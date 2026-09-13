(function(root){
'use strict';
const I=root.VaultIntelligence,P=root.VaultPresentation;
function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function button(text,fn,cls='secondary'){const b=el('button',text,cls);b.onclick=fn;return b;}
function cell(value,kind='number',signed=false){return P.cell(typeof value==='number'&&Number.isFinite(value)?value.toFixed(value!==0&&Math.abs(value)<.01?6:2):value,{kind,signed});}
function link(text,url){const a=el('a',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}

const measures={calmar:{label:'Calmar',kind:'number',direction:'Higher is better'},returns:{label:'Return',kind:'percent',direction:'Higher is better'},drawdown:{label:'Drawdown',kind:'percent',direction:'Lower is better'}};
const nameOf=x=>x.run.name||x.run.id;
const num=(value,kind='number',signed=false)=>cell(value,kind,signed).text;
function disclosure(title,id){const d=el('details');d.id=id;d.append(el('summary',title));return d;}
function picker(title,id){
 const d=disclosure(title,id);d.className='compact-picker';const summary=d.firstChild;summary.id=id+'-toggle';
 d.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();d.open=false;summary.focus({preventScroll:true});}};
 d.onfocusout=e=>{if(e.relatedTarget&&!d.contains(e.relatedTarget))d.open=false;};
 d.addEventListener('toggle',()=>{
  if(!d.open)return;const panel=d.querySelector('.picker-panel'),r=summary.getBoundingClientRect(),below=innerHeight-r.bottom-16,above=r.top-16;
  const upward=below<Math.min(panel.scrollHeight,420)&&above>below;panel.classList.toggle('opens-up',upward);panel.style.setProperty('--menu-room',Math.max(140,upward?above:below)+'px');
 });
 return d;
}
document.addEventListener('pointerdown',e=>{document.querySelectorAll('.compact-picker[open]').forEach(d=>{if(!d.contains(e.target))d.open=false;});});
function grip(){
 // Lucide grip-vertical, ISC; attribution is included in LICENSE.
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 for(const [k,v] of Object.entries({viewBox:'0 0 24 24',width:20,height:20,fill:'none',stroke:'currentColor','stroke-width':2,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(k,v);
 for(const [x,y] of [[9,12],[9,5],[9,19],[15,12],[15,5],[15,19]]){const c=document.createElementNS(svg.namespaceURI,'circle');c.setAttribute('cx',x);c.setAttribute('cy',y);c.setAttribute('r','1');svg.append(c);}return svg;
}
let cancelColumnDrag=null;
function columnDrag(handle,{key,axis,peers,scroller,commit}){
 let suppressClick=false;
 handle.addEventListener('click',e=>{if(suppressClick){suppressClick=false;if(e.detail>0){e.preventDefault();e.stopImmediatePropagation();}}},true);
 handle.onpointerdown=e=>{
  if(e.button!==0||e.isPrimary===false||(axis==='x'&&e.pointerType==='touch'))return;
  cancelColumnDrag?.();suppressClick=false;
  const controller=new AbortController(),options={signal:controller.signal},source=peers().find(n=>n.dataset.column===key),start={x:e.clientX,y:e.clientY};
  let active=false,ghost=null,marker=null,frame=0,last=e,before=undefined,valid=false;
  const rect=()=>scroller.getBoundingClientRect(),coordinate=p=>axis==='x'?p.clientX:p.clientY;
  const clean=()=>{controller.abort();if(frame)cancelAnimationFrame(frame);ghost?.remove();marker?.remove();source.classList.remove('column-drag-source');document.body.classList.remove('column-dragging');if(scroller.hasPointerCapture?.(e.pointerId))scroller.releasePointerCapture(e.pointerId);cancelColumnDrag=null;};
  const finish=(save=false)=>{
   const changed=active&&valid,anchor=before;clean();
   if(active)suppressClick=true;
   if(save&&changed)commit(anchor);
  };
  cancelColumnDrag=()=>finish();
  function position(){
   if(!active)return;
   const bounds=rect(),p=coordinate(last),nodes=peers().filter(n=>n!==source),cross=axis==='x'?last.clientY:last.clientX;
   const hit=axis==='x'?source.getBoundingClientRect():bounds;
   valid=cross>=(axis==='x'?hit.top:hit.left)-24&&cross<=(axis==='x'?hit.bottom:hit.right)+24&&p>=(axis==='x'?bounds.left:bounds.top)-40&&p<=(axis==='x'?bounds.right:bounds.bottom)+40;
   const target=nodes.find(n=>{const r=n.getBoundingClientRect();return p<(axis==='x'?r.left+r.width/2:r.top+r.height/2);});
   before=target?.dataset.column||null;
   const edge=(target||nodes.at(-1))?.getBoundingClientRect();marker.hidden=!valid||!edge;
   if(edge){const at=target?(axis==='x'?edge.left:edge.top):(axis==='x'?edge.right:edge.bottom);Object.assign(marker.style,axis==='x'?{left:at+'px',top:source.getBoundingClientRect().top+'px',height:source.getBoundingClientRect().height+'px',width:'3px'}:{left:bounds.left+'px',top:at+'px',width:bounds.width+'px',height:'3px'});}
   ghost.style.left=Math.min(Math.max(8,last.clientX-(axis==='x'?30:ghost.offsetWidth-22)),innerWidth-ghost.offsetWidth-8)+'px';ghost.style.top=(last.clientY-22)+'px';
  }
  function autoScroll(){
   if(!active)return;
   const r=rect(),p=coordinate(last),lo=axis==='x'?r.left:r.top,hi=axis==='x'?r.right:r.bottom;
   const speed=valid?(p<lo+32?-Math.min(14,(lo+32-p)/3):p>hi-32?Math.min(14,(p-hi+32)/3):0):0;
   if(speed){if(axis==='x')scroller.scrollLeft+=speed;else scroller.scrollTop+=speed;position();}
   frame=requestAnimationFrame(autoScroll);
  }
  window.addEventListener('pointermove',p=>{
   if(p.pointerId!==e.pointerId)return;last=p;
   if(!active&&Math.hypot(p.clientX-start.x,p.clientY-start.y)<7)return;
   if(!active){active=true;scroller.setPointerCapture?.(e.pointerId);source.classList.add('column-drag-source');document.body.classList.add('column-dragging');
    ghost=el('div',source.textContent,'column-drag-ghost');ghost.setAttribute('aria-hidden','true');ghost.style.width=(axis==='x'?Math.max(120,source.getBoundingClientRect().width):source.getBoundingClientRect().width)+'px';
    marker=el('div',undefined,'column-drop-marker');marker.setAttribute('aria-hidden','true');document.body.append(ghost,marker);frame=requestAnimationFrame(autoScroll);
   }
   p.preventDefault();position();
  },{...options,passive:false});
  window.addEventListener('pointerup',p=>{if(p.pointerId===e.pointerId){last=p;if(active){p.preventDefault();position();}finish(true);}},{...options,passive:false});
  window.addEventListener('pointercancel',p=>{if(p.pointerId===e.pointerId)finish();},options);
  scroller.addEventListener('lostpointercapture',()=>finish(),options);
  window.addEventListener('blur',()=>finish(),options);
  document.addEventListener('keydown',p=>{if(p.key==='Escape'){p.preventDefault();p.stopImmediatePropagation();finish();}}, {...options,capture:true});
 };
}
const tableColumns=[
 {key:'rank',label:'Rank',numeric:true,value:r=>r.rank,kind:'count',required:true},
 {key:'strategy',label:'Strategy & test conditions',value:r=>nameOf(r.item),required:true},
 {key:'returns',label:'Return',numeric:true,value:r=>r.item.returns,kind:'percent',signed:true},
 {key:'drawdown',label:'Drawdown',numeric:true,value:r=>r.item.drawdown,kind:'percent'},
 {key:'calmar',label:'Calmar',numeric:true,value:r=>r.item.calmar,signed:true},
 {key:'growth',label:'CAGR / annualized',numeric:true,value:r=>r.item.metrics.growth,kind:'percent',signed:true},
 {key:'win',label:'Win ratio',numeric:true,value:r=>r.item.metrics.win,kind:'percent'},
 {key:'trades',label:'Reported trades',numeric:true,value:r=>r.item.metrics.trades,kind:'count'},
 {key:'capital',label:'Initial capital',numeric:true,value:r=>r.item.metrics.capital},
 {key:'final',label:'Final capital',numeric:true,value:r=>r.item.metrics.final},
 {key:'from',label:'From',value:r=>r.item.from},
 {key:'to',label:'To',value:r=>r.item.to},
 {key:'universe',label:'Universe',value:r=>r.item.controls.Universe},
 {key:'chart',label:'Momentum chart',value:r=>r.item.controls['Momentum chart']}
];
const defaultColumns=tableColumns.slice(0,6).map(c=>c.key);
function tablePreferences(value){
 const keys=tableColumns.map(c=>c.key),optional=keys.slice(2);
 const order=['rank','strategy',...new Set([...(Array.isArray(value?.order)?value.order:[]).filter(k=>optional.includes(k)),...optional])];
 const visible=Array.isArray(value?.visible)?value.visible.filter(k=>keys.includes(k)):defaultColumns;
 return {order,visible:[...new Set(['rank','strategy',...visible])]};
}
function strategyTable({ordered,basis,all=false,showAll,onOpen,onGroup,onMore,leaders=[],canLead=false,state,onChange,toolbar}){
 const container=el('div',undefined,'strategy-table-tools'),prefs=state.preferences,m=measures[basis],name=all?'All runs ranking':'Strategy ranking';
 const columns=prefs.order.map(key=>tableColumns.find(c=>c.key===key)),shown=columns.filter(c=>prefs.visible.includes(c.key));
 const config=picker('Columns','strategy-columns'),panel=el('div',undefined,'picker-panel column-panel');
 const help=el('p','Drag to reorder. With a handle focused, use Arrow Up or Arrow Down. Rank and strategy stay first.','sr-only');help.id='column-drag-help';panel.append(help);
 const list=el('div',undefined,'column-options');
 function move(key,before,focusId){
  const order=prefs.order.filter(k=>k!==key),index=before?order.indexOf(before):order.length;order.splice(Math.max(2,index),0,key);
  if(order.join()===prefs.order.join())return;
  prefs.order=order;state.announcement=tableColumns.find(c=>c.key===key).label+' moved.';onChange(focusId,true);
 }
 columns.filter(c=>!c.required).forEach(c=>{
  const row=el('div',undefined,'column-option'),label=el('label'),check=el('input');row.dataset.column=c.key;check.type='checkbox';check.id='column-'+c.key;check.checked=prefs.visible.includes(c.key);
  check.onchange=()=>{prefs.visible=check.checked?[...prefs.visible,c.key]:prefs.visible.filter(k=>k!==c.key);if(!check.checked&&state.sort?.key===c.key)state.sort=null;onChange(check.id,true);};
  label.append(check,el('span',c.label));row.append(label);
  const handle=button(undefined,()=>{},'quiet column-grip');handle.id='column-grip-'+c.key;handle.setAttribute('aria-label','Reorder '+c.label);handle.setAttribute('aria-describedby',help.id);handle.append(grip());
  handle.onkeydown=e=>{const keys=prefs.order.slice(2),i=keys.indexOf(c.key),dest=e.key==='ArrowUp'?i-1:e.key==='ArrowDown'?i+1:e.key==='Home'?0:e.key==='End'?keys.length-1:null;if(dest===null)return;e.preventDefault();if(dest<0||dest>=keys.length||dest===i)return;const rest=keys.filter(k=>k!==c.key);move(c.key,rest[dest]||null,handle.id);};
  columnDrag(handle,{key:c.key,axis:'y',peers:()=>[...list.children],scroller:list,commit:before=>move(c.key,before,handle.id)});row.append(handle);
  list.append(row);
 });
 panel.append(list);const reset=button('Reset columns',()=>{state.preferences=tablePreferences(null);state.sort=null;onChange('columns-reset',true);},'quiet');reset.id='columns-reset';panel.append(reset);config.append(panel);toolbar.append(config);
 const description=el('p',undefined,'sr-only');description.id='strategy-table-order';description.setAttribute('role','status');
 const sortedColumn=tableColumns.find(c=>c.key===state.sort?.key);
 description.textContent=(state.announcement||'')+' '+(sortedColumn?'Sorted by '+sortedColumn.label+', '+state.sort.direction+'. Ranks use '+m.label+'.':'Ranking order.');state.announcement='';container.append(description);
 const wrap=el('div',undefined,'table-wrap');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',name+' · scrollable table');
 const t=el('table',undefined,'rank-table'+(all?' all-runs-table':''));t.setAttribute('aria-label',name);t.setAttribute('aria-describedby','strategy-table-order');t.dataset.basis=basis;
 t.style.minWidth=((all?320:240)+Math.max(0,shown.length-2)*(all?125:90))+'px';
 const head=el('thead'),tr=el('tr');
 shown.forEach(c=>{
  const th=el('th');th.scope='col';th.dataset.column=c.key;if(c.numeric)th.className='numeric';
  const active=state.sort?.key===c.key;th.setAttribute('aria-sort',active?state.sort.direction:!state.sort&&c.key==='rank'?'ascending':'none');
  const sort=button(c.label,()=>{state.sort={key:c.key,direction:active&&state.sort.direction==='ascending'?'descending':'ascending'};onChange('strategy-sort-'+c.key,false,true);},'table-sort');
  sort.id='strategy-sort-'+c.key;sort.setAttribute('aria-label',c.label);sort.title=c.label+' · click to sort '+(active&&state.sort.direction==='ascending'?'descending':'ascending');th.append(sort);tr.append(th);
  if(!c.required){th.classList.add('movable-column');columnDrag(sort,{key:c.key,axis:'x',peers:()=>[...tr.children].filter(n=>!['rank','strategy'].includes(n.dataset.column)),scroller:wrap,commit:before=>move(c.key,before,sort.id)});}
 });head.append(tr);t.append(head);
 // Display sorting never recomputes financial ranks, leaders or chart order.
 const display=sortedColumn?[...ordered].sort((a,b)=>P.compareValues(sortedColumn.value(a),sortedColumn.value(b),state.sort.direction)):ordered;
 const body=el('tbody');
 (showAll?display:display.slice(0,5)).forEach((r,index)=>{
  const x=r.item,row=el('tr',undefined,(canLead&&leaders.includes(x)?'rank-leader ':'')+(x.rankEligible===false||!x.withinLimit?'rank-limited':''));
  row.dataset.runId=x.run.id;row.style.setProperty('--order',Math.min(index,5));
  shown.forEach(c=>{
   const td=el('td',undefined,(c.numeric?'numeric':'')+(c.key===basis?' ranked-value':''));td.dataset.column=c.key;
   if(c.key==='rank')td.append(el('span',r.rank===null?'—':String(r.rank),'rank-place'));
   else if(c.key==='strategy'){
    td.append(button(nameOf(x),()=>onOpen(x.run),'rank-name'));
    const status=all?overviewStatus(x,basis):!x.withinLimit?'Above ceiling':!Number.isFinite(x[basis])?'Missing '+m.label:r.rank===null?'Needs a peer':canLead&&leaders.includes(x)?(leaders.length>1?'Joint leader':'Leading'):x.dominatedBy.length?'Outperformed on return / drawdown':'Different return / risk trade-off';
    td.append(el('small',status,'rank-status'));
    if(all){const c=x.controls;td.append(el('small',[c.Universe||'Universe not captured',c['Momentum chart']||'Chart not captured',c.From&&c.To?c.From+' — '+c.To:'Dates not verified',c['Initial capital']!==undefined?num(c['Initial capital'])+' capital':'Capital not captured'].join(' · '),'run-conditions'));if(x.groupKey)td.append(button('Group '+x.groupNumber+' · compare matched runs',()=>onGroup(x.groupKey),'quiet group-shortcut'));}
   }else{
    const value=c.value(r);td.textContent=c.numeric?num(value,c.kind,c.signed):value||'—';
    if(c.key==='growth'&&Number.isFinite(value))td.append(el('small',x.metrics.growthLabel,'growth-basis'));
   }
   row.append(td);
  });body.append(row);
 });t.append(body);wrap.append(t);container.append(wrap);
 if(ordered.length>5){const more=button(showAll?(state.sort?'Show first 5':'Show top 5'):'Show all '+ordered.length+' runs',onMore,'quiet');more.id='rank-more';container.append(more);}
 return container;
}
function metricList(rows,cls='map-metrics'){
 const list=el('dl',undefined,cls);
 for(const [label,value] of rows){const pair=el('div');pair.append(el('dt',label),el('dd',value));list.append(pair);}return list;
}
function showBenchmarkOptions(){
 const options=document.getElementById('analysis-options');if(options){options.open=true;options.scrollIntoView({block:'nearest'});document.getElementById('benchmark-select')?.focus({preventScroll:true});}
}
function runSnapshot(x,onOpen){
 const panel=el('div'),head=el('div',undefined,'panel-heading');head.append(el('h4',nameOf(x)),button('Open full run',()=>onOpen(x.run),'quiet'));panel.append(head);
 panel.append(metricList([['Gross return',num(x.returns,'percent',true)],['Max drawdown',num(x.drawdown,'percent')],[x.metrics.growthLabel||'CAGR / annualized',num(x.metrics.growth,'percent',true)],['Derived Calmar',num(x.calmar,'number',true)],['Win ratio',num(x.metrics.win,'percent')],['Reported trades',num(x.metrics.trades,'count')]]));
 const c=x.controls;panel.append(metricList([['Universe / timeframe',[c.Universe,c.Market,c.Timeframe].filter(Boolean).join(' · ')],['Test dates',x.from+' — '+x.to],['Chart models',c['Momentum chart']+' momentum · '+c['Execution chart']+' execution'],['Initial capital / allocation',num(c['Initial capital'])+' · '+c.Allocation],['Position / daily limits',num(c['Maximum open trades'],'count')+' open · '+(c['Daily stock limit']==='Off'?'daily limit off':num(c['Daily stock limit'],'count')+' per day')],['Execution price mode',c['Execution price mode']]],'map-settings map-context'));
 const main=[...x.rows].filter(([key,r])=>r.checked!==false&&!r.disabled&&(/^(momentum\.(period\.|ema\.|tma$|rs$|rs\.|strategy\.|radar$|trend-quality$|box\.|brick\.|signal-mode$|retracement$)|execution\.(selection$|exit$|target$|stop$|box\.|brick\.))/.test(key))).filter(([key])=>!key.startsWith('momentum.rs.')||x.rows.get('momentum.rs')?.checked===true);
 panel.append(el('h5','Main strategy settings'),metricList(main.slice(0,8).map(([key,r])=>[(key.startsWith('execution.')?'Execution · ':key.startsWith('momentum.rs.')?'RS · ':'')+r.label,P.settingText(r)]),'map-settings'));
 if(main.length>8){const more=el('details');more.append(el('summary',(main.length-8)+' more active settings'),metricList(main.slice(8).map(([key,r])=>[(key.startsWith('execution.')?'Execution · ':key.startsWith('momentum.rs.')?'RS · ':'')+r.label,P.settingText(r)]),'map-settings'));panel.append(more);}
 panel.append(el('p',(!x.withinLimit?'Above your drawdown ceiling. ':'')+(x.cautions||[]).join(' '),'mini'));
 return panel;
}
function riskChart(group,leaders,b,{all=false,state={},onOpen}={}){
 const figure=el('figure',undefined,'risk-map reveal'),head=el('div',undefined,'panel-heading');
 head.append(el('h3','Return vs. drawdown'),el('span','Select a point to inspect','mini'));figure.append(head);
 const items=group.items.filter(x=>Number.isFinite(x.returns)&&Number.isFinite(x.drawdown));
 let selected=items.find(x=>x.run.id===state.runId)||leaders[0]||items[0];
 if(selected?.run.id!==state.runId){state.runId=selected?.run.id||'';state.expanded=false;state.kind='run';}
 const plot=el('div'),legend=el('figcaption',undefined,'map-legend'),chooser=el('label','Inspect run','map-chooser'),select=el('select');
 select.id='chart-run-select';select.setAttribute('aria-label','Inspect chart run');items.forEach(x=>select.append(new Option(nameOf(x),x.run.id)));select.disabled=!selected;select.value=selected?.run.id||'';chooser.append(select);
 const announcement=el('p',undefined,'map-announcement');announcement.setAttribute('aria-live','polite');announcement.setAttribute('aria-atomic','true');
 const inspector=el('section',undefined,'map-inspector');inspector.id='chart-inspector';inspector.tabIndex=-1;inspector.setAttribute('aria-label','Chart selection details');
 const reference=el('section',undefined,'map-index');reference.setAttribute('aria-label','Index reference for selected run');
 figure.append(plot,legend,chooser,announcement,inspector,reference);
 const choose=(item,kind='run',focusKey='chart-run-select')=>{selected=item;state.runId=item.run.id;state.kind=kind;state.expanded=true;draw(focusKey);inspector.scrollIntoView({block:'nearest',behavior:'auto'});};
 select.onchange=()=>choose(items.find(x=>x.run.id===select.value));
 function draw(focusKey){
  const bm=selected?I.benchmarkFor(selected,b):{available:false,reason:'No reviewed run is available for a period-matched reference.'};
  const ref=bm.available&&Number.isFinite(bm.drawdown)?bm:null;
  if(!bm.available&&state.kind==='index'){state.kind='run';state.expanded=false;}
  figure.classList.toggle('map-interacted',!!state.expanded);
  plot.replaceChildren();legend.replaceChildren();inspector.replaceChildren();reference.replaceChildren();select.value=selected?.run.id||'';
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 540 290');svg.setAttribute('role','group');svg.setAttribute('aria-label',all?'Interactive return versus drawdown across different test conditions. The index reference follows the selected run’s period.':'Interactive return versus drawdown in the selected group. Select a run or the index reference.');
  const add=(tag,attrs,text,parent=svg)=>{const e=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;parent.append(e);return e;};
  add('title',{},'Higher return with less drawdown is toward the upper left. Select points with click, Enter or Space; the run selector also reaches overlapping points.');
  const values=[...items.map(x=>({ret:x.returns,dd:x.drawdown})),...(ref?[{ret:ref.returns,dd:ref.drawdown}]:[])];
  const minY=Math.min(0,...values.map(x=>x.ret)),maxY=Math.max(1,...values.map(x=>x.ret)),pad=Math.max(1,(maxY-minY)*.16),low=minY<0?minY-pad:0,high=maxY+pad,maxX=Math.max(1,...values.map(x=>x.dd))*1.2;
  const left=55,right=505,top=28,bottom=240,px=x=>left+x/maxX*(right-left),py=y=>bottom-(y-low)/(high-low)*(bottom-top);
  add('rect',{x:left,y:top,width:right-left,height:bottom-top,rx:8,class:'map-ground'});
  for(let i=0;i<=4;i++){const x=maxX*i/4,y=low+(high-low)*i/4;add('line',{x1:px(x),x2:px(x),y1:top,y2:bottom,class:'map-grid'});add('line',{x1:left,x2:right,y1:py(y),y2:py(y),class:'map-grid'});add('text',{x:px(x),y:bottom+19,'text-anchor':'middle',class:'map-axis'},x.toFixed(1)+'%');add('text',{x:left-10,y:py(y)+4,'text-anchor':'end',class:'map-axis'},y.toFixed(1)+'%');}
  if(low<0)add('line',{x1:left,x2:right,y1:py(0),y2:py(0),class:'map-zero'});add('text',{x:left,y:16,class:'map-caption'},'Return');add('text',{x:right,y:282,'text-anchor':'end',class:'map-caption'},'Drawdown');
  const wire=(point,callback)=>{point.addEventListener('click',callback);point.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();callback();}});};
  // Keep tab order stable after selection; the selector reaches coincident points.
  items.forEach((x,index)=>{
   const id='chart-point-'+index,tone=!x.withinLimit?'limit':leaders.includes(x)?'lead':'peer',isSelected=x===selected&&state.kind!=='index';
   const text='Inspect '+nameOf(x)+' · return '+num(x.returns,'percent',true)+' · drawdown '+num(x.drawdown,'percent')+(x.withinLimit?'':' · above ceiling');
   const point=add('g',{id,role:'button',tabindex:0,'aria-label':text,'aria-pressed':String(isSelected),'aria-controls':'chart-inspector',class:'map-point'+(isSelected?' selected':''),'data-run-id':x.run.id});
   add('circle',{cx:px(x.drawdown),cy:py(x.returns),r:15,class:'map-hit'},undefined,point);
   add('circle',{cx:px(x.drawdown),cy:py(x.returns),r:tone==='lead'?8:6,class:'map-dot '+tone,style:'--order:'+Math.min(index,5)},undefined,point);
   if(isSelected)add('circle',{cx:px(x.drawdown),cy:py(x.returns),r:11,class:'map-selected-ring'},undefined,point);
   add('title',{},text,point);wire(point,()=>choose(x,'run',id));
  });
  if(selected){const anchor=px(selected.drawdown)>335?'end':'start';add('text',{x:px(selected.drawdown)+(anchor==='end'?-14:14),y:py(selected.returns)-16,'text-anchor':anchor,class:'map-leader-label','pointer-events':'none'},nameOf(selected).length>24?nameOf(selected).slice(0,22)+'…':nameOf(selected));}
  if(ref){
   const text='Inspect index reference · '+b.name+' · '+ref.from+' to '+ref.to+' · return '+num(ref.returns,'percent',true)+' · observed-close drawdown '+num(ref.drawdown,'percent');
   const point=add('g',{id:'chart-index-point',role:'button',tabindex:0,'aria-label':text,'aria-pressed':String(state.kind==='index'),'aria-controls':'chart-inspector',class:'map-point map-index-point'});
   add('rect',{x:px(ref.drawdown)-15,y:py(ref.returns)-15,width:30,height:30,rx:3,class:'map-hit'},undefined,point);
   add('rect',{x:px(ref.drawdown)-6,y:py(ref.returns)-6,width:12,height:12,rx:1,class:'map-reference'},undefined,point);
   if(state.kind==='index')add('rect',{x:px(ref.drawdown)-10,y:py(ref.returns)-10,width:20,height:20,rx:2,class:'map-selected-ring'},undefined,point);
   add('title',{},text,point);wire(point,()=>choose(selected,'index','chart-index-point'));
   const anchor=px(ref.drawdown)>335?'end':'start';add('text',{x:px(ref.drawdown)+(anchor==='end'?-12:12),y:py(ref.returns)+21,'text-anchor':anchor,class:'map-axis','pointer-events':'none'},'Index reference');
  }
  plot.append(svg);
  [['selected','Selected'],...(!all?[['lead','Leader']]:[]),['peer',all?'Reviewed run':'Other run'],['limit','Above ceiling'],...(ref?[['reference','Index · selected period']]:[])].forEach(([tone,label])=>{const text=el('span',label);text.prepend(el('i',undefined,tone));legend.append(text);});
  announcement.textContent=state.expanded?(state.kind==='index'?'Index reference selected for ':'Selected ')+(selected?nameOf(selected):'')+'. Details below.':'Click a dot or choose a run to see its key metrics and settings. Overlapping points are available in the selector.';
  inspector.hidden=!state.expanded||!selected;
  if(!inspector.hidden){
   if(state.kind==='index'&&bm.available){
    inspector.append(el('h4',b.name),el('p','For '+nameOf(selected)+' · '+bm.from+' — '+bm.to,'mini'),metricList([['Buy & hold return',num(bm.returns,'percent',true)],['Annualized growth',num(bm.cagr,'percent',true)],['Observed-close drawdown',num(bm.drawdown,'percent')],['Derived Calmar',num(bm.calmar,'number',true)],['Initial capital',num(selected.metrics.capital)],['Buy & hold ending capital',num(bm.endingCapital)]]),el('p',bm.cautions.join(' '),'mini'),button('Inspect selected strategy',()=>choose(selected,'run','chart-run-select'),'quiet'));
   }else inspector.append(runSnapshot(selected,onOpen));
   inspector.append(button('Hide details',()=>{state.expanded=false;state.kind='run';draw('chart-run-select');},'quiet'));
  }
  reference.append(el('span','INDEX REFERENCE','eyebrow'));
  if(b)reference.append(el('h4',b.name),el('p',(b.demo?'FICTIONAL REFERENCE · ':'')+(b.kind==='total-return'?'Total return · dividends reinvested':'Price only · no dividends')+' · Source: '+b.source,'mini'));
  if(selected)reference.append(el('p','For '+nameOf(selected)+' · requested '+selected.from+' — '+selected.to+(all?' · follows the selected run, not the entire library.':''),'map-index-context'));
  if(bm.available){
   reference.append(metricList([['Buy & hold return',num(bm.returns,'percent',true)],['Gross excess (pp)',num(bm.excess,'number',true)]],'map-metrics index-metrics'),el('p','Effective index dates: '+bm.from+' — '+bm.to+(bm.shifted?' · approximate period':''),'mini'));
   if(!ref)reference.append(el('p','Index point unavailable: observed-close drawdown is withheld because the imported series is sparse. Return remains available.','map-reference-note'));
   reference.append(el('p','Gross comparison; strategy costs and dividend treatment are unverified. Index drawdown uses imported closing observations.','mini'));
   if(bm.shifted)reference.append(el('p','The effective index dates differ from the requested run dates. This is an approximate comparison.','map-reference-note'));
   const inspect=button('Inspect index',()=>choose(selected,'index','chart-inspect-index'),'quiet');inspect.id='chart-inspect-index';reference.append(inspect);
  }else reference.append(el('p',bm.reason,'map-reference-note'));
  reference.append(button(b?'Change index reference':'Choose / import index',showBenchmarkOptions,'quiet'));
  if(focusKey)figure.querySelector('#'+focusKey)?.focus({preventScroll:true});
 }
 draw();return figure;
}

function overviewStatus(x,basis){
 if(x.status==='Needs review')return 'Needs review · unranked';
 if(x.status==='Repeated result')return 'Repeated result · '+x.duplicateOf;
 if(x.fictionalExcluded)return 'Fictional · excluded from real ordering';
 if(!x.withinLimit)return 'Above ceiling · unranked';
 if(!Number.isFinite(x[basis]))return 'Missing '+measures[basis].label+' · unranked';
 return 'Exploratory · different conditions may apply';
}
function overviewReference(x,b){
 return x.rankEligible?I.benchmarkFor(x,b):{available:false,reason:x.fictionalExcluded?'Fictional data excluded from real comparison.':x.status+'; review the original before comparing a benchmark.'};
}
function drawOverview({target,o,basis,b,limit,showAll,onOpen,onGroup,onMore,table,chartState,tableState,onTableChange}){
 const ordered=I.ranking(o,basis),eligible=ordered.filter(({item:x})=>x.rankEligible&&x.withinLimit&&Number.isFinite(x[basis])),m=measures[basis];
 const top=eligible[0]?.item,ties=top?eligible.filter(({item:x})=>Math.abs(x[basis]-top[basis])<1e-9):[];
 const hero=el('section',undefined,'ranking-hero reveal'+(eligible.length>=2&&ties.length===1?'':' neutral'));
 hero.setAttribute('aria-label','All runs takeaway');
 const message=el('div',undefined,'hero-message');message.append(el('span','ALL RUNS · EXPLORATORY','leader-kicker'));
 message.append(el('h3',eligible.length<2?'Not enough eligible values to rank.':ties.length>1?ties.length+' runs share the '+(basis==='drawdown'?'lowest':'highest')+' available '+m.label.toLowerCase()+'.':nameOf(top)));
 message.append(el('p',eligible.length>=2?(basis==='drawdown'?'Lowest':'Highest')+' available '+m.label.toLowerCase()+' across '+eligible.length+' eligible runs. Different dates, universes and sizing can change this order.':'Every saved run remains visible below. Check review flags, missing values or your ceiling.'));
 hero.append(message);
 if(eligible.length>=2&&ties.length===1){const score=el('div',undefined,'hero-score');score.append(el('span',m.label),el('strong',num(top[basis],m.kind,basis!=='drawdown')),el('small','Across different test conditions'));hero.append(score);}
 const facts=el('div',undefined,'hero-facts');facts.append(el('span',o.total+' saved runs'),el('span',o.groups.length+' matched groups'),el('span',eligible.length+' with eligible '+m.label),el('span',o.items.length-eligible.length+' unranked'));hero.append(facts);target.append(hero);
 target.append(el('p','Every run in this comparison is included. Use a matched group for a fairer ranking. Results are never added or averaged into a combined portfolio.'+(limit!==null?' Drawdown ceiling: '+num(limit,'percent')+'.':''),'ranking-caution'));
 if(o.mixedData)target.append(el('p','Fictional runs are visible but excluded from ordering alongside real research.','issues'));
 const grid=el('div',undefined,'ranking-grid all-runs-grid'),board=el('section',undefined,'rank-board reveal'),head=el('div',undefined,'panel-heading');
 head.append(el('h3','All strategies, together'));board.append(head);
 board.append(strategyTable({ordered,basis,all:true,showAll,onOpen,onGroup,onMore,state:tableState,onChange:onTableChange,toolbar:head}));
 board.append(el('p','Equal values share a rank. Review flags, repeats, missing values and ceiling failures stay unranked.','mini'));
 const plotted=o.items.filter(x=>x.rankEligible&&Number.isFinite(x.returns)&&Number.isFinite(x.drawdown)),chart=riskChart({items:plotted},[],b,{all:true,state:chartState,onOpen});
 chart.append(el('p',plotted.length+' of '+o.total+' saved runs plotted. Review flags, repeated results and mixed fictional data are omitted. Different periods make this an exploratory map.','mini'));
 grid.append(board,chart);target.append(grid);
 const detail=disclosure('Compare all conditions & strategy settings','analysis-all-settings');
 detail.append(el('p','Submitted settings are shown below. “Different” marks a changed value or a missing capture. Identical labels do not verify costs, execution or capture quality. Unverified current inputs remain available inside each run.'));
 const names=o.items.map(x=>nameOf(x)+(x.groupNumber?' · G'+x.groupNumber:' · review'));
 detail.append(el('h3','Test conditions'),table(['Condition',...names],o.conditions.map(r=>[r.label+(r.different?' · Different':''),...r.values.map(v=>typeof v==='number'?cell(v,['Maximum open trades','Daily stock limit'].includes(r.key)?'count':'number'):v)]),{className:'comparison-table',name:'All run conditions'}));
 detail.append(el('h3','Captured strategy settings'),table(['Setting',...names],o.settings.map(r=>[r.key.split('.')[0]+' · '+r.label+(r.different?' · Different':''),...r.values]),{className:'comparison-table',name:'All strategy settings'}));target.append(detail);
 const statistics=disclosure('Compare all reported statistics','analysis-all-statistics');statistics.append(el('p','Original source measures remain separate, including CAGR and Annualized Returns. Values from runs needing review are shown as evidence, not endorsed as comparable.'),table(['Source measure',...names],o.statistics.map(r=>[r.label,...r.values.map(values=>values===null?'Not provided by source':values.length===1?P.metric(r.metricLabel,values[0]):values.join(' · '))]),{className:'comparison-table',name:'All reported statistics'}));target.append(statistics);
 const reference=disclosure('Buy & hold for each run’s own period','analysis-all-benchmarks');
 reference.append(el('p','Each eligible run uses its own dates and initial capital. The chart’s index point follows the selected run’s period. Gross excess is descriptive; strategy cost and dividend treatment remain unverified.'));
 if(b){reference.append(el('p',(b.demo?'FICTIONAL REFERENCE · ':'')+b.name+' · '+(b.kind==='total-return'?'Total return · dividends reinvested':'Price only · no dividends')+' · Source: '+b.source,'mini'));
  reference.append(table(['Run','Requested period','Reference period','Reference return','Gross excess (pp)','Buy & hold ending capital','Coverage & caveats'],o.items.map(x=>{const ref=overviewReference(x,b);return [nameOf(x),x.from&&x.to?x.from+' — '+x.to:'Not verified',ref.available?ref.from+' — '+ref.to:'Unavailable',cell(ref.returns,'percent',true),cell(ref.excess,'number',true),cell(ref.endingCapital),ref.available?ref.cautions.join(' '):ref.reason];}),{className:'comparison-table',name:'Per-run buy and hold'}));
 }else reference.append(el('p','Choose or import a reference in Filters & benchmark. Real Nifty history is not bundled.'));
 target.append(reference);
}

function render({target,runs,benchmarks=[],store,table,onOpen,onExit,onNotice,onBenchmarksChanged,download,preferences}){
 let limit=null,benchmarkId=benchmarks[0]?.id||'',groupKey='',basis='calmar',showAll=false;
 const openDetails=new Set(),chartState={},tableState={preferences:tablePreferences(preferences),sort:null,demo:!!store.demo};
 let preferenceWrite=Promise.resolve(),hasRendered=false;
 function onTableChange(focusId,persist=false,sorted=false){
  tableState.scrollLeft=target.querySelector('.rank-table')?.parentElement.scrollLeft||0;
  tableState.columnScrollTop=target.querySelector('.column-options')?.scrollTop||0;
  if(sorted)showAll=true;
  if(persist){const snapshot=JSON.parse(JSON.stringify(tableState.preferences));preferenceWrite=preferenceWrite.then(()=>store.putTablePreferences?.(snapshot)).catch(()=>onNotice('Column choices apply for this visit, but could not be saved on this browser.',true));}
  draw(focusId);
 }
 function draw(focusId){
  cancelColumnDrag?.();
  target.classList.toggle('analysis-updated',hasRendered);hasRendered=true;
  target.querySelectorAll('details[id]').forEach(d=>{if(d.open)openDetails.add(d.id);else openDetails.delete(d.id);});
  const a=I.analyze(runs,{drawdownLimit:limit});if(groupKey!=='all'&&!a.groups.some(g=>g.key===groupKey))groupKey=[...a.groups].sort((x,y)=>y.items.length-x.items.length)[0]?.key||'all';
  const g=a.groups.find(g=>g.key===groupKey),all=groupKey==='all',o=all?I.overview(a):null,b=benchmarks.find(b=>b.id===benchmarkId),bm=g?I.benchmarkFor(g.items[0],b):{available:false};
  target.replaceChildren();const head=el('div',undefined,'comparison-intro'),heading=el('div');heading.append(el('p','STRATEGY INTELLIGENCE','eyebrow'),el('h2','Find your front-runner.'));head.append(heading,button('Back to library',onExit));target.append(head);
  const toolbar=el('div',undefined,'ranking-toolbar'),groupLabel=el('label','Compare within'),groupSelect=el('select');groupSelect.id='ranking-group';groupSelect.setAttribute('aria-label','Comparison group');
  a.groups.forEach((x,i)=>groupSelect.append(new Option('Group '+(i+1)+' · '+x.controls['Momentum chart']+' · '+x.items.length+(x.items.length===1?' run':' runs')+' · '+x.controls.From.slice(0,4),x.key)));groupSelect.append(new Option('All runs · '+runs.length+' · exploratory','all'));if(!groupKey)groupKey='all';groupSelect.value=groupKey;groupSelect.disabled=!runs.length;groupSelect.onchange=()=>{groupKey=groupSelect.value;showAll=false;tableState.sort=null;draw('ranking-group');};groupLabel.append(groupSelect);toolbar.append(groupLabel);
  const by=el('div',undefined,'rank-by');by.append(el('span','Rank by','control-label'));
  const rankPicker=picker(measures[basis].label,'ranking-picker'),choices=el('div',undefined,'picker-panel ranking-choices');choices.setAttribute('role','group');choices.setAttribute('aria-label','Rank strategies by');
  for(const [key,m] of Object.entries(measures)){
   const choose=button(undefined,()=>{rankPicker.open=false;basis=key;showAll=false;tableState.sort=null;draw('ranking-picker-toggle');},'quiet');choose.id='rank-'+key;choose.setAttribute('aria-label',m.label);choose.setAttribute('aria-pressed',String(key===basis));choose.append(el('span',m.label),el('small',m.direction));choices.append(choose);
  }
  rankPicker.firstChild.setAttribute('aria-label','Rank by '+measures[basis].label);
  rankPicker.firstChild.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();rankPicker.open=true;document.getElementById('rank-'+basis).focus();}};
  choices.onkeydown=e=>{const buttons=[...choices.children],index=buttons.indexOf(document.activeElement);if(index<0)return;const next=e.key==='ArrowDown'?(index+1)%buttons.length:e.key==='ArrowUp'?(index+buttons.length-1)%buttons.length:null;if(next!==null){e.preventDefault();buttons[next].focus();}};
  rankPicker.append(choices);by.append(rankPicker);toolbar.append(by);target.append(toolbar);
  target.append(el('p',runs.length+' runs · '+a.groups.length+' separate groups · '+a.blocked.length+' for review'+(a.duplicates.length?' · '+a.duplicates.length+' repeated results':''),'ranking-scope'));
  if(all&&runs.length){
   drawOverview({target,o,basis,b,limit,showAll,onOpen,table,chartState,tableState,onTableChange,onGroup:key=>{groupKey=key;showAll=false;tableState.sort=null;draw('ranking-group');},onMore:()=>{showAll=!showAll;draw('rank-more');}});
  }else if(g){
   target.append(el('p',g.controls.Universe+' · '+g.controls.From+' — '+g.controls.To+' · '+g.controls.Allocation+' · '+num(g.controls['Initial capital'])+' capital'+(limit!==null?' · ceiling '+num(limit,'percent'):''),'ranking-context'));
   const ordered=I.ranking(g,basis),valid=ordered.filter(x=>x.item.withinLimit&&Number.isFinite(x.item[basis])),leaders=valid.filter(x=>Math.abs(x.item[basis]-valid[0].item[basis])<1e-9).map(x=>x.item),complete=valid.length===g.eligible.length,canLead=valid.length>=2&&complete,lead=canLead&&leaders.length===1?leaders[0]:null,m=measures[basis];
   const hero=el('section',undefined,'ranking-hero reveal'+(lead?'':' neutral'));hero.setAttribute('aria-label','Comparison takeaway');const message=el('div',undefined,'hero-message');message.append(el('span',lead?'LEADS THIS GROUP':'COMPARISON STATUS','leader-kicker'));
   let title,why;
   if(!g.eligible.length){title='No run meets your drawdown ceiling.';why='Relax the ceiling to compare this group, or review the other groups.';}
   else if(g.items.length<2){title='A peer is needed.';why='This run has no match with the same recorded controls. It cannot win a one-run comparison.';}
   else if(!complete){title='The comparison is incomplete.';why='Some runs are missing '+m.label.toLowerCase()+' data. Try another ranking measure or inspect the source.';}
   else if(valid.length<2){title='Only one run qualifies.';why='There are not enough eligible peers to name a leader under this ceiling.';}
   else if(leaders.length>1){title='Joint leaders on '+m.label.toLowerCase()+'.';why=leaders.map(nameOf).join(' and ')+' are tied. No tie-breaker has been invented.';}
   else{title=nameOf(lead);why=basis==='drawdown'?'Lowest reported drawdown among '+valid.length+' comparable runs.':'Highest '+(basis==='calmar'?'derived Calmar':'reported gross return')+' among '+valid.length+' comparable runs.';
    if(g.items.every(x=>x===lead||lead.returns>=x.returns&&lead.drawdown<=x.drawdown)&&g.items.some(x=>x!==lead&&(lead.returns>x.returns||lead.drawdown<x.drawdown)))why+=' No peer has more return or less drawdown.';if(lead.returns<=0)why+=' Its return is not positive.';}
   message.append(el('h3',title),el('p',why));hero.append(message);
   if(lead){const score=el('div',undefined,'hero-score');score.append(el('span',m.label),el('strong',num(lead[basis],m.kind,basis!=='drawdown')));hero.append(score);
    const stats=el('div',undefined,'hero-facts');for(const [label,value,signed] of [['Gross return',lead.returns,true],['Max drawdown',lead.drawdown,false]]){const s=el('span');s.append(el('small',label),el('strong',num(value,'percent',signed)));stats.append(s);}stats.append(button('Inspect this run',()=>onOpen(lead.run),'quiet'));hero.append(stats);}
   target.append(hero,el('p','Provisional ranking · costs and execution assumptions remain unverified.','ranking-caution'));
   const grid=el('div',undefined,'ranking-grid'),board=el('section',undefined,'rank-board reveal'),boardHead=el('div',undefined,'panel-heading');boardHead.append(el('h3','The leaderboard'));board.append(boardHead);
   board.append(strategyTable({ordered,basis,showAll,onOpen,leaders,canLead,state:tableState,onChange:onTableChange,toolbar:boardHead,onMore:()=>{showAll=!showAll;draw('rank-more');}}),el('p','Ranks stay within this group. Equal values share a rank.','mini'));
   grid.append(board,riskChart(g,canLead?leaders:[],b,{state:chartState,onOpen}));target.append(grid);
   const reference=el('section',undefined,'benchmark-brief reveal');reference.append(el('span','BUY & HOLD','eyebrow'));
   if(!bm.available)reference.append(el('h3','Add Nifty to the picture.'),el('p',bm.reason||'Choose a benchmark in Filters & benchmark.','muted'));
   else{const headline=el('div',undefined,'benchmark-headline');headline.append(el('h3',b.name),el('strong',num(bm.returns,'percent',true)));if(lead){const diff=lead.returns-bm.returns;headline.append(el('span',nameOf(lead)+' '+(diff>=0?'ahead by ':'behind by ')+num(Math.abs(diff))+' pp','benchmark-gap'));}reference.append(headline,el('p',(b.demo?'FICTIONAL REFERENCE · ':'')+(b.kind==='total-return'?'Total return · dividends reinvested':'Price only · no dividends')+' · '+bm.from+' — '+bm.to+(bm.shifted?' · approximate dates':''),'mini'),el('p','Source: '+b.source+' · Gross comparison; cost/dividend bases unverified.','mini'));}target.append(reference);
  }else target.append(el('section','No runs have enough verified captured controls for a comparison. Review the exclusions below.','ranking-hero neutral'));
  const options=disclosure('Filters & benchmark','analysis-options'),controls=el('div',undefined,'intelligence-controls');
  const riskLabel=el('label','Your drawdown ceiling (%)'),risk=el('input');risk.id='analysis-risk';risk.type='number';risk.min='0';risk.max='100';risk.step='any';risk.placeholder='No ceiling';risk.value=limit??'';riskLabel.append(risk);const apply=button('Apply ceiling',()=>{const n=risk.value===''?null:Number(risk.value);if(n!==null&&(!Number.isFinite(n)||n<0||n>100)){onNotice('Use a drawdown ceiling between 0 and 100.',true);return;}limit=n;draw('apply-ceiling');});apply.id='apply-ceiling';controls.append(riskLabel,apply);
  const refLabel=el('label','Buy-and-hold reference'),selection=el('select');selection.id='benchmark-select';selection.append(new Option('No reference selected',''));benchmarks.forEach(b=>selection.append(new Option(b.name+' · '+(b.kind==='total-return'?'Total Return Index':'Price index'),b.id)));selection.value=benchmarkId;selection.onchange=()=>{benchmarkId=selection.value;draw('benchmark-select');};refLabel.append(selection);controls.append(refLabel);options.append(controls);
    const importer=disclosure('Add Nifty benchmark data','benchmark-import');importer.append(el('p','Download one index’s history from NSE Indices. Import its CSV locally. No research records are sent to an external service.'),link('Open NSE historical data','https://www.niftyindices.com/reports/historical-data'));
  const form=el('div',undefined,'intelligence-controls'),nameLabel=el('label','Index name'),name=el('input');name.value='Nifty 50';nameLabel.append(name);
  const kindLabel=el('label','Index return basis'),kind=el('select');kind.append(new Option('Total Return Index · dividends included','total-return'),new Option('Price index · dividends excluded','price'));kindLabel.append(kind);
  const input=el('input');input.type='file';input.accept='.csv,text/csv';input.hidden=true;
  const importButton=button('Import benchmark CSV',()=>input.click());importButton.disabled=!!store.demo;
  input.onchange=async()=>{try{const file=input.files[0];if(!file)return;if(file.size>20*1024*1024)throw Error('Benchmark files must be smaller than 20 MB.');const imported=I.parseBenchmark(await file.text(),{id:'benchmark-'+crypto.randomUUID(),name:name.value.trim(),kind:kind.value,source:'Imported file: '+file.name,demo:false});await store.putBenchmark(imported);benchmarks=await store.allBenchmarks();await onBenchmarksChanged?.();benchmarkId=imported.id;openDetails.add('analysis-options');onNotice('Benchmark saved locally. Back up all includes index data.');draw();}catch(e){onNotice('Benchmark import stopped: '+e.message,true);}finally{input.value='';}};
  form.append(nameLabel,kindLabel,importButton,input);importer.append(form,el('p',store.demo?'Demo uses a fictional index illustration. Real Nifty data cannot be imported into demo mode.':'Accepted columns: Date and Total Returns Index (TRI) or Close (price). Dates must be YYYY-MM-DD or DD-Mon-YYYY. Missing coverage is shown instead of guessed.','muted'));

  options.append(importer);target.append(options);
  if(g){
   const detail=disclosure('Why these results? Settings, evidence & benchmark detail','analysis-evidence');detail.append(el('p',g.verdict,'verdict'));
   const aligned=disclosure('Aligned controls','analysis-aligned');aligned.append(table(['Control','Value'],Object.entries(g.controls).map(([k,v])=>[k,typeof v==='number'?cell(v,['Maximum open trades','Daily stock limit'].includes(k)?'count':'number'):v]),{name:'Aligned controls'}));detail.append(aligned);
   const diffs=disclosure('Changed strategy settings ('+g.differences.length+')','analysis-differences');diffs.append(g.differences.length?table(['Setting',...g.items.map(nameOf)],g.differences.map(d=>[d.key.split('.')[0]+' · '+d.label,...d.values]),{className:'comparison-table',name:'Strategy differences'}):el('p','No differences in the displayed strategy settings.'));detail.append(diffs);
   for(const x of g.items)detail.append(button('Open '+nameOf(x),()=>onOpen(x.run)),el('p',x.cautions.join(' '),'muted'));
   detail.append(el('h3','Full benchmark measures'));if(bm.available){detail.append(table(['Reference measure','Value'],[['Buy-and-hold return',cell(bm.returns,'percent',true)],['Annualized growth',cell(bm.cagr,'percent',true)],['Observed-close drawdown',cell(bm.drawdown,'percent')],['Derived Calmar',cell(bm.calmar,'number',true)],['Same initial capital',cell(g.controls['Initial capital'])],['Buy-and-hold ending capital',cell(bm.endingCapital)]],{className:'metric-table',name:'Buy-and-hold reference'}),table(['Run','Strategy gross return','Reference return','Gross excess (pp)'],g.items.map(x=>[nameOf(x),cell(x.returns,'percent',true),cell(bm.returns,'percent',true),cell(x.returns-bm.returns,'number',true)]),{name:'Excess return'}));bm.cautions.forEach(t=>detail.append(el('p',t,'muted')));}else detail.append(el('p',bm.reason));target.append(detail);
  }
  const method=disclosure('Method & excluded runs ('+a.blocked.length+')','analysis-method');
  method.append(el('p',a.groups.length+' comparison groups · '+a.blocked.length+' blocked · '+a.duplicates.length+' duplicate results excluded','analysis-count'),el('p','Peers share recorded dates, universe, market, timeframe, capital, allocation, limits and chart models. Strategy settings may differ. Costs, dividends, cash flows, leverage, universe history and equity valuation frequency are unverified. Rankings are provisional.'),el('p','Calmar = source CAGR ÷ positive maximum drawdown for the same run. Missing CAGR or zero drawdown leaves it undefined. Annualized Returns and the source Calmer Ratio stay separate. Each ranking uses one named measure; there is no opaque weighted score.'),el('p','A dominated run has a peer with at least as much return and no more drawdown, with one strictly better. Short periods, small samples, zero quantities and parameter-search bias weaken the evidence. Results are never added across runs: combined portfolios require synchronized equity curves and explicit weights.'),link('NSE: price versus total-return indices','https://www.niftyindices.com/resources/index-concepts/total-return-index'));
  if(a.blocked.length){method.append(el('h3','Excluded from ranking'));for(const x of a.blocked)method.append(button(x.run.name||x.run.id,()=>onOpen(x.run)),el('p',x.errors.join(' '),'issues'));}
  if(a.duplicates.length){method.append(el('h3','Repeated results are not independent evidence'));a.duplicates.forEach(x=>method.append(el('p',x.run.name+' repeats '+x.original.name+'. Kept in the library, counted once.')));}target.append(method);
  const exportButton=button('Export analysis CSV',()=>{
   if(all){
    const rows=[['Scope','Rank basis','Exploratory rank','Run','Matched group','Status','Recorded controls','Gross return (%)','Source CAGR (%)','Source Annualized Returns (%)','Preferred growth (%)','Growth basis','Max drawdown (%)','Derived Calmar','Reference','Reference basis','Reference source','Benchmark from','Benchmark to','Benchmark return (%)','Excess gross return (pp)','Buy-and-hold ending capital','Benchmark caveats','Evidence','Captured settings','Original statistics JSON']];
    for(const {item:x,rank} of I.ranking(o,basis)){
     const ref=overviewReference(x,b);
     rows.push(['All runs · exploratory',measures[basis].label,rank??'',nameOf(x),x.groupNumber??'',overviewStatus(x,basis),Object.entries(x.controls).map(([k,v])=>k+': '+(v??'Not captured')).join('; '),x.returns,x.cagr,x.metrics.annualized,x.metrics.growth,x.metrics.growthLabel,x.drawdown,x.calmar,b?.name||'',b?.kind||'',b?.source||'',ref.from||'',ref.to||'',ref.returns??'',ref.available?ref.excess:'',ref.endingCapital??'',ref.cautions?.join('; ')||ref.reason||'',(x.errors||[]).concat(x.cautions||[]).join('; '),[...x.rows].map(([key,r])=>key+': '+P.settingText(r)).join('; '),JSON.stringify({quickStats:x.run.quickStats||[],statistics:x.run.statistics||[]})]);
    }
    download('all-runs-analysis.csv',root.Vault.csv(rows.map(row=>row.map(v=>typeof v==='number'?Number(v.toFixed(6)):v??''))),'text/csv;charset=utf-8');return;
   }
   const rows=[['Group','Run','Aligned controls','Gross return (%)','Source CAGR (%)','Max drawdown (%)','Derived Calmar','Drawdown ceiling met','Dominated by','Reference','Reference basis','Reference source','Benchmark from','Benchmark to','Benchmark return (%)','Excess gross return (pp)','Benchmark caveats','Evidence']];a.groups.forEach((group,i)=>{const ref=I.benchmarkFor(group.items[0],b);group.items.forEach(x=>rows.push([i+1,nameOf(x),Object.entries(group.controls).map(([k,v])=>k+': '+v).join('; '),x.returns,x.cagr,x.drawdown,x.calmar,x.withinLimit,x.dominatedBy.join('; '),b?.name||'',b?.kind||'',b?.source||'',ref.from||'',ref.to||'',ref.returns??'',ref.available?x.returns-ref.returns:'',ref.cautions?.join('; ')||ref.reason||'',x.cautions.join('; ')]));});download('strategy-analysis.csv',root.Vault.csv(rows.map(row=>row.map(v=>typeof v==='number'?Number(v.toFixed(6)):v))),'text/csv;charset=utf-8');
  },'quiet');exportButton.disabled=all?!runs.length:!a.groups.length;target.append(exportButton,el('span',all?'Exports every run, status and setting in this comparison.':'Exports all comparison groups.','mini export-scope'));
  target.querySelectorAll('details[id]').forEach(d=>{d.open=openDetails.has(d.id);});const tableWrap=target.querySelector('.rank-table')?.parentElement;if(tableWrap)tableWrap.scrollLeft=tableState.scrollLeft||0;const columnList=target.querySelector('.column-options');if(columnList)columnList.scrollTop=tableState.columnScrollTop||0;if(focusId){const focused=document.getElementById(focusId);focused?.focus({preventScroll:true});if(focused?.classList.contains('column-grip')&&columnList){const r=focused.getBoundingClientRect(),bounds=columnList.getBoundingClientRect();if(r.top<bounds.top)columnList.scrollTop+=r.top-bounds.top;else if(r.bottom>bounds.bottom)columnList.scrollTop+=r.bottom-bounds.bottom;}}
 }
 draw();
}
root.VaultIntelligenceUI={render};
})(window);
