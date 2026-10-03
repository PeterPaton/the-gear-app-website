-- Discover: editorial picks of gear that's new to the industry, shown on the
-- Discover tab. Edit rows in the Supabase Table Editor; the app reads them
-- live. Everyone can read published rows; only the dashboard / service role
-- can write.
--
--   title, brand, kind      what it is ("Sony FX5", "Sony", "Camera")
--   headline                one-line hook shown on the card
--   summary                 short paragraph for the card
--   body                    the full write-up; blank lines separate paragraphs
--   highlights              key specs, one per array element
--   price                   free text, e.g. "$4,899.99 body only"
--   announced               announcement date (used for ordering)
--   image_url               product photo; falls back to the catalog item's
--   equipment_id            optional link to the catalog ("Add to inventory")
--   source_name/source_url  where to read more
--   published               untick to hide without deleting
--   sort                    lower shows first (then newest announced)
create table public.discover_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  brand text,
  kind text,
  headline text,
  summary text,
  body text,
  highlights text[] not null default '{}',
  price text,
  announced date,
  image_url text,
  equipment_id uuid references public.equipment ("UUID") on delete set null,
  source_name text,
  source_url text,
  published boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index discover_items_order on public.discover_items (published, sort, announced desc);
create index discover_items_equipment on public.discover_items (equipment_id);

alter table public.discover_items enable row level security;
create policy "Anyone can read published discover items" on public.discover_items
  for select using (published);
revoke insert, update, delete, truncate, references, trigger on table public.discover_items from anon, authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
create trigger discover_items_updated_at
  before update on public.discover_items
  for each row execute function public.touch_updated_at();

comment on table public.discover_items is 'Discover tab: new-to-the-industry gear picks. Edit here; blank lines in body separate paragraphs; untick published to hide.';
