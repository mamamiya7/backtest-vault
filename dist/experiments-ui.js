/* Experiment workspace. Demo commands never cross the extension boundary. */

(function(root){

'use strict';

const E=root.VaultExperiments,P=root.VaultPresentation,I=root.VaultIntelligence,S=root.VaultSetup;

const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};

const button=(label,fn,cls='secondary')=>{const b=el('button',label,cls);b.type='button';b.onclick=fn;return b;};

const input=(value,type='text')=>{const n=el('input');n.type=type;n.value=value;return n;};

const label=(text,control)=>{const l=el('label',text);l.append(control);return l;};

const select=options=>{const s=el('select');for(const [value,text] of options){const o=el('option',text);o.value=value;s.append(o);}return s;};

const disclosure=(title,body)=>{const d=el('details');d.append(el('summary',title),body);return d;};

const metricName=x=>({calmar:'Calmar',returns:'Return',drawdown:'Drawdown'}[x]||x);
const fmt=(n,percent=false,signed=false)=>P.cell(typeof n==='number'&&Number.isFinite(n)?n.toFixed(2):n,{kind:percent?'percent':'number',signed}).text;
const dateRangeText=value=>{const range=E.dateRange?.(value);if(!range)return 'Select date range';const format=date=>new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T00:00:00Z'));return format(range.from)+' → '+format(range.to);};
const settingDisplay=(field,value)=>field?.type==='date-range'?dateRangeText(value):typeof value==='boolean'?(value?'On':'Off'):field?.type==='number'?P.cell(value,{kind:field.integer?'count':/%/.test(field.label||'')?'percent':'number'}).text:field?.options?.find(o=>o.value===value)?.label??String(value??'—');
const trialSettingDisplay=(experiment,trial,field)=>{const period=E.trialPeriod(experiment,trial);return settingDisplay(field,field.key==='execution.period'?period.from+'/'+period.to:field.key==='execution.from'||field.key==='execution.to'?period[field.key.slice(10)]:trial.patch[field.key]);};
const stateName=x=>({draft:'Ready to start',running:'Running',pausing:'Stopping after current trial',paused:'Paused',complete:'Complete','needs-review':'Needs review',queued:'Queued',applying:'Checking and applying settings','strategy-submitting':'Waiting for strategy results','strategy-complete':'Strategy completed','portfolio-submitting':'Waiting for portfolio report',capturing:'Saving report',saved:'Saved',uncertain:'Needs review',skipped:'Skipped'}[x]||x);
const elapsed=(from,to)=>{const start=Date.parse(from),end=Date.parse(to);if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)return null;const seconds=(end-start)/1000,whole=Math.round(seconds);return seconds<60?seconds.toFixed(1)+' s':Math.floor(whole/60)+' min '+whole%60+' s';};

let cleanup=()=>{};
// Keep an unfinished setup while navigating this tab. Source sessions are
// checked again on return; these drafts never enter archives or run on resume.
const setupDrafts=new WeakMap();

async function render({target,store,runs,onOpen:openSaved,onExit,onNotice,table,download,baselineRun,startNew=false,studyId=null}){

 cleanup();document.body.classList.add('experiments-mode');let timer,selected=null,experiments=[],tabs=[],disposed=false,simulation=false,refreshing=false;
 let refreshSource=()=>{},wizard=null,deletionDialog=null,renderedList='',renderedDetail='',loadGeneration=0;const sourceChoices=new Map(),decisionGroups=new Map();
 const onOpen=run=>openSaved(run,selected);
 const stamp=e=>e?JSON.stringify([e.id,e.revision,e.status,e.owner,e.trials.map(t=>[t.status,t.error])]):'';
 const listStamp=()=>experiments.map(stamp).join('|');

 const extension=!store.demo&&location.protocol==='chrome-extension:'&&typeof chrome!=='undefined'&&!!chrome.runtime?.sendMessage;

 const alive=()=>!disposed&&target.isConnected&&panel.isConnected&&target.contains(panel);

 const notice=el('p','','notice');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');

 const panel=el('div',undefined,'experiment-workspace');target.replaceChildren(panel);panel.append(notice);

 const environment=el('div',undefined,'experiment-environment '+(store.demo?'is-sample':extension?'is-extension':'is-viewer'));
 environment.append(el('strong',store.demo?'Sample workspace':extension?'RZone automation':'Archive viewer'),el('span',store.demo?'Fictional results · no RZone backtests run.':extension?'Runs execute in your selected RZone tab.':'Review results and prepare plans. Execution is available in the installed Vault.'));
 panel.append(environment);

 const content=el('div');panel.append(content);
 const motion=root.VaultWorkspaceMotion?.create(panel),calendars=[];
 const clearCalendars=()=>{for(const calendar of calendars.splice(0))calendar.destroy();};
 const calendarOpen=()=>calendars.some(calendar=>calendar.button.getAttribute('aria-expanded')==='true');
 const attachCalendar=(container,fromInput,toInput,options={})=>{if(!root.VaultDateRange)return null;const calendar=root.VaultDateRange.attach({container,fromInput,toInput,...options});calendars.push(calendar);return calendar;};
 const keepSetup=()=>{if(!wizard||wizard.submitting)return;const {controls,countUpdates,fields,catalog,...draft}=wizard;if(wizard.connecting||wizard.ruleLookup)notice.textContent='';setupDrafts.set(store,structuredClone({...draft,connecting:false,warmingChart:null,loadingFilter:null,ruleLookup:null,reviewOpen:false,editorOpen:null,generation:draft.generation+1}));};

 const dispose=()=>{if(disposed)return;keepSetup();disposed=true;clearInterval(timer);clearCalendars();motion?.destroy();deletionDialog?.remove();deletionDialog=null;document.body.classList.remove('experiments-mode');};cleanup=dispose;

 async function command(action,data={}){

  if(store.demo)throw Error('Use the isolated simulation controls in demo mode.');

  if(!extension)throw Error('Open the installed extension to run RZone. Plans can be prepared in this browser viewer.');

  let timeout;
  try{
   const request=chrome.runtime.sendMessage({type:'vault-experiment',action,...data});
   // Bound the whole connection request, including time spent waiting for the
   // background queue. A late reply must not replace a newer setup or retry.
   const r=['configure','lookup-rule','lookup-symbol'].includes(action)?await Promise.race([request,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error(action.startsWith('lookup-')?'RZone did not finish searching. Check its tab, then search again. No backtest was started.':'RZone did not finish connecting. Check its tab, close any open dialog, then retry the connection here. No backtest was started.')),70000);})]):await request;
   if(!r?.ok)throw Error(r?.error||'Extension disconnected.');return r;
  }finally{clearTimeout(timeout);}

 }

 async function load(){const generation=++loadGeneration,data=extension?await command('list'):{experiments:await store.allExperiments(),tabs:[]},nextRuns=await store.all();if(generation!==loadGeneration||disposed)return;experiments=data.experiments;tabs=data.tabs;runs=nextRuns;motion?.observe(experiments);}

 async function action(fn){try{notice.textContent='';notice.className='notice';await fn();}catch(e){notice.textContent=e.message;notice.className='notice error';}}

 function deleteControl(e,compact=false){
  const b=button(compact?'Delete':'Delete study',()=>confirmDeletion(e,b),'quiet study-delete');
  b.setAttribute('aria-label','Delete study: '+e.name);b.dataset.deleteStudy=e.id;return b;
 }

 function confirmDeletion(e,trigger){
  if(deletionDialog)return;
  // An older poll must not repaint the removed study after confirmation.
  loadGeneration++;
  e=experiments.find(x=>x.id===e.id)||e;
  const dialog=el('dialog',undefined,'study-delete-dialog'),reason=E.deletionReason(e),title=el('h3','Delete study?'),description=el('p'),name=el('strong',e.name),error=el('p',reason,'notice error'),actions=el('div',undefined,'study-delete-actions');let busy=false;
  deletionDialog=dialog;title.id='study-delete-title';description.id='study-delete-description';error.setAttribute('role','alert');
  dialog.setAttribute('aria-labelledby',title.id);dialog.setAttribute('aria-describedby',description.id);
  description.append('This removes ',name,' and its trial plan. Saved backtest runs stay in your library.');
  const close=()=>{if(busy)return;dialog.remove();deletionDialog=null;if(trigger.isConnected)trigger.focus();};
  const cancel=button('Cancel',close,'secondary'),remove=button('Delete study',async()=>{
   if(busy)return;busy=true;remove.disabled=true;cancel.disabled=true;remove.textContent='Deleting…';error.textContent='';
   try{
    if(extension)await command('delete',{id:e.id});else await store.removeExperiment(e.id);
   }catch(err){error.textContent=err.message;busy=false;cancel.disabled=false;remove.disabled=false;remove.textContent='Delete study';cancel.focus();return;}
   busy=false;dialog.remove();deletionDialog=null;if(!alive())return;
   // Reflect successful removal even if a later refresh cannot reach storage.
   experiments=experiments.filter(x=>x.id!==e.id);sourceChoices.delete(e.id);decisionGroups.delete(e.id);list();
   notice.textContent='Study deleted. Saved runs remain in your library.';notice.className='notice';
   const heading=content.querySelector('h2');heading.tabIndex=-1;heading.focus();
  },'study-delete-confirm');
  remove.disabled=!!reason;cancel.autofocus=true;actions.append(cancel,remove);dialog.append(title,description,el('p','This cannot be undone. Export the study first if you want a copy.','mini'),error,actions);panel.append(dialog);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');cancel.focus();
 }

 function sourceControls(id,state){
  const picker=select([['','Select RZone tab']]),help=el('p','','mini');
  picker.setAttribute('aria-label','RZone tab');picker.dataset.rzone='true';help.setAttribute('role','status');
  const ready=t=>t.ready&&t.chart==='Candle';
  const remaining=experiments.find(e=>e.id===id)?.trials.filter(t=>t.status==='queued').length||1;
  const start=button(state==='draft'?'Run '+remaining+' '+(remaining===1?'test':'tests'):'Resume tests',()=>action(async()=>{
   const tab=tabs.find(t=>String(t.id)===picker.value);if(!tab||!ready(tab))throw Error('Connect a ready RZone backtesting tab first.');
   start.disabled=true;try{await command('start',{id,tabId:tab.id});await load();detail(id);}finally{if(start.isConnected)refreshSource();}
  }),'primary');
  function sync(){
   const available=tabs.filter(ready);let chosen=sourceChoices.get(id)||'';
   if(!chosen&&available.length===1){chosen=String(available[0].id);sourceChoices.set(id,chosen);}
   const current=tabs.find(t=>String(t.id)===chosen);
   // Never rebuild a focused native menu: Chrome can dismiss its open choices.
   if(document.activeElement!==picker){
    const opts=[['','Select RZone tab'],...tabs.map(t=>[String(t.id),'RZone · '+(t.chart||'not ready')+(ready(t)?'':' · unavailable')+' · tab '+t.id])];
    if(chosen&&!current)opts.push([chosen,'RZone · not connected']);
    if(JSON.stringify([...picker.options].map(o=>[o.value,o.textContent]))!==JSON.stringify(opts))picker.replaceChildren(...[...select(opts).options]);
    picker.value=chosen;
   }
   const target=tabs.find(t=>String(t.id)===picker.value);start.disabled=!target||!ready(target);
   help.textContent=target?(target.reason||(!ready(target)?'Open a supported RZone backtesting form.':'')):chosen?'RZone is not responding. Open its tab to reconnect.':'Open RZone Momentum BackTesting and close any report or settings dialogs.';
   help.hidden=!help.textContent;
  }
  picker.onchange=()=>{sourceChoices.set(id,picker.value);sync();};picker.onblur=sync;refreshSource=sync;sync();
  return [picker,start,help];
 }

 function heading(title,back){const h=el('div',undefined,'comparison-intro journey-heading');const text=el('div');if(back){const crumb=el('div',undefined,'study-breadcrumb');crumb.append(button('My studies',()=>list(),'quiet'),el('span',wizard?' / New test':' / Study'));text.append(crumb);}text.append(el('h2',title));h.append(text);if(!back)h.append(button('Run library',onExit,'quiet'));return h;}

 function journey(stage){const nav=el('nav',undefined,'study-journey'),steps=el('ol'),names=[['setup','Set up'],['run','Run tests'],['review','Review results']],current=names.findIndex(([key])=>key===stage);nav.setAttribute('aria-label','Study progress');for(const [i,[key,title]] of names.entries()){const item=el('li');item.dataset.stage=key;item.className=i<current?'is-done':i===current?'is-current':'';if(i===current)item.setAttribute('aria-current','step');item.append(el('span',String(i+1),'journey-number'),el('strong',title),el('small',i===current?'You are here':i<current?'Complete':'','journey-state'));steps.append(item);}nav.append(steps);return nav;}

 function list(){keepSetup();clearCalendars();motion?.enter(content,'list');selected=null;wizard=null;renderedList=listStamp();environment.hidden=extension;panel.classList.remove('is-setup','has-workbench');content.replaceChildren(heading('My studies'));const intro=el('div',undefined,'experiment-intro');intro.append(el('p','Set up a test, follow its progress, then review the results.','muted'),button(setupDrafts.has(store)?'Continue setup':'New test',()=>newTest(),'primary'),button('Use a saved run',()=>builder(),'quiet'));content.append(intro);

  if(!experiments.length){const empty=el('div',undefined,'experiment-empty');empty.append(el('h3','One setup. All your test results together.'),el('p','Start with one test or try several values. Vault keeps the settings, progress and results in one study.'));content.append(empty);}

  else{const cards=el('div',undefined,'experiment-cards');for(const e of [...experiments].reverse()){const card=el('article',undefined,'study-card'),b=button('',()=>detail(e.id),'experiment-card'),created=el('time');created.dateTime=e.createdAt;created.textContent='Created '+new Date(e.createdAt).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});b.append(el('small',(e.demo?'Sample · ':'')+stateName(e.status)),el('strong',e.name),el('span',e.trials.filter(t=>t.status==='saved').length+' / '+e.trials.length+(e.demo?' sample results':' saved')),created);card.append(b,deleteControl(e,true));cards.append(card);}content.append(cards);}

 }

 function newTest(initial=null){
  const savedContext=initial?S.savedRunContext(initial):null;
  if(initial&&(initial.demo===true)!==store.demo)throw Error('Real and fictional saved settings cannot be mixed.');
  const draft=!initial&&setupDrafts.get(store);if(draft){selected=null;wizard=structuredClone(draft);if(setupSourceValid())setupPage();return;}
  selected=null;wizard={step:0,sourceId:'',sourceSession:null,template:null,config:null,dimensions:[],ruleDrafts:new Map(),ruleSearchDrafts:new Map(),contextDrafts:new Map(),choiceCache:null,warmingChart:null,ruleLookup:null,name:store.demo?'Sample momentum study':'Momentum study',mode:'grid',budget:30,objective:'returns',ceiling:25,minTrades:store.demo?10:30,seed:42,timeout:20,connecting:false,connectionError:'',autoConnectAttempted:false,generation:0,stale:false,reviewOpen:false,editorOpen:null};
  if(initial){setupDrafts.delete(store);wizard.reuseRun=structuredClone(initial);wizard.reuseApplied=false;wizard.name=((initial.name||'Saved run').slice(0,110)+' · copy');}
  if(store.demo){if(!S)throw Error('Test setup is unavailable. Refresh Vault.');const c=savedContext?.config;wizard.template=S.demoTemplate(c?{momentumChart:c['momentum.chart'],executionChart:c['execution.chart'],momentumBrickMode:c['momentum.brick.mode'],executionBrickMode:c['execution.brick.mode']}:{});wizard.config=initial?S.configFromRun(initial,wizard.template):S.defaults(wizard.template);wizard.reuseApplied=!!initial;wizard.step=1;}
  setupPage();
 }

 async function prepareSavedContext(state,source,generation){
  if(!state.reuseRun)return source;
  const saved=S.savedRunContext(state.reuseRun),desired=state.reuseApplied?state.config:saved.config,session=source.session;
  for(const key of ['momentum.chart','momentum.market','execution.chart','momentum.brick.mode','execution.brick.mode']){
   if(!Object.hasOwn(desired,key))continue;
   const fields=S.fieldsForUI(S.template(source)).flatMap(group=>group.fields),field=fields.find(f=>f.key===key);
   if(!field||field.value===desired[key])continue;
   const response=await command('configure',{tabId:Number(state.sourceId),changes:{[field.stage]:{[field.sourceIndex??field.index]:desired[key]}}});
   if(!alive()||wizard!==state||generation!==state.generation)return null;
   if(response.source?.session!==session)throw Error('RZone changed while loading the saved settings. Connect again.');source=response.source;
  }
  for(const [key,loadFilter]of [['momentum.rs','relativeStrength'],['momentum.market-filter','marketFilter']]){
   if(!desired[key]&&!state.dimensions.some(d=>d.key===key&&Array.isArray(d.values)&&d.values.includes(true)))continue;
   const field=S.fieldsForUI(S.template(source)).flatMap(group=>group.fields).find(f=>f.key===key);if(!field?.needsDiscovery)continue;
   const response=await command('configure',{tabId:Number(state.sourceId),loadFilter});if(!alive()||wizard!==state||generation!==state.generation)return null;if(response.source?.session!==session)throw Error('RZone changed while loading the saved settings. Connect again.');source=response.source;
  }
  for(const key of ['momentum.rs.market','momentum.rs.source','marketFilter.chart','marketFilter.brick.mode','marketFilter.exit.brick.mode']){
   if(!Object.hasOwn(desired,key))continue;const field=S.fieldsForUI(S.template(source)).flatMap(group=>group.fields).find(f=>f.key===key);if(!field||field.value===desired[key])continue;
   const response=await command('configure',{tabId:Number(state.sourceId),changes:{[field.stage]:{[field.sourceIndex??field.index]:desired[key]}}});if(!alive()||wizard!==state||generation!==state.generation)return null;if(response.source?.session!==session)throw Error('RZone changed while loading the saved settings. Connect again.');source=response.source;
  }
  return source;
 }

 function setupSourceValid(){
  if(!wizard||store.demo||!wizard.template)return true;
  const source=tabs.find(t=>String(t.id)===wizard.sourceId);
  if(!source||source.session!==wizard.sourceSession){
   wizard.generation++;wizard.template=null;wizard.sourceSession=null;wizard.step=0;wizard.stale=true;wizard.connecting=false;
   notice.textContent='RZone changed or disconnected. Your entries are kept; reconnect and review them before running.';setupPage();return false;
  }
  return true;
 }

 const choiceCharts=['Candle','P&F','Renko'];
 const stageContext=(config,stage)=>config?[config[stage+'.chart'],config[stage+'.brick.mode']||'',...(stage==='marketFilter'?[config[stage+'.exit.brick.mode']||'']:[])].join(':'):null;
 const contextStages=['momentum','execution','marketFilter'];
 const chartContext=config=>config?contextStages.map(stage=>stageContext(config,stage)).join('|'):null;
 const chartSpecific=key=>/\.(?:chart|signal-mode|box|brick|price|radar|strategy|exit)(?:\.|$)/.test(key)||/\.rs\./.test(key)||/\.price-mode$/.test(key);
 function cacheReceipt(state,source){
  const cache=source?.choiceCache;if(!cache||!['live','cache'].includes(cache.source)||!Array.isArray(cache.charts)||cache.charts.some(c=>!choiceCharts.includes(c))||!(Number.isFinite(Date.parse(cache.checkedAt))||cache.checkedAt===null&&!cache.charts.length))return false;
  state.choiceCache={checkedAt:cache.checkedAt,source:cache.source,scope:cache.scope,charts:[...new Set(cache.charts)],pendingCharts:choiceCharts.filter(c=>!cache.charts.includes(c))};
  return true;
 }
 function acceptSetupSource(state,source){
  const template=S.template(source),config=S.defaults(template),previous=chartContext(state.config),next=chartContext(config),switching=previous&&previous!==next;
  let draft=state.config;
  if(switching){
   state.contextDrafts.set(previous,structuredClone({config:state.config,dimensions:state.dimensions,ruleDrafts:state.ruleDrafts,ruleSearchDrafts:state.ruleSearchDrafts}));
   const saved=state.contextDrafts.get(next),changed=new Set(contextStages.filter(stage=>stageContext(state.config,stage)!==stageContext(config,stage))),canCarry=key=>{
    const stage=key.split('.')[0];if(!changed.has(stage)||!chartSpecific(key))return true;
    // A filter has independent trend and exit brick modes. Changing one mode
    // replaces only that brick's size/mode; the other reviewed inputs stay put.
    if(stage==='marketFilter'&&state.config['marketFilter.chart']===config['marketFilter.chart']){
     if(key.startsWith('marketFilter.brick.'))return state.config['marketFilter.brick.mode']===config['marketFilter.brick.mode'];
     if(key.startsWith('marketFilter.exit.brick.'))return state.config['marketFilter.exit.brick.mode']===config['marketFilter.exit.brick.mode'];
     return true;
    }
    return false;
   };
   // Chart drafts restore only settings owned by the stage being switched.
   // Dates, sizing and the unchanged stage always retain their latest edits.
   const merge=(current,stored,key)=>[...current.filter(item=>canCarry(key(item))),...structuredClone(stored.filter(item=>!canCarry(key(item))))];
   draft=Object.fromEntries(merge(Object.entries(state.config),Object.entries(saved?.config||{}),item=>item[0]));
   state.dimensions=merge(state.dimensions,saved?.dimensions||[],item=>item.key);
   state.ruleDrafts=new Map(merge([...state.ruleDrafts],[...(saved?.ruleDrafts||[])],item=>item[0]));
   state.ruleSearchDrafts=new Map(merge([...state.ruleSearchDrafts],[...(saved?.ruleSearchDrafts||[])],item=>item[0].split('|')[0]));
   state.editorOpen=null;
  }
  if(draft)for(const group of S.fieldsForUI(template))for(const field of group.fields)if((!field.disabled||state.reuseRun)&&!field.chartContext&&Object.hasOwn(draft,field.key))config[field.key]=draft[field.key];
  // A bounded recheck may return the main form before reloading an enabled
  // optional filter. Keep its existing draft until its controls arrive again.
  if(draft)for(const [key,value]of Object.entries(draft))if(!Object.hasOwn(config,key)&&(key.startsWith('momentum.rs.')||key.startsWith('marketFilter.')))config[key]=value;
  state.template=template;state.sourceSession=source.session;state.config=config;state.stale=false;state.choiceCache=null;cacheReceipt(state,source);
 }

 async function warmSetupChoices(state,generation){
  if(!state.choiceCache||store.demo)return;
  const pending=[...state.choiceCache.pendingCharts];if(!pending.length)return;state.connecting=true;
  try{
   for(const chart of pending){
    if(!alive()||wizard!==state||generation!==state.generation)return;state.warmingChart=chart;setupPage();
    const response=await command('configure',{tabId:Number(state.sourceId),warmChart:chart});
    if(!alive()||wizard!==state||generation!==state.generation)return;if(response.source?.session!==state.sourceSession){state.template=null;state.sourceSession=null;state.choiceCache=null;state.step=0;state.stale=true;throw Error('RZone changed while checking choices. Reconnect before continuing.');}
    if(!cacheReceipt(state,response.source)||!state.choiceCache.charts.includes(chart))throw Error('RZone did not finish checking '+chart+' choices.');
   }
  }catch(error){if(alive()&&wizard===state&&generation===state.generation){state.connectionError='Could not check '+state.warmingChart+' choices. '+error.message+' Your current '+state.config['momentum.chart']+' settings are kept.';}}
  finally{state.connecting=false;state.warmingChart=null;if(alive()&&wizard===state&&generation===state.generation)setupPage();}
 }

 async function loadEnabledFilters(state,generation){
  const wasConnecting=state.connecting;let rendered=false;
  try{
   for(const [key,loadFilter] of [['momentum.rs','relativeStrength'],['momentum.market-filter','marketFilter']]){
    if(!alive()||wizard!==state||generation!==state.generation)return false;
    const field=S.fieldsForUI(state.template,state.config).flatMap(g=>g.fields).find(f=>f.key===key);if(!field?.needsDiscovery||!setupEnabled(state,key))continue;
    state.connecting=true;state.loadingFilter=field.label;rendered=true;setupPage();const session=state.sourceSession,response=await command('configure',{tabId:Number(state.sourceId),loadFilter});
    if(!alive()||wizard!==state||generation!==state.generation)return false;if(response.source?.session!==session)throw Error('RZone changed while reading filter settings. Connect again.');acceptSetupSource(state,response.source);
    if(S.fieldsForUI(state.template,state.config).flatMap(g=>g.fields).find(f=>f.key===key)?.needsDiscovery)throw Error('RZone did not finish loading '+field.label+' settings. Try loading them again.');
   }
   return true;
  }finally{state.connecting=wasConnecting;state.loadingFilter=null;if(rendered&&alive()&&wizard===state)setupPage();}
 }

 async function refreshSetupChoices(changes,{recheckAllChoices=false,chartSwitch=null,loadFilter=null}={}){
  const state=wizard;if(!state||state.connecting||store.demo)return;if(!setupSourceValid())return;
  const generation=++state.generation;state.connecting=true;state.connectionError='';for(const control of content.querySelectorAll('.setup-form input,.setup-form select,.setup-form button,.setup-builder button'))control.disabled=true;
  notice.textContent=recheckAllChoices?'Rechecking all choices from RZone…':loadFilter?'Loading '+(loadFilter==='relativeStrength'?'Relative Strength':'Market Trend Filter')+' settings…':chartSwitch?'Loading '+chartSwitch.value+' settings…':'Refreshing the choices from RZone…';
  try{const response=await command('configure',{tabId:Number(state.sourceId),...(changes?{changes}:{}),...(recheckAllChoices?{recheckAllChoices:true}:{}),...(loadFilter?{loadFilter}:{})});if(!alive()||wizard!==state||generation!==state.generation)return;if(chartSwitch){const config=S.defaults(S.template(response.source));if(config[chartSwitch.key]!==chartSwitch.value)throw Error('RZone did not switch to '+chartSwitch.value+'. Your previous settings are kept.');}acceptSetupSource(state,response.source);if(loadFilter&&S.fieldsForUI(state.template,state.config).flatMap(g=>g.fields).find(f=>f.key===(loadFilter==='relativeStrength'?'momentum.rs':'momentum.market-filter'))?.needsDiscovery)throw Error('RZone did not finish loading these filter settings. Try loading them again.');notice.textContent='';if(await loadEnabledFilters(state,generation))await warmSetupChoices(state,generation);}
  catch(error){if(!alive()||wizard!==state||generation!==state.generation)return;state.connectionError=error.message;throw error;}
  finally{state.connecting=false;if(alive()&&wizard===state)setupPage();}
 }

 function switchSetupChart(state,field,value){
  if(wizard!==state||state.connecting||state.ruleLookup||state.config[field.key]===value)return;
  if(store.demo){const options={momentumChart:state.config['momentum.chart'],executionChart:state.config['execution.chart']};for(const stage of ['momentum','execution'])if(options[stage+'Chart']==='Renko')options[stage+'BrickMode']=state.config[stage+'.brick.mode'];options[field.stage+(field.key.endsWith('.chart')?'Chart':'BrickMode')]=value;if(options[field.stage+'Chart']!=='Renko')delete options[field.stage+'BrickMode'];acceptSetupSource(state,S.demoTemplate(options));setupPage();return;}
  return refreshSetupChoices({[field.stage]:{[field.sourceIndex??field.index]:value}},{chartSwitch:{key:field.key,value}});
 }

 async function searchSetupRule(state,field,rawQuery){
  if(wizard!==state||state.connecting||state.ruleLookup||!setupSourceValid())return;
  const query=rawQuery.trim();if(!query||query.length>200||/[\u0000-\u001f\u007f]/.test(query))throw Error('Enter a rule name to search (up to 200 characters).');
  const category=state.config[field.sourceKey],draftKey=field.key+'|'+category,generation=state.generation,session=state.sourceSession,sourceId=state.sourceId,template=state.template;
  const request={fieldKey:field.key,category,query};state.ruleLookup=request;state.ruleSearchDrafts.set(draftKey,query);setupPage();
  const current=()=>alive()&&wizard===state&&state.generation===generation&&state.sourceSession===session&&state.sourceId===sourceId&&state.template===template&&state.config[field.sourceKey]===category&&state.ruleSearchDrafts.get(draftKey)?.trim()===query;
  try{
   const response=await command('lookup-rule',{tabId:Number(sourceId),session,...(field.stage!=='momentum'?{stage:field.stage}:{}),parentIndex:field.index-1,category,query});if(!current()||!setupSourceValid())return;
   const result=response.result;if(!result||(result.stage??'momentum')!==field.stage||result.parentIndex!==field.index-1||result.childIndex!==field.index||result.category!==category||result.query!==query||result.controlType!=='text'||!Array.isArray(result.options))throw Error('RZone returned choices for a different rule search. Search again.');
   const next=structuredClone(template),stage=field.sourceContainer?next.stages[field.stage][field.sourceContainer]:next.stages[field.stage],catalogue=stage.ruleCatalogues[field.index],options=structuredClone(result.options);
   if(stage.fields[field.index-1].value===category){
    // Keep the original source reading intact, without presenting an old
    // committed value as an available result of a different keyword search.
    const original=stage.fields[field.index].value,choice=stage.options[field.index]?.find(o=>o.value===original);
    if(original&&choice&&!options.some(o=>(typeof o==='string'?o:o?.label)===original)){if(options.length>=3000)throw Error('Too many rule matches. Search with a more specific name.');options.push({...choice,disabled:true});}
    stage.options[field.index]=options;
   }
   catalogue.categories[category]=options;(catalogue.searchQueries||={})[category]=query;
   state.template=S.template(next);notice.textContent='';
  }catch(error){if(current())throw error;}
  finally{if(state.ruleLookup===request)state.ruleLookup=null;if(alive()&&wizard===state)setupPage();}
 }

 async function searchSetupSymbol(state,field,rawQuery){
  if(wizard!==state||state.connecting||state.ruleLookup||!setupSourceValid())return;
  const query=rawQuery.trim();if(!query||query.length>200||/[\u0000-\u001f\u007f]/.test(query))throw Error('Enter a symbol name to search (up to 200 characters).');
  const market=state.config[field.marketKey],draftKey=field.key+'|'+market,generation=state.generation,session=state.sourceSession,sourceId=state.sourceId,template=state.template,request={fieldKey:field.key,market,query};state.ruleLookup=request;state.ruleSearchDrafts.set(draftKey,query);setupPage();
  const current=()=>alive()&&wizard===state&&state.generation===generation&&state.sourceSession===session&&state.sourceId===sourceId&&state.template===template&&state.config[field.marketKey]===market&&state.ruleSearchDrafts.get(draftKey)?.trim()===query;
  try{
   const response=await command('lookup-symbol',{tabId:Number(sourceId),session,stage:field.stage,fieldIndex:field.index,market,query});if(!current()||!setupSourceValid())return;
   const result=response.result;if(!result||(result.session!==undefined&&result.session!==session)||result.stage!==field.stage||result.fieldIndex!==field.index||result.market!==market||result.query!==query||result.controlType!=='text'||!Array.isArray(result.options))throw Error('RZone returned choices for a different symbol search. Search again.');
   const next=structuredClone(template),stage=field.sourceContainer?next.stages[field.stage][field.sourceContainer]:next.stages[field.stage],options=structuredClone(result.options),original=stage.fields[field.index].value,choice=stage.options[field.index]?.find(o=>o.value===original);
   if(original&&choice&&!options.some(o=>o.label===original)){if(options.length>=3000)throw Error('Too many symbol matches. Search with a more specific name.');options.push({...choice,disabled:true});}
   stage.options[field.index]=options;(stage.symbolQueries||={})[field.index]={market,query};state.template=S.template(next);notice.textContent='';
  }catch(error){if(current())throw error;}
  finally{if(state.ruleLookup===request)state.ruleLookup=null;if(alive()&&wizard===state)setupPage();}
 }

 function setupPage(){
  clearCalendars();motion?.enter(content,'setup');
  if(!wizard)return;const state=wizard;selected=null;panel.classList.add('is-setup');const globalDemo=document.getElementById('demo-banner');environment.hidden=!!(store.demo&&globalDemo&&!globalDemo.hidden)||extension;panel.classList.toggle('has-workbench',state.step>0);content.replaceChildren(heading('Set up your test',true),journey('setup'));
  const shell=el('div',undefined,'experiment-builder setup-builder');content.append(shell);
  if(state.reuseRun){const from=el('div',undefined,'setup-reuse-context');from.append(el('strong','Based on '+(state.reuseRun.name||'saved run')),el('span','Edit the settings below. Running saves a new study.'));shell.append(from);}
  if(!store.demo&&!extension){shell.append(el('h3','Open your installed Vault'),el('p','New tests use the settings and available choices from your RZone session. Open Backtest Vault from Chrome’s extensions to connect it.','muted'),button('Use a saved run',()=>builder(),'quiet'));return;}
  if(state.step===0){
   shell.append(el('h3','Connect to RZone'),el('p','Vault collects the available settings from your signed-in RZone tab. No backtest starts yet.','muted'));
   if(state.stale)shell.append(el('p','Your previous entries will be available to review after reconnecting.','setup-kept'));
   const picker=select([['','Choose RZone tab']]),hint=el('p','','mini'),connectionError=el('p','','notice error setup-connection-error'),actions=el('div',undefined,'setup-actions'),connect=button('Connect RZone',()=>action(async()=>{
    const tab=tabs.find(t=>String(t.id)===state.sourceId);if(!tab||!(tab.capable??tab.ready))throw Error(tab?.reason||'Open RZone and sign in before connecting.');
    const generation=++state.generation;state.autoConnectAttempted=true;state.connecting=true;state.connectionError='';sync();
    try{
     const response=await command('configure',{tabId:tab.id});if(!alive()||wizard!==state||generation!==state.generation)return;
     const source=await prepareSavedContext(state,response.source,generation);if(!source||!alive()||wizard!==state||generation!==state.generation)return;
     acceptSetupSource(state,source);if(state.reuseRun&&!state.reuseApplied){state.config=S.configFromRun(state.reuseRun,state.template);state.reuseApplied=true;}state.step=1;state.connecting=false;notice.textContent='';setupPage();if(await loadEnabledFilters(state,generation))await warmSetupChoices(state,generation);
    }catch(error){if(!alive()||wizard!==state||generation!==state.generation)return;state.connectionError=error.message;if(state.step!==0){state.step=0;state.template=null;state.sourceSession=null;state.connecting=false;setupPage();}throw error;}
    finally{state.connecting=false;if(wizard===state&&state.step===0)sync();}
   }),'primary');picker.dataset.rzone='setup';picker.setAttribute('aria-label','RZone tab');connectionError.setAttribute('role','alert');
   function sync(){
    if(wizard!==state||state.step!==0)return;const available=tabs.filter(t=>t.capable??t.ready);if(!state.sourceId&&available.length===1)state.sourceId=String(available[0].id);
    if(document.activeElement!==picker){const options=[['','Choose RZone tab'],...tabs.map(t=>[String(t.id),'RZone'+((t.capable??t.ready)?'':' · unavailable')+' · tab '+t.id])];if(state.sourceId&&!tabs.some(t=>String(t.id)===state.sourceId))options.push([state.sourceId,'RZone · not connected']);if(JSON.stringify([...picker.options].map(o=>[o.value,o.textContent]))!==JSON.stringify(options))picker.replaceChildren(...[...select(options).options]);picker.value=state.sourceId;}
    const source=tabs.find(t=>String(t.id)===state.sourceId);connect.disabled=state.connecting||!source||!(source.capable??source.ready);connect.textContent=state.connecting?'Reading available settings…':'Connect RZone';picker.disabled=state.connecting;hint.textContent=source?.reason||(!source?'Open RZone and sign in. Vault will detect the tab here.':'');hint.hidden=!hint.textContent;
    connectionError.textContent=state.connectionError;connectionError.hidden=!state.connectionError;
    if(!state.autoConnectAttempted&&!state.stale&&!state.connecting&&available.length===1&&String(available[0].id)===state.sourceId){
     state.autoConnectAttempted=true;const sourceId=state.sourceId,generation=state.generation;
     queueMicrotask(()=>{if(alive()&&wizard===state&&state.step===0&&state.generation===generation&&state.sourceId===sourceId&&tabs.filter(t=>t.capable??t.ready).length===1&&!connect.disabled)connect.click();});
    }
   }
   picker.onchange=()=>{state.autoConnectAttempted=true;state.sourceId=picker.value;state.template=null;state.sourceSession=null;state.generation++;sync();};picker.onblur=sync;refreshSource=sync;sync();
   actions.append(connect,button('Open RZone',()=>action(async()=>{await command('open-source');await load();sync();}),'quiet'));shell.append(label('Source',picker),hint,connectionError,actions);return;
  }
  if(!state.template){state.step=0;setupPage();return;}
  if(extension){const sourceBar=el('div',undefined,'setup-source-bar'),cache=state.choiceCache;let status='Connected to RZone';if(state.loadingFilter)status='Loading '+state.loadingFilter+' settings…';else if(state.warmingChart)status='Checking '+state.warmingChart+' choices… ('+Math.min(3,(cache?.charts.length||0)+1)+' of 3)';else if(cache&&!cache.pendingCharts.length){const when=new Date(cache.checkedAt);status=cache.source==='cache'||cache.scope==='shared-native'?'Using today’s dropdown choices':'Choices checked '+(when.toDateString()===new Date().toDateString()?'today':when.toLocaleDateString('en-IN'));}else if(cache?.charts.length)status='Choices ready: '+cache.charts.join(' · ');const refresh=button('Recheck all choices',()=>action(()=>refreshSetupChoices(undefined,{recheckAllChoices:true})),'quiet');refresh.disabled=state.connecting||!!state.ruleLookup;const receipt=el('span',status,'mini');receipt.setAttribute('role','status');receipt.setAttribute('aria-live','polite');if(cache?.checkedAt)receipt.title='Last checked '+new Date(cache.checkedAt).toLocaleString('en-IN');sourceBar.append(receipt,refresh);shell.append(sourceBar);}
  if(state.connectionError){const error=el('p',state.connectionError,'notice error setup-connection-error');error.setAttribute('role','alert');shell.append(error);}
  shell.classList.add('source-workbench');
  buildWorkbench(shell,state);
 }

 function setupPlan(state){
  return {id:'preview',name:state.name,baseline:S.configToBaseline(state.config,state.template,{id:state.reuseRun?.id||'setup-preview',name:state.name,demo:store.demo}),dimensions:state.dimensions.map(d=>({key:d.key,values:d.values})),mode:state.mode,budget:state.budget,objective:state.objective,ceiling:state.ceiling,minTrades:state.minTrades,seed:state.seed,timeoutMinutes:state.timeout};
 }

 const setupEnabled=(state,key)=>!key||!!state.config[key]||state.dimensions.some(d=>d.key===key&&Array.isArray(d.values)&&d.values.includes(true));
 const setupFieldActive=(state,field)=>(field.activeWhen||[]).every(condition=>{const dimension=state.dimensions.find(d=>d.key===condition.key),values=dimension&&Array.isArray(dimension.values)?dimension.values:[state.config[condition.key]];return values.some(value=>condition.values.includes(value));});
 const priceKeys=key=>/^marketFilter(?:\.exit)?\.price-mode$/.test(key)?[key.slice(0,-'.price-mode'.length)+'.price.close-only',key.slice(0,-'.price-mode'.length)+'.price.high-low']:null;
 const setupFieldValue=(state,field)=>{const keys=priceKeys(field.key);return keys?(!!state.config[keys[0]]===!!state.config[keys[1]]?'':state.config[keys[0]]?'close-only':'high-low'):state.config[field.key];};
 function rememberRuleCategory(state,field){
  const children=[...state.fields.values()].filter(f=>f.rule&&f.sourceKey===field.key);
  for(const child of children){
   let drafts=state.ruleDrafts.get(child.key);if(!drafts){drafts=new Map();state.ruleDrafts.set(child.key,drafts);}
   const dimension=state.dimensions.find(d=>d.key===child.key);drafts.set(state.config[field.key],{value:state.config[child.key],dimension:dimension?structuredClone(dimension):null});
  }
  return children;
 }
 function switchRuleCategory(state,field,category){
  const previous=state.config[field.key];if(previous===category)return true;
  const children=rememberRuleCategory(state,field);
  const nextConfig={...state.config,[field.key]:category},nextFields=S.fieldsForUI(state.template,nextConfig).flatMap(g=>g.fields);
  let dimensions=state.dimensions.filter(d=>!children.some(f=>f.key===d.key));
  for(const child of children){
   const saved=state.ruleDrafts.get(child.key).get(category),next=nextFields.find(f=>f.key===child.key);
   const placeholder=next?.options.find(o=>o.value===''||/^[-\s]*select\b/i.test(o.label||o.value));
   nextConfig[child.key]=saved?saved.value:placeholder?.value??'';
   if(saved?.dimension)dimensions.push(structuredClone(saved.dimension));
  }
  if(dimensions.length>6){notice.textContent='Use at most six changing settings in one test batch. Remove a test range before restoring this category.';return false;}
  state.generation++;state.config=nextConfig;state.dimensions=dimensions;state.editorOpen=null;setupPage();
  content.querySelector('[data-setup-field="'+field.key+'"]')?.focus();return true;
 }
 function workbenchChanged(state){
  // A field's visible alternatives are its source of truth. Returning to one
  // value must keep an included value, never revive an unseen old baseline.
  for(const dimension of state.dimensions){const field=state.catalog?.find(f=>f.key===dimension.key);if(!field||field.type==='boolean'||field.type==='date-range')continue;try{const value=E.values(dimension.values,field)[0],keys=priceKeys(field.key);if(keys){state.config[keys[0]]=value==='close-only';state.config[keys[1]]=value==='high-low';}else state.config[field.key]=value;}catch{}}
  for(const item of state.controls||[]){
   if(!item.control.isConnected)continue;
   const f=item.field,inspect=f.key.endsWith('.chart')&&f.options?.length>1;
   item.control.disabled=state.connecting||!!(item.lookupButton&&state.ruleLookup)||!!(f.disabled&&!inspect)||!setupEnabled(state,f.enabledBy)||!setupFieldActive(state,f);
   if(!item.auxiliary&&state.dimensions.some(d=>d.key===f.key)&&f.type!=='boolean'){const value=String(setupFieldValue(state,f)??'');if(item.control.type==='radio')item.control.checked=item.control.value===value;else item.control.value=value;}
  }
  for(const item of state.conditionals||[])item.wrap.hidden=!setupFieldActive(state,item.field);
  for(const update of state.countUpdates||[])update();
 }

 function variationEditor(state,field){
  const candidate=state.catalog.find(f=>f.key===field.key);if(!candidate||candidate.type==='boolean'||candidate.type==='enum'&&!candidate.options.length)return null;
  const holder=el('div',undefined,'source-variation'),toggle=button('Test values',()=>{},'source-test-values'),editor=el('div',undefined,'source-values-editor'),chips=el('div',undefined,'source-value-tokens');holder.dataset.variationFor=field.key;editor.dataset.editorFor=field.key;editor.hidden=state.editorOpen!==field.key;holder.append(chips,toggle,editor);
  const dimension=()=>state.dimensions.find(d=>d.key===field.key);
  const summary=()=>{const d=dimension();toggle.textContent=d?'Edit values':'Test values';toggle.disabled=state.connecting;toggle.setAttribute('aria-label','Test values for '+field.label);toggle.classList.toggle('is-active',!!d);toggle.setAttribute('aria-expanded',String(!editor.hidden));chips.replaceChildren();chips.hidden=!d;holder.closest('.source-field')?.classList.toggle('has-test-values',!!d);if(d){try{const values=E.values(d.values,candidate);for(const value of values.slice(0,3)){const chip=button(settingDisplay(field,value),()=>{const remaining=values.filter(v=>v!==value);if(remaining.length){d.values=['date','enum'].includes(candidate.type)?remaining:remaining.join(', ');d.editorMode='values';}else{state.dimensions=state.dimensions.filter(x=>x.key!==field.key);state.editorOpen=null;editor.hidden=true;}draw();workbenchChanged(state);toggle.focus();},'source-value-token');chip.title='Remove '+settingDisplay(field,value);chip.setAttribute('aria-label','Remove '+field.label+' test value '+settingDisplay(field,value));chip.disabled=state.connecting;chips.append(chip);}if(values.length>3)chips.append(el('span','+'+(values.length-3),'source-token-overflow'));}catch{chips.append(el('span','Review values','source-token-error'));}}if(state.connecting)for(const n of editor.querySelectorAll('button,input,select'))n.disabled=true;};
  function draw(){
   const d=dimension();editor.replaceChildren();if(!d)return;editor.append(el('strong',field.label));
   const current=setupFieldValue(state,field);
   if(candidate.type==='date'){
    if(!Array.isArray(d.values))d.values=[String(d.values||current)];
    const list=el('div',undefined,'source-date-values');
    d.values.forEach((value,index)=>{const row=el('div',undefined,'source-date-value'),n=input(value,'date');n.setAttribute('aria-label',field.label+' test date '+(index+1));n.required=true;n.oninput=()=>{d.values[index]=n.value;workbenchChanged(state);};const remove=button('Remove',()=>{d.values.splice(index,1);draw();workbenchChanged(state);},'quiet');remove.setAttribute('aria-label','Remove '+field.label+' test date '+(index+1));row.append(n,remove);list.append(row);});
    const add=button('Add date',()=>{d.values.push('');draw();workbenchChanged(state);const n=editor.querySelector('.source-date-value:last-child input');n?.focus();},'quiet');add.disabled=d.values.length>=100;editor.append(list,add);
   }else if(candidate.type==='enum'){
    const choices=candidate.options;
    const list=el('div',undefined,'source-value-choices');
    const missing=Array.isArray(d.values)?d.values.filter(value=>!choices.some(o=>o.value===value)).map(value=>({value,label:value+' · unavailable'})):[];
    for(const option of [...choices,...missing]){const checkbox=input('','checkbox');checkbox.checked=Array.isArray(d.values)&&d.values.includes(option.value);checkbox.onchange=()=>{const values=Array.isArray(d.values)?d.values:[];d.values=checkbox.checked?[...values,option.value]:values.filter(v=>v!==option.value);workbenchChanged(state);};list.append(label(option.label,checkbox));}
    if(choices.length>12){const search=input('','search');search.placeholder='Find a choice';search.setAttribute('aria-label','Find '+field.label+' test values');search.oninput=()=>{const query=search.value.trim().toLocaleLowerCase();for(const item of list.children)item.hidden=!item.textContent.toLocaleLowerCase().includes(query);};editor.append(search);}editor.append(list);
   }else{
    const seedRange=()=>{
     const parts=typeof d.values==='string'?d.values.split(':'):[];
     if(parts.length===3){d.range={from:parts[0],to:parts[1],step:parts[2]};d.rangePreservesValues=false;return;}
     try{
      const values=E.values(d.values,candidate),step=values.length>1?Number((values[1]-values[0]).toFixed(8)):1,range={from:String(values[0]),to:String(values.at(-1)),step:String(step)};
      if(step>0&&JSON.stringify(E.values(range.from+':'+range.to+':'+range.step,candidate))===JSON.stringify(values)){d.range=range;d.rangePreservesValues=false;return;}
     }catch{}
     // A non-arithmetic list cannot be represented by one positive-step range.
     // Opening its range editor must not replace the already planned values.
     d.range={from:'',to:'',step:'1'};d.rangePreservesValues=true;
    };
    const modes=el('div',undefined,'source-value-modes');for(const mode of ['Values','Range']){const b=button(mode,()=>{const next=mode.toLowerCase();if(next===(d.editorMode||'values'))return;if(next==='range')seedRange();else{try{d.values=E.values(d.values,candidate).join(', ');}catch{if(Array.isArray(d.values))d.values=d.values.join(', ');}}d.editorMode=next;draw();workbenchChanged(state);},'quiet');b.setAttribute('aria-pressed',String((d.editorMode||'values')===mode.toLowerCase()));modes.append(b);}editor.append(modes);
    if(d.editorMode==='range'){
     const fields=el('div',undefined,'source-range-inputs'),kept=el('p','Current values stay until you edit this range.','mini');if(!d.range)seedRange();kept.hidden=!d.rangePreservesValues;
     for(const [key,title] of [['from','From'],['to','To'],['step','Step']]){const n=input(d.range[key],'number');n.step=candidate.integer?'1':'any';n.setAttribute('aria-label',field.label+' range '+title.toLowerCase());n.oninput=()=>{d.range[key]=n.value;d.rangePreservesValues=false;kept.hidden=true;d.values=d.range.from+':'+d.range.to+':'+d.range.step;workbenchChanged(state);};fields.append(label(title,n));}editor.append(fields,kept);
    }else{
     const n=input(Array.isArray(d.values)?d.values.join(', '):String(d.values??''));n.placeholder='Enter values, separated by commas';n.setAttribute('aria-label',field.label+' test values');n.oninput=()=>{d.values=n.value;delete d.range;delete d.rangePreservesValues;workbenchChanged(state);};editor.append(label('Values, separated by commas',n));
    }
   }
   const actions=el('div',undefined,'source-value-actions');actions.append(button('Use current value',()=>{state.dimensions=state.dimensions.filter(d=>d.key!==field.key);state.editorOpen=null;editor.hidden=true;summary();workbenchChanged(state);},'quiet'),button('Done',()=>{state.editorOpen=null;editor.hidden=true;summary();workbenchChanged(state);},'secondary'));editor.append(actions);summary();
  }
  toggle.onclick=()=>{
   if(!dimension()){if(state.dimensions.length>=6){notice.textContent='Use at most six changing settings in one test batch.';return;}state.dimensions.push({key:field.key,values:['enum','date'].includes(candidate.type)?[setupFieldValue(state,field)]:String(setupFieldValue(state,field)),editorMode:'values'});}
   const open=editor.hidden;for(const n of content.querySelectorAll('.source-values-editor'))n.hidden=true;state.editorOpen=open?field.key:null;editor.hidden=!open;draw();summary();workbenchChanged(state);
  };state.countUpdates.push(summary);draw();summary();return holder;
 }

 function sourceField(state,key,{text='',radios=false,showLabel=false,variation=true}={}){
  const field=state.fields.get(key);if(!field)return el('span','Setting unavailable','mini');const value=state.config[key],wrap=el('div',undefined,'source-field');wrap.dataset.sourceField=key;wrap.hidden=!setupFieldActive(state,field);if(field.activeWhen?.length)state.conditionals.push({field,wrap});
  const caption=field.label.replace(/^Use /,'');if(showLabel&&field.type!=='boolean')wrap.append(el('span',caption,'source-control-label'));
  const line=el('div',undefined,'source-control-line');wrap.append(line);
  if(radios){
   const options=el('div',undefined,'source-radios');for(const option of field.options||[]){const n=input(option.value,'radio');n.name='setup-'+key;n.checked=String(value)===String(option.value);n.disabled=state.connecting||!!field.disabled||!!option.disabled||!setupEnabled(state,field.enabledBy);n.dataset.setupField=key;n.setAttribute('aria-label',caption+' · '+option.label);n.onchange=()=>{if(n.checked){state.config[key]=n.value;workbenchChanged(state);}};state.controls.push({field,control:n});options.append(label(option.label,n));}line.append(options);
  }else{
   let control,combo,unavailable=false;
   const stateChoice=field.type==='boolean'&&!field.disabled;
   const variableState=stateChoice&&variation&&state.catalog.some(f=>f.key===key&&f.type==='boolean');
   const selectedState=()=>state.dimensions.some(d=>d.key===key&&Array.isArray(d.values)&&d.values.includes(true)&&d.values.includes(false))?'both':String(!!state.config[key]);
   if(stateChoice){control=select([['false','Off'],['true','On'],...(variableState?[['both','Test both']]:[])]);control.classList.add('source-state-select');control.value=selectedState();control.dataset.mode=control.value;}
   else if(field.type==='boolean'){control=input('','checkbox');control.checked=!!value;}
   else if(field.type==='select'){
    const options=field.options||[];control=select(options.map(o=>[String(o.value),(o.label||String(o.value))+(field.rule&&o.disabled?' · unavailable':'')]));options.forEach((o,i)=>{control.options[i].disabled=!!o.disabled;if(o.reason)control.options[i].title=o.reason;else if(field.rule&&o.disabled)control.options[i].title='This choice is unavailable in the current source results.';});
    if(field.nativeType==='text'&&options.length&&!options.some(o=>o.value==='')){const placeholder=el('option','Select a rule');placeholder.value='';placeholder.disabled=true;control.prepend(placeholder);}
    if(!options.length){const empty=el('option',field.searchable||field.symbol?(field.searchQuery?'No matching choices':'Search RZone to load choices'):'No choices available');empty.value='';empty.disabled=true;control.append(empty);}
    if(!options.some(o=>String(o.value)===String(value))&&String(value??'')){const missing=el('option',String(value)+' · unavailable');missing.value=String(value);missing.disabled=true;control.append(missing);unavailable=true;}else if(field.rule&&options.some(o=>String(o.value)===String(value)&&o.disabled))unavailable=true;control.value=String(value??'');
   }else if(field.type==='combobox'){
    const choiceName=field.symbol?'symbol':'group';control=input(value??'');combo=el('div',undefined,'source-combobox');const menu=el('div',undefined,'source-choice-menu'),status=el('span','','source-choice-status'),options=field.options||[];let shown=[],active=-1;
    menu.id='source-choices-'+key.replaceAll('.','-');menu.setAttribute('role','listbox');menu.setAttribute('aria-label',caption+' choices');menu.hidden=true;status.id=menu.id+'-status';status.setAttribute('role','status');status.hidden=true;
    control.setAttribute('role','combobox');control.setAttribute('aria-autocomplete','list');control.setAttribute('aria-controls',menu.id);control.setAttribute('aria-expanded','false');control.setAttribute('aria-describedby',status.id);control.autocomplete='off';control.maxLength=200;
    const validity=()=>{const missing=!!control.value&&!options.some(o=>String(o.value)===control.value&&!o.disabled);control.setAttribute('aria-invalid',String(missing));wrap.classList.toggle('setup-unavailable',missing);status.textContent=missing?'Choose an available '+choiceName+'.':!options.length?(field.symbol?'Search RZone to load symbols.':'No groups available in RZone.'):'';status.hidden=!status.textContent;};
    const close=()=>{menu.hidden=true;control.setAttribute('aria-expanded','false');control.removeAttribute('aria-activedescendant');active=-1;};
    const highlight=()=>{const nodes=[...menu.querySelectorAll('[role=option]')];nodes.forEach((n,i)=>n.classList.toggle('is-active',i===active));if(active<0)control.removeAttribute('aria-activedescendant');else{control.setAttribute('aria-activedescendant',nodes[active].id);nodes[active].scrollIntoView?.({block:'nearest'});}};
    const choose=option=>{if(control.disabled||option.disabled)return;control.value=String(option.value);control.dispatchEvent(new Event('change',{bubbles:true}));validity();close();};
    const open=(filter=false)=>{if(control.disabled)return;const query=filter?control.value.trim().toLocaleLowerCase():'';shown=options.filter(o=>!query||String(o.label||o.value).toLocaleLowerCase().includes(query));active=-1;menu.replaceChildren();shown.forEach((option,i)=>{const n=el('div',option.label||String(option.value),'source-choice-option');n.id=menu.id+'-'+i;n.setAttribute('role','option');n.setAttribute('aria-selected',String(String(option.value)===control.value));n.setAttribute('aria-disabled',String(!!option.disabled));n.onpointerdown=event=>event.preventDefault();n.onmousedown=event=>event.preventDefault();n.onclick=()=>choose(option);menu.append(n);});if(!shown.length)menu.append(el('div',options.length?'No matching '+choiceName+'s':field.symbol?'Search RZone to load symbols':'No groups available','source-choice-empty'));menu.hidden=false;control.setAttribute('aria-expanded','true');highlight();};
    control.addEventListener('focus',()=>open());control.addEventListener('click',()=>{if(menu.hidden)open();});control.addEventListener('input',()=>{validity();open(true);});control.addEventListener('change',validity);control.addEventListener('blur',close);
    control.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}else if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(menu.hidden)open();const direction=event.key==='ArrowDown'?1:-1;let next=active<0?(direction>0?0:shown.length-1):active+direction;while(next>=0&&next<shown.length&&shown[next].disabled)next+=direction;if(next>=0&&next<shown.length)active=next;highlight();}else if(event.key==='Enter'&&!menu.hidden){event.preventDefault();event.stopPropagation();if(active>=0)choose(shown[active]);else close();}});
    combo.append(control,menu,status);validity();
   }else{control=input(value??'',field.type==='number'?'number':field.type==='date'?'date':'text');if(field.min!==undefined)control.min=field.min;if(field.max!==undefined)control.max=field.max;if(field.type==='number')control.step=field.integer?'1':'any';}
   control.dataset.setupField=key;control.setAttribute('aria-label',caption);control.title=field.reason||field.help||(variableState?caption+': On uses it, Off skips it, Test both compares separate On and Off runs.':caption);if(key==='momentum.group')control.placeholder='Search Group';control.required=!field.disabled&&field.type!=='boolean';const inspectChart=key.endsWith('.chart')&&field.options?.length>1;control.disabled=state.connecting||!!(field.disabled&&!inspectChart)||!setupEnabled(state,field.enabledBy)||!setupFieldActive(state,field);
   if(field.type==='boolean'&&(!stateChoice||text)){const l=label(text,control);l.className=stateChoice?'source-state-label':'source-check';line.append(l);}else line.append(combo||control);
   if(unavailable){wrap.classList.add('setup-unavailable');control.setAttribute('aria-invalid','true');line.title='This choice is no longer available. Select another option.';if(field.rule&&!field.options?.length)wrap.append(button('Clear unavailable choice',()=>{state.config[key]='';if(field.enabledBy)state.config[field.enabledBy]=false;state.dimensions=state.dimensions.filter(d=>d.key!==key&&d.key!==field.enabledBy);setupPage();},'quiet'));}
   const update=()=>{
    if(stateChoice){
     if(control.value==='both'){
      if(!variableState)return;
      if(!state.dimensions.some(d=>d.key===key)){if(state.dimensions.length>=6){notice.textContent='Use at most six changing settings in one test batch.';control.value=selectedState();return;}state.dimensions.push({key,values:[true,false]});}
      else state.dimensions.find(d=>d.key===key).values=[true,false];
     }else{state.config[key]=control.value==='true';state.dimensions=state.dimensions.filter(d=>d.key!==key);}
     control.dataset.mode=control.value;
    }else state.config[key]=control.type==='checkbox'?control.checked:control.value;
    workbenchChanged(state);
   };
   if(!field.cachedCategories&&!field.chartContext)control.addEventListener('input',update);
   control.addEventListener('change',()=>{
    if(field.chartContext&&!field.disabled){void action(()=>switchSetupChart(state,field,control.value));return;}
    if(field.cachedCategories?.includes(control.value)){
     if(!switchRuleCategory(state,field,control.value))control.value=state.config[key];return;
    }
    if(field.cachedCategories)rememberRuleCategory(state,field);
    update();if(field.needsDiscovery&&extension&&setupEnabled(state,field.key)){void action(()=>refreshSetupChoices(undefined,{loadFilter:field.key==='momentum.rs'?'relativeStrength':'marketFilter'}));return;}if(field.refreshOnChange&&extension)void action(()=>refreshSetupChoices({[field.stage]:{[field.sourceIndex??field.index]:control.value}}));
   });state.controls.push({field,control});
  }
  if(field.symbol&&extension){
   const market=state.config[field.marketKey],draftKey=field.key+'|'+market,search=el('div',undefined,'source-rule-search'),query=input(state.ruleSearchDrafts.get(draftKey)??field.searchQuery??''),pending=state.ruleLookup?.fieldKey===field.key&&state.ruleLookup.market===market;
   query.placeholder='Search symbols';query.maxLength=200;query.setAttribute('aria-label','Search '+caption+' in '+market);query.dataset.symbolSearch=field.key;query.addEventListener('input',()=>state.ruleSearchDrafts.set(draftKey,query.value));
   const find=button(pending?'Searching…':'Search',()=>action(()=>searchSetupSymbol(state,field,query.value)),'quiet');find.setAttribute('aria-label','Search RZone for '+caption+' in '+market);find.disabled=!!state.ruleLookup||state.connecting||!setupEnabled(state,field.enabledBy)||!setupFieldActive(state,field);query.disabled=state.connecting||!setupEnabled(state,field.enabledBy)||!setupFieldActive(state,field);state.controls.push({field,control:query,auxiliary:true},{field,control:find,auxiliary:true,lookupButton:true});query.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();if(!find.disabled)find.click();}});search.append(query,find);wrap.append(search);
  }else if(field.searchable&&extension){
   const draftKey=field.key+'|'+field.categoryKey,search=el('div',undefined,'source-rule-search'),query=input(state.ruleSearchDrafts.get(draftKey)??field.searchQuery??''),pending=state.ruleLookup?.fieldKey===field.key&&state.ruleLookup.category===field.categoryKey;
   query.placeholder='Search rules';query.maxLength=200;query.setAttribute('aria-label','Search '+caption+' in '+field.categoryKey);query.dataset.ruleSearch=field.key;query.addEventListener('input',()=>state.ruleSearchDrafts.set(draftKey,query.value));
   const find=button(pending?'Searching…':'Search',()=>action(()=>searchSetupRule(state,field,query.value)),'quiet');find.setAttribute('aria-label','Search RZone for '+caption+' in '+field.categoryKey);find.disabled=!!state.ruleLookup||state.connecting;query.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();if(!find.disabled)find.click();}});search.append(query,find);wrap.append(search);
  }
  if(field.disabled)wrap.classList.add('source-fixed');if(variation){const editor=variationEditor(state,field);if(editor)wrap.append(editor);}return wrap;
 }

 function buildWorkbench(shell,state){
  const groups=S.fieldsForUI(state.template,state.config);state.fields=new Map(groups.flatMap(g=>g.fields).map(f=>[f.key,f]));state.catalog=E.catalogFromSetup?E.catalogFromSetup(state.template,state.config):[];state.controls=[];state.conditionals=[];state.countUpdates=[];
  const form=el('form',undefined,'setup-form source-main-form');form.onsubmit=event=>{event.preventDefault();openBacktest(state);};shell.append(form);
  form.append(el('h3','Strategy settings'));
  const field=(key,opts)=>sourceField(state,'momentum.'+key,opts);
  const row=(title,children,cls='')=>{const n=el('div',undefined,'source-row '+cls);n.append(el('span',title,'source-row-label'));const values=el('div',undefined,'source-row-controls');values.append(...children);n.append(values);return n;};
  const overview=el('section',undefined,'source-overview-grid');overview.setAttribute('aria-label','Chart, market, group and timeframe');for(const key of ['chart','market','group','timeframe'])overview.append(field(key,{variation:['group','timeframe'].includes(key),showLabel:true}));form.append(overview);
  const periods=[],weights=[];for(let i=1;i<=4;i++){const pair=el('div',undefined,'source-period-pair');pair.append(el('span','Period '+i,'source-pair-heading'),field('period.'+i+'.enabled'),field('period.'+i));periods.push(pair);weights.push(field('period.'+i+'.weight'));}
  const periodGrid=el('section',undefined,'source-period-grid');periodGrid.setAttribute('aria-label','Periods');periodGrid.append(...periods);form.append(periodGrid);
  const indicators=el('section',undefined,'source-indicator-grid');indicators.setAttribute('aria-label','Moving averages');for(let i=1;i<=3;i++){const pair=el('div',undefined,'source-period-pair');pair.append(el('span','EMA '+i,'source-pair-heading'),field('ema.'+i+'.enabled'),field('ema.'+i));indicators.append(pair);}form.append(indicators);
  const moreBody=el('div',undefined,'source-more-body'),more=disclosure('More strategy settings',moreBody);more.classList.add('source-more-settings');more.open=!!state.moreOpen;more.addEventListener('toggle',()=>{state.moreOpen=more.open;});
  moreBody.append(row('Period weights',weights,'source-weight-row'));if(state.fields.has('momentum.signal-mode'))moreBody.append(field('signal-mode',{radios:true,showLabel:true}));
  moreBody.append(row('Retracement',[field('retracement.enabled'),field('retracement'),field('retracement.mode'),field('retracement.reference',{radios:true})],'source-retracement-row'),row('Volume above',[field('volume'),field('volume.reference',{radios:true})],'source-volume-row'));
  moreBody.append(row('Trend filters',[field('tma',{text:'TMA Trend'}),field('trend-quality.enabled',{text:'Trend Quality >'}),field('trend-quality')],'source-filter-row'));
  moreBody.append(row('Radar',[field('radar.enabled'),field('radar.source',{variation:false}),field('radar.rule')],'source-radar-row'));
  const strategies=el('div',undefined,'source-strategies');for(let i=1;i<=3;i++){const n=el('section',undefined,'source-strategy'),numeric=state.fields.has('momentum.strategy.'+i+'.input');n.setAttribute('aria-label','Strategy '+i);n.append(el('span','Strategy '+i,'source-row-label'),field('strategy.'+i+'.source',{variation:false}),field('strategy.'+i+'.rule'),field('strategy.'+i+(numeric?'.input':'.timeframe'),{showLabel:numeric}),field('strategy.'+i+'.enabled'));strategies.append(n);}moreBody.append(strategies,filterSettings(state,'momentum.rs','Relative Strength','momentum.rs.'),filterSettings(state,'momentum.market-filter','Market Trend Filter','marketFilter.'));form.append(more);
  const chartSettings=chartSettingsFields(state,'momentum');if(chartSettings)form.append(chartSettings);
  const limitations=el('p','Candle automation ready · P&F and Renko settings preview. Price selection.','source-availability');moreBody.append(limitations);
  const capability=S.executionCapability?.(state.template);if(!store.demo&&capability&&!capability.available)form.append(el('p',capability.reason,'source-availability source-execution-limit'));
  buildBacktestSettings(form,state);
  const bar=el('div',undefined,'source-count-bar'),count=el('div',undefined,'source-combination-count'),backtest=button('Review tests',()=>openBacktest(state),'primary');bar.append(count,backtest);shell.append(bar);
  const update=()=>{try{if(state.dimensions.length>6)throw Error('Restored test values exceed six changing settings. Remove a test range to continue.');const dimensions=state.dimensions.map(d=>{const field=state.catalog.find(f=>f.key===d.key);if(!field)throw Error('A changing setting is unavailable. Review its test values.');return {...field,values:E.values(d.values,field)};}),combinations=E.combos(dimensions).length,planned=state.mode==='grid'?combinations:Math.min(combinations,state.budget),unit=planned===1?'test':'tests';backtest.textContent='Review '+planned+' '+unit;count.replaceChildren(el('strong',planned+' '+unit+' planned'),el('span',dimensions.length?(dimensions.length===1?dimensions[0].label+' varies.':dimensions.length+' settings vary.')+' Other settings stay fixed.':'Current settings · saved together in one study'));if(state.mode!=='grid')count.append(el('span',combinations+' possible combinations','source-both-note'));if(dimensions.some(d=>d.type==='boolean'&&d.values.length===2))count.append(el('span','Test both compares separate On and Off runs.','source-both-note'));}catch(error){backtest.textContent='Review tests';count.replaceChildren(el('strong','Review test values'),el('span',error.message));}backtest.disabled=state.connecting||!!state.ruleLookup;};state.countUpdates.push(update);update();
  if(state.reviewOpen)openBacktest(state);
 }

 function filterSettings(state,key,title,prefix){
  const gate=state.fields.get(key),section=el('section',undefined,'source-filter-settings');section.dataset.filterSettings=key;section.setAttribute('aria-label',title+' settings');const heading=el('div',undefined,'source-filter-heading');heading.append(el('h4',title),sourceField(state,key));section.append(heading);
  const descriptors=[...state.fields.values()].filter(f=>f.key.startsWith(prefix)),fields=el('div',undefined,'source-filter-fields');
  for(const field of descriptors){if(field.key.endsWith('.price.high-low'))continue;if(field.key.endsWith('.price.close-only')){fields.append(priceModeField(state,field.key.slice(0,-'.price.close-only'.length),field.key.includes('.exit.')?'Exit price mode':'Filter price mode'));continue;}fields.append(sourceField(state,field.key,{showLabel:true,text:field.type==='boolean'?field.label.replace(/^Use /,''):''}));}if(descriptors.length)section.append(fields);
  if(gate?.needsDiscovery){const loading=el('p','Turn on to load its settings from RZone.','source-availability');section.append(loading);if(setupEnabled(state,key))section.append(button('Load settings',()=>action(()=>refreshSetupChoices(undefined,{loadFilter:key==='momentum.rs'?'relativeStrength':'marketFilter'})),'quiet'));}else if(gate?.disabled&&gate.reason)section.append(el('p',gate.reason,'source-availability'));
  return section;
 }

 function priceModeField(state,prefix,caption){
  const close=prefix+'.price.close-only',highLow=prefix+'.price.high-low',descriptor=state.fields.get(close),key=prefix+'.price-mode',ambiguous=!!state.config[close]===!!state.config[highLow],wrap=el('div',undefined,'source-field'),control=select([['close-only','Close Only'],['high-low','High & Low']]);wrap.dataset.sourceField=key;
  if(ambiguous){const option=el('option','Review price mode');option.value='';option.disabled=true;control.prepend(option);wrap.classList.add('setup-unavailable');}control.value=ambiguous?'':state.config[close]?'close-only':'high-low';control.required=true;control.disabled=state.connecting||!!descriptor?.disabled||!setupEnabled(state,descriptor?.enabledBy)||!setupFieldActive(state,descriptor||{});control.dataset.setupField=key;control.setAttribute('aria-label',caption);control.setAttribute('aria-invalid',String(ambiguous));const warning=el('span','RZone has conflicting price choices. Choose one.','source-price-warning');warning.hidden=!ambiguous;control.onchange=()=>{if(!['close-only','high-low'].includes(control.value))return;state.config[close]=control.value==='close-only';state.config[highLow]=control.value==='high-low';control.setAttribute('aria-invalid','false');wrap.classList.remove('setup-unavailable');warning.hidden=true;workbenchChanged(state);};const field={...descriptor,key,label:caption,type:'select',options:[{value:'close-only',label:'Close Only'},{value:'high-low',label:'High & Low'}]};state.controls.push({field,control});wrap.hidden=!setupFieldActive(state,field);if(field.activeWhen?.length)state.conditionals.push({field,wrap});const line=el('div',undefined,'source-control-line');line.append(control);wrap.append(el('span',caption,'source-control-label'),line,warning);const variation=variationEditor(state,field);if(variation)wrap.append(variation);state.countUpdates.push(()=>{const invalid=!!state.config[close]===!!state.config[highLow];control.setAttribute('aria-invalid',String(invalid));wrap.classList.toggle('setup-unavailable',invalid);warning.hidden=!invalid;});return wrap;
 }

 function chartSettingsFields(state,stage){
  const descriptors=[...state.fields.values()].filter(f=>f.stage===stage&&/\.(?:box\.|brick\.|price\.)/.test(f.key));if(!descriptors.length)return null;
  const section=el('section',undefined,'source-chart-settings');section.dataset.chartSettings=stage;section.setAttribute('aria-label',(stage==='momentum'?'Momentum':'Execution')+' '+state.config[stage+'.chart']+' settings');
  for(const field of descriptors.filter(f=>!f.key.includes('.price.')))section.append(sourceField(state,field.key,{showLabel:true}));
  const close=stage+'.price.close-only',highLow=stage+'.price.high-low',key=stage+'.price-mode',ambiguous=!!state.config[close]===!!state.config[highLow],wrap=el('div',undefined,'source-field'),control=select([['close-only','Close Only'],['high-low','High & Low']]);wrap.dataset.sourceField=key;
  if(ambiguous){const option=el('option','Review price mode');option.value='';option.disabled=true;control.prepend(option);wrap.classList.add('setup-unavailable');}
  control.value=ambiguous?'':state.config[close]?'close-only':'high-low';control.required=true;control.disabled=state.connecting;control.dataset.setupField=key;control.setAttribute('aria-label',(stage==='momentum'?'Momentum':'Backtest')+' price mode');control.setAttribute('aria-invalid',String(ambiguous));const warning=el('span','RZone has conflicting price choices. Choose one.','source-price-warning');warning.hidden=!ambiguous;
  control.onchange=()=>{if(!['close-only','high-low'].includes(control.value))return;state.config[close]=control.value==='close-only';state.config[highLow]=control.value==='high-low';control.setAttribute('aria-invalid','false');wrap.classList.remove('setup-unavailable');warning.hidden=true;workbenchChanged(state);};state.controls.push({field:{key},control});wrap.append(el('span','Price mode','source-control-label'),control,warning);section.append(wrap);return section;
 }

 function buildBacktestSettings(form,state){
  const columns=el('div',undefined,'source-backtest-settings'),execution=el('section',undefined,'source-execution-settings'),portfolio=el('section',undefined,'source-portfolio-settings');
  execution.setAttribute('aria-label','Momentum Trading BackTest settings');portfolio.setAttribute('aria-label','Portfolio settings');execution.append(el('h3','Test period'));portfolio.append(el('h3','Portfolio'));columns.append(execution,portfolio);form.append(columns);
  const field=(key,opts={})=>sourceField(state,key,{showLabel:true,variation:true,...opts});
  const pair=(keys,className='')=>{const grid=el('div',undefined,'source-review-fields '+className);grid.append(...keys.map(key=>field(key)));return grid;};
  const toggleRow=(key,value,title)=>{const row=el('div',undefined,'source-review-toggle-row');row.append(el('span',title,'source-review-toggle-label'),field(key,{showLabel:false}),field(value,{showLabel:false}));return row;};
  execution.append(dateRangeField(state));const executionBody=el('div'),executionMore=disclosure('Execution settings',executionBody);executionMore.classList.add('source-more-settings');executionMore.open=!!state.executionOpen;executionMore.addEventListener('toggle',()=>{state.executionOpen=executionMore.open;});execution.append(executionMore);executionBody.append(pair(['execution.rank','execution.chart','execution.selection'],'source-execution-options'));const chartSettings=chartSettingsFields(state,'execution');if(chartSettings)executionBody.append(chartSettings);
  const exit=el('div',undefined,'source-review-exit-row'),exitSource=field('execution.exit.source',{variation:false});exitSource.title='Choose a source, then use Test values on its rules.';exitSource.querySelector('select')?.setAttribute('title',exitSource.title);exit.append(field('execution.exit.enabled',{showLabel:false,text:'Exit strategy'}),exitSource,field('execution.exit.rule'));executionBody.append(exit);
  const limits=el('div',undefined,'source-exit-limits');limits.append(toggleRow('execution.target.enabled','execution.target','Profit target (%)'),toggleRow('execution.stop.enabled','execution.stop','Stop loss (%)'));executionBody.append(limits);
  portfolio.append(pair(['portfolio.capital','portfolio.max-open','portfolio.allocation'],'source-portfolio-primary'));
  const portfolioBody=el('div'),portfolioMore=disclosure('Portfolio limits',portfolioBody);portfolioMore.classList.add('source-more-settings');portfolioMore.open=!!state.portfolioOpen;portfolioMore.addEventListener('toggle',()=>{state.portfolioOpen=portfolioMore.open;});portfolioBody.append(field('portfolio.enabled',{showLabel:false,text:'Portfolio testing',variation:false}),el('p','Required to save the full report.','source-availability'),toggleRow('portfolio.daily-limit.enabled','portfolio.daily-limit','Limit new stocks per day'));portfolio.append(portfolioMore);
  for(const group of S.fieldsForUI(state.template).filter(g=>g.stage==='portfolio'))if(group.note)portfolioBody.append(el('p',group.note,'mini source-portfolio-note'));
 }

 function dateRangeField(state){
  const key='execution.period',holder=el('div',undefined,'source-date-control');holder.dataset.variationFor=key;holder.setAttribute('role','group');holder.setAttribute('aria-label','Date ranges to test');
  const list=el('div',undefined,'source-date-ranges');holder.append(list);let owned=[],adding=null;
  const dimension=()=>state.dimensions.find(d=>d.key===key),ranges=()=>dimension()?.values||[state.config['execution.from']+'/'+state.config['execution.to']];
  const forget=()=>{for(const api of owned){api.destroy();const index=calendars.indexOf(api);if(index>=0)calendars.splice(index,1);}owned=[];};
  const sync=()=>{for(const n of holder.querySelectorAll('input'))n.disabled=state.connecting||!!state.ruleLookup||!!state.fields.get('execution.'+n.dataset.datePart)?.disabled;for(const api of owned)api.refresh();if(adding){const full=ranges().length>=100||!dimension()&&state.dimensions.length>=6;adding.button.disabled=state.connecting||!!state.ruleLookup||full;adding.button.title=full?'Use at most six changing settings and 100 date ranges.':'';}for(const n of list.querySelectorAll('.source-date-remove'))n.disabled=state.connecting||!!state.ruleLookup;};
  function save(next,focusIndex=0){
   next=[...new Set(next)];if(!next.length||next.some(value=>!E.dateRange(value)))return;
   if(next.length>1&&!dimension()&&state.dimensions.length>=6){notice.textContent='Use at most six changing settings in one test batch.';return;}
   const first=E.dateRange(next[0]);state.config['execution.from']=first.from;state.config['execution.to']=first.to;
   state.dimensions=state.dimensions.filter(d=>![key,'execution.from','execution.to'].includes(d.key));if(next.length>1)state.dimensions.push({key,values:next});
   draw();workbenchChanged(state);list.querySelectorAll('.source-date-entry .vault-date-range-trigger')[Math.min(focusIndex,next.length-1)]?.focus();
  }
  function backing(container,range,index){
   const pair=el('div',undefined,'source-date-pair');pair.hidden=true;container.append(pair);const controls=[];
   for(const part of ['from','to']){const n=input(range?.[part]||'','date');n.setAttribute('aria-label',part==='from'?'From date':'To date');n.dataset.datePart=part;if(index===0)n.dataset.setupField='execution.'+part;const field=state.fields.get('execution.'+part);if(field?.min!==undefined)n.min=field.min;if(field?.max!==undefined)n.max=field.max;n.disabled=state.connecting;state.controls.push({field:field||{key:'execution.'+part},control:n});pair.append(n);controls.push(n);}
   return controls;
  }
  function draw(){
   forget();list.replaceChildren();holder.querySelector('.source-date-add')?.remove();const current=[...ranges()];
   current.forEach((value,index)=>{const row=el('div',undefined,'source-date-entry'),range=E.dateRange(value),[from,to]=backing(row,range,index);list.append(row);
    // Backing controls keep the same source keys; the only visible editor is
    // the range picker, which commits both endpoints as one value.
    if(index===0)for(const n of [from,to])n.addEventListener('change',()=>{state.config['execution.from']=from.value;state.config['execution.to']=to.value;});
    const api=attachCalendar(row,from,to,{onApply:period=>{const next=[...current];next[index]=period.from+'/'+period.to;save(next,index);}});if(api)owned.push(api);
    if(current.length>1){const remove=button('×',()=>save(current.filter((_,i)=>i!==index),Math.max(0,index-1)),'quiet source-date-remove');remove.setAttribute('aria-label','Remove date range '+(index+1));row.append(remove);}
   });
   const add=el('div',undefined,'source-date-add'),[from,to]=backing(add,null,-1);holder.append(add);adding=attachCalendar(add,from,to,{triggerLabel:'Test values',triggerAriaLabel:'Test values for date range',onApply:period=>save([...ranges(),period.from+'/'+period.to],ranges().length)});if(adding)owned.push(adding);sync();
  }
  state.countUpdates.push(sync);draw();return holder;
 }

 function openBacktest(state){
  if(wizard!==state||state.connecting||state.ruleLookup||!setupSourceValid())return;
  const previous=content.querySelector('.setup-backtest-dialog');if(previous?.open)return;previous?.remove();state.reviewOpen=true;
  const dialog=el('dialog',undefined,'setup-backtest-dialog');dialog.setAttribute('aria-label','Review backtest');dialog.setAttribute('aria-modal','true');const title=el('div',undefined,'source-dialog-heading');title.append(el('h3','Review backtest'),button('Close',()=>closeDialog(),'quiet'));dialog.append(title);
  const form=el('form',undefined,'setup-form source-review-form');dialog.append(form);content.append(dialog);
  function closeDialog(){state.reviewOpen=false;if(typeof dialog.close==='function')dialog.close();dialog.remove();state.controls=state.controls.filter(c=>c.control.isConnected);state.countUpdates=state.countUpdates.filter(fn=>fn!==update);content.querySelector('.source-count-bar .primary')?.focus();}
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog();});dialog.addEventListener('close',()=>{state.reviewOpen=false;});
  const body=el('div',undefined,'source-dialog-body'),scope=el('dl',undefined,'source-review-scope');form.append(body);body.append(scope);
  const varying=key=>state.dimensions.some(d=>d.key===key);
  for(const [title,value] of [['Universe',varying('momentum.group')?'Multiple universes · see test values below':state.config['momentum.group']],['Timeframe',varying('momentum.timeframe')?'Multiple timeframes · see test values below':state.config['momentum.timeframe']],['Test period',varying('execution.period')?state.dimensions.find(d=>d.key==='execution.period').values.length+' date ranges':varying('execution.from')||varying('execution.to')?'Multiple periods · see test values below':dateRangeText(state.config['execution.from']+'/'+state.config['execution.to'])],['Initial capital',varying('portfolio.capital')?'Multiple amounts · see test values below':fmt(Number(state.config['portfolio.capital']))]]){const item=el('div');item.append(el('dt',title),el('dd',String(value??'')));scope.append(item);}
  if(state.dimensions.length){const variations=el('dl',undefined,'source-review-variations');variations.setAttribute('aria-label','Test values');for(const dimension of state.dimensions){const field=state.catalog.find(f=>f.key===dimension.key),row=el('div');let values;try{values=E.values(dimension.values,field).map(value=>settingDisplay(field,value)).join(' · ');}catch{values='Review test values';}row.append(el('dt',field?.label||dimension.key),el('dd',values));variations.append(row);}body.append(variations);}
  const name=input(state.name);name.required=true;name.maxLength=120;name.oninput=()=>{state.name=name.value;workbenchChanged(state);};body.append(label('Test name',name));
  const rules=el('div',undefined,'experiment-form-grid');for(const [key,title,choices] of [['objective','Rank by',[['returns','Return · higher is better'],['calmar','Calmar · higher is better'],['drawdown','Drawdown · lower is better']]],['mode','Search',[['grid','All combinations'],['sample','Budgeted sample'],['adaptive','Adaptive · bounded neighborhood']]]]){const n=select(choices);n.value=state[key];n.onchange=()=>{state[key]=n.value;workbenchChanged(state);};rules.append(label(title,n));}
  for(const [key,title,min,max] of [['budget','Maximum runs',1,500],['ceiling','Max drawdown (%)',0,100],['minTrades','Minimum reported trades',0,1000000],['seed','Sample seed',0,4294967295],['timeout','Timeout per trial (minutes)',1,120]]){const n=input(state[key],'number');n.min=min;n.max=max;n.step='1';n.oninput=()=>{state[key]=+n.value;workbenchChanged(state);};rules.append(label(title,n));}body.append(disclosure('Decision rules & advanced',rules));
  const footer=el('div',undefined,'source-dialog-footer'),preview=el('div',undefined,'experiment-preview'),actions=el('div',undefined,'source-dialog-actions'),run=button('Run test',()=>{},'primary');run.type='submit';actions.append(button('Edit settings',()=>closeDialog(),'quiet'),run);footer.append(preview,actions);form.append(footer);
  function update(){if(!dialog.isConnected)return;try{const e=E.create(setupPlan(state)),capability=store.demo?null:S.executionCapability?.(state.template);preview.replaceChildren(el('strong',e.trials.length+' planned '+(e.trials.length===1?'test':'tests')),el('span',capability&&!capability.available?capability.reason:store.demo?'Fictional sample results. RZone will not run.':'Apply settings in RZone, run each test, and save completed reports.'));run.textContent=store.demo?'Generate '+e.trials.length+' sample '+(e.trials.length===1?'result':'results'):'Run '+e.trials.length+' '+(e.trials.length===1?'test':'tests');run.disabled=!!capability&&!capability.available;}catch(error){preview.replaceChildren(el('span',error.message));run.disabled=true;}}
  state.countUpdates.push(update);
  form.onsubmit=event=>{event.preventDefault();void action(async()=>{
   if(state.submitting||!form.reportValidity()||!setupSourceValid()||wizard!==state)return;const capability=store.demo?null:S.executionCapability?.(state.template);if(capability&&!capability.available)throw Error(capability.reason);const p=setupPlan(state);E.create(p);state.submitting=true;setupDrafts.delete(store);run.disabled=true;let created;
   try{
    if(store.demo){created=E.create({...p,id:crypto.randomUUID()});await store.putExperiment(created);await load();if(alive()&&wizard===state){wizard=null;detail(created.id);void simulate(created.id);}}
    else{const source=tabs.find(t=>String(t.id)===state.sourceId);if(!source||(source.capable??source.ready)!==true)throw Error(source?.reason||'RZone is unavailable. Reconnect before running.');created=(await command('create',{plan:p})).experiment;sourceChoices.set(created.id,state.sourceId);try{await command('start',{id:created.id,tabId:source.id});}finally{await load();if(alive()&&wizard===state){wizard=null;detail(created.id);}}}
   }finally{state.submitting=false;if(!created&&wizard===state&&run.isConnected)update();}
  });};update();if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
 }

 function builder(initial=baselineRun){
  if(extension||store.demo){
   if(initial){newTest(initial);return;}
   keepSetup();clearCalendars();selected=null;wizard=null;panel.classList.remove('is-setup','has-workbench');content.replaceChildren(heading('Use a saved run',true),journey('setup'));
   const shell=el('div',undefined,'experiment-builder'),usable=runs.filter(r=>{try{S.savedRunContext(r);return (r.demo===true)===store.demo;}catch{return false;}});content.append(shell);
   if(!usable.length){shell.append(el('p','No saved run has a complete supported setup yet.'),button('New test',()=>newTest(),'primary'));return;}
   const picker=select(usable.map(r=>[r.id,(r.name||r.id)+' · '+new Date(r.savedAt).toLocaleDateString('en-IN')]));shell.append(label('Saved run',picker),button('Use these settings',()=>action(()=>newTest(usable.find(r=>r.id===picker.value))),'primary'));return;
  }
  keepSetup();clearCalendars();motion?.enter(content,'builder');

  selected=null;wizard=null;environment.hidden=extension;panel.classList.remove('is-setup','has-workbench');content.replaceChildren(heading('Test variations from a saved run',true),journey('setup'));const form=el('form',undefined,'experiment-builder');content.append(form);

  const usable=runs.filter(r=>{try{E.baseline(r);return (r.demo===true)===store.demo;}catch{return false;}});

  if(!usable.length){form.append(el('p','Save a run with both submissions and a supported setting layout to use it as a baseline.'));return;}

  const baseline=select(usable.map(r=>[r.id,r.name||r.id]));if(initial&&usable.some(r=>r.id===initial.id))baseline.value=initial.id;

  const name=input(store.demo?'Sample momentum study':'Momentum study'),mode=select([['grid','All combinations'],['sample','Budgeted sample'],['adaptive','Adaptive · bounded neighborhood']]);

  const fieldsBox=el('div',undefined,'experiment-fields'),scope=el('p',undefined,'muted'),dimensions=[];

  const objective=select([['calmar','Calmar · higher is better'],['returns','Return · higher is better'],['drawdown','Drawdown · lower is better']]);

  const budget=input(30,'number'),ceiling=input(25,'number'),minTrades=input(store.demo?10:30,'number'),seed=input(42,'number'),timeout=input(20,'number');

  for(const [n,min,max] of [[budget,1,500],[ceiling,0,100],[minTrades,0,1000000],[seed,0,4294967295],[timeout,1,120]]){n.min=min;n.max=max;}

  const top=el('div',undefined,'experiment-form-grid');top.append(label('Experiment name',name),label('Baseline run',baseline));form.append(top,scope,el('h3','Settings to explore'),fieldsBox);

  let b;

  function addDimension(key){const available=E.catalog(b);const line=el('div',undefined,'experiment-dimension');const field=select(available.map(f=>[f.key,f.label]));if(key)field.value=key;else{const next=available.find(f=>!dimensions.some(d=>d.field.value===f.key));if(next)field.value=next.key;}

   const entry=input('');entry.placeholder='126, 180, 252';const update=()=>{const f=available.find(f=>f.key===field.value);entry.value=f.type==='boolean'?'Off, On':String(f.value);updatePreview();};

   const d={line,field,entry};dimensions.push(d);line.append(label('Setting',field),label('Values',entry),button('Remove',()=>{dimensions.splice(dimensions.indexOf(d),1);line.remove();updatePreview();},'quiet'));fieldsBox.append(line);field.onchange=update;entry.oninput=updatePreview;update();

  }

  form.append(button('Add setting',()=>{if(dimensions.length<6)addDimension();else notice.textContent='Use at most six settings in one experiment.';},'quiet'));

  const syntax=el('p','Separate values with commas, or use start:end:step (for example 100:200:25).','mini');form.append(syntax);

  const rules=el('div',undefined,'experiment-form-grid');rules.append(label('Search',mode),label('Maximum runs',budget),label('Rank by',objective),label('Max drawdown (%)',ceiling),label('Minimum reported trades',minTrades));form.append(el('h3','Decision rules'),rules);

  const advanced=el('div',undefined,'experiment-form-grid');advanced.append(label('Sample seed',seed),label('Timeout per trial (minutes)',timeout));form.append(disclosure('Advanced',advanced));

  const preview=el('div',undefined,'experiment-preview'),save=button('Save plan',()=>{},'primary');save.type='submit';form.append(preview,save);

  function plan(){return {id:'preview',name:name.value,baseline:b,dimensions:dimensions.map(d=>({key:d.field.value,values:d.entry.value})),mode:mode.value,budget:+budget.value,objective:objective.value,ceiling:+ceiling.value,minTrades:+minTrades.value,seed:+seed.value,timeoutMinutes:+timeout.value};}

  function updatePreview(){if(!b)return;try{const e=E.create(plan());preview.replaceChildren(el('strong',e.trials.length+' planned '+(e.trials.length===1?'run':'runs')),el('span',e.combinationCount+(e.combinationCount===1?' combination':' combinations')+' · '+e.mode+' · '+(store.demo?'sample data only':extension?'local RZone execution':'plan only · run from installed Vault')));save.disabled=false;}catch(error){preview.replaceChildren(el('span',error.message));save.disabled=true;}}

  function setBaseline(){b=E.baseline(usable.find(r=>r.id===baseline.value));dimensions.length=0;fieldsBox.replaceChildren();scope.textContent=E.fields(b,'momentum')[0].value+' · '+E.fields(b,'momentum')[1].value+' · '+E.fields(b,'execution')[1].value+' — '+E.fields(b,'execution')[2].value+' · Dates, universe, capital, allocation and other controls locked.';addDimension('momentum.period.1');}

  baseline.onchange=setBaseline;for(const n of [name,mode,budget,objective,ceiling,minTrades,seed,timeout])n.addEventListener('input',updatePreview);

  form.onsubmit=event=>{event.preventDefault();void action(async()=>{const p=plan();let e;if(extension)e=(await command('create',{plan:p})).experiment;else{e=E.create({...p,id:crypto.randomUUID()});await store.putExperiment(e);}await load();detail(e.id);});};setBaseline();

 }

 async function simulate(id){

  if(!store.demo||simulation)return;simulation=true;

  try{let e=experiments.find(e=>e.id===id);e.status='running';await store.putExperiment(e);detail(id);

   while(alive()){

    e=(await store.allExperiments()).find(e=>e.id===id);if(e.status!=='running')break;

    const t=E.nextTrial(e,await store.all());if(!t){e.status='complete';await store.putExperiment(e);break;}

    for(const state of ['applying','strategy-submitting','strategy-complete','portfolio-submitting','capturing'])E.transition(e,t,state);

    await store.putExperiment(e);await new Promise(resolve=>setTimeout(resolve,450));
    if(!(await store.allExperiments()).some(x=>x.id===id))break;
    if(!alive()){t.status='queued';e.status='paused';E.journal(e,'Simulation paused on navigation');await store.putExperiment(e);break;}
    const run=root.VaultDemo.createTrial(e,t);await store.put(run);E.transition(e,t,'saved');

    const latest=(await store.allExperiments()).find(x=>x.id===id);e.status=latest.status==='pausing'?'paused':e.trials.some(t=>t.status==='queued')?'running':'complete';await store.putExperiment(e);await load();if(selected===id)detail(id);

   }

  }finally{simulation=false;await load();if(alive()&&selected===id)detail(id);}

 }

 function executionEvidence(e){
  const body=el('div',undefined,'experiment-execution-evidence'),started=e.trials.filter(t=>t.events.length||t.execution||t.status==='saved'||t.status==='uncertain');
  if(!started.length)body.append(el('p','No RZone trial has started.','muted'));
  for(const t of started){
   const run=runs.find(r=>r.id===t.runId),receipt=run?.experiment?.evidence;let verified=false,reason='Source timing was not recorded for this result.';
   if(run&&typeof E.verifyEvidence==='function'){try{if(run.experiment?.id!==e.id||run.experiment?.trialId!==t.id||run.experiment?.phase!==t.phase)throw Error('Result does not belong to this experiment trial.');E.verifyEvidence(e,t,run);verified=true;}catch(error){reason=error.message;}}
   const section=el('section',undefined,'experiment-trial-evidence');section.append(el('h4','Trial '+t.ordinal+' · '+stateName(t.status)));
   if(verified&&receipt){
    const duration=elapsed(receipt.strategySubmittedAt,receipt.capturedAt);section.append(el('p','RZone source lifecycle recorded'+(duration?' · '+duration+' from submission to capture':''),'mini'));
    const cells=el('dl',undefined,'map-settings');
    for(const [title,key] of [['Strategy submitted','strategySubmittedAt'],['Running observed','strategyStartedAt'],['Strategy completed','strategyCompletedAt'],['Portfolio submitted','portfolioSubmittedAt'],['New report observed','reportOpenedAt'],['Report captured','capturedAt']]){
     const cell=el('div'),time=el('time');time.dateTime=receipt[key];time.textContent=new Date(receipt[key]).toLocaleString();cell.append(el('dt',title),el('dd'));cell.lastChild.append(time);cells.append(cell);
    }
    section.append(cells,el('p','Submission IDs: '+receipt.strategySubmissionId+' / '+receipt.portfolioSubmissionId,'mini evidence-reference'));
   }else if(run)section.append(el('p',reason,'mini'));
   if(t.error)section.append(el('p',t.error,'mini'));
   const events=el('ol',undefined,'experiment-timeline');
   for(const event of t.events){const row=el('li'),time=el('time');if(Number.isFinite(Date.parse(event.at))){time.dateTime=event.at;time.textContent=new Date(event.at).toLocaleTimeString();}else time.textContent='Time unavailable';row.append(el('span',stateName(event.status)),time);events.append(row);}
   if(t.events.length)section.append(events);
   if(run)section.append(button('Open saved run',()=>onOpen(run),'quiet'));
   body.append(section);
  }
  return disclosure('Execution evidence',body);
 }

 function detail(id){
  clearCalendars();motion?.enter(content,'study:'+id);

  keepSetup();selected=id;wizard=null;environment.hidden=extension;panel.classList.remove('is-setup','has-workbench');const e=experiments.find(e=>e.id===id);if(!e){list();return;}const saved=e.trials.filter(t=>t.status==='saved').length,allDecisions=E.decisions(e,runs),groups=allDecisions.groups||[],group=allDecisions.grouped?(groups.find(g=>g.key===decisionGroups.get(id))||groups[0]):null,d=allDecisions.grouped?(group||{...allDecisions,eligible:[],leader:null,leaders:[],neighbors:[]}):allDecisions,hero=el('section',undefined,'experiment-hero');if(group)decisionGroups.set(id,group.key);

  renderedDetail=stamp(e);const sample=store.demo||e.demo===true,active=e.trials.find(t=>E.active.includes(t.status));
  const headline=sample?(e.status==='complete'?'Sample results ready':e.status==='running'?'Generating sample results':e.status==='pausing'?'Finishing current sample':e.status==='paused'?'Sample generation paused':'Preview the experiment workflow'):active?'Trial '+active.ordinal+' · '+stateName(active.status):e.status==='running'?'Starting next trial':e.status==='needs-review'?'Review interrupted trial':allDecisions.headline;
  const complete=e.status==='complete'&&e.trials.every(t=>['saved','skipped'].includes(t.status));
  content.replaceChildren(heading(e.name,true),journey(complete?'review':'run'));hero.classList.toggle('is-sample',sample);hero.append(el('p',(sample?'SAMPLE DATA · ':'')+stateName(e.status).toUpperCase(),'eyebrow'),el('h3',headline));
  if(sample)hero.append(el('p','Illustrative returns generated here in seconds. No RZone backtests were submitted.','experiment-sample-note'));

  hero.append(el('p',metricName(e.objective)+' · drawdown ≤ '+e.ceiling+'% · trades ≥ '+e.minTrades,'mini'));
  if(motion){const copy=el('div',undefined,'experiment-hero-copy');copy.append(...hero.childNodes);hero.append(copy,motion.progress(e,sample));hero.classList.add('has-progress');}
  else{const progress=el('progress');progress.max=e.trials.length;progress.value=saved;progress.setAttribute('aria-label',sample?'Generated sample results':'Saved experiment trials');hero.append(progress,el('p',saved+' / '+e.trials.length+(sample?' sample results':' saved'),'mini'));}content.append(hero);

  const actions=el('div',undefined,'experiment-actions');

  if(['draft','paused'].includes(e.status)&&e.trials.some(t=>t.status==='queued')){

   if(store.demo)actions.append(button(simulation?'Generating samples…':'Generate sample results',()=>action(()=>simulate(id)),'primary'));

   else if(sample)actions.append(el('p','Imported sample experiment. Open the demo to explore its workflow.','muted'));

   else if(extension)actions.append(...sourceControls(id,e.status));

   else actions.append(el('p','Run this plan from the installed extension. This browser viewer stores plans separately.','muted'));

  }

  if(['running','pausing'].includes(e.status)&&(store.demo||extension&&!sample))actions.append(button(e.status==='pausing'?'Stopping after current…':sample?'Stop sample generation':'Stop after current',()=>action(async()=>{if(store.demo){const latest=(await store.allExperiments()).find(x=>x.id===id);latest.status='pausing';await store.putExperiment(latest);}else await command('pause',{id});await load();detail(id);}),'secondary'));

  if(complete)actions.prepend(button('View results',()=>{const section=content.querySelector('.experiment-evidence');section?.focus({preventScroll:true});section?.scrollIntoView?.({block:'start'});},'primary'));
  actions.append(button('Export study',()=>download('experiment-'+id+'.json',JSON.stringify({format:'definedge-backtest-vault',version:2,exportedAt:new Date().toISOString(),experiments:[e],runs:runs.filter(r=>r.id===e.baseline.id||e.trials.some(t=>t.runId===r.id))},null,2)),'quiet'),deleteControl(e));content.append(actions);

  const uncertainty=e.trials.filter(t=>t.status==='uncertain');for(const t of uncertainty){const n=el('div',undefined,'experiment-review');n.append(el('strong','Trial '+t.ordinal+' needs review'),el('p',t.error));if(extension&&!sample)n.append(button('Check saved result',()=>action(async()=>{await command('reconcile',{id,trialId:t.id});await load();detail(id);})),button('Skip this trial',()=>action(async()=>{await command('skip',{id,trialId:t.id});await load();detail(id);}), 'quiet'));content.append(n);}
  const recent=motion?.results(e,runs,onOpen,(extension||store.demo)?run=>action(()=>newTest(run)):null);if(recent)content.append(recent);

  const evidence=el('section',undefined,'experiment-evidence');evidence.tabIndex=-1;evidence.append(el('h3',sample?'Sample ranking':'Results'),el('p',e.trials.some(t=>t.phase!=='discovery')?'The candidate is frozen. Review validation and holdout separately from the discovery ranking.':d.next,'muted'));
  if(allDecisions.grouped){
   evidence.append(el('p','Ranked within matching universes, timeframes, dates and portfolio settings.','experiment-condition-summary'));
   if(groups.length){const groupLabel=(g,i)=>{const c=g.controls||{},count={type:'number',integer:true};return 'Group '+(i+1)+' · '+[c.Universe,c.Timeframe].filter(Boolean).join(' · ')+' · '+c.From+' — '+c.To+' · '+settingDisplay({type:'number'},c['Initial capital'])+' · '+c.Allocation+' · '+settingDisplay(count,c['Maximum open trades'])+' open · daily '+(c['Daily stock limit']==='Off'?'Off':settingDisplay(count,c['Daily stock limit']));},picker=select(groups.map((g,i)=>[g.key,groupLabel(g,i)])),row=el('div',undefined,'experiment-condition-picker');picker.setAttribute('aria-label','Compare matching conditions');picker.value=group.key;picker.onchange=()=>{decisionGroups.set(id,picker.value);detail(id);};row.append(label('Compare within',picker));evidence.append(row);const c=group.controls||{};evidence.append(el('p',[c.Universe,c.Market,c.Timeframe].filter(Boolean).join(' · '),'experiment-condition-summary'));}
  }

  const top=el('div',undefined,'experiment-ranking');for(const x of d.eligible.slice(0,5)){const row=button('',()=>onOpen(x.run),'experiment-rank');row.append(el('span',allDecisions.grouped&&d.eligible.length<2?'—':'#'+(d.eligible.findIndex(y=>Math.abs(y.value-x.value)<1e-9)+1)),el('strong','Trial '+x.trial.ordinal),el('span',e.dimensions.map(f=>f.label+': '+trialSettingDisplay(e,x.trial,f)).join(' · ')),el('b',fmt(x.value,e.objective!=='calmar',e.objective!=='drawdown')));top.append(row);}evidence.append(top);

  if(d.leader){const baseline=runs.find(r=>r.id===e.baseline.id),b=baseline?I.inspect(baseline):null,metrics=el('dl',undefined,'map-metrics');const add=(label,value)=>{const cell=el('div');cell.append(el('dt',label),el('dd',value));metrics.append(cell);};

   if(e.baseline.origin!=='vault-setup')add('Return vs baseline',b?fmt(d.leader.item.metrics.returns-b.metrics.returns,false,true)+' pp':'Baseline report unavailable');add('Max drawdown',fmt(d.leader.item.metrics.drawdown,true));if(e.baseline.origin!=='vault-setup'||e.trials.filter(t=>t.phase==='discovery').length>1)add('Neighbor checks',d.neighbors.filter(x=>x.eligible).length+' / '+d.neighbors.length+' meet rules');evidence.append(metrics);

   if(d.neighbors.length){const vals=d.neighbors.filter(x=>x.eligible).map(x=>x.value);evidence.append(el('p',vals.length?'Nearby eligible '+metricName(e.objective)+': '+fmt(Math.min(...vals))+' to '+fmt(Math.max(...vals))+'. Descriptive sensitivity; no confidence score.':'Nearby results fail the rules. Review sensitivity before proceeding.','mini'));}

   const reference=(store.demo?root.VaultDemo.benchmarks():[]);void store.allBenchmarks().then(bs=>{if(!evidence.isConnected)return;const benchmark=I.benchmarkFor(d.leader.item,bs[0]||reference[0]);const node=el('div',undefined,'experiment-reference');node.append(el('strong','Index reference'),el('p',benchmark.available?benchmark.benchmark.name+' · '+fmt(benchmark.returns,true,true)+' buy & hold · '+benchmark.from+' — '+benchmark.to:benchmark.reason,'mini'));if(benchmark.available){node.append(el('p',benchmark.benchmark.kind+' · '+benchmark.benchmark.source,'mini'),el('p',benchmark.cautions.join(' '),'mini'));}evidence.append(node);}).catch(()=>{});

  }

  content.append(evidence);

  const rows=e.trials.map(t=>{const x=t.status==='saved'?E.result(e,t,runs.find(r=>r.id===t.runId)):null;return [t.ordinal,t.phase,e.dimensions.map(f=>f.label+': '+trialSettingDisplay(e,t,f)).join(' · '),(sample&&t.status==='saved')?'Sample generated':stateName(t.status),x?.eligible?{text:fmt(x.value,e.objective!=='calmar'),numeric:true,sortValue:x.value}:x?.reasons.join(' · ')||'—'];});

  const history=el('div');history.append(table(['Trial','Stage','Settings','Status',e.objective==='calmar'?'Calmar':e.objective==='returns'?'Return':'Drawdown'],rows,{sortable:true,name:'Experiment trials'}));content.append(disclosure('All trials',history));

  if(!sample)content.append(executionEvidence(e));

  const fixed=el('div');for(const s of P.settings(e.baseline)){const dl=el('dl',undefined,'map-settings');for(const g of s.groups)for(const r of g.rows){const n=el('div');n.append(el('dt',s.title+' · '+r.label),el('dd',P.settingText(r)));dl.append(n);}fixed.append(dl);}content.append(disclosure(e.baseline.origin==='vault-setup'?'Test settings':'Baseline & locked context',fixed));

  if(e.trials.every(t=>['saved','skipped'].includes(t.status))){const phase=e.trials.some(t=>t.phase==='validation')?'holdout':'validation';if(!e.trials.some(t=>t.phase===phase)){const sourcePhase=phase==='validation'?'discovery':'validation',sourceDecision=sourcePhase==='discovery'?d:E.decisions(e,runs,sourcePhase),available=sourceDecision.grouped?(sourceDecision.groups?.[0]?.eligible||[]):sourceDecision.eligible;const section=el('section',undefined,'experiment-validation');section.append(el('h3',phase==='validation'?'Test on another period':'Final holdout'));

   if(available.length){const candidate=select(available.map(x=>[x.trial.id,'Trial '+x.trial.ordinal])),from=input('','date'),to=input('','date'),grid=el('div',undefined,'experiment-form-grid');const nextDay=value=>I.date(value)?new Date(Date.parse(value+'T00:00:00Z')+86400000).toISOString().slice(0,10):'';from.min=nextDay(E.researchEnd?.(e,phase)||'');to.min=from.min;from.required=true;to.required=true;const dateControl=el('div',undefined,'validation-date-control'),backing=el('div');backing.hidden=true;backing.append(label('From',from),label('To',to));dateControl.append(backing);grid.append(label('Candidate',candidate),dateControl);attachCalendar(dateControl,from,to);section.append(grid,button('Prepare '+phase+' test',()=>action(async()=>{const period={from:from.value,to:to.value};if(store.demo||!extension){E.validation(e,candidate.value,period,phase);await store.putExperiment(e);}else await command('validate',{id,trialId:candidate.value,period,phase});await load();detail(id);}),'primary'),el('p','Keep the chosen settings fixed and test a later, unseen period. Review the plan before running.','mini'));}

   else section.append(el('p','No candidate meets the frozen rules. Review the evidence before planning another stage.'));content.append(section);}}

  for(const phase of ['validation','holdout']){const results=E.decisions(e,runs,phase);if(results.items.length){const n=el('section',undefined,'experiment-validation');n.append(el('h3',phase==='validation'?'Validation evidence':'Holdout evidence'));for(const x of results.items)n.append(el('p','Trial '+x.trial.ordinal+' · '+x.trial.period.from+' — '+x.trial.period.to+' · '+(x.eligible?fmt(x.value,e.objective!=='calmar')+' '+metricName(e.objective):x.reasons.join(' · '))),button('Open result',()=>onOpen(x.run)));content.append(n);}}

 }

 await load();if(!alive())return;if(startNew)newTest();else if(baselineRun)builder(baselineRun);else if(studyId)detail(studyId);else list();

 timer=setInterval(async()=>{if(!alive()){dispose();return;}if(refreshing||deletionDialog||calendarOpen())return;refreshing=true;try{await load();if(!alive()||deletionDialog||calendarOpen())return;if(wizard&&!wizard.connecting)setupSourceValid();if(content.querySelector('[data-rzone]'))refreshSource();if(!content.contains(document.activeElement)){if(selected&&renderedDetail!==stamp(experiments.find(e=>e.id===selected)))detail(selected);else if(!selected&&!wizard&&renderedList!==listStamp())list();}}catch(error){notice.textContent=error.message;}finally{refreshing=false;}},3000);

}

root.VaultExperimentsUI={render,dispose:()=>cleanup(),resetDraft:store=>setupDrafts.delete(store)};

})(window);
