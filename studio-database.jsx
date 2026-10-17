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
    // Default sort is a stable random shuffle so the same item doesn't always
    // greet you at the top. Clicking a column header still switches to name /
    // category sorting; clicking it again toggles direction.
    const [sortBy, setSortBy] = useState({ key: 'random', dir: 'asc' });
    const [visible, setVisible] = useState(PAGE);
    const scrollRef = useRef(null);

    // Build the shuffle once per catalog load and keep it stable for the
    // session — re-shuffling on every render would jump items around as the
    // user types or filters.
    const shuffledOrder = useMemo(() => {
      const order = new Map();
      const arr = catalog.map((it, i) => i);
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      arr.forEach((origIdx, pos) => order.set(catalog[origIdx].id, pos));
      return order;
    }, [catalog]);

    // Set of catalog/equipment UUIDs already represented in the user's
    // inventory. Each inventory row stores a `equipment_id` linking back to
    // the catalog; older rows (pre-refactor) put the catalog id directly in
    // `id`, so we accept either as a match.
    const inventoryIds = useMemo(() => {
      const s = new Set();
      (items || []).forEach(it => {
        if (it.equipment_id) s.add(it.equipment_id);
        else if (it.id) s.add(it.id);
      });
      return s;
    }, [items]);

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
      if (sortBy.key === 'random') {
        r.sort((a, b) => (shuffledOrder.get(a.id) || 0) - (shuffledOrder.get(b.id) || 0));
      } else {
        r.sort((a, b) => {
          const va = a[sortBy.key], vb = b[sortBy.key];
          if (typeof va === 'number') return sortBy.dir === 'asc' ? va - vb : vb - va;
          return sortBy.dir === 'asc' ? String(va || '').localeCompare(String(vb || '')) : String(vb || '').localeCompare(String(va || ''));
        });
      }
      return r;
    }, [catalog, query, cat, sortBy, shuffledOrder]);

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
        <div style={{ ...R.kitHeadCell, cursor: 'pointer', color: isActive ? T.ink : T.textMute }} onClick={() => setSortBy(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))}>
          {label}{isActive && <span style={{ fontSize: 8 }}>{sortBy.dir === 'asc' ? '▲' : '▼'}</span>}
        </div>
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
          <div style={{ position: 'relative', flex: 1, minWidth: 130, maxWidth: 380, marginRight: 'auto' }}>
            <input style={R.headSearch(!!query)}
                   placeholder="Search catalog..."
                   value={query} onChange={e => setQuery(e.target.value)} />
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>⌕</span>
            {query && (
              <button onClick={() => setQuery('')} title="Clear" type="button"
                      style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, border: 'none', background: 'rgba(255,255,255,0.12)', color: '#fff', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            )}
          </div>
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

        <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, overflowY: 'auto', background: T.paper }}>
          {isLoading && catalog.length === 0 ? (
            <SkeletonTable rowH={rowH} />
          ) : (
            <div>
              <div style={{ ...R.kitHeadRow, gridTemplateColumns: R.kitCols(rowH, 170) }}>
                <div style={R.kitHeadCell}></div>
                {sortHeader('name', 'Item')}
                {sortHeader('category', 'Category')}
                <div style={{ ...R.kitHeadCell, borderRight: 'none' }}></div>
              </div>
              {slice.map(it => {
                const inInv = inventoryIds.has(it.id);
                const rowBg = T.paper;
                return (
                  <div key={it.id}
                      draggable
                      onDragStart={(e) => { setDraggedId(it.id); e.dataTransfer.effectAllowed = 'copy'; }}
                      onDragEnd={() => { setDraggedId(null); setHoverCart(false); }}
                      style={{ display: 'grid', gridTemplateColumns: R.kitCols(rowH, 170), height: rowH, borderBottom: `1px solid ${T.ink}`, cursor: 'grab', background: draggedId === it.id ? T.paperLight : rowBg, opacity: draggedId === it.id ? 0.5 : 1, transition: 'background .08s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#e2dbd2'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = rowBg; }}>
                    <div style={R.kitImgCell}>
                      <img src={window.GEAR.itemImage(it)} onError={(e) => { e.currentTarget.src = window.GEAR_PLACEHOLDER(it.category); }} style={R.kitImg} alt="" loading="lazy" />
                    </div>
                    <div style={{ ...R.kitCell, padding: '0 14px' }} title={it.name}>
                      <span style={R.kitName}>{it.name}</span>
                    </div>
                    <div style={{ ...R.kitCell, ...R.kitCat }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.category}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px' }}>
                      {inInv ? (
                        <span style={{ fontFamily: S.mono, fontSize: 10, color: '#1f8a5b', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>✓ In Inventory</span>
                      ) : (
                        <button data-tour="add-to-inventory" onClick={(e) => { e.stopPropagation(); onAddToInventory(it); }} style={{ background: 'none', color: T.orange, border: 'none', padding: '6px 4px', fontSize: 10, fontFamily: S.mono, cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>+ Add to Inventory</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
    const skel = { background: 'linear-gradient(90deg,#f1ece2 25%,#f8f5ee 50%,#f1ece2 75%)', backgroundSize: '200% 100%', animation: 'gearSkel 1.2s linear infinite' };
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
