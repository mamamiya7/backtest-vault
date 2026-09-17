const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const base=path.resolve(__dirname,'../dist');
const dom=new JSDOM(fs.readFileSync(path.join(base,'index.html'),'utf8'),{runScripts:'outside-only',url:'http://localhost/?view=library'});
const w=dom.window,d=w.document, downloads=[];
w.URL.createObjectURL=blob=>{downloads.push(blob);return 'blob:test';};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
const field=n=>({at:'2026-09-13',fields:[{index:0,label:'Period',type:'text',value:String(n),checked:null,disabled:false}]});
const make=(id,ret,mdd,period)=>({schemaVersion:1,id,name:`Run ${id}`,savedAt:'2026-09-13T10:00:00Z',provenance:'recorded-at-submit',parameters:{strategy:{main:field(period),execution:field(3)},settings:field(100000)},quickStats:[{label:'Gross Total Returns( % )',value:ret+'%'},{label:'Max Drawdown(MDD)',value:mdd+'%'},{label:'Total no. of Trades',value:'1'}],statistics:[{title:'Backtest Details',rows:[['Group','Large Midcap 250'],['Start Date','1-Jan 26'],['End Date','13-Sep 26'],['Timeframe','Daily']]}],charts:[],trades:{headers:['Sr #','Symbol','Qty'],rows:[['1','TEST','0']]},warnings:[]});
const saved={'run:a':make('a',25.26,8.68,252),'run:b':make('b',28.50,12.10,120)};
w.chrome={storage:{local:{get:async()=>saved,set:async data=>Object.assign(saved,data)}}};
for(const file of ['core.js','storage.js','presentation.js','dashboard.js'])w.eval(fs.readFileSync(path.join(base,file),'utf8'));
const tick=()=>new Promise(r=>setTimeout(r,20));
(async()=>{await tick();assert.equal(d.querySelectorAll('.run').length,2);
  assert.equal(d.getElementById('demo-link').hidden,true,'The everyday header has no demo shortcut');assert.equal(d.querySelector('a[href="?demo=1"]'),null,'Empty-state onboarding does not direct users into fictional data');
  d.querySelectorAll('.run input').forEach(x=>{x.checked=true;x.dispatchEvent(new w.Event('change'));});d.getElementById('compare').click();assert.match(d.getElementById('detail').textContent,/Different settings/);assert.match(d.getElementById('detail').textContent,/252/);assert.match(d.getElementById('detail').textContent,/120/);
  d.getElementById('risk').value='10';d.getElementById('risk').dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('.run').length,1);
  d.querySelector('.open').click();[...d.querySelectorAll('.tabs button')].find(b=>b.textContent==='Trades').click();assert.match(d.getElementById('detail').textContent,/1 trades have quantity zero/);
  [...d.querySelectorAll('.tabs button')].find(b=>b.textContent==='Notes').click();d.querySelector('#detail input').value='Revised name';d.querySelector('textarea').value='Holdout period still required';[...d.querySelectorAll('#detail button')].find(b=>b.textContent==='Save name & notes').click();await tick();assert.equal(saved['run:a'].notes,'Holdout period still required');
  d.getElementById('summary').click();assert.equal(downloads.length,1);await d.getElementById('backup').onclick();assert.equal(downloads.length,2);
  dom.window.close();await testGrowthPreference();await testJourneyNavigation();console.log('PASS: dashboard persistence, comparisons, risk filters, zero quantities, notes, exports, and CAGR-first display/sort/CSV with labelled fallback.');
})().catch(e=>{dom.window.close();console.error(e);process.exitCode=1;});

