/* Research-only additions. Original run records and the execution engine are never edited. */
(function(root){
'use strict';
const E=typeof module!=='undefined'?require('./experiments.js'):root.VaultExperiments;
const clone=x=>JSON.parse(JSON.stringify(x));
const canonical=x=>JSON.stringify((function sort(v){return Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;})(x));
const safeId=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(x);
function text(value,max,name){if(typeof value!=='string'||!value.trim()||value.length>max)throw Error('Enter '+name+' (up to '+max+' characters).');return value.trim();}
function planOf(study){E.validate(study);return {name:study.name,baseline:clone(study.baseline),dimensions:study.dimensions.map(d=>({key:d.key,values:clone(d.values)})),mode:study.mode,budget:study.budget,seed:study.seed,objective:study.objective,ceiling:study.ceiling,minTrades:study.minTrades,timeoutMinutes:study.timeoutMinutes};}
function validateProtocol(p){
 if(!p||p.version!==1||!safeId(p.id)||!safeId(p.familyId)||!safeId(p.sourceStudyId)||!Number.isFinite(Date.parse(p.createdAt))||typeof p.demo!=='boolean')throw Error('Invalid research plan.');
 text(p.name,120,'a plan name');text(p.hypothesis,2000,'a research question');if(p.previousId!==null&&!safeId(p.previousId))throw Error('Invalid previous version.');
 if(p.plan?.baseline?.demo!==p.demo)throw Error('Sample and real research plans cannot be mixed.');
 const rebuilt=E.create({...p.plan,id:'protocol-validation'});E.validate(rebuilt);return p;
}
function protocol(study,{id,familyId=id,previousId=null,name,hypothesis,now=new Date().toISOString()}={}){
 return validateProtocol({version:1,id,familyId,previousId,name:text(name,120,'a plan name'),hypothesis:text(hypothesis,2000,'a research question'),createdAt:now,sourceStudyId:study.id,demo:study.demo===true,plan:planOf(study)});
}
function draft(p,{id,now=new Date().toISOString()}={}){validateProtocol(p);if(!safeId(id))throw Error('Invalid new study identifier.');return E.create({...clone(p.plan),id,name:(p.name+' · new study').slice(0,120),now});}
function metric(value,objective){if(typeof value!=='number'||!Number.isFinite(value))return '—';return (value>0&&objective!=='drawdown'?'+':'')+value.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})+(objective==='calmar'?'':'%');}
function map(study,runs,{groupKey=null,x=study.dimensions[0]?.key,y=study.dimensions[1]?.key||null,slice={},phase='discovery'}={}){
 E.validate(study);if(!['discovery','validation','holdout'].includes(phase))throw Error('Unknown research stage.');
 const decision=E.decisions(study,runs,phase),groups=decision.groups;
 const group=groupKey?groups.find(g=>g.key===groupKey):groups[0];
 if(groupKey&&!group)throw Error('Choose a matching comparison group.');
 if(!group)return {decision,groups,group:null,rows:[],x:null,y:null,remaining:[]};
 const xd=study.dimensions.find(d=>d.key===x),yd=y?study.dimensions.find(d=>d.key===y):null;
 if(!xd||(y&&!yd)||xd.key===yd?.key)throw Error('Choose different settings for the two axes.');
 const remaining=study.dimensions.filter(d=>d.key!==x&&d.key!==y),selected={};
 for(const d of remaining){selected[d.key]=Object.hasOwn(slice,d.key)?slice[d.key]:group.items[0]?.trial.patch[d.key]??d.values[0];if(!d.values.some(v=>JSON.stringify(v)===JSON.stringify(selected[d.key])))throw Error('Choose a valid setting slice.');}
 const matches=t=>remaining.every(d=>JSON.stringify(t.patch[d.key])===JSON.stringify(selected[d.key]));
 const items=group.items.filter(i=>matches(i.trial));const ys=yd?yd.values:[null];
 const rows=ys.map(yv=>({value:yv,cells:xd.values.map(xv=>{
  const hit=items.filter(i=>JSON.stringify(i.trial.patch[x])===JSON.stringify(xv)&&(!yd||JSON.stringify(i.trial.patch[y])===JSON.stringify(yv)));
  if(!hit.length)return {x:xv,y:yv,state:'missing',text:'—',items:[]};
  if(hit.length>1)return {x:xv,y:yv,state:'multiple',text:hit.length+' trials',items:hit};
  const i=hit[0];return {x:xv,y:yv,state:i.eligible?'eligible':'excluded',text:i.eligible?metric(i.value,study.objective):'Excluded',value:i.eligible?i.value:null,items:hit};
 })}));
 const numbers=rows.flatMap(r=>r.cells).filter(c=>c.state==='eligible').map(c=>c.value),min=Math.min(...numbers),max=Math.max(...numbers);
 for(const row of rows)for(const cell of row.cells)if(cell.state==='eligible')cell.strength=max===min?0.5:study.objective==='drawdown'?(max-cell.value)/(max-min):(cell.value-min)/(max-min);
 return {decision,groups,group,rows,x:xd,y:yd,remaining,slice:selected};
}
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function report(study,runs,{question,notes='',now=new Date().toISOString()}={}){
 E.validate(study);text(question,2000,'a research question');if(typeof notes!=='string'||notes.length>8000)throw Error('Research notes must be under 8,000 characters.');
 const metricName={returns:'Return',drawdown:'Drawdown',calmar:'Calmar'}[study.objective],phases=['discovery','validation','holdout'].filter(p=>study.trials.some(t=>t.phase===p));
 const rows=phases.map(phase=>{const d=E.decisions(study,runs,phase),byTrial=new Map(d.items.map(i=>[i.trial.id,i]));return '<h2>'+escape(phase[0].toUpperCase()+phase.slice(1))+'</h2><p>'+escape(d.headline)+'. '+escape(d.next)+'</p>'+d.groups.map((g,n)=>'<h3>Matched group '+(n+1)+'</h3><dl>'+Object.entries(g.controls).map(([k,v])=>'<dt>'+escape(k)+'</dt><dd>'+escape(v)+'</dd>').join('')+'</dl><p>'+escape(g.headline)+'</p>').join('')+'<table><thead><tr><th>Trial / evidence</th><th>Tested settings</th><th>'+escape(metricName)+'</th><th>Assessment</th></tr></thead><tbody>'+study.trials.filter(t=>t.phase===phase).map(t=>{const i=byTrial.get(t.id),group=d.groups.findIndex(g=>g.items.some(v=>v.trial.id===t.id));return '<tr><td>Trial '+t.ordinal+'<small>'+escape(t.runId)+'<br>'+escape(i?.run?.savedAt||t.status)+'</small></td><td>'+Object.entries(t.patch).map(([k,v])=>escape(study.dimensions.find(dim=>dim.key===k)?.label||k)+': '+escape(v)).join('<br>')+'</td><td>'+escape(i?metric(i.value,study.objective):'—')+'</td><td>'+escape(i?(i.eligible?'Eligible · group '+(group+1):'Excluded: '+i.reasons.join('; ')):t.error||t.status)+'</td></tr>';}).join('')+'</tbody></table>';}).join('');
 const settings=['momentum','execution','portfolio','marketFilter'].map(stage=>{let fields;try{fields=E.fields(study.baseline,stage);}catch{return '';}return !fields?.length?'':'<h3>'+escape(stage)+'</h3><dl>'+fields.map(f=>'<dt>'+escape(f.label||'Setting '+f.index)+'</dt><dd>'+escape(f.type==='checkbox'?f.checked?'On':'Off':f.value)+'</dd>').join('')+'</dl>';}).join('');
 return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><title>'+escape(study.name)+' · Research report</title><style>body{font:15px/1.55 system-ui;color:#152d39;max-width:1100px;margin:40px auto;padding:24px}h1{font-size:32px}h2{border-top:2px solid #c6d9df;padding-top:22px}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}td,th{padding:12px;border:1px solid #bdccd3;text-align:left;vertical-align:top;overflow-wrap:anywhere}small{display:block;color:#486371}dl{display:grid;grid-template-columns:1fr 2fr;gap:6px 20px}dd{margin:0;overflow-wrap:anywhere}.note{white-space:pre-wrap}header{border-bottom:4px solid #168b75}.sample{background:#fff1ba;padding:10px}@media print{body{margin:0;padding:0;font-size:10pt}thead{display:table-header-group}tr{break-inside:avoid}h2,h3{break-after:avoid}}</style><header><p>BACKTEST VAULT · RESEARCH REPORT</p><h1>'+escape(study.name)+'</h1><p>Generated '+escape(now)+' · Study '+escape(study.id)+'</p></header>'+(study.demo?'<p class="sample">Fictional sample data. Not actual investment performance.</p>':'')+'<h2>Research question</h2><p class="note">'+escape(question)+'</p><p>Objective: '+escape(metricName)+' · Drawdown ceiling: '+escape(study.ceiling)+'% · Minimum trades: '+escape(study.minTrades)+'.</p>'+rows+'<h2>Research notes</h2><p class="note">'+escape(notes||'No researcher notes recorded.')+'</p><h2>Baseline settings</h2>'+settings+'<h2>Reading this evidence</h2><p>Settings were selected on historical data. A discovery leader is not a forecast or a trading recommendation. Compare only within matched groups. Values across different universes, timeframes, dates or portfolio assumptions are never averaged into a combined return. Missing or excluded evidence is retained above. A colourful cell or a large return does not establish statistical robustness. Read the saved source reports and test a frozen candidate on later data.</p><p>Only evidence present in the local archive is included. This document is a snapshot; export the study JSON alongside it to retain machine-readable reports and the trial journal. Use your browser’s Print command to save this report as PDF.</p></html>';
}
function store({demo=false,chromeStore=root.chrome?.storage?.local,local=root.localStorage}={}){
 const prefix='research:protocol:v1:';let memory={};
 async function all(){const data=demo?memory:chromeStore?await chromeStore.get(null):Object.fromEntries(Object.keys(local).filter(k=>k.startsWith(prefix)).map(k=>[k,JSON.parse(local.getItem(k))]));return Object.entries(data).filter(([k])=>k.startsWith(prefix)).map(([,p])=>clone(validateProtocol(p))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
 async function put(p){validateProtocol(p);if(p.demo!==demo)throw Error('Real and sample research plans cannot be mixed.');const key=prefix+p.id;const old=(await all()).find(x=>x.id===p.id);if(old){if(canonical(old)!==canonical(p))throw Error('Saved versions cannot be overwritten. Save a new version.');return;}
  // A fresh ID per revision prevents two tabs overwriting an earlier revision.
  if(demo)memory[key]=clone(p);else if(chromeStore)await chromeStore.set({[key]:clone(p)});else local.setItem(key,JSON.stringify(p));
 }
 async function importBackup(data){if(data?.format!=='backtest-vault-research'||data.version!==1||!Array.isArray(data.protocols)||data.protocols.length>1000)throw Error('Invalid research backup.');const values=data.protocols.map(p=>clone(validateProtocol(p)));if(values.some(p=>p.demo!==demo))throw Error('Real and sample research plans cannot be mixed.');const prior=await all(),ids=new Map(prior.map(p=>[p.id,canonical(p)]));for(const p of values){if(ids.has(p.id)&&ids.get(p.id)!==canonical(p))throw Error('A saved version conflicts with this backup.');ids.set(p.id,canonical(p));}for(const p of values)await put(p);return values.length;}
 async function backup(){return {format:'backtest-vault-research',version:1,exportedAt:new Date().toISOString(),protocols:await all()};}
 return {all,put,importBackup,backup};
}
const api={protocol,validateProtocol,draft,map,report,metric,store};if(typeof module!=='undefined')module.exports=api;root.VaultResearch=api;
})(typeof window!=='undefined'?window:globalThis);
