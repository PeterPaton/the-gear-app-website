-- Freemium billing: plans and limits, Suggest credits, Stripe subscription
-- state, and per-run AI accounting.
--
-- entitlements / credit_ledger / suggest_runs / stripe_events are only ever
-- written by the security-definer functions below, which only the service
-- role (the kit-suggest, billing and stripe-webhook edge functions) may call.
-- Signed-in users can read their own rows; nobody can write them directly.

-- ── Plans and credit packs: the public price list ──────────────────────────
-- Edit these rows to change limits or prices; the app, checkout and the
-- limit triggers all read them live.
create table public.plans (
  id text primary key,
  name text not null,
  monthly_credits integer not null check (monthly_credits >= 0),
  max_projects integer check (max_projects >= 0),                 -- null = unlimited
  max_inventory_items integer check (max_inventory_items >= 0),   -- null = unlimited
  pdf_branding boolean not null default false,
  price_pence integer check (price_pence > 0),                    -- null = free
  currency text not null default 'gbp',
  sort integer not null default 0
);

insert into public.plans (id, name, monthly_credits, max_projects, max_inventory_items, pdf_branding, price_pence, currency, sort) values
  ('free', 'Free', 3, 5, 50, true, null, 'gbp', 0),
  ('pro', 'Pro', 40, null, null, false, 1200, 'gbp', 1);

create table public.credit_packs (
  id text primary key,
  name text not null,
  credits integer not null check (credits > 0),
  price_pence integer not null check (price_pence > 0),
  currency text not null default 'gbp',
  active boolean not null default true,
  sort integer not null default 0
);

insert into public.credit_packs (id, name, credits, price_pence) values
  ('credits_20', '20 Suggest credits', 20, 500);

alter table public.plans enable row level security;
alter table public.credit_packs enable row level security;
create policy "Anyone can read plans" on public.plans for select using (true);
create policy "Anyone can read credit packs" on public.credit_packs for select using (true);

-- ── Per-user plan, credit balances and Stripe state ───────────────────────
-- monthly_credits: this period's allowance; resets (no rollover).
-- bonus_credits:   purchased top-ups; never expire; spent after monthly.
create table public.entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' references public.plans (id),
  monthly_credits integer not null default 0 check (monthly_credits >= 0),
  bonus_credits integer not null default 0 check (bonus_credits >= 0),
  period_start timestamptz not null default now(),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.entitlements enable row level security;
create policy "Users read their own entitlements" on public.entitlements
  for select to authenticated using ((select auth.uid()) = user_id);

create table public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null,
  monthly_after integer not null,
  bonus_after integer not null,
  reason text not null,
  ref text,
  created_at timestamptz not null default now()
);
create index credit_ledger_user_created on public.credit_ledger (user_id, created_at desc);
alter table public.credit_ledger enable row level security;
create policy "Users read their own credit history" on public.credit_ledger
  for select to authenticated using ((select auth.uid()) = user_id);

-- Stripe event ids already processed, so retried webhooks apply once.
create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;

-- One row per charged Suggest action. A run includes the automatic fix-up
-- pass (max_calls = 2) and records token usage so AI cost can be tracked.
create table public.suggest_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('generate', 'refine')),
  calls_used integer not null default 0,
  max_calls integer not null default 2,
  charged_monthly integer not null default 0,
  charged_bonus integer not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz not null default now()
);
create index suggest_runs_user_created on public.suggest_runs (user_id, created_at desc);
alter table public.suggest_runs enable row level security;

-- ── Functions ──────────────────────────────────────────────────────────────

-- Creates a user's row on first use and refills the monthly allowance once a
-- month has passed. Subscribers are refilled by the Stripe webhook on each
-- paid renewal instead. Locks the row for the rest of the caller's transaction.
create or replace function public.ensure_entitlements(p_user uuid)
returns public.entitlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.entitlements;
  allowance integer;
  months integer;
  old_monthly integer;
begin
  insert into public.entitlements (user_id, plan, monthly_credits)
  select p_user, p.id, p.monthly_credits from public.plans p where p.id = 'free'
  on conflict (user_id) do nothing;

  select * into strict e from public.entitlements where user_id = p_user for update;

  if e.stripe_subscription_id is null and now() >= e.period_start + interval '1 month' then
    select p.monthly_credits into allowance from public.plans p where p.id = e.plan;
    -- Whole months elapsed; at least 1 so month-end clamping (Jan 31 + 1 month
    -- = Feb 28) can't leave period_start where it was.
    months := greatest(1,
      extract(year from age(now(), e.period_start))::integer * 12
      + extract(month from age(now(), e.period_start))::integer);
    old_monthly := e.monthly_credits;
    update public.entitlements
       set monthly_credits = allowance,
           period_start = e.period_start + make_interval(months => months),
           updated_at = now()
     where user_id = p_user
    returning * into e;
    insert into public.credit_ledger (user_id, delta, monthly_after, bonus_after, reason)
    values (p_user, allowance - old_monthly, e.monthly_credits, e.bonus_credits, 'monthly_refill');
  end if;
  return e;
