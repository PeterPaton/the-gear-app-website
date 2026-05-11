// Studio Projects page — card grid with kit-strip preview.
(function () {
  const { useState } = React;
  const S = window.STUDIO_STYLES;
  const T = S.T;

  function ProjectCard({ p, items, editMode, onOpen, onDelete, onRename }) {
    const sCol = window.GEAR.statusColor[p.status];
    const totalQty = items.reduce((s, pi) => s + (pi.qty || 0), 0);
    const handleDelete = (e) => {
      e.stopPropagation();
      if (window.confirm(`Delete "${p.name}"? This removes the project and its kit list.`)) onDelete(p.id);
    };
    return (
      <div style={card} onClick={editMode ? undefined : onOpen}
           onMouseEnter={e => { if (!editMode) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; } }}
           onMouseLeave={e => { if (!editMode) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; } }}>
        {editMode && (
          <button onClick={handleDelete} title="Delete project" style={delBtn}>×</button>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: S.mono, fontSize: 9, color: T.textMute, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>{p.client}</div>
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
                style={{ width: '100%', background: '#fff', border: `1px solid ${T.paperEdge}`, borderRadius: 4, outline: 'none', fontSize: 22, fontWeight: 600, lineHeight: 1.15, marginBottom: 4, fontFamily: S.mono, letterSpacing: '-0.01em', padding: '4px 8px', color: T.ink }}
              />
            ) : (
              <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.15, marginBottom: 4, fontFamily: S.mono, letterSpacing: '-0.01em' }}>{p.name}</div>
            )}
            <div style={{ fontFamily: S.mono, fontSize: 10, color: T.textMute, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{p.shoot} · {p.location}</div>
          </div>
          <span style={S.pill(sCol.bg, sCol.fg)}>{p.status}</span>
        </div>

        {/* Kit strip — first 8 items as thumbnails, qty badge for >1 */}
        <div style={kitStrip}>
          {items.slice(0, 8).map(pi => (
            <div key={pi.id} style={kitChip} title={pi.name}>
              <img src={pi.image_url || window.GEAR_PLACEHOLDER(pi.category)} onError={(e) => { e.currentTarget.src = window.GEAR_PLACEHOLDER(pi.category); }} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 5, background: '#fff' }} alt="" />
              {pi.qty > 1 && (
                <div style={{ position: 'absolute', bottom: 2, right: 2, background: T.orange, color: '#fff', fontSize: 9, padding: '1px 4px', fontFamily: S.mono, fontWeight: 700, borderRadius: 2 }}>{pi.qty}</div>
              )}
            </div>
          ))}
          {items.length > 8 && (
            <div style={{ ...kitChip, background: '#f1ece2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: S.mono, fontSize: 11, color: T.textMute, fontWeight: 600 }}>
              +{items.length - 8}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: `1px solid #f0ebe2`, fontFamily: S.mono, fontSize: 11, color: T.textMute, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          <span>{totalQty} items</span>
        </div>
      </div>
    );
  }

  function ProjectsPage({ projects, catalog, projectItems = {}, activeProjectId, onSelectProject, onOpenProject, onNewProject, onDeleteProject, onRenameProject }) {
    const R = window.GEAR_ROW;
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
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <input style={{ ...S.input, padding: query ? '8px 30px 8px 32px' : '8px 12px 8px 32px', background: '#f6f3ee' }}
                   placeholder="Search projects..."
                   value={query} onChange={e => setQuery(e.target.value)} />
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: T.textMute, fontSize: 13 }}>⌕</span>
            {query && (
              <button onClick={() => setQuery('')} title="Clear" type="button"
                      style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, border: 'none', background: 'rgba(0,0,0,0.08)', color: T.ink, borderRadius: '50%', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            )}
          </div>
          <div style={{ flex: 1 }}></div>
          <button style={R.editToggleBtn(editMode)} onClick={() => setEditMode(e => !e)}>
            {editMode ? '✕ Done' : '✎ Edit'}
          </button>
          <button style={S.btnP} onClick={onNewProject}>+ New Project</button>
        </div>

        <div style={{ display: 'flex', gap: 6, padding: '12px 28px', borderBottom: `1px solid ${T.paperEdge}`, background: '#faf7f2', flexShrink: 0 }}>
          {[['all', 'All'], ['active', 'Active'], ['planning', 'Planning'], ['wrapped', 'Wrapped']].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} style={catChip(filter === k)}>
              {l}
              <span style={{ marginLeft: 6, opacity: 0.6, fontFamily: S.mono, fontSize: 9 }}>
                {k === 'all' ? projects.length : projects.filter(p => p.status === k).length}
              </span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 28, background: '#faf7f2' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
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

  const card = { background: '#fff', border: `1px solid ${T.paperEdge}`, borderRadius: 6, padding: 20, cursor: 'pointer', transition: 'transform .14s, box-shadow .14s', position: 'relative' };
  const delBtn = { position: 'absolute', top: 10, left: 10, width: 22, height: 22, border: 'none', background: 'rgba(196,74,44,0.1)', color: '#c44a2c', borderRadius: 4, cursor: 'pointer', fontSize: 14, lineHeight: 1, zIndex: 2 };
  const kitStrip = { display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4, marginBottom: 16 };
  const kitChip = { aspectRatio: '1', background: '#fff', borderRadius: 3, position: 'relative', overflow: 'hidden' };
  const emptyCard = { background: 'transparent', border: `1.5px dashed ${T.paperEdge}`, borderRadius: 6, padding: 20, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 220, transition: 'border-color .14s', };
  const pageHead = { padding: '18px 28px', borderBottom: `1px solid ${T.paperEdge}`, background: '#fff', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 };
  const pageTitle = { fontFamily: S.mono, fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em' };
  const countChip = { fontFamily: S.mono, fontSize: 11, color: T.textMute, padding: '4px 10px', background: '#f1ece2', borderRadius: 3, letterSpacing: '0.04em' };
  const catChip = (a) => ({ padding: '5px 12px', fontSize: 10, fontFamily: S.mono, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: 999, border: a ? 'none' : `1px solid ${T.paperEdge}`, background: a ? T.ink : 'transparent', color: a ? '#fff' : T.ink, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' });

  window.STUDIO_PROJECTS = ProjectsPage;
})();
