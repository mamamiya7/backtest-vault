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
