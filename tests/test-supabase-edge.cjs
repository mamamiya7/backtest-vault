'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os');
const {createEdgeHandler}=require('../server/edge-adapter.cjs'),{build}=require('../scripts/build-supabase-function.cjs'),Accounts=require('../dist/accounts.js'),{configure}=require('../scripts/configure-accounts.cjs'),{remote}=require('../scripts/launch-preflight.cjs');
async function main(){
 const origin='chrome-extension://'+'a'.repeat(32),base='https://fixture.supabase.co/functions/v1/vault-accounts';let emails=0,raw;
 const session={access_token:'access',refresh_token:'refresh',expires_at:Math.floor(Date.now()/1000)+3600};
 const provider={sendCode:async()=>{emails++;return {sent:true};},verify:async()=>session,user:async token=>{if(token!=='access')throw Object.assign(Error('bad token'),{status:401});return {id:'verified-user'};},account:async u=>({userId:u.id,used:0,remaining:50}),reserve:async(u,id)=>({userId:u.id,runId:id,status:'reserved'}),webhook:async bytes=>{raw=bytes;return {ok:true};}};
 const paused=createEdgeHandler({provider,origins:[origin]});
 assert.deepEqual(await (await paused(new Request(base+'/health'))).json(),{ok:true,ready:false});
 assert.equal((await paused(new Request(base+'/auth/otp',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{"email":"one@example.test"}'}))).status,503);assert.equal(emails,0,'Unconfigured deployment must not send email');
 const handle=createEdgeHandler({provider,origins:[origin],ready:true});
 const request=(route,{method='GET',body,headers={}}={})=>handle(new Request(base+route,{method,headers:{Origin:origin,...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})}));
 assert.equal((await request('/account')).status,401);
 assert.equal((await request('/account',{headers:{Origin:'https://untrusted.example'}})).status,403);
 assert.equal((await request('/account',{headers:{Authorization:'Bearer wrong'}})).status,401);
 assert.equal((await request('/auth/otp',{method:'POST',body:{email:'one@example.test'}})).status,200);
 assert.equal((await request('/auth/verify',{method:'POST',body:{email:'one@example.test',token:'12345678'}})).status,200);
 assert.equal((await request('/runs/reserve',{method:'POST',headers:{Authorization:'Bearer access'},body:{runId:'trial',userId:'forged'}})).status,200);
 const body=' { "raw": "unchanged" }\n';assert.equal((await request('/billing/webhook',{method:'POST',body})).status,200);assert.equal(raw.toString(),body,'Webhook signing bytes must not be normalised');
 assert.equal((await request('/billing/webhook',{method:'POST',body:'x'.repeat(65537)})).status,413);
 assert.equal((await request('/auth/otp',{method:'POST',body:'{'})).status,503);
 const preflight=await request('/account',{method:'OPTIONS'});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
 assert.equal((await handle(new Request('https://fixture.supabase.co/vault-accounts/health'))).status,200);
 assert.equal((await handle(new Request('https://fixture.supabase.co/wrong/health'))).status,404);
 const data={};const storage={get:async k=>({[k]:data[k]}),set:async v=>Object.assign(data,v)};
 const app=Accounts.create({config:{mode:'account',apiOrigin:'https://fixture.supabase.co',apiPath:'/functions/v1/vault-accounts'},session:storage,local:storage,fetch:(url,options)=>{assert(url.startsWith(base+'/'));return handle(new Request(url,{...options,headers:{...options.headers,Origin:origin}}));}});
 assert.equal((await app.handle({action:'verify-code',email:'one@example.test',token:'12345678'})).remaining,50);
 for(const apiPath of ['/functions/v1/../secret','//other.example','/rest/v1/vault_accounts']){const bad=Accounts.create({config:{mode:'account',apiOrigin:'https://fixture.supabase.co',apiPath},session:storage,local:storage});await assert.rejects(bad.status(),/Invalid account service configuration/);}
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'vault-edge-'));try{fs.mkdirSync(path.join(temp,'dist'));fs.writeFileSync(path.join(temp,'dist/manifest.json'),'{"content_security_policy":{}}');configure(base,temp);const config={};vm.runInNewContext(fs.readFileSync(path.join(temp,'dist/commercial-config.js'),'utf8'),config);assert.equal(config.VaultCommercialConfig.apiPath,'/functions/v1/vault-accounts');const manifest=JSON.parse(fs.readFileSync(path.join(temp,'dist/manifest.json')));assert.deepEqual(manifest.host_permissions,['https://fixture.supabase.co/*']);assert(!JSON.stringify(config).includes('secret'));assert.throws(()=>configure('https://untrusted.example/functions/v1/vault-accounts',temp));}finally{fs.rmSync(temp,{recursive:true,force:true});}
 const checks=await remote({SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_ANON_KEY:'fixture',SUPABASE_SERVICE_ROLE_KEY:'fixture'},{communityOnly:true,origin:base,request:(url,options)=>url.startsWith(base)?paused(new Request(url,options)):Promise.resolve(new Response(url.includes('/settings')?'{"external":{"email":true}}':'[]'))});assert.equal(checks.find(c=>c.name==='Hosted API health').ok,false,'Paused service is not public-launch ready');
 const source=build();assert.equal(source,fs.readFileSync(path.join(__dirname,'../supabase/functions/vault-accounts/index.ts'),'utf8'),'Generated source must match shared handler');assert(!/\brequire\(|module\.exports|http\.createServer/.test(source));
 // Execute the exact generated deployment module with only public/closed settings.
 let deployed;const originalFetch=globalThis.fetch;globalThis.Deno={env:{toObject:()=>({})},serve:handler=>{deployed=handler;}};try{
  await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));assert.deepEqual(await (await deployed(new Request(base+'/health'))).json(),{ok:true,ready:false});
  const settings={PUBLIC_EMAIL_READY:'true',ALLOWED_ORIGINS:origin,SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_ANON_KEY:'fixture-anon',SUPABASE_SERVICE_ROLE_KEY:'fixture-service'};
  globalThis.Deno.env.toObject=()=>({...settings});let rpcArgs;
  globalThis.fetch=async(url,options)=>{if(url.endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:'verified-user',email:'one@example.test',email_confirmed_at:new Date().toISOString()}));if(url.endsWith('/rest/v1/rpc/vault_account')){rpcArgs=JSON.parse(options.body);return new Response(JSON.stringify({userId:'verified-user',remaining:50}));}throw Error('Unexpected provider request');};
  await import('data:text/javascript;base64,'+Buffer.from(source+'\n// configured test').toString('base64'));assert.equal((await (await deployed(new Request(base+'/health'))).json()).ready,true);
  const account=await deployed(new Request(base+'/account',{headers:{Origin:origin,Authorization:'Bearer access'}}));assert.equal(account.status,200);assert.equal((await account.json()).remaining,50);assert.deepEqual(rpcArgs,{p_user:'verified-user'},'Generated module uses verified identity for its service-only RPC');
  globalThis.Deno.env.toObject=()=>({...settings,ALLOWED_ORIGINS:'*'});await assert.rejects(import('data:text/javascript;base64,'+Buffer.from(source+'\n// wildcard test').toString('base64')),/exact Chrome extension origins/);
 }finally{delete globalThis.Deno;globalThis.fetch=originalFetch;}
 console.log('PASS: shared Edge handler, closed deployment, authenticated ownership, exact function paths/origins, raw webhook bytes, body limit, CORS, client configuration and launch-readiness gate.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
