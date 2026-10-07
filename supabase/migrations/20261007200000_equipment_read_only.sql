-- The equipment catalog is shared by everyone and the app only ever reads it,
-- but hand-made policies let any signed-in user insert, update or delete
-- catalog rows. Drop them so only the dashboard and the service role (which
-- bypass RLS) can edit the catalog. "Public read" stays.
drop policy if exists "Authenticated insert" on public.equipment;
drop policy if exists "Authenticated update" on public.equipment;
drop policy if exists "Authenticated delete" on public.equipment;
