// Studio app shell — sidebar nav + cart panel + main routing.
(function () {
  const { useState, useMemo } = React;
  const S = window.STUDIO_STYLES;
  const T = S.T;

  // ─── Right cart panel ───────────────────────────────────────────────
  function CartPanel({ projects, activeProjectId, projectItems = [], onSelectProject, items, hoverCart, setHoverCart, draggedId, setDraggedId, onDrop, onChangeQty, onRemove, onExport, onOpenProject, onNewProject, collapsed, setCollapsed }) {
    const active = projects.find(p => p.id === activeProjectId);
    if (!active) {
      // No project selected — always show the full CTA (collapsing here just
      // hides the "+ New Project" button behind a thin "Full list" bar).
      return (
        <div style={cartRoot(false)}>
          <div style={cartHead}>
            <div>
              <div style={{ fontFamily: S.mono, fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 4 }}>Full list</div>
              <div style={{ fontFamily: S.mono, fontSize: 14, fontWeight: 600, color: '#fff' }}>No project</div>
            </div>
          </div>
          <div style={{ flex: 1, padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
            <div style={{ fontFamily: S.mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Open or create a project</div>
            <div style={{ fontSize: 12, lineHeight: 1.5, maxWidth: 220 }}>Projects hold a kit list. Drag items here from your inventory once a project is active.</div>
            {onNewProject && (
              <button onClick={onNewProject} style={{ marginTop: 8, padding: '10px 14px', background: T.orange, color: '#fff', border: 'none', borderRadius: 4, fontFamily: S.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>+ New Project</button>
            )}
          </div>
        </div>
      );
    }
    const totalQty = projectItems.reduce((s, it) => s + (it.qty || 0), 0);
    const uniqueCount = projectItems.length;

    if (collapsed) {
      return (
        <div style={cartCollapsed(hoverCart)}
             onDragOver={(e) => { e.preventDefault(); setHoverCart(true); }}
             onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHoverCart(false); }}
             onDrop={(e) => { e.preventDefault(); if (draggedId) onDrop(draggedId); setHoverCart(false); setDraggedId(null); }}>
          <button onClick={() => setCollapsed(false)} style={cartCollapseBtn} title="Expand full list">‹</button>
          <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontFamily: S.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)', cursor: 'pointer' }} onClick={() => setCollapsed(false)}>
            {active.name}
          </div>
          <div style={{ flex: 1 }}></div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingBottom: 16 }}>
            <div style={{ fontFamily: S.mono, fontSize: 9, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Items</div>
            <div style={{ fontFamily: S.mono, fontSize: 18, fontWeight: 600, color: '#fff' }}>{totalQty}</div>
          </div>
        </div>
      );
    }

    return (
      <div style={cartRoot(hoverCart)}
           onDragOver={(e) => { e.preventDefault(); setHoverCart(true); }}
           onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHoverCart(false); }}
           onDrop={(e) => { e.preventDefault(); if (draggedId) onDrop(draggedId); setHoverCart(false); setDraggedId(null); }}>
        <div style={cartHead}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...S.label, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Active project</div>
              <select value={activeProjectId} onChange={e => onSelectProject(e.target.value)}
                      style={{ background: 'transparent', color: '#fff', border: 'none', fontSize: 20, fontWeight: 600, padding: 0, cursor: 'pointer', outline: 'none', width: '100%', fontFamily: S.mono, letterSpacing: '-0.01em', appearance: 'none' }}>
                {projects.map(p => <option key={p.id} value={p.id} style={{ color: T.ink, fontFamily: 'inherit' }}>{p.name}</option>)}
              </select>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: S.mono, marginTop: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {active.shoot} · {active.location}
              </div>
            </div>
            <button onClick={() => setCollapsed(true)} style={cartCollapseBtn} title="Minimise full list">›</button>
          </div>
        </div>

        <div style={cartList}>
          {projectItems.length === 0 && (
            <div style={emptyCart}>
              <div style={{ fontFamily: S.mono, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>No items yet</div>
            </div>
          )}
          {projectItems.map(pi => {
            const R = window.GEAR_ROW;
            return (
              <div key={pi.id} style={cartItem}>
                <div style={{ position: 'relative', width: cartRowH, height: cartRowH, padding: 6, flexShrink: 0 }}>
                  <div style={{ width: '100%', height: '100%', background: '#fff', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <img src={pi.image_url || window.GEAR_PLACEHOLDER(pi.category)} onError={(e) => { e.currentTarget.src = window.GEAR_PLACEHOLDER(pi.category); }} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="" />
                  </div>
                  {pi.qty > 1 && (
                    <div style={{ position: 'absolute', bottom: 2, right: 2, background: T.orange, color: '#fff', fontSize: 11, fontFamily: S.mono, fontWeight: 700, padding: '2px 6px', minWidth: 20, textAlign: 'center', lineHeight: 1.3, borderRadius: 4 }}>{pi.qty}</div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0, padding: '0 4px' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{pi.name}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontFamily: S.mono, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{pi.category}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', paddingRight: 12, flexShrink: 0 }}>
                  <div style={R.qPill(true)}>
                    <button onClick={() => onChangeQty(pi.equipment_id, -1)} title={pi.qty <= 1 ? 'Remove' : 'Decrease'} style={R.qPillBtn(true)}>−</button>
                    <button onClick={() => onChangeQty(pi.equipment_id, 1)} style={R.qPillBtn(true)}>+</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={cartFoot}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: S.mono, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            <span>{totalQty} items</span>
            <span style={{ color: '#fff', fontWeight: 600 }}>{uniqueCount} unique</span>
          </div>
          <button style={{ ...S.btnP, width: '100%', padding: 11 }} onClick={onExport}>Export Full List</button>
          <button onClick={() => onOpenProject(active.id)} style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.18)', padding: '9px', fontSize: 10, fontFamily: S.mono, cursor: 'pointer', letterSpacing: '0.08em', borderRadius: 4, textTransform: 'uppercase', fontWeight: 600 }}>Open project</button>
        </div>
      </div>
    );
  }

  // ─── Left sidebar nav ───────────────────────────────────────────────
  function Sidebar({ page, setPage, items, projects, collapsed, setCollapsed, user, onOpenAccount, onOpenProject }) {
    return (
      <div style={sideRoot(collapsed)}>
        <div style={brand}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <img src="app-icon.jpg" alt="Gear" style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0, display: 'block' }} />
            {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14 }}>THE GEAR APP</span>}
          </div>
          {!collapsed && <button onClick={() => setCollapsed(!collapsed)} style={collapseBtn}>‹</button>}
          {collapsed && <button onClick={() => setCollapsed(!collapsed)} style={{ ...collapseBtn, position: 'absolute', right: -10, top: 22, background: T.ink, border: '1px solid rgba(255,255,255,0.15)' }}>›</button>}
        </div>
        {!collapsed && <div style={{ ...S.label, color: 'rgba(255,255,255,0.4)', padding: '18px 16px 6px' }}>Workspace</div>}
        <NavItem icon="▣" label="Inventory" count={items.length} active={page === 'inventory'} onClick={() => setPage('inventory')} collapsed={collapsed} />
        <NavItem icon="◈" label="Database" active={page === 'database'} onClick={() => setPage('database')} collapsed={collapsed} />
        <NavItem icon="◧" label="Projects" count={projects.length} active={page === 'projects'} onClick={() => setPage('projects')} collapsed={collapsed} />
        {!collapsed && <div style={{ ...S.label, color: 'rgba(255,255,255,0.4)', padding: '18px 16px 6px' }}>Recent projects</div>}
        {!collapsed && projects.slice(0, 3).map(p => (
          <div key={p.id} style={{ ...recentRow, cursor: 'pointer' }} onClick={() => onOpenProject && onOpenProject(p.id)}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: window.GEAR.statusColor[p.status].fg, opacity: 0.85, flexShrink: 0 }}></span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
          </div>
        ))}
        <div style={{ flex: 1 }}></div>
        <div style={{ ...userBar(collapsed), cursor: 'pointer', transition: 'background .12s' }}
             onClick={onOpenAccount}
             onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
             onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
             title="Open account">
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.orange, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>{(user?.name || 'U').charAt(0).toUpperCase()}</div>
          {!collapsed && (
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || 'Account'}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontFamily: S.mono, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{user?.plan || 'Studio'} plan</div>
            </div>
          )}
          {!collapsed && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>›</span>}
        </div>
      </div>
    );
  }

  function NavItem({ icon, label, count, active, onClick, collapsed }) {
    return (
      <div onClick={onClick} style={navItem(active, collapsed)}
           onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
           onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
        <span style={{ width: 16, fontSize: 14, opacity: 0.85, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
        {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
        {!collapsed && count !== undefined && <span style={{ fontSize: 10, fontFamily: S.mono, color: 'rgba(255,255,255,0.45)' }}>{count}</span>}
      </div>
    );
  }

  // ─── Styles (declared after components) ─────────────────────────────
  const sideRoot = (col) => ({ width: col ? 56 : 220, background: T.ink, color: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0, transition: 'width .18s', position: 'relative' });
  const brand = { padding: '20px 16px', fontFamily: S.mono, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
  const collapseBtn = { background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.6)', width: 22, height: 22, borderRadius: 4, cursor: 'pointer', fontSize: 12 };
  const navItem = (a, col) => ({ display: 'flex', alignItems: 'center', gap: 10, padding: col ? '10px 0' : '9px 16px 9px 13px', fontSize: 13, color: a ? '#fff' : 'rgba(255,255,255,0.7)', background: a ? 'rgba(255,87,12,0.16)' : 'transparent', borderLeft: col ? 'none' : (a ? `3px solid ${T.orange}` : '3px solid transparent'), cursor: 'pointer', justifyContent: col ? 'center' : 'flex-start' });
  const recentRow = { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px 6px 23px', fontSize: 12, color: 'rgba(255,255,255,0.6)' };
  const userBar = (col) => ({ display: 'flex', alignItems: 'center', gap: 10, padding: 14, borderTop: '1px solid rgba(255,255,255,0.08)', justifyContent: col ? 'center' : 'flex-start' });

  const cartRoot = (drag) => ({ width: 400, background: T.ink, color: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0, outline: drag ? `3px solid ${T.orange}` : '3px solid transparent', outlineOffset: -3, transition: 'outline-color .12s' });
  const cartCollapsed = (drag) => ({ width: 48, background: T.ink, color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, padding: '14px 0', gap: 14, outline: drag ? `3px solid ${T.orange}` : '3px solid transparent', outlineOffset: -3, transition: 'outline-color .12s', position: 'relative' });
  const cartCollapseBtn = { background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.7)', width: 22, height: 22, borderRadius: 4, cursor: 'pointer', fontSize: 12, flexShrink: 0 };
  const cartHead = { padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' };
  const cartList = { flex: 1, overflowY: 'auto', padding: '8px 0' };
  const cartRowH = 56;
  const cartItem = { display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', height: cartRowH };
  const cartFoot = { padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: 8 };
  const emptyCart = { padding: '32px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' };

  window.STUDIO_SHELL = { Sidebar, CartPanel };
})();
