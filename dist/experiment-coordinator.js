/* Durable single-owner queue; never retry an uncertain source submission. */
(function(root){
'use strict';
const E=typeof module!=='undefined'?require('./experiments.js'):root.VaultExperiments;
const V=typeof module!=='undefined'?require('./core.js'):root.Vault;
function createCoordinator({storage,runtime,clock=()=>Date.now(),uuid=()=>crypto.randomUUID()}){
 let serial=Promise.resolve();
 const get=async k=>(await storage.get(k))[k];
 const put=e=>storage.set({['experiment:'+e.id]:e});
 const collection=async prefix=>Object.entries(await storage.get(null)).filter(([k])=>k.startsWith(prefix)).map(([,v])=>v);
 async function reviewLease(){
  const l=await get('runner:lease');if(!l||clock()-l.seenAt<90000)return l;
  const e=await get('experiment:'+l.experimentId),t=e?.trials.find(t=>t.id===l.trialId);
  if(t&&E.active.includes(t.status)){t.status='uncertain';t.error='Source tab stopped responding. Check for a saved report before skipping.';e.status='needs-review';E.journal(e,t.error);await put(e);}
  return l;
 }
 function validateCapture(e,t,r){
  if(!r||r.experiment?.id!==e.id||r.experiment?.trialId!==t.id||r.provenance!=='recorded-at-submit')throw Error('A matching durable capture has not been saved.');
  V.validate(r);if(r.charts.length!==6||r.trades.rows.length!==V.metrics(r).trades)throw Error('The saved report is incomplete.');
  for(const s of ['momentum','execution','portfolio'])E.verify(E.fields(E.expected(e,t),s),E.fields(r,s));
 }
 async function execute(m,sender){
  const source=sender.id===runtime.id&&sender.tab&&new URL(sender.url||'https://invalid/').origin==='https://zone.definedgesecurities.com';
  const url=runtime.getURL('index.html'),dashboard=sender.id===runtime.id&&(sender.url===url||sender.url?.startsWith(url+'?'));
  if(!source&&!dashboard)throw Error('This page cannot control experiments.');
  if(source&&m.action==='hello'){
   if(typeof m.session!=='string'||m.session.length>80)throw Error('Invalid source session.');
   await storage.set({['runner:tab:'+sender.tab.id]:{id:sender.tab.id,session:m.session,seenAt:clock(),ready:m.ready===true,chart:String(m.chart||'').slice(0,30)}});
   const l=await get('runner:lease');if(l?.tabId===sender.tab.id&&l.session===m.session&&!m.failed){l.seenAt=clock();await storage.set({'runner:lease':l});}
   const mine=(await collection('experiment:')).find(e=>e.status==='running'&&e.owner?.tabId===sender.tab.id&&e.owner.session===m.session);
   return {ok:true,id:mine?.id||null};
  }
  if(dashboard&&m.action==='list'){
   await reviewLease();return {ok:true,experiments:await collection('experiment:'),tabs:(await collection('runner:tab:')).filter(v=>clock()-v.seenAt<15000)};
  }
  if(dashboard&&m.action==='create'){
   const e=E.create({...m.plan,id:uuid()});if(e.demo)throw Error('Fictional experiments cannot control RZone.');
   if(await get('experiment:'+e.id))throw Error('Experiment ID already exists.');await put(e);return {ok:true,experiment:e};
  }
  const e=await get('experiment:'+m.id);if(!e)throw Error('Experiment not found.');E.validate(e);
  if(dashboard){
   if(m.action==='start'){
    if(await reviewLease())throw Error('A trial still owns the source tab. Finish or review it first.');
    if((await collection('experiment:')).some(x=>x.id!==e.id&&['running','pausing'].includes(x.status)))throw Error('Another experiment is running.');
    if(!['draft','paused'].includes(e.status)||e.trials.some(t=>t.status==='uncertain'))throw Error('Review interrupted trials before resuming.');
    const tab=await get('runner:tab:'+m.tabId);if(!tab?.ready||clock()-tab.seenAt>15000)throw Error('Open RZone Momentum BackTesting with the updated extension, then select its tab.');
    if(e.demo||!e.trials.some(t=>t.status==='queued'))throw Error('There are no queued real trials.');
    if(E.fields(e.baseline,'momentum')[0].value!=='Candle'||E.fields(e.baseline,'execution')[3].value!=='Candle')throw Error('P&F and Renko plans can be saved; live execution is waiting for separate adapter acceptance tests.');
    e.owner={tabId:tab.id,session:tab.session};e.status='running';E.journal(e,'Started on selected RZone tab');await put(e);return {ok:true};
   }
   if(m.action==='pause'){if(['running','pausing'].includes(e.status)){e.status=(await get('runner:lease'))?.experimentId===e.id?'pausing':'paused';E.journal(e,'Stop after current trial requested');await put(e);}return {ok:true};}
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
   const evidence=e.mode==='adaptive'?(await Promise.all(e.trials.filter(t=>t.phase==='discovery'&&t.status==='saved').map(t=>get('run:'+t.runId)))).filter(Boolean):[];const t=E.nextTrial(e,evidence);if(!t){e.status='complete';delete e.owner;E.journal(e,'Stage complete');await put(e);return {ok:true,trial:null};}
   const token=uuid();E.transition(e,t,'applying');await storage.set({['experiment:'+e.id]:e,'runner:lease':{experimentId:e.id,trialId:t.id,token,tabId:sender.tab.id,session:m.session,seenAt:clock()}});
   return {ok:true,experiment:e,trial:t,token};
  }
  const l=await get('runner:lease'),t=e.trials.find(t=>t.id===m.trialId);
  if(!l||l.experimentId!==e.id||l.trialId!==t?.id||l.token!==m.token||l.session!==m.session)throw Error('Trial ownership changed. Stop and review.');
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
