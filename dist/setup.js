/* A settings-only starting point. Source controls supply labels and choices;
 * no backtest, source submission or result is manufactured by this module. */
(function(root){
'use strict';
const V=typeof module!=='undefined'?require('./core.js'):root.Vault;
const P=typeof module!=='undefined'?require('./presentation.js'):root.VaultPresentation;
const L=typeof module!=='undefined'?require('./source-layouts.js'):root.VaultSourceLayouts;
const clone=x=>JSON.parse(JSON.stringify(x)),stages=['momentum','execution','portfolio'];
const layoutFor=(stage,fields)=>stage==='portfolio'?null:L.stage(stage,fields);
const catalogueShapes=(stage,fields)=>Object.fromEntries((layoutFor(stage,fields)?.rows||[]).map(row=>[row.childIndex,row]));
const ordered=x=>Array.isArray(x)?x.map(ordered):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,ordered(x[k])])):x;
const same=(a,b)=>JSON.stringify(ordered(a))===JSON.stringify(ordered(b));
const owns=(o,key)=>!!o&&Object.prototype.hasOwnProperty.call(o,key);
const idOK=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(x);
const blocked='This dynamic rule is not available in automatic setup yet.';
const ruleCategories=['Pre','My','Public','Popular'];
const searchRule=(shape,category)=>shape?.name!=='Radar'&&['My','Public'].includes(category);
const ruleRowIndices=(stage,key,shape)=>[shape.parentIndex,Number(key),...(shape.valueIndex!==undefined?[shape.valueIndex]:[]),shape.gateIndex];
const record=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
function catalogueChoices(input,label){
 if(!Array.isArray(input)||input.length>3000)throw Error('Invalid cached rule choices for '+label+'.');
 const seen=new Set();return input.map(option=>{
  const raw=typeof option==='string'?{value:option,label:option}:option;
  if(!record(raw)||typeof raw.value!=='string'||typeof raw.label!=='string'||raw.value.length>2000||raw.label.length>2000||/[\u0000-\u001f]/.test(raw.label)||(raw.disabled!==undefined&&typeof raw.disabled!=='boolean'))throw Error('Invalid cached rule choice for '+label+'.');
  if(seen.has(raw.label))throw Error('Ambiguous cached rule choices for '+label+'.');seen.add(raw.label);
  return {value:raw.label,label:raw.label,disabled:raw.disabled===true};
 });
}
function ruleCatalogues(input,stage,fields,options){
 const layout=layoutFor(stage,fields),shapes=catalogueShapes(stage,fields);
 if(!layout||!record(input)||Object.keys(input).some(key=>!owns(shapes,key)))throw Error('Invalid strategy rule catalogues.');
 const out={};
 for(const [key,entry] of Object.entries(input)){
  const shape=shapes[key],child=fields[Number(key)];
  if(!record(entry)||Object.keys(entry).some(k=>!['parentIndex','gateIndex','categories','controlTypes','searchQueries','fieldLabels','labelDependents'].includes(k))||entry.parentIndex!==shape.parentIndex||entry.gateIndex!==shape.gateIndex||fields[shape.parentIndex]?.type!=='select-one'||!['select-one','text'].includes(child?.type)||fields[shape.gateIndex]?.type!=='checkbox'||!record(entry.categories)||!Object.keys(entry.categories).length||Object.keys(entry.categories).length>4)throw Error('Invalid strategy rule catalogue association.');
  const categories={};
  for(const [category,choices] of Object.entries(entry.categories)){
   if(!ruleCategories.includes(category)||!options[shape.parentIndex]?.some(o=>o.value===category&&!o.disabled))throw Error('Cached strategy category is not available from its source.');
   categories[category]=catalogueChoices(choices,child.label+' / '+category);
  }
  const selected=fields[shape.parentIndex].value;
  let controlTypes;
  if(owns(entry,'controlTypes')){
   if(!record(entry.controlTypes)||!same(Object.keys(entry.controlTypes).sort(),Object.keys(categories).sort()))throw Error('Invalid strategy rule control types.');
   controlTypes={};
   for(const [category,type] of Object.entries(entry.controlTypes)){
    if(type!=='select-one'&&(type!=='text'||!searchRule(shape,category)))throw Error('Invalid strategy rule control type.');
    controlTypes[category]=type;
   }
   if(owns(controlTypes,selected)&&controlTypes[selected]!==child.type)throw Error('Cached strategy control type does not match the selected source category.');
  }
  if(child.type==='text'&&(!searchRule(shape,selected)||!owns(controlTypes,selected)))throw Error('Invalid strategy search rule association.');
  let searchQueries;
  if(owns(entry,'searchQueries')){
   if(!record(entry.searchQueries))throw Error('Invalid strategy rule searches.');searchQueries={};
   for(const [category,query] of Object.entries(entry.searchQueries)){
    if(controlTypes?.[category]!=='text'||typeof query!=='string'||!query||query!==query.trim()||query.length>200||/[\u0000-\u001f\u007f]/.test(query))throw Error('Invalid strategy rule search query.');
    searchQueries[category]=query;
   }
  }
  if(controlTypes)for(const [category,type] of Object.entries(controlTypes))if(type==='text'&&categories[category].length&&!owns(searchQueries,category))throw Error('Strategy search choices need their source query.');
  let fieldLabels;
  if(owns(entry,'fieldLabels')){
   if(!record(entry.fieldLabels)||!same(Object.keys(entry.fieldLabels).sort(),Object.keys(categories).sort()))throw Error('Invalid strategy field labels.');
   const indices=ruleRowIndices(stage,key,shape);fieldLabels={};
   for(const [category,labels] of Object.entries(entry.fieldLabels)){
    if(!Array.isArray(labels)||labels.length!==indices.length||labels.some(label=>typeof label!=='string'||!label.trim()||label.length>2000))throw Error('Invalid strategy field labels.');
    fieldLabels[category]=clone(labels);
   }
   if(owns(fieldLabels,selected)&&!same(fieldLabels[selected],indices.map(i=>fields[i].label)))throw Error('Cached strategy field labels do not match the selected source category.');
  }
  if(owns(categories,selected)&&!same(categories[selected],options[key]))throw Error('Cached strategy rules do not match the selected source category.');
  if(child.type==='text'&&child.value!==''&&!options[key]?.some(o=>o.value===child.value))throw Error('Selected source value is absent from its choices: '+child.label);
  if(owns(entry,'labelDependents')&&(stage!=='momentum'||!owns(layout.labelDependents,key)||!same(entry.labelDependents,layout.labelDependents[key])||!fieldLabels||Object.values(fieldLabels).some(labels=>labels.some(label=>label!==labels[0]))))throw Error('Invalid strategy label dependencies.');
  out[key]={parentIndex:shape.parentIndex,gateIndex:shape.gateIndex,categories,...(controlTypes?{controlTypes}:{}),...(searchQueries?{searchQueries}:{}),...(fieldLabels?{fieldLabels}:{}),...(owns(entry,'labelDependents')?{labelDependents:clone(entry.labelDependents)}:{})};
 }
 for(const [key,catalogue] of Object.entries(out))if(catalogue.labelDependents){
  const prefix=fields[catalogue.parentIndex].label+' → ',child=layout.rows.find(row=>row.parentIndex===catalogue.labelDependents[0])?.childIndex,labels=out[child]?.fieldLabels;
  if(!labels||catalogue.labelDependents.some(index=>!fields[index].label.startsWith(prefix)||fields[index].label.length===prefix.length)||Object.values(labels).some(row=>row.some(label=>!label.startsWith(prefix)||label.length===prefix.length)))throw Error('Invalid strategy label dependency evidence.');
 }
 return out;
}

