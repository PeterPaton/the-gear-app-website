// Studio billing UI — the upgrade screen (paywall), the credits badge on the
// Suggest page, and the Billing tab of the Account page. Data and Stripe calls
// live in gear-billing.js.
(function () {
  const S = window.STUDIO_STYLES;
  const T = S.T;
  const B = () => window.GEAR_BILLING;

  // What each plan includes, in the order shown on cards.
  function planFeatures(plan) {
    return [
      `${plan.monthly_credits} Suggest credits a month`,
      plan.max_projects == null ? 'Unlimited projects' : `${plan.max_projects} projects`,
      plan.max_inventory_items == null ? 'Unlimited inventory' : `${plan.max_inventory_items} inventory items`,
      plan.pdf_branding ? 'PDF exports with Gear branding' : 'Clean, unbranded PDF exports',
    ];
  }

  function reasonCopy(reason, status) {
    const refill = status && status.next_refill ? ` Your monthly credits refill on ${B().shortDate(status.next_refill)}.` : '';
    switch (reason) {
      case 'projects':
        return { title: `You've reached ${status?.max_projects ?? 'the'} projects on the Free plan`, sub: 'Upgrade to Pro for unlimited projects. Your existing projects stay as they are.' };
      case 'inventory':
        return { title: `Your inventory is at the Free limit of ${status?.max_inventory_items ?? ''} items`, sub: 'Upgrade to Pro for unlimited inventory.' };
      case 'credits':
        return { title: "You're out of Suggest credits", sub: `Top up, or go Pro for a bigger monthly allowance.${refill}` };
      case 'branding':
        return { title: 'Export clean PDFs', sub: 'Pro removes The Gear App branding from your exported lists.' };
      default:
        return { title: 'Upgrade to Pro', sub: 'More AI kit builds, no limits on projects or inventory, and clean PDF exports.' };
    }
  }

  // ── Paywall ────────────────────────────────────────────────────────────
  function PricingModal({ reason, status, catalog, onClose, onCheckout, onManage, busy, error }) {
    const free = catalog.plans.free;
    const pro = catalog.plans.pro;
    const pack = catalog.packs[0];
    const isPro = status && status.plan === 'pro';
    const comped = isPro && !status.subscription_status; // Pro granted without a Stripe subscription
    const copy = reasonCopy(reason, status);

    const planCard = (plan, highlight) => {
      const current = status ? status.plan === plan.id : plan.id === 'free';
      return (
        <div style={{ flex: '1 1 260px', border: `${highlight ? 2 : 1}px solid ${highlight ? T.orange : T.paperEdge}`, borderRadius: 6, padding: 20, background: highlight ? '#fff8f4' : '#fff', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <div style={{ ...S.label, color: highlight ? T.orange : T.textMute }}>{plan.name}</div>
            {current && <span style={S.pill(T.paperLight, T.ink)}>Current plan</span>}
          </div>
          <div style={{ fontFamily: S.mono, display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em' }}>{plan.price_pence ? B().money(plan.price_pence, plan.currency) : B().money(0, plan.currency)}</span>
            <span style={{ fontSize: 12, color: T.textMute }}>{plan.price_pence ? '/ month' : 'forever'}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
            {planFeatures(plan).map(f => (
              <div key={f} style={{ display: 'flex', gap: 8, fontSize: 13, color: T.ink, lineHeight: 1.35 }}>
                <span style={{ color: highlight ? T.orange : T.textMute, fontFamily: S.mono, fontWeight: 700 }}>✓</span>{f}
              </div>
            ))}
          </div>
          {plan.id === 'pro' && (comped ? (
            <div style={{ fontFamily: S.mono, fontSize: 11, color: T.ok, textAlign: 'center', padding: 12 }}>Complimentary · no payment needed</div>
          ) : isPro ? (
            <button onClick={onManage} disabled={!!busy} style={{ ...S.btnDark, padding: 12 }}>{busy === 'portal' ? 'Opening…' : 'Manage subscription'}</button>
          ) : (
            <button onClick={() => onCheckout('pro')} disabled={!!busy} style={{ ...S.btnP, padding: 12, opacity: busy ? 0.6 : 1 }}>
              {busy === 'pro' ? 'Opening checkout…' : `Upgrade to Pro · ${B().money(plan.price_pence, plan.currency)}/mo`}
            </button>
          ))}
        </div>
      );
    };

    return (
      <div style={S.modalOverlay} onClick={busy ? undefined : onClose}>
        <div style={{ ...S.modal, width: 720, maxWidth: 'calc(100vw - 32px)' }} onClick={e => e.stopPropagation()}>
          <div style={{ padding: '24px 28px 18px', borderBottom: `1px solid ${T.paperEdge}`, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ ...S.label, color: T.orange, marginBottom: 6 }}>{isPro ? 'Your plan' : 'Upgrade'}</div>
              <div style={{ fontFamily: S.mono, fontSize: 21, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.25 }}>{copy.title}</div>
              <div style={{ fontSize: 13, color: T.textMute, marginTop: 6, lineHeight: 1.5 }}>{copy.sub}</div>
            </div>
            <button onClick={onClose} disabled={!!busy} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: T.textMute, padding: 0, width: 30, height: 30, lineHeight: 1, flexShrink: 0 }}>×</button>
          </div>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', flex: 1, minHeight: 0 }}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {planCard(free, false)}
              {planCard(pro, true)}
            </div>
            {pack && (
              <div style={{ border: `1px solid ${T.paperEdge}`, borderRadius: 6, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Need more Suggest credits?</div>
                  <div style={{ fontSize: 12, color: T.textMute, marginTop: 2 }}>{pack.credits} credits for {B().money(pack.price_pence, pack.currency)} on any plan. They never expire and are used after your monthly credits.</div>
                </div>
                <button onClick={() => onCheckout(pack.id)} disabled={!!busy} style={{ ...S.btnG, opacity: busy ? 0.6 : 1 }}>
                  {busy === pack.id ? 'Opening checkout…' : `Buy ${pack.credits} credits`}
                </button>
              </div>
            )}
            {error && (
              <div style={{ background: '#fde6dd', color: T.err, border: `1px solid ${T.err}`, borderRadius: 4, padding: '10px 14px', fontSize: 12, fontFamily: S.mono }}>{error}</div>
            )}
            <div style={{ fontSize: 11, color: T.textMute, fontFamily: S.mono, letterSpacing: '0.02em' }}>
              Secure checkout by Stripe. Cancel any time from Account → Billing.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Credits badge (Suggest page header) ────────────────────────────────
  function CreditBadge({ status, onGetMore }) {
    if (!status) return null;
    const total = B().totalCredits(status);
    const empty = total === 0;
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#fff', border: `1px solid ${empty ? T.err : T.paperEdge}`, borderRadius: 4, padding: '7px 12px', fontFamily: S.mono, fontSize: 11 }}>
        <span style={{ fontWeight: 700, color: empty ? T.err : T.ink }}>{total} credit{total === 1 ? '' : 's'}</span>
        <span style={{ color: T.textMute }}>
          {status.monthly_credits}/{status.monthly_allowance} monthly{status.bonus_credits ? ` + ${status.bonus_credits} top-up` : ''}
          {status.next_refill ? ` · refills ${B().shortDate(status.next_refill)}` : ''}
        </span>
        <button onClick={onGetMore} style={{ background: 'none', border: 'none', padding: 0, color: T.orange, fontFamily: S.mono, fontSize: 11, fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {status.plan === 'pro' ? 'Top up' : 'Get more'}
        </button>
      </div>
    );
  }

  // ── Account → Billing ──────────────────────────────────────────────────
  const LEDGER_LABEL = {
    complimentary_pro: 'Complimentary Pro',
    suggest_generate: 'Kit generated',
    suggest_refine: 'Kit changed',
    refund: 'Refund (AI unavailable)',
    credit_pack: 'Credits purchased',
    monthly_refill: 'Monthly credits refilled',
    upgraded_to_pro: 'Upgraded to Pro',
    downgraded_to_free: 'Moved to Free',
  };

  function UsageBar({ label, used, limit }) {
    const pct = limit == null ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
    const full = limit != null && used >= limit;
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: S.mono, fontSize: 11, marginBottom: 6 }}>
          <span style={{ color: T.textMute, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10 }}>{label}</span>
          <span style={{ color: full ? T.err : T.ink, fontWeight: 600 }}>{used}{limit == null ? ' · unlimited' : ` / ${limit}`}</span>
        </div>
        {limit != null && (
          <div style={{ height: 6, background: T.paperLight, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: full ? T.err : T.orange }} />
          </div>
        )}
      </div>
    );
  }

  function BillingPanel({ status, catalog, history, error, busy, onUpgrade, onBuyCredits, onManage }) {
    const card = { background: '#fff', border: `1px solid ${T.paperEdge}`, borderRadius: 6, overflow: 'hidden' };
    const head = { padding: '14px 20px', borderBottom: '1px solid #f0ebe2', fontFamily: S.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' };
    if (!status) {
      return (
        <div style={{ ...card, padding: 24, fontFamily: S.mono, fontSize: 12, color: error ? T.err : T.textMute }}>
          {error ? `Couldn't load billing: ${error}` : 'Loading your plan…'}
        </div>
      );
    }
    const plan = catalog.plans[status.plan] || catalog.plans.free;
    const pack = catalog.packs[0];
    const isPro = status.plan === 'pro';
    const comped = isPro && !status.subscription_status;
    let planLine = 'Free forever. Upgrade any time.';
    if (comped) {
      planLine = 'Complimentary Pro. No payment needed.';
    } else if (isPro) {
      if (status.subscription_status === 'past_due') planLine = "Your last payment didn't go through. Update your card to keep Pro.";
      else if (status.cancel_at_period_end) planLine = `Cancelled. Pro stays active until ${B().shortDate(status.current_period_end)}.`;
      else planLine = `${B().money(plan.price_pence, plan.currency)} / month · renews ${B().shortDate(status.current_period_end)}`;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={card}>
          <div style={head}>Plan</div>
          <div style={{ padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: S.mono, fontSize: 22, fontWeight: 600 }}>{plan.name}</div>
              <div style={{ fontSize: 12, color: status.subscription_status === 'past_due' ? T.err : T.textMute, marginTop: 3 }}>{planLine}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
                {planFeatures(plan).map(f => <div key={f} style={{ fontSize: 12, color: T.ink }}>✓ {f}</div>)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(isPro && !comped) || status.has_billing_account ? (
                <button style={S.btnG} disabled={!!busy} onClick={onManage}>{busy === 'portal' ? 'Opening…' : (isPro && !comped ? 'Manage subscription' : 'Invoices')}</button>
              ) : null}
              {!isPro && <button style={S.btnP} disabled={!!busy} onClick={onUpgrade}>Upgrade to Pro</button>}
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={head}>Suggest credits</div>
          <div style={{ padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 32, fontFamily: S.mono }}>
              <div>
                <div style={{ fontSize: 9, color: T.textMute, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>Monthly</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{status.monthly_credits} <span style={{ fontSize: 12, color: T.textMute }}>/ {status.monthly_allowance}</span></div>
                <div style={{ fontSize: 10, color: T.textMute, marginTop: 2 }}>refills {B().shortDate(status.next_refill)}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: T.textMute, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>Top-up</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{status.bonus_credits}</div>
                <div style={{ fontSize: 10, color: T.textMute, marginTop: 2 }}>never expire</div>
              </div>
            </div>
            {pack && (
              <button style={S.btnG} disabled={!!busy} onClick={() => onBuyCredits(pack.id)}>
                {busy === pack.id ? 'Opening checkout…' : `Buy ${pack.credits} · ${B().money(pack.price_pence, pack.currency)}`}
              </button>
            )}
          </div>
        </div>

        <div style={card}>
          <div style={head}>Usage</div>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <UsageBar label="Projects" used={status.projects_used} limit={status.max_projects} />
            <UsageBar label="Inventory items" used={status.inventory_used} limit={status.max_inventory_items} />
          </div>
        </div>

        {error && (
          <div style={{ background: '#fde6dd', color: T.err, border: `1px solid ${T.err}`, borderRadius: 4, padding: '10px 14px', fontSize: 12, fontFamily: S.mono }}>{error}</div>
        )}

        <div style={card}>
          <div style={head}>Credit history</div>
          {(!history || history.length === 0) ? (
            <div style={{ padding: 20, fontSize: 12, color: T.textMute }}>No credit activity yet.</div>
          ) : history.map(h => (
            <div key={h.id} style={{ padding: '11px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0ebe2', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13 }}>{LEDGER_LABEL[h.reason] || h.reason}</div>
                <div style={{ fontSize: 10, color: T.textMute, fontFamily: S.mono, marginTop: 2 }}>{new Date(h.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div style={{ fontFamily: S.mono, fontSize: 12, fontWeight: 600, color: h.delta < 0 ? T.ink : h.delta > 0 ? T.ok : T.textMute }}>
                {h.delta > 0 ? '+' : ''}{h.delta !== 0 ? h.delta : '—'}
                <span style={{ color: T.textMute, fontWeight: 400, marginLeft: 10 }}>bal {h.monthly_after + h.bonus_after}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  window.STUDIO_BILLING = { PricingModal, CreditBadge, BillingPanel, planFeatures };
})();
