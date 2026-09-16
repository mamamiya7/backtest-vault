/* Full DOM → submission → pagination → durable save → next-trial integration. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const E=require('../dist/experiments.js'),S=require('../dist/setup.js'),D=require('../dist/demo.js'),{createCoordinator}=require('../dist/experiment-coordinator.js');
const base=path.resolve(__dirname,'../dist'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const reordered=x=>Array.isArray(x)?x.map(reordered):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,reordered(x[k])])):x;
async function scenario(options={}){
 const {changeLocked=false,overlap=false,staleCompletion=false,rejected=false,reuseReport=false,noRunning=false,preexistingReport=false,vaultSetup=false,missingGroup=false,changedOptions=false,driftDuringRun=false,refreshParents=false,noOptionRefresh=false,emptyOptions=false,variableSet='',bridge=false,closeAfterWake=false,closeStuckAfterWake=false}=options;
 const dom=new JSDOM('<body><h1>Momentum Trading BackTesting</h1><div class="account-right"></div></body>',{runScripts:'outside-only',url:'https://zone.definedgesecurities.com/index.html#research'}),w=dom.window,d=w.document;
 const fixture=D.create()[0];fixture.demo=false;w.structuredClone=structuredClone;
 Object.defineProperty(w.HTMLElement.prototype,'innerText',{get(){return this.textContent;}});
 w.Element.prototype.getClientRects=function(){return this.isConnected&&!this.closest('[hidden]')&&!this.closest('[style*="display: none"]')?[{width:100,height:20}]:[];};
 const nativeTimeout=w.setTimeout.bind(w),nativeInterval=w.setInterval.bind(w);w.setTimeout=(fn,ms)=>nativeTimeout(fn,Math.min(ms,20));w.setInterval=(fn,ms)=>nativeInterval(fn,Math.min(ms,30));
 const main=d.querySelector('.account-right');
 function form(container,fields){const table=d.createElement('table');for(const f of fields){const tr=d.createElement('tr'),td=d.createElement('td'),cell=d.createElement('td');td.textContent=f.label;let n;if(f.type==='select-one'){n=d.createElement('select');const choices=[f.value,...(/Allocation/.test(f.label)?['Fixed','Reinvestment']:/Timeframe|Str \d/.test(f.label)&&f.value==='Daily'?['Weekly']:f.value==='Pre'?['My']:f.value.startsWith('Demo ')?[f.value.replace(/^Demo /,'Alternate ')]:[])];for(const value of new Set(choices)){const o=d.createElement('option');o.textContent=value;o.value='source:'+value;n.append(o);}n.value='source:'+f.value;}else {n=d.createElement('input');n.type=f.type;n.value=f.value;if(f.checked!==null)n.checked=f.checked;if(f.type==='radio')n.name=/52 Week/.test(f.label)?'reference':'volume';}n.disabled=f.disabled;cell.append(n);tr.append(td,cell);table.append(tr);}container.append(table);
  if(vaultSetup){const nodes=[...table.querySelectorAll('input,select')],stage=fields.length===52?'momentum':fields.length===12?'execution':'portfolio';const gates=stage==='momentum'?[[4,5,6,7,8,9,10],[11,12],[13,14],[15,16],[17,18],[26,27],[28,29],[30,31],[34,35,36],[37,38],[42,39,40,41],[46,43,44,45],[50,47,48,49]]:stage==='execution'?[[5,6,7],[8,9],[10,11]]:[[4,5]];for(const [gate,...children]of gates){const update=()=>children.forEach(i=>nodes[i].disabled=!nodes[gate].checked);nodes[gate].addEventListener('change',update);update();}
   for(const index of stage==='momentum'?[35,39,43,47]:stage==='execution'?[6]:[]){nodes[index].addEventListener('change',()=>{if(noOptionRefresh)return;const target=nodes[index+1];nativeTimeout(()=>{target.replaceChildren();for(const value of emptyOptions?[]:['My trend rule','My alternate rule']){const o=d.createElement('option');o.textContent=value;o.value='custom:'+value;target.append(o);}},300);});}
  }
 }
 function button(p,label,fn){const n=d.createElement('button');n.textContent=label;n.onclick=fn;p.append(n);return n;}
 function popup(title){const p=d.createElement('div');p.className='popupContent';const h=d.createElement('div');h.className='custom-dialog-header';const caption=d.createElement('div');caption.className='caption';caption.textContent=title;const close=d.createElement('a');close.className='close-buton';close.onclick=()=>{
  if(title==='Momentum Trading BackTest'&&(closeAfterWake||closeStuckAfterWake)){
   // Model a hidden page waking after the deadline: the close animation may
   // already have removed the owned node before the next poll can run.
   const now=w.Date.now.bind(w.Date);nativeTimeout(()=>{if(closeAfterWake)p.remove();w.Date.now=()=>now()+6000;},5);
  }else p.remove();
 };h.append(caption,close);p.append(h);d.body.append(p);return p;}
 form(main,E.fields(fixture,'momentum'));let submissions=0,portfolios=0,priorReport=null,groupCommits=0;const guardedStates=[],savedBeforeNext=[];
 if(vaultSetup){const group=main.querySelectorAll('input,select')[1];group.placeholder='Search Group';group.addEventListener('keyup',()=>{d.querySelector('.ind-list')?.remove();if(missingGroup)return;const list=d.createElement('ul');list.className='ind-list';for(const name of ['Nifty 50 Index','Nifty 500 Index']){const li=d.createElement('li');li.textContent=name;li.onclick=()=>{group.value=name;groupCommits++;list.remove();};list.append(li);}d.body.append(list);});}
 const oldHiddenReport=preexistingReport?popup('Portfolio Backtesting Report'):null;if(oldHiddenReport)oldHiddenReport.hidden=true;
 // Observed RZone lifecycle: one main button becomes Cancel, the setup remains
 // open during Processing, and completion removes that setup automatically.
 const done=d.createElement('span');done.textContent='BackTest Completed.';main.append(done);let cancel;
 cancel=button(main,'BackTest',()=>{const p=popup('Momentum Trading BackTest');form(p,E.fields(fixture,'execution'));button(p,'Backtest',()=>{
  if(submissions&&plan)savedBeforeNext.push(!!memory['run:'+plan.trials[submissions-1].runId]);submissions++;if(rejected){popup('Error');return;}
  if(driftDuringRun)nativeTimeout(()=>{main.querySelectorAll('input,select')[1].value='Manual drift';},100);
  if(!overlap&&!staleCompletion&&!noRunning)done.textContent='Processing';
  if(!noRunning)cancel.textContent='Cancel BackTest';
  if(overlap||staleCompletion||noRunning)nativeTimeout(()=>{
   guardedStates.push({stage:'old-completion',completed:w.VaultCapture.getStrategy()?.completed,portfolios});
   if(overlap)done.textContent='Processing';
  },60);
  nativeTimeout(()=>{cancel.textContent='BackTest';done.textContent='BackTest Completed.';p.remove();},160);
  if(staleCompletion||noRunning)nativeTimeout(()=>{guardedStates.push({stage:'unconfirmed-finish',completed:w.VaultCapture.getStrategy()?.completed,portfolios});popup('Error');},240);
 });});
 button(main,'Portfolio Testing',()=>{const p=popup('Portfolio Backtesting');form(p,E.fields(fixture,'portfolio'));button(p,'Backtest',()=>{portfolios++;
 if(reuseReport&&priorReport){d.body.append(priorReport);return;}
 const report=oldHiddenReport||popup('Portfolio Backtesting Report');report.hidden=false;priorReport=report;const tabs=d.createElement('div');for(const name of ['Quick Stats','Statistics','Charts','Trade Details']){const tab=d.createElement('div');tab.setAttribute('role','tab');tab.textContent=name;tab.onclick=()=>{for(const t of tabs.children)t.className='';tab.className='selected';};tabs.append(tab);}report.append(tabs);
 const panel=d.createElement('div');panel.setAttribute('role','tabpanel');panel.innerHTML='<div class="stats-card"><div class="status">Total no. of Trades</div><div class="amt">4</div></div><div class="stats-card"><div class="status">Gross Total Returns( % )</div><div class="amt">10%</div></div><table class="dropdown-table-body"><tr><td>Group</td><td>Demo universe 40</td></tr></table>'+Array.from({length:6},(_,i)=>'<svg class="highcharts-root" xmlns="http://www.w3.org/2000/svg"><title>Chart '+i+'</title><path d="M0 0 L20 10"/></svg>').join('')+'<table class="rade-result-detail"></table><span id="curPageTextEle">1</span><span id="lastPageTextEle">2</span><img src="/firstPage.png"><img src="/next.png">';report.append(panel);
 function page(n){panel.querySelector('#curPageTextEle').textContent=n;panel.querySelector('table.rade-result-detail').innerHTML='<tr><th>Sr #</th><th>Symbol</th><th>Qty</th></tr>'+[n*2-1,n*2].map(i=>'<tr><td>'+i+'</td><td>TEST'+i+'</td><td>'+ (i===2?0:10)+'</td></tr>').join('');}panel.querySelector('img[src$="firstPage.png"]').onclick=()=>page(1);panel.querySelector('img[src$="next.png"]').onclick=()=>page(2);page(1);
 });});
 const memory={},runtime={id:'test-ext',getURL:p=>'chrome-extension://test-ext/'+p},source={id:'test-ext',url:w.location.href,tab:{id:9}},dashboard={id:'test-ext',url:runtime.getURL('index.html')};let uid=0;
 const storage={get:async key=>reordered(key?{[key]:E.clone(memory[key]??null)}:E.clone(memory)),set:async data=>Object.assign(memory,E.clone(data))};const coordinator=createCoordinator({storage,runtime,uuid:()=> 'test-id-'+(++uid)});
 const listeners=[],workerListeners=[],sourceMessages=[],sourceSuccessDialogs=[];let bridgeConfigRequests=0;
 if(bridge){
  // Exercise the actual worker -> coordinator -> content-script boundary. A
  // delayed reply is valid only when its listener retained the message port.
  const deliver=(handlers,message,sender)=>new Promise((resolve,reject)=>{
   let replied=false,open=false,listening=true;
   const reply=response=>{if(replied)return;if(!listening&&!open){reject(Error('Asynchronous response port was not retained.'));return;}replied=true;resolve(E.clone(response));};
   try{for(const fn of handlers)if(fn(E.clone(message),sender,reply)===true)open=true;listening=false;if(!replied&&!open)resolve(undefined);}catch(error){reject(error);}
  });
  let activeTab=10;const focusEvents=[];
  const vm=require('node:vm'),workerChrome={storage:{local:storage},runtime:{...runtime,onMessage:{addListener:fn=>workerListeners.push(fn)}},action:{onClicked:{addListener:()=>{}}},tabs:{
   sendMessage:(id,message,options)=>{assert.equal(id,9);assert.equal(options.frameId,0);if(message.type==='vault-runner-config'){bridgeConfigRequests++;assert.equal(activeTab,9,'RZone must be active before its settings are read.');focusEvents.push('read');}return deliver(listeners,message,{id:runtime.id,url:runtime.getURL('background.js')});},
   get:async id=>({id,windowId:1,url:id===9?w.location.href:runtime.getURL('index.html')}),
   query:async query=>{assert.deepEqual({...query},{active:true,windowId:1});return [{id:activeTab,windowId:1,url:activeTab===9?w.location.href:runtime.getURL('index.html')}];},
   update:async(id,update)=>{assert.equal(update.active,true);activeTab=id;focusEvents.push('active:'+id);return {id};},create:async ()=>({id:10})
  }};
  const context=vm.createContext({chrome:workerChrome,URL,crypto:require('node:crypto').webcrypto,structuredClone,setTimeout,clearTimeout});
  context.importScripts=(...files)=>files.forEach(file=>vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),context,{filename:file}));
  vm.runInContext(fs.readFileSync(path.join(base,'background.js'),'utf8'),context,{filename:'background.js'});
  coordinator.handle=async(message,sender)=>{const result=await deliver(workerListeners,{type:'vault-experiment',...message},sender);if(message.action==='configure'&&bridgeConfigRequests){assert.equal(activeTab,10,'Return to the initiating Vault after a read or source rejection.');assert.deepEqual(focusEvents,Array.from({length:bridgeConfigRequests},()=>['active:9','read','active:10']).flat());}return result;};
 }
 w.chrome={storage:{local:storage},runtime:{...runtime,sendMessage:m=>coordinator.handle(m,source),onMessage:{addListener:fn=>listeners.push(fn)}}};
 w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
 for(const file of ['core.js','presentation.js','intelligence.js','setup.js','experiments.js','capture.js'])w.eval(fs.readFileSync(path.join(base,file),'utf8'));
 if(vaultSetup){const status=w.VaultCapture.status;w.VaultCapture.status=message=>{sourceMessages.push(message);if(message==='RZone settings read. Return to Vault to finish setup.')sourceSuccessDialogs.push(!!w.VaultCapture.popup('Momentum Trading BackTest'));status(message);};}
 // Build the baseline from the same visible form labels the saver records.
 fixture.parameters.strategy.main.fields=JSON.parse(JSON.stringify(w.VaultCapture.fields(main)));
 const bp=popup('Baseline fixture');form(bp,E.fields(fixture,'execution'));fixture.parameters.strategy.execution.fields=JSON.parse(JSON.stringify(w.VaultCapture.fields(bp)));bp.remove();const pp=popup('Baseline portfolio');form(pp,E.fields(fixture,'portfolio'));fixture.parameters.settings.fields=JSON.parse(JSON.stringify(w.VaultCapture.fields(pp)));pp.remove();
 let plan;
 if(!vaultSetup){plan=E.create({id:'runner-proof',name:'Runner proof',baseline:E.baseline(fixture),dimensions:[{key:'momentum.period.1',values:'126,180,252'}],minTrades:0});memory['experiment:'+plan.id]=plan;}
 if(changeLocked)main.querySelectorAll('input')[0].value='Unexpected group';
 w.eval(fs.readFileSync(path.join(base,'runner.js'),'utf8'));
 try{for(let n=0;n<50&&!memory['runner:tab:9'];n++)await sleep(10);
  const probe=()=>{let status;for(const fn of listeners)fn({type:'vault-runner-status'},{id:runtime.id},r=>status=r);return status;};
  assert.equal(probe().ready,true);assert.equal(probe().session,memory['runner:tab:9'].session);
  const blockedDialog=popup('Existing report');assert.equal(probe().ready,false);assert.match(probe().reason,/Close/);blockedDialog.remove();
  cancel.textContent='Cancel BackTest';assert.equal(probe().ready,false);assert.match(probe().reason,/already running/);cancel.textContent='BackTest';
  const pending=popup('Momentum Trading BackTest');button(pending,'Backtest',()=>{}).click();pending.remove();assert.equal(probe().ready,false);assert.match(probe().reason,/earlier source submission/);const rejectedPending=popup('Error');w.VaultCapture.monitor();rejectedPending.remove();assert.equal(probe().ready,true);
  let untrustedReply=false;for(const fn of listeners)fn({type:'vault-runner-status'},{id:'other-extension'},()=>untrustedReply=true);assert.equal(untrustedReply,false);
  if(vaultSetup){
   const requestConfig=changes=>bridge?coordinator.handle({action:'configure',tabId:9,changes},dashboard).then(response=>({...response,config:response.source})):new Promise(resolve=>{for(const fn of listeners)fn({type:'vault-runner-config',changes},{id:runtime.id},resolve);});
   let navigationCount=0;
   if(refreshParents){main.hidden=true;d.querySelector('h1').textContent='Research dashboard';const nav=d.createElement('li');nav.setAttribute('token','bt');nav.textContent='Back Testing';nav.onclick=()=>{navigationCount++;nativeTimeout(()=>{const menu=d.createElement('div');menu.className='tool-popup';menu.innerHTML='<div class="popupContent"><div><ul class="Fav-menu"><li><a href="javascript:;"><span><div><span class="favourite-fill"></span><div class="scanner-name-scroll">Momentum Trading Back Testing</div></div></span></a></li></ul></div></div>';menu.querySelector('a').onclick=()=>{menu.remove();main.hidden=false;d.querySelector('h1').textContent='Momentum Trading BackTesting';};d.body.append(menu);},100);};d.body.append(nav);assert.equal(probe().ready,false);assert.equal(probe().capable,true);}
   const existing=popup('Existing user report'),blocked=await requestConfig();assert.equal(blocked.ok,false);assert.equal(existing.isConnected,true);assert.equal(submissions,0);existing.remove();
   const unsupported=await requestConfig({momentum:{0:'Renko'}});assert.equal(unsupported.ok,false);assert.equal(main.querySelector('select').selectedOptions[0].textContent,'Candle');
   if(noOptionRefresh){const failed=await requestConfig({momentum:{39:'My'}});assert.equal(failed.ok,false);assert.match(failed.error,/finish loading the dependent choices/);assert.equal(sourceMessages.at(-1),'Vault connection failed: '+failed.error);assert.equal(sourceSuccessDialogs.length,0);assert.equal(submissions,0);assert.equal(portfolios,0);return;}
   if(emptyOptions){const refreshed=await requestConfig({momentum:{43:'My'}});assert.equal(refreshed.ok,true,refreshed.error);assert.equal(refreshed.config.stages.momentum.options[44].length,0);assert.equal(refreshed.config.stages.momentum.fields[44].value,'');assert.equal(refreshed.config.stages.momentum.fields[46].checked,false);assert.equal(submissions,0);assert.equal(portfolios,0);assert.equal(w.VaultCapture.popup('Momentum Trading BackTest'),undefined);if(!variableSet)return;}
   if(refreshParents){const refreshed=await requestConfig({momentum:{39:'My'}});assert.equal(refreshed.ok,true,refreshed.error);}
   const response=await requestConfig(refreshParents?{execution:{6:'My'}}:undefined);
   if(closeStuckAfterWake){assert.equal(response.ok,false);assert.match(response.error,/Source dialog did not close/);assert.ok(w.VaultCapture.popup('Momentum Trading BackTest'));assert.equal(submissions,0);assert.equal(portfolios,0);assert.equal(sourceSuccessDialogs.length,0);return;}
   assert.equal(response.ok,true,response.error);assert.equal(submissions,0,'Loading the setup must never run a backtest.');assert.equal(portfolios,0);assert.equal(w.VaultCapture.popup('Momentum Trading BackTest'),undefined);
   if(closeAfterWake){assert.deepEqual(sourceSuccessDialogs,[false]);return;}
   if(bridge){assert.equal(bridgeConfigRequests,2,'Both the rejected change and successful connection must cross the real background boundary.');assert.equal(response.config.session,memory['runner:tab:9'].session,'Reading settings must retain the registered document session.');assert.deepEqual(sourceMessages.slice(-4),['Connecting to Vault: opening Momentum settings…','Connecting to Vault: reading strategy choices…','Connecting to Vault: reading backtest settings…','RZone settings read. Return to Vault to finish setup.']);assert.deepEqual(sourceSuccessDialogs,[false],'Connection success must only appear after closing its own settings dialog.');}
   if(refreshParents)assert.equal(navigationCount,1);
   const template=S.template(response.config),config=S.defaults(template);
   Object.assign(config,{'momentum.group':'Nifty 50 Index','momentum.timeframe':'Weekly','momentum.period.2.enabled':true,'momentum.period.2':90,'momentum.ema.1.enabled':true,'momentum.ema.1':200,'momentum.ema.2':55,'momentum.retracement.enabled':true,'momentum.retracement.reference':'8','momentum.volume.reference':'21','momentum.tma':true,'momentum.trend-quality.enabled':true,'momentum.trend-quality':60,'execution.from':'2023-01-01','execution.to':'2024-12-31','execution.target.enabled':false,'execution.target':7,'execution.stop':12,'portfolio.allocation':'Fixed','portfolio.capital':500000,'portfolio.max-open':8,'portfolio.daily-limit.enabled':true,'portfolio.daily-limit':3});
   if(refreshParents){assert.deepEqual(Array.from(response.config.stages.momentum.options[40],o=>o.value),['My trend rule','My alternate rule']);Object.assign(config,{'momentum.strategy.1.enabled':true,'momentum.strategy.1.rule':'My alternate rule','momentum.strategy.1.timeframe':'Weekly','execution.exit.enabled':true,'execution.exit.rule':'My alternate rule'});}
   const baseline=S.configToBaseline(config,template,{id:'empty-library-setup',name:'Configured in Vault',demo:false});
   const variableDimensions=variableSet==='momentum'?[['momentum.period.2.enabled',[false,true]],['momentum.period.2',[90,180]],['momentum.ema.1.enabled',[false,true]],['momentum.strategy.1.rule',['Demo trend rule','Alternate trend rule']],['momentum.retracement.reference',['7','9']],['momentum.volume.reference',['20','21']]]:variableSet==='rules'?[['momentum.radar.enabled',[false,true]],['momentum.radar.rule',['Demo momentum screen','Alternate momentum screen']],['execution.exit.enabled',[false,true]],['execution.exit.rule',['Demo exit rule','Alternate exit rule']],['execution.target.enabled',[false,true]],['execution.target',[7,9]]]:null;
   plan=E.create({id:'runner-proof',name:'Runner proof',baseline,dimensions:variableDimensions?variableDimensions.map(([key,values])=>({key,values})):[{key:'momentum.period.1',values:'126,180,252'}],...(variableSet?{mode:'sample',budget:3,seed:5}:{}),minTrades:0});memory['experiment:'+plan.id]=plan;
   assert.equal(Object.keys(memory).some(k=>k.startsWith('run:')),false,'A new setup must work with an empty archive.');
   if(changedOptions)main.querySelectorAll('input,select')[33].querySelector('option[value="source:Weekly"]').remove();
   // Let the source register again after the setup-reading status.
   for(let n=0;n<30&&!memory['runner:tab:9']?.ready;n++)await sleep(10);
  }
  await coordinator.handle({action:'start',id:plan.id,tabId:9},dashboard);
  for(const fn of listeners)fn({type:'vault-runner-wake'},{id:runtime.id},()=>{});
  for(let n=0;n<600&&!['complete','needs-review'].includes(memory['experiment:'+plan.id].status);n++)await sleep(20);
  const result=memory['experiment:'+plan.id];
  const runs=Object.entries(memory).filter(([k])=>k.startsWith('run:')).map(([,v])=>v);
  if(missingGroup||changedOptions||driftDuringRun){
   assert.equal(result.status,'needs-review',JSON.stringify(result.trials));assert.equal(runs.length,0);assert.equal(submissions,driftDuringRun?1:0);assert.equal(portfolios,0);
   assert.match(result.trials[0].error,missingGroup?/confirm that group/:changedOptions?/dropdown value is unavailable/:/read-back differs/);
  }
  else if(changeLocked||staleCompletion||rejected||reuseReport||noRunning||preexistingReport){
   assert.equal(result.status,'needs-review',JSON.stringify(result.trials));assert.equal(submissions,changeLocked?0:reuseReport?2:1);assert.equal(runs.length,reuseReport?1:0);assert.equal(portfolios,reuseReport?2:preexistingReport?1:0);
   if(reuseReport)assert.match(result.trials[1].error,/confirmed submissions/);
   if(preexistingReport)assert.match(result.trials[0].error,/linked submissions/);
   if(staleCompletion||noRunning){assert.equal(guardedStates.length,2);assert.ok(guardedStates.every(s=>s.completed===false&&s.portfolios===0),'A stale completion label must never advance to portfolio testing.');}
  }
  else{
   assert.equal(result.status,'complete',JSON.stringify(result.trials.map(t=>({status:t.status,error:t.error}))));assert.equal(submissions,3);assert.equal(portfolios,3);assert.equal(runs.length,3);assert.deepEqual(runs.map(r=>E.fields(r,'momentum')[12].value),variableSet?['180','180','180']:['126','180','252']);
   if(overlap){assert.equal(guardedStates.length,3);assert.ok(guardedStates.every((s,i)=>s.completed===false&&s.portfolios===i),'Old completion text while Cancel is visible must not complete the trial.');}
   for(const r of runs){assert.equal(r.provenance,'recorded-at-submit');assert.equal(r.charts.length,6);assert.equal(r.trades.rows.length,4);assert.equal(r.trades.rows[1][2],'0');assert.equal(r.experiment.id,plan.id);
    if(vaultSetup){const t=plan.trials.find(t=>t.runId===r.id);for(const stage of ['momentum','execution','portfolio'])E.verify(E.fields(E.expected(plan,t),stage),E.fields(r,stage));assert.equal(E.fields(r,'momentum')[1].value,'Nifty 50 Index');assert.equal(E.fields(r,'execution')[1].value,'2023-01-01');assert.equal(E.fields(r,'portfolio')[2].value,'500000');}
    if(variableSet){const m=E.fields(r,'momentum'),x=E.fields(r,'execution');assert.equal(m.slice(7,11).filter(f=>f.checked).length,1,'Retracement reference stays exclusive.');assert.equal(m.slice(20,22).filter(f=>f.checked).length,1,'Volume reference stays exclusive.');for(const [gate,child]of [[11,12],[13,14],[26,27],[34,36]])assert.equal(m[child].disabled,!m[gate].checked);for(const [gate,child]of [[5,7],[8,9]])assert.equal(x[child].disabled,!x[gate].checked);}
    const receipt=r.experiment.evidence;assert.equal(receipt.version,1);assert.equal(receipt.strategySubmissionId,r.parameters.strategy.id);assert.equal(receipt.portfolioSubmissionId,r.parameters.id);assert.equal(receipt.sourceSession,memory['runner:tab:9'].session);assert.equal(receipt.capturedAt,r.savedAt);const times=['strategySubmittedAt','strategyStartedAt','strategyCompletedAt','portfolioSubmittedAt','reportOpenedAt','capturedAt'].map(k=>Date.parse(receipt[k]));assert.ok(times.every((time,i)=>Number.isFinite(time)&&(!i||time>=times[i-1])));
   }assert.equal(new Set(runs.map(r=>r.experiment.evidence.strategySubmissionId)).size,3);assert.equal(new Set(runs.map(r=>r.experiment.evidence.portfolioSubmissionId)).size,3);assert.deepEqual(savedBeforeNext,[true,true],'Each earlier result is durable before the next source submission.');assert.equal(memory['runner:lease'],null);if(vaultSetup)assert.equal(groupCommits,3);if(variableSet)for(const dimension of plan.dimensions)assert.equal(new Set(plan.trials.map(t=>t.patch[dimension.key])).size,2,'The three trial fixture must exercise both '+dimension.key+' choices.');
  }
 }finally{dom.window.close();}
}
async function backgroundFocusChecks(){
 const vm=require('node:vm'),dashboardURL='chrome-extension://test-ext/index.html',sourceURL='https://zone.definedgesecurities.com/index.html#research';
 for(const mode of ['return','source-error','user-switch','closed-vault','changed-vault','moved-vault','unrelated-tab','late-read','late-activation']){
  let active=10,clock=1000,expired,release,reads=0;const actions=[],timers=new Map();let timerId=0;
  const browserTabs=new Map([[9,{id:9,windowId:1,url:sourceURL}],[10,{id:10,windowId:1,url:mode==='unrelated-tab'?'https://example.com/':dashboardURL}],[11,{id:11,windowId:1,url:'https://example.org/'}]]);
  const chrome={storage:{local:{}},runtime:{id:'test-ext',getURL:file=>'chrome-extension://test-ext/'+file,onMessage:{addListener:()=>{}}},action:{onClicked:{addListener:()=>{}}},tabs:{
   get:async id=>{if(!browserTabs.has(id))throw Error('Tab closed');return {...browserTabs.get(id)};},
   query:async query=>{assert.deepEqual({...query},{active:true,windowId:1});return [{...browserTabs.get(active)}];},
   update:async(id,update)=>{assert.equal(update.active,true);actions.push(id);active=id;if(mode==='late-activation'&&id===9)return await new Promise(resolve=>{release=resolve;});return {...browserTabs.get(id)};},
   sendMessage:async(id,message)=>{
    assert.equal(id,9);assert.equal(active,9);assert.equal(message.type,'vault-runner-config');reads++;
    if(mode==='user-switch')active=11;
    if(mode==='closed-vault')browserTabs.delete(10);
    if(mode==='changed-vault')browserTabs.get(10).url='https://example.net/';
    if(mode==='moved-vault')browserTabs.get(10).windowId=2;
    if(mode==='source-error')throw Error('Source rejected connection');
    if(mode==='late-read')return await new Promise(resolve=>{release=resolve;});
    return {ok:true,session:'s',config:{session:'s'}};
   },create:async()=>({id:12})
  }};
  class FakeDate extends Date {static now(){return clock;}}
  const context=vm.createContext({chrome,URL,Date:FakeDate,crypto:require('node:crypto').webcrypto,structuredClone,setTimeout:(fn,ms)=>{assert.equal(ms,60000);const id=++timerId;timers.set(id,fn);expired=fn;return id;},clearTimeout:id=>timers.delete(id)});
  context.importScripts=(...files)=>files.forEach(file=>vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),context,{filename:file}));
  vm.runInContext(fs.readFileSync(path.join(base,'background.js'),'utf8'),context,{filename:'background.js'});
  const result=context.configure(9,{});
  if(mode.startsWith('late-')){
   for(let n=0;n<20&&!release;n++)await Promise.resolve();assert.equal(typeof release,'function');clock+=60001;expired();
   await assert.rejects(result,/did not finish connecting/);release({ok:true,session:'s',config:{session:'s'}});
   for(let n=0;n<20;n++)await Promise.resolve();
   assert.deepEqual(actions,[9],'An expired request must never restore focus when its late operation completes.');assert.equal(reads,mode==='late-read'?1:0,'Expired activation must not start a late configuration read.');
  }else if(mode==='source-error')await assert.rejects(result,/Source rejected connection/);
  else assert.equal((await result).ok,true);
  if(['return','source-error'].includes(mode))assert.deepEqual(actions,[9,10]);
  if(['user-switch','closed-vault','changed-vault','moved-vault','unrelated-tab'].includes(mode))assert.deepEqual(actions,[9],mode+' must not restore focus to a tab the user did not request.');
  assert.equal(timers.size,0);
 }
}
(async()=>{const cases=[{}, {overlap:true},{changeLocked:true},{staleCompletion:true},{noRunning:true},{rejected:true},{reuseReport:true},{preexistingReport:true},{vaultSetup:true,bridge:true},{vaultSetup:true,closeAfterWake:true},{vaultSetup:true,closeStuckAfterWake:true},{vaultSetup:true,refreshParents:true},{vaultSetup:true,noOptionRefresh:true},{vaultSetup:true,emptyOptions:true,variableSet:'momentum'},{vaultSetup:true,missingGroup:true},{vaultSetup:true,changedOptions:true},{vaultSetup:true,driftDuringRun:true},{vaultSetup:true,variableSet:'momentum'},{vaultSetup:true,variableSet:'rules'}];if(!process.argv.includes('--variations'))await backgroundFocusChecks();for(const options of cases.filter(o=>(!process.argv.includes('--setup')||o.vaultSetup)&&(!process.argv.includes('--variations')||o.variableSet)&&(!process.argv.includes('--bridge')||o.bridge)&&(!process.argv.includes('--close')||o.closeAfterWake||o.closeStuckAfterWake)))await scenario(options);console.log('PASS: '+(process.argv.includes('--close')?'dialog close':process.argv.includes('--bridge')?'background bridge':process.argv.includes('--variations')?'variation':process.argv.includes('--setup')?'Vault setup':'all')+' runner scenarios, including source receipts, empty-library setup, dependent rule refresh, group resolution, control read-back and rejection guards. Live GWT/extension acceptance remains separate.');})().catch(e=>{console.error(e);process.exitCode=1;});
