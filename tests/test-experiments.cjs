const assert=require('node:assert/strict'),E=require('../dist/experiments.js'),D=require('../dist/demo.js'),V=require('../dist/core.js');
const {createCoordinator}=require('../dist/experiment-coordinator.js');
const clone=E.clone,b=E.baseline(D.create()[0]);
const reordered=x=>Array.isArray(x)?x.map(reordered):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,reordered(x[k])])):x;
const config={id:'exp-test',name:'Period study',baseline:b,dimensions:[{key:'momentum.period.1',values:'126:252:63'},{key:'execution.stop',values:'6,8'}],minTrades:10};
const e=E.create(config);assert.equal(e.trials.length,6);assert.equal(E.validate(e),e);assert.equal(E.fields(b,'momentum')[12].value,'180');assert.equal(E.fields(E.expected(e,e.trials[0]),'momentum')[12].value,'126');
const stored=reordered(e);assert.equal(E.validate(stored),stored,'Storage property order does not alter the approved plan');
const changedIndex=reordered(e);changedIndex.dimensions[0].index++;assert.throws(()=>E.validate(changedIndex),/settings were altered/);
const changedOrder=reordered(e);changedOrder.dimensions[0].values.reverse();assert.throws(()=>E.validate(changedOrder),/queue was altered/,'Array order still determines the approved trial order');
const changedDates=clone(e);changedDates.trials[0].period={from:'2030-01-01',to:'2031-01-01'};assert.throws(()=>E.validate(changedDates),/Discovery dates/,'Discovery must not silently change the locked period');
assert.throws(()=>E.create({...config,budget:3}),/exceed/);assert.throws(()=>E.create({...config,dimensions:[{key:'momentum.group',values:'something'}]}),/Unknown/);
assert.throws(()=>E.create({...config,dimensions:[{key:'momentum.period.1',values:'0,1.2'}]}),/valid whole/);
assert.throws(()=>E.create({...config,dimensions:[{key:'momentum.period.1',values:'1:20:0'}]}),/positive step/);
const sampled=E.create({...config,mode:'sample',budget:3,seed:199});assert.deepEqual(sampled.trials,E.create({...config,mode:'sample',budget:3,seed:199}).trials);
assert.equal(new Set(sampled.trials.map(t=>JSON.stringify(t.patch))).size,3);
const actual=clone(E.fields(b,'momentum'));actual[1].value='Different universe';assert.throws(()=>E.verify(E.fields(b,'momentum'),actual),/read-back/);
actual[1]=clone(E.fields(b,'momentum')[1]);actual[12].label='Unexpected';assert.throws(()=>E.verify(E.fields(b,'momentum'),actual),/layout/);
assert.throws(()=>E.transition(e,e.trials[0],'saved'),/Unexpected/);
E.transition(e,e.trials[0],'applying');const restored=E.restored(e);assert.equal(restored.status,'paused');assert.equal(restored.trials[0].status,'uncertain');assert.equal(e.trials[0].status,'applying');
const pnf=E.baseline(D.create()[2]),renko=E.baseline(D.create()[3]);assert.ok(E.catalog(pnf).some(f=>f.key==='momentum.box.size'));assert.ok(E.catalog(renko).some(f=>f.key==='momentum.brick.size'));
const broken=clone(sampled);broken.trials[0].patch['momentum.period.1']=999;assert.throws(()=>E.validate(broken),/ranges|altered/);

function recordedResult(plan,trial){
 const r=clone(D.create()[0]);r.demo=false;r.id=trial.runId;r.parameters=E.expected(plan,trial).parameters;r.experiment={id:plan.id,trialId:trial.id,phase:trial.phase};r.charts=Array.from({length:6},()=>r.charts[0]);
 const at=new Date(Date.parse(trial.execution.claimedAt)+100).toISOString(),s=r.parameters.strategy,p=r.parameters;
 Object.assign(s,{id:trial.id+'-strategy',at,started:true,startedAt:at,completed:true,completedAt:at});Object.assign(p,{id:trial.id+'-portfolio',at,reportOpenedAt:at});r.savedAt=at;
 r.experiment.evidence={version:1,sourceSession:trial.execution.sourceSession,strategySubmissionId:s.id,strategySubmittedAt:at,strategyStartedAt:at,strategyCompletedAt:at,portfolioSubmissionId:p.id,portfolioSubmittedAt:at,reportOpenedAt:at,capturedAt:at};
 return r;
}

