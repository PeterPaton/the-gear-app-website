// Gear · Login & Account pages.
(function () {
  const { useState } = React;
  const S = window.STUDIO_STYLES;
  const T = S.T;

  // ─── Login page ─────────────────────────────────────────────
  function LoginPage({ onSignIn }) {
    const [mode, setMode] = useState('signin'); // signin | signup
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
      e.preventDefault();
      setBusy(true);
      // If Supabase is wired, route through it; otherwise fake-auth.
      try {
        if (window.GEAR_DB?.enabled && window.supabase) {
          const sb = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
          const fn = mode === 'signin' ? 'signInWithPassword' : 'signUp';
          const { data, error } = await sb.auth[fn]({ email, password });
          if (error) throw error;
          // Pass both user profile and the full session (contains access_token for RLS)
          onSignIn(
            { email: data.user?.email || email, name: email.split('@')[0], plan: 'Studio' },
            data.session
          );
        } else {
          await new Promise(r => setTimeout(r, 400));
          onSignIn({ email, name: email.split('@')[0] || 'Filmmaker', plan: 'Studio' }, null);
        }
      } catch (err) {
        alert(err.message || 'Sign-in failed');
      } finally { setBusy(false); }
    };

    const oauth = async (provider) => {
      if (window.GEAR_DB?.enabled && window.supabase) {
        const sb = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
        const { error } = await sb.auth.signInWithOAuth({
          provider,
          options: {
            // Send the user back to this exact page after auth — App's auth
            // listener picks up the session from the URL hash on return.
            redirectTo: window.location.origin + window.location.pathname,
          },
        });
        if (error) alert(`${provider} sign-in failed: ${error.message}`);
      } else {
        // Demo mode — fake the sign-in.
        onSignIn({ email: `you@${provider}.com`, name: 'Filmmaker', plan: 'Studio', provider });
      }
    };

    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', background: T.ink, color: '#fff', overflow: 'hidden' }}>
        {/* Left — brand panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '40px 48px', background: T.ink, borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="app-icon.jpg" alt="Gear" style={{ width: 36, height: 36, borderRadius: 8 }} />
            <div style={{ fontFamily: S.mono, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>THE GEAR APP</div>
          </div>
          <div>
            <div style={{ fontFamily: S.mono, fontSize: 64, fontWeight: 400, letterSpacing: '-0.03em', lineHeight: 0.95, marginBottom: 24, maxWidth: 560 }}>
              All your gear,<br/>in one place.
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', maxWidth: 460, lineHeight: 1.55 }}>
              Organise your equipment, track your inventory and prep for every shoot. 
            </div>
          </div>
          <div style={{ display: 'flex', gap: 28, fontSize: 11, fontFamily: S.mono, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            <span>v2.4</span>
            <span>· iOS · macOS · Web</span>
          </div>
        </div>

        {/* Right — form */}
        <div style={{ width: 480, background: '#fff', color: T.ink, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 56px' }}>
          <div style={{ ...S.label, marginBottom: 8 }}>{mode === 'signin' ? 'Welcome back' : 'Get started'}</div>
          <div style={{ fontFamily: S.mono, fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 28 }}>
            {mode === 'signin' ? 'Sign in to the Gear App' : 'Create your account'}
          </div>

          {/* OAuth */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            <button onClick={() => oauth('google')} style={oauthBtn}>
              <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.7l6.2 5.2C41 35.5 44 30.2 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
              Continue with Google
            </button>
            <button onClick={() => oauth('apple')} style={oauthBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
              Continue with Apple
            </button>
            <button onClick={() => oauth('github')} style={oauthBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.6.2 2.9.1 3.2.8.8 1.3 1.9 1.3 3.1 0 4.6-2.9 5.6-5.5 5.9.5.4.9 1.1.9 2.3v3.3c0 .3.1.7.8.6A12 12 0 0 0 12 .3"/></svg>
              Continue with GitHub
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
              <input type="email" required style={S.input} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@studio.com" autoFocus />
            </div>
            <div style={S.field}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label style={S.label}>Password</label>
                {mode === 'signin' && <a href="#" style={{ ...S.label, color: T.orange, textDecoration: 'none' }}>Forgot?</a>}
              </div>
              <input type="password" required style={S.input} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <button type="submit" disabled={busy} style={{ ...S.btnP, padding: 12, marginTop: 8, opacity: busy ? 0.6 : 1 }}>
              {busy ? '...' : (mode === 'signin' ? 'Sign in' : 'Create account')}
            </button>
          </form>

          <div style={{ marginTop: 24, fontSize: 12, color: T.textMute, textAlign: 'center' }}>
            {mode === 'signin' ? "New to Gear? " : 'Already have an account? '}
            <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === 'signin' ? 'signup' : 'signin'); }} style={{ color: T.ink, fontWeight: 600 }}>
              {mode === 'signin' ? 'Create account' : 'Sign in'}
            </a>
          </div>
        </div>
      </div>
    );
  }

  const oauthBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '11px 14px', background: '#fff', color: T.ink, border: `1px solid ${T.paperEdge}`, borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: S.sans, transition: 'background .12s' };

  // ─── Account page ───────────────────────────────────────────
  function AccountPage({ user, onBack, onSignOut, onUpdate }) {
    const [section, setSection] = useState('profile');
    const [name, setName] = useState(user.name);
    const [email, setEmail] = useState(user.email);
    const [studio, setStudio] = useState(user.studio || '');

    const tabs = [
      { k: 'profile', label: 'Profile' },
      { k: 'workspace', label: 'Workspace' },
      { k: 'billing', label: 'Billing' },
      { k: 'integrations', label: 'Integrations' },
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
            <span style={S.pill('#FFE4D6', '#B33A06')}>{user.plan || 'Studio'} plan</span>
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
            {section === 'billing' && (
              <React.Fragment>
                <div style={card}>
                  <div style={cardHead}>Plan</div>
                  <div style={{ padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontFamily: S.mono, fontSize: 22, fontWeight: 600 }}>Studio</div>
                        <div style={{ fontSize: 12, color: T.textMute }}>$24 / month · billed monthly</div>
                      </div>
                      <button style={S.btnG}>Change plan</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, paddingTop: 14, borderTop: `1px solid ${T.paperEdge}`, fontFamily: S.mono, fontSize: 11 }}>
                      <Stat label="Items" value="∞" />
                      <Stat label="Projects" value="∞" />
                      <Stat label="Crew seats" value="5 of 10" />
                    </div>
                  </div>
                </div>
                <div style={{ ...card, marginTop: 16 }}>
                  <div style={cardHead}>Payment method</div>
                  <Row label="Card on file" value="Visa ending 4242" />
                  <Row label="Next charge" value="Dec 1, 2025" />
                </div>
              </React.Fragment>
            )}
            {section === 'integrations' && (
              <div style={card}>
                <div style={cardHead}>Connected services</div>
                <IntegrationRow name="Supabase" status={window.GEAR_DB?.enabled ? 'Connected' : 'Not connected'} on={!!window.GEAR_DB?.enabled} />
                <IntegrationRow name="Google Drive" status="Connected" on={true} />
                <IntegrationRow name="Dropbox" status="Not connected" on={false} />
                <IntegrationRow name="Slack" status="Not connected" on={false} />
                <IntegrationRow name="Frame.io" status="Not connected" on={false} />
              </div>
            )}
            {section === 'security' && (
              <React.Fragment>
                <div style={card}>
                  <div style={cardHead}>Password</div>
                  <Row label="Last changed" value="3 months ago" action="Change" />
                  <Row label="Two-factor auth" value="Enabled · Authenticator app" action="Manage" />
                </div>
                <div style={{ ...card, marginTop: 16 }}>
                  <div style={cardHead}>Sessions</div>
                  <Row label="MacBook Pro · Chrome" value="Los Angeles · Active now" />
                  <Row label="iPhone 15 · Gear iOS" value="Los Angeles · 2h ago" />
                </div>
                <div style={{ ...card, marginTop: 16, borderColor: '#f3d9d0' }}>
                  <div style={{ ...cardHead, color: '#B33A06' }}>Danger zone</div>
                  <div style={{ padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>Sign out everywhere</div>
                      <div style={{ fontSize: 12, color: T.textMute }}>Ends every active session including iOS.</div>
                    </div>
                    <button style={S.btnG} onClick={onSignOut}>Sign out</button>
                  </div>
                  <div style={{ padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0ebe2' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, color: '#B33A06' }}>Delete account</div>
                      <div style={{ fontSize: 12, color: T.textMute }}>Permanently delete your data. Cannot be undone.</div>
                    </div>
                    <button style={{ ...S.btnG, color: '#B33A06', borderColor: '#f3d9d0' }}>Delete</button>
                  </div>
                </div>
              </React.Fragment>
            )}
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

  function Stat({ label, value }) {
    return (
      <div>
        <div style={{ fontSize: 9, color: T.textMute, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{value}</div>
      </div>
    );
  }

  function IntegrationRow({ name, status, on }) {
    return (
      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0ebe2' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: T.paperLight, border: `1px solid ${T.paperEdge}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: S.mono, fontSize: 12, fontWeight: 700, color: T.ink }}>{name.charAt(0)}</div>
          <div>
            <div style={{ fontWeight: 500, fontSize: 13 }}>{name}</div>
            <div style={{ fontSize: 11, color: on ? '#1F8A5B' : T.textMute, fontFamily: S.mono, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{status}</div>
          </div>
        </div>
        <button style={S.btnG}>{on ? 'Manage' : 'Connect'}</button>
      </div>
    );
  }

  window.STUDIO_AUTH = { LoginPage, AccountPage };
})();
