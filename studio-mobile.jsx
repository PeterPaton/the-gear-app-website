// Gear · Phone layout. Runs on the same App state and actions as the desktop
// studio, laid out for one hand: a bottom tab bar, full-width lists, and
// bottom sheets where the desktop uses drag and drop.
(function () {
  const { useState, useMemo, useEffect } = React;
  const S = window.STUDIO_STYLES;
  const T = S.T;

  const TABS = [
    { k: 'inventory', icon: '▣', label: 'Inventory' },
    { k: 'projects', icon: '◧', label: 'Projects' },
    { k: 'suggest', icon: '✧', label: 'Suggest' },
    { k: 'discover', icon: '◎', label: 'Discover' },
    { k: 'database', icon: '◈', label: 'Database' },
  ];
  const PAGE = 60;

  // Every word in the query has to appear somewhere in the name or category,
  // in any order — the same matching the desktop Database page uses.
  const tokensOf = (q) => q.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (it, tokens) => {
    const hay = (String(it.name || '') + ' ' + String(it.category || '')).toLowerCase();
    return tokens.every(t => hay.includes(t));
  };
  const totalQty = (rows) => rows.reduce((s, r) => s + (r.qty || 0), 0);
  // The catalog id a row stands for: inventory rows link through
  // equipment_id; catalog rows (and pre-refactor inventory rows) use their id.
  const gearKey = (it) => it.equipment_id || it.id;

  // `app` carries the App's state and actions (see index.html), so the phone
  // layout reads and writes exactly what the desktop studio does.
  function MobileApp({ app }) {
    const { user, items, groups, projects, projectItems, catalog, billing } = app;
    const [tab, setTab] = useState('inventory');
    const [visited, setVisited] = useState(() => new Set(['inventory']));
    const [openProjectId, setOpenProjectId] = useState(null);
    const [showAccount, setShowAccount] = useState(false);
    const [showGuide, setShowGuide] = useState(false);
    // { kind: 'gear', id, source: 'inventory' | 'catalog' } | { kind: 'addGear', projectId }
    const [sheet, setSheet] = useState(null);

    const go = (k) => {
      if (k === tab && k === 'projects') setOpenProjectId(null); // tapping Projects again pops back to the list
      setTab(k);
      setVisited(v => (v.has(k) ? v : new Set(v).add(k)));
    };
    const openProject = (id) => { setOpenProjectId(id); app.setActiveProjectId(id); };
    const openProj = openProjectId ? projects.find(p => p.id === openProjectId) : null;
    useEffect(() => { if (openProjectId && !openProj) setOpenProjectId(null); }, [openProjectId, openProj]);

    // Sheets look their subject up live, so quantities update in place and a
    // sheet closes itself if its item is removed.
    const sheetGear = sheet && sheet.kind === 'gear'
      ? (sheet.source === 'inventory' ? items.find(i => i.id === sheet.id) : catalog.find(c => c.id === sheet.id))
      : null;
    const sheetProject = sheet && sheet.kind === 'addGear' ? projects.find(p => p.id === sheet.projectId) : null;
    const sheetGone = sheet && ((sheet.kind === 'gear' && !sheetGear) || (sheet.kind === 'addGear' && !sheetProject));
    useEffect(() => { if (sheetGone) setSheet(null); }, [sheetGone]);

    const title = (TABS.find(t => t.k === tab) || TABS[0]).label;
    const inProject = tab === 'projects' && openProj;

    return (
      <div style={root}>
        <style>{CSS}</style>
        <TopBar
          title={title}
          user={user}
          onAccount={() => setShowAccount(true)}
          onGuide={window.STUDIO_GUIDE ? () => setShowGuide(true) : null}
          onBack={inProject ? () => setOpenProjectId(null) : null}
          backLabel="Projects"
          action={inProject ? <button style={topAction} onClick={() => app.exportProject(openProj)}>PDF</button> : null}
        />

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Pane show={tab === 'inventory'}>
            <InventoryScreen
              items={items} groups={groups} billing={billing}
              onOpenItem={(it) => setSheet({ kind: 'gear', id: it.id, source: 'inventory' })}
              onAdd={() => go('database')}
              onUpgrade={() => app.openUpgrade('inventory')}
            />
          </Pane>
          <Pane show={tab === 'projects'}>
            {openProj ? (
              <ProjectScreen
                key={openProj.id}
                project={openProj}
                rows={projectItems[openProj.id]}
                onChangeQty={(rowId, d) => app.changeQty(rowId, d, openProj.id)}
                onRename={(name) => app.renameProject(openProj.id, name)}
                onStatus={(s) => app.changeProjectStatus(openProj.id, s)}
                onDelete={() => { app.deleteProject(openProj.id); setOpenProjectId(null); }}
                onAddGear={() => setSheet({ kind: 'addGear', projectId: openProj.id })}
              />
            ) : (
              <ProjectsScreen projects={projects} projectItems={projectItems} billing={billing} onOpen={openProject} onNew={app.openNewProject} />
            )}
          </Pane>
          {/* Suggest stays mounted so a kit that's still generating survives a tab switch. */}
          {window.STUDIO_SUGGEST && (
            <Pane show={tab === 'suggest'}>
              <window.STUDIO_SUGGEST compact {...app.suggestProps} />
            </Pane>
          )}
          {window.STUDIO_DISCOVER && visited.has('discover') && (
            <Pane show={tab === 'discover'}>
              <window.STUDIO_DISCOVER compact catalog={catalog} items={items} onAddToInventory={app.saveItem} />
            </Pane>
          )}
          {visited.has('database') && (
            <Pane show={tab === 'database'}>
              <CatalogScreen
                catalog={catalog} items={items} dbStatus={app.dbStatus}
                onOpenItem={(it) => setSheet({ kind: 'gear', id: it.id, source: 'catalog' })}
                onAddToInventory={app.saveItem}
              />
            </Pane>
          )}
        </div>

        <TabBar tab={tab} onTab={go} />

        {showAccount && <AccountScreen app={app} onBack={() => setShowAccount(false)} onGuide={window.STUDIO_GUIDE ? () => { setShowAccount(false); setShowGuide(true); } : null} />}

        {/* "How it works": the same guide as the desktop, full screen. Its
            "Open …" links switch to the matching tab. */}
        {showGuide && (
          <div style={{ ...root, zIndex: 55 }}>
            <window.STUDIO_GUIDE compact
              catalog={app.billingCatalog} items={catalog}
              closeLabel="✕ Close" onClose={() => setShowGuide(false)}
              onNavigate={(page) => { setShowGuide(false); setOpenProjectId(null); go(TABS.some(t => t.k === page) ? page : 'inventory'); }} />
          </div>
        )}

        {sheet && sheet.kind === 'gear' && sheetGear && (
          <GearSheet
            gear={sheetGear}
            invRow={sheet.source === 'inventory' ? sheetGear : items.find(i => gearKey(i) === sheetGear.id)}
            projects={projects} projectItems={projectItems} groups={groups}
            onMoveToGroup={(rowId, groupId, newName) => app.moveItemsToGroup([rowId], groupId, newName)}
            onAddToProject={(projectId, invRow) => app.addToProject(invRow ? invRow.id : sheetGear.id, projectId)}
            onAddToInventory={() => app.saveItem(sheetGear)}
            onChangeInvQty={app.changeInvQty}
            onEdit={(row) => app.editItem(row)}
            onNewProject={() => { setSheet(null); app.openNewProject(); }}
            onClose={() => setSheet(null)}
          />
        )}
        {sheet && sheet.kind === 'addGear' && sheetProject && (
          <AddGearSheet
            project={sheetProject}
            rows={projectItems[sheetProject.id] || []}
            items={items} catalog={catalog}
            onAdd={(id) => app.addToProject(id, sheetProject.id)}
            onClose={() => setSheet(null)}
          />
        )}
      </div>
    );
  }

  function Pane({ show, children }) {
    return <div style={{ flex: 1, minHeight: 0, display: show ? 'flex' : 'none', flexDirection: 'column' }}>{children}</div>;
  }

  // ─── Chrome ─────────────────────────────────────────────────────────
  function TopBar({ title, user, onAccount, onGuide, onBack, backLabel, action }) {
    return (
      <div style={topBar}>
        {onBack ? (
          <button onClick={onBack} style={backBtn}>‹ {backLabel}</button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <img src="app-icon.jpg" alt="Gear" style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0 }} />
            <span style={{ fontFamily: S.mono, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>{title}</span>
          </div>
        )}
        <div style={{ flex: 1 }} />
        {action}
        {onGuide && <button onClick={onGuide} aria-label="How it works" title="How it works" style={guideBtn}>?</button>}
        <button onClick={onAccount} aria-label="Account" style={avatarBtn}>{(user?.name || 'U').charAt(0).toUpperCase()}</button>
      </div>
    );
  }

  function TabBar({ tab, onTab }) {
    return (
      <nav style={tabBar}>
        {TABS.map(t => {
          const active = t.k === tab;
          return (
            <button key={t.k} onClick={() => onTab(t.k)} aria-current={active ? 'page' : undefined} style={tabBtn(active)}>
              <span style={{ fontSize: 17, lineHeight: 1 }}>{t.icon}</span>
              <span style={{ fontFamily: S.mono, fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t.label}</span>
            </button>
          );
        })}
      </nav>
    );
  }

  function Sheet({ title, onClose, tall, children, footer }) {
    return (
      <div style={sheetOverlay} onClick={onClose}>
        <div style={sheetBox(tall)} onClick={e => e.stopPropagation()} role="dialog" aria-label={title}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.paperEdge, margin: '8px auto 0', flexShrink: 0 }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 16px 8px', flexShrink: 0 }}>
            <div style={{ fontFamily: S.mono, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
            <button onClick={onClose} aria-label="Close" style={{ background: T.paperLight, border: 'none', borderRadius: '50%', width: 30, height: 30, fontSize: 18, lineHeight: 1, color: T.textMute, cursor: 'pointer', flexShrink: 0 }}>×</button>
          </div>
          <div className="gm-scroll" style={{ flex: 1, minHeight: 0, padding: '0 16px 16px' }}>{children}</div>
          {footer}
        </div>
      </div>
    );
  }

  // ─── Building blocks ────────────────────────────────────────────────
  function Thumb({ it, size = 48 }) {
    return (
      <div style={{ width: size, height: size, flexShrink: 0, background: '#fff', border: `1px solid ${T.paperLight}`, borderRadius: 6, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={window.GEAR.itemImage(it)} loading="lazy" alt=""
          onError={(e) => { e.currentTarget.src = window.GEAR_PLACEHOLDER(it.category); }}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      </div>
    );
  }

  function GearRow({ it, sub, right, onClick, thumb = 48 }) {
    return (
      <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', background: '#fff', borderBottom: '1px solid #f0ebe2', cursor: onClick ? 'pointer' : 'default' }}>
        <Thumb it={it} size={thumb} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={rowName}>{it.name}</div>
          <div style={rowSub}>{sub !== undefined ? sub : it.category}</div>
        </div>
        {right}
      </div>
    );
  }

  function Stepper({ value, onMinus, onPlus }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${T.paperEdge}`, borderRadius: 6, flexShrink: 0, background: '#fff' }}>
        <button onClick={(e) => { e.stopPropagation(); onMinus(); }} aria-label="Decrease" style={stepBtn}>−</button>
        <span style={{ minWidth: 26, textAlign: 'center', fontFamily: S.mono, fontSize: 14, fontWeight: 600 }}>{value}</span>
        <button onClick={(e) => { e.stopPropagation(); onPlus(); }} aria-label="Increase" style={stepBtn}>+</button>
      </div>
    );
  }

  function SearchBox({ value, onChange, placeholder }) {
    return (
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ ...S.input, padding: '10px 34px 10px 12px', borderRadius: 8 }} />
        {value && (
          <button onClick={() => onChange('')} aria-label="Clear search"
            style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: T.textMute, fontSize: 18, width: 28, height: 28, cursor: 'pointer' }}>×</button>
        )}
      </div>
    );
  }

  function Chips({ options, value, onChange }) {
    return (
      <div className="gm-chips" style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '0 14px 10px', flexShrink: 0 }}>
        {options.map(o => {
          const on = o === value;
          return (
            <button key={o} onClick={() => onChange(o)} style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 999, border: on ? 'none' : `1px solid ${T.paperEdge}`, background: on ? T.ink : '#fff', color: on ? '#fff' : T.ink, fontFamily: S.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer' }}>{o}</button>
          );
        })}
      </div>
    );
  }

  function Empty({ title, text, children }) {
    return (
      <div style={{ margin: '28px 16px', padding: '28px 20px', background: '#fff', border: `1px solid ${T.paperEdge}`, borderRadius: 10, textAlign: 'center' }}>
        <div style={{ fontFamily: S.mono, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 13, color: T.textMute, lineHeight: 1.5, marginBottom: children ? 18 : 0 }}>{text}</div>
        {children && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>}
      </div>
    );
  }

  // ─── Inventory ──────────────────────────────────────────────────────
  function InventoryScreen({ items, groups, billing, onOpenItem, onAdd, onUpgrade }) {
    const [query, setQuery] = useState('');
    const [cat, setCat] = useState('All');
    const tokens = tokensOf(query);
    const cats = useMemo(() => ['All', ...Array.from(new Set(items.map(i => i.category).filter(Boolean))).sort()], [items]);
    const filtering = tokens.length > 0 || cat !== 'All';

    // The user's groups first, then everything ungrouped. Searching or
    // filtering shows one flat list instead.
    let sections;
    if (filtering) {
      sections = [{ key: 'results', name: null, rows: items.filter(it => (cat === 'All' || it.category === cat) && matches(it, tokens)) }];
    } else {
      const grouped = new Set();
      sections = [];
      groups.forEach(g => {
        const rows = g.itemIds.map(id => items.find(i => i.id === id)).filter(Boolean);
        rows.forEach(r => grouped.add(r.id));
        if (rows.length) sections.push({ key: g.id, name: g.name, rows });
      });
      const rest = items.filter(i => !grouped.has(i.id));
      if (rest.length) sections.push({ key: 'items', name: sections.length ? 'Items' : null, rows: rest });
    }
    const limit = billing && billing.max_inventory_items != null ? billing.max_inventory_items : null;

    return (
      <div className="gm-scroll" style={{ flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', gap: 8, padding: '14px 14px 10px' }}>
          <SearchBox value={query} onChange={setQuery} placeholder={`Search ${items.length} item${items.length === 1 ? '' : 's'}`} />
          <button onClick={onAdd} aria-label="Add gear" style={{ ...S.btnP, padding: '0 16px', fontSize: 20, fontWeight: 400, borderRadius: 8 }}>+</button>
        </div>
        {items.length > 0 && cats.length > 2 && <Chips options={cats} value={cat} onChange={setCat} />}
        {items.length > 0 && (
          <div style={{ ...sectionLabel, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <span>{items.length} item{items.length === 1 ? '' : 's'} · {totalQty(items)} unit{totalQty(items) === 1 ? '' : 's'}</span>
            {limit != null && (
              <a href="#" onClick={(e) => { e.preventDefault(); onUpgrade(); }} style={{ color: items.length >= limit ? T.orange : T.textMute, textDecoration: 'none' }}>
                {items.length} / {limit} on {billing.plan_name}
              </a>
            )}
          </div>
        )}

        {items.length === 0 ? (
          <Empty title="No gear yet" text="Add the kit you own so you can pull it into projects and kit lists.">
            <button style={{ ...S.btnP, padding: 12 }} onClick={onAdd}>Add your first item</button>
          </Empty>
        ) : sections.every(s => s.rows.length === 0) ? (
          <div style={emptyLine}>Nothing matches “{query || cat}”.</div>
        ) : sections.map(sec => (
          <div key={sec.key} style={{ marginBottom: 12 }}>
            {sec.name && <div style={sectionLabel}>{sec.name} · {sec.rows.length}</div>}
            <div style={listCard}>
              {sec.rows.map(it => (
                <GearRow key={it.id} it={it} onClick={() => onOpenItem(it)}
                  right={<span style={qtyChip}>×{it.qty || 1}</span>} />
              ))}
            </div>
          </div>
        ))}
        <div style={{ height: 16 }} />
      </div>
    );
  }

  // ─── Projects ───────────────────────────────────────────────────────
  function ProjectsScreen({ projects, projectItems, billing, onOpen, onNew }) {
    const limit = billing && billing.max_projects != null ? billing.max_projects : null;
    return (
      <div className="gm-scroll" style={{ flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 14px 10px' }}>
          <span style={{ ...S.label }}>
            {projects.length} project{projects.length === 1 ? '' : 's'}{limit != null ? ` · ${limit} on ${billing.plan_name}` : ''}
          </span>
          <button style={{ ...S.btnP, padding: '9px 14px', borderRadius: 8 }} onClick={onNew}>+ New project</button>
        </div>
        {projects.length === 0 ? (
          <Empty title="No projects yet" text="A project is the kit list for one shoot. Create one, then add gear from your inventory or the database.">
            <button style={{ ...S.btnP, padding: 12 }} onClick={onNew}>Create a project</button>
          </Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 14px 16px' }}>
            {projects.map(p => {
              const rows = projectItems[p.id];
              const c = window.GEAR.statusColor[p.status] || window.GEAR.statusColor.planning;
              return (
                <div key={p.id} onClick={() => onOpen(p.id)} style={{ background: '#fff', border: `1px solid ${T.paperEdge}`, borderRadius: 10, padding: 14, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={S.pill(c.bg, c.fg)}>{p.status}</span>
                    <span style={{ fontFamily: S.mono, fontSize: 11, color: T.textMute }}>{rows ? `${totalQty(rows)} item${totalQty(rows) === 1 ? '' : 's'}` : '…'}</span>
                  </div>
                  <div style={{ fontFamily: S.mono, fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.2, wordBreak: 'break-word' }}>{p.name}</div>
                  {[p.client, p.shoot, p.location].some(Boolean) && (
                    <div style={{ fontSize: 12, color: T.textMute, marginTop: 4 }}>{[p.client, p.shoot, p.location].filter(Boolean).join(' · ')}</div>
                  )}
                  {rows && rows.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
                      {rows.slice(0, 6).map(pi => <Thumb key={pi.id} it={pi} size={40} />)}
                      {rows.length > 6 && <div style={{ ...qtyChip, alignSelf: 'center', marginLeft: 2 }}>+{rows.length - 6}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function ProjectScreen({ project, rows, onChangeQty, onRename, onStatus, onDelete, onAddGear }) {
    const list = rows || [];
    const byCat = {};
    list.forEach(pi => { (byCat[pi.category || 'Other'] = byCat[pi.category || 'Other'] || []).push(pi); });
    const cats = Object.keys(byCat).sort((a, b) => (a === 'Other') - (b === 'Other') || a.localeCompare(b));

    const rename = () => {
      const name = window.prompt('Rename project', project.name);
      if (name && name.trim()) onRename(name.trim());
    };
    const minus = (pi) => {
      if (pi.qty <= 1 && !window.confirm(`Remove ${pi.name} from this project?`)) return;
      onChangeQty(pi.id, -1);
    };
    const remove = () => {
      if (window.confirm(`Delete “${project.name}” and its kit list? This can’t be undone.`)) onDelete();
    };

    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="gm-scroll" style={{ flex: 1, minHeight: 0 }}>
          <div style={{ background: T.ink, color: '#fff', padding: '18px 16px 20px' }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
              {['planning', 'active', 'wrapped'].map(s => {
                const on = project.status === s;
                return (
                  <button key={s} onClick={() => onStatus(s)} style={{ padding: '6px 12px', borderRadius: 999, border: on ? `1px solid ${T.orange}` : '1px solid rgba(255,255,255,0.18)', background: on ? 'rgba(255,87,12,0.16)' : 'transparent', color: on ? T.orange : 'rgba(255,255,255,0.6)', fontFamily: S.mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    ● {s}
                  </button>
                );
              })}
            </div>
            <div onClick={rename} style={{ fontFamily: S.mono, fontSize: 28, fontWeight: 400, letterSpacing: '-0.03em', lineHeight: 1.05, wordBreak: 'break-word', cursor: 'pointer' }}>
              {project.name} <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>✎</span>
            </div>
            {[project.client, project.shoot, project.location].some(Boolean) && (
              <div style={{ fontSize: 11, fontFamily: S.mono, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 10, lineHeight: 1.6 }}>
                {[project.client, project.shoot, project.location].filter(Boolean).join(' · ')}
              </div>
            )}
            <div style={{ display: 'flex', gap: 28, fontFamily: S.mono, marginTop: 16 }}>
              <div><div style={heroStatLabel}>Items</div><div style={{ fontSize: 22, fontWeight: 600 }}>{totalQty(list)}</div></div>
              <div><div style={heroStatLabel}>Unique</div><div style={{ fontSize: 22, fontWeight: 600 }}>{list.length}</div></div>
            </div>
          </div>

          {!rows ? (
            <div style={emptyLine}>Loading kit list…</div>
          ) : list.length === 0 ? (
            <Empty title="Empty kit list" text="Add gear from your inventory or the database." />
          ) : cats.map(cat => (
            <div key={cat} style={{ marginTop: 12 }}>
              <div style={{ ...sectionLabel, display: 'flex', justifyContent: 'space-between' }}>
                <span>{cat}</span><span>{totalQty(byCat[cat])}</span>
              </div>
              <div style={listCard}>
                {byCat[cat].map(pi => (
                  <GearRow key={pi.id} it={pi} thumb={44} sub={null}
                    right={<Stepper value={pi.qty} onMinus={() => minus(pi)} onPlus={() => onChangeQty(pi.id, 1)} />} />
                ))}
              </div>
            </div>
          ))}

          <div style={{ padding: '24px 16px 20px', textAlign: 'center' }}>
            <button onClick={remove} style={{ background: 'none', border: 'none', color: T.err, fontFamily: S.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', padding: 8 }}>Delete project</button>
          </div>
        </div>
        <div style={{ padding: '10px 14px', background: '#fff', borderTop: `1px solid ${T.paperEdge}`, flexShrink: 0 }}>
          <button onClick={onAddGear} style={{ ...S.btnP, width: '100%', padding: 13, fontSize: 12, borderRadius: 8 }}>+ Add gear</button>
        </div>
      </div>
    );
  }

  // ─── Database ───────────────────────────────────────────────────────
  function CatalogScreen({ catalog, items, dbStatus, onOpenItem, onAddToInventory }) {
    const [query, setQuery] = useState('');
    const [cat, setCat] = useState('All');
    const [visible, setVisible] = useState(PAGE);
    const tokens = tokensOf(query);
    useEffect(() => { setVisible(PAGE); }, [query, cat]);

    const owned = useMemo(() => new Set(items.map(gearKey)), [items]);
    const cats = useMemo(() => ['All', ...Array.from(new Set(catalog.map(c => c.category).filter(Boolean))).sort()], [catalog]);
    // A stable shuffle per catalog load, like the desktop page, so browsing
    // doesn't always open on the same items. Searching keeps A–Z order.
    const shuffled = useMemo(() => {
      const arr = catalog.slice();
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }, [catalog]);
    const filtered = useMemo(
      () => (tokens.length ? catalog : shuffled).filter(it => (cat === 'All' || it.category === cat) && matches(it, tokens)),
      [catalog, shuffled, query, cat]
    );
    const loading = dbStatus && dbStatus.state === 'loading';

    return (
      <div className="gm-scroll" style={{ flex: 1, minHeight: 0 }}>
        <div style={{ padding: '14px 14px 10px' }}>
          <SearchBox value={query} onChange={setQuery} placeholder={catalog.length ? `Search ${catalog.length.toLocaleString()} items` : 'Search the database'} />
        </div>
        <Chips options={cats} value={cat} onChange={setCat} />
        <div style={sectionLabel}>
          {loading ? (dbStatus.msg || 'Loading…') : `${filtered.length.toLocaleString()} result${filtered.length === 1 ? '' : 's'}`}
        </div>
        {filtered.length === 0 && !loading ? (
          <div style={emptyLine}>{dbStatus && dbStatus.state === 'error' ? `Couldn’t load the database: ${dbStatus.msg}` : 'Nothing matches that search.'}</div>
        ) : (
          <div style={listCard}>
            {filtered.slice(0, visible).map(it => {
              const have = owned.has(it.id);
              return (
                <GearRow key={it.id} it={it} onClick={() => onOpenItem(it)}
                  right={have ? (
                    <span style={{ ...qtyChip, color: T.ok, background: '#e3efe5' }}>✓ Owned</span>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); onAddToInventory(it); }} style={{ ...S.btnP, padding: '8px 10px', fontSize: 10, flexShrink: 0, borderRadius: 6 }}>+ Add</button>
                  )} />
              );
            })}
          </div>
        )}
        {visible < filtered.length && (
          <div style={{ padding: 16, textAlign: 'center' }}>
            <button onClick={() => setVisible(v => v + PAGE)} style={{ ...S.btnG, background: '#fff', padding: '10px 18px' }}>
              Show more · {(filtered.length - visible).toLocaleString()} left
            </button>
          </div>
        )}
        <div style={{ height: 16 }} />
      </div>
    );
  }

  // ─── Sheets ─────────────────────────────────────────────────────────
  // One piece of gear: what you own of it, and which projects it's in.
  function GearSheet({ gear, invRow, projects, projectItems, groups = [], onMoveToGroup, onAddToProject, onAddToInventory, onChangeInvQty, onEdit, onNewProject, onClose }) {
    // Project rows are matched on catalog id. Custom inventory items have
    // none, so they show no count here, but they still add fine.
    const key = gearKey(invRow || gear);
    const inProject = (pid) => {
      const row = (projectItems[pid] || []).find(pi => pi.equipment_id === key);
      return row ? row.qty : 0;
    };
    const minusOwned = () => {
      if ((invRow.qty || 1) <= 1 && !window.confirm(`Remove ${invRow.name} from your inventory?`)) return;
      onChangeInvQty(invRow.id, -1);
    };

    return (
      <Sheet title={gear.category || 'Gear'} onClose={onClose}>
        <div style={{ height: 170, background: '#fff', border: `1px solid ${T.paperLight}`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 12 }}>
          <img src={window.GEAR.itemImage(gear)} alt="" onError={(e) => { e.currentTarget.src = window.GEAR_PLACEHOLDER(gear.category); }}
            style={{ maxWidth: '88%', maxHeight: '88%', objectFit: 'contain' }} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.3, marginBottom: 14, wordBreak: 'break-word' }}>{gear.name}</div>

        {invRow ? (
          <div style={{ ...sheetCard, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>In your inventory</div>
              <a href="#" onClick={(e) => { e.preventDefault(); onEdit(invRow); }} style={{ fontSize: 12, color: T.orange, fontWeight: 600, textDecoration: 'none' }}>Edit details</a>
            </div>
            <Stepper value={invRow.qty || 1} onMinus={minusOwned} onPlus={() => onChangeInvQty(invRow.id, 1)} />
          </div>
        ) : null}
        {invRow ? (
          <div style={{ ...sheetCard, display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600, flexShrink: 0 }}>Group</div>
            <select
              value={(groups.find(g => g.itemIds.includes(invRow.id)) || {}).id || ''}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '__new') {
                  const name = window.prompt('Name the new group', '');
                  if (name && name.trim()) onMoveToGroup(invRow.id, null, name.trim());
                } else {
                  onMoveToGroup(invRow.id, v || null);
                }
              }}
              style={{ ...S.input, flex: 1, minWidth: 0, borderRadius: 6 }}>
              <option value="">No group</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              <option value="__new">+ New group…</option>
            </select>
          </div>
        ) : (
          <button onClick={onAddToInventory} style={{ ...S.btnP, width: '100%', padding: 13, borderRadius: 8, marginBottom: 14 }}>+ Add to inventory</button>
        )}

        <div style={{ ...S.label, margin: '18px 0 8px' }}>Add to a project</div>
        {projects.length === 0 ? (
          <div style={sheetCard}>
            <div style={{ fontSize: 13, color: T.textMute, marginBottom: 10 }}>You don’t have any projects yet.</div>
            <button onClick={onNewProject} style={{ ...S.btnG, background: '#fff' }}>+ New project</button>
          </div>
        ) : (
          <div style={{ border: `1px solid ${T.paperEdge}`, borderRadius: 10, overflow: 'hidden' }}>
            {projects.map(p => {
              const n = inProject(p.id);
              const c = window.GEAR.statusColor[p.status] || window.GEAR.statusColor.planning;
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid #f0ebe2', background: '#fff' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.fg === '#ffffff' ? T.orange : c.fg, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  {n > 0 && <span style={{ ...qtyChip, color: T.orange, background: '#fff3ed' }}>×{n} in list</span>}
                  <button onClick={() => onAddToProject(p.id, invRow)} aria-label={`Add to ${p.name}`} style={{ ...S.btnDark, padding: '7px 12px', fontSize: 14, borderRadius: 6, flexShrink: 0 }}>+</button>
                </div>
              );
            })}
          </div>
        )}
      </Sheet>
    );
  }

  // Add gear to one project from your inventory or the whole database.
  function AddGearSheet({ project, rows, items, catalog, onAdd, onClose }) {
    const [source, setSource] = useState(items.length ? 'inventory' : 'catalog');
    const [query, setQuery] = useState('');
    const tokens = tokensOf(query);
    const pool = source === 'inventory' ? items : catalog;
    const results = useMemo(() => pool.filter(it => matches(it, tokens)).slice(0, 50), [pool, query]);
    const countFor = (it) => {
      const k = gearKey(it);
      const row = rows.find(pi => pi.equipment_id === k);
      return row ? row.qty : 0;
    };

    return (
      <Sheet title={`Add to ${project.name}`} onClose={onClose} tall>
        <div style={{ display: 'flex', background: T.paperLight, borderRadius: 8, padding: 3, marginBottom: 10 }}>
          {[['inventory', `My gear · ${items.length}`], ['catalog', 'Database']].map(([k, l]) => (
            <button key={k} onClick={() => setSource(k)} style={{ flex: 1, padding: '8px 0', border: 'none', borderRadius: 6, background: source === k ? '#fff' : 'transparent', boxShadow: source === k ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontFamily: S.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', color: T.ink, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        <div style={{ marginBottom: 10 }}>
          <SearchBox value={query} onChange={setQuery} placeholder={source === 'inventory' ? 'Search your gear' : `Search ${catalog.length.toLocaleString()} items`} />
        </div>
        {results.length === 0 ? (
          <div style={{ ...emptyLine, margin: '20px 0' }}>
            {source === 'inventory' && items.length === 0 ? 'Your inventory is empty. Try the Database tab.' : 'Nothing matches that search.'}
          </div>
        ) : (
          <div style={{ border: `1px solid ${T.paperEdge}`, borderRadius: 10, overflow: 'hidden' }}>
            {results.map(it => {
              const n = countFor(it);
              return (
                <GearRow key={it.id} it={it} thumb={44} onClick={() => onAdd(it.id)}
                  right={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {n > 0 && <span style={{ ...qtyChip, color: T.orange, background: '#fff3ed' }}>×{n}</span>}
                      <span style={{ ...S.btnDark, padding: '7px 12px', fontSize: 14, borderRadius: 6 }}>+</span>
                    </div>
                  } />
              );
            })}
          </div>
        )}
        {pool.length > 50 && results.length === 50 && (
          <div style={{ ...emptyLine, margin: '12px 0 0' }}>Showing the first 50. Search to narrow it down.</div>
        )}
      </Sheet>
    );
  }

  // ─── Account ────────────────────────────────────────────────────────
  function AccountScreen({ app, onBack, onGuide }) {
    const { user, session, billing } = app;
    const [name, setName] = useState(user.name || '');
    const [studio, setStudio] = useState(user.studio || '');
    const [saved, setSaved] = useState(false);
    const [history, setHistory] = useState([]);
    const [deleting, setDeleting] = useState(false);
    useEffect(() => {
      app.refreshBilling();
      if (session) window.GEAR_BILLING.loadHistory(session).then(setHistory).catch(err => console.warn('[Account] credit history:', err.message));
    }, []);
    const save = () => { app.updateUser({ name: name.trim() || user.name, studio: studio.trim() }); setSaved(true); setTimeout(() => setSaved(false), 1800); };
    const DeleteDialog = window.STUDIO_AUTH.DeleteAccountDialog;

    return (
      <div style={{ ...root, zIndex: 50, background: '#f6f3ee' }}>
        <div style={topBar}>
          <button onClick={onBack} style={backBtn}>‹ Back</button>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: S.mono, fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Account</span>
        </div>
        <div className="gm-scroll" style={{ flex: 1, minHeight: 0, padding: '18px 14px calc(env(safe-area-inset-bottom) + 24px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: T.orange, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, fontFamily: S.mono, flexShrink: 0 }}>
              {(user.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: S.mono, fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', wordBreak: 'break-word' }}>{user.name}</div>
              <div style={{ fontSize: 13, color: T.textMute, wordBreak: 'break-all' }}>{user.email}</div>
              {billing && <span style={{ ...S.pill('#FFE4D6', '#B33A06'), marginTop: 6 }}>{billing.plan_name} plan</span>}
            </div>
          </div>

          <div style={{ ...sheetCard, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            <div style={S.field}><label style={S.label}>Full name</label><input style={S.input} value={name} onChange={e => setName(e.target.value)} /></div>
            <div style={S.field}><label style={S.label}>Studio / company</label><input style={S.input} value={studio} onChange={e => setStudio(e.target.value)} placeholder="e.g. Atlas Films" /></div>
            <button style={{ ...S.btnP, padding: 11, borderRadius: 6 }} onClick={save}>{saved ? 'Saved ✓' : 'Save changes'}</button>
          </div>

          {window.STUDIO_BILLING && (
            <window.STUDIO_BILLING.BillingPanel
              status={billing}
              catalog={app.billingCatalog || window.GEAR_BILLING.FALLBACK_CATALOG}
              history={history}
              busy={app.billingBusy}
              error={app.billingError}
              onUpgrade={() => app.openUpgrade()}
              onBuyCredits={app.startCheckout}
              onManage={app.openBillingPortal}
            />
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
            {onGuide && <button style={{ ...S.btnG, background: '#fff', padding: 12 }} onClick={onGuide}>How it works</button>}
            <button style={{ ...S.btnG, background: '#fff', padding: 12 }} onClick={() => { onBack(); app.signOut(); }}>Sign out</button>
            <button style={{ ...S.btnG, background: '#fff', padding: 12, color: '#B33A06', borderColor: '#f3d9d0' }} onClick={() => setDeleting(true)}>Delete account</button>
          </div>
          <div style={{ fontSize: 12, color: T.textMute, lineHeight: 1.5, marginTop: 18, textAlign: 'center' }}>
            Drag and drop is on the desktop version at gearapp.io.
          </div>
        </div>
        {deleting && DeleteDialog && <DeleteDialog billing={billing} onConfirm={app.deleteAccount} onClose={() => setDeleting(false)} />}
      </div>
    );
  }

  // ─── Styles ─────────────────────────────────────────────────────────
  const CSS = `
    @keyframes gmSheetIn { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes gmFadeIn { from { opacity: 0; } to { opacity: 1; } }
    .gm-scroll { overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
    .gm-chips { scrollbar-width: none; }
    .gm-chips::-webkit-scrollbar { display: none; }
    input[type="search"]::-webkit-search-cancel-button { display: none; }
  `;
  const root = { position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#f6f3ee', overflow: 'hidden' };
  const topBar = { background: T.ink, color: '#fff', padding: 'calc(env(safe-area-inset-top) + 10px) 14px 10px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, minHeight: 52 };
  const backBtn = { background: 'none', border: 'none', color: '#fff', fontFamily: S.mono, fontSize: 13, fontWeight: 600, padding: '6px 4px', cursor: 'pointer' };
  const topAction = { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', borderRadius: 6, padding: '6px 11px', fontFamily: S.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', cursor: 'pointer' };
  const guideBtn = { width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', fontFamily: S.mono, fontWeight: 700, fontSize: 14, cursor: 'pointer', flexShrink: 0 };
  const avatarBtn = { width: 32, height: 32, borderRadius: '50%', background: T.orange, color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0 };
  const tabBar = { background: T.ink, display: 'flex', paddingBottom: 'env(safe-area-inset-bottom)', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 };
  const tabBtn = (a) => ({ flex: 1, minWidth: 0, background: 'none', border: 'none', color: a ? T.orange : 'rgba(255,255,255,0.6)', padding: '9px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', minHeight: 54 });
  const sheetOverlay = { position: 'fixed', inset: 0, background: 'rgba(20,16,12,0.45)', zIndex: 60, animation: 'gmFadeIn .18s ease-out' };
  const sheetBox = (tall) => ({ position: 'absolute', left: 0, right: 0, bottom: 0, height: tall ? '88%' : 'auto', maxHeight: '88%', background: '#faf7f2', borderRadius: '14px 14px 0 0', display: 'flex', flexDirection: 'column', paddingBottom: 'env(safe-area-inset-bottom)', animation: 'gmSheetIn .22s ease-out', boxShadow: '0 -8px 30px rgba(0,0,0,0.2)' });
  const sheetCard = { background: '#fff', border: `1px solid ${T.paperEdge}`, borderRadius: 10, padding: 14 };
  const listCard = { margin: '0 14px', border: `1px solid ${T.paperEdge}`, borderRadius: 10, overflow: 'hidden' };
  const sectionLabel = { ...S.label, padding: '4px 18px 8px' };
  const rowName = { fontSize: 14, fontWeight: 500, color: T.ink, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' };
  const rowSub = { fontSize: 10, fontFamily: S.mono, color: T.textMute, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3 };
  const qtyChip = { fontFamily: S.mono, fontSize: 11, fontWeight: 600, color: T.ink, background: '#f1ece2', borderRadius: 4, padding: '3px 7px', flexShrink: 0, whiteSpace: 'nowrap' };
  const stepBtn = { width: 36, height: 34, background: 'none', border: 'none', fontSize: 18, color: T.ink, cursor: 'pointer' };
  const heroStatLabel = { fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 };
  const emptyLine = { margin: '24px 16px', textAlign: 'center', fontFamily: S.mono, fontSize: 12, color: T.textMute, lineHeight: 1.5 };

  window.STUDIO_MOBILE = { MobileApp };
})();
