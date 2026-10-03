-- Tighten table privileges on the billing tables (RLS already blocks these;
-- this also hides them from the public API schema).
--   stripe_events, suggest_runs: server only.
--   entitlements, credit_ledger: signed-in users may read their own rows.
revoke all on table public.stripe_events, public.suggest_runs from anon, authenticated;
revoke all on table public.entitlements, public.credit_ledger from anon;
revoke insert, update, delete, truncate, references, trigger on table public.entitlements, public.credit_ledger from authenticated;
-- The price list is read-only outside the dashboard / service role.
revoke insert, update, delete, truncate, references, trigger on table public.plans, public.credit_packs from anon, authenticated;