end;
$$;

-- Reserves credits for a Suggest action (monthly allowance first, then
-- top-ups) and opens a run. Returns { ok: false } when the balance is short.
create or replace function public.start_suggest_run(p_user uuid, p_kind text, p_cost integer default 1)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.entitlements;
  from_monthly integer;
  new_run uuid;
begin
  if p_cost < 1 then
    raise exception 'cost must be positive';
  end if;
  select * into e from public.ensure_entitlements(p_user);
  if e.monthly_credits + e.bonus_credits < p_cost then
    return jsonb_build_object('ok', false, 'monthly_credits', e.monthly_credits, 'bonus_credits', e.bonus_credits);
  end if;
  from_monthly := least(e.monthly_credits, p_cost);
  update public.entitlements
     set monthly_credits = monthly_credits - from_monthly,
         bonus_credits = bonus_credits - (p_cost - from_monthly),
         updated_at = now()
   where user_id = p_user
  returning * into e;
  insert into public.suggest_runs (user_id, kind, calls_used, max_calls, charged_monthly, charged_bonus)
  values (p_user, p_kind, 1, 2, from_monthly, p_cost - from_monthly)
  returning id into new_run;
  insert into public.credit_ledger (user_id, delta, monthly_after, bonus_after, reason, ref)
  values (p_user, -p_cost, e.monthly_credits, e.bonus_credits, 'suggest_' || p_kind, new_run::text);
  return jsonb_build_object('ok', true, 'run_id', new_run, 'monthly_credits', e.monthly_credits, 'bonus_credits', e.bonus_credits);
end;
$$;

-- Claims the run's free follow-up call (the automatic fix-up pass).
create or replace function public.continue_suggest_run(p_user uuid, p_run uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    update public.suggest_runs
       set calls_used = calls_used + 1
     where id = p_run
       and user_id = p_user
       and calls_used < max_calls
       and created_at > now() - interval '1 hour'
    returning 1
  )
  select exists (select 1 from claimed);
$$;

