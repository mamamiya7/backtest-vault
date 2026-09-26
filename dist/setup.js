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
const symbolMarketMatches=(requested,actual)=>requested===actual||requested==='All'&&['NSE','BSE','MF','EQW'].includes(actual);
function mergeSymbolChoices(previous,current,market){
 const identities=new Map();
 for(const option of [...(previous||[]),...(current||[])]){
  if(!option||typeof option.label!=='string'||!option.label||typeof option.sourceValue!=='string'||!option.sourceValue||!symbolMarketMatches(market,option.market))continue;
  identities.set(JSON.stringify([option.market,option.sourceValue]),{value:option.label,label:option.label,disabled:option.disabled===true,sourceValue:option.sourceValue,market:option.market});
 }
 const labels=new Map();
 for(const option of identities.values()){
  const prior=labels.get(option.label);
  if(prior)prior.disabled=true;else labels.set(option.label,option);
 }
 return [...labels.values()];
}
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
  const rsConstruction=stage==='momentum'&&layout.variant&&shape.name==='Relative Strength',knownDependents=layout.labelDependents?.[key],prefix=fields[shape.parentIndex].label+' → ';
  const dependencies=entry.labelDependents;
  if(dependencies!==undefined&&(stage!=='momentum'||!owns(layout.labelDependents,key)||!same(dependencies,knownDependents)||!fieldLabels||Object.values(fieldLabels).some(labels=>(rsConstruction?labels.slice(0,2):labels).some(label=>label!==labels[0]))))throw Error('Invalid strategy label dependencies.');
  out[key]={parentIndex:shape.parentIndex,gateIndex:shape.gateIndex,categories,...(controlTypes?{controlTypes}:{}),...(searchQueries?{searchQueries}:{}),...(fieldLabels?{fieldLabels}:{}),...(dependencies!==undefined?{labelDependents:clone(dependencies)}:{})};
 }
 for(const [key,catalogue] of Object.entries(out))if(catalogue.labelDependents){
  const prefix=fields[catalogue.parentIndex].label+' → ',child=layout.rows.find(row=>row.parentIndex===catalogue.labelDependents[0])?.childIndex,labels=out[child]?.fieldLabels;
  const construction=shapes[key].name==='Relative Strength'&&layout.variant;
  if(!construction&&!labels||catalogue.labelDependents.some(index=>!fields[index].label.startsWith(prefix)||fields[index].label.length===prefix.length)||labels&&Object.values(labels).some(row=>row.some(label=>!label.startsWith(prefix)||label.length===prefix.length)))throw Error('Invalid strategy label dependency evidence.');
 }
 return out;
}

