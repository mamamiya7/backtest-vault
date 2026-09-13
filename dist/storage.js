window.VaultStore = (() => {
  // Select the isolated demo branch before even opening durable storage.
  const demo = new URLSearchParams(location.search).get('demo') === '1';
  if (demo) {
    let memory = window.VaultDemo.create(), benchmarks = window.VaultDemo.benchmarks?.() || [], tablePreferences = null;
    const clone = value => JSON.parse(JSON.stringify(value));
    return {demo:true,all:async()=>clone(memory),put:async run=>{const i=memory.findIndex(r=>r.id===run.id);if(i<0)memory.push(clone(run));else memory[i]=clone(run);},allBenchmarks:async()=>clone(benchmarks),putBenchmark:async()=>{throw Error('Benchmark import is disabled in demo mode.');},getTablePreferences:async()=>clone(tablePreferences),putTablePreferences:async value=>{tablePreferences=clone(value);},reset:async()=>{memory=window.VaultDemo.create();benchmarks=window.VaultDemo.benchmarks?.()||[];tablePreferences=null;}};
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
  return {all,put,allBenchmarks,putBenchmark,getTablePreferences,putTablePreferences};
})();
