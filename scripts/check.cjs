const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),pkg=require('../package.json'),manifest=require('../dist/manifest.json');
assert.equal(pkg.version,manifest.version,'Package and extension versions differ');
const html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
for(const [,name] of html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))"/g))assert.ok(fs.existsSync(path.join(dist,name)),'Missing asset: '+name);
for(const file of fs.readdirSync(dist).filter(f=>f.endsWith('.js'))){const r=spawnSync(process.execPath,['--check',path.join(dist,file)],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
assert.deepEqual(manifest.content_scripts[0].matches,['https://zone.definedgesecurities.com/*']);
assert.deepEqual(manifest.permissions,['storage','unlimitedStorage']);
assert.match(manifest.content_security_policy.extension_pages,/connect-src 'none'/);
for(const script of [...manifest.content_scripts.flatMap(x=>x.js),manifest.background.service_worker])assert.ok(fs.existsSync(path.join(dist,script)),script);
assert.match(html,/demo\.js.*storage\.js/s);assert.match(html,new RegExp('v'+pkg.version.replaceAll('.','\\.')));
console.log('PASS: runtime syntax, local assets, manifest entrypoints, version alignment, and unchanged origin/permissions.');
