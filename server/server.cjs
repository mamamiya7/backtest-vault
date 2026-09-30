'use strict';
const http=require('node:http'),crypto=require('node:crypto');
function createHandler({provider,origins=[],clock=()=>Date.now()}={}){
 const attempts=new Map();function rate(key,limit){const now=clock(),old=attempts.get(key),s=old&&now-old.at<60000?old:{at:now,count:0};if(++s.count>limit)throw Object.assign(Error('Too many requests. Try again shortly.'),{status:429});attempts.set(key,s);if(attempts.size>10000)for(const [k,v]of attempts)if(now-v.at>=60000)attempts.delete(k);}
 const validId=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(s);
 const email=s=>typeof s==='string'&&s.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
 return async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  try{
   const origin=req.headers.origin;if(origin&&!origins.includes(origin))return send(403,{error:'This origin is not allowed.'});if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
   if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST');res.writeHead(204);return res.end();}
   const path=new URL(req.url,'http://localhost').pathname;if(path==='/health'&&req.method==='GET')return send(200,{ok:true});
   if(!['GET','POST'].includes(req.method))return send(405,{error:'Method not allowed.'});
   let bytes=Buffer.alloc(0);for await(const part of req){bytes=Buffer.concat([bytes,part]);if(bytes.length>65536)return send(413,{error:'Request is too large.'});}
   if(path==='/billing/webhook'&&req.method==='POST')return send(200,await provider.webhook(bytes,req.headers['x-razorpay-signature'],req.headers['x-razorpay-event-id']));
   if(req.method==='POST'&&!String(req.headers['content-type']||'').startsWith('application/json'))return send(415,{error:'Use JSON requests.'});
   const body=bytes.length?JSON.parse(bytes):{};rate('ip:'+req.socket.remoteAddress,120);
   if(path==='/auth/otp'&&req.method==='POST'){if(!email(body.email))return send(400,{error:'Enter a valid email address.'});rate('email:'+crypto.createHash('sha256').update(body.email.toLowerCase()).digest('hex'),3);return send(200,await provider.sendCode(body.email.toLowerCase()));}
   if(path==='/auth/verify'&&req.method==='POST'){if(!email(body.email)||!/^\d{6,10}$/.test(body.token||''))return send(400,{error:'Enter the email code.'});rate('verify:'+req.socket.remoteAddress,10);return send(200,await provider.verify(body.email.toLowerCase(),body.token));}
   if(path==='/auth/refresh'&&req.method==='POST'){if(typeof body.refresh_token!=='string'||body.refresh_token.length>4000)return send(400,{error:'Invalid session.'});return send(200,await provider.refresh(body.refresh_token));}
   const token=/^Bearer ([^\s]{1,6000})$/.exec(req.headers.authorization||'')?.[1];if(!token)return send(401,{error:'Sign in with your email.'});const u=await provider.user(token);rate('user:'+u.id,120);
   if(path==='/account'&&req.method==='GET')return send(200,await provider.account(u));
   if(path==='/runs/pending'&&req.method==='GET')return send(200,await provider.pending(u));
   if(path==='/auth/logout'&&req.method==='POST')return send(200,await provider.logout(token));
   if(path==='/runs/reserve'&&req.method==='POST'){if(!validId(body.runId))return send(400,{error:'Invalid run identity.'});return send(200,await provider.reserve(u,body.runId));}
   if(path==='/runs/settle'&&req.method==='POST'){if(!validId(body.runId)||!['saved','released'].includes(body.outcome))return send(400,{error:'Invalid run outcome.'});return send(200,await provider.settle(u,body.runId,body.outcome));}
   if(path==='/billing/checkout'&&req.method==='POST')return send(200,await provider.checkout(u));
   if(path==='/billing/cancel'&&req.method==='POST')return send(200,await provider.cancel(u));
   if(path==='/billing/refresh'&&req.method==='POST')return send(200,await provider.refreshBilling(u));
   return send(404,{error:'Unknown endpoint.'});
  }catch(e){const status=e.status&&e.status>=400&&e.status<500?e.status:503;send(status,{error:e instanceof SyntaxError?'Invalid JSON.':status===401?'Your session or payment signature could not be verified.':e.message||'Service is temporarily unavailable.'});}
 };
}
function createServer(options){return http.createServer(createHandler(options));}
if(require.main===module){const env=process.env,origins=(env.ALLOWED_ORIGINS||'').split(',').filter(Boolean);if(!origins.length)throw Error('Set ALLOWED_ORIGINS to the exact installed extension origin.');const {providers}=require('./providers.cjs');createServer({provider:providers(env),origins}).listen(Number(env.PORT||8080),'0.0.0.0',()=>console.log('Vault account service is ready.'));}
module.exports={createServer,createHandler};
