// Gear · Discover — editorial picks of gear that's new to the industry.
//
// Content lives in the public.discover_items table and is edited in the
// Supabase Table Editor (see the migration for what each column does). Picks
// linked to a catalog item (equipment_id) borrow its photo and can be added to
// the user's inventory.
(function () {
  const { useState, useEffect, useMemo } = React;
  const S = window.STUDIO_STYLES;
  const T = S.T;

  const DOTS = { backgroundColor: T.ink, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '22px 22px' };
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  // Photo, or a branded card for picks without one.
  function PickImage({ pick, height }) {
    const [failed, setFailed] = useState(false);
    if (pick.image && !failed) {
      return (
        <div style={{ height, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, boxSizing: 'border-box' }}>
          <img src={pick.image} alt={pick.title} onError={() => setFailed(true)} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
      );
    }
    return (
      <div style={{ height, ...DOTS, color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center', padding: 16, boxSizing: 'border-box' }}>
        <div style={{ fontFamily: S.mono, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.orange }}>{pick.kind || 'New'}</div>
        <div style={{ fontFamily: S.sans, fontSize: height > 260 ? 34 : 24, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.05 }}>{pick.brand || pick.title}</div>
        {pick.brand && <div style={{ fontFamily: S.mono, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{pick.title}</div>}
      </div>
    );
  }

  // `compact` is the phone layout: tighter margins and a shorter lead image.
  function DiscoverPage({ catalog = [], items = [], onAddToInventory, compact }) {
    const [picks, setPicks] = useState(null);
    const [error, setError] = useState('');
    const [open, setOpen] = useState(null);

    useEffect(() => {
      window.GEAR_DB.loadDiscover().then(setPicks).catch(err => { setError(err.message); setPicks([]); });
    }, []);

    const catById = useMemo(() => new Map(catalog.map(it => [it.id, it])), [catalog]);
    const owned = useMemo(() => new Set(items.map(it => it.equipment_id || it.id)), [items]);
    const enriched = useMemo(() => (picks || []).map(p => {
      const linked = p.equipment_id ? catById.get(p.equipment_id) : null;
      return { ...p, linked, image: p.image_url || (linked && linked.image_url) || null };
    }), [picks, catById]);
    const updated = enriched.reduce((m, p) => (!m || p.updated_at > m ? p.updated_at : m), null);
    const [featured, ...rest] = enriched;

    const kindChip = (p) => (
      <span style={{ fontFamily: S.mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.orange }}>
        {[p.kind, p.brand].filter(Boolean).join(' · ')}
      </span>
    );

    return (
      <div style={{ flex: 1, overflowY: 'auto', background: '#f6f3ee' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto', padding: compact ? '18px 14px 32px' : '32px 28px 80px' }}>
          <div style={S.label}>Discover</div>
          <h1 style={{ fontFamily: S.mono, fontSize: 26, fontWeight: 700, margin: '6px 0 4px', letterSpacing: '-0.02em' }}>New to the industry</h1>
          <div style={{ fontSize: 13, color: T.textMute, lineHeight: 1.5 }}>
            Hand-picked gear announcements, explained.{updated ? ` Updated ${fmtDate(updated)}.` : ''}
          </div>

          {picks === null && <div style={{ marginTop: 28, fontFamily: S.mono, fontSize: 12, color: T.textMute }}>Loading…</div>}
          {error && <div style={{ marginTop: 20, fontFamily: S.mono, fontSize: 12, color: T.err }}>Couldn’t load Discover: {error}</div>}
          {picks && !picks.length && !error && <div style={{ marginTop: 28, fontFamily: S.mono, fontSize: 12, color: T.textMute }}>Nothing here yet. Check back soon.</div>}

          {featured && (
            <div onClick={() => setOpen(featured)} style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', background: '#fff', border: `1px solid ${T.paperEdge}`, borderRadius: 8, overflow: 'hidden', cursor: 'pointer' }}>
              <div style={{ flex: '1 1 380px', minWidth: 0 }}><PickImage pick={featured} height={compact ? 220 : 320} /></div>
              <div style={{ flex: '1 1 360px', padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {kindChip(featured)}
                <div style={{ fontFamily: S.mono, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{featured.title}</div>
                {featured.headline && <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{featured.headline}</div>}
                {featured.summary && <div style={{ fontSize: 13, color: T.textMute, lineHeight: 1.6 }}>{featured.summary}</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                  {(featured.highlights || []).slice(0, 3).map(h => <div key={h} style={{ fontSize: 12, color: T.ink }}><span style={{ color: T.orange, fontWeight: 700 }}>✓</span> {h}</div>)}
                </div>
                <div style={{ marginTop: 'auto', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: S.mono, fontSize: 11, color: T.textMute }}>{[featured.price, fmtDate(featured.announced)].filter(Boolean).join(' · ')}</span>
                  <span style={{ fontFamily: S.mono, fontSize: 11, fontWeight: 600, color: T.orange, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Read more →</span>
                </div>
              </div>
            </div>
          )}

          {rest.length > 0 && (
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: 16 }}>
              {rest.map(p => (
                <div key={p.id} onClick={() => setOpen(p)} style={{ background: '#fff', border: `1px solid ${T.paperEdge}`, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
                  <PickImage pick={p} height={190} />
                  <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                    {kindChip(p)}
                    <div style={{ fontFamily: S.mono, fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>{p.title}</div>
                    {p.headline && <div style={{ fontSize: 13, color: T.textMute, lineHeight: 1.5, flex: 1 }}>{p.headline}</div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                      <span style={{ fontFamily: S.mono, fontSize: 10, color: T.textMute }}>{p.price || fmtDate(p.announced)}</span>
                      <span style={{ fontFamily: S.mono, fontSize: 10, fontWeight: 600, color: T.orange, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Read more →</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {open && (
          <PickDetail pick={open} inInventory={open.linked && owned.has(open.linked.id)}
            onAdd={open.linked && onAddToInventory ? () => onAddToInventory(open.linked) : null}
            onClose={() => setOpen(null)} />
        )}
      </div>
    );
  }

  function PickDetail({ pick, inInventory, onAdd, onClose }) {
    useEffect(() => {
      const onKey = (e) => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, []);
    const paragraphs = String(pick.body || pick.summary || '').split(/\n\s*\n/).filter(Boolean);
    return (
      <div style={S.modalOverlay} onClick={onClose}>
        <div style={{ ...S.modal, width: 720, maxWidth: 'calc(100vw - 32px)' }} onClick={e => e.stopPropagation()} role="dialog" aria-label={pick.title}>
          <div style={{ position: 'relative' }}>
            <PickImage pick={pick} height={240} />
            <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 12, right: 12, width: 30, height: 30, borderRadius: 4, border: `1px solid ${T.paperEdge}`, background: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1, color: T.ink }}>×</button>
          </div>
          <div style={{ padding: '22px 28px 26px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
            <div style={{ fontFamily: S.mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.orange }}>
              {[pick.kind, pick.brand, pick.announced && `Announced ${fmtDate(pick.announced)}`].filter(Boolean).join(' · ')}
            </div>
            <div style={{ fontFamily: S.mono, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: '6px 0 4px' }}>{pick.title}</div>
            {pick.headline && <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{pick.headline}</div>}
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {paragraphs.map((p, i) => <p key={i} style={{ margin: 0, fontSize: 14, color: T.ink, lineHeight: 1.65 }}>{p}</p>)}
            </div>
            {(pick.highlights || []).length > 0 && (
              <div style={{ marginTop: 18, background: '#faf7f2', border: `1px solid ${T.paperEdge}`, borderRadius: 6, padding: '14px 16px' }}>
                <div style={{ ...S.label, marginBottom: 8 }}>Key specs</div>
                {pick.highlights.map(h => <div key={h} style={{ fontSize: 13, color: T.ink, lineHeight: 1.6 }}><span style={{ color: T.orange, fontWeight: 700 }}>✓</span> {h}</div>)}
              </div>
            )}
            <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: S.mono, fontSize: 12, fontWeight: 600 }}>{pick.price}</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {pick.source_url && (
                  <a href={pick.source_url} target="_blank" rel="noopener noreferrer" style={{ ...S.btnG, textDecoration: 'none', display: 'inline-block' }}>
                    {pick.source_name ? `Read on ${pick.source_name} ↗` : 'Read the announcement ↗'}
                  </a>
                )}
                {onAdd && (inInventory
                  ? <span style={{ ...S.btnG, color: T.ok, borderColor: T.ok, cursor: 'default' }}>✓ In inventory</span>
                  : <button onClick={onAdd} style={S.btnP}>+ Add to inventory</button>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  window.STUDIO_DISCOVER = DiscoverPage;
})();
