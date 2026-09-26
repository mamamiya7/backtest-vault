/* Observed RZone control positions. Reading a layout does not authorize execution. */
(function(root){
'use strict';
const charts=['Candle','P&F','Renko'],types={'select-one':'s',text:'t',date:'d',checkbox:'c',radio:'r'};
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
function chartName(chart){if(!charts.includes(chart))throw Error('This RZone chart layout is not available.');return chart;}
function main(chart,relativeStrength=false){
 chartName(chart);const variant=chart!=='Candle',shift=variant?2:0,rs=relativeStrength===true,rsIndex=51+shift;
 const rows=[{name:'Radar',parentIndex:35+shift,childIndex:36+shift,gateIndex:34+shift},...Array.from({length:3},(_,i)=>({name:'Strategy '+(i+1),parentIndex:39+shift+i*4,childIndex:40+shift+i*4,valueIndex:41+shift+i*4,gateIndex:42+shift+i*4,companionType:variant?'number':'timeframe',...(!variant?{timeframeIndex:41+i*4}:{})}))];
 if(rs)rows.push({name:'Relative Strength',parentIndex:variant?60:54,childIndex:variant?61:55,gateIndex:rsIndex});
 return freeze({stage:'momentum',chart,variant,relativeStrength:rs,count:(variant?58:52)+(rs?4:0),chartIndex:0,groupIndex:1,marketIndex:3,mtfIndex:2,rsIndex,timeframeIndex:33,radarGateIndex:34+shift,trendGateIndex:37+shift,trendValueIndex:38+shift,rows,benchmarkMarketIndex:rs?rsIndex+1:null,benchmarkIndex:rs?rsIndex+2:null,
  signalIndices:variant?[34,35]:[],sizeIndex:variant?54+(rs?2:0):null,modeIndex:variant?55+(rs?2:0):null,priceIndices:variant?[56+(rs?2:0),57+(rs?2:0)]:[],
  gates:[[4,5,6,7,8,9,10],...Array.from({length:4},(_,i)=>[11+i*2,12+i*2]),...Array.from({length:3},(_,i)=>[26+i*2,27+i*2]),[37+shift,38+shift],...rows.map(r=>[r.gateIndex,r.parentIndex,r.childIndex,...(r.valueIndex!==undefined?[r.valueIndex]:[])])],
  refreshParents:[0,3,...rows.map(r=>r.parentIndex),...(rs?[rsIndex+1]:[]),...(chart==='Renko'?[55+(rs?2:0)]:[])],labelDependents:{[44+shift]:[47+shift,48+shift,49+shift,50+shift],...(variant&&rs?{61:[56,57]}:{})}});
}
function execution(chart,selection='Price'){
 chartName(chart);if(!['Price','RS','Both'].includes(selection))throw Error('This selection layout is not available.');const variant=chart!=='Candle',chartShift=variant?4:0,rs=selection!=='Price',shift=chartShift+(rs?2:0),row={name:'Exit strategy',parentIndex:6+shift,childIndex:7+shift,gateIndex:5+shift};
 return freeze({stage:'execution',chart,variant,selection,count:(variant?16:12)+(rs?2:0),chartIndex:3,selectionIndex:4+chartShift,benchmarkMarketIndex:rs?5+chartShift:null,benchmarkIndex:rs?6+chartShift:null,sizeIndex:variant?4:null,modeIndex:variant?5:null,priceIndices:variant?[6,7]:[],rows:[row],targetGateIndex:8+shift,targetValueIndex:9+shift,stopGateIndex:10+shift,stopValueIndex:11+shift,
  gates:[[row.gateIndex,row.parentIndex,row.childIndex],[8+shift,9+shift],[10+shift,11+shift]],refreshParents:[0,3,4+chartShift,row.parentIndex,...(rs?[5+chartShift]:[]),...(chart==='Renko'?[5]:[])],labelDependents:{}});
}
const marketActions=['Exit only - Stop New entry','Exit all long positions - Stop New entry','Change exit strategy - Stop New entry','Change exit strategy - Continue New entry'];
function marketFilter(fields){
 if(!Array.isArray(fields))throw Error('Market trend settings are unavailable.');const chart=chartName(fields[0]?.value),variant=chart!=='Candle',topPrice=variant&&fields[3]?.type==='radio'&&fields[4]?.type==='radio',b=1+(variant?(topPrice?4:2):0),actionIndex=b+16,action=fields[actionIndex]?.value,hasExit=marketActions.slice(2).includes(action),exitPrice=hasExit&&variant&&fields.length===actionIndex+12;
 const rows=hasExit?[{name:'Market trend exit',gateIndex:actionIndex+1,parentIndex:actionIndex+2,childIndex:actionIndex+3}]:[],layout={stage:'marketFilter',chart,variant,count:actionIndex+1+(hasExit?7+(variant?2+(exitPrice?2:0):0):0),chartIndex:0,sizeIndex:variant?1:null,modeIndex:variant?2:null,priceIndices:topPrice?[3,4]:[],indexModeIndex:b,rsModeIndex:b+3,indexMarketIndex:b+1,indexSymbolIndex:b+2,numeratorMarketIndex:b+4,numeratorSymbolIndex:b+5,denominatorMarketIndex:b+6,denominatorSymbolIndex:b+7,methodIndices:[b+8,b+10,b+12,b+14],methodValueIndices:[b+9,b+11,b+13,b+15],actionIndex,hasExit,rows,targetGateIndex:hasExit?actionIndex+4:null,targetValueIndex:hasExit?actionIndex+5:null,stopGateIndex:hasExit?actionIndex+6:null,stopValueIndex:hasExit?actionIndex+7:null,exitSizeIndex:hasExit&&variant?actionIndex+8:null,exitModeIndex:hasExit&&variant?actionIndex+9:null,exitPriceIndices:exitPrice?[actionIndex+10,actionIndex+11]:[],gates:rows.map(r=>[r.gateIndex,r.parentIndex,r.childIndex]),refreshParents:[0,b+1,b+4,b+6,...rows.map(r=>r.parentIndex),...(chart==='Renko'?[2,...(hasExit?[actionIndex+9]:[])]:[])],labelDependents:{}};
 let signature='s'+(variant?'ts'+(topPrice?'rr':''):'')+'rstrststrtrtrtrts'+(hasExit?'cssctct'+(variant?'ts'+(exitPrice?'rr':''):''):'');
 for(const row of rows)if(['My','Public'].includes(fields[row.parentIndex]?.value)&&fields[row.childIndex]?.type==='text')signature=signature.slice(0,row.childIndex)+'t'+signature.slice(row.childIndex+1);
 if(!marketActions.includes(action)||fields.length!==layout.count||fields.map(f=>types[f?.type]||'?').join('')!==signature||Number(fields[b]?.checked)+Number(fields[b+3]?.checked)!==1||layout.methodIndices.filter(i=>fields[i]?.checked).length!==1||!/^Index/i.test(fields[b]?.label||'')||!/^RS/i.test(fields[b+3]?.label||''))throw Error('Market trend controls changed. Reload the available setup before continuing.');
 return freeze(layout);
}
function reindex(fields){return fields.map((f,index)=>({...f,index}));}
function projectMarketFilter(fields,{mode,action}={}){
 const layout=marketFilter(fields),out=fields.map(f=>({...f}));if(mode!==undefined&&!['Index','RS'].includes(mode))throw Error('Choose a market trend mode.');
 if(action!==undefined){if(!marketActions.includes(action)||marketActions.slice(2).includes(action)&&!layout.hasExit)throw Error('Load the complete market trend settings.');out[layout.actionIndex].value=action;}
 if(mode!==undefined){out[layout.indexModeIndex].checked=mode==='Index';out[layout.rsModeIndex].checked=mode==='RS';out[layout.indexSymbolIndex].disabled=mode!=='Index';out[layout.numeratorSymbolIndex].disabled=mode!=='RS';out[layout.denominatorSymbolIndex].disabled=mode!=='RS';}
 if(!marketActions.slice(2).includes(out[layout.actionIndex].value))out.splice(layout.actionIndex+1);
 if(mode==='RS'&&layout.priceIndices.length)out.splice(layout.priceIndices[0],2);
 return reindex(out);
}
function ruleRows(stage,chart){return (stage==='momentum'?main(chart):stage==='execution'?execution(chart):(()=>{throw Error('Unknown source stage.');})()).rows;}
function validate(stage,fields){
 if(!Array.isArray(fields))throw Error('RZone settings layout is unavailable.');
 if(stage==='marketFilter')return marketFilter(fields);
 const layout=stage==='momentum'?main(fields[0]?.value,fields[fields[0]?.value==='Candle'?51:53]?.checked):stage==='execution'?execution(fields[3]?.value,fields[fields[3]?.value==='Candle'?4:8]?.value):null;if(!layout)throw Error('Unknown source stage.');
 let signature=stage==='momentum'?('stcsc tsrrrr ctctctct trr tttt ctctctc s'+(layout.variant?' rr c ss ct sstc sstc sstc c tsrr':' c ss ct sssc sssc sssc c')).replace(/ /g,''):'sdds'+(layout.variant?'tsrr':'')+'scssctct';
 if(stage==='momentum'&&layout.relativeStrength)signature=signature.slice(0,layout.rsIndex+1)+'st'+signature.slice(layout.rsIndex+1)+'ss';
 if(stage==='execution'&&layout.selection!=='Price')signature=signature.slice(0,layout.selectionIndex+1)+'st'+signature.slice(layout.selectionIndex+1);
 for(const row of layout.rows)if(row.name!=='Radar'&&['My','Public'].includes(fields[row.parentIndex]?.value)&&fields[row.childIndex]?.type==='text')signature=signature.slice(0,row.childIndex)+'t'+signature.slice(row.childIndex+1);
 const anchors=stage==='momentum'?[[0,/Chart Type/i],[1,/Group/i],[4,/Retracement/i],[11,/^Period/i],[22,/Weight/i],[26,/EMA/i],[33,/Timeframe/i],[layout.radarGateIndex,/Radar/i],[layout.rsIndex,/Relative Strength/i],...layout.rows.slice(1,4).map((row,i)=>[row.parentIndex,new RegExp('Str '+(i+1),'i')])]:[[0,/Rank/i],[1,/From/i],[2,/To/i],[3,/Chart/i],[layout.selectionIndex,/Selection/i],[layout.rows[0].gateIndex,/Exit/i],[layout.targetGateIndex,/Target/i],[layout.stopGateIndex,/Stop Loss/i]];
 if(layout.variant){anchors.push([layout.sizeIndex,layout.chart==='Renko'?/Brick Size/i:/Box Size/i]);if(stage==='momentum')anchors.push([34,/Running.*Fresh/i]);}
 if(fields.length!==layout.count||fields.map(f=>types[f?.type]||'?').join('')!==signature||anchors.some(([index,pattern])=>!pattern.test(fields[index]?.label||'')))throw Error('RZone controls changed. Reload the available setup before continuing.');
 if(stage==='momentum'&&layout.variant&&fields[layout.marketIndex].value!=='NSE')throw Error('Automatic setup currently supports NSE for this chart.');
 return layout;
}
const api=freeze({version:1,charts,main,execution,marketFilter,marketActions,projectMarketFilter,ruleRows,validate,stage:validate});
if(typeof module!=='undefined')module.exports=api;root.VaultSourceLayouts=api;
})(typeof window!=='undefined'?window:globalThis);
