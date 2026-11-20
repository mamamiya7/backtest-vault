/* Durable single-owner queue; never retry an uncertain source submission. */
(function(root){
'use strict';
const E=typeof module!=='undefined'?require('./experiments.js'):root.VaultExperiments;
const V=typeof module!=='undefined'?require('./core.js'):root.Vault;
const L=typeof module!=='undefined'?require('./source-layouts.js'):root.VaultSourceLayouts;
const S=typeof module!=='undefined'?require('./setup.js'):root.VaultSetup;
function createCoordinator({storage,runtime,probe,configure,openSource,account,tabExists,clock=()=>Date.now(),uuid=()=>crypto.randomUUID()}){
 let serial=Promise.resolve();
 const validateStudy=E.createValidator();
 const get=async k=>(await storage.get(k))[k];
 const put=e=>storage.set({['experiment:'+e.id]:e});
 async function records(prefix,extra=[]){
  if(typeof storage.getKeys!=='function')return storage.get(null);
  const keys=await storage.getKeys();
  return storage.get([...keys.filter(key=>key.startsWith(prefix)),...extra]);
 }
 const collection=async prefix=>Object.entries(await records(prefix)).filter(([k])=>k.startsWith(prefix)).map(([,v])=>v);
 const localDay=(time=clock())=>{const d=new Date(time);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
 const choiceText=value=>typeof value==='string'&&value.length<=4000&&!/[\u0000-\u001f\u007f]/.test(value);
 const cacheSchema=2,dailyKey='runner:choices:daily',symbolKey='runner:choices:symbols';
 const nseSeedKey='runner:benchmark-seed:nse';
 const symbolMarkets=['NSE','BSE','MF','EQW'],symbolLimit=3000,symbolCacheLimit=2000000;
 const cacheStages=['momentum','execution','marketFilter'];
 const onlyKeys=(value,allowed)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw Error('Invalid cached metadata.');};
 const menuOptions=(values,symbol=false)=>{
  if(!Array.isArray(values)||values.length>3000)throw Error('Invalid cached menu.');
  // Storage may reorder object properties. Rebuild known metadata while
  // preserving the native option array order and exact source identities.
  return values.map(option=>{onlyKeys(option,['value','label','sourceValue','disabled','market']);if(!choiceText(option.label)||!option.label||option.value!==option.label||option.sourceValue!==undefined&&!choiceText(option.sourceValue)||option.disabled!==undefined&&typeof option.disabled!=='boolean'||option.market!==undefined&&(!choiceText(option.market)||!option.market)||symbol&&(!option.sourceValue||!option.market))throw Error('Invalid cached option.');return {value:option.value,label:option.label,...(option.sourceValue!==undefined?{sourceValue:option.sourceValue}:{}),...(option.disabled!==undefined?{disabled:option.disabled}:{}),...(option.market!==undefined?{market:option.market}:{})};});
 };
 const categoryNames=['Pre','My','Public','Popular'];
 function menuStage(stage,source){
  onlyKeys(source,['context','signature','nativeOptions','ruleCatalogues','groupOptions','symbolOptions','symbolQueries']);
  const c=source.context;onlyKeys(c,stage==='momentum'?['chart','market','relativeStrength','mode','categories','benchmarkMarkets']:stage==='execution'?['chart','selection','mode','categories','benchmarkMarkets']:['chart','mode','action','brickMode','exitBrickMode','categories','benchmarkMarkets']);
  if(!L.charts.includes(c.chart)||!Array.isArray(source.signature)||!source.signature.length||source.signature.length>80)throw Error('Invalid cached layout.');
  const signature=source.signature.map(pair=>{if(!Array.isArray(pair)||pair.length!==2||!['select-one','text','date','checkbox','radio'].includes(pair[0])||!choiceText(pair[1])||!pair[1])throw Error('Invalid cached control.');return [...pair];});
  const fields=signature.map(([type,label],index)=>({index,type,label,value:'',checked:['checkbox','radio'].includes(type)?false:null,disabled:false}));
  // Text-backed My/Public controls are part of the layout signature. The
  // category routes are checked against the known layout immediately below.
  if(!Array.isArray(c.categories))throw Error('Invalid cached categories.');
  for(const pair of c.categories){if(!Array.isArray(pair)||pair.length!==2||!Number.isInteger(pair[0])||!fields[pair[0]]||!categoryNames.includes(pair[1]))throw Error('Invalid cached category context.');fields[pair[0]].value=pair[1];}
  const context={chart:c.chart};let layout;
  if(stage==='momentum'){
   if(!choiceText(c.market)||!c.market||typeof c.relativeStrength!=='boolean')throw Error('Invalid cached market context.');Object.assign(context,{market:c.market,relativeStrength:c.relativeStrength});layout=L.main(c.chart,c.relativeStrength);fields[layout.chartIndex].value=c.chart;fields[layout.marketIndex].value=c.market;fields[layout.rsIndex].checked=c.relativeStrength;
  }else if(stage==='execution'){
   if(!['Price','RS','Both'].includes(c.selection))throw Error('Invalid cached selection context.');context.selection=c.selection;layout=L.execution(c.chart,c.selection);fields[layout.chartIndex].value=c.chart;fields[layout.selectionIndex].value=c.selection;
  }else{
   if(!['Index','RS'].includes(c.mode)||!L.marketActions.includes(c.action))throw Error('Invalid cached filter context.');Object.assign(context,{mode:c.mode,action:c.action});fields[0].value=c.chart;const topPrice=c.chart!=='Candle'&&fields[3]?.type==='radio'&&fields[4]?.type==='radio',offset=1+(c.chart==='Candle'?0:topPrice?4:2);if(!fields[offset+16])throw Error('Invalid cached filter layout.');fields[offset].checked=c.mode==='Index';fields[offset+3].checked=c.mode==='RS';fields[offset+8].checked=true;fields[offset+16].value=c.action;layout=L.marketFilter(fields);
  }
  const mode=(key,index)=>{if(!Number.isInteger(index)){if(Object.hasOwn(c,key))throw Error('Unexpected cached chart mode.');return;}const value=c[key];if(typeof value!=='string'||(layout.chart==='Renko'?!['Absolute','Percent','ATR','ATR %'].includes(value):!/^\d{1,3}$/.test(value)||Number(value)<1))throw Error('Invalid cached chart mode.');context[key]=value;fields[index].value=value;};
  if(stage==='marketFilter'){mode('brickMode',layout.modeIndex);mode('exitBrickMode',layout.exitModeIndex);}else mode('mode',layout.modeIndex);
  if(!Array.isArray(c.categories)||c.categories.length!==layout.rows.length)throw Error('Invalid cached categories.');context.categories=layout.rows.map((row,n)=>{const pair=c.categories[n];if(!Array.isArray(pair)||pair.length!==2||pair[0]!==row.parentIndex||!(row.name==='Radar'?['Pre','My']:categoryNames).includes(pair[1]))throw Error('Invalid cached category context.');fields[row.parentIndex].value=pair[1];return [...pair];});
  const symbols=['benchmarkIndex','indexSymbolIndex','numeratorSymbolIndex','denominatorSymbolIndex'].filter(key=>Number.isInteger(layout[key])).map(key=>layout[key]);
  if(c.benchmarkMarkets!==undefined){if(!Array.isArray(c.benchmarkMarkets)||c.benchmarkMarkets.length!==symbols.length)throw Error('Invalid cached benchmark markets.');context.benchmarkMarkets=symbols.map((index,n)=>{const pair=c.benchmarkMarkets[n];if(!Array.isArray(pair)||pair.length!==2||pair[0]!==index-1||!choiceText(pair[1])||!pair[1])throw Error('Invalid cached benchmark market.');fields[index-1].value=pair[1];return [...pair];});}
  L.stage(stage,fields);
  onlyKeys(source.nativeOptions,signature.flatMap(([type],index)=>type==='select-one'?[String(index)]:[]));
  const nativeOptions=Object.fromEntries(signature.flatMap(([type],index)=>type==='select-one'?[[index,menuOptions(source.nativeOptions[index])]]:[]));
  onlyKeys(source.ruleCatalogues,layout.rows.map(row=>String(row.childIndex)));
  const ruleCatalogues=Object.fromEntries(layout.rows.map(row=>{
   const catalogue=source.ruleCatalogues[row.childIndex];onlyKeys(catalogue,['parentIndex','gateIndex','categories','controlTypes','fieldLabels','searchQueries','labelDependents']);if(catalogue.parentIndex!==row.parentIndex||catalogue.gateIndex!==row.gateIndex)throw Error('Invalid cached rule route.');
   const names=Object.keys(catalogue.categories||{}),allowed=row.name==='Radar'?['Pre','My']:categoryNames;onlyKeys(catalogue.categories,allowed);if(!names.includes(fields[row.parentIndex].value))throw Error('Cached category is missing.');onlyKeys(catalogue.controlTypes,names);onlyKeys(catalogue.fieldLabels||{},names);onlyKeys(catalogue.searchQueries||{},names);
   const categories={},controlTypes={},fieldLabels={},searchQueries={},indices=[row.parentIndex,row.childIndex,...(Number.isInteger(row.valueIndex)?[row.valueIndex]:[]),row.gateIndex];
   for(const name of names){const type=catalogue.controlTypes[name];if(!['select-one','text'].includes(type)||type==='text'&&!['My','Public'].includes(name))throw Error('Invalid cached rule control.');categories[name]=menuOptions(catalogue.categories[name]);controlTypes[name]=type;if(catalogue.fieldLabels?.[name]){const labels=catalogue.fieldLabels[name];if(!Array.isArray(labels)||labels.length!==indices.length||labels.some(label=>!choiceText(label)||!label))throw Error('Invalid cached rule labels.');fieldLabels[name]=[...labels];}if(catalogue.searchQueries?.[name]!==undefined){if(type!=='text'||!choiceText(catalogue.searchQueries[name]))throw Error('Invalid cached rule query.');searchQueries[name]=catalogue.searchQueries[name];}}
   const out={parentIndex:row.parentIndex,gateIndex:row.gateIndex,categories,controlTypes,fieldLabels,searchQueries};if(catalogue.labelDependents!==undefined){if(JSON.stringify(catalogue.labelDependents)!==JSON.stringify(layout.labelDependents[row.childIndex]||[]))throw Error('Invalid cached label relationships.');out.labelDependents=[...catalogue.labelDependents];}return [row.childIndex,out];
  }));
  const out={context,signature,nativeOptions,ruleCatalogues};if(stage==='momentum')out.groupOptions=menuOptions(source.groupOptions);else if(source.groupOptions!==undefined)throw Error('Unexpected cached groups.');
  for(const [name,symbol]of [['symbolOptions',true],['symbolQueries',false]])if(source[name]!==undefined){onlyKeys(source[name],symbols.map(String));out[name]=Object.fromEntries(Object.entries(source[name]).map(([index,value])=>{if(symbol)return [index,menuOptions(value,true)];onlyKeys(value,['market','query']);if(!choiceText(value.market)||!value.market||!choiceText(value.query))throw Error('Invalid cached symbol query.');return [index,{market:value.market,query:value.query}];}));}
  return out;
 }
 function choicePayload(p,tab,daily=false){
  onlyKeys(p,daily?['schemaVersion','adapterVersion','daily','stages']:['schemaVersion','adapterVersion','session','stages']);
  if(p.schemaVersion!==cacheSchema||p.adapterVersion!==L.version||(daily?p.daily!==true:p.session!==tab.session)||JSON.stringify(p).length>2000000)throw Error('Invalid cached source.');
  onlyKeys(p.stages,cacheStages);if(!Object.keys(p.stages).length)throw Error('Empty cached source.');return {schemaVersion:cacheSchema,adapterVersion:L.version,daily:true,stages:Object.fromEntries(cacheStages.filter(stage=>p.stages[stage]).map(stage=>[stage,menuStage(stage,p.stages[stage])]))};
 }
 const choiceKey=p=>JSON.stringify(Object.entries(p.stages).map(([stage,value])=>[stage,value.context,value.signature]));
 const lookupKey=tab=>'runner:lookup:'+tab.id;
 function lookupRoutes(template,session){
  const rules=[],symbols=[];
  const add=(stage,descriptor)=>{
   if(!descriptor)return;const layout=L.stage(stage,descriptor.fields);
   for(const row of layout.rows||[])if(row.name!=='Radar')rules.push({stage,parentIndex:row.parentIndex,childIndex:row.childIndex,categories:(descriptor.options?.[row.parentIndex]||[]).filter(option=>!option.disabled&&['My','Public'].includes(option.value)).map(option=>option.value)});
   const pairs=stage==='marketFilter'?[[layout.indexMarketIndex,layout.indexSymbolIndex],[layout.numeratorMarketIndex,layout.numeratorSymbolIndex],[layout.denominatorMarketIndex,layout.denominatorSymbolIndex]]:[[layout.benchmarkMarketIndex,layout.benchmarkIndex]];
   for(const [marketIndex,fieldIndex]of pairs)if(Number.isInteger(marketIndex)&&Number.isInteger(fieldIndex)&&descriptor.fields[fieldIndex]?.type==='text')symbols.push({stage,fieldIndex,marketIndex,role:['benchmarkIndex','indexSymbolIndex','numeratorSymbolIndex','denominatorSymbolIndex'].find(key=>layout[key]===fieldIndex),markets:(descriptor.options?.[marketIndex]||[]).filter(option=>!option.disabled).map(option=>option.value)});
  };
  add('momentum',template.stages.momentum);add('momentum',template.stages.momentum.relativeStrength);add('execution',template.stages.execution);add('marketFilter',template.stages.marketFilter);
  return {session,rules,symbols};
 }
 const queryValid=query=>typeof query==='string'&&query.length>0&&query.length<=200&&query===query.trim()&&!/[\u0000-\u001f\u007f]/.test(query);
 const symbolQueryKey=entry=>JSON.stringify([entry.market,entry.query]);
 function symbolResultOptions(options,market){
  if(!['All',...symbolMarkets].includes(market))throw Error('Invalid cached symbol market.');
  const out=menuOptions(options,true);if(out.some(option=>!symbolMarkets.includes(option.market)||market!=='All'&&option.market!==market))throw Error('Invalid cached symbol exchange.');return out;
 }
 async function readSymbolQueries(seed=false){
  const day=localDay(),records=[],saved=await get(seed?nseSeedKey:symbolKey);
  try{
   onlyKeys(saved,['version','cacheVersion','day','records']);
   if(saved.version!==L.version||saved.cacheVersion!==1||!seed&&saved.day!==day||!Array.isArray(saved.records)||JSON.stringify(saved).length>symbolCacheLimit)return {day,records};
   for(const record of saved.records.slice(-128))try{
    onlyKeys(record,['market','query','checkedAt','options']);const at=Date.parse(record.checkedAt);
    if(!queryValid(record.query)||typeof record.checkedAt!=='string'||!Number.isFinite(at)||at>clock()||(seed?record.market!=='NSE'||!S.nseBenchmarkQueries.includes(record.query):localDay(at)!==day))continue;
    records.push({market:record.market,query:record.query,checkedAt:record.checkedAt,options:symbolResultOptions(record.options,record.market)});
   }catch{/* Only validated query results can satisfy another field's search. */}
  }catch{/* Missing or malformed receipts require a fresh source search. */}
  return {day,records};
 }
 async function retainSymbolQuery(cache,market,query,options){
  // A query started on yesterday's cache cannot mark those choices fresh today.
  if(cache.day!==localDay())return {day:localDay(),records:[]};
  const record={market,query,checkedAt:new Date(clock()).toISOString(),options},key=symbolQueryKey(record);
  if(JSON.stringify(record).length>symbolCacheLimit-200)return cache;
  let records=[...cache.records.filter(entry=>symbolQueryKey(entry)!==key),record].slice(-128);
  const payload=()=>({version:L.version,cacheVersion:1,day:cache.day,records});
  while(records.length&&JSON.stringify(payload()).length>symbolCacheLimit)records.shift();
  try{await storage.set({[symbolKey]:payload()});}catch{/* A live search remains usable when local storage is unavailable. */}
  return {day:cache.day,records};
 }
 async function benchmarkQueries(){
  const daily=await readSymbolQueries(),seed=await readSymbolQueries(true);
  return {day:daily.day,records:[...seed.records,...daily.records],seeded:seed.records.length};
 }
 async function seedBenchmarks(tab,route,m,cache){
  const queries=m.seedQueries;
  if(route.stage!=='momentum'||route.role!=='benchmarkIndex'||m.market!=='NSE'||!route.markets.includes('NSE')||!Array.isArray(queries)||!queries.length||queries.length>5||new Set(queries).size!==queries.length||queries.some(query=>!S.nseBenchmarkQueries.includes(query)))throw Error('Choose supported NSE benchmark search terms.');
  const seed=await readSymbolQueries(true),done=new Set(seed.records.map(record=>record.query)),pending=queries.filter(query=>!done.has(query));
  if(pending.length){
   const r=await configure(tab.id,{}, {kind:'symbol',stage:'momentum',fieldIndex:route.fieldIndex,market:'NSE',session:tab.session,query:pending[0],seedQueries:pending,...(m.lookupTemplate?{lookupTemplate:m.lookupTemplate}:{})});
   if(!r?.ok||r.session!==tab.session)throw Error(r?.error||'RZone reloaded during the benchmark search.');
   const result=r.result;
   if(!result||result.stage!=='momentum'||result.fieldIndex!==route.fieldIndex||result.market!=='NSE'||!Array.isArray(result.seeded)||result.seeded.length!==pending.length||result.seeded.some((entry,i)=>entry?.query!==pending[i]))throw Error('RZone returned different benchmark searches.');
   const checkedAt=new Date(clock()).toISOString();
   const records=[...seed.records,...result.seeded.map(entry=>({market:'NSE',query:entry.query,checkedAt,options:symbolResultOptions(entry.options,'NSE')}))];
   const payload={version:L.version,cacheVersion:1,day:localDay(),records};
   if(JSON.stringify(payload).length>symbolCacheLimit)throw Error('The NSE benchmark list exceeded its storage limit.');
   await storage.set({[nseSeedKey]:payload});
  }
  const combined=await benchmarkQueries();
  return {ok:true,result:{seeded:combined.seeded,...knownSymbolChoices(cache,combined,'NSE',[],route.markets)}};
 }
 function cachedSymbolChoices(queries){
  const identities=new Map();if(queries.day===localDay())for(const record of queries.records)for(const option of record.options){const key=JSON.stringify([option.market,option.sourceValue]);identities.delete(key);identities.set(key,option);}
  // Preserve exchange identities here. Label ambiguity is resolved only after
  // the receiving field's market is known.
  return [...identities.values()].slice(-symbolLimit);
 }
 function knownSymbolChoices(choices,queries,market,current=[],allowedMarkets=symbolMarkets){
  const previous=[];
  if(choices.day===localDay())for(const record of choices.records)for(const stage of Object.values(record.payload.stages))for(const options of Object.values(stage.symbolOptions||{}))previous.push(...options);
  if(queries.day===localDay())for(const record of queries.records)previous.push(...record.options);
  const permitted=option=>allowedMarkets.includes(option.market),all=S.mergeSymbolChoices(previous.filter(permitted),current.filter(permitted),market),identities=new Set(current.map(option=>JSON.stringify([option.market,option.sourceValue])));
  // Keep current source/query choices first in importance when bounding a
  // large discovered pool. Resolve ambiguity before dropping older entries.
  const ordered=[...all.filter(option=>!identities.has(JSON.stringify([option.market,option.sourceValue]))),...all.filter(option=>identities.has(JSON.stringify([option.market,option.sourceValue])))];
  return {knownOptions:ordered.slice(-symbolLimit),...(ordered.length>symbolLimit?{knownOptionsTruncated:true}:{})};
 }
 function enrichSymbolChoices(config,choices,queries){
  const source=structuredClone(config);
  for(const stage of ['momentum','execution','marketFilter']){
   const main=source.stages[stage],descriptors=stage==='momentum'?[main,main?.relativeStrength,main?.withoutRelativeStrength]:[main];
   for(const descriptor of descriptors.filter(Boolean)){
    const layout=L.stage(stage,descriptor.fields);
    for(const role of ['benchmarkIndex','indexSymbolIndex','numeratorSymbolIndex','denominatorSymbolIndex']){
     const index=layout[role];if(!Number.isInteger(index))continue;
     const market=descriptor.fields[index-1].value,markets=(descriptor.options?.[index-1]||[]).filter(option=>!option.disabled).map(option=>typeof option==='string'?option:option.value),known=knownSymbolChoices(choices,queries,market,descriptor.options?.[index]||[],markets);
     (descriptor.options||={})[index]=known.knownOptions;
    }
   }
  }
  S.template(source);return source;
 }
 async function readChoiceCache(tab,force){
  const day=localDay();
  if(force){const old=await storage.get(null);await storage.set({...Object.fromEntries(Object.keys(old).filter(key=>key.startsWith('runner:choices:')).map(key=>[key,null])),[dailyKey]:null});return {key:dailyKey,day,records:[]};}
  const saved=await get(dailyKey),records=[];
  if(saved?.version===L.version&&saved.cacheVersion===cacheSchema&&saved.day===day&&Array.isArray(saved.records))for(const record of saved.records.slice(-128)){
   try{if(typeof record?.checkedAt!=='string'||!Number.isFinite(Date.parse(record.checkedAt))||Date.parse(record.checkedAt)>clock()||localDay(Date.parse(record.checkedAt))!==day)continue;const payload=choicePayload(record.payload,tab,true);if(Object.keys(payload.stages).length!==1)continue;records.push({checkedAt:record.checkedAt,payload});}catch{/* Malformed metadata is never overlaid onto source controls. */}
  }
  return {key:dailyKey,day,records,...(saved?.version===L.version&&saved.cacheVersion===cacheSchema&&saved.day===day&&L.charts.includes(saved.warmInterruptedChart)?{warmInterruptedChart:saved.warmInterruptedChart}:{})};
 }
 async function retainChoices(tab,cache,response){
  const day=localDay(),rolledOver=cache.day!==day;let records=rolledOver?[]:cache.records,writeFailed=false;
  // Crossing midnight must never make yesterday's reused metadata look fresh.
  const oldChoicesUsed=response.hasCachedChoices===true||response.choicesFromCache===true||cache.records.length>0&&response.hasCachedChoices!==false;
  try{
   const receipts=[choicePayload(response.choiceCache,tab),...(response.relativeChoiceCache?[choicePayload(response.relativeChoiceCache,tab)]:[])];
   if(!(rolledOver&&oldChoicesUsed)){
    for(const received of receipts)for(const [stage,value]of Object.entries(received.stages)){
     const payload={schemaVersion:cacheSchema,adapterVersion:L.version,daily:true,stages:{[stage]:value}},key=choiceKey(payload),existing=records.find(record=>choiceKey(record.payload)===key);
     records=[...records.filter(record=>choiceKey(record.payload)!==key),{payload,checkedAt:existing?.checkedAt||new Date(clock()).toISOString()}].slice(-128);
    }
    try{await storage.set({[dailyKey]:{version:L.version,cacheVersion:cacheSchema,day,records,...(!rolledOver&&cache.warmInterruptedChart?{warmInterruptedChart:cache.warmInterruptedChart}:{})}});}catch{writeFailed=true;}
   }
  }catch{writeFailed=true;/* Never report invalid metadata as successfully saved. */}
  const covered=stage=>new Set(records.flatMap(record=>{const context=record.payload.stages[stage]?.context;return context&&(stage!=='momentum'||context.relativeStrength===false)&&(!context.selection||context.selection==='Price')?[context.chart]:[];}));
  const main=covered('momentum'),execution=covered('execution'),charts=L.charts.filter(chart=>main.has(chart)&&execution.has(chart));
  return {checkedAt:records.map(record=>record.checkedAt).sort().at(-1)||null,day,source:response.choicesFromCache===true?'cache':'live',scope:'daily',charts,pendingCharts:L.charts.filter(chart=>!charts.includes(chart)),complete:charts.length===L.charts.length,...(!rolledOver&&cache.warmInterruptedChart?{warmInterruptedChart:cache.warmInterruptedChart}:{}),...(writeFailed?{notSaved:true}:{})};
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
 async function reviewLease(state){
  const l=state?state['runner:lease']:await get('runner:lease');if(!l||clock()-l.seenAt<90000)return l;
  const key='experiment:'+l.experimentId,e=state?state[key]:await get(key),t=e?.trials.find(t=>t.id===l.trialId);
  if(t&&E.active.includes(t.status)){t.status='uncertain';t.error='Source tab stopped responding. Check for a saved report before skipping.';e.status='needs-review';E.journal(e,t.error);await put(e);}
  return l;
 }
 async function recoverReplacedSource(tabId,session,confirmed){
  const registration='runner:tab:'+tabId;
  const state=await records('experiment:',['runner:lease',registration]),lease=state['runner:lease'];
  const replaced=owner=>owner?.tabId===tabId&&typeof owner.session==='string'&&owner.session!==session;
  const deadLease=replaced(lease),studies=Object.entries(state).filter(([key,e])=>key.startsWith('experiment:')&&(replaced(e.owner)||deadLease&&lease.experimentId===e.id&&!e.owner));
  const registered=state[registration],receiptChanged=typeof registered?.session==='string'&&registered.session!==session;
  if(!deadLease&&!studies.length&&!receiptChanged)return state;
  // A delayed hello from a dead document must not retire the new owner. Only
  // the currently responding top-frame document can confirm replacement.
  let current=confirmed;
  if(!current&&probe){try{current=await probe(tabId);}catch{return false;}}
  if(!current||current.session!==session)return false;
  const leaseStudy=deadLease&&state['experiment:'+lease.experimentId];
  if(leaseStudy?.owner&&!replaced(leaseStudy.owner))return false;
  const updates={},at=new Date(clock()).toISOString();
  for(const [key,e] of studies){
   if(key!=='experiment:'+e.id)throw Error('The saved study identity does not match.');
   E.validate(e);
   for(const t of e.trials){
    if(!E.active.includes(t.status)&&t.status!=='uncertain')continue;
    const saved=await get('run:'+t.runId);let recovered=false;
    if(saved){try{validateCapture(e,t,saved);if(account?.enabled)await account.settle(t.runId,'saved');recovered=true;}catch{/* Unproven or unsettled results remain untouched for review. */}}
    t.status=recovered?'saved':'uncertain';
    t.error=recovered?null:'RZone was refreshed or reopened before this test finished. Check its saved result or skip this trial before resuming.';
   }
   e.status=e.trials.some(t=>t.status==='uncertain')?'needs-review':e.trials.every(t=>['saved','skipped'].includes(t.status))?'complete':'paused';
   delete e.owner;E.journal(e,'RZone page changed. Saved results kept; unfinished tests stopped for review.',at);updates[key]=e;
  }
  if(deadLease)updates['runner:lease']=null;
  if(current)updates['runner:tab:'+tabId]={id:tabId,session,seenAt:clock(),ready:current.ready===true,capable:current.capable===true||current.ready===true,chart:String(current.chart||'').slice(0,30)};
  // Keep the interrupted journal and ownership release in one durable write.
  await storage.set(updates);return {...state,...updates};
 }
 async function reviewSourceOwners(tabId){
  if(!probe)return;
  const state=await records('experiment:',['runner:lease']),owners=[state['runner:lease'],...Object.entries(state).filter(([key])=>key.startsWith('experiment:')).map(([,e])=>e.owner)],ids=new Set(owners.filter(o=>Number.isInteger(o?.tabId)&&typeof o.session==='string'&&(tabId===undefined||o.tabId===tabId)).map(o=>o.tabId));
  for(const id of ids){let current;try{current=await probe(id);}catch{continue;}
   if(typeof current?.session!=='string'||!current.session||current.session.length>80)continue;
   await recoverReplacedSource(id,current.session,current);
  }
 }
 function validateCapture(e,t,r){
  if(!r||r.id!==t.runId||r.experiment?.id!==e.id||r.experiment?.trialId!==t.id||r.experiment?.phase!==t.phase||r.provenance!=='recorded-at-submit')throw Error('A matching durable capture has not been saved.');
  if(e.demo||r.demo===true)throw Error('A fictional result cannot complete a real RZone trial.');
  V.validate(r);if(r.charts.length!==6||r.trades.rows.length!==V.metrics(r).trades)throw Error('The saved report is incomplete.');
  const planned=E.expected(e,t);E.verifySettings(planned,r);
  E.verifyEvidence(e,t,r);
 }
 function setupProfiles(sources){
  const profiles=[],covered=new Set();
  for(const source of sources){
   if(!source||source.demo)continue;
   try{
    const template=S.template(source),contexts=[];
    for(const stage of cacheStages){
     const descriptor=template.stages[stage];if(!descriptor)continue;
     const fields=descriptor.fields,layout=L.stage(stage,fields);
     const context=[stage,layout.chart];
     if(layout.chart==='Renko')context.push(fields[layout.modeIndex]?.value,fields[layout.exitModeIndex]?.value);
     if(stage==='momentum')context.push(fields[layout.marketIndex]?.value,!!descriptor.relativeStrength);
     if(stage==='execution')context.push(layout.selection);
     if(stage==='marketFilter')context.push(layout.hasExit);
     contexts.push(JSON.stringify(context));
    }
    // Entry and exit choices are independently reusable. A different P&F
    // reversal uses the same controls and menus and must not evict an exit chart.
    if(contexts.every(context=>covered.has(context)))continue;
    contexts.forEach(context=>covered.add(context));profiles.push(template);
   }catch{/* Invalid old templates remain in the original research archive. */}
  }
  return profiles;
 }
 async function execute(m,sender,received){
  const source=sender.id===runtime.id&&sender.tab&&(sender.frameId===undefined||sender.frameId===0)&&new URL(sender.url||'https://invalid/').origin==='https://zone.definedgesecurities.com';
  const url=runtime.getURL('index.html'),dashboard=sender.id===runtime.id&&(sender.url===url||sender.url?.startsWith(url+'?'));
  if(!source&&!dashboard)throw Error('This page cannot control experiments.');
  if(source&&m.action==='hello'){
   if(typeof m.session!=='string'||!m.session||m.session.length>80)throw Error('Invalid source session.');
   const state=await recoverReplacedSource(sender.tab.id,m.session);
   if(!state)return {ok:true,id:null};
   await storage.set({['runner:tab:'+sender.tab.id]:{id:sender.tab.id,session:m.session,seenAt:clock(),ready:m.ready===true,capable:m.capable===true||m.ready===true,chart:String(m.chart||'').slice(0,30)}});
   // Review the old deadline before accepting a late heartbeat. A returning tab
   // cannot erase a period during which its submission outcome was unknown.
   const l=await reviewLease(state),owned=l&&state['experiment:'+l.experimentId],trial=owned?.trials.find(t=>t.id===l.trialId);
   if(l?.tabId===sender.tab.id&&l.session===m.session&&!m.failed&&['running','pausing'].includes(owned?.status)&&E.active.includes(trial?.status)){
    l.seenAt=clock();await storage.set({'runner:lease':l});
   }
   const recovery=l?.recoveryPending&&l.tabId===sender.tab.id&&l.session===m.session&&E.active.includes(trial?.status)&&['running','pausing'].includes(owned?.status);
   const mine=recovery?owned:Object.entries(state).find(([key,e])=>key.startsWith('experiment:')&&e.status==='running'&&e.owner?.tabId===sender.tab.id&&e.owner.session===m.session)?.[1];
   const timeout=trial&&l.tabId===sender.tab.id&&l.session===m.session&&E.waitingForResult(trial.status)
    ?{trialId:trial.id,deadlineAt:E.trialDeadline(owned,trial)}:undefined;
   return {ok:true,id:mine?.id||null,...(timeout?{timeout}:{}),...(recovery?{recovery:true}:{})};
  }
  if(dashboard&&m.action==='list'){
   if(m.passive===true){
    const registered=(await collection('runner:tab:')).filter(tab=>clock()-tab.seenAt<120000);
    const tabs=tabExists?(await Promise.all(registered.map(async tab=>await tabExists(tab.id)?tab:null))).filter(Boolean):registered;
    return {ok:true,localSetup:true,experiments:await collection('experiment:'),tabs};
   }
   await reviewSourceOwners();await reviewLease();const tabs=(await Promise.all((await collection('runner:tab:')).map(sourceStatus))).filter(Boolean);return {ok:true,experiments:await collection('experiment:'),tabs};
  }
  if(dashboard&&m.action==='setup-library'){
   const profiles=await get('runner:setup-profiles'),archives=(await collection('experiment:')).slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
   const choices=await readChoiceCache(null,false),queries=await benchmarkQueries();
   const templates=setupProfiles([...(Array.isArray(profiles)?profiles:[]),...archives.map(e=>e.baseline?.setup?.template)]).map(template=>enrichSymbolChoices(template,choices,queries));
   return {ok:true,templates,nseBenchmarkSeeded:queries.seeded,marketFilterAutoAttempted:await get('runner:market-filter-auto-day')===localDay()};
  }
  if(dashboard&&m.action==='lookup-symbol-local'){
   if(!cacheStages.includes(m.stage)||!Number.isInteger(m.fieldIndex)||m.fieldIndex<0||m.fieldIndex>80||!['All',...symbolMarkets].includes(m.market)||!queryValid(m.query))throw Error('Invalid saved benchmark search.');
   const queries=await benchmarkQueries(),query=m.query.toLowerCase();
   const records={day:queries.day,records:queries.records.map(record=>({...record,options:record.options.filter(option=>option.label.toLowerCase().includes(query))}))};
   const {knownOptions:options,knownOptionsTruncated}=knownSymbolChoices({records:[]},records,m.market);
   return {ok:true,result:{stage:m.stage,fieldIndex:m.fieldIndex,market:m.market,query:m.query,controlType:'text',options,preloaded:options.length>0,knownOptionsTruncated}};
  }
  if(dashboard&&m.action==='create'){
   if(m.reuse&&account?.enabled)await account.requireFeature('reuse');
   const key=m.draftId&&'experiment:'+m.draftId,existing=key&&await get(key);
   if(m.draftId&&(!E.editableDraft(existing)||(await Promise.all(existing.trials.map(t=>get('run:'+t.runId)))).some(Boolean)))throw Error('This study has already started. Open it in My studies to continue.');
   const e=E.create({...m.plan,id:existing?.id||uuid(),...(existing?{now:existing.createdAt}:{})});if(e.demo)throw Error('Fictional experiments cannot control RZone.');
   if(!existing&&await get('experiment:'+e.id))throw Error('Experiment ID already exists.');
   if(existing)e.revision=existing.revision+1;
   await put(e);return {ok:true,experiment:e};
  }
  if(dashboard&&['configure','lookup-rule','lookup-symbol','open-source'].includes(m.action)){
   await reviewSourceOwners(m.action==='open-source'?undefined:m.tabId);
   const lease=await reviewLease(),studies=await collection('experiment:');
   if(lease||studies.some(x=>['running','pausing'].includes(x.status))){
    const interrupted=lease&&studies.find(e=>e.id===lease.experimentId&&e.status==='needs-review');
    if(interrupted)throw Error('An interrupted test needs review. Open "'+interrupted.name+'" in My studies, then choose Recover this trial or Skip this trial before reconnecting.');
    throw Error('Finish or pause the current tests in My studies before changing the RZone setup.');
   }
   if(m.action==='open-source'){
    if(!openSource)throw Error('Open RZone in Chrome and sign in, then reconnect here.');
    return {ok:true,...await openSource(await collection('runner:tab:'))};
   }
   if(!configure)throw Error('Reload the updated extension and refresh RZone to connect the setup editor.');
   const tab=await sourceStatus(await get('runner:tab:'+m.tabId));
   if(!tab?.capable&&!tab?.ready)throw Error(tab?.reason||'Open RZone and sign in, then connect again.');
   let lookupTemplate,lookupMetadata;
   if(['lookup-rule','lookup-symbol'].includes(m.action)&&m.lookupTemplate!==undefined){
    lookupTemplate=S.template(m.lookupTemplate);
    if(lookupTemplate.demo)throw Error('A sample setup cannot search RZone.');
    lookupMetadata=lookupRoutes(lookupTemplate,tab.session);
   }
   if(m.action==='lookup-rule'){
    if(m.session!==tab.session)throw Error('RZone changed or reloaded. Reconnect before searching for strategies.');
    const stage=m.stage===undefined?'momentum':m.stage,routes=lookupMetadata||await get(lookupKey(tab)),recorded=routes?.session===tab.session?routes.rules.find(route=>route.stage===stage&&route.parentIndex===m.parentIndex):null,parents=stage==='momentum'?[39,41,43,45,47,49]:stage==='execution'?[6,10]:[],allowed=recorded?recorded.categories.includes(m.category):(!routes||routes.session!==tab.session)&&parents.includes(m.parentIndex);
    if(!allowed||!['My','Public'].includes(m.category)||!queryValid(m.query))throw Error('Enter a strategy search of 1–200 characters. Load this filter\'s choices first.');
    const request={stage,parentIndex:m.parentIndex,category:m.category,query:m.query,session:tab.session,...(lookupTemplate?{lookupTemplate}:{})},lookupCache=await readChoiceCache(tab,false);
    const r=await configure(tab.id,{},request);
    if(!r?.ok)throw Error(r?.error||'RZone strategy search could not be read.');
    if(r.session!==tab.session)throw Error('RZone reloaded during the search. Reconnect and try again.');
    const result=r.result;
    // Older source readers omitted stage for momentum searches. Execution
    // must identify its stage explicitly; its result cannot satisfy a main-form query.
    const resultStage=result?.stage===undefined?'momentum':result.stage;
    if(!result||resultStage!==stage||result.parentIndex!==m.parentIndex||result.childIndex!==(recorded?.childIndex??m.parentIndex+1)||result.category!==m.category||result.query!==m.query||result.controlType!=='text'||!Array.isArray(result.options)||result.options.length>3000)throw Error('RZone returned a different strategy search. Search again.');
    const metadata=r.choiceCache||result.choiceCache;if(metadata)await retainChoices(tab,lookupCache,{choiceCache:metadata,hasCachedChoices:true});
    const visible={...result};delete visible.choiceCache;return {ok:true,result:visible};
   }
   if(m.action==='lookup-symbol'){
    if(m.session!==tab.session)throw Error('RZone changed or reloaded. Reconnect before searching for symbols.');
    const routes=lookupMetadata||await get(lookupKey(tab)),route=routes?.session===tab.session&&routes.symbols?.find(route=>route.stage===m.stage&&route.fieldIndex===m.fieldIndex);
    if(!route||!route.markets.includes(m.market)||!queryValid(m.query))throw Error('Enter a symbol search of 1–200 characters after loading this filter\'s choices.');
    if(m.seedQueries!==undefined)return seedBenchmarks(tab,route,{...m,lookupTemplate},await readChoiceCache(tab,false));
    const request={kind:'symbol',stage:m.stage,fieldIndex:m.fieldIndex,market:m.market,query:m.query,session:tab.session,...(lookupTemplate?{lookupTemplate}:{})},lookupCache=await readChoiceCache(tab,false),symbolCache=await readSymbolQueries(),cached=symbolCache.records.slice().reverse().find(record=>record.market===m.market&&record.query===m.query&&record.options.every(option=>route.markets.includes(option.market)));
    if(cached)return {ok:true,result:{stage:m.stage,fieldIndex:m.fieldIndex,market:m.market,query:m.query,controlType:'text',options:structuredClone(cached.options),...knownSymbolChoices(lookupCache,await benchmarkQueries(),m.market,cached.options,route.markets),cached:true}};
    if(m.stage==='momentum'&&m.market==='NSE'){
     const seed=await readSymbolQueries(true),query=m.query.toLowerCase();
     const matches=S.mergeSymbolChoices([],seed.records.flatMap(record=>record.options),'NSE').filter(option=>option.label.toLowerCase().includes(query));
     if(matches.some(option=>!option.disabled)){
      const options=matches.slice(0,symbolLimit),combined={day:seed.day,records:[...seed.records,...symbolCache.records]};
      const known=knownSymbolChoices(lookupCache,combined,m.market,options,route.markets);
      return {ok:true,result:{stage:m.stage,fieldIndex:m.fieldIndex,market:m.market,query:m.query,controlType:'text',options,...known,cached:true,preloaded:true,...(matches.length>symbolLimit?{knownOptionsTruncated:true}:{})}};
     }
    }
    const r=await configure(tab.id,{},request);
    if(!r?.ok)throw Error(r?.error||'RZone symbol search could not be read.');
    if(r.session!==tab.session)throw Error('RZone reloaded during the search. Reconnect and try again.');
    const result=r.result;
    if(!result||result.stage!==m.stage||result.fieldIndex!==m.fieldIndex||result.market!==m.market||result.query!==m.query||result.controlType!=='text'||!Array.isArray(result.options)||result.options.length>3000||result.options.some(option=>!option||!choiceText(option.label)||!option.label||option.value!==option.label||!choiceText(option.sourceValue)||!option.sourceValue||!(option.market===m.market||m.market==='All'&&option.market!=='All'&&route.markets.includes(option.market))||option.disabled!==undefined&&typeof option.disabled!=='boolean'))throw Error('RZone returned a different symbol search. Search again.');
    const exact=symbolResultOptions(result.options,m.market),metadata=r.choiceCache||result.choiceCache;if(metadata)await retainChoices(tab,lookupCache,{choiceCache:metadata,hasCachedChoices:true});
    await retainSymbolQuery(symbolCache,m.market,m.query,exact);const current=await readChoiceCache(tab,false);
    return {ok:true,result:{stage:m.stage,fieldIndex:m.fieldIndex,market:m.market,query:m.query,controlType:'text',options:exact,...knownSymbolChoices(current,await benchmarkQueries(),m.market,exact,route.markets),cached:false}};
   }
   const changes=m.changes??{};
   if(!changes||typeof changes!=='object'||Array.isArray(changes)||Object.keys(changes).some(k=>!['momentum','execution','marketFilter'].includes(k)))throw Error('Invalid source choices request.');
   for(const values of Object.values(changes))if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).length>10||Object.entries(values).some(([index,value])=>!/^\d{1,2}$/.test(index)||typeof value!=='string'||value.length>2000))throw Error('Invalid source choices request.');
   if(m.includeRelativeStrength!==undefined&&(m.includeRelativeStrength!==true||!L.charts.includes(changes.momentum?.[0])||m.loadFilter||m.warmChart))throw Error('Invalid Relative Strength chart refresh.');
   if(m.recheckAllChoices!==undefined&&typeof m.recheckAllChoices!=='boolean'||m.warmChart!==undefined&&!L.charts.includes(m.warmChart)||m.loadFilter!==undefined&&!['relativeStrength','marketFilter'].includes(m.loadFilter)||m.warmChart&&(Object.keys(changes).length||m.loadFilter))throw Error('Invalid source choice refresh.');
   let filterTemplate;
   if(m.filterTemplate!==undefined){
    const marketLookup=m.loadFilter==='marketFilter'||m.loadFilter===undefined&&Object.keys(changes).length===1&&changes.marketFilter;
    if(m.recheckAllChoices||(!marketLookup&&(m.loadFilter!=='relativeStrength'||Object.keys(changes).length))||marketLookup&&Object.keys(changes).some(stage=>stage!=='marketFilter'))throw Error('Invalid optional filter lookup.');
    filterTemplate=S.template(m.filterTemplate);
    if(filterTemplate.demo)throw Error('A sample setup cannot search RZone.');
   }
   const cache=await readChoiceCache(tab,m.recheckAllChoices===true),benchmarkCache=await benchmarkQueries(),symbols=cachedSymbolChoices(benchmarkCache);
   if(m.warmChart){
    if(cache.warmInterruptedChart)throw Error('Automatic choices check stopped earlier today. Use Recheck all choices to retry it.');
    // Reserve durably before touching the source. A failed read, closed Vault
    // or worker restart must not begin the same day's background pass again.
    await storage.set({[dailyKey]:{version:L.version,cacheVersion:cacheSchema,day:cache.day,records:cache.records,warmInterruptedChart:m.warmChart}});
   }
   if(m.automaticMarketFilter!==undefined){
    if(m.automaticMarketFilter!==true||m.loadFilter!=='marketFilter'||!filterTemplate||Object.keys(changes).length||m.warmChart)throw Error('Invalid automatic Market Trend lookup.');
    const key='runner:market-filter-auto-day',day=localDay();
    if(await get(key)===day)throw Error('Automatic Market Trend loading already ran today. Use Load Market Trend choices to retry.');
    await storage.set({[key]:day});
   }
   const options={cachedChoices:cache.records.map(r=>r.payload),forceChoices:m.recheckAllChoices===true,...(symbols.length?{cachedSymbols:symbols}:{}),...(m.includeRelativeStrength?{includeRelativeStrength:true}:{}),...(m.warmChart?{warmChart:m.warmChart}:{}),...(m.loadFilter?{loadFilter:m.loadFilter}:{}),...(filterTemplate?{filterTemplate}:{})};
   const r=await configure(tab.id,changes,undefined,options);
   if(!r?.ok)throw Error(r?.error||'RZone setup could not be read.');
   if(r.session!==tab.session||r.config?.session!==tab.session)throw Error('RZone reloaded while connecting. Connect again.');
   const template=S.template(r.config),routes=lookupRoutes(template,tab.session);try{await storage.set({[lookupKey(tab)]:routes});}catch{/* The form can still load; an unrecorded filter search must reconnect. */}
   try{
    const saved=await get('runner:setup-profiles');
    await storage.set({'runner:setup-profiles':setupProfiles([template,...(Array.isArray(saved)?saved:[])])});
   }catch{/* The current source reading remains available in Vault. */}
   // All menu metadata stays local for this calendar day, across source tabs.
   // Current settings come from this fresh response, never from stored menus.
   const choiceCache=filterTemplate&&!r.choiceCache?undefined:await retainChoices(tab,cache,r);
   const source=enrichSymbolChoices(r.config,await readChoiceCache(tab,false),benchmarkCache);
   return {ok:true,source:{...source,choiceCache,nseBenchmarkSeeded:benchmarkCache.seeded}};
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
  const commandStarted=clock();
  const timeoutCommand=m.action==='extend-timeout'||m.action==='trial-timeout';
  const readsLease=timeoutCommand||source&&['checkpoint','fail'].includes(m.action);
  const [e,lease]=await Promise.all([get('experiment:'+m.id),readsLease?get('runner:lease'):null]);
  if(!e)throw Error('Experiment not found.');validateStudy(e);
  if(timeoutCommand){
   const t=e.trials.find(t=>t.id===m.trialId);
   if(!t||!['running','pausing'].includes(e.status)||!E.waitingForResult(t.status)||lease?.experimentId!==e.id||lease.trialId!==t.id||lease.session!==e.owner?.session||lease.tabId!==e.owner?.tabId||clock()-lease.seenAt>=90000)throw Error('This trial is no longer waiting for an RZone result.');
   if(source&&(sender.tab.id!==lease.tabId||m.session!==lease.session||m.token!==lease.token))throw Error('Trial ownership changed.');
   const deadlineAt=E.trialDeadline(e,t);
   if(m.action==='trial-timeout')return {ok:true,deadlineAt};
   // Either surface may extend. A second click for the same deadline is a no-op.
   if(m.deadlineAt===t.execution.previousDeadlineAt&&Number.isSafeInteger(m.deadlineAt))return {ok:true,deadlineAt};
   if(m.deadlineAt!==deadlineAt||!E.timeoutWarning(e,deadlineAt,received))throw Error('The timeout extension window has closed.');
   t.execution.previousDeadlineAt=deadlineAt;
   t.execution.deadlineAt=Math.max(deadlineAt,received+e.timeoutMinutes*60000);
   E.journal(e,'Extended timeout for trial '+t.ordinal,new Date(clock()).toISOString());
   await put(e);
   return {ok:true,deadlineAt:t.execution.deadlineAt};
  }
  if(dashboard){
   if(m.action==='start'){
    if(await reviewLease())throw Error('A trial still owns the source tab. Finish or review it first.');
    if((await collection('experiment:')).some(x=>x.id!==e.id&&['running','pausing'].includes(x.status)))throw Error('Another experiment is running.');
    if(!['draft','paused'].includes(e.status)||e.trials.some(t=>t.status==='uncertain'))throw Error('Review interrupted trials before resuming.');
    let tab;
    if(m.autoSelect===true&&!m.tabId){
     const candidates=(await Promise.all((await collection('runner:tab:')).map(sourceStatus))).filter(Boolean);
     const ready=candidates.filter(candidate=>candidate.ready);
     if(ready.length>1)throw Error('More than one RZone tab is ready. Choose which tab to use, then retry.');
     tab=ready[0]||(candidates.length===1?candidates[0]:null);
    }else tab=await sourceStatus(await get('runner:tab:'+m.tabId));
    if(!tab?.ready)throw Error(tab?.reason||'RZone is not responding. Open RZone and refresh its tab if it is idle, then return here and retry.');
    if(e.demo||!e.trials.some(t=>t.status==='queued'))throw Error('There are no queued real trials.');
    if(account?.enabled){for(const trial of e.trials.filter(t=>t.status==='saved')){const saved=await get('run:'+trial.runId);validateCapture(e,trial,saved);await account.settle(trial.runId,'saved');}await account.start(e.trials.filter(t=>t.status==='queued').length);}
    L.validate('momentum',E.fields(e.baseline,'momentum'));
    if(L.validate('execution',E.fields(e.baseline,'execution')).selection!=='Price')throw Error('Automatic execution currently requires Price selection.');
    delete e.sourceCleanup;e.owner={tabId:tab.id,session:tab.session};e.status='running';E.journal(e,'Started on selected RZone tab');await put(e);return {ok:true,tabId:tab.id};
   }
   if(m.action==='pause'){if(['running','pausing'].includes(e.status)){e.status=(await get('runner:lease'))?.experimentId===e.id?'pausing':'paused';if(e.status==='paused')delete e.owner;E.journal(e,'Stop after current trial requested');await put(e);}return {ok:true};}
   if(m.action==='skip'){
    const t=e.trials.find(t=>t.id===m.trialId);if(!t||t.status!=='uncertain')throw Error('Only an interrupted trial can be skipped.');
    const l=await get('runner:lease');if(l?.experimentId===e.id&&clock()-l.seenAt<90000)throw Error('Wait for the interrupted source session to disconnect before skipping.');
    if(account?.enabled){if(await get('run:'+t.runId))throw Error('A saved result exists. Choose Recover this trial to link it.');await account.settle(t.runId,'released');}
    t.status='skipped';E.journal(e,'User skipped interrupted trial '+t.ordinal);e.status='paused';delete e.owner;await storage.set({['experiment:'+e.id]:e,...(l?.experimentId===e.id?{'runner:lease':null}:{})});return {ok:true};
   }
   if(m.action==='reconcile'||m.action==='recover'){
    const lease=await get('runner:lease');if(lease&&lease.experimentId!==e.id)throw Error('Another experiment owns the source tab.');
    const t=e.trials.find(t=>t.id===m.trialId);
    if(!t||t.status!=='uncertain')throw Error('This trial is no longer waiting for recovery.');
    const r=await get('run:'+t.runId);
    if(!r){
     if(m.action==='reconcile')throw Error('No durable result is available to reconcile.');
     if(e.demo||e.status!=='needs-review'||e.trials.some(other=>other!==t&&(E.active.includes(other.status)||other.status==='uncertain')))throw Error('Resolve the other interrupted trial before continuing.');
     if((await collection('experiment:')).some(other=>other.id!==e.id&&['running','pausing'].includes(other.status)))throw Error('Another experiment is running.');
     if(E.canRetryUnsubmitted(t)){
      if(lease&&lease.trialId!==t.id)throw Error('Another trial owns the RZone tab.');
      // The runner must record submission intent before clicking Backtest.
      t.status='queued';t.error=null;delete t.execution;
      e.status='paused';delete e.owner;E.journal(e,'Trial '+t.ordinal+' returned to the queue before RZone submission.');
      await storage.set({['experiment:'+e.id]:e,'runner:lease':null});
      return {ok:true,requeued:true};
     }
     const tabId=e.owner?.tabId,session=t.execution?.sourceSession;
     if(!Number.isInteger(tabId)||!session||e.owner.session!==session||lease&&(lease.trialId!==t.id||lease.tabId!==tabId||lease.session!==session))throw Error('Vault lost the original RZone page. Keep that page open during future trials.');
     let source;try{source=await probe?.(tabId);}catch{/* Missing or disconnected source. */}
     const receipt=source?.recovery,portfolioRecorded=t.events.some(event=>event.status==='portfolio-submitting');
     if(source?.session!==session||receipt?.experimentId!==e.id||receipt?.trialId!==t.id||!receipt.strategyId||receipt.portfolioId&&!portfolioRecorded||!t.events.some(event=>event.status==='strategy-submitting')){
      throw Error('Vault could not verify the original submission. If its report is still open, save a copy from RZone before closing the tab.');
     }
     t.status=receipt.portfolioId?'portfolio-submitting':'strategy-submitting';
     t.error=null;t.execution.deadlineAt=clock()+e.timeoutMinutes*60000;
     e.status='running';E.journal(e,'Recovering original RZone submission for trial '+t.ordinal,new Date(clock()).toISOString());
     await storage.set({['experiment:'+e.id]:e,'runner:lease':{experimentId:e.id,trialId:t.id,token:uuid(),tabId,session,seenAt:clock(),recoveryPending:true,recovery:{strategyId:receipt.strategyId,portfolioId:receipt.portfolioId??null}}});
     return {ok:true,tabId,recovering:true};
    }
    validateCapture(e,t,r);if(account?.enabled)await account.settle(t.runId,'saved');
    const closeInterrupted=/\bdialog did not close\b/i.test(t.error||''),sourceTab=e.owner?.tabId??lease?.tabId;
    t.status='saved';t.error=null;
    e.status=e.trials.every(trial=>['saved','skipped'].includes(trial.status))?'complete':e.trials.some(trial=>trial.status==='uncertain')?'needs-review':'paused';
    if(closeInterrupted&&e.status==='paused')e.sourceCleanup={trialId:t.id,tabId:sourceTab};
    delete e.owner;E.journal(e,'Recovered saved result for trial '+t.ordinal);await storage.set({['experiment:'+e.id]:e,'runner:lease':null});return {ok:true};
   }
   if(m.action==='validate'){
    if(account?.enabled)await account.requireFeature('reuse');
    const t=e.trials.find(t=>t.id===m.trialId),r=t&&await get('run:'+t.runId);if(!t||!E.result(e,t,r).eligible)throw Error('Choose a candidate that meets the fixed rules.');
    E.validation(e,t.id,m.period,m.phase);await put(e);return {ok:true};
   }
   throw Error('Unknown experiment command.');
  }
  if(e.owner?.tabId!==sender.tab.id||e.owner?.session!==m.session)throw Error('This source tab does not own the experiment.');
  if(m.action==='claim'){
   const existing=await reviewLease();
   if(existing?.recoveryPending&&existing.experimentId===e.id&&existing.tabId===sender.tab.id&&existing.session===m.session&&clock()-existing.seenAt<90000&&['running','pausing'].includes(e.status)){
    const trial=e.trials.find(t=>t.id===existing.trialId);
    if(trial&&E.waitingForResult(trial.status)){
     existing.recoveryPending=false;await storage.set({'runner:lease':existing});
     return {ok:true,experiment:e,trial,token:existing.token,recovery:existing.recovery};
    }
   }
   if(e.status!=='running'||existing)return {ok:true,trial:null};
   const interrupted=e.trials.find(t=>E.active.includes(t.status));if(interrupted){interrupted.status='uncertain';interrupted.error='The active trial lost its saved ownership record. Review the source result before continuing.';e.status='needs-review';E.journal(e,interrupted.error);await put(e);return {ok:true,trial:null};}
   const evidence=e.mode==='adaptive'?(await Promise.all(e.trials.filter(t=>t.phase==='discovery'&&t.status==='saved').map(t=>get('run:'+t.runId)))).filter(Boolean):[];const t=E.nextTrial(e,evidence);if(!t){e.status='complete';delete e.owner;E.journal(e,'Stage complete');await put(e);return {ok:true,trial:null};}
   // Never overwrite an existing record under a queued trial's ID. This can
   // happen after a partial backup/import or a lost acknowledgement.
   if(await get('run:'+t.runId)){t.status='uncertain';t.error='A saved record already exists for this trial. Review it before continuing.';e.status='needs-review';E.journal(e,t.error);await put(e);return {ok:true,trial:null};}
   if(account?.enabled){try{await account.reserve(t.runId);}catch(error){e.status='paused';delete e.owner;E.journal(e,'Account check stopped this trial: '+error.message);await put(e);throw error;}}
   const token=uuid();t.execution={sourceSession:m.session,claimedAt:new Date(clock()).toISOString()};E.transition(e,t,'applying');await storage.set({['experiment:'+e.id]:e,'runner:lease':{experimentId:e.id,trialId:t.id,token,tabId:sender.tab.id,session:m.session,seenAt:clock()}});
   return {ok:true,experiment:e,trial:t,token};
  }
  const leaseState=readsLease&&(!lease||lease.experimentId===e.id)?{['experiment:'+e.id]:e,'runner:lease':lease}:undefined;
  const l=await reviewLease(leaseState),t=e.trials.find(t=>t.id===m.trialId);
  if(!l||l.experimentId!==e.id||l.trialId!==t?.id||l.token!==m.token||l.session!==m.session)throw Error('Trial ownership changed. Stop and review.');
  if(clock()-l.seenAt>=90000)throw Error('Trial ownership expired. Stop and review the current source result.');
  if(m.action==='fail'){t.status='uncertain';t.error=String(m.error||'Interrupted').slice(0,1000);e.status='needs-review';E.journal(e,'Trial '+t.ordinal+': '+t.error);await put(e);return {ok:true};}
  if(m.action==='checkpoint'){
   if(!['running','pausing'].includes(e.status))throw Error('Experiment is paused for review.');
   if(l.recovery&&m.stage==='capturing'&&await get('run:'+t.runId))throw Error('A result was already saved. Recover this trial again to link it.');
   if(m.stage==='saved'){validateCapture(e,t,await get('run:'+t.runId));if(account?.enabled)await account.settle(t.runId,'saved');}
   if(m.stage==='saved'&&m.timing){
    const keys=['Quick Stats','Statistics','Charts','Trade Details','details','checkpoint','write','close','ack','queue','prepare','journal'];
    const timing=Object.fromEntries(keys.filter(key=>Number.isSafeInteger(m.timing[key])&&m.timing[key]>=0).map(key=>[key,m.timing[key]]));
    t.captureTiming={...timing,confirm:Math.max(0,clock()-commandStarted)};
   }
   const ready=clock();
   E.transition(e,t,m.stage);
   if(m.stage==='saved'){
    const remaining=e.trials.some(x=>x.status==='queued'),cleanupError=typeof m.cleanupError==='string'&&m.cleanupError.trim().slice(0,300);
    e.status=!remaining?'complete':e.status==='pausing'||cleanupError?'paused':'running';
    if(cleanupError){
     if(remaining)e.sourceCleanup={trialId:t.id,tabId:l.tabId};
     E.journal(e,'Trial '+t.ordinal+' was saved. RZone dialog cleanup stopped: '+cleanupError);
    }
    if(e.status!=='running')delete e.owner;await storage.set({['experiment:'+e.id]:e,'runner:lease':null});
   }
   else {l.seenAt=clock();await storage.set({['experiment:'+e.id]:e,'runner:lease':l});}
   const timing=m.stage==='capturing'?{queue:commandStarted-received,prepare:ready-commandStarted,journal:clock()-ready}:undefined;
   return {ok:true,status:e.status,...(timing?{timing}:{})};
  }
  throw Error('Unknown runner command.');
 }
 return {handle(m,sender){const received=clock(),task=serial.then(()=>execute(m,sender,received));serial=task.catch(()=>{});return task;}};
}
if(typeof module!=='undefined')module.exports={createCoordinator};root.VaultExperimentCoordinator={createCoordinator};
})(typeof window!=='undefined'?window:globalThis);
