/* Local pilot licensing. No strategy data, passwords or payment details leave Vault. */
(function(root){
'use strict';
const features=['protocols','sensitivity','reports'];
const plans={community:{name:'Community',features:['50 successful automatic runs per verified account','Candle, P&F and Renko setup and test values','Saved history and basic comparisons','Backup, restore and existing exports']},pro:{name:'Pro · ₹899/month',features:['Continued automation without a Vault run quota','Reuse saved settings to start another study','Versioned reusable research plans','Sensitivity maps for tested settings','Evidence-linked research reports']}};
function decode(value){if(typeof value!=='string'||value.length>24000||!/^[A-Za-z0-9_-]+$/.test(value))throw Error('Invalid license file.');return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),x=>x.charCodeAt(0));}
async function verify(envelope,{keys=root.VaultLicenseKeys||{},now=Date.now(),crypto=root.crypto}={}){
 if(!envelope||envelope.format!=='backtest-vault-license'||envelope.version!==1||typeof envelope.keyId!=='string'||!Object.hasOwn(keys,envelope.keyId))throw Error('This license was not issued for this Vault release.');
 const bytes=decode(envelope.payload),signature=decode(envelope.signature);
 const key=await crypto.subtle.importKey('jwk',keys[envelope.keyId],{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
 if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,signature,bytes))throw Error('The license signature is invalid.');
 const p=JSON.parse(new TextDecoder().decode(bytes)),start=Date.parse(p.startsAt),end=Date.parse(p.expiresAt);
 if(p.product!=='backtest-vault'||p.edition!=='pro'||typeof p.id!=='string'||p.id.length>120||typeof p.issuedTo!=='string'||!p.issuedTo.trim()||p.issuedTo.length>160||!['evaluation','pilot'].includes(p.kind)||!Number.isFinite(start)||!Number.isFinite(end)||end<=start||!Array.isArray(p.features)||p.features.length!==features.length||new Set(p.features).size!==features.length||p.features.some(x=>!features.includes(x)))throw Error('The license details are invalid.');
 const active=now>=start&&now<end;
 return {edition:active?'pro':'community',active,reason:now<start?'not-started':now>=end?'expired':'active',license:p};
}
// Separate namespace: license files are excluded from research backups.
function client({demo=false,chromeStore=root.chrome?.storage?.local,local=root.localStorage,keys=root.VaultLicenseKeys||{},clock=()=>Date.now()}={}){
 if(!demo&&root.VaultAccountUI?.enabled())return {
  status:async()=>{const s=await root.VaultAccountUI.command('status');return {...s,edition:s.pro?'pro':'community',active:s.pro===true,reason:s.signedIn?'account':'signed-out'};},
  requireFeature:feature=>root.VaultAccountUI.requireFeature(feature),
  activate:async()=>{throw Error('Sign in to activate your paid subscription.');},remove:()=>root.VaultAccountUI.command('sign-out')
 };
 let memory=null;const key='vault:license:v1';
 async function read(){if(demo)return memory;return chromeStore?(await chromeStore.get(key))[key]||null:JSON.parse(local.getItem(key)||'null');}
 async function write(value){if(demo){memory=value;return;}if(chromeStore)return chromeStore.set({[key]:value});local.setItem(key,JSON.stringify(value));}
 async function status(){try{const data=await read();if(!data)return {edition:'community',active:false,reason:'none'};return await verify(data,{keys,now:clock()});}catch{return {edition:'community',active:false,reason:'invalid'};}}
 async function activate(data){const result=await verify(data,{keys,now:clock()});if(!result.active)throw Error(result.reason==='expired'?'This license has expired. Your saved work remains available.':'This license is not active yet.');await write(data);return result;}
 async function requireFeature(feature){if(!features.includes(feature)||!(await status()).active)throw Error('This tool needs an active Pro license. Your Community tools and saved work remain available.');}
 return {status,activate,requireFeature,remove:()=>write(null)};
}
const api={features,plans,verify,client};if(typeof module!=='undefined')module.exports=api;root.VaultEditions=api;
})(typeof window!=='undefined'?window:globalThis);
