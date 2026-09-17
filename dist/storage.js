window.VaultStore = (() => {
  // Select the isolated demo branch before even opening durable storage.
  const demo = new URLSearchParams(location.search).get('demo') === '1';
  if (demo) {
    let memory = window.VaultDemo.create(), benchmarks = window.VaultDemo.benchmarks?.() || [], tablePreferences = null, experiments=[];
    const clone = value => JSON.parse(JSON.stringify(value));
    const removeExperiment=async id=>{if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,120}$/.test(id))throw Error('Invalid study.');const i=experiments.findIndex(e=>e.id===id);if(i<0)return false;const reason=window.VaultExperiments.deletionReason(experiments[i]);if(reason)throw Error(reason);experiments.splice(i,1);return true;};
    return {demo:true,allExperiments:async()=>clone(experiments),putExperiment:async e=>{window.VaultExperiments.validate(e);const i=experiments.findIndex(x=>x.id===e.id);if(i<0)experiments.push(clone(e));else experiments[i]=clone(e);},removeExperiment,all:async()=>clone(memory),put:async run=>{const i=memory.findIndex(r=>r.id===run.id);if(i<0)memory.push(clone(run));else memory[i]=clone(run);},allBenchmarks:async()=>clone(benchmarks),putBenchmark:async()=>{throw Error('Benchmark import is disabled in demo mode.');},getTablePreferences:async()=>clone(tablePreferences),putTablePreferences:async value=>{tablePreferences=clone(value);},reset:async()=>{memory=window.VaultDemo.create();benchmarks=window.VaultDemo.benchmarks?.()||[];tablePreferences=null;experiments=[];}};
  }
  const chromeStore = typeof chrome !== 'undefined' && chrome.storage?.local;
  const database = chromeStore ? null : new Promise((resolve,reject) => {
    const request = indexedDB.open('definedge-backtest-vault',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('runs',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
  async function all() {
    if(chromeStore) return Object.entries(await chromeStore.get(null)).filter(([k])=>k.startsWith('run:')).map(([,v])=>v);
    const db=await database;
    return new Promise((resolve,reject)=>{const q=db.transaction('runs').objectStore('runs').getAll();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
  }
  async function put(run) {
    if(chromeStore) return chromeStore.set({['run:'+run.id]:run});
    const db=await database;
    return new Promise((resolve,reject)=>{const tx=db.transaction('runs','readwrite');tx.objectStore('runs').put(run);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
  }
  // A separate database keeps existing run storage and old backups unchanged.
  let benchmarkDatabase;
  function benchmarkDB(){return benchmarkDatabase ||= new Promise((resolve,reject)=>{const q=indexedDB.open('definedge-backtest-vault-benchmarks',1);q.onupgradeneeded=()=>q.result.createObjectStore('benchmarks',{keyPath:'id'});q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
  async function allBenchmarks(){if(chromeStore)return Object.entries(await chromeStore.get(null)).filter(([k])=>k.startsWith('benchmark:')).map(([,v])=>v);const db=await benchmarkDB();return new Promise((resolve,reject)=>{const q=db.transaction('benchmarks').objectStore('benchmarks').getAll();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
  async function putBenchmark(b){if(chromeStore)return chromeStore.set({['benchmark:'+b.id]:b});const db=await benchmarkDB();return new Promise((resolve,reject)=>{const tx=db.transaction('benchmarks','readwrite');tx.objectStore('benchmarks').put(b);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
  // Appearance only: excluded from research records and JSON backups.
  const preferencesKey='ui:strategy-table:v1';
  async function getTablePreferences(){try{return chromeStore?(await chromeStore.get(preferencesKey))[preferencesKey]||null:JSON.parse(localStorage.getItem(preferencesKey)||'null');}catch{return null;}}
  async function putTablePreferences(value){if(chromeStore)return chromeStore.set({[preferencesKey]:value});localStorage.setItem(preferencesKey,JSON.stringify(value));}
  let experimentDatabase;
  function experimentDB(){return experimentDatabase ||= new Promise((resolve,reject)=>{const q=indexedDB.open('definedge-backtest-vault-experiments',1);q.onupgradeneeded=()=>q.result.createObjectStore('experiments',{keyPath:'id'});q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
  async function allExperiments(){if(chromeStore)return Object.entries(await chromeStore.get(null)).filter(([k])=>k.startsWith('experiment:')).map(([,v])=>v);const db=await experimentDB();return new Promise((resolve,reject)=>{const q=db.transaction('experiments').objectStore('experiments').getAll();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
  async function putExperiment(e){window.VaultExperiments.validate(e);if(chromeStore)return chromeStore.set({['experiment:'+e.id]:e});const db=await experimentDB();return new Promise((resolve,reject)=>{const tx=db.transaction('experiments','readwrite');tx.objectStore('experiments').put(e);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
  async function removeExperiment(id){
    if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,120}$/.test(id))throw Error('Invalid study.');
    if(chromeStore){
      if(!chrome.runtime?.sendMessage)throw Error('Reopen the installed Vault to delete this study.');
      const result=await chrome.runtime.sendMessage({type:'vault-experiment',action:'delete',id});
      if(!result?.ok)throw Error(result?.error||'The study could not be deleted.');
      return result.deleted;
    }
    const db=await experimentDB();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('experiments','readwrite'),store=tx.objectStore('experiments'),q=store.get(id);let removed=false,error;
      // Read and remove in one transaction so another page's newer active
      // state cannot be overwritten by the confirmation dialog's snapshot.
      q.onsuccess=()=>{if(!q.result)return;const reason=window.VaultExperiments.deletionReason(q.result);if(reason){error=Error(reason);tx.abort();return;}store.delete(id);removed=true;};
      tx.oncomplete=()=>resolve(removed);tx.onerror=tx.onabort=()=>reject(error||tx.error||Error('The study could not be deleted.'));
    });
  }
  return {all,put,allBenchmarks,putBenchmark,getTablePreferences,putTablePreferences,allExperiments,putExperiment,removeExperiment};
})();
