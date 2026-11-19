// Studio Projects page — folder-style cards with a thumbnail grid.
(function () {
  const { useState } = React;
  const S = window.STUDIO_STYLES;
  const T = S.T;

  // Project card in the folder style: status + date, the name in spaced caps,
  // a big orange item count, then a 5-column grid of white thumbnail tiles
  // split by 1px black rules. The dot texture lives on this card only.
  function ProjectCard({ p, items, editMode, onOpen, onDelete, onRename }) {
    const [hot, setHot] = useState(false);
    const totalQty = items.reduce((s, pi) => s + (pi.qty || 0), 0);
    const handleDelete = (e) => {
      e.stopPropagation();
      if (window.confirm(`Delete "${p.name}"? This removes the project and its kit list.`)) onDelete(p.id);
    };
    const meta = [p.client, p.location].filter(Boolean).join(' · ');
    // Ink card: status reads on dark (active stays brand orange).
    const tag = p.status === 'active'
      ? { background: T.orange, color: '#fff', border: `1px solid ${T.orange}` }
      : { background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.28)' };

    // Two rows of tiles, three once there are more than ten items. When there
    // are more items than tiles the last tile reads +N.
    const n = items.length;
    const cells = n > 10 ? 15 : 10;
    const cap = n > cells ? cells - 1 : cells;
    const tiles = [];
    for (let i = 0; i < cells; i++) {
      const pi = items[i];
      if (i < cap && pi) {
        tiles.push(
          <div key={pi.id || i} style={tile} title={pi.name}>
            <img src={pi.image_url || window.GEAR_PLACEHOLDER(pi.category)} onError={(e) => { e.currentTarget.src = window.GEAR_PLACEHOLDER(pi.category); }} style={{ position: 'absolute', inset: 4, width: 'calc(100% - 8px)', height: 'calc(100% - 8px)', objectFit: 'contain' }} alt="" />
            {pi.qty > 1 && (
              <div style={{ position: 'absolute', bottom: 0, right: 0, background: T.orange, color: '#fff', fontSize: 10, padding: '1px 5px', fontFamily: S.mono }}>{pi.qty}</div>
            )}
          </div>
        );
      } else if (i === cells - 1 && n > cells) {
        tiles.push(<div key="more" style={{ ...tile, background: T.paperLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: S.mono, fontSize: 13, color: T.textMute }}>+{n - cap}</div>);
      } else {
        tiles.push(<div key={'e' + i} style={{ ...tile, background: '#000' }} />);
      }
    }

    return (
      <div style={card} onClick={editMode ? undefined : onOpen}
           onMouseEnter={e => { setHot(true); if (!editMode) e.currentTarget.style.outline = `2px solid ${T.orange}`; }}
           onMouseLeave={e => { setHot(false); e.currentTarget.style.outline = 'none'; }}>
        {editMode && (
          <button onClick={handleDelete} title="Delete project" style={delBtn}>×</button>
        )}
        <div style={{ padding: '16px 16px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ ...S.pill('transparent', '#fff'), ...tag }}>{p.status}</span>
            {!editMode && (p.shoot || p.date) && <span style={{ fontFamily: S.mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', textAlign: 'right' }}>{p.shoot || p.date}</span>}
          </div>
          {editMode ? (
            <input
              defaultValue={p.name}
              key={p.id + ':' + p.name}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onBlur={(e) => {
                const v = (e.target.value || '').trim();
                if (v && v !== p.name) onRename && onRename(p.id, v);
                if (!v) e.target.value = p.name;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.target.blur();
                if (e.key === 'Escape') { e.target.value = p.name; e.target.blur(); }
              }}
              style={{ display: 'block', width: '100%', margin: '14px 0 4px', background: '#fff', border: `1px solid ${T.paperEdge}`, outline: 'none', fontSize: 16, lineHeight: 1.2, fontFamily: S.mono, padding: '4px 8px', color: T.ink }}
            />
          ) : (
            <div style={{ fontFamily: S.mono, fontSize: 14, letterSpacing: '0.14em', textTransform: 'uppercase', lineHeight: 1.35, margin: '14px 0 0', color: 'rgba(255,255,255,0.88)' }}>{p.name}</div>
          )}
          {meta && <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{meta}</div>}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 12, fontFamily: S.mono }}>
            <span style={{ fontSize: 44, lineHeight: 1, color: T.orange }}>{totalQty}</span>
            <span style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Item{totalQty === 1 ? '' : 's'}</span>
            {n !== totalQty && <span style={{ marginLeft: 'auto', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>{n} unique</span>}
          </div>
        </div>

        <div style={tileGrid}>{tiles}</div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 34, padding: '0 16px', fontFamily: S.mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a827b' }}>
          <span>Kit list</span>
          <span style={{ color: hot && !editMode ? T.orange : '#8a827b' }}>Open ›</span>
        </div>
      </div>
    );
  }

  function ProjectsPage({ projects, catalog, projectItems = {}, activeProjectId, onSelectProject, onOpenProject, onNewProject, onDeleteProject, onRenameProject }) {
    const R = window.GEAR_ROW;
    const { pageHead, pageTitle, countChip, catChip } = R;
    const [filter, setFilter] = useState('all'); // all, active, planning, wrapped
    const [query, setQuery] = useState('');
    const [editMode, setEditMode] = useState(false);
    const filtered = projects.filter(p => {
      if (filter !== 'all' && p.status !== filter) return false;
      if (query && !(p.name + ' ' + p.client + ' ' + p.location).toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={pageHead}>
          <div style={pageTitle}>Projects</div>
          <div style={countChip}>{filtered.length} of {projects.length}</div>
          <div style={{ position: 'relative', flex: 1, minWidth: 130, maxWidth: 360, marginRight: 'auto' }}>
            <input style={R.headSearch(!!query)}
                   placeholder="Search projects..."
                   value={query} onChange={e => setQuery(e.target.value)} />
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>⌕</span>
            {query && (
              <button onClick={() => setQuery('')} title="Clear" type="button"
                      style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, border: 'none', background: 'rgba(255,255,255,0.12)', color: '#fff', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            )}
          </div>
          <button style={R.editToggleBtn(editMode)} onClick={() => setEditMode(e => !e)}>
            {editMode ? '✕ Done' : '✎ Edit'}
          </button>
          <button data-tour="new-project" style={S.btnP} onClick={onNewProject}>+ New Project</button>
        </div>

        <div style={R.catRow}>
          {[['all', 'All'], ['active', 'Active'], ['planning', 'Planning'], ['wrapped', 'Wrapped']].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} style={catChip(filter === k)}>
              {l}
              <span style={{ marginLeft: 6, opacity: 0.6, fontFamily: S.mono, fontSize: 9 }}>
                {k === 'all' ? projects.length : projects.filter(p => p.status === k).length}
              </span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px', background: T.paper }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14, alignItems: 'start' }}>
            {filtered.map(p => (
              <ProjectCard key={p.id} p={p} items={projectItems[p.id] || []} editMode={editMode} onDelete={onDeleteProject} onRename={onRenameProject} onOpen={() => { onSelectProject(p.id); onOpenProject(p.id); }} />
            ))}
            <div onClick={onNewProject} style={emptyCard}>
              <div style={{ fontSize: 28, color: T.textMute, marginBottom: 6 }}>+</div>
              <div style={{ fontFamily: S.mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.textMute }}>New project</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const card = { background: `${T.ink} radial-gradient(circle, rgba(255,255,255,0.14) 1px, transparent 1.2px) 0 0 / 22px 22px`, color: '#fff', border: `1px solid ${T.ink}`, outlineOffset: -1, cursor: 'pointer', transition: 'border-color .12s', position: 'relative', display: 'flex', flexDirection: 'column' };
  const delBtn = { position: 'absolute', top: 10, right: 10, width: 24, height: 24, border: `1px solid #f3d9d0`, background: '#fff', color: '#c44a2c', cursor: 'pointer', fontSize: 14, lineHeight: 1, zIndex: 2 };
  const tileGrid = { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: '#000', borderTop: '1px solid #000', borderBottom: '1px solid #000' };
  const tile = { position: 'relative', aspectRatio: '1 / 1', background: '#fff', overflow: 'hidden' };
  const emptyCard = { background: 'transparent', border: `1px dashed ${T.ink}`, padding: 20, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, transition: 'border-color .14s' };

  window.STUDIO_PROJECTS = ProjectsPage;
})();
