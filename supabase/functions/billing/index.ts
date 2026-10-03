// Supabase Edge Function: billing
// ------------------------------------------------------------------
// Starts Stripe Checkout for Pro or a credit pack, and opens the Stripe
// customer portal (card, invoices, cancel). Prices and credit amounts come
// from the public.plans and public.credit_packs tables, so editing those rows
// changes checkout too. Payments are applied by the stripe-webhook function.
//
//   POST { action: "checkout", product: "pro" | <credit_packs.id>, return_url }
//   POST { action: "portal", return_url }
//   → { url }   the browser redirects there
//
// Secrets: STRIPE_SECRET_KEY. Deploy with verify_jwt = true.

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

// Where Stripe may send people back to: the production site, this project's
// Vercel previews, and local development.
function safeReturnUrl(raw: unknown): string | null {
  try {
    const u = new URL(String(raw));
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    const allowed = local ||
      u.hostname === "gearapp.io" || u.hostname === "www.gearapp.io" ||
      (u.hostname.endsWith(".vercel.app") && u.hostname.startsWith("the-gear-app-website"));
    if (!allowed || (!local && u.protocol !== "https:")) return null;
    return u.origin + u.pathname;
  } catch {
    return null;
  }
}

// A saved customer id can be stale — e.g. created with test keys before
// switching to live ones. Returns null when Stripe no longer knows it.
async function liveCustomer(stripe: Stripe, id: string | null): Promise<string | null> {
  if (!id) return null;
  try {
    const customer = await stripe.customers.retrieve(id);
    return customer.deleted ? null : customer.id;
  } catch (e) {
    if (e instanceof Stripe.errors.StripeInvalidRequestError && e.code === "resource_missing") return null;
    throw e;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  const user = auth.user;
  if (!user) return json({ error: "Sign in first", code: "auth" }, 401);

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return json({ error: "Payments aren't set up yet", code: "billing-not-configured" }, 503);
  const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() });

  let body: { action?: string; product?: string; return_url?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const returnUrl = safeReturnUrl(body.return_url);
  if (!returnUrl) return json({ error: "Invalid return_url" }, 400);

  const { data: ent, error: entError } = await admin.rpc("ensure_entitlements", { p_user: user.id });
  if (entError) return json({ error: entError.message }, 500);

  try {
    let customerId = await liveCustomer(stripe, ent.stripe_customer_id);
    if (body.action === "portal") {
      if (!customerId) return json({ error: "No billing account yet", code: "no-billing-account" }, 400);
      const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
      return json({ url: portal.url });
    }
    if (body.action !== "checkout") return json({ error: "Unknown action" }, 400);

    // One Stripe customer per user; the idempotency key stops double clicks
    // from creating two.
    if (!customerId) {
      const customer = await stripe.customers.create(
        { email: user.email, metadata: { user_id: user.id } },
        { idempotencyKey: `customer-${user.id}-${ent.stripe_customer_id ?? "new"}` },
      );
      customerId = customer.id;
      const { error } = await admin.from("entitlements").update({ stripe_customer_id: customerId }).eq("user_id", user.id);
      if (error) return json({ error: error.message }, 500);
    }

    const product = String(body.product || "");
    if (product === "pro") {
      if (ent.plan === "pro" && ent.stripe_subscription_id) {
        return json({ error: "You're already on Pro", code: "already-subscribed" }, 409);
      }
      const { data: plan, error } = await admin.from("plans").select("*").eq("id", "pro").single();
      if (error || !plan?.price_pence) return json({ error: "Pro plan isn't configured" }, 500);
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        client_reference_id: user.id,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: plan.currency,
            unit_amount: plan.price_pence,
            recurring: { interval: "month" },
            product_data: {
              name: "The Gear App Pro",
              description: `${plan.monthly_credits} Suggest credits a month, unlimited projects and inventory, unbranded PDF exports`,
            },
          },
        }],
        subscription_data: { metadata: { user_id: user.id } },
        metadata: { user_id: user.id, product: "pro" },
        allow_promotion_codes: true,
        success_url: `${returnUrl}?billing=success&product=pro`,
        cancel_url: `${returnUrl}?billing=cancelled`,
      });
      return json({ url: session.url });
    }

    const { data: pack } = await admin.from("credit_packs").select("*").eq("id", product).eq("active", true).maybeSingle();
    if (!pack) return json({ error: "Unknown product" }, 400);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: pack.currency,
          unit_amount: pack.price_pence,
          product_data: { name: pack.name, description: "Top-up credits for Suggest. They never expire." },
        },
      }],
      metadata: { user_id: user.id, pack_id: pack.id },
      payment_intent_data: { metadata: { user_id: user.id, pack_id: pack.id } },
      success_url: `${returnUrl}?billing=success&product=${encodeURIComponent(pack.id)}`,
      cancel_url: `${returnUrl}?billing=cancelled`,
    });
    return json({ url: session.url });
  } catch (e) {
    const message = e instanceof Stripe.errors.StripeError ? e.message : (e as Error)?.message || String(e);
    return json({ error: message, code: "stripe" }, 502);
  }
});
