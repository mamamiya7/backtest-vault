'use strict';
importScripts('core.js','presentation.js','intelligence.js','setup.js','experiments.js','experiment-coordinator.js');
async function probe(tabId){
 let timeout;try{return await Promise.race([chrome.tabs.sendMessage(tabId,{type:'vault-runner-status'},{frameId:0}),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('RZone did not respond.')),2500);})]);}finally{clearTimeout(timeout);}
}
async function configure(tabId,changes={}){
 let timeout;try{return await Promise.race([chrome.tabs.sendMessage(tabId,{type:'vault-runner-config',changes},{frameId:0}),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('RZone did not finish connecting. Check its tab and reconnect.')),60000);})]);}finally{clearTimeout(timeout);}
}
async function openSource(knownTabs){
 for(const tab of [...knownTabs].sort((a,b)=>b.seenAt-a.seenAt)){
  try{const status=await probe(tab.id);if(status?.session===tab.session){await chrome.tabs.update(tab.id,{active:true});return {tabId:tab.id};}}catch{/* Closed/reloaded tabs cannot be reused. */}
 }
 const tab=await chrome.tabs.create({url:'https://zone.definedgesecurities.com/index.html#research'});return {tabId:tab.id};
}
const coordinator=VaultExperimentCoordinator.createCoordinator({storage:chrome.storage.local,runtime:chrome.runtime,probe,configure,openSource});
chrome.action.onClicked.addListener(() => chrome.tabs.create({url: chrome.runtime.getURL('index.html')}));
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if(message?.type==='vault-experiment'){coordinator.handle(message,sender).then(result=>{
    if(message.action==='start'&&result.ok)void chrome.tabs.sendMessage(message.tabId,{type:'vault-runner-wake'},{frameId:0}).catch(()=>{});
    reply(result);
  },error=>reply({ok:false,error:error.message}));return true;}
  if (message.type === 'open-vault' && sender.url?.startsWith('https://zone.definedgesecurities.com/')) {
    chrome.tabs.create({url: chrome.runtime.getURL('index.html')});
    reply({ok: true});
  }
});
