// Studio app shell — sidebar nav + cart panel + main routing.
(function () {
  const { useState, useMemo } = React;
  const S = window.STUDIO_STYLES;
  const T = S.T;

  // ─── Right cart panel ───────────────────────────────────────────────
  function CartPanel({ projects, activeProjectId, projectItems = [], onSelectProject, items, hoverCart, setHoverCart, draggedId, setDraggedId, draggedGroupId, setDraggedGroupId, onDrop, onDropGroup, onChangeQty, onRemove, onExport, onOpenProject, onNewProject, collapsed, setCollapsed, width = 400, setWidth }) {
    const active = projects.find(p => p.id === activeProjectId);
    // Filter for the project's list, and the row whose − / + are showing.
    const [q, setQ] = useState('');
    const [hoverRow, setHoverRow] = useState(null);
    // Drag the left edge to resize. Clamped to a sane minimum and capped at a
    // quarter of the viewport so the cart never crowds the main workspace.
    const startResize = (e) => {
      if (!setWidth) return;
      e.preventDefault();
      const startX = e.clientX;
      const startW = width;
      const onMove = (ev) => {
        const next = startW + (startX - ev.clientX);
        const max = Math.floor(window.innerWidth / 4);
        const min = 300;
        setWidth(Math.max(min, Math.min(max, next)));
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };
    const ResizeHandle = (collapsed || !setWidth) ? null : (
      <div onMouseDown={startResize}
           title="Drag to resize"
           style={{ position: 'absolute', left: -3, top: 0, bottom: 0, width: 6, cursor: 'col-resize', zIndex: 10 }} />
    );
    if (!active) {
      // No project selected — always show the full CTA (collapsing here just
      // hides the "+ New Project" button behind a thin "Full list" bar).
      return (
        <div style={cartRoot(false, width)}>
          {ResizeHandle}
          <div style={cartHead}>
            <div>
              <div style={{ fontFamily: S.mono, fontSize: 15, letterSpacing: '0.04em', textTransform: 'uppercase' }}>No project</div>
              <div style={cartSub}>Full list</div>
            </div>
          </div>
          <div style={{ flex: 1, padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'rgba(255,255,255,0.55)' }}>
            <div style={{ fontFamily: S.mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Open or create a project</div>
            <div style={{ fontSize: 12, lineHeight: 1.5, maxWidth: 220 }}>Projects hold a kit list. Drag items here from your inventory once a project is active.</div>
            {onNewProject && (
              <button onClick={onNewProject} style={{ ...S.btnP, marginTop: 8, padding: '10px 14px' }}>+ New Project</button>
            )}
          </div>
        </div>
      );
    }
    const totalQty = projectItems.reduce((s, it) => s + (it.qty || 0), 0);
    const uniqueCount = projectItems.length;
    const R = window.GEAR_ROW;

    if (collapsed) {
      return (
        <div style={cartCollapsed(hoverCart)}
             onDragOver={(e) => { e.preventDefault(); setHoverCart(true); }}
             onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHoverCart(false); }}
             onDrop={(e) => {
               e.preventDefault();
               if (draggedGroupId && onDropGroup) onDropGroup(draggedGroupId);
               else if (draggedId) onDrop(draggedId);
               setHoverCart(false);
               setDraggedId(null);
               if (setDraggedGroupId) setDraggedGroupId(null);
             }}>
          <button onClick={() => setCollapsed(false)} style={cartCollapseBtn} title="Expand full list">‹</button>
          <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontFamily: S.mono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#fff', cursor: 'pointer' }} onClick={() => setCollapsed(false)}>
            {active.name}
          </div>
          <div style={{ flex: 1 }}></div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingBottom: 16 }}>
            <div style={{ fontFamily: S.mono, fontSize: 9, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Items</div>
            <div style={{ fontFamily: S.mono, fontSize: 18, color: T.orange }}>{totalQty}</div>
          </div>
        </div>
      );
    }

    // The project's items, filtered by the search box and grouped by category.
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    const shown = projectItems.filter(pi => {
      const hay = ((pi.name || '') + ' ' + (pi.category || '')).toLowerCase();
      return tokens.every(t => hay.includes(t));
    });
    const grouped = shown.reduce((acc, pi) => {
      const cat = pi.category || 'Other';
      (acc[cat] = acc[cat] || []).push(pi);
      return acc;
    }, {});
    const meta = [active.shoot, active.location].filter(Boolean).join(' · ');

    return (
      <div data-tour="project-panel" style={cartRoot(hoverCart, width)}
           onDragOver={(e) => { e.preventDefault(); setHoverCart(true); }}
           onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHoverCart(false); }}
           onDrop={(e) => {
             e.preventDefault();
             if (draggedGroupId && onDropGroup) onDropGroup(draggedGroupId);
             else if (draggedId) onDrop(draggedId);
             setHoverCart(false);
             setDraggedId(null);
             if (setDraggedGroupId) setDraggedGroupId(null);
           }}>
        {ResizeHandle}

        {/* Title: the project picker reads as the panel's heading */}
        <div style={cartHead}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ position: 'relative' }}>
              <select value={activeProjectId} onChange={e => onSelectProject(e.target.value)} title="Switch project" style={cartSelect}>
                {projects.map(p => <option key={p.id} value={p.id} style={{ color: T.ink, background: '#fff' }}>{p.name}</option>)}
              </select>
              <span aria-hidden="true" style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.orange, fontSize: 12 }}>▾</span>
            </div>
            <div style={cartSub}>{meta || 'Active project'}</div>
          </div>
          <button onClick={() => setCollapsed(true)} style={cartCollapseBtn} title="Minimise full list">›</button>
        </div>

        {/* Search the list; + starts a new project */}
        <div style={{ display: 'flex', borderBottom: '1px solid #000', flexShrink: 0 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${projectItems.length} item${projectItems.length === 1 ? '' : 's'}`} style={cartSearch} />
          {onNewProject && <button onClick={onNewProject} title="New project" style={cartPlus}>+</button>}
        </div>

        <div style={cartList}>
          {projectItems.length === 0 && (
            <div style={emptyCart}>
              <div style={{ fontFamily: S.mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Drag gear here</div>
            </div>
          )}
          {projectItems.length > 0 && shown.length === 0 && (
            <div style={{ padding: '18px 16px', fontFamily: S.mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: DIM }}>No matches</div>
          )}
          {Object.entries(grouped).map(([cat, rows]) => (
            <React.Fragment key={cat}>
              <div style={cartGroup}>
                <span>{cat}</span>
                <span>{rows.reduce((n, pi) => n + (pi.qty || 0), 0)}</span>
              </div>
              {rows.map(pi => {
                const hot = hoverRow === pi.id;
                return (
                  <div key={pi.id} style={cartItem} onMouseEnter={() => setHoverRow(pi.id)} onMouseLeave={() => setHoverRow(r => r === pi.id ? null : r)}>
                    <div style={cartImg}>
                      <img src={pi.image_url || window.GEAR_PLACEHOLDER(pi.category)} onError={(e) => { e.currentTarget.src = window.GEAR_PLACEHOLDER(pi.category); }} style={{ position: 'absolute', top: 4, left: 4, width: 'calc(100% - 8px)', height: 'calc(100% - 8px)', objectFit: 'contain' }} alt="" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', minWidth: 0 }} title={pi.name}>
                      <span style={{ fontSize: 12.5, color: '#e8e2d8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pi.name}</span>
                    </div>
                    {/* ×N; hovering the row brings up − and + either side */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 38px 1fr', borderLeft: '1px solid #000' }}>
                      <button onClick={() => onChangeQty(pi.id, -1)} title={pi.qty <= 1 ? 'Remove' : 'Decrease'} style={{ ...cartStep, visibility: hot ? 'visible' : 'hidden' }}>−</button>
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: S.mono, fontSize: 11, color: pi.qty > 1 ? '#fff' : DIM, background: pi.qty > 1 ? T.orange : 'transparent' }}>×{pi.qty}</span>
                      <button onClick={() => onChangeQty(pi.id, 1)} title="Increase" style={{ ...cartStep, visibility: hot ? 'visible' : 'hidden' }}>+</button>
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>

        <div style={cartFoot}>
          <div style={cartHint}>{totalQty} item{totalQty === 1 ? '' : 's'} · {uniqueCount} unique</div>
          <div style={{ display: 'flex' }}>
            <button onClick={() => onOpenProject(active.id)} style={{ ...cartFootBtn, background: '#242424', color: '#fff', borderRight: '1px solid #000' }}>Open project</button>
            <button onClick={onExport} style={{ ...cartFootBtn, background: T.orange, color: '#fff' }}>Export list</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Left sidebar nav ───────────────────────────────────────────────
  function Sidebar({ page, setPage, items, projects, collapsed, setCollapsed, user, planName, onUpgrade, onOpenAccount, onOpenProject }) {
    return (
      <div style={sideRoot(collapsed)}>
        <div style={brand}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <img src="app-icon.jpg" alt="Gear" style={{ width: 28, height: 28, flexShrink: 0, display: 'block' }} />
            {!collapsed && <span style={{ ...S.wordmark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 15 }}>THE GEAR APP</span>}
          </div>
          {!collapsed && <button onClick={() => setCollapsed(!collapsed)} style={collapseBtn}>‹</button>}
          {collapsed && <button onClick={() => setCollapsed(!collapsed)} style={{ ...collapseBtn, position: 'absolute', right: -10, top: 22, background: T.ink, border: '1px solid rgba(255,255,255,0.15)' }}>›</button>}
        </div>
        <NavItem icon="▣" label="Inventory" count={items.length} active={page === 'inventory'} onClick={() => setPage('inventory')} collapsed={collapsed} />
        <NavItem tour="nav-suggest" icon="✧" label="Suggest" active={page === 'suggest'} onClick={() => setPage('suggest')} collapsed={collapsed} />
        <NavItem tour="nav-discover" icon="◎" label="Discover" active={page === 'discover'} onClick={() => setPage('discover')} collapsed={collapsed} />
        <NavItem icon="◈" label="Database" active={page === 'database'} onClick={() => setPage('database')} collapsed={collapsed} />
        <NavItem icon="◧" label="Projects" count={projects.length} active={page === 'projects'} onClick={() => setPage('projects')} collapsed={collapsed} />
        <NavItem tour="nav-guide" icon="?" label="Guide" active={page === 'guide'} onClick={() => setPage('guide')} collapsed={collapsed} />
        {!collapsed && <div style={{ ...S.label, color: 'rgba(255,255,255,0.4)', padding: '18px 16px 6px' }}>Recent projects</div>}
        {!collapsed && projects.slice(0, 3).map(p => (
          <div key={p.id} style={{ ...recentRow, cursor: 'pointer' }} onClick={() => onOpenProject && onOpenProject(p.id)}>
            <span style={{ display: 'inline-block', width: 8, height: 8, background: p.status === 'active' ? T.orange : p.status === 'wrapped' ? '#666' : '#b9a983', flexShrink: 0 }}></span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
          </div>
        ))}
        <div style={{ flex: 1 }}></div>
        {onUpgrade && !collapsed && (
          <div style={{ padding: '0 14px 14px' }}>
            <button onClick={onUpgrade} style={{ width: '100%', background: 'rgba(255,87,12,0.14)', border: `1px solid ${T.orange}`, color: '#fff', padding: '9px 10px', cursor: 'pointer', fontFamily: S.mono, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              ✦ Upgrade to Pro
            </button>
          </div>
        )}
        <div style={{ ...userBar(collapsed), cursor: 'pointer', transition: 'background .12s' }}
             onClick={onOpenAccount}
             onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
             onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
             title="Open account">
          <div style={{ width: 30, height: 30, background: T.orange, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: S.mono, fontSize: 13, flexShrink: 0 }}>{(user?.name || 'U').charAt(0).toUpperCase()}</div>
          {!collapsed && (
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || 'Account'}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontFamily: S.mono, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{planName ? `${planName} plan` : 'Account'}</div>
            </div>
          )}
          {!collapsed && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>›</span>}
        </div>
      </div>
    );
  }

  function NavItem({ icon, label, count, active, onClick, collapsed, tour }) {
    return (
      <div data-tour={tour} onClick={onClick} style={navItem(active, collapsed)}
           onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
           onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
        <span style={{ width: 16, fontSize: 14, opacity: 0.85, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
        {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
        {!collapsed && count !== undefined && <span style={{ fontSize: 11, fontFamily: S.mono, color: active ? '#fff' : 'rgba(255,255,255,0.45)' }}>{count}</span>}
      </div>
    );
  }

  // ─── Styles (declared after components) ─────────────────────────────
  const sideRoot = (col) => ({ width: col ? 56 : 220, background: T.ink, color: '#fff', borderRight: '1px solid #000', display: 'flex', flexDirection: 'column', flexShrink: 0, transition: 'width .18s', position: 'relative' });
  const brand = { height: 64, padding: '0 16px', borderBottom: '1px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
  const collapseBtn = { background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.6)', width: 22, height: 22, cursor: 'pointer', fontSize: 12 };
  const navItem = (a, col) => ({ display: 'flex', alignItems: 'center', gap: 10, height: 40, borderBottom: '1px solid #000', padding: col ? 0 : '0 16px', fontFamily: S.mono, fontSize: 13, letterSpacing: '0.04em', color: a ? '#fff' : 'rgba(255,255,255,0.72)', background: a ? T.orange : 'transparent', cursor: 'pointer', justifyContent: col ? 'center' : 'flex-start' });
  const recentRow = { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px 6px 23px', fontSize: 12, color: 'rgba(255,255,255,0.6)' };
  const userBar = (col) => ({ display: 'flex', alignItems: 'center', gap: 10, padding: 14, borderTop: '1px solid #000', justifyContent: col ? 'center' : 'flex-start' });

  const DIM = '#8a827b';
  const cartRoot = (drag, width = 400) => ({ width: width, background: T.ink, color: '#fff', borderLeft: '1px solid #000', display: 'flex', flexDirection: 'column', flexShrink: 0, outline: drag ? `3px solid ${T.orange}` : '3px solid transparent', outlineOffset: -3, transition: 'outline-color .12s', position: 'relative' });
  const cartCollapsed = (drag) => ({ width: 48, background: T.ink, color: '#fff', borderLeft: '1px solid #000', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, padding: '14px 0', gap: 14, outline: drag ? `3px solid ${T.orange}` : '3px solid transparent', outlineOffset: -3, transition: 'outline-color .12s', position: 'relative' });
  const cartCollapseBtn = { background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.7)', width: 22, height: 22, cursor: 'pointer', fontSize: 12, flexShrink: 0 };
  const cartHead = { display: 'flex', alignItems: 'center', gap: 10, minHeight: 64, padding: '0 16px', borderBottom: '1px solid #000', flexShrink: 0 };
  const cartSelect = { width: '100%', background: 'transparent', color: '#fff', border: 'none', borderRadius: 0, padding: '0 18px 0 0', fontFamily: S.mono, fontSize: 15, letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer', outline: 'none', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', textOverflow: 'ellipsis' };
  const cartSub = { fontFamily: S.mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: DIM, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
  const cartSearch = { flex: 1, minWidth: 0, height: 40, border: 'none', borderRadius: 0, background: '#242424', color: '#fff', padding: '0 16px', fontSize: 13, fontFamily: S.sans, outline: 'none' };
  const cartPlus = { width: 40, border: 'none', background: T.orange, color: '#fff', fontFamily: S.mono, fontSize: 18, cursor: 'pointer', padding: 0 };
  const cartList = { flex: 1, overflowY: 'auto' };
  const cartGroup = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 26, padding: '0 16px', background: '#111', borderBottom: '1px solid #000', fontFamily: S.mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: DIM };
  const cartItem = { display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr) 96px', height: 44, borderBottom: '1px solid #000' };
  const cartImg = { position: 'relative', background: '#fff', borderRight: '1px solid #000', overflow: 'hidden', minWidth: 0 };
  const cartStep = { border: 'none', background: 'transparent', color: '#fff', fontSize: 15, cursor: 'pointer', padding: 0 };
  const cartFoot = { borderTop: '1px solid #000', flexShrink: 0 };
  const cartHint = { padding: '10px 16px', fontFamily: S.mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: DIM };
  const cartFootBtn = { flex: 1, height: 42, border: 'none', fontFamily: S.mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' };
  const emptyCart = { margin: 14, padding: '28px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.45)', border: '1px dashed rgba(255,255,255,0.25)' };

  window.STUDIO_SHELL = { Sidebar, CartPanel };
})();
