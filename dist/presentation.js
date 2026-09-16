(function (root) {
  'use strict';
  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const decimal = new Intl.NumberFormat('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2});
  const integer = new Intl.NumberFormat('en-IN', {maximumFractionDigits:0});

  // Display only. An arrow is a site annotation, never a numeric sign.
  function cell(value, {kind='number', signed=false}={}) {
    const original=clean(value);
    if (kind==='text') return {text:original || '—', numeric:false};
    if (value===null || value===undefined || original==='' || /^[-—–]$/.test(original)) return {text:'—', numeric:true};
    const candidate=original.replace(/[↑↓₹%,]/g,'').replace(/\u2212/g,'-').replace(/\s*days?$/i,'').trim();
    if (!/^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(candidate)) return {text:original,numeric:false};
    let n=Number(candidate);
    if (!Number.isFinite(n)) return {text:original,numeric:false};
    if (Object.is(n,-0)) n=0;
    // Never round a fractional quantity/period to a whole number.
    const precision=Math.min(20,Math.max(2,(candidate.split('.')[1]||'').length));
    const digits=kind==='count' && Number.isInteger(n) ? integer : precision===2?decimal:new Intl.NumberFormat('en-IN',{minimumFractionDigits:2,maximumFractionDigits:precision});
    const sign=n<0?'-':signed&&n>0?'+':'';
    const unit=kind==='percent'||original.includes('%')?'%':/days?$/i.test(original)?` ${Math.abs(n)===1?'day':'days'}`:'';
    return {text:sign+(original.includes('₹')?'₹':'')+digits.format(Math.abs(n))+unit,numeric:true,sortValue:n,tone:signed&&n!==0?(n<0?'negative':'positive'):'',title:`Original: ${original}`};
  }

  function metric(label,value) {
    const count=/^(total (?:no\.?|number)|total no\. of (?:profit|loss)|winning streak|lossing streak|losing streak|reported trades|captured trades|trades$|sr #$|qty$)/i.test(clean(label));
    const days=/^(max|min) holding period$/i.test(clean(label));
    const signed=!count && /return|cagr|total pl|p&l|g\/l|^max (profit|loss)$|expectancy|calm[ae]r|sharpe/i.test(label);
    return cell(value,{kind:count||days?'count':/%/.test(label)?'percent':'number',signed});
  }

  function tradeCell(header,value) {
    if (/Date$/i.test(header)) {
      const text=clean(value),match=text.match(/^(\d{1,2})-([A-Za-z]{3})[ -](\d{2}|\d{4})$/),months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
      const iso=match&&months.includes(match[2].toLowerCase())?(match[3].length===2?'20':'')+match[3]+'-'+String(months.indexOf(match[2].toLowerCase())+1).padStart(2,'0')+'-'+match[1].padStart(2,'0'):text;
      return {...cell(value,{kind:'text'}),sortValue:/^\d{4}-\d{2}-\d{2}$/.test(iso)?iso:text||null};
    }
    if (/^(Symbol|Exit Reason)$/i.test(header)) return cell(value,{kind:'text'});
    if (/^(Sr #|Qty)$/i.test(header)) return cell(value,{kind:'count'});
    return cell(value,{kind:header.includes('%')?'percent':'number',signed:/^(G\/L|P[&/]L)/i.test(header)});
  }

  const sourceName=value=>({Pre:'Predefined',My:'My systems',Public:'Public',Popular:'Popular'}[value]||value);
  const ruleName=value=>/^-- Select .*System --$/i.test(value)?'Not selected':value;
  function state(row) {
    if (row.checked===true) return 'On';
    if (row.checked===false) return 'Off';
    return row.disabled?'Disabled':'—';
  }
  function settingValue(row) {
    return cell(row.value,{kind:row.kind || 'text'});
  }
  function settingText(row) {
    const bits=row.value==='—' && typeof row.checked==='boolean'?[]:[settingValue(row).text];
    if (row.weight!==undefined) bits.push(`weight ${cell(row.weight).text}`);
    if (row.detail) bits.push(row.detail);
    if (state(row)!=='—') bits.push(state(row));
    return bits.join(' · ');
  }
  const types={s:'select-one',t:'text',c:'checkbox',r:'radio',d:'date'};
  function matches(fields,signature,anchors) {
    return fields.length===signature.length && fields.every((f,i)=>f.index===i && f.type===types[signature[i]]) && anchors.every(([i,re])=>re.test(fields[i].label));
  }
  function choice(fields,key,label,indices,names) {
    const selected=indices.filter(i=>fields[i].checked);
    return {key,label,value:selected.length?selected.map(i=>names[indices.indexOf(i)]).join('; '):'Not selected',kind:'text',detail:selected.length>1?'Conflicting selections':undefined,sourceIndices:indices};
  }
  function chartRows(fields,start,chart) {
    const renko=chart==='Renko';
    return [
      {key:renko?'brick.size':'box.size',label:renko?'Brick size input':'Box size',value:fields[start].value,kind:renko&&fields[start+1].value==='Percent'?'percent':'number',sourceIndices:[start]},
      {key:renko?'brick.mode':'box.reversal',label:renko?'Brick size mode':'Reversal size',value:fields[start+1].value,kind:renko?'text':'count',sourceIndices:[start+1]},
      choice(fields,'price-mode','Price mode',[start+2,start+3],['Close Only','High & Low'])
    ];
  }

  function mainGroups(fields) {
    // Only name positions for complete layouts observed during live tests.
    // Unknown/dynamic layouts retain their individual source fields.
    const chart=fields[0]?.value,variant=['P&F','Renko'].includes(chart),shift=variant?2:0;
    const extended=fields.length===(variant?62:56),rs=51+shift,chartStart=rs+1+(extended?2:0);
    const common='stcsc tsrrrr ctctctct trr tttt ctctctc s';
    let signature=(common+(variant?' rr c ss ct sstc sstc sstc c':' c ss ct sssc sssc sssc c')+(extended?'st':'')+(variant?'tsrr':'')+(extended?'ss':'')).replace(/ /g,'');
    // My/Public strategy rules use a search input in the observed
    // source layout. Other control positions retain the exact type signature.
    if(['Candle','P&F','Renko'].includes(chart))for(const parent of [39+shift,43+shift,47+shift])if(['My','Public'].includes(fields[parent]?.value)&&fields[parent+1]?.type==='text')signature=signature.slice(0,parent+1)+'t'+signature.slice(parent+2);
    const anchors=[[0,/Chart Type/i],[1,/Group/i],[4,/Retracement/i],[11,/^Period/i],[22,/Weight/i],[26,/EMA/i],[33,/Timeframe/i],[34+shift,/Radar/i],[39+shift,/Str 1/i],[43+shift,/Str 2/i],[47+shift,/Str 3/i],[rs,/Relative Strength/i]];
    if(variant)anchors.push([34,/Running.*Fresh/i],[chartStart,chart==='Renko'?/Brick Size/i:/Box Size/i]);
    if (!['Candle','P&F','Renko'].includes(chart) || !matches(fields,signature,anchors)) return null;
    const f=i=>fields[i], rows=(name,items)=>({name,rows:items});
    const entry=(key,label,i,kind='text',check)=>({key,label,value:f(i).value,kind,disabled:f(i).disabled,checked:check===undefined?null:f(check).checked,sourceIndices:check===undefined?[i]:[check,i]});
    const toggle=(key,label,i)=>({key,label,value:'—',kind:'text',checked:f(i).checked,sourceIndices:[i]});
    const choose=(key,label,indices,names)=>choice(fields,key,label,indices,names);
    const groups=[rows('Universe',[
      entry('chart','Chart type',0),entry('group','Group',1),entry('market','Market',3),entry('timeframe','Timeframe',33),toggle('market-filter','Market trend filter',2)
    ])];
    if(variant)groups.push(rows('Chart settings',[...chartRows(fields,chartStart,chart),choose('signal-mode','Signal mode',[34,35],['Running','Fresh'])]));
    groups.push(rows('Momentum periods',Array.from({length:4},(_,i)=>({...entry(`period.${i+1}`,`Period ${i+1}`,12+i*2,'count',11+i*2),weight:f(22+i).value,sourceIndices:[11+i*2,12+i*2,22+i]}))));
    groups.push(rows('EMA & TMA',[
      ...Array.from({length:3},(_,i)=>entry(`ema.${i+1}`,`EMA ${i+1}`,27+i*2,'count',26+i*2)),toggle('tma','TMA Trend',32)
    ]));
    groups.push(rows('Retracement & volume',[
      entry('retracement','Retracement',5,'percent',4),entry('retracement.mode','Condition',6),choose('retracement.reference','Reference',[7,8,9,10],['52 Week High','52 Week Low','ATH','ATL']),entry('volume','Minimum volume',19,'count'),choose('volume.reference','Volume reference',[20,21],['Average','Highest'])
    ]));
    groups.push(rows('Filters',[
      {...entry('radar','Radar',36+shift,'text',34+shift),value:ruleName(f(36+shift).value),detail:sourceName(f(35+shift).value),sourceIndices:[34+shift,35+shift,36+shift]},entry('trend-quality','Trend Quality >',38+shift,'percent',37+shift)
    ]));
    groups.push(rows('Strategies',Array.from({length:3},(_,n)=>{const i=39+shift+n*4;return {...entry(`strategy.${n+1}`,`Strategy ${n+1}`,i+1,'text',i+3),value:ruleName(f(i+1).value),detail:`${sourceName(f(i).value)} · ${variant?'input '+cell(f(i+2).value).text:f(i+2).value}`,sourceIndices:[i,i+1,i+2,i+3]};})));
    groups.push(rows('Relative Strength',[
      toggle('rs','Relative Strength',rs),...(extended?[
        entry('rs.market','Benchmark market',rs+1),entry('rs.benchmark','Benchmark',rs+2),{...entry('rs.rule','RS rule',fields.length-1),value:ruleName(f(fields.length-1).value),detail:sourceName(f(fields.length-2).value),sourceIndices:[fields.length-2,fields.length-1]}
      ]:[])
    ]));
    return groups;
  }

  function executionGroups(fields) {
    const chart=fields[3]?.value,variant=['P&F','Renko'].includes(chart),selection=variant?8:4,mode=fields[selection]?.value,benchmark=['RS','Both'].includes(mode),exit=selection+1+(benchmark?2:0);
    let signature='sdds'+(variant?'tsrr':'')+'s'+(benchmark?'st':'')+'cssctct';
    if(['Candle','P&F','Renko'].includes(chart)&&mode==='Price'&&['My','Public'].includes(fields[exit+1]?.value)&&fields[exit+2]?.type==='text')signature=signature.slice(0,exit+2)+'t'+signature.slice(exit+3);
    const anchors=[[0,/Rank/i],[1,/From/i],[2,/To/i],[3,/Chart/i],[selection,/Selection/i],[exit,/Exit/i],[exit+3,/Target/i],[exit+5,/Stop Loss/i]];
    if(variant)anchors.push([4,chart==='Renko'?/Brick Size/i:/Box Size/i]);
    if(benchmark)anchors.push([selection+1,/Exit Denominator/i]);
    if (!['Candle','P&F','Renko'].includes(chart) || !['Price','RS','Both'].includes(mode) || !matches(fields,signature,anchors)) return null;
    const row=(key,label,i,kind='text',check)=>({key,label,value:fields[i].value,kind,disabled:fields[i].disabled,checked:check===undefined?null:fields[check].checked,sourceIndices:check===undefined?[i]:[check,i]});
    return [{name:'Backtest setup',rows:[row('rank','Rank criteria',0),row('from','From date',1),row('to','To date',2),row('chart','Chart type',3),row('selection','Selection type',selection),...(benchmark?[row('exit.market','Exit benchmark market',selection+1),row('exit.benchmark','Exit benchmark',selection+2)]:[])]},
      ...(variant?[{name:'Chart settings',rows:chartRows(fields,4,chart)}]:[]),
      {name:'Exits',rows:[{...row('exit','Exit strategy',exit+2,'text',exit),value:ruleName(fields[exit+2].value),detail:sourceName(fields[exit+1].value),sourceIndices:[exit,exit+1,exit+2]},row('target','Target',exit+4,'percent',exit+3),row('stop','Stop loss',exit+6,'percent',exit+5)]}];
  }
  function portfolioGroups(fields) {
    if (!matches(fields,'csttct',[[0,/Portfolio/i],[1,/Allocation/i],[2,/Initial Investment/i],[3,/Maximum Open Trades/i],[4,/Stock Per Day/i],[5,/Stock Per Day/i]])) return null;
    return [{name:'Allocation & limits',rows:[
      {key:'enabled',label:'Portfolio testing',value:'—',checked:fields[0].checked,sourceIndices:[0]},
      {key:'allocation',label:'Allocation',value:fields[1].value,sourceIndices:[1]},
      {key:'capital',label:'Initial capital',value:fields[2].value,kind:'number',sourceIndices:[2]},
      {key:'max-open',label:'Maximum open trades',value:fields[3].value,kind:'count',sourceIndices:[3]},
      {key:'daily-limit',label:'Stocks per day',value:fields[5].value,kind:'count',checked:fields[4].checked,sourceIndices:[4,5]}
    ]}];
  }

  function fallbackGroups(fields) {
    return [{name:'Captured settings',rows:fields.map(f=>{
      // Remove the known tooltip spill, but keep unknown field context intact.
      let label=clean(f.label).split('→').at(-1).replace(/\/?\s*iThis feature can help you.*$/i,'').replace(/\/?\s*Prei\b/gi,'').replace(/Str\s+(\d+)/gi,'Strategy $1').replace(/\s*:\s*$/,'').trim() || `Field ${f.index+1}`;
      const key=`field.${f.index}`;
      if (fields.filter(x=>x.label===f.label).length>1) label+=` · field ${f.index+1}`;
      return {key,label,value:['checkbox','radio'].includes(f.type)?'—':f.value,kind:['select-one','date'].includes(f.type)?'text':'number',checked:f.checked,disabled:f.disabled,sourceIndices:[f.index]};
    })}];
  }
  function settings(run) {
    return [
      ['momentum','Momentum',run.parameters?.strategy?.main,mainGroups],
      ['execution','Execution',run.parameters?.strategy?.execution,executionGroups],
      ['portfolio','Portfolio',run.parameters?.settings,portfolioGroups],
      ['observed','Current inputs (unverified)',run.observedMain,mainGroups]
    ].filter(([, ,snapshot])=>snapshot).map(([key,title,snapshot,adapt])=>({key,title,snapshot,groups:adapt(snapshot.fields)||fallbackGroups(snapshot.fields)}));
  }
  function parameterMap(run) {
    return new Map(settings(run).flatMap(stage=>stage.groups.flatMap(group=>group.rows.map(row=>[`${stage.key}.${row.key}`,{label:`${stage.title} · ${row.label}`,text:settingText(row),signature:JSON.stringify(row.sourceIndices.map(i=>{const f=stage.snapshot.fields.find(f=>f.index===i);return [f.type,f.value,f.checked,f.disabled];}))}]))));
  }
  function compareValues(a,b,direction='ascending') {
    const missing=v=>v===null||v===undefined||v===''||v==='—'||typeof v==='number'&&!Number.isFinite(v);
    if(missing(a))return missing(b)?0:1;if(missing(b))return -1;
    const order=typeof a==='number'&&typeof b==='number'?a-b:String(a).localeCompare(String(b),'en',{numeric:true,sensitivity:'base'});
    return direction==='descending'?-order:order;
  }
  const api={cell,metric,tradeCell,compareValues,state,settingValue,settingText,settings,parameterMap};
  if (typeof module!=='undefined') module.exports=api;
  root.VaultPresentation=api;
})(typeof window!=='undefined'?window:globalThis);
