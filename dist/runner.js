/* One local RZone DOM executor. Only explicit experiment commands can start it. */
(() => {
'use strict';
const C=window.VaultCapture,E=window.VaultExperiments,V=window.Vault,L=window.VaultSourceLayouts;
if(!C||!E||!L||typeof chrome==='undefined'||!chrome.runtime?.sendMessage)return;
const session=crypto.randomUUID();let active=false,configuring=false,failed=false,interrupted=false,polling=false,writing=false;
let lastConfig=null,optionalDay='';const optionalMenus=[];
const localChoiceDay=(time=Date.now())=>{const day=new Date(time);return [day.getFullYear(),day.getMonth(),day.getDate()].join('-');};
const currentChoiceDay=()=>lastConfig&&localChoiceDay(lastConfig.capturedAt)===localChoiceDay();
function checkOptionalDay(force=false){const day=localChoiceDay();if(force||optionalDay!==day){optionalMenus.length=0;optionalDay=day;}}
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
 if(message?.type==='vault-runner-config'){void configuration(message.changes,message).then(result=>reply({ok:true,session,...result}),error=>{if(!active&&!configuring)C.status('Could not load settings: '+error.message);reply({ok:false,error:error.message});});return true;}
 if(message?.type==='vault-runner-rule-search'){void ruleLookup(message).then(result=>reply({ok:true,session,result}),error=>reply({ok:false,error:error.message}));return true;}
 if(message?.type==='vault-runner-symbol-search'){void symbolLookup(message).then(result=>reply({ok:true,session,result}),error=>reply({ok:false,error:error.message}));return true;}
});
function button(p,name){const matches=[...p.querySelectorAll('button')].filter(e=>C.visible(e)&&!e.disabled&&name.test(V.clean(e.textContent)));if(matches.length!==1)throw Error('Cannot identify the '+name+' control.');return matches[0];}
function check(){if(interrupted)throw Error('The source tab was changed manually. Review the current trial.');if(!C.main())throw Error('RZone Momentum page is unavailable.');if(C.popup('Error'))throw Error('Definedge rejected the submitted settings.');}
async function wait(checkValue,deadline,message){while(Date.now()<deadline){check();const v=checkValue();if(v)return v;await delay(250);}throw Error(message);}
async function close(p,until=Infinity){
 check();if(!p.isConnected||!C.visible(p))return;
 const controls=[...p.querySelectorAll('.custom-dialog-header .close-buton')].filter(node=>C.visible(node)&&node.closest('.popupContent')===p);
 if(controls.length!==1)throw Error('Cannot identify the RZone dialog close control. Close that dialog in RZone before continuing.');
 if(popups().at(-1)!==p)throw Error('RZone still has an open menu above its settings. Close that menu before reconnecting.');
 const started=Date.now(),deadline=Math.min(started+10000,until);let retried=false;
 ownClick(controls[0]);
 for(;;){
  // A hidden tab can wake after the deadline, after GWT has already finished
  // closing. Read the owned dialog first; a late timer is not a failed close.
  check();if(!p.isConnected||!C.visible(p))return;
  if(Date.now()>=deadline)throw Error('Source dialog did not close.');
  // GWT keeps the popup attached while its clipping animation runs. Allow
  // that animation within the request's cleanup budget; never remove it.
  const shell=p.closest('.custom-dialog'),style=shell&&getComputedStyle(shell),animating=style?.overflow==='hidden'&&style.clip!=='auto'&&style.clip!=='rect(auto, auto, auto, auto)';
  if(!retried&&!animating&&Date.now()-started>=500&&popups().at(-1)===p&&controls[0].isConnected){
   retried=true;controls[0].dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));controls[0].dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));ownClick(controls[0]);
  }
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
async function settledMain(){
 const started=Date.now(),deadline=started+8000;let signature='',stableAt=started;
 while(Date.now()<deadline){
  check();if(workingPopups().length)throw Error('Close the open RZone menu or dialog, then connect again.');
  const main=C.main(),nodes=inputs(main);
  const next=JSON.stringify(nodes.map(n=>[n.type,n.value,n.checked??null,n.disabled,n.tagName==='SELECT'?[...n.options].map(o=>[o.value,V.clean(o.textContent),o.disabled]):null]));
  if(next!==signature){signature=next;stableAt=Date.now();}
  const chart=V.clean(nodes[0]?.selectedOptions?.[0]?.textContent),layout=['Candle','P&F','Renko'].includes(chart)?L.main(chart,nodes[chart==='Candle'?51:53]?.checked):null;
  if(layout&&nodes.length===layout.count&&Date.now()-started>=1500&&Date.now()-stableAt>=750)return main;
  await delay(100);
 }
 throw Error('RZone settings are still loading. Wait for the form to finish loading, then connect again.');
}
function changedControls(before,after){
 const changes=[];
 for(let index=0;index<Math.max(before.length,after.length);index++){
  const a=before[index],b=after[index];if(JSON.stringify(a)===JSON.stringify(b))continue;
  const label=V.clean(a?.label||b?.label||'Control').slice(0,80);
  const properties=!a||!b?['layout']:['label','type','value','checked','disabled'].filter(key=>a[key]!==b[key]).map(key=>({type:'control type',value:'selection',checked:'on/off',disabled:'availability'}[key]||key));
  changes.push('field '+(index+1)+' ('+label+': '+properties.join(', ')+')');
 }
 return changes.slice(0,3).join('; ')+(changes.length>3?'; '+(changes.length-3)+' more controls':'');
}
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
 if(!L.stage('momentum',before)||node?.tagName!=='INPUT'||node.type!=='text'||node.placeholder!=='Search Group'||node.disabled)throw Error('Cannot identify the RZone group search. Refresh RZone and connect again.');
 if(popups().length)throw Error('Close the open RZone menu before refreshing choices.');
 // The heading opens RZone's help tooltip. Its plain Chart Type label was
 // verified to dismiss Group without opening a popup or changing a control.
 const row=inputs(main)[0]?.closest('tr'),outside=[...(row?.children||[])].filter(n=>n.tagName==='TD'&&C.visible(n)&&!n.children.length&&/^Chart Type\s*:$/i.test(V.clean(n.textContent)));
 if(outside.length!==1)throw Error('Cannot identify the RZone chart label. Refresh RZone and connect again.');
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
   const after=C.fields(main);if(JSON.stringify(after)!==JSON.stringify(before))throw Error('RZone settings changed while reading group choices: '+changedControls(before,after)+'. Review the source settings and connect again.');
  }
  }finally{observer.disconnect();}
 }
}
function configChanges(changes){
 if(changes===undefined)return {};
 if(!changes||typeof changes!=='object'||Array.isArray(changes)||Object.keys(changes).some(s=>!['momentum','execution'].includes(s)))throw Error('Unsupported setup choices.');
 const allowed={momentum:[0,3,35,37,39,41,43,45,47,49,55],execution:[0,3,4,5,6,8,10]};
 for(const [stage,values]of Object.entries(changes)){
  if(!values||typeof values!=='object'||Array.isArray(values))throw Error('Unsupported setup choices.');
  for(const [key,value]of Object.entries(values)){
   if(!/^\d+$/.test(key)||String(Number(key))!==key||!allowed[stage].includes(Number(key))||typeof value!=='string'||!value.length||value.length>200)throw Error('This setting needs a separate source adapter.');
   if((stage==='momentum'&&key==='0'||stage==='execution'&&key==='3')&&!['Candle','P&F','Renko'].includes(value))throw Error('This chart does not have a verified setup layout.');
   if(stage==='momentum'&&key==='3'&&value!=='NSE')throw Error('Automatic setup currently supports NSE. Other markets use a different source layout.');
  }
 }
 if(Object.values(changes).reduce((n,values)=>n+Object.keys(values).length,0)>1)throw Error('Refresh one source selector at a time.');
 return changes;
}
function sourceLayout(p,stage){try{if(stage==='marketFilter')return L.stage(stage,C.fields(p));const nodes=inputs(p),chart=V.clean(nodes[stage==='momentum'?0:3]?.selectedOptions?.[0]?.textContent);return stage==='momentum'?L.main(chart,nodes[chart==='Candle'?51:53]?.checked):stage==='execution'?L.execution(chart,V.clean(nodes[chart==='Candle'?4:8]?.selectedOptions?.[0]?.textContent)):null;}catch{return null;}}
const stageRows=(stage,p)=>sourceLayout(p,stage)?.rows||[];
const sourceParent=(p,stage,index)=>{const row=stageRows(stage,p).find(row=>row.parentIndex===index);return row?{gate:row.gateIndex,child:row.childIndex}:null;};
async function settledStage(p,stage,chart,until=Infinity){
 const deadline=Math.min(Date.now()+8000,until);let signature='',stableAt=Date.now();
 while(Date.now()<deadline){check();const nodes=inputs(p),layout=sourceLayout(p,stage),next=JSON.stringify(nodes.map(n=>[n.type,n.value,n.checked??null,n.disabled,n.tagName==='SELECT'?[...n.options].map(o=>[o.value,V.clean(o.textContent),o.disabled]):null]));if(next!==signature){signature=next;stableAt=Date.now();}if(layout?.chart===chart&&nodes.length===layout.count&&Date.now()-stableAt>=750){L.stage(stage,C.fields(p));return;}await delay(100);}
 throw Error('RZone did not finish changing its chart settings. Refresh the source before reconnecting.');
}
const selectedRules=new WeakMap();
const ruleSearch=node=>node?.tagName==='INPUT'&&node.type==='text'&&node.placeholder==='Search System Builder';
const ruleShape=node=>node?.tagName==='SELECT'?'select-one':ruleSearch(node)?'text':null;
async function settledOptions(p,index,changed,until=Infinity){
 const deadline=Math.min(Date.now()+10000,until),started=Date.now();let signature='',stableAt=Date.now();
 while(Date.now()<deadline){check();const n=inputs(p)[index],shape=ruleShape(n),next=shape==='select-one'?JSON.stringify([...n.options].map(o=>[o.value,V.clean(o.textContent),o.disabled])):shape==='text'?JSON.stringify([shape,n.placeholder,n.disabled]):'';
  if(next!==signature){signature=next;stableAt=Date.now();}
  // A search control has no preloaded catalogue. Its actual query response is
  // proved separately by searchRules, including when My/Public reuse one input.
  if((changed()||shape==='text')&&shape&&Date.now()-started>=750&&Date.now()-stableAt>=750)return;
  await delay(100);
 }
 throw Error('RZone did not finish loading the dependent choices. Try refreshing those choices again.');
}
async function selectValue(p,node,value,parent,until=Infinity){
 if(Date.now()>=until)throw Error('RZone strategy choices took too long to load. Refresh choices and try again.');
 let observer=null,refreshed=!parent;
 if(parent){const child=inputs(p)[parent.child];observer=new MutationObserver(records=>{if(records.some(r=>r.target===child||child?.contains(r.target)||[...r.removedNodes,...r.addedNodes].some(n=>n===child||n.contains?.(child))))refreshed=true;});observer.observe(p,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['value','label','disabled','placeholder']});}
 try{node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}));if(parent)await settledOptions(p,parent.child,()=>refreshed,until);}finally{observer?.disconnect();}
}
async function changeParents(p,changes,stage,until=Infinity){
 for(const [key,value]of Object.entries(changes||{})){
  const index=Number(key),fields=C.fields(p),layout=L.stage(stage,fields),f=fields[index],parent=sourceParent(p,stage,index);
  if(!layout?.refreshParents.includes(index))throw Error('This setting is not a refreshable selector in the current source layout.');
  if(index===layout.selectionIndex&&value!=='Price')throw Error('Only Price selection has a verified setup adapter.');
  if(!f||f.type!=='select-one')throw Error('Source setting layout changed.');
  if(f.value===value)continue;
  const restore=parent&&!C.fields(p)[parent.gate].checked;
  try{
   if(restore)await setField(p,parent.gate,{...C.fields(p)[parent.gate],checked:true},stage,until);
   await setField(p,index,{...f,value},stage,until);
  }finally{if(restore&&!interrupted&&C.visible(p))await setField(p,parent.gate,{...C.fields(p)[parent.gate],checked:false},stage);}
 }
}
const ruleRowName=row=>row.name;
const ruleRowIndices=row=>[row.parentIndex,row.childIndex,row.valueIndex,row.gateIndex].filter(Number.isInteger);
async function enabledRule(p,row,until=Infinity){
 await wait(()=>{const nodes=inputs(p);return nodes[row.gateIndex]?.checked&&[row.parentIndex,row.childIndex,row.valueIndex].filter(Number.isInteger).every(i=>nodes[i]&&!nodes[i].disabled);},Math.min(Date.now()+5000,until),'RZone did not enable the rule controls. Review its checkbox and refresh choices.');
}
function ruleFieldLabels(main,row,indices=ruleRowIndices(row)){
 const nodes=inputs(main),skip=new Set(['TABLE','INPUT','SELECT','TEXTAREA','BUTTON','SVG']);
 const stripped=node=>{const copy=node.cloneNode(false);for(const child of node.childNodes){if(child.nodeType===1){if(!skip.has(child.tagName.toUpperCase()))copy.appendChild(stripped(child));}else copy.appendChild(child.cloneNode(false));}return copy;};
 return indices.map(index=>{const node=nodes[index],contexts=[];for(let p=node.parentElement;p&&p!==main.parentElement;p=p.parentElement){if(p.tagName!=='TR')continue;const labels=[...p.children].map(cell=>{const copy=stripped(cell);return V.clean(copy.innerText||copy.textContent);}).filter(Boolean).join(' / ');if(labels)contexts.push(labels);if(contexts.length>=2)break;}return contexts.reverse().join(' → ')||node.getAttribute('aria-label')||node.placeholder||'Field '+(index+1);});
}
const observedRuleShape=(row,node,category)=>node?.tagName==='SELECT'?'select-one':row.name!=='Radar'&&['My','Public'].includes(category)&&ruleSearch(node)?'text':null;
function knownRule(main,row){const nodes=inputs(main),node=nodes[row.childIndex],known=selectedRules.get(node);return known&&known.value===node.value&&known.category===V.clean(nodes[row.parentIndex].selectedOptions[0]?.textContent)?known:null;}
function restorableRule(main,row){const node=inputs(main)[row.childIndex],known=knownRule(main,row);if(ruleSearch(node)&&node.value.trim()&&!known)throw Error('Finish or clear the '+ruleRowName(row)+' rule search in RZone before connecting. Vault cannot distinguish a selected rule from unfinished search text.');return known;}
function compactRuleChoices(choices){
 const found=new Map();
 for(const choice of choices){const previous=found.get(choice.label);if(previous)previous.disabled=true;else found.set(choice.label,choice);}
 return [...found.values()];
}
function strategyOptions(node,allowAmbiguous=true){
 if(node?.tagName!=='SELECT'||node.options.length>3000)throw Error('RZone strategy choices are unavailable or exceed 3,000 entries.');
 const labels=new Set(),choices=[...node.options].map(option=>{
  const label=V.clean(option.textContent);
  if(!label||label.length>2000||option.value.length>2000||!allowAmbiguous&&labels.has(label))throw Error('RZone strategy choices have missing or duplicate names. Review them before refreshing.');
  labels.add(label);return {value:label,label,sourceValue:option.value,disabled:option.disabled};
 });
 return compactRuleChoices(choices);
}
const noRules=menu=>[...menu.querySelectorAll('.gwt-HTML')].some(n=>C.visible(n)&&/^No matching system builder found\.?$/i.test(V.clean(n.textContent)));
function ruleMenu(container){
 const allowed=container!==C.main()&&[C.popup('Momentum Trading BackTest'),C.popup('Market Trend Filter')].includes(container)?container:null;
 const others=popups().filter(p=>p!==allowed),found=others.filter(p=>!V.clean(p.querySelector('.caption')?.textContent)&&([...p.querySelectorAll('.ind-list li[sbid]')].some(C.visible)||noRules(p)));
 const loading=p=>!V.clean(p.querySelector('.caption')?.textContent)&&p.querySelector('.ind-list')&&![...p.querySelectorAll('.ind-list li')].some(C.visible);
 if(found.length>1||others.some(p=>!found.includes(p)&&!loading(p)))throw Error('RZone opened an unexpected dialog while reading rules. Close it and refresh choices.');
 return found[0];
}
function ruleMenuChoices(menu){
 const rows=[...menu.querySelectorAll('.ind-list li[sbid]')].filter(C.visible);
 if(rows.length>3000)throw Error('RZone has more than 3,000 rule choices. Narrow the source rules before refreshing.');
 return compactRuleChoices(rows.map(row=>{const label=V.clean(row.textContent),id=row.getAttribute('sbid');if(!label||!id||label.length>2000||id.length>2000)throw Error('RZone rule choices are incomplete. Refresh choices and try again.');return {value:label,label,sourceValue:id,disabled:false};}));
}
function ruleOutside(main){
 if(main===C.popup('Market Trend Filter')){const title=main.querySelector('.caption');if(title&&C.visible(title)&&V.clean(title.textContent)==='Market Trend Filter')return title;throw Error('Cannot identify the Market Trend Filter heading.');}
 const row=inputs(main)[main===C.main()||main===C.popup('Market Trend Filter')?0:3]?.closest('tr'),outside=[...(row?.children||[])].filter(n=>n.tagName==='TD'&&C.visible(n)&&!n.children.length&&/^Chart Type\s*:$/i.test(V.clean(n.textContent)));
 if(outside.length!==1)throw Error('Cannot identify the RZone chart label. Refresh RZone and connect again.');return outside[0];
}
async function dismissRuleMenu(main,owned,until){
 if(![...owned].some(p=>p.isConnected&&C.visible(p)))return;
 ruleMenu(main);const outside=ruleOutside(main);outside.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));outside.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));ownClick(outside);
 const deadline=Math.min(Date.now()+5000,until);for(;;){check();if([...owned].every(p=>!p.isConnected||!C.visible(p)))return;if(Date.now()>=deadline)throw Error('RZone rule menu did not close. Close it before continuing.');await delay(100);}
}
function ruleQuery(node,value){
 const key=value?String(value).at(-1):'Backspace',keyCode=value?key.toUpperCase().charCodeAt(0):8;
 selectedRules.delete(node);
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new KeyboardEvent('keyup',{key,keyCode,which:keyCode,bubbles:true}));
}
async function searchRules(main,index,query,{choose=false,sourceValue=null,until=Infinity}={}){
 if(Date.now()>=until)throw Error('RZone rule search timed out before it could start. Refresh choices and try again.');
 const node=inputs(main)[index];if(!ruleSearch(node)||node.disabled)throw Error('The RZone system-builder search is unavailable.');
 if(popups().some(p=>p!==main))throw Error('Close the open RZone menu before reading rules.');
 const original=node.value,owned=new Set(),old=new Set(document.querySelectorAll('.popupContent')),changed=new Set();let signature='',stableAt=Date.now(),observed=false;
 const observer=new MutationObserver(records=>{for(const p of document.querySelectorAll('.popupContent'))if(records.some(r=>r.target===p||p.contains(r.target))){changed.add(p);if(owned.has(p))stableAt=Date.now();}});observer.observe(document.body,{childList:true,subtree:true,characterData:true});
 try{
  node.focus();ownClick(node);ruleQuery(node,query);
  const deadline=Math.min(Date.now()+10000,until);let choices,menu;
  while(Date.now()<deadline){
   check();if(inputs(main)[index]!==node||node.value!==query)throw Error('The RZone rule search changed while reading choices.');
   menu=ruleMenu(main);if(menu){if(!owned.has(menu)&&(!old.has(menu)||changed.has(menu))){owned.add(menu);stableAt=Date.now();observed=true;}
    const read=ruleMenuChoices(menu),next=JSON.stringify(read);if(next!==signature){signature=next;stableAt=Date.now();}
    if(observed&&(read.length||noRules(menu))&&Date.now()-stableAt>=750){choices=read;break;}
   }await delay(100);
  }
  if(!choices){failed=true;throw Error('RZone did not finish loading its system-builder choices. Refresh RZone before reconnecting.');}
  if(choose){const matches=[...menu.querySelectorAll('.ind-list li[sbid]')].filter(n=>C.visible(n)&&V.clean(n.textContent)===query&&(sourceValue===null||n.getAttribute('sbid')===sourceValue));if(matches.length!==1)throw Error(matches.length?'The rule name matches more than one RZone choice. Choose a unique rule.':'RZone did not confirm that rule. Choose an available rule.');const id=matches[0].getAttribute('sbid');ownClick(matches[0]);await delay(150);if(V.clean(node.value)!==query)throw Error('RZone selected a different rule.');const row=stageRows(containerStage(main),main).find(r=>r.childIndex===index);selectedRules.set(node,{value:query,sbid:id,category:V.clean(inputs(main)[row.parentIndex].selectedOptions[0]?.textContent)});}
  return choices;
 }finally{
  observer.disconnect();if(!interrupted&&node.isConnected){if(!choose)Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,original);await dismissRuleMenu(main,owned,Math.max(Date.now()+1000,until));node.blur();}
 }
}
function unchangedOutsideRow(main,before,row){
 const nodes=inputs(main),expected=before.map(field=>({...field}));
 if(nodes.length!==before.length)throw Error('RZone settings layout changed while reading strategy choices.');
 // The full labelled snapshot is checked again after restoring this row.
 // During its requests, read native values directly instead of repeatedly
 // cloning every source table and its potentially thousands of rule options.
 const current=nodes.map((node,index)=>nodeField(node,before[index]));
 for(const index of ruleRowIndices(row)){
  const actual=current[index];expected[index]={...expected[index],value:actual.value,checked:actual.checked,disabled:actual.disabled,...(index===row.childIndex&&ruleShape(nodes[index])?{type:actual.type}:{})};
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
  for(const [index,value]of [[row.childIndex,original.ruleValue],...(Number.isInteger(row.valueIndex)?[[row.valueIndex,original.timeframeValue]]:[])]){
   check();nodes=inputs(main);const node=nodes[index];
   if(index===row.childIndex&&ruleSearch(node)){if(value!==''){if(!original.selection)throw Error('The original source search was not confirmed.');original.restoreChoices=await searchRules(main,index,value,{choose:true,sourceValue:original.selection.sbid,until:deadline});}else Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,'');continue;}
   if(index===row.valueIndex&&node.tagName==='INPUT'&&row.companionType==='number'){if(node.value!==value){setText(node,value);node.blur();await delay(150);}continue;}
   if(node.value===value&&V.clean(node.selectedOptions[0]?.textContent)===snapshot[index].value)continue;
   if(![...node.options].some(o=>o.value===value&&V.clean(o.textContent)===snapshot[index].value))throw Error('The original selected rule or timeframe is no longer available.');
   await selectValue(main,node,value,null,deadline);await delay(150);
  }
 }catch(error){restoreError=error;}
 finally{
  if(!interrupted&&main.isConnected&&C.visible(main)){
   const gate=inputs(main)[row.gateIndex];if(gate?.type==='checkbox'&&gate.checked!==original.enabled){ownClick(gate);await delay(150);}
  }
 }
 if(restoreError)throw Error('RZone strategy settings could not be restored: '+restoreError.message+' Review the source before reconnecting.');
 const restored=C.fields(main);
 if(JSON.stringify(restored)!==JSON.stringify(snapshot))throw Error('RZone strategy settings changed during discovery. Review the source before reconnecting.');
 return restored;
}
async function strategyCatalogues(main,deadline,stage='momentum',shared=null,onlyNames=null){
 const catalogues={};let snapshot=C.fields(main);const layout=L.stage(stage,snapshot);
 for(const row of layout.rows){
  if(onlyNames&&!onlyNames.includes(row.name))continue;
  check();if(Date.now()>=deadline)throw Error('RZone strategy choices took too long to load. Refresh choices and try again.');
  const nodes=inputs(main),parent=nodes[row.parentIndex],child=nodes[row.childIndex],gate=nodes[row.gateIndex],timeframe=nodes[row.valueIndex];
  if(snapshot.length!==layout.count||parent?.tagName!=='SELECT'||!observedRuleShape(row,child,V.clean(parent.selectedOptions[0]?.textContent))||Number.isInteger(row.valueIndex)&&!(row.companionType==='number'?timeframe?.tagName==='INPUT'&&timeframe.type==='text':timeframe?.tagName==='SELECT')||gate?.type!=='checkbox'||gate.disabled)throw Error('RZone strategy layout changed. Refresh RZone and connect again.');
  const selection=restorableRule(main,row);
  const offered=strategyOptions(parent,false).filter(o=>!o.disabled&&['Pre','My','Public','Popular'].includes(o.value));
  const selected=V.clean(parent.selectedOptions[0]?.textContent);
  if(!offered.some(o=>o.value===selected))throw Error('The selected RZone strategy category is not available for automatic discovery.');
  const original={parentValue:parent.value,ruleValue:child.value,timeframeValue:timeframe?.value,enabled:gate.checked,selection},categories={},controlTypes={},fieldLabels={},searchQueries={};let reading=selected;
  // On the observed source STR3 sits inside STR2's table row. Prove that
  // exact ancestor prefix for every offered category before publishing it.
  const possible=layout.labelDependents?.[row.childIndex]||[],dependents=possible.every(i=>snapshot[i].label.startsWith(snapshot[row.parentIndex].label+' → '))?possible:[];
  // Shared menus contain only source-wide native Pre/Popular choices. Private
  // Radar My menus and My/Public search shapes are always freshly observed in
  // a new document; no account identity is inferred from the avatar or group.
  const seed=shared?.ruleCatalogues?.[row.childIndex],reused=new Set();
  if(seed&&jsonSame(seed.labelDependents||[],dependents))for(const category of ['Pre','Popular']){
   if(offered.some(o=>o.value===category)&&Array.isArray(seed.categories?.[category])&&seed.controlTypes?.[category]==='select-one'&&Array.isArray(seed.fieldLabels?.[category])){
    categories[category]=structuredClone(seed.categories[category]);controlTypes[category]='select-one';fieldLabels[category]=structuredClone(seed.fieldLabels[category]);reused.add(category);
   }
  }
  try{
   if(!gate.checked){ownClick(gate);await delay(150);await enabledRule(main,row,deadline);await settledOptions(main,row.childIndex,()=>true,deadline);}
   if(inputs(main)[row.parentIndex].value!==original.parentValue)await selectValue(main,inputs(main)[row.parentIndex],original.parentValue,{gate:row.gateIndex,child:row.childIndex},deadline);
   const initialChild=inputs(main)[row.childIndex],initialAnchor=initialChild.tagName==='SELECT'&&initialChild.options.length?offered.find(o=>o.value===selected):null;
   if(categories[selected]&&(!jsonSame(categories[selected],strategyOptions(initialChild))||!jsonSame(fieldLabels[selected],ruleFieldLabels(main,row)))){for(const category of Object.keys(categories)){delete categories[category];delete controlTypes[category];delete fieldLabels[category];}reused.clear();}
   const ordered=['Pre','Popular','My','Public'].map(name=>offered.find(option=>option.value===name)).filter(Boolean);
   for(const category of [...ordered.filter(o=>o.value!==selected),...ordered.filter(o=>o.value===selected)]){
    if(reused.has(category.value))continue;
    reading=category.value;
    check();unchangedOutsideRow(main,snapshot,row);
    if(Date.now()>=deadline)throw Error('RZone strategy choices took too long to load. Refresh choices and try again.');
    const current=inputs(main),categoryNode=current[row.parentIndex];
    if(!current[row.gateIndex].checked||categoryNode.disabled||current[row.childIndex].disabled)throw Error('RZone did not enable the strategy choices. Review its strategy checkbox and reconnect.');
    // Empty -> empty can produce no DOM mutation at all. Visit a known
    // populated category first, so clearing its options is a fresh, observable
    // empty response rather than an assumed completion of a pending request.
    if(current[row.childIndex].tagName==='SELECT'&&!current[row.childIndex].options.length&&categoryNode.value!==category.sourceValue&&!categories[category.value]?.length&&initialAnchor?.value!==category.value){
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
    const child=inputs(main)[row.childIndex],shape=observedRuleShape(row,child,category.value);if(!shape)throw Error('The rule control changed to an unsupported layout.');
    controlTypes[category.value]=shape;categories[category.value]=shape==='text'?[]:strategyOptions(child);fieldLabels[category.value]=ruleFieldLabels(main,row);
    if(dependents.length){const labels=ruleFieldLabels(main,row,dependents),prefix=fieldLabels[category.value][0]+' → ',oldPrefix=snapshot[row.parentIndex].label+' → ';if(dependents.some((index,i)=>labels[i]!==prefix+snapshot[index].label.slice(oldPrefix.length)))throw Error('The dependent strategy labels changed unexpectedly. Refresh choices.');}
   }
  }catch(error){throw Error(ruleRowName(row)+' / '+reading+': '+error.message);
  }finally{if(!interrupted)snapshot=await restoreStrategyRow(main,row,snapshot,original);}
  if(original.restoreChoices){categories[selected]=original.restoreChoices;searchQueries[selected]=original.ruleValue;}
  catalogues[row.childIndex]={parentIndex:row.parentIndex,gateIndex:row.gateIndex,categories,controlTypes,fieldLabels,searchQueries,...(dependents.length?{labelDependents:dependents}:{})};
 }
 return catalogues;
}
function choiceContext(stage,descriptor){
 const layout=L.stage(stage,descriptor.fields),fields=descriptor.fields;
 const benchmarkMarkets=symbolIndices(layout).map(index=>[index-1,fields[index-1].value]);
 if(stage==='marketFilter')return {chart:layout.chart,mode:fields[layout.rsModeIndex].checked?'RS':'Index',action:fields[layout.actionIndex].value,...(Number.isInteger(layout.modeIndex)?{brickMode:fields[layout.modeIndex].value}:{}),...(Number.isInteger(layout.exitModeIndex)?{exitBrickMode:fields[layout.exitModeIndex].value}:{}),categories:layout.rows.map(row=>[row.parentIndex,fields[row.parentIndex].value]),benchmarkMarkets};
 return {chart:layout.chart,...(stage==='momentum'?{market:fields[layout.marketIndex].value,relativeStrength:layout.relativeStrength}:{selection:fields[layout.selectionIndex].value}),...(Number.isInteger(layout.modeIndex)?{mode:fields[layout.modeIndex].value}:{}),categories:layout.rows.map(row=>[row.parentIndex,fields[row.parentIndex].value]),...(benchmarkMarkets.length?{benchmarkMarkets}:{})};
}
const choiceSignature=descriptor=>descriptor.fields.map(field=>[field.type,field.label]);
// Storage and extension messages may reorder object keys; array order and values remain significant.
const canonicalJson=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const jsonSame=(a,b)=>canonicalJson(a)===canonicalJson(b);
// Native dropdown order is not a change to the offered identities. Keep
// duplicate counts, disabled flags and source IDs significant.
const menuSame=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&jsonSame(a.map(canonicalJson).sort(),b.map(canonicalJson).sort());
const inactiveChoice=(layout,fields,index)=>fields[index]?.disabled&&layout.gates.some(([gate,...children])=>children.includes(Number(index))&&!fields[gate].checked);
function reuseInactiveChoices(stage,descriptor,cached){
 if(!cached||cached.publicOnly)return;
 const layout=L.stage(stage,descriptor.fields);
 for(const [index,options]of Object.entries(cached.nativeOptions))if(inactiveChoice(layout,descriptor.fields,index))descriptor.options[index]=structuredClone(options);
}
function choiceStageCache(stage,descriptor){
 const catalogues=structuredClone(descriptor.ruleCatalogues);
 const symbols=new Set(symbolIndices(L.stage(stage,descriptor.fields)).map(String));
 return {context:choiceContext(stage,descriptor),signature:choiceSignature(descriptor),nativeOptions:Object.fromEntries(Object.entries(descriptor.options).filter(([index])=>descriptor.fields[index]?.type==='select-one')),ruleCatalogues:catalogues,...(stage==='momentum'?{groupOptions:descriptor.options[1]}:{}),...(symbols.size?{symbolOptions:Object.fromEntries(Object.entries(descriptor.options).filter(([index])=>symbols.has(index))),symbolQueries:structuredClone(descriptor.symbolQueries||{})}:{})};
}
const rememberedChoices=(previous,current)=>compactRuleChoices([...new Map([...(previous||[]),...current].map(option=>[JSON.stringify([option.label,option.sourceValue,option.market]),structuredClone(option)])).values()]);
function rememberedSymbols(previous,current,market){
 const choices=window.VaultSetup.mergeSymbolChoices(previous,current,market),fresh=new Set(current.map(option=>JSON.stringify([option.market,option.sourceValue])));
 // Resolve same-name ambiguity within the selected market before bounding
 // accumulated history, keeping every choice from the current native read.
 return [...choices.filter(option=>!fresh.has(JSON.stringify([option.market,option.sourceValue]))),...choices.filter(option=>fresh.has(JSON.stringify([option.market,option.sourceValue])))].slice(-3000);
}
function symbolsForControl(p,index,choices){
 const markets=new Set([...inputs(p)[index-1].options].filter(option=>!option.disabled).map(option=>V.clean(option.textContent)));
 return choices.filter(option=>markets.has(option.market));
}
function knownSymbols(records=[],extra=[],force=false){
 if(force)return [];
 const choices=[];
 for(const record of records)if(record?.schemaVersion===2&&record.adapterVersion===L.version&&(record.daily===true&&!Object.hasOwn(record,'session')||record.session===session))for(const stage of Object.values(record.stages||{}))for(const options of Object.values(stage.symbolOptions||{}))if(Array.isArray(options))choices.push(...options);
 if(currentChoiceDay())for(const stage of ['momentum','execution','marketFilter']){const base=lastConfig.stages[stage];if(base)for(const descriptor of stage==='momentum'?[base,base.relativeStrength,base.withoutRelativeStrength]:[base])if(descriptor)for(const index of symbolIndices(L.stage(stage,descriptor.fields)))choices.push(...(descriptor.options[index]||[]));}
 return [...choices,...extra];
}
function dailyStage(stage,descriptor,cached){
 const layout=L.stage(stage,descriptor.fields),context=choiceContext(stage,descriptor),withoutCategories=value=>Object.fromEntries(Object.entries(value).filter(([key])=>key!=='categories'&&!(value.chart==='P&F'&&(stage==='marketFilter'?['brickMode','exitBrickMode']:['mode']).includes(key))).sort(([a],[b])=>a.localeCompare(b)));
 if(!jsonSame(withoutCategories(cached.context),withoutCategories(context)))return null;
 try{
  if(cached.signature.length!==descriptor.fields.length)throw Error('signature');
  // RZone leaves mounted RS controls and portfolio help in hidden ancestor
  // rows after those panels are visited. They change captured text, not the
  // visible control or its menu. Normalize only these observed decorations
  // for cache matching; retain the source's raw labels in the returned form.
  const help=' / iThis feature can help you to look at combined result of the group of stocks you have backtested. It assumes equal amount of allocation in all stocks and calculates the total performance of the stocks in the group. The average return, hit ratio and risk-reward ratio is calculated on all stocks put together gives idea about the performance of systems tested on group of stocks. For equity curve & drawdown, progressive P&L is calculated on the allocated amount.';
  const stableLabel=(label,index)=>{
   if(stage!=='momentum')return label;
   const strategyRows=layout.rows.slice(1,4);
   if(strategyRows.slice(1).some(row=>ruleRowIndices(row).includes(index)))label=label.split(help).join('');
   if(index===layout.rsIndex&&!layout.relativeStrength)label=label.replace(/^(Relative Strength\s*:)\s*\/\s*(?:All|NSE|BSE|MF|EQW)$/,'$1');
   if(layout.variant&&[layout.sizeIndex,layout.modeIndex].includes(index))label=label.replace(/^RS SB : \/ (?:Pre|My|Public|Popular)i → /,'');
   return label;
  };
  cached=structuredClone(cached);
  cached.signature.forEach((entry,index)=>{entry[1]=stableLabel(entry[1],index);});
  for(const row of layout.rows)for(const labels of Object.values(cached.ruleCatalogues[row.childIndex]?.fieldLabels||{}))ruleRowIndices(row).forEach((index,n)=>{labels[n]=stableLabel(labels[n],index);});
  const base=descriptor.fields.map((field,index)=>({...field,type:cached.signature[index][0],label:cached.signature[index][1]}));
  for(const [index,value]of cached.context.categories)base[index].value=value;
  const labels=window.VaultSetup.projectRuleLabels(base,cached.ruleCatalogues,descriptor.fields,stage),children=new Set(layout.rows.map(row=>String(row.childIndex)));
  const native=Object.fromEntries(Object.entries(descriptor.options).filter(([index])=>descriptor.fields[index]?.type==='select-one'&&!children.has(index)));
  for(const [index,options]of Object.entries(native))if(!inactiveChoice(layout,descriptor.fields,index)&&!menuSame(options,cached.nativeOptions[index]))throw Error('available dropdown identities');
  const copy=structuredClone(cached);
  for(const row of layout.rows){const catalogue=copy.ruleCatalogues[row.childIndex],category=descriptor.fields[row.parentIndex].value;
   if(!catalogue||catalogue.parentIndex!==row.parentIndex||catalogue.gateIndex!==row.gateIndex||!Array.isArray(catalogue.categories?.[category])||catalogue.controlTypes?.[category]!==descriptor.fields[row.childIndex].type)throw Error('category');
   base[row.childIndex].type=catalogue.controlTypes[category];
   if(!descriptor.fields[row.childIndex].disabled&&base[row.childIndex].type==='select-one'&&!menuSame(catalogue.categories[category],compactRuleChoices(structuredClone(descriptor.options[row.childIndex]||[]))))throw Error('available rule identities');
  }
  if(base.some((field,index)=>field.type!==descriptor.fields[index].type||labels[index]!==stableLabel(descriptor.fields[index].label,index)))throw Error('layout');
  for(const owner of Object.values(copy.ruleCatalogues))if(owner.labelDependents){const before=base[owner.parentIndex].label+' → ',after=labels[owner.parentIndex]+' → ';
   for(const row of layout.rows){const indices=ruleRowIndices(row),catalogue=copy.ruleCatalogues[row.childIndex];for(const observed of Object.values(catalogue.fieldLabels||{}))indices.forEach((index,n)=>{if(owner.labelDependents.includes(index)){if(!observed[n].startsWith(before))throw Error('dependent labels');observed[n]=after+observed[n].slice(before.length);}});}
  }
  // Category labels must still match raw capture evidence, including the
  // STR2 ancestor of STR3. Restore help only in its observed context segment.
  if(stage==='momentum')for(const row of layout.rows.slice(2,4))for(const observed of Object.values(copy.ruleCatalogues[row.childIndex].fieldLabels||{}))ruleRowIndices(row).forEach((index,n)=>{
   const current=descriptor.fields[index].label.split(' → '),parts=observed[n].split(' → ');
   current.forEach((part,i)=>{if(part.includes(help)){if(parts[i]===undefined)throw Error('dependent labels');parts[i]+=help;}});observed[n]=parts.join(' → ');
  });
  if(stage==='momentum'&&(!Array.isArray(copy.groupOptions)||descriptor.fields[1].value&&!copy.groupOptions.some(option=>!option.disabled&&option.label===descriptor.fields[1].value)))throw Error('group');
  return copy;
 }catch(error){throw Error(error.message);}
}
function cachedStage(stage,descriptor,records,force){
 if(force||!Array.isArray(records))return null;
 const layout=L.stage(stage,descriptor.fields),mismatches=[];
 for(const record of records.slice(-128).reverse()){
  if(record?.schemaVersion===2&&record.adapterVersion===L.version&&(record.daily===true&&!Object.hasOwn(record,'session')||record.session===session)&&record.stages?.[stage]){try{const hit=dailyStage(stage,descriptor,record.stages[stage]);if(hit)return hit;}catch(error){mismatches.push(error.message);}continue;}
  if(layout.rows.some(row=>descriptor.fields[row.childIndex].type==='text'&&descriptor.fields[row.childIndex].value.trim()))continue;
  const shared=record?.publicOnly===true,cached=record?.stages?.[stage];if(record?.schemaVersion!==1||record.adapterVersion!==L.version||(!shared&&record.session!==session)||shared&&Object.hasOwn(record,'session')||!cached||!jsonSame(cached.context,choiceContext(stage,descriptor))||!jsonSame(cached.signature,choiceSignature(descriptor)))continue;
  const childIndices=new Set(layout.rows.map(row=>String(row.childIndex)));
  if(!jsonSame(cached.nativeOptions,Object.fromEntries(Object.entries(descriptor.options).filter(([index])=>descriptor.fields[index]?.type==='select-one'&&(!shared||!childIndices.has(index))))))continue;
  if(stage==='momentum'&&(shared?Object.hasOwn(cached,'groupOptions'):!Array.isArray(cached.groupOptions)||descriptor.fields[1].value&&!cached.groupOptions.some(option=>!option.disabled&&option.label===descriptor.fields[1].value)))continue;
  const rows=Object.keys(cached.ruleCatalogues||{});if(!jsonSame(rows.sort(),layout.rows.map(row=>String(row.childIndex)).sort()))continue;
  try{
   for(const row of layout.rows){const catalogue=cached.ruleCatalogues[row.childIndex],category=descriptor.fields[row.parentIndex].value;if(catalogue.parentIndex!==row.parentIndex||catalogue.gateIndex!==row.gateIndex)throw Error('Invalid cached category.');if(shared){if(Object.hasOwn(catalogue,'searchQueries')||Object.keys(catalogue.categories||{}).some(key=>!['Pre','Popular'].includes(key)||catalogue.controlTypes?.[key]!=='select-one'||!Array.isArray(catalogue.categories[key])))throw Error('Private choices cannot cross documents.');if(catalogue.categories?.[category]&&!jsonSame(catalogue.categories[category],compactRuleChoices(structuredClone(descriptor.options[row.childIndex]||[]))))throw Error('Shared choices changed.');}else if(!Array.isArray(catalogue.categories?.[category])||catalogue.controlTypes?.[category]!==descriptor.fields[row.childIndex].type)throw Error('Invalid cached category.');if(catalogue.fieldLabels?.[category]&&!jsonSame(catalogue.fieldLabels[category],ruleRowIndices(row).map(index=>descriptor.fields[index].label)))throw Error('Cached labels changed.');}
   return {...structuredClone(cached),publicOnly:shared};
  }catch{/* A cache mismatch falls back to current source discovery. */}
 }
 if(mismatches.length)throw Error('Vault could not match the current '+(stage==='momentum'?'main':stage==='execution'?'exit':'Market Trend Filter')+' form to today’s saved choices ('+[...new Set(mismatches)].join(', ')+'). Saved choices are kept. Use Recheck all choices only if you want to replace them.');
 return null;
}
function cachedGroups(descriptor,records,force){
 if(force)return null;
 const value=descriptor.fields[1].value;
 for(const record of (records||[]).slice().reverse())if(record?.schemaVersion===2&&record.adapterVersion===L.version&&(record.daily===true||record.session===session)){
  const stage=record.stages?.momentum;
  if(stage?.context.market===descriptor.fields[3].value&&Array.isArray(stage.groupOptions)&&(!value||stage.groupOptions.some(option=>!option.disabled&&option.label===value)))return structuredClone(stage.groupOptions);
 }
 return null;
}
function restorableStage(p,stage){
 const fields=C.fields(p),layout=L.stage(stage,fields),nodes=inputs(p),selections={};
 for(const row of layout.rows)selections[row.childIndex]=restorableRule(p,row);
 for(const indices of [layout.priceIndices||[],layout.signalIndices||[]])if(indices.length&&indices.filter(index=>fields[index].checked).length!==1)throw Error('Choose one '+(indices===layout.priceIndices?'price':'signal')+' option in RZone before loading other chart choices. Your current settings were left intact.');
 return {fields,nativeValues:nodes.map(node=>node.value),selections};
}
async function restoreStage(p,stage,snapshot,until){
 const original=L.stage(stage,snapshot.fields),expired=()=>{check();if(Date.now()>=until)throw Error('RZone settings could not be restored before the connection deadline. Review the source before reconnecting.');};
 expired();if(jsonSame(C.fields(p),snapshot.fields)&&jsonSame(inputs(p).map(node=>node.value),snapshot.nativeValues))return;
 await transitionLayout(p,snapshot.fields,stage,until);
 expired();let nodes=inputs(p),layout=sourceLayout(p,stage);
 if(layout?.chart!==original.chart){await setField(p,layout.chartIndex,{...C.fields(p)[layout.chartIndex],value:original.chart},stage,until);expired();}
 for(const index of [original.modeIndex,original.exitModeIndex].filter(Number.isInteger))if(C.fields(p)[index].value!==snapshot.fields[index].value){await setField(p,index,snapshot.fields[index],stage,until);expired();}
 if(stage==='marketFilter'){await retainedMarketFields(p,snapshot.fields,undefined,until);expired();}
 // Restore the source's exact categories before resolving rules or values.
 for(const row of original.rows){
  expired();nodes=inputs(p);if(!nodes[row.gateIndex].checked){ownClick(nodes[row.gateIndex]);await enabledRule(p,row,until);await settledOptions(p,row.childIndex,()=>true,until);}
  if(nodes[row.parentIndex].value!==snapshot.nativeValues[row.parentIndex])await selectValue(p,nodes[row.parentIndex],snapshot.nativeValues[row.parentIndex],{gate:row.gateIndex,child:row.childIndex},until);
 }
 for(const [gate]of original.gates){expired();nodes=inputs(p);if(!nodes[gate].checked){ownClick(nodes[gate]);await delay(150);}}
 if(stage==='marketFilter')for(let n=0;n<original.methodIndices.length;n++){const value=original.methodValueIndices[n];if(inputs(p)[value].value!==snapshot.fields[value].value){ownClick(inputs(p)[original.methodIndices[n]]);await delay(150);await setField(p,value,{...snapshot.fields[value],disabled:false},stage,until);}}
 const gates=new Set(original.gates.map(([gate])=>gate)),parentIndices=new Set(original.rows.map(row=>row.parentIndex));
 for(const field of snapshot.fields){
  expired();if(gates.has(field.index)||parentIndices.has(field.index)||field.index===original.chartIndex||field.index===original.modeIndex)continue;
  nodes=inputs(p);const node=nodes[field.index],row=original.rows.find(row=>row.childIndex===field.index);
  if(row&&ruleSearch(node)&&field.value.trim()){const selection=snapshot.selections[field.index];if(!selection)throw Error('The original rule selection cannot be restored safely.');await searchRules(p,field.index,field.value,{choose:true,sourceValue:selection.sbid,until});}
  else if(node?.tagName==='SELECT'){
   const native=snapshot.nativeValues[field.index],option=[...node.options].filter(option=>option.value===native&&V.clean(option.textContent)===field.value);if(option.length!==1&&field.value!=='')throw Error('An original source choice is no longer available.');if(node.value!==native){await selectValue(p,node,native,null,until);await delay(150);}
  }else if(stage==='momentum'&&field.index===1){if(node.value!==field.value)throw Error('The chart switch changed the source group. Review its selection before reconnecting.');continue;}
  else if(symbolIndices(original).includes(field.index)){if(node.value!==field.value){if(node.disabled)throw Error('The original benchmark could not be restored.');if(field.value.trim())await searchSymbols(p,field.index,field.value,{choose:true,market:snapshot.fields[field.index-1].value,until});else Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,'');}}
  else await setField(p,field.index,{...field,disabled:false},stage,until);
 }
 for(const [gate]of [...original.gates].reverse()){expired();const node=inputs(p)[gate];if(node.checked!==snapshot.fields[gate].checked){ownClick(node);await delay(150);}}
 expired();const restored=C.fields(p);E.verify(snapshot.fields,restored);if(!jsonSame(snapshot.fields,restored))throw Error('RZone settings availability changed during chart restoration. Review the source before reconnecting.');
}
async function openMarketFilter(until){
 const layout=L.stage('momentum',C.fields(C.main()));if(!inputs(C.main())[layout.mtfIndex].checked){ownClick(inputs(C.main())[layout.mtfIndex]);await delay(150);}
 ownClick(button(C.main(),/^Market Trend Filter$/i));return C.popup('Market Trend Filter')||await wait(()=>C.popup('Market Trend Filter'),Math.min(Date.now()+10000,until),'Market Trend Filter did not open.');
}
async function benchmarkChoices(p,stage,until,cached,cachedLayout,known=[]){
 const out={options:{},symbolQueries:{}},layout=L.stage(stage,C.fields(p));
 for(const index of symbolIndices(layout)){const node=inputs(p)[index];if(node.disabled)continue;const query=node.value,market=V.clean(inputs(p)[index-1].selectedOptions[0]?.textContent),role=['benchmarkIndex','indexSymbolIndex','numeratorSymbolIndex','denominatorSymbolIndex'].find(key=>layout[key]===index),cachedIndex=cachedLayout?cachedLayout[role]:index,choices=rememberedSymbols(symbolsForControl(p,index,[...known,...Object.values(out.options).flat()]),symbolsForControl(p,index,cached?.symbolOptions?.[cachedIndex]||[]),market);
  const fresh=!query.trim()||choices.some(option=>!option.disabled&&option.sourceValue&&option.label===query)?[]:await searchSymbols(p,index,query,{market,until});out.options[index]=rememberedSymbols(choices,fresh,market);if(query.trim())out.symbolQueries[index]={market,query};}
 return out;
}
function mergeBenchmarks(d,proof){d.options={...d.options,...proof.options};d.symbolQueries={...d.symbolQueries,...proof.symbolQueries};return d;}
async function filterConfiguration(requestedChanges,request={}){
 if(active||configuring||failed)throw Error('RZone is busy or needs review. Finish its current work first.');
 const feature=request.loadFilter||(requestedChanges?.momentum?'relativeStrength':'marketFilter'),changes=requestedChanges||{};
 if(!['relativeStrength','marketFilter'].includes(feature)||Object.keys(changes).some(key=>key!=='marketFilter'&&key!=='momentum')||Object.values(changes).reduce((n,v)=>n+Object.keys(v).length,0)>1)throw Error('Load one optional filter at a time.');
 if(!lastConfig)throw Error('Connect RZone before loading filter choices.');
 if(!currentChoiceDay())throw Error('A new day has started. Connect RZone again to update today’s choices.');
 checkOptionalDay(request.forceChoices===true);const records=request.forceChoices?[]:[...optionalMenus,...(request.cachedChoices||[])],symbols=knownSymbols(records,request.cachedSymbols||[],request.forceChoices===true);configuring=true;interrupted=false;const started=Date.now(),until=started+42000;let p,snapshot,relativeSnapshot,originalMain,result,reusedChoices=false,choiceCache;
 try{
  await prepare();await settledMain();originalMain=restorableStage(C.main(),'momentum');
  const base=lastConfig.stages.momentum;if(!jsonSame(originalMain.fields,base.fields))throw Error('RZone settings changed. Connect again before loading this filter.');
  const config=structuredClone(lastConfig);C.status('Reading '+(feature==='relativeStrength'?'Relative Strength':'Market Trend Filter')+' settings…');
  if(feature==='relativeStrength'){
   const off=L.main(base.fields[0].value),wasOn=originalMain.fields[off.rsIndex].checked;
   if(wasOn){await setField(C.main(),off.rsIndex,{...originalMain.fields[off.rsIndex],checked:false},'momentum',until);}
   const without={...descriptor(C.main()),supportedMarkets:['NSE'],ruleCatalogues:Object.fromEntries(Object.entries(base.ruleCatalogues||{}).filter(([key])=>Number(key)!==L.main(off.chart,true).rows.at(-1).childIndex))};without.options[1]=structuredClone(base.options[1]);
   await setField(C.main(),off.rsIndex,{...C.fields(C.main())[off.rsIndex],checked:true},'momentum',until);
   relativeSnapshot=restorableStage(C.main(),'momentum');
   for(const [raw,value]of Object.entries(changes.momentum||{})){const index=Number(raw),layout=L.stage('momentum',C.fields(C.main()));if(![layout.benchmarkMarketIndex,layout.rows.at(-1).parentIndex].includes(index)||typeof value!=='string'||!value||value.length>200)throw Error('This Relative Strength selector cannot refresh the source.');await setField(C.main(),index,{...C.fields(C.main())[index],value},'momentum',until);}
   const relative={...descriptor(C.main()),supportedMarkets:['NSE']};relative.options[1]=structuredClone(base.options[1]);const previous=cachedStage('momentum',relative,records,request.forceChoices===true);reuseInactiveChoices('momentum',relative,previous);reusedChoices=!!previous;relative.ruleCatalogues=previous?previous.ruleCatalogues:{...without.ruleCatalogues,...await strategyCatalogues(C.main(),until,'momentum',null,['Relative Strength'])};
   for(const [child,c]of Object.entries(relative.ruleCatalogues))relative.options[child]=c.categories[relative.fields[c.parentIndex].value];
   mergeBenchmarks(relative,await benchmarkChoices(C.main(),'momentum',until,previous,undefined,symbols));
   choiceCache={schemaVersion:2,adapterVersion:L.version,session,stages:{momentum:choiceStageCache('momentum',relative)}};optionalMenus.push(choiceCache);if(optionalMenus.length>128)optionalMenus.shift();
   config.stages.momentum.relativeStrength=relative;config.stages.momentum.withoutRelativeStrength=without;
  }else{
   p=await openMarketFilter(until);snapshot=restorableStage(p,'marketFilter');let layout=L.stage('marketFilter',snapshot.fields);
   const values=changes.marketFilter||{};
   // Source inspection restores the user's dialog. Subsequent editor changes
   // must start from the previously observed chart and both brick contexts,
   // not silently fall back to the restored source's construction modes.
   if(Object.keys(values).length&&lastConfig.stages.marketFilter){
    const previous=lastConfig.stages.marketFilter.fields;await transitionLayout(p,previous,'marketFilter',until);layout=L.stage('marketFilter',C.fields(p));const previousLayout=L.stage('marketFilter',previous);
    for(const key of ['modeIndex','exitModeIndex'])if(Number.isInteger(layout[key])&&Number.isInteger(previousLayout[key]))await setField(p,layout[key],{...C.fields(p)[layout[key]],value:previous[previousLayout[key]].value},'marketFilter',until);
   }
   for(const [raw,value]of Object.entries(values)){
    let index=Number(raw);const prior=lastConfig.stages.marketFilter&&L.stage('marketFilter',lastConfig.stages.marketFilter.fields),exitParent=prior?.rows[0]?.parentIndex===index,semantic=prior&&['chartIndex','modeIndex','indexMarketIndex','numeratorMarketIndex','denominatorMarketIndex','exitModeIndex'].find(key=>prior[key]===index);
    if((exitParent||semantic==='exitModeIndex')&&!layout.hasExit){await setField(p,layout.actionIndex,{...C.fields(p)[layout.actionIndex],value:L.marketActions[2]},'marketFilter',until);await settledStage(p,'marketFilter',layout.chart,until);layout=L.stage('marketFilter',C.fields(p));}
    if(exitParent)index=layout.rows[0].parentIndex;else if(semantic&&Number.isInteger(layout[semantic]))index=layout[semantic];if(!/^\d+$/.test(raw)||typeof value!=='string'||!value||value.length>200||!layout.refreshParents.includes(index))throw Error('This market trend selector cannot refresh the source.');
    if(exitParent&&!inputs(p)[layout.rows[0].gateIndex].checked)await setField(p,layout.rows[0].gateIndex,{...C.fields(p)[layout.rows[0].gateIndex],checked:true},'marketFilter',until);
    await setField(p,index,{...C.fields(p)[index],value},'marketFilter',until);await settledStage(p,'marketFilter',index===layout.chartIndex?value:layout.chart,until);layout=L.stage('marketFilter',C.fields(p));
   }
   // Keep the chosen context's current mode/action before expanding its editor.
   const current={fields:C.fields(p)};
   if(!current.fields[layout.indexModeIndex].checked){await setField(p,layout.indexModeIndex,{...current.fields[layout.indexModeIndex],checked:true},'marketFilter',until);layout=L.stage('marketFilter',C.fields(p));}
   if(!layout.hasExit){await setField(p,layout.actionIndex,{...C.fields(p)[layout.actionIndex],value:L.marketActions[2]},'marketFilter',until);await settledStage(p,'marketFilter',layout.chart,until);layout=L.stage('marketFilter',C.fields(p));}
   const full=descriptor(p);full.current=current;const previous=cachedStage('marketFilter',full,records,request.forceChoices===true);reuseInactiveChoices('marketFilter',full,previous);reusedChoices=!!previous;full.ruleCatalogues=previous?previous.ruleCatalogues:await strategyCatalogues(p,until,'marketFilter');for(const [child,c]of Object.entries(full.ruleCatalogues))full.options[child]=c.categories[full.fields[c.parentIndex].value];
   mergeBenchmarks(full,await benchmarkChoices(p,'marketFilter',until,previous,undefined,symbols));
   // Read both benchmark branches; map the observed RS indices back to the
   // full Index descriptor instead of assuming non-Candle positions match.
   const expanded=L.stage('marketFilter',full.fields);await setField(p,expanded.rsModeIndex,{...C.fields(p)[expanded.rsModeIndex],checked:true},'marketFilter',until);
   const rs=L.stage('marketFilter',C.fields(p)),proof=await benchmarkChoices(p,'marketFilter',until,previous,expanded,[...symbols,...symbolIndices(expanded).flatMap(index=>full.options[index]||[])]);
   for(const key of ['numeratorSymbolIndex','denominatorSymbolIndex']){if(proof.options[rs[key]]){full.options[expanded[key]]=proof.options[rs[key]];full.symbolQueries[expanded[key]]=proof.symbolQueries[rs[key]];}}
   config.stages.marketFilter=full;
   choiceCache={schemaVersion:2,adapterVersion:L.version,session,stages:{marketFilter:choiceStageCache('marketFilter',full)}};optionalMenus.push(choiceCache);if(optionalMenus.length>128)optionalMenus.shift();
  }
  config.capturedAt=new Date().toISOString();window.VaultSetup.template(config);result={config,choiceCache,choicesFromCache:reusedChoices,hasCachedChoices:reusedChoices};
 }finally{
  try{
   if(p?.isConnected&&C.visible(p)&&!interrupted){if(snapshot)await restoreStage(p,'marketFilter',snapshot,started+54000);await close(p,started+58000);}
   if(relativeSnapshot&&!interrupted)await restoreStage(C.main(),'momentum',relativeSnapshot,started+55000);
   if(originalMain&&!interrupted){await restoreStage(C.main(),'momentum',originalMain,started+59000);}
  }catch(error){failed=true;throw error;}finally{configuring=false;}
 }
 lastConfig=structuredClone(result.config);C.status('Filter settings loaded. Return to Vault.');return result;
}
async function configuration(requestedChanges,request={}){
 const relativeLayout=lastConfig?.stages.momentum.relativeStrength&&L.stage('momentum',lastConfig.stages.momentum.relativeStrength.fields);
 if(request.loadFilter!==undefined||requestedChanges?.marketFilter||relativeLayout&&[relativeLayout.benchmarkMarketIndex,relativeLayout.rows.at(-1).parentIndex].some(index=>Object.hasOwn(requestedChanges?.momentum||{},index)))return filterConfiguration(requestedChanges,request);
 if(active||configuring||failed)throw Error('RZone is busy or needs review. Finish its current work first.');
 const changes=configChanges(requestedChanges),warm=request.warmChart;
 checkOptionalDay(request.forceChoices===true);
 if(warm!==undefined&&(!['Candle','P&F','Renko'].includes(warm)||Object.keys(changes).length))throw Error('Load one supported chart context at a time.');
 configuring=true;interrupted=false;const started=Date.now();let setup=null,config,warmMain,warmExecution,restoreMain=false,restoreExecution=false,sharedChoicesUsed=false;const hits=[];
 try{
  try{
  C.status('Connecting to Vault: opening Momentum settings…');
  await prepare();
  await settledMain();
  for(const row of stageRows('momentum',C.main()))restorableRule(C.main(),row);
  C.status('Connecting to Vault: checking current settings…');
  const original=C.fields(C.main());L.stage('momentum',original);if(original[3]?.value!=='NSE')throw Error('Automatic setup currently supports NSE. Other markets use a different source layout.');
  if(warm){
   warmMain=restorableStage(C.main(),'momentum');
   button(C.main(),/^BackTest$/i).click();setup=C.popup('Momentum Trading BackTest')||await wait(()=>C.popup('Momentum Trading BackTest'),Math.min(Date.now()+10000,started+12000),'Momentum settings did not open.');
   warmExecution=restorableStage(setup,'execution');await close(setup,started+20000);setup=null;
   if(Date.now()>=started+20000)throw Error('RZone took too long to prepare the other chart choices. Its original settings were left intact.');
  }
  restoreMain=!!warm&&(warmMain.fields[0].value!==warm||L.stage('momentum',warmMain.fields).relativeStrength);
  if(warm){const layout=L.stage('momentum',C.fields(C.main()));if(layout.relativeStrength)await setField(C.main(),layout.rsIndex,{...C.fields(C.main())[layout.rsIndex],checked:false},'momentum',started+25000);}
  await changeParents(C.main(),warm?{0:warm}:changes.momentum,'momentum',started+(warm?25000:35000));const momentum={...descriptor(C.main()),supportedMarkets:['NSE']};
  L.stage('momentum',momentum.fields);
  const mainCache=cachedStage('momentum',momentum,request.cachedChoices,request.forceChoices===true);hits.push(!!mainCache);
  reuseInactiveChoices('momentum',momentum,mainCache);
  sharedChoicesUsed=!!mainCache?.publicOnly;
  if(mainCache)C.status('Reusing today’s dropdown choices; checking current settings…');
  momentum.options[1]=mainCache&&!mainCache.publicOnly?mainCache.groupOptions:cachedGroups(momentum,request.cachedChoices,request.forceChoices===true)||await groupCatalogue(C.main());
  // Discovery shares a bounded request budget. Main scanning keeps its 35 s
  // cap; execution must be open/refreshed by 43 s, and its scan ends at 48 s.
  // Reserve 5 s each for exact exit restoration and owned-dialog closure,
  // keeping the complete operation within the worker's unchanged 60 s.
  const scanDeadline=Math.min(Date.now()+35000,started+(warm?30000:Object.keys(changes.execution||{}).length?28000:38000));
  momentum.ruleCatalogues=mainCache&&!mainCache.publicOnly?mainCache.ruleCatalogues:await strategyCatalogues(C.main(),scanDeadline,'momentum',mainCache);
  for(const [child,catalogue]of Object.entries(momentum.ruleCatalogues))momentum.options[child]=catalogue.categories[momentum.fields[catalogue.parentIndex].value];
  if(mainCache?.symbolOptions)mergeBenchmarks(momentum,{options:structuredClone(mainCache.symbolOptions),symbolQueries:structuredClone(mainCache.symbolQueries||{})});
  C.status('Connecting to Vault: reading backtest settings…');
  const openUntil=started+(warm?33000:43000)-(Object.keys(changes.execution||{}).length?10000:0);
  if(Date.now()>=openUntil)throw Error('RZone choices took too long to load. Refresh choices and try again.');
  button(C.main(),/^BackTest$/i).click();setup=C.popup('Momentum Trading BackTest')||await wait(()=>C.popup('Momentum Trading BackTest'),Math.min(Date.now()+10000,openUntil),'Momentum settings did not open.');
  for(const row of stageRows('execution',setup))restorableRule(setup,row);
  restoreExecution=!!warm&&(warmExecution.fields[3].value!==warm||L.stage('execution',warmExecution.fields).selection!=='Price');
  await changeParents(setup,warm?{3:warm}:changes.execution,'execution',started+(warm?37000:43000));
  if(warm){const layout=L.stage('execution',C.fields(setup));if(layout.selection!=='Price')await setField(setup,layout.selectionIndex,{...C.fields(setup)[layout.selectionIndex],value:'Price'},'execution',started+37000);}
  const execution=descriptor(setup);
  L.stage('execution',execution.fields);
  const executionCache=cachedStage('execution',execution,request.cachedChoices,request.forceChoices===true);hits.push(!!executionCache);
  reuseInactiveChoices('execution',execution,executionCache);
  sharedChoicesUsed=sharedChoicesUsed||!!executionCache?.publicOnly;
  execution.ruleCatalogues=executionCache&&!executionCache.publicOnly?executionCache.ruleCatalogues:await strategyCatalogues(setup,started+(warm?40000:48000),'execution',executionCache);
  for(const [child,catalogue]of Object.entries(execution.ruleCatalogues))execution.options[child]=catalogue.categories[execution.fields[catalogue.parentIndex].value];
  if(executionCache?.symbolOptions)mergeBenchmarks(execution,{options:structuredClone(executionCache.symbolOptions),symbolQueries:structuredClone(executionCache.symbolQueries||{})});
  if(JSON.stringify(C.fields(C.main()))!==JSON.stringify(momentum.fields))throw Error('RZone momentum settings changed while reading backtest choices. Review the source.');
  const portfolio=window.VaultSetup?.portfolioTemplate();if(!portfolio)throw Error('Vault setup template is unavailable. Reload the extension and RZone.');
  check();config={schemaVersion:1,adapterVersion:L.version,session,capturedAt:new Date().toISOString(),stages:{momentum,execution,portfolio},supports:{charts:['Candle','P&F','Renko'],executeCharts:['Candle'],filters:['relative-strength','market-filter'],blocked:[]}};window.VaultSetup.template(config);
  }finally{
   try{if(setup&&C.visible(setup)&&!interrupted){if(restoreExecution)await restoreStage(setup,'execution',warmExecution,started+50000);await close(setup,started+55000);}}
   catch(error){failed=true;throw error;}
   finally{if(restoreMain&&!interrupted){try{await restoreStage(C.main(),'momentum',warmMain,started+59000);}catch(error){failed=true;throw error;}}}
  }
  if(!warm)lastConfig=structuredClone(config);C.status('RZone settings read. Return to Vault to finish setup.');return {config,choiceCache:{schemaVersion:2,adapterVersion:L.version,session,stages:{momentum:choiceStageCache('momentum',config.stages.momentum),execution:choiceStageCache('execution',config.stages.execution)}},choicesFromCache:hits.every(Boolean),hasCachedChoices:hits.some(Boolean),sharedChoicesUsed};
 }catch(error){C.status('Vault connection failed: '+error.message);throw error;}
 finally{configuring=false;}
}
async function lookupContext(stage,index,until,restoreUntil=until+14000){
 await prepare();await settledMain();const mainSnapshot=restorableStage(C.main(),'momentum');let p=C.main(),snapshot,extraSnapshot;
 try{
  if(stage==='marketFilter'){
   const full=lastConfig?.stages.marketFilter;if(!full)throw Error('Load Market Trend Filter settings first.');
   p=await openMarketFilter(until);snapshot=restorableStage(p,stage);await transitionLayout(p,full.fields,stage,until);
  }else if(stage==='execution'){
   const full=lastConfig?.stages.execution;if(!full)throw Error('Connect RZone before searching exit strategies.');
   ownClick(button(C.main(),/^BackTest$/i));p=C.popup('Momentum Trading BackTest')||await wait(()=>C.popup('Momentum Trading BackTest'),Math.min(Date.now()+10000,until),'Momentum settings did not open.');snapshot=restorableStage(p,stage);
   // RZone can reopen this dialog using the main chart. Search the execution
   // chart staged in Vault, then restore the independently captured source.
   await transitionLayout(p,full.fields,stage,until);
  }else {
   const current=L.stage(stage,mainSnapshot.fields),full=lastConfig?.stages.momentum.relativeStrength;
   if(full&&index>current.rsIndex&&!current.relativeStrength){await setField(p,current.rsIndex,{...mainSnapshot.fields[current.rsIndex],checked:true},stage,until);extraSnapshot=restorableStage(p,stage);}
  }
  return {p,async restore(){
   if(interrupted)return;
   if(p!==C.main()&&p.isConnected&&C.visible(p)){if(snapshot)await restoreStage(p,stage,snapshot,restoreUntil-5000);await close(p,restoreUntil);}
   if(extraSnapshot)await restoreStage(C.main(),'momentum',extraSnapshot,restoreUntil-4000);
   await restoreStage(C.main(),'momentum',mainSnapshot,restoreUntil);
  }};
 }catch(error){if(!interrupted){if(p!==C.main()&&C.visible(p)){if(snapshot)await restoreStage(p,stage,snapshot,restoreUntil-5000);await close(p,restoreUntil);}await restoreStage(C.main(),'momentum',mainSnapshot,restoreUntil);}throw error;}
}
async function symbolLookup(request){
 if(request.session!==session)throw Error('The RZone page changed. Connect again before searching symbols.');
 const stage=request.stage;
 if(!['momentum','execution','marketFilter'].includes(stage)||!Number.isInteger(request.fieldIndex)||typeof request.market!=='string'||typeof request.query!=='string'||request.query!==request.query.trim()||!request.query||request.query.length>200||/[\u0000-\u001f\u007f]/.test(request.query))throw Error('Enter a symbol search of 1 to 200 characters.');
 if(active||configuring||failed)throw Error('RZone is busy or needs review.');
 configuring=true;interrupted=false;const started=Date.now();let context;
 try{
  context=await lookupContext(stage,request.fieldIndex,started+45000);const p=context.p,layout=L.stage(stage,C.fields(p));
  if(!symbolIndices(layout).includes(request.fieldIndex))throw Error('This symbol is not available in the current source layout.');
  if(stage==='marketFilter'){
   const key=request.fieldIndex===layout.indexSymbolIndex?'indexModeIndex':'rsModeIndex';if(!C.fields(p)[layout[key]].checked)await setField(p,layout[key],{...C.fields(p)[layout[key]],checked:true},stage,started+45000);
  }
  const updated=L.stage(stage,C.fields(p)),role=['benchmarkIndex','indexSymbolIndex','numeratorSymbolIndex','denominatorSymbolIndex'].find(key=>layout[key]===request.fieldIndex),index=updated[role];
  await setField(p,index-1,{...C.fields(p)[index-1],value:request.market},stage,started+45000);
  const options=await searchSymbols(p,index,request.query,{market:request.market,until:started+45000});
  const result={stage,fieldIndex:request.fieldIndex,market:request.market,query:request.query,controlType:'text',options};
  const descriptor=stage==='momentum'&&lastConfig.stages.momentum.relativeStrength&&request.fieldIndex===L.stage('momentum',lastConfig.stages.momentum.relativeStrength.fields).benchmarkIndex?lastConfig.stages.momentum.relativeStrength:lastConfig.stages[stage];
  if(descriptor){descriptor.options[request.fieldIndex]=rememberedSymbols(symbolsForControl(p,index,knownSymbols(currentChoiceDay()?optionalMenus:[])),options,request.market);descriptor.symbolQueries={...descriptor.symbolQueries,[request.fieldIndex]:{market:request.market,query:request.query}};if(currentChoiceDay())result.choiceCache={schemaVersion:2,adapterVersion:L.version,session,stages:{[stage]:choiceStageCache(stage,descriptor)}};}
  return result;
 }finally{try{if(context)await context.restore();}catch(error){failed=true;throw error;}finally{configuring=false;}}
}
async function ruleLookup(request){
 const started=Date.now(),workUntil=started+45000;
 if(request.session!==session)throw Error('The RZone page changed. Connect again before searching rules.');
 const stage=request.stage===undefined?'momentum':request.stage;
 if(!['momentum','execution','marketFilter'].includes(stage)||!Number.isInteger(request.parentIndex)||!['My','Public'].includes(request.category)||typeof request.query!=='string'||request.query!==request.query.trim()||!request.query||request.query.length>200||/[\u0000-\u001f\u007f]/.test(request.query))throw Error('Enter a rule search of 1 to 200 characters for My or Public.');
 if(active||configuring||failed)throw Error('RZone is busy or needs review. Finish its current work first.');
 configuring=true;interrupted=false;let main,row,snapshot,original,context;
 try{
  context=await lookupContext(stage,request.parentIndex,workUntil);main=context.p;snapshot=C.fields(main);L.stage(stage,snapshot);row=stageRows(stage,main).find(r=>r.parentIndex===request.parentIndex&&r.name!=='Radar');if(!row)throw Error('This rule is not available in the current chart layout.');restorableRule(main,row);
  const nodes=inputs(main),parent=nodes[row.parentIndex],child=nodes[row.childIndex],gate=nodes[row.gateIndex],timeframe=nodes[row.valueIndex];
  if(parent.tagName!=='SELECT'||!observedRuleShape(row,child,V.clean(parent.selectedOptions[0]?.textContent))||gate.type!=='checkbox'||gate.disabled)throw Error('RZone strategy layout changed. Refresh RZone and connect again.');
  const offered=[...parent.options].filter(o=>!o.disabled&&V.clean(o.textContent)===request.category);if(offered.length!==1)throw Error('The requested source category is unavailable.');
  original={parentValue:parent.value,ruleValue:child.value,timeframeValue:timeframe?.value,enabled:gate.checked,selection:knownRule(main,row)};
  const deadline=Math.min(Date.now()+25000,workUntil);
  if(Date.now()>=deadline)throw Error('RZone rule search timed out. Refresh choices and try again.');
  if(!gate.checked){ownClick(gate);await delay(150);}
  await enabledRule(main,row,deadline);
  if(parent.value!==offered[0].value)await selectValue(main,parent,offered[0].value,{gate:row.gateIndex,child:row.childIndex},deadline);
  if(!ruleSearch(inputs(main)[row.childIndex]))throw Error('This category does not expose a system-builder search. Refresh choices.');
  unchangedOutsideRow(main,snapshot,row);
  const options=await searchRules(main,row.childIndex,request.query,{until:deadline});
  unchangedOutsideRow(main,snapshot,row);
  if(V.clean(inputs(main)[row.parentIndex].selectedOptions[0]?.textContent)!==request.category)throw Error('The rule source changed while searching.');
  const result={stage,parentIndex:row.parentIndex,childIndex:row.childIndex,category:request.category,query:request.query,controlType:'text',options};
  const descriptor=stage==='momentum'&&lastConfig.stages.momentum.relativeStrength&&request.parentIndex===L.stage('momentum',lastConfig.stages.momentum.relativeStrength.fields).rows.at(-1).parentIndex?lastConfig.stages.momentum.relativeStrength:lastConfig.stages[stage],catalogue=descriptor?.ruleCatalogues?.[row.childIndex];
  if(catalogue){catalogue.categories[request.category]=rememberedChoices(catalogue.categories[request.category],options);catalogue.searchQueries={...catalogue.searchQueries,[request.category]:request.query};if(descriptor.fields[row.parentIndex].value===request.category)descriptor.options[row.childIndex]=structuredClone(catalogue.categories[request.category]);if(currentChoiceDay())result.choiceCache={schemaVersion:2,adapterVersion:L.version,session,stages:{[stage]:choiceStageCache(stage,descriptor)}};}
  return result;
 }catch(error){throw Error((row?ruleRowName(row)+' / '+request.category+': ':'')+error.message);
 }finally{try{try{if(original&&!interrupted)await restoreStrategyRow(main,row,snapshot,original);}finally{if(context)await context.restore();}}finally{configuring=false;}}
}
function sameValue(a,b){try{E.verify([{...a,index:0}],[{...b,index:0}]);return true;}catch{return false;}}
function ruleTransition(expected,current,index,catalogues){
 const stage=/Rank/i.test(expected[0]?.label)?'execution':/Group/i.test(expected[1]?.label)?'momentum':'marketFilter';let row;try{row=L.stage(stage,expected).rows.find(r=>r.childIndex===index&&r.name!=='Radar');}catch{return false;}const types=row&&catalogues?.[index]?.controlTypes;if(!types)return false;
 const from=current[row.parentIndex]?.value,to=expected[row.parentIndex]?.value;
 return from!==to&&types[from]===current[index]?.type&&types[to]===expected[index]?.type&&['select-one','text'].includes(types[from])&&['select-one','text'].includes(types[to]);
}
function layout(expected,current,catalogues,base,stage){
 const project=window.VaultSetup?.projectRuleLabels,from=base&&catalogues&&project?project(base,catalogues,current,stage):null,to=base&&catalogues&&project?project(base,catalogues,expected,stage):null;
 if(expected.length!==current.length||expected.some((f,i)=>f.type!==current[i].type&&!ruleTransition(expected,current,i,catalogues)||V.clean(f.label)!==V.clean(current[i].label)&&!(from?.[i]===current[i].label&&to?.[i]===f.label)))throw Error('Settings layout changed. Review the source tab.');
}
function nodeField(node,field){return {...field,type:node.type,value:node.tagName==='SELECT'?[...node.selectedOptions].map(o=>V.clean(o.textContent)).join('; '):node.value,checked:['checkbox','radio'].includes(node.type)?node.checked:null,disabled:node.disabled};}
function setupNodes(p,expected,catalogues){const nodes=inputs(p),current=nodes.map((n,i)=>nodeField(n,expected[i]));if(nodes.length!==expected.length||nodes.some((n,i)=>n.type!==expected[i].type&&(!ruleTransition(expected,current,i,catalogues)||!ruleShape(n))))throw Error('Settings layout changed. Review the source tab.');return nodes;}
function setText(node,value){const proto=node.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(node,String(value));node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));}
const containerStage=p=>p===C.main()?'momentum':p===C.popup('Market Trend Filter')?'marketFilter':'execution';
function symbolIndices(layout){return ['benchmarkIndex','indexSymbolIndex','numeratorSymbolIndex','denominatorSymbolIndex'].filter(key=>Number.isInteger(layout?.[key])).map(key=>layout[key]);}
function symbolOptions(template,stage,layout,index){
 const d=stage==='momentum'&&layout.relativeStrength?template?.stages?.momentum?.relativeStrength||template?.stages?.momentum:template?.stages?.[stage];
 if(!d)return [];const source=L.stage(stage,d.fields),key=['benchmarkIndex','indexSymbolIndex','numeratorSymbolIndex','denominatorSymbolIndex'].find(key=>layout[key]===index);
 return key?d.options?.[source[key]]||[]:[];
}
async function searchSymbols(p,index,query,{choose=false,sourceValue,market,expectedExchange,until=Infinity,restore=true}={}){
 if(Date.now()+1000>=until)throw Error('RZone symbol search timed out before it could start. Refresh choices and try again.');
 const node=inputs(p)[index],marketNode=inputs(p)[index-1];
 if(node?.tagName!=='INPUT'||node.type!=='text'||node.placeholder!=='Search Symbol'||node.disabled||marketNode?.tagName!=='SELECT')throw Error('The benchmark symbol search is unavailable.');
 const selectedMarket=V.clean(marketNode.selectedOptions[0]?.textContent);if(market!==selectedMarket)throw Error('The benchmark market changed. Search again.');
 if(popups().some(menu=>menu!==p))throw Error('Close the open RZone menu before searching symbols.');
 const original=node.value,owned=new Set(),old=new Set(document.querySelectorAll('.popupContent'));let last='',stableAt=Date.now(),fresh=false,committed=false;
 // Native symbol results temporarily become a spinner in the same popup.
 // Recognize only that observed shell; unrelated dialogs still stop the read.
 const loading=menu=>menu.parentElement?.classList.contains('tool-popup')&&!!menu.querySelector(':scope > .abcd-1 .loading')&&!menu.querySelector('.custom-dialog-header');
 const noSymbols=menu=>menu.parentElement?.classList.contains('tool-popup')&&!menu.querySelector('.custom-dialog-header')&&[...menu.querySelectorAll(':scope > .abcd-1 .gwt-HTML')].some(node=>C.visible(node)&&V.clean(node.textContent)==='No matching symbol found');
 const symbolMenu=menu=>!!menu.querySelector('.ind-list')||loading(menu)||noSymbols(menu);
 const observer=new MutationObserver(records=>{for(const menu of popups())if(menu!==p&&symbolMenu(menu)&&records.some(r=>r.target===menu||menu.contains(r.target))){owned.add(menu);fresh=true;stableAt=Date.now();}});
 observer.observe(document.body,{childList:true,subtree:true,characterData:true});
 try{
  node.focus();ownClick(node);ruleQuery(node,query);let choices,menu;const deadline=Math.min(Date.now()+10000,until-1000);
  while(Date.now()<deadline){
   check();if(inputs(p)[index]!==node||node.value!==query||V.clean(marketNode.selectedOptions[0]?.textContent)!==market)throw Error('The benchmark search changed while reading.');
   const menus=popups().filter(m=>m!==p);if(menus.some(m=>!symbolMenu(m))||menus.length>1)throw Error('RZone opened an unexpected symbol dialog.');
   menu=menus[0];if(menu){if(!old.has(menu)&&!owned.has(menu)){owned.add(menu);fresh=true;stableAt=Date.now();}
    if(loading(menu)){last='';stableAt=Date.now();await delay(100);continue;}
    const rows=[...menu.querySelectorAll('.ind-list li[name][exhg]')].filter(C.visible);if(rows.length>3000)throw Error('Narrow the symbol search.');
    const read=rows.map(row=>{const id=row.getAttribute('name'),exchange=row.getAttribute('exhg'),label=V.clean(row.querySelector('.symbol-search-list > div')?.textContent);if(!id||id.length>2000||!label||id.split('|')[0]!==label||!exchange)throw Error('RZone symbol choices are incomplete.');return {value:label,label,sourceValue:id,market:exchange,disabled:false};}).filter(o=>market==='All'||o.market===market);
    const next=JSON.stringify(read);if(next!==last){last=next;stableAt=Date.now();}
    if(fresh&&(read.length||noSymbols(menu))&&Date.now()-stableAt>=750){choices=compactRuleChoices(read);break;}
   }await delay(100);
  }
  if(!choices)throw Error('RZone did not return confirmed symbols. Try a more specific symbol name.');
  if(choose){
   const matches=[...menu.querySelectorAll('.ind-list li[name][exhg]')].filter(row=>C.visible(row)&&V.clean(row.querySelector('.symbol-search-list > div')?.textContent)===query&&(market==='All'||row.getAttribute('exhg')===market)&&(sourceValue===undefined||row.getAttribute('name')===sourceValue)&&(expectedExchange===undefined||row.getAttribute('exhg')===expectedExchange));
   if(matches.length!==1)throw Error('The benchmark symbol is unavailable or ambiguous. Search for it again.');
   const target=matches[0].querySelector('.symbol-search-list');if(!target)throw Error('Cannot identify the symbol selection.');ownClick(target);await delay(150);
   if(node.value!==query)throw Error('RZone selected a different benchmark.');
   committed=true;
  }
  return choices;
 }finally{
  try{if(!interrupted&&node.isConnected){try{
   // Keep observing through dismissal: a delayed response can reopen the
   // native list after its first empty-query acknowledgement. Restoring text
   // or closing the parent at that first hidden frame leaves an orphan menu.
   const cleanupDeadline=Math.min(Date.now()+5000,until);let quietSince=null,lastClear=Date.now();
   if(!committed)ruleQuery(node,'');
   for(;;){
    check();
    for(const menu of popups())if(menu!==p&&!old.has(menu)&&symbolMenu(menu))owned.add(menu);
    const visible=[...owned].some(menu=>menu.isConnected&&C.visible(menu)),now=Date.now();
    if(!visible){if(quietSince===null)quietSince=now;if(now-quietSince>=500)break;}
    else{quietSince=null;if(!committed&&now-lastClear>=200){ruleQuery(node,'');lastClear=now;}}
    if(now>=cleanupDeadline)throw Error('The symbol menu did not close.');
    await delay(100);
   }
  }finally{if(!interrupted&&node.isConnected){
   if(!committed&&restore)Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,original);
   node.blur();
  }}}}finally{observer.disconnect();}
 }
}
async function group(node,value,expectedIdentity){
 node.focus();setText(node,value);node.dispatchEvent(new KeyboardEvent('keyup',{key:String(value).at(-1)||'',bubbles:true}));
 const selected=await wait(()=>{
  const candidates=[...document.querySelectorAll('.ind-list li,.gwt-SuggestBoxPopup .item,.gwt-SuggestBoxPopup td,[role="listbox"] [role="option"]')].filter(n=>C.visible(n)&&V.clean(n.textContent)===String(value));
  const exact=candidates.filter(n=>!candidates.some(other=>other!==n&&n.contains(other)));
  if(exact.length>1)throw Error('The group name matches more than one RZone choice. Choose a unique group.');return exact[0];
 },Date.now()+5000,'RZone did not confirm that group. Choose an exact group name from the available RZone groups.');
 if(expectedIdentity!==undefined&&selected.getAttribute('grpid')!==expectedIdentity)throw Error('The group identity changed in RZone. Recheck choices before running.');
 ownClick(selected);node.blur();await delay(150);if(V.clean(node.value)!==V.clean(value))throw Error('RZone selected a different group.');
}
async function setField(p,index,f,stage,until=Infinity,template){
 check();if(Date.now()>=until)throw Error('The source settings operation exceeded its deadline.');const node=inputs(p)[index];if(!node||node.type!==f.type)throw Error('Settings layout changed. Review the source tab.');const current=nodeField(node,f),source=sourceLayout(p,stage),search=stageRows(stage,p).some(row=>row.childIndex===index&&row.name!=='Radar')&&ruleSearch(node),symbol=symbolIndices(source).includes(index);if(sameValue(f,current)&&!(stage==='momentum'&&index===1)&&!((search||symbol)&&f.value.trim()&&!node.disabled))return;
 if(node.disabled)throw Error('Planned setting is disabled: '+f.label);
 if(['checkbox','radio'].includes(f.type)){if(f.type==='radio'&&!f.checked)return;ownClick(node);if(index===source?.rsIndex||stage==='marketFilter'&&[source?.indexModeIndex,source?.rsModeIndex].includes(index))await settledStage(p,stage,source.chart,until);const row=stageRows(stage,p).find(r=>r.gateIndex===index);if(row&&f.checked)await enabledRule(p,row,until);}
 else if(node.tagName==='SELECT'){const matches=[...node.options].filter(o=>!o.disabled&&V.clean(o.textContent)===String(f.value));if(matches.length!==1)throw Error('Planned dropdown value is unavailable: '+f.label);await selectValue(p,node,matches[0].value,sourceParent(p,stage,index),until);if(index===source?.chartIndex||source?.chart==='Renko'&&index===source.modeIndex)await settledStage(p,stage,index===source.chartIndex?String(f.value):source.chart,until);}
 else if(stage==='momentum'&&index===1)await group(node,String(f.value),template?.stages?.momentum?.options?.[1]?.find(o=>o.value===String(f.value)&&!o.disabled)?.sourceValue);
 else if(symbol){if(f.value.trim()){const market=V.clean(inputs(p)[index-1].selectedOptions[0]?.textContent),choices=symbolOptions(template,stage,source,index),option=choices.find(o=>!o.disabled&&o.value===f.value&&(market==='All'||o.market===market));await searchSymbols(p,index,String(f.value),{choose:true,market,sourceValue:option?.sourceValue,expectedExchange:option?.market,until});}else Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,'');}
 else if(search){if(f.value.trim())await searchRules(p,index,String(f.value),{choose:true,until:Math.min(Date.now()+10000,until)});else {Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,'');node.blur();}}
 else {setText(node,f.value);node.blur();}
 await delay(150);
}
async function transitionLayout(p,expected,stage,until=Infinity){
 const target=L.stage(stage,expected);let current=L.stage(stage,C.fields(p));
 if(current.chart!==target.chart){await setField(p,current.chartIndex,{...C.fields(p)[current.chartIndex],value:target.chart},stage,until);current=L.stage(stage,C.fields(p));}
 if(stage==='momentum'&&current.relativeStrength!==target.relativeStrength){await setField(p,current.rsIndex,{...C.fields(p)[current.rsIndex],checked:target.relativeStrength},stage,until);current=L.stage(stage,C.fields(p));}
 if(stage==='execution'&&current.selection!==target.selection){await setField(p,current.selectionIndex,{...C.fields(p)[current.selectionIndex],value:target.selection},stage,until);await settledStage(p,stage,target.chart,until);}
 if(stage==='marketFilter'){
  const action=expected[target.actionIndex].value;if(C.fields(p)[current.actionIndex].value!==action){await setField(p,current.actionIndex,{...C.fields(p)[current.actionIndex],value:action},stage,until);await settledStage(p,stage,target.chart,until);current=L.stage(stage,C.fields(p));}
  const mode=expected[target.rsModeIndex].checked?'RS':'Index',key=mode==='RS'?'rsModeIndex':'indexModeIndex';if(!C.fields(p)[current[key]].checked){await setField(p,current[key],{...C.fields(p)[current[key]],checked:true},stage,until);await settledStage(p,stage,target.chart,until);}
 }
 return target;
}
async function retainedMarketFields(p,expected,template,until=Infinity){
 const target=L.stage('marketFilter',expected);
 for(const role of ['indexSymbolIndex','numeratorSymbolIndex','denominatorSymbolIndex']){
  let current=L.stage('marketFilter',C.fields(p));const index=current[role],wanted=target[role],nodes=inputs(p);
  if(nodes[index].value===expected[wanted].value&&V.clean(nodes[index-1].selectedOptions[0]?.textContent)===expected[wanted-1].value)continue;
  const modeKey=role==='indexSymbolIndex'?'indexModeIndex':'rsModeIndex';await setField(p,current[modeKey],{...C.fields(p)[current[modeKey]],checked:true},'marketFilter',until);current=L.stage('marketFilter',C.fields(p));
  await setField(p,current[role]-1,{...expected[wanted-1],disabled:false},'marketFilter',until,template);await setField(p,current[role],{...expected[wanted],disabled:false},'marketFilter',until,template);
 }
 await transitionLayout(p,expected,'marketFilter',until);
 for(let n=0;n<target.methodIndices.length;n++){
  const index=target.methodValueIndices[n],node=inputs(p)[index];if(node.value===expected[index].value)continue;
  await setField(p,target.methodIndices[n],{...expected[target.methodIndices[n]],checked:true},'marketFilter',until);await setField(p,index,{...expected[index],disabled:false},'marketFilter',until);
 }
 const method=target.methodIndices.find(index=>expected[index].checked);await setField(p,method,expected[method],'marketFilter',until);
}
async function applySetup(p,expected,stage,template){
 if(stage!=='portfolio')await transitionLayout(p,expected,stage);
 if(stage==='marketFilter')await retainedMarketFields(p,expected,template);
 const descriptor=window.VaultSetup?.descriptorForFields?.(template,stage,expected)||(stage==='momentum'&&L.stage(stage,expected).relativeStrength?template?.stages?.momentum?.relativeStrength||template?.stages?.momentum:template?.stages?.[stage]),catalogues=descriptor?.ruleCatalogues;
 if(stage!=='portfolio')for(const row of L.stage(stage,expected).rows){
  if(C.fields(p)[row.parentIndex].value!==expected[row.parentIndex].value){if(!inputs(p)[row.gateIndex].checked)await setField(p,row.gateIndex,{...expected[row.gateIndex],checked:true},stage);await setField(p,row.parentIndex,expected[row.parentIndex],stage);}
 }
 layout(expected,C.fields(p),catalogues,descriptor?.fields,stage);
 const source=['momentum','execution','marketFilter'].includes(stage)?L.stage(stage,expected):null;
 // Checkbox gates may disable their retained numeric values. Populate those
 // values while the gate is on, then restore the explicitly planned state.
 const gates=source?.gates||[[0,1,2,3,4,5],[4,5]];
 const temporary=[];
 for(const [gate,...children] of gates){
  check();const nodes=setupNodes(p,expected,catalogues),current=nodes.map((n,i)=>nodeField(n,expected[i])),changing=children.some(i=>!sameValue(expected[i],current[i])),mustEnable=expected[gate]?.checked||changing;
  if(mustEnable&&!current[gate].checked)await setField(p,gate,{...expected[gate],checked:true},stage);
  if(changing&&!expected[gate].checked)temporary.push(gate);
 }
 const first=stage==='momentum'?[0,3,1]:[],modes=source?.chart==='Renko'?[source.modeIndex,source.exitModeIndex].filter(Number.isInteger):[];first.push(...modes);const order=[...first,...expected.map((_,i)=>i).filter(i=>!first.includes(i))];
 for(const i of order){if(temporary.includes(i))continue;setupNodes(p,expected,catalogues);if(expected[i].disabled&&sameValue(expected[i],nodeField(inputs(p)[i],expected[i])))continue;await setField(p,i,expected[i],stage,Infinity,template);}
 for(const i of temporary.reverse())await setField(p,i,expected[i],stage,Infinity,template);
 E.verify(expected,C.fields(p));
}
async function apply(p,e,t,stage){
 const expected=E.fields(E.expected(e,t),stage),current=C.fields(p),allowed=e.dimensions.filter(d=>d.stage===stage).map(d=>d.index);
 if(e.baseline.origin==='vault-setup'){await applySetup(p,expected,stage,e.baseline.setup.template);return;}
 if(stage==='execution'&&t.period)allowed.push(1,2);
 // Validate fixed controls before changing anything. Never silently restore another strategy.
 const fixed=E.clone(expected);for(const i of allowed)if(current[i])fixed[i]={...fixed[i],value:current[i].value,checked:current[i].checked};E.verify(fixed,current);
 for(const i of allowed){check();const f=expected[i],nodes=inputs(p),node=nodes[i];if(!node||node.disabled)throw Error('Planned setting is disabled: '+f.label);if(f.type==='checkbox'){if(node.checked!==f.checked)ownClick(node);}else if(node.tagName==='SELECT'){const matches=[...node.options].filter(o=>V.clean(o.textContent)===String(f.value));if(matches.length!==1)throw Error('Planned dropdown value is unavailable.');node.value=matches[0].value;node.dispatchEvent(new Event('change',{bubbles:true}));}else{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(node,String(f.value));node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));node.blur();}await delay(150);}
 // A saved report proves its earlier selection, not the current search box's
 // committed ID. Re-select active text rules through exact visible suggestions
 // even when the displayed value still matches that earlier report.
 if(['momentum','execution'].includes(stage))for(const row of stageRows(stage,p)){const nodes=inputs(p),node=nodes[row.childIndex];if(nodes[row.gateIndex]?.checked&&ruleSearch(node)){if(!expected[row.childIndex]?.value.trim())throw Error('Choose a rule before running '+ruleRowName(row)+'.');await searchRules(p,row.childIndex,expected[row.childIndex].value,{choose:true,until:Date.now()+10000});}}
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
  const planned=E.expected(e,t);if(E.fields(planned,'momentum')[0]?.value!=='Candle'||E.fields(planned,'execution')[3]?.value!=='Candle')throw Error('P&F and Renko automatic execution is awaiting live acceptance. Their settings and choices can be prepared in Vault.');
  await apply(C.main(),e,t,'momentum');
  const marketFields=E.fields(planned,'marketFilter');
  if(marketFields?.length){
   const filter=await openMarketFilter(Math.min(deadline,Date.now()+10000));await apply(filter,e,t,'marketFilter');
   E.verify(marketFields,C.fields(filter));ownClick(button(filter,/^Save$/i));
   await wait(()=>!filter.isConnected||!C.visible(filter),Math.min(deadline,Date.now()+5000),'RZone did not save the Market Trend Filter settings.');
   const savedFilter=C.getMarketTrend?.();if(!savedFilter)throw Error('The Market Trend Filter save was not recorded.');E.verify(marketFields,savedFilter.fields);
  }
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
   E.verifySettings(E.expected(e,t),r);
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
for(const type of ['click','input','change'])document.addEventListener(type,event=>{if(!writing&&event.isTrusted&&!C.host.contains(event.target)){for(const [container,stage]of [[C.main(),'momentum'],[C.popup('Momentum Trading BackTest'),'execution'],[C.popup('Market Trend Filter'),'marketFilter']]){if(!container)continue;const nodes=inputs(container),rows=stageRows(stage,container);if(['input','change'].includes(type)){selectedRules.delete(event.target);for(const row of rows)if(event.target===nodes[row.parentIndex])selectedRules.delete(nodes[row.childIndex]);}if(type==='click'&&event.target.closest?.('.ind-list li[sbid]'))for(const row of rows)if(ruleSearch(nodes[row.childIndex]))selectedRules.delete(nodes[row.childIndex]);}if(active||configuring)interrupted=true;}},true);
async function tick(){if(polling)return;polling=true;try{const r=await send({action:'hello',...sourceStatus(),failed});if(r.id&&!active&&!configuring&&!failed){const job=await send({action:'claim',id:r.id});if(job.trial)void run(job);}}catch{/* Reload invalidates the document; do not keep sending or submit again. */failed=true;}finally{polling=false;}}
window.VaultRunner={get active(){return active;},apply};
const timer=setInterval(tick,3000);void tick();window.addEventListener('pagehide',()=>{clearInterval(timer);interrupted=true;},{once:true});
})();
