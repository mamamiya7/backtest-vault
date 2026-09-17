/* Original date-only range control. Existing setup inputs remain the source of truth. */
(function(root){
'use strict';
const instances=new WeakMap(),DAY=86400000;
let sequence=0;
const pad=n=>String(n).padStart(2,'0');
const makeDate=(year,month,day)=>{const d=new Date(0);d.setUTCFullYear(year,month,day);d.setUTCHours(0,0,0,0);return d;};
const iso=d=>String(d.getUTCFullYear()).padStart(4,'0')+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate());
const parse=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return null;const [y,m,d]=value.split('-').map(Number),date=makeDate(y,m-1,d);return y>=1&&y<=9999&&iso(date)===value?date:null;};
const today=()=>{const d=new Date();return makeDate(d.getFullYear(),d.getMonth(),d.getDate());};
const shiftMonth=(date,amount)=>{const first=makeDate(date.getUTCFullYear(),date.getUTCMonth()+amount,1),last=makeDate(first.getUTCFullYear(),first.getUTCMonth()+1,0);return makeDate(first.getUTCFullYear(),first.getUTCMonth(),Math.min(date.getUTCDate(),last.getUTCDate()));};
const inBounds=d=>d.getUTCFullYear()>=1&&d.getUTCFullYear()<=9999;
const fullDate=d=>new Intl.DateTimeFormat(undefined,{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(d);
const monthTitle=d=>new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric',timeZone:'UTC'}).format(d);

function attach({container,fromInput,toInput}){
 if(!container||!fromInput||!toInput)throw new TypeError('Date range requires a container and both date inputs.');
 const existing=instances.get(container);if(existing&&existing.fromInput===fromInput&&existing.toInput===toInput)return existing.api;if(existing)existing.api.destroy();
 const doc=container.ownerDocument,win=doc.defaultView||root,id='vault-date-range-'+(++sequence);
 const node=(tag,text,cls)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=(text,handler,cls)=>{const b=node('button',text,cls);b.type='button';b.addEventListener('click',handler);return b;};
 const trigger=button('Choose dates',open,'vault-date-range-trigger');trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');container.append(trigger);
 let dialog=null,draft=null,active='from',view=null,focusDate=null,calendarHost=null,status=null,error=null,apply=null,fromDraft=null,toDraft=null,monthSelect=null,yearSelect=null,previous=null,next=null,media=null,mediaListener=null,destroyed=false,previousFocus=null;
 const narrow=()=>Boolean(media&&media.matches);
 const available=(value,key=active)=>{const input=key==='from'?fromInput:toInput;return !(parse(input.min)&&value<input.min)&&!(parse(input.max)&&value>input.max);};
 const validation=()=>{
  const start=parse(draft.from),end=parse(draft.to);
  if(!start||!end)return 'Choose a start date and an end date.';
  if(start>=end)return 'The end date must be after the start date.';
  for(const [key,input] of [['from',fromInput],['to',toInput]]){
   if(parse(input.min)&&draft[key]<input.min)return (key==='from'?'Start':'End')+' date must be on or after '+input.min+'.';
   if(parse(input.max)&&draft[key]>input.max)return (key==='from'?'Start':'End')+' date must be on or before '+input.max+'.';
  }
  return '';
 };
 function sync(){
  fromDraft.value=draft.from;toDraft.value=draft.to;
  fromDraft.parentElement.classList.toggle('is-active',active==='from');toDraft.parentElement.classList.toggle('is-active',active==='to');
  status.textContent=active==='from'?'Choose a start date.':'Choose an end date.';
  const problem=validation();apply.disabled=Boolean(problem);error.textContent=problem;error.hidden=!problem;
 }
 function setView(date){view=makeDate(date.getUTCFullYear(),date.getUTCMonth(),1);}
 function visibleDate(date){const start=+view,end=+shiftMonth(view,narrow()?1:2);return +date>=start&&+date<end;}
 function choose(date){
  const value=iso(date);
  if(!available(value))return;
  if(active==='to'&&parse(draft.from)&&value<=draft.from&&!available(value,'from'))return;
  if(active==='from'||!parse(draft.from)||value<=draft.from){draft.from=value;draft.to='';active='to';}
  else{draft.to=value;active='from';}
  focusDate=value;sync();renderCalendars();focusDay();
 }
 function focusDay(){const day=calendarHost.querySelector('[data-date="'+focusDate+'"]');if(day)day.focus();}
 function calendarKeys(event,date){
  let moved=null;
  const offset=(date.getUTCDay()+6)%7;
  if(event.key==='ArrowLeft')moved=new Date(+date-DAY);
  if(event.key==='ArrowRight')moved=new Date(+date+DAY);
  if(event.key==='ArrowUp')moved=new Date(+date-7*DAY);
  if(event.key==='ArrowDown')moved=new Date(+date+7*DAY);
  if(event.key==='Home')moved=new Date(+date-offset*DAY);
  if(event.key==='End')moved=new Date(+date+(6-offset)*DAY);
  if(event.key==='PageUp')moved=shiftMonth(date,event.shiftKey?-12:-1);
  if(event.key==='PageDown')moved=shiftMonth(date,event.shiftKey?12:1);
  if(!moved)return;event.preventDefault();if(!inBounds(moved))return;
  focusDate=iso(moved);if(!visibleDate(moved))setView(moved);renderCalendars();focusDay();
 }
 function renderCalendars(){
  calendarHost.replaceChildren();monthSelect.value=String(view.getUTCMonth());
  const selectedYear=view.getUTCFullYear(),startYear=Math.min(1900,selectedYear),endYear=Math.max(today().getUTCFullYear()+10,selectedYear);
  yearSelect.replaceChildren();for(let y=startYear;y<=endYear;y++){const option=node('option',String(y));option.value=String(y);yearSelect.append(option);}yearSelect.value=String(selectedYear);
  previous.disabled=selectedYear===1&&view.getUTCMonth()===0;next.disabled=selectedYear===9999&&view.getUTCMonth()===11;
  const count=narrow()?1:2;
  if(!parse(focusDate)||!visibleDate(parse(focusDate)))focusDate=iso(view);
  for(let offset=0;offset<count;offset++){
   const date=shiftMonth(view,offset);if(!inBounds(date))continue;
   const section=node('section',undefined,'vault-date-range-month'),heading=node('h3',monthTitle(date));heading.id=id+'-month-'+offset;section.append(heading);
   const table=node('table',undefined,'vault-date-range-grid');table.setAttribute('role','grid');table.setAttribute('aria-labelledby',heading.id);table.setAttribute('aria-multiselectable','true');
   const head=node('thead'),headRow=node('tr');
   for(let day=0;day<7;day++){const sample=makeDate(2024,0,1+day),cell=node('th',new Intl.DateTimeFormat(undefined,{weekday:'short',timeZone:'UTC'}).format(sample));cell.scope='col';headRow.append(cell);}head.append(headRow);table.append(head);
   const body=node('tbody'),startOffset=(date.getUTCDay()+6)%7,days=makeDate(date.getUTCFullYear(),date.getUTCMonth()+1,0).getUTCDate();
   for(let row=0;row<Math.ceil((startOffset+days)/7);row++){
    const tr=node('tr');for(let col=0;col<7;col++){
     const day=row*7+col-startOffset+1,cell=node('td');cell.setAttribute('role','gridcell');
     if(day<1||day>days){cell.className='is-empty';cell.setAttribute('aria-disabled','true');tr.append(cell);continue;}
     const current=makeDate(date.getUTCFullYear(),date.getUTCMonth(),day),value=iso(current),start=value===draft.from,end=value===draft.to,selected=(start||end||Boolean(draft.from&&draft.to&&value>draft.from&&value<draft.to));
     cell.setAttribute('aria-selected',String(selected));if(selected)cell.classList.add('is-range');if(start)cell.classList.add('is-range-start');if(end)cell.classList.add('is-range-end');
     const b=button(String(day),()=>choose(current));b.dataset.date=value;b.tabIndex=value===focusDate?0:-1;b.setAttribute('aria-label',fullDate(current)+(start?', start date':'')+(end?', end date':''));if(!available(value))b.setAttribute('aria-disabled','true');
     if(value===iso(today()))b.setAttribute('aria-current','date');b.addEventListener('keydown',e=>calendarKeys(e,current));b.addEventListener('focus',()=>{for(const old of calendarHost.querySelectorAll('button[tabindex="0"]'))old.tabIndex=-1;b.tabIndex=0;focusDate=value;});cell.append(b);tr.append(cell);
    }body.append(tr);
   }table.append(body);section.append(table);calendarHost.append(section);
  }
 }
 function navigate(amount){const moved=shiftMonth(view,amount);if(!inBounds(moved))return;setView(moved);focusDate=iso(view);renderCalendars();}
 function preset(years){
  const end=parse(draft.to)||parse(toInput.value)||today(),start=shiftMonth(end,-12*years);if(!inBounds(start))return;
  draft={from:iso(start),to:iso(end)};focusDate=draft.from;active='from';setView(start);sync();renderCalendars();
 }
 function close(restoreFocus=true){
  if(!dialog)return;const current=dialog;dialog=null;
  if(media&&mediaListener){if(media.removeEventListener)media.removeEventListener('change',mediaListener);else if(media.removeListener)media.removeListener(mediaListener);}media=null;mediaListener=null;
  if(typeof current.close==='function'&&current.open)current.close();current.remove();trigger.setAttribute('aria-expanded','false');
  if(restoreFocus){const target=trigger.isConnected?trigger:previousFocus?.isConnected?previousFocus:null;if(target)target.focus();}
 }
 function commit(){
  if(validation()){sync();return;}if(fromInput.disabled||toInput.disabled){error.hidden=false;error.textContent='These dates are currently unavailable.';apply.disabled=true;return;}
  const saved={...draft};fromInput.value=saved.from;toInput.value=saved.to;close();
  fromInput.dispatchEvent(new win.Event('change',{bubbles:true}));toInput.dispatchEvent(new win.Event('change',{bubbles:true}));
 }
 function open(){
  if(destroyed||dialog||fromInput.disabled||toInput.disabled)return;
  previousFocus=doc.activeElement;draft={from:parse(fromInput.value)?fromInput.value:'',to:parse(toInput.value)?toInput.value:''};active='from';focusDate=draft.from||draft.to||iso(today());setView(parse(focusDate));
  media=typeof win.matchMedia==='function'?win.matchMedia('(max-width: 640px)'):null;
  dialog=node('dialog',undefined,'vault-date-range-dialog');dialog.id=id;dialog.setAttribute('aria-labelledby',id+'-title');dialog.setAttribute('aria-describedby',id+'-status');dialog.setAttribute('aria-modal','true');
  const header=node('header',undefined,'vault-date-range-header'),title=node('h2','Test dates');title.id=id+'-title';const dismiss=button('×',()=>close(),'vault-date-range-dismiss');dismiss.setAttribute('aria-label','Close date picker');header.append(title,dismiss);dialog.append(header);
  const fields=node('div',undefined,'vault-date-range-fields');
  for(const [key,text,input] of [['from','Start date',fromInput],['to','End date',toInput]]){
   const label=node('label',text),control=node('input');control.type='date';control.value=draft[key];control.setAttribute('aria-label',text);if(input.min)control.min=input.min;if(input.max)control.max=input.max;
   control.addEventListener('focus',()=>{active=key;sync();renderCalendars();});control.addEventListener('change',()=>{draft[key]=control.value;active=key;const date=parse(control.value);if(date){setView(date);focusDate=control.value;}sync();renderCalendars();});label.append(control);fields.append(label);if(key==='from')fromDraft=control;else toDraft=control;
  }dialog.append(fields);
  const presets=node('div',undefined,'vault-date-range-presets'),presetLabel=node('span','Ending on selected end date');presets.append(presetLabel);for(const years of [1,3,5])presets.append(button(years+'Y',()=>preset(years)));dialog.append(presets);
  const navigation=node('div',undefined,'vault-date-range-navigation');previous=button('‹',()=>navigate(-1));previous.setAttribute('aria-label','Previous month');next=button('›',()=>navigate(1));next.setAttribute('aria-label','Next month');monthSelect=node('select');monthSelect.setAttribute('aria-label','Month');
  for(let m=0;m<12;m++){const option=node('option',new Intl.DateTimeFormat(undefined,{month:'long',timeZone:'UTC'}).format(makeDate(2024,m,1)));option.value=String(m);monthSelect.append(option);}
  yearSelect=node('select');yearSelect.setAttribute('aria-label','Year');monthSelect.addEventListener('change',()=>{setView(makeDate(view.getUTCFullYear(),Number(monthSelect.value),1));focusDate=iso(view);renderCalendars();});yearSelect.addEventListener('change',()=>{setView(makeDate(Number(yearSelect.value),view.getUTCMonth(),1));focusDate=iso(view);renderCalendars();});navigation.append(previous,monthSelect,yearSelect,next);dialog.append(navigation);
  calendarHost=node('div',undefined,'vault-date-range-calendars');dialog.append(calendarHost);status=node('p',undefined,'vault-date-range-status');status.id=id+'-status';status.setAttribute('aria-live','polite');dialog.append(status);error=node('p',undefined,'vault-date-range-error');error.setAttribute('role','status');dialog.append(error);
  const footer=node('footer',undefined,'vault-date-range-actions');apply=button('Apply dates',commit,'vault-date-range-apply');footer.append(button('Cancel',()=>close()),apply);dialog.append(footer);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('close',()=>close());dialog.addEventListener('keydown',event=>{
   if(event.key==='Escape'){event.preventDefault();close();return;}
   if(event.key!=='Tab')return;const controls=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')].filter(n=>n.tabIndex!==-1&&!n.closest('[hidden]')),first=controls[0],last=controls[controls.length-1];
   if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first.focus();}
  });
  doc.body.append(dialog);sync();renderCalendars();if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');trigger.setAttribute('aria-expanded','true');trigger.setAttribute('aria-controls',id);focusDay();
  mediaListener=()=>{const focusedDay=doc.activeElement?.dataset?.date;renderCalendars();if(focusedDay)focusDay();};if(media){if(media.addEventListener)media.addEventListener('change',mediaListener);else if(media.addListener)media.addListener(mediaListener);}
 }
 const api={button:trigger,open,close:()=>close(),destroy:()=>{destroyed=true;close(false);trigger.remove();instances.delete(container);}};
 instances.set(container,{api,fromInput,toInput});return api;
}
root.VaultDateRange={attach};
})(typeof window!=='undefined'?window:globalThis);
