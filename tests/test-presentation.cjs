const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const P=require('../dist/presentation.js');
const V=require('../dist/core.js');

assert.equal(P.cell('150000.00').text,'1,50,000.00');
assert.equal(P.metric('CAGR','-6.37%').text,'-6.37%');
assert.equal(P.metric('Calmer Ratio','0.09% ↓').text,'+0.09%','Down arrow must not turn a positive number negative');
assert.equal(P.metric('Expectancy','-0.29 ↑').text,'-0.29','An explicit minus remains authoritative');
assert.equal(P.metric('Total no. of Trades','65').text,'65');
assert.equal(P.metric('Average Holding Period','24.83 days').text,'24.83 days');
assert.equal(P.metric('Min Holding Period','1 days').text,'1 day');
assert.equal(P.metric('Annualized Returns','-').text,'—');
assert.equal(P.cell('₹ -3338',{signed:true}).text,'-₹3,338.00');
assert.equal(P.cell('-0.00',{signed:true}).text,'0.00');
assert.equal(P.cell('0.001',{signed:true}).text,'+0.001','Formatting must not hide a small nonzero value');
assert.equal(P.tradeCell('Qty','0').text,'0');
assert.equal(P.tradeCell('Qty','0.25').text,'0.25');
assert.equal(P.tradeCell('Symbol','1234').text,'1234');
assert.equal(P.tradeCell('Entry Date','1-Jan 25').text,'1-Jan 25');
assert.equal(P.tradeCell('G/L %','4.5').text,'+4.50%');
assert.equal(P.tradeCell('P/L','2800').text,'+2,800.00');
assert.equal(P.tradeCell('P/L','-2800').text,'-2,800.00');
assert.equal(P.tradeCell('Entry Date','1-Jan 25').sortValue,'2025-01-01');
assert.equal(P.tradeCell('Exit Date','28-Dec-2024').sortValue,'2024-12-28');
for(const direction of ['ascending','descending']){
 const sorted=[null,12,-2,0,2,NaN].sort((a,b)=>P.compareValues(a,b,direction));
 assert.deepEqual(sorted.slice(0,4),direction==='ascending'?[-2,0,2,12]:[12,2,0,-2]);assert.equal(sorted[4],null);assert.ok(Number.isNaN(sorted[5]));
}
assert.ok(P.compareValues('Strategy 2','Strategy 10')<0);
assert.ok(P.compareValues(P.tradeCell('Entry Date','28-Dec 24').sortValue,P.tradeCell('Entry Date','1-Jan 25').sortValue)<0);
assert.equal(P.cell('↑').text,'↑','An annotation alone is not a number');
assert.equal(P.settingText({value:'—',checked:true}),'On','A standalone toggle needs only its state');

