/* Full DOM → submission → pagination → durable save → next-trial integration. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const E=require('../dist/experiments.js'),S=require('../dist/setup.js'),D=require('../dist/demo.js'),{createCoordinator}=require('../dist/experiment-coordinator.js');
const base=path.resolve(__dirname,'../dist'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const requestedCatalogue=process.argv.find(argument=>argument.startsWith('--catalogue-case='))?.slice('--catalogue-case='.length);
const fromCase=Number(process.argv.find(argument=>argument.startsWith('--from-case='))?.slice('--from-case='.length)||1);
const toCaseArgument=process.argv.find(argument=>argument.startsWith('--to-case='))?.slice('--to-case='.length),toCase=toCaseArgument===undefined?Infinity:Number(toCaseArgument);
if(!Number.isInteger(fromCase)||fromCase<1)throw Error('Runner starting case must be a positive integer.');
if(toCase!==Infinity&&(!Number.isInteger(toCase)||toCase<fromCase))throw Error('Runner ending case must be an integer at least equal to the starting case.');
const exitCases=['exit-search-complete','exit-search-original-public','exit-search-execute','exit-search-no-menu','exit-search-ambiguous','exit-search-unfinished','exit-search-saved-baseline','exit-search-delayed-gate','exit-search-deadline'];
const searchCases=['search-complete','search-original-public','search-execute','search-no-menu','search-ambiguous','search-unfinished','search-cross-row',...exitCases];
if(requestedCatalogue&&!['complete','delayed','empty','radar-empty','rejected','radar-rejected','execute',...searchCases].includes(requestedCatalogue))throw Error('Unknown runner catalogue case: '+requestedCatalogue);
const reordered=x=>Array.isArray(x)?x.map(reordered):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,reordered(x[k])])):x;
async function scenario(options={}){
 const {changeLocked=false,overlap=false,staleCompletion=false,rejected=false,reuseReport=false,noRunning=false,preexistingReport=false,vaultSetup=false,missingGroup=false,changedOptions=false,driftDuringRun=false,refreshParents=false,noOptionRefresh=false,emptyOptions=false,variableSet='',bridge=false,closeAfterWake=false,closeStuckAfterWake=false,groupCatalogue='',ruleCatalogue=''}=options;
 const dom=new JSDOM('<body><h1 class="header-text">Momentum Trading BackTesting<div class="tooltip">i</div></h1><div class="account-right"></div></body>',{runScripts:'outside-only',url:'https://zone.definedgesecurities.com/index.html#research'}),w=dom.window,d=w.document;
 const fixture=D.create()[0],sourceExecutionFields=E.clone(E.fields(fixture,'execution'));fixture.demo=false;w.structuredClone=structuredClone;
 Object.defineProperty(w.HTMLElement.prototype,'innerText',{get(){return this.textContent;}});
 w.Element.prototype.getClientRects=function(){return this.isConnected&&!this.closest('[hidden]')&&!this.closest('[style*="display: none"]')?[{width:100,height:20}]:[];};
 const nativeTimeout=w.setTimeout.bind(w),nativeInterval=w.setInterval.bind(w);w.setTimeout=(fn,ms)=>nativeTimeout(fn,Math.min(ms,20));w.setInterval=(fn,ms)=>nativeInterval(fn,Math.min(ms,30));
 const main=d.querySelector('.account-right'),categoryLoads=[],searchMode=searchCases.includes(ruleCatalogue),exitMode=exitCases.includes(ruleCatalogue),crossRows=['search-cross-row','exit-search-execute'].includes(ruleCatalogue),ruleMenus=new Set(),ruleQueries=[],ruleSelections=[];let initialOptionsReady=false,initialSnapshot,duplicateDuringExecution=false;
 function form(container,fields){const table=d.createElement('table');for(const f of fields){const tr=d.createElement('tr'),td=d.createElement('td'),cell=d.createElement('td');td.textContent=f.label;let n;if(f.type==='select-one'){n=d.createElement('select');const choices=[f.value,...(/Allocation/.test(f.label)?['Fixed','Reinvestment']:/Rank Criteria/.test(f.label)?['Fictional alternate rank']:/Timeframe|Str \d/.test(f.label)&&f.value==='Daily'?['Weekly']:f.value==='Pre'?['My']:f.value.startsWith('Demo ')?[f.value.replace(/^Demo /,'Alternate ')]:[])];for(const value of new Set(choices)){const o=d.createElement('option');o.textContent=value;o.value='source:'+value;n.append(o);}n.value='source:'+f.value;}else {n=d.createElement('input');n.type=f.type;n.value=f.value;if(f.checked!==null)n.checked=f.checked;if(f.type==='radio')n.name=/52 Week/.test(f.label)?'reference':'volume';}n.disabled=f.disabled;cell.append(n);tr.append(td,cell);table.append(tr);}container.append(table);
  if(vaultSetup){const nodes=[...table.querySelectorAll('input,select')],stage=fields.length===52?'momentum':fields.length===12?'execution':'portfolio';const gates=stage==='momentum'?[[4,5,6,7,8,9,10],[11,12],[13,14],[15,16],[17,18],[26,27],[28,29],[30,31],[34,35,36],[37,38],[42,39,40,41],[46,43,44,45],[50,47,48,49]]:stage==='execution'?[[5,6,7],[8,9],[10,11]]:[[4,5]];for(const [gate,...children]of gates){const update=()=>{const change=()=>children.forEach(i=>nodes[i].disabled=!nodes[gate].checked);if(ruleCatalogue==='exit-search-delayed-gate'&&stage==='execution'&&gate===5&&nodes[gate].checked)nativeTimeout(change,900);else change();};nodes[gate].addEventListener('change',update);update();}
   if(crossRows&&stage==='momentum'){
    // The observed source nests STR3 under the STR2 TR, so STR2's category
    // contributes an ancestor label to all four STR3 fields in capture.js.
    const rows=nodes.slice(43,51).map(n=>n.closest('tr')),outer=d.createElement('tr'),outerLabel=d.createElement('td'),outerCell=d.createElement('td'),nested=d.createElement('table'),inner=d.createElement('tr'),innerLabel=d.createElement('td'),innerCell=d.createElement('td');
    outerLabel.textContent='Str 2 :';innerLabel.textContent='Str 3 :';outerCell.append(...nodes.slice(43,47));innerCell.append(...nodes.slice(47,51));inner.append(innerLabel,innerCell);nested.append(inner);outerCell.append(nested);outer.append(outerLabel,outerCell);rows[0].before(outer);for(const row of rows)row.remove();
   }
   for(const index of stage==='momentum'?[35,39,43,47]:stage==='execution'?[6]:[]){
    let target=nodes[index+1];const strategy=stage==='momentum'&&[35,39,43,47].includes(index),number=strategy?(index-35)/4:null,exitSearch=exitMode&&stage==='execution',label=exitSearch?'Exit strategy':number?'Strategy '+number:'Radar';
    const predefined=[...target.options].map(o=>({label:o.textContent,value:o.value}));
    // Live Radar offers Pre/My. The delayed variant additionally models extra
    // categories offered by a future source, with Popular explicitly disabled.
    for(const category of ruleCatalogue&&(number||exitSearch||['delayed','radar-empty'].includes(ruleCatalogue))?['Public','Popular']:[])if(![...nodes[index].options].some(o=>o.textContent===category)){const option=d.createElement('option');option.textContent=category;option.value='source:'+category;option.disabled=index===35&&category==='Popular';nodes[index].append(option);}
    const available=category=>{
     if(emptyOptions&&category==='My'||ruleCatalogue==='empty'&&strategy&&['My','Public'].includes(category)||ruleCatalogue==='radar-empty'&&index===35&&['My','Public'].includes(category))return [];
     if(ruleCatalogue&&(strategy||exitSearch))return ['first','second'].map(word=>({label:label+' '+category+' '+word,value:'rule:'+(exitSearch?'exit':number)+':'+category+':'+word}));
     if(category==='Pre')return groupCatalogue==='initial-options'&&initialOptionsReady&&stage==='momentum'&&index===39?[...predefined,{label:'Loaded initial rule',value:'initial:rule'}]:predefined;
     return [category+' trend rule',category+' alternate rule'].map(label=>({label,value:'custom:'+label}));
    };
    const populate=category=>{
     if(searchMode&&(number||exitSearch))for(const at of exitSearch?[index,index+1,5]:[index,index+1,index+2,index+3]){const cell=nodes[at].closest('tr').firstElementChild;cell.querySelector('.source-category')?.remove();const badge=d.createElement('span');badge.className='source-category';badge.textContent=' / '+category+'i';cell.append(badge);if(!cell.querySelector('svg')){const icon=d.createElementNS('http://www.w3.org/2000/svg','svg');icon.textContent='Excluded SVG caption';cell.append(icon);}}
     const search=searchMode&&(number||exitSearch)&&['My','Public'].includes(category),kind=search?'INPUT':'SELECT';
     if(target.tagName!==kind){const next=d.createElement(kind);next.disabled=target.disabled;target.parentElement.querySelector('input[type="hidden"]')?.remove();target.replaceWith(next);target=next;nodes[index+1]=target;
      if(search){target.type='text';target.placeholder='Search System Builder';const hidden=d.createElement('input');hidden.type='hidden';hidden.value='position:'+index;target.after(hidden);
       const searchTarget=target;target.addEventListener('keyup',event=>{
        const query=searchTarget.value,activeCategory=searchTarget.dataset.category;ruleQueries.push({index,category:activeCategory,query,keyCode:event.keyCode});
        if(!query||ruleCatalogue==='search-no-menu'||ruleCatalogue==='exit-search-no-menu'&&exitSearch)return;
        nativeTimeout(()=>{for(const menu of ruleMenus)menu.remove();const menu=d.createElement('div');menu.className='popupContent';ruleMenus.add(menu);d.body.append(menu);
         const choices=activeCategory==='My'?[]:[...available(activeCategory),{label:'Shared public rule',value:'duplicate:1'},{label:'Shared public rule',value:'duplicate:2'}].filter(o=>o.label.toLowerCase().includes(query.toLowerCase()));
         if(duplicateDuringExecution&&choices.length===1&&(!exitMode||exitSearch))choices.push({...choices[0],value:'new-duplicate'});
         const hiddenChoice=()=>{const list=d.createElement('ul');list.className='ind-list';list.hidden=true;const row=d.createElement('li');row.setAttribute('sbid','hidden-only');row.textContent=query;list.append(row);menu.append(list);};
         if(!choices.length){menu.innerHTML='<div class="gwt-HTML">No matching system builder found</div>';hiddenChoice();return;}
         const list=d.createElement('ul');list.className='ind-list';menu.append(list);for(const choice of choices){const li=d.createElement('li');li.setAttribute('sbid',choice.value);li.textContent=choice.label;li.onclick=()=>{searchTarget.value=choice.label;searchTarget.dataset.selectedRule=choice.value;ruleSelections.push({index,category:activeCategory,label:choice.label,id:choice.value});menu.remove();};list.append(li);}
         hiddenChoice();
        },180);
       });
      }
     }
     if(search){target.value='';target.dataset.selectedRule='';target.dataset.category=category;return;}
     target.replaceChildren();for(const choice of available(category)){const option=d.createElement('option');option.textContent=choice.label;option.value=choice.value;target.append(option);}
    };
    if(ruleCatalogue&&(strategy||exitSearch)){
     const category=number===1&&['search-original-public','search-unfinished'].includes(ruleCatalogue)||exitSearch&&['exit-search-original-public','exit-search-unfinished','exit-search-delayed-gate'].includes(ruleCatalogue)?'Public':number===1?'Popular':'Pre';nodes[index].value='source:'+category;populate(category);if(target.tagName==='SELECT')target.selectedIndex=target.options.length-1;else if(['search-unfinished','exit-search-unfinished'].includes(ruleCatalogue))target.value='Unfinished query';
     if(number)nodes[index+2].value=number===1?'source:Weekly':'source:Daily';const gate=exitSearch?5:number?index+3:34;nodes[gate].checked=number===1||exitSearch&&category==='Public'&&ruleCatalogue!=='exit-search-delayed-gate';nodes[gate].dispatchEvent(new w.Event('change',{bubbles:true}));
    }
    nodes[index].addEventListener('change',()=>{
     const category=nodes[index].selectedOptions[0]?.textContent;categoryLoads.push({stage,index,category,enabled:!nodes[index].disabled});
     if(noOptionRefresh||ruleCatalogue==='rejected'&&index===43&&category==='Public'||ruleCatalogue==='radar-rejected'&&index===35&&category==='My')return;
     nativeTimeout(()=>populate(category),ruleCatalogue==='delayed'&&strategy&&category==='Public'?1100:300);
    });
   }
   if(stage==='execution'){nodes[3].closest('tr').firstElementChild.addEventListener('click',()=>{for(const menu of ruleMenus)menu.remove();});if(exitMode)container.originalFields=JSON.stringify(w.VaultCapture.fields(container));}
  }
 }
 function button(p,label,fn){const n=d.createElement('button');n.textContent=label;n.onclick=fn;p.append(n);return n;}
 function popup(title){const p=d.createElement('div');p.className='popupContent';const h=d.createElement('div');h.className='custom-dialog-header';const caption=d.createElement('div');caption.className='caption';caption.textContent=title;const close=d.createElement('a');close.className='close-buton';close.onclick=()=>{
  if(p.originalFields)assert.equal(JSON.stringify(w.VaultCapture.fields(p)),p.originalFields,'Discovery/search must restore every execution field before closing its owned dialog.');
  if(title==='Momentum Trading BackTest'&&(closeAfterWake||closeStuckAfterWake)){
   // Model a hidden page waking after the deadline: the close animation may
   // already have removed the owned node before the next poll can run.
   const now=w.Date.now.bind(w.Date);nativeTimeout(()=>{if(closeAfterWake)p.remove();w.Date.now=()=>now()+6000;},5);
  }else p.remove();
 };h.append(caption,close);p.append(h);d.body.append(p);return p;}
 form(main,E.fields(fixture,'momentum'));let submissions=0,portfolios=0,priorReport=null,groupCommits=0,settingsReads=0;const guardedStates=[],savedBeforeNext=[],strategyNativeSubmissions=[],submittedStageFields={execution:[],portfolio:[]},contextVariations=['execution-context','portfolio-sizing'].includes(variableSet);
 const groupSearches=[],groupRows=['Demo universe 40','Nifty 50 Index','Nifty 500 Index','Other index'];let groupMenuReads=0,groupChanges=0,lastGroupQuery,headingClicks=0,openedBeforeInitial=false;
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
  group.addEventListener('click',()=>{
   groupSearches.push(['open',group.value]);render(names(group.value),group.value);
   if(groupCatalogue==='initial-options'&&!initialOptionsReady)openedBeforeInitial=true;
   if(['field-drift','label-drift'].includes(groupCatalogue))nativeTimeout(()=>{
    const field=main.querySelectorAll('input,select')[12];
    if(groupCatalogue==='field-drift')field.value='987654321';
    else field.closest('tr').firstElementChild.textContent='Period 1 changed label';
   },100);
  });
  group.addEventListener('keyup',()=>{
   cancelSearches();const query=group.value;groupSearches.push(['search',query]);
   if(groupCatalogue==='delayed'&&!query){render(groupRows.filter(name=>name.startsWith('Nifty')),query);pending.push(nativeTimeout(()=>render(names(query),query),1200));}
   else pending.push(nativeTimeout(()=>render(names(query),query),groupCatalogue==='late-restore'&&query?1800:180));
  });
  const outside=main.querySelector('select').closest('tr').firstElementChild;
  assert.equal(outside.textContent,'Chart Type :');assert.equal(outside.childElementCount,0);
  outside.addEventListener('click',()=>{cancelSearches();menu?.remove();for(const ruleMenu of ruleMenus)ruleMenu.remove();});
  // The real source heading opens an empty help tooltip, so it is not a safe
  // outside-click target even though it dismisses the autocomplete list.
  d.querySelector('h1').addEventListener('click',()=>{
   headingClicks++;cancelSearches();menu?.remove();const help=d.createElement('div');help.className='tool-popup tool-tip';
   help.innerHTML='<div class="popupContent"><div class="gwt-HTML"></div></div>';d.body.append(help);
  });
 }
 const oldHiddenReport=preexistingReport?popup('Portfolio Backtesting Report'):null;if(oldHiddenReport)oldHiddenReport.hidden=true;
 // Observed RZone lifecycle: one main button becomes Cancel, the setup remains
 // open during Processing, and completion removes that setup automatically.
 const done=d.createElement('span');done.textContent='BackTest Completed.';main.append(done);let cancel;
 cancel=button(main,'BackTest',()=>{settingsReads++;const p=popup('Momentum Trading BackTest');form(p,sourceExecutionFields);button(p,'Backtest',()=>{
  if(contextVariations){submittedStageFields.execution.push(JSON.parse(JSON.stringify(w.VaultCapture.fields(p))));assert.equal(p.querySelector('select').value,'source:'+submittedStageFields.execution.at(-1)[0].value,'Rank criteria must select the exact native option, not assign display text as its value.');}
  if(['execute','search-execute','search-ambiguous','search-cross-row','exit-search-execute','exit-search-ambiguous'].includes(ruleCatalogue)){const controls=[...main.querySelectorAll('input,select')].filter(n=>n.type!=='hidden');strategyNativeSubmissions.push([35,39,43,47].map(index=>({category:controls[index].value,rule:controls[index+1].value,enabled:controls[index===35?34:index+3].checked})));for(const index of [40,44,48])if(controls[index].type==='text'&&controls[index+2].checked)assert.ok(controls[index].dataset.selectedRule,'Typing a rule without clicking its exact suggestion must never submit.');if(exitMode){const exitControls=[...p.querySelectorAll('input,select')].filter(n=>n.type!=='hidden');assert.equal(exitControls[7].dataset.selectedRule,'rule:exit:Public:first','Execution exit selection requires an exact native menu commitment.');}}
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
 if(contextVariations){submittedStageFields.portfolio.push(JSON.parse(JSON.stringify(w.VaultCapture.fields(p))));assert.equal(p.querySelector('select').value,'source:'+submittedStageFields.portfolio.at(-1)[1].value,'Allocation must select the native Fixed/Reinvestment option.');}
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
 for(const file of ['core.js','presentation.js','intelligence.js','source-layouts.js','setup.js','experiments.js','capture.js'])w.eval(fs.readFileSync(path.join(base,file),'utf8'));
 if(vaultSetup){const status=w.VaultCapture.status;w.VaultCapture.status=message=>{sourceMessages.push(message);if(message==='RZone settings read. Return to Vault to finish setup.')sourceSuccessDialogs.push(!!w.VaultCapture.popup('Momentum Trading BackTest'));status(message);};}
 // Build the baseline from the same visible form labels the saver records.
 fixture.parameters.strategy.main.fields=JSON.parse(JSON.stringify(w.VaultCapture.fields(main)));
 const bp=popup('Baseline fixture');form(bp,E.fields(fixture,'execution'));fixture.parameters.strategy.execution.fields=JSON.parse(JSON.stringify(w.VaultCapture.fields(bp)));bp.remove();const pp=popup('Baseline portfolio');form(pp,E.fields(fixture,'portfolio'));fixture.parameters.settings.fields=JSON.parse(JSON.stringify(w.VaultCapture.fields(pp)));pp.remove();
 let plan;
 if(!vaultSetup){plan=E.create({id:'runner-proof',name:'Runner proof',baseline:E.baseline(fixture),dimensions:[{key:'momentum.period.1',values:'126,180,252'}],minTrades:0});memory['experiment:'+plan.id]=plan;}
 if(changeLocked)main.querySelectorAll('input')[0].value='Unexpected group';
 const runnerUIListeners=[],nativeAddListener=d.addEventListener.bind(d);d.addEventListener=(type,fn,...args)=>{if(['click','input','change'].includes(type))runnerUIListeners.push({type,fn});return nativeAddListener(type,fn,...args);};
 w.eval(fs.readFileSync(path.join(base,'runner.js'),'utf8'));d.addEventListener=nativeAddListener;
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
   const unsupportedMarket=await requestConfig({momentum:{3:'BSE'}});assert.equal(unsupportedMarket.ok,false);assert.match(unsupportedMarket.error,/supports NSE/);assert.equal(categoryLoads.length,0);assert.equal(groupSearches.length,0);
   if(ruleCatalogue){
    const before=JSON.stringify(w.VaultCapture.fields(main)),nativeBefore=[...main.querySelectorAll('input,select')].map(n=>n.value);
    const existingSettings=popup('Momentum Trading BackTest'),blockedSettings=await requestConfig();assert.equal(blockedSettings.ok,false);assert.equal(existingSettings.isConnected,true);assert.equal(categoryLoads.length,0);assert.equal(groupSearches.length,0);existingSettings.remove();
    const response=await requestConfig();
    assert.equal(JSON.stringify(w.VaultCapture.fields(main)),before,'Restore every main field, including disabled flags, after category discovery.');
    assert.deepEqual([...main.querySelectorAll('input,select')].map(n=>n.value),nativeBefore,'Restore the exact native option IDs and selected values.');
    assert.equal(submissions,0);assert.equal(portfolios,0);assert.equal(groupCommits,0);assert.equal(w.VaultCapture.popup('Momentum Trading BackTest'),undefined);
    assert.ok(categoryLoads.every(request=>request.enabled),'Every parent request must occur with its strategy checkbox enabled.');
    if(searchMode){
     if(ruleCatalogue==='search-unfinished'){assert.equal(response.ok,false);assert.match(response.error,/Finish or clear the Strategy 1 rule search/);assert.equal(categoryLoads.length,0);assert.equal(groupSearches.length,0);assert.equal(settingsReads,0);return;}
     if(ruleCatalogue==='exit-search-unfinished'){assert.equal(response.ok,false);assert.match(response.error,/Finish or clear the Exit strategy rule search/);assert.equal(categoryLoads.some(load=>load.stage==='execution'),false);assert.equal(ruleQueries.length,0);assert.equal(settingsReads,1);return;}
     assert.equal(response.ok,true,JSON.stringify(response));assert.equal(ruleQueries.length,0,'Connecting must not invent an empty query catalogue.');
     const momentum=response.config.stages.momentum,execution=response.config.stages.execution;
     assert.deepEqual(Array.from(momentum.supportedMarkets),['NSE']);
     if(crossRows){assert.deepEqual(Array.from(momentum.ruleCatalogues[44].labelDependents),[47,48,49,50]);for(const category of ['Pre','My','Public','Popular'])assert.ok(momentum.ruleCatalogues[48].fieldLabels[category].every(label=>label.startsWith(momentum.fields[43].label+' → ')));}
     if(exitMode){assert.deepEqual({...execution.ruleCatalogues[7].controlTypes},{Pre:'select-one',Popular:'select-one',My:'text',Public:'text'});assert.deepEqual({...execution.ruleCatalogues[7].searchQueries},{});assert.equal(execution.ruleCatalogues[7].categories.My.length,0);assert.equal(execution.ruleCatalogues[7].categories.Public.length,0);}
     for(const child of [40,44,48]){const entry=momentum.ruleCatalogues[child];assert.deepEqual({...entry.controlTypes},{Pre:'select-one',Popular:'select-one',My:'text',Public:'text'});assert.deepEqual({...entry.searchQueries},{});assert.equal(entry.categories.My.length,0);assert.equal(entry.categories.Public.length,0);}
     for(const child of [40,44,48])for(const category of ['Pre','My','Public','Popular']){const labels=momentum.ruleCatalogues[child].fieldLabels[category];assert.equal(labels.length,4);assert.ok(labels.every(label=>label.includes(category+'i')&&!label.includes('Excluded SVG caption')),'Record exact category labels with the same SVG exclusions as the capture.');}
     const lookup=(parentIndex,category,query,sourceSession=probe().session)=>new Promise(resolve=>{for(const fn of listeners)fn({type:'vault-runner-rule-search',...(parentIndex===6?{stage:'execution'}:{}),parentIndex,category,query,session:sourceSession},{id:runtime.id},resolve);});
     const invalid=await lookup(39,'Public',' public ');assert.equal(invalid.ok,false);assert.equal(ruleQueries.length,0);const stale=await lookup(39,'Public','public','another-page');assert.equal(stale.ok,false);assert.equal(ruleQueries.length,0);
     const oldPopup=popup('Existing user report');assert.equal((await lookup(39,'Public','public')).ok,false);assert.equal(oldPopup.isConnected,true);oldPopup.remove();assert.equal(ruleQueries.length,0);
     if(ruleCatalogue==='exit-search-deadline'){
      const now=w.Date.now.bind(w.Date),fields=w.VaultCapture.fields,loads=categoryLoads.length;let elapsed=0,setupReads=0;w.Date.now=()=>now()+elapsed;w.VaultCapture.fields=container=>{const result=fields(container);if(container===w.VaultCapture.popup('Momentum Trading BackTest')&&++setupReads===2)elapsed=46000;return result;};
      try{const expired=await lookup(6,'Public','public');assert.equal(expired.ok,false);assert.match(expired.error,/timed out/);assert.equal(categoryLoads.length,loads,'No source category change may start after the absolute lookup work deadline.');assert.equal(ruleQueries.length,0);assert.equal(JSON.stringify(fields(main)),before);assert.equal(w.VaultCapture.popup('Momentum Trading BackTest'),undefined,'The owned dialog still closes within the reserved restoration budget.');}finally{w.Date.now=now;w.VaultCapture.fields=fields;}return;
     }
     const indexes=ruleCatalogue==='search-complete'?[39,43,47]:ruleCatalogue==='search-cross-row'?[43,47]:ruleCatalogue==='exit-search-execute'?[43,47,6]:exitMode?[6]:[39];
     for(const parentIndex of indexes){
      const empty=await lookup(parentIndex,'My','missing');if(['search-no-menu','exit-search-no-menu'].includes(ruleCatalogue)){assert.equal(empty.ok,false);assert.match(empty.error,/Strategy 1 \/ My:.*system-builder choices|Exit strategy \/ My:.*system-builder choices/);assert.equal(JSON.stringify(w.VaultCapture.fields(main)),before);assert.equal(ruleSelections.length,0);assert.equal(w.VaultCapture.popup('Momentum Trading BackTest'),undefined);return;}
      assert.equal(empty.ok,true,empty.error);assert.deepEqual(Array.from(empty.result.options),[],'Only an explicit no-match response establishes empty query results.');assert.equal(JSON.stringify(w.VaultCapture.fields(main)),before);
      const result=await lookup(parentIndex,'Public','public');assert.equal(result.ok,true,result.error);assert.equal(result.result.childIndex,parentIndex+1);assert.equal(result.result.controlType,'text');assert.equal(result.result.query,'public');assert.equal(result.result.options.length,3);
      assert.equal(result.result.stage,parentIndex===6?'execution':'momentum');
      const ambiguous=result.result.options.find(o=>o.label==='Shared public rule');assert.equal(ambiguous.disabled,true,'Duplicate labels collapse to one unavailable choice.');assert.equal(ruleSelections.length,0,'Reading choices must never commit a rule.');assert.ok(ruleQueries.every(q=>q.query&&q.keyCode>0),'Every lookup uses the nonempty query and a printable key event.');
      assert.equal(JSON.stringify(w.VaultCapture.fields(main)),before);assert.deepEqual([...main.querySelectorAll('input,select')].map(n=>n.value),nativeBefore);assert.equal([...ruleMenus].some(n=>n.isConnected),false);
      const stage=parentIndex===6?execution:momentum,entry=stage.ruleCatalogues[parentIndex+1];entry.categories.Public=JSON.parse(JSON.stringify(result.result.options));entry.searchQueries.Public='public';entry.categories.My=[];entry.searchQueries.My='missing';
      if(stage.fields[parentIndex].value==='Public')stage.options[parentIndex+1]=entry.categories.Public;
     }
     if(ruleCatalogue==='exit-search-saved-baseline'){
      const source=popup('Momentum Trading BackTest');form(source,sourceExecutionFields);let nodes=[...source.querySelectorAll('input,select')].filter(n=>n.type!=='hidden');nodes[5].click();nodes[6].value='source:Public';nodes[6].dispatchEvent(new w.Event('change',{bubbles:true}));await sleep(400);
      nodes=[...source.querySelectorAll('input,select')].filter(n=>n.type!=='hidden');const search=nodes[7];search.value='Exit strategy Public first';assert.equal(search.dataset.selectedRule,'');
      const saved=()=>({baseline:{parameters:{strategy:{execution:{fields:w.VaultCapture.fields(source)}}}},dimensions:[]});
      await w.VaultRunner.apply(source,saved(),{patch:{}},'execution');assert.equal(search.dataset.selectedRule,'rule:exit:Public:first');assert.equal(ruleSelections.length,1,'A matching but uncommitted saved-baseline text value must still click its unique source result.');
      duplicateDuringExecution=true;search.dataset.selectedRule='';await assert.rejects(w.VaultRunner.apply(source,saved(),{patch:{}},'execution'),/more than one RZone choice/);assert.equal(ruleSelections.length,1);assert.equal(search.dataset.selectedRule,'','Ambiguous native choices cannot be committed from saved text.');
      duplicateDuringExecution=false;search.value='Unavailable saved rule';await assert.rejects(w.VaultRunner.apply(source,saved(),{patch:{}},'execution'),/did not confirm that rule/);assert.equal(ruleSelections.length,1);assert.equal(submissions,0);assert.equal(portfolios,0);source.remove();return;
     }
     if(['search-execute','search-ambiguous','search-cross-row','exit-search-execute','exit-search-ambiguous','exit-search-delayed-gate'].includes(ruleCatalogue)){cataloguedResponse=response;duplicateDuringExecution=['search-ambiguous','exit-search-ambiguous'].includes(ruleCatalogue);}else {S.template(response.config);return;}
    }
    else {
    if(['rejected','radar-rejected'].includes(ruleCatalogue)){
     assert.equal(response.ok,false);assert.match(response.error,/dependent choices|took too long/);assert.equal(settingsReads,0);assert.equal(sourceSuccessDialogs.length,0);
     assert.equal(categoryLoads.some(request=>request.index===(ruleCatalogue==='radar-rejected'?39:47)),false,'Stop the catalogue after a failed row rather than reading later strategies.');
    }else{
     assert.equal(response.ok,true,JSON.stringify({ruleCatalogue,error:response.error,categoryLoads}));assert.equal(settingsReads,1);
     const momentum=response.config.stages.momentum;assert.equal(momentum.fields.length,52);assert.equal(JSON.stringify(momentum.fields),before);
     assert.deepEqual(Object.keys(momentum.ruleCatalogues),['36','40','44','48']);
     for(let number=0;number<=3;number++){
      const parent=35+number*4,child=parent+1,catalogue=momentum.ruleCatalogues[child],offered=number?['My','Popular','Pre','Public']:['delayed','radar-empty'].includes(ruleCatalogue)?['My','Pre','Public']:['My','Pre'],label=number?'Strategy '+number:'Radar';
      assert.equal(catalogue.parentIndex,parent);assert.equal(catalogue.gateIndex,number?parent+3:34);assert.deepEqual(Object.keys(catalogue.categories).sort(),offered);
      for(const category of offered){
       const expected=(ruleCatalogue==='empty'||ruleCatalogue==='radar-empty'&&!number)&&['My','Public'].includes(category)?[]:['first','second'].map(word=>label+' '+category+' '+word);
       assert.deepEqual(Array.from(catalogue.categories[category],option=>option.value),expected,'Keep each strategy and category in its own catalogue.');
      }
      assert.deepEqual(momentum.options[child],catalogue.categories[number===1?'Popular':'Pre'],'The normal child menu remains scoped to its current source category.');
      const requested=categoryLoads.filter(request=>request.index===parent).map(request=>request.category);
      assert.deepEqual([...new Set(requested)].sort(),offered,'Only offered enabled categories are read, including Radar.');
      if(ruleCatalogue==='empty')assert.equal(requested.length,number?5:2,'Confirm consecutive empty categories with just one extra populated-category read per strategy.');
      if(ruleCatalogue==='radar-empty'&&!number)assert.deepEqual(requested,['My','Pre','Public','Pre'],'Consecutive empty Radar menus must still visit a populated anchor for a fresh response.');
     }
    }
    if(ruleCatalogue==='execute')cataloguedResponse=response;else return;
    }
   }
   if(groupCatalogue){
    const before=JSON.stringify(w.VaultCapture.fields(main)),beforeValue=main.querySelectorAll('input,select')[1].value;
    const preexisting=d.createElement('div');preexisting.className='popupContent';preexisting.innerHTML='<div class="abcd-1"><ul class="ind-list"><li grpid="existing">Existing open group</li></ul></div>';d.body.append(preexisting);
    const blockedGroup=await requestConfig();assert.equal(blockedGroup.ok,false);assert.equal(preexisting.isConnected,true);assert.equal(groupSearches.length,0,'An existing group menu must remain untouched.');preexisting.remove();
    if(groupCatalogue==='initial-options')nativeTimeout(()=>{
     const child=main.querySelectorAll('input,select')[40],option=d.createElement('option');
     option.textContent='Loaded initial rule';option.value='initial:rule';child.append(option);child.value=option.value;
     initialOptionsReady=true;initialSnapshot=JSON.stringify(w.VaultCapture.fields(main));
    },1100);
    const response=await requestConfig();
    const expected=JSON.parse(before);
    if(groupCatalogue==='field-drift')expected[12].value='987654321';
    if(groupCatalogue==='label-drift')expected[12].label='Period 1 changed label';
    assert.equal(JSON.stringify(w.VaultCapture.fields(main)),initialSnapshot||JSON.stringify(expected),'Catalogue reading must restore its changes without overwriting genuine source drift.');
    assert.equal(groupCommits,0,'Reading choices must never select any group.');assert.equal(groupChanges,0,'Search text must not commit a group change.');
    assert.equal(submissions,0);assert.equal(portfolios,0);assert.equal(d.querySelector('.ind-list'),null);assert.equal(w.VaultCapture.popup('Momentum Trading BackTest'),undefined);
    assert.equal(headingClicks,0,'Dismiss using the inert Chart Type cell, never the tooltip-bearing heading.');assert.equal(d.querySelector('.tool-popup.tool-tip'),null);assert.equal(d.querySelector('.popupContent'),null);
    assert.deepEqual(groupSearches[0],['open',''],'Open only after clearing the original search.');
    assert.deepEqual(groupSearches.at(-1),['search',beforeValue],'Restore the original query before dismissing the owned menu.');
    if(['field-drift','label-drift'].includes(groupCatalogue)){
     assert.equal(response.ok,false);assert.match(response.error,/settings changed while reading group choices/i);assert.match(response.error,/\b13\b/);
     assert.match(response.error,/Period/i);assert.doesNotMatch(response.error,/987654321/,'Diagnostics must not disclose raw field values.');
     assert.equal(settingsReads,0);assert.equal(categoryLoads.length,0);assert.equal(sourceSuccessDialogs.length,0);
    }else if(['duplicate','overflow','missing'].includes(groupCatalogue)){
     assert.equal(response.ok,false);assert.match(response.error,groupCatalogue==='duplicate'?/ambiguous/:groupCatalogue==='overflow'?/3,000/:/finish loading its group choices/);
     assert.equal(sourceSuccessDialogs.length,0);assert.equal(settingsReads,0,'A failed group read must stop before opening execution settings.');
    }else{
     assert.equal(response.ok,true,response.error);assert.equal(response.config.stages.momentum.fields.length,52);assert.equal(settingsReads,1);
     assert.deepEqual(Array.from(response.config.stages.momentum.options[1],o=>({...o})),groupRows.map((label,i)=>({value:label,label,sourceValue:'group:'+i,disabled:false})));
     assert.ok(groupMenuReads>=2,'Read the settled response, not just the initial popup.');
     assert.equal(lastGroupQuery,beforeValue,'Await the restored query response before dismissing, even when it is delayed.');
     if(groupCatalogue==='initial-options'){
      assert.equal(initialOptionsReady,true);assert.equal(openedBeforeInitial,false,'Wait for initial native choices before freezing the Group snapshot.');
      assert.equal(JSON.stringify(response.config.stages.momentum.fields),initialSnapshot);
      assert.equal(response.config.stages.momentum.fields[40].value,'Loaded initial rule');
      assert.ok(response.config.stages.momentum.options[40].some(option=>option.sourceValue==='initial:rule'),'Read the settled native option catalogue.');
     }
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
   if(bridge){assert.equal(bridgeConfigRequests,3,'Both rejected chart/market changes and the successful connection must cross the real background boundary.');assert.equal(response.config.session,memory['runner:tab:9'].session,'Reading settings must retain the registered document session.');assert.deepEqual(sourceMessages.slice(-4),['Connecting to Vault: opening Momentum settings…','Connecting to Vault: reading strategy choices…','Connecting to Vault: reading backtest settings…','RZone settings read. Return to Vault to finish setup.']);assert.deepEqual(sourceSuccessDialogs,[false],'Connection success must only appear after closing its own settings dialog.');}
   if(refreshParents)assert.equal(navigationCount,1);
   const template=S.template(response.config),config=S.defaults(template);
   Object.assign(config,{'momentum.group':'Nifty 50 Index','momentum.timeframe':'Weekly','momentum.period.2.enabled':true,'momentum.period.2':90,'momentum.ema.1.enabled':true,'momentum.ema.1':200,'momentum.ema.2':55,'momentum.retracement.enabled':true,'momentum.retracement.reference':'8','momentum.volume.reference':'21','momentum.tma':true,'momentum.trend-quality.enabled':true,'momentum.trend-quality':60,'execution.from':'2023-01-01','execution.to':'2024-12-31','execution.target.enabled':false,'execution.target':7,'execution.stop':12,'portfolio.allocation':'Fixed','portfolio.capital':500000,'portfolio.max-open':8,'portfolio.daily-limit.enabled':true,'portfolio.daily-limit':3});
   if(refreshParents){assert.deepEqual(Array.from(response.config.stages.momentum.options[40],o=>o.value),['My trend rule','My alternate rule']);Object.assign(config,{'momentum.strategy.1.enabled':true,'momentum.strategy.1.rule':'My alternate rule','momentum.strategy.1.timeframe':'Weekly','execution.exit.enabled':true,'execution.exit.rule':'My alternate rule'});}
   if(ruleCatalogue==='execute')for(const [number,category]of ['My','Public','My','Popular'].entries()){const prefix=number?'momentum.strategy.'+number:'momentum.radar',label=number?'Strategy '+number:'Radar';Object.assign(config,{[prefix+'.source']:category,[prefix+'.rule']:label+' '+category+' second',[prefix+'.enabled']:true});}
   if(['search-execute','search-ambiguous'].includes(ruleCatalogue))Object.assign(config,{'momentum.strategy.1.source':'Public','momentum.strategy.1.rule':'Strategy 1 Public first','momentum.strategy.1.enabled':true});
   if(crossRows)for(const number of [2,3])Object.assign(config,{['momentum.strategy.'+number+'.source']:'Public',['momentum.strategy.'+number+'.rule']:'Strategy '+number+' Public first',['momentum.strategy.'+number+'.enabled']:true});
   if(['exit-search-execute','exit-search-ambiguous','exit-search-delayed-gate'].includes(ruleCatalogue))Object.assign(config,{'execution.exit.source':'Public','execution.exit.rule':'Exit strategy Public first','execution.exit.enabled':true});
   const baseline=S.configToBaseline(config,template,{id:'empty-library-setup',name:'Configured in Vault',demo:false});
   const variableDimensions=variableSet==='momentum'?[['momentum.period.2.enabled',[false,true]],['momentum.period.2',[90,180]],['momentum.ema.1.enabled',[false,true]],['momentum.strategy.1.rule',['Demo trend rule','Alternate trend rule']],['momentum.retracement.reference',['7','9']],['momentum.volume.reference',['20','21']]]:variableSet==='rules'?[['momentum.radar.enabled',[false,true]],['momentum.radar.rule',['Demo momentum screen','Alternate momentum screen']],['execution.exit.enabled',[false,true]],['execution.exit.rule',['Demo exit rule','Alternate exit rule']],['execution.target.enabled',[false,true]],['execution.target',[7,9]]]:variableSet==='execution-context'?[['execution.rank',['Return Percent','Fictional alternate rank']],['execution.from',['2021-01-01','2022-01-01']],['execution.to',['2023-12-31','2024-12-31']],['portfolio.allocation',['Fixed','Reinvestment']],['portfolio.capital',[100000,250000]],['portfolio.max-open',[4,9]]]:variableSet==='portfolio-sizing'?[['execution.rank',['Return Percent','Fictional alternate rank']],['portfolio.allocation',['Fixed','Reinvestment']],['portfolio.capital',[100000,250000]],['portfolio.max-open',[4,9]],['portfolio.daily-limit.enabled',[false,true]],['portfolio.daily-limit',[2,5]]]:null;
   plan=E.create({id:'runner-proof',name:'Runner proof',baseline,dimensions:variableDimensions?variableDimensions.map(([key,values])=>({key,values})):[{key:'momentum.period.1',values:'126,180,252'}],...(variableSet?{mode:'sample',budget:3,seed:5}:{}),minTrades:0});memory['experiment:'+plan.id]=plan;
   assert.equal(Object.keys(memory).some(k=>k.startsWith('run:')),false,'A new setup must work with an empty archive.');
   if(changedOptions)main.querySelectorAll('input,select')[33].querySelector('option[value="source:Weekly"]').remove();
   // Let the source register again after the setup-reading status.
   for(let n=0;n<30&&!memory['runner:tab:9']?.ready;n++)await sleep(10);
  }
  await coordinator.handle({action:'start',id:plan.id,tabId:9},dashboard);
  for(const fn of listeners)fn({type:'vault-runner-wake'},{id:runtime.id},()=>{});
  for(let n=0;n<(crossRows||exitMode?1200:600)&&!['complete','needs-review'].includes(memory['experiment:'+plan.id].status);n++)await sleep(20);
  const result=memory['experiment:'+plan.id];
  const runs=Object.entries(memory).filter(([k])=>k.startsWith('run:')).map(([,v])=>v);
  if(['search-ambiguous','exit-search-ambiguous'].includes(ruleCatalogue)){assert.equal(result.status,'needs-review',JSON.stringify(result.trials));assert.match(result.trials[0].error,/more than one RZone choice/);assert.equal(submissions,0);assert.equal(portfolios,0);assert.equal(runs.length,0);assert.equal(ruleSelections.length,0);}
  else if(missingGroup||changedOptions||driftDuringRun){
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
   if(ruleCatalogue==='execute')assert.deepEqual(strategyNativeSubmissions,Array.from({length:3},()=>['My','Public','My','Popular'].map((category,index)=>({category:'source:'+category,rule:'rule:'+index+':'+category+':second',enabled:true}))),'Apply each cached category before resolving its exact native rule option, on every source submission.');
   if(crossRows){
    assert.ok(runs.every(r=>E.fields(r,'momentum').slice(47,51).every(f=>f.label.startsWith('Str 2 : / Publici → Str 3 : / Publici'))),'Compose both changed source categories in exact captured ancestor/child labels.');assert.equal(ruleSelections.filter(s=>[43,47].includes(s.index)).length,6);
    const nodes=[...main.querySelectorAll('input,select')].filter(n=>n.type!=='hidden'),drift=d.createTextNode(' Unexpected source label'),count=ruleSelections.length;nodes[47].closest('tr').firstElementChild.append(drift);
    await assert.rejects(w.VaultRunner.apply(main,plan,plan.trials.at(-1),'momentum'),/Settings layout changed/);assert.equal(ruleSelections.length,count,'Observed category metadata never authorizes unrelated label changes.');drift.remove();
   }
   if(['exit-search-execute','exit-search-delayed-gate'].includes(ruleCatalogue)){assert.equal(ruleSelections.filter(s=>s.index===6).length,3);assert.ok(runs.every(r=>E.fields(r,'execution')[7].type==='text'&&E.fields(r,'execution')[7].value==='Exit strategy Public first'));}
   if(ruleCatalogue==='search-execute'){
    assert.equal(ruleSelections.length,3);assert.ok(ruleSelections.every(s=>s.category==='Public'&&s.id==='rule:1:Public:first'));assert.ok(runs.every(r=>E.fields(r,'momentum')[40].type==='text'&&E.fields(r,'momentum')[40].value==='Strategy 1 Public first'),'Save actual source input types with exact selected rule labels.');
    await sleep(50);const beforeReconnect=JSON.stringify(w.VaultCapture.fields(main));
    const reconnect=await new Promise(resolve=>{for(const fn of listeners)fn({type:'vault-runner-config'},{id:runtime.id},resolve);});
    assert.equal(reconnect.ok,true,reconnect.error);assert.equal(JSON.stringify(w.VaultCapture.fields(main)),beforeReconnect,'A known exact selection is restored after future connections.');
    assert.equal(ruleSelections.length,4);assert.equal(ruleSelections.at(-1).id,'rule:1:Public:first');assert.equal(reconnect.config.stages.momentum.ruleCatalogues[40].searchQueries.Public,'Strategy 1 Public first');S.template(reconnect.config);
    // Model a genuine source-menu click that changes only the committed ID,
    // while preserving its duplicate display label and emitting no input event.
    const manualMenu=d.createElement('ul');manualMenu.className='ind-list';const manualChoice=d.createElement('li');manualChoice.setAttribute('sbid','manually-selected-duplicate');manualChoice.textContent='Strategy 1 Public first';manualMenu.append(manualChoice);d.body.append(manualMenu);
    for(const listener of runnerUIListeners.filter(item=>item.type==='click'))listener.fn({isTrusted:true,target:manualChoice});manualMenu.remove();
    const loadCount=categoryLoads.length,queryCount=groupSearches.length,afterManual=await new Promise(resolve=>{for(const fn of listeners)fn({type:'vault-runner-config'},{id:runtime.id},resolve);});
    assert.equal(afterManual.ok,false);assert.match(afterManual.error,/Finish or clear the Strategy 1 rule search/);assert.equal(categoryLoads.length,loadCount);assert.equal(groupSearches.length,queryCount,'An unverified manual source selection is rejected before any discovery mutation.');
   }
   if(overlap){assert.equal(guardedStates.length,3);assert.ok(guardedStates.every((s,i)=>s.completed===false&&s.portfolios===i),'Old completion text while Cancel is visible must not complete the trial.');}
   for(const r of runs){assert.equal(r.provenance,'recorded-at-submit');assert.equal(r.charts.length,6);assert.equal(r.trades.rows.length,4);assert.equal(r.trades.rows[1][2],'0');assert.equal(r.experiment.id,plan.id);
    if(vaultSetup){const t=plan.trials.find(t=>t.runId===r.id),expected=E.expected(plan,t);for(const stage of ['momentum','execution','portfolio'])E.verify(E.fields(expected,stage),E.fields(r,stage));assert.equal(E.fields(r,'momentum')[1].value,'Nifty 50 Index');assert.equal(E.fields(r,'execution')[1].value,t.patch['execution.from']||'2023-01-01');assert.equal(E.fields(r,'portfolio')[2].value,String(t.patch['portfolio.capital']||500000));
     if(contextVariations){
      for(const stage of ['execution','portfolio']){assert.deepEqual(submittedStageFields[stage][t.ordinal-1],JSON.parse(JSON.stringify(E.fields(expected,stage))),'Every submitted '+stage+' control must match that trial, including dates and disabled-state gates.');assert.deepEqual(JSON.parse(JSON.stringify(E.fields(r,stage))),submittedStageFields[stage][t.ordinal-1],'The saved source snapshot must preserve the exact settings used for its own result.');}
      const indexes={'execution.rank':0,'execution.from':1,'execution.to':2,'portfolio.allocation':1,'portfolio.capital':2,'portfolio.max-open':3,'portfolio.daily-limit.enabled':4,'portfolio.daily-limit':5};
      for(const dimension of plan.dimensions){const field=E.fields(r,dimension.stage)[indexes[dimension.key]],value=t.patch[dimension.key];assert.equal(typeof value==='boolean'?field.checked:field.value,typeof value==='boolean'?value:String(value),'The saved '+dimension.key+' must equal the chosen trial value, independently of expected-field generation.');}
     }
    }
    if(variableSet){const m=E.fields(r,'momentum'),x=E.fields(r,'execution'),p=E.fields(r,'portfolio');assert.equal(m.slice(7,11).filter(f=>f.checked).length,1,'Retracement reference stays exclusive.');assert.equal(m.slice(20,22).filter(f=>f.checked).length,1,'Volume reference stays exclusive.');for(const [gate,child]of [[11,12],[13,14],[26,27],[34,36]])assert.equal(m[child].disabled,!m[gate].checked);for(const [gate,child]of [[5,7],[8,9]])assert.equal(x[child].disabled,!x[gate].checked);assert.equal(p[5].disabled,!p[4].checked,'Daily-limit values retain the planned gate state, even when the numeric value changes while Off.');}
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
// Complete fictional native forms exercise independent chart contexts without
// granting the still-closed live execution capability for P&F or Renko.
async function chartScenario(chartCase){
 const L=require('../dist/source-layouts.js'),dom=new JSDOM('<body><h1 class="header-text">Momentum Trading BackTesting</h1><div class="account-right"></div></body>',{runScripts:'outside-only',url:'https://zone.definedgesecurities.com/index.html#research'}),w=dom.window,d=w.document,main=d.querySelector('.account-right'),listeners=[],counts={categories:0,groups:0,submissions:0},menus=new Set();
 w.structuredClone=structuredClone;Object.defineProperty(w.HTMLElement.prototype,'innerText',{get(){return this.textContent;}});w.Element.prototype.getClientRects=function(){return this.isConnected&&!this.closest('[hidden]')?[{width:100,height:20}]:[];};
 const initial=chartCase==='Renko'?'Renko':chartCase==='warm-reversal'?'P&F':'Candle';let executionState=null,privateRadarChoices=[];const categoryRequests=[],groupRows=['Demo universe 40','Other fictional group'];
 const state=(stage,chart)=>JSON.parse(JSON.stringify(S.demoTemplate({momentumChart:chart,executionChart:chart}).stages[stage]));
 function nodes(p){return [...p.querySelectorAll('input,select')].filter(n=>n.type!=='hidden');}
 function optionsFor(stage,layout,index,field,descriptor){const row=layout.rows.find(row=>row.parentIndex===index);return row?(row.name==='Radar'?['Pre','My']:['Pre','My','Public','Popular']):index===layout.chartIndex?L.charts:descriptor.options[index]?.map(o=>o.label)||[field.value];}
 function render(p,stage,descriptor){
  p.querySelector('table')?.remove();const layout=L.stage(stage,descriptor.fields),table=d.createElement('table');
  for(const field of descriptor.fields){const tr=d.createElement('tr'),label=d.createElement('td'),cell=d.createElement('td');label.textContent=field.label;const node=d.createElement(field.type==='select-one'?'select':'input');if(node.tagName==='SELECT'){for(const value of optionsFor(stage,layout,field.index,field,descriptor)){const o=d.createElement('option');o.value='native:'+value;o.textContent=value;node.append(o);}node.value='native:'+field.value;}else {node.type=field.type;node.value=field.value;if(field.checked!==null)node.checked=field.checked;if(field.type==='radio')node.name=stage+':'+(/52 Week|ATH|ATL/.test(field.label)?'retracement':/Running/.test(field.label)?'signal':/Close Only/.test(field.label)?'price':'volume');}node.disabled=field.disabled;cell.append(node);tr.append(label,cell);table.append(tr);}p.prepend(table);
  const current=nodes(p),sync=()=>{if(stage==='execution')executionState={fields:JSON.parse(JSON.stringify(w.VaultCapture.fields(p))),options:Object.fromEntries(nodes(p).flatMap((n,i)=>n.tagName==='SELECT'?[[i,[...n.options].map(o=>({label:o.textContent,value:o.textContent}))]]:[]))};};
  for(const [gate,...children]of layout.gates){const update=()=>children.forEach(index=>current[index].disabled=!current[gate].checked);current[gate].addEventListener('change',update);update();}
  for(const row of layout.rows){
   let child=current[row.childIndex];const populate=()=>{const category=current[row.parentIndex].selectedOptions[0].textContent,search=row.name!=='Radar'&&['My','Public'].includes(category),next=d.createElement(search?'input':'select');next.disabled=!current[row.gateIndex].checked;child.replaceWith(next);child=next;current[row.childIndex]=next;
    if(search){next.type='text';next.placeholder='Search System Builder';next.addEventListener('keyup',()=>{for(const menu of menus)menu.remove();if(!next.value)return;const menu=d.createElement('div');menu.className='popupContent';menus.add(menu);if(category==='My')menu.innerHTML='<div class="gwt-HTML">No matching system builder found</div>';else{const ul=d.createElement('ul');ul.className='ind-list';const li=d.createElement('li');li.setAttribute('sbid',stage+':'+layout.chart+':public');li.textContent=layout.chart+' public rule';li.onclick=()=>{next.value=li.textContent;menu.remove();};ul.append(li);menu.append(ul);}d.body.append(menu);});}
    else {const values=category==='My'?privateRadarChoices:[descriptor.fields[row.childIndex].type==='select-one'?descriptor.fields[row.childIndex].value:'Demo rule',layout.chart+' '+row.name+' '+category+' rule'];for(const value of [...new Set(values)]){const o=d.createElement('option');o.value='native:'+value;o.textContent=value;next.append(o);}}
   };
   populate();current[row.parentIndex].addEventListener('change',()=>{counts.categories++;categoryRequests.push({stage,row:row.name,category:current[row.parentIndex].selectedOptions[0].textContent});w.setTimeout(populate,150);});
  }
  const chart=current[layout.chartIndex];chart.addEventListener('change',()=>{const target=chart.selectedOptions[0].textContent,group=stage==='momentum'?current[1].value:null;w.setTimeout(()=>{const next=state(stage,target);if(stage==='momentum')next.fields[1].value=group;render(p,stage,next);},100);});
  if(layout.chart==='Renko')current[layout.modeIndex].addEventListener('change',()=>{current[layout.sizeIndex].value=({Absolute:'10',Percent:'1',ATR:'14','ATR %':'14'})[current[layout.modeIndex].selectedOptions[0].textContent];});
  const outside=current[layout.chartIndex].closest('tr').firstElementChild;outside.addEventListener('click',()=>{for(const menu of menus)menu.remove();});
  if(stage==='momentum'){
   const group=current[1];group.placeholder='Search Group';group.addEventListener('keyup',()=>{counts.groups++;for(const menu of menus)menu.remove();const menu=d.createElement('div');menu.className='popupContent';menus.add(menu);const list=d.createElement('ul');list.className='ind-list';for(const value of groupRows){const li=d.createElement('li');li.setAttribute('grpid','group:'+value);li.textContent=value;li.onclick=()=>{group.value=value;menu.remove();};list.append(li);}menu.append(list);d.body.append(menu);});
  }
  return {sync};
 }
 function openExecution(){const p=d.createElement('div');p.className='popupContent';p.innerHTML='<div class="custom-dialog-header"><div class="caption">Momentum Trading BackTest</div><a class="close-buton"></a></div>';d.body.append(p);render(p,'execution',executionState||state('execution',initial));p.querySelector('.close-buton').onclick=()=>{executionState={fields:JSON.parse(JSON.stringify(w.VaultCapture.fields(p))),options:Object.fromEntries(nodes(p).flatMap((n,i)=>n.tagName==='SELECT'?[[i,[...n.options].map(o=>({label:o.textContent,value:o.textContent}))]]:[]))};p.remove();};return p;}
 w.chrome={storage:{local:{get:async()=>({}),set:async()=>{}}},runtime:{id:'chart-fixture',getURL:f=>'chrome-extension://chart-fixture/'+f,sendMessage:async()=>({ok:true}),onMessage:{addListener:fn=>listeners.push(fn)}}};
 w.URL.createObjectURL=()=> 'blob:fictional';w.URL.revokeObjectURL=()=>{};
 for(const file of ['core.js','presentation.js','intelligence.js','source-layouts.js','setup.js','experiments.js','capture.js'])w.eval(fs.readFileSync(path.join(base,file),'utf8'));
 const initialMain=state('momentum',initial);if(chartCase==='warm-reversal'){initialMain.fields[55].value='5';executionState=state('execution',initial);executionState.fields[5].value='5';}render(main,'momentum',initialMain);const open=d.createElement('button');open.textContent='BackTest';open.onclick=openExecution;main.append(open);w.eval(fs.readFileSync(path.join(base,'runner.js'),'utf8'));
 const request=message=>new Promise(resolve=>{for(const listener of listeners)listener({type:'vault-runner-config',...message},{id:'chart-fixture'},resolve);});
 try{
  const before=JSON.stringify(w.VaultCapture.fields(main)),first=await request({});assert.equal(first.ok,true,first.error);assert.equal(JSON.stringify(w.VaultCapture.fields(main)),before);assert.equal(first.choicesFromCache,false);assert.equal(first.choiceCache.adapterVersion,L.version);assert.equal(first.choiceCache.stages.momentum.context.chart,initial);assert.equal(JSON.stringify(first.choiceCache).includes('capturedAt'),false);assert.equal(Object.hasOwn(first.choiceCache.stages.momentum,'fields'),false);
  if(chartCase==='cache-reconnect'){
   // Feed the real reader reply through the real coordinator's persistence
   // boundary; the next source receives the exact sanitized stored payload.
   const memory={},runtime={id:'cache-reconnect',getURL:p=>'chrome-extension://cache-reconnect/'+p},storage={get:async key=>structuredClone(key?{[key]:memory[key]}:memory),set:async values=>Object.assign(memory,structuredClone(values))};
   const coordinator=createCoordinator({storage,runtime,probe:async()=>({session:first.session,ready:true,capable:true}),configure:async()=>first});
   await coordinator.handle({action:'hello',session:first.session,ready:true,capable:true},{id:runtime.id,url:'https://zone.definedgesecurities.com/index.html#research',tab:{id:12}});
   await coordinator.handle({action:'configure',tabId:12},{id:runtime.id,url:runtime.getURL('index.html')});
   const shared=memory['runner:choices:shared-native'].records[0].payload;assert.equal(shared.publicOnly,true);assert.equal(shared.session,undefined);
   groupRows.push('Current account group');privateRadarChoices=['Current account radar'];nodes(main)[12].value='444';const countsBefore={...counts},requestsBefore=categoryRequests.length;
   const reopened=await request({cachedChoices:[shared]});assert.equal(reopened.ok,true,reopened.error);assert.equal(reopened.choicesFromCache,true);assert.equal(reopened.sharedChoicesUsed,true);assert.equal(reopened.config.stages.momentum.fields[12].value,'444');assert.ok(reopened.config.stages.momentum.options[1].some(o=>o.label==='Current account group'));assert.ok(reopened.config.stages.momentum.ruleCatalogues[36].categories.My.some(o=>o.label==='Current account radar'));assert.ok(counts.groups>countsBefore.groups,'The current account’s groups are freshly read');assert.ok(categoryRequests.slice(requestsBefore).some(r=>r.row==='Radar'&&r.category==='My'),'The private native My menu is freshly read');assert.ok(!categoryRequests.slice(requestsBefore).some(r=>r.category==='Popular'),'Public Popular menus are not scanned again');assert.equal(w.VaultCapture.popup('Momentum Trading BackTest'),undefined);assert.equal(nodes(main)[35].selectedOptions[0].textContent,'Pre');assert.equal(nodes(main)[34].checked,false,'Owned discovery restores the original source gate');
   const poisoned=structuredClone(shared);poisoned.stages.momentum.ruleCatalogues[36].categories.My=[{value:'Old account radar',label:'Old account radar'}];poisoned.stages.momentum.ruleCatalogues[36].controlTypes.My='select-one';const previous=categoryRequests.length,rejected=await request({cachedChoices:[poisoned]});assert.equal(rejected.ok,true,rejected.error);assert.equal(rejected.choicesFromCache,false);assert.ok(categoryRequests.slice(previous).some(r=>r.stage==='momentum'&&r.category==='Popular'),'A contaminated shared stage falls back to fresh discovery');assert.ok(!JSON.stringify(rejected.config).includes('Old account radar'));
   return;
  }
  if(chartCase==='cache'){
   const countsBefore={...counts};nodes(main)[12].value='333';const reused=await request({cachedChoices:[first.choiceCache]});assert.equal(reused.ok,true,reused.error);assert.equal(reused.choicesFromCache,true);assert.equal(reused.config.stages.momentum.fields[12].value,'333','Cached choices never overwrite freshly read source values.');assert.deepEqual(counts,countsBefore,'A cache hit never opens group or dependent-category menus.');
   const forced=await request({cachedChoices:[first.choiceCache],forceChoices:true});assert.equal(forced.ok,true,forced.error);assert.equal(forced.choicesFromCache,false);assert.ok(counts.categories>countsBefore.categories&&counts.groups>countsBefore.groups);
   const mixed=structuredClone(forced.choiceCache);mixed.stages.execution.context.chart='Renko';const mixedCounts={...counts},partial=await request({cachedChoices:[mixed]});assert.equal(partial.ok,true,partial.error);assert.equal(partial.choicesFromCache,false);assert.equal(partial.hasCachedChoices,true,'Mixed stage provenance must remain explicit across a local-date boundary.');assert.equal(counts.groups,mixedCounts.groups);assert.ok(counts.categories>mixedCounts.categories);
   const stale=structuredClone(forced.choiceCache);stale.session='different-document';const oldCounts={...counts},renewed=await request({cachedChoices:[stale]});assert.equal(renewed.ok,true,renewed.error);assert.equal(renewed.choicesFromCache,false);assert.ok(counts.categories>oldCounts.categories);return;
  }
  if(chartCase.startsWith('warm')){
   const target=chartCase==='warm-reversal'?'Renko':'P&F',originalExecution=JSON.stringify(executionState.fields),warm=await request({warmChart:target});assert.equal(warm.ok,true,warm.error);assert.equal(warm.config.stages.momentum.fields[0].value,target);assert.equal(warm.config.stages.execution.fields[3].value,target);assert.equal(JSON.stringify(w.VaultCapture.fields(main)),before,'A warm chart scan restores every original main value and gate.');assert.equal(JSON.stringify(executionState.fields),originalExecution,'The independent original execution chart and controls are restored.');if(chartCase==='warm-reversal'){assert.equal(nodes(main)[55].selectedOptions[0].textContent,'5');assert.equal(executionState.fields[5].value,'5','Nondefault P&F reversal must be restored after warming another chart.');}assert.equal(w.VaultCapture.popup('Momentum Trading BackTest'),undefined);return;
  }
  const chart=chartCase,switched=chart===initial?first:await request({changes:{momentum:{0:chart}}});assert.equal(switched.ok,true,switched.error);assert.equal(switched.config.stages.momentum.fields.length,58);assert.equal(switched.config.stages.execution.fields[3].value,initial,'Main and execution charts are independent.');
  const paired=await request({changes:{execution:{3:chart}}});assert.equal(paired.ok,true,paired.error);assert.equal(paired.config.stages.execution.fields.length,16);const t=S.template(paired.config),config=S.defaults(t),layout=L.main(chart),exit=L.execution(chart);
  config['momentum.period.1']=444;config[chart==='P&F'?'momentum.box.size':'momentum.brick.size']=chart==='P&F'?1.5:20;config['execution.target']=9;config['momentum.strategy.1.input']=0.75;
  const descriptors=S.fieldsForUI(t).flatMap(g=>g.fields),number=descriptors.find(f=>f.stage==='momentum'&&f.index===layout.rows[1].valueIndex);delete config['momentum.strategy.1.input'];config[number.key]=0.75;
  const b=S.configToBaseline(config,t),experiment={baseline:b,dimensions:[]},trial={patch:{}};await w.VaultRunner.apply(main,experiment,trial,'momentum');assert.equal(nodes(main)[12].value,'444');assert.equal(nodes(main)[layout.rows[1].valueIndex].value,'0.75');assert.equal(nodes(main)[layout.sizeIndex].value,String(chart==='P&F'?1.5:20));const p=openExecution();await w.VaultRunner.apply(p,experiment,trial,'execution');assert.equal(nodes(p)[exit.targetValueIndex].value,'9');p.querySelector('.close-buton').click();assert.equal(S.executionCapability(t).available,false,'Fictional application proof does not open the live execution gate.');
  if(chart==='Renko'){const mode=await request({changes:{momentum:{55:'Percent'}}});assert.equal(mode.ok,true,mode.error);assert.equal(mode.config.stages.momentum.fields[54].value,'1','The fresh source reset is captured when the Renko brick mode changes.');}
 }finally{assert.equal(counts.submissions,0);dom.window.close();}
}
(async()=>{
 const readinessCases=['initial-options','field-drift','label-drift'];
 const cases=[
  ...['complete','delayed','empty','radar-empty','rejected','radar-rejected','execute',...searchCases].map(ruleCatalogue=>({vaultSetup:true,ruleCatalogue})),
  ...['blank','nonblank','delayed','late-restore','duplicate','overflow','missing',...readinessCases].map(groupCatalogue=>({vaultSetup:true,groupCatalogue})),
  {},{overlap:true},{changeLocked:true},{staleCompletion:true},{noRunning:true},{rejected:true},{reuseReport:true},{preexistingReport:true},
  {vaultSetup:true,bridge:true},{vaultSetup:true,closeAfterWake:true},{vaultSetup:true,closeStuckAfterWake:true},{vaultSetup:true,refreshParents:true},{vaultSetup:true,noOptionRefresh:true},
  {vaultSetup:true,emptyOptions:true,variableSet:'momentum'},{vaultSetup:true,missingGroup:true},{vaultSetup:true,changedOptions:true},{vaultSetup:true,driftDuringRun:true},{vaultSetup:true,variableSet:'momentum'},{vaultSetup:true,variableSet:'rules'},
  {vaultSetup:true,variableSet:'execution-context'},{vaultSetup:true,variableSet:'portfolio-sizing'},
  ...['P&F','Renko','cache','warm','warm-reversal','cache-reconnect'].map(chartCase=>({chartCase}))
 ];
 if(fromCase===1&&!requestedCatalogue&&!process.argv.includes('--variations')&&!process.argv.includes('--readiness')){await backgroundFocusChecks();console.log('PASS: background focus and deadline checks (9 cases).');}
 const selected=cases.filter(o=>(!requestedCatalogue||o.ruleCatalogue===requestedCatalogue)&&(!process.argv.includes('--readiness')||readinessCases.includes(o.groupCatalogue))&&(!process.argv.includes('--catalogues')||o.ruleCatalogue)&&(!process.argv.includes('--groups')||o.groupCatalogue)&&(!process.argv.includes('--setup')||o.vaultSetup)&&(!process.argv.includes('--variations')||o.variableSet)&&(!process.argv.includes('--bridge')||o.bridge)&&(!process.argv.includes('--close')||o.closeAfterWake||o.closeStuckAfterWake));
 if(fromCase>selected.length)throw Error('Runner starting case exceeds the selected scenarios.');
 if(toCase!==Infinity&&toCase>selected.length)throw Error('Runner ending case exceeds the selected scenarios.');
 const lastCase=Math.min(toCase,selected.length);
 for(const [index,options]of selected.slice(fromCase-1,lastCase).entries()){
  if(options.chartCase)await chartScenario(options.chartCase);else await scenario(options);console.log('PASS: runner '+(index+fromCase)+'/'+selected.length+' '+(Object.keys(options).length?JSON.stringify(options):'baseline sequence'));
 }
 console.log('PASS: '+(lastCase-fromCase+1)+' runner scenarios, including source receipts, empty-library setup, dependent rule refresh, group resolution, control read-back and rejection guards. Live GWT/extension acceptance remains separate.');
})().catch(e=>{console.error(e);process.exitCode=1;});
