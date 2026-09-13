const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom'),D=require('../dist/demo.js');
const base=path.resolve(__dirname,'../dist'),tick=()=>new Promise(r=>setTimeout(r,25));
const files=['core.js','demo.js','storage.js','presentation.js','intelligence.js','intelligence-ui.js','dashboard.js'];
function app(saved={},demo=false,analysis=false){
 const dom=new JSDOM(fs.readFileSync(path.join(base,'index.html'),'utf8'),{runScripts:'outside-only',url:'http://localhost/?'+new URLSearchParams({...demo&&{demo:1},...analysis&&{view:'analysis'}})}),w=dom.window,d=w.document,downloads=[];
 let durable=0;
 w.chrome={storage:{local:{get:async()=>{durable++;return structuredClone(saved);},set:async data=>{durable++;Object.assign(saved,structuredClone(data));}}}};
 w.Blob=Blob;w.URL.createObjectURL=blob=>{downloads.push(blob);return 'blob:test';};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};w.HTMLElement.prototype.scrollIntoView=function(){};
 for(const f of files)w.eval(fs.readFileSync(path.join(base,f),'utf8'));
 return {w,d,saved,downloads,close:()=>w.close(),durable:()=>durable,click:text=>{const b=[...d.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(b,'Missing button: '+text);b.click();}};
}
const importJSON=(a,data)=>a.d.getElementById('import').onchange({target:{files:[{size:1,text:async()=>JSON.stringify(data)}],value:'test'}});
(async()=>{const demos=app({},true);let real,restored;try{
 await tick();demos.click('Analyze strategies');await tick();assert.match(demos.d.querySelector('#detail').textContent,/4 comparison groups · 1 blocked/);assert.match(demos.d.querySelector('#detail').textContent,/FICTIONAL REFERENCE/);
 assert.equal([...demos.d.querySelectorAll('button')].find(b=>b.textContent==='Import benchmark CSV').disabled,true);
 assert.equal(demos.durable(),0);demos.click('Export analysis CSV');const csv=await demos.downloads.at(-1).text();assert.match(csv,/Source CAGR/);assert.match(csv,/Synthetic calendar-day series/);assert.doesNotMatch(csv,/\d\.\d{7}/);
 assert.ok(demos.d.body.classList.contains('analysis-mode'));assert.equal(demos.d.querySelectorAll('.rank-table').length,1);assert.equal(demos.d.querySelectorAll('.risk-map svg').length,1);
 assert.equal(demos.d.querySelectorAll('#detail details[open]').length,0);assert.equal(demos.d.querySelectorAll('.rank-table tbody tr').length,2);
 const groups=demos.d.getElementById('ranking-group'),firstGroup=groups.value;groups.value=groups.options[1].value;groups.onchange();
 assert.match(demos.d.querySelector('.ranking-hero').textContent,/A peer is needed/);assert.equal(demos.d.querySelector('.rank-place').textContent,'—');
 demos.click('Export analysis CSV');assert.match(await demos.downloads.at(-1).text(),/Momentum core/); // Export still includes other groups.
 const changed=demos.d.getElementById('ranking-group');changed.value=firstGroup;changed.onchange();
 demos.d.getElementById('analysis-options').open=true;demos.click('Return');assert.equal(demos.d.activeElement.id,'rank-returns');assert.equal(demos.d.getElementById('analysis-options').open,true);assert.equal(demos.d.getElementById('rank-returns').getAttribute('aria-pressed'),'true');
 demos.click('Drawdown');assert.equal(demos.d.querySelector('.hero-score strong').textContent,'2.50%');assert.equal(demos.d.querySelector('.rank-table').dataset.basis,'drawdown');
 demos.click('Inspect this run');assert.equal(demos.d.body.classList.contains('analysis-mode'),false);demos.click('Analyze strategies');await tick();
 const ceiling=demos.d.querySelector('.intelligence-controls input');ceiling.value='0';demos.click('Apply ceiling');assert.match(demos.d.querySelector('#detail').textContent,/No run meets your drawdown ceiling/);
 demos.d.getElementById('analysis-risk').value='';demos.click('Apply ceiling');assert.equal(demos.d.querySelector('.hero-message h3').textContent,'Momentum core');
 demos.click('Back up all');const demoBackup=JSON.parse(await demos.downloads.at(-1).text());assert.equal(demoBackup.benchmarks.length,1);assert.ok(demoBackup.benchmarks[0].demo);assert.equal(demos.durable(),0);
 // Test the real application storage/import branches with synthetic data, never real user storage.
 const fixture=D.create()[0];fixture.demo=false;fixture.charts=[];fixture.name='<img src=x onerror=alert(1)>';const saved={['run:'+fixture.id]:structuredClone(fixture)};real=app(saved);await tick();
 real.click('Analyze strategies');await tick();assert.match(real.d.querySelector('#detail').textContent,/Import a Nifty index CSV/);assert.equal(real.d.querySelector('#detail img[src=x]'),null);
 const input=real.d.querySelector('#detail input[type=file]');Object.defineProperty(input,'files',{value:[{name:'test-only.csv',size:70,text:async()=> 'Date,Total Returns Index\n2025-01-01,100\n2025-06-01,90\n2025-12-31,110'}]});await input.onchange();
 assert.match(real.d.getElementById('notice').textContent,/Benchmark saved locally/);assert.equal(Object.keys(saved).filter(k=>k.startsWith('benchmark:')).length,1);assert.deepEqual(saved['run:'+fixture.id],fixture);
 real.click('Back up all');const backup=JSON.parse(await real.downloads.at(-1).text());assert.equal(backup.benchmarks.length,1);assert.equal(backup.runs.length,1);assert.match(real.d.querySelector('#detail').textContent,/Sparse observations/);
 real.click('Export analysis CSV');assert.match(await real.downloads.at(-1).text(),/Imported file: test-only.csv/);
 restored=app();await tick();await importJSON(restored,backup);assert.equal((await restored.w.VaultStore.all()).length,1);assert.equal((await restored.w.VaultStore.allBenchmarks()).length,1);
 const before=JSON.stringify(restored.saved);const duplicate=structuredClone(backup);duplicate.runs[0].name='Must not replace';duplicate.benchmarks[0].source='Must not replace';await importJSON(restored,duplicate);assert.equal(JSON.stringify(restored.saved),before);
 restored.click('Back up all');const roundtrip=JSON.parse(await restored.downloads.at(-1).text());assert.deepEqual(roundtrip.runs,backup.runs);assert.deepEqual(roundtrip.benchmarks,backup.benchmarks);
 const malformed=structuredClone(backup);malformed.runs[0].id='new-run';malformed.benchmarks[0].points[0].value=-1;await importJSON(restored,malformed);assert.equal(JSON.stringify(restored.saved),before);assert.match(restored.d.getElementById('notice').textContent,/Import stopped/);
 // Deliberately conflicting measures and a larger cohort exercise rank changes and progressive disclosure.
 const candidates=Array.from({length:7},(_,i)=>{const r=D.create()[0];r.id='test-rank-'+i;r.name='Candidate '+i;r.demo=false;r.charts=[];for(const [label,value] of [['Gross Total Returns( % )',10+i],['CAGR',10+i],['Max Drawdown(MDD)',i===0?1:10+i]])r.quickStats.find(s=>s.label===label).value=String(value);return r;});
 const rankSaved=Object.fromEntries(candidates.map(r=>['run:'+r.id,r])),rankSource=JSON.stringify(rankSaved),ranking=app(rankSaved,false,true);
 try{await tick();assert.ok(ranking.d.body.classList.contains('analysis-mode'));assert.equal(ranking.d.querySelector('.hero-message h3').textContent,'Candidate 0');assert.equal(ranking.d.querySelectorAll('.rank-table tbody tr').length,5);
 ranking.click('Show all 7 runs');assert.equal(ranking.d.querySelectorAll('.rank-table tbody tr').length,7);ranking.click('Return');assert.equal(ranking.d.querySelector('.hero-message h3').textContent,'Candidate 6');assert.equal(ranking.d.querySelector('.rank-table tbody tr').dataset.runId,'test-rank-6');assert.equal(ranking.d.querySelectorAll('.rank-table tbody tr').length,5);
 ranking.click('Drawdown');assert.equal(ranking.d.querySelector('.hero-message h3').textContent,'Candidate 0');assert.equal(JSON.stringify(rankSaved),rankSource);
 ranking.d.getElementById('analysis-risk').value='1';ranking.click('Apply ceiling');assert.match(ranking.d.querySelector('.ranking-hero').textContent,/Only one run qualifies/);assert.equal(ranking.d.querySelectorAll('.rank-leader').length,0);assert.equal(ranking.d.querySelector('.rank-place').textContent,'—');
 ranking.click('Back to library');assert.equal(ranking.d.body.classList.contains('analysis-mode'),false);
 }finally{ranking.close();}
 const empty=app({},false,true);try{await tick();assert.match(empty.d.querySelector('.ranking-hero').textContent,/No runs have enough verified/);assert.equal(empty.d.querySelector('.rank-table'),null);}finally{empty.close();}
 const partial=D.create().slice(0,2);partial[1].quickStats=partial[1].quickStats.filter(s=>s.label!=='CAGR');partial.forEach(r=>{r.demo=false;r.charts=[];});const missing=app(Object.fromEntries(partial.map(r=>['run:'+r.id,r])),false,true);
 try{await tick();assert.match(missing.d.querySelector('.ranking-hero').textContent,/comparison is incomplete/);assert.equal(missing.d.querySelectorAll('.rank-leader').length,0);missing.click('Return');assert.equal(missing.d.querySelector('.hero-message h3').textContent,'Momentum core');}finally{missing.close();}
 console.log('PASS: analysis UI, drawdown controls, text safety, demo benchmark isolation, CSV precision/provenance, immediate benchmark backup, JSON roundtrip, duplicate IDs and invalid-import staging.');
 }finally{demos.close();real?.close();restored?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