// Representative captured Candle form: preserve the original messy contexts.
const snapshot=items=>({at:'2026-09-13T06:00:00Z',fields:items.map(([type,label,value,checked=null,disabled=false],index)=>({index,type,label,value,checked,disabled}))});
const items=[
 ['select-one','Chart Type :','Candle'],['text','Chart Type : → Group :','Example group'],['checkbox','Chart Type : → Group :','on',false],['select-one','Market : / Retracement :','NSE'],
 ['checkbox','Market : / Retracement : → 52 Week High / 52 Week Low / ATH / ATL','on',true],['text','Market : / Retracement : → 52 Week High / 52 Week Low / ATH / ATL','30'],['select-one','Market : / Retracement : → 52 Week High / 52 Week Low / ATH / ATL','Within'],
 ...['52 Week High','52 Week Low','ATH','ATL'].map((_,i)=>['radio','Market : / Retracement : → 52 Week High / 52 Week Low / ATH / ATL','on',i===2]),
 ...['252','120','90','60'].flatMap((value,i)=>[['checkbox','Period :','on',i>=2],['text','Period :',value,null,i<2]]),
 ['text','Period : → Volume above : / Average / Highest','0'],['radio','Period : → Volume above : / Average / Highest','on',false],['radio','Period : → Volume above : / Average / Highest','on',true],
 ...['1','1','2','1'].map(value=>['text','Weight : / EMA :',value]),
 ...['150','40','15'].flatMap(value=>[['checkbox','Weight : / EMA : → TMA Trend','on',true],['text','Weight : / EMA : → TMA Trend',value]]),
 ['checkbox','Weight : / EMA : → TMA Trend','on',true],['select-one','Timeframe :','Daily'],
 ['checkbox','Trend Quality / > → Radar :','on',false],['select-one','Trend Quality / > → Radar :','Pre'],['select-one','Trend Quality / > → Radar :','MIP - Momentify',null,true],['checkbox','Timeframe : → Trend Quality / >','on',true],['text','Timeframe : → Trend Quality / >','40']
];
for(let i=1;i<=3;i++){
 const label=i===1?'Str 1 : / Prei':"Str 2 : / Prei / iThis feature can help you to look at combined result of the group of stocks."+(i===3?' → Str 3 : / Prei':'');
 items.push(['select-one',label,'Pre'],['select-one',label,i===3?'Close greater than open':'-- Select Predefined System --',null,i!==3],['select-one',label,i===3?'Weekly':'Daily',null,i!==3],['checkbox',label,'on',i===3]);
}
items.push(['checkbox','Relative Strength : / NSE','on',true],['select-one','Relative Strength : / NSE','NSE'],['text','Relative Strength : / NSE','Nifty 50'],['select-one','RS SB : / Prei','Pre'],['select-one','RS SB : / Prei','Rising ratio line']);
const run={schemaVersion:1,id:'presentation-a',name:'Formatting check',savedAt:'2026-09-13T06:00:00Z',provenance:'recorded-at-submit',parameters:{strategy:{main:snapshot(items),execution:snapshot([
 ['select-one','Rank Criteria :','Return Percent'],['date','From :','2025-01-01'],['date','To :','2026-09-13'],['select-one','Chart Type :','Candle'],['select-one','Selection Type :','Price'],['checkbox','Exit Stratergy: / Prei','on',false],['select-one','Exit Stratergy: / Prei','Pre'],['select-one','Exit Stratergy: / Prei','-- Select Predefined System --',null,true],['checkbox','Target:','on',false],['text','Target:','5'],['checkbox','Stop Loss:','on',true],['text','Stop Loss:','6']
 ])},settings:snapshot([['checkbox','Portfolio Backtesting :','on',true],['select-one','Allocation type :','Fixed'],['text','Total Initial Investment :','150,000'],['text','Maximum Open Trades :','3'],['checkbox','No Of Stock Per Day :','on',false],['text','No Of Stock Per Day :','2']])},quickStats:[{label:'Calmer Ratio',value:'0.09% ↓'},{label:'Expectancy',value:'-0.29 ↓'},{label:'Initial Capital',value:'150000.00'},{label:'Total no. of Trades',value:'1'}],statistics:[{title:'Backtest Details',rows:[['Group','Example group'],['Start Date','1-Jan 25'],['End Date','13-Sep 26'],['Timeframe','Daily']]}],monthly:[],charts:[],trades:{headers:['Sr #','Symbol','Qty','G/L %'],rows:[['1','TEST','0','-4.5']]},warnings:[]};
