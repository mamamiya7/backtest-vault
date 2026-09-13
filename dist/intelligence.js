/* Explainable research comparisons. Original runs are never changed. */
(function(root){
'use strict';
const V=typeof module!=='undefined'?require('./core.js'):root.Vault;
const P=typeof module!=='undefined'?require('./presentation.js'):root.VaultPresentation;
const DAY=86400000,clean=V.clean,norm=x=>clean(x).toLowerCase();
function date(value){
 const s=clean(value);let y,m,d,match;
 if((match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s))){[,y,m,d]=match.map(Number);}
 else if((match=/^(\d{1,2})[- /]([A-Za-z]{3})[- /](\d{2}|\d{4})$/.exec(s))){d=+match[1];m='jan feb mar apr may jun jul aug sep oct nov dec'.split(' ').indexOf(match[2].toLowerCase())+1;y=+match[3];if(y<100)y+=y>=70?1900:2000;}
 else return null;
 const t=Date.UTC(y,m-1,d),v=new Date(t);return v.getUTCFullYear()===y&&v.getUTCMonth()===m-1&&v.getUTCDate()===d?v.toISOString().slice(0,10):null;
}
const days=(a,b)=>(Date.parse(b)-Date.parse(a))/DAY;
function stat(run,label){const values=run.quickStats.filter(x=>norm(x.label)===norm(label));return values.length===1?V.number(values[0].value):null;}
function inspect(run){
 const errors=V.assessment(run),cautions=[],metrics=V.metrics(run),stages=P.settings(run),rows=new Map();
 for(const s of stages){if(s.key==='observed')continue;if(s.groups.some(g=>g.name==='Captured settings'))errors.push(s.title+': unknown setting layout.');for(const g of s.groups)for(const r of g.rows)rows.set(s.key+'.'+r.key,r);}
 const value=k=>rows.get(k)?.value,details=V.details(run),from=date(value('execution.from')),to=date(value('execution.to'));
 const capital=V.number(value('portfolio.capital')),limits=rows.get('portfolio.daily-limit');
 const controls={
  'Universe':value('momentum.group'),'Market':value('momentum.market'),'Timeframe':value('momentum.timeframe'),
  'From':from,'To':to,'Initial capital':capital,'Allocation':value('portfolio.allocation'),
  'Maximum open trades':V.number(value('portfolio.max-open')),'Daily stock limit':limits?.checked===false?'Off':limits?.checked===true?V.number(limits.value):null,
  'Momentum chart':value('momentum.chart'),'Execution chart':value('execution.chart'),'Execution price mode':value('execution.price-mode')||(value('execution.chart')==='Candle'?'Candle model unverified':null),'Data':run.demo===true?'Fictional':'Real'
 };
 for(const [key,v] of Object.entries(controls))if(v===undefined||v===null||clean(v)==='')errors.push('Missing comparable control: '+key+'.');
 if(rows.get('portfolio.enabled')?.checked!==true)errors.push('Portfolio testing is not confirmed enabled.');
 if(!from||!to||days(from,to)<=0)errors.push('A valid, positive comparison period is required.');
 for(const [field,expected] of [['group',controls.Universe],['segment',controls.Market],['timeframe',controls.Timeframe]])if(details[field]&&norm(details[field])!==norm(expected))errors.push('Submitted '+field+' differs from the report.');
 if(details.from&&date(details.from)!==from)errors.push('Submitted start date differs from the report.');
 if(details.to&&date(details.to)!==to)errors.push('Submitted end date differs from the report.');
 if(!(capital>0)||metrics.capital===null||Math.abs(capital-metrics.capital)>.01)errors.push('Submitted and reported initial capital do not match.');
 if(metrics.returns===null||metrics.returns < -100)errors.push('Gross total return is missing or invalid.');
 if(metrics.drawdown===null||metrics.drawdown<0||metrics.drawdown>100)errors.push('Max drawdown must be between 0% and 100%.');
 const sourceCagr=stat(run,'CAGR'),cagr=sourceCagr!==null&&sourceCagr>=-100?sourceCagr:null,calmar=cagr!==null&&metrics.drawdown>0?cagr/metrics.drawdown:null;
 if(cagr===null)cautions.push('CAGR is unavailable: derived Calmar is not ranked. Annualized Returns is kept separate.');
 if(metrics.drawdown===0)cautions.push('Zero reported drawdown: Calmar is undefined, not infinite.');
 const periodDays=from&&to?days(from,to):0;
 if(periodDays<365)cautions.push('Less than one year: annualized figures can exaggerate a short sample.');
 if(metrics.trades===null||metrics.trades<30)cautions.push('Fewer than 30 reported trades: a small-sample flag, not a statistical confidence test.');
 const qty=run.trades.headers.findIndex(x=>/^qty$/i.test(x));
 const zeroQty=qty<0?null:run.trades.rows.filter(r=>V.number(r[qty])===0).length;
 if(zeroQty)cautions.push(zeroQty+' zero-quantity rows are included in reported trade counts.');
 cautions.push('Trading costs, dividends, cash flows, leverage and equity valuation frequency are not verified by the captured form.');
 const fingerprint=JSON.stringify([controls,[...rows].sort(([a],[b])=>a.localeCompare(b)).map(([k,r])=>[k,r.checked===false?'Off':[r.value,r.weight,r.detail,r.checked]]),run.quickStats,run.trades]);
 return {run,controls,rows,from,to,periodDays,metrics,cagr,calmar,zeroQty,errors:[...new Set(errors)],cautions:[...new Set(cautions)],fingerprint};
}
function leaders(items,key,ascending=false){
 const valid=items.filter(x=>Number.isFinite(x[key]));if(!valid.length)return [];
 const best=(ascending?Math.min:Math.max)(...valid.map(x=>x[key]));
 return valid.filter(x=>Math.abs(x[key]-best)<1e-9);
}
function analyze(runs,{drawdownLimit=null}={}){
 if(drawdownLimit!==null&&(!Number.isFinite(drawdownLimit)||drawdownLimit<0||drawdownLimit>100))throw Error('Drawdown ceiling must be between 0 and 100.');
 const groups=new Map(),blocked=[],seen=new Map(),duplicates=[];
 for(const run of runs){let item;try{V.validate(run);item=inspect(run);}catch(e){blocked.push({run,errors:[e.message]});continue;}
  if(item.errors.length){blocked.push(item);continue;}
  if(seen.has(item.fingerprint)){duplicates.push({run,original:seen.get(item.fingerprint)});continue;}seen.set(item.fingerprint,run);
  const key=JSON.stringify(Object.values(item.controls).map(x=>typeof x==='string'?norm(x):x));
  if(!groups.has(key))groups.set(key,{key,controls:item.controls,items:[]});groups.get(key).items.push(item);
 }
 const result=[...groups.values()].map(group=>{
  for(const item of group.items){Object.assign(item,{returns:item.metrics.returns,drawdown:item.metrics.drawdown,withinLimit:drawdownLimit===null||item.metrics.drawdown<=drawdownLimit});}
  const eligible=group.items.filter(x=>x.withinLimit),returnLeaders=leaders(eligible,'returns'),riskLeaders=leaders(eligible,'drawdown',true),calmarLeaders=leaders(eligible,'calmar');
  for(const item of group.items){item.dominatedBy=eligible.filter(other=>other!==item&&other.returns>=item.returns&&other.drawdown<=item.drawdown&&(other.returns>item.returns||other.drawdown<item.drawdown)).map(x=>x.run.name);}
  const known=new Set(group.items.flatMap(x=>[...x.rows.keys()])),differences=[...known].filter(key=>new Set(group.items.map(x=>{const r=x.rows.get(key);return r?P.settingText(r):'Not captured';})).size>1).map(key=>({label:group.items.find(x=>x.rows.has(key)).rows.get(key).label,key,values:group.items.map(x=>x.rows.has(key)?P.settingText(x.rows.get(key)):'Not captured')}));
  let verdict;
  if(group.items.length<2)verdict='No peer with the same recorded controls. Keep this run separate.';
  else if(!eligible.length)verdict='No run meets your drawdown ceiling.';
  else if(calmarLeaders.length===1&&eligible.length>=2&&eligible.every(x=>x.calmar!==null)){const lead=calmarLeaders[0];verdict=lead.run.name+' leads on derived Calmar ('+lead.calmar.toFixed(2)+') among comparable reported results. '+(lead.returns>0?'It is a research candidate, not a proven winner.':'Its return is negative: the highest ratio does not make it a winning strategy.');}
  else verdict='No single Calmar winner can be named. Compare return leaders, drawdown leaders and the missing evidence below.';
  return {...group,eligible,returnLeaders,riskLeaders,calmarLeaders,differences,verdict};
 });
 return {groups:result,blocked,duplicates,total:runs.length};
}
// Competition ranks preserve ties; missing values and ceiling failures stay unranked.
function ranking(group,basis='calmar'){
 if(!['calmar','returns','drawdown'].includes(basis))throw Error('Unknown ranking measure.');
 const valid=group.items.filter(x=>x.rankEligible!==false&&x.withinLimit&&Number.isFinite(x[basis])).sort((a,b)=>(basis==='drawdown'?a[basis]-b[basis]:b[basis]-a[basis])||String(a.run.name||a.run.id).localeCompare(String(b.run.name||b.run.id)));
 const ranked=valid.map((item,i)=>({item,rank:valid.length<2?null:valid.findIndex(x=>Math.abs(x[basis]-item[basis])<1e-9)+1}));
 return [...ranked,...group.items.filter(x=>!valid.includes(x)).map(item=>({item,rank:null}))];
}
// Exploratory ordering spans groups; it never changes strict groups or pools returns.
function overview(analysis){
 const accepted=new Map(),items=[];
 analysis.groups.forEach((g,i)=>g.items.forEach(x=>{const item={...x,groupKey:g.key,groupNumber:i+1,rankEligible:true,status:'Reviewed capture'};accepted.set(x.run,item);items.push(item);}));
 for(const x of analysis.blocked)items.push({...x,controls:x.controls||{},rows:x.rows||new Map(),metrics:x.metrics||{},returns:x.metrics?.returns??null,drawdown:x.metrics?.drawdown??null,cagr:x.cagr??null,calmar:x.calmar??null,rankEligible:false,withinLimit:false,status:'Needs review',cautions:x.cautions||[]});
 for(const x of analysis.duplicates){const original=accepted.get(x.original);items.push({...original,run:x.run,rankEligible:false,status:'Repeated result',duplicateOf:x.original.name||x.original.id});}
 const mixedData=items.some(x=>x.run.demo===true)&&items.some(x=>x.run.demo!==true);
 if(mixedData)for(const x of items)if(x.run.demo===true){x.rankEligible=false;x.fictionalExcluded=true;}
 const conditionKeys=[...new Set(items.flatMap(x=>Object.keys(x.controls)))];
 const conditions=conditionKeys.map(key=>{const values=items.map(x=>x.controls[key]??'Not captured');return {key,label:key,values,different:new Set(values.map(v=>typeof v==='string'?norm(v):v)).size>1};});
 const settingKeys=[...new Set(items.flatMap(x=>[...x.rows.keys()]))];
 const settings=settingKeys.map(key=>{const values=items.map(x=>x.rows.has(key)?P.settingText(x.rows.get(key)):'Not captured');return {key,label:items.find(x=>x.rows.has(key)).rows.get(key).label,values,different:new Set(values).size>1};});
 const reports=items.map(x=>{
  try{V.validate(x.run);}catch{return new Map();}
  const map=new Map(),sections=new Map();
  for(const section of [{title:'Quick stats',rows:(x.run.quickStats||[]).map(s=>[s.label,s.value])},...(x.run.statistics||[])]){
   const occurrence=(sections.get(section.title)||0)+1;sections.set(section.title,occurrence);const labels=new Map();
   for(const row of section.rows){const n=(labels.get(row[0])||0)+1;labels.set(row[0],n);const key=JSON.stringify([section.title,occurrence,row[0],n]);map.set(key,{label:section.title+(occurrence>1?' '+occurrence:'')+' · '+row[0]+(n>1?' ('+n+')':''),metricLabel:row[0],values:row.slice(1)});}
  }return map;
 });
 const reportKeys=[...new Set(reports.flatMap(m=>[...m.keys()]))],statistics=reportKeys.map(key=>({key,...reports.find(m=>m.has(key)).get(key),values:reports.map(m=>m.get(key)?.values??null)}));
 return {...analysis,items,conditions,settings,statistics,mixedData};
}
function csvRows(text){
 if(typeof text!=='string'||text.length>20*1024*1024)throw Error('Benchmark CSV must be smaller than 20 MB.');
 const rows=[];let row=[],field='',quoted=false;
 text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(quoted||field==='')quoted=!quoted;else throw Error('Invalid CSV quoting.');}else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>clean(x)))rows.push(row);row=[];field='';}else field+=c;}
 if(quoted)throw Error('Unclosed CSV quote.');row.push(field);if(row.some(x=>clean(x)))rows.push(row);return rows;
}
function parseBenchmark(text,{id,name='Nifty 50',kind='total-return',source='User-imported CSV',demo=false}={}){
 const rows=csvRows(text),header=rows.shift()?.map(norm)||[],di=header.indexOf('date');
 const vi=kind==='total-return'?header.findIndex(x=>['total returns index','total return index','tri','value'].includes(x)):header.findIndex(x=>['close','closing value','value'].includes(x));
 if(di<0||vi<0)throw Error('Expected Date and '+(kind==='total-return'?'Total Returns Index (or Value)':'Close (or Value)')+' columns. Use ISO dates or DD-Mon-YYYY.');
 const ni=header.findIndex(x=>['index name','indexname'].includes(x)),names=ni<0?[]:[...new Set(rows.map(r=>norm(r[ni])))];
 if(names.length>1)throw Error('Import only one index per CSV.');
 if(names.length===1&&names[0]!==norm(name))throw Error('Index Name in the CSV does not match the selected index.');
 const points=rows.map(r=>({date:date(r[di]),value:V.number(r[vi])}));
 const benchmark={schemaVersion:1,id:id||'benchmark-'+Date.now(),name,kind,source,importedAt:new Date().toISOString(),demo,points};
 validateBenchmark(benchmark);benchmark.points.sort((a,b)=>a.date.localeCompare(b.date));return benchmark;
}
function validateBenchmark(b){
 if(!b||b.schemaVersion!==1||typeof b.id!=='string'||!b.id||b.id.length>150||typeof b.name!=='string'||!b.name||b.name.length>200||!['price','total-return'].includes(b.kind)||typeof b.source!=='string'||b.source.length>500||typeof b.demo!=='boolean'||!Array.isArray(b.points)||b.points.length<2||b.points.length>50000)throw Error('Invalid benchmark record.');
 const dates=new Set();
 for(const p of b.points){if(!p||typeof p.date!=='string'||!date(p.date)||date(p.date)!==p.date||typeof p.value!=='number'||!Number.isFinite(p.value)||p.value<=0)throw Error('Invalid benchmark date or non-positive index value.');if(dates.has(p.date))throw Error('Duplicate benchmark date: '+p.date);dates.add(p.date);}
 return b;
}
function benchmarkFor(item,b){
 if(!b)return {available:false,reason:'Import a Nifty index CSV to compare the same period.'};
 try{validateBenchmark(b);}catch(e){return {available:false,reason:e.message};}
 if((item.run.demo===true)!==b.demo)return {available:false,reason:'Fictional and real data cannot be mixed.'};
 const all=[...b.points].sort((a,b)=>a.date.localeCompare(b.date));
 if(all[0].date>item.from||all.at(-1).date<item.to){
  // Only allow short edge shifts for non-trading days; always disclose dates.
  if(days(item.from,all[0].date)>4||days(all.at(-1).date,item.to)>4)return {available:false,reason:'Benchmark data does not cover this run’s dates.'};
 }
 const points=all.filter(p=>p.date>=item.from&&p.date<=item.to);if(points.length<2)return {available:false,reason:'At least two index observations inside the run period are required.'};
 const first=points[0],last=points.at(-1);
 if(days(item.from,first.date)>4||days(last.date,item.to)>4)return {available:false,reason:'Benchmark observations near the requested start or end are missing.'};
 const span=days(first.date,last.date),ratio=last.value/first.value,returns=(ratio-1)*100,annualized=(ratio**(365.25/span)-1)*100,cagr=Number.isFinite(annualized)?annualized:null;
 if(!Number.isFinite(returns)||!Number.isFinite(item.metrics.capital*ratio))return {available:false,reason:'Benchmark values produce an invalid return or capital amount.'};
 let peak=first.value,dd=0,maxGap=0;points.forEach((p,i)=>{peak=Math.max(peak,p.value);dd=Math.max(dd,(1-p.value/peak)*100);if(i)maxGap=Math.max(maxGap,days(points[i-1].date,p.date));});
 const sparse=points.length<Math.max(3,span*.45)||maxGap>7,shifted=first.date!==item.from||last.date!==item.to;
 const cautions=['Reference return before trading costs. Strategy dividend/cost treatment is unverified; excess return is descriptive, not risk-adjusted alpha.','Drawdown uses imported closing observations, which may differ from the strategy’s valuation frequency.'];
 if(shifted)cautions.push('Effective benchmark dates differ: '+first.date+' to '+last.date+'. This is an approximate period comparison; calendar coverage has not been independently verified.');
 if(cagr===null)cautions.push('Annualized growth is outside the supported numeric range and is withheld.');
 if(sparse)cautions.push('Sparse observations or long gaps: benchmark drawdown and Calmar are withheld.');
 return {available:true,benchmark:b,from:first.date,to:last.date,points:points.length,returns,cagr,drawdown:sparse?null:dd,calmar:!sparse&&dd>0&&cagr!==null?cagr/dd:null,excess:item.metrics.returns-returns,endingCapital:item.metrics.capital*ratio,shifted,sparse,cautions};
}
const api={date,days,inspect,analyze,ranking,overview,parseBenchmark,validateBenchmark,benchmarkFor};
if(typeof module!=='undefined')module.exports=api;root.VaultIntelligence=api;
})(typeof window!=='undefined'?window:globalThis);
