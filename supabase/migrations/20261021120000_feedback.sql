-- Feedback sent from the app's "Leave feedback" form. Signed-in users can add
-- their own rows but not read any back; read them from the Supabase dashboard.
-- Rows go with the account when it is deleted (cascade from auth.users).
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default 'idea' check (kind in ('idea', 'problem', 'praise', 'other')),
  message text not null check (char_length(message) between 1 and 5000),
  email text,
  can_contact boolean not null default false,
  page text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);
create index if not exists feedback_user_id_idx on public.feedback (user_id);

alter table public.feedback enable row level security;

drop policy if exists "Users can send feedback" on public.feedback;
create policy "Users can send feedback" on public.feedback
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Insert-only: nothing for signed-out visitors, and signed-in users can't
-- read, change or delete feedback (keeps it out of the GraphQL schema too).
revoke all on table public.feedback from anon;
revoke all on table public.feedback from authenticated;
grant insert on table public.feedback to authenticated;
