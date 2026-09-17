const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const source=fs.readFileSync(path.resolve(__dirname,'../dist/date-range.js'),'utf8');
function app({from='2024-01-10',to='2024-02-29',mobile=false,min='',max='',onApply,triggerLabel,triggerAriaLabel}={}){
 const dom=new JSDOM('<div id="range"><input id="from" type="date"><input id="to" type="date"></div>',{runScripts:'outside-only'}),w=dom.window,d=w.document;
 let mediaListener;const media={matches:mobile,addEventListener:(_type,fn)=>{mediaListener=fn;},removeEventListener:()=>{mediaListener=null;}};w.matchMedia=()=>media;
 const fromInput=d.querySelector('#from'),toInput=d.querySelector('#to');fromInput.value=from;toInput.value=to;fromInput.min=min;toInput.max=max;
 w.eval(source);const api=w.VaultDateRange.attach({container:d.querySelector('#range'),fromInput,toInput,onApply,triggerLabel,triggerAriaLabel});
 const find=text=>{const b=[...d.querySelectorAll('button')].find(n=>n.textContent===text);assert.ok(b,'Button: '+text);return b;};
 const key=(value,shiftKey=false)=>d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:value,shiftKey,bubbles:true,cancelable:true}));
 const edit=(label,value)=>{const input=d.querySelector('input[aria-label="'+label+'"]');input.focus();input.value=value;input.dispatchEvent(new w.Event('change',{bubbles:true}));};
 const choose=value=>{const b=d.querySelector('[data-date="'+value+'"]');assert.ok(b,'Date: '+value);b.click();};
 return {dom,w,d,api,fromInput,toInput,find,key,edit,choose,resize:mobile=>{media.matches=mobile;if(mediaListener)mediaListener();},dispose:()=>{api.destroy();dom.window.close();}};
}

// The entry is the actual range. Host changes and unavailable inputs stay in sync.
{
 const a=app();try{
  assert.equal(a.api.button.textContent,'10 Jan 2024 → 29 Feb 2024');assert.match(a.api.button.getAttribute('aria-label'),/^Edit date range:/);assert.ok(!a.d.body.textContent.includes('Choose dates'));
  a.fromInput.value='2025-01-01';a.toInput.value='2025-12-31';a.api.refresh();assert.equal(a.api.button.textContent,'1 Jan 2025 → 31 Dec 2025');
  a.fromInput.value='2025-02-01';a.fromInput.dispatchEvent(new a.w.Event('input'));assert.equal(a.api.button.textContent,'1 Feb 2025 → 31 Dec 2025');
  a.toInput.value='2025-11-30';a.toInput.dispatchEvent(new a.w.Event('change'));assert.equal(a.api.button.textContent,'1 Feb 2025 → 30 Nov 2025');
  a.toInput.disabled=true;a.api.refresh();assert.equal(a.api.button.disabled,true);a.api.open();assert.equal(a.d.querySelector('dialog'),null);
  a.toInput.disabled=false;a.fromInput.disabled=true;a.api.refresh();assert.equal(a.api.button.disabled,true);
  a.fromInput.disabled=false;a.api.refresh();assert.equal(a.api.button.disabled,false);a.api.open();assert.ok(a.d.querySelector('dialog'));a.api.close();
  a.fromInput.value='';a.toInput.value='';a.api.refresh();assert.equal(a.api.button.textContent,'Select date range');assert.equal(a.api.button.getAttribute('aria-label'),'Select date range');
  a.fromInput.value='2025-01-01';a.api.refresh();assert.equal(a.api.button.textContent,'1 Jan 2025 → Select end date');
  const removed=[];for(const input of [a.fromInput,a.toInput]){const remove=input.removeEventListener.bind(input);input.removeEventListener=(type,fn,...options)=>{removed.push(input.id+':'+type);return remove(type,fn,...options);};}
  a.api.destroy();assert.deepEqual(removed,['from:input','from:change','to:input','to:change']);a.api.refresh();
 }finally{a.dispose();}
}
// A host may use the same calendar to add another range; it is added only after Apply.
{
 const events=[],a=app({from:'',to:'',triggerLabel:'Test values',triggerAriaLabel:'Add another date range to test',onApply:values=>events.push(['apply',values.from,values.to,Boolean(a.d.querySelector('dialog'))])});try{
  for(const input of [a.fromInput,a.toInput])input.addEventListener('change',()=>events.push([input.id,a.fromInput.value,a.toInput.value,Boolean(a.d.querySelector('dialog'))]));
  assert.equal(a.api.button.textContent,'Test values');assert.equal(a.api.button.getAttribute('aria-label'),'Add another date range to test');
  a.api.open();a.edit('Start date','2025-01-01');a.edit('End date','2025-12-31');a.find('Cancel').click();assert.deepEqual(events,[]);assert.equal(a.fromInput.value,'');
  a.api.open();a.edit('Start date','2025-01-01');a.edit('End date','2025-12-31');a.find('Apply dates').click();
  assert.deepEqual(events,[['from','2025-01-01','2025-12-31',false],['to','2025-01-01','2025-12-31',false],['apply','2025-01-01','2025-12-31',false]]);assert.equal(a.api.button.textContent,'Test values');
 }finally{a.dispose();}
}

