/* One local RZone DOM executor. Only explicit experiment commands can start it. */
(() => {
'use strict';
const C=window.VaultCapture,E=window.VaultExperiments,V=window.Vault;
if(!C||!E||typeof chrome==='undefined'||!chrome.runtime?.sendMessage)return;
const session=crypto.randomUUID();let active=false,failed=false,interrupted=false,polling=false;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const send=async data=>{const r=await chrome.runtime.sendMessage({type:'vault-experiment',session,...data});if(!r?.ok)throw Error(r?.error||'Extension disconnected.');return r;};
const inputs=p=>[...p.querySelectorAll('input,select,textarea')].filter(e=>C.visible(e)&&!['password','hidden','submit','button'].includes(e.type)&&!e.closest('[role="tab"]'));
const popups=()=>[...document.querySelectorAll('.popupContent')].filter(C.visible);
function button(p,name){const matches=[...p.querySelectorAll('button')].filter(e=>C.visible(e)&&!e.disabled&&name.test(V.clean(e.textContent)));if(matches.length!==1)throw Error('Cannot identify the '+name+' control.');return matches[0];}
function check(){if(interrupted)throw Error('The source tab was changed manually. Review the current trial.');if(!C.main())throw Error('RZone Momentum page is unavailable.');if(C.popup('Error'))throw Error('Definedge rejected the submitted settings.');}
async function wait(checkValue,deadline,message){while(Date.now()<deadline){check();const v=checkValue();if(v)return v;await delay(250);}throw Error(message);}
async function close(p){const controls=[...p.querySelectorAll('.custom-dialog-header .close-buton')].filter(C.visible);if(controls.length!==1)throw Error('Cannot close the completed experiment report. Close it manually before continuing.');controls[0].click();await wait(()=>!C.visible(p),Date.now()+5000,'Source dialog did not close.');}
async function apply(p,e,t,stage){
 const expected=E.fields(E.expected(e,t),stage),current=C.fields(p),allowed=e.dimensions.filter(d=>d.stage===stage).map(d=>d.index);
 if(stage==='execution'&&t.period)allowed.push(1,2);
 // Validate fixed controls before changing anything. Never silently restore another strategy.
 const fixed=E.clone(expected);for(const i of allowed)if(current[i])fixed[i]={...fixed[i],value:current[i].value,checked:current[i].checked};E.verify(fixed,current);
 for(const i of allowed){check();const f=expected[i],nodes=inputs(p),node=nodes[i];if(!node||node.disabled)throw Error('Planned setting is disabled: '+f.label);if(f.type==='checkbox'){if(node.checked!==f.checked)node.click();}else if(node.tagName==='SELECT'){const matches=[...node.options].filter(o=>V.clean(o.textContent)===String(f.value));if(matches.length!==1)throw Error('Planned dropdown value is unavailable.');node.value=matches[0].value;node.dispatchEvent(new Event('change',{bubbles:true}));}else{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(node,String(f.value));node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));node.blur();}await delay(150);}
 E.verify(expected,C.fields(p));
}
async function run(job){
 const {experiment:e,trial:t,token}=job,common={id:e.id,trialId:t.id,token};
 const checkpoint=stage=>send({...common,action:'checkpoint',stage});
 active=true;interrupted=false;const deadline=Date.now()+e.timeoutMinutes*60000;
 try{
  if(C.pending())throw Error('Recover the pending manual save before starting an experiment.');
  if(popups().length)throw Error('Close existing RZone dialogs before starting. Your open report was left intact.');
  C.status(e.name+' · Trial '+t.ordinal+' of '+e.trials.length);
  await apply(C.main(),e,t,'momentum');
  button(C.main(),/^BackTest$/i).click();
  const setup=await wait(()=>C.popup('Momentum Trading BackTest'),Math.min(deadline,Date.now()+10000),'Momentum settings did not open.');
  await apply(setup,e,t,'execution');
  E.verify(E.fields(E.expected(e,t),'momentum'),C.fields(C.main()));
  await checkpoint('strategy-submitting'); // Persist the intent before a source side effect.
  const previous=C.getStrategy()?.id;button(setup,/^Backtest$/i).click();
  await wait(()=>{C.monitor();const s=C.getStrategy();return s?.id!==previous&&s?.completed;},deadline,'Momentum completion could not be confirmed.');
  await checkpoint('strategy-complete');
  if(C.visible(setup))await close(setup);
  button(C.main(),/^Portfolio Testing$/i).click();
  const portfolio=await wait(()=>C.popup('Portfolio Backtesting'),Math.min(deadline,Date.now()+10000),'Portfolio settings did not open.');
  await apply(portfolio,e,t,'portfolio');
  E.verify(E.fields(E.expected(e,t),'momentum'),C.fields(C.main()));
  await checkpoint('portfolio-submitting');button(portfolio,/^Backtest$/i).click();
  const report=await wait(()=>C.popup('Portfolio Backtesting Report'),deadline,'Portfolio report did not arrive.');
  C.monitor();await checkpoint('capturing');
  await C.capture({strict:true,runId:t.runId,name:e.name+' · '+t.phase+' '+t.ordinal,experiment:{id:e.id,trialId:t.id,phase:t.phase},verify:r=>{check();for(const stage of ['momentum','execution','portfolio'])E.verify(E.fields(E.expected(e,t),stage),E.fields(r,stage));}});
  // Close only this trial's saved report. A failed close stops further submissions.
  await close(report);if(C.visible(portfolio))await close(portfolio);
  await checkpoint('saved');
  C.status('Trial '+t.ordinal+' saved. Experiment queue will continue in this tab.');
 }catch(error){failed=true;C.status('Experiment stopped: '+error.message);try{await send({...common,action:'fail',error:error.message});}catch{/* Durable lease prevents replay if the worker is unreachable. */}}
 finally{active=false;}
}
document.addEventListener('click',event=>{if(active&&event.isTrusted&&!C.host.contains(event.target))interrupted=true;},true);
document.addEventListener('input',event=>{if(active&&event.isTrusted&&!C.host.contains(event.target))interrupted=true;},true);
async function tick(){if(polling)return;polling=true;try{const r=await send({action:'hello',ready:!!C.main()&&!failed&&!C.pending()&&!popups().length,chart:C.fields(C.main())[0]?.value,failed});if(r.id&&!active&&!failed){const job=await send({action:'claim',id:r.id});if(job.trial)void run(job);}}catch{/* Reload invalidates the document; do not keep sending or submit again. */failed=true;}finally{polling=false;}}
window.VaultRunner={get active(){return active;},apply};
const timer=setInterval(tick,3000);void tick();window.addEventListener('pagehide',()=>{clearInterval(timer);interrupted=true;},{once:true});
})();
