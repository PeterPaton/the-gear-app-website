-- Annual billing: two months free (Pro £69/yr vs £83.88, Pro + AI £99/yr vs £119.88).
-- Annual subscribers still get their Suggest credits refilled every month.

alter table public.plans add column if not exists annual_price_pence integer check (annual_price_pence > 0);
update public.plans set annual_price_pence = 6900 where id = 'pro';
update public.plans set annual_price_pence = 9900 where id = 'pro_ai';

alter table public.entitlements
  add column if not exists billing_interval text not null default 'month' check (billing_interval in ('month', 'year'));

-- Lazy monthly refill now also covers annual subscribers (their Stripe
-- invoice only comes once a year). Monthly subscribers are still refilled by
-- the webhook on each paid renewal.
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

  if (e.stripe_subscription_id is null or e.billing_interval = 'year')
     and now() >= e.period_start + interval '1 month' then
    select p.monthly_credits into allowance from public.plans p where p.id = e.plan;
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

drop function if exists public.apply_subscription(uuid, text, text, text, timestamptz, boolean, text);

create or replace function public.apply_subscription(
  p_user uuid,
  p_customer text,
  p_subscription text,
  p_status text,
  p_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_plan text default 'pro',
  p_interval text default 'month'
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
  new_interval text := case when p_interval = 'year' then 'year' else 'month' end;
begin
  select * into e from public.ensure_entitlements(p_user);
  old_plan := e.plan;
  old_monthly := e.monthly_credits;

  if not is_paid and e.stripe_subscription_id is not null and e.stripe_subscription_id <> p_subscription then
    return jsonb_build_object('ignored', true);
  end if;

  if is_paid then
    new_plan := case when exists (select 1 from public.plans where id = p_plan and price_pence is not null)
                     then p_plan else 'pro' end;
    update public.entitlements
       set plan = new_plan,
           billing_interval = new_interval,
           stripe_customer_id = coalesce(p_customer, stripe_customer_id),
           stripe_subscription_id = p_subscription,
           subscription_status = p_status,
           current_period_end = p_period_end,
           cancel_at_period_end = coalesce(p_cancel_at_period_end, false),
           monthly_credits = case when old_plan = new_plan then monthly_credits
                                  else (select p.monthly_credits from public.plans p where p.id = new_plan) end,
           period_start = case when old_plan = new_plan then period_start else now() end,
           updated_at = now()
     where user_id = p_user
    returning * into e;
  else
    update public.entitlements
       set plan = 'free',
           billing_interval = 'month',
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

revoke execute on function public.apply_subscription(uuid, text, text, text, timestamptz, boolean, text, text) from public, anon, authenticated;
grant execute on function public.apply_subscription(uuid, text, text, text, timestamptz, boolean, text, text) to service_role;

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
    'billing_interval', e.billing_interval,
    'monthly_credits', e.monthly_credits,
    'monthly_allowance', p.monthly_credits,
    'bonus_credits', e.bonus_credits,
    'next_refill', case when e.stripe_subscription_id is null or e.billing_interval = 'year'
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