const original=JSON.stringify(run);
const stages=P.settings(run),main=stages[0];
assert.equal(main.groups[1].name,'Momentum periods');
assert.deepEqual(main.groups[1].rows.map(r=>[r.label,r.value,r.weight,P.state(r)]),[['Period 1','252','1','Off'],['Period 2','120','1','Off'],['Period 3','90','2','On'],['Period 4','60','1','On']]);
assert.deepEqual(main.groups[2].rows.map(r=>r.label),['EMA 1','EMA 2','EMA 3','TMA Trend']);
const strategies=main.groups.find(g=>g.name==='Strategies').rows;
assert.deepEqual(strategies.map(r=>r.label),['Strategy 1','Strategy 2','Strategy 3']);
assert.equal(strategies[2].value,'Close greater than open');assert.equal(strategies[2].detail,'Predefined · Weekly');
assert.equal(main.groups.find(g=>g.name==='Relative Strength').rows[2].value,'Nifty 50');
assert.equal(P.state(stages[1].groups[1].rows[1]),'Off');assert.equal(P.settingValue(stages[1].groups[1].rows[1]).text,'5.00%');
for(const stage of stages)assert.deepEqual(stage.groups.flatMap(g=>g.rows.flatMap(r=>r.sourceIndices)).sort((a,b)=>a-b),stage.snapshot.fields.map(f=>f.index),'Every captured field must remain represented');
const unknown=structuredClone(run);unknown.parameters.strategy.main.fields.splice(1,0,{type:'text',label:'New dynamic field',value:'7',checked:null,disabled:false});unknown.parameters.strategy.main.fields.forEach((f,i)=>f.index=i);
assert.equal(P.settings(unknown)[0].groups[0].name,'Captured settings','An unfamiliar layout must not receive guessed positional labels');
assert.equal(P.settings(unknown)[0].groups[0].rows.length,57);
assert.equal(JSON.stringify(run),original,'The presentation layer must never rewrite archival source data');
const conflicting=structuredClone(run);
conflicting.parameters.strategy.execution.fields=[{index:0,label:'Close Only / High & Low',type:'radio',checked:true,value:'on'},{index:1,label:'Close Only / High & Low',type:'radio',checked:true,value:'on'}];
assert.match(V.assessment(conflicting).join(' '),/Execution: Close Only and High & Low were both selected/);
assert.equal(conflicting.parameters.strategy.execution.fields[1].checked,true,'Conflicting source state must not be repaired silently');
conflicting.parameters.strategy.execution.fields[1].checked=false;
assert.doesNotMatch(V.assessment(conflicting).join(' '),/price mode is ambiguous/);

