const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const base=path.resolve(__dirname,'../dist'),files=['core.js','demo.js','storage.js','presentation.js','intelligence.js','intelligence-ui.js','experiments.js','experiments-ui.js','dashboard.js'];
function app(demo=true){const dom=new JSDOM(fs.readFileSync(path.join(base,'index.html'),'utf8'),{runScripts:'outside-only',url:'http://localhost/'+(demo?'?demo=1&view=experiments':'')});const w=dom.window,d=w.document,memory={},downloads=[];let durable=0;
 w.structuredClone=structuredClone;w.Blob=Blob;w.HTMLElement.prototype.scrollIntoView=function(){};w.URL.createObjectURL=b=>{downloads.push(b);return 'blob:mock';};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
 w.chrome={storage:{local:{get:async k=>{durable++;if(demo)throw Error('Demo touched durable storage');return k?{[k]:memory[k]}:memory;},set:async v=>{durable++;if(demo)throw Error('Demo wrote durable storage');Object.assign(memory,v);}}},runtime:{sendMessage:async()=>{throw Error('Viewer must not control extension');}}};
 for(const file of files)w.eval(fs.readFileSync(path.join(base,file),'utf8'));
 const click=text=>{const b=[...d.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(b,'Button '+text);b.click();};return {dom,w,d,memory,downloads,click,durable:()=>durable};
}
const tick=(n=40)=>new Promise(r=>setTimeout(r,n));
async function sourcePickerTests(){
 const dom=new JSDOM('<main></main>',{runScripts:'outside-only',url:'chrome-extension://test-extension/index.html'}),w=dom.window,d=w.document;w.structuredClone=structuredClone;
 let poll,tabs=[{id:7,chart:'Candle',ready:true}];w.setInterval=fn=>{poll=fn;return 1;};w.clearInterval=()=>{};
 for(const file of ['core.js','presentation.js','intelligence.js','experiments.js','demo.js','experiments-ui.js'])w.eval(fs.readFileSync(path.join(base,file),'utf8'));
 const run=w.VaultDemo.create()[0];run.demo=false;const baseline=w.VaultExperiments.baseline(run),plan=w.VaultExperiments.create({id:'picker-test',name:'Picker test',baseline,dimensions:[{key:'momentum.period.1',values:'126,180,252'}]});
 let starts=0;w.chrome={runtime:{sendMessage:async m=>{if(m.action==='list')return {ok:true,experiments:[plan],tabs};if(m.action==='start'){starts++;assert.equal(m.tabId,9);return {ok:false,error:'Source no longer ready.'};}throw Error('Unexpected command');}}};
 const store={demo:false,all:async()=>[run],allBenchmarks:async()=>[],allExperiments:async()=>[plan]};
 const render=()=>w.VaultExperimentsUI.render({target:d.querySelector('main'),store,runs:[run],onOpen:()=>{},onExit:()=>{},onNotice:()=>{},table:()=>d.createElement('table'),download:()=>{}});
 try{
  await render();d.querySelector('.experiment-card').click();const picker=d.querySelector('[data-rzone]'),start=[...d.querySelectorAll('button')].find(b=>b.textContent==='Start experiment');
  assert.equal(picker.value,'7','One ready source is selected automatically');assert.equal(start.disabled,false);
  picker.focus();const options=[...picker.options];tabs=[];await poll();assert.deepEqual([...picker.options],options,'Never replace options while native menu is focused');assert.equal(start.disabled,true);
  picker.blur();assert.equal(picker.value,'7');assert.match(picker.selectedOptions[0].textContent,/not connected/);assert.match(d.querySelector('.experiment-actions').textContent,/not responding/);
  tabs=[{id:9,chart:'Candle',ready:true}];await poll();assert.equal(picker.value,'7','Never silently switch an existing selection');assert.equal(start.disabled,true);
  picker.value='9';picker.dispatchEvent(new w.Event('change'));assert.equal(start.disabled,false);
  tabs=[{id:7,chart:'Candle',ready:true},{id:9,chart:'Candle',ready:true}];await poll();assert.equal(picker.value,'9');start.click();await tick();assert.equal(starts,1);assert.match(d.querySelector('.notice').textContent,/Source no longer ready/);
  tabs=[{id:9,chart:'Candle',ready:false,reason:'Close the open report in RZone.'}];await poll();assert.equal(picker.value,'9');assert.equal(start.disabled,true);assert.match(d.querySelector('.experiment-actions').textContent,/Close the open report/);
  tabs=[];await render();d.querySelector('.experiment-card').click();const late=d.querySelector('[data-rzone]');assert.equal(late.value,'');tabs=[{id:12,chart:'Candle',ready:true}];await poll();assert.equal(late.value,'12','A source discovered later is auto-selected');
 }finally{w.VaultExperimentsUI.dispose();dom.window.close();}
}
(async()=>{await sourcePickerTests();const a=app();let real;try{await tick();assert.match(a.d.querySelector('#detail').textContent,/Plan → Run → Decide/);a.click('New experiment');
 const values=a.d.querySelector('.experiment-dimension input');values.value='126,180,252';values.dispatchEvent(new a.w.Event('input'));assert.match(a.d.querySelector('.experiment-preview').textContent,/3 planned runs/);
 a.d.querySelector('form').dispatchEvent(new a.w.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.equal((await a.w.VaultStore.allExperiments()).length,1);a.click('Simulate queue');await tick(650);a.click('Stop after current');await tick(1000);
 let e=(await a.w.VaultStore.allExperiments())[0];assert.equal(e.status,'paused');assert.ok(e.trials.some(t=>t.status==='saved'));a.click('Simulate queue');await tick(1600);e=(await a.w.VaultStore.allExperiments())[0];assert.equal(e.status,'complete');assert.equal(e.trials.filter(t=>t.status==='saved').length,3);assert.match(a.d.querySelector('.experiment-evidence').textContent,/Trial/);assert.equal(a.durable(),0);
 await a.d.getElementById('backup').onclick();const backup=JSON.parse(await a.downloads.at(-1).text());assert.equal(backup.version,2);assert.equal(backup.experiments.length,1);assert.equal(backup.runs.length,9);assert.equal(a.durable(),0);
 real=app(false);await tick();const importJSON=data=>real.d.getElementById('import').onchange({target:{files:[{size:1,text:async()=>JSON.stringify(data)}],value:'file'}});
 await importJSON(backup);let restored=(await real.w.VaultStore.allExperiments())[0];assert.equal(restored.status,'paused');assert.equal(restored.trials.filter(t=>t.status==='saved').length,3);
 const before=JSON.stringify(real.memory);await importJSON(backup);assert.equal(JSON.stringify(real.memory),before,'Duplicate imports retain original experiment journal');
 const malformed=structuredClone(backup);malformed.runs[0].id='should-not-be-written';malformed.experiments[0].trials[0].patch['momentum.period.1']=10000;await importJSON(malformed);assert.equal(JSON.stringify(real.memory),before,'Validate whole collection before any record writes');
 await real.d.getElementById('backup').onclick();const roundtrip=JSON.parse(await real.downloads.at(-1).text());assert.equal(roundtrip.experiments[0].id,e.id);assert.equal(roundtrip.experiments[0].trials.length,3);
 // Validation remains separate, but its journal row must still display its metric.
 const dates=a.d.querySelectorAll('.experiment-validation input');dates[0].value='2026-01-01';dates[1].value='2026-06-30';a.click('Freeze validation plan');await tick();a.click('Simulate queue');await tick(850);
 const validationRow=[...a.d.querySelectorAll('table[aria-label="Experiment trials"] tbody tr')].find(r=>r.cells[1].textContent==='validation');assert.ok(validationRow);assert.notEqual(validationRow.cells[4].textContent,'—');assert.match(a.d.querySelector('#detail').textContent,/Validation evidence/);
 a.click('Reset demo');await tick();assert.equal((await a.w.VaultStore.allExperiments()).length,0);assert.equal((await a.w.VaultStore.all()).length,6);assert.equal(a.durable(),0);
 // Reset during an in-flight simulation must never resurrect its records.
 a.click('Experiments');await tick();a.click('New experiment');const nextValues=a.d.querySelector('.experiment-dimension input');nextValues.value='126,180,252';nextValues.dispatchEvent(new a.w.Event('input'));a.d.querySelector('form').dispatchEvent(new a.w.Event('submit',{bubbles:true,cancelable:true}));await tick();a.click('Simulate queue');await tick(60);a.click('Reset demo');await tick(600);assert.equal((await a.w.VaultStore.allExperiments()).length,0);assert.equal((await a.w.VaultStore.all()).length,6);
 console.log('PASS: experiment UI planning, pause/resume simulation, decision view, complete v2 backup/import, preflight validation, duplicate IDs and strict demo isolation.');
 }finally{a.dom.window.close();real?.dom.window.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
