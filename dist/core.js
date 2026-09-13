(function (root) {
  'use strict';
  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  function number(value) {
    const s = clean(value).replace(/[,₹%↑↓]/g, '').trim();
    if (!/^[-+]?\d+(?:\.\d+)?$/.test(s)) return null;
    const n = Number(s); return Number.isFinite(n) ? n : null;
  }
  function csv(rows) {
    return '\uFEFF' + rows.map(row => row.map(value => {
      let s = String(value ?? '');
      // Prevent spreadsheet formula execution for imported names and notes.
      if (/^[\s]*[=+@\-]/.test(s) && number(s) === null) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    }).join(',')).join('\r\n');
  }
  function metrics(run) {
    const values = new Map((run.quickStats || []).map(x => [clean(x.label).toLowerCase(), x.value]));
    const get = label => number(values.get(label.toLowerCase()));
    const cagr=get('CAGR'), annualized=get('Annualized Returns');
    // Choose the overview measure without replacing either source metric.
    const growth=cagr??annualized, growthLabel=cagr!==null?'CAGR':annualized!==null?'Annualized return':'CAGR / annualized return';
    return {returns:get('Gross Total Returns( % )'), drawdown:get('Max Drawdown(MDD)'), cagr, annualized, growth, growthLabel, trades:get('Total no. of Trades'), win:get('Win Ratio'), capital:get('Initial Capital'), final:get('Final Capital')};
  }
  function details(run) {
    const pairs = (run.statistics || []).flatMap(x => x.rows || []);
    const get = key => pairs.find(r => clean(r[0]).toLowerCase() === key.toLowerCase())?.[1] || '';
    return {group:get('Group'), from:get('Start Date'), to:get('End Date'), timeframe:get('Timeframe'), segment:get('Segment')};
  }
  function validate(run) {
    if (!run || run.schemaVersion !== 1 || typeof run.id !== 'string' || !Array.isArray(run.quickStats) || !Array.isArray(run.statistics) || !Array.isArray(run.charts) || !Array.isArray(run.trades?.rows) || !Array.isArray(run.trades?.headers)) throw new Error('This file is not a Backtest Vault run.');
    if (run.charts.length > 100 || run.trades.rows.length > 1000000) throw new Error('Archive exceeds supported limits.');
    const scalar = x => x === null || ['string','number','boolean'].includes(typeof x);
    const row = r => Array.isArray(r) && r.every(scalar);
    const snapshot = s => !s || (typeof s === 'object' && Array.isArray(s.fields) && s.fields.every(f=>f && typeof f.label === 'string' && scalar(f.value) && typeof f.index === 'number'));
    if (!run.quickStats.every(x=>x && typeof x.label==='string' && scalar(x.value)) || !run.statistics.every(x=>x && typeof x.title==='string' && Array.isArray(x.rows) && x.rows.every(row)) || !run.charts.every(x=>x && typeof x.svg==='string' && (!x.title || typeof x.title==='string')) || !row(run.trades.headers) || !run.trades.rows.every(row) || (run.monthly && (!Array.isArray(run.monthly) || !run.monthly.every(x=>Array.isArray(x)&&x.every(row)))) || (run.warnings && (!Array.isArray(run.warnings) || !run.warnings.every(x=>typeof x==='string'))) || !snapshot(run.observedMain) || !snapshot(run.parameters?.settings) || !snapshot(run.parameters?.strategy?.main) || !snapshot(run.parameters?.strategy?.execution)) throw new Error('Archive contains malformed report data.');
    for (const key of ['name','savedAt','provenance','notes']) if (run[key] !== undefined && typeof run[key] !== 'string') throw new Error(`Invalid ${key} in archive.`);
    if (run.demo !== undefined && typeof run.demo !== 'boolean') throw new Error('Invalid demo marker in archive.');
    return run;
  }
  function safeSvg(source) {
    const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
    if (parsed.querySelector('parsererror') || parsed.documentElement.localName !== 'svg') throw new Error('Invalid chart SVG');
    const tags = new Set('svg g path rect circle ellipse line polyline polygon text tspan title desc defs clipPath linearGradient radialGradient stop'.toLowerCase().split(' '));
    const attrs = new Set('xmlns version width height viewBox x y x1 y1 x2 y2 cx cy r rx ry d points transform fill stroke stroke-width stroke-linecap stroke-linejoin stroke-dasharray stroke-opacity fill-opacity opacity font-family font-size font-weight font-style text-anchor dominant-baseline alignment-baseline dx dy id clip-path offset stop-color stop-opacity gradientUnits gradientTransform'.toLowerCase().split(' '));
    const svg = parsed.documentElement;
    for (const el of [svg, ...svg.querySelectorAll('*')]) {
      if (!tags.has(el.localName.toLowerCase())) {el.remove(); continue;}
      // Highcharts uses inline text styles: copy only non-URL presentation values.
      for (const property of ['fill','stroke','font-family','font-size','font-weight','font-style','opacity']) {
        const value = el.style?.getPropertyValue(property);
        if (value && !/url|[<>]/i.test(value)) el.setAttribute(property, value);
      }
      for (const attr of [...el.attributes]) {
        const localReference = /^url\(#[\w-]+\)$/.test(attr.value);
        if (!attrs.has(attr.name.toLowerCase()) || (/url\(|javascript:|https?:|data:/i.test(attr.value) && attr.name !== 'xmlns' && !localReference)) el.removeAttribute(attr.name);
      }
    }
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    return new XMLSerializer().serializeToString(svg);
  }
  function assessment(run) {
    const issues = [...(run.warnings || [])];
    const expected = metrics(run).trades;
    if (expected !== null && expected !== run.trades.rows.length) issues.push(`Report has ${expected} trades; archive has ${run.trades.rows.length}.`);
    if (run.provenance !== 'recorded-at-submit') issues.push('Settings were not linked to both backtest submissions.');
    // Definedge's Renko exit form can check both price-mode radios because
    // their HTML group names differ. Preserve that source state and flag it.
    for(const [stage,snapshot] of [['Momentum',run.parameters?.strategy?.main],['Execution',run.parameters?.strategy?.execution],['Current inputs',run.observedMain]]) {
      const fields=snapshot?.fields || [];
      for(let i=1;i<fields.length;i++) {
        const pair=[fields[i-1],fields[i]];
        if(pair[0].index+1===pair[1].index && pair.every(f=>f.type==='radio' && f.checked===true && /Close Only.*High & Low/i.test(f.label))) {
          issues.push(`${stage}: Close Only and High & Low were both selected in Definedge. The saved price mode is ambiguous; review this run.`);
        }
      }
    }
    return [...new Set(issues)];
  }
  const api = {clean, number, csv, metrics, details, validate, safeSvg, assessment};
  if (typeof module !== 'undefined') module.exports = api;
  root.Vault = api;
})(typeof window !== 'undefined' ? window : globalThis);
