// Gear · Login & Account pages.
(function () {
  const { useState, useEffect } = React;
  const S = window.STUDIO_STYLES;
  const T = S.T;

  // Phones get the phone layout (studio-mobile.jsx) and the phone sign-in
  // screen. Narrow windows count, and so do touch screens held sideways
  // (wide but short), which a width test alone would hand the desktop UI.
  // index.html uses the same media query for its phone-only CSS.
  const PHONE_QUERY = '(max-width: 819px), (pointer: coarse) and (max-height: 500px)';
  function useIsMobile() {
    const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches);
    useEffect(() => {
      const mq = window.matchMedia(PHONE_QUERY);
      const onChange = () => setM(mq.matches);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }, []);
    return m;
  }

  // ─── Login page ─────────────────────────────────────────────
  function LoginPage({ onSignIn, catalog = [] }) {
    const isMobile = useIsMobile();
    const [mode, setMode] = useState('signin'); // signin | signup
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(() => window.GEAR_AUTH.remember());
    const [showGuide, setShowGuide] = useState(false);
    const [plans, setPlans] = useState(window.GEAR_BILLING.FALLBACK_CATALOG);
    React.useEffect(() => { window.GEAR_BILLING.loadCatalog().then(setPlans).catch(() => {}); }, []);
    const [busy, setBusy] = useState(false);
    // Auth clients store the session where "Keep me signed in" says to.
    const authClient = () => {
      window.GEAR_AUTH.setRemember(remember);
      return window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey, { auth: { storage: window.GEAR_AUTH.storage() } });
    };

    const submit = async (e) => {
      e.preventDefault();
      setBusy(true);
      try {
        if (!window.GEAR_DB?.enabled || !window.supabase) {
          throw new Error('Authentication is unavailable right now. Please try again in a moment.');
        }
        const sb = authClient();
        if (mode === 'reset') {
          const host = window.location.hostname;
          const isLocal = host === 'localhost' || host === '127.0.0.1';
          const redirectTo = isLocal ? (window.location.origin + window.location.pathname) : 'https://www.gearapp.io/';
          const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
          if (error) throw error;
          alert('Password reset email sent. Check your inbox.');
          setMode('signin');
          return;
        }
        const fn = mode === 'signin' ? 'signInWithPassword' : 'signUp';
        const { data, error } = await sb.auth[fn]({ email, password });
        if (error) throw error;
        if (mode === 'signup' && !data.session) {
          // Email confirmation enabled in Supabase — no session yet.
          alert('Check your email and click the confirmation link to finish creating your account.');
          setMode('signin');
          return;
        }
        onSignIn(
          { email: data.user?.email || email, name: email.split('@')[0] },
          data.session
        );
      } catch (err) {
        alert(err.message || 'Sign-in failed');
      } finally { setBusy(false); }
    };

    const oauth = async (provider) => {
      if (!window.GEAR_DB?.enabled || !window.supabase) {
        alert('Authentication is unavailable right now. Please try again in a moment.');
        return;
      }
      const sb = authClient();
      // Always come back to the production domain after OAuth — keeps the
      // session cookie + storage scoped to one origin even when someone
      // arrived via a Vercel preview URL. Local dev still round-trips on
      // its own origin so OAuth can be tested without deploying.
      const host = window.location.hostname;
      const isLocal = host === 'localhost' || host === '127.0.0.1';
      const redirectTo = isLocal
        ? (window.location.origin + window.location.pathname)
        : 'https://www.gearapp.io/';
      const { error } = await sb.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (error) alert(`${provider} sign-in failed: ${error.message}`);
    };

    if (showGuide && window.STUDIO_GUIDE) {
      return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', overflow: 'hidden' }}>
          <window.STUDIO_GUIDE catalog={plans} items={catalog} closeLabel="← Back to sign in" onClose={() => setShowGuide(false)} onCreateAccount={() => { setShowGuide(false); setMode('signup'); }} />
        </div>
      );
    }

    const form = (
      <React.Fragment>
        <div style={{ ...S.label, marginBottom: 8 }}>{mode === 'signin' ? 'Welcome back' : 'Get started'}</div>
        <div style={{ fontFamily: S.mono, fontSize: isMobile ? 24 : 30, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: mode === 'signup' ? 8 : 28 }}>
          {mode === 'signin' ? 'Sign in to the Gear App' : mode === 'signup' ? 'Create your account' : 'Reset your password'}
        </div>
        {mode === 'signup' && (
          <div style={{ fontSize: 13, color: T.textMute, marginBottom: 24 }}>Start on the Free plan. No card needed; upgrade to Pro any time.</div>
        )}

        {/* OAuth */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          <button onClick={() => oauth('google')} style={oauthBtn}>
            <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.7l6.2 5.2C41 35.5 44 30.2 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            Continue with Google
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '12px 0 20px', color: T.textMute, fontFamily: S.mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          <div style={{ flex: 1, height: 1, background: T.paperEdge }}></div>
          or with email
          <div style={{ flex: 1, height: 1, background: T.paperEdge }}></div>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={S.field}>
            <label style={S.label}>Email</label>
            <input type="email" required style={S.input} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@studio.com" autoFocus={!isMobile} />
          </div>
          {mode !== 'reset' && (
            <div style={S.field}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label style={S.label}>Password</label>
                {mode === 'signin' && (
                  <a href="#" onClick={(e) => { e.preventDefault(); setMode('reset'); }} style={{ ...S.label, color: T.orange, textDecoration: 'none' }}>Forgot?</a>
                )}
              </div>
              <input type="password" required style={S.input} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
          )}
          {mode !== 'reset' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.ink, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ width: 15, height: 15, accentColor: T.orange, margin: 0, cursor: 'pointer' }} />
              Keep me signed in
            </label>
          )}
          <button type="submit" disabled={busy} style={{ ...S.btnP, padding: 12, marginTop: 8, opacity: busy ? 0.6 : 1 }}>
            {busy ? '...' : (mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset email')}
          </button>
        </form>

        <div style={{ marginTop: 24, fontSize: 12, color: T.textMute, textAlign: 'center' }}>
          {mode === 'reset' ? (
            <a href="#" onClick={(e) => { e.preventDefault(); setMode('signin'); }} style={{ color: T.ink, fontWeight: 600 }}>← Back to sign in</a>
          ) : (
            <React.Fragment>
              {mode === 'signin' ? "New to Gear? " : 'Already have an account? '}
              <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === 'signin' ? 'signup' : 'signin'); }} style={{ color: T.ink, fontWeight: 600 }}>
                {mode === 'signin' ? 'Create account' : 'Sign in'}
              </a>
            </React.Fragment>
          )}
        </div>
      </React.Fragment>
    );

    // Phone: the brand photo up top and the same form in a sheet below it.
    if (isMobile) {
      return (
        <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: '#fff', color: T.ink }}>
          <div style={{ minHeight: 280, padding: 'calc(env(safe-area-inset-top) + 24px) 24px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 40, color: '#fff', background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0.85) 100%), #0c0c0c url(login-bg.jpg) center / cover no-repeat' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="app-icon.jpg" alt="Gear" style={{ width: 30, height: 30, borderRadius: 7 }} />
              <div style={{ fontFamily: S.mono, fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>THE GEAR APP</div>
            </div>
            <div>
              <div style={{ fontFamily: S.sans, fontSize: 'clamp(32px, 9vw, 46px)', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.05, marginBottom: 10 }}>
                All your gear,<br />in one place.
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,0.75)' }}>
                Organise your equipment, track your inventory and prep for every shoot.
              </div>
            </div>
          </div>
          <div style={{ position: 'relative', marginTop: -16, background: '#fff', borderRadius: '16px 16px 0 0', padding: '28px 22px calc(env(safe-area-inset-bottom) + 32px)' }}>
            {form}
          </div>
        </div>
      );
    }

    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', background: T.ink, color: '#fff', overflow: 'hidden' }}>
        {/* Left — brand panel, with the subtle dot grid behind the hero copy. */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '40px 56px', background: T.ink, borderRight: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '22px 22px', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="app-icon.jpg" alt="Gear" style={{ width: 36, height: 36, borderRadius: 8 }} />
            <div style={{ fontFamily: S.mono, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>THE GEAR APP</div>
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{ fontFamily: S.sans, fontSize: 'clamp(56px, 7vw, 96px)', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.0, marginBottom: 22, maxWidth: 800 }}>
              All your gear,<br />in one place.
            </div>
            <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', maxWidth: 520, lineHeight: 1.55 }}>
              Organise your equipment, track your inventory and prep for every shoot.
            </div>
            <button onClick={() => setShowGuide(true)} style={{ marginTop: 26, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', borderRadius: 4, padding: '10px 16px', cursor: 'pointer', fontFamily: S.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              See how it works →
            </button>
            {/* A random mix of real gear from the database, bleeding to the panel edges. */}
            {window.STUDIO_GUIDE_MARQUEE && (
              <div style={{ margin: '34px -56px 0' }}>
                <window.STUDIO_GUIDE_MARQUEE items={catalog} dark count={28} />
              </div>
            )}
          </div>
          <div style={{ position: 'relative', display: 'flex', gap: 28, fontSize: 11, fontFamily: S.mono, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            <span>v2.4</span>
          </div>
        </div>

        {/* Right — form */}
        <div style={{ width: 480, background: '#fff', color: T.ink, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 56px' }}>
          {form}
        </div>
      </div>
    );
  }

  const oauthBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '11px 14px', background: '#fff', color: T.ink, border: `1px solid ${T.paperEdge}`, borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: S.sans, transition: 'background .12s' };

  // ─── Password recovery form ─────────────────────────────────
  // Shown when Supabase fires PASSWORD_RECOVERY (user clicked the reset
  // email and now has a one-time recovery session). They set a new password
  // and we hand control back to the App.
  function RecoveryForm({ onComplete }) {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const submit = async (e) => {
      e.preventDefault();
      if (password.length < 8) { alert('Use at least 8 characters.'); return; }
      if (password !== confirm) { alert('Passwords do not match.'); return; }
      setBusy(true);
      try {
        if (!window.GEAR_DB?.enabled || !window.supabase) throw new Error('Authentication is unavailable.');
        const sb = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey, { auth: { storage: window.GEAR_AUTH.storage() } });
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw error;
        alert('Password updated. You are now signed in.');
        if (onComplete) onComplete();
      } catch (err) {
        alert(err.message || 'Update failed');
      } finally { setBusy(false); }
    };
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.ink, color: '#fff' }}>
        <form onSubmit={submit} style={{ width: 380, maxWidth: 'calc(100vw - 32px)', padding: 32, background: '#fff', color: T.ink, borderRadius: 8 }}>
          <div style={{ ...S.label, marginBottom: 6 }}>Reset password</div>
          <div style={{ fontFamily: S.mono, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 20 }}>Set a new password</div>
          <div style={S.field}>
            <label style={S.label}>New password</label>
            <input type="password" required style={S.input} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" autoFocus />
          </div>
          <div style={{ ...S.field, marginTop: 12 }}>
            <label style={S.label}>Confirm password</label>
            <input type="password" required style={S.input} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Type it again" />
          </div>
          <button type="submit" disabled={busy} style={{ ...S.btnP, padding: 12, marginTop: 20, width: '100%', opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Saving…' : 'Update password'}
          </button>
        </form>
      </div>
    );
  }

  // ─── Account page ───────────────────────────────────────────
  function AccountPage({ user, session, onDeleteAccount, billing, billingCatalog, billingBusy, billingError, onRefreshBilling, onUpgrade, onBuyCredits, onManageBilling, onBack, onSignOut, onUpdate }) {
    const [section, setSection] = useState('profile');
    const [history, setHistory] = useState([]);
    const [deleting, setDeleting] = useState(false); // confirmation dialog open
    // Fresh plan, usage and credit history whenever Billing is opened.
    React.useEffect(() => {
      if (section !== 'billing' || !session) return;
      if (onRefreshBilling) onRefreshBilling();
      window.GEAR_BILLING.loadHistory(session).then(setHistory).catch(err => console.warn('[Account] credit history:', err.message));
    }, [section]);
    const [name, setName] = useState(user.name);
    const [email, setEmail] = useState(user.email);
    const [studio, setStudio] = useState(user.studio || '');

    const tabs = [
      { k: 'profile', label: 'Profile' },
      { k: 'workspace', label: 'Workspace' },
      { k: 'billing', label: 'Billing' },
      { k: 'security', label: 'Security' },
    ];

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f6f3ee', overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{ padding: '14px 28px', borderBottom: `1px solid ${T.paperEdge}`, background: '#fff', display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={onBack} style={{ ...S.btnG, padding: '6px 12px' }}>← Back</button>
          <div style={{ fontFamily: S.mono, fontSize: 11, color: T.textMute, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Account</div>
        </div>

        {/* Hero */}
        <div style={{ padding: '36px 40px 24px', background: '#fff', borderBottom: `1px solid ${T.paperEdge}`, display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ width: 84, height: 84, borderRadius: '50%', background: T.orange, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 700, fontFamily: S.mono }}>
            {(user.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: S.mono, fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>{user.name}</div>
            <div style={{ fontSize: 13, color: T.textMute, marginBottom: 8 }}>{user.email}</div>
            {billing && <span style={S.pill('#FFE4D6', '#B33A06')}>{billing.plan_name} plan</span>}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '0 28px', borderBottom: `1px solid ${T.paperEdge}`, background: '#fff' }}>
          {tabs.map(t => (
            <button key={t.k} onClick={() => setSection(t.k)} style={{ background: 'none', border: 'none', padding: '14px 16px', fontFamily: S.mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: section === t.k ? T.ink : T.textMute, cursor: 'pointer', borderBottom: section === t.k ? `2px solid ${T.orange}` : '2px solid transparent', fontWeight: 600 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {section === 'profile' && (
              <div style={card}>
                <div style={cardHead}>Profile</div>
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={S.field}><label style={S.label}>Full name</label><input style={S.input} value={name} onChange={e => setName(e.target.value)} /></div>
                  <div style={S.field}><label style={S.label}>Email</label><input style={S.input} value={email} onChange={e => setEmail(e.target.value)} /></div>
                  <div style={S.field}><label style={S.label}>Studio / company</label><input style={S.input} value={studio} onChange={e => setStudio(e.target.value)} placeholder="e.g. Atlas Films" /></div>
                  <div style={{ display: 'flex', gap: 8, paddingTop: 6 }}>
                    <button style={S.btnP} onClick={() => onUpdate({ name, email, studio })}>Save changes</button>
                    <button style={S.btnG}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
            {section === 'workspace' && (
              <div style={card}>
                <div style={cardHead}>Workspace</div>
                <Row label="Default location" value="Studio · LA" />
                <Row label="Currency" value="USD" />
                <Row label="Date format" value="MMM D, YYYY" />
                <Row label="Theme" value="Paper (light)" />
              </div>
            )}
            {section === 'billing' && window.STUDIO_BILLING && (
              <window.STUDIO_BILLING.BillingPanel
                status={billing}
                catalog={billingCatalog || window.GEAR_BILLING.FALLBACK_CATALOG}
                history={history}
                busy={billingBusy}
                error={billingError}
                onUpgrade={onUpgrade}
                onBuyCredits={onBuyCredits}
                onManage={onManageBilling}
              />
            )}
            {section === 'security' && (
              <React.Fragment>
                <div style={card}>
                  <div style={cardHead}>Password</div>
                  <Row label="Last changed" value="3 months ago" action="Change" />
                  <Row label="Two-factor auth" value="Enabled · Authenticator app" action="Manage" />
                </div>
                <div style={{ ...card, marginTop: 16, borderColor: '#f3d9d0' }}>
                  <div style={{ ...cardHead, color: '#B33A06' }}>Danger zone</div>
                  <div style={{ padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>Sign out everywhere</div>
                      <div style={{ fontSize: 12, color: T.textMute }}>Ends every active session.</div>
                    </div>
                    <button style={S.btnG} onClick={onSignOut}>Sign out</button>
                  </div>
                  <div style={{ padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0ebe2' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, color: '#B33A06' }}>Delete account</div>
                      <div style={{ fontSize: 12, color: T.textMute }}>Permanently delete your data. Cannot be undone.</div>
                    </div>
                    <button style={{ ...S.btnG, color: '#B33A06', borderColor: '#f3d9d0' }} onClick={() => setDeleting(true)}>Delete</button>
                  </div>
                </div>
              </React.Fragment>
            )}
          </div>
        </div>
        {deleting && <DeleteAccountDialog billing={billing} onConfirm={onDeleteAccount} onClose={() => setDeleting(false)} />}
      </div>
    );
  }

  // Type-to-confirm dialog for permanently deleting the account.
  function DeleteAccountDialog({ billing, onConfirm, onClose }) {
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const ready = text.trim() === 'DELETE' && !busy;
    const subscribed = billing && billing.plan === 'pro' && billing.subscription_status;
    const submit = async () => {
      if (!ready) return;
      setBusy(true);
      setError('');
      try { await onConfirm(); } catch (e) { setError(e.message || String(e)); setBusy(false); }
    };
    return (
      <div style={{ ...S.modalOverlay, zIndex: 300 }} onClick={busy ? undefined : onClose}>
        <div style={{ ...S.modal, width: 480 }} onClick={e => e.stopPropagation()} role="dialog" aria-label="Delete account">
          <div style={{ padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontFamily: S.mono, fontSize: 20, fontWeight: 700, color: '#B33A06' }}>Delete your account?</div>
            <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.6 }}>
              This permanently deletes your inventory, groups, projects, kit lists, Suggest credits and history. It can’t be undone.
              {subscribed && <span> Your Pro subscription is cancelled immediately and you won’t be charged again.</span>}
            </div>
            <div style={S.field}>
              <label style={S.label}>Type DELETE to confirm</label>
              <input style={S.input} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit(); }} autoFocus disabled={busy} placeholder="DELETE" />
            </div>
            {error && <div style={{ background: '#fde6dd', color: T.err, border: `1px solid ${T.err}`, borderRadius: 4, padding: '9px 12px', fontSize: 12, fontFamily: S.mono }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button style={S.btnG} onClick={onClose} disabled={busy}>Cancel</button>
              <button onClick={submit} disabled={!ready}
                style={{ ...S.btnP, background: '#B33A06', opacity: ready ? 1 : 0.45, cursor: ready ? 'pointer' : 'not-allowed' }}>
                {busy ? 'Deleting…' : 'Delete account'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const card = { background: '#fff', border: `1px solid ${T.paperEdge}`, borderRadius: 6, overflow: 'hidden' };
  const cardHead = { padding: '14px 20px', borderBottom: '1px solid #f0ebe2', fontFamily: S.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' };

  function Row({ label, value, action }) {
    return (
      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0ebe2' }}>
        <div>
          <div style={{ fontFamily: S.mono, fontSize: 10, color: T.textMute, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
          <div style={{ fontSize: 13 }}>{value}</div>
        </div>
        {action && <button style={S.btnG}>{action}</button>}
      </div>
    );
  }

  window.STUDIO_AUTH = { LoginPage, AccountPage, DeleteAccountDialog, useIsMobile, RecoveryForm };
})();
