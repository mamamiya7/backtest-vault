/* Run only on the issuer's machine. Private keys never belong in an extension or repository. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function init(directory){
 const repo=path.resolve(__dirname,'..'),dir=path.resolve(directory);if(dir===repo||dir.startsWith(repo+path.sep))throw Error('Keep issuer keys outside this repository.');fs.mkdirSync(dir,{recursive:true});
 const pair=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'}),kid='pilot-'+crypto.randomBytes(8).toString('hex'),publicKey=pair.publicKey.export({format:'jwk'});
 fs.writeFileSync(path.join(dir,'issuer-private.json'),JSON.stringify({kid,key:pair.privateKey.export({format:'jwk'})},null,2),{flag:'wx',mode:0o600});
 fs.writeFileSync(path.join(dir,'license-keys.js'),'/* Public verification keys only. */\nwindow.VaultLicenseKeys=Object.freeze('+JSON.stringify({[kid]:publicKey})+');\n',{flag:'wx'});
 return {kid,publicFile:path.join(dir,'license-keys.js')};
}
function issue({keyFile,issuedTo,days=30,kind='pilot',now=Date.now(),output}){
 if(typeof issuedTo!=='string'||!issuedTo.trim()||issuedTo.length>160||!Number.isInteger(days)||days<1||days>366||!['pilot','evaluation'].includes(kind))throw Error('Supply a recipient, 1–366 days, and pilot or evaluation kind.');
 const issuer=JSON.parse(fs.readFileSync(keyFile)),p={product:'backtest-vault',edition:'pro',id:crypto.randomUUID(),issuedTo:issuedTo.trim(),kind,startsAt:new Date(now).toISOString(),expiresAt:new Date(now+days*86400000).toISOString(),features:['protocols','sensitivity','reports']},payload=Buffer.from(JSON.stringify(p));
 const signature=crypto.sign('sha256',payload,{key:crypto.createPrivateKey({key:issuer.key,format:'jwk'}),dsaEncoding:'ieee-p1363'}).toString('base64url');
 const envelope={format:'backtest-vault-license',version:1,keyId:issuer.kid,payload:payload.toString('base64url'),signature};fs.writeFileSync(output,JSON.stringify(envelope,null,2),{flag:'wx'});return envelope;
}
if(require.main===module){const args=process.argv.slice(2),get=k=>args.includes(k)?args[args.indexOf(k)+1]:undefined;try{if(args.includes('--init')){const result=init(get('--init'));console.log('Created issuer key outside the repository. Public key file: '+result.publicFile);}else{issue({keyFile:get('--key'),issuedTo:get('--to'),days:Number(get('--days')||30),kind:args.includes('--evaluation')?'evaluation':'pilot',output:get('--output')});console.log('Created signed license.');}}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={init,issue};
