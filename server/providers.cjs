'use strict';
const crypto=require('node:crypto');
function providers(env=process.env,request=fetch){
 const required=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'];
 for(const key of required)if(!env[key])throw Error('Missing server setting: '+key);
 const billingKeys=['RAZORPAY_KEY_ID','RAZORPAY_KEY_SECRET','RAZORPAY_PLAN_ID','RAZORPAY_WEBHOOK_SECRET'];
 const billingEnabled=billingKeys.some(key=>Boolean(env[key]));
 if(billingEnabled)for(const key of billingKeys)if(!env[key])throw Error('Missing server setting: '+key);
 const requireBilling=()=>{if(!billingEnabled)throw Object.assign(Error('Pro checkout is not available yet. Community access is available while payment setup is completed.'),{status:503});};
 if(!/^https:\/\/[^/]+\.supabase\.co$/.test(env.SUPABASE_URL))throw Error('Use your hosted Supabase project URL.');
 if(billingEnabled&&env.NODE_ENV==='production'&&!env.RAZORPAY_KEY_ID.startsWith('rzp_live_'))throw Error('Production requires a live Razorpay account.');
 async function json(url,{method='GET',headers={},body}={}){const r=await request(url,{method,headers:{'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(12000)});const d=await r.json();if(!r.ok){const e=Error(d.message||d.msg||d.error_description||d.error?.description||'Provider request failed.');e.status=r.status;throw e;}return d;}
 const auth=(path,body,token)=>json(env.SUPABASE_URL+'/auth/v1/'+path,{method:body===undefined?'GET':'POST',headers:{apikey:env.SUPABASE_ANON_KEY,...(token?{Authorization:'Bearer '+token}:{})},body});
 const rpc=(name,args)=>json(env.SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY},body:args});
 const razor=(path,body)=>{requireBilling();return json('https://api.razorpay.com/v1/'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Basic '+Buffer.from(env.RAZORPAY_KEY_ID+':'+env.RAZORPAY_KEY_SECRET).toString('base64')},body});};
 function safeSession(s){if(!s.access_token||!s.refresh_token||!s.expires_in)throw Error('Email verification did not return a session.');return {access_token:s.access_token,refresh_token:s.refresh_token,expires_at:s.expires_at||Math.floor(Date.now()/1000)+s.expires_in};}
 async function validatePlan(){const p=await razor('plans/'+encodeURIComponent(env.RAZORPAY_PLAN_ID));if(p.period!=='monthly'||p.interval!==1||p.item?.amount!==89900||p.item?.currency!=='INR')throw Error('The billing plan must be INR 899.00 per month.');}
 async function syncSubscription(id,event){const claim=await rpc('vault_billing_claim',{p_subscription:id}),sub=await razor('subscriptions/'+encodeURIComponent(id));if(sub.plan_id!==env.RAZORPAY_PLAN_ID||sub.quantity!==1)throw Error('Unrecognised subscription plan.');const user=sub.notes?.vault_user_id;if(user!==claim.userId)throw Error('Subscription account is missing.');
  // Authorisation alone does not grant Pro. Paid cycle boundaries come from the provider.
  let until=null;
  if(Number(sub.paid_count)>0){for(let skip=0;skip<200;skip+=100){const invoices=await razor('invoices?subscription_id='+encodeURIComponent(sub.id)+'&count=100&skip='+skip);for(const invoice of invoices.items||[]){if(invoice.subscription_id===sub.id&&invoice.status==='paid'&&invoice.currency==='INR'&&invoice.amount_paid>=89900&&invoice.payment_id&&Number.isSafeInteger(invoice.billing_end)&&invoice.billing_end>0){const payment=await razor('payments/'+encodeURIComponent(invoice.payment_id));if(payment.status==='captured'&&payment.currency==='INR'&&payment.amount-(payment.amount_refunded||0)>=89900)until=Math.max(until||0,invoice.billing_end);}}if((invoices.items||[]).length<100)break;}}
  await rpc('vault_subscription',{p_event:event,p_subscription:sub.id,p_status:sub.status,p_until:until?new Date(until*1000).toISOString():null,p_user:user,p_revision:claim.revision});
 }
 return {
 sendCode:async email=>{await auth('otp',{email,create_user:true});return {sent:true};},
 verify:async(email,token)=>safeSession(await auth('verify',{email,token,type:'email'})),
 refresh:async token=>safeSession(await auth('token?grant_type=refresh_token',{refresh_token:token})),
 logout:async token=>{await auth('logout?scope=local',{},token);return {ok:true};},
 user:async token=>{const u=await auth('user',undefined,token);if(!u.email_confirmed_at)throw Object.assign(Error('Verify your email first.'),{status:401});return {id:u.id,email:u.email};},
  account:async u=>{const a=await rpc('vault_account',{p_user:u.id});return {...a,email:u.email};},
  refreshBilling:async u=>{const a=await rpc('vault_account',{p_user:u.id});if(a.subscriptionId){requireBilling();await syncSubscription(a.subscriptionId,'refresh-'+crypto.randomUUID());}return {ok:true};},
 reserve:(u,runId)=>rpc('vault_reserve',{p_user:u.id,p_run:runId}),
 pending:u=>rpc('vault_pending',{p_user:u.id}),
 settle:(u,runId,outcome)=>rpc('vault_settle',{p_user:u.id,p_run:runId,p_outcome:outcome}),
 checkout:async u=>{await validatePlan();const id=crypto.randomUUID(),claim=await rpc('vault_checkout',{p_user:u.id,p_request:id});if(claim.pending)throw Object.assign(Error('A checkout is being prepared. Refresh account status shortly; do not pay twice.'),{status:409});let sub;
  if(claim.subscriptionId)sub=await razor('subscriptions/'+encodeURIComponent(claim.subscriptionId));else{
   // A network-uncertain create retains its reservation for operator reconciliation.
   sub=await razor('subscriptions',{plan_id:env.RAZORPAY_PLAN_ID,total_count:120,quantity:1,customer_notify:true,notes:{vault_user_id:u.id,vault_checkout_request:id}});
   await rpc('vault_attach_checkout',{p_user:u.id,p_request:id,p_subscription:sub.id});
  }
  if(sub.notes?.vault_user_id!==u.id||sub.plan_id!==env.RAZORPAY_PLAN_ID)throw Error('Checkout account mismatch.');
  const url=new URL(sub.short_url);if(url.protocol!=='https:'||!['rzp.io','razorpay.com'].includes(url.hostname))throw Error('Invalid hosted checkout URL.');return {url:url.href,amount:89900,currency:'INR'};
 },
 cancel:async u=>{requireBilling();const a=await rpc('vault_account',{p_user:u.id});if(!a.subscriptionId)throw Error('No subscription to cancel.');const sub=await razor('subscriptions/'+encodeURIComponent(a.subscriptionId));if(sub.notes?.vault_user_id!==u.id)throw Error('Subscription account mismatch.');if(sub.status==='active')await razor('subscriptions/'+encodeURIComponent(sub.id)+'/cancel',{cancel_at_cycle_end:true});await syncSubscription(sub.id,'cancel-'+crypto.randomUUID());return {ok:true};},
 webhook:async(bytes,signature,event)=>{requireBilling();if(!/^[a-f0-9]{64}$/i.test(signature||'')||!crypto.timingSafeEqual(Buffer.from(signature,'hex'),crypto.createHmac('sha256',env.RAZORPAY_WEBHOOK_SECRET).update(bytes).digest()))throw Object.assign(Error('Invalid webhook signature.'),{status:401});const payload=JSON.parse(bytes.toString('utf8'));let id=payload.payload?.subscription?.entity?.id;
  if(!id){const paymentId=payload.payload?.payment?.entity?.id||payload.payload?.refund?.entity?.payment_id;if(/^pay_[a-zA-Z0-9]+$/.test(paymentId||'')){const payment=await razor('payments/'+paymentId);if(/^inv_[a-zA-Z0-9]+$/.test(payment.invoice_id||'')){const invoice=await razor('invoices/'+payment.invoice_id);id=invoice.subscription_id;}}}
  if(!id)return {ignored:true};if(!/^sub_[a-zA-Z0-9]+$/.test(id))throw Error('Invalid subscription identity.');await syncSubscription(id,event||crypto.createHash('sha256').update(bytes).digest('hex'));return {ok:true};}
 };
}
module.exports={providers};
