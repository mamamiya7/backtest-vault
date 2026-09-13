const assert=require('node:assert/strict'),E=require('../dist/experiments.js'),D=require('../dist/demo.js'),V=require('../dist/core.js');
const {createCoordinator}=require('../dist/experiment-coordinator.js');
const clone=E.clone,b=E.baseline(D.create()[0]);
const config={id:'exp-test',name:'Period study',baseline:b,dimensions:[{key:'momentum.period.1',values:'126:252:63'},{key:'execution.stop',values:'6,8'}],minTrades:10};
const e=E.create(config);assert.equal(e.trials.length,6);assert.equal(E.validate(e),e);assert.equal(E.fields(b,'momentum')[12].value,'180');assert.equal(E.fields(E.expected(e,e.trials[0]),'momentum')[12].value,'126');
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

async function coordinatorTests(){
 const memory={},runtime={id:'test-extension',getURL:p=>'chrome-extension://test-extension/'+p};let time=100000,ids=0;
 const storage={get:async key=>key?{[key]:clone(memory[key]??null)}:clone(memory),set:async data=>Object.assign(memory,clone(data))};
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
 const r=clone(D.create()[0]);r.demo=false;r.id=a.trial.runId;r.parameters=E.expected(plan,a.trial).parameters;r.experiment={id,trialId:a.trial.id,phase:'discovery'};r.charts=Array.from({length:6},()=>r.charts[0]);
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
}

async function decisionTests(){
 const {JSDOM}=require('jsdom'),fs=require('node:fs'),path=require('node:path');const dom=new JSDOM('',{runScripts:'outside-only'});const w=dom.window;w.structuredClone=structuredClone;
 for(const file of ['core.js','presentation.js','intelligence.js','experiments.js','demo.js'])w.eval(fs.readFileSync(path.resolve(__dirname,'../dist',file),'utf8'));
 try{const plan=w.VaultExperiments.create(config),runs=plan.trials.map(t=>{t.status='saved';return w.VaultDemo.createTrial(plan,t);});plan.status='complete';const d=w.VaultExperiments.decisions(plan,runs);assert.ok(d.eligible.length>1,JSON.stringify(d.items.map(x=>x.reasons)));assert.ok(d.leader);assert.equal(d.pending,0);
  const bad=clone(runs[0]);bad.parameters.strategy.main.fields[1].value='Wrong universe';assert.equal(w.VaultExperiments.result(plan,plan.trials[0],bad).eligible,false);
  const noCagr=clone(runs[0]);noCagr.quickStats=noCagr.quickStats.filter(s=>s.label!=='CAGR');assert.equal(w.VaultExperiments.result(plan,plan.trials[0],noCagr).eligible,false,'Annualized fallback must not enter Calmar');
  assert.throws(()=>w.VaultExperiments.validation(plan,d.leader.trial.id,{from:'2025-06-01',to:'2025-12-01'}),/strictly after/);
  w.VaultExperiments.validation(plan,d.leader.trial.id,{from:'2026-01-01',to:'2026-06-01'});assert.equal(plan.trials.at(-1).phase,'validation');assert.deepEqual(plan.trials.at(-1).patch,d.leader.trial.patch);
  const before=w.VaultExperiments.nextTrial({...plan,mode:'adaptive'},runs);const holdoutLeak=clone(runs[0]);holdoutLeak.id='unrelated';holdoutLeak.quickStats[0].value='999999%';assert.equal(w.VaultExperiments.nextTrial({...plan,mode:'adaptive'},[...runs,holdoutLeak]).id,before.id);
  w.VaultExperiments.validate(plan);
 }finally{dom.window.close();}
}
(async()=>{await coordinatorTests();await decisionTests();console.log('PASS: bounded planning, reproducible sampling, immutable settings, queue ownership/restart/uncertainty, save acknowledgements, source verification, eligibility, CAGR-only Calmar and isolated validation.');})().catch(e=>{console.error(e);process.exitCode=1;});
