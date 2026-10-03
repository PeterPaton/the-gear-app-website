// Supabase Edge Function: stripe-webhook
// ------------------------------------------------------------------
// Applies Stripe events to public.entitlements: Pro subscriptions start,
// renew (refilling monthly credits), change and end; paid credit packs add
// top-up credits. Each event is verified with STRIPE_WEBHOOK_SECRET and
// applied at most once (public.stripe_events).
//
// Stripe endpoint URL: https://<project-ref>.supabase.co/functions/v1/stripe-webhook
// Events: checkout.session.completed, checkout.session.async_payment_succeeded,
//         customer.subscription.created, customer.subscription.updated,
//         customer.subscription.deleted, invoice.paid
//
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
// Deploy with verify_jwt = false: Stripe can't send a Supabase JWT, so the
// signature check below is the authentication.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@23.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

async function rpc(fn: string, args: Record<string, unknown>) {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
}

async function userForCustomer(customerId: string): Promise<string | null> {
  const { data } = await admin.from("entitlements").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
  return data?.user_id ?? null;
}

// Re-reads the subscription from Stripe so events arriving out of order can't
// apply stale state. Returns the user it belongs to.
async function syncSubscription(stripe: Stripe, subscriptionId: string, userHint?: string | null): Promise<string | null> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const userId = userHint || sub.metadata?.user_id || await userForCustomer(customerId);
  if (!userId) {
    console.warn(`[stripe-webhook] no user for subscription ${sub.id}`);
    return null;
  }
  const periodEnd = sub.items.data[0]?.current_period_end;
  await rpc("apply_subscription", {
    p_user: userId,
    p_customer: customerId,
    p_subscription: sub.id,
    p_status: sub.status,
    p_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    p_cancel_at_period_end: sub.cancel_at_period_end || sub.cancel_at != null,
  });
  return userId;
}

async function handle(stripe: Stripe, event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object;
      const userId = s.client_reference_id || s.metadata?.user_id;
      if (!userId) return;
      if (s.mode === "subscription" && s.subscription) {
        await syncSubscription(stripe, typeof s.subscription === "string" ? s.subscription : s.subscription.id, userId);
      } else if (s.mode === "payment" && s.payment_status === "paid" && s.metadata?.pack_id) {
        // Delayed payment methods finish later, in async_payment_succeeded.
        const { data: pack, error } = await admin.from("credit_packs").select("credits").eq("id", s.metadata.pack_id).single();
        if (error || !pack) throw new Error(`unknown credit pack ${s.metadata.pack_id}`);
        await rpc("grant_bonus_credits", { p_user: userId, p_amount: pack.credits, p_reason: "credit_pack", p_ref: s.id });
      }
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      await syncSubscription(stripe, sub.id, sub.metadata?.user_id);
      return;
    }
    case "invoice.paid": {
      const invoice = event.data.object;
      if (invoice.billing_reason !== "subscription_cycle") return; // first payment is handled by checkout
      // Where the subscription id sits depends on the endpoint's API version:
      // parent.subscription_details from 2025-03-31 on, top-level before that.
      const legacy = (invoice as unknown as { subscription?: string | { id: string } | null }).subscription;
      const ref = invoice.parent?.subscription_details?.subscription ?? legacy;
      const subscriptionId = typeof ref === "string" ? ref : ref?.id;
      if (!subscriptionId) return;
      const userId = await syncSubscription(stripe, subscriptionId);
      if (userId) await rpc("refill_monthly_credits", { p_user: userId, p_ref: invoice.id });
      return;
    }
    default:
      return;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) return new Response("Stripe is not configured", { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing Stripe-Signature", { status: 400 });

  const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() });
  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret, undefined, cryptoProvider);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  // Claim the event id first so a retry that overlaps can't apply it twice.
  const { error: claimError } = await admin.from("stripe_events").insert({ id: event.id, type: event.type });
  if (claimError) {
    if (claimError.code === "23505") return new Response("already processed");
    return new Response(claimError.message, { status: 500 });
  }
  try {
    await handle(stripe, event);
    return new Response("ok");
  } catch (e) {
    console.error(`[stripe-webhook] ${event.type} ${event.id}:`, e);
    // Release the claim so Stripe's retry runs it again.
    await admin.from("stripe_events").delete().eq("id", event.id);
    return new Response("handler failed", { status: 500 });
  }
});
