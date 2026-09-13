'use strict';
chrome.action.onClicked.addListener(() => chrome.tabs.create({url: chrome.runtime.getURL('index.html')}));
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message.type === 'open-vault' && sender.url?.startsWith('https://zone.definedgesecurities.com/')) {
    chrome.tabs.create({url: chrome.runtime.getURL('index.html')});
    reply({ok: true});
  }
});
