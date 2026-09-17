/* Fictional source controls for filter projection tests. No account data. */
const S=require('../../dist/setup.js'),L=require('../../dist/source-layouts.js');
const clone=value=>JSON.parse(JSON.stringify(value));
function fixture({chart='Candle',marketChart=chart,exitPrices=false,mode='Index',action=L.marketActions[0]}={}){
 const source=clone(S.demoTemplate({momentumChart:chart,executionChart:'Candle'}));source.supports.filters=['relative-strength','market-filter'];
 const off=clone(source.stages.momentum),base=L.main(chart),rs=clone(off),native=(type,label,value,checked=null)=>({index:0,type,label,value,checked,disabled:false});
 rs.fields[base.rsIndex].checked=true;
 rs.fields.splice(base.rsIndex+1,0,native('select-one','Relative Strength market','NSE'),native('text','Relative Strength benchmark','Demo benchmark'));
 rs.fields.push(native('select-one','RS SB : / Pre','Pre'),native('select-one','RS SB : / Pre','Demo relative rule'));
 rs.fields.forEach((field,index)=>{field.index=index;});rs.options={};for(const [index,options]of Object.entries(off.options))rs.options[Number(index)>base.rsIndex?Number(index)+2:index]=clone(options);
 const r=L.main(chart,true);rs.options[r.benchmarkMarketIndex]=['All','NSE','BSE'];rs.options[r.benchmarkIndex]=[{value:'Demo benchmark',label:'Demo benchmark',sourceValue:'demo-index|101',market:'NSE'}];rs.options[r.rows.at(-1).parentIndex]=['Pre'];rs.options[r.rows.at(-1).childIndex]=['Demo relative rule','Demo relative alternative'];
 source.stages.momentum.relativeStrength=rs;source.stages.momentum.withoutRelativeStrength=off;
 const fields=[],add=(...args)=>fields.push(native(...args)),variant=marketChart!=='Candle';
 add('select-one','Chart type',marketChart);if(variant){add('text',marketChart==='Renko'?'Brick Size':'Box Size','1');add('select-one',marketChart==='Renko'?'Brick mode':'Reversal size',marketChart==='Renko'?'Percent':'3');add('radio','Close Only','on',true);add('radio','High & Low','on',false);}
 add('radio','Index Filter','on',true);add('select-one','Scrip market','NSE');add('text','Scrip','Demo index');add('radio','RS Filter','on',false);add('select-one','Scrip1 market','NSE');add('text','Scrip1','Demo numerator');add('select-one','Scrip2 market','NSE');add('text','Scrip2','Demo denominator');
 for(const method of ['EMA','D Smart','MAST','KTQP']){add('radio',method,'on',method==='EMA');add('text',method,'20');}
 add('select-one','Action',L.marketActions[2]);add('checkbox','Exit strategy','on',false);add('select-one','Exit source','Pre');add('select-one','Exit rule','Demo market exit');add('checkbox','Target','on',false);add('text','Target','5');add('checkbox','Stop Loss','on',false);add('text','Stop Loss','3');
 if(variant){add('text',marketChart==='Renko'?'Exit Brick Size':'Exit Box Size','1');add('select-one',marketChart==='Renko'?'Exit brick mode':'Exit reversal size',marketChart==='Renko'?'Percent':'3');if(exitPrices){add('radio','Exit Close Only','on',true);add('radio','Exit High & Low','on',false);}}
 fields.forEach((field,index)=>{field.index=index;});const m=L.marketFilter(fields),options={0:L.charts,[m.actionIndex]:L.marketActions};
 for(const [market,symbol]of [[m.indexMarketIndex,m.indexSymbolIndex],[m.numeratorMarketIndex,m.numeratorSymbolIndex],[m.denominatorMarketIndex,m.denominatorSymbolIndex]]){options[market]=['All','NSE','BSE'];options[symbol]=[{value:fields[symbol].value,label:fields[symbol].value,sourceValue:'demo-symbol|'+symbol,market:'NSE'}];}
 options[m.rows[0].parentIndex]=['Pre'];options[m.rows[0].childIndex]=['Demo market exit','Demo market alternative'];if(variant)for(const index of [m.modeIndex,m.exitModeIndex])options[index]=marketChart==='Renko'?['Absolute','Percent','ATR','ATR %']:['2','3','4'];
 source.stages.marketFilter={fields,options,current:{fields:L.projectMarketFilter(fields,{mode,action})}};
 return source;
}
module.exports=fixture;
