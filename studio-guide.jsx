// Studio guide — introduction for new users: hero, a scrolling strip of real
// catalog items, "Gear at a Glance" feature cards and a screenshot walkthrough
// of each part of the app. Shown once after a new user's first sign-in, from
// the sidebar (Guide), and from the login page before signing up.
//
// Screenshots live in /guide and show a demo studio built from real catalog
// items. Also exports ItemMarquee, used on the login page.
(function () {
  const { useState, useMemo, useEffect } = React;
  const S = window.STUDIO_STYLES;
  const T = S.T;

  // The "+" grid used behind the phone landing page.
  const DOT_BG = 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.75) 100%), #0c0c0c url(login-bg.jpg) center center / cover no-repeat';

  // ── Scrolling strip of random catalog items ────────────────────────────
  // Real gear only (cameras, lenses, lights, support, audio, monitors) with a
  // picture; a fresh random mix on every visit. Items whose image fails are
  // dropped. Pauses on hover; stands still for people who prefer less motion.
  const SHOWCASE_ROLES = new Set(['body', 'lens', 'light', 'gimbal', 'monitor', 'mic-xlr', 'mic', 'tripod', 'xlr-input']);

  function ItemMarquee({ items = [], count = 32, dark = false, speed = 55 }) {
    const [broken, setBroken] = useState(() => new Set());
    const picks = useMemo(() => {
      const C = window.GEAR_COMPAT;
      const pool = items.filter(it => it.image_url && (!C || SHOWCASE_ROLES.has(C.specOf(it).role)));
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return pool.slice(0, count);
    }, [items.length, count]);
    const shown = picks.filter(it => !broken.has(it.id));
    if (shown.length < 8) return null;
    const tile = 112;
    return (
      <div className="gear-marquee" style={{ overflow: 'hidden', width: '100%', maskImage: 'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)' }}>
        <style>{`
          @keyframes gearMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
          .gear-marquee-track { animation: gearMarquee ${Math.round(shown.length * 140 / speed * 10) / 10}s linear infinite; }
          .gear-marquee:hover .gear-marquee-track { animation-play-state: paused; }
          @media (prefers-reduced-motion: reduce) { .gear-marquee-track { animation: none; } }
        `}</style>
        <div className="gear-marquee-track" style={{ display: 'flex', gap: 12, width: 'max-content', padding: '4px 0' }}>
          {[0, 1].map(copy => shown.map(it => (
            <div key={copy + it.id} aria-hidden={copy === 1} title={it.name} style={{ width: tile, flexShrink: 0 }}>
              <div style={{ width: tile, height: tile, background: '#fff', borderRadius: 8, border: dark ? '1px solid rgba(255,255,255,0.08)' : `1px solid ${T.paperEdge}`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, boxSizing: 'border-box' }}>
                <img src={it.image_url} alt={copy === 0 ? it.name : ''} loading="lazy"
                  onError={() => setBroken(prev => new Set(prev).add(it.id))}
                  onLoad={e => { if (e.currentTarget.naturalWidth < 60) setBroken(prev => new Set(prev).add(it.id)); }}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </div>
              <div style={{ marginTop: 6, fontSize: 10, lineHeight: 1.3, fontFamily: S.mono, color: dark ? 'rgba(255,255,255,0.55)' : T.textMute, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', height: 26 }}>
                {it.name}
              </div>
            </div>
          )))}
        </div>
      </div>
    );
  }

  // ── Content ────────────────────────────────────────────────────────────
  const FEATURES = [
    { icon: '▣', page: 'inventory', title: 'Build your inventory', text: 'Add gear from a database of thousands of items or create your own. Track quantities and status, and group kit that travels together.' },
    { icon: '◈', page: 'database', title: 'Search the database', text: 'Filter cameras, lenses, lighting, audio and support by category, then add items to your inventory or straight into a project.' },
    { icon: '◧', page: 'projects', title: 'Sort your items into projects', text: 'Prep for each shoot by dragging items, or whole groups, into a project. Adjust quantities and track its status from planning to wrapped.' },
    { icon: '✧', page: 'suggest', title: 'Let AI build the kit', text: 'Describe the shoot and get a kit list that works together. Mounts, batteries, media, monitoring and gimbal payload are checked for you. Then ask for changes in plain English.' },
    { icon: '⤓', page: 'projects', title: 'Export your kit list', text: 'Download a clean PDF pull list to share with crew, rental houses or insurers.' },
  ];

  const WALKTHROUGH = [
    {
      img: 'guide/inventory.webp', page: 'inventory', label: 'Inventory', title: 'Your kit, organised',
      text: 'Everything you own in one list, with the project you’re prepping open alongside it.',
      points: [
        'Add items from the database, or create your own for anything that isn’t listed.',
        'Drag one item onto another to make a group, like an A-Cam package or a sound bag.',
        'Track how many you own and whether each is available, checked out or in for repair.',
        'Drag items, or a whole group, into the active project on the right.',
      ],
    },
    {
      img: 'guide/database.webp', page: 'database', label: 'Database', title: 'Thousands of items, one search',
      text: 'Cameras, lenses, lighting, audio and support, all with pictures.',
      points: [
        'Search by name and narrow it down by category.',
        'Add anything to your inventory in one click.',
        'Or drag it straight into a project when you’re hiring it in.',
      ],
    },
    {
      img: 'guide/projects.webp', page: 'projects', label: 'Projects', title: 'A project for every shoot',
      text: 'Each card shows the client, dates, location and the kit going out.',
      points: [
        'Create a project per shoot and keep its kit list in one place.',
        'See every project’s gear at a glance.',
        'Track status from planning to active to wrapped.',
      ],
    },
    {
      img: 'guide/project.webp', page: 'projects', label: 'Project', title: 'The full kit list',
      text: 'Open a project for the complete list, grouped by category with quantities.',
      points: [
        'Adjust quantities and the project’s status in edit mode.',
        'Jump to recent projects from the sidebar.',
      ],
    },
    {
      img: 'guide/suggest.webp', page: 'suggest', label: 'Suggest', title: 'Let AI build the kit',
      text: 'Describe the shoot in plain English and get a kit list in under a minute.',
      points: [
        'Every item is checked against the camera: lens mounts and adapters, sensor coverage, batteries, media, monitor connections, gimbal payload and XLR audio.',
        'Anything missing comes with one-click fixes from the database.',
        'Ask for changes, like “swap to a lighter camera for the gimbal”, and undo them.',
        'History keeps every kit, and you can save one as a new project.',
      ],
    },
    {
      img: 'guide/export.webp', page: 'projects', label: 'Export', title: 'Export a pull list',
      text: 'Download a PDF of any project or your whole inventory.',
      points: [
        'Include photos and category headings, in a compact or spacious layout.',
        'Share it with crew, rental houses or insurers.',
        'Pro exports carry your studio name instead of The Gear App’s.',
      ],
    },
  ];

  const STEPS = [
    ['Add your gear', 'Search the database or create custom items.'],
    ['Create a project', 'One per shoot, with client, dates and location.'],
    ['Fill it', 'Drag gear in, or let Suggest build the kit for you.'],
  ];

  function Screenshot({ src, alt, onOpen }) {
    return (
      <div onClick={onOpen} style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${T.paperEdge}`, boxShadow: '0 18px 40px rgba(25,25,25,0.14)', background: '#fff', cursor: 'zoom-in' }}>
        <div style={{ height: 28, background: '#ece6dc', display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', borderBottom: `1px solid ${T.paperEdge}` }}>
          {['#ff5f57', '#febc2e', '#28c840'].map(c => <span key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />)}
          <span style={{ marginLeft: 10, fontFamily: S.mono, fontSize: 10, color: T.textMute, background: '#f6f3ee', padding: '2px 10px', borderRadius: 4 }}>gearapp.io</span>
        </div>
        <img src={src} alt={alt} loading="lazy" style={{ display: 'block', width: '100%', height: 'auto', aspectRatio: '16 / 10' }} />
      </div>
    );
  }

  function GuidePage({ onNavigate, onClose, onCreateAccount, closeLabel, catalog, items = [] }) {
    const [zoom, setZoom] = useState(null);
    useEffect(() => {
      if (!zoom) return;
      const onKey = (e) => { if (e.key === 'Escape') setZoom(null); };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [zoom]);
    const free = catalog && catalog.plans && catalog.plans.free;
    const pro = catalog && catalog.plans && catalog.plans.pro;
    const B = window.GEAR_BILLING;

    return (
      <div style={{ flex: 1, overflowY: 'auto', background: '#f6f3ee' }}>
        {/* Hero */}
        <div style={{ position: 'relative', background: DOT_BG, color: '#fff', padding: '56px 0 40px', textAlign: 'center', overflow: 'hidden' }}>
          {onClose && (
            <button onClick={onClose} style={{ position: 'absolute', top: 18, right: 22, zIndex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 4, padding: '7px 12px', cursor: 'pointer', fontFamily: S.mono, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {closeLabel || 'Close'}
            </button>
          )}
          <div style={{ padding: '0 40px' }}>
            <img src="app-icon.jpg" alt="" style={{ width: 56, height: 56, borderRadius: 12, marginBottom: 22 }} />
            <div style={{ fontFamily: S.sans, fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.02 }}>All your gear,<br />in one place.</div>
            <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', maxWidth: 520, margin: '18px auto 0', lineHeight: 1.55 }}>
              Organise your equipment, track your inventory and prep for every shoot.
            </div>
          </div>
          <div style={{ marginTop: 40 }}>
            <ItemMarquee items={items} dark />
          </div>
        </div>

        <div style={{ maxWidth: 1040, margin: '0 auto', padding: '48px 28px 72px' }}>
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
                  <button onClick={() => onNavigate(f.page)} style={linkBtn}>Open {f.page} →</button>
                )}
              </div>
            ))}
            {free && pro && (
              <div style={{ background: DOT_BG, color: '#fff', borderRadius: 6, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,87,12,0.18)', color: T.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>✦</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Free to start</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55 }}>
                  Free includes {free.max_projects} projects, {free.max_inventory_items} inventory items and {free.monthly_credits} AI kit builds a month.
                  Pro ({B.money(pro.price_pence, pro.currency)}/month) removes the limits and gives you {pro.monthly_credits} builds a month.
                </div>
              </div>
            )}
          </div>

          {/* Walkthrough */}
          <div style={{ textAlign: 'center', margin: '72px 0 8px' }}>
            <div style={{ fontFamily: S.mono, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>A closer look</div>
            <div style={{ fontSize: 14, color: T.textMute, marginTop: 8 }}>How each part of the app works. Click any screenshot to see it full size.</div>
          </div>
          {WALKTHROUGH.map((w, i) => (
            <div key={w.img} style={{ display: 'flex', flexWrap: 'wrap', flexDirection: i % 2 ? 'row-reverse' : 'row', alignItems: 'center', gap: 40, marginTop: 56 }}>
              <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                <div style={{ ...S.label, color: T.orange }}>{String(i + 1).padStart(2, '0')} · {w.label}</div>
                <div style={{ fontFamily: S.mono, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: '8px 0 10px' }}>{w.title}</div>
                <div style={{ fontSize: 14, color: T.textMute, lineHeight: 1.6 }}>{w.text}</div>
                <ul style={{ margin: '14px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {w.points.map(p => (
                    <li key={p} style={{ display: 'flex', gap: 10, fontSize: 13, color: T.ink, lineHeight: 1.55 }}>
                      <span style={{ color: T.orange, fontFamily: S.mono, fontWeight: 700, flexShrink: 0 }}>✓</span>{p}
                    </li>
                  ))}
                </ul>
                {onNavigate && <button onClick={() => onNavigate(w.page)} style={{ ...linkBtn, marginTop: 16 }}>Open {w.page} →</button>}
              </div>
              <div style={{ flex: '1.6 1 420px', minWidth: 0 }}>
                <Screenshot src={w.img} alt={`${w.label} screen`} onOpen={() => setZoom(w)} />
              </div>
            </div>
          ))}

          {/* Getting started */}
          <div style={{ marginTop: 72, background: '#fff', border: `1px solid ${T.paperEdge}`, borderRadius: 6, padding: '24px 26px' }}>
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
            {onNavigate ? (
              <button onClick={() => onNavigate('database')} style={{ ...S.btnP, marginTop: 22, padding: '11px 18px' }}>Start adding gear</button>
            ) : onCreateAccount ? (
              <button onClick={onCreateAccount} style={{ ...S.btnP, marginTop: 22, padding: '11px 18px' }}>Create a free account</button>
            ) : null}
          </div>
          <div style={{ marginTop: 14, fontSize: 11, color: T.textMute, fontFamily: S.mono, textAlign: 'center' }}>Screenshots show a demo studio.</div>
        </div>

        {zoom && (
          <div onClick={() => setZoom(null)} role="dialog" aria-label={`${zoom.label} screenshot`}
            style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(12,12,12,0.86)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, cursor: 'zoom-out' }}>
            <img src={zoom.img} alt={`${zoom.label} screen`} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }} />
          </div>
        )}
      </div>
    );
  }

  const linkBtn = { alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, color: T.orange, fontFamily: S.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' };

  window.STUDIO_GUIDE = GuidePage;
  window.STUDIO_GUIDE_MARQUEE = ItemMarquee;
})();
