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
    const meta = [p.client, p.shoot, p.location].filter(Boolean).join(' · ');
    const shown = items.slice(0, items.length > 6 ? 5 : 6);
    return (
      <div style={card} onClick={editMode ? undefined : onOpen}
           onMouseEnter={e => { if (!editMode) e.currentTarget.style.outline = `2px solid ${T.orange}`; }}
           onMouseLeave={e => { e.currentTarget.style.outline = 'none'; }}>
        {editMode && (
          <button onClick={handleDelete} title="Delete project" style={delBtn}>×</button>
        )}
        <div style={{ padding: '14px 16px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={S.pill(sCol.bg, sCol.fg)}>{p.status}</span>
            <span style={{ fontFamily: S.mono, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.textMute }}>{totalQty} item{totalQty === 1 ? '' : 's'}</span>
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
              style={{ display: 'block', width: '100%', margin: '10px 0 4px', background: '#fff', border: `1px solid ${T.paperEdge}`, outline: 'none', fontSize: 20, lineHeight: 1.2, fontFamily: S.mono, padding: '4px 8px', color: T.ink }}
            />
          ) : (
            <div style={{ fontSize: 20, lineHeight: 1.2, margin: '10px 0 4px', fontFamily: S.mono, letterSpacing: '0.01em' }}>{p.name}</div>
          )}
          {meta && <div style={{ fontSize: 13, color: T.textMute }}>{meta}</div>}
        </div>

        {/* Kit strip: the first items as photo cells, then a +N cell */}
        <div style={kitStrip}>
          {[0, 1, 2, 3, 4, 5].map(i => {
            const pi = shown[i];
            if (pi) return (
              <div key={pi.id} style={kitChip} title={pi.name}>
                <img src={pi.image_url || window.GEAR_PLACEHOLDER(pi.category)} onError={(e) => { e.currentTarget.src = window.GEAR_PLACEHOLDER(pi.category); }} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 5 }} alt="" />
                {pi.qty > 1 && (
                  <div style={{ position: 'absolute', bottom: 0, right: 0, background: T.orange, color: '#fff', fontSize: 10, padding: '1px 5px', fontFamily: S.mono }}>{pi.qty}</div>
                )}
              </div>
            );
            if (i === 5 && items.length > 6) return (
              <div key="more" style={{ ...kitChip, background: T.paperLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: S.mono, fontSize: 12, color: T.textMute }}>+{items.length - 5}</div>
            );
            return <div key={'e' + i} style={kitChip} />;
          })}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
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

  const card = { background: '#fff', border: `1px solid ${T.ink}`, outlineOffset: -1, cursor: 'pointer', transition: 'border-color .12s', position: 'relative', display: 'flex', flexDirection: 'column' };
  const delBtn = { position: 'absolute', top: 10, right: 10, width: 24, height: 24, border: `1px solid #f3d9d0`, background: '#fff', color: '#c44a2c', cursor: 'pointer', fontSize: 14, lineHeight: 1, zIndex: 2 };
  const kitStrip = { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', borderTop: `1px solid ${T.ink}`, marginTop: 'auto' };
  const kitChip = { height: 56, background: '#fff', position: 'relative', overflow: 'hidden', borderRight: `1px solid ${T.ink}` };
  const emptyCard = { background: 'transparent', border: `1px dashed ${T.ink}`, padding: 20, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, transition: 'border-color .14s' };

  window.STUDIO_PROJECTS = ProjectsPage;
})();