// Detached controls cannot commit an abandoned calendar or a subsequently reopened draft.
{
 let calls=0;const a=app({onApply:()=>calls++});try{
  a.api.open();a.edit('Start date','2025-01-01');a.edit('End date','2025-12-31');const canceledApply=a.find('Apply dates');a.find('Cancel').click();canceledApply.click();
  assert.equal(calls,0,'A canceled calendar cannot invoke its old callback');assert.equal(a.fromInput.value,'2024-01-10');assert.equal(a.toInput.value,'2024-02-29');
  a.api.open();a.edit('Start date','2026-01-01');a.edit('End date','2026-12-31');canceledApply.click();assert.equal(calls,0,'An old Apply cannot commit a newly opened calendar');assert.ok(a.d.querySelector('dialog'));assert.equal(a.fromInput.value,'2024-01-10');const detachedApply=a.find('Apply dates');a.api.destroy();detachedApply.click();
  assert.equal(calls,0,'A destroyed calendar cannot invoke its old callback');assert.equal(a.fromInput.value,'2024-01-10');assert.equal(a.toInput.value,'2024-02-29');assert.equal(a.d.querySelector('dialog'),null);
 }finally{a.dispose();}
}
// Calendar selection stays a draft; Apply commits both values before notifying the host.
{
 const a=app(),{d,api,fromInput,toInput}=a;try{
  assert.equal(d.querySelectorAll('#range input').length,2);assert.equal(a.w.VaultDateRange.attach({container:d.querySelector('#range'),fromInput,toInput}),api,'Duplicate attachment is idempotent');
  api.button.click();assert.ok(d.querySelector('dialog[open]'));assert.equal(d.querySelectorAll('.vault-date-range-month').length,2);assert.equal(d.activeElement.dataset.date,'2024-01-10');
  a.choose('2024-01-15');assert.equal(a.find('Apply dates').disabled,true);a.choose('2024-02-20');assert.equal(a.find('Apply dates').disabled,false);
  assert.equal(fromInput.value,'2024-01-10');assert.equal(toInput.value,'2024-02-29');
  const events=[];for(const input of [fromInput,toInput])input.addEventListener('change',()=>events.push([input.id,fromInput.value,toInput.value,Boolean(d.querySelector('dialog'))]));
  a.find('Apply dates').click();assert.equal(d.querySelector('dialog'),null);assert.equal(d.activeElement,api.button);assert.deepEqual(events,[['from','2024-01-15','2024-02-20',false],['to','2024-01-15','2024-02-20',false]]);
  api.open();a.choose('2024-01-18');a.find('Cancel').click();assert.equal(fromInput.value,'2024-01-15');assert.equal(toInput.value,'2024-02-20');assert.equal(events.length,2);
  api.open();d.querySelector('dialog').dispatchEvent(new a.w.Event('cancel',{cancelable:true}));assert.equal(d.querySelector('dialog'),null);assert.equal(d.activeElement,api.button);
  api.open();a.key('Escape');assert.equal(d.querySelector('dialog'),null);assert.equal(d.activeElement,api.button);
 }finally{a.dispose();}
}
// Leap-day presets are anchored to the chosen end date and cannot spill into March.
{
 const a=app({from:'2020-01-01',to:'2024-02-29'});try{
  a.api.open();a.find('1Y').click();assert.equal(a.d.querySelector('input[aria-label="Start date"]').value,'2023-02-28');assert.equal(a.d.querySelector('input[aria-label="End date"]').value,'2024-02-29');
  a.find('3Y').click();assert.equal(a.d.querySelector('input[aria-label="Start date"]').value,'2021-02-28');
  a.find('5Y').click();assert.equal(a.d.querySelector('input[aria-label="Start date"]').value,'2019-02-28');
  a.edit('End date','2025-03-31');a.find('1Y').click();assert.equal(a.d.querySelector('input[aria-label="Start date"]').value,'2024-03-31');
  a.find('Apply dates').click();assert.equal(a.fromInput.value,'2024-03-31');assert.equal(a.toInput.value,'2025-03-31');
 }finally{a.dispose();}
}
// Dates are strict, input boundaries are enforced, and calendar clicks cannot bypass them.
{
 const a=app({min:'2024-01-10',max:'2024-03-01'});try{
  a.api.open();const tooEarly=a.d.querySelector('[data-date="2024-01-09"]');assert.equal(tooEarly.getAttribute('aria-disabled'),'true');tooEarly.click();assert.equal(a.d.querySelector('input[aria-label="Start date"]').value,'2024-01-10');
  a.edit('Start date','2024-02-29');a.edit('End date','2024-02-29');assert.equal(a.find('Apply dates').disabled,true);assert.match(a.d.querySelector('.vault-date-range-error').textContent,/after/);
  a.edit('End date','2023-02-29');assert.equal(a.find('Apply dates').disabled,true,'Invalid leap date is not accepted');
  a.edit('Start date','2024-01-09');a.edit('End date','2024-02-20');assert.equal(a.find('Apply dates').disabled,true);assert.match(a.d.querySelector('.vault-date-range-error').textContent,/2024-01-10/);
  a.edit('Start date','2024-01-15');a.edit('End date','2024-03-02');assert.equal(a.find('Apply dates').disabled,true);assert.match(a.d.querySelector('.vault-date-range-error').textContent,/2024-03-01/);
  a.edit('End date','2024-03-01');assert.equal(a.find('Apply dates').disabled,false);a.toInput.disabled=true;a.find('Apply dates').click();assert.ok(a.d.querySelector('dialog'));assert.equal(a.fromInput.value,'2024-01-10');assert.match(a.d.querySelector('.vault-date-range-error').textContent,/unavailable/);
 }finally{a.dispose();}
}
// Arrow/week/month/year navigation crosses month and leap-year boundaries without selecting dates.
{
 const a=app({from:'2024-01-31',to:'2024-03-31'});try{
  a.api.open();a.key('PageDown');assert.equal(a.d.activeElement.dataset.date,'2024-02-29');a.key('PageDown',true);assert.equal(a.d.activeElement.dataset.date,'2025-02-28');
  a.key('PageUp',true);assert.equal(a.d.activeElement.dataset.date,'2024-02-28');a.key('ArrowRight');assert.equal(a.d.activeElement.dataset.date,'2024-02-29');a.key('ArrowDown');assert.equal(a.d.activeElement.dataset.date,'2024-03-07');
  a.key('Home');assert.equal(a.d.activeElement.dataset.date,'2024-03-04');a.key('End');assert.equal(a.d.activeElement.dataset.date,'2024-03-10');a.key('ArrowUp');assert.equal(a.d.activeElement.dataset.date,'2024-03-03');a.key('ArrowLeft');assert.equal(a.d.activeElement.dataset.date,'2024-03-02');
  assert.equal(a.d.querySelectorAll('.vault-date-range-grid button[tabindex="0"]').length,1);assert.equal(a.fromInput.value,'2024-01-31');
  const month=a.d.querySelector('select[aria-label="Month"]'),year=a.d.querySelector('select[aria-label="Year"]');month.value='11';month.dispatchEvent(new a.w.Event('change'));year.value='2020';year.dispatchEvent(new a.w.Event('change'));assert.ok(a.d.querySelector('[data-date="2020-12-01"]'));
  a.d.querySelector('[aria-label="Close date picker"]').focus();a.key('Tab',true);assert.equal(a.d.activeElement,a.find('Apply dates'));a.key('Tab');assert.equal(a.d.activeElement.getAttribute('aria-label'),'Close date picker');
 }finally{a.dispose();}
}
// The mobile calendar has one month, resizing preserves a valid focused calendar day, and cleanup is complete.
{
 const a=app({mobile:true});try{
  a.api.open();assert.equal(a.d.querySelectorAll('.vault-date-range-month').length,1);a.key('PageDown');assert.equal(a.d.activeElement.dataset.date,'2024-02-10');
  a.resize(false);assert.equal(a.d.querySelectorAll('.vault-date-range-month').length,2);assert.equal(a.d.activeElement.dataset.date,'2024-02-10');a.resize(true);assert.equal(a.d.querySelectorAll('.vault-date-range-month').length,1);
  a.api.destroy();assert.equal(a.d.querySelector('dialog'),null);assert.equal(a.d.querySelector('.vault-date-range-trigger'),null);a.api.open();assert.equal(a.d.querySelector('dialog'),null);
 }finally{a.dispose();}
}
console.log('Date range picker: range entry/sync, draft/commit, leap dates, bounds, keyboard, focus and mobile checks passed.');
