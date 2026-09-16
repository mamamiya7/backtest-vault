/* Full DOM → submission → pagination → durable save → next-trial integration. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const E=require('../dist/experiments.js'),D=require('../dist/demo.js'),{createCoordinator}=require('../dist/experiment-coordinator.js');
const base=path.resolve(__dirname,'../dist'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const reordered=x=>Array.isArray(x)?x.map(reordered):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,reordered(x[k])])):x;
async function scenario(options={}){
 const {changeLocked=false,overlap=false,staleCompletion=false,rejected=false,reuseReport=false,noRunning=false,preexistingReport=false}=options;
 const dom=new JSDOM('<body><h1>Momentum Trading BackTesting</h1><div class="account-right"></div></body>',{runScripts:'outside-only',url:'https://zone.definedgesecurities.com/index.html#research'}),w=dom.window,d=w.document;
 const fixture=D.create()[0];fixture.demo=false;w.structuredClone=structuredClone;
 Object.defineProperty(w.HTMLElement.prototype,'innerText',{get(){return this.textContent;}});
 w.Element.prototype.getClientRects=function(){return this.isConnected&&!this.closest('[hidden]')&&!this.closest('[style*="display: none"]')?[{width:100,height:20}]:[];};
 const nativeTimeout=w.setTimeout.bind(w),nativeInterval=w.setInterval.bind(w);w.setTimeout=(fn,ms)=>nativeTimeout(fn,Math.min(ms,20));w.setInterval=(fn,ms)=>nativeInterval(fn,Math.min(ms,30));
 const main=d.querySelector('.account-right');
 function form(container,fields){const table=d.createElement('table');for(const f of fields){const tr=d.createElement('tr'),td=d.createElement('td'),cell=d.createElement('td');td.textContent=f.label;let n;if(f.type==='select-one'){n=d.createElement('select');const o=d.createElement('option');o.textContent=f.value;o.value=f.value;n.append(o);}else {n=d.createElement('input');n.type=f.type;n.value=f.value;if(f.checked!==null)n.checked=f.checked;}n.disabled=f.disabled;cell.append(n);tr.append(td,cell);table.append(tr);}container.append(table);}
 function button(p,label,fn){const n=d.createElement('button');n.textContent=label;n.onclick=fn;p.append(n);return n;}
 function popup(title){const p=d.createElement('div');p.className='popupContent';const h=d.createElement('div');h.className='custom-dialog-header';const caption=d.createElement('div');caption.className='caption';caption.textContent=title;const close=d.createElement('a');close.className='close-buton';close.onclick=()=>p.remove();h.append(caption,close);p.append(h);d.body.append(p);return p;}
 form(main,E.fields(fixture,'momentum'));let submissions=0,portfolios=0,priorReport=null;const guardedStates=[];
 const oldHiddenReport=preexistingReport?popup('Portfolio Backtesting Report'):null;if(oldHiddenReport)oldHiddenReport.hidden=true;
 // Observed RZone lifecycle: one main button becomes Cancel, the setup remains
 // open during Processing, and completion removes that setup automatically.
 const done=d.createElement('span');done.textContent='BackTest Completed.';main.append(done);let cancel;
 cancel=button(main,'BackTest',()=>{const p=popup('Momentum Trading BackTest');form(p,E.fields(fixture,'execution'));button(p,'Backtest',()=>{
  submissions++;if(rejected){popup('Error');return;}
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
 const listeners=[];w.chrome={storage:{local:storage},runtime:{...runtime,sendMessage:m=>coordinator.handle(m,source),onMessage:{addListener:fn=>listeners.push(fn)}}};
 w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
 for(const file of ['core.js','presentation.js','intelligence.js','experiments.js','capture.js'])w.eval(fs.readFileSync(path.join(base,file),'utf8'));
 // Build the baseline from the same visible form labels the saver records.
 fixture.parameters.strategy.main.fields=JSON.parse(JSON.stringify(w.VaultCapture.fields(main)));
 const bp=popup('Baseline fixture');form(bp,E.fields(fixture,'execution'));fixture.parameters.strategy.execution.fields=JSON.parse(JSON.stringify(w.VaultCapture.fields(bp)));bp.remove();const pp=popup('Baseline portfolio');form(pp,E.fields(fixture,'portfolio'));fixture.parameters.settings.fields=JSON.parse(JSON.stringify(w.VaultCapture.fields(pp)));pp.remove();
 const plan=E.create({id:'runner-proof',name:'Runner proof',baseline:E.baseline(fixture),dimensions:[{key:'momentum.period.1',values:'126,180,252'}],minTrades:0});memory['experiment:'+plan.id]=plan;
 if(changeLocked)main.querySelectorAll('input')[0].value='Unexpected group';
 w.eval(fs.readFileSync(path.join(base,'runner.js'),'utf8'));
 try{for(let n=0;n<50&&!memory['runner:tab:9'];n++)await sleep(10);
  const probe=()=>{let status;for(const fn of listeners)fn({type:'vault-runner-status'},{id:runtime.id},r=>status=r);return status;};
  assert.equal(probe().ready,true);assert.equal(probe().session,memory['runner:tab:9'].session);
  const blockedDialog=popup('Existing report');assert.equal(probe().ready,false);assert.match(probe().reason,/Close/);blockedDialog.remove();
  cancel.textContent='Cancel BackTest';assert.equal(probe().ready,false);assert.match(probe().reason,/already running/);cancel.textContent='BackTest';
  const pending=popup('Momentum Trading BackTest');button(pending,'Backtest',()=>{}).click();pending.remove();assert.equal(probe().ready,false);assert.match(probe().reason,/earlier source submission/);const rejectedPending=popup('Error');w.VaultCapture.monitor();rejectedPending.remove();assert.equal(probe().ready,true);
  let untrustedReply=false;for(const fn of listeners)fn({type:'vault-runner-status'},{id:'other-extension'},()=>untrustedReply=true);assert.equal(untrustedReply,false);
  await coordinator.handle({action:'start',id:plan.id,tabId:9},dashboard);
  for(const fn of listeners)fn({type:'vault-runner-wake'},{id:runtime.id},()=>{});
  for(let n=0;n<300&&!['complete','needs-review'].includes(memory['experiment:'+plan.id].status);n++)await sleep(20);
  const result=memory['experiment:'+plan.id];
  const runs=Object.entries(memory).filter(([k])=>k.startsWith('run:')).map(([,v])=>v);
  if(changeLocked||staleCompletion||rejected||reuseReport||noRunning||preexistingReport){
   assert.equal(result.status,'needs-review',JSON.stringify(result.trials));assert.equal(submissions,changeLocked?0:reuseReport?2:1);assert.equal(runs.length,reuseReport?1:0);assert.equal(portfolios,reuseReport?2:preexistingReport?1:0);
   if(reuseReport)assert.match(result.trials[1].error,/confirmed submissions/);
   if(preexistingReport)assert.match(result.trials[0].error,/linked submissions/);
   if(staleCompletion||noRunning){assert.equal(guardedStates.length,2);assert.ok(guardedStates.every(s=>s.completed===false&&s.portfolios===0),'A stale completion label must never advance to portfolio testing.');}
  }
  else{
   assert.equal(result.status,'complete',JSON.stringify(result.trials.map(t=>({status:t.status,error:t.error}))));assert.equal(submissions,3);assert.equal(portfolios,3);assert.equal(runs.length,3);assert.deepEqual(runs.map(r=>E.fields(r,'momentum')[12].value),['126','180','252']);
   if(overlap){assert.equal(guardedStates.length,3);assert.ok(guardedStates.every((s,i)=>s.completed===false&&s.portfolios===i),'Old completion text while Cancel is visible must not complete the trial.');}
   for(const r of runs){assert.equal(r.provenance,'recorded-at-submit');assert.equal(r.charts.length,6);assert.equal(r.trades.rows.length,4);assert.equal(r.trades.rows[1][2],'0');assert.equal(r.experiment.id,plan.id);
    const receipt=r.experiment.evidence;assert.equal(receipt.version,1);assert.equal(receipt.strategySubmissionId,r.parameters.strategy.id);assert.equal(receipt.portfolioSubmissionId,r.parameters.id);assert.equal(receipt.sourceSession,memory['runner:tab:9'].session);assert.equal(receipt.capturedAt,r.savedAt);const times=['strategySubmittedAt','strategyStartedAt','strategyCompletedAt','portfolioSubmittedAt','reportOpenedAt','capturedAt'].map(k=>Date.parse(receipt[k]));assert.ok(times.every((time,i)=>Number.isFinite(time)&&(!i||time>=times[i-1])));
   }assert.equal(new Set(runs.map(r=>r.experiment.evidence.strategySubmissionId)).size,3);assert.equal(new Set(runs.map(r=>r.experiment.evidence.portfolioSubmissionId)).size,3);assert.equal(memory['runner:lease'],null);
  }
 }finally{dom.window.close();}
}
(async()=>{await scenario();await scenario({overlap:true});await scenario({changeLocked:true});await scenario({staleCompletion:true});await scenario({noRunning:true});await scenario({rejected:true});await scenario({reuseReport:true});await scenario({preexistingReport:true});console.log('PASS: simulated Candle trials with exact submission receipts, delayed fresh completion, stale/completing overlap, no-start and source-error rejection, existing/reused-report rejection, pagination, durable saves, busy-source readiness, and locked-control drift. Live GWT/extension acceptance remains separate.');})().catch(e=>{console.error(e);process.exitCode=1;});
