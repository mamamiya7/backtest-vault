/* Fictional, deterministic UI fixtures. Never derived from a user's archive. */
(function(root){
'use strict';
const snapshot=items=>({at:'2026-01-02T09:30:00Z',fields:items.map(([type,label,value,checked=null,disabled=false],index)=>({index,type,label,value:String(value),checked,disabled}))});
const text=(label,value)=>['text',label,value], select=(label,value)=>['select-one',label,value], check=(label,on)=>['checkbox',label,'on',on], radio=(label,on)=>['radio',label,'on',on];
function main(chart,period,rs,mode){
 const items=[select('Chart Type :',chart),text('Group :','Demo universe 40'),check('Group :',false),select('Market :','NSE'),check('Retracement :',false),text('Retracement :','20'),select('Retracement :','Within'),
 ...[true,false,false,false].map(x=>radio('52 Week High / 52 Week Low / ATH / ATL',x)),
 ...[period,120,90,60].flatMap((v,i)=>[check('Period :',i===0),['text','Period :',v,null,i!==0]]),
 text('Volume above :',0),radio('Average / Highest',true),radio('Average / Highest',false),
 ...[1,1,1,1].map(x=>text('Weight :',x)),
 ...[100,50,20].flatMap((v,i)=>[check('EMA :',rs&&i===0),['text','EMA :',v,null,!(rs&&i===0)]]),
 check('TMA Trend',false),select('Timeframe :','Daily')];
 if(chart!=='Candle')items.push(radio('Running / Fresh',true),radio('Running / Fresh',false));
 items.push(check('Radar :',false),select('Radar :','Pre'),select('Radar :','Demo momentum screen'),check('Trend Quality :',false),text('Trend Quality :',40));
 for(let i=1;i<=3;i++)items.push(select('Str '+i+' :','Pre'),select('Str '+i+' :',i===1?'Demo trend rule':'-- Select Predefined System --'),chart==='Candle'?select('Str '+i+' :','Daily'):text('Str '+i+' :',0.5),check('Str '+i+' :',i===1));
 items.push(check('Relative Strength :',rs));
 if(rs)items.push(select('Relative Strength :','NSE'),text('Relative Strength :','Demo benchmark'));
 if(chart!=='Candle')items.push(...chartFields(chart,mode));
 if(rs)items.push(select('RS SB :','Pre'),select('RS SB :','Demo rising ratio'));
 return snapshot(items);
}
function chartFields(chart,mode){return [text(chart==='Renko'?'Brick Size :':'Box Size :',mode==='ATR'?14:chart==='Renko'&&mode==='Absolute'?10:0.5),select(chart==='Renko'?'Brick Size :':'Reversal Size :',chart==='Renko'?mode:3),radio('Close Only / High & Low',true),radio('Close Only / High & Low',false)];}
function chartSvg(values,title,color,drawdown=false){
 const min=drawdown?Math.min(-1,...values):Math.min(95,...values),max=drawdown?0:Math.max(110,...values),left=53,top=30,width=620,height=205;
 const coords=values.map((v,i)=>[left+i*width/(values.length-1),top+height-(v-min)/(max-min)*height]);
 const line=coords.map(([x,y],i)=>(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)).join(' ');
 const grid=[0,1,2,3].map(i=>{const y=top+i*height/3,v=max-i*(max-min)/3;return '<line x1="53" y1="'+y+'" x2="673" y2="'+y+'" stroke="#30415a"/><text x="43" y="'+(y+4)+'" text-anchor="end" fill="#b0c3dc" font-size="12">'+v.toFixed(0)+(drawdown?'%':'')+'</text>';}).join('');
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 282" width="720" height="282"><title>'+title+' — fictional demo</title><rect width="720" height="282" fill="#101d2e"/>'+grid+'<path d="'+line+' L673 235 L53 235 Z" fill="'+color+'" fill-opacity="0.10"/><path d="'+line+'" fill="none" stroke="'+color+'" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><text x="53" y="263" fill="#b0c3dc" font-size="12">JAN</text><text x="247" y="263" fill="#b0c3dc" font-size="12">APR</text><text x="441" y="263" fill="#b0c3dc" font-size="12">JUL</text><text x="673" y="263" text-anchor="end" fill="#b0c3dc" font-size="12">DEC</text></svg>';
}
function create(configOverride){
 const configs=configOverride||[
 ['Momentum core','Candle',180,false,'Percent',[2.8,3.1,-2.5,4.6,1.4,-1.8,3.5,2.1,-1.3,3.2,1.6,2.4]],
 ['Relative strength','Candle',120,true,'Percent',[1.5,2.2,-1.8,3.3,1.1,-2.7,2.4,1.6,-1.1,2.5,1.9,1.3]],
 ['P&F breakout','P&F',90,false,'Percent',[3.4,-4.2,2.7,3.9,-1.5,2.2,-3.1,4.8,2.1,3.2,-2.6,2.8]],
 ['Renko trend','Renko',180,true,'ATR',[1.2,2.3,-1.4,2.8,-2.1,1.6,2.5,-1.7,3.2,1.1,2.6,1.8]],
 ['Renko · review needed','Renko',60,false,'Absolute',[-2.4,1.2,-3.5,2.2,-1.8,-2.6,1.4,-1.7,2.3,-2.1,1.1,-.9]],
 ['Holdout sample','Candle',180,false,'Percent',[.6,1.2,-1.5,.8,1.1,-.7,1.3,-.5,.8,1.2,-.9,.7]]
 ];
 return configs.map(([name,type,period,rs,mode,returns],n)=>{
 const equity=[100];returns.forEach(v=>equity.push(equity.at(-1)*(1+v/100)));
 let peak=100;const drawdowns=equity.map(v=>{peak=Math.max(peak,v);return (v/peak-1)*100;});
 const gross=equity.at(-1)-100,mdd=-Math.min(...drawdowns),year=n===5?'2024':'2025';
 const execution=[select('Rank Criteria :','Return Percent'),['date','From :',year+'-01-01'],['date','To :',year+'-12-31'],select('Chart Type :',type),...(type==='Candle'?[]:chartFields(type,mode)),select('Selection Type :','Price'),check('Exit Strategy :',false),select('Exit Strategy :','Pre'),select('Exit Strategy :','Demo exit rule'),check('Target :',true),text('Target :',6),check('Stop Loss :',true),text('Stop Loss :',8)];
 if(n===4)execution[7][3]=true;
 const rows=returns.map((pct,i)=>{const before=equity[i]*1000,after=equity[i+1]*1000;return [String(i+1),'DEMO-'+String(i+1).padStart(2,'0'),year+'-'+String(i+1).padStart(2,'0')+'-01',year+'-'+String(i+1).padStart(2,'0')+'-28','100',before.toFixed(2),after.toFixed(2),pct.toFixed(2),(after-before).toFixed(2)];});
 return {schemaVersion:1,id:'demo-run-'+(n+1),demo:true,name,savedAt:'2026-01-02T'+String(15-n).padStart(2,'0')+':00:00Z',provenance:'recorded-at-submit',notes:'FICTIONAL DEMO. Illustrative settings and a synthetic monthly return series, not a real strategy backtest. Use this record to explore the interface.',parameters:{strategy:{main:main(type,period,rs,mode),execution:snapshot(execution)},settings:snapshot([check('Portfolio Backtesting :',true),select('Allocation type :','Reinvestment'),text('Total Initial Investment :',100000),text('Maximum Open Trades :',5),check('No Of Stock Per Day :',false),text('No Of Stock Per Day :',2)])},
 quickStats:[['Gross Total Returns( % )',gross.toFixed(2)+'%'],['Max Drawdown(MDD)',mdd.toFixed(2)+'%'],['Annualized Returns',gross.toFixed(2)+'%'],['Total no. of Trades','12'],['Initial Capital','100000.00'],['Final Capital',(equity.at(-1)*1000).toFixed(2)],['Total PL',(gross*1000).toFixed(2)],['Win Ratio',(returns.filter(x=>x>0).length/12*100).toFixed(2)+'%']].map(([label,value])=>({label,value})),
 statistics:[{title:'Backtest Details',rows:[['Group','Demo universe 40'],['Segment','NSE'],['Start Date','1-Jan '+year.slice(2)],['End Date','31-Dec '+year.slice(2)],['Timeframe','Daily'],['Data type','Fictional demonstration']]},{title:'Return distribution',rows:[['Best month',Math.max(...returns).toFixed(2)+'%'],['Worst month',Math.min(...returns).toFixed(2)+'%'],['Positive months',String(returns.filter(x=>x>0).length)],['Negative months',String(returns.filter(x=>x<0).length)]]}],
 monthly:[[['Year','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Total'],[year,...returns.map(x=>x.toFixed(2)+'%'),gross.toFixed(2)+'%']]],
 charts:[{title:'Equity curve · indexed to 100',svg:chartSvg(equity,'Equity curve','#91ebcb')},{title:'Drawdown · monthly observations',svg:chartSvg(drawdowns,'Drawdown','#b0baff',true)}],trades:{headers:['Sr #','Symbol','Entry Date','Exit Date','Qty','Entry Value','Exit Value','G/L %','P/L'],rows},warnings:[]};
 });
}
function benchmarks(){const points=[];for(let i=0;i<731;i++)points.push({date:new Date(Date.UTC(2024,0,1+i)).toISOString().slice(0,10),value:100*Math.exp(.00028*i+.025*Math.sin(i/17)+.015*Math.sin(i/47))});return [{schemaVersion:1,id:'demo-nifty-reference',name:'Nifty 50 (fictional)',kind:'total-return',source:'Synthetic calendar-day series; not actual Nifty performance',importedAt:'2026-01-02T00:00:00Z',demo:true,points}];}
const createOriginal=create;
function withCagr(configOverride){return createOriginal(configOverride).map(run=>{const from=run.parameters.strategy.execution.fields[1].value,to=run.parameters.strategy.execution.fields[2].value,days=(Date.parse(to)-Date.parse(from))/86400000,ret=Number(run.quickStats[0].value.replace('%',''));run.quickStats.push({label:'CAGR',value:(((1+ret/100)**(365.25/days)-1)*100).toFixed(2)+'%'});return run;});}
function createTrial(e,t){
 if(!e.demo)throw Error('Simulation is restricted to fictional experiments.');
 const E=root.VaultExperiments,b=E.expected(e,t),m=E.fields(b,'momentum'),x=E.fields(b,'execution');
 const wave=Object.values(t.patch).reduce((sum,v)=>{
  if(typeof v==='boolean')return sum+Number(v)*3;
  const numeric=Number(v);if(Number.isFinite(numeric))return sum+numeric;
  let hash=0;for(const char of String(v))hash=(Math.imul(hash,31)+char.codePointAt(0))>>>0;return sum+hash%10000;
 },0);
 const returns=Array.from({length:12},(_,i)=>Number((1.2+2.8*Math.sin(i*1.7+wave*.014)).toFixed(2)));
 const run=withCagr([[e.name+' · simulated '+t.ordinal,m[0].value,180,false,'Percent',returns]])[0];
 run.id=t.runId;run.parameters=b.parameters;run.experiment={id:e.id,trialId:t.id,phase:t.phase};run.savedAt=new Date().toISOString();
 // A setup contains no earlier result or submission. The isolated demo adds
 // its own fictional completion state only when generating a sample result.
 if(b.origin==='vault-setup'){run.parameters.strategy.started=true;run.parameters.strategy.completed=true;run.parameters.strategy.auxiliarySettingsUncaptured=false;}
 const capital=Number(String(E.fields(b,'portfolio')[2].value).replace(/,/g,'')),scale=capital/100000;
 for(const stat of run.quickStats)if(['Initial Capital','Final Capital','Total PL'].includes(stat.label))stat.value=(Number(stat.value)*scale).toFixed(2);
 for(const row of run.trades.rows)for(const column of [5,6,8])row[column]=(Number(row[column])*scale).toFixed(2);
 run.statistics[0].rows=[['Group',m[1].value],['Segment',m[3].value],['Start Date',x[1].value],['End Date',x[2].value],['Timeframe',m[33].value],['Data type','Fictional experiment simulation']];
 const span=Date.parse(x[2].value)-Date.parse(x[1].value);run.trades.rows.forEach((r,i)=>{r[2]=new Date(Date.parse(x[1].value)+span*i/12).toISOString().slice(0,10);r[3]=new Date(Date.parse(x[1].value)+span*(i+1)/12).toISOString().slice(0,10);});
 const gross=Number(run.quickStats[0].value.replace('%',''));run.quickStats.find(s=>s.label==='CAGR').value=(((1+gross/100)**(365.25/(span/86400000))-1)*100).toFixed(2)+'%';
 run.monthly=[];run.notes='FICTIONAL EXPERIMENT SIMULATION. A deterministic synthetic series illustrates queue and decision behavior. Settings do not execute trading logic. Charts and trades are synthetic.';
 return run;
}
const api={create:withCagr,benchmarks,createTrial};if(typeof module!=='undefined')module.exports=api;root.VaultDemo=api;
})(typeof window!=='undefined'?window:globalThis);