// The live P&F/Renko layouts add signal radios, numeric strategy inputs and
// independent main/exit chart controls. RS inserts benchmark fields as well.
for(const [chart,rs,selection,brickMode] of [['P&F',false,'Price','3'],['P&F',true,'Both','5'],['Renko',false,'Price','Percent'],['Renko',false,'Price','Absolute'],['Renko',true,'RS','ATR']]){
 const sample=structuredClone(run),base=sample.parameters.strategy.main.fields,exec=sample.parameters.strategy.execution.fields;
 const fresh=(type,label,value,checked=null)=>({type,label,value,checked,disabled:false});
 const chartFields=()=>[fresh('text',chart==='Renko'?'Brick Size :':'Box Size :',brickMode==='ATR'?'14':'0.75'),fresh('select-one',chart==='Renko'?'Brick Size :':'Reversal Size:',brickMode),fresh('radio','Close Only / High & Low','on',true),fresh('radio','Close Only / High & Low','on',false)];
 const numberedStrategies=base.slice(39,51).map((f,i)=>i%4===2?{...f,type:'text',value:String(Math.floor(i/4)+0.5)}:f);
 sample.parameters.strategy.main.fields=[...base.slice(0,34),fresh('radio','Running / Fresh','on',true),fresh('radio','Running / Fresh','on',false),...base.slice(34,39),...numberedStrategies,{...base[51],checked:rs},...(rs?base.slice(52,54):[]),...chartFields(),...(rs?base.slice(54):[])].map((f,index)=>({...f,index}));
 sample.parameters.strategy.main.fields[0].value=chart;
 sample.parameters.strategy.execution.fields=[...exec.slice(0,4),...chartFields(),{...exec[4],value:selection},...(selection==='Price'?[]:[fresh('select-one','Exit Denominator :','NSE'),fresh('text','Exit Denominator :','Nifty 50')]),...exec.slice(5)].map((f,index)=>({...f,index}));
 sample.parameters.strategy.execution.fields[3].value=chart;
 const before=JSON.stringify(sample),adapted=P.settings(sample);
 for(const stage of adapted){assert.notEqual(stage.groups[0].name,'Captured settings',chart+' known layout');assert.deepEqual(stage.groups.flatMap(g=>g.rows.flatMap(r=>r.sourceIndices)).sort((a,b)=>a-b),stage.snapshot.fields.map(f=>f.index));}
 const groups=adapted[0].groups;
 assert.deepEqual(groups.find(g=>g.name==='Momentum periods').rows.map(r=>r.label),['Period 1','Period 2','Period 3','Period 4']);
 assert.equal(groups.find(g=>g.name==='Chart settings').rows.find(r=>r.label==='Signal mode').value,'Running');
 assert.match(groups.find(g=>g.name==='Strategies').rows[2].detail,/input 2.50/);
 const executionChart=adapted[1].groups.find(g=>g.name==='Chart settings');
 assert.equal(executionChart.rows[1].value,brickMode);
 if(selection!=='Price')assert.equal(adapted[1].groups[0].rows.find(r=>r.label==='Exit benchmark').value,'Nifty 50');
 if(chart==='Renko'&&brickMode==='Absolute'){
   sample.parameters.strategy.execution.fields[7].checked=true;
   const price=P.settings(sample)[1].groups.find(g=>g.name==='Chart settings').rows.find(r=>r.label==='Price mode');
   assert.equal(price.value,'Close Only; High & Low');assert.equal(price.detail,'Conflicting selections');
   assert.match(V.assessment(sample).join(' '),/price mode is ambiguous/);
   sample.parameters.strategy.execution.fields[7].checked=false;
 }
 assert.equal(JSON.stringify(sample),before);
 if(!rs&&selection==='Price')for(const category of ['My','Public']){
   const searched=structuredClone(sample),m=searched.parameters.strategy.main.fields,x=searched.parameters.strategy.execution.fields;
   for(const parent of [41,45,49]){m[parent].value=category;m[parent+1].type='text';m[parent+1].value='Fictional '+chart+' rule '+parent;}
   x[10].value=category;x[11].type='text';x[11].value='Fictional '+chart+' exit';
   const preserved=JSON.stringify(searched),views=P.settings(searched);
   for(const stage of views){assert.notEqual(stage.groups[0].name,'Captured settings');assert.deepEqual(stage.groups.flatMap(g=>g.rows.flatMap(r=>r.sourceIndices)).sort((a,b)=>a-b),stage.snapshot.fields.map(f=>f.index),'Every variant search field is represented exactly once');}
   assert.equal(views[1].groups.find(g=>g.name==='Exits').rows[0].value,'Fictional '+chart+' exit');assert.equal(JSON.stringify(searched),preserved);
   m[41].value='Pre';assert.equal(P.settings(searched)[0].groups[0].name,'Captured settings','Unexpected variant text fields stay raw');
 }
}

