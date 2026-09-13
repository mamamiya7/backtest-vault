'use strict';
importScripts('core.js','presentation.js','intelligence.js','experiments.js','experiment-coordinator.js');
const coordinator=VaultExperimentCoordinator.createCoordinator({storage:chrome.storage.local,runtime:chrome.runtime});
chrome.action.onClicked.addListener(() => chrome.tabs.create({url: chrome.runtime.getURL('index.html')}));
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if(message?.type==='vault-experiment'){coordinator.handle(message,sender).then(reply,error=>reply({ok:false,error:error.message}));return true;}
  if (message.type === 'open-vault' && sender.url?.startsWith('https://zone.definedgesecurities.com/')) {
    chrome.tabs.create({url: chrome.runtime.getURL('index.html')});
    reply({ok: true});
  }
});
