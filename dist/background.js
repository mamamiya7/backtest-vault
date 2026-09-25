'use strict';
importScripts('core.js','presentation.js','intelligence.js','source-layouts.js','setup.js','experiments.js','experiment-coordinator.js');
async function probe(tabId){
 let timeout;try{return await Promise.race([chrome.tabs.sendMessage(tabId,{type:'vault-runner-status'},{frameId:0}),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('RZone did not respond.')),2500);})]);}finally{clearTimeout(timeout);}
}
async function configure(tabId,changes={},lookup,choiceOptions={}){
 const deadline=Date.now()+60000,message='RZone did not finish connecting. Check its tab and reconnect.';
 let timeout,live=true;
 const current=()=>live&&Date.now()<deadline;
 const check=()=>{if(!current())throw Error(message);};
 const ownPage=url=>typeof url==='string'&&(url===chrome.runtime.getURL('index.html')||url.startsWith(chrome.runtime.getURL('index.html')+'?')||url.startsWith(chrome.runtime.getURL('index.html')+'#'));
 const work=async()=>{
  let source,previous;
  try{
   source=await chrome.tabs.get(tabId);check();
   const tabs=await chrome.tabs.query({active:true,windowId:source.windowId});check();
   previous=tabs.find(tab=>ownPage(tab.url)&&(!tab.pendingUrl||ownPage(tab.pendingUrl)));
   // RZone animates its dialogs. Keep its rendering active while reading and
   // closing the settings we opened; hidden tabs may pause that animation.
   await chrome.tabs.update(tabId,{active:true});check();
   const message=lookup?{type:lookup.kind==='symbol'?'vault-runner-symbol-search':'vault-runner-rule-search',...Object.fromEntries(Object.entries(lookup).filter(([key])=>key!=='kind'))}:{type:'vault-runner-config',changes,...choiceOptions};
   return await chrome.tabs.sendMessage(tabId,message,{frameId:0});
  }finally{
   if(previous&&source&&current()){
    try{
     const tabs=await chrome.tabs.query({active:true,windowId:source.windowId});
     if(current()&&tabs.some(tab=>tab.id===tabId)){
      const tab=await chrome.tabs.get(previous.id);
      if(current()&&tab.windowId===source.windowId&&ownPage(tab.url)&&(!tab.pendingUrl||ownPage(tab.pendingUrl))){
       // Recheck after the lookup so a user switch is not overwritten.
       const active=await chrome.tabs.query({active:true,windowId:source.windowId});
       if(current()&&active.some(tab=>tab.id===tabId))await chrome.tabs.update(previous.id,{active:true});
      }
     }
    }catch{/* A closed or changed Vault tab must not turn a successful read into a failure. */}
   }
  }
 };
 try{return await Promise.race([work(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error(message)),60000);})]);}finally{live=false;clearTimeout(timeout);}
}
async function openSource(knownTabs){
 for(const tab of [...knownTabs].sort((a,b)=>b.seenAt-a.seenAt)){
  try{const status=await probe(tab.id);if(status?.session===tab.session){await chrome.tabs.update(tab.id,{active:true});return {tabId:tab.id};}}catch{/* Closed/reloaded tabs cannot be reused. */}
 }
 const tab=await chrome.tabs.create({url:'https://zone.definedgesecurities.com/index.html#research'});return {tabId:tab.id};
}
const coordinator=VaultExperimentCoordinator.createCoordinator({storage:chrome.storage.local,runtime:chrome.runtime,probe,configure,openSource});
chrome.action.onClicked.addListener(() => chrome.tabs.create({url: chrome.runtime.getURL('index.html')}));
async function openVault(message){
 let url=chrome.runtime.getURL('index.html');
 if(Object.hasOwn(message,'runId')){
  const id=message.runId;
  if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,120}$/.test(id))throw Error('The saved run link is invalid.');
  const key='run:'+id,stored=await chrome.storage.local.get(key),run=stored[key];
  if(!run||run.id!==id||run.demo===true||run.source!=='https://zone.definedgesecurities.com/index.html#research')throw Error('This saved run is no longer available in Vault.');
  Vault.validate(run);
  url+='?run='+encodeURIComponent(id);
 }
 await chrome.tabs.create({url});
 return {ok:true};
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if(message?.type==='vault-experiment'){coordinator.handle(message,sender).then(result=>{
    if(message.action==='start'&&result.ok)void chrome.tabs.sendMessage(message.tabId,{type:'vault-runner-wake'},{frameId:0}).catch(()=>{});
    reply(result);
  },error=>reply({ok:false,error:error.message}));return true;}
  if (message?.type === 'open-vault' && sender.id===chrome.runtime.id && Number.isInteger(sender.tab?.id) && (sender.frameId??0)===0 && sender.url?.startsWith('https://zone.definedgesecurities.com/')) {
    openVault(message).then(reply,error=>reply({ok:false,error:error.message}));
    return true;
  }
});
