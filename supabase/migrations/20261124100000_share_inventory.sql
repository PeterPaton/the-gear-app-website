-- Share links for a person's whole inventory, not just a project's kit list.
--
-- shared_lists.kind is 'project' (as before: project_id set) or 'inventory'
-- (project_id null; at most one per user, enforced by a unique index). The public
-- page still calls get_shared_kit(token); for an inventory link it returns the
-- owner's inventory items (name, photo, category, quantity) and nothing else:
-- no name, email or status.

alter table public.shared_lists add column if not exists kind text not null default 'project';
alter table public.shared_lists drop constraint if exists shared_lists_kind_check;
alter table public.shared_lists add constraint shared_lists_kind_check check (kind in ('project', 'inventory'));
alter table public.shared_lists alter column project_id drop not null;
alter table public.shared_lists drop constraint if exists shared_lists_kind_project;
alter table public.shared_lists add constraint shared_lists_kind_project check (
  (kind = 'project' and project_id is not null) or (kind = 'inventory' and project_id is null)
);
create unique index if not exists shared_lists_one_inventory on public.shared_lists (user_id) where kind = 'inventory';

-- Owners manage their own links; a project link still needs a project they own.
drop policy if exists "Owners manage their share links" on public.shared_lists;
create policy "Owners manage their share links" on public.shared_lists
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      kind = 'inventory'
      or exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid()))
    )
  );

grant insert (kind) on table public.shared_lists to authenticated;

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

  if s.kind = 'inventory' then
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'name', ui.name,
                 'image_url', ui.image_url,
                 'category', ui.category,
                 'qty', coalesce(ui.qty, 1)
               ) order by ui.created_at
             ),
             '[]'::jsonb
           )
      into items
      from public.user_inventory ui
     where ui.user_id = s.user_id;

    update public.shared_lists
       set views = views + 1, last_viewed_at = now()
     where token = p_token;

    return jsonb_build_object('kind', 'inventory', 'name', 'Inventory', 'items', items);
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
    'kind', 'project',
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
