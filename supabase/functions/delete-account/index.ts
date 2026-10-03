// Supabase Edge Function: delete-account
// ------------------------------------------------------------------
// Permanently deletes the signed-in user's account. Their Stripe customer is
// deleted first, which cancels any subscription immediately so they're never
// billed again (Stripe keeps its payment records). Deleting the auth user then
// removes every row that belongs to them: inventory, groups, projects and their
// items, plan, credits and credit history all cascade from auth.users.
//
//   POST { confirm: "DELETE" }  →  { ok: true }
//
// Secrets: STRIPE_SECRET_KEY (only needed if the user has a billing account).
// Deploy with verify_jwt = true.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@23.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  const user = auth.user;
  if (!user) return json({ error: "Sign in first", code: "auth" }, 401);

  let body: { confirm?: string } = {};
  try {
    body = await req.json();
  } catch { /* handled below */ }
  if (body.confirm !== "DELETE") return json({ error: "Type DELETE to confirm" }, 400);

  // Stop billing before anything is removed.
  const { data: ent } = await admin.from("entitlements").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
  if (ent?.stripe_customer_id) {
    const key = Deno.env.get("STRIPE_SECRET_KEY");
    if (!key) return json({ error: "Billing is unavailable right now, so the subscription can't be cancelled. Try again later." }, 503);
    const stripe = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
    try {
      await stripe.customers.del(ent.stripe_customer_id);
    } catch (e) {
      const missing = e instanceof Stripe.errors.StripeInvalidRequestError && e.code === "resource_missing";
      if (!missing) return json({ error: `Couldn't cancel billing: ${(e as Error).message}` }, 502);
    }
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});