function projectRuleLabels(baseFields,catalogues,selectedFields){
 const stage=baseFields[1]?.type==='date'?'execution':'momentum',layout=layoutFor(stage,baseFields),labels=baseFields.map(f=>f.label);
 for(const [key,catalogue] of Object.entries(catalogues||{})){
  const observed=catalogue.fieldLabels?.[selectedFields[catalogue.parentIndex]?.value];if(!observed)continue;
  ruleRowIndices(stage,key,layout.rows.find(row=>row.childIndex===Number(key))).forEach((index,n)=>{labels[index]=observed[n];});
 }
 for(const catalogue of Object.values(catalogues||{}))if(catalogue.labelDependents){
  const original=baseFields[catalogue.parentIndex].label+' → ',updated=labels[catalogue.parentIndex]+' → ';
  for(const index of catalogue.labelDependents){
   if(!labels[index].startsWith(original)||labels[index].length===original.length)throw Error('Strategy label dependency changed. Reload the available setup.');
   labels[index]=updated+labels[index].slice(original.length);
   if(labels[index].length>2000)throw Error('Strategy field label is too long.');
  }
 }
 return labels;
}

function portfolioTemplate(){
 // These six labels, their order and both allocation labels were observed in
 // the real Candle archives. Values below are editable setup defaults, not
 // readings from the connected tab or a previously submitted portfolio.
 const rows=[['checkbox','Portfolio Backtesting :','on',true],['select-one','Allocation type :','Reinvestment',null],['text','Total Initial Investment :','100000',null],['text','Maximum Open Trades :','5',null],['checkbox','No Of Stock Per Day :','on',false],['text','No Of Stock Per Day :','5',null]];
 return {template:true,origin:'verified-layout',fields:rows.map(([type,label,value,checked],index)=>({index,type,label,value,checked,disabled:false})),options:{1:['Fixed','Reinvestment'].map(value=>({value,label:value,disabled:false}))}};
}
function parameters(t){return {strategy:{main:{fields:clone(t.stages.momentum.fields)},execution:{fields:clone(t.stages.execution.fields)}},settings:{fields:clone(t.stages.portfolio.fields)}};}
function template(source){
 if(!source||typeof source!=='object')throw Error('Connect RZone to load the available setup.');
 const input=source.stages||source,t={schemaVersion:1,demo:source.demo===true,stages:{}};
 if(source.adapterVersion!==undefined){if(source.adapterVersion!==L.version)throw Error('This source adapter version is not supported.');t.adapterVersion=L.version;}
 if(source.session!==undefined){if(typeof source.session!=='string'||!source.session||source.session.length>120)throw Error('Invalid setup source session.');t.session=source.session;}
 if(source.capturedAt!==undefined){if(typeof source.capturedAt!=='string'||!Number.isFinite(Date.parse(source.capturedAt)))throw Error('Invalid setup capture time.');t.capturedAt=source.capturedAt;}
 for(const stage of stages){
  const s=input[stage]||(stage==='portfolio'?portfolioTemplate():null);
  if(!s||!Array.isArray(s.fields)||!s.fields.length||s.fields.length>100)throw Error('RZone '+stage+' controls were not available.');
  const fields=s.fields.map((f,index)=>{
   if(!f||f.index!==index||!['text','date','checkbox','radio','select-one'].includes(f.type)||typeof f.label!=='string'||!f.label.trim()||f.label.length>2000||typeof f.value!=='string'||f.value.length>2000||typeof f.disabled!=='boolean'||(!['checkbox','radio'].includes(f.type)?f.checked!==null:typeof f.checked!=='boolean'))throw Error('RZone '+stage+' settings layout is invalid.');
   return {index,type:f.type,label:f.label,value:f.value,checked:f.checked,disabled:f.disabled};
  });
  const layout=layoutFor(stage,fields),ruleIndices=(layout?.rows||[]).map(row=>row.childIndex);
  const options={};
  for(const f of fields){
   const groupCatalogue=stage==='momentum'&&f.index===1&&owns(s.options,1);
   const offered=groupCatalogue?s.options[1]:s.options?.[f.index]??s.fields[f.index].options;
   if(offered!==undefined||groupCatalogue){
    if(!Array.isArray(offered)||offered.length>3000)throw Error('Invalid source choices for '+f.label);
    const seen=new Set();options[f.index]=offered.map(o=>{
     const raw=typeof o==='string'?{value:o,label:o}:o;
     if(!raw||typeof raw.value!=='string'||typeof raw.label!=='string'||raw.value.length>2000||raw.label.length>2000)throw Error('Invalid source choice for '+f.label);
     if(stage==='momentum'&&f.index===1&&(!raw.label.trim()||/[\u0000-\u001f]/.test(raw.label)))throw Error('Invalid source choice for '+f.label);
     // Captured select values are display labels, never opaque DOM tokens.
     const value=raw.label,entry={value,label:raw.label,disabled:raw.disabled===true};
     if(seen.has(value))throw Error('Ambiguous source choices for '+f.label);seen.add(value);return entry;
    });
   }else if(f.type==='select-one')options[f.index]=[{value:f.value,label:f.value,disabled:false}];
   const emptyRule=ruleIndices.includes(f.index)&&options[f.index]?.length===0&&f.value==='';
   if(f.type==='select-one'&&!emptyRule&&!options[f.index].some(o=>o.value===f.value))throw Error('Selected source value is absent from its choices: '+f.label);
  }
  t.stages[stage]={fields,options};
  if(owns(s,'supportedMarkets')){
   if(stage!=='momentum'||!same(s.supportedMarkets,['NSE'])||fields[3]?.value!=='NSE')throw Error('This RZone market layout is not available for automatic setup yet.');
   t.stages[stage].supportedMarkets=['NSE'];
  }
  if(owns(s,'ruleCatalogues'))t.stages[stage].ruleCatalogues=ruleCatalogues(s.ruleCatalogues,stage,fields,options);
  for(const index of ruleIndices)if(fields[index]?.type==='text'&&!t.stages[stage].ruleCatalogues?.[index]?.controlTypes)throw Error('Invalid strategy search rule association.');
  if(s.template===true){t.stages[stage].template=true;t.stages[stage].origin=s.origin==='verified-layout'?'verified-layout':'template';}
 }
 const m=t.stages.momentum.fields,x=t.stages.execution.fields;
 L.validate('momentum',m);L.validate('execution',x);
 const layout=P.settings({parameters:parameters(t)});
 if(layout.length!==3||layout.some(s=>s.groups.some(g=>g.name==='Captured settings')))throw Error('RZone controls changed. Reload the available setup before continuing.');
 t.supports={charts:[...new Set([m[0].value,x[3].value])],selection:['Price'],blocked:['market-filter','relative-strength']};
 if(t.adapterVersion)t.supports.executeCharts=['Candle'];
 return t;
}
function fieldsForUI(input,config={}){
 const t=template(input),groups=[],m=t.stages.momentum.fields,x=t.stages.execution.fields,p=t.stages.portfolio.fields,main=L.main(m[0].value),execution=L.execution(x[3].value);
 const group=(stage,key,title)=>{const g={stage,key:stage+'.'+key,title,fields:[]};groups.push(g);return g;};
 const add=(g,key,label,index,type,extra={})=>{
  const f=t.stages[g.stage].fields[index],d={key:g.stage+'.'+key,label,stage:g.stage,index,type,value:type==='boolean'?f.checked:type==='number'?V.number(f.value):f.value,...extra};
  if(type==='select'||type==='combobox')d.options=clone(t.stages[g.stage].options[index]||[{value:f.value,label:f.value,disabled:false}]);
  g.fields.push(d);return d;
 };
 const number=(g,key,label,index,min,max,extra={})=>add(g,key,label,index,'number',{min,max,...extra});
 const toggle=(g,key,label,index,extra={})=>add(g,key,label,index,'boolean',extra);
 const fixed=(g,key,label,index,reason)=>{const d=add(g,key,label,index,t.stages[g.stage].fields[index].type==='checkbox'?'boolean':'select',{disabled:true,reason});if(d.options)d.options.forEach(o=>{if(o.value!==d.value){o.disabled=true;o.reason=reason;}});return d;};
 const dynamic=(g,key,label,index,dependents)=>add(g,key,label,index,'select',{dynamic:true,refresh:true,refreshOnChange:true,dependents,help:'Refreshes the available rules from RZone when changed.'});
 const chartSelector=(g,layout)=>{const d=dynamic(g,'chart','Chart type',layout.chartIndex,layout.rows.map(row=>row.childIndex));d.chartContext=true;d.help='Loads the settings and choices for this chart.';for(const option of d.options)if(!L.charts.includes(option.value))option.disabled=true;return d;};
 const chartSettings=(stage,layout)=>{
  if(!layout.variant)return;const g=group(stage,'chart-settings','Chart settings'),renko=layout.chart==='Renko',modeKey=stage+'.brick.mode',mode=owns(config,modeKey)?config[modeKey]:t.stages[stage].fields[layout.modeIndex].value,atr=renko&&['ATR','ATR %'].includes(mode);
  number(g,renko?'brick.size':'box.size',atr?'ATR period':renko?'Brick size input':'Box size',layout.sizeIndex,atr?1:0.000001,1000000,{integer:atr});
  if(renko){const d=dynamic(g,'brick.mode','Brick size mode',layout.modeIndex,[layout.sizeIndex]);d.help='Loads the size input for this brick mode. The mode stays fixed within a test batch.';d.chartContext=true;}
  else add(g,'box.reversal','Reversal size',layout.modeIndex,'select');
  toggle(g,'price.close-only','Close Only',layout.priceIndices[0]);toggle(g,'price.high-low','High & Low',layout.priceIndices[1]);
  if(stage==='momentum'){const selected=layout.signalIndices.filter(index=>m[index].checked);if(selected.length!==1)throw Error('Choose exactly one Running or Fresh signal in RZone.');g.fields.push({stage,key:stage+'.signal-mode',label:'Signal mode',type:'select',indices:clone(layout.signalIndices),value:String(selected[0]),options:layout.signalIndices.map((index,n)=>({value:String(index),label:['Running','Fresh'][n],disabled:false}))});}
 };
 let g=group('momentum','universe','Strategy');
 chartSelector(g,main);
 const hasGroupCatalogue=owns(t.stages.momentum.options,1);
 add(g,'group','Universe / group',1,hasGroupCatalogue?'combobox':'text',{maxLength:200,help:hasGroupCatalogue?'':'Enter the exact group name. RZone must resolve it before a backtest can start.'});
 const market=add(g,'market','Market',3,'select',hasGroupCatalogue?{dynamic:true,refresh:true,refreshOnChange:true,dependents:[1],help:'Refreshes the available groups from RZone when changed.'}:{});
 if(t.stages.momentum.supportedMarkets)for(const option of market.options)if(!t.stages.momentum.supportedMarkets.includes(option.value)){option.disabled=true;option.reason='Automatic setup currently supports NSE. Other markets use a different source layout.';}
 add(g,'timeframe','Timeframe',33,'select');
 chartSettings('momentum',main);
 g=group('momentum','periods','Momentum periods');
 for(let i=1;i<=4;i++){
  toggle(g,'period.'+i+'.enabled','Use Period '+i,9+i*2);
  number(g,'period.'+i,'Period '+i,10+i*2,1,1000000,{integer:true,enabledBy:'momentum.period.'+i+'.enabled'});
  number(g,'period.'+i+'.weight','Period '+i+' weight',21+i,0,1000,{enabledBy:'momentum.period.'+i+'.enabled'});
 }
 g=group('momentum','trend','EMA & TMA');
 for(let i=1;i<=3;i++){toggle(g,'ema.'+i+'.enabled','Use EMA '+i,24+i*2);number(g,'ema.'+i,'EMA '+i,25+i*2,1,1000000,{integer:true,enabledBy:'momentum.ema.'+i+'.enabled'});}
 toggle(g,'tma','TMA Trend',32);
 g=group('momentum','filters','Retracement & volume');
 toggle(g,'retracement.enabled','Use retracement',4);number(g,'retracement','Retracement (%)',5,0,100,{enabledBy:'momentum.retracement.enabled'});add(g,'retracement.mode','Retracement condition',6,'select',{enabledBy:'momentum.retracement.enabled'});
 const reference=(key,label,indices,names)=>{const selected=indices.filter(i=>m[i].checked);if(selected.length!==1)throw Error('Choose exactly one '+label.toLowerCase()+' in the source setup.');g.fields.push({stage:'momentum',key:'momentum.'+key,label,type:'select',indices,value:String(selected[0]),options:indices.map((i,n)=>({value:String(i),label:names[n],disabled:false}))});};
 reference('retracement.reference','Retracement reference',[7,8,9,10],['52 Week High','52 Week Low','ATH','ATL']);g.fields.at(-1).enabledBy='momentum.retracement.enabled';
 number(g,'volume','Minimum volume',19,0,1000000000000,{integer:true});reference('volume.reference','Volume reference',[20,21],['Average','Highest']);
 toggle(g,'trend-quality.enabled','Use Trend Quality',main.trendGateIndex);number(g,'trend-quality','Trend Quality (%)',main.trendValueIndex,0,100,{enabledBy:'momentum.trend-quality.enabled'});
 g=group('momentum','rules','Additional rules');
 for(const [key,label,index] of [['market-filter','Market trend filter',main.mtfIndex],['rs','Relative Strength',main.rsIndex]])fixed(g,key,label,index,blocked).value=false;
 const cachedRule=(g,parent,child)=>{
  const catalogue=t.stages[g.stage].ruleCatalogues?.[child.index];if(!catalogue)return;
  const category=owns(config,parent.key)?config[parent.key]:parent.value;
  parent.cachedCategories=parent.options.filter(o=>owns(catalogue.categories,o.value)).map(o=>o.value);
  parent.help='Choose a category to see its loaded rules. Refresh choices after changing rules in RZone.';
  child.sourceKey=parent.key;child.categoryKey=category;
  if(catalogue.controlTypes){child.nativeType=catalogue.controlTypes[category]||t.stages[g.stage].fields[child.index].type;child.searchable=child.nativeType==='text';if(child.searchable)child.searchQuery=catalogue.searchQueries?.[category]??null;}
  if(owns(catalogue.categories,category))child.options=clone(catalogue.categories[category]);
  else if(category!==parent.value)child.options=[];
  if(category!==parent.value)child.value='';
 };
 for(const [i,row] of main.rows.entries()){
  const key=i?'strategy.'+i:'radar',label=row.name;toggle(g,key+'.enabled','Use '+label,row.gateIndex);
  const parent=dynamic(g,key+'.source',label+' source',row.parentIndex,[row.childIndex]),child=add(g,key+'.rule',label+' rule',row.childIndex,'select',{enabledBy:'momentum.'+key+'.enabled',rule:true});cachedRule(g,parent,child);
  if(i){if(row.companionType==='number')number(g,key+'.input',label+' input',row.valueIndex,0.000001,1000000,{enabledBy:'momentum.'+key+'.enabled'});else add(g,key+'.timeframe',label+' timeframe',row.valueIndex,'select',{enabledBy:'momentum.'+key+'.enabled'});}
 }
 g=group('execution','test','Backtest');
 add(g,'rank','Rank criteria',0,'select');add(g,'from','From date',1,'date');add(g,'to','To date',2,'date');chartSelector(g,execution);fixed(g,'selection','Selection type',execution.selectionIndex,'Automatic testing currently supports Price. RS and Both are not yet available.');
 chartSettings('execution',execution);
 g=group('execution','exits','Exits');
 toggle(g,'target.enabled','Use profit target',execution.targetGateIndex);number(g,'target','Profit target (%)',execution.targetValueIndex,0.000001,100,{enabledBy:'execution.target.enabled'});toggle(g,'stop.enabled','Use stop loss',execution.stopGateIndex);number(g,'stop','Stop loss (%)',execution.stopValueIndex,0.000001,100,{enabledBy:'execution.stop.enabled'});
 const exit=execution.rows[0];toggle(g,'exit.enabled','Use exit strategy',exit.gateIndex);const exitSource=dynamic(g,'exit.source','Exit strategy source',exit.parentIndex,[exit.childIndex]),exitRule=add(g,'exit.rule','Exit strategy rule',exit.childIndex,'select',{enabledBy:'execution.exit.enabled',rule:true});cachedRule(g,exitSource,exitRule);
 g=group('portfolio','allocation','Portfolio');
 fixed(g,'enabled','Portfolio testing',0,'Portfolio testing is required to collect the full report.').value=true;add(g,'allocation','Allocation',1,'select');number(g,'capital','Initial capital',2,0.01,1000000000000000);number(g,'max-open','Maximum open trades',3,1,1000000,{integer:true});toggle(g,'daily-limit.enabled','Limit new stocks per day',4);number(g,'daily-limit','Stocks per day',5,1,1000000,{integer:true,enabledBy:'portfolio.daily-limit.enabled'});
 if(t.stages.portfolio.template)g.note='Editable portfolio defaults; confirmed against RZone before submission.';
 return groups;
}
function defaults(input){return Object.fromEntries(fieldsForUI(input).flatMap(g=>g.fields.map(f=>[f.key,f.value])));}
function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
function validateConfig(config,input){
 if(!config||typeof config!=='object'||Array.isArray(config))throw Error('Check the backtest setup.');
 const descriptors=fieldsForUI(input,config).flatMap(g=>g.fields),keys=new Set(descriptors.map(f=>f.key)),out={};
 if(Object.keys(config).some(k=>!keys.has(k)))throw Error('Unknown setting in the backtest setup.');
 for(const f of descriptors){let v=config[f.key];if(v===undefined)throw Error('Choose '+f.label+'.');
  if(f.type==='boolean'){if(typeof v!=='boolean')throw Error(f.label+' must be on or off.');}
  else if(f.type==='number'){if(!['string','number'].includes(typeof v)||typeof v==='string'&&!/^\s*[+]?(?:\d+(?:\.\d*)?|\.\d+)\s*$/.test(v))throw Error(f.label+': enter a valid number.');v=Number(v);if(!Number.isFinite(v)||v<f.min||v>f.max||(f.integer&&!Number.isInteger(v)))throw Error(f.label+': enter '+(f.integer?'a whole number':'a number')+' between '+f.min+' and '+f.max+'.');}
  else if(f.type==='combobox'){
   if(!f.options.length)throw Error('No '+f.label.toLowerCase()+' choices are available. Refresh choices in RZone.');
   if(typeof v!=='string'||!v.trim()||!f.options.some(o=>o.value===v&&!o.disabled))throw Error('Choose an available '+f.label.toLowerCase()+'.');
  }
  else if(f.type==='select'){
   const unchangedInactive=(f.disabled||f.enabledBy&&config[f.enabledBy]===false)&&v===f.value;
   const emptyUnusedRule=f.rule&&(f.options.length===0&&f.value===''||f.nativeType==='text')&&v===''&&config[f.enabledBy]===false;
   if(f.rule&&f.options.length===0&&config[f.enabledBy]===true)throw Error(f.searchable&&!f.searchQuery?'Search RZone for '+f.label.toLowerCase()+' before enabling it.':'No '+f.label.toLowerCase()+' choices are available. Turn the rule off or '+(f.searchable?'search again.':'refresh choices.'));
   if(typeof v!=='string'||!emptyUnusedRule&&!f.options.some(o=>o.value===v&&(!o.disabled||unchangedInactive)))throw Error('Choose an available '+f.label.toLowerCase()+'.');
   if(f.rule&&config[f.enabledBy]===true&&(!v.trim()||/^\s*--|select.*(?:system|rule|radar)/i.test(v)))throw Error('Choose a '+f.label.toLowerCase()+' before enabling it.');
  }
  else if(f.type==='date'){if(!validDate(v))throw Error(f.label+': choose a valid date.');}
  else {if(typeof v!=='string'||!v.trim()||v.trim().length>(f.maxLength||2000)||/[\u0000-\u001f]/.test(v))throw Error('Enter a valid '+f.label.toLowerCase()+'.');v=v.trim();}
  if(f.disabled&&!same(v,f.value))throw Error(f.label+' is not available for automatic setup.');
  if(f.dynamic&&!same(v,f.value)&&!f.cachedCategories?.includes(v))throw Error('Refresh choices for '+f.label+' before continuing.');out[f.key]=v;
 }
 if(out['execution.from']>=out['execution.to'])throw Error('The end date must be after the start date.');
 for(const stage of ['momentum','execution'])if(owns(out,stage+'.price.close-only')&&Number(out[stage+'.price.close-only'])+Number(out[stage+'.price.high-low'])!==1)throw Error('Choose exactly one '+(stage==='momentum'?'Momentum':'Backtest')+' price mode: Close Only or High & Low.');
 if(![1,2,3,4].some(i=>out['momentum.period.'+i+'.enabled']&&out['momentum.period.'+i+'.weight']>0))throw Error('Enable at least one period with a positive weight.');
 return out;
}
function configToBaseline(config,input,{id='vault-setup',name='New strategy',demo}={}){
 const t=template(input),values=validateConfig(config,t);
 if(!idOK(id)||typeof name!=='string'||!name.trim()||name.length>120)throw Error('Give this setup a short name.');
 if(demo!==undefined&&demo!==t.demo)throw Error('Real and fictional setup cannot be mixed.');
 const p=parameters(t),get=stage=>stage==='momentum'?p.strategy.main.fields:stage==='execution'?p.strategy.execution.fields:p.settings.fields;
 for(const d of fieldsForUI(t,values).flatMap(g=>g.fields)){const f=get(d.stage),v=values[d.key];if(d.indices){for(const i of d.indices)f[i].checked=String(i)===v;}else if(d.type==='boolean')f[d.index].checked=v;else{f[d.index].value=String(v);if(d.nativeType)f[d.index].type=d.nativeType;}}
 for(const stage of ['momentum','execution']){
  const f=get(stage),labels=projectRuleLabels(t.stages[stage].fields,t.stages[stage].ruleCatalogues,f);f.forEach((field,index)=>{field.label=labels[index];});
 }
 // Disabled is a recorded UI condition, not a user setting. Keep dependencies
 // consistent for presentation while the runner always verifies source values.
 for(const d of fieldsForUI(t,values).flatMap(g=>g.fields)){if(d.enabledBy&&d.index!==undefined)get(d.stage)[d.index].disabled=!values[d.enabledBy];}
 return {id,name:name.trim(),demo:t.demo,origin:'vault-setup',setupVersion:1,parameters:p,setup:{version:1,template:t,config:values}};
}
function validateBaseline(b){
 if(!b||b.origin!=='vault-setup'||b.setupVersion!==1||b.setup?.version!==1||!idOK(b.id)||typeof b.demo!=='boolean')throw Error('Invalid Vault setup baseline.');
 const rebuilt=configToBaseline(b.setup.config,b.setup.template,{id:b.id,name:b.name,demo:b.demo});
 if(!same(b.parameters,rebuilt.parameters)||!same(b.setup,rebuilt.setup)||Object.keys(b).some(k=>!['id','name','demo','origin','setupVersion','parameters','setup'].includes(k)))throw Error('Vault setup settings or source template were altered.');
 return b;
}
function executionCapability(input){const t=template(input),available=t.stages.momentum.fields[0].value==='Candle'&&t.stages.execution.fields[3].value==='Candle';return {available,reason:available?'':'Automatic execution for P&F and Renko is awaiting verification. You can review their settings and choices.'};}
function demoTemplate({momentumChart='Candle',executionChart=momentumChart,momentumBrickMode,executionBrickMode}={}){
 const D=typeof module!=='undefined'?require('./demo.js'):root.VaultDemo;
 L.main(momentumChart);L.execution(executionChart);const samples=D.create(),r=samples.find(r=>r.parameters.strategy.main.fields[0].value===momentumChart&&r.parameters.strategy.main.fields.length===L.main(momentumChart).count),execution=samples.find(r=>r.parameters.strategy.execution.fields[3].value===executionChart),source={demo:true,adapterVersion:L.version,stages:{momentum:{fields:clone(r.parameters.strategy.main.fields)},execution:{fields:clone(execution.parameters.strategy.execution.fields)},portfolio:portfolioTemplate()}};
 // This helper builds fictional editor examples, not a copy of live source
 // state. Its initial price choice is deliberate; live flags are never fixed.
 for(const stage of ['momentum','execution']){const layout=stage==='momentum'?L.main(momentumChart):L.execution(executionChart),s=source.stages[stage],brickMode=stage==='momentum'?momentumBrickMode:executionBrickMode;s.options={[layout.chartIndex]:L.charts.map(value=>({value,label:value}))};if(layout.variant){s.fields[layout.priceIndices[0]].checked=true;s.fields[layout.priceIndices[1]].checked=false;s.options[layout.modeIndex]=(layout.chart==='Renko'?['Absolute','Percent','ATR','ATR %']:Array.from({length:14},(_,i)=>String(i+2))).map(value=>({value,label:value}));}if(brickMode!==undefined){const sizes={Absolute:'10',Percent:'1',ATR:'14','ATR %':'14'};if(layout.chart!=='Renko'||!owns(sizes,brickMode))throw Error('Choose an available Renko brick mode.');s.fields[layout.modeIndex].value=brickMode;s.fields[layout.sizeIndex].value=sizes[brickMode];}}
 // Fictional UI choices are kept in demo-only memory and never advertised as
 // options fetched from the user's authenticated RZone account.
 Object.assign(source.stages.momentum.options,{1:[r.parameters.strategy.main.fields[1].value,'Demo universe 20','Demo universe 60'],3:['NSE'].map(value=>({value,label:value})),33:['Daily','Weekly'].map(value=>({value,label:value}))});
 return template(source);
}
const api={template,portfolioTemplate,fieldsForUI,defaults,validDate,validateConfig,configToBaseline,validateBaseline,projectRuleLabels,executionCapability,demoTemplate};
if(typeof module!=='undefined')module.exports=api;root.VaultSetup=api;
})(typeof window!=='undefined'?window:globalThis);
