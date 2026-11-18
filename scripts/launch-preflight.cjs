'use strict';
// Read-only provider checks. Never prints a credential or any account/report row.
const required=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','RAZORPAY_KEY_ID','RAZORPAY_KEY_SECRET','RAZORPAY_PLAN_ID','RAZORPAY_WEBHOOK_SECRET','ALLOWED_ORIGINS'];
function configuration(env,mode='test',{communityOnly=false}={}){
 const keys=communityOnly?required.filter(key=>!key.startsWith('RAZORPAY_')):required;
 const checks=keys.map(key=>({name:key,ok:typeof env[key]==='string'&&env[key].trim().length>0&&!/YOUR_|SET_IN_|SET_AFTER_|SET_IN_HOST/.test(env[key])}));
 const add=(name,ok)=>checks.push({name,ok:!!ok});
 const emailBudget=Number(env.AUTH_EMAIL_DAILY_LIMIT??80);add('Shared email attempt budget',Number.isInteger(emailBudget)&&emailBudget>=1&&emailBudget<=10000);
 if(communityOnly)add('Billing settings absent in Community-only mode',required.filter(key=>key.startsWith('RAZORPAY_')).every(key=>!env[key]));
 if(checks.find(x=>x.name==='SUPABASE_URL').ok)add('Hosted Supabase origin',/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(env.SUPABASE_URL));
 if(checks.find(x=>x.name==='ALLOWED_ORIGINS').ok)add('Exact Chrome extension origins',env.ALLOWED_ORIGINS.split(',').every(s=>/^chrome-extension:\/\/[a-p]{32}$/.test(s)));
 if(env.RAZORPAY_KEY_ID)add('Razorpay '+mode+' key',new RegExp('^rzp_'+(mode==='live'?'live':'test')+'_[a-zA-Z0-9]+$').test(env.RAZORPAY_KEY_ID));
 if(env.RAZORPAY_PLAN_ID)add('Razorpay plan identity',/^plan_[a-zA-Z0-9]+$/.test(env.RAZORPAY_PLAN_ID));
 if(env.RAZORPAY_WEBHOOK_SECRET)add('Separate strong webhook secret',env.RAZORPAY_WEBHOOK_SECRET.length>=32&&env.RAZORPAY_WEBHOOK_SECRET!==env.RAZORPAY_KEY_SECRET);
 if(mode==='live')add('Production mode',env.NODE_ENV==='production');
 return checks;
}
async function remote(env,{origin,request=fetch,communityOnly=false}={}){
 const result=[];
 async function probe(name,url,options={},accept=r=>r.ok){
  try {const response=await request(url,{...options,signal:AbortSignal.timeout(12000)});const data=await response.json().catch(()=>null);result.push({name,ok:!!accept(response,data)});}catch{result.push({name,ok:false});}
 }
 await probe('Email authentication enabled',env.SUPABASE_URL+'/auth/v1/settings',{headers:{apikey:env.SUPABASE_ANON_KEY}},(r,d)=>r.ok&&d?.external?.email===true);
 const service={apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY};
 for(const table of ['vault_accounts','vault_run_receipts','vault_billing_events','vault_auth_limits'])await probe('Database schema: '+table,env.SUPABASE_URL+'/rest/v1/'+table+'?select=*&limit=0',{headers:service},(r,d)=>r.ok&&Array.isArray(d)&&d.length===0);
 if(!communityOnly)await probe('INR 899 monthly plan', 'https://api.razorpay.com/v1/plans/'+encodeURIComponent(env.RAZORPAY_PLAN_ID),{headers:{Authorization:'Basic '+Buffer.from(env.RAZORPAY_KEY_ID+':'+env.RAZORPAY_KEY_SECRET).toString('base64')}},(r,d)=>r.ok&&d?.period==='monthly'&&d.interval===1&&d.item?.amount===89900&&d.item.currency==='INR');
 if(origin){const u=new URL(origin),edge=/^[a-z0-9-]+\.supabase\.co$/.test(u.hostname)&&/^\/functions\/v1\/[a-z][a-z0-9-]{0,62}$/.test(u.pathname);if(u.protocol!=='https:'||u.search||u.hash||u.username||u.password||u.origin!==origin&&!edge)throw Error('Use an exact HTTPS API origin or hosted Supabase function URL.');await probe('Hosted API health',origin+'/health',{},(r,d)=>r.ok&&d?.ok===true&&d.ready!==false);await probe('Foreign browser origin rejected',origin+'/account',{headers:{Origin:'https://untrusted.example'}},r=>r.status===403);await probe('Unauthenticated account rejected',origin+'/account',{},r=>r.status===401);}
 return result;
}
async function main(){const args=process.argv.slice(2),mode=args.includes('--live')?'live':'test',communityOnly=args.includes('--community-only'),origin=args.find(s=>s.startsWith('--origin='))?.slice(9),checks=configuration(process.env,mode,{communityOnly});if(args.includes('--remote')&&checks.every(x=>x.ok))checks.push(...await remote(process.env,{origin,communityOnly}));for(const c of checks)console.log((c.ok?'PASS ':'NEEDS SETUP ')+c.name);console.log('Manual acceptance still required: SMTP delivery, real email code, extension origin and archive migration.'+(communityOnly?' Pro checkout is disabled.':' Webhook replay and payment/cancel/refund also need acceptance.'));if(checks.some(c=>!c.ok))process.exitCode=1;}
if(require.main===module)main().catch(()=>{console.error('Preflight could not complete. Check the origin and provider settings securely.');process.exitCode=1;});
module.exports={configuration,remote};