async function coordinatorTests(){
 const memory={},runtime={id:'test-extension',getURL:p=>'chrome-extension://test-extension/'+p};let time=100000,ids=0;
 const storage={get:async key=>reordered(key?{[key]:clone(memory[key]??null)}:clone(memory)),set:async data=>Object.assign(memory,clone(data))};
 const make=()=>createCoordinator({storage,runtime,clock:()=>time,uuid:()=> 'generated-'+(++ids)});let c=make();
 const dashboard={id:runtime.id,url:runtime.getURL('index.html')},source={id:runtime.id,url:'https://zone.definedgesecurities.com/index.html#research',tab:{id:7}};
 const real=clone(b);real.demo=false;
 const call=(action,data={},sender=dashboard)=>c.handle({action,...data},sender);
 await assert.rejects(call('list',{}, {...dashboard,url:'https://evil.invalid'}),/cannot control/);
 const {experiment:plan}=await call('create',{plan:{...config,baseline:real}});const id=plan.id;
 await call('hello',{session:'session-1',ready:true,chart:'Candle'},source);await call('start',{id,tabId:7});
 const [a,other]=await Promise.all([call('claim',{id,session:'session-1'},source),call('claim',{id,session:'session-1'},source)]);assert.ok(a.trial);assert.equal(other.trial,null);
 const args={id,session:'session-1',token:a.token,trialId:a.trial.id};
 await assert.rejects(call('checkpoint',{...args,stage:'saved'},source),/durable capture/);
 await assert.rejects(call('checkpoint',{...args,token:'wrong',stage:'strategy-submitting'},source),/ownership/);
 // A fresh service worker must retain the original owner and never repeat the claim.
 c=make();assert.equal((await call('claim',{id,session:'session-1'},source)).trial,null);
 for(const stage of ['strategy-submitting','strategy-complete','portfolio-submitting','capturing'])await call('checkpoint',{...args,stage},source);
 const r=recordedResult(plan,a.trial);
 assert.equal(E.result(plan,a.trial,r).eligible,true,'A linked recorded lifecycle may enter decision eligibility');
 const oldUnproven=clone(r);delete oldUnproven.experiment.evidence;assert.equal(E.result(plan,a.trial,oldUnproven).eligible,false,'Legacy results remain visible but cannot rank as verified experiment evidence');
 // A matching storage key alone is not a verified result. Preserve the lease
 // and trial until record identity, execution session, and source order agree.
 const variants=[
  [x=>{x.id='different-run';},/matching durable/],
  [x=>{x.demo=true;},/fictional/],
  [x=>{x.experiment.phase='holdout';},/matching durable/],
  [x=>{delete x.experiment.evidence;},/execution evidence/],
  [x=>{x.experiment.evidence.sourceSession='old-document';},/source session/],
  [x=>{x.parameters.strategy.id='older-strategy';},/submissions/],
  [x=>{x.parameters.strategy.started=false;},/submissions/],
  [x=>{x.experiment.evidence.reportOpenedAt='1970-01-01T00:00:01.000Z';x.parameters.reportOpenedAt=x.experiment.evidence.reportOpenedAt;},/execution order/]
 ];
 for(const [mutate,error] of variants){const bad=clone(r);mutate(bad);memory['run:'+r.id]=bad;await assert.rejects(call('checkpoint',{...args,stage:'saved'},source),error);assert.equal(memory['experiment:'+id].trials[0].status,'capturing');assert.equal(memory['runner:lease'].token,a.token);}
 memory['run:'+r.id]=r;
 await call('pause',{id});assert.equal(memory['experiment:'+id].status,'pausing');await call('checkpoint',{...args,stage:'saved'},source);
 assert.equal(memory['experiment:'+id].status,'paused');assert.equal(memory['runner:lease'],null);assert.equal(memory['experiment:'+id].trials[0].status,'saved');
 await call('start',{id,tabId:7});const next=await call('claim',{id,session:'session-1'},source);assert.notEqual(next.trial.id,a.trial.id);
 time+=91000;await call('list');assert.equal(memory['experiment:'+id].status,'needs-review');assert.equal(memory['experiment:'+id].trials.find(t=>t.id===next.trial.id).status,'uncertain');
 await assert.rejects(call('start',{id,tabId:7}),/owns/);await call('skip',{id,trialId:next.trial.id});assert.equal(memory['runner:lease'],null);
 await assert.rejects(call('reconcile',{id,trialId:next.trial.id}),/No durable/);
 // A failed persistence acknowledgement must not dispatch another trial.
 const blocked=createCoordinator({storage:{...storage,set:async()=>{throw Error('Storage unavailable');}},runtime});await assert.rejects(blocked.handle({action:'create',plan:{...config,baseline:real}},dashboard),/Storage unavailable/);
 // Hidden-page heartbeats can be delayed. Discovery/start must use a direct reply,
 // while neither discovery nor a closed/reloaded tab may revive an old owner.
 let reply={session:'session-1',ready:true,chart:'Candle'};
 c=createCoordinator({storage,runtime,clock:()=>time,uuid:()=> 'generated-'+(++ids),probe:async tabId=>{assert.equal(tabId,7);if(!reply)throw Error('Tab closed');return clone(reply);}});
 const leaseBefore=clone(memory['runner:lease']);time+=120000;
 assert.equal((await call('list')).tabs[0].ready,true,'Responding background tab survives delayed heartbeat');assert.deepEqual(memory['runner:lease'],leaseBefore);
 const {experiment:live}=await call('create',{plan:{...config,baseline:real}});
 reply.ready=false;reply.reason='Close the open report.';await assert.rejects(call('start',{id:live.id,tabId:7}),/Close the open report/);
 reply={session:'new-document',ready:true,chart:'Candle'};assert.equal((await call('list')).tabs.length,0);await assert.rejects(call('start',{id:live.id,tabId:7}),/not responding/);
 reply=null;assert.equal((await call('list')).tabs.length,0);await assert.rejects(call('start',{id:live.id,tabId:7}),/not responding/);
 reply={session:'session-1',ready:true,chart:'Candle'};await call('start',{id:live.id,tabId:7});assert.equal(memory['experiment:'+live.id].status,'running');
 const late=await call('claim',{id:live.id,session:'session-1'},source),lateArgs={id:live.id,session:'session-1',token:late.token,trialId:late.trial.id};
 const deadline=memory['runner:lease'].seenAt;time+=90001;
 await call('hello',{session:'session-1',ready:true,chart:'Candle'},source);
 assert.equal(memory['runner:lease'].seenAt,deadline,'Late hello cannot revive an expired trial');
 assert.equal(memory['experiment:'+live.id].status,'needs-review');
 await assert.rejects(call('checkpoint',{...lateArgs,stage:'strategy-submitting'},source),/expired/);
 await call('skip',{id:live.id,trialId:late.trial.id});
 // A saved-but-unacknowledged result can be reconciled after a worker restart,
 // including property reordering, while an absent proof cannot be promoted.
 await call('start',{id:live.id,tabId:7});const recovery=await call('claim',{id:live.id,session:'session-1'},source),recoveryArgs={id:live.id,session:'session-1',token:recovery.token,trialId:recovery.trial.id};
 for(const stage of ['strategy-submitting','strategy-complete','portfolio-submitting','capturing'])await call('checkpoint',{...recoveryArgs,stage},source);
 const durable=recordedResult(live,recovery.trial);memory['run:'+durable.id]=durable;
 c=make();time+=90001;await call('list');
 const unproven=clone(durable);delete unproven.experiment.evidence;memory['run:'+durable.id]=unproven;await assert.rejects(call('reconcile',{id:live.id,trialId:recovery.trial.id}),/execution evidence/);
 memory['run:'+durable.id]=durable;await call('reconcile',{id:live.id,trialId:recovery.trial.id});assert.equal(memory['runner:lease'],null);assert.equal(memory['experiment:'+live.id].trials.find(t=>t.id===recovery.trial.id).status,'saved');
 // Imported/queued records must never cause the runner to overwrite an
 // existing run, even when the existing record is not a valid trial result.
 await call('hello',{session:'session-1',ready:true,chart:'Candle'},source);await call('start',{id:live.id,tabId:7});const queued=memory['experiment:'+live.id].trials.find(t=>t.status==='queued');memory['run:'+queued.runId]={id:queued.runId,privateNote:'preserve this record'};
 assert.equal((await call('claim',{id:live.id,session:'session-1'},source)).trial,null);assert.equal(memory['experiment:'+live.id].status,'needs-review');assert.equal(memory['runner:lease'],null);assert.equal(memory['run:'+queued.runId].privateNote,'preserve this record');
 await call('skip',{id:live.id,trialId:queued.id});await call('start',{id:live.id,tabId:7});const orphan=await call('claim',{id:live.id,session:'session-1'},source);
 // Simulate an inconsistent write/recovery state: the active journal survives
 // but its lease does not. It must not claim a second trial after restart.
 memory['runner:lease']=null;c=make();assert.equal((await call('claim',{id:live.id,session:'session-1'},source)).trial,null);assert.equal(memory['experiment:'+live.id].status,'needs-review');assert.equal(memory['experiment:'+live.id].trials.find(t=>t.id===orphan.trial.id).status,'uncertain');assert.equal(memory['experiment:'+live.id].trials.filter(t=>E.active.includes(t.status)).length,0);
}

