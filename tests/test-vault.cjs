const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const base = path.resolve(__dirname,'../dist');
const V = require(path.join(base,'core.js'));
const dom = new JSDOM('<!doctype html><body><h1>Momentum Trading BackTesting</h1><div class="account-right"><table><tr><td>Period :</td><td><input type="checkbox" checked><input value="252"></td><td>Retracement :</td><td><input value="20"></td></tr><tr><td>Weight :</td><td><input value="1"></td></tr></table><span id="completion"></span><button id="cancel" style="display:none">Cancel BackTest</button></div></body>',{runScripts:'outside-only',url:'https://zone.definedgesecurities.com/index.html#research'});
const w=dom.window, d=w.document;
global.DOMParser=w.DOMParser;global.XMLSerializer=w.XMLSerializer;
assert.equal(V.number('₹ 1,25,256.58'),125256.58);
assert.equal(V.number('36.44% ↑'),36.44);
assert.equal(V.number('-'),null);
assert.equal(V.number('not a number'),null);
assert.match(V.csv([['=HYPERLINK("x")','-10.5','a,b','line\nbreak']]),/"'=HYPERLINK/);
assert.match(V.csv([['-10.5']]),/"-10.5"/);
const svg=V.safeSvg('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" onload="alert(1)"><script>alert(1)</script><image href="https://bad.example/test"/><foreignObject><p>bad</p></foreignObject><path fill="url(https://bad.example/x)" d="M0 0 L10 10"/><text style="font-size:14px;fill:red">Return</text></svg>');
assert.doesNotMatch(svg,/script|onload|foreignObject|https:\/\/bad/);assert.match(svg,/font-size="14px"/);assert.match(svg,/M0 0 L10 10/);
const empty={schemaVersion:1,id:'a',quickStats:[],statistics:[],charts:[],trades:{headers:[],rows:[]}};
assert.equal(V.validate(empty),empty);
assert.throws(()=>V.validate({...empty,quickStats:[null]}),/malformed/);
assert.throws(()=>V.validate({...empty,monthly:'bad'}),/malformed/);
let vaultOpens=0;
const store={};w.chrome={storage:{local:{set:async data=>Object.assign(store,data)}},runtime:{sendMessage:async()=>{vaultOpens++;}}};
const downloads=[];w.Blob=Blob;w.URL.createObjectURL=blob=>{downloads.push(blob);return 'blob:recovery';};w.URL.revokeObjectURL=()=>{};
const downloadNames=[];w.HTMLAnchorElement.prototype.click=function(){downloadNames.push(this.download);};
w.structuredClone=structuredClone;
Object.defineProperty(w.HTMLElement.prototype,'innerText',{get(){return this.textContent;},configurable:true});
w.Element.prototype.getClientRects=function(){if(this.closest('[hidden]')||[this,...ancestors(this)].some(e=>e.style?.display==='none'))return [];return [{width:100,height:20}];};
function ancestors(e){const out=[];while(e=e.parentElement)out.push(e);return out;}
let shadow;
const attach=w.Element.prototype.attachShadow;
w.Element.prototype.attachShadow=function(args){const s=attach.call(this,args);if(this.id==='definedge-backtest-vault')shadow=s;return s;};
function popup(title,html){const e=d.createElement('div');e.className='popupContent';e.innerHTML=`<div class="caption">${title}</div>${html}`;d.body.append(e);return e;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
// Reproduce the live site's modal event gate, including retargeted shadow clicks.
d.addEventListener('click',event=>{
  const activePopup=[...d.querySelectorAll('.popupContent')].filter(e=>e.getClientRects().length).at(-1);
  if(activePopup&&!activePopup.contains(event.target)){event.preventDefault();event.stopImmediatePropagation();}
},true);
w.eval(fs.readFileSync(path.join(base,'core.js'),'utf8'));w.eval(fs.readFileSync(path.join(base,'capture.js'),'utf8'));
(async()=>{
  const execution=popup('Momentum Trading BackTest','<table><tr><td>From :</td><td><input type="date" value="2026-01-01"></td></tr><tr><td>Target:</td><td><input type="checkbox" checked><input value="3"></td></tr></table><button>BackTest</button>');
  execution.querySelector('button').click();
  const error=popup('Error','<p>Please select at least one of Stop-Loss, Target, or Exit Condition</p><button>Close</button>');
  await delay(800);
  assert.match(shadow.querySelector('#status').textContent,/Definedge rejected/);
  error.remove();await delay(800);
  shadow.querySelector('#open').click();
  assert.equal(vaultOpens,1,'Open vault must work inside the active strategy dialog after a nested error closes');
  execution.querySelector('button').click();execution.remove();d.querySelector('#cancel').style.display='';await delay(800);d.querySelector('#cancel').style.display='none';d.querySelector('#completion').textContent='BackTest Completed.';await delay(800);
  const portfolio=popup('Portfolio Backtesting','<table><tr><td>Total Initial Investment :</td><td><input value="100,000"></td></tr></table><button>Backtest</button>');portfolio.querySelector('button').click();portfolio.remove();
  // Change the live setup after submission: archive must retain submitted 252.
  d.querySelector('.account-right input[value="252"]').value='120';
  const report=popup('Portfolio Backtesting Report','<div role="tablist">'+['Quick Stats','Statistics','Charts','Trade Details'].map((x,i)=>`<div role="tab" class="gwt-TabBarItem ${i===0?'gwt-TabBarItem-selected':''}">${x}</div>`).join('')+'</div><div role="tabpanel"><div class="stats-card"><div class="amt">4</div><div class="status">Total no. of Trades</div></div><div class="stats-card"><div class="amt">25.26%</div><div class="status">Gross Total Returns( % )</div></div><table class="dropdown-table-body"><tr><td>Group</td><td>Large Midcap 250</td></tr></table>'+Array.from({length:6},(_,i)=>`<svg xmlns="http://www.w3.org/2000/svg" class="highcharts-root" width="200" height="100"><title>Chart ${i+1}</title><path d="M0 90 L200 10" stroke="green"/></svg>`).join('')+'<table class="rade-result-detail"></table><span id="curPageTextEle">1</span><span id="lastPageTextEle">2</span><img src="/images/firstPage.png"><img src="/images/next.png"></div>');
  report.querySelectorAll('[role="tab"]').forEach(t=>t.onclick=()=>{report.querySelectorAll('[role="tab"]').forEach(x=>x.classList.remove('gwt-TabBarItem-selected'));t.classList.add('gwt-TabBarItem-selected');});
  function page(n){report.querySelector('#curPageTextEle').textContent=n;report.querySelector('.rade-result-detail').innerHTML='<tr><th>Sr #</th><th>Symbol</th><th>Qty</th><th>P&L</th></tr>'+[n*2-1,n*2].map(i=>`<tr><td>${i}</td><td>STOCK${i}</td><td>${i===2?0:10}</td><td>100</td></tr>`).join('')+(n===2?'<tr><td></td><td> </td><td>&nbsp;</td><td></td></tr>'.repeat(3):'');}
  page(1);report.querySelector('img[src$="firstPage.png"]').onclick=()=>page(1);report.querySelector('img[src$="next.png"]').onclick=()=>page(2);
  await delay(800);shadow.querySelector('#save').click();
  for(let i=0;i<60&&!Object.keys(store).length;i++)await delay(100);
  assert.equal(Object.keys(store).length,1,shadow.querySelector('#status').textContent);
  const run=Object.values(store)[0];V.validate(run);
  assert.equal(run.provenance,'recorded-at-submit');assert.equal(run.trades.rows.length,4);assert.equal(run.charts.length,6);
  assert.equal(run.parameters.strategy.main.fields.find(f=>f.value==='252').value,'252');
  assert.equal(run.trades.rows[1][2],'0','Zero quantity trade must be preserved');
  assert.ok(run.trades.rows.every(row=>row.some(cell=>cell!=='')),'Final-page placeholders must not become trades');
  assert.equal(V.metrics(run).returns,25.26);
  await delay(700);assert.equal(report.querySelector('#curPageTextEle').textContent,'1');
  assert.match(report.querySelector('[role="tab"]').className,/selected/);
  assert.equal(V.assessment(run).length,0);
  // A broken next page must fail closed and never write a partial run.
  report.querySelector('img[src$="next.png"]').remove();shadow.querySelector('#save').click();await delay(3200);
  assert.equal(Object.keys(store).length,1);assert.match(shadow.querySelector('#status').textContent,/Save failed.*Next trade page/);
  assert.equal(shadow.querySelector('#recovery').hidden,true,'Incomplete trade captures must not become recovery backups');
  // Reproduce storage disappearing after an extension reload, without touching real browser storage.
  const next=d.createElement('img');next.src='/images/next.png';next.onclick=()=>page(2);report.querySelector('[role="tabpanel"]').append(next);
  const workingChrome=w.chrome;w.chrome={runtime:workingChrome.runtime};
  await shadow.querySelector('#save').onclick();
  assert.match(shadow.querySelector('#status').textContent,/Not saved to Vault.*disconnected.*Download recovery backup/);
  assert.doesNotMatch(shadow.querySelector('#status').textContent,/Cannot read properties/);assert.equal(Object.keys(store).length,1);
  assert.equal(shadow.querySelector('#recovery').hidden,false);assert.equal(shadow.querySelector('#save').textContent,'Retry captured run');
  shadow.querySelector('#recovery').click();const recovery=JSON.parse(await downloads.at(-1).text());
  assert.equal(recovery.format,'definedge-backtest-vault');assert.equal(recovery.runs.length,1);V.validate(recovery.runs[0]);
  assert.equal(recovery.runs[0].trades.rows.length,4);assert.equal(recovery.runs[0].charts.length,6);assert.equal(recovery.runs[0].parameters.strategy.main.fields.find(f=>f.value==='252').value,'252');
  assert.equal(downloadNames.at(-1),'backtest-vault-recovery-'+recovery.runs[0].id+'.json');
  // The actual dashboard import accepts this recovery envelope, and importing it twice keeps one run.
  const recoveredStore={},viewer=new JSDOM(fs.readFileSync(path.join(base,'index.html'),'utf8'),{runScripts:'outside-only',url:'http://localhost/'}),vw=viewer.window;
  try {
    vw.chrome={storage:{local:{get:async()=>recoveredStore,set:async data=>Object.assign(recoveredStore,data)}}};
    vw.URL.createObjectURL=()=> 'blob:chart';vw.URL.revokeObjectURL=()=>{};vw.HTMLElement.prototype.scrollIntoView=function(){};
    for(const file of ['core.js','storage.js','presentation.js','dashboard.js'])vw.eval(fs.readFileSync(path.join(base,file),'utf8'));
    await delay(30);
    const importRecovery=()=>vw.document.getElementById('import').onchange({target:{files:[{size:1,text:async()=>JSON.stringify(recovery)}],value:'recovery.json'}});
    await importRecovery();await importRecovery();
    assert.equal(Object.keys(recoveredStore).length,1);assert.deepEqual(JSON.parse(JSON.stringify(Object.values(recoveredStore)[0])),recovery.runs[0]);
  } finally {viewer.window.close();}
  // Missing chrome, invalidated contexts and rejected writes must retain the exact same pending record.
  w.chrome=undefined;await shadow.querySelector('#open').onclick();assert.match(shadow.querySelector('#status').textContent,/disconnected.*Download recovery/);await shadow.querySelector('#save').onclick();
  w.chrome={storage:{local:{set:async()=>{throw Error('Extension context invalidated.');}}}};await shadow.querySelector('#save').onclick();assert.match(shadow.querySelector('#status').textContent,/disconnected/);
  w.chrome={storage:{local:{set:async()=>{throw Error('QUOTA_BYTES quota exceeded');}}}};await shadow.querySelector('#save').onclick();assert.match(shadow.querySelector('#status').textContent,/Not saved.*QUOTA_BYTES/);
  shadow.querySelector('#recovery').click();assert.deepEqual(JSON.parse(await downloads.at(-1).text()).runs,recovery.runs);
  // After the source report closes, retry must persist the original ID/data instead of recapturing.
  report.remove();await delay(800);w.chrome=workingChrome;await shadow.querySelector('#save').onclick();
  assert.equal(Object.keys(store).length,2);assert.deepEqual(JSON.parse(JSON.stringify(store['run:'+recovery.runs[0].id])),recovery.runs[0]);assert.equal(shadow.querySelector('#recovery').hidden,true);assert.equal(shadow.querySelector('#save').textContent,'Save backtest');
  report.remove();await delay(800);shadow.querySelector('#save').click();
  assert.match(shadow.querySelector('#status').textContent,/Open a completed Portfolio/,'Vault must remain usable after its report is removed');
  dom.window.close();
  console.log('PASS: modal-safe vault controls, rejected submission recovery, numeric and CSV handling, SVG sanitation, malformed import rejection, frozen submitted parameters, completion linkage, all trade pages, six charts, zero quantity preservation, restoration, and fail-closed pagination.');
})().catch(e=>{dom.window.close();console.error(e);process.exitCode=1;});
