'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),{PGlite}=require('@electric-sql/pglite');
const {providers}=require('../server/providers.cjs'),{createServer}=require('../server/server.cjs'),Accounts=require('../dist/accounts.js');
const uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const storage=()=>{const data={};return {data,get:async key=>key?{[key]:data[key]}:structuredClone(data),set:async value=>Object.assign(data,structuredClone(value))};};
async function main(){
 const db=new PGlite();let server;
 try{
  await db.exec('create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);');await db.query('insert into auth.users values ($1),($2)',[uid,other]);await db.exec(fs.readFileSync('server/schema.sql','utf8'));await db.exec(fs.readFileSync('server/schema.sql','utf8'));
  const rpc=async(name,args)=>(await db.query('select public.'+name+'('+Object.keys(args).map((k,i)=>k+' => $'+(i+1)).join(',')+') as value',Object.values(args))).rows[0].value;
  await db.exec('set role anon');await assert.rejects(rpc('vault_account',{p_user:uid}),/permission denied/);await db.exec('reset role');
  const env={NODE_ENV:'test',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_ANON_KEY:'fixture-anon',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',RAZORPAY_KEY_ID:'rzp_test_fixture',RAZORPAY_KEY_SECRET:'fixture-secret',RAZORPAY_PLAN_ID:'plan_fixture',RAZORPAY_WEBHOOK_SECRET:'fixture-webhook'};
  let sub={id:'sub_fixture',plan_id:'plan_fixture',quantity:1,status:'created',paid_count:0,current_end:Math.floor(Date.now()/1000)+86400,notes:{vault_user_id:uid},short_url:'https://rzp.io/fixture'},invoices=[],refund=0,creates=0,refreshes=0;const calls=[];
  const remote=async(url,options={})=>{const u=new URL(url),body=options.body?JSON.parse(options.body):undefined;calls.push({path:u.pathname,body});let value;
   if(u.hostname==='fixture.supabase.co'){
    if(u.pathname.startsWith('/rest/v1/rpc/')){try{value=await rpc(u.pathname.split('/').at(-1),body);}catch(e){return Response.json({message:e.message},{status:400});}}
    else if(u.pathname==='/auth/v1/otp')value={};
    else if(u.pathname==='/auth/v1/verify'){if(body.token!=='123456')return Response.json({message:'Invalid code'},{status:401});value={access_token:'access-A',refresh_token:'refresh-A',expires_in:3600};}
    else if(u.pathname==='/auth/v1/token'){refreshes++;value={access_token:'access-A',refresh_token:'refresh-next',expires_in:3600};}
    else if(u.pathname==='/auth/v1/logout')value={};
    else if(u.pathname==='/auth/v1/user'){const t=options.headers.Authorization;if(!['Bearer access-A','Bearer access-B'].includes(t))return Response.json({message:'Invalid session'},{status:401});value={id:t==='Bearer access-A'?uid:other,email:t==='Bearer access-A'?'one@example.test':'two@example.test',email_confirmed_at:new Date().toISOString()};}
   }else if(u.hostname==='api.razorpay.com'){
    if(u.pathname==='/v1/plans/plan_fixture')value={period:'monthly',interval:1,item:{amount:89900,currency:'INR'}};
    else if(u.pathname==='/v1/subscriptions'&&options.method==='POST'){creates++;assert.equal(body.quantity,1);assert.equal(body.notes.vault_user_id,uid);value=sub;}
    else if(u.pathname==='/v1/subscriptions/sub_fixture/cancel'){assert.deepEqual(body,{cancel_at_cycle_end:true});value=sub;}
    else if(u.pathname==='/v1/subscriptions/sub_fixture')value=sub;
    else if(u.pathname==='/v1/invoices')value={items:invoices};
    else if(u.pathname==='/v1/payments/pay_fixture')value={status:'captured',currency:'INR',amount:89900,amount_refunded:refund,invoice_id:'inv_fixture'};
    else if(u.pathname==='/v1/invoices/inv_fixture')value={subscription_id:'sub_fixture'};
   }
   if(value===undefined)throw Error('Unexpected fixture request: '+url);return Response.json(value);
  };
  let serviceTime=Date.now();const provider=providers(env,remote);server=createServer({provider,origins:['chrome-extension://fixture'],clock:()=>serviceTime});await new Promise(r=>server.listen(0,'127.0.0.1',r));const endpoint='http://127.0.0.1:'+server.address().port;
  const network=(url,options)=>fetch(endpoint+new URL(url).pathname,options),session=storage(),local=storage();
  const app=()=>Accounts.create({config:{mode:'account',apiOrigin:'https://accounts.example.test'},session,local,fetch:network});let a=app();
  assert.equal((await a.status()).signedIn,false);await assert.rejects(a.start(1),/Sign in/);await assert.rejects(a.handle({action:'send-code',email:'bad'}),/valid email/);
  await a.handle({action:'send-code',email:'ONE@example.test'});await assert.rejects(a.handle({action:'verify-code',email:'one@example.test',token:'000000'}),/verified/);
  await a.handle({action:'verify-code',email:'one@example.test',token:'123456'});assert.equal((await a.status()).remaining,50);await assert.rejects(a.requireFeature('reuse'),/Pro/);
  for(let i=0;i<49;i++){serviceTime+=5000;await a.reserve('trial-'+i);await a.settle('trial-'+i,'saved');}
  a=app();assert.equal((await a.status()).used,49,'Worker restart cannot reset account quota');
  const final=await Promise.allSettled([a.reserve('last-A'),a.reserve('last-B')]);assert.equal(final.filter(x=>x.status==='fulfilled').length,1,'The 50th slot cannot be spent twice');const last=final[0].status==='fulfilled'?'last-A':'last-B';
  assert.equal((await a.status()).remaining,0);assert.equal((await a.handle({action:'pending'})).length,1);local.data['run:'+last]={id:last};await assert.rejects(a.handle({action:'recover-run',runId:last}),/still in your library/);delete local.data['run:'+last];await a.handle({action:'recover-run',runId:last});assert.equal((await a.status()).remaining,1,'A lost unsaved reservation can be recovered after reinstall');await a.reserve(last);await a.settle(last,'saved');await a.settle(last,'saved');assert.equal((await a.status()).used,50,'Duplicate save acknowledgement is idempotent');await assert.rejects(a.start(1),/free runs/);
  // An anonymous request cannot claim another user's free entitlement.
  assert.equal((await fetch(endpoint+'/runs/reserve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'stolen',userId:uid})})).status,401);
  assert.equal((await fetch(endpoint+'/account',{headers:{Origin:'https://untrusted.example',Authorization:'Bearer access-A'}})).status,403);
  let checkout=await a.handle({action:'upgrade'});assert.equal(checkout.amount,89900);await a.handle({action:'upgrade'});assert.equal(creates,1,'Repeated upgrade clicks reuse the linked subscription');
  const event=Buffer.from(JSON.stringify({event:'subscription.activated',payload:{subscription:{entity:{id:'sub_fixture',status:'active',current_end:9999999999}}}})),signature=crypto.createHmac('sha256',env.RAZORPAY_WEBHOOK_SECRET).update(event).digest('hex');
  await assert.rejects(provider.webhook(event,'0'.repeat(64),'bad'),/signature/);await provider.webhook(event,signature,'same');assert.equal((await a.status()).pro,false,'Browser return and unpaid activation cannot grant Pro');
  sub={...sub,status:'active',paid_count:1};invoices=[{subscription_id:'sub_fixture',status:'paid',currency:'INR',amount_paid:89900,payment_id:'pay_fixture',billing_end:sub.current_end}];
  await provider.webhook(event,signature,'same');await provider.webhook(event,signature,'same');assert.equal((await a.status()).pro,true);await a.requireFeature('reuse');await a.start(500);await a.reserve('paid-trial');await a.settle('paid-trial','saved');assert.equal((await a.status()).used,50,'Pro has no monthly run allowance and does not consume Community runs');
  await a.handle({action:'cancel'});assert.equal((await a.status()).pro,true,'Cancellation preserves paid cycle access');
  const newer=await rpc('vault_billing_claim',{p_subscription:'sub_fixture'}),future=new Date(Date.now()+200000).toISOString();await rpc('vault_subscription',{p_event:'newer',p_subscription:'sub_fixture',p_status:'active',p_until:future,p_user:uid,p_revision:newer.revision});await rpc('vault_subscription',{p_event:'older',p_subscription:'sub_fixture',p_status:'expired',p_until:null,p_user:uid,p_revision:newer.revision-1});assert.equal((await a.status()).pro,true,'An older concurrent provider read cannot overwrite a newer snapshot');
  refund=89900;const paymentEvent=Buffer.from(JSON.stringify({event:'payment.refunded',payload:{payment:{entity:{id:'pay_fixture'}}}})),paymentSignature=crypto.createHmac('sha256',env.RAZORPAY_WEBHOOK_SECRET).update(paymentEvent).digest('hex');await provider.webhook(paymentEvent,paymentSignature,'refund');assert.equal((await a.status()).pro,false,'A payment-only refund resolves its invoice and removes unfunded Pro');refund=0;invoices[0].billing_end=Math.floor(Date.now()/1000)-10;await provider.webhook(event,signature,'expired');assert.equal((await a.status()).pro,false,'An expired funded billing period does not unlock Pro');
  const stale=session.data['vault:account:session'];stale.expires_at=1;await Promise.all([a.status(),a.status()]);assert.equal(refreshes,1,'Rotating refresh tokens are refreshed once for concurrent requests');
  await a.handle({action:'sign-out'});assert.equal((await a.status()).signedIn,false);assert.ok(!JSON.stringify(local.data).includes('access-A'));assert.ok(!JSON.stringify(local.data).includes('refresh-A'));
  await a.handle({action:'verify-code',email:'one@example.test',token:'123456'});assert.equal((await a.status()).used,50,'Fresh login and cleared client installation still use the server count');
  assert.throws(()=>providers({...env,NODE_ENV:'production'},remote),/live Razorpay/);
  // Supabase Community access must not depend on merchant approval or payment keys.
  const communityEnv={NODE_ENV:'production',SUPABASE_URL:env.SUPABASE_URL,SUPABASE_ANON_KEY:env.SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:env.SUPABASE_SERVICE_ROLE_KEY};
  const community=providers(communityEnv,remote),beforeBilling=calls.length;
  await community.sendCode('two@example.test');await community.verify('two@example.test','123456');
  assert.equal((await community.user('access-B')).id,other);
  assert.equal((await community.account({id:other,email:'two@example.test'})).remaining,50);
  await community.reserve({id:other},'community-only');await community.settle({id:other},'community-only','released');
  assert.equal((await community.account({id:other})).remaining,50);
  await community.refreshBilling({id:other});
  for(const action of [()=>community.checkout({id:other}),()=>community.cancel({id:other}),()=>community.webhook(Buffer.from('{}'),'','test'),()=>community.refreshBilling({id:uid})])await assert.rejects(action(),/checkout is not available/);
  assert.ok(!calls.slice(beforeBilling).some(c=>c.path.startsWith('/v1/')),'Community-only mode makes no payment-provider requests');
  assert.throws(()=>providers({...communityEnv,RAZORPAY_KEY_ID:'rzp_live_partial'},remote),/Missing server setting: RAZORPAY_KEY_SECRET/,'Partial billing configuration fails closed');
  await coordinatorChecks();await senderChecks();console.log('PASS: actual PostgreSQL migrations/RLS/functions, account HTTP flow, atomic 50-run quota, failed-run release, paid unlimited runs, subscription checkout ownership, signed/replayed webhooks, refund/expiry access, session refresh, and queue integration.');
 }finally{if(server)await new Promise(r=>server.close(r));await db.close();}
}
async function coordinatorChecks(){
 const E=require('../dist/experiments.js'),D=require('../dist/demo.js'),{createCoordinator}=require('../dist/experiment-coordinator.js'),local=storage(),runtime={id:'fixture',getURL:p=>'chrome-extension://fixture/'+p},dashboard={id:'fixture',url:runtime.getURL('index.html')},source={id:'fixture',url:'https://zone.definedgesecurities.com/index.html#research',tab:{id:1},frameId:0};
 const baseline=E.baseline(D.create()[0]);baseline.demo=false;const plan={name:'Account queue',baseline,dimensions:[{key:'momentum.period.1',values:[126,252]}]};let id=0,denied=false,settlements=0;const account={enabled:true,start:async()=>{if(denied)throw Error('Sign in');},reserve:async runId=>{if(denied)throw Error('quota exhausted');local.data['billing:trial:'+runId]={runId,status:'reserved'};},settle:async(runId,outcome)=>{assert.ok(local.data['run:'+runId],'Only a durable result is charged');settlements++;}};
 const c=createCoordinator({storage:local,runtime,clock:()=>100000,uuid:()=> 'exp-'+(++id),account});await c.handle({action:'hello',session:'session',ready:true},source);const e=(await c.handle({action:'create',plan},dashboard)).experiment;
 denied=true;await assert.rejects(c.handle({action:'start',id:e.id,tabId:1},dashboard),/Sign in/);assert.equal(local.data['experiment:'+e.id].status,'draft');denied=false;await c.handle({action:'start',id:e.id,tabId:1},dashboard);denied=true;await assert.rejects(c.handle({action:'claim',id:e.id,session:'session'},source),/quota/);assert.equal(local.data['experiment:'+e.id].status,'paused');assert.equal(local.data['runner:lease'],undefined,'Quota failure cannot claim or submit a source test');
 denied=false;await c.handle({action:'start',id:e.id,tabId:1},dashboard);const claimed=await c.handle({action:'claim',id:e.id,session:'session'},source);const trial=claimed.trial,run=structuredClone(D.create()[0]);run.demo=false;run.provenance='recorded-at-submit';run.id=trial.runId;run.parameters=E.expected(claimed.experiment,trial).parameters;run.experiment={id:e.id,trialId:trial.id,phase:trial.phase};run.charts=Array.from({length:6},()=>run.charts[0]);const at=new Date(100100).toISOString(),s=run.parameters.strategy;Object.assign(s,{id:trial.id+'-strategy',at,started:true,startedAt:at,completed:true,completedAt:at});Object.assign(run.parameters,{id:trial.id+'-portfolio',at,reportOpenedAt:at});run.savedAt=at;run.experiment.evidence={version:1,sourceSession:'session',strategySubmissionId:s.id,strategySubmittedAt:at,strategyStartedAt:at,strategyCompletedAt:at,portfolioSubmissionId:run.parameters.id,portfolioSubmittedAt:at,reportOpenedAt:at,capturedAt:at};
 const owned=local.data['experiment:'+e.id];owned.trials[0].status='capturing';const message={action:'checkpoint',id:e.id,trialId:trial.id,session:'session',token:claimed.token,stage:'saved'};await assert.rejects(c.handle(message,source),/durable capture/);assert.equal(settlements,0);local.data['run:'+run.id]=run;await c.handle(message,source);assert.equal(settlements,1);assert.equal(local.data['experiment:'+e.id].trials[0].status,'saved');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
async function senderChecks(){const vm=require('node:vm'),listeners=[];let requests=0;const ctx={importScripts:()=>{},VaultAccounts:{create:()=>({handle:async()=>{requests++;return {};}})},VaultExperimentCoordinator:{createCoordinator:()=>({handle:async()=>({ok:true})})},chrome:{storage:{local:{}},runtime:{id:'fixture',getURL:p=>'chrome-extension://fixture/'+p,onMessage:{addListener:fn=>listeners.push(fn)}},action:{onClicked:{addListener:()=>{}}},tabs:{}},URL};vm.runInNewContext(fs.readFileSync('dist/background.js','utf8'),ctx);const dispatch=(sender)=>new Promise(resolve=>listeners[0]({type:'vault-account',action:'status'},sender,resolve));assert.equal((await dispatch({id:'fixture',tab:{id:1},url:'https://zone.definedgesecurities.com/'})).ok,false);assert.equal((await dispatch({id:'other',url:'chrome-extension://fixture/index.html'})).ok,false);assert.equal((await dispatch({id:'fixture',url:'chrome-extension://fixture/index.html?view=studies'})).ok,true);assert.equal(requests,1,'Source tabs and other extensions cannot read account sessions');}
