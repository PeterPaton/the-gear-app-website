-- Core tables: the equipment catalog and each user's inventory, groups,
-- projects and project items.
--
-- These were first created by hand in the Supabase dashboard; this file
-- records them (as of 2026-10-07) so a fresh database gets the same schema,
-- row-level security and, above all, the ON DELETE CASCADE rules that make
-- deleting an account (supabase/functions/delete-account) remove every
-- project, kit list item, inventory row and group that belonged to it.
--
-- Safe to run against the live database: everything is created only if it
-- is missing, and nothing existing is altered or dropped. It sorts before the
-- billing migrations because their limit triggers and get_my_billing() use
-- projects and user_inventory.

-- ── Equipment catalog (shared, read-only to the app) ──────────────────────
create table if not exists public.equipment (
  "UUID" uuid primary key default gen_random_uuid(),
  name text not null unique,
  image_url text,
  category text
);

-- ── Per-user tables ───────────────────────────────────────────────────────
create table if not exists public.user_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  equipment_id uuid references public.equipment("UUID") on delete set null,
  name text,
  image_url text,
  category text,
  qty integer not null default 1,
  status text default 'available',
  created_at timestamptz default now()
);

create table if not exists public.user_groups (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  item_ids jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.projects (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  client text,
  status text default 'planning',
  shoot text,
  location text,
  items jsonb default '[]'::jsonb, -- legacy; kit lists live in project_items
  created_at timestamptz default now()
);

create table if not exists public.project_items (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects(id) on delete cascade,
  equipment_id uuid references public.equipment("UUID") on delete set null,
  name text,
  image_url text,
  category text,
  qty integer default 1,
  created_at timestamptz default now()
);

-- ── Row-level security ────────────────────────────────────────────────────
alter table public.equipment enable row level security;
alter table public.user_inventory enable row level security;
alter table public.user_groups enable row level security;
alter table public.projects enable row level security;
alter table public.project_items enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'equipment' and policyname = 'Public read') then
    create policy "Public read" on public.equipment for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_inventory' and policyname = 'Users manage own inventory') then
    create policy "Users manage own inventory" on public.user_inventory for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_groups' and policyname = 'own groups') then
    create policy "own groups" on public.user_groups for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'projects' and policyname = 'Users manage own projects') then
    create policy "Users manage own projects" on public.projects for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'project_items' and policyname = 'Users manage own project items') then
    create policy "Users manage own project items" on public.project_items for all
      using (exists (select 1 from public.projects where projects.id = project_items.project_id and projects.user_id = auth.uid()))
      with check (exists (select 1 from public.projects where projects.id = project_items.project_id and projects.user_id = auth.uid()));
  end if;
end $$;
