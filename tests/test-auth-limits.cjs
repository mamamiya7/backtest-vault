'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const {providers}=require('../server/providers.cjs');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
async function main(){
 const db=new PGlite();
 try{
  await db.exec('create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);');
  const schema=fs.readFileSync('server/schema.sql','utf8');await db.exec(schema);await db.exec(schema);
  const attempt=async(key,action='send',budget=80)=>(await db.query('select public.vault_auth_attempt($1,$2,$3) as value',[key,action,budget])).rows[0].value;
  for(const role of ['anon','authenticated']){
   await db.exec('set role '+role);await assert.rejects(attempt(hash('forbidden')),/permission denied/);
   await assert.rejects(db.query('select * from vault_auth_limits'),/permission denied/);await db.exec('reset role');
  }
  assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.vault_auth_limits'::regclass")).rows[0].relrowsecurity,true);
  await db.exec('set role service_role');assert.equal((await attempt(hash('service-only'))).allowed,true);await db.exec('reset role');
  assert.equal((await attempt(hash('service-only'))).allowed,false,'A fresh caller cannot bypass an existing bucket');
  await assert.rejects(attempt('plain@example.test'),/Invalid authentication budget/);
  await assert.rejects(attempt(hash('invalid'),'send',0),/Invalid authentication budget/);
  await assert.rejects(attempt(hash('invalid'),'other'),/Invalid authentication budget/);
  await db.exec('truncate vault_auth_limits');
  const first=await attempt(hash('same-email'));assert.equal(first.allowed,true);
  const blocked=await attempt(hash('same-email'));assert.equal(blocked.allowed,false);assert.ok(blocked.retryAfter>=1&&blocked.retryAfter<=60);
  const globalCount=await db.query("select attempts from vault_auth_limits where policy='send-global'");assert.equal(globalCount.rows[0].attempts,1,'Blocked email attempts do not spend the global email allowance');
  // Simulate a previously spent day, without relying on a test sleep or clock boundary.
  await db.query("update vault_auth_limits set attempts=5 where policy='send-day'");
  await db.query("delete from vault_auth_limits where policy='send-short'");
  assert.equal((await attempt(hash('same-email'))).allowed,false,'Daily email limits survive the minute boundary');
  assert.equal((await db.query("select attempts from vault_auth_limits where policy='send-global'")).rows[0].attempts,1);
  await db.exec('truncate vault_auth_limits');
  const results=await Promise.all(Array.from({length:8},(_,i)=>attempt(hash('different-'+i),'send',3)));
  assert.equal(results.filter(x=>x.allowed).length,3,'Independent callers share one global budget');
  assert.equal((await db.query('select count(distinct subject_hash)::int as n from vault_auth_limits')).rows[0].n,4,'After exhaustion, no attacker-selected email buckets are created');
  assert.equal((await attempt(hash('verification'),'verify')).allowed,true,'Verification uses a separate budget from sends');
  await db.query("update vault_auth_limits set attempts=10 where policy='verify-short'");
  assert.equal((await attempt(hash('verification'),'verify')).allowed,false);
  await db.query("insert into vault_auth_limits values('expired',$1,now()-interval '4 days',now()-interval '3 days',0)",[hash('expired')]);
  await attempt(hash('cleanup'),'verify');assert.equal((await db.query("select count(*)::int as n from vault_auth_limits where policy='expired'")).rows[0].n,0,'Old buckets are pruned');
  // Run the real provider implementation through separate instances sharing the SQL limiter.
  await db.exec('truncate vault_auth_limits');let mailCalls=0,verificationCalls=0;const stored=[];
  const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_ANON_KEY:'fixture-anon',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',AUTH_EMAIL_DAILY_LIMIT:'2'};
  const request=async(url,options)=>{
   const body=JSON.parse(options.body);
   if(url.endsWith('/rest/v1/rpc/vault_auth_attempt')){
    assert.match(body.p_email_hash,/^[a-f0-9]{64}$/);assert(!JSON.stringify(body).includes('@'),'No raw email stored in limit RPC');stored.push(body);
    return Response.json(await attempt(body.p_email_hash,body.p_action,body.p_daily_budget));
   }
   if(url.endsWith('/auth/v1/otp')){mailCalls++;return Response.json({});}
   if(url.endsWith('/auth/v1/verify')){verificationCalls++;return Response.json({access_token:'fixture',refresh_token:'fixture-refresh',expires_in:3600});}
   throw Error('Unexpected request');
  };
  await providers(env,request).sendCode('ONE@example.test');
  await assert.rejects(providers(env,request).sendCode('one@example.test'),e=>e.status===429);
  await providers(env,request).sendCode('two@example.test');
  await assert.rejects(providers(env,request).sendCode('three@example.test'),e=>e.status===429);assert.equal(mailCalls,2);
  await providers(env,request).verify('ONE@example.test','123456');assert.equal(verificationCalls,1);
  assert.equal(stored[0].p_email_hash,stored[1].p_email_hash,'Case variants share one keyed email identity');
  let outgoing=0;const unavailable=providers(env,async(url)=>{if(url.includes('/rpc/'))throw Error('Database unavailable');outgoing++;return Response.json({});});
  await assert.rejects(unavailable.sendCode('fail@example.test'),/Database unavailable/);assert.equal(outgoing,0,'Limiter failure must never send email');
  assert.throws(()=>providers({...env,AUTH_EMAIL_DAILY_LIMIT:'0'},request),/AUTH_EMAIL_DAILY_LIMIT/);
  assert.throws(()=>providers({...env,AUTH_EMAIL_DAILY_LIMIT:'not-a-number'},request),/AUTH_EMAIL_DAILY_LIMIT/);
  console.log('PASS: service-only/RLS auth budgets, shared instance limits, privacy, email/global/verification rejection, expired bucket cleanup and fail-closed mail delivery.');
 }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
