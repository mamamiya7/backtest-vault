/* Experiment workspace. Demo commands never cross the extension boundary. */

(function(root){

'use strict';

const E=root.VaultExperiments,P=root.VaultPresentation,I=root.VaultIntelligence;

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

async function render({target,store,runs,onOpen,onExit,onNotice,table,download,baselineRun}){

 cleanup();document.body.classList.add('experiments-mode');let timer,selected=null,experiments=[],tabs=[],disposed=false,simulation=false,refreshing=false;
 let refreshSource=()=>{};const sourceChoices=new Map();

 const extension=!store.demo&&location.protocol==='chrome-extension:'&&typeof chrome!=='undefined'&&!!chrome.runtime?.sendMessage;

 const alive=()=>!disposed&&target.isConnected&&target.querySelector('.experiment-workspace');

 const notice=el('p','','notice');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');

 const panel=el('div',undefined,'experiment-workspace');target.replaceChildren(panel);panel.append(notice);

 const mode=el('div',undefined,'experiment-environment '+(store.demo?'is-sample':extension?'is-extension':'is-viewer'));
 mode.append(el('strong',store.demo?'Sample workspace':extension?'RZone automation':'Archive viewer'),el('span',store.demo?'Fictional results · no RZone backtests run.':extension?'Runs execute in your selected RZone tab.':'Review results and prepare plans. Execution is available in the installed Vault.'));
 panel.append(mode);

 const content=el('div');panel.append(content);

 cleanup=()=>{disposed=true;clearInterval(timer);document.body.classList.remove('experiments-mode');};

 async function command(action,data={}){

  if(store.demo)throw Error('Use the isolated simulation controls in demo mode.');

  if(!extension)throw Error('Open the installed extension to run RZone. Plans can be prepared in this browser viewer.');

  const r=await chrome.runtime.sendMessage({type:'vault-experiment',action,...data});if(!r?.ok)throw Error(r?.error||'Extension disconnected.');return r;

 }

 async function load(){if(extension){const r=await command('list');experiments=r.experiments;tabs=r.tabs;}else experiments=await store.allExperiments();runs=await store.all();}

 async function action(fn){try{notice.textContent='';await fn();}catch(e){notice.textContent=e.message;notice.className='notice error';}}

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

 function list(){selected=null;content.replaceChildren(heading('From an idea to evidence.'));const intro=el('div',undefined,'experiment-intro');intro.append(el('p','Choose a baseline. Vary a few settings. Keep the rest fixed.','muted'),button('New experiment',()=>builder(),'primary'));content.append(intro);

  if(!experiments.length){const empty=el('div',undefined,'experiment-empty');empty.append(el('span','01 → 02 → 03','experiment-flow'),el('h3','Plan → Run → Decide'),el('p','Your ranges become a finite queue. Each result keeps its settings, charts and trades.'));content.append(empty);}

  else{const cards=el('div',undefined,'experiment-cards');for(const e of [...experiments].reverse()){const b=button('',()=>detail(e.id),'experiment-card');b.append(el('small',(e.demo?'Sample · ':'')+stateName(e.status)),el('strong',e.name),el('span',e.trials.filter(t=>t.status==='saved').length+' / '+e.trials.length+(e.demo?' sample results':' saved')+' · '+e.baseline.name));cards.append(b);}content.append(cards);}

 }

 function builder(initial=baselineRun){

  selected=null;content.replaceChildren(heading('Design your experiment',true));const form=el('form',undefined,'experiment-builder');content.append(form);

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

  selected=id;const e=experiments.find(e=>e.id===id);if(!e){list();return;}const saved=e.trials.filter(t=>t.status==='saved').length,d=E.decisions(e,runs),hero=el('section',undefined,'experiment-hero');

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

   add('Return vs baseline',b?fmt(d.leader.item.metrics.returns-b.metrics.returns,false,true)+' pp':'Baseline report unavailable');add('Max drawdown',fmt(d.leader.item.metrics.drawdown,true));add('Neighbor checks',d.neighbors.filter(x=>x.eligible).length+' / '+d.neighbors.length+' meet rules');evidence.append(metrics);

   if(d.neighbors.length){const vals=d.neighbors.filter(x=>x.eligible).map(x=>x.value);evidence.append(el('p',vals.length?'Nearby eligible '+metricName(e.objective)+': '+fmt(Math.min(...vals))+' to '+fmt(Math.max(...vals))+'. Descriptive sensitivity; no confidence score.':'Nearby results fail the rules. Review sensitivity before proceeding.','mini'));}

   const reference=(store.demo?root.VaultDemo.benchmarks():[]);void store.allBenchmarks().then(bs=>{if(!evidence.isConnected)return;const benchmark=I.benchmarkFor(d.leader.item,bs[0]||reference[0]);const node=el('div',undefined,'experiment-reference');node.append(el('strong','Index reference'),el('p',benchmark.available?benchmark.benchmark.name+' · '+fmt(benchmark.returns,true,true)+' buy & hold · '+benchmark.from+' — '+benchmark.to:benchmark.reason,'mini'));if(benchmark.available){node.append(el('p',benchmark.benchmark.kind+' · '+benchmark.benchmark.source,'mini'),el('p',benchmark.cautions.join(' '),'mini'));}evidence.append(node);}).catch(()=>{});

  }

  content.append(evidence);

  const rows=e.trials.map(t=>{const x=t.status==='saved'?E.result(e,t,runs.find(r=>r.id===t.runId)):null;return [t.ordinal,t.phase,e.dimensions.map(f=>f.label+': '+t.patch[f.key]).join(' · '),(sample&&t.status==='saved')?'Sample generated':stateName(t.status),x?.eligible?{text:fmt(x.value,e.objective!=='calmar'),numeric:true,sortValue:x.value}:x?.reasons.join(' · ')||'—'];});

  const history=el('div');history.append(table(['Trial','Stage','Settings','Status',e.objective==='calmar'?'Calmar':e.objective==='returns'?'Return':'Drawdown'],rows,{sortable:true,name:'Experiment trials'}));content.append(disclosure('All trials',history));

  if(!sample)content.append(executionEvidence(e));

  const fixed=el('div');for(const s of P.settings(e.baseline)){const dl=el('dl',undefined,'map-settings');for(const g of s.groups)for(const r of g.rows){const n=el('div');n.append(el('dt',s.title+' · '+r.label),el('dd',P.settingText(r)));dl.append(n);}fixed.append(dl);}content.append(disclosure('Baseline & locked context',fixed));

  if(e.trials.every(t=>['saved','skipped'].includes(t.status))){const phase=e.trials.some(t=>t.phase==='validation')?'holdout':'validation';if(!e.trials.some(t=>t.phase===phase)){const sourcePhase=phase==='validation'?'discovery':'validation',available=E.decisions(e,runs,sourcePhase).eligible;const section=el('section',undefined,'experiment-validation');section.append(el('h3',phase==='validation'?'Freeze a candidate for validation':'Final holdout'));

   if(available.length){const candidate=select(available.map(x=>[x.trial.id,'Trial '+x.trial.ordinal])),from=input('','date'),to=input('','date'),grid=el('div',undefined,'experiment-form-grid');grid.append(label('Candidate',candidate),label('From',from),label('To',to));section.append(grid,button('Freeze '+phase+' plan',()=>action(async()=>{const period={from:from.value,to:to.value};if(store.demo||!extension){E.validation(e,candidate.value,period,phase);await store.putExperiment(e);}else await command('validate',{id,trialId:candidate.value,period,phase});await load();detail(id);}),'primary'),el('p','Use an unseen later period. A result already examined is no longer an untouched holdout.','mini'));}

   else section.append(el('p','No candidate meets the frozen rules. Review the evidence before planning another stage.'));content.append(section);}}

  for(const phase of ['validation','holdout']){const results=E.decisions(e,runs,phase);if(results.items.length){const n=el('section',undefined,'experiment-validation');n.append(el('h3',phase==='validation'?'Validation evidence':'Holdout evidence'));for(const x of results.items)n.append(el('p','Trial '+x.trial.ordinal+' · '+x.trial.period.from+' — '+x.trial.period.to+' · '+(x.eligible?fmt(x.value,e.objective!=='calmar')+' '+metricName(e.objective):x.reasons.join(' · '))),button('Open result',()=>onOpen(x.run)));content.append(n);}}

 }

 await load();if(baselineRun)builder(baselineRun);else list();

 timer=setInterval(async()=>{if(!alive()){cleanup();return;}if(refreshing)return;refreshing=true;try{const before=selected&&experiments.find(e=>e.id===selected)?.revision;await load();if(content.querySelector('[data-rzone]'))refreshSource();const after=selected&&experiments.find(e=>e.id===selected)?.revision;if(selected&&before!==after&&!content.contains(document.activeElement))detail(selected);}catch(error){notice.textContent=error.message;}finally{refreshing=false;}},3000);

}

root.VaultExperimentsUI={render,dispose:()=>cleanup()};

})(window);
