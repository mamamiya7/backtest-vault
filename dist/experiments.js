/* Finite local research plans and an immutable-at-start trial journal. */
(function(root){
'use strict';
const V=typeof module!=='undefined'?require('./core.js'):root.Vault;
const P=typeof module!=='undefined'?require('./presentation.js'):root.VaultPresentation;
const I=typeof module!=='undefined'?require('./intelligence.js'):root.VaultIntelligence;
const S=typeof module!=='undefined'?require('./setup.js'):root.VaultSetup;
const clone=x=>JSON.parse(JSON.stringify(x)), stages=['momentum','execution','portfolio'];
// Storage may reorder object properties. Array order and every value still matter.
const ordered=x=>Array.isArray(x)?x.map(ordered):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,ordered(x[k])])):x;
const signature=x=>JSON.stringify(ordered(x)),same=(a,b)=>signature(a)===signature(b);
const fields=(b,s)=>s==='portfolio'?b.parameters?.settings?.fields:b.parameters?.strategy?.[s==='momentum'?'main':'execution']?.fields;
const stageSnapshot=(b,s)=>({fields:fields(b,s)});
const idOK=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(x);
const active=['applying','strategy-submitting','strategy-complete','portfolio-submitting','capturing'];
function baseline(run){
 V.validate(run);
 if(run.provenance!=='recorded-at-submit')throw Error('Choose a run with both submissions recorded.');
 const b={id:run.id,name:run.name||run.id,demo:run.demo===true,parameters:clone(run.parameters)};
 catalog(b);return b;
}
function catalogFromSetup(template,config={}){
 if(!S)throw Error('Reload Vault to load the test setup editor.');
 const strategy=/^momentum\.(?:period\.[1-4](?:\.enabled|\.weight)?|ema\.[1-3](?:\.enabled)?|tma|retracement(?:\.enabled|\.mode|\.reference)?|volume(?:\.reference)?|radar\.(?:enabled|rule)|trend-quality(?:\.enabled)?|strategy\.[1-3]\.(?:enabled|rule|timeframe|input)|signal-mode)$/;
 const exits=/^execution\.(?:target(?:\.enabled)?|stop(?:\.enabled)?|exit\.(?:enabled|rule))$/;
 const context=/^(?:execution\.(?:rank|from|to)|portfolio\.(?:allocation|capital|max-open|daily-limit(?:\.enabled)?))$/;
 const chartValues=/^(?:momentum|execution)\.(?:box\.(?:size|reversal)|brick\.size|price\.(?:close-only|high-low))$/;
 return S.fieldsForUI(template,config).flatMap(g=>g.fields).filter(f=>!f.disabled&&(strategy.test(f.key)||exits.test(f.key)||context.test(f.key)||chartValues.test(f.key))).map(f=>{
  // Keep existing descriptor labels stable so older approved archives still validate.
  const prefix=exits.test(f.key)?'Exit · ':f.stage==='execution'?'Backtest · ':f.stage==='portfolio'?'Portfolio · ':'';
  const d={key:f.key,label:prefix+f.label,stage:f.stage,type:f.type==='select'?'enum':f.type,value:Object.hasOwn(config,f.key)?config[f.key]:f.value};
  if(f.index!==undefined)d.index=f.index;if(f.indices)d.indices=clone(f.indices);
  if(f.type==='number'){d.min=f.min;d.max=f.max;d.integer=f.integer===true;}
  if(f.type==='select')d.options=f.options.filter(o=>!o.disabled).map(o=>({value:o.value,label:o.label}));
  return d;
 });
}
function catalog(b){
 if(b?.origin==='vault-setup'){S.validateBaseline(b);return catalogFromSetup(b.setup.template,b.setup.config);}
 const settings=P.settings(b).filter(s=>stages.includes(s.key));
 if(settings.length!==3||settings.some(s=>s.groups.some(g=>g.name==='Captured settings')||!fields(b,s.key)?.length))throw Error('This setting layout is not supported for experiments yet.');
 const rows=settings.flatMap(s=>s.groups.flatMap(g=>g.rows.map(r=>({...r,stage:s.key}))));
 if(rows.find(r=>r.stage==='momentum'&&r.key==='market-filter')?.checked)throw Error('Market Trend Filter has uncaptured dialog settings. Turn it off and save a new baseline first.');
 if(rows.find(r=>r.stage==='portfolio'&&r.key==='enabled')?.checked!==true)throw Error('The baseline must have portfolio testing enabled.');
 const out=[];
 for(const r of rows){
  const f=fields(b,r.stage), key=r.stage+'.'+r.key;
  // Scope-changing controls remain locked. Dynamic RS/rule changes need separate write adapters.
  const numeric=r.stage==='momentum'?/^(period\.\d|ema\.\d|retracement|volume|trend-quality|box\.size|box\.reversal|brick\.size)$/.test(r.key):r.stage==='execution'?/^(target|stop|box\.size|box\.reversal|brick\.size)$/.test(r.key):false;
  if(numeric&&r.checked!==false){
   const index=r.sourceIndices.find(i=>!['checkbox','radio'].includes(f[i].type));
   const integer=r.kind==='count'||r.key==='box.reversal';
   out.push({key,label:(r.stage==='execution'?'Exit · ':'')+r.label,stage:r.stage,index,type:'number',integer,min:['volume','retracement','trend-quality'].includes(r.key)?0:integer?1:0.000001,max:r.kind==='percent'?100:1000000,value:V.number(f[index].value)});
  }
  if(r.stage==='momentum'&&r.key.startsWith('period.')&&r.checked)out.push({key:key+'.weight',label:r.label+' weight',stage:r.stage,index:r.sourceIndices[2],type:'number',min:0,max:1000,value:V.number(f[r.sourceIndices[2]].value)});
  if(r.stage==='momentum'&&r.key==='tma')out.push({key,label:r.label,stage:r.stage,index:r.sourceIndices[0],type:'boolean',value:r.checked});
 }
 return out;
}
function values(text,field){
 if(field.type==='date'){
  if(!Array.isArray(text)||!text.length||text.length>100||text.some(value=>!S.validDate(value)))throw Error(field.label+': choose 1–100 valid dates in YYYY-MM-DD format.');
  return [...new Set(text)];
 }
 if(field.type==='enum'){
  if(!Array.isArray(text)||!text.length||text.length>100||text.some(v=>typeof v!=='string'||!field.options.some(o=>o.value===v)))throw Error(field.label+': choose 1–100 available source values.');
  return [...new Set(text)];
 }
 if(field.type==='boolean'){
  const raw=Array.isArray(text)?text:String(text).split(',');
  if(!raw.length||raw.length>100)throw Error(field.label+': choose On, Off.');
  return [...new Set(raw.map(v=>{if(typeof v==='boolean')return v;if(typeof v!=='string')throw Error(field.label+': use On, Off.');v=v.trim().toLowerCase();if(!['on','off','true','false'].includes(v))throw Error(field.label+': use On, Off.');return v==='on'||v==='true';}))];
 }
 const s=Array.isArray(text)?null:String(text).trim();let raw;
 if(s?.includes(':')){const a=s.split(':').map(Number);if(a.length!==3||a.some(x=>!Number.isFinite(x))||a[2]<=0||a[1]<a[0])throw Error('Use start:end:step, with a positive step.');const n=Math.floor((a[1]-a[0])/a[2]+1e-8)+1;if(n>100)throw Error('Use at most 100 values per setting.');raw=Array.from({length:n},(_,i)=>Number((a[0]+i*a[2]).toFixed(8)));}
 else raw=(Array.isArray(text)?text:s.split(',')).map(v=>typeof v==='number'?v:typeof v==='string'&&v.trim()!==''?Number(v.trim()):NaN);
 if(!raw.length||raw.length>100||raw.some(v=>!Number.isFinite(v)||v<field.min||v>field.max||(field.integer&&!Number.isInteger(v))))throw Error(field.label+': enter valid '+(field.integer?'whole ':'')+'numbers between '+field.min+' and '+field.max+'.');
 return [...new Set(raw)];
}
function dimensions(b,input){
 const available=catalog(b),seen=new Set();
 if(b.origin==='vault-setup'&&Array.isArray(input)&&input.length===0)return [];
 if(!Array.isArray(input)||!input.length||input.length>6)throw Error('Choose between one and six settings.');
 return input.map(d=>{const f=available.find(f=>f.key===d?.key);if(!f||seen.has(d.key))throw Error('Unknown or repeated experiment setting.');seen.add(d.key);const v=values(d.values,f);if(v.length<1)throw Error('Each setting needs values.');return {...f,values:v};});
}
function combos(dims){let out=[{}];for(const d of dims){if(out.length*d.values.length>10000)throw Error('This plan exceeds 10,000 combinations. Narrow the ranges.');out=out.flatMap(c=>d.values.map(v=>({...c,[d.key]:v})));}return out;}
function shuffled(list,seed){let s=Number(seed)>>>0;const next=()=>{s=(s+0x6D2B79F5)>>>0;let x=Math.imul(s^(s>>>15),1|s);x^=x+Math.imul(x^(x>>>7),61|x);return ((x^(x>>>14))>>>0)/4294967296;};const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(next()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function combinationRules(b){return S.fieldsForUI(b.setup.template,b.setup.config).flatMap(g=>g.fields).filter(f=>f.rule).map(f=>({key:f.key,label:f.label,gate:f.enabledBy,available:new Set(f.options.filter(o=>!o.disabled).map(o=>o.value))}));}
function checkSetupCombination(config,rules){
 // The unchanged baseline already passed S.validateBaseline. Dimension values
 // passed the exact source enum, boolean, date and numeric domains in dimensions().
 // Only these cross-field constraints can change inside the approved catalog;
 // evaluate every combination without repeatedly copying huge source menus.
 if(![1,2,3,4].some(i=>config['momentum.period.'+i+'.enabled']&&config['momentum.period.'+i+'.weight']>0))throw Error('Each combination needs a positive weight on an enabled period.');
 if(!['execution.target.enabled','execution.stop.enabled','execution.exit.enabled'].some(key=>config[key]))throw Error('Each combination needs an enabled target, stop loss or exit strategy.');
 if(config['execution.from']>=config['execution.to'])throw Error('Every date combination must have From before To. Remove overlapping start/end choices.');
 for(const stage of ['momentum','execution'])if(Object.hasOwn(config,stage+'.price.close-only')&&Number(config[stage+'.price.close-only'])+Number(config[stage+'.price.high-low'])!==1)throw Error('Every combination must choose exactly one '+stage+' price mode.');
 for(const f of rules)if(config[f.gate]){const value=config[f.key];if(!f.available.has(value)||!value.trim()||/^\s*--|select.*(?:system|rule|radar)/i.test(value))throw Error('Each combination needs an available '+f.label.toLowerCase()+' before enabling it.');}
}
function setupExpected(b,patch,period){
 const config={...b.setup.config,...patch};
 if(period){config['execution.from']=period.from;config['execution.to']=period.to;}
 const next=S.configToBaseline(config,b.setup.template,{id:b.id,name:b.name,demo:b.demo});
 checkSetupCombination(next.setup.config,combinationRules(b));
 return next;
}
function create({id,name,baseline:b,dimensions:input,mode='grid',budget=30,seed=42,objective='calmar',ceiling=25,minTrades=30,timeoutMinutes=20,now=new Date().toISOString()}){
 if(b?.origin==='vault-setup'){if(!S)throw Error('Reload Vault to load the test setup editor.');S.validateBaseline(b);}
 else if(b?.origin!==undefined)throw Error('Unknown experiment setup origin.');
 if(!idOK(id)||typeof name!=='string'||!name.trim()||name.length>120)throw Error('Give this experiment a short name.');
 if(!['grid','sample','adaptive'].includes(mode)||!['calmar','returns','drawdown'].includes(objective))throw Error('Unknown experiment mode or objective.');
 if(!Number.isInteger(Number(seed))||seed<0||seed>4294967295)throw Error('Seed must be an integer from 0 to 4,294,967,295.');
 if(!Number.isInteger(Number(budget))||budget<1||budget>500)throw Error('Run budget must be 1–500.');
 if(!Number.isFinite(+ceiling)||ceiling<0||ceiling>100||!Number.isInteger(+minTrades)||minTrades<0||minTrades>1000000)throw Error('Check the drawdown ceiling and minimum trades.');
 if(!Number.isFinite(+timeoutMinutes)||timeoutMinutes<1||timeoutMinutes>120)throw Error('Trial timeout must be 1–120 minutes.');
 const dims=dimensions(b,input),all=combos(dims),main=fields(b,'momentum');
 if(mode==='grid'&&all.length>budget)throw Error(all.length+' combinations exceed the '+budget+' run budget. Increase the budget or use a sample.');
 const rules=b.origin==='vault-setup'?combinationRules(b):null;
 for(const patch of all){if(rules){checkSetupCombination({...b.setup.config,...patch},rules);continue;}const weight=Array.from({length:4},(_,i)=>main[11+i*2].checked?(patch['momentum.period.'+(i+1)+'.weight']??V.number(main[22+i].value)):0);if(!weight.some(x=>x>0))throw Error('Each combination needs a positive weight on an enabled period.');}
 const candidates=mode==='grid'?all:shuffled(all,seed).slice(0,+budget);
 const make=(patch,i)=>({id:id+'-t'+(i+1),runId:id+'-t'+(i+1),ordinal:i+1,patch,status:'queued',phase:'discovery',events:[]});
 return {schemaVersion:1,id,name:name.trim(),createdAt:now,status:'draft',revision:0,baseline:clone(b),dimensions:dims,mode,budget:+budget,seed:+seed,objective,ceiling:+ceiling,minTrades:+minTrades,timeoutMinutes:+timeoutMinutes,combinationCount:all.length,trials:candidates.map(make),events:[{at:now,action:'planned'}],demo:b.demo===true};
}
function expected(e,t){
 if(e.baseline.origin==='vault-setup'){
  if(!t.patch||Object.keys(t.patch).length!==e.dimensions.length||e.dimensions.some(d=>!Object.hasOwn(t.patch,d.key)||!d.values.includes(t.patch[d.key])))throw Error('Trial is outside the approved ranges.');
  return setupExpected(e.baseline,t.patch,t.period);
 }
 const b=clone(e.baseline);for(const d of e.dimensions){const f=fields(b,d.stage)[d.index];if(!Object.hasOwn(t.patch,d.key))throw Error('Trial is missing a setting.');if(d.type==='boolean')f.checked=t.patch[d.key];else f.value=String(t.patch[d.key]);}if(t.period){fields(b,'execution')[1].value=t.period.from;fields(b,'execution')[2].value=t.period.to;}return b;
}
function fieldEqual(a,b){if(a.type!==b.type)return false;if(['checkbox','radio'].includes(a.type))return a.checked===b.checked;const x=String(a.value).trim(),y=String(b.value).trim();if(a.type==='text'&&/^-?[\d,.]+$/.test(x)&&/^-?[\d,.]+$/.test(y))return V.number(x)===V.number(y);return x===y;}
function verify(expectedFields,actualFields){
 if(!Array.isArray(actualFields)||expectedFields.length!==actualFields.length)throw Error('Settings layout changed. Review the source tab.');
 for(let i=0;i<expectedFields.length;i++){const a=expectedFields[i],b=actualFields[i];if(a.type!==b.type||V.clean(a.label)!==V.clean(b.label))throw Error('Setting label/layout changed at field '+(i+1)+'.');if(!fieldEqual(a,b))throw Error('Setting read-back differs: '+a.label+' (field '+(i+1)+').');}
 return true;
}
function verifyEvidence(e,t,run){
 const proof=run.experiment?.evidence,s=run.parameters?.strategy,p=run.parameters,execution=t.execution;
 if(!proof||proof.version!==1||!execution||typeof execution.sourceSession!=='string'||!execution.sourceSession||execution.sourceSession.length>80||proof.sourceSession!==execution.sourceSession)throw Error('Fresh source execution evidence is missing or belongs to another source session.');
 if(!idOK(s?.id)||!idOK(p?.id)||proof.strategySubmissionId!==s.id||proof.portfolioSubmissionId!==p.id||s.started!==true||s.completed!==true)throw Error('Source submissions do not match this result.');
 const pairs=[['strategySubmittedAt',s.at],['strategyStartedAt',s.startedAt],['strategyCompletedAt',s.completedAt],['portfolioSubmittedAt',p.at],['reportOpenedAt',p.reportOpenedAt],['capturedAt',run.savedAt]];
 if(pairs.some(([key,value])=>!value||proof[key]!==value))throw Error('Source execution timestamps do not match this result.');
 const times=[execution.claimedAt,...pairs.map(([key])=>proof[key])];
 if(times.some(x=>typeof x!=='string'||!Number.isFinite(Date.parse(x))||new Date(x).toISOString()!==x)||times.some((x,i)=>i&&Date.parse(x)<Date.parse(times[i-1])))throw Error('Source execution order could not be verified.');
 return true;
}
function trialPeriod(e,t){return t.period||{from:t.patch?.['execution.from']??fields(e.baseline,'execution')[1].value,to:t.patch?.['execution.to']??fields(e.baseline,'execution')[2].value};}
function researchEnd(e,phase='validation'){
 const allowed=phase==='holdout'?['discovery','validation']:['discovery'];
 // Include interrupted attempts whose outcomes may already have been seen, but
 // not untouched, skipped alternatives or unsampled Cartesian combinations.
 return e.trials.filter(t=>allowed.includes(t.phase)&&(t.status==='saved'||t.execution||t.events?.some(event=>active.includes(event.status)||event.status==='saved'||event.status==='uncertain'))).map(t=>trialPeriod(e,t).to).sort().at(-1)||null;
}
function validate(e){
 if(!e||e.schemaVersion!==1||!idOK(e.id)||!Array.isArray(e.trials)||e.trials.length>1000||!['draft','running','pausing','paused','complete','needs-review'].includes(e.status))throw Error('Invalid experiment archive.');
 const fresh=create({...e,dimensions:e.dimensions,now:e.createdAt});
 if(!same(fresh.dimensions,e.dimensions)||fresh.combinationCount!==e.combinationCount||fresh.demo!==e.demo)throw Error('Experiment settings were altered.');
 const discovery=e.trials.filter(t=>t.phase==='discovery');
 if(discovery.length!==fresh.trials.length||discovery.some((t,i)=>t.id!==fresh.trials[i].id||t.ordinal!==fresh.trials[i].ordinal||!same(t.patch,fresh.trials[i].patch)))throw Error('The planned discovery queue was altered.');
 if(discovery.some(t=>t.period!==undefined||t.parentTrialId!==undefined))throw Error('Discovery dates must remain in the approved settings, not a separate period override.');
 if(e.trials.some((t,i)=>t.ordinal!==i+1||t.id!==e.id+'-t'+(i+1))||e.trials.slice(0,discovery.length).some(t=>t.phase!=='discovery')||e.trials.slice(discovery.length).some((t,i)=>t.phase!==(i?'holdout':'validation')))throw Error('The planned trial stage order was altered.');
 if(e.trials.filter(t=>t.phase==='validation').length>1||e.trials.filter(t=>t.phase==='holdout').length>1)throw Error('Validation stages must remain frozen.');
 for(const phase of ['validation','holdout'])if(e.trials.some(t=>t.phase===phase)&&e.trials.some(t=>(t.phase==='discovery'||phase==='holdout'&&t.phase==='validation')&&!['saved','skipped'].includes(t.status)))throw Error('Finish all preceding trials before a frozen '+phase+' stage.');
 const ids=new Set(),validStates=['queued',...active,'saved','uncertain','skipped'];
 if(!Array.isArray(e.events)||e.events.length>10000)throw Error('Invalid experiment history.');
 for(const t of e.trials){if(!idOK(t.id)||!idOK(t.runId)||t.id!==t.runId||!t.id.startsWith(e.id+'-t')||ids.has(t.id)||!validStates.includes(t.status)||!['discovery','validation','holdout'].includes(t.phase)||!Array.isArray(t.events))throw Error('Invalid trial journal.');ids.add(t.id);if(Object.keys(t.patch||{}).length!==e.dimensions.length||e.dimensions.some(d=>!d.values.includes(t.patch[d.key])))throw Error('Trial is outside the approved ranges.');if(t.phase!=='discovery'){if(!t.period||I.date(t.period.from)!==t.period.from||I.date(t.period.to)!==t.period.to||t.period.from>=t.period.to)throw Error('Invalid validation dates.');const parent=e.trials.find(x=>x.id===t.parentTrialId&&x.phase===(t.phase==='validation'?'discovery':'validation')),end=researchEnd(e,t.phase);if(!parent||parent.status!=='saved'||!same(t.patch,parent.patch)||t.period.from<=trialPeriod(e,parent).to||end&&t.period.from<=end)throw Error('Validation must preserve its candidate and use a later period, strictly after all preceding tested dates.');}
  // fresh=create(...) already validated the setup, every approved combination,
  // and source option domains. Discovery patches above match that exact queue;
  // later stages preserve an approved patch and validate their dates here.
  // Rebuild a setup only when that actual trial is needed, not once per queued
  // trial on every heartbeat/checkpoint. Legacy field-based checks stay intact.
  if(e.baseline.origin!=='vault-setup')expected(e,t);
 }
 if(e.trials.filter(t=>active.includes(t.status)).length>1)throw Error('Only one trial can run at a time.');
 return e;
}
function journal(e,action,now=new Date().toISOString()){e.revision++;e.updatedAt=now;e.events.push({at:now,action});}
function transition(e,t,status,now=new Date().toISOString()){
 const next={queued:'applying',applying:'strategy-submitting','strategy-submitting':'strategy-complete','strategy-complete':'portfolio-submitting','portfolio-submitting':'capturing',capturing:'saved'};
 if(next[t.status]!==status)throw Error('Unexpected trial transition: '+t.status+' → '+status);
 t.status=status;t.events.push({at:now,status});journal(e,'Trial '+t.ordinal+': '+status,now);return e;
}
function result(e,t,run){return inspectResult(e,t,run,()=>expected(e,t));}
function inspectResult(e,t,run,readExpected){
 const issues=[];let item;
 if(!run)return {trial:t,eligible:false,reasons:['Saved result is missing.']};
 try{V.validate(run);if(run.id!==t.runId||run.experiment?.id!==e.id||run.experiment?.trialId!==t.id||run.experiment?.phase!==t.phase)throw Error('Result does not belong to this experiment trial.');const planned=readExpected();for(const s of stages)verify(fields(planned,s),fields(run,s));if((run.demo===true)!==e.demo)throw Error('Real and fictional results cannot be mixed.');if(!e.demo)verifyEvidence(e,t,run);item=I.inspect(run);issues.push(...item.errors);if(item.metrics.drawdown>e.ceiling)issues.push('Drawdown exceeds '+e.ceiling+'%.');if(item.metrics.trades===null||item.metrics.trades<e.minTrades)issues.push('Below '+e.minTrades+' reported trades.');if(!Number.isFinite(e.objective==='calmar'?item.calmar:item.metrics[e.objective]))issues.push('Selected ranking measure is unavailable.');}
 catch(error){issues.push(error.message);}
 const value=item?(e.objective==='calmar'?item.calmar:item.metrics[e.objective]):null;
 return {trial:t,run,item,value,eligible:issues.length===0,reasons:issues};
}
function validatedSetupFields(e,t){
 // Only used synchronously after validate(e). Ranking needs the source fields,
 // not a new copy of thousands of unchanged dropdown choices for every row.
 // verify() compares values/checkboxes and labels; UI disabled flags are not
 // evidence. Actual execution still calls expected() and the full setup model.
 const b={parameters:clone(e.baseline.parameters)};
 for(const d of e.dimensions){const f=fields(b,d.stage),value=t.patch[d.key];if(d.indices){for(const i of d.indices)f[i].checked=String(i)===value;}else if(d.type==='boolean')f[d.index].checked=value;else f[d.index].value=String(value);}
 if(t.period){fields(b,'execution')[1].value=t.period.from;fields(b,'execution')[2].value=t.period.to;}
 return b;
}
function summarizeDecision(e,items,pending){
 const eligible=items.filter(x=>x.eligible).sort((a,b)=>(e.objective==='drawdown'?a.value-b.value:b.value-a.value)||a.trial.ordinal-b.trial.ordinal),leaders=eligible.length?eligible.filter(x=>Math.abs(x.value-eligible[0].value)<1e-9):[],leader=leaders.length===1?leaders[0]:null;
 const neighbors=leader?items.filter(x=>x!==leader&&e.dimensions.filter(d=>x.trial.patch[d.key]!==leader.trial.patch[d.key]).length===1&&e.dimensions.every(d=>d.type==='enum'?x.trial.patch[d.key]===leader.trial.patch[d.key]:Math.abs(d.values.indexOf(x.trial.patch[d.key])-d.values.indexOf(leader.trial.patch[d.key]))<=1)):[];
 return {items,eligible,leaders,leader,neighbors,pending,headline:!items.length?'Ready to collect evidence':!eligible.length?'No trial meets your rules':leaders.length>1?'Tied leaders':(pending?'Leading so far':'Discovery leader')+' · Trial '+leader.trial.ordinal,next:pending?'Finish the planned trials before selecting a candidate.':!leader?'Review exclusions and ties before choosing a candidate.':neighbors.length<2?'Test nearby settings before moving to a fresh period.':'Freeze a candidate, then test a later validation period.',complete:pending===0};
}
function decisions(e,runs,phase='discovery'){
 const setup=e.baseline.origin==='vault-setup';if(setup)validate(e);
 const map=new Map(runs.map(r=>[r.id,r])),items=e.trials.filter(t=>t.phase===phase&&t.status==='saved').map(t=>setup?inspectResult(e,t,map.get(t.runId),()=>validatedSetupFields(e,t)):result(e,t,map.get(t.runId)));
 // Identical report evidence is not another independent result; keep it in the journal.
 const evidence=new Set();for(const x of items.filter(x=>x.eligible).sort((a,b)=>(e.objective==='drawdown'?a.value-b.value:b.value-a.value)||a.trial.ordinal-b.trial.ordinal)){const sig=signature([x.run.quickStats,x.run.statistics,x.run.trades]);if(evidence.has(sig)){x.eligible=false;x.reasons.push('Repeated report evidence.');}else evidence.add(sig);}
 const pending=e.trials.filter(t=>t.phase===phase&&!['saved','skipped'].includes(t.status)).length,scopes=new Map();
 for(const item of items){if(!item.item)continue;const controls=item.item.controls,key=signature(Object.fromEntries(Object.entries(controls).map(([name,value])=>[name,typeof value==='string'?V.clean(value).toLowerCase():value])));item.groupKey=key;if(!scopes.has(key))scopes.set(key,{key,controls,items:[]});scopes.get(key).items.push(item);}
 const scopeDimension=/^(?:execution\.(?:from|to)|portfolio\.(?:allocation|capital|max-open|daily-limit(?:\.enabled)?))$/;
 // A partly finished mixed-scope plan must not name a universal leader just
 // because its first returned trials happen to share one set of controls.
 const grouped=scopes.size>1||phase==='discovery'&&e.dimensions.some(d=>scopeDimension.test(d.key)&&d.values.length>1);
 const groups=[...scopes.values()].map(group=>({...group,...summarizeDecision(e,group.items,pending)}));
 if(!grouped)return {...summarizeDecision(e,items,pending),groups,grouped:false};
 for(const group of groups)if(group.items.length===1){group.leader=null;group.leaders=[];group.neighbors=[];if(group.eligible.length)group.headline='One trial · no matched peer';group.next=pending?'Finish the planned trials before selecting a candidate.':'Test another strategy with these same dates and portfolio settings.';}
 return {items,eligible:groups.flatMap(g=>g.eligible),leaders:[],leader:null,neighbors:[],pending,complete:pending===0,groups,grouped:true,headline:!items.length?'Ready to collect evidence':'Compare matched test conditions',next:pending?'Finish the planned trials; results are compared within matching dates and portfolio settings.':'Choose a matched group to review its candidates. Different test conditions have separate comparisons.'};
}
function nextTrial(e,runs){
 const queued=e.trials.filter(t=>t.status==='queued');if(e.mode!=='adaptive'||!queued.length||queued[0].phase!=='discovery')return queued[0];
 const d=decisions(e,runs);if(!d.leader||e.trials.filter(t=>t.status==='saved'&&t.phase==='discovery').length%3===0)return queued[0];
 // Deterministic bounded neighborhood search; every third step explores the seeded pool.
 const distance=t=>e.dimensions.reduce((sum,x)=>sum+(x.type==='enum'?Number(t.patch[x.key]!==d.leader.trial.patch[x.key]):Math.abs(x.values.indexOf(t.patch[x.key])-x.values.indexOf(d.leader.trial.patch[x.key]))),0);
 return [...queued].sort((a,b)=>distance(a)-distance(b)||a.ordinal-b.ordinal)[0];
}
function validation(e,trialId,period,phase='validation',now=new Date().toISOString()){
 if(!['validation','holdout'].includes(phase)||!['complete','paused'].includes(e.status)||e.trials.some(t=>!['saved','skipped'].includes(t.status)))throw Error('Finish the current stage first.');
 if(I.date(period.from)!==period.from||I.date(period.to)!==period.to||period.from>=period.to)throw Error('Use a valid, positive validation period.');
 const t=e.trials.find(t=>t.id===trialId&&t.status==='saved'&&t.phase===(phase==='validation'?'discovery':'validation'));
 if(!t)throw Error('Select a saved candidate from the preceding stage.');
 const end=researchEnd(e,phase);
 if(period.from<=end)throw Error('Use dates strictly after the preceding research periods.');
 if(e.trials.some(x=>x.phase===phase))throw Error('This stage is already frozen. Create another experiment to change the research plan.');
 const n=e.trials.length+1;e.trials.push({id:e.id+'-t'+n,runId:e.id+'-t'+n,ordinal:n,patch:clone(t.patch),status:'queued',phase,period:clone(period),parentTrialId:t.id,events:[]});e.status='paused';journal(e,'Frozen '+phase+' candidate: trial '+t.ordinal,now);return e;
}
function restored(e){validate(e);const x=clone(e);x.status='paused';delete x.owner;for(const t of x.trials)if(active.includes(t.status)){t.status='uncertain';t.error='Interrupted before backup. Review this trial before continuing.';}journal(x,'Imported paused; source tab must be selected again.');return x;}
const api={baseline,catalog,catalogFromSetup,fields,stageSnapshot,values,dimensions,combos,create,expected,trialPeriod,researchEnd,verify,verifyEvidence,validate,journal,transition,result,decisions,nextTrial,validation,restored,active,clone};
if(typeof module!=='undefined')module.exports=api;root.VaultExperiments=api;
})(typeof window!=='undefined'?window:globalThis);
