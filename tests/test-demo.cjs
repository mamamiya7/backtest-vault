const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const base=path.resolve(__dirname,'../dist'),Demo=require('../dist/demo.js'),V=require('../dist/core.js'),P=require('../dist/presentation.js');
const fixtures=Demo.create();assert.equal(fixtures.length,6);
for(const run of fixtures){V.validate(run);assert.equal(run.demo,true);assert.equal(run.trades.rows.length,V.metrics(run).trades);for(const s of P.settings(run)){assert.notEqual(s.groups[0].name,'Captured settings');assert.deepEqual(s.groups.flatMap(g=>g.rows.flatMap(r=>r.sourceIndices)).sort((a,b)=>a-b),s.snapshot.fields.map(f=>f.index));}}
assert.match(V.assessment(fixtures[4]).join(' '),/both selected/);
const dom=new JSDOM(fs.readFileSync(path.join(base,'index.html'),'utf8'),{runScripts:'outside-only',url:'http://localhost/?demo=1'}),w=dom.window,d=w.document;
let durableCalls=0;const downloads=[];
Object.defineProperty(w,'indexedDB',{get(){durableCalls++;throw Error('Demo opened IndexedDB');}});
Object.defineProperty(w,'chrome',{get(){durableCalls++;throw Error('Demo accessed extension storage');}});
w.Blob=Blob;w.URL.createObjectURL=blob=>{downloads.push(blob);return 'blob:synthetic';};w.URL.revokeObjectURL=()=>{};
const names=[];w.HTMLAnchorElement.prototype.click=function(){names.push(this.download);};
for(const file of ['core.js','demo.js','storage.js','presentation.js','dashboard.js'])w.eval(fs.readFileSync(path.join(base,file),'utf8'));
const tick=()=>new Promise(r=>setTimeout(r,20)),clickText=text=>[...d.querySelectorAll('button')].find(b=>b.textContent===text).click();
(async()=>{try{
 await tick();assert.equal(durableCalls,0);assert.equal(d.querySelectorAll('.run').length,6);assert.equal(d.querySelector('#detail h2').textContent,'Momentum core');assert.equal(d.getElementById('demo-banner').hidden,false);assert.equal(d.getElementById('import-trigger').disabled,true);
 const checks=d.querySelectorAll('.run input');for(const c of [...checks].slice(0,2)){c.checked=true;c.dispatchEvent(new w.Event('change'));}
 d.getElementById('compare').click();assert.match(d.getElementById('detail').textContent,/2 backtests compared/);
 d.getElementById('search').value='no match';d.getElementById('search').dispatchEvent(new w.Event('input'));assert.match(d.getElementById('selection-note').textContent,/2 hidden by filters/);
 d.getElementById('summary').click();let csv=await downloads.at(-1).text();assert.match(csv,/Momentum core/);assert.match(csv,/Relative strength/);assert.doesNotMatch(csv,/P&F breakout/);assert.ok(names.at(-1).startsWith('demo-'));
 d.getElementById('clear-selection').click();assert.equal(d.getElementById('compare').disabled,true);assert.doesNotMatch(d.getElementById('detail').textContent,/backtests compared/);
 d.getElementById('clear-filters').click();assert.equal(d.querySelectorAll('.run').length,6);
 const tab=d.getElementById('tab-Statistics');tab.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(d.getElementById('tab-Parameters').getAttribute('aria-selected'),'true');assert.equal(d.activeElement.id,'tab-Parameters');assert.equal(d.querySelectorAll('[role=tab][tabindex="0"]').length,1);
 clickText('Notes');d.querySelector('#detail input').value='Demo edit';d.querySelector('#detail textarea').value='Temporary demo note';clickText('Save name & notes');await tick();assert.equal((await w.VaultStore.all())[0].name,'Demo edit');assert.match(d.getElementById('notice').textContent,/temporarily/);assert.equal(durableCalls,0);
 d.getElementById('backup').click();const archive=JSON.parse(await downloads.at(-1).text());assert.equal(archive.runs.length,6);assert.ok(archive.runs.every(r=>r.demo));assert.ok(names.at(-1).startsWith('demo-'));
 await d.getElementById('import').onchange({target:{files:[{text:async()=>{throw Error('Demo import was read');}}],value:'test'}});assert.equal(durableCalls,0);
 d.getElementById('search').value='nothing';d.getElementById('search').dispatchEvent(new w.Event('input'));assert.equal(d.getElementById('summary').disabled,true);
 d.getElementById('reset-demo').click();await tick();assert.equal((await w.VaultStore.all())[0].name,'Momentum core');assert.equal(d.getElementById('compare').disabled,true);assert.equal(d.getElementById('search').value,'');assert.equal(d.querySelectorAll('.run').length,6);
 // The same page at a normal URL must still select durable Chrome storage.
 const local=new JSDOM('',{runScripts:'outside-only',url:'http://localhost/'});let reads=0;
 local.window.chrome={storage:{local:{get:async()=>{reads++;return {'run:private':{id:'private'}};},set:async()=>{}}}};
 local.window.eval(fs.readFileSync(path.join(base,'storage.js'),'utf8'));assert.equal((await local.window.VaultStore.all())[0].id,'private');assert.equal(reads,1);local.window.close();
 console.log('PASS: fictional demo schemas, complete settings, storage isolation, selected exports, hidden selection feedback, keyboard tabs, temporary notes, import guard, and demo reset.');
 }finally{w.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
