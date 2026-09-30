'use strict';
const {Buffer}=require('node:buffer');
const {createHandler}=require('./server.cjs');
// A Fetch transport for the same account handler; SQL/auth/payment checks stay shared.
function createEdgeHandler({provider,origins=[],clock,mount='/vault-accounts',ready=false}={}){
 if(!/^\/[a-z][a-z0-9-]{0,62}$/.test(mount))throw Error('Invalid function mount.');
 const handle=createHandler({provider,origins,clock});
 return async(request,info)=>{
  const url=new URL(request.url),prefixes=['/functions/v1'+mount,mount];
  const prefix=prefixes.find(p=>url.pathname===p||url.pathname.startsWith(p+'/'));
  if(!prefix)return new Response(JSON.stringify({error:'Unknown endpoint.'}),{status:404,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  const route=url.pathname.slice(prefix.length)||'/';
  const origin=request.headers.get('origin');
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  if(origin&&!origins.includes(origin))return new Response(JSON.stringify({error:'This origin is not allowed.'}),{status:403,headers});
  if(origin){headers['Access-Control-Allow-Origin']=origin;headers.Vary='Origin';}
  if(route==='/health'&&request.method==='GET')return new Response(JSON.stringify({ok:true,ready}),{headers});
  // Keep the deployed service closed until sender, exact origins and billing acceptance are configured.
  if(!ready&&request.method!=='OPTIONS')return new Response(JSON.stringify({error:'Public account access is not enabled yet. Email delivery setup is pending.'}),{status:503,headers});
  const req={url:route+url.search,method:request.method,headers:Object.fromEntries(request.headers),socket:{remoteAddress:info?.remoteAddr?.hostname||'edge'}};
  req[Symbol.asyncIterator]=async function*(){if(!request.body)return;const reader=request.body.getReader();try{for(;;){const part=await reader.read();if(part.done)break;yield Buffer.from(part.value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}};
  const outgoing=new Headers(headers);let status=200,body=null;
  const res={setHeader:(name,value)=>outgoing.set(name,value),writeHead:(value,values)=>{status=value;for(const [name,v]of Object.entries(values||{}))outgoing.set(name,v);},end:value=>{body=value??null;}};
  await handle(req,res);
  return new Response(body,{status,headers:outgoing});
 };
}
module.exports={createEdgeHandler};
