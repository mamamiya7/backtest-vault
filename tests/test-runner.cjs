/* Full DOM → submission → pagination → durable save → next-trial integration. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const E=require('../dist/experiments.js'),S=require('../dist/setup.js'),D=require('../dist/demo.js'),{createCoordinator}=require('../dist/experiment-coordinator.js');
const base=path.resolve(__dirname,'../dist'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const requestedCatalogue=process.argv.find(argument=>argument.startsWith('--catalogue-case='))?.slice('--catalogue-case='.length);
if(requestedCatalogue&&!['complete','delayed','empty','rejected','execute'].includes(requestedCatalogue))throw Error('Unknown runner catalogue case: '+requestedCatalogue);
const reordered=x=>Array.isArray(x)?x.map(reordered):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,reordered(x[k])])):x;
async function scenario(options={}){
 const {changeLocked=false,overlap=false,staleCompletion=false,rejected=false,reuseReport=false,noRunning=false,preexistingReport=false,vaultSetup=false,missingGroup=false,changedOptions=false,driftDuringRun=false,refreshParents=false,noOptionRefresh=false,emptyOptions=false,variableSet='',bridge=false,closeAfterWake=false,closeStuckAfterWake=false,groupCatalogue='',ruleCatalogue=''}=options;
 const dom=new JSDOM('<body><h1 class="header-text">Momentum Trading BackTesting<div class="tooltip">i</div></h1><div class="account-right"></div></body>',{runScripts:'outside-only',url:'https://zone.definedgesecurities.com/index.html#research'}),w=dom.window,d=w.document;
 const fixture=D.create()[0];fixture.demo=false;w.structuredClone=structuredClone;
 Object.defineProperty(w.HTMLElement.prototype,'innerText',{get(){return this.textContent;}});
 w.Element.prototype.getClientRects=function(){return this.isConnected&&!this.closest('[hidden]')&&!this.closest('[style*="display: none"]')?[{width:100,height:20}]:[];};
 const nativeTimeout=w.setTimeout.bind(w),nativeInterval=w.setInterval.bind(w);w.setTimeout=(fn,ms)=>nativeTimeout(fn,Math.min(ms,20));w.setInterval=(fn,ms)=>nativeInterval(fn,Math.min(ms,30));
 const main=d.querySelector('.account-right'),categoryLoads=[];
 function form(container,fields){const table=d.createElement('table');for(const f of fields){const tr=d.createElement('tr'),td=d.createElement('td'),cell=d.createElement('td');td.textContent=f.label;let n;if(f.type==='select-one'){n=d.createElement('select');const choices=[f.value,...(/Allocation/.test(f.label)?['Fixed','Reinvestment']:/Timeframe|Str \d/.test(f.label)&&f.value==='Daily'?['Weekly']:f.value==='Pre'?['My']:f.value.startsWith('Demo ')?[f.value.replace(/^Demo /,'Alternate ')]:[])];for(const value of new Set(choices)){const o=d.createElement('option');o.textContent=value;o.value='source:'+value;n.append(o);}n.value='source:'+f.value;}else {n=d.createElement('input');n.type=f.type;n.value=f.value;if(f.checked!==null)n.checked=f.checked;if(f.type==='radio')n.name=/52 Week/.test(f.label)?'reference':'volume';}n.disabled=f.disabled;cell.append(n);tr.append(td,cell);table.append(tr);}container.append(table);
  if(vaultSetup){const nodes=[...table.querySelectorAll('input,select')],stage=fields.length===52?'momentum':fields.length===12?'execution':'portfolio';const gates=stage==='momentum'?[[4,5,6,7,8,9,10],[11,12],[13,14],[15,16],[17,18],[26,27],[28,29],[30,31],[34,35,36],[37,38],[42,39,40,41],[46,43,44,45],[50,47,48,49]]:stage==='execution'?[[5,6,7],[8,9],[10,11]]:[[4,5]];for(const [gate,...children]of gates){const update=()=>children.forEach(i=>nodes[i].disabled=!nodes[gate].checked);nodes[gate].addEventListener('change',update);update();}
   for(const index of stage==='momentum'?[35,39,43,47]:stage==='execution'?[6]:[]){
    const target=nodes[index+1],strategy=stage==='momentum'&&[39,43,47].includes(index),number=strategy?(index-35)/4:null;
    const predefined=[...target.options].map(o=>({label:o.textContent,value:o.value}));
    for(const category of ruleCatalogue?['Public','Popular']:[])if(![...nodes[index].options].some(o=>o.textContent===category)){const option=d.createElement('option');option.textContent=category;option.value='source:'+category;nodes[index].append(option);}
    const available=category=>{
     if(emptyOptions&&category==='My'||ruleCatalogue==='empty'&&strategy&&['My','Public'].includes(category))return [];
     if(ruleCatalogue&&strategy)return ['first','second'].map(word=>({label:'Strategy '+number+' '+category+' '+word,value:'rule:'+number+':'+category+':'+word}));
     if(category==='Pre')return predefined;
     return [category+' trend rule',category+' alternate rule'].map(label=>({label,value:'custom:'+label}));
    };
    const populate=category=>{target.replaceChildren();for(const choice of available(category)){const option=d.createElement('option');option.textContent=choice.label;option.value=choice.value;target.append(option);}};
    if(ruleCatalogue&&strategy){
     const category=number===1?'Popular':'Pre';nodes[index].value='source:'+category;populate(category);target.selectedIndex=target.options.length-1;
     nodes[index+2].value=number===1?'source:Weekly':'source:Daily';nodes[index+3].checked=number===1;nodes[index+3].dispatchEvent(new w.Event('change',{bubbles:true}));
    }
    nodes[index].addEventListener('change',()=>{
     const category=nodes[index].selectedOptions[0]?.textContent;categoryLoads.push({stage,index,category,enabled:!nodes[index].disabled});
     if(noOptionRefresh||ruleCatalogue==='rejected'&&index===43&&category==='Public')return;
     nativeTimeout(()=>populate(category),ruleCatalogue==='delayed'&&strategy&&category==='Public'?1100:300);
    });
   }
  }
 }
 function button(p,label,fn){const n=d.createElement('button');n.textContent=label;n.onclick=fn;p.append(n);return n;}
 function popup(title){const p=d.createElement('div');p.className='popupContent';const h=d.createElement('div');h.className='custom-dialog-header';const caption=d.createElement('div');caption.className='caption';caption.textContent=title;const close=d.createElement('a');close.className='close-buton';close.onclick=()=>{
  if(title==='Momentum Trading BackTest'&&(closeAfterWake||closeStuckAfterWake)){
   // Model a hidden page waking after the deadline: the close animation may
   // already have removed the owned node before the next poll can run.
   const now=w.Date.now.bind(w.Date);nativeTimeout(()=>{if(closeAfterWake)p.remove();w.Date.now=()=>now()+6000;},5);
  }else p.remove();
 };h.append(caption,close);p.append(h);d.body.append(p);return p;}
 form(main,E.fields(fixture,'momentum'));let submissions=0,portfolios=0,priorReport=null,groupCommits=0,settingsReads=0;const guardedStates=[],savedBeforeNext=[],strategyNativeSubmissions=[];
 const groupSearches=[],groupRows=['Demo universe 40','Nifty 50 Index','Nifty 500 Index','Other index'];let groupMenuReads=0,groupChanges=0,lastGroupQuery;
 if(vaultSetup){
  const group=main.querySelectorAll('input,select')[1];group.placeholder='Search Group';
  if(groupCatalogue==='blank')group.value='';
  if(['delayed','late-restore'].includes(groupCatalogue))group.value='Nifty';
  let menu=null,pending=[];
  const cancelSearches=()=>{pending.forEach(w.clearTimeout);pending=[];};
  const render=(names,query)=>{
   if(groupCatalogue==='missing')return;
   if(missingGroup&&query)names=[];
   if(!menu?.isConnected){menu=d.createElement('div');menu.className='popupContent';menu.innerHTML='<div class="abcd-1"><ul class="ind-list"></ul></div>';d.body.append(menu);}
   const list=menu.querySelector('.ind-list');list.replaceChildren();
   for(const [i,name]of names.entries()){
    const li=d.createElement('li');li.setAttribute('grpid','group:'+i);li.textContent=name;
    li.onclick=()=>{group.value=name;groupCommits++;cancelSearches();menu.remove();};list.append(li);
   }
   groupMenuReads++;lastGroupQuery=query;
  };
  const names=query=>groupCatalogue==='duplicate'&&!query?['Same group','Same group']:groupCatalogue==='overflow'&&!query?Array.from({length:3001},(_,i)=>'Group '+i):groupRows.filter(name=>!query||name.toLowerCase().includes(query.toLowerCase()));
  group.addEventListener('change',()=>groupChanges++);
  group.addEventListener('click',()=>{groupSearches.push(['open',group.value]);render(names(group.value),group.value);});
  group.addEventListener('keyup',()=>{
   cancelSearches();const query=group.value;groupSearches.push(['search',query]);
   if(groupCatalogue==='delayed'&&!query){render(groupRows.filter(name=>name.startsWith('Nifty')),query);pending.push(nativeTimeout(()=>render(names(query),query),1200));}
   else pending.push(nativeTimeout(()=>render(names(query),query),groupCatalogue==='late-restore'&&query?1800:180));
  });
  d.querySelector('h1').addEventListener('click',()=>{cancelSearches();menu?.remove();});
 }
 const oldHiddenReport=preexistingReport?popup('Portfolio Backtesting Report'):null;if(oldHiddenReport)oldHiddenReport.hidden=true;
 // Observed RZone lifecycle: one main button becomes Cancel, the setup remains
 // open during Processing, and completion removes that setup automatically.
 const done=d.createElement('span');done.textContent='BackTest Completed.';main.append(done);let cancel;
 cancel=button(main,'BackTest',()=>{settingsReads++;const p=popup('Momentum Trading BackTest');form(p,E.fields(fixture,'execution'));button(p,'Backtest',()=>{
  if(ruleCatalogue==='execute'){const controls=main.querySelectorAll('input,select');strategyNativeSubmissions.push([39,43,47].map(index=>({category:controls[index].value,rule:controls[index+1].value,enabled:controls[index+3].checked})));}
  if(submissions&&plan)savedBeforeNext.push(!!memory['run:'+plan.trials[submissions-1].runId]);submissions++;if(rejected){popup('Error');return;}
  if(driftDuringRun)nativeTimeout(()=>{main.querySelectorAll('input,select')[1].value='Manual drift';},100);
  if(!overlap&&!staleCompletion&&!noRunning)done.textContent='Processing';
  if(!noRunning)cancel.textContent='Cancel BackTest';
  if(overlap||staleCompletion||noRunning)nativeTimeout(()=>{
   guardedStates.push({stage:'old-completion',completed:w.VaultCapture.getStrategy()?.completed,portfolios});
   if(overlap)done.textContent='Processing';
  },60);
  nativeTimeout(()=>{cancel.textContent='BackTest';done.textContent='BackTest Completed.';p.remove();},160);
  if(staleCompletion||noRunning)nativeTimeout(()=>{guardedStates.push({stage:'unconfirmed-finish',completed:w.VaultCapture.getStrategy()?.completed,portfolios});popup('Error');},240);
 });});
 button(main,'Portfolio Testing',()=>{const p=popup('Portfolio Backtesting');form(p,E.fields(fixture,'portfolio'));button(p,'Backtest',()=>{portfolios++;
 if(reuseReport&&priorReport){d.body.append(priorReport);return;}
 const report=oldHiddenReport||popup('Portfolio Backtesting Report');report.hidden=false;priorReport=report;const tabs=d.createElement('div');for(const name of ['Quick Stats','Statistics','Charts','Trade Details']){const tab=d.createElement('div');tab.setAttribute('role','tab');tab.textContent=name;tab.onclick=()=>{for(const t of tabs.children)t.className='';tab.className='selected';};tabs.append(tab);}report.append(tabs);
 const panel=d.createElement('div');panel.setAttribute('role','tabpanel');panel.innerHTML='<div class="stats-card"><div class="status">Total no. of Trades</div><div class="amt">4</div></div><div class="stats-card"><div class="status">Gross Total Returns( % )</div><div class="amt">10%</div></div><table class="dropdown-table-body"><tr><td>Group</td><td>Demo universe 40</td></tr></table>'+Array.from({length:6},(_,i)=>'<svg class="highcharts-root" xmlns="http://www.w3.org/2000/svg"><title>Chart '+i+'</title><path d="M0 0 L20 10"/></svg>').join('')+'<table class="rade-result-detail"></table><span id="curPageTextEle">1</span><span id="lastPageTextEle">2</span><img src="/firstPage.png"><img src="/next.png">';report.append(panel);
 function page(n){panel.querySelector('#curPageTextEle').textContent=n;panel.querySelector('table.rade-result-detail').innerHTML='<tr><th>Sr #</th><th>Symbol</th><th>Qty</th></tr>'+[n*2-1,n*2].map(i=>'<tr><td>'+i+'</td><td>TEST'+i+'</td><td>'+ (i===2?0:10)+'</td></tr>').join('');}panel.querySelector('img[src$="firstPage.png"]').onclick=()=>page(1);panel.querySelector('img[src$="next.png"]').onclick=()=>page(2);page(1);
 });});
 const memory={},runtime={id:'test-ext',getURL:p=>'chrome-extension://test-ext/'+p},source={id:'test-ext',url:w.location.href,tab:{id:9}},dashboard={id:'test-ext',url:runtime.getURL('index.html')};let uid=0;
 const storage={get:async key=>reordered(key?{[key]:E.clone(memory[key]??null)}:E.clone(memory)),set:async data=>Object.assign(memory,E.clone(data))};const coordinator=createCoordinator({storage,runtime,uuid:()=> 'test-id-'+(++uid)});
 const listeners=[],workerListeners=[],sourceMessages=[],sourceSuccessDialogs=[];let bridgeConfigRequests=0;
 if(bridge){
  // Exercise the actual worker -> coordinator -> content-script boundary. A
  // delayed reply is valid only when its listener retained the message port.
  const deliver=(handlers,message,sender)=>new Promise((resolve,reject)=>{
   let replied=false,open=false,listening=true;
   const reply=response=>{if(replied)return;if(!listening&&!open){reject(Error('Asynchronous response port was not retained.'));return;}replied=true;resolve(E.clone(response));};
   try{for(const fn of handlers)if(fn(E.clone(message),sender,reply)===true)open=true;listening=false;if(!replied&&!open)resolve(undefined);}catch(error){reject(error);}
  });
  let activeTab=10;const focusEvents=[];
  const vm=require('node:vm'),workerChrome={storage:{local:storage},runtime:{...runtime,onMessage:{addListener:fn=>workerListeners.push(fn)}},action:{onClicked:{addListener:()=>{}}},tabs:{
   sendMessage:(id,message,options)=>{assert.equal(id,9);assert.equal(options.frameId,0);if(message.type==='vault-runner-config'){bridgeConfigRequests++;assert.equal(activeTab,9,'RZone must be active before its settings are read.');focusEvents.push('read');}return deliver(listeners,message,{id:runtime.id,url:runtime.getURL('background.js')});},
   get:async id=>({id,windowId:1,url:id===9?w.location.href:runtime.getURL('index.html')}),
   query:async query=>{assert.deepEqual({...query},{active:true,windowId:1});return [{id:activeTab,windowId:1,url:activeTab===9?w.location.href:runtime.getURL('index.html')}];},
   update:async(id,update)=>{assert.equal(update.active,true);activeTab=id;focusEvents.push('active:'+id);return {id};},create:async ()=>({id:10})
  }};
  const context=vm.createContext({chrome:workerChrome,URL,crypto:require('node:crypto').webcrypto,structuredClone,setTimeout,clearTimeout});
  context.importScripts=(...files)=>files.forEach(file=>vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),context,{filename:file}));
  vm.runInContext(fs.readFileSync(path.join(base,'background.js'),'utf8'),context,{filename:'background.js'});
  coordinator.handle=async(message,sender)=>{const result=await deliver(workerListeners,{type:'vault-experiment',...message},sender);if(message.action==='configure'&&bridgeConfigRequests){assert.equal(activeTab,10,'Return to the initiating Vault after a read or source rejection.');assert.deepEqual(focusEvents,Array.from({length:bridgeConfigRequests},()=>['active:9','read','active:10']).flat());}return result;};
 }
 const sourceFailures=[];
 w.chrome={storage:{local:storage},runtime:{...runtime,sendMessage:async m=>{try{const r=await coordinator.handle(m,source);if(!r?.ok)sourceFailures.push(r);return r;}catch(error){sourceFailures.push(error.message);throw error;}},onMessage:{addListener:fn=>listeners.push(fn)}}};
 w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
 for(const file of ['core.js','presentation.js','intelligence.js','setup.js','experiments.js','capture.js'])w.eval(fs.readFileSync(path.join(base,file),'utf8'));
 if(vaultSetup){const status=w.VaultCapture.status;w.VaultCapture.status=message=>{sourceMessages.push(message);if(message==='RZone settings read. Return to Vault to finish setup.')sourceSuccessDialogs.push(!!w.VaultCapture.popup('Momentum Trading BackTest'));status(message);};}
 // Build the baseline from the same visible form labels the saver records.
 fixture.parameters.strategy.main.fields=JSON.parse(JSON.stringify(w.VaultCapture.fields(main)));
 const bp=popup('Baseline fixture');form(bp,E.fields(fixture,'execution'));fixture.parameters.strategy.execution.fields=JSON.parse(JSON.stringify(w.VaultCapture.fields(bp)));bp.remove();const pp=popup('Baseline portfolio');form(pp,E.fields(fixture,'portfolio'));fixture.parameters.settings.fields=JSON.parse(JSON.stringify(w.VaultCapture.fields(pp)));pp.remove();
 let plan;
 if(!vaultSetup){plan=E.create({id:'runner-proof',name:'Runner proof',baseline:E.baseline(fixture),dimensions:[{key:'momentum.period.1',values:'126,180,252'}],minTrades:0});memory['experiment:'+plan.id]=plan;}
 if(changeLocked)main.querySelectorAll('input')[0].value='Unexpected group';
 w.eval(fs.readFileSync(path.join(base,'runner.js'),'utf8'));
 try{for(let n=0;n<50&&!memory['runner:tab:9'];n++)await sleep(10);
  const probe=()=>{let status;for(const fn of listeners)fn({type:'vault-runner-status'},{id:runtime.id},r=>status=r);return status;};
  assert.equal(probe().ready,true,JSON.stringify({status:probe(),sourceFailures}));assert.equal(probe().session,memory['runner:tab:9'].session);
  const blockedDialog=popup('Existing report');assert.equal(probe().ready,false);assert.match(probe().reason,/Close/);blockedDialog.remove();
  cancel.textContent='Cancel BackTest';assert.equal(probe().ready,false);assert.match(probe().reason,/already running/);cancel.textContent='BackTest';
  const pending=popup('Momentum Trading BackTest');button(pending,'Backtest',()=>{}).click();pending.remove();assert.equal(probe().ready,false);assert.match(probe().reason,/earlier source submission/);const rejectedPending=popup('Error');w.VaultCapture.monitor();rejectedPending.remove();assert.equal(probe().ready,true);
  let untrustedReply=false;for(const fn of listeners)fn({type:'vault-runner-status'},{id:'other-extension'},()=>untrustedReply=true);assert.equal(untrustedReply,false);
  if(vaultSetup){
   const requestConfig=changes=>bridge?coordinator.handle({action:'configure',tabId:9,changes},dashboard).then(response=>({...response,config:response.source})):new Promise(resolve=>{for(const fn of listeners)fn({type:'vault-runner-config',changes},{id:runtime.id},resolve);});
   let navigationCount=0,cataloguedResponse;
   if(refreshParents){main.hidden=true;d.querySelector('h1').textContent='Research dashboard';const nav=d.createElement('li');nav.setAttribute('token','bt');nav.textContent='Back Testing';nav.onclick=()=>{navigationCount++;nativeTimeout(()=>{const menu=d.createElement('div');menu.className='tool-popup';menu.innerHTML='<div class="popupContent"><div><ul class="Fav-menu"><li><a href="javascript:;"><span><div><span class="favourite-fill"></span><div class="scanner-name-scroll">Momentum Trading Back Testing</div></div></span></a></li></ul></div></div>';menu.querySelector('a').onclick=()=>{menu.remove();main.hidden=false;d.querySelector('h1').textContent='Momentum Trading BackTesting';};d.body.append(menu);},100);};d.body.append(nav);assert.equal(probe().ready,false);assert.equal(probe().capable,true);}
   const existing=popup('Existing user report'),blocked=await requestConfig();assert.equal(blocked.ok,false);assert.equal(existing.isConnected,true);assert.equal(submissions,0);existing.remove();
   const unsupported=await requestConfig({momentum:{0:'Renko'}});assert.equal(unsupported.ok,false);assert.equal(main.querySelector('select').selectedOptions[0].textContent,'Candle');
   if(ruleCatalogue){
    const before=JSON.stringify(w.VaultCapture.fields(main)),nativeBefore=[...main.querySelectorAll('input,select')].map(n=>n.value);
    const existingSettings=popup('Momentum Trading BackTest'),blockedSettings=await requestConfig();assert.equal(blockedSettings.ok,false);assert.equal(existingSettings.isConnected,true);assert.equal(categoryLoads.length,0);assert.equal(groupSearches.length,0);existingSettings.remove();
    const response=await requestConfig();
    assert.equal(JSON.stringify(w.VaultCapture.fields(main)),before,'Restore every main field, including disabled flags, after category discovery.');
    assert.deepEqual([...main.querySelectorAll('input,select')].map(n=>n.value),nativeBefore,'Restore the exact native option IDs and selected values.');
    assert.equal(submissions,0);assert.equal(portfolios,0);assert.equal(groupCommits,0);assert.equal(w.VaultCapture.popup('Momentum Trading BackTest'),undefined);
    assert.ok(categoryLoads.every(request=>request.enabled),'Every parent request must occur with its strategy checkbox enabled.');
    if(ruleCatalogue==='rejected'){
     assert.equal(response.ok,false);assert.match(response.error,/dependent choices|took too long/);assert.equal(settingsReads,0);assert.equal(sourceSuccessDialogs.length,0);
     assert.equal(categoryLoads.some(request=>request.index===47),false,'Stop the catalogue after a failed row rather than reading later strategies.');
    }else{
     assert.equal(response.ok,true,JSON.stringify({ruleCatalogue,error:response.error,categoryLoads}));assert.equal(settingsReads,1);
     const momentum=response.config.stages.momentum;assert.equal(momentum.fields.length,52);assert.equal(JSON.stringify(momentum.fields),before);
     assert.deepEqual(Object.keys(momentum.ruleCatalogues),['40','44','48']);
     for(let number=1;number<=3;number++){
      const parent=35+number*4,child=parent+1,catalogue=momentum.ruleCatalogues[child];
      assert.equal(catalogue.parentIndex,parent);assert.equal(catalogue.gateIndex,parent+3);assert.deepEqual(Object.keys(catalogue.categories).sort(),['My','Popular','Pre','Public']);
      for(const category of ['Pre','My','Public','Popular']){
       const expected=ruleCatalogue==='empty'&&['My','Public'].includes(category)?[]:['first','second'].map(word=>'Strategy '+number+' '+category+' '+word);
       assert.deepEqual(Array.from(catalogue.categories[category],option=>option.value),expected,'Keep each strategy and category in its own catalogue.');
      }
      assert.deepEqual(momentum.options[child],catalogue.categories[number===1?'Popular':'Pre'],'The normal child menu remains scoped to its current source category.');
      const requested=categoryLoads.filter(request=>request.index===parent).map(request=>request.category);
      assert.deepEqual([...new Set(requested)].sort(),['My','Popular','Pre','Public']);
      if(ruleCatalogue==='empty')assert.equal(requested.length,5,'Confirm consecutive empty categories with just one extra populated-category read per strategy.');
     }
    }
    if(ruleCatalogue==='execute')cataloguedResponse=response;else return;
   }
   if(groupCatalogue){
    const before=JSON.stringify(w.VaultCapture.fields(main)),beforeValue=main.querySelectorAll('input,select')[1].value;
    const preexisting=d.createElement('div');preexisting.className='popupContent';preexisting.innerHTML='<div class="abcd-1"><ul class="ind-list"><li grpid="existing">Existing open group</li></ul></div>';d.body.append(preexisting);
    const blockedGroup=await requestConfig();assert.equal(blockedGroup.ok,false);assert.equal(preexisting.isConnected,true);assert.equal(groupSearches.length,0,'An existing group menu must remain untouched.');preexisting.remove();
    const response=await requestConfig();
    assert.equal(JSON.stringify(w.VaultCapture.fields(main)),before,'Catalogue reading must restore every source field exactly.');
    assert.equal(groupCommits,0,'Reading choices must never select any group.');assert.equal(groupChanges,0,'Search text must not commit a group change.');
    assert.equal(submissions,0);assert.equal(portfolios,0);assert.equal(d.querySelector('.ind-list'),null);assert.equal(w.VaultCapture.popup('Momentum Trading BackTest'),undefined);
    assert.deepEqual(groupSearches[0],['open',''],'Open only after clearing the original search.');
    assert.deepEqual(groupSearches.at(-1),['search',beforeValue],'Restore the original query before dismissing the owned menu.');
    if(['duplicate','overflow','missing'].includes(groupCatalogue)){
     assert.equal(response.ok,false);assert.match(response.error,groupCatalogue==='duplicate'?/ambiguous/:groupCatalogue==='overflow'?/3,000/:/finish loading its group choices/);
     assert.equal(sourceSuccessDialogs.length,0);assert.equal(settingsReads,0,'A failed group read must stop before opening execution settings.');
    }else{
     assert.equal(response.ok,true,response.error);assert.equal(response.config.stages.momentum.fields.length,52);assert.equal(settingsReads,1);
     assert.deepEqual(Array.from(response.config.stages.momentum.options[1],o=>({...o})),groupRows.map((label,i)=>({value:label,label,sourceValue:'group:'+i,disabled:false})));
     assert.ok(groupMenuReads>=2,'Read the settled response, not just the initial popup.');
     assert.equal(lastGroupQuery,beforeValue,'Await the restored query response before dismissing, even when it is delayed.');
    }
    return;
   }
   if(noOptionRefresh){const failed=await requestConfig({momentum:{39:'My'}});assert.equal(failed.ok,false);assert.match(failed.error,/finish loading the dependent choices/);assert.equal(sourceMessages.at(-1),'Vault connection failed: '+failed.error);assert.equal(sourceSuccessDialogs.length,0);assert.equal(submissions,0);assert.equal(portfolios,0);return;}
   if(emptyOptions){const refreshed=await requestConfig({momentum:{43:'My'}});assert.equal(refreshed.ok,true,refreshed.error);assert.equal(refreshed.config.stages.momentum.options[44].length,0);assert.equal(refreshed.config.stages.momentum.fields[44].value,'');assert.equal(refreshed.config.stages.momentum.fields[46].checked,false);assert.equal(submissions,0);assert.equal(portfolios,0);assert.equal(w.VaultCapture.popup('Momentum Trading BackTest'),undefined);if(!variableSet)return;}
   if(refreshParents){const refreshed=await requestConfig({momentum:{39:'My'}});assert.equal(refreshed.ok,true,refreshed.error);}
   const response=cataloguedResponse||await requestConfig(refreshParents?{execution:{6:'My'}}:undefined);
   if(closeStuckAfterWake){assert.equal(response.ok,false);assert.match(response.error,/Source dialog did not close/);assert.ok(w.VaultCapture.popup('Momentum Trading BackTest'));assert.equal(submissions,0);assert.equal(portfolios,0);assert.equal(sourceSuccessDialogs.length,0);return;}
   assert.equal(response.ok,true,response.error);assert.equal(submissions,0,'Loading the setup must never run a backtest.');assert.equal(portfolios,0);assert.equal(w.VaultCapture.popup('Momentum Trading BackTest'),undefined);
   assert.equal(response.config.stages.momentum.fields.length,52);assert.deepEqual(Array.from(response.config.stages.momentum.options[1],o=>o.value),groupRows);
   if(closeAfterWake){assert.deepEqual(sourceSuccessDialogs,[false]);return;}
   if(bridge){assert.equal(bridgeConfigRequests,2,'Both the rejected change and successful connection must cross the real background boundary.');assert.equal(response.config.session,memory['runner:tab:9'].session,'Reading settings must retain the registered document session.');assert.deepEqual(sourceMessages.slice(-4),['Connecting to Vault: opening Momentum settings…','Connecting to Vault: reading strategy choices…','Connecting to Vault: reading backtest settings…','RZone settings read. Return to Vault to finish setup.']);assert.deepEqual(sourceSuccessDialogs,[false],'Connection success must only appear after closing its own settings dialog.');}
   if(refreshParents)assert.equal(navigationCount,1);
   const template=S.template(response.config),config=S.defaults(template);
   Object.assign(config,{'momentum.group':'Nifty 50 Index','momentum.timeframe':'Weekly','momentum.period.2.enabled':true,'momentum.period.2':90,'momentum.ema.1.enabled':true,'momentum.ema.1':200,'momentum.ema.2':55,'momentum.retracement.enabled':true,'momentum.retracement.reference':'8','momentum.volume.reference':'21','momentum.tma':true,'momentum.trend-quality.enabled':true,'momentum.trend-quality':60,'execution.from':'2023-01-01','execution.to':'2024-12-31','execution.target.enabled':false,'execution.target':7,'execution.stop':12,'portfolio.allocation':'Fixed','portfolio.capital':500000,'portfolio.max-open':8,'portfolio.daily-limit.enabled':true,'portfolio.daily-limit':3});
   if(refreshParents){assert.deepEqual(Array.from(response.config.stages.momentum.options[40],o=>o.value),['My trend rule','My alternate rule']);Object.assign(config,{'momentum.strategy.1.enabled':true,'momentum.strategy.1.rule':'My alternate rule','momentum.strategy.1.timeframe':'Weekly','execution.exit.enabled':true,'execution.exit.rule':'My alternate rule'});}
   if(ruleCatalogue==='execute')for(const [index,category]of ['Public','My','Popular'].entries()){const number=index+1;Object.assign(config,{['momentum.strategy.'+number+'.source']:category,['momentum.strategy.'+number+'.rule']:'Strategy '+number+' '+category+' second',['momentum.strategy.'+number+'.enabled']:true});}
   const baseline=S.configToBaseline(config,template,{id:'empty-library-setup',name:'Configured in Vault',demo:false});
   const variableDimensions=variableSet==='momentum'?[['momentum.period.2.enabled',[false,true]],['momentum.period.2',[90,180]],['momentum.ema.1.enabled',[false,true]],['momentum.strategy.1.rule',['Demo trend rule','Alternate trend rule']],['momentum.retracement.reference',['7','9']],['momentum.volume.reference',['20','21']]]:variableSet==='rules'?[['momentum.radar.enabled',[false,true]],['momentum.radar.rule',['Demo momentum screen','Alternate momentum screen']],['execution.exit.enabled',[false,true]],['execution.exit.rule',['Demo exit rule','Alternate exit rule']],['execution.target.enabled',[false,true]],['execution.target',[7,9]]]:null;
   plan=E.create({id:'runner-proof',name:'Runner proof',baseline,dimensions:variableDimensions?variableDimensions.map(([key,values])=>({key,values})):[{key:'momentum.period.1',values:'126,180,252'}],...(variableSet?{mode:'sample',budget:3,seed:5}:{}),minTrades:0});memory['experiment:'+plan.id]=plan;
   assert.equal(Object.keys(memory).some(k=>k.startsWith('run:')),false,'A new setup must work with an empty archive.');
   if(changedOptions)main.querySelectorAll('input,select')[33].querySelector('option[value="source:Weekly"]').remove();
   // Let the source register again after the setup-reading status.
   for(let n=0;n<30&&!memory['runner:tab:9']?.ready;n++)await sleep(10);
  }
  await coordinator.handle({action:'start',id:plan.id,tabId:9},dashboard);
  for(const fn of listeners)fn({type:'vault-runner-wake'},{id:runtime.id},()=>{});
  for(let n=0;n<600&&!['complete','needs-review'].includes(memory['experiment:'+plan.id].status);n++)await sleep(20);
  const result=memory['experiment:'+plan.id];
  const runs=Object.entries(memory).filter(([k])=>k.startsWith('run:')).map(([,v])=>v);
  if(missingGroup||changedOptions||driftDuringRun){
   assert.equal(result.status,'needs-review',JSON.stringify(result.trials));assert.equal(runs.length,0);assert.equal(submissions,driftDuringRun?1:0);assert.equal(portfolios,0);
   assert.match(result.trials[0].error,missingGroup?/confirm that group/:changedOptions?/dropdown value is unavailable/:/read-back differs/);
  }
  else if(changeLocked||staleCompletion||rejected||reuseReport||noRunning||preexistingReport){
   assert.equal(result.status,'needs-review',JSON.stringify(result.trials));assert.equal(submissions,changeLocked?0:reuseReport?2:1);assert.equal(runs.length,reuseReport?1:0);assert.equal(portfolios,reuseReport?2:preexistingReport?1:0);
   if(reuseReport)assert.match(result.trials[1].error,/confirmed submissions/);
   if(preexistingReport)assert.match(result.trials[0].error,/linked submissions/);
   if(staleCompletion||noRunning){assert.equal(guardedStates.length,2);assert.ok(guardedStates.every(s=>s.completed===false&&s.portfolios===0),'A stale completion label must never advance to portfolio testing.');}
  }
  else{
   assert.equal(result.status,'complete',JSON.stringify(result.trials.map(t=>({status:t.status,error:t.error}))));assert.equal(submissions,3);assert.equal(portfolios,3);assert.equal(runs.length,3);assert.deepEqual(runs.map(r=>E.fields(r,'momentum')[12].value),variableSet?['180','180','180']:['126','180','252']);
   if(ruleCatalogue==='execute')assert.deepEqual(strategyNativeSubmissions,Array.from({length:3},()=>['Public','My','Popular'].map((category,index)=>({category:'source:'+category,rule:'rule:'+(index+1)+':'+category+':second',enabled:true}))),'Apply each cached category before resolving its exact native rule option, on every source submission.');
   if(overlap){assert.equal(guardedStates.length,3);assert.ok(guardedStates.every((s,i)=>s.completed===false&&s.portfolios===i),'Old completion text while Cancel is visible must not complete the trial.');}
   for(const r of runs){assert.equal(r.provenance,'recorded-at-submit');assert.equal(r.charts.length,6);assert.equal(r.trades.rows.length,4);assert.equal(r.trades.rows[1][2],'0');assert.equal(r.experiment.id,plan.id);
    if(vaultSetup){const t=plan.trials.find(t=>t.runId===r.id);for(const stage of ['momentum','execution','portfolio'])E.verify(E.fields(E.expected(plan,t),stage),E.fields(r,stage));assert.equal(E.fields(r,'momentum')[1].value,'Nifty 50 Index');assert.equal(E.fields(r,'execution')[1].value,'2023-01-01');assert.equal(E.fields(r,'portfolio')[2].value,'500000');}
    if(variableSet){const m=E.fields(r,'momentum'),x=E.fields(r,'execution');assert.equal(m.slice(7,11).filter(f=>f.checked).length,1,'Retracement reference stays exclusive.');assert.equal(m.slice(20,22).filter(f=>f.checked).length,1,'Volume reference stays exclusive.');for(const [gate,child]of [[11,12],[13,14],[26,27],[34,36]])assert.equal(m[child].disabled,!m[gate].checked);for(const [gate,child]of [[5,7],[8,9]])assert.equal(x[child].disabled,!x[gate].checked);}
    const receipt=r.experiment.evidence;assert.equal(receipt.version,1);assert.equal(receipt.strategySubmissionId,r.parameters.strategy.id);assert.equal(receipt.portfolioSubmissionId,r.parameters.id);assert.equal(receipt.sourceSession,memory['runner:tab:9'].session);assert.equal(receipt.capturedAt,r.savedAt);const times=['strategySubmittedAt','strategyStartedAt','strategyCompletedAt','portfolioSubmittedAt','reportOpenedAt','capturedAt'].map(k=>Date.parse(receipt[k]));assert.ok(times.every((time,i)=>Number.isFinite(time)&&(!i||time>=times[i-1])));
   }assert.equal(new Set(runs.map(r=>r.experiment.evidence.strategySubmissionId)).size,3);assert.equal(new Set(runs.map(r=>r.experiment.evidence.portfolioSubmissionId)).size,3);assert.deepEqual(savedBeforeNext,[true,true],'Each earlier result is durable before the next source submission.');assert.equal(memory['runner:lease'],null);if(vaultSetup)assert.equal(groupCommits,3);if(variableSet)for(const dimension of plan.dimensions)assert.equal(new Set(plan.trials.map(t=>t.patch[dimension.key])).size,2,'The three trial fixture must exercise both '+dimension.key+' choices.');
  }
 }finally{dom.window.close();}
}
async function backgroundFocusChecks(){
 const vm=require('node:vm'),dashboardURL='chrome-extension://test-ext/index.html',sourceURL='https://zone.definedgesecurities.com/index.html#research';
 for(const mode of ['return','source-error','user-switch','closed-vault','changed-vault','moved-vault','unrelated-tab','late-read','late-activation']){
  let active=10,clock=1000,expired,release,reads=0;const actions=[],timers=new Map();let timerId=0;
  const browserTabs=new Map([[9,{id:9,windowId:1,url:sourceURL}],[10,{id:10,windowId:1,url:mode==='unrelated-tab'?'https://example.com/':dashboardURL}],[11,{id:11,windowId:1,url:'https://example.org/'}]]);
  const chrome={storage:{local:{}},runtime:{id:'test-ext',getURL:file=>'chrome-extension://test-ext/'+file,onMessage:{addListener:()=>{}}},action:{onClicked:{addListener:()=>{}}},tabs:{
   get:async id=>{if(!browserTabs.has(id))throw Error('Tab closed');return {...browserTabs.get(id)};},
   query:async query=>{assert.deepEqual({...query},{active:true,windowId:1});return [{...browserTabs.get(active)}];},
   update:async(id,update)=>{assert.equal(update.active,true);actions.push(id);active=id;if(mode==='late-activation'&&id===9)return await new Promise(resolve=>{release=resolve;});return {...browserTabs.get(id)};},
   sendMessage:async(id,message)=>{
    assert.equal(id,9);assert.equal(active,9);assert.equal(message.type,'vault-runner-config');reads++;
    if(mode==='user-switch')active=11;
    if(mode==='closed-vault')browserTabs.delete(10);
    if(mode==='changed-vault')browserTabs.get(10).url='https://example.net/';
    if(mode==='moved-vault')browserTabs.get(10).windowId=2;
    if(mode==='source-error')throw Error('Source rejected connection');
    if(mode==='late-read')return await new Promise(resolve=>{release=resolve;});
    return {ok:true,session:'s',config:{session:'s'}};
   },create:async()=>({id:12})
  }};
  class FakeDate extends Date {static now(){return clock;}}
  const context=vm.createContext({chrome,URL,Date:FakeDate,crypto:require('node:crypto').webcrypto,structuredClone,setTimeout:(fn,ms)=>{assert.equal(ms,60000);const id=++timerId;timers.set(id,fn);expired=fn;return id;},clearTimeout:id=>timers.delete(id)});
  context.importScripts=(...files)=>files.forEach(file=>vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),context,{filename:file}));
  vm.runInContext(fs.readFileSync(path.join(base,'background.js'),'utf8'),context,{filename:'background.js'});
  const result=context.configure(9,{});
  if(mode.startsWith('late-')){
   for(let n=0;n<20&&!release;n++)await Promise.resolve();assert.equal(typeof release,'function');clock+=60001;expired();
   await assert.rejects(result,/did not finish connecting/);release({ok:true,session:'s',config:{session:'s'}});
   for(let n=0;n<20;n++)await Promise.resolve();
   assert.deepEqual(actions,[9],'An expired request must never restore focus when its late operation completes.');assert.equal(reads,mode==='late-read'?1:0,'Expired activation must not start a late configuration read.');
  }else if(mode==='source-error')await assert.rejects(result,/Source rejected connection/);
  else assert.equal((await result).ok,true);
  if(['return','source-error'].includes(mode))assert.deepEqual(actions,[9,10]);
  if(['user-switch','closed-vault','changed-vault','moved-vault','unrelated-tab'].includes(mode))assert.deepEqual(actions,[9],mode+' must not restore focus to a tab the user did not request.');
  assert.equal(timers.size,0);
 }
}
(async()=>{const cases=[...['complete','delayed','empty','rejected','execute'].map(ruleCatalogue=>({vaultSetup:true,ruleCatalogue})),...['blank','nonblank','delayed','late-restore','duplicate','overflow','missing'].map(groupCatalogue=>({vaultSetup:true,groupCatalogue})),{}, {overlap:true},{changeLocked:true},{staleCompletion:true},{noRunning:true},{rejected:true},{reuseReport:true},{preexistingReport:true},{vaultSetup:true,bridge:true},{vaultSetup:true,closeAfterWake:true},{vaultSetup:true,closeStuckAfterWake:true},{vaultSetup:true,refreshParents:true},{vaultSetup:true,noOptionRefresh:true},{vaultSetup:true,emptyOptions:true,variableSet:'momentum'},{vaultSetup:true,missingGroup:true},{vaultSetup:true,changedOptions:true},{vaultSetup:true,driftDuringRun:true},{vaultSetup:true,variableSet:'momentum'},{vaultSetup:true,variableSet:'rules'}];if(!requestedCatalogue&&!process.argv.includes('--variations'))await backgroundFocusChecks();for(const options of cases.filter(o=>(!requestedCatalogue||o.ruleCatalogue===requestedCatalogue)&&(!process.argv.includes('--catalogues')||o.ruleCatalogue)&&(!process.argv.includes('--groups')||o.groupCatalogue)&&(!process.argv.includes('--setup')||o.vaultSetup)&&(!process.argv.includes('--variations')||o.variableSet)&&(!process.argv.includes('--bridge')||o.bridge)&&(!process.argv.includes('--close')||o.closeAfterWake||o.closeStuckAfterWake)))await scenario(options);console.log('PASS: '+(process.argv.includes('--close')?'dialog close':process.argv.includes('--bridge')?'background bridge':process.argv.includes('--variations')?'variation':process.argv.includes('--setup')?'Vault setup':'all')+' runner scenarios, including source receipts, empty-library setup, dependent rule refresh, group resolution, control read-back and rejection guards. Live GWT/extension acceptance remains separate.');})().catch(e=>{console.error(e);process.exitCode=1;});
