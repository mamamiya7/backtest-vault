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
assert.deepEqual(b.parameters.strategy.execution.fields.slice(0,3).map(f=>f.value),['Sharpe Return','2024-02-29','2025-02-28'],'Rank and dates retain their exact native source positions');
assert.deepEqual(b.parameters.settings.fields.map(f=>['checkbox','radio'].includes(f.type)?f.checked:f.value),[true,'Fixed','250000','7',true,'2'],'Portfolio settings stay in the observed six-field order');
assert.equal(S.validDate('2024-02-29'),true);for(const value of ['2025-02-29','2024-02-30','2024-13-01','2024-1-01',' 2024-01-01','2024-01-01T00:00:00Z',null,20240101])assert.equal(S.validDate(value),false,'Date list and baseline validation share an exact ISO date check');
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
 [{'momentum.chart':'P&F'},/Refresh choices for Chart type/],
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
assert.equal(S.fieldsForUI(t).flatMap(g=>g.fields).find(f=>f.key==='momentum.chart').options.find(o=>o.value==='P&F').disabled,false,'Observed chart choices can be selected to load their matching layouts');
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
// Group autocomplete choices remain a catalogue beside the original text
// control; importing an older template without that catalogue remains valid.
{
 const withGroups=clone(source),current=withGroups.stages.momentum.fields[1].value;
 withGroups.stages.momentum.options[1]=[current,{value:'source-token',label:'Second universe'},{value:'closed-token',label:'Unavailable universe',disabled:true}];
 const original=clone(withGroups),groupT=S.template(withGroups),groupC=S.defaults(groupT),descriptor=key=>S.fieldsForUI(groupT).flatMap(g=>g.fields).find(f=>f.key===key);
 assert.deepEqual(withGroups,original,'Reading Group choices must not mutate the source');
 assert.equal(descriptor('momentum.group').type,'combobox');
 assert.equal(descriptor('momentum.group').value,current);
 assert.deepEqual(descriptor('momentum.group').options.map(o=>o.value),[current,'Second universe','Unavailable universe']);
 assert.equal(descriptor('momentum.market').dynamic,true);assert.equal(descriptor('momentum.market').refresh,true);assert.equal(descriptor('momentum.market').refreshOnChange,true);assert.deepEqual(descriptor('momentum.market').dependents,[1]);
 const groupB=S.configToBaseline({...groupC,'momentum.group':'Second universe'},groupT,{id:'catalogued-group',name:'Selected group'});
 assert.equal(S.validateBaseline(groupB),groupB);
 assert.equal(groupB.parameters.strategy.main.fields[1].type,'text','A UI combobox must preserve the source text field type');
 assert.equal(groupB.parameters.strategy.main.fields[1].value,'Second universe');
 assert.equal(groupB.setup.template.stages.momentum.fields[1].type,'text');
 for(const value of ['', 'Unobserved universe','Unavailable universe',' Second universe '])assert.throws(()=>S.validateConfig({...groupC,'momentum.group':value},groupT),/available universe/,'Only an exact available Group can enter a plan');
 assert.throws(()=>S.validateConfig({...groupC,'momentum.market':'BSE'},groupT),/Refresh choices for Market/,'A group catalogue from NSE must not validate a BSE plan');
 const nextMarket=clone(withGroups);nextMarket.stages.momentum.fields[3].value='BSE';nextMarket.stages.momentum.fields[1].value='';nextMarket.stages.momentum.options[1]=['BSE universe'];
 const nextT=S.template(nextMarket),nextC=S.defaults(nextT);
 assert.equal(nextC['momentum.group'],'','A blank Group must not select the first observed choice implicitly');
 assert.throws(()=>S.validateConfig(nextC,nextT),/available universe/);
 assert.throws(()=>S.validateConfig({...nextC,'momentum.group':current},nextT),/available universe/,'The prior market Group cannot survive a different catalogue silently');
 assert.equal(S.validateConfig({...nextC,'momentum.group':'BSE universe'},nextT)['momentum.market'],'BSE');
 const removed=clone(withGroups);removed.stages.momentum.options[1]=['Second universe'];
 const removedT=S.template(removed);assert.equal(S.defaults(removedT)['momentum.group'],current,'A removed selected Group stays visible for review rather than changing automatically');
 assert.throws(()=>S.configToBaseline(S.defaults(removedT),removedT),/available universe/);
 const emptyGroups=clone(withGroups);emptyGroups.stages.momentum.options[1]=[];const emptyT=S.template(emptyGroups),emptyDescriptor=S.fieldsForUI(emptyT).flatMap(g=>g.fields).find(f=>f.key==='momentum.group');
 assert.equal(emptyDescriptor.type,'combobox');assert.deepEqual(emptyDescriptor.options,[],'An observed empty Group catalogue must not fall back to free text');
 assert.throws(()=>S.validateConfig(S.defaults(emptyT),emptyT),/No universe.*choices/);
 for(const choices of [null,undefined,{},[''],['  '],['Bad\nlabel'],[{value:'v'}],[{label:'Group'}]]){
  const invalid=clone(withGroups);invalid.stages.momentum.options[1]=choices;assert.throws(()=>S.template(invalid),/Invalid source choice/);
 }
 const duplicate=clone(withGroups);duplicate.stages.momentum.options[1]=[{value:'a',label:'Same group'},{value:'b',label:'Same group'}];assert.throws(()=>S.template(duplicate),/Ambiguous source choices/);
 const bounded=clone(withGroups);bounded.stages.momentum.options[1]=Array.from({length:3000},(_,i)=>'Observed group '+i);assert.equal(S.template(bounded).stages.momentum.options[1].length,3000);
 bounded.stages.momentum.options[1].push('One too many');assert.throws(()=>S.template(bounded),/Invalid source choices/);
 const oldDescriptor=S.fieldsForUI(t).flatMap(g=>g.fields);assert.equal(oldDescriptor.find(f=>f.key==='momentum.group').type,'text');assert.equal(oldDescriptor.find(f=>f.key==='momentum.market').dynamic,undefined);
 assert.equal(S.validateBaseline(clone(b)).parameters.strategy.main.fields[3].value,'BSE','Pre-catalogue saved plans retain their legacy text Group and Market semantics');
 const demoGroup=S.fieldsForUI(demoT).flatMap(g=>g.fields).find(f=>f.key==='momentum.group');assert.equal(demoGroup.type,'combobox');assert.equal(demoGroup.options.length,3);assert.ok(demoGroup.options.every(o=>o.label.startsWith('Demo universe ')),'Preview groups are explicitly fictional');
}
assert.equal(S.template({momentum:source.stages.momentum,execution:source.stages.execution,portfolio:source.stages.portfolio}).stages.momentum.fields.length,52,'Direct stage aliases remain supported');
// Strategy rules belong to one observed category of one exact strategy slot.
{
 const cached=clone(source),m=cached.stages.momentum,categories=['Pre','My','Public','Popular'];m.ruleCatalogues={};
 for(let n=0;n<=3;n++){
  const parent=35+4*n,child=parent+1,gate=n?parent+3:34,lists={};
  m.options[parent]=categories;m.fields[parent].value='Pre';m.fields[gate].checked=true;
  for(const category of categories)lists[category]=[`${n} ${category} first`,{value:'opaque-token',label:`${n} ${category} second`},{value:'disabled-token',label:`${n} ${category} unavailable`,disabled:true}];
  m.options[child]=clone(lists.Pre);m.fields[child].value=`${n} Pre first`;m.ruleCatalogues[child]={parentIndex:parent,gateIndex:gate,categories:lists};
 }
 const before=clone(cached),catalogueT=S.template(cached),defaults=S.defaults(catalogueT);assert.deepEqual(cached,before);
 for(let n=0;n<=3;n++)for(const category of categories){
  const prefix=n?'momentum.strategy.'+n:'momentum.radar',chosen={...defaults,[prefix+'.source']:category,[prefix+'.rule']:`${n} ${category} second`},descriptors=S.fieldsForUI(catalogueT,chosen).flatMap(g=>g.fields),parent=descriptors.find(f=>f.key===prefix+'.source'),child=descriptors.find(f=>f.key===prefix+'.rule');
  assert.deepEqual(parent.cachedCategories,categories);assert.equal(parent.refreshOnChange,true);
  assert.equal(child.sourceKey,parent.key);assert.equal(child.categoryKey,category);assert.deepEqual(child.options.map(o=>o.value),[`${n} ${category} first`,`${n} ${category} second`,`${n} ${category} unavailable`]);
  const baseline=S.configToBaseline(chosen,catalogueT,{id:`cached-${n}-${category}`,name:'Cached category'});assert.equal(S.validateBaseline(canonical(baseline)).id,baseline.id);
  assert.equal(baseline.parameters.strategy.main.fields[35+4*n].value,category);assert.equal(baseline.parameters.strategy.main.fields[36+4*n].value,`${n} ${category} second`);
  assert.deepEqual(baseline.setup.template.stages.momentum.fields,catalogueT.stages.momentum.fields,'Local category changes never rewrite the original source snapshot');
  assert.throws(()=>S.validateConfig({...chosen,[prefix+'.rule']:`${n} ${category==='My'?'Public':'My'} first`},catalogueT),/available (strategy|radar)/,'Rules are not unioned across categories');
  assert.throws(()=>S.validateConfig({...chosen,[prefix+'.rule']:`${n} ${category} unavailable`},catalogueT),/available (strategy|radar)/,'A cached disabled rule cannot execute');
  if(category!=='Pre')assert.equal(child.value,'','An unselected cached category cannot invent a selected rule');
 }
 const partial=clone(cached);delete partial.stages.momentum.ruleCatalogues[40].categories.My;const partialT=S.template(partial);
 assert.throws(()=>S.validateConfig({...defaults,'momentum.strategy.1.source':'My','momentum.strategy.1.rule':'1 My first'},partialT),/Refresh choices for Strategy 1 source/,'Uncached categories retain the live refresh requirement');
 const radarOnly=clone(cached);radarOnly.stages.momentum.options[35]=['Pre','My'];delete radarOnly.stages.momentum.ruleCatalogues[36].categories.Public;delete radarOnly.stages.momentum.ruleCatalogues[36].categories.Popular;
 const radarT=S.template(radarOnly),radar=S.fieldsForUI(radarT).flatMap(g=>g.fields).find(f=>f.key==='momentum.radar.source');assert.deepEqual(radar.cachedCategories,['Pre','My'],'Radar exposes only its own source categories');
 assert.throws(()=>S.validateConfig({...defaults,'momentum.radar.source':'Public'},radarT),/available radar source/);
 const oldRadar=clone(cached);delete oldRadar.stages.momentum.ruleCatalogues[36];assert.equal(S.fieldsForUI(oldRadar).flatMap(g=>g.fields).find(f=>f.key==='momentum.radar.source').cachedCategories,undefined,'Existing STR-only archives retain on-demand Radar choices');
 assert.throws(()=>S.validateConfig({...defaults,'momentum.radar.source':'My','momentum.radar.rule':'0 My first'},oldRadar),/Refresh choices for Radar source|available radar rule/);
 for(let n=0;n<=3;n++){
  const empty=clone(cached),child=36+4*n,prefix=n?'momentum.strategy.'+n:'momentum.radar';empty.stages.momentum.ruleCatalogues[child].categories.My=[];
  const emptyT=S.template(empty),emptyConfig={...defaults,[prefix+'.source']:'My',[prefix+'.enabled']:false,[prefix+'.rule']:''};
  assert.equal(S.validateBaseline(S.configToBaseline(emptyConfig,emptyT)).setup.config[prefix+'.rule'],'');
  assert.throws(()=>S.validateConfig({...emptyConfig,[prefix+'.enabled']:true},emptyT),/No (strategy|radar) .* choices/);
  assert.throws(()=>S.validateConfig({...emptyConfig,[prefix+'.rule']:`${n} Pre first`},emptyT),/available (strategy|radar)/,'Even an inactive removed rule cannot use another category');
 }
 for(const mutate of [
  x=>{x.stages.momentum.ruleCatalogues=null;},x=>{x.stages.momentum.ruleCatalogues=[];},
  x=>{x.stages.momentum.ruleCatalogues[36]=clone(x.stages.momentum.ruleCatalogues[40]);},
  x=>{x.stages.momentum.ruleCatalogues[40].parentIndex=43;},x=>{x.stages.momentum.ruleCatalogues[40].gateIndex=46;},
  x=>{x.stages.momentum.ruleCatalogues[40].unexpected=true;},x=>{x.stages.momentum.ruleCatalogues[40].categories={};},
  x=>{x.stages.momentum.ruleCatalogues[40].categories=[];},x=>{x.stages.momentum.ruleCatalogues[40].categories.My=null;},
  x=>{x.stages.momentum.ruleCatalogues[40].categories.My=[{value:'v'}];},
  x=>{x.stages.momentum.ruleCatalogues[40].categories.My=[{value:'v',label:'Rule',disabled:'yes'}];},
  x=>{x.stages.momentum.ruleCatalogues[40].categories.My=['Rule\nline'];},
  x=>{x.stages.momentum.ruleCatalogues[40].categories.My=['Same','Same'];},
  x=>{x.stages.momentum.ruleCatalogues[40].categories.My=Array.from({length:3001},(_,i)=>'Rule '+i);},
  x=>{x.stages.momentum.ruleCatalogues[40].categories.Other=['Unknown'];},
  x=>{x.stages.momentum.options[39]=['Pre','My','Public',{value:'p',label:'Popular',disabled:true}];},
  x=>{x.stages.momentum.ruleCatalogues[40].categories.Pre=['Stale cached rule'];},
  x=>{x.stages.execution.ruleCatalogues={40:clone(x.stages.momentum.ruleCatalogues[40])};}
 ]){const invalid=clone(cached);mutate(invalid);assert.throws(()=>S.template(invalid),/Invalid|Ambiguous|not available|do not match/);}
 const limit=clone(cached);limit.stages.momentum.ruleCatalogues[40].categories.My=Array.from({length:3000},(_,i)=>'Rule '+i);assert.equal(S.template(limit).stages.momentum.ruleCatalogues[40].categories.My.length,3000);
 assert.equal(S.fieldsForUI(t).flatMap(g=>g.fields).find(f=>f.key==='momentum.strategy.1.source').cachedCategories,undefined);
 assert.equal(S.validateBaseline(clone(b)).id,b.id,'Legacy archives with no category metadata rebuild unchanged');
}
// RZone replaces each My/Public STR rule menu with a search input. Cached
// options remain exact labels while the expected source type follows category.
{
 const captured=clone(source),m=captured.stages.momentum,categories=['Pre','My','Public','Popular'];m.ruleCatalogues={};
 for(let n=1;n<=3;n++){
  const parent=35+4*n,child=parent+1,gate=parent+3,lists=Object.fromEntries(categories.map(category=>[category,[`${n} ${category} first`,`${n} ${category} second`,{value:'ambiguous',label:`${n} ${category} duplicated`,disabled:true}]]));
  m.options[parent]=categories;m.fields[parent].value='Public';m.fields[child].type='text';m.fields[child].value='';m.fields[gate].checked=false;m.fields[child].disabled=true;m.options[child]=clone(lists.Public);
  m.ruleCatalogues[child]={parentIndex:parent,gateIndex:gate,categories:lists,controlTypes:{Pre:'select-one',My:'text',Public:'text',Popular:'select-one'},searchQueries:{My:'private',Public:'public'}};
 }
 const current=S.template(captured),initial=S.defaults(current);assert.equal(S.validateBaseline(S.configToBaseline(initial,current)).setup.config['momentum.strategy.1.rule'],'','An initially Public search can be blank while off');
 for(let n=1;n<=3;n++)for(const category of categories){
  const prefix='momentum.strategy.'+n,child=36+n*4,config={...initial,[prefix+'.source']:category,[prefix+'.rule']:`${n} ${category} second`,[prefix+'.enabled']:true},baseline=S.configToBaseline(config,current),field=S.fieldsForUI(current,config).flatMap(g=>g.fields).find(f=>f.key===prefix+'.rule');
  assert.equal(field.type,'select','Vault presents source search results as exact choices');assert.equal(field.nativeType,['My','Public'].includes(category)?'text':'select-one');assert.equal(baseline.parameters.strategy.main.fields[child].type,field.nativeType);assert.deepEqual(S.validateBaseline(canonical(baseline)),canonical(baseline));
  assert.throws(()=>S.validateConfig({...config,[prefix+'.rule']:`${n} ${category} duplicated`},current),/available strategy/,'An ambiguous display label cannot execute');
  if(['My','Public'].includes(category))assert.equal(S.validateConfig({...config,[prefix+'.rule']:'',[prefix+'.enabled']:false},current)[prefix+'.rule'],'');
 }
 const startedPre=clone(captured);for(let n=1;n<=3;n++){const parent=35+n*4,child=parent+1;startedPre.stages.momentum.fields[parent].value='Pre';startedPre.stages.momentum.fields[child].type='select-one';startedPre.stages.momentum.fields[child].value=`${n} Pre first`;startedPre.stages.momentum.options[child]=clone(startedPre.stages.momentum.ruleCatalogues[child].categories.Pre);}
 const pre=S.template(startedPre),preConfig=S.defaults(pre),textBaseline=S.configToBaseline({...preConfig,'momentum.strategy.1.source':'My','momentum.strategy.1.rule':'1 My second','momentum.strategy.1.enabled':true},pre);assert.equal(textBaseline.parameters.strategy.main.fields[40].type,'text');assert.equal(S.validateBaseline(textBaseline).parameters.strategy.main.fields[40].value,'1 My second');assert.equal(textBaseline.setup.template.stages.momentum.fields[40].type,'select-one','Config never rewrites the captured native source');
 const labelled=clone(startedPre);for(let n=1;n<=3;n++){
  const parent=35+n*4,child=parent+1,catalogue=labelled.stages.momentum.ruleCatalogues[child];catalogue.fieldLabels=Object.fromEntries(categories.map(category=>[category,new Array(4).fill('Str '+n+' : / '+category+'i')]));for(let i=0;i<4;i++)labelled.stages.momentum.fields[parent+i].label=catalogue.fieldLabels.Pre[i];
 }
 const labelsT=S.template(labelled),labelsC=S.defaults(labelsT),labelsB=S.configToBaseline({...labelsC,'momentum.strategy.1.source':'Public','momentum.strategy.1.rule':'1 Public first','momentum.strategy.1.enabled':true},labelsT);assert.deepEqual(labelsB.parameters.strategy.main.fields.slice(39,43).map(f=>f.label),new Array(4).fill('Str 1 : / Publici'));assert.equal(S.validateBaseline(labelsB).parameters.strategy.main.fields[40].type,'text');assert.deepEqual(labelsB.setup.template.stages.momentum.fields.slice(39,43).map(f=>f.label),new Array(4).fill('Str 1 : / Prei'),'Captured badge labels remain immutable');
 for(const mutate of [x=>{x.stages.momentum.ruleCatalogues[40].fieldLabels=[];},x=>{delete x.stages.momentum.ruleCatalogues[40].fieldLabels.My;},x=>{x.stages.momentum.ruleCatalogues[40].fieldLabels.Other=['unexpected'];},x=>{x.stages.momentum.ruleCatalogues[40].fieldLabels.My=['too short'];},x=>{x.stages.momentum.ruleCatalogues[40].fieldLabels.My[0]='';},x=>{x.stages.momentum.ruleCatalogues[40].fieldLabels.My[1]=42;},x=>{x.stages.momentum.ruleCatalogues[40].fieldLabels.My[1]='x'.repeat(2001);},x=>{x.stages.momentum.ruleCatalogues[40].fieldLabels.Pre[2]='Wrong current label';}]){const invalid=clone(labelled);mutate(invalid);assert.throws(()=>S.template(invalid),/Invalid strategy field labels|field labels do not match/);}
 const forgedLabels=clone(labelsB);forgedLabels.parameters.strategy.main.fields[41].label='Str 1 : / Prei';assert.throws(()=>S.validateBaseline(forgedLabels),/altered/);
 const tampered=clone(textBaseline);tampered.parameters.strategy.main.fields[40].type='select-one';assert.throws(()=>S.validateBaseline(tampered),/altered/,'An imported baseline cannot lie about the source control type');
 const empty=clone(captured);empty.stages.momentum.ruleCatalogues[40].categories.Public=[];empty.stages.momentum.options[40]=[];const emptyT=S.template(empty),emptyC=S.defaults(emptyT);assert.equal(S.validateBaseline(S.configToBaseline(emptyC,emptyT)).setup.config['momentum.strategy.1.rule'],'');assert.throws(()=>S.validateConfig({...emptyC,'momentum.strategy.1.enabled':true},emptyT),/No strategy 1 rule choices/);
 for(const mutate of [
  x=>delete x.stages.momentum.ruleCatalogues,
  x=>delete x.stages.momentum.ruleCatalogues[40].controlTypes,
  x=>{x.stages.momentum.ruleCatalogues[40].controlTypes=null;},
  x=>{x.stages.momentum.ruleCatalogues[40].controlTypes=[];},
  x=>delete x.stages.momentum.ruleCatalogues[40].controlTypes.My,
  x=>{x.stages.momentum.ruleCatalogues[40].controlTypes.Other='text';},
  x=>{x.stages.momentum.ruleCatalogues[40].controlTypes.Pre='text';},
  x=>{x.stages.momentum.ruleCatalogues[40].controlTypes.Popular='text';},
  x=>{x.stages.momentum.ruleCatalogues[40].controlTypes.Public='select-one';},
  x=>{x.stages.momentum.ruleCatalogues[40].controlTypes.Public='password';},
  x=>{x.stages.momentum.ruleCatalogues[40].searchQueries.Public='';},
  x=>{x.stages.momentum.ruleCatalogues[40].searchQueries.Public=' padded ';},
  x=>{x.stages.momentum.ruleCatalogues[40].searchQueries.Public='Line\nfeed';},
  x=>{x.stages.momentum.ruleCatalogues[40].searchQueries.Public='x'.repeat(201);},
  x=>{x.stages.momentum.ruleCatalogues[40].searchQueries.Pre='not a search';},
  x=>{x.stages.momentum.ruleCatalogues[40].searchQueries=[];},
  x=>{x.stages.momentum.fields[40].value='Unlisted search text';},
  x=>{x.stages.momentum.ruleCatalogues[40].categories.Public=['Different choices'];}
 ]){const invalid=clone(captured);mutate(invalid);assert.throws(()=>S.template(invalid),/Invalid|does not match|do not match|absent/);}
 const radarText=clone(captured);radarText.stages.momentum.fields[35].value='My';radarText.stages.momentum.fields[36].type='text';radarText.stages.momentum.fields[36].value='';radarText.stages.momentum.options[36]=[];radarText.stages.momentum.ruleCatalogues[36]={parentIndex:35,gateIndex:34,categories:{My:[]},controlTypes:{My:'text'}};assert.throws(()=>S.template(radarText),/Invalid strategy rule control type|controls changed/,'Radar has no observed text-rule adapter');
 const noEvidence=clone(captured);delete noEvidence.stages.momentum.ruleCatalogues[40].searchQueries;assert.throws(()=>S.template(noEvidence),/need their source query/,'Populated search lists need the query that produced them');
 const unloaded=clone(empty);delete unloaded.stages.momentum.ruleCatalogues[40].searchQueries.Public;const unloadedT=S.template(unloaded),unloadedC=S.defaults(unloadedT);assert.equal(S.fieldsForUI(unloadedT).flatMap(g=>g.fields).find(f=>f.key==='momentum.strategy.1.rule').searchQuery,null);assert.throws(()=>S.validateConfig({...unloadedC,'momentum.strategy.1.enabled':true},unloadedT),/Search RZone/,'An unqueried category is not an empty search result');
}
// Exit rules use the same native/search contract, with their own stage and row.
for(const initial of ['Pre','Public']){
 const input=clone(source),x=input.stages.execution,categories=['Pre','My','Public','Popular'],option=value=>({value,label:value,disabled:false}),lists=Object.fromEntries(categories.map(category=>[category,[option('Exit '+category+' A'),option('Exit '+category+' B')]])),labels=Object.fromEntries(categories.map(category=>[category,new Array(3).fill('Exit Stratergy: / '+category+'i')]));
 x.fields[6].value=initial;x.fields[7].type=initial==='Public'?'text':'select-one';x.fields[7].value=lists[initial][0].value;x.fields[5].checked=false;x.fields[7].disabled=true;x.options[6]=categories.map(option);x.options[7]=lists[initial];[6,7,5].forEach((index,n)=>{x.fields[index].label=labels[initial][n];});
 x.ruleCatalogues={7:{parentIndex:6,gateIndex:5,categories:lists,controlTypes:{Pre:'select-one',My:'text',Public:'text',Popular:'select-one'},searchQueries:{My:'private',Public:'public'},fieldLabels:labels}};
 const template=S.template(input),defaults=S.defaults(template);
 for(const category of categories){
  const config={...defaults,'execution.exit.source':category,'execution.exit.rule':'Exit '+category+' A','execution.exit.enabled':true},baseline=S.configToBaseline(config,template),desc=S.fieldsForUI(template,config).flatMap(g=>g.fields).find(f=>f.key==='execution.exit.rule');
  assert.equal(desc.sourceKey,'execution.exit.source');assert.equal(desc.stage,'execution');assert.equal(desc.searchable,['My','Public'].includes(category));assert.equal(baseline.parameters.strategy.execution.fields[7].type,desc.nativeType);assert.equal(baseline.parameters.strategy.execution.fields[7].label,labels[category][1]);assert.deepEqual(S.validateBaseline(clone(baseline)),baseline);
  const plan=E.create({id:'exit-search-'+initial+'-'+category,name:'Exit rule variations',baseline,dimensions:[{key:'execution.exit.rule',values:lists[category].map(o=>o.value)}]});
  for(const trial of plan.trials){const expected=E.expected(plan,trial);assert.equal(expected.parameters.strategy.execution.fields[7].value,trial.patch['execution.exit.rule']);assert.equal(expected.parameters.strategy.execution.fields[7].type,desc.nativeType);S.validateBaseline(expected);}
  assert.throws(()=>E.create({id:'wrong-exit',name:'Wrong exit',baseline,dimensions:[{key:'execution.exit.rule',values:['Other category rule']}]}),/source values/);
 }
 const empty=clone(input);empty.stages.execution.ruleCatalogues[7].categories.Public=[];delete empty.stages.execution.ruleCatalogues[7].searchQueries.Public;
 if(initial==='Public'){empty.stages.execution.fields[7].value='';empty.stages.execution.options[7]=[];}
 const emptyT=S.template(empty),emptyConfig={...S.defaults(emptyT),'execution.exit.source':'Public','execution.exit.rule':'','execution.exit.enabled':false};S.validateBaseline(S.configToBaseline(emptyConfig,emptyT));assert.throws(()=>S.validateConfig({...emptyConfig,'execution.exit.enabled':true},emptyT),/Search RZone/);
 for(const alter of [s=>delete s.stages.execution.ruleCatalogues[7].controlTypes,s=>{s.stages.execution.ruleCatalogues[7].parentIndex=39;},s=>{s.stages.execution.ruleCatalogues[7].gateIndex=8;},s=>{s.stages.execution.ruleCatalogues[7].fieldLabels.My=['wrong'];},s=>{s.stages.execution.ruleCatalogues[7].controlTypes.Pre='text';},s=>{s.stages.execution.ruleCatalogues[7].labelDependents=[47,48,49,50];}]){
  const invalid=clone(input);alter(invalid);assert.throws(()=>S.template(invalid),/Invalid|need their source query/);
 }
}
// The observed STR2 prefix belongs to both rows; STR3 still has its own category.
for(const initial2 of ['Pre','Public'])for(const initial3 of ['Pre','My']){
 const input=clone(source),m=input.stages.momentum,categories=['Pre','My','Public','Popular'],option=value=>({value,label:value,disabled:false}),prefix=category=>'Str 2 : / '+category+'i / Source help',suffix=category=>'Str 3 : / '+category+'i';m.ruleCatalogues={};
 for(const [child,initial] of [[44,initial2],[48,initial3]]){
  const parent=child-1,gate=child+2,slot=child===44?2:3,lists=Object.fromEntries(categories.map(cat=>[cat,[option(slot+' '+cat+' A'),option(slot+' '+cat+' B')]])),fieldLabels=Object.fromEntries(categories.map(cat=>[cat,new Array(4).fill(slot===2?prefix(cat):prefix(initial2)+' → '+suffix(cat))]));
  m.fields[parent].value=initial;m.fields[child].type=['My','Public'].includes(initial)?'text':'select-one';m.fields[child].value=lists[initial][0].value;m.fields[gate].checked=false;m.fields[child].disabled=true;m.fields[child+1].disabled=true;m.options[parent]=categories.map(option);m.options[child]=lists[initial];for(let n=0;n<4;n++)m.fields[parent+n].label=fieldLabels[initial][n];
  m.ruleCatalogues[child]={parentIndex:parent,gateIndex:gate,categories:lists,controlTypes:{Pre:'select-one',My:'text',Public:'text',Popular:'select-one'},searchQueries:{My:'private',Public:'public'},fieldLabels,...(slot===2?{labelDependents:[47,48,49,50]}:{})};
 }
 const template=S.template(input),defaults=S.defaults(template);assert.deepEqual(S.projectRuleLabels(m.fields,m.ruleCatalogues,m.fields),m.fields.map(f=>f.label));
 for(const category2 of categories)for(const category3 of categories){const config={...defaults,'momentum.strategy.2.source':category2,'momentum.strategy.2.rule':'2 '+category2+' A','momentum.strategy.3.source':category3,'momentum.strategy.3.rule':'3 '+category3+' A'},baseline=S.configToBaseline(config,template),fields=baseline.parameters.strategy.main.fields;assert.ok(fields.slice(43,47).every(f=>f.label===prefix(category2)));assert.ok(fields.slice(47,51).every(f=>f.label===prefix(category2)+' → '+suffix(category3)));assert.deepEqual(S.validateBaseline(clone(baseline)),baseline);assert.equal(input.stages.momentum.fields[47].label,prefix(initial2)+' → '+suffix(initial3),'Projection never mutates its original source');}
 for(const alter of [s=>{s.stages.momentum.ruleCatalogues[44].labelDependents=[47,48,49];},s=>{s.stages.momentum.ruleCatalogues[44].labelDependents=[50,49,48,47];},s=>{s.stages.momentum.ruleCatalogues[48].labelDependents=[47,48,49,50];},s=>delete s.stages.momentum.ruleCatalogues[48].fieldLabels,s=>{s.stages.momentum.ruleCatalogues[48].fieldLabels.Public[1]='Unrelated prefix → Str 3 : / Publici';},s=>{s.stages.momentum.ruleCatalogues[44].fieldLabels.My[2]='Different row label';}]){const invalid=clone(input);alter(invalid);assert.throws(()=>S.template(invalid),/label dependenc|field labels/);}
}
{
 const input=clone(source);input.stages.momentum.supportedMarkets=['NSE'];const template=S.template(input),descriptor=S.fieldsForUI(template).flatMap(g=>g.fields).find(f=>f.key==='momentum.market');assert.equal(descriptor.options.find(o=>o.value==='BSE').disabled,true);assert.match(descriptor.options.find(o=>o.value==='BSE').reason,/different source layout/);assert.equal(template.stages.momentum.options[3].find(o=>o.value==='BSE').disabled,false,'Source choices remain original evidence');assert.throws(()=>S.validateConfig({...S.defaults(template),'momentum.market':'BSE'},template),/available market/);S.validateBaseline(S.configToBaseline(S.defaults(template),template));assert.equal(S.template(source).stages.momentum.supportedMarkets,undefined,'Legacy templates are not rewritten');S.validateBaseline(b);
 for(const change of [s=>{s.stages.momentum.supportedMarkets=['BSE'];},s=>{s.stages.momentum.fields[3].value='BSE';},s=>{s.stages.execution.supportedMarkets=['NSE'];}]){const invalid=clone(input);change(invalid);assert.throws(()=>S.template(invalid),/market layout/);}
}
// Main and execution charts are independent, and every visible native control
// belongs to one descriptor without reusing a Candle offset for a variant.
{
 const L=require('../dist/source-layouts.js');
 for(const momentumChart of L.charts)for(const executionChart of L.charts){
  const t=S.demoTemplate({momentumChart,executionChart}),config=S.defaults(t),fields=S.fieldsForUI(t).flatMap(g=>g.fields),base=S.configToBaseline(config,t),unchanged=clone(t);
  assert.equal(base.parameters.strategy.main.fields[0].value,momentumChart);assert.equal(base.parameters.strategy.execution.fields[3].value,executionChart);S.validateBaseline(clone(base));assert.deepEqual(t,unchanged);
  assert.equal(S.executionCapability(t).available,momentumChart==='Candle'&&executionChart==='Candle','Read/edit support cannot unlock a non-Candle live execution gate');
  for(const stage of ['momentum','execution','portfolio']){const indices=fields.filter(f=>f.stage===stage).flatMap(f=>f.indices||[f.index]);assert.deepEqual(indices.slice().sort((a,b)=>a-b),t.stages[stage].fields.map(f=>f.index),'Every '+stage+' native control is represented exactly once');}
  for(const stage of ['momentum','execution']){const layout=L.stage(stage,t.stages[stage].fields),descriptor=fields.find(f=>f.key===stage+'.chart');assert.equal(descriptor.dynamic,true);assert.equal(descriptor.chartContext,true);assert.ok(descriptor.options.every(o=>!o.disabled));if(!layout.variant)continue;
   assert.equal(fields.find(f=>f.key===stage+(layout.chart==='P&F'?'.box.size':'.brick.size')).index,layout.sizeIndex);assert.equal(fields.find(f=>f.key===stage+(layout.chart==='P&F'?'.box.reversal':'.brick.mode')).index,layout.modeIndex);
   const conflict=clone(t);for(const index of layout.priceIndices)conflict.stages[stage].fields[index].checked=true;const read=S.template(conflict);assert.deepEqual(layout.priceIndices.map(i=>read.stages[stage].fields[i].checked),[true,true]);assert.throws(()=>S.configToBaseline(S.defaults(read),read),/exactly one.*price mode/,'Conflicting source flags are preserved and blocked, not normalized');
  }
  for(let n=1;n<=3;n++){const input=fields.find(f=>f.key===`momentum.strategy.${n}.input`),timeframe=fields.find(f=>f.key===`momentum.strategy.${n}.timeframe`);if(momentumChart==='Candle')assert.ok(timeframe&&!input);else{assert.ok(input&&!timeframe);assert.equal(input.type,'number');assert.equal(input.index,39+n*4);assert.doesNotMatch(input.label,/timeframe/i);}}
  const bad=clone(t);bad.stages.execution.fields[0].type='text';assert.throws(()=>S.template(bad),/controls changed/);const blocked=clone(t);blocked.stages.momentum.fields[L.main(momentumChart).rsIndex].checked=true;assert.throws(()=>S.template(blocked),/Relative Strength off/);
 }
 for(const stage of ['momentum','execution'])for(const mode of ['Absolute','Percent','ATR','ATR %']){const t=S.demoTemplate({momentumChart:'Renko',executionChart:'Renko'}),layout=L.stage(stage,t.stages[stage].fields);t.stages[stage].fields[layout.modeIndex].value=mode;t.stages[stage].fields[layout.sizeIndex].value=mode.startsWith('ATR')?'14':mode==='Absolute'?'10':'1';const loaded=S.template(t),config=S.defaults(loaded),f=S.fieldsForUI(loaded).flatMap(g=>g.fields).find(f=>f.key===stage+'.brick.size');assert.equal(f.integer,mode.startsWith('ATR'));S.validateBaseline(S.configToBaseline(config,loaded));if(mode.startsWith('ATR'))assert.throws(()=>S.validateConfig({...config,[stage+'.brick.size']:1.5},loaded),/whole number/);assert.throws(()=>S.validateConfig({...config,[stage+'.brick.mode']:mode==='Percent'?'Absolute':'Percent'},loaded),/Refresh choices/);}
 // Text search children and observed nested labels use the chart's own rows.
 for(const chart of ['P&F','Renko'])for(const stage of ['momentum','execution']){
  const source=S.demoTemplate({momentumChart:chart,executionChart:chart}),s=source.stages[stage],layout=L.stage(stage,s.fields),categories=['Pre','My','Public','Popular'],option=value=>({value,label:value,disabled:false});s.ruleCatalogues={};
  for(const [n,row] of layout.rows.entries()){
   if(row.name==='Radar')continue;const prefix=stage==='execution'?'Exit Stratergy:':'Str '+n+' :',parentRow=layout.rows[2],label=category=>stage==='momentum'&&n===3?'Str 2 : / Prei → '+prefix+' / '+category+'i':prefix+' / '+category+'i',lists=Object.fromEntries(categories.map(category=>[category,[option(chart+' '+row.name+' '+category)]])),rowIndices=[row.parentIndex,row.childIndex,...(row.valueIndex===undefined?[]:[row.valueIndex]),row.gateIndex],fieldLabels=Object.fromEntries(categories.map(category=>[category,rowIndices.map(()=>label(category))]));
   s.fields[row.parentIndex].value='Pre';s.fields[row.childIndex].value=lists.Pre[0].value;s.fields[row.gateIndex].checked=false;s.options[row.parentIndex]=categories.map(option);s.options[row.childIndex]=lists.Pre;rowIndices.forEach((index,n)=>s.fields[index].label=fieldLabels.Pre[n]);s.ruleCatalogues[row.childIndex]={parentIndex:row.parentIndex,gateIndex:row.gateIndex,categories:lists,controlTypes:{Pre:'select-one',My:'text',Public:'text',Popular:'select-one'},searchQueries:{My:'private',Public:'public'},fieldLabels,...(stage==='momentum'&&row===parentRow?{labelDependents:layout.labelDependents[row.childIndex]}:{})};
  }
  const t=S.template(source),config=S.defaults(t);for(const category of categories){const next={...config};for(const [n,row] of layout.rows.entries()){if(row.name==='Radar')continue;const key=stage==='execution'?'execution.exit':'momentum.strategy.'+n;next[key+'.source']=category;next[key+'.rule']=chart+' '+row.name+' '+category;next[key+'.enabled']=true;}const baseline=S.configToBaseline(next,t),actual=E.fields(baseline,stage);S.validateBaseline(clone(baseline));for(const row of layout.rows.filter(r=>r.name!=='Radar'))assert.equal(actual[row.childIndex].type,['My','Public'].includes(category)?'text':'select-one');if(stage==='momentum')assert.ok(actual.slice(49,53).every(f=>f.label==='Str 2 : / '+category+'i → Str 3 : / '+category+'i'));}
  const misplaced=clone(t),child=layout.rows.at(-1).childIndex;misplaced.stages[stage].ruleCatalogues[child].parentIndex=stage==='execution'?6:47;assert.throws(()=>S.template(misplaced),/association/,'Candle rule metadata cannot be reused at variant offsets');
 }
}
// Reusing a saved trial starts from its exact three recorded stages, never the
// latest source defaults, while menus and execution capability remain current.
{
 const run={...clone(fixture),demo:false,parameters:clone(b.parameters)},before=clone(run),sourceBefore=clone(t),copied=S.configFromRun(run,t),rebuilt=S.configToBaseline(copied,t);
 assert.deepEqual(copied,b.setup.config,'All edited strategy, date, exit and portfolio inputs hydrate together');
 assert.equal(copied['momentum.period.2.enabled'],true);assert.equal(copied['momentum.period.2.weight'],0.5);assert.equal(copied['portfolio.capital'],250000);assert.equal(copied['portfolio.daily-limit'],2);assert.equal(copied['execution.from'],'2024-02-29');
 assert.deepEqual(rebuilt.parameters,b.parameters,'Hydrated config reconstructs every submitted value, flag and native radio identity');assert.deepEqual(run,before);assert.deepEqual(t,sourceBefore);
 assert.deepEqual(S.savedRunContext(run),{config:{'momentum.chart':'Candle','momentum.market':'BSE','execution.chart':'Candle'},changes:[{momentum:{0:'Candle'}},{momentum:{3:'BSE'}},{execution:{3:'Candle'}}]});
 const removed=clone(run);removed.parameters.strategy.main.fields[40].value='Removed strategy';const unavailable=S.configFromRun(removed,t);assert.equal(unavailable['momentum.strategy.1.rule'],'Removed strategy');assert.throws(()=>S.validateConfig(unavailable,t),/available strategy 1 rule/i,'A missing saved choice is retained for review and cannot silently use a current default');
 const removedInactive=clone(removed);removedInactive.parameters.strategy.main.fields[42].checked=false;assert.throws(()=>S.validateConfig(S.configFromRun(removedInactive,t),t),/available strategy 1 rule/i,'Unavailable inactive choices are not silently replaced either');
 const searched=clone(run);searched.parameters.strategy.main.fields[39].value='My';searched.parameters.strategy.main.fields[40].value='Saved private rule';searched.parameters.strategy.main.fields[40].type='text';const unsearched=S.configFromRun(searched,t);assert.equal(unsearched['momentum.strategy.1.source'],'My');assert.equal(unsearched['momentum.strategy.1.rule'],'Saved private rule');assert.throws(()=>S.validateConfig(unsearched,t),/available strategy 1 source|Refresh choices/i,'Archived private names are not evidence of a current offered search result');
 const inactive=clone(run);inactive.parameters.settings.fields[0].checked=false;assert.equal(S.configFromRun(inactive,t)['portfolio.enabled'],false);assert.throws(()=>S.validateConfig(S.configFromRun(inactive,t),t),/not available/,'A required flag is retained and blocked instead of being turned on during hydration');
 for(const mutate of [r=>{r.provenance='unverified';},r=>{delete r.parameters.settings;},r=>{r.parameters.strategy.main.fields[12].index=13;},r=>{r.parameters.strategy.main.fields[12].value=null;},r=>{r.parameters.strategy.auxiliarySettingsUncaptured=true;},r=>{r.parameters.strategy.main.fields[51].checked=true;},r=>{r.parameters.settings.fields[2].label='Unrecognized portfolio input';}]){const invalid=clone(run);mutate(invalid);assert.throws(()=>S.configFromRun(invalid,t),'Malformed, incomplete and unsupported recorded layouts cannot acquire source defaults');}
 assert.throws(()=>S.configFromRun(fixture,t),/Real and fictional/);
 const ambiguous=clone(run);ambiguous.parameters.strategy.main.fields[8].checked=true;assert.throws(()=>S.configFromRun(ambiguous,t),/exactly one retracement/,'Conflicting archive radio groups cannot be converted into one arbitrarily selected value');
 const L=require('../dist/source-layouts.js');
 for(const momentumChart of L.charts)for(const executionChart of L.charts){
  const live=S.demoTemplate({momentumChart,executionChart}),saved=S.configToBaseline({...S.defaults(live),'momentum.period.1':252,'execution.from':'2020-01-01','portfolio.capital':450000},live),record={...clone(fixture),parameters:clone(saved.parameters)},config=S.configFromRun(record,live);
  assert.deepEqual(S.configToBaseline(config,live).parameters,saved.parameters);assert.equal(S.executionCapability(live).available,momentumChart==='Candle'&&executionChart==='Candle','Reusing a variant is no new live execution approval');
  const context=S.savedRunContext(record);assert.equal(context.config['momentum.chart'],momentumChart);assert.equal(context.config['execution.chart'],executionChart);assert.ok(context.changes.every(change=>Object.values(change).flatMap(Object.keys).length===1));
  if(momentumChart!=='Candle'||executionChart!=='Candle')assert.throws(()=>S.configFromRun(record,S.demoTemplate()),/Load the saved/,'Independent main and execution contexts must be loaded before field positions are reused');
 }
 const renko=S.demoTemplate({momentumChart:'Renko',executionChart:'Renko',momentumBrickMode:'ATR',executionBrickMode:'Absolute'}),saved=S.configToBaseline(S.defaults(renko),renko),record={...clone(fixture),parameters:clone(saved.parameters)},context=S.savedRunContext(record);
 assert.equal(context.config['momentum.brick.mode'],'ATR');assert.equal(context.config['execution.brick.mode'],'Absolute');assert.deepEqual(context.changes.slice(-2),[{momentum:{55:'ATR'}},{execution:{5:'Absolute'}}]);assert.throws(()=>S.configFromRun(record,S.demoTemplate({momentumChart:'Renko',executionChart:'Renko'})),/Load the saved/,'ATR periods cannot hydrate into Percent sizes');
}
console.log('PASS: exact saved-run re-use with current-menu validation, independent chart contexts, chart-scoped main/execution layouts, exact field coverage, numeric strategy inputs, mode-specific sizing, conflicting price-state preservation, native/search catalogues and label dependencies, immutable reconstruction and legacy archives.');
