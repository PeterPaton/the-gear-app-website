-- Share links: a project's kit list can be opened by anyone who has the link,
-- without an account. gearapp.io/s/<slug>-<token> is served by api/share.js.
--
-- The tables stay private (owner-only row-level security). Visitors never read
-- them directly: they call get_shared_kit(token), a security-definer function
-- that returns a fixed set of fields for an active link and nothing else. The
-- token is 20 random hex characters (80 bits), so a link can't be guessed.
--
--   active          turn a link off without losing its settings
--   show_client     client name is hidden from visitors unless the owner opts in
--   show_location   location, likewise
--   show_dates      shoot dates, likewise
--   views/last_viewed_at   counted each time the shared page is built
--
-- One link per project. Rows go when the project or the account is deleted
-- (cascades), so delete-account needs no change.
create table if not exists public.shared_lists (
  token text primary key default substr(replace(gen_random_uuid()::text, '-', ''), 1, 20),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id text not null references public.projects (id) on delete cascade,
  active boolean not null default true,
  show_client boolean not null default false,
  show_location boolean not null default false,
  show_dates boolean not null default false,
  views integer not null default 0,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint shared_lists_one_per_project unique (project_id),
  constraint shared_lists_token_shape check (token ~ '^[a-f0-9]{20}$')
);

create index if not exists shared_lists_user_id_idx on public.shared_lists (user_id);

alter table public.shared_lists enable row level security;

-- Owners manage their own links, and only for projects they own.
drop policy if exists "Owners manage their share links" on public.shared_lists;
create policy "Owners manage their share links" on public.shared_lists
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid()))
  );

-- Nothing for signed-out visitors. Signed-in owners can read their rows, create
-- a link, change its switches and delete it; the token and counters are not
-- theirs to write.
revoke all on table public.shared_lists from anon;
revoke all on table public.shared_lists from authenticated;
grant select, delete on table public.shared_lists to authenticated;
grant insert (project_id, active, show_client, show_location, show_dates) on table public.shared_lists to authenticated;
grant update (active, show_client, show_location, show_dates) on table public.shared_lists to authenticated;

-- What a visitor gets for a link: the project's name and status, the optional
-- client / location / dates, and each item's name, image, category and
-- quantity. Returns null for an unknown, malformed or switched-off token.
create or replace function public.get_shared_kit(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.shared_lists;
  p public.projects;
  items jsonb;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{20}$' then
    return null;
  end if;

  select * into s from public.shared_lists where token = p_token and active;
  if not found then
    return null;
  end if;

  select * into p from public.projects where id = s.project_id;
  if not found then
    return null;
  end if;

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'name', pi.name,
               'image_url', pi.image_url,
               'category', pi.category,
               'qty', coalesce(pi.qty, 1)
             ) order by pi.created_at
           ),
           '[]'::jsonb
         )
    into items
    from public.project_items pi
   where pi.project_id = p.id;

  update public.shared_lists
     set views = views + 1, last_viewed_at = now()
   where token = p_token;

  return jsonb_build_object(
    'name', p.name,
    'status', p.status,
    'client', case when s.show_client then p.client end,
    'location', case when s.show_location then p.location end,
    'shoot', case when s.show_dates then p.shoot end,
    'items', items
  );
end;
$$;

revoke all on function public.get_shared_kit(text) from public;
grant execute on function public.get_shared_kit(text) to anon, authenticated;
