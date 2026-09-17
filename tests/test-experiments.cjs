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
for(const value of ['0::1',':10:1','0:10:','0: :1'])assert.throws(()=>E.values(value,{label:'Volume',type:'number',min:0,max:1000,integer:true}),/start:end:step/,'A missing numeric endpoint or step is not the number zero');
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

async function deletionTests(){
 const memory={},runtime={id:'delete-extension',getURL:p=>'chrome-extension://delete-extension/'+p};let time=100000,ids=0;
 const storage={get:async key=>clone(key?{[key]:memory[key]??null}:memory),set:async data=>Object.assign(memory,clone(data)),remove:async key=>{delete memory[key];}};
 const c=createCoordinator({storage,runtime,clock:()=>time,uuid:()=> 'delete-study-'+(++ids)});
 const dashboard={id:runtime.id,url:runtime.getURL('index.html')},source={id:runtime.id,url:'https://zone.definedgesecurities.com/index.html#research',tab:{id:7}};
 const real=clone(b);real.demo=false;
 const call=(action,data={},sender=dashboard)=>c.handle({action,...data},sender),create=async()=> (await call('create',{plan:{...config,baseline:real}})).experiment;
 const draft=await create(),other=await create();
 memory['run:'+draft.trials[0].runId]={id:draft.trials[0].runId,experiment:{id:draft.id},note:'Saved research stays in the library'};
 memory['benchmark:reference']={id:'reference',values:[100,110]};memory['ui:strategy-table:v1']={order:['rank','returns']};
 const retained=clone(memory);delete retained['experiment:'+draft.id];
 await assert.rejects(call('delete',{id:draft.id},source),/Only Vault/);
 await assert.rejects(call('delete',{id:draft.id},{...dashboard,id:'another-extension'}),/cannot control/);
 await assert.rejects(call('delete',{id:'../bad'}),/Invalid study/);
 assert.equal((await call('delete',{id:draft.id})).deleted,true);assert.deepEqual(memory,retained,'Delete only the requested study, never its saved runs or other records');
 assert.equal((await call('delete',{id:draft.id})).deleted,false,'A repeated confirmed deletion is harmless');
 assert.equal(E.deletionReason(undefined),'Study not found.');
 for(const status of ['draft','complete','paused','needs-review']){const safe=clone(other);safe.status=status;safe.trials[0].status='uncertain';assert.equal(E.deletionReason(safe),'','An unowned interrupted archive may be deleted');}
 for(const status of ['running','pausing'])assert.match(E.deletionReason({...other,status}),/Stop this study/);
 for(const status of E.active){const active=clone(other);active.status='paused';active.trials[0].status=status;assert.match(E.deletionReason(active),/Stop this study/);memory['experiment:'+other.id]=active;await assert.rejects(call('delete',{id:other.id}),/Stop this study/);}
 memory['experiment:'+other.id]=clone(other);
 await call('hello',{session:'session-1',ready:true,chart:'Candle'},source);
 // Both orders use the same serialized queue; deletion cannot overtake start.
 const first=await create(),deleteFirst=await Promise.allSettled([call('delete',{id:first.id}),call('start',{id:first.id,tabId:7})]);
 assert.equal(deleteFirst[0].status,'fulfilled');assert.equal(deleteFirst[1].status,'rejected');assert.match(deleteFirst[1].reason.message,/not found/);assert.equal(memory['experiment:'+first.id],undefined);
 const second=await create(),startFirst=await Promise.allSettled([call('start',{id:second.id,tabId:7}),call('delete',{id:second.id})]);
 assert.equal(startFirst[0].status,'fulfilled');assert.equal(startFirst[1].status,'rejected');assert.match(startFirst[1].reason.message,/Stop this study/);
 await call('pause',{id:second.id});assert.equal(memory['experiment:'+second.id].owner,undefined,'An immediate pause releases source ownership');await call('delete',{id:second.id});
 const oldPaused=await create();Object.assign(memory['experiment:'+oldPaused.id],{status:'paused',owner:{tabId:7,session:'session-1'}});await call('delete',{id:oldPaused.id});assert.equal(memory['experiment:'+oldPaused.id],undefined,'Legacy immediate pauses may retain harmless metadata without an active trial or lease');
 const live=await create();await call('start',{id:live.id,tabId:7});
 const claimed=await call('claim',{id:live.id,session:'session-1'},source),args={id:live.id,session:'session-1',token:claimed.token,trialId:claimed.trial.id};
 await assert.rejects(call('delete',{id:live.id}),/Stop this study/);
 // Other inactive studies can be removed without disturbing the running lease.
 const lease=clone(memory['runner:lease']);await call('delete',{id:other.id});assert.deepEqual(memory['runner:lease'],lease);
 time+=90001;await assert.rejects(call('delete',{id:live.id}),/Review this study/);
 assert.equal(memory['experiment:'+live.id].status,'needs-review');assert.equal(memory['experiment:'+live.id].trials[0].status,'uncertain');assert.deepEqual(memory['runner:lease'],lease,'Expiry cannot silently release an unreviewed submission');
 await assert.rejects(call('checkpoint',{...args,stage:'strategy-submitting'},source),/expired/);
 await call('skip',{id:live.id,trialId:claimed.trial.id});await call('delete',{id:live.id});
 await assert.rejects(call('checkpoint',{...args,stage:'strategy-submitting'},source),/not found/);
 await assert.rejects(call('claim',{id:live.id,session:'session-1'},source),/not found/);
 assert.equal((await call('hello',{session:'session-1',ready:true},source)).id,null);assert.equal(memory['experiment:'+live.id],undefined,'Late runner messages never recreate a deleted study');
 // A lease still protects an inconsistent archive even if its owner was lost.
 const orphan=await create();memory['runner:lease']={experimentId:orphan.id,trialId:orphan.trials[0].id,seenAt:time-100000};
 await assert.rejects(call('delete',{id:orphan.id}),/Review this study/);assert.ok(memory['experiment:'+orphan.id]);memory['runner:lease']=null;
 const unsettled=await create();Object.assign(memory['experiment:'+unsettled.id],{status:'needs-review',owner:{tabId:7,session:'session-1'}});memory['experiment:'+unsettled.id].trials[0].status='uncertain';
 await assert.rejects(call('delete',{id:unsettled.id}),/Review this study/);await call('skip',{id:unsettled.id,trialId:unsettled.trials[0].id});await call('delete',{id:unsettled.id});
 const blocked=createCoordinator({storage:{...storage,remove:async()=>{throw Error('Storage unavailable');}},runtime});
 await assert.rejects(blocked.handle({action:'delete',id:orphan.id},dashboard),/Storage unavailable/);assert.ok(memory['experiment:'+orphan.id],'Failed storage removal must not report success');
 memory['experiment:wrong-key']=clone(memory['experiment:'+orphan.id]);await assert.rejects(call('delete',{id:'wrong-key'}),/identity does not match/);assert.ok(memory['experiment:'+orphan.id],'A malformed storage entry cannot redirect deletion to a different study');
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
async function setupBridgeTests(){
 const S=require('../dist/setup.js'),memory={},runtime={id:'setup-extension',getURL:p=>'chrome-extension://setup-extension/'+p};
 const storage={get:async key=>clone(key?{[key]:memory[key]??null}:memory),set:async data=>Object.assign(memory,clone(data))};
 const dashboard={id:runtime.id,url:runtime.getURL('index.html')},source={id:runtime.id,url:'https://zone.definedgesecurities.com/index.html#research',tab:{id:42}};
 const config=S.demoTemplate();config.demo=false;config.session='setup-session';let replySession='setup-session',calls=0,opened=0;
 const c=createCoordinator({storage,runtime,clock:()=>100000,uuid:()=> 'new-from-vault',
  probe:async()=>({session:'setup-session',ready:true,capable:true,chart:'Candle'}),
  configure:async(id,changes)=>{assert.equal(id,42);calls++;if(calls===2)assert.deepEqual(changes,{momentum:{35:'My'}});return {ok:true,session:replySession,config:{...config,session:replySession}};},
  openSource:async known=>{opened++;assert.equal(known[0].id,42);return {tabId:42};}});
 const call=(action,data={},sender=dashboard)=>c.handle({action,...data},sender);
 await call('hello',{session:'setup-session',ready:true,capable:true,chart:'Candle'},source);
 assert.equal((await call('open-source')).tabId,42);assert.equal(opened,1);
 const connected=await call('configure',{tabId:42});assert.equal(connected.source.session,'setup-session');
 await call('configure',{tabId:42,changes:{momentum:{35:'My'}}});
 await assert.rejects(call('configure',{tabId:42,changes:{portfolio:{2:'999'}}}),/Invalid source choices/);
 await assert.rejects(call('configure',{tabId:42,changes:{momentum:{unknown:'bad'}}}),/Invalid source choices/);
 await assert.rejects(call('configure',{tabId:42},source),/Experiment not found/);
 replySession='replacement-document';await assert.rejects(call('configure',{tabId:42}),/reloaded/);replySession='setup-session';
 const setup=S.configToBaseline(S.defaults(config),config,{id:'new-strategy',name:'Configured in Vault'});
 const created=await call('create',{plan:{name:'First test',baseline:setup,dimensions:[],objective:'returns'}});
 assert.equal(created.experiment.trials.length,1);assert.deepEqual(created.experiment.trials[0].patch,{});
 assert.equal(E.validate(reordered(created.experiment)).id,created.experiment.id);
 assert.equal(Object.keys(memory).filter(k=>k.startsWith('run:')).length,0,'Setup must not manufacture a saved baseline result');
 const altered=clone(created.experiment);altered.baseline.parameters.settings.fields[2].value='999';assert.throws(()=>E.validate(altered),/altered/);
 assert.throws(()=>E.create({...config,id:'old-empty',name:'old empty',baseline:b,dimensions:[]}),/one and six/);
 memory['runner:lease']={seenAt:100000};await assert.rejects(call('configure',{tabId:42}),/Finish or pause/);await assert.rejects(call('open-source'),/Finish or pause/);
}
function setupVariationTests(){
 const S=require('../dist/setup.js'),source=S.demoTemplate();
 const offer=(stage,index,options)=>{source.stages[stage].options[index]=options.map(value=>({value,label:value,disabled:false}));};
 offer('momentum',36,['Demo momentum screen','Radar, quality']);offer('momentum',40,['Demo trend rule','Trend, Momentum','-- Select Predefined System --']);offer('momentum',41,['Daily','Weekly']);offer('execution',7,['Demo exit rule','Exit, reversal']);
 const t=S.template(source),config=S.defaults(t),base=S.configToBaseline(config,t,{id:'variation-setup',name:'Inline variations'}),unchanged=clone(base),catalog=E.catalog(base);
 for(const key of ['momentum.period.1.enabled','momentum.period.2','momentum.period.2.weight','momentum.ema.1.enabled','momentum.ema.1','momentum.tma','momentum.retracement.enabled','momentum.retracement','momentum.retracement.mode','momentum.retracement.reference','momentum.volume.reference','momentum.radar.enabled','momentum.radar.rule','momentum.trend-quality.enabled','momentum.strategy.1.enabled','momentum.strategy.1.rule','momentum.strategy.1.timeframe','execution.target.enabled','execution.stop.enabled','execution.exit.enabled','execution.exit.rule'])assert.ok(catalog.some(f=>f.key===key),key+' must be available beside its setup control');
 for(const key of ['momentum.group','momentum.market','momentum.timeframe','momentum.chart','momentum.radar.source','momentum.strategy.1.source','momentum.rs','momentum.market-filter','execution.chart','execution.selection','execution.exit.source','portfolio.enabled'])assert.ok(!catalog.some(f=>f.key===key),key+' must remain fixed context or a source-catalogue control');
 const blank=clone(t);blank.stages.momentum.fields[1].value='';blank.stages.execution.fields[1].value='';blank.stages.execution.fields[2].value='';assert.ok(E.catalogFromSetup(blank).some(f=>f.key==='momentum.period.1'),'Inline variation choices do not depend on a completed main form');
 assert.deepEqual(catalog.find(f=>f.key==='momentum.retracement.reference').indices,[7,8,9,10]);assert.equal(catalog.find(f=>f.key==='momentum.radar.rule').type,'enum');
 const make=(dimensions,extra={})=>E.create({id:'variation-test',name:'Inline variations',baseline:base,dimensions,budget:100,objective:'returns',minTrades:0,...extra});
 const plan=make([
  {key:'momentum.period.2.enabled',values:[false,true]},
  {key:'momentum.ema.1',values:'100:200:100'},
  {key:'momentum.retracement.reference',values:['7','10']},
  {key:'momentum.volume.reference',values:['20','21']},
  {key:'momentum.strategy.1.rule',values:['Demo trend rule','Trend, Momentum']},
  {key:'execution.target.enabled',values:'On, Off'}
 ]);
 assert.equal(plan.trials.length,64);assert.deepEqual(plan.dimensions.find(f=>f.key==='momentum.strategy.1.rule').values,['Demo trend rule','Trend, Momentum'],'Comma-containing rule names remain one enum value');
 assert.equal(E.validate(reordered(plan)).id,plan.id);
 for(const trial of plan.trials){const expected=E.expected(plan,trial),m=E.fields(expected,'momentum');S.validateBaseline(expected);assert.equal(m[13].checked,trial.patch['momentum.period.2.enabled']);assert.equal(m[14].disabled,!m[13].checked);assert.equal(m[27].value,String(trial.patch['momentum.ema.1']));assert.equal(m.filter((f,i)=>i>=7&&i<=10&&f.checked).length,1);assert.equal(m[Number(trial.patch['momentum.retracement.reference'])].checked,true);assert.equal(m[Number(trial.patch['momentum.volume.reference'])].checked,true);assert.equal(m[40].value,trial.patch['momentum.strategy.1.rule']);assert.equal(E.fields(expected,'execution')[8].checked,trial.patch['execution.target.enabled']);}
 assert.deepEqual(base,unchanged,'Expected trials never mutate their immutable setup baseline');
 assert.throws(()=>make([{key:'momentum.strategy.1.rule',values:'Demo trend rule,Trend, Momentum'}]),/source values/,'Enums cannot be parsed by splitting labels on commas');
 assert.throws(()=>make([{key:'momentum.strategy.1.rule',values:['Unknown rule']}]),/source values/);
 assert.throws(()=>make([{key:'momentum.period.1.enabled',values:[1]}]),/On, Off/);
 assert.throws(()=>make([{key:'momentum.ema.1',values:[true]}]),/valid whole/);
 assert.throws(()=>make([{key:'momentum.period.1.enabled',values:[true,false]}],{mode:'sample',budget:1}),/positive weight/,'Validate unsampled combinations too; sampling cannot hide an all-periods-off case');
 assert.throws(()=>make([{key:'execution.target.enabled',values:[true,false]},{key:'execution.stop.enabled',values:[true,false]}]),/enabled target, stop loss or exit/);
 assert.throws(()=>make([{key:'momentum.strategy.1.rule',values:['Demo trend rule','-- Select Predefined System --']}],{mode:'sample',budget:1}),/before enabling/,'A placeholder cannot be an enabled rule in an unselected combination');
 const empty=clone(t);empty.stages.momentum.fields[36].value='';empty.stages.momentum.options[36]=[];empty.stages.momentum.fields[34].checked=false;const emptyBase=S.configToBaseline(S.defaults(empty),empty);assert.throws(()=>make([{key:'momentum.radar.enabled',values:[false,true]}],{baseline:emptyBase}),/before enabling/);
 for(const key of ['momentum.group','momentum.radar.source','execution.exit.source','portfolio.enabled'])assert.throws(()=>make([{key,values:['changed']}]),/Unknown/);
 const noExits={...config,'execution.target.enabled':false,'execution.stop.enabled':false,'execution.exit.enabled':false};assert.throws(()=>make([],{baseline:S.configToBaseline(noExits,t)}),/enabled target, stop loss or exit/);
 const damaged=reordered(plan);damaged.dimensions.find(f=>f.key==='momentum.retracement.reference').indices.reverse();assert.throws(()=>E.validate(damaged),/settings were altered/);
 assert.throws(()=>E.decisions(damaged,[]),/settings were altered/,'The ranking batch must validate before using its lightweight field reconstruction');
 const changedOptions=reordered(plan);changedOptions.dimensions.find(f=>f.key==='momentum.strategy.1.rule').options.push({value:'Injected rule',label:'Injected rule'});assert.throws(()=>E.validate(changedOptions),/settings were altered/);
 const forgedPatch=clone(plan.trials[0]);forgedPatch.patch['momentum.group']='Different universe';assert.throws(()=>E.expected(plan,forgedPatch),/approved ranges/);
 const unknownRule=clone(plan.trials[0]);unknownRule.patch['momentum.strategy.1.rule']='Unknown rule';assert.throws(()=>E.expected(plan,unknownRule),/approved ranges/);
 const sample=make([{key:'momentum.radar.rule',values:['Demo momentum screen','Radar, quality']},{key:'momentum.tma',values:[true,false]}],{mode:'sample',budget:3,seed:18});assert.deepEqual(sample.trials,make(sample.dimensions,{mode:'sample',budget:3,seed:18}).trials);
 const mixed=clone(plan),mixedRuns=[0,7,31,63].map(index=>{mixed.trials[index].status='saved';return D.createTrial(mixed,mixed.trials[index]);});const batched=E.decisions(mixed,mixedRuns);
 for(const item of batched.items){const direct=E.result(mixed,item.trial,item.run);assert.equal(item.eligible,direct.eligible);assert.deepEqual(item.reasons,direct.reasons);assert.equal(item.value,direct.value);}
 const wrongReference=clone(mixedRuns[0]);wrongReference.parameters.strategy.main.fields[7].checked=!wrongReference.parameters.strategy.main.fields[7].checked;const mismatched=E.decisions(mixed,[wrongReference,...mixedRuns.slice(1)]).items.find(item=>item.run?.id===wrongReference.id);assert.equal(mismatched.eligible,false);assert.match(mismatched.reasons.join(' '),/read-back/,'Batch ranking still rejects a captured reference checkbox that differs from the trial');
 // Label alternatives are categorical, not ordered numerical neighbors.
 const rules=make([{key:'momentum.strategy.1.rule',values:['Demo trend rule','Trend, Momentum']}]);const runs=rules.trials.map(trial=>{trial.status='saved';return D.createTrial(rules,trial);});rules.status='complete';const decision=E.decisions(rules,runs);assert.equal(decision.eligible.length,2);assert.ok(decision.leader);assert.equal(decision.neighbors.length,0);
 E.validation(rules,decision.leader.trial.id,{from:'2026-01-01',to:'2026-06-01'});const validation=rules.trials.at(-1),expected=E.expected(rules,validation);assert.equal(E.fields(expected,'execution')[1].value,'2026-01-01');assert.equal(expected.setup.config['execution.from'],'2026-01-01');assert.deepEqual(validation.patch,decision.leader.trial.patch);E.validate(rules);
 const invalidDate=clone(rules);invalidDate.trials.at(-1).period.from='2026-02-30';assert.throws(()=>E.validate(invalidDate),/Invalid validation dates/,'Setup archives still verify real dates without rebuilding every trial');
 const earlierDate=clone(rules);earlierDate.trials.at(-1).period.from='2025-12-31';assert.throws(()=>E.validate(earlierDate),/preserve its candidate/);
 const changedCandidate=clone(rules);changedCandidate.trials.at(-1).patch['momentum.strategy.1.rule']=decision.leader.trial.patch['momentum.strategy.1.rule']==='Demo trend rule'?'Trend, Momentum':'Demo trend rule';assert.throws(()=>E.validate(changedCandidate),/preserve its candidate/,'An allowed enum is still forbidden if it changes the frozen validation candidate');
 const changedDiscovery=clone(rules);changedDiscovery.trials[0].period={from:'2026-01-01',to:'2026-06-01'};assert.throws(()=>E.validate(changedDiscovery),/Discovery dates/);
}
async function ruleSearchBridgeTests(){
 const memory={},runtime={id:'search-extension',getURL:p=>'chrome-extension://search-extension/'+p},session='search-session',calls=[];
 const storage={get:async key=>clone(key?{[key]:memory[key]??null}:memory),set:async value=>Object.assign(memory,clone(value))},dashboard={id:runtime.id,url:runtime.getURL('index.html')},source={id:runtime.id,url:'https://zone.definedgesecurities.com/index.html#research',tab:{id:42}};
 let responsePatch=null,replySession=session;
 const c=createCoordinator({storage,runtime,clock:()=>100000,probe:async()=>({session,ready:true,capable:true,chart:'Candle'}),configure:async(id,changes,request)=>{calls.push({id,changes:clone(changes),request:clone(request)});return {ok:true,session:replySession,result:{...request,childIndex:request.parentIndex+1,controlType:'text',options:[{value:'Fictional match',label:'Fictional match',disabled:false}],...responsePatch}};}}),call=(data={},sender=dashboard)=>c.handle({action:'lookup-rule',tabId:42,session,parentIndex:39,category:'Public',query:'trend',...data},sender);
 await c.handle({action:'hello',session,ready:true,capable:true,chart:'Candle'},source);
 const first=await call();assert.equal(first.result.options[0].label,'Fictional match');assert.deepEqual(calls[0],{id:42,changes:{},request:{stage:'momentum',parentIndex:39,category:'Public',query:'trend',session}});assert.deepEqual(Object.keys(memory),['runner:tab:42'],'Searching cannot write a run, experiment or lease');
 for(const patch of [{parentIndex:35},{parentIndex:'39'},{parentIndex:40},{parentIndex:6},{stage:'momentum',parentIndex:6},{stage:'execution',parentIndex:39},{stage:'execution',parentIndex:7},{stage:'portfolio',parentIndex:6},{stage:null},{stage:''},{stage:5},{category:'Pre'},{category:'Popular'},{category:'Unknown'},{query:''},{query:'   '},{query:' padded'},{query:'x'.repeat(201)},{query:'line\nfeed'},{query:'\u007f'},{query:5}]){const count=calls.length;await assert.rejects(call(patch),/strategy search/);assert.equal(calls.length,count,'Invalid lookup cannot reach the source');}
 await assert.rejects(call({session:'old-document'}),/changed or reloaded/);await assert.rejects(call({},source),/Experiment not found/);await assert.rejects(call({},{...dashboard,url:'https://unrelated.invalid/'}),/cannot control/);
 replySession='changed';await assert.rejects(call(),/reloaded during/);replySession=session;
 for(const patch of [{stage:'execution'},{stage:'portfolio'},{stage:null},{parentIndex:43},{childIndex:44},{category:'My'},{query:'other'},{controlType:'select-one'},{options:{}},{options:new Array(3001).fill('too many')}]){responsePatch=patch;await assert.rejects(call(),/different strategy search/);}responsePatch=null;
 responsePatch={stage:undefined};assert.equal((await call()).result.options[0].label,'Fictional match','Legacy momentum replies may omit their stage.');responsePatch=null;
 const exitRequest={stage:'execution',parentIndex:6,query:'exit trend'};
 for(const category of ['My','Public']){const exit=await call({...exitRequest,category});assert.equal(exit.result.stage,'execution');assert.equal(exit.result.childIndex,7);assert.deepEqual(calls.at(-1),{id:42,changes:{},request:{...exitRequest,category,session}});}
 for(const patch of [{stage:undefined},{stage:'momentum'},{stage:null},{parentIndex:39},{childIndex:40},{category:'My'},{query:'trend'}]){responsePatch=patch;await assert.rejects(call(exitRequest),/different strategy search/);}responsePatch=null;
 await assert.rejects(call({...exitRequest,session:'old-document'}),/changed or reloaded/);await assert.rejects(call(exitRequest,source),/Experiment not found/);
 replySession='changed';await assert.rejects(call(exitRequest),/reloaded during/);replySession=session;
 memory['runner:lease']={seenAt:100000};await assert.rejects(call(),/Finish or pause/);await assert.rejects(call(exitRequest),/Finish or pause/);delete memory['runner:lease'];memory['experiment:running']={status:'running'};await assert.rejects(call(),/Finish or pause/);await assert.rejects(call(exitRequest),/Finish or pause/);delete memory['experiment:running'];
 for(const parentIndex of [39,43,47])for(const category of ['My','Public'])assert.equal((await call({parentIndex,category})).result.category,category);
}
function setupCachedCategoryTests(){
 const S=require('../dist/setup.js'),source=S.demoTemplate(),m=source.stages.momentum,categories=['Pre','My','Public','Popular'];m.ruleCatalogues={};
 const option=(label,disabled=false)=>({value:label,label,disabled});
 for(let n=0;n<=3;n++){
  const parent=35+4*n,child=parent+1,gate=n?parent+3:34,lists={};m.options[parent]=categories.map(x=>option(x));m.fields[parent].value='Pre';m.fields[gate].checked=true;
  for(const category of categories)lists[category]=[option(`${n} ${category} first`),option(`${n} ${category} second`),option(`${n} ${category} unavailable`,true)];
  m.options[child]=clone(lists.Pre);m.fields[child].value=`${n} Pre first`;m.ruleCatalogues[child]={parentIndex:parent,gateIndex:gate,categories:lists,...(n?{controlTypes:{Pre:'select-one',My:'text',Public:'text',Popular:'select-one'},searchQueries:{My:'private',Public:'public'}}:{})};
 }
 const t=S.template(source),defaults=S.defaults(t);
 for(const category of categories){
  const config={...defaults};for(let n=0;n<=3;n++){const prefix=n?`momentum.strategy.${n}`:'momentum.radar';config[prefix+'.source']=category;config[prefix+'.rule']=`${n} ${category} first`;}
  const baseline=S.configToBaseline(config,t,{id:'category-'+category,name:'Cached '+category}),catalog=E.catalog(baseline),dimensions=[];
  for(let n=0;n<=3;n++){
   const prefix=n?`momentum.strategy.${n}`:'momentum.radar',rule=catalog.find(f=>f.key===prefix+'.rule');assert.deepEqual(rule.options.map(o=>o.value),[`${n} ${category} first`,`${n} ${category} second`],'Dimension choices use the configured category, not the original source or a union');
   assert.ok(!catalog.some(f=>f.key===prefix+'.source'),'A category remains fixed within a batch');dimensions.push({key:prefix+'.rule',values:rule.options.map(o=>o.value)});
  }
  const plan=E.create({id:'plan-'+category,name:'Rules for '+category,baseline,dimensions,budget:20,objective:'returns'});assert.equal(plan.trials.length,16);assert.equal(E.validate(reordered(plan)).id,plan.id);
  for(const trial of plan.trials){const expected=E.expected(plan,trial);for(let n=0;n<=3;n++){const prefix=n?`momentum.strategy.${n}`:'momentum.radar';assert.equal(E.fields(expected,'momentum')[35+4*n].value,category);assert.equal(E.fields(expected,'momentum')[36+4*n].value,trial.patch[prefix+'.rule']);assert.equal(E.fields(expected,'momentum')[36+4*n].type,n&&['My','Public'].includes(category)?'text':'select-one','Each trial expects the actual source control for its category');}S.validateBaseline(expected);}
  for(let n=0;n<=3;n++){
   const prefix=n?`momentum.strategy.${n}`:'momentum.radar',key=prefix+'.rule',other=category==='My'?'Public':'My';
   assert.throws(()=>E.create({id:'wrong-category',name:'Wrong category',baseline,dimensions:[{key,values:[`${n} ${other} first`]}]}),/source values/);
   assert.throws(()=>E.create({id:'disabled-rule',name:'Disabled rule',baseline,dimensions:[{key,values:[`${n} ${category} unavailable`]}]}),/source values/);
   assert.throws(()=>E.create({id:'changing-category',name:'Changing category',baseline,dimensions:[{key:prefix+'.source',values:['Pre','My']}]}),/Unknown/);
  }
  const tampered=clone(plan);tampered.dimensions[0].options.push(option('1 '+(category==='My'?'Pre':'My')+' first'));assert.throws(()=>E.validate(tampered),/settings were altered/,'Imported dimension metadata cannot add another category');
  const wrongPatch=clone(plan.trials[0]);wrongPatch.patch['momentum.strategy.1.rule']='1 '+(category==='My'?'Pre':'My')+' first';assert.throws(()=>E.expected(plan,wrongPatch),/approved ranges/);
 }
 for(let n=0;n<=3;n++){
  const empty=clone(t),key=n?`momentum.strategy.${n}`:'momentum.radar',child=36+4*n;empty.stages.momentum.ruleCatalogues[child].categories.My=[];
  const baseline=S.configToBaseline({...defaults,[key+'.source']:'My',[key+'.rule']:'',[key+'.enabled']:false},empty),make=values=>E.create({id:'empty-category-'+n,name:'Empty rules',baseline,dimensions:[{key:key+'.enabled',values}],objective:'returns',mode:'sample',budget:1});
  assert.equal(make([false]).trials.length,1);assert.throws(()=>make([false,true]),/available (strategy|radar) .* before enabling/,'Every combination must block enabling an empty category, including unsampled trials');
 }
}
function setupContextVariationTests(){
 const S=require('../dist/setup.js'),source=S.demoTemplate();source.stages.execution.options[0]=['Return Percent','Sharpe Return'];
 const template=S.template(source),config={...S.defaults(template),'portfolio.daily-limit.enabled':true},base=S.configToBaseline(config,template,{id:'context-base',name:'Context study'}),catalog=E.catalog(base);
 const types={'execution.rank':'enum','execution.from':'date','execution.to':'date','portfolio.allocation':'enum','portfolio.capital':'number','portfolio.max-open':'number','portfolio.daily-limit.enabled':'boolean','portfolio.daily-limit':'number'};
 for(const [key,type] of Object.entries(types))assert.equal(catalog.find(f=>f.key===key)?.type,type,key+' is a supported new-setup variation');
 for(const key of Object.keys(types))assert.ok(!E.catalog(b).some(f=>f.key===key),'Saved-baseline scopes remain locked: '+key);
 const make=(dimensions,extra={})=>E.create({id:'context-test',name:'Dates and sizing',baseline:base,dimensions,budget:100,objective:'returns',minTrades:0,...extra});
 const dates=catalog.find(f=>f.key==='execution.from');
 assert.deepEqual(E.values(['2024-02-29','2024-02-29','2025-01-01'],dates),['2024-02-29','2025-01-01']);
 for(const input of ['2024-01-01',[],['2025-02-29'],['2024-2-01'],[' 2024-02-01'],['2024-02-01T00:00:00Z'],[42],[null],Array(101).fill('2024-01-01')])assert.throws(()=>E.values(input,dates),/valid dates/,'Dates are exact ISO value lists');
 assert.throws(()=>make([{key:'execution.from',values:['2024-01-01','2025-06-01']},{key:'execution.to',values:['2025-01-01','2025-12-01']}],{mode:'sample',budget:1}),/Every date combination/,'Reject invalid unsampled combinations, not only the selected sample');
 assert.throws(()=>make([{key:'execution.from',values:['2025-12-31']}]),/Every date combination/,'Date ranges are checked against a fixed opposite endpoint too');
 const dims=[{key:'execution.rank',values:['Return Percent','Sharpe Return']},{key:'execution.from',values:['2023-01-01','2024-01-01']},{key:'execution.to',values:['2025-06-01','2025-12-31']},{key:'portfolio.allocation',values:['Fixed','Reinvestment']},{key:'portfolio.capital',values:[100000,200000]},{key:'portfolio.max-open',values:[5,10]}],plan=make(dims);
 assert.equal(plan.trials.length,64);assert.equal(E.validate(reordered(plan)).id,plan.id);
 for(const trial of plan.trials){const expected=E.expected(plan,trial),x=E.fields(expected,'execution'),p=E.fields(expected,'portfolio');for(const [key,index] of [['execution.rank',0],['execution.from',1],['execution.to',2]])assert.equal(x[index].value,String(trial.patch[key]));for(const [key,index] of [['portfolio.allocation',1],['portfolio.capital',2],['portfolio.max-open',3]])assert.equal(p[index].value,String(trial.patch[key]));S.validateBaseline(expected);}
 assert.throws(()=>make([...dims,{key:'portfolio.daily-limit',values:[1,2]}]),/one and six/);
 const alteredType=clone(plan);alteredType.dimensions[1].type='number';assert.throws(()=>E.validate(alteredType),/settings were altered/);
 const alteredPatch=clone(plan);alteredPatch.trials[0].patch['execution.to']='2040-01-01';assert.throws(()=>E.validate(alteredPatch),/queue was altered/);
 const limits=make([{key:'portfolio.daily-limit.enabled',values:[false,true]},{key:'portfolio.daily-limit',values:[1,2]}]);for(const trial of limits.trials){const p=E.fields(E.expected(limits,trial),'portfolio');assert.equal(p[4].checked,trial.patch['portfolio.daily-limit.enabled']);assert.equal(p[5].value,String(trial.patch['portfolio.daily-limit']));assert.equal(p[5].disabled,!p[4].checked);}
 for(const [key,values] of [['portfolio.capital',[0]],['portfolio.max-open',[1.5]],['portfolio.daily-limit',[0]],['portfolio.allocation',['Unsupported']],['execution.rank',['Unknown']]])assert.throws(()=>make([{key,values}]),/valid|source values/);
 // A leader belongs to exact observed conditions, never an aggregate across windows or sizing.
 for(const [key,values,control] of [['execution.from',['2023-01-01','2024-01-01'],'From'],['execution.to',['2025-06-01','2025-12-31'],'To'],['portfolio.allocation',['Fixed','Reinvestment'],'Allocation'],['portfolio.capital',[100000,200000],'Initial capital'],['portfolio.max-open',[5,10],'Maximum open trades'],['portfolio.daily-limit',[1,2],'Daily stock limit'],['portfolio.daily-limit.enabled',[false,true],'Daily stock limit']]){
  const grouped=make([{key,values},{key:'momentum.period.1',values:[126,252]}]),runs=grouped.trials.map(trial=>{trial.status='saved';return D.createTrial(grouped,trial);});grouped.status='complete';
  const decision=E.decisions(grouped,runs);assert.equal(decision.grouped,true);assert.equal(decision.groups.length,2,key);assert.equal(decision.leader,null);assert.deepEqual(decision.leaders,[]);assert.equal(new Set(decision.groups.map(g=>g.controls[control])).size,2);for(const group of decision.groups){assert.equal(group.items.length,2);assert.equal(group.eligible.length,2,JSON.stringify(group.items.map(i=>i.reasons)));assert.ok(group.leader);assert.ok(group.items.every(i=>i.groupKey===group.key));assert.ok(group.neighbors.every(i=>i.groupKey===group.key));}
  const partial=clone(grouped);partial.trials.slice(2).forEach(t=>{t.status='queued';});partial.status='running';const partialDecision=E.decisions(partial,runs.slice(0,2));assert.equal(partialDecision.groups.length,1);assert.equal(partialDecision.grouped,true);assert.equal(partialDecision.leader,null,'Pending unlike scopes cannot produce a universal leader');
 }
 const adaptive=make([{key:'execution.from',values:['2023-01-01','2024-01-01']},{key:'momentum.period.1',values:[126,252]}],{mode:'adaptive'}),adaptiveRuns=adaptive.trials.slice(0,2).map(t=>{t.status='saved';return D.createTrial(adaptive,t);});assert.equal(E.nextTrial(adaptive,adaptiveRuns).id,adaptive.trials[2].id,'Adaptive selection cannot optimize against a cross-scope winner');
 const singletons=make([{key:'execution.from',values:['2023-01-01','2024-01-01']}]),oneRuns=singletons.trials.map(t=>{t.status='saved';return D.createTrial(singletons,t);});assert.ok(E.decisions(singletons,oneRuns).groups.every(g=>g.leader===null&&g.eligible.length===1),'Singleton scopes are visible without claiming a matched winner');
 // Freeze after the latest actually attempted window, including non-candidates.
 const research=make([{key:'execution.to',values:['2025-06-01','2026-03-01','2030-12-31']}]);research.trials[0].status=research.trials[1].status='saved';research.trials[2].status='skipped';research.status='complete';
 assert.equal(E.researchEnd(research),'2026-03-01');assert.throws(()=>E.validation(research,research.trials[0].id,{from:'2026-01-01',to:'2026-12-31'}),/strictly after/,'Later non-candidate discovery windows still reserve their research period');
 const attempted=clone(research);attempted.trials[2].execution={sourceSession:'interrupted',claimedAt:'2026-09-16T08:00:00.000Z'};assert.equal(E.researchEnd(attempted),'2030-12-31');assert.throws(()=>E.validation(attempted,attempted.trials[0].id,{from:'2026-04-01',to:'2026-12-31'}),/strictly after/);
 E.validation(research,research.trials[0].id,{from:'2026-04-01',to:'2026-12-31'});let validation=research.trials.at(-1);assert.equal(E.fields(E.expected(research,validation),'execution')[2].value,'2026-12-31');assert.equal(validation.patch['execution.to'],'2025-06-01','Frozen discovery values remain immutable while the new phase carries its explicit period');E.validate(reordered(research));
 assert.equal(E.restored(research).trials[2].status,'skipped','A genuinely skipped alternative remains skipped when a valid frozen validation plan is imported');
 for(const status of ['queued',...E.active,'uncertain']){const reopened=clone(research);reopened.trials[2].status=status;assert.throws(()=>E.validate(reopened),/preceding trials before a frozen validation/,'An imported validation stage cannot reopen '+status+' discovery alternatives');assert.throws(()=>E.restored(reopened),/preceding trials/);}
 const leaked=clone(research);leaked.trials.at(-1).period.from='2026-01-01';assert.throws(()=>E.validate(leaked),/strictly after all preceding tested dates/,'Imports cannot bypass the all-tested-window boundary');
 validation.status='saved';research.status='complete';assert.throws(()=>E.validation(research,validation.id,{from:'2026-07-01',to:'2027-12-31'},'holdout'),/strictly after/);E.validation(research,validation.id,{from:'2027-01-01',to:'2027-12-31'},'holdout');E.validate(research);assert.equal(E.trialPeriod(research,research.trials.at(-1)).from,'2027-01-01');
 assert.equal(E.restored(research).trials[2].status,'skipped','Untested skipped alternatives do not block a valid frozen holdout import');
 for(const status of ['queued',...E.active,'uncertain']){const reopened=clone(research);reopened.trials.find(t=>t.phase==='validation').status=status;assert.throws(()=>E.validate(reopened),/preceding trials before a frozen holdout/,'An imported holdout stage cannot reopen its preceding validation trial');assert.throws(()=>E.restored(reopened),/preceding trials/);}
 const reopenedDiscovery=clone(research);reopenedDiscovery.trials[2].status='queued';assert.throws(()=>E.validate(reopenedDiscovery),/preceding trials/,'Holdout archives cannot reopen earlier discovery alternatives either');
}
function pairedPeriodTests(){
 const S=require('../dist/setup.js'),template=S.demoTemplate(),baseline=S.configToBaseline(S.defaults(template),template,{id:'paired-base',name:'Paired test periods'}),original=clone(baseline);
 const periods=['2023-01-01/2023-12-31','2024-01-01/2024-12-31','2025-01-01/2025-12-31'],field=E.catalog(baseline).find(f=>f.key==='execution.period');
 assert.deepEqual(field,{key:'execution.period',label:'Test period',stage:'execution',type:'date-range',value:baseline.setup.config['execution.from']+'/'+baseline.setup.config['execution.to']});
 assert.equal(E.catalog(b).some(f=>f.key==='execution.period'),false,'Legacy recorded-baseline scopes remain locked');
 assert.deepEqual(E.dateRange('2024-02-29/2024-03-01'),{from:'2024-02-29',to:'2024-03-01'});
 assert.deepEqual(E.values([periods[0],periods[1],periods[0],periods[2]],field),periods,'Keep paired alternatives in first-seen order without duplicate tests');
 for(const value of [undefined,null,42,{},['2024-01-01','2025-01-01'],'2025-02-29/2025-03-01','2024-2-01/2024-03-01',' 2024-01-01/2025-01-01','2024-01-01/2025-01-01 ','2024-01-01','2024-01-01/2025-01-01/2026-01-01','2024-01-01T00:00:00Z/2025-01-01','2024-01-01/2024-01-01','2025-01-01/2024-01-01']){
  assert.equal(E.dateRange(value),null,'Reject malformed, impossible, same-day or reversed ranges');
  assert.throws(()=>E.values([value],field),/valid date ranges/);
 }
 for(const value of [periods[0],[],Array(101).fill(periods[0])])assert.throws(()=>E.values(value,field),/1–100 valid date ranges/);
 const make=(values=periods,dimensions=[],options={})=>E.create({id:'paired-plan',name:'Paired dates',baseline,dimensions:[{key:'execution.period',values},...dimensions],budget:100,objective:'returns',minTrades:0,...options});
 const paired=make([periods[0],periods[1],periods[0],periods[2]]);
 assert.equal(paired.trials.length,3,'Three complete ranges mean three tests, never nine endpoint combinations');assert.equal(paired.combinationCount,3);E.validate(reordered(paired));
 assert.equal(make([periods[0]]).trials.length,1,'One range means one test');
 for(const trial of paired.trials){
  const period=E.dateRange(trial.patch['execution.period']),expected=E.expected(paired,trial);
  assert.deepEqual(E.trialPeriod(paired,trial),period);assert.equal(E.fields(expected,'execution')[1].value,period.from);assert.equal(E.fields(expected,'execution')[2].value,period.to);
  assert.equal(expected.setup.config['execution.from'],period.from);assert.equal(expected.setup.config['execution.to'],period.to);assert.equal(Object.hasOwn(expected.setup.config,'execution.period'),false,'Only actual source settings reach execution');S.validateBaseline(expected);
 }
 assert.deepEqual(baseline,original,'Applying paired periods never changes the approved baseline');
 assert.equal(make(periods,[{key:'momentum.period.1',values:[126,252]}]).trials.length,6,'Date pairs still combine with independent strategy settings');
 assert.throws(()=>make(periods,[{key:'execution.from',values:['2020-01-01']}]),/complete test periods or separate date settings/);
 assert.throws(()=>make(periods,[{key:'execution.to',values:['2030-01-01']}]),/complete test periods or separate date settings/);
 for(const mode of ['sample','adaptive']){
  const sampled=make(periods,[{key:'momentum.period.1',values:[126,252]}],{mode,budget:3,seed:109});
  assert.deepEqual(sampled.trials,make(periods,[{key:'momentum.period.1',values:[126,252]}],{mode,budget:3,seed:109}).trials);assert.equal(sampled.combinationCount,6);assert.equal(sampled.trials.length,3);E.validate(reordered(sampled));
  assert.throws(()=>make([periods[0],'2025-01-01/2024-01-01'],[],{mode,budget:1}),/valid date ranges/,'Sampling cannot hide an invalid period');
 }
 for(const change of [x=>x.dimensions[0].type='date',x=>x.dimensions[0].index=1,x=>x.dimensions[0].label='Dates',x=>x.dimensions[0].values.reverse(),x=>x.dimensions[0].values.push(periods[0]),x=>x.trials[0].patch['execution.period']=periods[1],x=>x.trials[0].patch['execution.period']='2025-01-01/2024-01-01',x=>x.trials[0].period={from:'2030-01-01',to:'2031-01-01'},x=>x.dimensions.push({...E.catalog(baseline).find(f=>f.key==='execution.from'),values:['2020-01-01']})]){
  const altered=clone(paired);change(altered);assert.throws(()=>E.validate(altered),/altered|Discovery dates|complete test periods|valid date ranges/,'Imported paired periods cannot rewrite their immutable plan');
 }
 const outside=clone(paired.trials[0]);outside.patch['execution.period']='2030-01-01/2031-01-01';assert.throws(()=>E.expected(paired,outside),/approved ranges/);
 // Different periods are separate matched-condition groups, even while other
 // date pairs have not returned. The fast ranking path must expand them too.
 const grouped=make(periods,[{key:'momentum.period.1',values:[126,252]}]),runs=grouped.trials.map(trial=>{trial.status='saved';return D.createTrial(grouped,trial);});grouped.status='complete';
 const decision=E.decisions(grouped,runs);assert.equal(decision.grouped,true);assert.equal(decision.groups.length,3);assert.equal(decision.leader,null);assert.equal(decision.eligible.length,6,JSON.stringify(decision.items.map(i=>i.reasons)));
 assert.equal(new Set(decision.groups.map(g=>g.controls.From+'/'+g.controls.To)).size,3);for(const group of decision.groups)assert.equal(group.items.length,2);
 const partial=clone(grouped);partial.trials.slice(2).forEach(t=>t.status='queued');partial.status='running';const partialDecision=E.decisions(partial,runs.slice(0,2));assert.equal(partialDecision.grouped,true);assert.equal(partialDecision.groups.length,1);assert.equal(partialDecision.leader,null);
 const adaptive=make(periods,[{key:'momentum.period.1',values:[126,252]}],{mode:'adaptive'}),adaptiveRuns=adaptive.trials.slice(0,2).map(t=>{t.status='saved';return D.createTrial(adaptive,t);});assert.equal(E.nextTrial(adaptive,adaptiveRuns).id,adaptive.trials[2].id,'Adaptive runs retain seeded order across unlike periods');
 // Freeze later phases after every attempted discovery period, not merely the
 // chosen candidate's period; untouched skipped alternatives reserve nothing.
 const research=make([periods[0],periods[2],'2030-01-01/2030-12-31']);research.trials[0].status=research.trials[1].status='saved';research.trials[2].status='skipped';research.status='complete';
 assert.equal(E.researchEnd(research),'2025-12-31');assert.throws(()=>E.validation(research,research.trials[0].id,{from:'2024-01-01',to:'2024-12-31'}),/strictly after/);
 const attempted=clone(research);attempted.trials[2].execution={sourceSession:'interrupted',claimedAt:'2026-09-17T08:00:00.000Z'};assert.equal(E.researchEnd(attempted),'2030-12-31');
 E.validation(research,research.trials[0].id,{from:'2026-01-01',to:'2026-12-31'});const validation=research.trials.at(-1);assert.equal(validation.patch['execution.period'],periods[0],'The original paired discovery choice stays frozen');assert.deepEqual(E.trialPeriod(research,validation),{from:'2026-01-01',to:'2026-12-31'});
 assert.equal(E.fields(E.expected(research,validation),'execution')[1].value,'2026-01-01');assert.equal(E.fields(E.expected(research,validation),'execution')[2].value,'2026-12-31');E.validate(reordered(research));
 const leaked=clone(research);leaked.trials.at(-1).period.from='2025-01-01';assert.throws(()=>E.validate(leaked),/strictly after all preceding tested dates/);
 const reopened=clone(research);reopened.trials[2].status='queued';assert.throws(()=>E.validate(reopened),/preceding trials before a frozen validation/);
 validation.status='saved';research.status='complete';assert.equal(E.researchEnd(research,'holdout'),'2026-12-31');assert.throws(()=>E.validation(research,validation.id,{from:'2026-06-01',to:'2027-12-31'},'holdout'),/strictly after/);
 E.validation(research,validation.id,{from:'2027-01-01',to:'2027-12-31'},'holdout');E.validate(research);assert.deepEqual(E.trialPeriod(research,research.trials.at(-1)),{from:'2027-01-01',to:'2027-12-31'});assert.equal(E.fields(E.expected(research,research.trials.at(-1)),'execution')[1].value,'2027-01-01');assert.equal(E.restored(research).trials[2].status,'skipped');
}
function chartVariationTests(){
 const S=require('../dist/setup.js'),L=require('../dist/source-layouts.js');
 for(const momentumChart of L.charts)for(const executionChart of L.charts){
  const template=S.demoTemplate({momentumChart,executionChart}),config=S.defaults(template),baseline=S.configToBaseline(config,template),catalog=E.catalog(baseline),dimensions=[];
  if(momentumChart!=='Candle')dimensions.push({key:'momentum.'+(momentumChart==='P&F'?'box':'brick')+'.size',values:[1,2]},{key:'momentum.strategy.1.input',values:[1,2]},{key:'momentum.signal-mode',values:['34','35']});else dimensions.push({key:'momentum.period.1',values:[126,252]});
  if(executionChart!=='Candle')dimensions.push({key:'execution.'+(executionChart==='P&F'?'box':'brick')+'.size',values:[1,2]});else dimensions.push({key:'execution.stop',values:[6,8]});
  if(momentumChart==='P&F')dimensions.push({key:'momentum.box.reversal',values:['2','3']});if(executionChart==='P&F')dimensions.push({key:'execution.box.reversal',values:['3','5']});
  const plan=E.create({id:'charts-'+L.charts.indexOf(momentumChart)+'-'+L.charts.indexOf(executionChart),name:'Fictional chart settings',baseline,dimensions,budget:100,objective:'returns',minTrades:0});E.validate(reordered(plan));
  for(const trial of plan.trials){const expected=E.expected(plan,trial);S.validateBaseline(expected);for(const dimension of plan.dimensions){const f=E.fields(expected,dimension.stage),value=trial.patch[dimension.key];if(dimension.indices)assert.equal(f[Number(value)].checked,true);else assert.equal(f[dimension.index].value,String(value));}const run=D.createTrial(plan,trial);assert.equal(E.result(plan,trial,run).eligible,true,JSON.stringify(E.result(plan,trial,run).reasons));}
  for(const key of ['momentum.chart','execution.chart','momentum.brick.mode','execution.brick.mode'])assert.equal(catalog.some(f=>f.key===key),false,'Chart and Renko mode contexts do not vary inside a batch');
  if(momentumChart!=='Candle'){assert.equal(catalog.some(f=>f.key==='momentum.strategy.1.timeframe'),false);assert.equal(catalog.find(f=>f.key==='momentum.strategy.1.input').type,'number');assert.throws(()=>E.create({id:'bad-price',name:'Invalid mixed price flags',baseline,dimensions:[{key:'momentum.price.close-only',values:[true,false]}],mode:'sample',budget:1}),/Every combination must choose exactly one/);}
 }
 for(const stage of ['momentum','execution']){const template=S.demoTemplate({momentumChart:'Renko',executionChart:'Renko',momentumBrickMode:'ATR',executionBrickMode:'ATR %'}),baseline=S.configToBaseline(S.defaults(template),template),descriptor=E.catalog(baseline).find(f=>f.key===stage+'.brick.size');assert.equal(descriptor.integer,true);assert.throws(()=>E.create({id:'fractional-atr',name:'ATR must be whole',baseline,dimensions:[{key:descriptor.key,values:[14,14.5]}]}),/whole numbers/);}
}
(async()=>{setupVariationTests();setupCachedCategoryTests();setupContextVariationTests();pairedPeriodTests();chartVariationTests();await coordinatorTests();await deletionTests();await decisionTests();await setupBridgeTests();await ruleSearchBridgeTests();console.log('PASS: independent chart contexts, exact variant trial settings, paired test periods and legacy date variations, matched decisions, frozen forward stages, immutable archives, authorized coordinator operations and guarded study deletion with preserved results.');})().catch(e=>{console.error(e);process.exitCode=1;});