async function decisionTests(){
 const {JSDOM}=require('jsdom'),fs=require('node:fs'),path=require('node:path');const dom=new JSDOM('',{runScripts:'outside-only'});const w=dom.window;w.structuredClone=structuredClone;
 for(const file of ['core.js','presentation.js','intelligence.js','experiments.js','demo.js'])w.eval(fs.readFileSync(path.resolve(__dirname,'../dist',file),'utf8'));
 try{const plan=w.VaultExperiments.create(config),runs=plan.trials.map(t=>{t.status='saved';return w.VaultDemo.createTrial(plan,t);});plan.status='complete';const d=w.VaultExperiments.decisions(plan,runs);assert.ok(d.eligible.length>1,JSON.stringify(d.items.map(x=>x.reasons)));assert.ok(d.leader);assert.equal(d.pending,0);
  const bad=clone(runs[0]);bad.parameters.strategy.main.fields[1].value='Wrong universe';assert.equal(w.VaultExperiments.result(plan,plan.trials[0],bad).eligible,false);
  const noCagr=clone(runs[0]);noCagr.quickStats=noCagr.quickStats.filter(s=>s.label!=='CAGR');assert.equal(w.VaultExperiments.result(plan,plan.trials[0],noCagr).eligible,false,'Annualized fallback must not enter Calmar');
  assert.throws(()=>w.VaultExperiments.validation(plan,d.leader.trial.id,{from:'2025-06-01',to:'2025-12-01'}),/strictly after/);
  w.VaultExperiments.validation(plan,d.leader.trial.id,{from:'2026-01-01',to:'2026-06-01'});assert.equal(plan.trials.at(-1).phase,'validation');assert.deepEqual(plan.trials.at(-1).patch,d.leader.trial.patch);
  w.VaultExperiments.validate(reordered(plan));
  const mixedStages=reordered(plan);mixedStages.trials.unshift(mixedStages.trials.pop());assert.throws(()=>w.VaultExperiments.validate(mixedStages),/stage order/);
  const changedCandidate=reordered(plan);changedCandidate.trials.at(-1).patch['execution.stop']=changedCandidate.trials.at(-1).patch['execution.stop']===6?8:6;assert.throws(()=>w.VaultExperiments.validate(changedCandidate),/preserve its candidate/);
  const duplicate=clone(runs[1]);for(const key of ['quickStats','statistics','trades'])duplicate[key]=reordered(runs[0][key]);const duplicateDecision=w.VaultExperiments.decisions(plan,[runs[0],duplicate]);assert.ok(duplicateDecision.items.find(x=>x.run.id===duplicate.id).reasons.includes('Repeated report evidence.'));
  const before=w.VaultExperiments.nextTrial({...plan,mode:'adaptive'},runs);const holdoutLeak=clone(runs[0]);holdoutLeak.id='unrelated';holdoutLeak.quickStats[0].value='999999%';assert.equal(w.VaultExperiments.nextTrial({...plan,mode:'adaptive'},[...runs,holdoutLeak]).id,before.id);
  w.VaultExperiments.validate(plan);
 }finally{dom.window.close();}
}
(async()=>{await coordinatorTests();await decisionTests();console.log('PASS: bounded planning, reproducible sampling, immutable settings, queue ownership/restart/uncertainty, save acknowledgements, source verification, eligibility, CAGR-only Calmar and isolated validation.');})().catch(e=>{console.error(e);process.exitCode=1;});
