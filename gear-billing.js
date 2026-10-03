// Gear · Billing client — plans, credits and Stripe checkout.
//
// The database is the source of truth: public.plans / public.credit_packs
// hold limits and prices, get_my_billing() returns the signed-in user's plan,
// credits and usage, and triggers enforce the project / inventory limits. The
// app only mirrors those to show the right UI; it never decides entitlements.
//
// Exposes window.GEAR_BILLING.
(function () {
  // Shown until the price list loads from Supabase (and if it can't).
  const FALLBACK_CATALOG = {
    plans: {
      free: { id: 'free', name: 'Free', monthly_credits: 3, max_projects: 5, max_inventory_items: 50, pdf_branding: true, price_pence: null, currency: 'gbp' },
      pro: { id: 'pro', name: 'Pro', monthly_credits: 40, max_projects: null, max_inventory_items: null, pdf_branding: false, price_pence: 1200, currency: 'gbp' },
    },
    packs: [{ id: 'credits_20', name: '20 Suggest credits', credits: 20, price_pence: 500, currency: 'gbp' }],
  };

  const cfg = () => window.SUPABASE_CONFIG || {};
  const client = (session) => window.supabase.createClient(cfg().url, cfg().anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: session ? { Authorization: `Bearer ${session.access_token}` } : {} },
  });
  const available = () => !!(window.supabase && cfg().url && cfg().anonKey);

  async function loadCatalog() {
    if (!available()) return FALLBACK_CATALOG;
    const sb = client(null);
    const [plans, packs] = await Promise.all([
      sb.from('plans').select('*').order('sort'),
      sb.from('credit_packs').select('*').eq('active', true).order('sort'),
    ]);
    if (plans.error || packs.error || !plans.data?.length) return FALLBACK_CATALOG;
    return {
      plans: Object.fromEntries(plans.data.map(p => [p.id, p])),
      packs: packs.data,
    };
  }

  // { plan, plan_name, monthly_credits, monthly_allowance, bonus_credits,
  //   next_refill, max_projects, max_inventory_items, pdf_branding,
  //   projects_used, inventory_used, subscription_status, current_period_end,
  //   cancel_at_period_end, has_billing_account }
  async function loadStatus(session) {
    if (!available() || !session) return null;
    const { data, error } = await client(session).rpc('get_my_billing');
    if (error) throw new Error(error.message);
    return data;
  }

  async function loadHistory(session, limit = 12) {
    if (!available() || !session) return [];
    const { data, error } = await client(session)
      .from('credit_ledger')
      .select('id, delta, monthly_after, bonus_after, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  }

  async function callBillingFunction(session, body) {
    let res;
    try {
      res = await fetch(`${cfg().url}/functions/v1/billing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': cfg().anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...body, return_url: window.location.origin + window.location.pathname }),
      });
    } catch (e) {
      throw Object.assign(new Error('Couldn’t reach the payment service. Check your connection and try again.'), { code: 'network' });
    }
    let data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok || !data || !data.url) {
      const err = new Error((data && data.error) || `Billing service responded ${res.status}`);
      err.code = (data && data.code) || (res.status === 404 ? 'billing-not-configured' : 'http');
      throw err;
    }
    return data.url;
  }

  // Sends the browser to Stripe Checkout. `product` is 'pro' or a credit pack
  // id. Remembers what was bought so the app can confirm it on return.
  async function checkout(session, product, status) {
    const url = await callBillingFunction(session, { action: 'checkout', product });
    try {
      sessionStorage.setItem('gear.billing.pending', JSON.stringify({
        product, plan: status && status.plan, bonus: status ? status.bonus_credits : null, at: Date.now(),
      }));
    } catch (e) {}
    window.location.assign(url);
  }

  async function openPortal(session) {
    window.location.assign(await callBillingFunction(session, { action: 'portal' }));
  }

  // The limit triggers raise "plan_limit:<projects|inventory>:<limit>".
  function planLimitFromError(err) {
    const m = String((err && err.message) || err || '').match(/plan_limit:(\w+):(\d+)/);
    return m ? { resource: m[1], limit: Number(m[2]) } : null;
  }

  const totalCredits = (status) => status ? (status.monthly_credits || 0) + (status.bonus_credits || 0) : 0;

  // True when the user's plan caps `resource` and they've reached it. Unknown
  // status (still loading, offline) never blocks — the database still enforces.
  function atLimit(status, resource, used) {
    if (!status) return false;
    const limit = resource === 'projects' ? status.max_projects : status.max_inventory_items;
    return limit != null && used >= limit;
  }

  function money(pence, currency = 'gbp') {
    if (pence == null) return '';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: String(currency).toUpperCase(),
      minimumFractionDigits: pence % 100 ? 2 : 0,
    }).format(pence / 100);
  }

  function shortDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  window.GEAR_BILLING = {
    FALLBACK_CATALOG,
    loadCatalog, loadStatus, loadHistory,
    checkout, openPortal,
    planLimitFromError, totalCredits, atLimit,
    money, shortDate,
  };
})();
