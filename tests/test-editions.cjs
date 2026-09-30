const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const E=require('../dist/editions.js'),issuer=require('../scripts/issue-license.cjs');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'vault-license-test-'));
(async()=>{
 const {kid}=issuer.init(directory),secret=JSON.parse(fs.readFileSync(path.join(directory,'issuer-private.json'))),pub=crypto.createPublicKey(crypto.createPrivateKey({key:secret.key,format:'jwk'})).export({format:'jwk'}),keys={[kid]:pub},now=Date.parse('2026-09-26T00:00:00Z'),output=path.join(directory,'license.json');
 const signed=issuer.issue({keyFile:path.join(directory,'issuer-private.json'),issuedTo:'Test buyer',days:30,now,output});
 assert.equal((await E.verify(signed,{keys,now})).active,true);
 assert.equal((await E.verify(signed,{keys,now:now+30*86400000})).reason,'expired');assert.equal((await E.verify(signed,{keys,now:now-1})).active,false);
 const tampered=structuredClone(signed),payload=JSON.parse(Buffer.from(tampered.payload,'base64url'));payload.expiresAt='2099-01-01';tampered.payload=Buffer.from(JSON.stringify(payload)).toString('base64url');await assert.rejects(E.verify(tampered,{keys,now}),/signature/);await assert.rejects(E.verify(signed,{keys:{},now}),/not issued/);
 let time=now,memory={};const local={get:async key=>({[key]:memory[key]}),set:async data=>Object.assign(memory,data)},client=E.client({chromeStore:local,keys,clock:()=>time});
 await assert.rejects(client.requireFeature('reports'),/active Pro/);await client.activate(signed);await client.requireFeature('reports');await assert.rejects(client.requireFeature('trading'),/active Pro/);
 const restarted=E.client({chromeStore:local,keys,clock:()=>time});assert.equal((await restarted.status()).edition,'pro');time+=31*86400000;await assert.rejects(restarted.requireFeature('protocols'),/active Pro/);assert.equal((await restarted.status()).edition,'community');
 const demo=E.client({demo:true,keys,clock:()=>now,chromeStore:{get:()=>{throw Error('demo storage leak');},set:()=>{throw Error('demo storage leak');}}});await demo.activate(signed);assert.equal((await demo.status()).active,true);await demo.remove();assert.equal((await demo.status()).active,false);
 assert.throws(()=>issuer.init(path.resolve(__dirname,'../bad-private-issuer')),/outside/);
 assert.equal(Object.hasOwn(pub,'d'),false);assert.ok(E.plans.community.features.some(x=>x.includes('50 successful')));assert.ok(E.plans.pro.features.some(x=>x.includes('Reuse saved settings')));
 console.log('PASS: signed license validation, forgery rejection, expiry, persistent restart, demo isolation and external issuer keys.');
})().catch(e=>{console.error(e);process.exitCode=1;});
