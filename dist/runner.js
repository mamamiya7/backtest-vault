/* One local RZone DOM executor. Only explicit experiment commands can start it. */
(() => {
'use strict';
const C=window.VaultCapture,E=window.VaultExperiments,V=window.Vault;
if(!C||!E||typeof chrome==='undefined'||!chrome.runtime?.sendMessage)return;
const session=crypto.randomUUID();let active=false,configuring=false,failed=false,interrupted=false,polling=false,writing=false;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const send=async data=>{const r=await chrome.runtime.sendMessage({type:'vault-experiment',session,...data});if(!r?.ok)throw Error(r?.error||'Extension disconnected.');return r;};
const inputs=p=>[...p.querySelectorAll('input,select,textarea')].filter(e=>C.visible(e)&&!['password','hidden','submit','button'].includes(e.type)&&!e.closest('[role="tab"]'));
const popups=()=>[...document.querySelectorAll('.popupContent')].filter(C.visible);
const ownClick=node=>{writing=true;try{node.click();}finally{writing=false;}};
const onMomentum=()=>!!C.main()&&document.body.innerText.includes('Momentum Trading BackTesting');
const navigation=()=>[...new Set([...document.querySelectorAll('a,button,[role="menuitem"],.gwt-MenuItem,.tool-popup .Fav-menu .scanner-name-scroll')].filter(n=>C.visible(n)&&!n.disabled&&/^Momentum Trading Back ?Testing$/i.test(V.clean(n.textContent))).map(n=>n.matches('.scanner-name-scroll')?n.closest('a')||n:n))];
const backtestNavigation=()=>[...document.querySelectorAll('li[token="bt"]')].filter(C.visible);
const workingPopups=()=>popups().filter(p=>!p.querySelector('.Fav-menu')||!p.closest('.tool-popup'));
function sourceStatus(){
 const main=C.main();const reason=failed?'RZone runner stopped. Refresh RZone after preserving any open report.':active?'A trial is running in RZone.':configuring?'Reading RZone setup options.':C.pending()?'Recover the pending save in RZone first.':C.running()?'A backtest is already running in RZone.':C.awaitingResult()?'An earlier source submission is still awaiting a confirmed result.':popups().length?'Close the open report or settings dialog in RZone.':!onMomentum()?'Open Momentum Trading BackTesting in RZone.':'';
 const chart=main?.querySelector('select');
 return {session,ready:!reason,capable:!failed&&!active&&!configuring&&!C.pending()&&!C.running()&&!C.awaitingResult()&&!workingPopups().length&&(onMomentum()||navigation().length===1||backtestNavigation().length===1),chart:chart?V.clean(chart.selectedOptions[0]?.textContent):'',reason};
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 if(sender.id!==chrome.runtime.id)return;
 if(message?.type==='vault-runner-status')reply(sourceStatus());
 if(message?.type==='vault-runner-wake'){reply({ok:true});void tick();}
 if(message?.type==='vault-runner-config'){void configuration(message.changes).then(config=>reply({ok:true,session,config}),error=>reply({ok:false,error:error.message}));return true;}
});
function button(p,name){const matches=[...p.querySelectorAll('button')].filter(e=>C.visible(e)&&!e.disabled&&name.test(V.clean(e.textContent)));if(matches.length!==1)throw Error('Cannot identify the '+name+' control.');return matches[0];}
function check(){if(interrupted)throw Error('The source tab was changed manually. Review the current trial.');if(!C.main())throw Error('RZone Momentum page is unavailable.');if(C.popup('Error'))throw Error('Definedge rejected the submitted settings.');}
async function wait(checkValue,deadline,message){while(Date.now()<deadline){check();const v=checkValue();if(v)return v;await delay(250);}throw Error(message);}
async function close(p){
 check();if(!p.isConnected||!C.visible(p))return;
 const controls=[...p.querySelectorAll('.custom-dialog-header .close-buton')].filter(C.visible);
 if(controls.length!==1)throw Error('Cannot identify the RZone dialog close control. Close that dialog in RZone before continuing.');
 controls[0].click();const deadline=Date.now()+5000;
 for(;;){
  // A hidden tab can wake after the deadline, after GWT has already finished
  // closing. Read the owned dialog first; a late timer is not a failed close.
  check();if(!p.isConnected||!C.visible(p))return;
  if(Date.now()>=deadline)throw Error('Source dialog did not close.');
  await delay(250);
 }
}
async function prepare(){
 if(C.pending()||C.running()||C.awaitingResult()||workingPopups().length)throw Error('Finish or close the current RZone work first. Your report and settings were left intact.');
 if(onMomentum()&&!popups().length)return;
 let choices=navigation();
 if(!choices.length&&backtestNavigation().length===1){backtestNavigation()[0].click();const deadline=Date.now()+10000;while(Date.now()<deadline&&!choices.length){if(interrupted)throw Error('RZone was changed while connecting. Connect again when ready.');if(workingPopups().length)throw Error('RZone opened an unexpected dialog. Review it before continuing.');await delay(100);choices=navigation();}}
 if(choices.length!==1)throw Error('Sign in to RZone so Vault can find Momentum Trading BackTesting.');
 choices[0].click();const deadline=Date.now()+10000;
 while(Date.now()<deadline){if(interrupted)throw Error('RZone was changed while connecting. Connect again when ready.');if(onMomentum())return;await delay(100);}
 throw Error('Momentum Trading BackTesting did not open.');
}
function descriptor(p){const fields=C.fields(p),options={};inputs(p).forEach((n,i)=>{if(n.tagName==='SELECT')options[i]=[...n.options].map(o=>({value:V.clean(o.textContent),label:V.clean(o.textContent),sourceValue:o.value,disabled:o.disabled}));});return {fields,options};}
function groupSearch(node,value){
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,value);
 // Search text is not a selected group. Do not dispatch a change or select a
 // suggestion while reading choices; the source commits groups on item clicks.
 node.dispatchEvent(new Event('input',{bubbles:true}));
 node.dispatchEvent(new KeyboardEvent('keyup',{key:'Backspace',bubbles:true}));
}
function groupMenu(){
 const found=popups().filter(p=>!V.clean(p.querySelector('.caption')?.textContent)&&p.querySelector('.ind-list'));
 if(found.length>1)throw Error('RZone opened more than one group menu. Close its menus and refresh choices.');
 if(popups().some(p=>!found.includes(p)))throw Error('RZone opened an unexpected dialog while reading groups. Close it and refresh choices.');
 return found[0];
}
function groupChoices(menu){
 const rows=[...menu.querySelectorAll('.ind-list li[grpid]')];
 if(rows.length>3000)throw Error('RZone has more than 3,000 group choices. Narrow the available source groups before refreshing.');
 const labels=new Set(),ids=new Set();
 return rows.map(row=>{
  const label=V.clean(row.textContent),id=row.getAttribute('grpid');
  if(!label||!id||label.length>500||id.length>500)throw Error('RZone group choices are incomplete. Refresh choices and try again.');
  if(labels.has(label)||ids.has(id))throw Error('RZone group choices are ambiguous. Give duplicate groups unique names before refreshing.');
  labels.add(label);ids.add(id);return {value:label,label,sourceValue:id,disabled:false};
 });
}
async function groupCatalogue(main){
 const before=C.fields(main),node=inputs(main)[1],oldPopups=new Set([...document.querySelectorAll('.popupContent')].filter(C.visible));
 if(before.length!==52||node?.tagName!=='INPUT'||node.type!=='text'||node.placeholder!=='Search Group'||node.disabled)throw Error('Cannot identify the RZone group search. Refresh RZone and connect again.');
 if(popups().length)throw Error('Close the open RZone menu before refreshing choices.');
 // RZone appends a tooltip "i" inside .header-text; match the heading's own
 // text so that icon text does not make the safe outside-click target vanish.
 const outside=[...document.querySelectorAll('.header-text,h1,h2,h3,h4')].filter(n=>C.visible(n)&&/^Momentum Trading Back ?Testing$/i.test(V.clean([...n.childNodes].filter(child=>child.nodeType===Node.TEXT_NODE).map(child=>child.textContent).join(' ')))&&!n.closest('a,button,input,select,textarea'));
 if(outside.length!==1)throw Error('Cannot identify the RZone page heading. Refresh RZone and connect again.');
 const original=node.value,owned=new Set();let started=Date.now(),changedAt=started,signature='',fresh=false;
 const observer=new MutationObserver(records=>{if(records.some(r=>[...owned].some(p=>{const list=p.querySelector('.ind-list');return list&&(r.target===list||list.contains(r.target)||[...r.addedNodes,...r.removedNodes].some(n=>n===list));}))){fresh=true;changedAt=Date.now();}});
 observer.observe(document.body,{subtree:true,childList:true,characterData:true});
 const read=()=>{
  const menu=groupMenu();if(!menu)return null;
  if(!owned.has(menu)){
   if(oldPopups.has(menu))throw Error('An existing RZone group menu reappeared. Close it and refresh choices.');
   owned.add(menu);fresh=true;changedAt=Date.now();
  }
  const choices=groupChoices(menu),next=JSON.stringify(choices);
  if(next!==signature){signature=next;changedAt=Date.now();}
  return {menu,choices};
 };
 try{
  // Clear before focus/click: opening with an old query can first render a
  // filtered list, which must never be mistaken for the full catalogue.
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,'');
  node.focus();ownClick(node);groupSearch(node,'');
  const deadline=Date.now()+10000;let choices;
  while(Date.now()<deadline){
   check();if(node.value!=='')throw Error('The RZone group search changed while reading. Refresh choices when ready.');
   const current=read();
   if(fresh&&current?.choices.length&&Date.now()-started>=1500&&Date.now()-changedAt>=750){choices=current.choices;break;}
   await delay(100);
  }
  if(!choices)throw Error('RZone did not finish loading its group choices. Refresh choices and try again.');
 return choices;
 }finally{
  try{
  if(!interrupted&&node.isConnected){
   observer.takeRecords();fresh=original===''||!owned.size;
   groupSearch(node,original);
   // Let the restored search settle before dismissing its own popup, so a
   // delayed response cannot reopen it over the execution-settings dialog.
   const restoreStarted=Date.now(),restoreDeadline=restoreStarted+5000;let restoredAt=restoreStarted,last='',restored=false;
   while(Date.now()<restoreDeadline){
    check();const menu=groupMenu();
    if(menu&&!owned.has(menu)){if(oldPopups.has(menu))throw Error('An existing RZone menu reappeared. Close it and refresh choices.');owned.add(menu);fresh=true;changedAt=Date.now();}
    const next=menu?menu.innerHTML:'';if(next!==last){last=next;restoredAt=Date.now();}
    if(fresh&&Date.now()-restoreStarted>=1500&&Date.now()-Math.max(restoredAt,changedAt)>=750){restored=true;break;}
    await delay(100);
   }
   if(!restored)throw Error('RZone group search did not settle. Close its menu and refresh choices.');
   if([...owned].some(p=>p.isConnected&&C.visible(p))){
    outside[0].dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
    outside[0].dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));ownClick(outside[0]);
    const closeDeadline=Date.now()+5000;
    for(;;){check();if([...owned].every(p=>!p.isConnected||!C.visible(p)))break;if(Date.now()>=closeDeadline)throw Error('RZone group menu did not close. Close it and refresh choices.');await delay(100);}
   }
   node.blur();
   if(JSON.stringify(C.fields(main))!==JSON.stringify(before))throw Error('RZone settings changed while reading group choices. Review the source settings and connect again.');
  }
  }finally{observer.disconnect();}
 }
}
function configChanges(changes){
 if(changes===undefined)return {};
 if(!changes||typeof changes!=='object'||Array.isArray(changes)||Object.keys(changes).some(s=>!['momentum','execution'].includes(s)))throw Error('Unsupported setup choices.');
 const allowed={momentum:[0,3,35,39,43,47],execution:[0,3,4,6]};
 for(const [stage,values]of Object.entries(changes)){
  if(!values||typeof values!=='object'||Array.isArray(values))throw Error('Unsupported setup choices.');
  for(const [key,value]of Object.entries(values)){
   if(!/^\d+$/.test(key)||String(Number(key))!==key||!allowed[stage].includes(Number(key))||typeof value!=='string'||!value.length||value.length>200)throw Error('This setting needs a separate source adapter.');
   if(stage==='momentum'&&key==='0'&&value!=='Candle'||stage==='execution'&&key==='3'&&value!=='Candle'||stage==='execution'&&key==='4'&&value!=='Price')throw Error('Only Candle and Price setup can be refreshed automatically.');
  }
 }
 if(Object.values(changes).reduce((n,values)=>n+Object.keys(values).length,0)>1)throw Error('Refresh one source selector at a time.');
 return changes;
}
const sourceParents={momentum:{35:{gate:34,child:36},39:{gate:42,child:40},43:{gate:46,child:44},47:{gate:50,child:48}},execution:{6:{gate:5,child:7}}};
async function settledOptions(p,index,changed,until=Infinity){
 const deadline=Math.min(Date.now()+10000,until),started=Date.now();let signature='',stableAt=Date.now();
 while(Date.now()<deadline){check();const n=inputs(p)[index],next=n?.tagName==='SELECT'?JSON.stringify([...n.options].map(o=>[o.value,V.clean(o.textContent),o.disabled])):'';
  if(next!==signature){signature=next;stableAt=Date.now();}
  if(changed()&&n?.tagName==='SELECT'&&Date.now()-started>=750&&Date.now()-stableAt>=750)return;
  await delay(100);
 }
 throw Error('RZone did not finish loading the dependent choices. Try refreshing those choices again.');
}
async function selectValue(p,node,value,parent,until=Infinity){
 if(Date.now()>=until)throw Error('RZone strategy choices took too long to load. Refresh choices and try again.');
 let observer=null,refreshed=!parent;
 if(parent){const child=inputs(p)[parent.child];observer=new MutationObserver(records=>{if(records.some(r=>r.target===child||child?.contains(r.target)||[...r.removedNodes,...r.addedNodes].some(n=>n===child||n.contains?.(child))))refreshed=true;});observer.observe(p,{subtree:true,childList:true,characterData:true});}
 try{node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}));if(parent)await settledOptions(p,parent.child,()=>refreshed,until);}finally{observer?.disconnect();}
}
async function changeParents(p,changes,stage){
 for(const [key,value]of Object.entries(changes||{})){
  const index=Number(key),f=C.fields(p)[index],parent=sourceParents[stage]?.[index];
  if(!f||f.type!=='select-one')throw Error('Source setting layout changed.');
  if(f.value===value)continue;
  const restore=parent&&!C.fields(p)[parent.gate].checked;
  try{
   if(restore)await setField(p,parent.gate,{...C.fields(p)[parent.gate],checked:true},stage);
   await setField(p,index,{...f,value},stage);
  }finally{if(restore&&!interrupted&&C.visible(p))await setField(p,parent.gate,{...C.fields(p)[parent.gate],checked:false},stage);}
 }
}
const strategyRows=[{parentIndex:39,childIndex:40,timeframeIndex:41,gateIndex:42},{parentIndex:43,childIndex:44,timeframeIndex:45,gateIndex:46},{parentIndex:47,childIndex:48,timeframeIndex:49,gateIndex:50}];
function strategyOptions(node){
 if(node?.tagName!=='SELECT'||node.options.length>3000)throw Error('RZone strategy choices are unavailable or exceed 3,000 entries.');
 const labels=new Set();return [...node.options].map(option=>{
  const label=V.clean(option.textContent);
  if(!label||label.length>2000||option.value.length>2000||labels.has(label))throw Error('RZone strategy choices have missing or duplicate names. Review them before refreshing.');
  labels.add(label);return {value:label,label,sourceValue:option.value,disabled:option.disabled};
 });
}
function unchangedOutsideRow(main,before,row){
 const nodes=inputs(main),expected=before.map(field=>({...field}));
 if(nodes.length!==before.length)throw Error('RZone settings layout changed while reading strategy choices.');
 // The full labelled snapshot is checked again after restoring this row.
 // During its requests, read native values directly instead of repeatedly
 // cloning every source table and its potentially thousands of rule options.
 const current=nodes.map((node,index)=>nodeField(node,before[index]));
 for(const index of [row.parentIndex,row.childIndex,row.timeframeIndex,row.gateIndex]){
  const actual=current[index];expected[index]={...expected[index],value:actual.value,checked:actual.checked,disabled:actual.disabled};
 }
 if(JSON.stringify(expected)!==JSON.stringify(current))throw Error('Other RZone settings changed while reading strategy choices. Review the source before reconnecting.');
}
async function restoreStrategyRow(main,row,snapshot,original){
 const deadline=Date.now()+5000;let restoreError;
 try{
  check();let nodes=inputs(main),parent=nodes[row.parentIndex];
  if(parent.value!==original.parentValue){
   if(![...parent.options].some(o=>o.value===original.parentValue&&V.clean(o.textContent)===snapshot[row.parentIndex].value))throw Error('The original category is no longer available.');
   await selectValue(main,parent,original.parentValue,{gate:row.gateIndex,child:row.childIndex},deadline);
  }
  for(const [index,value]of [[row.childIndex,original.ruleValue],[row.timeframeIndex,original.timeframeValue]]){
   check();nodes=inputs(main);const node=nodes[index];
   if(node.value===value&&V.clean(node.selectedOptions[0]?.textContent)===snapshot[index].value)continue;
   if(![...node.options].some(o=>o.value===value&&V.clean(o.textContent)===snapshot[index].value))throw Error('The original selected rule or timeframe is no longer available.');
   await selectValue(main,node,value,null,deadline);await delay(150);
  }
 }catch(error){restoreError=error;}
 finally{
  if(!interrupted&&C.main()===main){
   const gate=inputs(main)[row.gateIndex];if(gate?.type==='checkbox'&&gate.checked!==original.enabled){ownClick(gate);await delay(150);}
  }
 }
 if(restoreError)throw Error('RZone strategy settings could not be restored: '+restoreError.message+' Review the source before reconnecting.');
 if(JSON.stringify(C.fields(main))!==JSON.stringify(snapshot))throw Error('RZone strategy settings changed during discovery. Review the source before reconnecting.');
}
async function strategyCatalogues(main,deadline){
 const catalogues={};
 for(const row of strategyRows){
  check();if(Date.now()>=deadline)throw Error('RZone strategy choices took too long to load. Refresh choices and try again.');
  const snapshot=C.fields(main),nodes=inputs(main),parent=nodes[row.parentIndex],child=nodes[row.childIndex],gate=nodes[row.gateIndex],timeframe=nodes[row.timeframeIndex];
  if(snapshot.length!==52||parent?.tagName!=='SELECT'||child?.tagName!=='SELECT'||timeframe?.tagName!=='SELECT'||gate?.type!=='checkbox'||gate.disabled)throw Error('RZone strategy layout changed. Refresh RZone and connect again.');
  const offered=strategyOptions(parent).filter(o=>!o.disabled&&['Pre','My','Public','Popular'].includes(o.value));
  const selected=V.clean(parent.selectedOptions[0]?.textContent);
  if(!offered.some(o=>o.value===selected))throw Error('The selected RZone strategy category is not available for automatic discovery.');
  const original={parentValue:parent.value,ruleValue:child.value,timeframeValue:timeframe.value,enabled:gate.checked},categories={};
  try{
   if(!gate.checked){ownClick(gate);await delay(150);await settledOptions(main,row.childIndex,()=>true,deadline);}
   if(inputs(main)[row.parentIndex].value!==original.parentValue)await selectValue(main,inputs(main)[row.parentIndex],original.parentValue,{gate:row.gateIndex,child:row.childIndex},deadline);
   const initialAnchor=inputs(main)[row.childIndex].options.length?offered.find(o=>o.value===selected):null;
   const ordered=['Pre','Popular','My','Public'].map(name=>offered.find(option=>option.value===name)).filter(Boolean);
   for(const category of [...ordered.filter(o=>o.value!==selected),...ordered.filter(o=>o.value===selected)]){
    check();unchangedOutsideRow(main,snapshot,row);
    if(Date.now()>=deadline)throw Error('RZone strategy choices took too long to load. Refresh choices and try again.');
    const current=inputs(main),categoryNode=current[row.parentIndex];
    if(!current[row.gateIndex].checked||categoryNode.disabled||current[row.childIndex].disabled)throw Error('RZone did not enable the strategy choices. Review its strategy checkbox and reconnect.');
    // Empty -> empty can produce no DOM mutation at all. Visit a known
    // populated category first, so clearing its options is a fresh, observable
    // empty response rather than an assumed completion of a pending request.
    if(!current[row.childIndex].options.length&&categoryNode.value!==category.sourceValue&&!categories[category.value]?.length&&initialAnchor?.value!==category.value){
     const anchor=offered.find(o=>categories[o.value]?.length)||initialAnchor;
     if(anchor&&anchor.sourceValue!==category.sourceValue&&anchor.sourceValue!==categoryNode.value){
      await selectValue(main,categoryNode,anchor.sourceValue,{gate:row.gateIndex,child:row.childIndex},deadline);
      const options=strategyOptions(inputs(main)[row.childIndex]);
      if(!options.length)throw Error('RZone strategy choices changed during discovery. Refresh choices and try again.');
      categories[anchor.value]=options;
     }
    }
    if(inputs(main)[row.parentIndex].value!==category.sourceValue)await selectValue(main,inputs(main)[row.parentIndex],category.sourceValue,{gate:row.gateIndex,child:row.childIndex},deadline);
    else await settledOptions(main,row.childIndex,()=>true,deadline);
    check();unchangedOutsideRow(main,snapshot,row);
    if(V.clean(inputs(main)[row.parentIndex].selectedOptions[0]?.textContent)!==category.value)throw Error('The RZone strategy category changed while reading choices.');
    categories[category.value]=strategyOptions(inputs(main)[row.childIndex]);
   }
  }finally{if(!interrupted)await restoreStrategyRow(main,row,snapshot,original);}
  catalogues[row.childIndex]={parentIndex:row.parentIndex,gateIndex:row.gateIndex,categories};
 }
 return catalogues;
}
async function configuration(requestedChanges){
 if(active||configuring||failed)throw Error('RZone is busy or needs review. Finish its current work first.');
 const changes=configChanges(requestedChanges);
 configuring=true;interrupted=false;const started=Date.now();let setup=null,config;
 try{
  try{
  C.status('Connecting to Vault: opening Momentum settings…');
  await prepare();
  C.status('Connecting to Vault: reading strategy choices…');
  const original=C.fields(C.main());if(original.length!==52||original[0]?.value!=='Candle')throw Error('This source layout needs a separate automatic setup adapter.');
  await changeParents(C.main(),changes.momentum,'momentum');const momentum=descriptor(C.main());
  if(momentum.fields.length!==52||momentum.fields[0]?.value!=='Candle'||momentum.fields[51]?.checked)throw Error('Vault setup currently supports the standard Candle layout without Relative Strength. This RZone layout needs a separate adapter.');
  if(momentum.fields[2]?.checked)throw Error('Market Trend Filter has additional source settings. Turn it off before connecting this setup.');
  momentum.options[1]=await groupCatalogue(C.main());
  // Scan for at most 35 s, stopping by 38 s from request start (28 s when an
  // execution parent must also refresh). Reserve 5 s for row restoration,
  // 10 s to open execution settings, optionally 10 s for that parent refresh,
  // and 5 s to close the owned dialog: at most 58 s of the worker's 60 s.
  // The dashboard's 70 s deadline and all fresh-response checks stay unchanged.
  const scanDeadline=Math.min(Date.now()+35000,started+(Object.keys(changes.execution||{}).length?28000:38000));
  momentum.ruleCatalogues=await strategyCatalogues(C.main(),scanDeadline);
  for(const [child,catalogue]of Object.entries(momentum.ruleCatalogues))momentum.options[child]=catalogue.categories[momentum.fields[catalogue.parentIndex].value];
  C.status('Connecting to Vault: reading backtest settings…');
  button(C.main(),/^BackTest$/i).click();setup=await wait(()=>C.popup('Momentum Trading BackTest'),Date.now()+10000,'Momentum settings did not open.');
  await changeParents(setup,changes.execution,'execution');const execution=descriptor(setup);
  if(execution.fields.length!==12||execution.fields[3]?.value!=='Candle'||execution.fields[4]?.value!=='Price')throw Error('Vault setup currently supports Candle with Price execution. This execution layout needs a separate adapter.');
  const portfolio=window.VaultSetup?.portfolioTemplate();if(!portfolio)throw Error('Vault setup template is unavailable. Reload the extension and RZone.');
  check();config={schemaVersion:1,session,capturedAt:new Date().toISOString(),stages:{momentum,execution,portfolio},supports:{charts:['Candle'],blocked:['relative-strength','market-filter']}};
  }finally{if(setup&&C.visible(setup)&&!interrupted)await close(setup);}
  C.status('RZone settings read. Return to Vault to finish setup.');return config;
 }catch(error){C.status('Vault connection failed: '+error.message);throw error;}
 finally{configuring=false;}
}
function sameValue(a,b){try{E.verify([{...a,index:0}],[{...b,index:0}]);return true;}catch{return false;}}
function layout(expected,current){if(expected.length!==current.length||expected.some((f,i)=>f.type!==current[i].type||V.clean(f.label)!==V.clean(current[i].label)))throw Error('Settings layout changed. Review the source tab.');}
function nodeField(node,field){return {...field,type:node.type,value:node.tagName==='SELECT'?[...node.selectedOptions].map(o=>V.clean(o.textContent)).join('; '):node.value,checked:['checkbox','radio'].includes(node.type)?node.checked:null,disabled:node.disabled};}
function setupNodes(p,expected){const nodes=inputs(p);if(nodes.length!==expected.length||nodes.some((n,i)=>n.type!==expected[i].type))throw Error('Settings layout changed. Review the source tab.');return nodes;}
function setText(node,value){const proto=node.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(node,String(value));node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));}
async function group(node,value){
 node.focus();setText(node,value);node.dispatchEvent(new KeyboardEvent('keyup',{key:String(value).at(-1)||'',bubbles:true}));
 const selected=await wait(()=>{
  const candidates=[...document.querySelectorAll('.ind-list li,.gwt-SuggestBoxPopup .item,.gwt-SuggestBoxPopup td,[role="listbox"] [role="option"]')].filter(n=>C.visible(n)&&V.clean(n.textContent)===String(value));
  const exact=candidates.filter(n=>!candidates.some(other=>other!==n&&n.contains(other)));
  if(exact.length>1)throw Error('The group name matches more than one RZone choice. Choose a unique group.');return exact[0];
 },Date.now()+5000,'RZone did not confirm that group. Choose an exact group name from the available RZone groups.');
 ownClick(selected);node.blur();await delay(150);if(V.clean(node.value)!==V.clean(value))throw Error('RZone selected a different group.');
}
async function setField(p,index,f,stage){
 check();const node=inputs(p)[index];if(!node||node.type!==f.type)throw Error('Settings layout changed. Review the source tab.');const current=nodeField(node,f);if(sameValue(f,current)&&!(stage==='momentum'&&index===1))return;
 if(node.disabled)throw Error('Planned setting is disabled: '+f.label);
 if(['checkbox','radio'].includes(f.type)){if(f.type==='radio'&&!f.checked)return;ownClick(node);}
 else if(node.tagName==='SELECT'){const matches=[...node.options].filter(o=>!o.disabled&&V.clean(o.textContent)===String(f.value));if(matches.length!==1)throw Error('Planned dropdown value is unavailable: '+f.label);await selectValue(p,node,matches[0].value,sourceParents[stage]?.[index]);}
 else if(stage==='momentum'&&index===1)await group(node,String(f.value));
 else {setText(node,f.value);node.blur();}
 await delay(150);
}
async function applySetup(p,expected,stage){
 layout(expected,C.fields(p));
 if(stage==='momentum'&&(expected.length!==52||expected[0].value!=='Candle'||[2,51].some(i=>expected[i].checked)))throw Error('This setup uses a source filter that has not been validated for automatic execution.');
 if(stage==='execution'&&(expected.length!==12||expected[3].value!=='Candle'||expected[4].value!=='Price'))throw Error('This execution setup has not been validated for automatic execution.');
 // Checkbox gates may disable their retained numeric values. Populate those
 // values while the gate is on, then restore the explicitly planned state.
 const gates=stage==='momentum'?[[4,5,6,7,8,9,10],[11,12],[13,14],[15,16],[17,18],[26,27],[28,29],[30,31],[34,35,36],[37,38],[42,39,40,41],[46,43,44,45],[50,47,48,49]]:stage==='execution'?[[5,6,7],[8,9],[10,11]]:[[0,1,2,3,4,5],[4,5]];
 const temporary=[];
 for(const [gate,...children] of gates){
  check();const nodes=setupNodes(p,expected),current=nodes.map((n,i)=>nodeField(n,expected[i])),changing=children.some(i=>!sameValue(expected[i],current[i])),mustEnable=expected[gate]?.checked||changing;
  if(mustEnable&&!current[gate].checked)await setField(p,gate,{...expected[gate],checked:true},stage);
  if(changing&&!expected[gate].checked)temporary.push(gate);
 }
 const order=stage==='momentum'?[0,3,1,...expected.map((_,i)=>i).filter(i=>![0,3,1].includes(i))]:expected.map((_,i)=>i);
 for(const i of order){if(temporary.includes(i))continue;setupNodes(p,expected);await setField(p,i,expected[i],stage);}
 for(const i of temporary.reverse())await setField(p,i,expected[i],stage);
 E.verify(expected,C.fields(p));
}
async function apply(p,e,t,stage){
 const expected=E.fields(E.expected(e,t),stage),current=C.fields(p),allowed=e.dimensions.filter(d=>d.stage===stage).map(d=>d.index);
 if(e.baseline.origin==='vault-setup'){await applySetup(p,expected,stage);return;}
 if(stage==='execution'&&t.period)allowed.push(1,2);
 // Validate fixed controls before changing anything. Never silently restore another strategy.
 const fixed=E.clone(expected);for(const i of allowed)if(current[i])fixed[i]={...fixed[i],value:current[i].value,checked:current[i].checked};E.verify(fixed,current);
 for(const i of allowed){check();const f=expected[i],nodes=inputs(p),node=nodes[i];if(!node||node.disabled)throw Error('Planned setting is disabled: '+f.label);if(f.type==='checkbox'){if(node.checked!==f.checked)ownClick(node);}else if(node.tagName==='SELECT'){const matches=[...node.options].filter(o=>V.clean(o.textContent)===String(f.value));if(matches.length!==1)throw Error('Planned dropdown value is unavailable.');node.value=matches[0].value;node.dispatchEvent(new Event('change',{bubbles:true}));}else{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(node,String(f.value));node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));node.blur();}await delay(150);}
 E.verify(expected,C.fields(p));
}
async function run(job){
 const {experiment:e,trial:t,token}=job,common={id:e.id,trialId:t.id,token};
 const checkpoint=stage=>send({...common,action:'checkpoint',stage});
 active=true;interrupted=false;const deadline=Date.now()+e.timeoutMinutes*60000;
 try{
  if(C.pending())throw Error('Recover the pending manual save before starting an experiment.');
  if(C.running())throw Error('A backtest is already running in RZone. Wait for it to finish before starting an experiment.');
  if(C.awaitingResult())throw Error('An earlier source submission is still awaiting a confirmed result.');
  if(popups().length)throw Error('Close existing RZone dialogs before starting. Your open report was left intact.');
  C.status(e.name+' · Trial '+t.ordinal+' of '+e.trials.length);
  await apply(C.main(),e,t,'momentum');
  button(C.main(),/^BackTest$/i).click();
  const setup=await wait(()=>C.popup('Momentum Trading BackTest'),Math.min(deadline,Date.now()+10000),'Momentum settings did not open.');
  await apply(setup,e,t,'execution');
  E.verify(E.fields(E.expected(e,t),'momentum'),C.fields(C.main()));
  await checkpoint('strategy-submitting'); // Persist the intent before a source side effect.
  const previous=C.getStrategy()?.id;button(setup,/^Backtest$/i).click();
  const submitted=C.getStrategy();
  if(!submitted||submitted.id===previous)throw Error('The strategy submission was not recorded.');
  const completed=await wait(()=>{C.monitor();const s=C.getStrategy();if(s&&s.id!==submitted.id)throw Error('The strategy submission changed during this trial.');return s?.completed&&s.startedAt&&s.completedAt?s:null;},deadline,'A fresh running-to-completed Momentum backtest could not be confirmed.');
  await checkpoint('strategy-complete');
  if(C.visible(setup))await close(setup);
  button(C.main(),/^Portfolio Testing$/i).click();
  const portfolio=await wait(()=>C.popup('Portfolio Backtesting'),Math.min(deadline,Date.now()+10000),'Portfolio settings did not open.');
  await apply(portfolio,e,t,'portfolio');
  E.verify(E.fields(E.expected(e,t),'momentum'),C.fields(C.main()));
  await checkpoint('portfolio-submitting');
  const previousPortfolio=C.getPortfolio()?.id;button(portfolio,/^Backtest$/i).click();
  const submittedPortfolio=C.getPortfolio();
  if(!submittedPortfolio||submittedPortfolio.id===previousPortfolio||submittedPortfolio.strategy?.id!==completed.id)throw Error('The portfolio submission was not linked to this trial.');
  const report=await wait(()=>C.popup('Portfolio Backtesting Report'),deadline,'Portfolio report did not arrive.');
  C.monitor();await checkpoint('capturing');
  const experiment={id:e.id,trialId:t.id,phase:t.phase};
  await C.capture({strict:true,runId:t.runId,name:e.name+' · '+t.phase+' '+t.ordinal,submission:{strategyId:completed.id,portfolioId:submittedPortfolio.id},experiment,verify:r=>{
   check();
   if(!report.isConnected||C.popup('Portfolio Backtesting Report')!==report||C.getStrategy()?.id!==completed.id||C.getPortfolio()?.id!==submittedPortfolio.id)throw Error('The source report or submission changed during capture.');
   for(const stage of ['momentum','execution','portfolio'])E.verify(E.fields(E.expected(e,t),stage),E.fields(r,stage));
   const p=r.parameters,s=p.strategy;
   const evidence={version:1,sourceSession:session,strategySubmissionId:s.id,strategySubmittedAt:s.at,strategyStartedAt:s.startedAt,strategyCompletedAt:s.completedAt,portfolioSubmissionId:p.id,portfolioSubmittedAt:p.at,reportOpenedAt:p.reportOpenedAt,capturedAt:r.savedAt};
   const times=[s.at,s.startedAt,s.completedAt,p.at,p.reportOpenedAt,r.savedAt].map(Date.parse);
   if(times.some((value,index)=>!Number.isFinite(value)||index>0&&value<times[index-1]))throw Error('Submission timing could not be verified.');
   experiment.evidence=evidence;
  }});
  // Close only this trial's saved report. A failed close stops further submissions.
  await close(report);if(C.visible(portfolio))await close(portfolio);
  await checkpoint('saved');
  C.status('Trial '+t.ordinal+' saved. Experiment queue will continue in this tab.');
 }catch(error){failed=true;C.status('Experiment stopped: '+error.message);try{await send({...common,action:'fail',error:error.message});}catch{/* Durable lease prevents replay if the worker is unreachable. */}}
 finally{active=false;}
}
for(const type of ['click','input','change'])document.addEventListener(type,event=>{if((active||configuring)&&!writing&&event.isTrusted&&!C.host.contains(event.target))interrupted=true;},true);
async function tick(){if(polling)return;polling=true;try{const r=await send({action:'hello',...sourceStatus(),failed});if(r.id&&!active&&!configuring&&!failed){const job=await send({action:'claim',id:r.id});if(job.trial)void run(job);}}catch{/* Reload invalidates the document; do not keep sending or submit again. */failed=true;}finally{polling=false;}}
window.VaultRunner={get active(){return active;},apply};
const timer=setInterval(tick,3000);void tick();window.addEventListener('pagehide',()=>{clearInterval(timer);interrupted=true;},{once:true});
})();
