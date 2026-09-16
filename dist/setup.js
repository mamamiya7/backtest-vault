/* A settings-only starting point. Source controls supply labels and choices;
 * no backtest, source submission or result is manufactured by this module. */
(function(root){
'use strict';
const V=typeof module!=='undefined'?require('./core.js'):root.Vault;
const P=typeof module!=='undefined'?require('./presentation.js'):root.VaultPresentation;
const clone=x=>JSON.parse(JSON.stringify(x)),stages=['momentum','execution','portfolio'];
const ruleIndices={momentum:[36,40,44,48],execution:[7],portfolio:[]};
const ordered=x=>Array.isArray(x)?x.map(ordered):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,ordered(x[k])])):x;
const same=(a,b)=>JSON.stringify(ordered(a))===JSON.stringify(ordered(b));
const owns=(o,key)=>!!o&&Object.prototype.hasOwnProperty.call(o,key);
const idOK=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(x);
const blocked='This dynamic rule is not available in automatic setup yet.';
const strategyCatalogues={40:{parentIndex:39,gateIndex:42},44:{parentIndex:43,gateIndex:46},48:{parentIndex:47,gateIndex:50}};
const ruleCategories=['Pre','My','Public','Popular'];
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
 if(stage!=='momentum'||!record(input)||Object.keys(input).some(key=>!owns(strategyCatalogues,key)))throw Error('Invalid strategy rule catalogues.');
 const out={};
 for(const [key,entry] of Object.entries(input)){
  const shape=strategyCatalogues[key],child=fields[Number(key)];
  if(!record(entry)||Object.keys(entry).some(k=>!['parentIndex','gateIndex','categories'].includes(k))||entry.parentIndex!==shape.parentIndex||entry.gateIndex!==shape.gateIndex||fields[shape.parentIndex]?.type!=='select-one'||child?.type!=='select-one'||fields[shape.gateIndex]?.type!=='checkbox'||!record(entry.categories)||!Object.keys(entry.categories).length||Object.keys(entry.categories).length>4)throw Error('Invalid strategy rule catalogue association.');
  const categories={};
  for(const [category,choices] of Object.entries(entry.categories)){
   if(!ruleCategories.includes(category)||!options[shape.parentIndex]?.some(o=>o.value===category&&!o.disabled))throw Error('Cached strategy category is not available from its source.');
   categories[category]=catalogueChoices(choices,child.label+' / '+category);
  }
  const selected=fields[shape.parentIndex].value;
  if(owns(categories,selected)&&!same(categories[selected],options[key]))throw Error('Cached strategy rules do not match the selected source category.');
  out[key]={parentIndex:shape.parentIndex,gateIndex:shape.gateIndex,categories};
 }
 return out;
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
 if(source.session!==undefined){if(typeof source.session!=='string'||!source.session||source.session.length>120)throw Error('Invalid setup source session.');t.session=source.session;}
 if(source.capturedAt!==undefined){if(typeof source.capturedAt!=='string'||!Number.isFinite(Date.parse(source.capturedAt)))throw Error('Invalid setup capture time.');t.capturedAt=source.capturedAt;}
 for(const stage of stages){
  const s=input[stage]||(stage==='portfolio'?portfolioTemplate():null);
  if(!s||!Array.isArray(s.fields)||!s.fields.length||s.fields.length>100)throw Error('RZone '+stage+' controls were not available.');
  const fields=s.fields.map((f,index)=>{
   if(!f||f.index!==index||!['text','date','checkbox','radio','select-one'].includes(f.type)||typeof f.label!=='string'||!f.label.trim()||f.label.length>2000||typeof f.value!=='string'||f.value.length>2000||typeof f.disabled!=='boolean'||(!['checkbox','radio'].includes(f.type)?f.checked!==null:typeof f.checked!=='boolean'))throw Error('RZone '+stage+' settings layout is invalid.');
   return {index,type:f.type,label:f.label,value:f.value,checked:f.checked,disabled:f.disabled};
  });
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
   const emptyRule=ruleIndices[stage].includes(f.index)&&options[f.index]?.length===0&&f.value==='';
   if(f.type==='select-one'&&!emptyRule&&!options[f.index].some(o=>o.value===f.value))throw Error('Selected source value is absent from its choices: '+f.label);
  }
  t.stages[stage]={fields,options};
  if(owns(s,'ruleCatalogues'))t.stages[stage].ruleCatalogues=ruleCatalogues(s.ruleCatalogues,stage,fields,options);
  if(s.template===true){t.stages[stage].template=true;t.stages[stage].origin=s.origin==='verified-layout'?'verified-layout':'template';}
 }
 const m=t.stages.momentum.fields,x=t.stages.execution.fields;
 if(m[0]?.value!=='Candle'||m.length!==52||x[3]?.value!=='Candle'||x[4]?.value!=='Price'||x.length!==12)throw Error('Automatic setup currently supports Candle with Price selection and Relative Strength off. P&F, Renko and dynamic RS layouts need their own verified adapters.');
 const layout=P.settings({parameters:parameters(t)});
 if(layout.length!==3||layout.some(s=>s.groups.some(g=>g.name==='Captured settings')))throw Error('RZone controls changed. Reload the available setup before continuing.');
 t.supports={charts:['Candle'],selection:['Price'],blocked:['market-filter','relative-strength']};
 return t;
}
function fieldsForUI(input,config={}){
 const t=template(input),groups=[],m=t.stages.momentum.fields,x=t.stages.execution.fields,p=t.stages.portfolio.fields;
 const group=(stage,key,title)=>{const g={stage,key:stage+'.'+key,title,fields:[]};groups.push(g);return g;};
 const add=(g,key,label,index,type,extra={})=>{
  const f=t.stages[g.stage].fields[index],d={key:g.stage+'.'+key,label,stage:g.stage,index,type,value:type==='boolean'?f.checked:type==='number'?V.number(f.value):f.value,...extra};
  if(type==='select'||type==='combobox')d.options=clone(t.stages[g.stage].options[index]||[{value:f.value,label:f.value,disabled:false}]);
  g.fields.push(d);return d;
 };
 const number=(g,key,label,index,min,max,extra={})=>add(g,key,label,index,'number',{min,max,...extra});
 const toggle=(g,key,label,index,extra={})=>add(g,key,label,index,'boolean',extra);
 const fixed=(g,key,label,index,reason)=>{const d=add(g,key,label,index,t.stages[g.stage].fields[index].type==='checkbox'?'boolean':'select',{disabled:true,reason});if(d.options)d.options.forEach(o=>{if(o.value!==d.value){o.disabled=true;o.reason=reason;}});return d;};
 let g=group('momentum','universe','Strategy');
 fixed(g,'chart','Chart type',0,'Candle automation is available. P&F and Renko automatic setup is not yet available.');
 const hasGroupCatalogue=owns(t.stages.momentum.options,1);
 add(g,'group','Universe / group',1,hasGroupCatalogue?'combobox':'text',{maxLength:200,help:hasGroupCatalogue?'':'Enter the exact group name. RZone must resolve it before a backtest can start.'});
 add(g,'market','Market',3,'select',hasGroupCatalogue?{dynamic:true,refresh:true,refreshOnChange:true,dependents:[1],help:'Refreshes the available groups from RZone when changed.'}:{});add(g,'timeframe','Timeframe',33,'select');
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
 toggle(g,'trend-quality.enabled','Use Trend Quality',37);number(g,'trend-quality','Trend Quality (%)',38,0,100,{enabledBy:'momentum.trend-quality.enabled'});
 g=group('momentum','rules','Additional rules');
 for(const [key,label,index] of [['market-filter','Market trend filter',2],['rs','Relative Strength',51]])fixed(g,key,label,index,blocked).value=false;
 const dynamic=(g,key,label,index,dependents)=>add(g,key,label,index,'select',{dynamic:true,refresh:true,refreshOnChange:true,dependents,help:'Refreshes the available rules from RZone when changed.'});
 toggle(g,'radar.enabled','Use Radar',34);dynamic(g,'radar.source','Radar source',35,[36]);add(g,'radar.rule','Radar rule',36,'select',{enabledBy:'momentum.radar.enabled',rule:true});
 for(let i=1;i<=3;i++){
  const at=35+i*4,key='strategy.'+i;toggle(g,key+'.enabled','Use Strategy '+i,at+3);
  const parent=dynamic(g,key+'.source','Strategy '+i+' source',at,[at+1]),child=add(g,key+'.rule','Strategy '+i+' rule',at+1,'select',{enabledBy:'momentum.'+key+'.enabled',rule:true}),catalogue=t.stages.momentum.ruleCatalogues?.[at+1];
  if(catalogue){
   const category=owns(config,parent.key)?config[parent.key]:parent.value;
   parent.cachedCategories=parent.options.filter(o=>owns(catalogue.categories,o.value)).map(o=>o.value);
   parent.help='Choose a category to see its loaded rules. Refresh choices after changing rules in RZone.';
   child.sourceKey=parent.key;child.categoryKey=category;
   if(owns(catalogue.categories,category))child.options=clone(catalogue.categories[category]);
   else if(category!==parent.value)child.options=[];
   if(category!==parent.value)child.value='';
  }
  add(g,key+'.timeframe','Strategy '+i+' timeframe',at+2,'select',{enabledBy:'momentum.'+key+'.enabled'});
 }
 g=group('execution','test','Backtest');
 add(g,'rank','Rank criteria',0,'select');add(g,'from','From date',1,'date');add(g,'to','To date',2,'date');fixed(g,'chart','Chart type',3,'The execution chart stays Candle.');fixed(g,'selection','Selection type',4,'Automatic testing currently supports Price. RS and Both are not yet available.');
 g=group('execution','exits','Exits');
 toggle(g,'target.enabled','Use profit target',8);number(g,'target','Profit target (%)',9,0.000001,100,{enabledBy:'execution.target.enabled'});toggle(g,'stop.enabled','Use stop loss',10);number(g,'stop','Stop loss (%)',11,0.000001,100,{enabledBy:'execution.stop.enabled'});
 toggle(g,'exit.enabled','Use exit strategy',5);dynamic(g,'exit.source','Exit strategy source',6,[7]);add(g,'exit.rule','Exit strategy rule',7,'select',{enabledBy:'execution.exit.enabled',rule:true});
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
   const emptyUnusedRule=f.rule&&f.options.length===0&&f.value===''&&v===''&&config[f.enabledBy]===false;
   if(f.rule&&f.options.length===0&&config[f.enabledBy]===true)throw Error('No '+f.label.toLowerCase()+' choices are available. Turn the rule off or refresh choices.');
   if(typeof v!=='string'||!emptyUnusedRule&&!f.options.some(o=>o.value===v&&(!o.disabled||unchangedInactive)))throw Error('Choose an available '+f.label.toLowerCase()+'.');
   if(f.rule&&config[f.enabledBy]===true&&(!v.trim()||/^\s*--|select.*(?:system|rule|radar)/i.test(v)))throw Error('Choose a '+f.label.toLowerCase()+' before enabling it.');
  }
  else if(f.type==='date'){if(!validDate(v))throw Error(f.label+': choose a valid date.');}
  else {if(typeof v!=='string'||!v.trim()||v.trim().length>(f.maxLength||2000)||/[\u0000-\u001f]/.test(v))throw Error('Enter a valid '+f.label.toLowerCase()+'.');v=v.trim();}
  if(f.disabled&&!same(v,f.value))throw Error(f.label+' is not available for automatic setup.');
  if(f.dynamic&&!same(v,f.value)&&!f.cachedCategories?.includes(v))throw Error('Refresh choices for '+f.label+' before continuing.');out[f.key]=v;
 }
 if(out['execution.from']>=out['execution.to'])throw Error('The end date must be after the start date.');
 if(![1,2,3,4].some(i=>out['momentum.period.'+i+'.enabled']&&out['momentum.period.'+i+'.weight']>0))throw Error('Enable at least one period with a positive weight.');
 return out;
}
function configToBaseline(config,input,{id='vault-setup',name='New strategy',demo}={}){
 const t=template(input),values=validateConfig(config,t);
 if(!idOK(id)||typeof name!=='string'||!name.trim()||name.length>120)throw Error('Give this setup a short name.');
 if(demo!==undefined&&demo!==t.demo)throw Error('Real and fictional setup cannot be mixed.');
 const p=parameters(t),get=stage=>stage==='momentum'?p.strategy.main.fields:stage==='execution'?p.strategy.execution.fields:p.settings.fields;
 for(const d of fieldsForUI(t,values).flatMap(g=>g.fields)){const f=get(d.stage),v=values[d.key];if(d.indices){for(const i of d.indices)f[i].checked=String(i)===v;}else if(d.type==='boolean')f[d.index].checked=v;else f[d.index].value=String(v);}
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
function demoTemplate(){
 const D=typeof module!=='undefined'?require('./demo.js'):root.VaultDemo;
 const r=D.create()[0],source={demo:true,stages:{momentum:{fields:r.parameters.strategy.main.fields},execution:{fields:r.parameters.strategy.execution.fields},portfolio:portfolioTemplate()}};
 // Fictional UI choices are kept in demo-only memory and never advertised as
 // options fetched from the user's authenticated RZone account.
 source.stages.momentum.options={1:[r.parameters.strategy.main.fields[1].value,'Demo universe 20','Demo universe 60'],3:['NSE'].map(value=>({value,label:value})),33:['Daily','Weekly'].map(value=>({value,label:value}))};
 return template(source);
}
const api={template,portfolioTemplate,fieldsForUI,defaults,validateConfig,configToBaseline,validateBaseline,demoTemplate};
if(typeof module!=='undefined')module.exports=api;root.VaultSetup=api;
})(typeof window!=='undefined'?window:globalThis);
