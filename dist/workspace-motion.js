/* Original, dependency-free interaction effects. No research values are interpolated. */
(function(root){
'use strict';
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function create(scope){
 const media=root.matchMedia?.('(prefers-reduced-motion: reduce)'),seen=new Set(),pending=new Set(),fractions=new Map(),animations=new Set();let initialized=false,view=null;
 const reduced=()=>media?.matches===true;
 const animate=(element,frames,options)=>{if(reduced()||typeof element.animate!=='function')return;const a=element.animate(frames,options);animations.add(a);a.onfinish=a.oncancel=()=>animations.delete(a);};
 const cancel=()=>{if(reduced()){for(const a of animations)a.cancel();animations.clear();}};media?.addEventListener?.('change',cancel);
 const key=(e,t)=>JSON.stringify([e.id,t.id,t.runId]);
 function observe(experiments){for(const e of experiments)for(const t of e.trials)if(t.status==='saved'&&t.runId){const k=key(e,t);if(initialized&&!seen.has(k))pending.add(k);seen.add(k);}initialized=true;}
 function enter(element,id){if(view===id)return;view=id;animate(element,[{opacity:.45,transform:'translateY(5px)',filter:'blur(2px)'},{opacity:1,transform:'none',filter:'blur(0)'}],{duration:200,easing:'ease-out'});}
 function progress(e,sample){
  const saved=e.trials.filter(t=>t.status==='saved').length,total=e.trials.length,fraction=total?saved/total:0,previous=fractions.get(e.id);fractions.set(e.id,fraction);
  const wrap=node('div',undefined,'study-progress'),ring=node('div',undefined,'study-progress-ring');wrap.dataset.state=e.status;
  ring.setAttribute('role','progressbar');ring.setAttribute('aria-label',sample?'Generated sample results':'Saved experiment trials');ring.setAttribute('aria-valuemin','0');ring.setAttribute('aria-valuemax',String(total||1));ring.setAttribute('aria-valuenow',String(saved));ring.setAttribute('aria-valuetext',saved+' of '+total+(sample?' sample results':' saved')+' · '+e.status.replaceAll('-',' '));
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 120 120');svg.setAttribute('aria-hidden','true');
  for(const name of ['study-progress-track','study-progress-value']){const circle=document.createElementNS(svg.namespaceURI,'circle');for(const [k,v] of Object.entries({cx:60,cy:60,r:52,fill:'none','stroke-width':6,pathLength:100,class:name}))circle.setAttribute(k,String(v));if(name.endsWith('value')){circle.style.strokeDasharray='100';circle.style.strokeDashoffset=String(100-fraction*100);if(previous!==undefined&&previous!==fraction)animate(circle,[{strokeDashoffset:String(100-previous*100)},{strokeDashoffset:String(100-fraction*100)}],{duration:450,easing:'ease-out'});}svg.append(circle);}
  const caption=node('div',undefined,'study-progress-count');caption.setAttribute('aria-hidden','true');caption.append(node('strong',saved+' / '+total),node('span',sample?'generated':'saved'));ring.append(svg,caption);wrap.append(ring);
  const skipped=e.trials.filter(t=>t.status==='skipped').length;if(skipped)wrap.append(node('small',skipped+' skipped'));
  return wrap;
 }
 function savedRow(row,e,t){
  if(pending.delete(key(e,t)))animate(row,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:280,easing:'ease-out'});
 }
 const pointer=event=>{if(reduced()||event.pointerType==='touch')return;const card=event.target.closest?.('.study-card');if(!card||!scope.contains(card))return;const box=card.getBoundingClientRect();card.style.setProperty('--spot-x',(event.clientX-box.left)+'px');card.style.setProperty('--spot-y',(event.clientY-box.top)+'px');};
 scope.addEventListener('pointermove',pointer);
 return {observe,enter,progress,savedRow,destroy(){scope.removeEventListener('pointermove',pointer);media?.removeEventListener?.('change',cancel);for(const a of animations)a.cancel();animations.clear();}};
}
root.VaultWorkspaceMotion={create};
})(window);
