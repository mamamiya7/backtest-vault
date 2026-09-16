/* Observed RZone control positions. Reading a layout does not authorize execution. */
(function(root){
'use strict';
const charts=['Candle','P&F','Renko'],types={'select-one':'s',text:'t',date:'d',checkbox:'c',radio:'r'};
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
function chartName(chart){if(!charts.includes(chart))throw Error('This RZone chart layout is not available.');return chart;}
function main(chart){
 chartName(chart);const variant=chart!=='Candle',shift=variant?2:0;
 const rows=[{name:'Radar',parentIndex:35+shift,childIndex:36+shift,gateIndex:34+shift},...Array.from({length:3},(_,i)=>({name:'Strategy '+(i+1),parentIndex:39+shift+i*4,childIndex:40+shift+i*4,valueIndex:41+shift+i*4,gateIndex:42+shift+i*4,companionType:variant?'number':'timeframe',...(!variant?{timeframeIndex:41+i*4}:{})}))];
 return freeze({stage:'momentum',chart,variant,count:variant?58:52,chartIndex:0,groupIndex:1,marketIndex:3,mtfIndex:2,rsIndex:51+shift,timeframeIndex:33,radarGateIndex:34+shift,trendGateIndex:37+shift,trendValueIndex:38+shift,rows,
  signalIndices:variant?[34,35]:[],sizeIndex:variant?54:null,modeIndex:variant?55:null,priceIndices:variant?[56,57]:[],
  gates:[[4,5,6,7,8,9,10],...Array.from({length:4},(_,i)=>[11+i*2,12+i*2]),...Array.from({length:3},(_,i)=>[26+i*2,27+i*2]),[37+shift,38+shift],...rows.map(r=>[r.gateIndex,r.parentIndex,r.childIndex,...(r.valueIndex!==undefined?[r.valueIndex]:[])])],
  refreshParents:[0,3,...rows.map(r=>r.parentIndex),...(chart==='Renko'?[55]:[])],labelDependents:{[44+shift]:[47+shift,48+shift,49+shift,50+shift]}});
}
function execution(chart){
 chartName(chart);const variant=chart!=='Candle',shift=variant?4:0,row={name:'Exit strategy',parentIndex:6+shift,childIndex:7+shift,gateIndex:5+shift};
 return freeze({stage:'execution',chart,variant,count:variant?16:12,chartIndex:3,selectionIndex:4+shift,sizeIndex:variant?4:null,modeIndex:variant?5:null,priceIndices:variant?[6,7]:[],rows:[row],targetGateIndex:8+shift,targetValueIndex:9+shift,stopGateIndex:10+shift,stopValueIndex:11+shift,
  gates:[[row.gateIndex,row.parentIndex,row.childIndex],[8+shift,9+shift],[10+shift,11+shift]],refreshParents:[0,3,4+shift,row.parentIndex,...(chart==='Renko'?[5]:[])],labelDependents:{}});
}
function ruleRows(stage,chart){return (stage==='momentum'?main(chart):stage==='execution'?execution(chart):(()=>{throw Error('Unknown source stage.');})()).rows;}
function validate(stage,fields){
 if(!Array.isArray(fields))throw Error('RZone settings layout is unavailable.');
 const layout=stage==='momentum'?main(fields[0]?.value):stage==='execution'?execution(fields[3]?.value):null;if(!layout)throw Error('Unknown source stage.');
 let signature=stage==='momentum'?('stcsc tsrrrr ctctctct trr tttt ctctctc s'+(layout.variant?' rr c ss ct sstc sstc sstc c tsrr':' c ss ct sssc sssc sssc c')).replace(/ /g,''):'sdds'+(layout.variant?'tsrr':'')+'scssctct';
 for(const row of layout.rows)if(row.name!=='Radar'&&['My','Public'].includes(fields[row.parentIndex]?.value)&&fields[row.childIndex]?.type==='text')signature=signature.slice(0,row.childIndex)+'t'+signature.slice(row.childIndex+1);
 const anchors=stage==='momentum'?[[0,/Chart Type/i],[1,/Group/i],[4,/Retracement/i],[11,/^Period/i],[22,/Weight/i],[26,/EMA/i],[33,/Timeframe/i],[layout.radarGateIndex,/Radar/i],[layout.rsIndex,/Relative Strength/i],...layout.rows.slice(1).map((row,i)=>[row.parentIndex,new RegExp('Str '+(i+1),'i')])]:[[0,/Rank/i],[1,/From/i],[2,/To/i],[3,/Chart/i],[layout.selectionIndex,/Selection/i],[layout.rows[0].gateIndex,/Exit/i],[layout.targetGateIndex,/Target/i],[layout.stopGateIndex,/Stop Loss/i]];
 if(layout.variant){anchors.push([layout.sizeIndex,layout.chart==='Renko'?/Brick Size/i:/Box Size/i]);if(stage==='momentum')anchors.push([34,/Running.*Fresh/i]);}
 if(stage==='momentum'&&(fields[layout.rsIndex]?.checked||fields[layout.mtfIndex]?.checked))throw Error('Automatic setup requires Relative Strength off and Market Trend Filter off.');
 if(fields.length!==layout.count||fields.map(f=>types[f?.type]||'?').join('')!==signature||anchors.some(([index,pattern])=>!pattern.test(fields[index]?.label||'')))throw Error('RZone controls changed. Reload the available setup before continuing.');
 if(stage==='execution'&&fields[layout.selectionIndex].value!=='Price')throw Error('Automatic setup currently requires Price selection.');
 if(stage==='momentum'&&layout.variant&&fields[layout.marketIndex].value!=='NSE')throw Error('Automatic setup currently supports NSE for this chart.');
 return layout;
}
const api=freeze({version:1,charts,main,execution,ruleRows,validate,stage:validate});
if(typeof module!=='undefined')module.exports=api;root.VaultSourceLayouts=api;
})(typeof window!=='undefined'?window:globalThis);
