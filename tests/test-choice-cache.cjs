/* Daily menus never replace current source settings or execution evidence. */
const assert=require('node:assert/strict');
const {createCoordinator}=require('../dist/experiment-coordinator.js');
const S=require('../dist/setup.js'),L=require('../dist/source-layouts.js');
const clone=x=>structuredClone(x);
const session='fictional-source-session',tabId=42,key='runner:choices:'+tabId,sharedKey='runner:choices:shared-native';
const runtime={id:'cache-tests',getURL:p=>'chrome-extension://cache-tests/'+p};
const dashboard={id:runtime.id,url:runtime.getURL('index.html')};
const source={id:runtime.id,url:'https://zone.definedgesecurities.com/index.html#research',tab:{id:tabId}};
const payload=(main='Candle',execution=main)=>{const template=S.demoTemplate({momentumChart:main,executionChart:execution});return {schemaVersion:1,adapterVersion:L.version,session,stages:Object.fromEntries([['momentum',main],['execution',execution]].map(([stage,chart])=>{const descriptor=template.stages[stage],layout=L.stage(stage,descriptor.fields);return [stage,{context:{chart,[stage==='momentum'?'market':'selection']:stage==='momentum'?'NSE':'Price',...(Number.isInteger(layout.modeIndex)?{mode:descriptor.fields[layout.modeIndex].value}:{}),categories:layout.rows.map(row=>[row.parentIndex,descriptor.fields[row.parentIndex].value])},signature:descriptor.fields.map(field=>[field.type,field.label]),nativeOptions:Object.fromEntries(Object.entries(descriptor.options).filter(([index])=>descriptor.fields[index].type==='select-one')),ruleCatalogues:{},...(stage==='momentum'?{groupOptions:[{label:'Fictional group',value:'Fictional group',disabled:false}]}:{})}];}))};};
async function harness(){
 let now=new Date(2026,8,16,12,0,0).getTime(),replySession=session,sourceSession=session,failWrite=false,respond=null;
 const memory={},calls=[];
 const storage={get:async k=>clone(k?{[k]:memory[k]}:memory),set:async values=>{if(failWrite&&Object.hasOwn(values,key))throw Error('Storage unavailable');Object.assign(memory,clone(values));}};
 const c=createCoordinator({storage,runtime,clock:()=>now,probe:async()=>({session:sourceSession,capable:true,ready:true,chart:'Candle'}),configure:async(id,changes,lookup,options)=>{
  calls.push(clone({id,changes,lookup,options}));
  if(respond)return respond(calls.at(-1));
  const config=S.demoTemplate();config.demo=false;config.session=replySession;config.capturedAt=new Date(now).toISOString();config.stages.momentum.fields[12].value=String(252+calls.length);
  const choiceCache=payload(options.warmChart||'Candle');choiceCache.session=replySession;
  return {ok:true,session:replySession,config,choiceCache,choicesFromCache:options.cachedChoices.some(p=>JSON.stringify(p.stages.momentum.context)===JSON.stringify(choiceCache.stages.momentum.context)),sharedChoicesUsed:options.cachedChoices.some(p=>p.publicOnly===true)};
 }});
 await c.handle({action:'hello',session,ready:true,capable:true},source);
 return {memory,calls,c,call:(extra={},sender=dashboard)=>c.handle({action:'configure',tabId,...extra},sender),reload:async next=>{replySession=sourceSession=next;await c.handle({action:'hello',session:next,ready:true,capable:true},source);},setTime:v=>{now=v;},getTime:()=>now,setReplySession:v=>{replySession=v;},setSourceSession:v=>{sourceSession=v;},failWrites:v=>{failWrite=v;},respond:v=>{respond=v;}};
}
(async()=>{
 const h=await harness();
 let first=await h.call();assert.deepEqual(h.calls[0].options,{cachedChoices:[],forceChoices:false});assert.deepEqual(first.source.choiceCache.charts,['Candle']);assert.deepEqual(first.source.choiceCache.pendingCharts,['P&F','Renko']);assert.equal(first.source.choiceCache.source,'live');
 const initialTime=first.source.choiceCache.checkedAt;
 h.setTime(h.getTime()+60000);let second=await h.call();assert.equal(h.calls[1].options.cachedChoices.length,1);assert.equal(second.source.choiceCache.source,'cache');assert.equal(second.source.choiceCache.checkedAt,initialTime,'A hit does not pretend the menus were fetched again');assert.notEqual(second.source.stages.momentum.fields[12].value,first.source.stages.momentum.fields[12].value,'Current settings must be freshly returned even on a menu hit');
 await h.call({warmChart:'P&F'});let complete=await h.call({warmChart:'Renko'});assert.deepEqual(complete.source.choiceCache.charts,L.charts);assert.deepEqual(complete.source.choiceCache.pendingCharts,[]);assert.equal(h.calls.at(-1).options.warmChart,'Renko');
 assert.deepEqual(Object.keys(h.memory).sort(),[key,sharedKey,'runner:tab:'+tabId].sort(),'Choice reads cannot create runs, experiments or execution leases');
 const recorded=clone(h.memory[key]);
 await h.call({recheckAllChoices:true});assert.equal(h.calls.at(-1).options.forceChoices,true);assert.deepEqual(h.calls.at(-1).options.cachedChoices,[]);assert.equal(h.memory[key].records.length,1,'Manual refresh invalidates all cached chart menus, including unvisited charts');assert.equal(h.memory[sharedKey].records.length,1,'Manual refresh also invalidates every shared chart');
 h.memory[key]=clone(recorded);h.setTime(new Date(2026,8,17,0,0,1).getTime());await h.call();assert.deepEqual(h.calls.at(-1).options.cachedChoices,[],'The next local calendar day starts with a fresh scan');
 for(const corrupt of [s=>{s.version=L.version+1;},s=>{s.session='another-document';},s=>{s.records[0].payload.session='another-document';},s=>{s.records[0].payload.adapterVersion=L.version+1;},s=>{s.records[0].checkedAt='invalid';},s=>{s.records[0].checkedAt=new Date(h.getTime()+86400000).toISOString();},s=>{s.records[0].checkedAt=new Date(h.getTime()-86400000).toISOString();}]){
  const fresh=clone(h.memory[key]);fresh.records=fresh.records.slice(0,1);corrupt(fresh);h.memory[key]=fresh;delete h.memory[sharedKey];await h.call();assert.deepEqual(h.calls.at(-1).options.cachedChoices,[],'Wrong adapter, session, day, or timestamp must never be reused');
 }
 let count=h.calls.length;
 for(const request of [{recheckAllChoices:'yes'},{warmChart:'Heiken'},{warmChart:'Renko',changes:{momentum:{0:'Renko'}}}])await assert.rejects(h.call(request),/Invalid source choice refresh/);
 assert.equal(h.calls.length,count);await assert.rejects(h.call({},{...dashboard,url:'https://unrelated.invalid'}),/cannot control/);
 h.setReplySession('another-document');const before=clone(h.memory[key]);await assert.rejects(h.call(),/reloaded while connecting/);assert.deepEqual(h.memory[key],before);h.setReplySession(session);
 h.memory['runner:lease']={seenAt:h.getTime()};await assert.rejects(h.call(),/Finish or pause/);delete h.memory['runner:lease'];
 // A failed additional chart cannot erase already checked charts or claim completion.
 h.respond(()=>({ok:false,error:'Fictional chart restore failure'}));await assert.rejects(h.call({warmChart:'Renko'}),/restore failure/);assert.deepEqual(h.memory[key],before);h.respond(null);
 h.failWrites(true);const unsaved=await h.call({warmChart:'P&F'});assert.equal(unsaved.source.choiceCache.notSaved,true);assert.ok(unsaved.source.stages.momentum.fields.length,'A storage failure does not discard the fresh editable form');h.failWrites(false);
 // An expired source document cannot inherit a previous account/session cache.
 h.setSourceSession('new-document');count=h.calls.length;await assert.rejects(h.call(),/Open RZone|sign in|connect/);assert.equal(h.calls.length,count);
 // A registered page reload keeps daily public coverage without transferring
 // account-specific groups, My menus, selections or keyword search results.
 const daily=await harness();await daily.call();await daily.call({warmChart:'P&F'});const dailyComplete=await daily.call({warmChart:'Renko'}),dailyAt=dailyComplete.source.choiceCache.checkedAt;
 const privatePayload=daily.memory[key].records[0].payload;
 for(const stage of ['momentum','execution']){const layout=stage==='momentum'?L.main(privatePayload.stages[stage].context.chart):L.execution(privatePayload.stages[stage].context.chart);privatePayload.stages[stage].context.privateGroup='PRIVATE-CONTEXT';privatePayload.stages[stage].nativeOptions[99]=[{value:'PRIVATE-UNKNOWN',label:'PRIVATE-UNKNOWN'}];for(const row of layout.rows){const labels=[row.parentIndex,row.childIndex,row.valueIndex,row.gateIndex].filter(Number.isInteger).map(index=>privatePayload.stages[stage].signature[index][1]);privatePayload.stages[stage].nativeOptions[row.childIndex]=[{value:'PRIVATE-MENU',label:'PRIVATE-MENU'}];privatePayload.stages[stage].ruleCatalogues[row.childIndex]={parentIndex:row.parentIndex,gateIndex:row.gateIndex,categories:{My:[{label:'PRIVATE-RULE',value:'PRIVATE-RULE'}],Public:[{label:'PRIVATE-SEARCH',value:'PRIVATE-SEARCH'}],Pre:[{label:'Shared predefined',value:'Shared predefined',privateNote:'PRIVATE-OPTION'}],Popular:[{label:'Shared popular',value:'Shared popular'}]},controlTypes:{My:'select-one',Public:'text',Pre:'select-one',Popular:'select-one'},fieldLabels:{Pre:labels,Popular:labels},searchQueries:{Public:'PRIVATE-QUERY'}};}}
 daily.respond(()=>{const config=S.demoTemplate();config.session=session;return {ok:true,session,config,choiceCache:privatePayload};});await daily.call();daily.respond(null);
 const publicJSON=JSON.stringify(daily.memory[sharedKey]);assert.doesNotMatch(publicJSON,/PRIVATE-|Fictional group|groupOptions|searchQueries|"session"/);assert.match(publicJSON,/Shared predefined/);assert.match(publicJSON,/Shared popular/);
 daily.setTime(daily.getTime()+60000);await daily.reload('reloaded-source');const afterReload=await daily.call();assert.ok(daily.calls.at(-1).options.cachedChoices.every(p=>p.publicOnly===true),'Only public native catalogues may cross source documents');assert.deepEqual(afterReload.source.choiceCache.charts,L.charts,'Reload does not repeat automatic all-chart sweeps');assert.equal(afterReload.source.choiceCache.scope,'shared-native');assert.equal(afterReload.source.choiceCache.checkedAt,dailyAt);assert.equal(afterReload.source.session,'reloaded-source','The editable form stays bound to the fresh source session');assert.equal(daily.memory[key].records.length,1,'Old document-private choices are not copied to the new document');
 const newPageCalls=daily.calls.length;await daily.call();assert.equal(daily.calls.length,newPageCalls+1);assert.equal(daily.calls.at(-1).options.cachedChoices[0].publicOnly,undefined,'The new document can reuse its own freshly read private menus');
 // A shared cache is an allowlist, not a place to hide private rows or fields.
 const poisoned=await harness();await poisoned.call();poisoned.memory[sharedKey].records[0].payload.stages.momentum.groupOptions=[{label:'PRIVATE-GROUP'}];await poisoned.reload('other-account-document');await poisoned.call();assert.deepEqual(poisoned.calls.at(-1).options.cachedChoices,[],'A shared payload containing a group list is rejected wholesale');
 for(const corrupt of [p=>{p.stages.momentum.context.secret='PRIVATE-CONTEXT';},p=>{p.stages.momentum.context.categories[0]=[39,'Pre'];},p=>{p.stages.momentum.signature.push(['text','PRIVATE-FIELD']);},p=>{p.stages.momentum.signature[0].push('PRIVATE-EXTRA');},p=>{p.stages.momentum.signature[0][0]='password';},p=>{p.stages.momentum.nativeOptions[99]=[{value:'PRIVATE-MENU',label:'PRIVATE-MENU'}];},p=>{p.stages.momentum.nativeOptions[0][0].privateNote='PRIVATE-OPTION';},p=>{p.adapterVersion++;}]){
  const malformed=await harness();await malformed.call();corrupt(malformed.memory[sharedKey].records[0].payload);await malformed.reload('reloaded-document');await malformed.call();assert.deepEqual(malformed.calls.at(-1).options.cachedChoices,[],'Malformed shared context, signature and native options must not cross document boundaries');
 }
 const newTab=await harness();await newTab.call();await newTab.c.handle({action:'hello',session,ready:true,capable:true},{...source,tab:{id:99}});await newTab.call({tabId:99});assert.ok(newTab.calls.at(-1).options.cachedChoices.every(p=>p.publicOnly===true),'Another tab receives only shared source-wide choices');
 const mixed=await harness();mixed.respond(()=>{const config=S.demoTemplate();config.session=session;return {ok:true,session,config,choiceCache:payload('P&F','Candle')};});const oneStage=await mixed.call();assert.deepEqual(oneStage.source.choiceCache.charts,[],'Coverage needs both main and execution chart menus');
 mixed.respond(()=>{const config=S.demoTemplate();config.session=session;return {ok:true,session,config,choiceCache:{...payload(),session:'wrong'}};});await mixed.call();assert.equal(mixed.memory[key].records.length,1,'Invalid cache metadata is ignored, never persisted');
 mixed.respond(()=>({ok:true,session,config:{session},choiceCache:payload()}));const intact=clone(mixed.memory[key]);await assert.rejects(mixed.call());assert.deepEqual(mixed.memory[key],intact,'An invalid source form cannot populate the cache');
 // Crossing midnight during a cached read must not relabel yesterday's menus as new.
 for(const flags of [{choicesFromCache:true},{choicesFromCache:false,hasCachedChoices:true},{choicesFromCache:false}]){
  const midnight=await harness();midnight.setTime(new Date(2026,8,16,23,59,59).getTime());await midnight.call();midnight.respond(()=>{midnight.setTime(new Date(2026,8,17,0,0,1).getTime());const config=S.demoTemplate();config.session=session;return {ok:true,session,config,choiceCache:payload(),...flags};});const rolled=await midnight.call();assert.equal(rolled.source.choiceCache.checkedAt,null);assert.deepEqual(rolled.source.choiceCache.pendingCharts,L.charts,'An old stage cannot inherit today’s timestamp from a fresh stage');
 }
 console.log('PASS: daily shared menus survive registered reloads/new tabs; private menus stay document-scoped; fresh fields, all-chart coverage, force refresh, rollover, malformed payloads, authorization and storage recovery.');
})().catch(error=>{console.error(error);process.exitCode=1;});
