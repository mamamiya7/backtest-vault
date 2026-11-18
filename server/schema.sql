-- Run in the account project's SQL editor. No research records are uploaded.
create table if not exists public.vault_accounts (
 user_id uuid primary key references auth.users(id), used integer not null default 0 check (used between 0 and 50),
 subscription_id text unique, subscription_status text, paid_until timestamptz, checkout_request text,
 billing_revision bigint not null default 0, applied_revision bigint not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.vault_run_receipts (
 user_id uuid not null references public.vault_accounts(user_id), run_id text not null,
 status text not null check (status in ('reserved','saved','released')), free boolean not null,
 created_at timestamptz not null default now(), primary key(user_id,run_id)
);
create table if not exists public.vault_billing_events (event_id text primary key, subscription_id text not null, created_at timestamptz not null default now());
alter table public.vault_accounts enable row level security;
alter table public.vault_run_receipts enable row level security;
alter table public.vault_billing_events enable row level security;
revoke all on public.vault_accounts,public.vault_run_receipts,public.vault_billing_events from anon,authenticated;

create or replace function public.vault_account(p_user uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare a vault_accounts; pending integer; active boolean;
begin
 insert into vault_accounts(user_id) values(p_user) on conflict do nothing;
 select * into a from vault_accounts where user_id=p_user;
 select count(*) into pending from vault_run_receipts where user_id=p_user and status='reserved' and free;
 active:=coalesce(a.paid_until>now(),false);
 return jsonb_build_object('userId',p_user,'pro',active,'used',a.used,'remaining',greatest(0,50-a.used-pending),'reserved',pending,'paidUntil',a.paid_until,'subscriptionStatus',a.subscription_status,'subscriptionId',a.subscription_id);
end $$;

create or replace function public.vault_reserve(p_user uuid,p_run text) returns jsonb language plpgsql security definer set search_path=public as $$
declare a vault_accounts; r vault_run_receipts; pending integer; isfree boolean;
begin
 if p_run !~ '^[a-zA-Z0-9_-]{1,120}$' then raise exception 'Invalid run identity'; end if;
 insert into vault_accounts(user_id) values(p_user) on conflict do nothing;
 select * into a from vault_accounts where user_id=p_user for update;
 select * into r from vault_run_receipts where user_id=p_user and run_id=p_run;
 if r.status='saved' then raise exception 'This run is already counted'; end if;
 if r.status='reserved' then return jsonb_build_object('status','reserved'); end if;
 isfree:=not coalesce(a.paid_until>now(),false);
 select count(*) into pending from vault_run_receipts where user_id=p_user and status='reserved' and free;
 if isfree and a.used+pending>=50 then raise exception 'Your 50 free runs are used or reserved. Upgrade to Pro or review unfinished tests.'; end if;
 insert into vault_run_receipts(user_id,run_id,status,free) values(p_user,p_run,'reserved',isfree)
 on conflict(user_id,run_id) do update set status='reserved',free=excluded.free;
 return jsonb_build_object('status','reserved');
end $$;

create or replace function public.vault_pending(p_user uuid) returns jsonb language sql security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('runId',run_id,'createdAt',created_at) order by created_at),'[]'::jsonb) from vault_run_receipts where user_id=p_user and status='reserved';
$$;

create or replace function public.vault_settle(p_user uuid,p_run text,p_outcome text) returns jsonb language plpgsql security definer set search_path=public as $$
declare r vault_run_receipts;
begin
 if p_outcome not in ('saved','released') then raise exception 'Invalid outcome'; end if;
 perform 1 from vault_accounts where user_id=p_user for update;
 select * into r from vault_run_receipts where user_id=p_user and run_id=p_run;
 if not found then raise exception 'Run reservation is missing'; end if;
 if r.status=p_outcome then return jsonb_build_object('status',p_outcome); end if;
 if r.status<>'reserved' then raise exception 'Review this run reservation before changing it'; end if;
 if p_outcome='saved' and r.free then update vault_accounts set used=used+1 where user_id=p_user; end if;
 update vault_run_receipts set status=p_outcome where user_id=p_user and run_id=p_run;
 return jsonb_build_object('status',p_outcome);
end $$;

-- A checkout reservation survives restarts and serialises requests across devices.
create or replace function public.vault_checkout(p_user uuid,p_request text) returns jsonb language plpgsql security definer set search_path=public as $$
declare a vault_accounts;
begin
 insert into vault_accounts(user_id) values(p_user) on conflict do nothing;
 select * into a from vault_accounts where user_id=p_user for update;
 if a.paid_until>now() then raise exception 'Pro is already active'; end if;
 if a.subscription_id is not null and coalesce(a.subscription_status,'created') not in ('cancelled','completed','expired') then return jsonb_build_object('subscriptionId',a.subscription_id); end if;
 if a.checkout_request is not null then return jsonb_build_object('pending',true); end if;
 update vault_accounts set checkout_request=p_request where user_id=p_user;
 return jsonb_build_object('request',p_request);
end $$;
create or replace function public.vault_attach_checkout(p_user uuid,p_request text,p_subscription text) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 update vault_accounts set subscription_id=p_subscription,subscription_status='created',checkout_request=null where user_id=p_user and checkout_request=p_request;
 if not found then raise exception 'Checkout ownership changed'; end if;
 return jsonb_build_object('ok',true);
end $$;

create or replace function public.vault_billing_claim(p_subscription text) returns jsonb language plpgsql security definer set search_path=public as $$
declare a vault_accounts;
begin
 update vault_accounts set billing_revision=billing_revision+1 where subscription_id=p_subscription returning * into a;
 if not found then raise exception 'Subscription ownership is missing. Retry after checkout is linked.'; end if;
 return jsonb_build_object('userId',a.user_id,'revision',a.billing_revision);