create or replace function public.record_suggest_usage(p_run uuid, p_input integer, p_output integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.suggest_runs
     set input_tokens = input_tokens + greatest(p_input, 0),
         output_tokens = output_tokens + greatest(p_output, 0)
   where id = p_run;
$$;

-- Gives back whatever a run charged (the AI call failed). Safe to call twice.
create or replace function public.refund_suggest_run(p_run uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.suggest_runs;
  e public.entitlements;
begin
  select * into r from public.suggest_runs where id = p_run for update;
  if not found or r.charged_monthly + r.charged_bonus = 0 then
    return null;
  end if;
  update public.suggest_runs set charged_monthly = 0, charged_bonus = 0 where id = p_run;
  update public.entitlements
     set monthly_credits = monthly_credits + r.charged_monthly,
         bonus_credits = bonus_credits + r.charged_bonus,
         updated_at = now()
   where user_id = r.user_id
  returning * into e;
  insert into public.credit_ledger (user_id, delta, monthly_after, bonus_after, reason, ref)
  values (r.user_id, r.charged_monthly + r.charged_bonus, e.monthly_credits, e.bonus_credits, 'refund', p_run::text);
  return jsonb_build_object('monthly_credits', e.monthly_credits, 'bonus_credits', e.bonus_credits);
end;
$$;

-- Adds purchased top-up credits.
create or replace function public.grant_bonus_credits(p_user uuid, p_amount integer, p_reason text, p_ref text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.entitlements;
begin
  if p_amount < 1 then
    raise exception 'amount must be positive';
  end if;
  perform public.ensure_entitlements(p_user);
  update public.entitlements
     set bonus_credits = bonus_credits + p_amount,
         updated_at = now()
   where user_id = p_user
  returning * into e;
  insert into public.credit_ledger (user_id, delta, monthly_after, bonus_after, reason, ref)
  values (p_user, p_amount, e.monthly_credits, e.bonus_credits, p_reason, p_ref);
  return jsonb_build_object('monthly_credits', e.monthly_credits, 'bonus_credits', e.bonus_credits);
end;
$$;

-- Resets the monthly allowance on a paid subscription renewal.
create or replace function public.refill_monthly_credits(p_user uuid, p_ref text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.entitlements;
  allowance integer;
  old_monthly integer;
begin
  select * into e from public.ensure_entitlements(p_user);
  select p.monthly_credits into allowance from public.plans p where p.id = e.plan;
  old_monthly := e.monthly_credits;
  update public.entitlements
     set monthly_credits = allowance,
         period_start = now(),
         updated_at = now()
   where user_id = p_user
  returning * into e;
  insert into public.credit_ledger (user_id, delta, monthly_after, bonus_after, reason, ref)
  values (p_user, allowance - old_monthly, e.monthly_credits, e.bonus_credits, 'monthly_refill', p_ref);
  return jsonb_build_object('monthly_credits', e.monthly_credits, 'bonus_credits', e.bonus_credits);
end;
$$;

-- Applies a Stripe subscription's current state. active / trialing /
-- past_due (Stripe is still retrying the card) mean Pro; anything else Free.
-- Upgrading starts a fresh Pro allowance; downgrading caps the remaining
-- monthly credits at the Free allowance. Top-ups are never touched.
create or replace function public.apply_subscription(
  p_user uuid,
  p_customer text,
  p_subscription text,
  p_status text,
  p_period_end timestamptz,
  p_cancel_at_period_end boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.entitlements;
  was_pro boolean;
  old_monthly integer;
  is_pro boolean := p_status in ('active', 'trialing', 'past_due');
begin
  select * into e from public.ensure_entitlements(p_user);
  was_pro := e.plan = 'pro';
  old_monthly := e.monthly_credits;

  -- An event about an older subscription must not end a newer one.
  if not is_pro and e.stripe_subscription_id is not null and e.stripe_subscription_id <> p_subscription then
    return jsonb_build_object('ignored', true);
  end if;

  if is_pro then
    update public.entitlements
       set plan = 'pro',
           stripe_customer_id = coalesce(p_customer, stripe_customer_id),
           stripe_subscription_id = p_subscription,
           subscription_status = p_status,
           current_period_end = p_period_end,
           cancel_at_period_end = coalesce(p_cancel_at_period_end, false),
           monthly_credits = case when was_pro then monthly_credits
                                  else (select p.monthly_credits from public.plans p where p.id = 'pro') end,
           period_start = case when was_pro then period_start else now() end,
           updated_at = now()
     where user_id = p_user
    returning * into e;
  else
    update public.entitlements
       set plan = 'free',
           stripe_customer_id = coalesce(p_customer, stripe_customer_id),
           stripe_subscription_id = null,
           subscription_status = p_status,
           current_period_end = null,
           cancel_at_period_end = false,
           monthly_credits = least(monthly_credits, (select p.monthly_credits from public.plans p where p.id = 'free')),
           period_start = case when was_pro then now() else period_start end,
           updated_at = now()
     where user_id = p_user
    returning * into e;
  end if;

  if was_pro <> (e.plan = 'pro') then
    insert into public.credit_ledger (user_id, delta, monthly_after, bonus_after, reason, ref)
    values (p_user, e.monthly_credits - old_monthly, e.monthly_credits, e.bonus_credits,
            case when e.plan = 'pro' then 'upgraded_to_pro' else 'downgraded_to_free' end, p_subscription);
  end if;
  return jsonb_build_object('plan', e.plan, 'monthly_credits', e.monthly_credits, 'bonus_credits', e.bonus_credits);
end;
$$;

-- Everything the app needs to show the signed-in user's plan, credits and usage.
create or replace function public.get_my_billing()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  e public.entitlements;
  p public.plans;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  select * into e from public.ensure_entitlements(uid);
  select * into p from public.plans where id = e.plan;
  return jsonb_build_object(
    'plan', e.plan,
    'plan_name', p.name,
    'monthly_credits', e.monthly_credits,
    'monthly_allowance', p.monthly_credits,
    'bonus_credits', e.bonus_credits,
    'next_refill', case when e.stripe_subscription_id is null
                        then e.period_start + interval '1 month'
                        else e.current_period_end end,
    'max_projects', p.max_projects,
    'max_inventory_items', p.max_inventory_items,
    'pdf_branding', p.pdf_branding,
    'projects_used', (select count(*) from public.projects where user_id = uid),
    'inventory_used', (select count(*) from public.user_inventory where user_id = uid),
    'subscription_status', e.subscription_status,
    'current_period_end', e.current_period_end,
    'cancel_at_period_end', e.cancel_at_period_end,
    'has_billing_account', e.stripe_customer_id is not null
  );
end;
$$;

-- Only the edge functions (service role) may move credits or change plans.
revoke execute on function
  public.ensure_entitlements(uuid),
  public.start_suggest_run(uuid, text, integer),
  public.continue_suggest_run(uuid, uuid),
  public.record_suggest_usage(uuid, integer, integer),
  public.refund_suggest_run(uuid),
  public.grant_bonus_credits(uuid, integer, text, text),
  public.refill_monthly_credits(uuid, text),
  public.apply_subscription(uuid, text, text, text, timestamptz, boolean)
from public, anon, authenticated;

grant execute on function
  public.ensure_entitlements(uuid),
  public.start_suggest_run(uuid, text, integer),
  public.continue_suggest_run(uuid, uuid),
  public.record_suggest_usage(uuid, integer, integer),
  public.refund_suggest_run(uuid),
  public.grant_bonus_credits(uuid, integer, text, text),
  public.refill_monthly_credits(uuid, text),
  public.apply_subscription(uuid, text, text, text, timestamptz, boolean)
to service_role;

revoke execute on function public.get_my_billing() from public, anon;
grant execute on function public.get_my_billing() to authenticated;
