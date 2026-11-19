-- Two paid tiers.
--   pro     £6.99/mo  unlimited projects + inventory, clean PDFs, NO AI features
--   pro_ai  £9.99/mo  everything in Pro, plus Suggest (30 AI kit builds a month)
-- Free keeps its 3 Suggest credits a month.

alter table public.plans add column if not exists ai_enabled boolean not null default true;

update public.plans set ai_enabled = true where id = 'free';

-- Existing Pro subscribers (and comped accounts) paid for / were given the
-- AI plan, so they move to Pro AI. 'pro' becomes the new AI-free tier.
insert into public.plans (id, name, monthly_credits, max_projects, max_inventory_items, pdf_branding, price_pence, currency, sort, ai_enabled)
values ('pro_ai', 'Pro + AI', 30, null, null, false, 999, 'gbp', 2, true)
on conflict (id) do update
  set name = excluded.name, monthly_credits = excluded.monthly_credits, price_pence = excluded.price_pence,
      sort = excluded.sort, ai_enabled = excluded.ai_enabled;

update public.entitlements set plan = 'pro_ai' where plan = 'pro';

update public.plans
   set name = 'Pro', monthly_credits = 0, price_pence = 699, ai_enabled = false, sort = 1
 where id = 'pro';

-- ── Subscriptions now carry which paid tier they are ───────────────────────
drop function if exists public.apply_subscription(uuid, text, text, text, timestamptz, boolean);

create or replace function public.apply_subscription(
  p_user uuid,
  p_customer text,
  p_subscription text,
  p_status text,
  p_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_plan text default 'pro'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.entitlements;
  old_plan text;
  new_plan text;
  old_monthly integer;
  is_paid boolean := p_status in ('active', 'trialing', 'past_due');
begin
  select * into e from public.ensure_entitlements(p_user);
  old_plan := e.plan;
  old_monthly := e.monthly_credits;

  -- An event about an older subscription must not end a newer one.
  if not is_paid and e.stripe_subscription_id is not null and e.stripe_subscription_id <> p_subscription then
    return jsonb_build_object('ignored', true);
  end if;

  if is_paid then
    new_plan := case when exists (select 1 from public.plans where id = p_plan and price_pence is not null)
                     then p_plan else 'pro' end;
    update public.entitlements
       set plan = new_plan,
           stripe_customer_id = coalesce(p_customer, stripe_customer_id),
           stripe_subscription_id = p_subscription,
           subscription_status = p_status,
           current_period_end = p_period_end,
           cancel_at_period_end = coalesce(p_cancel_at_period_end, false),
           -- A tier change starts that tier's allowance; same tier keeps the balance.
           monthly_credits = case when old_plan = new_plan then monthly_credits
                                  else (select p.monthly_credits from public.plans p where p.id = new_plan) end,
           period_start = case when old_plan = new_plan then period_start else now() end,
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
           period_start = case when old_plan <> 'free' then now() else period_start end,
           updated_at = now()
     where user_id = p_user
    returning * into e;
  end if;

  if old_plan <> e.plan then
    insert into public.credit_ledger (user_id, delta, monthly_after, bonus_after, reason, ref)
    values (p_user, e.monthly_credits - old_monthly, e.monthly_credits, e.bonus_credits,
            case when e.plan = 'free' then 'downgraded_to_free' else 'upgraded_to_' || e.plan end, p_subscription);
  end if;
  return jsonb_build_object('plan', e.plan, 'monthly_credits', e.monthly_credits, 'bonus_credits', e.bonus_credits);
end;
$$;

revoke execute on function public.apply_subscription(uuid, text, text, text, timestamptz, boolean, text) from public, anon, authenticated;
grant execute on function public.apply_subscription(uuid, text, text, text, timestamptz, boolean, text) to service_role;

-- ── AI is only for plans that include it ───────────────────────────────────
-- Top-up credits can't unlock AI on a plan without it.
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
  if not (select p.ai_enabled from public.plans p where p.id = e.plan) then
    return jsonb_build_object('ok', false, 'no_ai', true, 'monthly_credits', e.monthly_credits, 'bonus_credits', e.bonus_credits);
  end if;
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

-- get_my_billing gains ai_enabled (everything else is unchanged).
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
    'ai_enabled', p.ai_enabled,
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
