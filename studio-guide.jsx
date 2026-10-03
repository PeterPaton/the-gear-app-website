// Studio guide — "Gear at a Glance" introduction for new users. Shown once
// automatically after a user's first sign-in, from the sidebar (Guide), and
// from the login page before signing up.
(function () {
  const S = window.STUDIO_STYLES;
  const T = S.T;

  const FEATURES = [
    { icon: '▣', page: 'inventory', title: 'Build your inventory', text: 'Add gear from a database of thousands of items or create your own. Track quantities and status, and group kit that travels together.' },
    { icon: '◈', page: 'database', title: 'Search the database', text: 'Filter cameras, lenses, lighting, audio and support by category, then add items to your inventory or straight into a project.' },
    { icon: '◧', page: 'projects', title: 'Sort your items into projects', text: 'Prep for each shoot by dragging items, or whole groups, into a project. Adjust quantities and track its status from planning to wrapped.' },
    { icon: '✧', page: 'suggest', title: 'Let AI build the kit', text: 'Describe the shoot and get a kit list that works together. Mounts, batteries, media, monitoring and gimbal payload are checked for you. Then ask for changes in plain English.' },
    { icon: '⤓', page: 'projects', title: 'Export your kit list', text: 'Download a clean PDF pull list to share with crew, rental houses or insurers.' },
  ];

  const STEPS = [
    ['Add your gear', 'Search the database or create custom items.'],
    ['Create a project', 'One per shoot, with client, dates and location.'],
    ['Fill it', 'Drag gear in, or let Suggest build the kit for you.'],
  ];

  function GuidePage({ onNavigate, onClose, closeLabel, catalog }) {
    const free = catalog && catalog.plans && catalog.plans.free;
    const pro = catalog && catalog.plans && catalog.plans.pro;
    const B = window.GEAR_BILLING;
    return (
      <div style={{ flex: 1, overflowY: 'auto', background: '#f6f3ee' }}>
        {/* Hero */}
        <div style={{ position: 'relative', background: T.ink, color: '#fff', padding: '56px 40px 64px', textAlign: 'center', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '22px 22px', pointerEvents: 'none' }} />
          {onClose && (
            <button onClick={onClose} style={{ position: 'absolute', top: 18, right: 22, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 4, padding: '7px 12px', cursor: 'pointer', fontFamily: S.mono, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {closeLabel || 'Close'}
            </button>
          )}
          <div style={{ position: 'relative' }}>
            <img src="app-icon.jpg" alt="" style={{ width: 56, height: 56, borderRadius: 12, marginBottom: 22 }} />
            <div style={{ fontFamily: S.sans, fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.02 }}>All your gear,<br />in one place.</div>
            <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', maxWidth: 520, margin: '18px auto 0', lineHeight: 1.55 }}>
              Organise your equipment, track your inventory and prep for every shoot.
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 960, margin: '0 auto', padding: '44px 28px 72px' }}>
          {/* Features */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontFamily: S.mono, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>Gear at a Glance</div>
            <div style={{ fontSize: 14, color: T.textMute, marginTop: 8 }}>Everything you need to prep a shoot, from your shelf to the call sheet.</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 14 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ background: '#fff', border: `1px solid ${T.paperEdge}`, borderRadius: 6, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fff3ed', color: T.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>{f.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: T.ink }}>{f.title}</div>
                <div style={{ fontSize: 13, color: T.textMute, lineHeight: 1.55, flex: 1 }}>{f.text}</div>
                {onNavigate && (
                  <button onClick={() => onNavigate(f.page)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, color: T.orange, fontFamily: S.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Open {f.page} →
                  </button>
                )}
              </div>
            ))}
            {free && pro && (
              <div style={{ background: T.ink, color: '#fff', borderRadius: 6, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,87,12,0.18)', color: T.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>✦</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Free to start</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55 }}>
                  Free includes {free.max_projects} projects, {free.max_inventory_items} inventory items and {free.monthly_credits} AI kit builds a month.
                  Pro ({B.money(pro.price_pence, pro.currency)}/month) removes the limits and gives you {pro.monthly_credits} builds a month.
                </div>
              </div>
            )}
          </div>

          {/* Getting started */}
          <div style={{ marginTop: 44, background: '#fff', border: `1px solid ${T.paperEdge}`, borderRadius: 6, padding: '24px 26px' }}>
            <div style={{ ...S.label, marginBottom: 16 }}>Get started in three steps</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 18 }}>
              {STEPS.map(([title, text], i) => (
                <div key={title} style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: T.ink, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: S.mono, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
                    <div style={{ fontSize: 12, color: T.textMute, marginTop: 3, lineHeight: 1.5 }}>{text}</div>
                  </div>
                </div>
              ))}
            </div>
            {onNavigate && (
              <button onClick={() => onNavigate('database')} style={{ ...S.btnP, marginTop: 22, padding: '11px 18px' }}>Start adding gear</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  window.STUDIO_GUIDE = GuidePage;
})();
