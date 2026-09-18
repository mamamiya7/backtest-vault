(() => {
  'use strict';
  const V = window.Vault;
  const visible = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const text = e => V.clean(e?.textContent);
  const caption = p => text(p?.querySelector('.caption'));
  const popup = title => [...document.querySelectorAll('.popupContent')].find(p => visible(p) && caption(p) === title);
  const main = () => [...document.querySelectorAll('.account-right')].find(p => visible(p) && p.textContent.includes('Retracement') && p.textContent.includes('Period'));
  const onMomentum = () => !!main() && document.body.innerText.includes('Momentum Trading BackTesting');
  let strategy = null, portfolio = null, busy = false, sawRunning = false, sawCleared = false, lastReport = null, pendingRun = null;
  let reportsAtSubmit = new Set(), portfolioLinked = false, marketTrendReceipt = null;
  const reportLinks = new WeakMap();
  const reports = () => [...document.querySelectorAll('.popupContent')].filter(p=>caption(p)==='Portfolio Backtesting Report');
  const running = () => [...(main()?.querySelectorAll('button') || [])].some(b=>visible(b)&&/Cancel BackTest/i.test(text(b)));
  const completed = () => !!main()?.innerText.includes('BackTest Completed.');
  const now = () => new Date().toISOString();
  function fields(container) {
    if (!container) return [];
    return [...container.querySelectorAll('input,select,textarea')].filter(e => visible(e) && !['password','hidden','submit','button'].includes(e.type) && !e.closest('[role="tab"]')).map((e, i) => {
      const contexts = [];
      for (let p = e.parentElement; p && p !== container.parentElement; p = p.parentElement) {
        if (p.tagName !== 'TR') continue;
        const labels = [...p.children].map(cell => {
          const copy = cell.cloneNode(true);
          copy.querySelectorAll('table,input,select,textarea,button,svg').forEach(x => x.remove());
          return text(copy);
        }).filter(Boolean).join(' / ');
        if (labels) contexts.push(labels);
        if (contexts.length >= 2) break;
      }
      return {index:i, label:contexts.reverse().join(' → ') || e.getAttribute('aria-label') || e.placeholder || `Field ${i + 1}`, type:e.type || e.tagName.toLowerCase(), value:e.tagName === 'SELECT' ? [...e.selectedOptions].map(o=>text(o)).join('; ') : e.value, checked:['checkbox','radio'].includes(e.type) ? e.checked : null, disabled:e.disabled};
    });
  }
  function snapshot(container) {return {at:now(), fields:fields(container)};}
  function recordMarketTrend(container) {
    const observed=fields(container);
    if(!window.VaultSourceLayouts)throw Error('Source layouts are unavailable.');
    window.VaultSourceLayouts.stage('marketFilter',observed);
    marketTrendReceipt={at:now(),fields:observed,mainFields:fields(main())};
  }
  function currentMarketTrend() {
    if(!marketTrendReceipt||popup('Error')||popup('Market Trend Filter')||JSON.stringify(marketTrendReceipt.mainFields)!==JSON.stringify(fields(main())))return null;
    return {at:marketTrendReceipt.at,fields:structuredClone(marketTrendReceipt.fields)};
  }
  function status(message) {statusEl.textContent = message;}
  const host = document.createElement('div'); host.id = 'definedge-backtest-vault';
  host.dataset.version = '0.17.5';
  host.style.cssText = 'position:fixed;right:16px;bottom:14px;z-index:2147483646;';
  const shadow = host.attachShadow({mode:'closed'});
  shadow.innerHTML = `<style>:host{font:14px system-ui;color:#f3f8fc}.bar{background:#112639;border:1px solid #34536e;border-radius:12px;padding:10px;box-shadow:0 6px 26px #0007;max-width:390px}button{font:600 14px system-ui;border:0;border-radius:7px;padding:9px 12px;cursor:pointer;background:#52d8ca;color:#072923;margin-right:6px}button.secondary{background:#2b455b;color:white}button:disabled{opacity:.5;cursor:wait}p{margin:8px 2px 0;line-height:1.35;font-size:13px}</style><div class="bar"><button id="save">Save backtest</button><button class="secondary" id="open">Open vault</button><p id="status" role="status">Recording settings when you run a backtest.</p></div>`;
  const statusEl = shadow.querySelector('#status');
  const saveButton = shadow.querySelector('#save');
  const recoveryButton = document.createElement('button');
  recoveryButton.id='recovery'; recoveryButton.className='secondary'; recoveryButton.textContent='Download recovery backup'; recoveryButton.hidden=true;
  statusEl.before(recoveryButton);
  const disconnected = 'Vault is disconnected from this tab. Reload the extension, then refresh Definedge.';
  const recoveryAdvice = () => pendingRun ? ' The captured run is held in this tab. Download recovery backup before refreshing, then use Import runs in Vault.' : '';
  function storageFailure(error) {
    const message=String(error?.message || error);
    return error?.code==='VAULT_DISCONNECTED' || /extension context invalidated/i.test(message) ? disconnected : 'Vault storage could not save this run: '+message;
  }
  async function persistPending(strict=false) {
    const run=pendingRun;
    try {
      const local=typeof chrome==='undefined'?null:chrome.storage?.local;
      if(typeof local?.set!=='function') {const error=new Error(disconnected);error.code='VAULT_DISCONNECTED';throw error;}
      await local.set({['run:'+run.id]:run});
      pendingRun=null; recoveryButton.hidden=true; saveButton.textContent='Save backtest';
      status(`Saved ${run.trades.rows.length} trades and ${run.charts.length} charts${run.provenance==='unverified'?' · settings unverified':''}. Open vault to review and back up.`);
      return run;
    } catch(error) {
      recoveryButton.hidden=false; saveButton.textContent='Retry captured run';
      status('Not saved to Vault. '+storageFailure(error)+recoveryAdvice());
      if(strict)throw error;
    }
  }
  recoveryButton.onclick = () => {
    if(!pendingRun) return;
    try {
      const data={format:'definedge-backtest-vault',version:1,exportedAt:now(),runs:[pendingRun]};
      const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
      const anchor=document.createElement('a');anchor.href=url;anchor.download='backtest-vault-recovery-'+pendingRun.id+'.json';
      shadow.append(anchor);
      try {anchor.click();} finally {anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
      status('Recovery download requested. Check that the JSON file finished downloading before refreshing. Import it into Vault to finish saving. This capture remains in the tab until you leave or retry successfully.');
    } catch(error) {status('Recovery download could not start: '+error.message+'. Keep this tab open and retry.');}
  };
  shadow.querySelector('#open').onclick = async () => {
    try {
      if(typeof chrome==='undefined'||typeof chrome.runtime?.sendMessage!=='function')throw new Error(disconnected);
      await chrome.runtime.sendMessage({type:'open-vault'});
    } catch {status(disconnected+recoveryAdvice());}
  };
  document.documentElement.append(host);
  document.addEventListener('click', event => {
    if (!onMomentum() || busy) return;
    const touchedPopup=event.target.closest?.('.popupContent');
    if(['Market Trend Filter','Error'].includes(caption(touchedPopup)))marketTrendReceipt=null;
    const button = event.target.closest?.('button');
    if (!button) return;
    if(/^Market Trend Filter$/i.test(text(button)))marketTrendReceipt=null;
    const p = button.closest('.popupContent');
    if(caption(p)==='Market Trend Filter'&&/^save$/i.test(text(button))){
      try{recordMarketTrend(p);}catch{marketTrendReceipt=null;}
      return;
    }
    if(!/^backtest$/i.test(text(button)))return;
    if (caption(p) === 'Momentum Trading BackTest') {
      const extraSettings = [...main().querySelectorAll('button')].some(b=>/Market Trend Filter/i.test(text(b)) && !b.disabled);
      const marketTrend=extraSettings?currentMarketTrend():null;
      strategy = {id:crypto.randomUUID(), at:now(), main:snapshot(main()), execution:snapshot(p), completed:false, auxiliarySettingsUncaptured:extraSettings&&!marketTrend,...(marketTrend?{marketTrend}:{})};
      // An already-running source cannot establish a new submission lifecycle.
      if(running()) strategy = null;
      portfolio = null; sawRunning = false; sawCleared = !completed();
      reportsAtSubmit = new Set(); portfolioLinked = false;
      status('Strategy settings recorded. Waiting for Definedge to start.');
    } else if (caption(p) === 'Portfolio Backtesting') {
      reportsAtSubmit = new Set(reports()); portfolioLinked = false;
      portfolio = {id:crypto.randomUUID(), at:now(), settings:snapshot(p), strategy:strategy?.completed && !running() ? structuredClone(strategy) : null};
      status('Portfolio settings recorded. Save when the report opens.');
    }
  }, true);
  for(const eventName of ['input','change'])document.addEventListener(eventName,event=>{if(caption(event.target.closest?.('.popupContent'))==='Market Trend Filter')marketTrendReceipt=null;},true);
  function monitor() {
    const active = onMomentum(); host.hidden = !active;
    if(popup('Error'))marketTrendReceipt=null;
    // GWT modal previews reject events whose target is outside the active popup.
    // Keep the host inside it so shadow-button clicks belong to that popup too.
    const activePopup = [...document.querySelectorAll('.popupContent')].filter(visible).at(-1);
    const parent = activePopup || document.body;
    if (host.parentElement !== parent) parent.append(host);
    if (!active) {strategy = null; marketTrendReceipt=null; portfolio = null; lastReport = null; reportsAtSubmit.clear(); return;}
    if (popup('Error') && (portfolio || strategy && !strategy.completed)) {
      const which=portfolio?'portfolio':'strategy';
      strategy = null; portfolio = null; sawRunning = false; sawCleared = false;
      status('Definedge rejected the '+which+' submission. Correct the error shown and submit BackTest again.');
    }
    if (strategy && !strategy.completed) {
      const isRunning=running(), isComplete=completed();
      if (!isComplete) sawCleared = true;
      if (!sawRunning && isRunning) {
        sawRunning = true; strategy.started=true; strategy.startedAt=now(); status('Strategy running. Waiting for completion.');
      }
      if (sawRunning && sawCleared && !isRunning && isComplete) {
        strategy.completed = true; strategy.completedAt=now(); status('Strategy completed. Portfolio settings will be recorded on submission.');
      }
    }
    const report = popup('Portfolio Backtesting Report');
    if (report && report !== lastReport) {
      // Never relabel a stale/reopened report with a later portfolio submission.
      if(!reportLinks.has(report)) {
        const fresh=portfolio && !portfolioLinked && !reportsAtSubmit.has(report);
        reportLinks.set(report, fresh ? {...structuredClone(portfolio),reportOpenedAt:now()} : null);
        if(fresh)portfolioLinked=true;
      }
      lastReport = report;
    }
    if (!report) lastReport = null;
  }
  const timer = setInterval(monitor, 700); monitor();
  // Observe real DOM state changes as well as polling; a short source run must
  // not be "proved" by a fixed delay or by the preceding Completed label.
  const observer=new MutationObserver(changes=>{
    if(typeof document!=='undefined'&&document?.body&&changes.some(change=>change.target!==host&&!host.contains(change.target)))monitor();
  });
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['style','class','hidden']});
  window.addEventListener('pagehide',()=>{clearInterval(timer);observer.disconnect();},{once:true});
  const delay = ms => new Promise(resolve => setTimeout(resolve,ms));
  async function waitFor(check, error, timeout=12000) {
    const start = Date.now();
    while (Date.now()-start < timeout) {if(check()) return; await delay(150);}
    throw new Error(error);
  }
  async function chooseTab(report, name) {
    const el = [...report.querySelectorAll('[role="tab"]')].find(e=>text(e) === name);
    if (!el) throw new Error(`${name} tab not found. The site layout may have changed.`);
    el.click();
    await waitFor(()=>el.className.includes('selected') || el.getAttribute('aria-selected') === 'true', `${name} did not open.`);
    await delay(500);
    if (!report.isConnected) throw new Error('The report was closed during capture.');
  }
  function rows(table) {return table ? [...table.rows].map(r => [...r.cells].map(c=>text(c))) : [];}
  function readReport(report) {
    const panel = report.querySelector('[role="tabpanel"]');
    if (!panel) throw new Error('Report content not found.');
    const quickStats = [...panel.querySelectorAll('.stats-card')].map(e=>({label:text(e.querySelector('.status')),value:text(e.querySelector('.amt'))})).filter(x=>x.label);
    const statistics = [...panel.querySelectorAll('.dropdown-table-body')].map(e=>({title:text(e.parentElement?.querySelector('.dropdown-head')) || 'Statistics',rows:rows(e)}));
    const monthly = [...panel.querySelectorAll('table')].filter(t=>!t.querySelector('table') && !t.matches('.dropdown-table-body,.rade-result-detail')).map(rows).filter(r=>r[0]?.length === 14);
    const charts = [...panel.querySelectorAll('svg.highcharts-root')].map((e,i)=>{
      const box=e.closest('.equity-chart,.draw-down-chart,.charts-align');
      const heading=box ? [...box.children].find(x=>!x.querySelector('svg.highcharts-root')) : null;
      return {title:text(heading) || text(e.querySelector('title')) || `Chart ${i+1}`,svg:V.safeSvg(e.outerHTML)};
    });
    return {quickStats, statistics, monthly, charts};
  }
  async function allTrades(report) {
    const table = () => report.querySelector('table.rade-result-detail');
    const page = () => Number(report.querySelector('#curPageTextEle')?.textContent || 1);
    const total = () => Number(report.querySelector('#lastPageTextEle')?.textContent || 1);
    const originalPage = page();
    if (!table()) throw new Error('Trade table not found.');
    if (page() !== 1) {
      const first = report.querySelector('img[src$="/firstPage.png"]');
      if (!first) throw new Error('Cannot navigate to first trade page.');
      first.click(); await waitFor(()=>page()===1, 'First trade page did not load.');
    }
    const count = total();
    if (!Number.isInteger(count) || count<1 || count>2000) throw new Error('Unexpected trade page count.');
    const result = {headers:rows(table())[0] || [], rows:[], pages:count};
    try {
      for (let index=1; index<=count; index++) {
        if (!report.isConnected) throw new Error('Report closed during trade capture.');
        if (page() !== index) throw new Error('Trade pages changed during capture.');
        const r = rows(table());
        // Definedge pads the final page to 50 rows with empty cells.
        // Only omit entirely blank placeholders; keep real zero-quantity trades.
        result.rows.push(...r.slice(1).filter(row=>row.some(cell=>cell!=='')));
        status(`Saving trades: page ${index} of ${count}…`);
        if(index<count) {
          const next = report.querySelector('img[src$="/next.png"]');
          if (!next) throw new Error('Next trade page control not found.');
          const previousFirst = r[1]?.join('|');
          next.click();
          await waitFor(()=>page()===index+1 && rows(table())[1]?.join('|')!==previousFirst,'Next trade page did not load.');
        }
      }
    } finally {
      if (report.isConnected && page() !== originalPage) {
        report.querySelector('img[src$="/firstPage.png"]')?.click();
        await waitFor(()=>page()===1,'Could not restore trade page.');
        for(let i=1;i<originalPage;i++) {report.querySelector('img[src$="/next.png"]')?.click(); await waitFor(()=>page()===i+1,'Could not restore trade page.');}
      }
    }
    return result;
  }
  async function capture(options={}) {
    if(busy) {if(options.strict)throw Error('A capture is already in progress.');return;}
    // A retry writes the same frozen capture and ID, even if the report has changed or closed.
    if(pendingRun) {
      busy=true;saveButton.disabled=true;
      try {if(options.runId&&pendingRun.id!==options.runId)throw Error('Recover the earlier manual capture first.');return await persistPending(options.strict);} finally {busy=false;saveButton.disabled=false;}
    }
    const report = popup('Portfolio Backtesting Report');
    if(!report) {if(options.strict)throw Error('Completed portfolio report is missing.');status('Open a completed Portfolio Backtesting Report, then Save backtest.');return;}
    monitor();
    const linked = reportLinks.get(report);
    const selected = [...report.querySelectorAll('[role="tab"]')].find(e=>e.className.includes('selected') || e.getAttribute('aria-selected')==='true');
    const previousTab = text(selected) || 'Quick Stats';
    busy=true; saveButton.disabled=true;
    try {
      status('Collecting statistics and charts…');
      await chooseTab(report,'Quick Stats');
      await chooseTab(report,'Statistics');
      // All statistics tables are already in the report DOM, including collapsed sections.
      await chooseTab(report,'Charts');
      await chooseTab(report,'Trade Details');
      const extracted = readReport(report);
      if(!extracted.quickStats.length || !extracted.statistics.length) throw new Error('Report statistics are missing. Nothing was saved.');
      const trades = await allTrades(report);
      const run = {schemaVersion:1,id:crypto.randomUUID(),name:`Momentum · ${now().slice(0,16).replace('T',' ')}`,savedAt:now(),source:'https://zone.definedgesecurities.com/index.html#research',provenance:linked?.strategy ? 'recorded-at-submit':'unverified',parameters:linked || null,observedMain:linked?.strategy ? null : snapshot(main()),...extracted,trades,warnings:[]};
      if(!linked?.strategy) run.warnings.push('This report predates a confirmed strategy submission in this tab. Current visible inputs are reference only; do not treat them as the settings used. Run both backtests with the extension active for linked settings.');
      if(extracted.charts.length<6) run.warnings.push(`Captured ${extracted.charts.length} chart graphics; the inspected portfolio layout contains six. Review chart completeness.`);
      if(linked?.strategy?.auxiliarySettingsUncaptured) run.warnings.push('Market Trend Filter was enabled without a confirmed settings save. Open its settings, save them, then run the backtest again to capture the complete filter.');
      const expected=V.metrics(run).trades;
      if(expected!==null && trades.rows.length!==expected) throw new Error(`Trade capture incomplete: ${trades.rows.length} of ${expected}. Nothing was saved.`);
      if(options.strict){
        if(!linked?.strategy||extracted.charts.length!==6)throw Error('Experiments require linked submissions and all six charts.');
        if(!options.submission||linked.id!==options.submission.portfolioId||linked.strategy.id!==options.submission.strategyId||!linked.strategy.startedAt||!linked.strategy.completedAt||!linked.reportOpenedAt)throw Error('The report does not belong to this trial\'s confirmed submissions.');
        options.verify?.(run);
      }
      if(options.runId){run.id=options.runId;run.name=options.name;run.experiment=options.experiment;}
      pendingRun=run;
      return await persistPending(options.strict);
    } catch(error) {status(`Save failed: ${error.message}`);if(options.strict)throw error;}
    finally {
      if(report.isConnected) {try {await chooseTab(report,previousTab);} catch { /* Archive remains valid if tab restoration fails. */ }}
      busy=false; saveButton.disabled=false;
    }
  }
  saveButton.onclick=()=>{if(window.VaultRunner?.active){status('An experiment is using this tab. Stop after current in Vault before saving manually.');return;}return capture();};
  // This facade exists in the extension's isolated world, not the site's page world.
  window.VaultCapture={capture,fields,snapshot,main,popup,visible,monitor,status,host,recordMarketTrend,getMarketTrend:currentMarketTrend,
    getStrategy:()=>strategy?structuredClone(strategy):null,
    getPortfolio:()=>portfolio?structuredClone(portfolio):null,
    running,
    awaitingResult:()=>!!(strategy&&!strategy.completed||portfolio&&!portfolioLinked),
    pending:()=>!!pendingRun,
    addControl:button=>statusEl.before(button)};
})();
