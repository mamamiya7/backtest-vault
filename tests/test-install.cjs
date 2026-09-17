/* Installs the actual release ZIP in isolated folders. Never loads Chrome or touches its profile. */
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {build,runtimeFiles,sha}=require('../scripts/build-release.cjs');
const windows=process.platform==='win32',root=path.resolve(__dirname,'..');
const sandbox=fs.mkdtempSync(path.join(os.tmpdir(),'vault-install-'));
function run(file,args,options={}){const r=spawnSync(file,args,{encoding:'utf8',timeout:90000,...options});assert.ifError(r.error);return r;}
function unpack(zip,dest){const staging=fs.mkdtempSync(path.join(sandbox,'unzip-'));const r=windows?run('tar.exe',['-xf',zip,'-C',staging]):run('unzip',['-q',zip,'-d',staging]);assert.equal(r.status,0,r.stdout+r.stderr);fs.renameSync(staging,dest);return path.join(dest,'BacktestVault');}
function install(bundle,target,{update=false,ok=true,env={},useDefault=false}={}){
 const script=path.join(bundle,windows?(update?'Update.cmd':'Setup.cmd'):(update?'update.sh':'setup.sh'));
 const vars={...process.env,...env,BV_TEST_SCRIPT:script,BV_TEST_TARGET:target};
 const r=windows?run(process.env.ComSpec||'cmd.exe',['/d','/v:off','/s','/c','""%BV_TEST_SCRIPT%" '+(useDefault?'':'--target "%BV_TEST_TARGET%" ')+'--no-open --non-interactive"'],{env:vars,windowsVerbatimArguments:true}):run('bash',[script,...(useDefault?[]:['--target',target]),'--no-open','--non-interactive'],{env:vars});
 if(ok)assert.equal(r.status,0,r.stdout+r.stderr);else assert.notEqual(r.status,0,'Invalid install unexpectedly succeeded: '+r.stdout);
 return r;
}
function matches(target){for(const name of runtimeFiles)assert.equal(sha(fs.readFileSync(path.join(target,name))),sha(fs.readFileSync(path.join(root,'dist',name),'utf8').replace(/\r\n/g,'\n')),name);}
function snapshot(folder){return Object.fromEntries(fs.readdirSync(folder).filter(n=>fs.statSync(path.join(folder,n)).isFile()).map(n=>[n,sha(fs.readFileSync(path.join(folder,n)))]));}
try{
 const a=build(path.join(sandbox,'release one')),b=build(path.join(sandbox,'release two'));assert.equal(sha(fs.readFileSync(a.destination)),sha(fs.readFileSync(b.destination)),'Release archive must be reproducible.');assert.throws(()=>build(path.dirname(a.destination)),/exist/i);
 const bundle=unpack(a.destination,path.join(sandbox,'Extracted & spaces ! (研究)'));
 for(const line of fs.readFileSync(path.join(bundle,'SHA256SUMS'),'utf8').trim().split('\n')){const [hash,name]=line.split('  ');assert.equal(sha(fs.readFileSync(path.join(bundle,name))),hash,name);}
 assert.deepEqual(fs.readdirSync(path.join(bundle,'extension')).sort(),[...runtimeFiles].sort());
 assert.equal(JSON.parse(fs.readFileSync(path.join(bundle,'extension/manifest.json'))).version,a.version);
 for(const name of ['Setup.cmd','Update.cmd'])assert.ok(!/\bpowershell(?:\.exe)?\b|ExecutionPolicy|Set-ExecutionPolicy|\breg(?:\.exe)?\s+add/i.test(fs.readFileSync(path.join(bundle,name),'utf8').split(/\r?\n/).filter(line=>!/^\s*rem\b/i.test(line)).join('\n')),'Windows helper must not depend on PowerShell or policy edits.');
 console.log('PASS: deterministic ZIP, full extraction, all bundled checksums, exact runtime allowlist.');

 const target=path.join(sandbox,'Installed & spaces ! (研究)','extension');install(bundle,target);matches(target);
 fs.writeFileSync(path.join(target,'my-backup.json'),'fictional user-owned backup');const existing=snapshot(target);install(bundle,target);assert.deepEqual(snapshot(target),existing,'Reinstall must preserve runtime and unrelated files.');
 const manifest=JSON.parse(fs.readFileSync(path.join(target,'manifest.json')));manifest.version='0.10.0';fs.writeFileSync(path.join(target,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(path.join(target,'dashboard.js'),'// older fictional install');install(bundle,target,{update:true});matches(target);assert.equal(fs.readFileSync(path.join(target,'my-backup.json'),'utf8'),'fictional user-owned backup');
 console.log('PASS: fresh setup, repeat setup, older-version update, permanent path, unrelated file preservation.');

 // Force a real failure after an earlier runtime file was replaced, then verify rollback.
 fs.writeFileSync(path.join(target,'background.js'),'// previous fictional background');
 const rollbackBefore=snapshot(target);
 if(windows){
  fs.chmodSync(path.join(target,'core.js'),0o444);
  try{install(bundle,target,{update:true,ok:false});}finally{fs.chmodSync(path.join(target,'core.js'),0o666);}
 }else{
  const shim=path.join(sandbox,'failure-shim');fs.mkdirSync(shim);
  fs.writeFileSync(path.join(shim,'mv'),'#!/usr/bin/env bash\nlast="${@: -1}"\nif [[ "$last" == "$BV_TEST_FAIL_TARGET/core.js" ]]; then exit 1; fi\nexec /usr/bin/mv "$@"\n',{mode:0o755});
  install(bundle,target,{update:true,ok:false,env:{PATH:shim+path.delimiter+process.env.PATH,BV_TEST_FAIL_TARGET:target}});
 }
 assert.deepEqual(snapshot(target),rollbackBefore,'Interrupted replacement must restore every original runtime file.');
 install(bundle,target,{update:true});matches(target);
 console.log('PASS: mid-update failure restores the previous files; a subsequent update succeeds.');

 const defaultBase=path.join(sandbox,'Default user data'),defaultTarget=windows?path.join(defaultBase,'BacktestVault','extension'):path.join(defaultBase,'backtest-vault','extension');install(bundle,defaultTarget,{useDefault:true,env:windows?{LOCALAPPDATA:defaultBase}:{XDG_DATA_HOME:defaultBase}});matches(defaultTarget);
 install(bundle,path.join(sandbox,'Missing update target'),{update:true,ok:false});
 const wrong=path.join(sandbox,'Not Vault');fs.mkdirSync(wrong);fs.writeFileSync(path.join(wrong,'manifest.json'),'{}');fs.writeFileSync(path.join(wrong,'keep.txt'),'keep');const beforeWrong=snapshot(wrong);install(bundle,wrong,{ok:false});assert.deepEqual(snapshot(wrong),beforeWrong);
 const bad=unpack(a.destination,path.join(sandbox,'Broken payload')),before=snapshot(target);fs.appendFileSync(path.join(bad,'extension/core.js'),'\n// corrupted download');install(bad,target,{update:true,ok:false});assert.deepEqual(snapshot(target),before,'Bad payload cannot change an existing installation.');
 fs.unlinkSync(path.join(bad,'extension/core.js'));install(bad,target,{update:true,ok:false});assert.deepEqual(snapshot(target),before);
 const link=path.join(sandbox,'Linked target');try{fs.symlinkSync(target,link,windows?'junction':'dir');install(bundle,link,{update:true,ok:false});assert.deepEqual(snapshot(target),before);}catch(error){if(error.code!=='EPERM')throw error;throw Error('Unable to exercise the symlink safeguard: '+error.message);}
 console.log('PASS: default user-local destination, wrong target, missing update target, damaged/missing payload, symlink refusal.');
 const guide=fs.readFileSync(path.join(bundle,'START-HERE.html'),'utf8');for(const text of ['Load unpacked','Update.cmd','bash update.sh','manifest.json','same folder'])assert.ok(guide.includes(text),text);assert.ok(!/<script\b|<link\b|<img\b/i.test(guide),'Offline guide needs no external assets.');
 console.log('PASS: '+process.platform+' package installation acceptance. Chrome approval/loading remains a user action.');
}finally{
 // Only delete this test's own newly-created directory after resolving containment.
 const actual=fs.realpathSync(sandbox),parent=fs.realpathSync(os.tmpdir());
 assert.ok(actual.startsWith(parent+path.sep)&&path.basename(actual).startsWith('vault-install-'));
 fs.rmSync(actual,{recursive:true,force:true});
}