function projectRuleLabels(baseFields,catalogues,selectedFields,sourceStage){
 const stage=sourceStage||(baseFields[1]?.type==='date'?'execution':'momentum'),layout=layoutFor(stage,baseFields),labels=baseFields.map(f=>f.label);
 for(const [key,catalogue] of Object.entries(catalogues||{})){
  const observed=catalogue.fieldLabels?.[selectedFields[catalogue.parentIndex]?.value];if(!observed)continue;
  ruleRowIndices(stage,key,layout.rows.find(row=>row.childIndex===Number(key))).forEach((index,n)=>{labels[index]=observed[n];});
 }
 for(const [key,catalogue] of Object.entries(catalogues||{})){
  const original=baseFields[catalogue.parentIndex].label+' → ',updated=labels[catalogue.parentIndex]+' → ';
  // Project the known legacy RS ancestor without changing archived templates.
  const known=layout.labelDependents?.[key],rs=stage==='momentum'&&layout.variant&&layout.rows.find(row=>row.childIndex===Number(key))?.name==='Relative Strength';
  const dependencies=catalogue.labelDependents||(rs&&known?.every(index=>labels[index].startsWith(original)&&labels[index].length>original.length)?known:[]);
  for(const index of dependencies){
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
 function normalize(stage,s){
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
     const identity=stage==='momentum'&&(f.index===1||f.index===layout.benchmarkIndex)||stage==='execution'&&f.index===layout.benchmarkIndex||stage==='marketFilter'&&[layout.indexSymbolIndex,layout.numeratorSymbolIndex,layout.denominatorSymbolIndex].includes(f.index);
     if(identity&&raw.sourceValue!==undefined){if(typeof raw.sourceValue!=='string'||!raw.sourceValue||raw.sourceValue.length>2000||/[\u0000-\u001f]/.test(raw.sourceValue))throw Error('Invalid native choice identity.');entry.sourceValue=raw.sourceValue;}
     if(identity&&raw.market!==undefined){if(typeof raw.market!=='string'||!['All','NSE','BSE','MF','EQW'].includes(raw.market))throw Error('Invalid benchmark market.');entry.market=raw.market;}
     if(seen.has(value))throw Error('Ambiguous source choices for '+f.label);seen.add(value);return entry;
    });
   }else if(f.type==='select-one')options[f.index]=[{value:f.value,label:f.value,disabled:false}];
   const emptyRule=ruleIndices.includes(f.index)&&options[f.index]?.length===0&&f.value==='';
   if(f.type==='select-one'&&!emptyRule&&!options[f.index].some(o=>o.value===f.value))throw Error('Selected source value is absent from its choices: '+f.label);
  }
  const out={fields,options};
  if(owns(s,'supportedMarkets')){
   if(stage!=='momentum'||!same(s.supportedMarkets,['NSE'])||fields[3]?.value!=='NSE')throw Error('This RZone market layout is not available for automatic setup yet.');
   out.supportedMarkets=['NSE'];
  }
  if(owns(s,'ruleCatalogues'))out.ruleCatalogues=ruleCatalogues(s.ruleCatalogues,stage,fields,options);
  for(const index of ruleIndices)if(fields[index]?.type==='text'&&!out.ruleCatalogues?.[index]?.controlTypes)throw Error('Invalid strategy search rule association.');
  if(s.template===true){out.template=true;out.origin=s.origin==='verified-layout'?'verified-layout':'template';}
  const symbolIndices=stage==='momentum'?[layout.benchmarkIndex]:stage==='execution'?[layout.benchmarkIndex]:stage==='marketFilter'?[layout.indexSymbolIndex,layout.numeratorSymbolIndex,layout.denominatorSymbolIndex]:[];
  if(s.symbolQueries!==undefined){if(!record(s.symbolQueries))throw Error('Invalid benchmark searches.');out.symbolQueries={};for(const [index,entry] of Object.entries(s.symbolQueries)){if(!symbolIndices.includes(Number(index))||!record(entry)||Object.keys(entry).some(key=>!['market','query'].includes(key))||typeof entry.market!=='string'||typeof entry.query!=='string'||!entry.query.trim()||entry.query.length>200||/[\u0000-\u001f]/.test(entry.query))throw Error('Invalid benchmark search.');out.symbolQueries[index]={market:entry.market,query:entry.query};}}
  return out;
 }
 for(const stage of stages)t.stages[stage]=normalize(stage,input[stage]||(stage==='portfolio'?portfolioTemplate():null));
 const filters=source.supports?.filters;if(filters!==undefined){if(!Array.isArray(filters)||filters.some(value=>!['relative-strength','market-filter'].includes(value))||new Set(filters).size!==filters.length)throw Error('Invalid filter capabilities.');}
 for(const key of ['relativeStrength','withoutRelativeStrength'])if(input.momentum?.[key]){const sub=normalize('momentum',input.momentum[key]),layout=L.stage('momentum',sub.fields);if(layout.chart!==t.stages.momentum.fields[0].value||layout.relativeStrength!==(key==='relativeStrength'))throw Error('Relative Strength source context changed.');t.stages.momentum[key]=sub;}
 if(input.marketFilter){const sub=normalize('marketFilter',input.marketFilter),layout=L.stage('marketFilter',sub.fields);if(!layout.hasExit||!sub.fields[layout.indexModeIndex].checked)throw Error('Read the complete market trend filter settings.');if(!input.marketFilter.current?.fields)throw Error('Market trend current settings were not recorded.');const current=clone(input.marketFilter.current);L.stage('marketFilter',current.fields);if(current.fields.length>100||current.fields.some((f,index)=>!f||f.index!==index||!['text','date','checkbox','radio','select-one'].includes(f.type)||typeof f.label!=='string'||!f.label.trim()||f.label.length>2000||typeof f.value!=='string'||f.value.length>2000||typeof f.disabled!=='boolean'||(['checkbox','radio'].includes(f.type)?typeof f.checked!=='boolean':f.checked!==null)))throw Error('Invalid current market trend fields.');if(current.fields[0].value!==sub.fields[0].value)throw Error('Market trend chart context changed.');sub.current={fields:current.fields.map(({index,type,label,value,checked,disabled})=>({index,type,label,value,checked,disabled}))};t.stages.marketFilter=sub;}

 const m=t.stages.momentum.fields,x=t.stages.execution.fields;
 L.validate('momentum',m);const executionLayout=L.validate('execution',x);if(executionLayout.selection!=='Price')throw Error('Automatic setup currently requires Price selection.');
 const layout=P.settings({parameters:parameters(t)});
 if(layout.filter(s=>stages.includes(s.key)).length!==3||layout.filter(s=>stages.includes(s.key)).some(s=>s.groups.some(g=>g.name==='Captured settings')))throw Error('RZone controls changed. Reload the available setup before continuing.');
 t.supports={charts:[...new Set([m[0].value,x[3].value])],selection:['Price'],blocked:['market-filter','relative-strength']};
 if(filters){t.supports.filters=[...filters];t.supports.blocked=t.supports.blocked.filter(value=>!filters.includes(value));}
 if(m[L.main(m[0].value).rsIndex].checked&&!t.stages.momentum.relativeStrength&&!filters?.includes('relative-strength'))throw Error('Load complete Relative Strength settings before continuing.');
 if(m[2].checked&&!t.stages.marketFilter&&!filters?.includes('market-filter'))throw Error('Load complete Market Trend Filter settings before continuing.');
 if(t.adapterVersion){
  const executionCharts=source.supports&&owns(source.supports,'executeCharts')?source.supports.executeCharts:['Candle'];
  if(!Array.isArray(executionCharts)||executionCharts.some(chart=>!L.charts.includes(chart))||new Set(executionCharts).size!==executionCharts.length)throw Error('Invalid source execution capabilities.');
  t.supports.executeCharts=[...executionCharts];
 }
 return t;
}
function editorStages(t){
 const out=clone(t.stages),current=out.momentum,rs=current.relativeStrength;
 if(rs){const original=L.stage('momentum',current.fields),expanded=L.stage('momentum',rs.fields),full=clone(rs);
  for(let index=0;index<=original.rsIndex;index++)full.fields[index]=clone(current.fields[index]);
  if(original.variant)for(const name of ['sizeIndex','modeIndex',...[]]){const a=original[name],b=expanded[name];full.fields[b]={...current.fields[a],index:b,label:rs.fields[b].label};if(current.options[a])full.options[b]=clone(current.options[a]);}
  if(original.variant)original.priceIndices.forEach((a,n)=>{const b=expanded.priceIndices[n];full.fields[b]={...current.fields[a],index:b,label:rs.fields[b].label};});
  for(const [index,options]of Object.entries(current.options))if(Number(index)<=original.rsIndex)full.options[index]=clone(options);
  full.ruleCatalogues={...clone(current.ruleCatalogues||{}),...Object.fromEntries(Object.entries(rs.ruleCatalogues||{}).filter(([key])=>Number(key)===expanded.rows.at(-1).childIndex))};
  out.momentum=full;
 }
 if(out.marketFilter){const full=out.marketFilter,now=full.current.fields,a=L.marketFilter(now),b=L.marketFilter(full.fields);
  const keys=['chartIndex','sizeIndex','modeIndex','indexModeIndex','rsModeIndex','indexMarketIndex','indexSymbolIndex','numeratorMarketIndex','numeratorSymbolIndex','denominatorMarketIndex','denominatorSymbolIndex','actionIndex','targetGateIndex','targetValueIndex','stopGateIndex','stopValueIndex','exitSizeIndex','exitModeIndex'];
  const pairs=keys.filter(key=>a[key]!==null&&a[key]!==undefined&&b[key]!==null&&b[key]!==undefined).map(key=>[a[key],b[key]]);
  for(const key of ['priceIndices','methodIndices','methodValueIndices','exitPriceIndices'])a[key].forEach((index,n)=>{if(b[key][n]!==undefined)pairs.push([index,b[key][n]]);});
  if(a.rows[0])for(const key of ['gateIndex','parentIndex','childIndex'])pairs.push([a.rows[0][key],b.rows[0][key]]);
  for(const [from,to]of pairs)full.fields[to]={...now[from],index:to,label:full.fields[to].label};
 }
 return out;
}
function descriptorForFields(input,stage,expected){
 const t=template(input);if(stage==='portfolio')return clone(t.stages.portfolio);const target=L.stage(stage,expected),editing=editorStages(t);let descriptor=clone(editing[stage]);if(!descriptor)throw Error('Load the '+stage+' settings before running.');
 let fields,mapping;
 if(stage==='marketFilter'){
  const observed=t.stages.marketFilter,from=L.marketFilter(observed.fields);descriptor=clone(observed);fields=L.projectMarketFilter(observed.fields,{mode:expected[target.rsModeIndex].checked?'RS':'Index',action:expected[target.actionIndex].value});const projected=L.marketFilter(fields);mapping=new Map();
  const singles=['chartIndex','sizeIndex','modeIndex','indexModeIndex','rsModeIndex','indexMarketIndex','indexSymbolIndex','numeratorMarketIndex','numeratorSymbolIndex','denominatorMarketIndex','denominatorSymbolIndex','actionIndex','targetGateIndex','targetValueIndex','stopGateIndex','stopValueIndex','exitSizeIndex','exitModeIndex'];
  for(const key of singles)if(Number.isInteger(from[key])&&Number.isInteger(projected[key]))mapping.set(from[key],projected[key]);
  for(const key of ['priceIndices','methodIndices','methodValueIndices','exitPriceIndices'])from[key].forEach((index,n)=>{if(Number.isInteger(projected[key][n]))mapping.set(index,projected[key][n]);});
  if(projected.rows[0])for(const key of ['parentIndex','childIndex','gateIndex'])mapping.set(from.rows[0][key],projected.rows[0][key]);
 }else if(stage==='momentum'&&t.stages.momentum.relativeStrength){
  const from=L.main(descriptor.fields[0].value,true);descriptor.fields[from.rsIndex].checked=true;mapping=new Map();fields=[];
  const push=(index,label)=>{const field=descriptor.fields[index],next=fields.length;mapping.set(index,next);fields.push({...field,index:next,...(label?{label}:{})});};
  for(let index=0;index<=from.rsIndex;index++)push(index);
  if(target.relativeStrength){for(let index=from.rsIndex+1;index<descriptor.fields.length;index++)push(index);}else if(from.variant){const off=t.stages.momentum.fields.length===target.count?t.stages.momentum:t.stages.momentum.withoutRelativeStrength;if(!off)throw Error('Read the Relative Strength off settings.');[from.sizeIndex,from.modeIndex,...from.priceIndices].forEach((index,n)=>push(index,off.fields[[target.sizeIndex,target.modeIndex,...target.priceIndices][n]].label));}
  fields[target.rsIndex].checked=target.relativeStrength;
 }else return descriptor;
 descriptor.fields=fields;descriptor.options=Object.fromEntries(Object.entries(descriptor.options||{}).filter(([index])=>mapping.has(Number(index))).map(([index,options])=>[mapping.get(Number(index)),options]));
 if(descriptor.symbolQueries)descriptor.symbolQueries=Object.fromEntries(Object.entries(descriptor.symbolQueries).filter(([index])=>mapping.has(Number(index))).map(([index,value])=>[mapping.get(Number(index)),value]));
 if(descriptor.ruleCatalogues)descriptor.ruleCatalogues=Object.fromEntries(Object.entries(descriptor.ruleCatalogues).filter(([index])=>mapping.has(Number(index))).map(([index,catalogue])=>[mapping.get(Number(index)),{...catalogue,parentIndex:mapping.get(catalogue.parentIndex),gateIndex:mapping.get(catalogue.gateIndex),...(catalogue.labelDependents?{labelDependents:catalogue.labelDependents.map(index=>mapping.get(index))}:{})}]));
 delete descriptor.current;delete descriptor.relativeStrength;delete descriptor.withoutRelativeStrength;L.stage(stage,descriptor.fields);return descriptor;
}
function activeField(field,config){return (!field.enabledBy||config[field.enabledBy]===true)&&(!field.activeWhen||field.activeWhen.every(condition=>condition.values.includes(config[condition.key])));}
function fieldsForUI(input,config={}){
 const source=template(input),t={...source,stages:editorStages(source)},groups=[],m=t.stages.momentum.fields,x=t.stages.execution.fields,p=t.stages.portfolio.fields,main=L.main(m[0].value,!!source.stages.momentum.relativeStrength||L.stage('momentum',source.stages.momentum.fields).relativeStrength),execution=L.stage('execution',x);
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
 for(const [key,label,index,capability,loaded] of [['market-filter','Market trend filter',main.mtfIndex,'market-filter',!!source.stages.marketFilter],['rs','Relative Strength',main.rsIndex,'relative-strength',!!source.stages.momentum.relativeStrength&&(source.stages.momentum.fields.length===L.main(m[0].value).count||!!source.stages.momentum.withoutRelativeStrength)]]){if(source.supports.filters?.includes(capability)){toggle(g,key,label,index,{variation:true,...(!loaded?{needsDiscovery:true}:{})});}else fixed(g,key,label,index,blocked).value=false;}
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
 for(const [i,row] of main.rows.slice(0,4).entries()){
  const key=i?'strategy.'+i:'radar',label=row.name;toggle(g,key+'.enabled','Use '+label,row.gateIndex);
  const parent=dynamic(g,key+'.source',label+' source',row.parentIndex,[row.childIndex]),child=add(g,key+'.rule',label+' rule',row.childIndex,'select',{enabledBy:'momentum.'+key+'.enabled',rule:true});cachedRule(g,parent,child);
  if(i){if(row.companionType==='number')number(g,key+'.input',label+' input',row.valueIndex,0.000001,1000000,{enabledBy:'momentum.'+key+'.enabled'});else add(g,key+'.timeframe',label+' timeframe',row.valueIndex,'select',{enabledBy:'momentum.'+key+'.enabled'});}
 }
 const symbol=(g,key,label,index,marketKey,extra={})=>{const d=add(g,key,label,index,'combobox',{symbol:true,marketKey,variation:true,...extra});const market=config[marketKey]??groups.flatMap(group=>group.fields).find(field=>field.key===marketKey)?.value;d.options=d.options.filter(option=>option.sourceValue&&symbolMarketMatches(market,option.market));d.searchQuery=t.stages[g.stage].symbolQueries?.[index]?.market===market?t.stages[g.stage].symbolQueries[index].query:null;return d;};
 if(source.stages.momentum.relativeStrength){g=group('momentum','relative-strength','Relative Strength');const row=main.rows.at(-1),extra={sourceContainer:'relativeStrength',enabledBy:'momentum.rs',variation:true};
  const market=dynamic(g,'rs.market','Benchmark market',main.benchmarkMarketIndex,[main.benchmarkIndex]);Object.assign(market,{sourceContainer:'relativeStrength',enabledBy:'momentum.rs'});
  symbol(g,'rs.benchmark','Benchmark',main.benchmarkIndex,'momentum.rs.market',extra);
  const parent=dynamic(g,'rs.source','Relative Strength source',row.parentIndex,[row.childIndex]),child=add(g,'rs.rule','Relative Strength rule',row.childIndex,'select',{...extra,rule:true});Object.assign(parent,{sourceContainer:'relativeStrength',enabledBy:'momentum.rs'});cachedRule(g,parent,child);if(main.variant&&parent.cachedCategories)parent.cachedCategories=[parent.value];
 }
 if(source.stages.marketFilter){const original=source.stages.marketFilter,layout=L.marketFilter(original.fields),f=t.stages.marketFilter.fields,base={enabledBy:'momentum.market-filter',variation:true};g=group('marketFilter','filter','Market trend filter');
  chartSelector(g,layout).enabledBy='momentum.market-filter';
  const radios=(key,label,indices,names,extra={})=>{const selected=indices.filter(index=>f[index].checked);if(selected.length!==1)throw Error('Choose exactly one '+label.toLowerCase()+'.');const d={stage:'marketFilter',key:'marketFilter.'+key,label,type:'select',indices:clone(indices),radioValues:clone(names),value:names[indices.indexOf(selected[0])],options:names.map(value=>({value,label:value,disabled:false})),...base,...extra};g.fields.push(d);return d;};
  radios('mode','Filter mode',[layout.indexModeIndex,layout.rsModeIndex],['Index','RS']);
  const benchmarks=[['index','Index',layout.indexMarketIndex,layout.indexSymbolIndex,'Index'],['numerator','RS numerator',layout.numeratorMarketIndex,layout.numeratorSymbolIndex,'RS'],['denominator','RS denominator',layout.denominatorMarketIndex,layout.denominatorSymbolIndex,'RS']];
  for(const [key,label,marketIndex,symbolIndex,mode]of benchmarks){const activeWhen=[{key:'marketFilter.mode',values:[mode]}],market=dynamic(g,key+'.market',label+' market',marketIndex,[symbolIndex]);Object.assign(market,{enabledBy:base.enabledBy,activeWhen});symbol(g,key+'.symbol',label,symbolIndex,'marketFilter.'+key+'.market',{...base,activeWhen});}
  radios('method','Trend method',layout.methodIndices,['EMA','D Smart','MAST','KTQP']);
  for(const [n,key]of ['ema','dsmart','mast','ktqp'].entries())number(g,key,['EMA','D Smart','MAST','KTQP'][n]+' period',layout.methodValueIndices[n],1,1000000,{...base,integer:true,activeWhen:[{key:'marketFilter.method',values:[['EMA','D Smart','MAST','KTQP'][n]]}]});
  add(g,'action','When trend changes',layout.actionIndex,'select',base);
  const exitWhen=[{key:'marketFilter.action',values:L.marketActions.slice(2)}],row=layout.rows[0];
  toggle(g,'exit.enabled','Use exit strategy',row.gateIndex,{...base,activeWhen:exitWhen});const parent=dynamic(g,'exit.source','Exit strategy source',row.parentIndex,[row.childIndex]),child=add(g,'exit.rule','Exit strategy rule',row.childIndex,'select',{...base,activeWhen:[...exitWhen,{key:'marketFilter.exit.enabled',values:[true]}],rule:true});Object.assign(parent,{enabledBy:base.enabledBy,activeWhen:exitWhen});cachedRule(g,parent,child);
  for(const [key,label,gate,value]of [['target','Profit target (%)',layout.targetGateIndex,layout.targetValueIndex],['stop','Stop loss (%)',layout.stopGateIndex,layout.stopValueIndex]]){toggle(g,key+'.enabled','Use '+label.toLowerCase(),gate,{...base,activeWhen:exitWhen});number(g,key,label,value,0.000001,100,{...base,activeWhen:[...exitWhen,{key:'marketFilter.'+key+'.enabled',values:[true]}]});}
  if(layout.variant)for(const [prefix,sizeIndex,modeIndex,prices,activeWhen]of [['',layout.sizeIndex,layout.modeIndex,layout.priceIndices,[]],['exit.',layout.exitSizeIndex,layout.exitModeIndex,layout.exitPriceIndices,exitWhen]]){const renko=layout.chart==='Renko',modeKey='marketFilter.'+prefix+'brick.mode',mode=config[modeKey]??f[modeIndex].value,atr=renko&&['ATR','ATR %'].includes(mode);number(g,prefix+(renko?'brick.size':'box.size'),(prefix?'Exit ':'')+(atr?'ATR period':renko?'Brick size':'Box size'),sizeIndex,atr?1:0.000001,1000000,{...base,integer:atr,activeWhen});if(renko){const mode=dynamic(g,prefix+'brick.mode',(prefix?'Exit ':'')+'brick size mode',modeIndex,[sizeIndex]);Object.assign(mode,{enabledBy:base.enabledBy,activeWhen,chartContext:true});}else add(g,prefix+'box.reversal',(prefix?'Exit ':'')+'reversal size',modeIndex,'select',{...base,activeWhen});prices.forEach((index,n)=>toggle(g,prefix+'price.'+(n?'high-low':'close-only'),(prefix?'Exit ':'')+(n?'High & Low':'Close Only'),index,{...base,activeWhen:[...activeWhen,...(!prefix?[{key:'marketFilter.mode',values:['Index']}]:[])]}));}
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
 const original=L.stage('momentum',source.stages.momentum.fields);if(main.variant&&main.relativeStrength!==original.relativeStrength)for(const field of groups.flatMap(group=>group.fields).filter(field=>field.stage==='momentum'))for(const key of ['sizeIndex','modeIndex'])if(field.index===main[key])field.sourceIndex=original[key];
 return groups;
}
function defaults(input){return Object.fromEntries(fieldsForUI(input).flatMap(g=>g.fields.map(f=>[f.key,f.value])));}
function savedRunFields(run){
 V.validate(run);
 if(run.provenance!=='recorded-at-submit')throw Error('Choose a saved run with both submissions recorded.');
 if(run.parameters?.strategy?.auxiliarySettingsUncaptured)throw Error('This saved run has additional settings that were not captured.');
 const snapshots={momentum:run.parameters?.strategy?.main,execution:run.parameters?.strategy?.execution,portfolio:run.parameters?.settings},out={};
 for(const stage of stages){
  const fields=snapshots[stage]?.fields;
  if(!Array.isArray(fields)||!fields.length||fields.length>100||fields.some((f,index)=>!f||f.index!==index||!['text','date','checkbox','radio','select-one'].includes(f.type)||typeof f.label!=='string'||!f.label.trim()||f.label.length>2000||typeof f.value!=='string'||f.value.length>2000||typeof f.disabled!=='boolean'||(['checkbox','radio'].includes(f.type)?typeof f.checked!=='boolean':f.checked!==null)))throw Error('This saved run does not contain a complete '+stage+' settings layout.');
  out[stage]=fields;
 }
 L.validate('momentum',out.momentum);L.validate('execution',out.execution);
 if(out.momentum[2].checked){const captured=run.parameters?.strategy?.marketTrend?.fields;if(!Array.isArray(captured))throw Error('This saved run does not contain its market trend settings.');L.stage('marketFilter',captured);out.marketFilter=captured;}else if(run.parameters?.strategy?.marketTrend)throw Error('Saved market trend settings do not match their enabled state.');
 const presented=P.settings(run).filter(s=>stages.includes(s.key));
 if(presented.length!==3||presented.some(s=>s.groups.some(g=>g.name==='Captured settings')))throw Error('This saved settings layout is not supported for a new test yet.');
 return out;
}
function savedRunContext(run){
 const fields=savedRunFields(run),config={'momentum.chart':fields.momentum[0].value,'momentum.market':fields.momentum[3].value,'execution.chart':fields.execution[3].value};
 // The source reader accepts one parent change at a time. Callers skip entries
 // already matching the current source before loading any dependent choices.
 const changes=[{momentum:{0:config['momentum.chart']}},{momentum:{3:config['momentum.market']}},{execution:{3:config['execution.chart']}}];
 for(const stage of ['momentum','execution']){const layout=L.stage(stage,fields[stage]);if(layout.chart==='Renko'){config[stage+'.brick.mode']=fields[stage][layout.modeIndex].value;changes.push({[stage]:{[layout.modeIndex]:config[stage+'.brick.mode']}});}}
 const main=L.stage('momentum',fields.momentum),loadFilters=[];if(fields.momentum[main.rsIndex].checked)config['momentum.rs']=true;if(fields.momentum[2].checked)config['momentum.market-filter']=true;
 if(config['momentum.rs']){loadFilters.push('relativeStrength');config['momentum.rs.market']=fields.momentum[main.benchmarkMarketIndex].value;config['momentum.rs.source']=fields.momentum[main.rows.at(-1).parentIndex].value;}
 if(fields.marketFilter){loadFilters.push('marketFilter');const layout=L.marketFilter(fields.marketFilter);config['marketFilter.chart']=layout.chart;changes.push({marketFilter:{0:layout.chart}});if(layout.chart==='Renko')for(const [key,index]of [['marketFilter.brick.mode',layout.modeIndex],['marketFilter.exit.brick.mode',layout.exitModeIndex]])if(index!==null){config[key]=fields.marketFilter[index].value;changes.push({marketFilter:{[index]:config[key]}});}}
 return {config,changes,...(loadFilters.length?{loadFilters}:{})};
}
function configFromRun(run,input){
 const fields=savedRunFields(run),t=template(input),context=savedRunContext(run).config,current=defaults(t);
 if((run.demo===true)!==t.demo)throw Error('Real and fictional saved settings cannot be mixed.');
 for(const key of ['momentum.chart','execution.chart','momentum.brick.mode','execution.brick.mode','marketFilter.chart','marketFilter.brick.mode','marketFilter.exit.brick.mode'])if(owns(context,key)&&context[key]!==current[key])throw Error('Load the saved '+(key.startsWith('momentum.')?'Momentum':'Backtest')+' chart settings before using this run.');
 const config={...current},covered=Object.fromEntries(Object.keys(fields).map(stage=>[stage,new Set()])),editor=editorStages(t);
 const indexMap=(stage,index)=>{
  if(stage==='momentum'){const a=L.main(editor.momentum.fields[0].value,!!t.stages.momentum.relativeStrength),b=L.stage('momentum',fields.momentum);if(index<=a.rsIndex)return index;if(a.variant){for(const key of ['sizeIndex','modeIndex'])if(index===a[key])return b[key];for(const [n,value]of a.priceIndices.entries())if(index===value)return b.priceIndices[n];}return b.relativeStrength?index:null;}
  if(stage==='marketFilter'){if(!fields.marketFilter)return null;const a=L.marketFilter(t.stages.marketFilter.fields),b=L.marketFilter(fields.marketFilter);for(const key of ['chartIndex','sizeIndex','modeIndex','indexModeIndex','rsModeIndex','indexMarketIndex','indexSymbolIndex','numeratorMarketIndex','numeratorSymbolIndex','denominatorMarketIndex','denominatorSymbolIndex','actionIndex','targetGateIndex','targetValueIndex','stopGateIndex','stopValueIndex','exitSizeIndex','exitModeIndex'])if(a[key]===index)return b[key];for(const key of ['priceIndices','methodIndices','methodValueIndices','exitPriceIndices']){const n=a[key].indexOf(index);if(n!==-1)return b[key][n]??null;}for(const key of ['gateIndex','parentIndex','childIndex'])if(a.rows[0]?.[key]===index)return b.rows[0]?.[key]??null;throw Error('Unknown saved market trend setting.');}
  return index;
 };
 for(const descriptor of fieldsForUI(t).flatMap(g=>g.fields)){
  const captured=fields[descriptor.stage],indices=(descriptor.indices||[descriptor.index]).map(index=>indexMap(descriptor.stage,index));
  if(indices.some(index=>index===null||index===undefined))continue;
  for(const index of indices){if(!captured?.[index]||covered[descriptor.stage].has(index))throw Error('This saved settings layout cannot be copied safely.');covered[descriptor.stage].add(index);}
  if(descriptor.indices){const selected=indices.filter(index=>captured[index].checked);if(selected.length!==1)throw Error('Choose a saved run with exactly one '+descriptor.label.toLowerCase()+'.');config[descriptor.key]=descriptor.radioValues?descriptor.radioValues[indices.indexOf(selected[0])]:String(descriptor.indices[indices.indexOf(selected[0])]);}
  else{const field=captured[indices[0]];config[descriptor.key]=descriptor.type==='boolean'?field.checked:descriptor.type==='number'?(V.number(field.value)??field.value):field.value;}
 }
 if(Object.keys(fields).some(stage=>covered[stage].size!==fields[stage].length))throw Error('Some saved settings are not supported by the current form.');
 // Menus always remain current source evidence. Keep a removed or unsearched
 // saved choice visible in the draft; validateConfig must block its submission.
 return config;
}
function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
function validateConfig(config,input){
 if(!config||typeof config!=='object'||Array.isArray(config))throw Error('Check the backtest setup.');
 const descriptors=fieldsForUI(input,config).flatMap(g=>g.fields),keys=new Set(descriptors.map(f=>f.key)),out={};
 if(Object.keys(config).some(k=>!keys.has(k)))throw Error('Unknown setting in the backtest setup.');
 for(const f of descriptors){let v=config[f.key];if(v===undefined)throw Error('Choose '+f.label+'.');
  if(f.type==='boolean'){if(typeof v!=='boolean')throw Error(f.label+' must be on or off.');}
  else if(f.type==='number'){if(!['string','number'].includes(typeof v)||typeof v==='string'&&!/^\s*[+]?(?:\d+(?:\.\d*)?|\.\d+)\s*$/.test(v))throw Error(f.label+': enter a valid number.');v=Number(v);if(!Number.isFinite(v)||v<f.min||v>f.max||(f.integer&&!Number.isInteger(v)))throw Error(f.label+': enter '+(f.integer?'a whole number':'a number')+' between '+f.min+' and '+f.max+'.');}
  else if(f.type==='combobox'){
   if(f.symbol&&!activeField(f,config)){if(typeof v!=='string'||v.length>2000)throw Error('Check '+f.label+'.');out[f.key]=v;continue;}
   if(!f.options.length)throw Error('No '+f.label.toLowerCase()+' choices are available. Refresh choices in RZone.');
   if(typeof v!=='string'||!v.trim()||!f.options.some(o=>o.value===v&&!o.disabled))throw Error('Choose an available '+f.label.toLowerCase()+'.');
  }
  else if(f.type==='select'){
   const unchangedInactive=(f.disabled||!activeField(f,config))&&v===f.value;
   const emptyUnusedRule=f.rule&&(f.options.length===0&&f.value===''||f.nativeType==='text')&&v===''&&!activeField(f,config);
   if(f.rule&&f.options.length===0&&activeField(f,config))throw Error(f.searchable&&!f.searchQuery?'Search RZone for '+f.label.toLowerCase()+' before enabling it.':'No '+f.label.toLowerCase()+' choices are available. Turn the rule off or '+(f.searchable?'search again.':'refresh choices.'));
   if(typeof v!=='string'||!emptyUnusedRule&&!f.options.some(o=>o.value===v&&(!o.disabled||unchangedInactive)))throw Error('Choose an available '+f.label.toLowerCase()+'.');
   if(f.rule&&activeField(f,config)&&(!v.trim()||/^\s*--|select.*(?:system|rule|radar)/i.test(v)))throw Error('Choose a '+f.label.toLowerCase()+' before enabling it.');
  }
  else if(f.type==='date'){if(!validDate(v))throw Error(f.label+': choose a valid date.');}
  else {if(typeof v!=='string'||!v.trim()||v.trim().length>(f.maxLength||2000)||/[\u0000-\u001f]/.test(v))throw Error('Enter a valid '+f.label.toLowerCase()+'.');v=v.trim();}
  if(f.disabled&&!same(v,f.value))throw Error(f.label+' is not available for automatic setup.');
  if(f.dynamic&&!same(v,f.value)&&!f.cachedCategories?.includes(v))throw Error('Refresh choices for '+f.label+' before continuing.');out[f.key]=v;
 }
 validateCombination(out,input,descriptors);
 if(out['execution.from']>=out['execution.to'])throw Error('The end date must be after the start date.');
 for(const stage of ['momentum','execution'])if(owns(out,stage+'.price.close-only')&&Number(out[stage+'.price.close-only'])+Number(out[stage+'.price.high-low'])!==1)throw Error('Choose exactly one '+(stage==='momentum'?'Momentum':'Backtest')+' price mode: Close Only or High & Low.');
 if(![1,2,3,4].some(i=>out['momentum.period.'+i+'.enabled']&&out['momentum.period.'+i+'.weight']>0))throw Error('Enable at least one period with a positive weight.');
 return out;
}
function validateCombination(config,input,preparedFields){
 const fields=preparedFields||fieldsForUI(input,config).flatMap(group=>group.fields);
 for(const field of fields){if(field.needsDiscovery&&config[field.key]===true)throw Error('Load '+field.label+' settings before continuing.');if(!field.variation||!activeField(field,config))continue;
  const value=config[field.key];if(field.symbol&&!field.options.some(option=>option.value===value&&option.sourceValue&&symbolMarketMatches(config[field.marketKey],option.market)&&!option.disabled))throw Error('Search for and choose '+field.label.toLowerCase()+' in its selected market.');
  if(field.rule&&(!value||/^\s*--|select.*(?:system|rule)/i.test(value)||!field.options.some(option=>option.value===value&&!option.disabled)))throw Error('Choose an available '+field.label.toLowerCase()+'.');
 }
 for(const prefix of ['marketFilter.','marketFilter.exit.']){const a=fields.find(field=>field.key===prefix+'price.close-only');if(a&&activeField(a,config)&&Number(config[a.key])+Number(config[prefix+'price.high-low'])!==1)throw Error('Choose exactly one market trend price mode.');}
 return config;
}
function configToBaseline(config,input,{id='vault-setup',name='New strategy',demo}={}){
 const t=template(input),values=validateConfig(config,t);
 if(!idOK(id)||typeof name!=='string'||!name.trim()||name.length>120)throw Error('Give this setup a short name.');
 if(demo!==undefined&&demo!==t.demo)throw Error('Real and fictional setup cannot be mixed.');
 const editing=editorStages(t),p=parameters({stages:editing});if(editing.marketFilter)p.strategy.marketTrend={fields:clone(editing.marketFilter.fields)};
 const get=stage=>stage==='momentum'?p.strategy.main.fields:stage==='execution'?p.strategy.execution.fields:stage==='marketFilter'?p.strategy.marketTrend.fields:p.settings.fields;
 const descriptors=fieldsForUI(t,values).flatMap(g=>g.fields);
 for(const d of descriptors){const f=get(d.stage),v=values[d.key];if(d.indices){for(const [n,i]of d.indices.entries())f[i].checked=(d.radioValues?d.radioValues[n]:String(i))===v;}else if(d.type==='boolean')f[d.index].checked=v;else{f[d.index].value=String(v);if(d.nativeType)f[d.index].type=d.nativeType;}}
 for(const stage of ['momentum','execution',...(editing.marketFilter?['marketFilter']:[])]){
  const f=get(stage),base=clone(editing[stage].fields);if(stage==='momentum'&&t.stages.momentum.relativeStrength)base[L.main(base[0].value).rsIndex].checked=true;
  if(stage==='marketFilter'){const observed=L.marketFilter(t.stages.marketFilter.fields);base[observed.indexModeIndex].checked=true;base[observed.rsModeIndex].checked=false;base[observed.actionIndex].value=t.stages.marketFilter.fields[observed.actionIndex].value;}
  const labels=projectRuleLabels(base,editing[stage].ruleCatalogues,f,stage);f.forEach((field,index)=>{field.label=labels[index];});
 }
 // Source disablement is evidence of visibility, rather than a user setting.
 for(const d of descriptors)if(d.enabledBy&&d.index!==undefined&&!(d.stage==='marketFilter'&&(/\.market$/.test(d.key)||['marketFilter.target','marketFilter.stop'].includes(d.key))))get(d.stage)[d.index].disabled=!activeField(d,values);
 if(t.stages.momentum.relativeStrength&&!values['momentum.rs']){const full=get('momentum'),on=L.main(full[0].value,true),offSource=t.stages.momentum.fields.length===L.main(full[0].value).count?t.stages.momentum:t.stages.momentum.withoutRelativeStrength;if(!offSource)throw Error('Read the Relative Strength off settings before switching it off.');const off=L.stage('momentum',offSource.fields),projected=full.slice(0,on.rsIndex+1);if(on.variant)for(const [n,index]of [on.sizeIndex,on.modeIndex,...on.priceIndices].entries())projected.push({...full[index],label:offSource.fields[[off.sizeIndex,off.modeIndex,...off.priceIndices][n]].label});p.strategy.main.fields=projected.map((field,index)=>({...field,index}));}
 if(editing.marketFilter){if(values['momentum.market-filter']){const full=get('marketFilter'),observed=L.marketFilter(t.stages.marketFilter.fields);full[observed.indexModeIndex].checked=true;full[observed.rsModeIndex].checked=false;full[observed.actionIndex].value=t.stages.marketFilter.fields[observed.actionIndex].value;p.strategy.marketTrend.fields=L.projectMarketFilter(full,{mode:values['marketFilter.mode'],action:values['marketFilter.action']});}else delete p.strategy.marketTrend;}
 return {id,name:name.trim(),demo:t.demo,origin:'vault-setup',setupVersion:1,parameters:p,setup:{version:1,template:t,config:values}};
}
function validateBaseline(b){
 if(!b||b.origin!=='vault-setup'||b.setupVersion!==1||b.setup?.version!==1||!idOK(b.id)||typeof b.demo!=='boolean')throw Error('Invalid Vault setup baseline.');
 const rebuilt=configToBaseline(b.setup.config,b.setup.template,{id:b.id,name:b.name,demo:b.demo});
 if(!same(b.parameters,rebuilt.parameters)||!same(b.setup,rebuilt.setup)||Object.keys(b).some(k=>!['id','name','demo','origin','setupVersion','parameters','setup'].includes(k)))throw Error('Vault setup settings or source template were altered.');
 return b;
}
function settingLabel(fields,index){
 let label=V.clean(fields[index]?.label);let layout;
 try{layout=L.stage('momentum',fields);}catch{return label;}
 // RZone retains these mounted RS decorations after On → Off. Their text is
 // not a setting; compare the original controls and keep raw archive labels.
 if(!layout.relativeStrength&&index===layout.rsIndex)label=label.replace(/^(Relative Strength\s*:)\s*\/\s*(?:All|NSE|BSE|MF|EQW)$/,'$1');
 if(layout.variant&&[layout.sizeIndex,layout.modeIndex].includes(index))label=label.replace(/^RS SB : \/ (?:Pre|My|Public|Popular)i → /,'');
 return label;
}
function executionCapability(input){
 const t=template(input),charts=t.supports.executeCharts||['Candle'],available=[t.stages.momentum.fields[0].value,t.stages.execution.fields[3].value].every(chart=>charts.includes(chart));
 return {available,reason:available?'':'Refresh RZone and reconnect to use the updated P&F and Renko runner. Your settings are kept.'};
}
function demoTemplate({momentumChart='Candle',executionChart=momentumChart,momentumBrickMode,executionBrickMode}={}){
 const D=typeof module!=='undefined'?require('./demo.js'):root.VaultDemo;
 L.main(momentumChart);L.execution(executionChart);const samples=D.create(),r=samples.find(r=>r.parameters.strategy.main.fields[0].value===momentumChart&&r.parameters.strategy.main.fields.length===L.main(momentumChart).count),execution=samples.find(r=>r.parameters.strategy.execution.fields[3].value===executionChart),source={demo:true,adapterVersion:L.version,supports:{executeCharts:[...L.charts]},stages:{momentum:{fields:clone(r.parameters.strategy.main.fields)},execution:{fields:clone(execution.parameters.strategy.execution.fields)},portfolio:portfolioTemplate()}};
 // This helper builds fictional editor examples, not a copy of live source
 // state. Its initial price choice is deliberate; live flags are never fixed.
 for(const stage of ['momentum','execution']){const layout=stage==='momentum'?L.main(momentumChart):L.execution(executionChart),s=source.stages[stage],brickMode=stage==='momentum'?momentumBrickMode:executionBrickMode;s.options={[layout.chartIndex]:L.charts.map(value=>({value,label:value}))};if(layout.variant){s.fields[layout.priceIndices[0]].checked=true;s.fields[layout.priceIndices[1]].checked=false;s.options[layout.modeIndex]=(layout.chart==='Renko'?['Absolute','Percent','ATR','ATR %']:Array.from({length:14},(_,i)=>String(i+2))).map(value=>({value,label:value}));}if(brickMode!==undefined){const sizes={Absolute:'10',Percent:'1',ATR:'14','ATR %':'14'};if(layout.chart!=='Renko'||!owns(sizes,brickMode))throw Error('Choose an available Renko brick mode.');s.fields[layout.modeIndex].value=brickMode;s.fields[layout.sizeIndex].value=sizes[brickMode];}}
 // Fictional UI choices are kept in demo-only memory and never advertised as
 // options fetched from the user's authenticated RZone account.
 Object.assign(source.stages.momentum.options,{1:[r.parameters.strategy.main.fields[1].value,'Demo universe 20','Demo universe 60'],3:['NSE'].map(value=>({value,label:value})),33:['Daily','Weekly'].map(value=>({value,label:value}))});
 return template(source);
}
const api={descriptorForFields,activeField,validateCombination,template,portfolioTemplate,fieldsForUI,defaults,savedRunContext,configFromRun,validDate,validateConfig,configToBaseline,validateBaseline,projectRuleLabels,settingLabel,executionCapability,demoTemplate,mergeSymbolChoices};
if(typeof module!=='undefined')module.exports=api;root.VaultSetup=api;
})(typeof window!=='undefined'?window:globalThis);
