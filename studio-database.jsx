// Gear · Database page — browse the full Supabase equipment catalog.
// Read-only reference view. Users click "+ Add to Inventory" to copy an item into their personal list.
(function () {
  const { useState, useMemo, useEffect, useRef } = React;
  const S = window.STUDIO_STYLES;
  const T = S.T;
  const R = window.GEAR_ROW;

  const PAGE = 80;

  function DatabasePage({ catalog, items, onAddToInventory, onAddToCart, draggedId, setDraggedId, hoverCart, setHoverCart, density, setDensity, dbStatus = { state: 'idle' } }) {
    const [query, setQuery] = useState('');
    const [cat, setCat] = useState('All');
    const [sortBy, setSortBy] = useState({ key: 'name', dir: 'asc' });
    const [visible, setVisible] = useState(PAGE);
    const scrollRef = useRef(null);

    const inventoryIds = useMemo(() => new Set((items || []).map(it => it.id)), [items]);

    const cats = useMemo(() => {
      const seen = new Set(['All']);
      catalog.forEach(it => { if (it.category) seen.add(it.category); });
      return Array.from(seen);
    }, [catalog]);

    const filtered = useMemo(() => {
      // Token AND match — every whitespace-separated word in the query has to
      // appear somewhere in the haystack, but order doesn't matter. Lets
      // "18mm Sigma" find "Sigma 18mm Lens" the same as "Sigma 18mm".
      const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
      let r = catalog.filter(it => {
        if (cat !== 'All' && it.category !== cat) return false;
        if (tokens.length === 0) return true;
        const hay = (String(it.name || '') + ' ' + String(it.brand || '') + ' ' + String(it.category || '')).toLowerCase();
        return tokens.every(t => hay.includes(t));
      });
      r.sort((a, b) => {
        const va = a[sortBy.key], vb = b[sortBy.key];
        if (typeof va === 'number') return sortBy.dir === 'asc' ? va - vb : vb - va;
        return sortBy.dir === 'asc' ? String(va || '').localeCompare(String(vb || '')) : String(vb || '').localeCompare(String(va || ''));
      });
      return r;
    }, [catalog, query, cat, sortBy]);

    useEffect(() => { setVisible(PAGE); if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [query, cat, sortBy]);

    const onScroll = (e) => {
      const el = e.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 400 && visible < filtered.length) {
        setVisible(v => Math.min(v + PAGE, filtered.length));
      }
    };

    const sortHeader = (key, label) => {
      const isActive = sortBy.key === key;
      return (
        <th style={R.sH} onClick={() => setSortBy(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: isActive ? T.ink : T.textMute }}>
            {label}{isActive && <span style={{ fontSize: 8 }}>{sortBy.dir === 'asc' ? '▲' : '▼'}</span>}
          </span>
        </th>
      );
    };

    const rowH = R.rowH(density);
    const isLoading = dbStatus.state === 'loading';
    const slice = filtered.slice(0, visible);

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={R.pageHead}>
          <div style={R.pageTitle}>Database</div>
          <div style={R.countChip}>{isLoading ? 'loading…' : `${filtered.length} of ${catalog.length}`}</div>
          <div style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
            <input style={{ ...S.input, padding: '8px 12px 8px 32px', background: '#f6f3ee' }}
                   placeholder="Search catalog..."
                   value={query} onChange={e => setQuery(e.target.value)} />
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: T.textMute, fontSize: 13 }}>⌕</span>
          </div>
          <div style={{ flex: 1 }} />
          <div style={R.densityToggle}>
            <button onClick={() => setDensity('tight')} style={R.densityBtn(density === 'tight')} title="Tight">▤</button>
            <button onClick={() => setDensity('comfortable')} style={R.densityBtn(density === 'comfortable')} title="Comfortable">≡</button>
          </div>
        </div>

        <div style={R.catRow}>
          {cats.map(c => (
            <button key={c} onClick={() => setCat(c)} style={R.catChip(cat === c)}>
              {c}<span style={{ marginLeft: 6, opacity: 0.6, fontFamily: S.mono, fontSize: 9 }}>{c === 'All' ? catalog.length : catalog.filter(i => i.category === c).length}</span>
            </button>
          ))}
        </div>

        <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, overflowY: 'auto', background: '#faf7f2' }}>
          {isLoading && catalog.length === 0 ? (
            <SkeletonTable rowH={rowH} />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13, tableLayout: 'fixed' }}>
              <colgroup>
                <col /><col style={{ width: 160 }} /><col style={{ width: 180 }} />
              </colgroup>
              <thead>
                <tr>
                  {sortHeader('name', 'Item')}
                  {sortHeader('category', 'Category')}
                  <th style={{ ...R.sH, textAlign: 'right' }}></th>
                </tr>
              </thead>
              <tbody>
                {slice.map(it => {
                  const inInv = inventoryIds.has(it.id);
                  const rowBg = '#faf7f2';
                  return (
                    <tr key={it.id}
                        draggable
                        onDragStart={(e) => { setDraggedId(it.id); e.dataTransfer.effectAllowed = 'copy'; }}
                        onDragEnd={() => { setDraggedId(null); setHoverCart(false); }}
                        style={{ cursor: 'grab', height: rowH, background: draggedId === it.id ? '#f6f3ee' : rowBg, opacity: draggedId === it.id ? 0.5 : 1, transition: 'background .08s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#f0ebe2'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = rowBg; }}>

                      <td style={{ ...R.tD, padding: 0, height: rowH, verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                          <div style={{ width: rowH, height: rowH, padding: 6, flexShrink: 0 }}>
                            <div style={{ width: '100%', height: '100%', background: '#fff', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                              <img src={window.GEAR.itemImage(it)} onError={(e) => { e.currentTarget.src = window.GEAR_PLACEHOLDER(it.category); }} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="" loading="lazy" />
                            </div>
                          </div>
                          <div style={{ padding: '0 14px', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{it.name}</div>
                        </div>
                      </td>
                      <td style={{ ...R.tD, padding: '0 14px', fontFamily: S.mono, fontSize: 11, color: T.textMute, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.category}</td>
                      <td style={{ ...R.tD, padding: '0 14px', textAlign: 'right' }}>
                        {inInv ? (
                          <span style={{ fontFamily: S.mono, fontSize: 10, color: '#1f8a5b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, padding: '6px 12px', display: 'inline-block' }}>✓ In Inventory</span>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); onAddToInventory(it); }} style={{ background: T.orange, color: '#fff', border: 'none', padding: '6px 12px', fontSize: 10, fontFamily: S.mono, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.06em', borderRadius: 3, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>+ Add to Inventory</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!isLoading && filtered.length === 0 && (
            <div style={{ padding: 60, textAlign: 'center', color: T.textMute, fontFamily: S.mono, fontSize: 13 }}>
              {catalog.length === 0 ? 'No items in the database. Connect Supabase via the Tweaks panel.' : 'No items match. Try clearing filters.'}
            </div>
          )}
          {!isLoading && visible < filtered.length && (
            <div style={{ padding: '20px', textAlign: 'center', fontFamily: S.mono, fontSize: 10, color: T.textMute, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Showing {slice.length} of {filtered.length} · scroll for more
            </div>
          )}
        </div>
      </div>
    );
  }

  function SkeletonTable({ rowH }) {
    const rows = Array.from({ length: 16 });
    const skel = { background: 'linear-gradient(90deg,#f1ece2 25%,#f8f5ee 50%,#f1ece2 75%)', backgroundSize: '200% 100%', borderRadius: 3, animation: 'gearSkel 1.2s linear infinite' };
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <tbody>
          {rows.map((_, i) => (
            <tr key={i} style={{ height: rowH, opacity: 1 - i * 0.05 }}>
              <td style={{ padding: 6 }}><div style={{ ...skel, width: '70%', height: 12, marginLeft: rowH }}></div></td>
              <td style={{ padding: '0 14px' }}><div style={{ ...skel, width: '60%', height: 10 }}></div></td>
              <td style={{ padding: '0 14px' }}><div style={{ ...skel, width: 110, height: 26, marginLeft: 'auto' }}></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (!document.getElementById('gear-skel-css')) {
    const st = document.createElement('style'); st.id = 'gear-skel-css';
    st.textContent = '@keyframes gearSkel{0%{background-position:100% 0}100%{background-position:-100% 0}}';
    document.head.appendChild(st);
  }

  window.STUDIO_DATABASE = DatabasePage;
})();
