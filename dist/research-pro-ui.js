(function(root){
'use strict';
const R=root.VaultResearch,Editions=root.VaultEditions;
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,fn,cls='secondary')=>{const n=node('button',text,cls);n.type='button';n.onclick=fn;return n;};
const field=(text,control)=>{const l=node('label',text);l.append(control);return l;};
const select=items=>{const s=node('select');for(const [value,text]of items){const o=node('option',text);o.value=value;s.append(o);}return s;};
function modal(title){
 const prior=document.activeElement,d=node('dialog',undefined,'research-dialog'),head=node('div',undefined,'research-heading'),h=node('h2',title),close=button('Close',()=>d.close(),'quiet');
 h.id='research-dialog-title-'+root.crypto.randomUUID();d.setAttribute('aria-labelledby',h.id);head.append(h,close);const body=node('div');d.append(head,body);document.body.append(d);
 d.addEventListener('close',()=>{d.remove();if(prior?.isConnected)prior.focus();},{once:true});d.showModal();return {d,body};
}
function download(name,content,type='application/json'){const url=URL.createObjectURL(new Blob([content],{type})),a=node('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function init({store,onStudy,onRun,onNotice}={}){
 const demo=store.demo===true,license=Editions.client({demo}),research=R.store({demo});
 const reportError=(container,fn)=>async()=>{try{await fn();}catch(error){let n=container.querySelector('[role="alert"]');if(!n){n=node('p',undefined,'research-error');n.setAttribute('role','alert');container.prepend(n);}n.textContent=error.message;}};
 async function badge(){const s=await license.status(),b=document.getElementById('vault-plan');if(b)b.textContent=!demo&&root.VaultAccountUI?.enabled()?(s.signedIn?(s.pro?'Pro':s.remaining+' free runs'):'Sign in'):(s.active?'Pro':'Community');return s;}
 async function plans(){
  if(!demo&&root.VaultAccountUI?.enabled())return root.VaultAccountUI.open();
  const {body}=modal('Choose your Vault'),s=await badge();body.append(node('p','One installation. Your studies stay in the same archive.','muted'));
  const cards=node('div',undefined,'research-plans');for(const [key,p]of Object.entries(Editions.plans)){const c=node('section',undefined,'research-plan '+key);c.append(node('p',key===s.edition?'YOUR EDITION':'RESEARCH TOOLS','research-eyebrow'),node('h3',p.name),node('strong',key==='community'?'Free':'Paid pilot · invitation only'));const ul=node('ul');p.features.forEach(v=>ul.append(node('li',v)));c.append(ul);cards.append(c);}body.append(cards);
  body.append(node('p','Community includes every existing backtesting feature. Pro adds research tools. Public checkout is not open yet.','muted'));
  body.append(button('Open research tools',()=>{body.closest('dialog').close();void tools();},'secondary'));
  if(s.license){body.append(node('p',(s.active?'Active ':'Inactive ')+s.license.kind+' license · '+s.license.issuedTo+' · expires '+new Date(s.license.expiresAt).toLocaleDateString('en-IN')));}
  const input=node('input');input.type='file';input.accept='.json,application/json';input.setAttribute('aria-label','Activate a Pro license file');
  input.onchange=reportError(body,async()=>{const file=input.files[0];if(!file)return;if(file.size>32000)throw Error('Choose a Vault license file under 32 KB.');await license.activate(JSON.parse(await file.text()));await badge();const message=node('p','Pro is active. Open any study and choose Research tools.','research-success');message.setAttribute('role','status');body.append(message);input.value='';});
  body.append(field('Have a pilot license? Activate it here',input),node('p','Activation works locally. No payment details or research records are uploaded. After expiry, Community and access to saved research plans and reports remain available.','muted'));
  if(s.active)body.append(button('Remove license from this browser',reportError(body,async()=>{await license.remove();await badge();onNotice?.('License removed. Saved studies and research plans are unchanged.');body.closest('dialog').close();}),'quiet'));
 }
 function locked(body){body.append(node('p','This tool is included in Pro at ₹899/month.'),button('View editions',plans));}
 function trialList(container,items){for(const i of items){const c=node('div',undefined,'research-trial');c.append(node('strong','Trial '+i.trial.ordinal),node('p',i.eligible?'Meets the study’s rules':i.reasons.join(' · ')));if(i.run)c.append(button('Open saved report',()=>{container.closest('dialog').close();onRun?.(i.run);},'quiet'));container.append(c);}}
 async function tools(studyId){
  const studies=await store.allExperiments();let study=studies.find(e=>e.id===studyId)||studies[0];const {body}=modal('Research tools');
  const toolbar=node('div',undefined,'research-toolbar'),chooser=select(studies.map(e=>[e.id,e.name+' · '+new Date(e.createdAt).toLocaleDateString('en-IN')]));if(study)chooser.value=study.id;toolbar.append(field('Study',chooser));body.append(toolbar);
  const tabs=node('div',undefined,'research-tabs'),panel=node('div'),status=node('p');status.setAttribute('role','status');body.append(tabs,status,panel);let tab='sensitivity',renderId=0;
  for(const [value,label]of [['sensitivity','Sensitivity map'],['protocols','Research plans'],['reports','Research report']]){const b=button(label,()=>{tab=value;void render();});b.dataset.researchTab=value;tabs.append(b);}
  chooser.onchange=()=>{study=studies.find(e=>e.id===chooser.value);void render();};
  async function render(){const generation=++renderId;status.textContent='';panel.replaceChildren();tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.researchTab===tab)));const entitlement=await license.status();if(generation!==renderId||!body.isConnected)return;
   if(tab==='protocols'){await protocols(panel,study,entitlement.active);return;}
   if(!study){panel.append(node('p','Complete a study first, then open its Research tools.'));return;}
   if(!entitlement.active){locked(panel);return;}
   if(tab==='sensitivity')await sensitivity(panel,study);else reports(panel,study);
  }
  async function sensitivity(container,e){
   const runs=await store.all();if(!container.isConnected)return;
   if(!e.dimensions.length){container.append(node('p','This study uses one setup. Add test values in New test to compare how a setting changes the result.'));return;}
   const selections=node('div',undefined,'research-map-controls'),x=select(e.dimensions.map(d=>[d.key,d.label])),y=select([['','None'],...e.dimensions.map(d=>[d.key,d.label])]),group=select([]),phase=select(['discovery','validation','holdout'].filter(p=>e.trials.some(t=>t.phase===p)).map(p=>[p,p[0].toUpperCase()+p.slice(1)]));y.value=e.dimensions[1]?.key||'';
   const canvas=node('div'),filters=node('div',undefined,'research-map-controls'),detail=node('div',undefined,'research-cell-detail');detail.setAttribute('aria-live','polite');
   selections.append(field('Stage',phase),field('Matched conditions',group),field('Columns',x),field('Rows',y));container.append(node('p','Compare tested values within the same test conditions. Select a cell to open its evidence.','muted'),selections,filters,canvas,detail);
   let slice={};
   function fillGroups(){const old=group.value,decision=root.VaultExperiments.decisions(e,runs,phase.value);group.replaceChildren();decision.groups.forEach((g,n)=>{const o=node('option','Group '+(n+1)+' · '+g.items.length+' saved trials');o.value=g.key;group.append(o);});if([...group.options].some(o=>o.value===old))group.value=old;}
   function draw(){
    detail.replaceChildren();canvas.replaceChildren();filters.replaceChildren();if(x.value===y.value)y.value='';
    const m=R.map(e,runs,{x:x.value,y:y.value||null,groupKey:group.value||null,slice,phase:phase.value});if(!m.group){canvas.append(node('p',m.decision.items.length?'No comparable results. The saved evidence needs review.':'No saved results for this stage yet.'));trialList(canvas,m.decision.items);return;}
    slice=m.slice;for(const d of m.remaining){const s=select(d.values.map((v,n)=>[String(n),String(v)]));s.value=String(d.values.findIndex(v=>JSON.stringify(v)===JSON.stringify(slice[d.key])));s.onchange=()=>{slice[d.key]=d.values[Number(s.value)];draw();};filters.append(field(d.label,s));}
    const context=node('details'),list=node('dl',undefined,'research-context');context.append(node('summary','Test conditions'));Object.entries(m.group.controls).forEach(([k,v])=>list.append(node('dt',k),node('dd',String(v??'—'))));context.append(list);canvas.append(context);
    const objective={returns:'Return',drawdown:'Drawdown',calmar:'Calmar'}[e.objective],t=node('table',undefined,'research-map'),cap=node('caption',objective+' · stronger colour means a better value within this view'),thead=node('thead'),hr=node('tr');hr.append(node('th',m.y?.label||'Trial'));m.x.values.forEach(v=>hr.append(node('th',String(v))));thead.append(hr);t.append(cap,thead);const tbody=node('tbody');
    for(const row of m.rows){const tr=node('tr'),heading=node('th',m.y?String(row.value):m.x.label);heading.scope='row';tr.append(heading);for(const c of row.cells){const td=node('td');if(!c.items.length)td.append(node('span','—'));else{const b=button(c.text,()=>{detail.replaceChildren(node('h3','Selected evidence'));trialList(detail,c.items);});b.className='research-cell '+c.state;if(c.state==='eligible')b.style.setProperty('--intensity',String(0.13+c.strength*.65));b.setAttribute('aria-label',m.x.label+' '+c.x+(m.y?', '+m.y.label+' '+c.y:'')+': '+c.text);td.append(b);}tr.append(td);}tbody.append(tr);}t.append(tbody);const scroll=node('div',undefined,'research-map-scroll');scroll.append(t);canvas.append(scroll,node('p','— means no saved result in this group and slice. Excluded trials remain inspectable. Colour is descriptive, not proof of a robust strategy.','muted'));
   }
   x.onchange=y.onchange=()=>{slice={};draw();};group.onchange=()=>{slice={};draw();};phase.onchange=()=>{slice={};fillGroups();draw();};fillGroups();draw();
  }
  async function protocols(container,e,active){
   const saved=await research.all();if(!container.isConnected)return;
   if(active&&e){const box=node('section',undefined,'research-plan-editor'),name=node('input'),question=node('textarea'),previous=select([['','New research plan'],...saved.map(p=>[p.id,p.name+' · '+new Date(p.createdAt).toLocaleString('en-IN')])]);name.value=e.name;name.maxLength=120;question.maxLength=2000;question.rows=3;question.placeholder='What change are you testing, and what would count as useful evidence?';
    box.append(node('h3','Save this study’s plan'),field('Name',name),field('Research question',question),field('Version history',previous),button('Save new version',reportError(box,async()=>{await license.requireFeature('protocols');const parent=saved.find(p=>p.id===previous.value),id=root.crypto.randomUUID();await research.put(R.protocol(e,{id,familyId:parent?.familyId||id,previousId:parent?.id||null,name:name.value,hypothesis:question.value}));await render();}),'primary'),node('p','Saves settings, test values and decision rules. Results stay with the original study.','muted'));container.append(box);
   }else if(!active)locked(container);
   container.append(node('h3','Saved research plans'));if(!saved.length)container.append(node('p','No saved plans yet.'));
   for(const p of saved){const card=node('article',undefined,'research-protocol');card.append(node('h4',p.name),node('p',p.hypothesis),node('p',new Date(p.createdAt).toLocaleString('en-IN')+(p.previousId?' · revised version':' · first version'),'muted'));const details=node('details'),summary=node('dl',undefined,'research-context'),catalog=root.VaultExperiments.catalog(p.plan.baseline);details.append(node('summary','View saved settings'));summary.append(node('dt','Objective'),node('dd',{returns:'Return',drawdown:'Drawdown',calmar:'Calmar'}[p.plan.objective]),node('dt','Maximum drawdown'),node('dd',p.plan.ceiling+'%'),node('dt','Minimum trades'),node('dd',String(p.plan.minTrades)));for(const dim of p.plan.dimensions)summary.append(node('dt',catalog.find(c=>c.key===dim.key)?.label||dim.key),node('dd',dim.values.join(', ')));details.append(summary);for(const stage of ['momentum','execution','portfolio','marketFilter']){const values=root.VaultExperiments.fields(p.plan.baseline,stage);if(!values?.length)continue;const group=node('details'),list=node('dl',undefined,'research-context');group.append(node('summary',{momentum:'Strategy settings',execution:'Exit settings',portfolio:'Portfolio',marketFilter:'Market Trend Filter'}[stage]));for(const f of values)list.append(node('dt',f.label||'Setting '+(f.index+1)),node('dd',String(f.type==='checkbox'?(f.checked?'On':'Off'):f.value)));group.append(list);details.append(group);}card.append(details,button('Export plan',()=>download('vault-research-'+p.id+'.json',JSON.stringify({format:'backtest-vault-research',version:1,protocols:[p]},null,2)),'quiet'));
    if(active)card.append(button('Create draft study',reportError(card,async()=>{await license.requireFeature('protocols');const draft=R.draft(p,{id:root.crypto.randomUUID()});await store.putExperiment(draft);body.closest('dialog').close();onStudy?.(draft.id);onNotice?.('Draft created from your research plan. Review it before starting.');})));container.append(card);
   }
   const importFile=node('input');importFile.type='file';importFile.accept='.json';importFile.onchange=reportError(container,async()=>{const f=importFile.files[0];if(!f)return;if(f.size>25000000)throw Error('Research backups must be under 25 MB.');await research.importBackup(JSON.parse(await f.text()));await render();});container.append(field('Restore research plans',importFile),button('Back up research plans',reportError(container,async()=>download('vault-research-plans.json',JSON.stringify(await research.backup(),null,2))),'quiet'),node('p','Saved plans can always be viewed, restored and exported, including after Pro expires. Run Library backups include them too.','muted'));
  }
  function reports(container,e){const question=node('textarea'),notes=node('textarea');question.rows=3;question.maxLength=2000;notes.rows=5;notes.maxLength=8000;container.append(node('p','Create a shareable snapshot with all trials, exclusions, matched conditions and saved settings.','muted'),field('Research question',question),field('Your interpretation and next test',notes),button('Download research report',reportError(container,async()=>{await license.requireFeature('reports');const html=R.report(e,await store.all(),{question:question.value,notes:notes.value});download('vault-research-'+e.id+'.html',html,'text/html');}),'primary'),node('p','Downloads an HTML report. Open it and use Print → Save as PDF. Your report includes your settings; share it only with people you choose.','muted'));}
  await render();
 }
 badge().catch(()=>{});const b=document.getElementById('vault-plan');if(b)b.onclick=()=>plans();
 return {plans,tools,license,research,badge};
}
root.VaultResearchUI={init};
})(window);
