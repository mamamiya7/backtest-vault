const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),pkg=require('../package.json'),manifest=require('../dist/manifest.json');
assert.equal(pkg.version,manifest.version,'Package and extension versions differ');
const html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
const {runtimeFiles}=require('./build-release.cjs');
const keyContext={window:{}};require('node:vm').runInNewContext(fs.readFileSync(path.join(dist,'license-keys.js'),'utf8'),keyContext,{timeout:100});
assert.ok(Object.keys(keyContext.window.VaultLicenseKeys||{}).length,'At least one public issuer key is required');
for(const key of Object.values(keyContext.window.VaultLicenseKeys)){assert.equal(key.kty,'EC');assert.equal(key.crv,'P-256');assert.ok(key.x&&key.y);assert.equal(Object.hasOwn(key,'d'),false,'Private issuer key must not be packaged');}
// This runs on every OS: a Linux build must also catch Windows installer drift.
const windowsSetup=fs.readFileSync(path.join(root,'installer','Setup.cmd'),'utf8'),windowsLists=[...windowsSetup.matchAll(/^set "BV_FILES=([^"\r\n]*)"\s*$/gim)];
assert.equal(windowsLists.length,1,'Windows setup must declare exactly one runtime allowlist');
assert.deepEqual(windowsLists[0][1].trim().split(/\s+/).sort(),[...runtimeFiles].sort(),'Windows setup BV_FILES differs from the release runtime allowlist');
for(const [,name] of html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))"/g)){
 assert.ok(fs.existsSync(path.join(dist,name)),'Missing asset: '+name);
 assert.ok(runtimeFiles.includes(name),'Release omits dashboard asset: '+name);
}
for(const file of fs.readdirSync(dist).filter(f=>f.endsWith('.js'))){const r=spawnSync(process.execPath,['--check',path.join(dist,file)],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
assert.deepEqual(manifest.content_scripts[0].matches,['https://zone.definedgesecurities.com/*']);
assert.deepEqual(manifest.permissions,['storage','unlimitedStorage']);
const deployment={};require('node:vm').runInNewContext(fs.readFileSync(path.join(dist,'commercial-config.js'),'utf8'),deployment);const api=deployment.VaultCommercialConfig.apiOrigin;
if(api){assert.equal(new URL(api).origin,api);assert.ok(api.startsWith('https://'));assert.deepEqual(manifest.host_permissions,[api+'/*']);assert.ok(manifest.content_security_policy.extension_pages.includes('connect-src '+api+';'));}else{assert.match(manifest.content_security_policy.extension_pages,/connect-src 'none'/);assert.equal(manifest.host_permissions,undefined);}
for(const script of [...manifest.content_scripts.flatMap(x=>x.js),manifest.background.service_worker])assert.ok(fs.existsSync(path.join(dist,script)),script);
for(const [size,name] of Object.entries(manifest.icons||{})){assert.ok(runtimeFiles.includes(name),'Release omits icon: '+name);const bytes=fs.readFileSync(path.join(dist,name));assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.equal(bytes.readUInt32BE(16),Number(size));assert.equal(bytes.readUInt32BE(20),Number(size));}
assert.match(html,/demo\.js.*storage\.js/s);assert.match(html,new RegExp('v'+pkg.version.replaceAll('.','\\.')));
console.log('PASS: runtime syntax, local assets, Windows installer allowlist, manifest entrypoints, version alignment, unchanged capture permissions and exact account-origin configuration.');
