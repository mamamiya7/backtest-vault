const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom'),fixture=require('./fixtures/filter-setup.cjs'),Setup=require('../dist/setup.js');
const root=path.resolve(__dirname,'../dist'),files=['core.js','presentation.js','intelligence.js','demo.js','source-layouts.js','setup.js','experiments.js','date-range.js','workspace-motion.js','experiments-ui.js'];
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
async function check(main,exit,filter){
 const dom=new JSDOM('<main></main>',{runScripts:'outside-only',url:'chrome-extension://ui-preservation/index.html'}),w=dom.window,d=w.document;w.structuredClone=structuredClone;w.setInterval=()=>1;w.clearInterval=()=>{};w.HTMLElement.prototype.scrollIntoView=function(){};
 for(const file of files)w.eval(fs.readFileSync(path.join(root,file),'utf8'));
 const source=fixture({chart:main,marketChart:filter,exitPrices:true});source.stages.execution=Setup.demoTemplate({executionChart:exit}).stages.execution;source.demo=false;source.session='ui-preservation';source.choiceCache={checkedAt:new Date().toISOString(),source:'cache',scope:'daily',charts:['Candle','P&F','Renko']};
 const commands=[];w.chrome={runtime:{sendMessage:async m=>{commands.push(m);if(m.action==='list')return {ok:true,experiments:[],tabs:[{id:9,session:source.session,capable:true,ready:true}]};assert.equal(m.action,'configure');return {ok:true,source:structuredClone(source)};}}};
 const store={demo:false,all:async()=>[],allBenchmarks:async()=>[]},field=key=>d.querySelector('[data-setup-field="'+key+'"]'),wrap=key=>d.querySelector('[data-source-field="'+key+'"]'),change=(key,value)=>{const n=field(key);assert.ok(n,key);n.value=value;n.dispatchEvent(new w.Event('change',{bubbles:true}));},click=(text,scope=d)=>{const b=[...scope.querySelectorAll('button')].find(n=>n.textContent===text);assert.ok(b,text);b.click();};
 try{
  await w.VaultExperimentsUI.render({target:d.querySelector('main'),store,runs:[],onOpen:()=>{},onExit:()=>{},table:()=>d.createElement('table'),download:()=>{},startNew:true});await tick();
  assert.ok(d.querySelector('.research-workbench'));const initialCalls=commands.filter(m=>m.action==='configure').length;
  for(const f of w.VaultSetup.fieldsForUI(source).flatMap(g=>g.fields)){
   if(/\.price\./.test(f.key)){assert.ok(field(f.key.replace(/\.price\.(close-only|high-low)$/,'.price-mode')),'Paired price control '+f.key);continue;}
   assert.equal(d.querySelectorAll('[data-setup-field="'+f.key+'"]').length,1,'Exactly one source binding: '+[main,exit,filter,f.key].join('/'));
   if(f.stage!=='marketFilter')assert.equal(field(f.key).closest('dialog'),null,'Only Market Trend lives in its window');
  }
  assert.equal(field('momentum.chart').value,main);assert.equal(field('execution.chart').value,exit);
  const radar=d.querySelector('[data-enable-field="momentum.radar.enabled"]');radar.click();assert.equal(field('momentum.radar.rule').disabled,false);radar.click();assert.equal(field('momentum.radar.rule').disabled,true);
  d.querySelector('[data-enable-field="momentum.rs"]').click();assert.equal(field('momentum.rs.rule').disabled,false);assert.equal(field('momentum.rs.benchmark').disabled,false);
  d.querySelector('[data-enable-field="momentum.market-filter"]').click();const dialog=d.querySelector('.research-filter-dialog');assert.equal(dialog.open,true);assert.equal(field('marketFilter.chart').value,filter);
  for(const mode of ['Index','RS']){change('marketFilter.mode',mode);assert.equal(wrap('marketFilter.index.symbol').hidden,mode!=='Index');assert.equal(wrap('marketFilter.numerator.symbol').hidden,mode!=='RS');assert.equal(wrap('marketFilter.denominator.symbol').hidden,mode!=='RS');
   for(const method of ['EMA','D Smart','MAST','KTQP']){change('marketFilter.method',method);for(const key of ['ema','dsmart','mast','ktqp'])assert.equal(wrap('marketFilter.'+key).hidden,key!==method.toLowerCase().replace(' ',''));
    for(const [i,action]of w.VaultSourceLayouts.marketActions.entries()){change('marketFilter.action',action);assert.equal(wrap('marketFilter.exit.enabled').hidden,i<2);assert.equal(wrap('marketFilter.target.enabled').hidden,i<2);}
   }
  }
  dialog.dispatchEvent(new w.Event('cancel',{cancelable:true}));assert.equal(dialog.open,false);assert.equal(d.activeElement.textContent,'Market Trend Filter');click('Market Trend Filter');assert.equal(dialog.open,true);click('Done',dialog);assert.equal(dialog.open,false);
  assert.equal(commands.filter(m=>m.action==='configure').length,initialCalls,'Toggles and opening cached filters do not rescan the source');assert.ok(commands.every(m=>['list','configure'].includes(m.action)));
  const editor=d.querySelector('[data-variation-for="momentum.period.1"]'),original=field('momentum.period.1').value;click('Test values',editor);const input=editor.querySelector('[aria-label="Period 1 test values"]');input.value='252,500';input.dispatchEvent(new w.Event('input'));assert.match(d.querySelector('.source-count-bar').textContent,/2 tests/);click('Cancel',editor);assert.equal(field('momentum.period.1').value,original,'Cancel restores the original baseline');assert.match(d.querySelector('.source-count-bar').textContent,/1 test planned/);
  click('Test values',editor);editor.querySelector('[aria-label="Period 1 test values"]').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(editor.querySelector('.source-values-editor').hidden,true);
  if(main==='Candle'&&exit==='Candle'&&filter==='Candle'){click('Test values',editor);const draft=editor.querySelector('[aria-label="Period 1 test values"]');draft.value='200,400';draft.dispatchEvent(new w.Event('input'));click('My studies');click('Continue setup');const resumed=d.querySelector('[data-variation-for="momentum.period.1"]');click('Cancel',resumed);assert.equal(field('momentum.period.1').value,original,'Cancel retains its original snapshot after leaving and resuming setup');assert.match(d.querySelector('.source-count-bar').textContent,/1 test planned/);}
  const capability=w.VaultSetup.executionCapability(source);assert.equal(capability.available,true,'Current source capability covers each independently selected chart layout');
 }finally{w.VaultExperimentsUI.dispose();dom.window.close();}
}
(async()=>{let layouts=0;for(const main of ['Candle','P&F','Renko'])for(const exit of ['Candle','P&F','Renko'])for(const filter of ['Candle','P&F','Renko']){await check(main,exit,filter);layouts++;}console.log('PASS: '+layouts+' independent chart layouts, all model fields rendered once; 864 Market Trend mode/method/action states; native gates, Radar/RS, filter-window reopen/Escape, cancel, no extra discovery, advertised execution eligibility.');})().catch(error=>{console.error(error);process.exitCode=1;});
