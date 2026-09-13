const assert=require('node:assert/strict');
const I=require('../dist/intelligence.js'),D=require('../dist/demo.js');
const copy=x=>structuredClone(x),runs=D.create(),original=JSON.stringify(runs);
const stat=(r,label,value)=>{r.quickStats.find(x=>x.label===label).value=String(value);};
const field=(r,stage,key,value)=>{const item=I.inspect(r),row=item.rows.get(stage+'.'+key),snapshot=stage==='momentum'?r.parameters.strategy.main:stage==='execution'?r.parameters.strategy.execution:r.parameters.settings;snapshot.fields[row.sourceIndices.at(-1)].value=String(value);};
const detail=(r,label,value)=>{r.statistics[0].rows.find(x=>x[0]===label)[1]=value;};
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,actual+' != '+expected);
assert.equal(I.date('29-Feb-2024'),'2024-02-29');assert.equal(I.date('1-Jan 25'),'2025-01-01');assert.equal(I.date('2025-02-29'),null);assert.equal(I.date('31-Apr-2025'),null);assert.equal(I.date('1-XXX-2025'),null);assert.equal(I.date('01/02/2025'),null);
let a=I.analyze(runs);assert.equal(a.groups.length,4);assert.equal(a.blocked.length,1);assert.equal(a.groups[0].items.length,2);assert.equal(a.groups[0].calmarLeaders[0].run.id,runs[0].id);assert.deepEqual(a.groups[0].items[1].dominatedBy,[runs[0].name]);assert.match(a.groups[0].verdict,/research candidate/);assert.ok(a.groups[0].differences.some(d=>d.key==='momentum.period.1'));assert.equal(JSON.stringify(runs),original);
for(const [stage,key,value,adjust] of [
 ['portfolio','capital',200000,r=>stat(r,'Initial Capital',200000)],
 ['portfolio','allocation','Fixed'],['portfolio','max-open',3],['portfolio','daily-limit',1,r=>r.parameters.settings.fields[4].checked=true],
 ['momentum','group','Another universe',r=>detail(r,'Group','Another universe')],
 ['momentum','market','BSE',r=>detail(r,'Segment','BSE')],
 ['momentum','timeframe','Weekly',r=>detail(r,'Timeframe','Weekly')],
 ['execution','from','2024-12-01',r=>detail(r,'Start Date','1-Dec 24')]
]){const r=copy(runs[1]);field(r,stage,key,value);adjust?.(r);a=I.analyze([runs[0],r]);assert.equal(a.blocked.length,0,stage+'.'+key);assert.equal(a.groups.length,2,stage+'.'+key);}
const rnk=copy(runs[3]);rnk.id='changed-mode';rnk.parameters.strategy.execution.fields[6].checked=false;rnk.parameters.strategy.execution.fields[7].checked=true;assert.equal(I.analyze([runs[3],rnk]).groups.length,2);
const mismatched=copy(runs[0]);detail(mismatched,'Start Date','2-Jan 25');assert.match(I.analyze([mismatched]).blocked[0].errors.join(' '),/start date differs/);
const unknown=copy(runs[0]);unknown.parameters.strategy.main.fields.pop();assert.match(I.analyze([unknown]).blocked[0].errors.join(' '),/unknown setting layout/);
const noLink=copy(runs[0]);noLink.provenance='unverified';assert.equal(I.analyze([noLink]).groups.length,0);
const repeat=copy(runs[0]);repeat.id='copy';repeat.name='Copy renamed';repeat.savedAt='2026-09-13';repeat.notes='New note';field(repeat,'portfolio','daily-limit',99);
a=I.analyze([runs[0],repeat]);assert.equal(a.duplicates.length,1);assert.equal(a.groups[0].items.length,1);
const noCagr=copy(runs[1]);noCagr.quickStats=noCagr.quickStats.filter(x=>x.label!=='CAGR');noCagr.quickStats.push({label:'Calmer Ratio',value:'999% ↓'});assert.equal(I.inspect(noCagr).calmar,null);assert.match(I.analyze([runs[0],noCagr]).groups[0].verdict,/No single/);
const zero=copy(runs[0]);stat(zero,'Max Drawdown(MDD)',0);assert.equal(I.inspect(zero).calmar,null);
const invalid=copy(runs[0]);stat(invalid,'CAGR','-101%');assert.equal(I.inspect(invalid).calmar,null);stat(invalid,'Max Drawdown(MDD)',-5);assert.equal(I.analyze([invalid]).groups.length,0);
a=I.analyze(runs.slice(0,2),{drawdownLimit:2.6});assert.equal(a.groups[0].eligible.length,1);assert.equal(a.groups[0].items[1].withinLimit,false);assert.match(I.analyze(runs.slice(0,2),{drawdownLimit:0}).groups[0].verdict,/No run meets/);assert.throws(()=>I.analyze(runs,{drawdownLimit:-1}));
const tied=copy(runs[1]);stat(tied,'CAGR',runs[0].quickStats.find(x=>x.label==='CAGR').value);stat(tied,'Max Drawdown(MDD)',2.5);a=I.analyze([runs[0],tied]);assert.equal(a.groups[0].calmarLeaders.length,2);assert.match(a.groups[0].verdict,/No single/);
// Ranking uses one named measure, preserves ties, and never ranks a singleton or ceiling failure.
const rankItems=[
 {run:{id:'a',name:'A'},returns:10,drawdown:2,calmar:5,withinLimit:true},
 {run:{id:'b',name:'B'},returns:20,drawdown:4,calmar:5,withinLimit:true},
 {run:{id:'c',name:'C'},returns:15,drawdown:5,calmar:3,withinLimit:true},
 {run:{id:'d',name:'D'},returns:30,drawdown:9,calmar:6,withinLimit:false},
 {run:{id:'e',name:'E'},returns:5,drawdown:1,calmar:null,withinLimit:true}
],rankGroup={items:rankItems},rankBefore=JSON.stringify(rankItems);
assert.deepEqual(I.ranking(rankGroup).map(x=>[x.item.run.id,x.rank]),[['a',1],['b',1],['c',3],['d',null],['e',null]]);
assert.deepEqual(I.ranking(rankGroup,'returns').map(x=>x.item.run.id),['b','c','a','e','d']);
assert.deepEqual(I.ranking(rankGroup,'drawdown').map(x=>x.item.run.id),['e','a','b','c','d']);
assert.equal(I.ranking({items:[rankItems[0],rankItems[3],rankItems[4]]})[0].rank,null);
assert.deepEqual(I.ranking({items:[]}),[]);assert.throws(()=>I.ranking(rankGroup,'score'),/Unknown/);
assert.equal(JSON.stringify(rankItems),rankBefore);
// All-runs overview keeps every record while ordering only reviewed, unique evidence.
const allInput=[...copy(runs),copy(repeat),{id:'broken',name:'Broken record',demo:true}],allBefore=JSON.stringify(allInput),strict=I.analyze(allInput),strictBefore=JSON.stringify(strict);
const all=I.overview(strict);assert.equal(all.items.length,allInput.length);assert.equal(all.groups.length,4);assert.equal(all.items.filter(x=>x.rankEligible).length,5);
assert.equal(all.items.find(x=>x.run.id==='copy').status,'Repeated result');assert.equal(all.items.find(x=>x.run.id==='broken').returns,null);
assert.equal(I.ranking(all,'returns').filter(x=>x.rank!==null).length,5);assert.ok(I.ranking(all).filter(x=>!x.item.rankEligible).every(x=>x.rank===null));
assert.ok(all.conditions.find(x=>x.key==='From').different);assert.ok(all.conditions.find(x=>x.key==='Momentum chart').different);assert.ok(all.settings.some(x=>x.key==='momentum.period.1'&&x.different));
assert.ok(all.statistics.some(x=>x.label==='Quick stats · CAGR'));assert.ok(all.statistics.some(x=>x.label==='Quick stats · Annualized Returns'));assert.equal(all.statistics[0].values.length,allInput.length);
assert.equal(JSON.stringify(strict),strictBefore);assert.equal(JSON.stringify(allInput),allBefore);
const realRun=copy(runs[0]);realRun.demo=false;realRun.id='real';const mixed=I.overview(I.analyze([...copy(runs),realRun]));assert.ok(mixed.mixedData);assert.ok(mixed.items.filter(x=>x.run.demo).every(x=>!x.rankEligible));assert.equal(I.ranking(mixed,'returns')[0].rank,null);
const allZero=I.overview(I.analyze([zero,noCagr]));assert.ok(I.ranking(allZero).every(x=>x.rank===null));assert.equal(I.ranking(allZero,'returns').filter(x=>x.rank!==null).length,2);
const allCeiling=I.overview(I.analyze(runs,{drawdownLimit:0}));assert.ok(I.ranking(allCeiling,'returns').every(x=>x.rank===null));
assert.deepEqual(I.ranking(I.overview(I.analyze([runs[0],tied]))).map(x=>x.rank),[1,1]);assert.equal(I.overview(I.analyze([])).items.length,0);
const losses=runs.slice(0,2).map(copy);for(const [i,r] of losses.entries()){stat(r,'Gross Total Returns( % )',-5-i);stat(r,'CAGR',-5-i);}assert.match(I.analyze(losses).groups[0].verdict,/negative/);
const csv='\uFEFF"Date","Total Returns Index"\r\n"03-Jan-2025","1,100.00"\r\n"01-Jan-2025","1,000.00"\r\n"02-Jan-2025","900.00"\r\n';
const benchmark=I.parseBenchmark(csv,{id:'b',demo:true});assert.equal(benchmark.points[0].date,'2025-01-01');assert.equal(benchmark.points[0].value,1000);assert.equal(benchmark.points.length,3);
assert.throws(()=>I.parseBenchmark(csv,{kind:'price'}),/Expected/);
assert.equal(I.parseBenchmark('Date,Close\n2025-01-01,100\n2025-01-02,101',{kind:'price'}).kind,'price');
assert.throws(()=>I.parseBenchmark('Date,Value\n2025-01-01,100\n2025-01-01,101'),/Duplicate/);
for(const invalid of ['2025-02-30,100','2025-01-02,-1','2025-01-02,Infinity','2025-01-02,NaN'])assert.throws(()=>I.parseBenchmark('Date,Value\n2025-01-01,100\n'+invalid));
assert.throws(()=>I.parseBenchmark('Date,Value\n"2025-01-01,100'),/Unclosed/);
assert.throws(()=>I.parseBenchmark('Index Name,Date,Value\nOther,2025-01-01,100\nOther,2025-01-02,101'),/does not match/);
const custom=I.inspect(runs[0]);custom.from='2025-01-01';custom.to='2025-01-03';
let bm=I.benchmarkFor(custom,benchmark);assert.ok(bm.available);near(bm.returns,10);near(bm.drawdown,10);near(bm.endingCapital,110000);near(bm.excess,custom.metrics.returns-10);
assert.equal(I.benchmarkFor(custom,{...benchmark,demo:false}).available,false);assert.equal(I.benchmarkFor(custom,null).available,false);
const year=copy(benchmark);year.points=[{date:'2025-01-01',value:100},{date:'2025-12-31',value:110}];custom.to='2025-12-31';bm=I.benchmarkFor(custom,year);assert.equal(bm.sparse,true);assert.equal(bm.drawdown,null);assert.equal(bm.calmar,null);near(bm.cagr,(1.1**(365.25/364)-1)*100);
const complete=D.benchmarks()[0];bm=I.benchmarkFor(custom,complete);assert.equal(bm.sparse,false);assert.equal(bm.shifted,false);assert.ok(bm.drawdown>0);
const missingEdges={...complete,points:complete.points.filter(p=>p.date<'2025-01-01'||p.date>'2025-01-10')};assert.match(I.benchmarkFor(custom,missingEdges).reason,/near the requested start/);
const shortened={...complete,points:complete.points.filter(p=>p.date<='2025-12-29')};bm=I.benchmarkFor(custom,shortened);assert.equal(bm.available,true);assert.equal(bm.shifted,true);assert.match(bm.cautions.join(' '),/approximate/);
custom.to='2026-02-01';assert.equal(I.benchmarkFor(custom,complete).available,false);
assert.equal(JSON.stringify(runs),original);
console.log('PASS: strict cohorts, source consistency, Calmar definitions, ties, dominance, risk ceilings, duplicate evidence, benchmark CSV validation, return/drawdown math, sparse/edge coverage and source immutability.');
