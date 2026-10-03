-- Enforces each plan's project and inventory limits in the database, so the
-- limits hold even if someone bypasses the app. Rows users already have are
-- never removed; at the limit they just can't add more until they upgrade.
--
-- The app saves with upsert, which fires BEFORE INSERT even for edits, so
-- rows that already exist pass straight through.
create or replace function public.enforce_plan_limits()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  user_plan text;
  lim integer;
  used integer;
  noun text;
begin
  if tg_table_name = 'projects' then
    if exists (select 1 from public.projects where id = new.id) then
      return new;
    end if;
  elsif exists (select 1 from public.user_inventory where id = new.id) then
    return new;
  end if;

  user_plan := coalesce((select en.plan from public.entitlements en where en.user_id = new.user_id), 'free');

  if tg_table_name = 'projects' then
    noun := 'projects';
    select p.max_projects into lim from public.plans p where p.id = user_plan;
    select count(*) into used from public.projects where user_id = new.user_id;
  else
    noun := 'inventory';
    select p.max_inventory_items into lim from public.plans p where p.id = user_plan;
    select count(*) into used from public.user_inventory where user_id = new.user_id;
  end if;

  if lim is not null and used >= lim then
    -- The app parses "plan_limit:<what>:<limit>" to open the upgrade screen.
    raise exception 'plan_limit:%:%', noun, lim
      using errcode = 'P0001', hint = 'Upgrade to Pro for unlimited ' || noun || '.';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_plan_limits() from public, anon, authenticated;

create trigger enforce_plan_limits
  before insert on public.projects
  for each row execute function public.enforce_plan_limits();

create trigger enforce_plan_limits
  before insert on public.user_inventory
  for each row execute function public.enforce_plan_limits();
