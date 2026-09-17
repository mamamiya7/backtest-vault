/* Durable single-owner queue; never retry an uncertain source submission. */
(function(root){
'use strict';
const E=typeof module!=='undefined'?require('./experiments.js'):root.VaultExperiments;
const V=typeof module!=='undefined'?require('./core.js'):root.Vault;
const L=typeof module!=='undefined'?require('./source-layouts.js'):root.VaultSourceLayouts;
const S=typeof module!=='undefined'?require('./setup.js'):root.VaultSetup;
function createCoordinator({storage,runtime,probe,configure,openSource,clock=()=>Date.now(),uuid=()=>crypto.randomUUID()}){
 let serial=Promise.resolve();
 const get=async k=>(await storage.get(k))[k];
 const put=e=>storage.set({['experiment:'+e.id]:e});
 const collection=async prefix=>Object.entries(await storage.get(null)).filter(([k])=>k.startsWith(prefix)).map(([,v])=>v);
 const localDay=(time=clock())=>{const d=new Date(time);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
 const choiceText=value=>typeof value==='string'&&value.length<=4000&&!/[\u0000-\u001f\u007f]/.test(value);
 const sharedOptions=values=>{
  if(!Array.isArray(values)||values.length>3000)throw Error('Invalid cached menu.');
  return values.map(option=>{
   if(!option||!choiceText(option.label)||!option.label||option.value!==option.label||option.sourceValue!==undefined&&!choiceText(option.sourceValue)||option.disabled!==undefined&&typeof option.disabled!=='boolean')throw Error('Invalid cached option.');
   return {value:option.value,label:option.label,...(option.sourceValue!==undefined?{sourceValue:option.sourceValue}:{}),...(option.disabled!==undefined?{disabled:option.disabled}:{})};
  });
 };
 const publicChoices=p=>({schemaVersion:1,adapterVersion:L.version,publicOnly:true,stages:Object.fromEntries(['momentum','execution'].map(stage=>{
  const source=p.stages[stage],layout=stage==='momentum'?L.main(source.context.chart):L.execution(source.context.chart),children=new Set(layout.rows.map(row=>row.childIndex)),raw=source.context;
  if(stage==='momentum'?raw.market!=='NSE':raw.selection!=='Price')throw Error('Unsupported cached context.');
  if(!Array.isArray(raw.categories)||raw.categories.length!==layout.rows.length)throw Error('Invalid cached categories.');
  const categories=layout.rows.map((row,i)=>{const pair=raw.categories[i];if(!Array.isArray(pair)||pair.length!==2||pair[0]!==row.parentIndex||!(row.name==='Radar'?['Pre','My']:['Pre','My','Public','Popular']).includes(pair[1]))throw Error('Invalid cached category context.');return [row.parentIndex,pair[1]];});
  const context={chart:layout.chart,...(stage==='momentum'?{market:'NSE'}:{selection:'Price'}),...(Number.isInteger(layout.modeIndex)?{mode:raw.mode}:{}),categories};
  if(Number.isInteger(layout.modeIndex)&&(layout.chart==='Renko'?!['Absolute','Percent','ATR','ATR %'].includes(raw.mode):typeof raw.mode!=='string'||!/^\d{1,3}$/.test(raw.mode)||Number(raw.mode)<1))throw Error('Invalid cached chart mode.');
  if(!Array.isArray(source.signature)||source.signature.length!==layout.count)throw Error('Invalid cached signature.');
  const signature=source.signature.map(pair=>{if(!Array.isArray(pair)||pair.length!==2||!['select-one','text','date','checkbox','radio'].includes(pair[0])||!choiceText(pair[1])||!pair[1])throw Error('Invalid cached control.');return [pair[0],pair[1]];});
  const fields=signature.map(([type,label],index)=>({index,type,label,value:'',checked:['checkbox','radio'].includes(type)?false:null,disabled:false}));fields[layout.chartIndex].value=layout.chart;fields[stage==='momentum'?layout.marketIndex:layout.selectionIndex].value=stage==='momentum'?'NSE':'Price';for(const [index,category]of categories)fields[index].value=category;L.stage(stage,fields);
  const nativeOptions=Object.fromEntries(signature.flatMap(([type],index)=>type==='select-one'&&!children.has(index)?[[index,sharedOptions(source.nativeOptions?.[index])]]:[]));
  return [stage,{context,signature,nativeOptions,ruleCatalogues:Object.fromEntries(layout.rows.map(row=>{
   const catalogue=source.ruleCatalogues?.[row.childIndex]||{},names=Object.keys(catalogue.categories||{}).filter(category=>['Pre','Popular'].includes(category)&&catalogue.controlTypes?.[category]==='select-one'),indices=[row.parentIndex,row.childIndex,...(Number.isInteger(row.valueIndex)?[row.valueIndex]:[]),row.gateIndex];
   const fieldLabels=Object.fromEntries(names.filter(category=>catalogue.fieldLabels?.[category]).map(category=>{const labels=catalogue.fieldLabels[category];if(!Array.isArray(labels)||labels.length!==indices.length||labels.some(label=>!choiceText(label)||!label))throw Error('Invalid cached rule labels.');return [category,[...labels]];}));
   if(catalogue.labelDependents&&JSON.stringify(catalogue.labelDependents)!==JSON.stringify(layout.labelDependents[row.childIndex]||[]))throw Error('Invalid cached label relationships.');
   return [row.childIndex,{parentIndex:row.parentIndex,gateIndex:row.gateIndex,categories:Object.fromEntries(names.map(category=>[category,sharedOptions(catalogue.categories[category])])),controlTypes:Object.fromEntries(names.map(category=>[category,'select-one'])),fieldLabels,...(catalogue.labelDependents?{labelDependents:[...catalogue.labelDependents]}:{})}];
  }))}];
 }))});
 const validChoicePayload=(p,tab,shared=false)=>{
  try{return p&&p.schemaVersion===1&&p.adapterVersion===L.version&&(shared?p.publicOnly===true&&JSON.stringify(p)===JSON.stringify(publicChoices(p)):p.publicOnly!==true&&p.session===tab.session&&!!publicChoices(p))&&JSON.stringify(p).length<=2000000;}catch{return false;}
 };
 const choiceKey=p=>JSON.stringify(['momentum','execution'].map(stage=>p.stages[stage].context));
 async function readChoiceCache(tab,force){
  const key='runner:choices:'+tab.id,sharedKey='runner:choices:shared-native';
  if(force){await storage.set({[key]:null,[sharedKey]:null});return {key,sharedKey,day:localDay(),records:[]};}
  const saved=await get(key),shared=await get(sharedKey),day=localDay();
  const validRecord=(r,publicOnly)=>validChoicePayload(r?.payload,tab,publicOnly)&&typeof r.checkedAt==='string'&&Number.isFinite(Date.parse(r.checkedAt))&&Date.parse(r.checkedAt)<=clock()&&localDay(Date.parse(r.checkedAt))===day;
  const own=saved?.version===L.version&&saved.session===tab.session&&saved.day===day&&Array.isArray(saved.records)?saved.records.filter(r=>validRecord(r,false)).slice(-9):[];
  const known=new Set(own.map(r=>choiceKey(r.payload))),publicRecords=shared?.version===L.version&&shared.day===day&&Array.isArray(shared.records)?shared.records.filter(r=>validRecord(r,true)&&!known.has(choiceKey(r.payload))).slice(-9):[];
  return {key,sharedKey,day,records:[...own,...publicRecords]};
 }
 async function retainChoices(tab,cache,response){
  const day=localDay(),rolledOver=cache.day!==day;
  let records=rolledOver?[]:cache.records,writeFailed=false;
  // A reply that reused yesterday's choices cannot renew them after midnight.
  const oldChoicesUsed=response.hasCachedChoices===true||response.choicesFromCache===true||cache.records.length>0&&response.hasCachedChoices!==false;
  if(validChoicePayload(response.choiceCache,tab)&&!(rolledOver&&oldChoicesUsed)){
   const payload=response.choiceCache,key=choiceKey(payload),existing=records.find(r=>choiceKey(r.payload)===key);
   const checkedAt=(response.choicesFromCache===true||response.sharedChoicesUsed===true)&&existing?existing.checkedAt:new Date(clock()).toISOString();
   records=[...records.filter(r=>choiceKey(r.payload)!==key),{payload,checkedAt}].slice(-18);
   // RZone exposes no stable account identifier. Only shared Pre/Popular
   // menus cross document boundaries. Group, My and keyword-search results
   // remain document-scoped and are read again after reconnecting.
   const privateRecords=records.filter(r=>r.payload.publicOnly!==true).slice(-9),sharedRecords=records.slice(-9).map(r=>({checkedAt:r.checkedAt,payload:publicChoices(r.payload)}));
   try{await storage.set({[cache.key]:{version:L.version,session:tab.session,day,records:privateRecords},[cache.sharedKey]:{version:L.version,day,records:sharedRecords}});}catch{writeFailed=true;}
  }
  const covered=stage=>new Set(records.map(r=>r.payload.stages[stage].context.chart));
  const main=covered('momentum'),execution=covered('execution'),charts=L.charts.filter(chart=>main.has(chart)&&execution.has(chart));
  return {checkedAt:records.map(r=>r.checkedAt).sort().at(-1)||null,source:response.choicesFromCache===true?'cache':'live',scope:response.sharedChoicesUsed===true?'shared-native':'document',charts,pendingCharts:L.charts.filter(chart=>!charts.includes(chart)),...(writeFailed?{notSaved:true}:{})};
 }

 async function sourceStatus(tab){
  if(!tab)return null;
  if(!probe)return clock()-tab.seenAt<15000?tab:null;
  // A direct reply does not depend on background-page interval scheduling.
  // Probing never renews a trial lease or changes its document owner.
  try{const r=await probe(tab.id);if(!r||r.session!==tab.session)return null;
   return {...tab,ready:r.ready===true,capable:r.capable===true||r.ready===true,chart:String(r.chart||'').slice(0,30),reason:String(r.reason||'').slice(0,180)};
  }catch{return null;}
 }
 async function reviewLease(){
  const l=await get('runner:lease');if(!l||clock()-l.seenAt<90000)return l;
  const e=await get('experiment:'+l.experimentId),t=e?.trials.find(t=>t.id===l.trialId);
  if(t&&E.active.includes(t.status)){t.status='uncertain';t.error='Source tab stopped responding. Check for a saved report before skipping.';e.status='needs-review';E.journal(e,t.error);await put(e);}
  return l;
 }
 function validateCapture(e,t,r){
  if(!r||r.id!==t.runId||r.experiment?.id!==e.id||r.experiment?.trialId!==t.id||r.experiment?.phase!==t.phase||r.provenance!=='recorded-at-submit')throw Error('A matching durable capture has not been saved.');
  if(e.demo||r.demo===true)throw Error('A fictional result cannot complete a real RZone trial.');
  V.validate(r);if(r.charts.length!==6||r.trades.rows.length!==V.metrics(r).trades)throw Error('The saved report is incomplete.');
  const planned=E.expected(e,t);for(const s of ['momentum','execution','portfolio'])E.verify(E.fields(planned,s),E.fields(r,s));
  E.verifyEvidence(e,t,r);
 }
 async function execute(m,sender){
  const source=sender.id===runtime.id&&sender.tab&&(sender.frameId===undefined||sender.frameId===0)&&new URL(sender.url||'https://invalid/').origin==='https://zone.definedgesecurities.com';
  const url=runtime.getURL('index.html'),dashboard=sender.id===runtime.id&&(sender.url===url||sender.url?.startsWith(url+'?'));
  if(!source&&!dashboard)throw Error('This page cannot control experiments.');
  if(source&&m.action==='hello'){
   if(typeof m.session!=='string'||m.session.length>80)throw Error('Invalid source session.');
   await storage.set({['runner:tab:'+sender.tab.id]:{id:sender.tab.id,session:m.session,seenAt:clock(),ready:m.ready===true,capable:m.capable===true||m.ready===true,chart:String(m.chart||'').slice(0,30)}});
   // Review the old deadline before accepting a late heartbeat. A returning tab
   // cannot erase a period during which its submission outcome was unknown.
   const l=await reviewLease();if(l?.tabId===sender.tab.id&&l.session===m.session&&!m.failed){const owned=await get('experiment:'+l.experimentId),trial=owned?.trials.find(t=>t.id===l.trialId);if(['running','pausing'].includes(owned?.status)&&E.active.includes(trial?.status)){l.seenAt=clock();await storage.set({'runner:lease':l});}}
   const mine=(await collection('experiment:')).find(e=>e.status==='running'&&e.owner?.tabId===sender.tab.id&&e.owner.session===m.session);
   return {ok:true,id:mine?.id||null};
  }
  if(dashboard&&m.action==='list'){
   await reviewLease();const tabs=(await Promise.all((await collection('runner:tab:')).map(sourceStatus))).filter(Boolean);return {ok:true,experiments:await collection('experiment:'),tabs};
  }
  if(dashboard&&m.action==='create'){
   const e=E.create({...m.plan,id:uuid()});if(e.demo)throw Error('Fictional experiments cannot control RZone.');
   if(await get('experiment:'+e.id))throw Error('Experiment ID already exists.');await put(e);return {ok:true,experiment:e};
  }
  if(dashboard&&['configure','lookup-rule','open-source'].includes(m.action)){
   if(await reviewLease()||(await collection('experiment:')).some(x=>['running','pausing'].includes(x.status)))throw Error('Finish or pause the current tests before changing the RZone setup.');
   if(m.action==='open-source'){
    if(!openSource)throw Error('Open RZone in Chrome and sign in, then reconnect here.');
    return {ok:true,...await openSource(await collection('runner:tab:'))};
   }
   if(!configure)throw Error('Reload the updated extension and refresh RZone to connect the setup editor.');
   const tab=await sourceStatus(await get('runner:tab:'+m.tabId));
   if(!tab?.capable&&!tab?.ready)throw Error(tab?.reason||'Open RZone and sign in, then connect again.');
   if(m.action==='lookup-rule'){
    if(m.session!==tab.session)throw Error('RZone changed or reloaded. Reconnect before searching for strategies.');
    const stage=m.stage===undefined?'momentum':m.stage,parents=stage==='momentum'?[39,41,43,45,47,49]:stage==='execution'?[6,10]:[];
    if(!parents.includes(m.parentIndex)||!['My','Public'].includes(m.category)||typeof m.query!=='string'||!m.query.length||m.query.length>200||m.query!==m.query.trim()||/[\u0000-\u001f\u007f]/.test(m.query))throw Error('Enter a strategy search of 1–200 characters.');
    const request={stage,parentIndex:m.parentIndex,category:m.category,query:m.query,session:tab.session};
    const r=await configure(tab.id,{},request);
    if(!r?.ok)throw Error(r?.error||'RZone strategy search could not be read.');
    if(r.session!==tab.session)throw Error('RZone reloaded during the search. Reconnect and try again.');
    const result=r.result;
    // Older source readers omitted stage for momentum searches. Execution
    // must identify its stage explicitly; its result cannot satisfy a main-form query.
    const resultStage=result?.stage===undefined?'momentum':result.stage;
    if(!result||resultStage!==stage||result.parentIndex!==m.parentIndex||result.childIndex!==m.parentIndex+1||result.category!==m.category||result.query!==m.query||result.controlType!=='text'||!Array.isArray(result.options)||result.options.length>3000)throw Error('RZone returned a different strategy search. Search again.');
    return {ok:true,result};
   }
   const changes=m.changes??{};
   if(!changes||typeof changes!=='object'||Array.isArray(changes)||Object.keys(changes).some(k=>!['momentum','execution'].includes(k)))throw Error('Invalid source choices request.');
   for(const values of Object.values(changes))if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).length>10||Object.entries(values).some(([index,value])=>!/^\d{1,2}$/.test(index)||typeof value!=='string'||value.length>2000))throw Error('Invalid source choices request.');
   if(m.recheckAllChoices!==undefined&&typeof m.recheckAllChoices!=='boolean'||m.warmChart!==undefined&&!L.charts.includes(m.warmChart)||m.warmChart&&Object.keys(changes).length)throw Error('Invalid source choice refresh.');
   const cache=await readChoiceCache(tab,m.recheckAllChoices===true);
   const options={cachedChoices:cache.records.map(r=>r.payload),forceChoices:m.recheckAllChoices===true,...(m.warmChart?{warmChart:m.warmChart}:{})};
   const r=await configure(tab.id,changes,undefined,options);
   if(!r?.ok)throw Error(r?.error||'RZone setup could not be read.');
   if(r.session!==tab.session||r.config?.session!==tab.session)throw Error('RZone reloaded while connecting. Connect again.');
   S.template(r.config);
   // Choice caches are deliberately outside run/experiment archives. They are
   // split into document-private and daily shared native choices. Current
   // settings always came from the fresh response, never from stored menus.
   const choiceCache=await retainChoices(tab,cache,r);
   return {ok:true,source:{...r.config,choiceCache}};
  }
  if(m.action==='delete'){
   if(!dashboard)throw Error('Only Vault can delete a study.');
   if(typeof m.id!=='string'||!/^[a-zA-Z0-9_-]{1,120}$/.test(m.id))throw Error('Invalid study.');
   // Expiry keeps its lease until the interrupted submission is reviewed. A
   // stale deadline is not permission to discard source ownership.
   const lease=await reviewLease(),current=await get('experiment:'+m.id);
   if(!current){if(lease?.experimentId===m.id)throw Error('Review this study\'s interrupted test before deleting it.');return {ok:true,deleted:false};}
   if(current.id!==m.id)throw Error('The saved study identity does not match.');
   E.validate(current);
   const reason=E.deletionReason(current);if(reason)throw Error(reason);
   if(lease?.experimentId===current.id)throw Error('Review this study\'s interrupted test before deleting it.');
   // This command shares the start/claim/checkpoint queue. It removes only
   // the plan; saved result records remain independently available in Vault.
   await storage.remove('experiment:'+current.id);return {ok:true,deleted:true};
  }
  const e=await get('experiment:'+m.id);if(!e)throw Error('Experiment not found.');E.validate(e);
  if(dashboard){
   if(m.action==='start'){
    if(await reviewLease())throw Error('A trial still owns the source tab. Finish or review it first.');
    if((await collection('experiment:')).some(x=>x.id!==e.id&&['running','pausing'].includes(x.status)))throw Error('Another experiment is running.');
    if(!['draft','paused'].includes(e.status)||e.trials.some(t=>t.status==='uncertain'))throw Error('Review interrupted trials before resuming.');
    const tab=await sourceStatus(await get('runner:tab:'+m.tabId));if(!tab?.ready)throw Error(tab?.reason||'RZone is not responding. Open its Momentum BackTesting page with the updated extension, then try again.');
    if(e.demo||!e.trials.some(t=>t.status==='queued'))throw Error('There are no queued real trials.');
    if(E.fields(e.baseline,'momentum')[0].value!=='Candle'||E.fields(e.baseline,'execution')[3].value!=='Candle')throw Error('P&F and Renko plans can be saved; live execution is waiting for separate adapter acceptance tests.');
    e.owner={tabId:tab.id,session:tab.session};e.status='running';E.journal(e,'Started on selected RZone tab');await put(e);return {ok:true};
   }
   if(m.action==='pause'){if(['running','pausing'].includes(e.status)){e.status=(await get('runner:lease'))?.experimentId===e.id?'pausing':'paused';if(e.status==='paused')delete e.owner;E.journal(e,'Stop after current trial requested');await put(e);}return {ok:true};}
   if(m.action==='skip'){
    const t=e.trials.find(t=>t.id===m.trialId);if(!t||t.status!=='uncertain')throw Error('Only an interrupted trial can be skipped.');
    const l=await get('runner:lease');if(l?.experimentId===e.id&&clock()-l.seenAt<90000)throw Error('Wait for the interrupted source session to disconnect before skipping.');
    t.status='skipped';E.journal(e,'User skipped interrupted trial '+t.ordinal);e.status='paused';delete e.owner;await storage.set({['experiment:'+e.id]:e,...(l?.experimentId===e.id?{'runner:lease':null}:{})});return {ok:true};
   }
   if(m.action==='reconcile'){
    const lease=await get('runner:lease');if(lease&&lease.experimentId!==e.id)throw Error('Another experiment owns the source tab.');
    const t=e.trials.find(t=>t.id===m.trialId),r=t&&await get('run:'+t.runId);if(!t||t.status!=='uncertain'||!r)throw Error('No durable result is available to reconcile.');
    validateCapture(e,t,r);t.status='saved';t.error=null;e.status='paused';delete e.owner;E.journal(e,'Recovered saved result for trial '+t.ordinal);await storage.set({['experiment:'+e.id]:e,'runner:lease':null});return {ok:true};
   }
   if(m.action==='validate'){
    const t=e.trials.find(t=>t.id===m.trialId),r=t&&await get('run:'+t.runId);if(!t||!E.result(e,t,r).eligible)throw Error('Choose a candidate that meets the fixed rules.');
    E.validation(e,t.id,m.period,m.phase);await put(e);return {ok:true};
   }
   throw Error('Unknown experiment command.');
  }
  if(e.owner?.tabId!==sender.tab.id||e.owner?.session!==m.session)throw Error('This source tab does not own the experiment.');
  if(m.action==='claim'){
   if(e.status!=='running'||await reviewLease())return {ok:true,trial:null};
   const interrupted=e.trials.find(t=>E.active.includes(t.status));if(interrupted){interrupted.status='uncertain';interrupted.error='The active trial lost its saved ownership record. Review the source result before continuing.';e.status='needs-review';E.journal(e,interrupted.error);await put(e);return {ok:true,trial:null};}
   const evidence=e.mode==='adaptive'?(await Promise.all(e.trials.filter(t=>t.phase==='discovery'&&t.status==='saved').map(t=>get('run:'+t.runId)))).filter(Boolean):[];const t=E.nextTrial(e,evidence);if(!t){e.status='complete';delete e.owner;E.journal(e,'Stage complete');await put(e);return {ok:true,trial:null};}
   // Never overwrite an existing record under a queued trial's ID. This can
   // happen after a partial backup/import or a lost acknowledgement.
   if(await get('run:'+t.runId)){t.status='uncertain';t.error='A saved record already exists for this trial. Review it before continuing.';e.status='needs-review';E.journal(e,t.error);await put(e);return {ok:true,trial:null};}
   const token=uuid();t.execution={sourceSession:m.session,claimedAt:new Date(clock()).toISOString()};E.transition(e,t,'applying');await storage.set({['experiment:'+e.id]:e,'runner:lease':{experimentId:e.id,trialId:t.id,token,tabId:sender.tab.id,session:m.session,seenAt:clock()}});
   return {ok:true,experiment:e,trial:t,token};
  }
  const l=await reviewLease(),t=e.trials.find(t=>t.id===m.trialId);
  if(!l||l.experimentId!==e.id||l.trialId!==t?.id||l.token!==m.token||l.session!==m.session)throw Error('Trial ownership changed. Stop and review.');
  if(clock()-l.seenAt>=90000)throw Error('Trial ownership expired. Stop and review the current source result.');
  if(m.action==='fail'){t.status='uncertain';t.error=String(m.error||'Interrupted').slice(0,1000);e.status='needs-review';E.journal(e,'Trial '+t.ordinal+': '+t.error);await put(e);return {ok:true};}
  if(m.action==='checkpoint'){
   if(!['running','pausing'].includes(e.status))throw Error('Experiment is paused for review.');
   if(m.stage==='saved')validateCapture(e,t,await get('run:'+t.runId));
   E.transition(e,t,m.stage);
   if(m.stage==='saved'){const remaining=e.trials.some(x=>x.status==='queued');e.status=!remaining?'complete':e.status==='pausing'?'paused':'running';if(e.status!=='running')delete e.owner;await storage.set({['experiment:'+e.id]:e,'runner:lease':null});}
   else {l.seenAt=clock();await storage.set({['experiment:'+e.id]:e,'runner:lease':l});}
   return {ok:true,status:e.status};
  }
  throw Error('Unknown runner command.');
 }
 return {handle(m,sender){const task=serial.then(()=>execute(m,sender));serial=task.catch(()=>{});return task;}};
}
if(typeof module!=='undefined')module.exports={createCoordinator};root.VaultExperimentCoordinator={createCoordinator};
})(typeof window!=='undefined'?window:globalThis);
