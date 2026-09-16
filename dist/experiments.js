/* Finite local research plans and an immutable-at-start trial journal. */
(function(root){
'use strict';
const V=typeof module!=='undefined'?require('./core.js'):root.Vault;
const P=typeof module!=='undefined'?require('./presentation.js'):root.VaultPresentation;
const I=typeof module!=='undefined'?require('./intelligence.js'):root.VaultIntelligence;
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
function catalog(b){
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
 if(field.type==='boolean')return [...new Set(String(text).split(',').map(v=>{v=v.trim().toLowerCase();if(!['on','off','true','false'].includes(v))throw Error(field.label+': use On, Off.');return v==='on'||v==='true';}))];
 const s=String(text).trim();let raw;
 if(s.includes(':')){const a=s.split(':').map(Number);if(a.length!==3||a.some(x=>!Number.isFinite(x))||a[2]<=0||a[1]<a[0])throw Error('Use start:end:step, with a positive step.');const n=Math.floor((a[1]-a[0])/a[2]+1e-8)+1;if(n>100)throw Error('Use at most 100 values per setting.');raw=Array.from({length:n},(_,i)=>Number((a[0]+i*a[2]).toFixed(8)));}
 else raw=s.split(',').map(v=>v.trim()===''?NaN:Number(v.trim()));
 if(!raw.length||raw.length>100||raw.some(v=>!Number.isFinite(v)||v<field.min||v>field.max||(field.integer&&!Number.isInteger(v))))throw Error(field.label+': enter valid '+(field.integer?'whole ':'')+'numbers between '+field.min+' and '+field.max+'.');
 return [...new Set(raw)];
}
function dimensions(b,input){
 const available=catalog(b),seen=new Set();
 if(!Array.isArray(input)||!input.length||input.length>6)throw Error('Choose between one and six settings.');
 return input.map(d=>{const f=available.find(f=>f.key===d.key);if(!f||seen.has(d.key))throw Error('Unknown or repeated experiment setting.');seen.add(d.key);const v=values(Array.isArray(d.values)?d.values.join(','):d.values,f);if(v.length<1)throw Error('Each setting needs values.');return {...f,values:v};});
}
function combos(dims){let out=[{}];for(const d of dims){if(out.length*d.values.length>10000)throw Error('This plan exceeds 10,000 combinations. Narrow the ranges.');out=out.flatMap(c=>d.values.map(v=>({...c,[d.key]:v})));}return out;}
function shuffled(list,seed){let s=Number(seed)>>>0;const next=()=>{s=(s+0x6D2B79F5)>>>0;let x=Math.imul(s^(s>>>15),1|s);x^=x+Math.imul(x^(x>>>7),61|x);return ((x^(x>>>14))>>>0)/4294967296;};const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(next()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function create({id,name,baseline:b,dimensions:input,mode='grid',budget=30,seed=42,objective='calmar',ceiling=25,minTrades=30,timeoutMinutes=20,now=new Date().toISOString()}){
 if(!idOK(id)||typeof name!=='string'||!name.trim()||name.length>120)throw Error('Give this experiment a short name.');
 if(!['grid','sample','adaptive'].includes(mode)||!['calmar','returns','drawdown'].includes(objective))throw Error('Unknown experiment mode or objective.');
 if(!Number.isInteger(Number(seed))||seed<0||seed>4294967295)throw Error('Seed must be an integer from 0 to 4,294,967,295.');
 if(!Number.isInteger(Number(budget))||budget<1||budget>500)throw Error('Run budget must be 1–500.');
 if(!Number.isFinite(+ceiling)||ceiling<0||ceiling>100||!Number.isInteger(+minTrades)||minTrades<0||minTrades>1000000)throw Error('Check the drawdown ceiling and minimum trades.');
 if(!Number.isFinite(+timeoutMinutes)||timeoutMinutes<1||timeoutMinutes>120)throw Error('Trial timeout must be 1–120 minutes.');
 const dims=dimensions(b,input),all=combos(dims),main=fields(b,'momentum');
 for(const patch of all){const weight=Array.from({length:4},(_,i)=>main[11+i*2].checked?(patch['momentum.period.'+(i+1)+'.weight']??V.number(main[22+i].value)):0);if(!weight.some(x=>x>0))throw Error('Each combination needs a positive weight on an enabled period.');}
 if(mode==='grid'&&all.length>budget)throw Error(all.length+' combinations exceed the '+budget+' run budget. Increase the budget or use a sample.');
 const candidates=mode==='grid'?all:shuffled(all,seed).slice(0,+budget);
 const make=(patch,i)=>({id:id+'-t'+(i+1),runId:id+'-t'+(i+1),ordinal:i+1,patch,status:'queued',phase:'discovery',events:[]});
 return {schemaVersion:1,id,name:name.trim(),createdAt:now,status:'draft',revision:0,baseline:clone(b),dimensions:dims,mode,budget:+budget,seed:+seed,objective,ceiling:+ceiling,minTrades:+minTrades,timeoutMinutes:+timeoutMinutes,combinationCount:all.length,trials:candidates.map(make),events:[{at:now,action:'planned'}],demo:b.demo===true};
}
function expected(e,t){const b=clone(e.baseline);for(const d of e.dimensions){const f=fields(b,d.stage)[d.index];if(!Object.hasOwn(t.patch,d.key))throw Error('Trial is missing a setting.');if(d.type==='boolean')f.checked=t.patch[d.key];else f.value=String(t.patch[d.key]);}if(t.period){fields(b,'execution')[1].value=t.period.from;fields(b,'execution')[2].value=t.period.to;}return b;}
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
function validate(e){
 if(!e||e.schemaVersion!==1||!idOK(e.id)||!Array.isArray(e.trials)||e.trials.length>1000||!['draft','running','pausing','paused','complete','needs-review'].includes(e.status))throw Error('Invalid experiment archive.');
 const fresh=create({...e,dimensions:e.dimensions,now:e.createdAt});
 if(!same(fresh.dimensions,e.dimensions)||fresh.combinationCount!==e.combinationCount||fresh.demo!==e.demo)throw Error('Experiment settings were altered.');
 const discovery=e.trials.filter(t=>t.phase==='discovery');
 if(discovery.length!==fresh.trials.length||discovery.some((t,i)=>t.id!==fresh.trials[i].id||t.ordinal!==fresh.trials[i].ordinal||!same(t.patch,fresh.trials[i].patch)))throw Error('The planned discovery queue was altered.');
 if(discovery.some(t=>t.period!==undefined||t.parentTrialId!==undefined))throw Error('Discovery dates must remain fixed to the baseline.');
 if(e.trials.some((t,i)=>t.ordinal!==i+1||t.id!==e.id+'-t'+(i+1))||e.trials.slice(0,discovery.length).some(t=>t.phase!=='discovery')||e.trials.slice(discovery.length).some((t,i)=>t.phase!==(i?'holdout':'validation')))throw Error('The planned trial stage order was altered.');
 if(e.trials.filter(t=>t.phase==='validation').length>1||e.trials.filter(t=>t.phase==='holdout').length>1)throw Error('Validation stages must remain frozen.');
 const ids=new Set(),validStates=['queued',...active,'saved','uncertain','skipped'];
 if(!Array.isArray(e.events)||e.events.length>10000)throw Error('Invalid experiment history.');
 for(const t of e.trials){if(!idOK(t.id)||!idOK(t.runId)||t.id!==t.runId||!t.id.startsWith(e.id+'-t')||ids.has(t.id)||!validStates.includes(t.status)||!['discovery','validation','holdout'].includes(t.phase)||!Array.isArray(t.events))throw Error('Invalid trial journal.');ids.add(t.id);if(Object.keys(t.patch||{}).length!==e.dimensions.length||e.dimensions.some(d=>!d.values.includes(t.patch[d.key])))throw Error('Trial is outside the approved ranges.');if(t.phase!=='discovery'){if(!t.period||I.date(t.period.from)!==t.period.from||I.date(t.period.to)!==t.period.to||t.period.from>=t.period.to)throw Error('Invalid validation dates.');const parent=e.trials.find(x=>x.id===t.parentTrialId&&x.phase===(t.phase==='validation'?'discovery':'validation'));if(!parent||!same(t.patch,parent.patch)||t.period.from<=(parent.period?.to||fields(e.baseline,'execution')[2].value))throw Error('Validation must preserve its candidate and use a later period.');}expected(e,t);}
 if(e.trials.filter(t=>active.includes(t.status)).length>1)throw Error('Only one trial can run at a time.');
 return e;
}
function journal(e,action,now=new Date().toISOString()){e.revision++;e.updatedAt=now;e.events.push({at:now,action});}
function transition(e,t,status,now=new Date().toISOString()){
 const next={queued:'applying',applying:'strategy-submitting','strategy-submitting':'strategy-complete','strategy-complete':'portfolio-submitting','portfolio-submitting':'capturing',capturing:'saved'};
 if(next[t.status]!==status)throw Error('Unexpected trial transition: '+t.status+' → '+status);
 t.status=status;t.events.push({at:now,status});journal(e,'Trial '+t.ordinal+': '+status,now);return e;
}
function result(e,t,run){
 const issues=[];let item;
 if(!run)return {trial:t,eligible:false,reasons:['Saved result is missing.']};
 try{V.validate(run);if(run.id!==t.runId||run.experiment?.id!==e.id||run.experiment?.trialId!==t.id||run.experiment?.phase!==t.phase)throw Error('Result does not belong to this experiment trial.');for(const s of stages)verify(fields(expected(e,t),s),fields(run,s));if((run.demo===true)!==e.demo)throw Error('Real and fictional results cannot be mixed.');if(!e.demo)verifyEvidence(e,t,run);item=I.inspect(run);issues.push(...item.errors);if(item.metrics.drawdown>e.ceiling)issues.push('Drawdown exceeds '+e.ceiling+'%.');if(item.metrics.trades===null||item.metrics.trades<e.minTrades)issues.push('Below '+e.minTrades+' reported trades.');if(!Number.isFinite(e.objective==='calmar'?item.calmar:item.metrics[e.objective]))issues.push('Selected ranking measure is unavailable.');}
 catch(error){issues.push(error.message);}
 const value=item?(e.objective==='calmar'?item.calmar:item.metrics[e.objective]):null;
 return {trial:t,run,item,value,eligible:issues.length===0,reasons:issues};
}
function decisions(e,runs,phase='discovery'){
 const map=new Map(runs.map(r=>[r.id,r])),items=e.trials.filter(t=>t.phase===phase&&t.status==='saved').map(t=>result(e,t,map.get(t.runId)));
 const results=items.filter(x=>x.eligible).sort((a,b)=>(e.objective==='drawdown'?a.value-b.value:b.value-a.value)||a.trial.ordinal-b.trial.ordinal);
 // Identical report evidence is not another independent result; keep it in the journal.
 const evidence=new Set();for(const x of results){const sig=signature([x.run.quickStats,x.run.statistics,x.run.trades]);if(evidence.has(sig)){x.eligible=false;x.reasons.push('Repeated report evidence.');}else evidence.add(sig);}
 const eligible=results.filter(x=>x.eligible),leaders=eligible.length?eligible.filter(x=>Math.abs(x.value-eligible[0].value)<1e-9):[],leader=leaders.length===1?leaders[0]:null;
 const neighbors=leader?items.filter(x=>x!==leader&&e.dimensions.filter(d=>x.trial.patch[d.key]!==leader.trial.patch[d.key]).length===1&&e.dimensions.every(d=>Math.abs(d.values.indexOf(x.trial.patch[d.key])-d.values.indexOf(leader.trial.patch[d.key]))<=1)):[];
 const pending=e.trials.filter(t=>t.phase===phase&&!['saved','skipped'].includes(t.status)).length;
 return {items,eligible,leaders,leader,neighbors,pending,headline:!items.length?'Ready to collect evidence':!eligible.length?'No trial meets your rules':leaders.length>1?'Tied leaders':(pending?'Leading so far':'Discovery leader')+' · Trial '+leader.trial.ordinal,next:pending?'Finish the planned trials before selecting a candidate.':!leader?'Review exclusions and ties before choosing a candidate.':neighbors.length<2?'Test nearby settings before moving to a fresh period.':'Freeze a candidate, then test a later validation period.',complete:pending===0};
}
function nextTrial(e,runs){
 const queued=e.trials.filter(t=>t.status==='queued');if(e.mode!=='adaptive'||!queued.length||queued[0].phase!=='discovery')return queued[0];
 const d=decisions(e,runs);if(!d.leader||e.trials.filter(t=>t.status==='saved'&&t.phase==='discovery').length%3===0)return queued[0];
 // Deterministic bounded neighborhood search; every third step explores the seeded pool.
 const distance=t=>e.dimensions.reduce((sum,x)=>sum+Math.abs(x.values.indexOf(t.patch[x.key])-x.values.indexOf(d.leader.trial.patch[x.key])),0);
 return [...queued].sort((a,b)=>distance(a)-distance(b)||a.ordinal-b.ordinal)[0];
}
function validation(e,trialId,period,phase='validation',now=new Date().toISOString()){
 if(!['validation','holdout'].includes(phase)||!['complete','paused'].includes(e.status)||e.trials.some(t=>!['saved','skipped'].includes(t.status)))throw Error('Finish the current stage first.');
 if(I.date(period.from)!==period.from||I.date(period.to)!==period.to||period.from>=period.to)throw Error('Use a valid, positive validation period.');
 const t=e.trials.find(t=>t.id===trialId&&t.status==='saved'&&t.phase===(phase==='validation'?'discovery':'validation'));
 if(!t)throw Error('Select a saved candidate from the preceding stage.');
 const end=e.trials.filter(x=>x.phase!=='holdout').map(x=>x.period?.to||fields(e.baseline,'execution')[2].value).sort().at(-1);
 if(period.from<=end)throw Error('Use dates strictly after the preceding research periods.');
 if(e.trials.some(x=>x.phase===phase))throw Error('This stage is already frozen. Create another experiment to change the research plan.');
 const n=e.trials.length+1;e.trials.push({id:e.id+'-t'+n,runId:e.id+'-t'+n,ordinal:n,patch:clone(t.patch),status:'queued',phase,period:clone(period),parentTrialId:t.id,events:[]});e.status='paused';journal(e,'Frozen '+phase+' candidate: trial '+t.ordinal,now);return e;
}
function restored(e){validate(e);const x=clone(e);x.status='paused';delete x.owner;for(const t of x.trials)if(active.includes(t.status)){t.status='uncertain';t.error='Interrupted before backup. Review this trial before continuing.';}journal(x,'Imported paused; source tab must be selected again.');return x;}
const api={baseline,catalog,fields,stageSnapshot,values,dimensions,combos,create,expected,verify,verifyEvidence,validate,journal,transition,result,decisions,nextTrial,validation,restored,active,clone};
if(typeof module!=='undefined')module.exports=api;root.VaultExperiments=api;
})(typeof window!=='undefined'?window:globalThis);