async function testGrowthPreference(){
  const cases=[
    {id:'both',cagr:'8.00%',annualized:'99.00%',value:8,label:'CAGR'},
    {id:'cagr-only',cagr:'16.00%',value:16,label:'CAGR'},
    {id:'annualized-only',annualized:'12.00%',value:12,label:'Annualized return'},
    {id:'zero',cagr:'0.00%',annualized:'50.00%',value:0,label:'CAGR'},
    {id:'negative',cagr:'-6.25%',annualized:'75.00%',value:-6.25,label:'CAGR'},
    {id:'invalid-cagr',cagr:'N/A',annualized:'3.50%',value:3.5,label:'Annualized return'},
    {id:'missing',cagr:'-',annualized:'-',value:null,label:'CAGR / annualized return'}
  ];
  const stored=Object.fromEntries(cases.map(c=>{const run=make(c.id,20,8,252);for(const [label,value] of [['CAGR',c.cagr],['Annualized Returns',c.annualized]])if(value!==undefined)run.quickStats.push({label,value});return ['run:'+c.id,run];}));
  const before=JSON.stringify(stored),page=new JSDOM(fs.readFileSync(path.join(base,'index.html'),'utf8'),{runScripts:'outside-only',url:'http://localhost/?view=library'}),win=page.window,doc=win.document,blobs=[];
  win.chrome={storage:{local:{get:async()=>stored,set:async()=>{throw Error('Viewing metrics must not rewrite saved runs');}}}};
  win.Blob=Blob;win.URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:growth';};win.URL.revokeObjectURL=()=>{};win.HTMLAnchorElement.prototype.click=function(){};
  try{
    for(const file of ['core.js','storage.js','presentation.js','dashboard.js'])win.eval(fs.readFileSync(path.join(base,file),'utf8'));
    await tick();
    for(const c of cases){
      [...doc.querySelectorAll('.open')].find(b=>b.textContent==='Run '+c.id).click();
      const card=doc.querySelectorAll('.metrics .metric')[2],m=win.Vault.metrics(stored['run:'+c.id]);
      assert.equal(card.querySelector('span').textContent,c.label);assert.equal(m.growth,c.value);
      assert.equal(card.querySelector('strong').textContent,c.value===null?'—':(c.value>0?'+':'')+c.value.toFixed(2)+'%');
      assert.equal(Boolean(card.querySelector('small')),c.value===null);
      assert.equal(m.cagr,win.Vault.number(c.cagr));assert.equal(m.annualized,win.Vault.number(c.annualized));
    }
    doc.getElementById('sort').value='growth';doc.getElementById('sort').dispatchEvent(new win.Event('input'));
    assert.deepEqual([...doc.querySelectorAll('.open')].map(b=>b.textContent),['cagr-only','annualized-only','both','invalid-cagr','zero','negative','missing'].map(id=>'Run '+id));
    doc.querySelectorAll('.run input').forEach(c=>{c.checked=true;c.dispatchEvent(new win.Event('change'));});doc.getElementById('compare').click();
    const growthRow=[...doc.querySelectorAll('table[aria-label="Reported performance"] tbody tr')].find(row=>row.cells[0].textContent==='CAGR / annualized return (%)');
    cases.forEach((c,i)=>{const cell=growthRow.cells[i+1];assert.equal(cell.querySelector('.cell-detail').textContent,c.value===null?'Not provided by source':c.label);assert.equal(cell.classList.contains('numeric'),true);});
    doc.getElementById('summary').click();const csv=await blobs.at(-1).text(),rows=csv.replace(/^\uFEFF/,'').split('\r\n').map(line=>line.slice(1,-1).split('","').map(v=>v.replaceAll('""','"'))),headers=rows.shift();
    const column=name=>headers.indexOf(name);for(const name of ['CAGR / annualized return (%)','Return measure','CAGR (%)','Annualized return (%)'])assert.notEqual(column(name),-1);
    for(const c of cases){const row=rows.find(row=>row[0]===c.id),fixed=value=>value===null?'':value.toFixed(2);assert.equal(row[column('CAGR / annualized return (%)')],fixed(c.value));assert.equal(row[column('Return measure')],c.value===null?'':c.label);assert.equal(row[column('CAGR (%)')],fixed(win.Vault.number(c.cagr)));assert.equal(row[column('Annualized return (%)')],fixed(win.Vault.number(c.annualized)));}
    await doc.getElementById('backup').onclick();const backup=JSON.parse(await blobs.at(-1).text());assert.deepEqual(backup.runs.map(r=>r.quickStats),Object.values(stored).map(r=>r.quickStats));assert.equal(JSON.stringify(stored),before);
  }finally{win.close();}
}

async function testJourneyNavigation(){
  const page=new JSDOM(fs.readFileSync(path.join(base,'index.html'),'utf8'),{runScripts:'outside-only',url:'chrome-extension://test-extension/index.html'}),win=page.window,doc=win.document,routes=[],run=make('navigation',20,5,252),stored={'run:navigation':run};
  win.HTMLElement.prototype.scrollIntoView=function(){};
  win.chrome={storage:{local:{get:async()=>stored,set:async()=>{throw Error('Navigation must not modify saved research');}}}};
  win.URL.createObjectURL=()=>{throw Error('Navigation must not export anything');};win.URL.revokeObjectURL=()=>{};
  const paint=(kind,options)=>{routes.push({kind,options});const title=doc.createElement('h2');title.textContent=kind;options.target.replaceChildren(title);};
  win.VaultExperimentsUI={dispose:()=>{},render:async options=>paint('studies',options)};
  win.VaultIntelligenceUI={render:options=>paint('comparison',options)};
  try{
    for(const file of ['core.js','storage.js','presentation.js','dashboard.js'])win.eval(fs.readFileSync(path.join(base,file),'utf8'));
    await tick();assert.equal(routes.at(-1)?.kind,'studies','The installed workspace opens the study hub');assert.equal(routes.at(-1).options.startNew,false);
    assert.equal(doc.getElementById('experiments').textContent,'My studies');assert.equal(doc.getElementById('analyze').textContent,'Compare results');
    doc.getElementById('new-test').click();await tick();assert.equal(routes.at(-1).kind,'studies');assert.equal(routes.at(-1).options.startNew,true,'New test opens setup directly without creating another kind of object');assert.equal(routes.at(-1).options.baselineRun,null);
    doc.getElementById('experiments').click();await tick();assert.equal(routes.at(-1).kind,'studies');assert.equal(routes.at(-1).options.startNew,false,'My studies revisits saved work rather than beginning a test');
    doc.getElementById('analyze').click();await tick();assert.equal(routes.at(-1).kind,'comparison');assert.deepEqual([...routes.at(-1).options.runs],[run],'Cross-study comparison receives the saved result library');
    routes.at(-1).options.onOpen(run);const variation=[...doc.querySelectorAll('#detail button')].find(button=>button.textContent==='Test variations');assert.ok(variation,'A saved result has an understandable reuse action');variation.click();await tick();assert.equal(routes.at(-1).kind,'studies');assert.equal(routes.at(-1).options.baselineRun,run,'Reusing a result retains its exact baseline');assert.equal(routes.at(-1).options.startNew,false);
    routes.at(-1).options.onOpen(run,'navigation-study');const back=[...doc.querySelectorAll('#detail button')].find(button=>button.textContent==='Back to study');assert.ok(back,'Opening one report keeps a route back to its study');back.click();await tick();assert.equal(routes.at(-1).kind,'studies');assert.equal(routes.at(-1).options.studyId,'navigation-study','Back returns to the originating study rather than an unrelated list or setup');assert.equal(routes.at(-1).options.startNew,false);
    assert.deepEqual(stored,{'run:navigation':run},'The navigation flow is read-only until an explicit run action');
  }finally{win.close();}
}