end $$;
-- Provider state is fetched by the server; event order never controls entitlement.
create or replace function public.vault_subscription(p_event text,p_subscription text,p_status text,p_until timestamptz,p_user uuid,p_revision bigint) returns jsonb language plpgsql security definer set search_path=public as $$
declare a vault_accounts;
begin
 select * into a from vault_accounts where user_id=p_user for update;
 if a.subscription_id is distinct from p_subscription then raise exception 'Subscription ownership mismatch'; end if;
 insert into vault_billing_events(event_id,subscription_id) values(p_event,p_subscription) on conflict do nothing;
 if p_revision>a.applied_revision then update vault_accounts set subscription_status=p_status,paid_until=p_until,applied_revision=p_revision where user_id=p_user; end if;
 return jsonb_build_object('ok',true);
end $$;

revoke all on function public.vault_account(uuid),public.vault_reserve(uuid,text),public.vault_settle(uuid,text,text),public.vault_pending(uuid),public.vault_checkout(uuid,text),public.vault_attach_checkout(uuid,text,text),public.vault_billing_claim(text),public.vault_subscription(text,text,text,timestamptz,uuid,bigint) from public,anon,authenticated;
grant execute on function public.vault_account(uuid),public.vault_reserve(uuid,text),public.vault_settle(uuid,text,text),public.vault_pending(uuid),public.vault_checkout(uuid,text),public.vault_attach_checkout(uuid,text,text),public.vault_billing_claim(text),public.vault_subscription(text,text,text,timestamptz,uuid,bigint) to service_role;

-- Shared authentication budgets survive Edge instance restarts. No raw emails/IPs.
create table if not exists public.vault_auth_limits (
 policy text not null, subject_hash text not null check (subject_hash ~ '^[a-f0-9]{64}$'),
 bucket_start timestamptz not null, expires_at timestamptz not null,
 attempts integer not null default 0 check (attempts >= 0),
 primary key(policy,subject_hash,bucket_start)
);
create index if not exists vault_auth_limits_expiry on public.vault_auth_limits(expires_at);
alter table public.vault_auth_limits enable row level security;
revoke all on public.vault_auth_limits from public,anon,authenticated;

create or replace function public.vault_auth_attempt(p_email_hash text,p_action text,p_daily_budget integer default 80)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 instant timestamptz:=clock_timestamp(); global_start timestamptz;
 email_start timestamptz; global_policy text; email_policy text; period_seconds integer;
 global_limit integer; email_limit integer; count_now integer;
 global_hash text:=repeat('0',64);
begin
 if p_email_hash is null or p_email_hash !~ '^[a-f0-9]{64}$' or p_action is null or p_action not in ('send','verify')
 or p_daily_budget is null or p_daily_budget not between 1 and 10000 then raise exception 'Invalid authentication budget'; end if;
 delete from vault_auth_limits where expires_at < instant-interval '1 day';
 global_start:=to_timestamp(floor(extract(epoch from instant)/86400)*86400);
 global_policy:=p_action||'-global'; global_limit:=case when p_action='send' then p_daily_budget else 1000 end;
 insert into vault_auth_limits(policy,subject_hash,bucket_start,expires_at)
 values(global_policy,global_hash,global_start,global_start+interval '1 day') on conflict do nothing;
 -- All instances acquire the global row before any email row. Rejections do not
 -- spend the global allowance or create new email rows after budget exhaustion.
 select attempts into count_now from vault_auth_limits where policy=global_policy and subject_hash=global_hash and bucket_start=global_start for update;
 if count_now>=global_limit then return jsonb_build_object('allowed',false,'retryAfter',greatest(1,ceil(extract(epoch from global_start+interval '1 day'-instant)))); end if;
 for period_seconds,email_limit,email_policy in
  select * from (values
   (case when p_action='send' then 60 else 600 end,case when p_action='send' then 1 else 10 end,p_action||'-short'),
   (86400,case when p_action='send' then 5 else 50 end,p_action||'-day')
  ) as limits(seconds,maximum,policy)
 loop
  email_start:=to_timestamp(floor(extract(epoch from instant)/period_seconds)*period_seconds);
  insert into vault_auth_limits(policy,subject_hash,bucket_start,expires_at)
  values(email_policy,p_email_hash,email_start,email_start+make_interval(secs=>period_seconds)) on conflict do nothing;
  select attempts into count_now from vault_auth_limits where policy=email_policy and subject_hash=p_email_hash and bucket_start=email_start for update;
  if count_now>=email_limit then return jsonb_build_object('allowed',false,'retryAfter',greatest(1,ceil(extract(epoch from email_start+make_interval(secs=>period_seconds)-instant)))); end if;
 end loop;
 update vault_auth_limits set attempts=attempts+1 where policy=global_policy and subject_hash=global_hash and bucket_start=global_start;
 update vault_auth_limits set attempts=attempts+1 where subject_hash=p_email_hash and
  ((policy=p_action||'-short' and bucket_start=to_timestamp(floor(extract(epoch from instant)/(case when p_action='send' then 60 else 600 end))*(case when p_action='send' then 60 else 600 end)))
   or (policy=p_action||'-day' and bucket_start=global_start));
 return jsonb_build_object('allowed',true,'retryAfter',0);
end $$;
revoke all on function public.vault_auth_attempt(text,text,integer) from public,anon,authenticated;
grant execute on function public.vault_auth_attempt(text,text,integer) to service_role;
