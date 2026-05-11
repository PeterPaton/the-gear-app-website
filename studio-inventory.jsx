// Gear · Inventory page — the user's personal gear list.
(function () {
  const { useState, useMemo, useEffect, useRef } = React;
  const S = window.STUDIO_STYLES;
  const T = S.T;
  const R = window.GEAR_ROW;

  function InventoryPage({
    items, projects, activeProjectId,
    density, setDensity,
    onEditItem, onAddToCart, onChangeInvQty,
    groups = [], onCombineIntoGroup, onRenameGroup, onDeleteGroup, onMoveItemToGroup,
    onAddItem, onOpenDatabase, onExportInventory,
    draggedId, setDraggedId, hoverCart, setHoverCart,
  }) {
    const activeProject = projects.find(p => p.id === activeProjectId);
    const [query, setQuery] = useState('');
    // Either 'all' or a category name. Groups are not chip filters anymore;
    // they show as inline section cards within the list.
    const [filter, setFilter] = useState('all');
    const [selected, setSelected] = useState(new Set());
    const [editMode, setEditMode] = useState(false);
    // Row currently being hovered during a drag, for the "drop here to group" highlight.
    const [hoverRowId, setHoverRowId] = useState(null);
    // The group whose name input should be focused (set when a group is just created).
    const [editingGroupId, setEditingGroupId] = useState(null);
    const groupInputRefs = useRef({});
    // Group ids the user has manually collapsed (in-memory, per page mount).
    const [collapsedGroups, setCollapsedGroups] = useState(new Set());
    const toggleGroupCollapse = (id) => setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    // Drag highlight is mutually-exclusive between three zones — the scroll
    // page background, an individual group card, or a single row in the
    // ungrouped Items section. Each handler sets its own and clears the
    // others so only one outline shows at a time, Finder-style.
    const [hoverCardId, setHoverCardId] = useState(null);
    const [hoverPage, setHoverPage] = useState(false);

    // Auto-focus the name field whenever editingGroupId changes (used right
    // after dropping items together to create a new group).
    useEffect(() => {
      if (editingGroupId && groupInputRefs.current[editingGroupId]) {
        const el = groupInputRefs.current[editingGroupId];
        el.focus();
        el.select();
      }
    }, [editingGroupId]);

    const rowH = R.rowH(density);

    const filtered = useMemo(() => {
      const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
      const r = items.filter(it => {
        if (filter !== 'all' && it.category !== filter) return false;
        if (tokens.length > 0) {
          const hay = (it.name + ' ' + (it.brand || '') + ' ' + (it.serial || '') + ' ' + (it.model || '') + ' ' + (it.category || '')).toLowerCase();
          if (!tokens.every(t => hay.includes(t))) return false;
        }
        return true;
      });
      r.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      return r;
    }, [items, query, filter]);

    // Bucket filtered items into per-group lists + an ungrouped bucket.
    const sections = useMemo(() => {
      const itemToGroup = new Map();
      groups.forEach(g => g.itemIds.forEach(id => itemToGroup.set(id, g.id)));
      const groupItems = {};
      groups.forEach(g => { groupItems[g.id] = []; });
      const ungrouped = [];
      filtered.forEach(it => {
        const gid = itemToGroup.get(it.id);
        if (gid && groupItems[gid]) groupItems[gid].push(it);
        else ungrouped.push(it);
      });
      return { groupItems, ungrouped };
    }, [filtered, groups]);

    const toggleSel = (id) => {
      const next = new Set(selected);
      next.has(id) ? next.delete(id) : next.add(id);
      setSelected(next);
    };

    const cats = useMemo(() => {
      const seen = new Set(['All']);
      items.forEach(it => { if (it.category) seen.add(it.category); });
      return Array.from(seen);
    }, [items]);

    // Item row. `inGroup=true` means this row lives inside a group card —
    // drop events should pass through to the card so the whole card lights up
    // (Finder-style) rather than the individual row. Rows in the ungrouped
    // Items section keep the per-row combine target behavior because that's
    // the only place where dragging item-onto-item creates a new group.
    const renderRow = (it, opts) => {
      const inGroup = !!(opts && opts.inGroup);
      const ownedQty = it.qty || 1;
      const isSel = editMode && selected.has(it.id);
      const isRowDropTarget = !inGroup && draggedId && draggedId !== it.id && hoverRowId === it.id && !editMode;
      const rowBg = isSel ? '#fff3ed' : '#faf7f2';

      return (
        <div key={it.id}
             draggable={!editMode}
             onClick={() => { if (editMode) toggleSel(it.id); }}
             onDragStart={(e) => { if (!editMode) { setDraggedId(it.id); e.dataTransfer.effectAllowed = 'copy'; } }}
             onDragEnd={() => { setDraggedId(null); setHoverCart(false); setHoverRowId(null); setHoverCardId(null); setHoverPage(false); }}
             onDragOver={inGroup ? undefined : (e) => {
               if (draggedId && draggedId !== it.id && !editMode) {
                 e.preventDefault();
                 e.stopPropagation();
                 if (hoverRowId !== it.id) setHoverRowId(it.id);
                 if (hoverPage) setHoverPage(false);
                 if (hoverCardId) setHoverCardId(null);
               }
             }}
             onDragLeave={inGroup ? undefined : (e) => {
               if (!e.currentTarget.contains(e.relatedTarget)) setHoverRowId(prev => prev === it.id ? null : prev);
             }}
             onDrop={inGroup ? undefined : (e) => {
               if (draggedId && draggedId !== it.id && !editMode && onCombineIntoGroup) {
                 e.preventDefault();
                 e.stopPropagation();
                 const result = onCombineIntoGroup(draggedId, it.id);
                 setDraggedId(null);
                 setHoverRowId(null);
                 setHoverCart(false);
                 setHoverPage(false);
                 if (result && result.isNew) setEditingGroupId(result.id);
               }
             }}
             style={{
               display: 'flex',
               alignItems: 'stretch',
               borderBottom: '1px solid #f0ebe2',
               background: isRowDropTarget ? '#fff3ed' : (draggedId === it.id ? '#f6f3ee' : rowBg),
               opacity: draggedId === it.id ? 0.5 : 1,
               outline: isSel ? `2px solid ${T.orange}` : (isRowDropTarget ? `2px solid ${T.orange}` : 'none'),
               outlineOffset: '-2px',
               cursor: editMode ? 'pointer' : 'grab',
               height: rowH,
               transition: 'background .08s, outline-color .08s',
             }}
             onMouseEnter={(e) => { if (!isSel && !isRowDropTarget) e.currentTarget.style.background = '#f0ebe2'; }}
             onMouseLeave={(e) => { if (!isSel && !isRowDropTarget) e.currentTarget.style.background = rowBg; }}>

          {/* Image with qty badge */}
          <div style={{ position: 'relative', width: rowH, height: rowH, padding: 6, flexShrink: 0 }}>
            <div style={{ width: '100%', height: '100%', background: isSel ? T.orange : '#fff', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', transition: 'background .12s' }}>
              <img src={window.GEAR.itemImage(it)} onError={(e) => { e.currentTarget.src = window.GEAR_PLACEHOLDER(it.category); }} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="" />
            </div>
            {ownedQty > 1 && (
              <div style={{ position: 'absolute', bottom: 2, right: 2, background: T.orange, color: '#fff', fontSize: 11, fontFamily: S.mono, fontWeight: 700, padding: '2px 6px', minWidth: 20, textAlign: 'center', lineHeight: 1.3, borderRadius: 4 }}>{ownedQty}</div>
            )}
          </div>

          {/* Name + category */}
          <div style={{ flex: 1, minWidth: 0, padding: '0 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
            {it.category && <div style={{ fontSize: 10, fontFamily: S.mono, color: T.textMute, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{it.category}</div>}
          </div>

          {/* +/- qty pill (edit mode only) */}
          {editMode && (
            <div style={{ display: 'flex', alignItems: 'center', paddingRight: 14, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
              <div style={R.qPill(false)}>
                <button onClick={(e) => { e.stopPropagation(); onChangeInvQty && onChangeInvQty(it.id, -1); }} title={ownedQty <= 1 ? 'Remove from inventory' : 'Decrease'} style={R.qPillBtn(false)}>−</button>
                <button onClick={(e) => { e.stopPropagation(); onChangeInvQty && onChangeInvQty(it.id, 1); }} style={R.qPillBtn(false)}>+</button>
              </div>
            </div>
          )}
        </div>
      );
    };

    // Section card: header + list of rows. Optionally an inline editable name
    // for groups; static label for the ungrouped bucket.
    const renderSection = ({ key, group, label, rows }) => {
      if (rows.length === 0 && !group) return null; // skip empty ungrouped section
      const totalQty = rows.reduce((s, it) => s + (it.qty || 1), 0);
      const collapsed = group ? collapsedGroups.has(group.id) : false;
      const cardKey = group ? group.id : '_ungrouped';
      // Only real group cards outline as a drop target. The ungrouped Items
      // card hands its drops through to the page-background drop zone so the
      // "release from group" gesture lights up the whole middle page.
      const isCardDropTarget = !!group && !!draggedId && hoverCardId === cardKey && !editMode;
      const cardDragHandlers = group ? {
        onDragOver: (e) => {
          if (draggedId && !editMode) {
            e.preventDefault();
            e.stopPropagation();
            if (hoverCardId !== cardKey) setHoverCardId(cardKey);
            if (hoverPage) setHoverPage(false);
            if (hoverRowId) setHoverRowId(null);
          }
        },
        onDragLeave: (e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setHoverCardId(prev => prev === cardKey ? null : prev);
          }
        },
        onDrop: (e) => {
          if (draggedId && !editMode && onMoveItemToGroup) {
            e.preventDefault();
            e.stopPropagation();
            onMoveItemToGroup(draggedId, group.id);
            setDraggedId(null);
            setHoverCardId(null);
            setHoverRowId(null);
            setHoverPage(false);
            setHoverCart(false);
          }
        },
      } : {};
      return (
        <div key={key}
             {...cardDragHandlers}
             style={{ marginBottom: 8, background: '#fff', borderRadius: 6, border: `1px solid ${T.paperEdge}`, overflow: 'hidden', outline: isCardDropTarget ? `3px solid ${T.orange}` : 'none', outlineOffset: -2, transition: 'outline-color .12s' }}>
          {/* Header — clicking the bar (anywhere except the rename input)
              toggles collapse. The chevron button still works as a discrete
              control; both call stopPropagation so we don't double-toggle. */}
          <div onClick={() => { if (group) toggleGroupCollapse(group.id); }}
               style={{ padding: '10px 14px 10px 18px', background: '#f6f3ee', borderBottom: collapsed ? 'none' : `1px solid ${T.paperEdge}`, display: 'flex', alignItems: 'center', gap: 10, cursor: group ? 'pointer' : 'default', userSelect: 'none' }}>
            {(() => {
              if (!group) return <span style={{ flex: 1, fontFamily: S.mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink }}>{label}</span>;
              // Names are only renamable when (a) the group was just created
              // and is waiting for its initial name, or (b) the user has the
              // Edit toggle on. Outside those it renders as plain text so
              // accidental clicks don't put the input into edit mode.
              const editable = editMode || editingGroupId === group.id;
              if (!editable) {
                return <span style={{ flex: 1, fontFamily: S.mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink, padding: '2px 0' }}>{group.name}</span>;
              }
              return (
                <input
                  ref={el => { if (el) groupInputRefs.current[group.id] = el; else delete groupInputRefs.current[group.id]; }}
                  defaultValue={group.name}
                  key={group.id + ':' + group.name /* re-mount when name changes externally */}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    const v = (e.target.value || '').trim();
                    if (v && v !== group.name) onRenameGroup && onRenameGroup(group.id, v);
                    if (!v) e.target.value = group.name;
                    setEditingGroupId(prev => prev === group.id ? null : prev);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.target.blur();
                    if (e.key === 'Escape') { e.target.value = group.name; e.target.blur(); }
                  }}
                  // Field styling makes it obvious the name is editable when the user is in Edit mode.
                  style={{ flex: 1, minWidth: 0, background: '#fff', border: `1px solid ${T.paperEdge}`, borderRadius: 4, outline: 'none', fontFamily: S.mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.ink, padding: '5px 10px' }}
                />
              );
            })()}
            <span style={{ fontFamily: S.mono, fontSize: 10, color: T.textMute, fontWeight: 600 }}>{totalQty}</span>
            {group && editMode && (
              <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete group "${group.name}"? Items stay in inventory.`)) onDeleteGroup && onDeleteGroup(group.id); }}
                      title="Delete group"
                      style={{ width: 22, height: 22, border: 'none', background: 'rgba(196,74,44,0.1)', color: '#c44a2c', borderRadius: 4, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
            )}
            {group && (
              <button onClick={(e) => { e.stopPropagation(); toggleGroupCollapse(group.id); }}
                      title={collapsed ? 'Expand group' : 'Collapse group'}
                      style={{ width: 22, height: 22, border: 'none', background: 'rgba(0,0,0,0.06)', color: T.ink, borderRadius: 4, cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform .15s', transform: collapsed ? 'rotate(90deg)' : 'rotate(0deg)' }}>▾</button>
            )}
          </div>
          {!collapsed && (
            <div>
              {rows.length === 0 ? (
                <div style={{ padding: '20px 18px', fontFamily: S.mono, fontSize: 11, color: T.textMute, letterSpacing: '0.06em', textTransform: 'uppercase' }}>No items match the current filter</div>
              ) : rows.map(it => renderRow(it, { inGroup: !!group }))}
            </div>
          )}
        </div>
      );
    };

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={R.pageHead}>
          <div style={R.pageTitle}>Inventory</div>
          <div style={R.countChip}>{filtered.length} of {items.length}</div>
          <div style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
            <input style={{ ...S.input, padding: query ? '8px 30px 8px 32px' : '8px 12px 8px 32px', background: '#f6f3ee' }}
                   placeholder="Search inventory..."
                   value={query} onChange={e => setQuery(e.target.value)} />
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: T.textMute, fontSize: 13 }}>⌕</span>
            {query && (
              <button onClick={() => setQuery('')} title="Clear" type="button"
                      style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, border: 'none', background: 'rgba(0,0,0,0.08)', color: T.ink, borderRadius: '50%', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            )}
          </div>
          <div style={{ flex: 1 }} />
          <button style={R.editToggleBtn(editMode)} onClick={() => { setEditMode(e => !e); setSelected(new Set()); }}>
            {editMode ? '✕ Done' : '✎ Edit'}
          </button>
          <div style={R.densityToggle}>
            <button onClick={() => setDensity('tight')} style={R.densityBtn(density === 'tight')} title="Tight">▤</button>
            <button onClick={() => setDensity('comfortable')} style={R.densityBtn(density === 'comfortable')} title="Comfortable">≡</button>
          </div>
          {onExportInventory && (
            <button style={{ ...S.btnG, padding: '7px 14px', fontSize: 11, fontFamily: S.mono, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }} onClick={onExportInventory}>Export PDF</button>
          )}
          <button style={S.btnP} onClick={onOpenDatabase}>+ Add Item</button>
        </div>

        {editMode && selected.size > 0 && (
          <div style={{ background: T.ink, color: '#fff', padding: '10px 28px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{ fontFamily: S.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>
              {selected.size} item{selected.size > 1 ? 's' : ''} selected
            </div>
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.15)' }} />
            <button style={{ background: T.orange, color: '#fff', border: 'none', padding: '7px 16px', fontSize: 11, fontFamily: S.mono, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.06em', borderRadius: 3, textTransform: 'uppercase' }}
              onClick={() => { selected.forEach(id => onAddToCart(id)); setSelected(new Set()); }}>
              + Add to {activeProject ? activeProject.name : 'project'}
            </button>
            <div style={{ flex: 1 }} />
            <button style={{ background: 'transparent', color: 'rgba(255,255,255,0.5)', border: 'none', padding: '7px 12px', fontSize: 11, fontFamily: S.mono, cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase' }}
              onClick={() => setSelected(new Set())}>✕ Clear</button>
          </div>
        )}

        <div style={R.catRow}>
          <button onClick={() => setFilter('all')} style={R.catChip(filter === 'all')}>
            All<span style={{ marginLeft: 6, opacity: 0.6, fontFamily: S.mono, fontSize: 9 }}>{items.length}</span>
          </button>
          {cats.filter(c => c !== 'All').map(c => (
            <button key={c} onClick={() => setFilter(c)} style={R.catChip(filter === c)}>
              {c}<span style={{ marginLeft: 6, opacity: 0.6, fontFamily: S.mono, fontSize: 9 }}>{items.filter(i => i.category === c).length}</span>
            </button>
          ))}
        </div>

        <div
          style={{ flex: 1, overflowY: 'auto', background: '#faf7f2', padding: '10px 14px', boxShadow: hoverPage ? `inset 0 0 0 3px ${T.orange}` : 'none', transition: 'box-shadow .12s' }}
          onDragOver={(e) => {
            // Page-background drop target. The group cards stopPropagation on
            // their dragover, so we only ever see drags over the empty space
            // around them — exactly the "release this item from its group"
            // gesture the user wants.
            if (draggedId && !editMode) {
              e.preventDefault();
              if (!hoverPage) setHoverPage(true);
              if (hoverCardId) setHoverCardId(null);
              if (hoverRowId) setHoverRowId(null);
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setHoverPage(false);
          }}
          onDrop={(e) => {
            if (draggedId && !editMode && onMoveItemToGroup) {
              e.preventDefault();
              onMoveItemToGroup(draggedId, null);
              setDraggedId(null);
              setHoverPage(false);
              setHoverCardId(null);
              setHoverRowId(null);
              setHoverCart(false);
            }
          }}
        >
          {items.length === 0 ? (
            <div style={{ padding: '60px 40px', textAlign: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 38, opacity: 0.25 }}>▣</div>
                <div style={{ fontSize: 16, color: T.ink, fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Your inventory is empty</div>
                <div style={{ fontSize: 12, maxWidth: 360, lineHeight: 1.5, fontFamily: 'Inter, sans-serif', color: T.textMute }}>Browse the Database to find and add gear to your personal inventory.</div>
                <button style={{ ...S.btnP, marginTop: 6 }} onClick={onOpenDatabase}>Browse Database</button>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '60px 40px', textAlign: 'center', color: T.textMute, fontFamily: S.mono, fontSize: 13 }}>
              No items match. Try clearing filters.
            </div>
          ) : (
            <React.Fragment>
              {/* One section per group. When a filter is active, hide groups
                  that have no matching items (no more "No items match the
                  current filter" empty section). With no filter we still show
                  every group so the user can manage them. */}
              {groups.map(g => {
                const sectionRows = sections.groupItems[g.id] || [];
                if (sectionRows.length === 0 && filter !== 'all') return null;
                return renderSection({ key: g.id, group: g, rows: sectionRows });
              }).filter(Boolean)}
              {/* Ungrouped fallback */}
              {renderSection({
                key: '_ungrouped',
                label: 'Items',
                rows: sections.ungrouped,
              })}
            </React.Fragment>
          )}
        </div>
      </div>
    );
  }

  window.STUDIO_INVENTORY = InventoryPage;
})();