const base=path.resolve(__dirname,'../dist');
// Only observed STR My/Public search fields gain a text adapter;
// unknown text replacements retain the complete captured-settings fallback.
for(const category of ['My','Public']){
 const search=structuredClone(run),fields=search.parameters.strategy.main.fields;
 for(let slot=0;slot<3;slot++){const parent=39+slot*4;fields[parent].value=category;fields[parent+1].type='text';fields[parent+1].value='Fictional '+category+' rule '+slot;}
 const before=JSON.stringify(search),adapted=P.settings(search)[0];assert.notEqual(adapted.groups[0].name,'Captured settings');assert.deepEqual(adapted.groups.find(g=>g.name==='Strategies').rows.map(r=>r.value),[0,1,2].map(n=>'Fictional '+category+' rule '+n));assert.deepEqual(adapted.groups.flatMap(g=>g.rows.flatMap(r=>r.sourceIndices)).sort((a,b)=>a-b),fields.map(f=>f.index));assert.equal(JSON.stringify(search),before);
}
for(const [index,parent,category] of [[40,39,'Pre'],[44,43,'Popular'],[36,35,'My']]){const wrong=structuredClone(run);wrong.parameters.strategy.main.fields[parent].value=category;wrong.parameters.strategy.main.fields[index].type='text';assert.equal(P.settings(wrong)[0].groups[0].name,'Captured settings','Unobserved text controls cannot receive positional labels');}
for(const category of ['My','Public']){
 const search=structuredClone(run),fields=search.parameters.strategy.execution.fields;fields[6].value=category;fields[7].type='text';fields[7].value='Fictional searched exit';const before=JSON.stringify(search),adapted=P.settings(search)[1];assert.notEqual(adapted.groups[0].name,'Captured settings');assert.equal(adapted.groups.find(g=>g.name==='Exits').rows[0].value,'Fictional searched exit');assert.deepEqual(adapted.groups.flatMap(g=>g.rows.flatMap(r=>r.sourceIndices)).sort((a,b)=>a-b),fields.map(f=>f.index));assert.equal(JSON.stringify(search),before);
}
for(const category of ['Pre','Popular']){const wrong=structuredClone(run);wrong.parameters.strategy.execution.fields[6].value=category;wrong.parameters.strategy.execution.fields[7].type='text';assert.equal(P.settings(wrong)[1].groups[0].name,'Captured settings','Unobserved exit text categories retain raw fallback');}
const dom=new JSDOM(fs.readFileSync(path.join(base,'index.html'),'utf8'),{runScripts:'outside-only',url:'http://localhost/'}),w=dom.window,d=w.document,downloads=[];
w.Blob=Blob;w.URL.createObjectURL=blob=>{downloads.push(blob);return 'blob:test';};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
const saved={'run:presentation-a':structuredClone(run)};w.chrome={storage:{local:{get:async()=>structuredClone(saved),set:async x=>Object.assign(saved,x)}}};
for(const file of ['core.js','storage.js','presentation.js','dashboard.js'])w.eval(fs.readFileSync(path.join(base,file),'utf8'));
(async()=>{try{
 await new Promise(r=>setTimeout(r,20));d.querySelector('.open').click();
 const stats=d.querySelector('table[aria-label="Quick stats"]');assert.equal(stats.rows[1].cells[1].textContent,'+0.09%');assert.equal(stats.rows[1].cells[1].title,'Original: 0.09% ↓');assert.ok(stats.rows[1].cells[1].classList.contains('numeric'));assert.ok(stats.rows[2].cells[1].classList.contains('negative'));
 [...d.querySelectorAll('.tabs button')].find(b=>b.textContent==='Parameters').click();
 const periods=d.querySelector('table[aria-label="Momentum · Momentum periods"]');assert.equal(periods.rows.length,5);assert.equal(periods.rows[3].cells[0].textContent,'Period 3');assert.equal(periods.rows[3].cells[2].textContent,'2.00');assert.equal(periods.rows[3].cells[3].textContent,'On');
 assert.doesNotMatch([...d.querySelectorAll('.settings-table')].map(t=>t.textContent).join(' '),/Prei|iThis feature|Str 2.*Str 3/);
 assert.ok([...d.querySelectorAll('.source-fields')].every(e=>!e.open));
 d.getElementById('summary').click();const csv=await downloads.at(-1).text();assert.match(csv,/Momentum · Period 3/);assert.match(csv,/Strategy 3/);assert.doesNotMatch(csv,/Prei|iThis feature/);
 await d.getElementById('backup').onclick();assert.deepEqual(JSON.parse(await downloads.at(-1).text()).runs,[run]);
 console.log('PASS: signed/decimal/unit formatting, arrow semantics, numbered periods/EMA, consolidated strategies, exact field coverage, safe unknown-layout fallback, aligned cells, readable CSV and unchanged JSON archives.');
 }finally{dom.window.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
