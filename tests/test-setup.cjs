/* Vault-first plans retain source layout and options without inventing a run. */
const assert=require('node:assert/strict');
const S=require('../dist/setup.js'),E=require('../dist/experiments.js'),D=require('../dist/demo.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const fixture=D.create()[0],source={schemaVersion:1,session:'source-session',capturedAt:'2026-09-16T08:00:00.000Z',stages:{
 momentum:{fields:clone(fixture.parameters.strategy.main.fields),options:{
  0:[{value:'candle-token',label:'Candle'},{value:'pnf-token',label:'P&F'}],
  3:[{value:'nse-token',label:'NSE'},{value:'bse-token',label:'BSE'},{value:'blocked-token',label:'Unavailable',disabled:true}],
  33:[{value:'day-token',label:'Daily'},{value:'week-token',label:'Weekly'}],
  35:[{value:'pre-token',label:'Pre'},{value:'user-token',label:'My'}],
  36:['Demo momentum screen','Demo second screen'],
  40:['Demo trend rule','Demo alternative trend','-- Select Predefined System --'],
  41:['Daily','Weekly']
 }},
 execution:{fields:clone(fixture.parameters.strategy.execution.fields),options:{0:['Return Percent','Sharpe Return'],7:['Demo exit rule','Demo other exit']}},
 portfolio:S.portfolioTemplate()
}};
const frozen=clone(source),t=S.template(source),c=S.defaults(t);
assert.deepEqual(source,frozen,'Loading a template must not mutate captured source fields');
assert.equal(t.demo,false);assert.equal(c['momentum.chart'],'Candle');assert.equal(c['momentum.period.1'],180);
assert.equal(c['portfolio.capital'],100000);assert.equal(c['portfolio.allocation'],'Reinvestment');
assert.equal(S.fieldsForUI(t).find(g=>g.key==='momentum.periods').stage,'momentum');
assert.deepEqual(t.stages.momentum.options[3].map(o=>o.value),['NSE','BSE','Unavailable'],'Stored select values use source display labels, not opaque tokens');
const edited={...c,'momentum.group':'Test universe','momentum.market':'BSE','momentum.timeframe':'Weekly','momentum.period.2.enabled':true,'momentum.period.2':90,'momentum.period.2.weight':0.5,'momentum.ema.1.enabled':true,'momentum.ema.1':200,'momentum.tma':true,'momentum.retracement.enabled':true,'momentum.retracement.reference':'10','momentum.volume.reference':'21','momentum.radar.enabled':true,'momentum.radar.rule':'Demo second screen','momentum.strategy.1.rule':'Demo alternative trend','momentum.strategy.1.timeframe':'Weekly','execution.rank':'Sharpe Return','execution.from':'2024-02-29','execution.to':'2025-02-28','execution.target':'12.5','execution.exit.enabled':true,'execution.exit.rule':'Demo other exit','portfolio.allocation':'Fixed','portfolio.capital':'250000','portfolio.max-open':7,'portfolio.daily-limit.enabled':true,'portfolio.daily-limit':2};
const b=S.configToBaseline(edited,t,{id:'setup-test',name:'Starting strategy',demo:false});
assert.equal(S.validateBaseline(b),b);assert.equal(b.origin,'vault-setup');assert.equal(b.setupVersion,1);
assert.equal(b.parameters.strategy.main.fields[1].value,'Test universe');assert.equal(b.parameters.strategy.main.fields[3].value,'BSE');
assert.equal(b.parameters.strategy.main.fields[13].checked,true);assert.equal(b.parameters.strategy.main.fields[14].value,'90');assert.equal(b.parameters.strategy.main.fields[14].disabled,false);assert.equal(b.parameters.strategy.main.fields[23].value,'0.5');
assert.deepEqual(b.parameters.strategy.main.fields.slice(7,11).map(f=>f.checked),[false,false,false,true]);
assert.deepEqual(b.parameters.strategy.main.fields.slice(20,22).map(f=>f.checked),[false,true]);
assert.equal(b.parameters.strategy.main.fields[36].value,'Demo second screen');assert.equal(b.parameters.strategy.main.fields[40].value,'Demo alternative trend');assert.equal(b.parameters.strategy.main.fields[41].value,'Weekly');
assert.equal(b.parameters.strategy.execution.fields[9].value,'12.5');assert.equal(b.parameters.settings.fields[2].value,'250000');
assert.ok(!('quickStats'in b)&&!('statistics'in b)&&!('trades'in b)&&!('charts'in b)&&!('provenance'in b)&&!('savedAt'in b));
assert.deepEqual(Object.keys(b.parameters),['strategy','settings']);assert.deepEqual(Object.keys(b.parameters.strategy),['main','execution']);
for(const stage of ['momentum','execution','portfolio']){
 const f=E.fields(b,stage);assert.deepEqual(f.map(x=>[x.index,x.type,x.label]),t.stages[stage].fields.map(x=>[x.index,x.type,x.label]),'Every source index/type/label survives setup editing');
}
assert.ok(E.catalog(b).some(f=>f.key==='momentum.period.2'),'Settings-only plans work with the existing experiment dimension catalog');
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
assert.equal(S.validateBaseline(canonical(b)).id,b.id,'Object property order from storage is irrelevant');
for(const [patch,error] of [
 [{'execution.from':'2025-02-29'},/valid date/],
 [{'execution.to':'2024-01-01'},/end date/],
 [{'momentum.period.1.weight':0},/positive weight/],
 [{'momentum.period.1.enabled':false},/positive weight/],
 [{'momentum.period.2':1.5},/whole number/],
 [{'momentum.period.1.weight':-1},/number/],
 [{'momentum.volume':null},/valid number/],
 [{'momentum.volume':true},/valid number/],
 [{'portfolio.capital':0},/number/],
 [{'portfolio.capital':'1e99'},/number/],
 [{'portfolio.max-open':1.25},/whole number/],
 [{'momentum.group':''},/valid universe/],
 [{'momentum.market':'Nasdaq'},/available market/],
 [{'momentum.market':'Unavailable'},/available market/],
 [{'momentum.timeframe':'Yearly'},/available timeframe/],
 [{'momentum.chart':'P&F'},/available chart/],
 [{'momentum.market-filter':true},/not available/],
 [{'momentum.rs':true},/not available/],
 [{'momentum.radar.source':'My'},/Refresh choices/],
 [{'momentum.radar.rule':'Unknown screen'},/available radar/],
 [{'momentum.strategy.1.rule':'-- Select Predefined System --'},/before enabling/],
 [{'execution.exit.rule':'Never loaded rule'},/available exit/],
 [{'portfolio.enabled':false},/not available/],
 [{'unknown.setting':1},/Unknown setting/]
])assert.throws(()=>S.validateConfig({...c,...patch},t),error);
assert.throws(()=>S.configToBaseline(c,t,{demo:true}),/Real and fictional/);
const radarSource=S.fieldsForUI(t).flatMap(g=>g.fields).find(f=>f.key==='momentum.radar.source');assert.equal(radarSource.dynamic,true);assert.equal(radarSource.refreshOnChange,true);assert.deepEqual(radarSource.dependents,[36]);assert.equal(radarSource.disabled,undefined);
const refreshedSource=clone(source);refreshedSource.stages.momentum.fields[35].value='My';refreshedSource.stages.momentum.fields[36].value='My screen';refreshedSource.stages.momentum.options[36]=['My screen'];const refreshedT=S.template(refreshedSource);
assert.throws(()=>S.validateConfig({...c,'momentum.radar.source':'My'},refreshedT),/available radar rule/,'A catalogue refresh must not retain an unavailable old rule silently');
assert.equal(S.validateConfig({...c,'momentum.radar.source':'My','momentum.radar.rule':'My screen'},refreshedT)['momentum.radar.source'],'My');
assert.equal(S.fieldsForUI(t).flatMap(g=>g.fields).find(f=>f.key==='momentum.chart').options.find(o=>o.value==='P&F').disabled,true,'Unsupported source chart choices stay visible and explicitly unavailable');
const altered=clone(b);altered.parameters.strategy.main.fields[12].value='999';assert.throws(()=>S.validateBaseline(altered),/altered/);
const forged=clone(b);forged.provenance='recorded-at-submit';assert.throws(()=>S.validateBaseline(forged),/altered/);
const malformed=clone(source);malformed.stages.momentum.fields[12].index=11;assert.throws(()=>S.template(malformed),/layout/);
const wrongLabel=clone(source);wrongLabel.stages.execution.fields[9].label='Wrong target label'; // Non-anchor source labels are retained verbatim.
assert.equal(S.template(wrongLabel).stages.execution.fields[9].label,'Wrong target label');
wrongLabel.stages.execution.fields[8].label='Unknown threshold';assert.throws(()=>S.template(wrongLabel),/controls changed/);
const unsupported=clone(source);unsupported.stages.momentum.fields=clone(D.create()[1].parameters.strategy.main.fields);assert.throws(()=>S.template(unsupported),/Relative Strength off/);
const invalidOption=clone(source);invalidOption.stages.momentum.options[3]=['Other market'];assert.throws(()=>S.template(invalidOption),/absent/);
for(const [stage,index,gate,key] of [['momentum',36,34,'momentum.radar'],['momentum',40,42,'momentum.strategy.1'],['momentum',44,46,'momentum.strategy.2'],['momentum',48,50,'momentum.strategy.3'],['execution',7,5,'execution.exit']]){
 const empty=clone(source);empty.stages[stage].fields[index].value='';empty.stages[stage].fields[gate].checked=false;empty.stages[stage].options[index]=[];
 const emptyTemplate=S.template(empty),emptyConfig=S.defaults(emptyTemplate);
 assert.deepEqual(emptyTemplate.stages[stage].options[index],[],'An empty source rule list must remain empty, without an invented selectable option');
 assert.deepEqual(S.fieldsForUI(emptyTemplate).flatMap(g=>g.fields).find(f=>f.key===key+'.rule').options,[]);
 assert.equal(S.validateConfig(emptyConfig,emptyTemplate)[key+'.rule'],'');
 assert.equal(S.validateBaseline(S.configToBaseline(emptyConfig,emptyTemplate)).parameters.strategy.main.fields.length,52,'An unused empty rule catalogue can be saved and restored');
 assert.throws(()=>S.validateConfig({...emptyConfig,[key+'.enabled']:true},emptyTemplate),/No .* choices are available/,'An empty source rule list cannot execute an enabled rule');
 assert.throws(()=>S.validateConfig({...emptyConfig,[key+'.rule']:'Previously selected rule'},emptyTemplate),/available/,'A disappeared prior choice must not silently validate even when its rule is off');
}
const emptyParent=clone(source);emptyParent.stages.momentum.fields[35].value='';emptyParent.stages.momentum.options[35]=[];assert.throws(()=>S.template(emptyParent),/absent/,'Parent source selectors cannot use the empty-rule exception');
const emptyMarket=clone(source);emptyMarket.stages.momentum.fields[3].value='';emptyMarket.stages.momentum.options[3]=[];assert.throws(()=>S.template(emptyMarket),/absent/,'Required source menus cannot use the empty-rule exception');
const ambiguous=clone(source);ambiguous.stages.momentum.options[3]=[{value:'a',label:'NSE'},{value:'b',label:'NSE'}];assert.throws(()=>S.template(ambiguous),/Ambiguous/);
const radioConflict=clone(source);radioConflict.stages.momentum.fields[8].checked=true;assert.throws(()=>S.defaults(S.template(radioConflict)),/exactly one/);
const withoutPortfolio=clone(source);delete withoutPortfolio.stages.portfolio;const staticT=S.template(withoutPortfolio);assert.equal(staticT.stages.portfolio.template,true);assert.equal(staticT.stages.portfolio.origin,'verified-layout');assert.match(S.fieldsForUI(staticT).find(g=>g.stage==='portfolio').note,/defaults/);
const demoT=S.demoTemplate(),demoB=S.configToBaseline(S.defaults(demoT),demoT,{id:'demo-setup',name:'Sample setup',demo:true});assert.equal(demoB.demo,true);assert.equal(S.validateBaseline(demoB),demoB);
assert.equal(S.template({momentum:source.stages.momentum,execution:source.stages.execution,portfolio:source.stages.portfolio}).stages.momentum.fields.length,52,'Direct stage aliases remain supported');
console.log('PASS: source-derived setup, exact labels and choices, editable Candle strategy/exits/portfolio, settings-only provenance, strict dates/weights/capital/rules, unsupported settings, immutable reconstruction and fictional isolation.');
