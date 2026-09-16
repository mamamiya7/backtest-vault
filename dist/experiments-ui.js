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
const stateName=x=>({draft:'Ready to start',running:'Running',pausing:'Stopping after current trial',paused:'Paused',complete:'Complete','needs-review':'Needs review',queued:'Queued',applying:'Checking and applying settings','strategy-submitting':'Waiting for strategy results','strategy-complete':'Strategy completed','portfolio-submitting':'Waiting for portfolio report',capturing:'Saving report',saved:'Saved',uncertain:'Needs review',skipped:'Skipped'}[x]||x);
const elapsed=(from,to)=>{const start=Date.parse(from),end=Date.parse(to);if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)return null;const seconds=(end-start)/1000,whole=Math.round(seconds);return seconds<60?seconds.toFixed(1)+' s':Math.floor(whole/60)+' min '+whole%60+' s';};

let cleanup=()=>{};

async function render({target,store,runs,onOpen,onExit,onNotice,table,download,baselineRun,startNew=false}){

 cleanup();document.body.classList.add('experiments-mode');let timer,selected=null,experiments=[],tabs=[],disposed=false,simulation=false,refreshing=false;
 let refreshSource=()=>{},wizard=null;const sourceChoices=new Map();

 const extension=!store.demo&&location.protocol==='chrome-extension:'&&typeof chrome!=='undefined'&&!!chrome.runtime?.sendMessage;

 const alive=()=>!disposed&&target.isConnected&&target.querySelector('.experiment-workspace');

 const notice=el('p','','notice');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');

 const panel=el('div',undefined,'experiment-workspace');target.replaceChildren(panel);panel.append(notice);

 const environment=el('div',undefined,'experiment-environment '+(store.demo?'is-sample':extension?'is-extension':'is-viewer'));
 environment.append(el('strong',store.demo?'Sample workspace':extension?'RZone automation':'Archive viewer'),el('span',store.demo?'Fictional results · no RZone backtests run.':extension?'Runs execute in your selected RZone tab.':'Review results and prepare plans. Execution is available in the installed Vault.'));
 panel.append(environment);

 const content=el('div');panel.append(content);

 cleanup=()=>{disposed=true;clearInterval(timer);document.body.classList.remove('experiments-mode');};

 async function command(action,data={}){

  if(store.demo)throw Error('Use the isolated simulation controls in demo mode.');

  if(!extension)throw Error('Open the installed extension to run RZone. Plans can be prepared in this browser viewer.');

  let timeout;
  try{
   const request=chrome.runtime.sendMessage({type:'vault-experiment',action,...data});
   // Bound the whole connection request, including time spent waiting for the
   // background queue. A late reply must not replace a newer setup or retry.
   const r=action==='configure'?await Promise.race([request,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('RZone did not finish connecting. Check its tab, close any open dialog, then retry the connection here. No backtest was started.')),70000);})]):await request;
   if(!r?.ok)throw Error(r?.error||'Extension disconnected.');return r;
  }finally{clearTimeout(timeout);}

 }

 async function load(){if(extension){const r=await command('list');experiments=r.experiments;tabs=r.tabs;}else experiments=await store.allExperiments();runs=await store.all();}

 async function action(fn){try{notice.textContent='';notice.className='notice';await fn();}catch(e){notice.textContent=e.message;notice.className='notice error';}}

 function sourceControls(id,state){
  const picker=select([['','Select RZone tab']]),help=el('p','','mini');
  picker.setAttribute('aria-label','RZone tab');picker.dataset.rzone='true';help.setAttribute('role','status');
  const ready=t=>t.ready&&t.chart==='Candle';
  const start=button(state==='draft'?'Start experiment':'Resume',()=>action(async()=>{
   const tab=tabs.find(t=>String(t.id)===picker.value);if(!tab||!ready(tab))throw Error('Connect a ready Candle RZone tab first.');
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
   help.textContent=target?(target.reason||(!ready(target)?'Live experiments currently need a Candle RZone tab.':'')):chosen?'RZone is not responding. Open its tab to reconnect.':'Open RZone Momentum BackTesting and close any report or settings dialogs.';
   help.hidden=!help.textContent;
  }
  picker.onchange=()=>{sourceChoices.set(id,picker.value);sync();};picker.onblur=sync;refreshSource=sync;sync();
  return [picker,start,help];
 }

 function heading(title,back){const h=el('div',undefined,'comparison-intro');const text=el('div');text.append(el('p','EXPERIMENTS','eyebrow'),el('h2',title));h.append(text,button(back?'All experiments':'Run library',back?()=>list():onExit,'quiet'));return h;}

 function list(){selected=null;wizard=null;environment.hidden=false;panel.classList.remove('is-setup','has-workbench');content.replaceChildren(heading('From an idea to evidence.'));const intro=el('div',undefined,'experiment-intro');intro.append(el('p','Set up a strategy, run a test, then explore what changes.','muted'),button('Start a new test',()=>newTest(),'primary'),button('Use a saved run',()=>builder(),'quiet'));content.append(intro);

  if(!experiments.length){const empty=el('div',undefined,'experiment-empty');empty.append(el('span','01 → 02 → 03','experiment-flow'),el('h3','Plan → Run → Decide'),el('p','Your ranges become a finite queue. Each result keeps its settings, charts and trades.'));content.append(empty);}

  else{const cards=el('div',undefined,'experiment-cards');for(const e of [...experiments].reverse()){const b=button('',()=>detail(e.id),'experiment-card');b.append(el('small',(e.demo?'Sample · ':'')+stateName(e.status)),el('strong',e.name),el('span',e.trials.filter(t=>t.status==='saved').length+' / '+e.trials.length+(e.demo?' sample results':' saved')+' · '+e.baseline.name));cards.append(b);}content.append(cards);}

 }

 function newTest(){
  selected=null;wizard={step:0,sourceId:'',sourceSession:null,template:null,config:null,dimensions:[],name:store.demo?'Sample momentum study':'Momentum study',mode:'grid',budget:30,objective:'returns',ceiling:25,minTrades:store.demo?10:30,seed:42,timeout:20,connecting:false,connectionError:'',generation:0,stale:false,reviewOpen:false,editorOpen:null};
  if(store.demo){if(!S)throw Error('Test setup is unavailable. Refresh Vault.');wizard.template=S.demoTemplate();wizard.config=S.defaults(wizard.template);wizard.step=1;}
  setupPage();
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

 function acceptSetupSource(state,source){
  const template=S.template(source),config=S.defaults(template);
  if(state.config)for(const group of S.fieldsForUI(template))for(const field of group.fields)if(!field.disabled&&Object.hasOwn(state.config,field.key))config[field.key]=state.config[field.key];
  state.template=template;state.sourceSession=source.session;state.config=config;state.stale=false;
 }

 async function refreshSetupChoices(changes){
  const state=wizard;if(!state||state.connecting||store.demo)return;if(!setupSourceValid())return;
  const generation=++state.generation;state.connecting=true;state.connectionError='';for(const control of content.querySelectorAll('.setup-form input,.setup-form select,.setup-form button,.setup-builder button'))control.disabled=true;
  notice.textContent='Refreshing the choices from RZone…';
  try{const response=await command('configure',{tabId:Number(state.sourceId),...(changes?{changes}:{})});if(!alive()||wizard!==state||generation!==state.generation)return;acceptSetupSource(state,response.source);notice.textContent='Choices refreshed from RZone. Review any unavailable selections.';}
  catch(error){if(!alive()||wizard!==state||generation!==state.generation)return;state.connectionError=error.message;throw error;}
  finally{state.connecting=false;if(alive()&&wizard===state)setupPage();}
 }

 function setupPage(){
  if(!wizard)return;const state=wizard;selected=null;panel.classList.add('is-setup');const globalDemo=document.getElementById('demo-banner');environment.hidden=!!(store.demo&&globalDemo&&!globalDemo.hidden)||!!(extension&&state.step>0);panel.classList.toggle('has-workbench',state.step>0);content.replaceChildren(heading(state.step>0?'Momentum Trading BackTesting':'Start a new test',true));
  const shell=el('div',undefined,'experiment-builder setup-builder');content.append(shell);
  if(!store.demo&&!extension){shell.append(el('h3','Open your installed Vault'),el('p','New tests use the settings and available choices from your RZone session. Open Backtest Vault from Chrome’s extensions to connect it.','muted'),button('Use a saved run',()=>builder(),'quiet'));return;}
  if(state.step===0){
   shell.append(el('h3','Connect to RZone'),el('p','Vault collects the available settings from your signed-in RZone tab. No backtest starts yet.','muted'));
   if(state.stale)shell.append(el('p','Your previous entries will be available to review after reconnecting.','setup-kept'));
   const picker=select([['','Choose RZone tab']]),hint=el('p','','mini'),connectionError=el('p','','notice error setup-connection-error'),actions=el('div',undefined,'setup-actions'),connect=button('Connect RZone',()=>action(async()=>{
    const tab=tabs.find(t=>String(t.id)===state.sourceId);if(!tab||!(tab.capable??tab.ready))throw Error(tab?.reason||'Open RZone and sign in before connecting.');
    const generation=++state.generation;state.connecting=true;state.connectionError='';sync();
    try{
     const response=await command('configure',{tabId:tab.id});if(!alive()||wizard!==state||generation!==state.generation)return;
     acceptSetupSource(state,response.source);state.step=1;state.connecting=false;notice.textContent='';setupPage();
    }catch(error){if(!alive()||wizard!==state||generation!==state.generation)return;state.connectionError=error.message;if(state.step!==0){state.step=0;state.template=null;state.sourceSession=null;state.connecting=false;setupPage();}throw error;}
    finally{state.connecting=false;if(wizard===state&&state.step===0)sync();}
   }),'primary');picker.dataset.rzone='setup';picker.setAttribute('aria-label','RZone tab');connectionError.setAttribute('role','alert');
   function sync(){
    if(wizard!==state||state.step!==0)return;const available=tabs.filter(t=>t.capable??t.ready);if(!state.sourceId&&available.length===1)state.sourceId=String(available[0].id);
    if(document.activeElement!==picker){const options=[['','Choose RZone tab'],...tabs.map(t=>[String(t.id),'RZone'+((t.capable??t.ready)?'':' · unavailable')+' · tab '+t.id])];if(state.sourceId&&!tabs.some(t=>String(t.id)===state.sourceId))options.push([state.sourceId,'RZone · not connected']);if(JSON.stringify([...picker.options].map(o=>[o.value,o.textContent]))!==JSON.stringify(options))picker.replaceChildren(...[...select(options).options]);picker.value=state.sourceId;}
    const source=tabs.find(t=>String(t.id)===state.sourceId);connect.disabled=state.connecting||!source||!(source.capable??source.ready);connect.textContent=state.connecting?'Reading available settings…':'Connect RZone';picker.disabled=state.connecting;hint.textContent=source?.reason||(!source?'Open RZone and sign in. Vault will detect the tab here.':'');hint.hidden=!hint.textContent;
    connectionError.textContent=state.connectionError;connectionError.hidden=!state.connectionError;
   }
   picker.onchange=()=>{state.sourceId=picker.value;state.template=null;state.sourceSession=null;state.generation++;sync();};picker.onblur=sync;refreshSource=sync;sync();
   actions.append(connect,button('Open RZone',()=>action(async()=>{await command('open-source');await load();sync();}),'quiet'));shell.append(label('Source',picker),hint,connectionError,actions);return;
  }
  if(!state.template){state.step=0;setupPage();return;}
  if(extension){const sourceBar=el('div',undefined,'setup-source-bar');sourceBar.append(el('span','Connected to RZone','mini'),button('Refresh choices',()=>action(()=>refreshSetupChoices()),'quiet'));shell.append(sourceBar);}
  if(state.connectionError){const error=el('p',state.connectionError,'notice error setup-connection-error');error.setAttribute('role','alert');shell.append(error);}
  shell.classList.add('source-workbench');
  buildWorkbench(shell,state);
 }

 function setupPlan(state){
  return {id:'preview',name:state.name,baseline:S.configToBaseline(state.config,state.template,{id:'setup-preview',name:state.name,demo:store.demo}),dimensions:state.dimensions.map(d=>({key:d.key,values:d.values})),mode:state.mode,budget:state.budget,objective:state.objective,ceiling:state.ceiling,minTrades:state.minTrades,seed:state.seed,timeoutMinutes:state.timeout};
 }

 function workbenchChanged(state){
  for(const item of state.controls||[]){
   if(!item.control.isConnected)continue;
   const f=item.field,inspect=f.key.endsWith('.chart')&&f.options?.length>1;
   item.control.disabled=!!(f.disabled&&!inspect)||!!(f.enabledBy&&!state.config[f.enabledBy]);
  }
  for(const update of state.countUpdates||[])update();
 }

 function variationEditor(state,field){
  const candidate=state.catalog.find(f=>f.key===field.key);if(!candidate||candidate.type==='enum'&&!candidate.options.length)return null;
  const holder=el('div',undefined,'source-variation'),toggle=button('Test values',()=>{},'source-test-values'),editor=el('div',undefined,'source-values-editor');holder.dataset.variationFor=field.key;editor.dataset.editorFor=field.key;editor.hidden=state.editorOpen!==field.key;holder.append(toggle,editor);
  const dimension=()=>state.dimensions.find(d=>d.key===field.key);
  const summary=()=>{const d=dimension();toggle.textContent=d?'Edit values':candidate.type==='boolean'?'On/off':'Test values';toggle.setAttribute('aria-label','Test values for '+field.label);toggle.classList.toggle('is-active',!!d);toggle.setAttribute('aria-expanded',String(!editor.hidden));};
  function draw(){
   const d=dimension();editor.replaceChildren();if(!d)return;editor.append(el('strong',field.label));
   const current=state.config[field.key];
   if(candidate.type==='enum'||candidate.type==='boolean'){
    const choices=candidate.type==='boolean'?[{value:true,label:'On'},{value:false,label:'Off'}]:candidate.options;
    const list=el('div',undefined,'source-value-choices');
    for(const option of choices){const checkbox=input('','checkbox');checkbox.checked=Array.isArray(d.values)&&d.values.includes(option.value);checkbox.onchange=()=>{const values=Array.isArray(d.values)?d.values:[];d.values=checkbox.checked?[...values,option.value]:values.filter(v=>v!==option.value);workbenchChanged(state);};list.append(label(option.label,checkbox));}editor.append(list);
   }else{
    const modes=el('div',undefined,'source-value-modes');for(const mode of ['Values','Range']){const b=button(mode,()=>{d.editorMode=mode.toLowerCase();draw();},'quiet');b.setAttribute('aria-pressed',String((d.editorMode||'values')===mode.toLowerCase()));modes.append(b);}editor.append(modes);
    if(d.editorMode==='range'){
     const fields=el('div',undefined,'source-range-inputs');d.range||={from:String(current),to:String(current),step:'1'};
     for(const [key,title] of [['from','From'],['to','To'],['step','Step']]){const n=input(d.range[key],'number');n.step=candidate.integer?'1':'any';n.setAttribute('aria-label',field.label+' range '+title.toLowerCase());n.oninput=()=>{d.range[key]=n.value;d.values=d.range.from+':'+d.range.to+':'+d.range.step;workbenchChanged(state);};fields.append(label(title,n));}d.values=d.range.from+':'+d.range.to+':'+d.range.step;editor.append(fields);workbenchChanged(state);
    }else{
     if(typeof d.values!=='string'||d.values.includes(':'))d.values=String(current);
     const n=input(d.values);n.placeholder='126, 180, 252';n.setAttribute('aria-label',field.label+' test values');n.oninput=()=>{d.values=n.value;workbenchChanged(state);};editor.append(label('Values, separated by commas',n));
    }
   }
   const actions=el('div',undefined,'source-value-actions');actions.append(button('Use current value',()=>{state.dimensions=state.dimensions.filter(d=>d.key!==field.key);state.editorOpen=null;editor.hidden=true;summary();workbenchChanged(state);},'quiet'),button('Done',()=>{state.editorOpen=null;editor.hidden=true;summary();workbenchChanged(state);},'secondary'));editor.append(actions);summary();
  }
  toggle.onclick=()=>{
   if(!dimension()){if(state.dimensions.length>=6){notice.textContent='Use at most six changing settings in one test batch.';return;}state.dimensions.push({key:field.key,values:candidate.type==='boolean'||candidate.type==='enum'?[state.config[field.key]]:String(state.config[field.key]),editorMode:'values'});}
   const open=editor.hidden;for(const n of content.querySelectorAll('.source-values-editor'))n.hidden=true;state.editorOpen=open?field.key:null;editor.hidden=!open;draw();summary();workbenchChanged(state);
  };draw();summary();return holder;
 }

 function sourceField(state,key,{text='',radios=false,showLabel=false,variation=true}={}){
  const field=state.fields.get(key);if(!field)return el('span','Setting unavailable','mini');const value=state.config[key],wrap=el('div',undefined,'source-field');wrap.dataset.sourceField=key;
  const caption=field.label.replace(/^Use /,'');if(showLabel&&field.type!=='boolean')wrap.append(el('span',caption,'source-control-label'));
  const line=el('div',undefined,'source-control-line');wrap.append(line);
  if(radios){
   const options=el('div',undefined,'source-radios');for(const option of field.options||[]){const n=input(option.value,'radio');n.name='setup-'+key;n.checked=String(value)===String(option.value);n.disabled=!!field.disabled||!!option.disabled||!!(field.enabledBy&&!state.config[field.enabledBy]);n.dataset.setupField=key;n.setAttribute('aria-label',caption+' · '+option.label);n.onchange=()=>{if(n.checked){state.config[key]=n.value;workbenchChanged(state);}};state.controls.push({field,control:n});options.append(label(option.label,n));}line.append(options);
  }else{
   let control,unavailable=false;
   if(field.type==='boolean'){control=input('','checkbox');control.checked=!!value;}
   else if(field.type==='select'){
    const options=field.options||[];control=select(options.map(o=>[String(o.value),o.label||String(o.value)]));options.forEach((o,i)=>control.options[i].disabled=!!o.disabled);
    if(!options.length){const empty=el('option','No choices available');empty.value='';empty.disabled=true;control.append(empty);}
    if(!options.some(o=>String(o.value)===String(value))&&String(value??'')){const missing=el('option',String(value)+' · unavailable');missing.value=String(value);missing.disabled=true;control.append(missing);unavailable=true;}control.value=String(value??'');
   }else{control=input(value??'',field.type==='number'?'number':field.type==='date'?'date':'text');if(field.min!==undefined)control.min=field.min;if(field.max!==undefined)control.max=field.max;if(field.type==='number')control.step=field.integer?'1':'any';}
   control.dataset.setupField=key;control.setAttribute('aria-label',caption);control.title=field.reason||field.help||caption;if(key==='momentum.group')control.placeholder='Search Group';control.required=!field.disabled&&field.type!=='boolean';const inspectChart=key.endsWith('.chart')&&field.options?.length>1;control.disabled=!!(field.disabled&&!inspectChart)||!!(field.enabledBy&&!state.config[field.enabledBy]);
   if(field.type==='boolean'){const l=label(text,control);l.className='source-check';line.append(l);}else line.append(control);
   if(unavailable){wrap.classList.add('setup-unavailable');control.setAttribute('aria-invalid','true');line.title='This choice is no longer available. Select another option.';if(field.rule&&!field.options?.length)wrap.append(button('Clear unavailable choice',()=>{state.config[key]='';if(field.enabledBy)state.config[field.enabledBy]=false;setupPage();},'quiet'));}
   const update=()=>{state.config[key]=control.type==='checkbox'?control.checked:control.value;workbenchChanged(state);};
   control.addEventListener('input',update);control.addEventListener('change',()=>{update();if(field.refreshOnChange&&extension)void action(()=>refreshSetupChoices({[field.stage]:{[field.index]:control.value}}));});state.controls.push({field,control});
  }
  if(field.disabled)wrap.classList.add('source-fixed');if(variation){const editor=variationEditor(state,field);if(editor)wrap.append(editor);}return wrap;
 }

 function buildWorkbench(shell,state){
  const groups=S.fieldsForUI(state.template);state.fields=new Map(groups.flatMap(g=>g.fields).map(f=>[f.key,f]));state.catalog=E.catalogFromSetup?E.catalogFromSetup(state.template,state.config):[];state.controls=[];state.countUpdates=[];
  const form=el('form',undefined,'setup-form source-main-form');form.onsubmit=event=>{event.preventDefault();openBacktest(state);};shell.append(form);
  const main=el('div',undefined,'source-main-grid'),left=el('section',undefined,'source-main-left'),right=el('section',undefined,'source-main-right');left.setAttribute('aria-label','Chart, periods and timeframe');right.setAttribute('aria-label','Group and filters');main.append(left,right);form.append(main);
  const field=(key,opts)=>sourceField(state,'momentum.'+key,opts);
  const row=(title,children,cls='')=>{const n=el('div',undefined,'source-row '+cls);n.append(el('span',title,'source-row-label'));const values=el('div',undefined,'source-row-controls');values.append(...children);n.append(values);return n;};
  left.append(row('Chart Type :',[field('chart',{variation:false})]),row('Market :',[field('market',{variation:false})]));
  const periods=[],weights=[];for(let i=1;i<=4;i++){const pair=el('div',undefined,'source-period-pair');pair.append(field('period.'+i+'.enabled'),field('period.'+i));periods.push(pair);weights.push(field('period.'+i+'.weight'));}
  left.append(row('Period :',periods,'source-period-row'),row('Weight :',weights,'source-weight-row'),row('Timeframe :',[field('timeframe',{variation:false})]));
  right.append(row('Group :',[field('group',{variation:false}),field('market-filter',{text:'MARKET TREND FILTER',variation:false})],'source-group-row'));
  right.append(row('Retracement :',[field('retracement.enabled'),field('retracement'),field('retracement.mode'),field('retracement.reference',{radios:true})],'source-retracement-row'));
  right.append(row('Volume above :',[field('volume'),field('volume.reference',{radios:true})],'source-volume-row'));
  const emas=[];for(let i=1;i<=3;i++){const pair=el('div',undefined,'source-period-pair');pair.append(field('ema.'+i+'.enabled'),field('ema.'+i));emas.push(pair);}emas.push(field('tma',{text:'TMA Trend'}));right.append(row('EMA :',emas,'source-ema-row'));
  const quality=el('div',undefined,'source-quality');quality.append(field('trend-quality.enabled',{text:'Trend Quality >'}),field('trend-quality'));right.append(row('Radar :',[field('radar.enabled'),field('radar.source',{variation:false}),field('radar.rule'),quality],'source-radar-row'));
  const strategies=el('div',undefined,'source-strategies');for(let i=1;i<=3;i++){const n=el('section',undefined,'source-strategy');n.setAttribute('aria-label','Strategy '+i);n.append(el('span','Str '+i+' :','source-row-label'),field('strategy.'+i+'.source',{variation:false}),field('strategy.'+i+'.rule'),field('strategy.'+i+'.timeframe'),field('strategy.'+i+'.enabled'));strategies.append(n);}form.append(strategies,field('rs',{text:'Relative Strength :',variation:false}));
  const limitations=el('p','Candle automation · P&F, Renko, Market Trend Filter and Relative Strength are unavailable for automatic execution.','source-availability');form.append(limitations);
  const bar=el('div',undefined,'source-count-bar'),count=el('div',undefined,'source-combination-count'),backtest=button('Backtest',()=>openBacktest(state),'primary');bar.append(count,backtest);shell.append(bar);
  const update=()=>{try{const dimensions=state.dimensions.map(d=>{const field=state.catalog.find(f=>f.key===d.key);if(!field)throw Error('A changing setting is unavailable. Review its test values.');return {...field,values:E.values(d.values,field)};}),combinations=E.combos(dimensions).length,planned=state.mode==='grid'?combinations:Math.min(combinations,state.budget);count.replaceChildren(el('strong',planned+' '+(planned===1?'test':'tests')),el('span',dimensions.length?combinations+' '+(combinations===1?'combination':'combinations')+' · '+dimensions.length+' changing '+(dimensions.length===1?'setting':'settings'):'Current settings'));}catch(error){count.replaceChildren(el('strong','Review test values'),el('span',error.message));}backtest.disabled=state.connecting;};state.countUpdates.push(update);update();
  if(state.reviewOpen)openBacktest(state);
 }

 function openBacktest(state){
  if(wizard!==state||!setupSourceValid())return;
  const previous=content.querySelector('.setup-backtest-dialog');if(previous?.open)return;previous?.remove();state.reviewOpen=true;
  const dialog=el('dialog',undefined,'setup-backtest-dialog');dialog.setAttribute('aria-label','Momentum Trading BackTest');dialog.setAttribute('aria-modal','true');const title=el('div',undefined,'source-dialog-heading');title.append(el('h3','Momentum Trading BackTest'),button('Close',()=>closeDialog(),'quiet'));dialog.append(title);
  const form=el('form',undefined,'setup-form source-review-form');dialog.append(form);content.append(dialog);
  function closeDialog(){state.reviewOpen=false;if(typeof dialog.close==='function')dialog.close();dialog.remove();state.controls=state.controls.filter(c=>c.control.isConnected);state.countUpdates=state.countUpdates.filter(fn=>fn!==update);}
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog();});dialog.addEventListener('close',()=>{state.reviewOpen=false;});
  const body=el('div',undefined,'source-dialog-body'),columns=el('div',undefined,'source-review-columns'),execution=el('section'),portfolio=el('section');execution.append(el('h4','Backtest settings'));portfolio.append(el('h4','Portfolio Backtesting'));columns.append(execution,portfolio);form.append(body);body.append(columns);
  const field=(key,opts={})=>sourceField(state,key,{showLabel:true,variation:key.startsWith('execution.'),...opts});
  const pair=(keys,className='')=>{const grid=el('div',undefined,'source-review-fields '+className);grid.append(...keys.map(key=>field(key)));return grid;};
  const toggleRow=(key,value,title)=>{const row=el('div',undefined,'source-review-toggle-row');row.append(field(key,{showLabel:false,text:title}),field(value,{showLabel:false}));return row;};
  execution.append(pair(['execution.from','execution.to'],'source-date-pair'),pair(['execution.rank','execution.chart','execution.selection'],'source-execution-options'),toggleRow('execution.target.enabled','execution.target','Profit target (%)'),toggleRow('execution.stop.enabled','execution.stop','Stop loss (%)'));
  const exit=el('div',undefined,'source-review-exit-row');exit.append(field('execution.exit.enabled',{showLabel:false,text:'Exit strategy'}),field('execution.exit.source',{showLabel:false}),field('execution.exit.rule',{showLabel:false}));execution.append(exit);
  portfolio.append(field('portfolio.enabled',{showLabel:false,text:'Portfolio testing'}),pair(['portfolio.allocation'],'source-allocation-row'),pair(['portfolio.capital','portfolio.max-open']),toggleRow('portfolio.daily-limit.enabled','portfolio.daily-limit','Limit new stocks per day'));
  for(const group of S.fieldsForUI(state.template).filter(g=>g.stage==='portfolio'))if(group.note)portfolio.append(el('p',group.note,'mini source-portfolio-note'));
  const name=input(state.name);name.required=true;name.maxLength=120;name.oninput=()=>{state.name=name.value;workbenchChanged(state);};body.append(label('Test name',name));
  const rules=el('div',undefined,'experiment-form-grid');for(const [key,title,choices] of [['objective','Rank by',[['returns','Return · higher is better'],['calmar','Calmar · higher is better'],['drawdown','Drawdown · lower is better']]],['mode','Search',[['grid','All combinations'],['sample','Budgeted sample'],['adaptive','Adaptive · bounded neighborhood']]]]){const n=select(choices);n.value=state[key];n.onchange=()=>{state[key]=n.value;workbenchChanged(state);};rules.append(label(title,n));}
  for(const [key,title,min,max] of [['budget','Maximum runs',1,500],['ceiling','Max drawdown (%)',0,100],['minTrades','Minimum reported trades',0,1000000],['seed','Sample seed',0,4294967295],['timeout','Timeout per trial (minutes)',1,120]]){const n=input(state[key],'number');n.min=min;n.max=max;n.step='1';n.oninput=()=>{state[key]=+n.value;workbenchChanged(state);};rules.append(label(title,n));}body.append(disclosure('Decision rules & advanced',rules));
  const footer=el('div',undefined,'source-dialog-footer'),preview=el('div',undefined,'experiment-preview'),actions=el('div',undefined,'source-dialog-actions'),run=button('Run test',()=>{},'primary');run.type='submit';actions.append(button('Back to strategy',()=>closeDialog(),'quiet'),run);footer.append(preview,actions);form.append(footer);
  function update(){if(!dialog.isConnected)return;try{const e=E.create(setupPlan(state));preview.replaceChildren(el('strong',e.trials.length+' planned '+(e.trials.length===1?'test':'tests')),el('span',store.demo?'Fictional sample results. RZone will not run.':'Apply settings in RZone, run each test, and save completed reports.'));run.textContent=store.demo?'Generate '+e.trials.length+' sample '+(e.trials.length===1?'result':'results'):'Run '+e.trials.length+' '+(e.trials.length===1?'test':'tests');run.disabled=false;}catch(error){preview.replaceChildren(el('span',error.message));run.disabled=true;}}
  state.countUpdates.push(update);
  form.onsubmit=event=>{event.preventDefault();void action(async()=>{
   if(!form.reportValidity()||!setupSourceValid()||wizard!==state)return;const p=setupPlan(state);E.create(p);run.disabled=true;let created;
   try{
    if(store.demo){created=E.create({...p,id:crypto.randomUUID()});await store.putExperiment(created);await load();wizard=null;detail(created.id);void simulate(created.id);}
    else{const source=tabs.find(t=>String(t.id)===state.sourceId);if(!source||(source.capable??source.ready)!==true)throw Error(source?.reason||'RZone is unavailable. Reconnect before running.');created=(await command('create',{plan:p})).experiment;sourceChoices.set(created.id,state.sourceId);try{await command('start',{id:created.id,tabId:source.id});}finally{await load();wizard=null;detail(created.id);}}
   }finally{if(!created&&wizard===state&&run.isConnected)update();}
  });};update();if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
 }

 function builder(initial=baselineRun){

  selected=null;wizard=null;environment.hidden=false;panel.classList.remove('is-setup','has-workbench');content.replaceChildren(heading('Design your experiment',true));const form=el('form',undefined,'experiment-builder');content.append(form);

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

  selected=id;wizard=null;environment.hidden=false;panel.classList.remove('is-setup','has-workbench');const e=experiments.find(e=>e.id===id);if(!e){list();return;}const saved=e.trials.filter(t=>t.status==='saved').length,d=E.decisions(e,runs),hero=el('section',undefined,'experiment-hero');

  const sample=store.demo||e.demo===true,active=e.trials.find(t=>E.active.includes(t.status));
  const headline=sample?(e.status==='complete'?'Sample results ready':e.status==='running'?'Generating sample results':e.status==='pausing'?'Finishing current sample':e.status==='paused'?'Sample generation paused':'Preview the experiment workflow'):active?'Trial '+active.ordinal+' · '+stateName(active.status):e.status==='running'?'Starting next trial':e.status==='needs-review'?'Review interrupted trial':d.headline;
  content.replaceChildren(heading(e.name,true));hero.classList.toggle('is-sample',sample);hero.append(el('p',(sample?'SAMPLE DATA · ':'')+stateName(e.status).toUpperCase(),'eyebrow'),el('h3',headline));
  if(sample)hero.append(el('p','Illustrative returns generated here in seconds. No RZone backtests were submitted.','experiment-sample-note'));

  const progress=el('progress');progress.max=e.trials.length;progress.value=saved;progress.setAttribute('aria-label',sample?'Generated sample results':'Saved experiment trials');hero.append(progress,el('p',saved+' / '+e.trials.length+(sample?' sample results':' saved')+' · '+metricName(e.objective)+' · drawdown ≤ '+e.ceiling+'% · trades ≥ '+e.minTrades,'mini'));content.append(hero);

  const actions=el('div',undefined,'experiment-actions');

  if(['draft','paused'].includes(e.status)&&e.trials.some(t=>t.status==='queued')){

   if(store.demo)actions.append(button(simulation?'Generating samples…':'Generate sample results',()=>action(()=>simulate(id)),'primary'));

   else if(sample)actions.append(el('p','Imported sample experiment. Open the demo to explore its workflow.','muted'));

   else if(extension)actions.append(...sourceControls(id,e.status));

   else actions.append(el('p','Run this plan from the installed extension. This browser viewer stores plans separately.','muted'));

  }

  if(['running','pausing'].includes(e.status)&&(store.demo||extension&&!sample))actions.append(button(e.status==='pausing'?'Stopping after current…':sample?'Stop sample generation':'Stop after current',()=>action(async()=>{if(store.demo){const latest=(await store.allExperiments()).find(x=>x.id===id);latest.status='pausing';await store.putExperiment(latest);}else await command('pause',{id});await load();detail(id);}),'secondary'));

  actions.append(button('Export experiment',()=>download('experiment-'+id+'.json',JSON.stringify({format:'definedge-backtest-vault',version:2,exportedAt:new Date().toISOString(),experiments:[e],runs:runs.filter(r=>r.id===e.baseline.id||e.trials.some(t=>t.runId===r.id))},null,2))));content.append(actions);

  const uncertainty=e.trials.filter(t=>t.status==='uncertain');for(const t of uncertainty){const n=el('div',undefined,'experiment-review');n.append(el('strong','Trial '+t.ordinal+' needs review'),el('p',t.error));if(extension&&!sample)n.append(button('Check saved result',()=>action(async()=>{await command('reconcile',{id,trialId:t.id});await load();detail(id);})),button('Skip this trial',()=>action(async()=>{await command('skip',{id,trialId:t.id});await load();detail(id);}), 'quiet'));content.append(n);}

  const evidence=el('section',undefined,'experiment-evidence');evidence.append(el('h3',sample?'Sample ranking':'Decision desk'),el('p',e.trials.some(t=>t.phase!=='discovery')?'The candidate is frozen. Review validation and holdout separately from the discovery ranking.':d.next,'muted'));

  const top=el('div',undefined,'experiment-ranking');for(const x of d.eligible.slice(0,5)){const row=button('',()=>onOpen(x.run),'experiment-rank');row.append(el('span','#'+(d.eligible.findIndex(y=>Math.abs(y.value-x.value)<1e-9)+1)),el('strong','Trial '+x.trial.ordinal),el('span',e.dimensions.map(f=>f.label+': '+x.trial.patch[f.key]).join(' · ')),el('b',fmt(x.value,e.objective!=='calmar',e.objective!=='drawdown')));top.append(row);}evidence.append(top);

  if(d.leader){const baseline=runs.find(r=>r.id===e.baseline.id),b=baseline?I.inspect(baseline):null,metrics=el('dl',undefined,'map-metrics');const add=(label,value)=>{const cell=el('div');cell.append(el('dt',label),el('dd',value));metrics.append(cell);};

   if(e.baseline.origin!=='vault-setup')add('Return vs baseline',b?fmt(d.leader.item.metrics.returns-b.metrics.returns,false,true)+' pp':'Baseline report unavailable');add('Max drawdown',fmt(d.leader.item.metrics.drawdown,true));if(e.baseline.origin!=='vault-setup'||e.trials.filter(t=>t.phase==='discovery').length>1)add('Neighbor checks',d.neighbors.filter(x=>x.eligible).length+' / '+d.neighbors.length+' meet rules');evidence.append(metrics);

   if(d.neighbors.length){const vals=d.neighbors.filter(x=>x.eligible).map(x=>x.value);evidence.append(el('p',vals.length?'Nearby eligible '+metricName(e.objective)+': '+fmt(Math.min(...vals))+' to '+fmt(Math.max(...vals))+'. Descriptive sensitivity; no confidence score.':'Nearby results fail the rules. Review sensitivity before proceeding.','mini'));}

   const reference=(store.demo?root.VaultDemo.benchmarks():[]);void store.allBenchmarks().then(bs=>{if(!evidence.isConnected)return;const benchmark=I.benchmarkFor(d.leader.item,bs[0]||reference[0]);const node=el('div',undefined,'experiment-reference');node.append(el('strong','Index reference'),el('p',benchmark.available?benchmark.benchmark.name+' · '+fmt(benchmark.returns,true,true)+' buy & hold · '+benchmark.from+' — '+benchmark.to:benchmark.reason,'mini'));if(benchmark.available){node.append(el('p',benchmark.benchmark.kind+' · '+benchmark.benchmark.source,'mini'),el('p',benchmark.cautions.join(' '),'mini'));}evidence.append(node);}).catch(()=>{});

  }

  content.append(evidence);

  const rows=e.trials.map(t=>{const x=t.status==='saved'?E.result(e,t,runs.find(r=>r.id===t.runId)):null;return [t.ordinal,t.phase,e.dimensions.map(f=>f.label+': '+t.patch[f.key]).join(' · '),(sample&&t.status==='saved')?'Sample generated':stateName(t.status),x?.eligible?{text:fmt(x.value,e.objective!=='calmar'),numeric:true,sortValue:x.value}:x?.reasons.join(' · ')||'—'];});

  const history=el('div');history.append(table(['Trial','Stage','Settings','Status',e.objective==='calmar'?'Calmar':e.objective==='returns'?'Return':'Drawdown'],rows,{sortable:true,name:'Experiment trials'}));content.append(disclosure('All trials',history));

  if(!sample)content.append(executionEvidence(e));

  const fixed=el('div');for(const s of P.settings(e.baseline)){const dl=el('dl',undefined,'map-settings');for(const g of s.groups)for(const r of g.rows){const n=el('div');n.append(el('dt',s.title+' · '+r.label),el('dd',P.settingText(r)));dl.append(n);}fixed.append(dl);}content.append(disclosure(e.baseline.origin==='vault-setup'?'Test settings':'Baseline & locked context',fixed));

  if(e.trials.every(t=>['saved','skipped'].includes(t.status))){const phase=e.trials.some(t=>t.phase==='validation')?'holdout':'validation';if(!e.trials.some(t=>t.phase===phase)){const sourcePhase=phase==='validation'?'discovery':'validation',available=E.decisions(e,runs,sourcePhase).eligible;const section=el('section',undefined,'experiment-validation');section.append(el('h3',phase==='validation'?'Freeze a candidate for validation':'Final holdout'));

   if(available.length){const candidate=select(available.map(x=>[x.trial.id,'Trial '+x.trial.ordinal])),from=input('','date'),to=input('','date'),grid=el('div',undefined,'experiment-form-grid');grid.append(label('Candidate',candidate),label('From',from),label('To',to));section.append(grid,button('Freeze '+phase+' plan',()=>action(async()=>{const period={from:from.value,to:to.value};if(store.demo||!extension){E.validation(e,candidate.value,period,phase);await store.putExperiment(e);}else await command('validate',{id,trialId:candidate.value,period,phase});await load();detail(id);}),'primary'),el('p','Use an unseen later period. A result already examined is no longer an untouched holdout.','mini'));}

   else section.append(el('p','No candidate meets the frozen rules. Review the evidence before planning another stage.'));content.append(section);}}

  for(const phase of ['validation','holdout']){const results=E.decisions(e,runs,phase);if(results.items.length){const n=el('section',undefined,'experiment-validation');n.append(el('h3',phase==='validation'?'Validation evidence':'Holdout evidence'));for(const x of results.items)n.append(el('p','Trial '+x.trial.ordinal+' · '+x.trial.period.from+' — '+x.trial.period.to+' · '+(x.eligible?fmt(x.value,e.objective!=='calmar')+' '+metricName(e.objective):x.reasons.join(' · '))),button('Open result',()=>onOpen(x.run)));content.append(n);}}

 }

 await load();if(startNew)newTest();else if(baselineRun)builder(baselineRun);else list();

 timer=setInterval(async()=>{if(!alive()){cleanup();return;}if(refreshing)return;refreshing=true;try{const before=selected&&experiments.find(e=>e.id===selected)?.revision;await load();if(wizard&&!wizard.connecting)setupSourceValid();if(content.querySelector('[data-rzone]'))refreshSource();const after=selected&&experiments.find(e=>e.id===selected)?.revision;if(selected&&before!==after&&!content.contains(document.activeElement))detail(selected);}catch(error){notice.textContent=error.message;}finally{refreshing=false;}},3000);

}

root.VaultExperimentsUI={render,dispose:()=>cleanup()};

})(window);
