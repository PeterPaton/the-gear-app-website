// Studio modals — New Project, Edit Item, Export PDF preview.
(function () {
  const { useState } = React;
  const S = window.STUDIO_STYLES;
  const T = S.T;

  function ModalShell({ title, onClose, children, footer, width }) {
    return (
      <div style={S.modalOverlay} onClick={onClose}>
        <div style={{ ...S.modal, width: width || 540 }} onClick={e => e.stopPropagation()}>
          <div style={S.modalHead}>
            <div style={S.modalTitle}>{title}</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: T.textMute, padding: 0, width: 28, height: 28 }}>×</button>
          </div>
          <div style={S.modalBody}>{children}</div>
          {footer && <div style={S.modalFoot}>{footer}</div>}
        </div>
      </div>
    );
  }

  function NewProjectModal({ onClose, onCreate }) {
    const [form, setForm] = useState({ name: '', client: '', shoot: '', location: '', status: 'planning' });
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const submit = () => { if (!form.name) return; onCreate({ ...form, id: 'p' + Date.now(), items: [] }); onClose(); };
    const sCol = window.GEAR.statusColor[form.status] || { bg: '#f1ece2', fg: T.ink };
    const statuses = [
      { k: 'planning', l: 'Planning' },
      { k: 'active', l: 'Active' },
      { k: 'wrapped', l: 'Wrapped' },
    ];
    return (
      <div style={S.modalOverlay} onClick={onClose}>
        <div style={{ ...S.modal, width: 580, padding: 0 }} onClick={e => e.stopPropagation()}>
          {/* Branded header — paper texture, slip-card vibe */}
          <div style={{ background: '#faf7f2', padding: '24px 28px 20px', borderBottom: `1px solid ${T.paperEdge}`, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 4, background: T.orange }}></div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontFamily: S.mono, fontSize: 9, color: T.textMute, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8 }}>The Gear App · New job slip</div>
                <div style={{ fontFamily: S.mono, fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{form.name || 'Untitled project'}</div>
                <div style={{ fontSize: 11, color: T.textMute, marginTop: 6, fontFamily: S.mono, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {(form.client || 'No client')} · {(form.shoot || 'TBD')} · {(form.location || 'No location')}
                </div>
              </div>
              <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: T.textMute, padding: 0, width: 30, height: 30, lineHeight: 1 }}>×</button>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={S.field}>
              <label style={S.label}>Project name</label>
              <input style={{ ...S.input, fontSize: 15, padding: '11px 14px', fontFamily: S.mono, letterSpacing: '-0.01em' }} placeholder="e.g. Atlas Doc — Day 2" value={form.name} onChange={e => set('name', e.target.value)} autoFocus />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={S.field}>
                <label style={S.label}>Client</label>
                <input style={S.input} placeholder="Atlas Films" value={form.client} onChange={e => set('client', e.target.value)} />
              </div>
              <div style={S.field}>
                <label style={S.label}>Shoot dates</label>
                <input style={S.input} placeholder="Nov 14–18" value={form.shoot} onChange={e => set('shoot', e.target.value)} />
              </div>
            </div>
            <div style={S.field}>
              <label style={S.label}>Location</label>
              <input style={S.input} placeholder="Topanga, CA" value={form.location} onChange={e => set('location', e.target.value)} />
            </div>
            <div style={S.field}>
              <label style={S.label}>Status</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {statuses.map(s => {
                  const active = form.status === s.k;
                  const c = window.GEAR.statusColor[s.k];
                  return (
                    <button key={s.k} onClick={() => set('status', s.k)} style={{
                      padding: '8px 14px', fontSize: 10, fontFamily: S.mono, fontWeight: 600,
                      letterSpacing: '0.1em', textTransform: 'uppercase', borderRadius: 999,
                      border: active ? 'none' : `1px solid ${T.paperEdge}`,
                      background: active ? c.bg : 'transparent',
                      color: active ? c.fg : T.textMute, cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.fg, opacity: active ? 1 : 0.5 }}></span>
                      {s.l}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '16px 28px', borderTop: `1px solid ${T.paperEdge}`, background: '#faf7f2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: S.mono, fontSize: 9, color: T.textMute, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Slip #{Date.now().toString().slice(-6)}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={S.btnG} onClick={onClose}>Cancel</button>
              <button style={{ ...S.btnP, opacity: form.name ? 1 : 0.45, cursor: form.name ? 'pointer' : 'not-allowed' }} disabled={!form.name} onClick={submit}>Create Project</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function EditItemModal({ item, onClose, onSave }) {
    const [form, setForm] = useState({ ...item });
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    return (
      <ModalShell title={item.id ? 'Edit Item' : 'New Item'} onClose={onClose} footer={
        <React.Fragment>
          <button style={S.btnG} onClick={onClose}>Cancel</button>
          <button style={S.btnP} onClick={() => { onSave(form); onClose(); }}>Save</button>
        </React.Fragment>
      }>
        <div style={{ display: 'flex', gap: 16 }}>
          <img src={window.GEAR.itemImage(form)} onError={(e) => { e.currentTarget.src = window.GEAR_PLACEHOLDER(form.category || 'Camera'); }} style={{ width: 88, height: 88, background: T.paperLight, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} alt="" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={S.label}>Item name</label>
            <input style={S.input} value={form.name || ''} onChange={e => set('name', e.target.value)} autoFocus />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={S.field}>
            <label style={S.label}>Category</label>
            <select style={S.input} value={form.category || 'Camera'} onChange={e => set('category', e.target.value)}>
              {window.GEAR_CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={S.field}>
            <label style={S.label}>Brand</label>
            <input style={S.input} value={form.brand || ''} onChange={e => set('brand', e.target.value)} />
          </div>
          <div style={S.field}>
            <label style={S.label}>Model</label>
            <input style={S.input} value={form.model || ''} onChange={e => set('model', e.target.value)} />
          </div>
          <div style={S.field}>
            <label style={S.label}>Serial</label>
            <input style={S.input} value={form.serial || ''} onChange={e => set('serial', e.target.value)} />
          </div>
          <div style={S.field}>
            <label style={S.label}>Quantity</label>
            <input type="number" style={S.input} value={form.qty || 1} onChange={e => set('qty', parseInt(e.target.value) || 1)} />
          </div>
          <div style={S.field}>
            <label style={S.label}>Value (USD)</label>
            <input type="number" style={S.input} value={form.value || 0} onChange={e => set('value', parseInt(e.target.value) || 0)} />
          </div>
          <div style={S.field}>
            <label style={S.label}>Location</label>
            <input style={S.input} value={form.location || ''} onChange={e => set('location', e.target.value)} />
          </div>
          <div style={S.field}>
            <label style={S.label}>Status</label>
            <select style={S.input} value={form.status || 'available'} onChange={e => set('status', e.target.value)}>
              <option value="available">Available</option>
              <option value="checked-out">Checked out</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        </div>
      </ModalShell>
    );
  }

  function ExportPDFModal({ project, items = [], mode = 'project', groups = [], onClose }) {
    const [showPhotos, setShowPhotos] = useState(true);
    const [density, setDensity] = useState('comfortable'); // 'tight' | 'comfortable'
    // Subheaders default on — for projects this groups by category (Camera /
    // Lens / etc.), for inventory by user-created group with an "Items"
    // bucket for ungrouped rows.
    const [showSubheaders, setShowSubheaders] = useState(true);
    const [busy, setBusy] = useState(false);
    const sheetRef = React.useRef(null);

    const totalQty = items.reduce((s, pi) => s + (pi.qty || 0), 0);
    const uniqueCount = items.length;
    const isTight = density === 'tight';
    const rowPad = isTight ? '4px 0' : '10px 0';
    const thumb = isTight ? 26 : 42;

    // Group items into named sections for the subheader render path.
    // Project: category. Inventory: group name (or "Items" if ungrouped).
    const sections = React.useMemo(() => {
      if (!showSubheaders) return null;
      const buckets = new Map();
      const ungroupedKey = mode === 'inventory' ? 'Items' : 'Other';
      let labelFor;
      if (mode === 'inventory') {
        const idToGroupName = new Map();
        (groups || []).forEach(g => g.itemIds.forEach(id => idToGroupName.set(id, g.name)));
        labelFor = (pi) => idToGroupName.get(pi.id) || ungroupedKey;
      } else {
        labelFor = (pi) => pi.category || ungroupedKey;
      }
      items.forEach(pi => {
        const k = labelFor(pi);
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k).push(pi);
      });
      // Stable ordering: alphabetical, with the ungrouped fallback last.
      const keys = Array.from(buckets.keys()).filter(k => k !== ungroupedKey).sort((a, b) => a.localeCompare(b));
      if (buckets.has(ungroupedKey)) keys.push(ungroupedKey);
      return keys.map(k => ({ name: k, rows: buckets.get(k) }));
    }, [showSubheaders, items, mode, groups]);

    const colCount = showPhotos ? 4 : 3;

    // Inline every <img> as a data: URL before html2canvas runs. html2canvas
    // can only bake cross-origin images into the canvas when the source
    // server returns CORS headers, and many product CDNs don't — so fetching
    // each image to a Blob and replacing the src removes the CORS dependency
    // entirely. Falls back to the category placeholder if a fetch can't
    // succeed (e.g. truly no-CORS hosts) so the PDF row still has an icon.
    const inlineImagesAsDataUrls = async (node) => {
      const imgs = Array.from(node.querySelectorAll('img'));
      await Promise.all(imgs.map(async (img) => {
        if (!img.src || img.src.startsWith('data:')) return;
        try {
          const res = await fetch(img.src, { mode: 'cors', cache: 'no-store' });
          if (!res.ok) throw new Error('fetch ' + res.status);
          const blob = await res.blob();
          const dataUrl = await new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result);
            fr.onerror = reject;
            fr.readAsDataURL(blob);
          });
          img.src = dataUrl;
        } catch (e) {
          const cat = img.getAttribute('data-category') || 'Camera';
          img.src = window.GEAR_PLACEHOLDER(cat);
        }
        // Wait for the (possibly swapped) source to decode before html2canvas runs.
        if (!img.complete || img.naturalWidth === 0) {
          await new Promise(resolve => {
            const done = () => resolve();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
          });
        }
      }));
    };

    const downloadPDF = async () => {
      const node = sheetRef.current;
      if (!node || !window.html2pdf || busy) return;
      setBusy(true);
      // html2canvas refuses to render elements that are positioned far off-
      // screen (the cloned-and-hidden approach was producing blank PDFs), so
      // mutate the visible preview's <img> srcs in place, generate the PDF,
      // then restore the original sources. The user briefly sees the images
      // swap to inlined data URLs during generation, which is acceptable.
      const imgs = Array.from(node.querySelectorAll('img'));
      const originalSrcs = imgs.map(img => img.getAttribute('src'));
      try {
        await inlineImagesAsDataUrls(node);
        await window.html2pdf().from(node).set({
          margin: [0.4, 0.5, 0.5, 0.5],
          filename: `${project.name.replace(/[^a-z0-9_\- ]/gi, '_').trim() || 'pull-list'}.pdf`,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'], avoid: 'tr' },
        }).save();
      } catch (err) {
        console.warn('[Export] html2pdf failed:', err);
      } finally {
        // Restore original sources so the preview keeps showing actual remote
        // images (the data-URL versions would still look identical but are
        // wasteful to keep in memory after we're done generating).
        imgs.forEach((img, i) => {
          if (originalSrcs[i] != null) img.setAttribute('src', originalSrcs[i]);
        });
        setBusy(false);
      }
    };

    const toggleBtn = (active) => ({
      padding: '7px 14px',
      fontSize: 11,
      fontFamily: S.mono,
      fontWeight: 600,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      border: `1px solid ${active ? T.orange : T.paperEdge}`,
      borderRadius: 4,
      background: active ? '#fff3ed' : '#fff',
      color: active ? T.orange : T.ink,
      cursor: 'pointer',
    });

    return (
      <ModalShell title="Export Full List" onClose={onClose} width={760} footer={
        <React.Fragment>
          <button style={S.btnG} onClick={onClose} disabled={busy}>Cancel</button>
          <button style={{ ...S.btnP, opacity: busy ? 0.6 : 1 }} onClick={downloadPDF} disabled={busy}>{busy ? 'Generating…' : 'Download PDF'}</button>
        </React.Fragment>
      }>
        {/* Appearance toggles */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button style={toggleBtn(showPhotos)} onClick={() => setShowPhotos(v => !v)}>{showPhotos ? '✓' : '○'} Photos</button>
          <button style={toggleBtn(showSubheaders)} onClick={() => setShowSubheaders(v => !v)}>{showSubheaders ? '✓' : '○'} Subheaders</button>
          <div style={{ width: 1, background: T.paperEdge }} />
          <button style={toggleBtn(isTight)} onClick={() => setDensity('tight')}>▤ Compact</button>
          <button style={toggleBtn(!isTight)} onClick={() => setDensity('comfortable')}>≡ Spacious</button>
        </div>

        {/* sheetRef wraps the receipt-style border directly so it appears in
            the exported PDF too. This was previously the source of an orphan
            trailing page, but only because pagebreak mode `avoid-all` forced
            the whole table onto a later page; with the current `avoid: 'tr'`
            mode the wrapper height matches the content and the border lays
            out cleanly across pages. */}
        <div ref={sheetRef} style={{ background: '#fff', border: `1px solid ${T.paperEdge}`, borderRadius: 4, padding: '32px 36px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingBottom: 16, borderBottom: `2px solid ${T.ink}` }}>
              <div>
                <div style={{ fontFamily: S.mono, fontSize: 10, color: T.textMute, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Full list</div>
                <div style={{ fontFamily: S.mono, fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1 }}>{project.name}</div>
                <div style={{ fontSize: 12, color: T.textMute, marginTop: 6 }}>{[project.client, project.shoot, project.location].filter(Boolean).join(' · ')}</div>
              </div>
              <div style={{ fontFamily: S.mono, fontSize: 14, fontWeight: 700 }}>THE GEAR APP</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0, marginBottom: 20, fontSize: 11, fontFamily: S.mono }}>
              <div><div style={{ color: T.textMute, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 9 }}>Items</div><div style={{ fontSize: 18, marginTop: 4 }}>{totalQty}</div></div>
              <div><div style={{ color: T.textMute, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 9 }}>Unique</div><div style={{ fontSize: 18, marginTop: 4 }}>{uniqueCount}</div></div>
            </div>
            {items.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', fontFamily: S.mono, fontSize: 11, color: T.textMute, textTransform: 'uppercase', letterSpacing: '0.08em' }}>No items in this project</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.ink}` }}>
                    <th style={{ textAlign: 'left', padding: '8px 0', fontFamily: S.mono, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', width: 50 }}>Qty</th>
                    {showPhotos && <th style={{ width: thumb + 12, padding: '8px 0' }}></th>}
                    <th style={{ textAlign: 'left', padding: '8px 0', fontFamily: S.mono, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Item</th>
                    <th style={{ textAlign: 'left', padding: '8px 0', fontFamily: S.mono, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Category</th>
                  </tr>
                </thead>
                {(() => {
                  const renderRow = (pi) => (
                    <tr key={pi.id} style={{ borderBottom: '1px solid #f0ebe2', pageBreakInside: 'avoid' }}>
                      <td style={{ padding: rowPad, fontFamily: S.mono, fontWeight: 600 }}>{pi.qty}×</td>
                      {showPhotos && (
                        <td style={{ padding: rowPad }}>
                          <div style={{ width: thumb, height: thumb, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            <img src={pi.image_url || window.GEAR_PLACEHOLDER(pi.category)} onError={(e) => { e.currentTarget.src = window.GEAR_PLACEHOLDER(pi.category); }} data-category={pi.category || 'Camera'} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="" />
                          </div>
                        </td>
                      )}
                      <td style={{ padding: rowPad }}>{pi.name}</td>
                      <td style={{ padding: rowPad, fontFamily: S.mono, fontSize: 11, color: T.textMute }}>{pi.category}</td>
                    </tr>
                  );
                  if (sections) {
                    return sections.map(sec => (
                      <tbody key={sec.name}>
                        <tr>
                          <td colSpan={colCount} style={{ padding: '14px 0 6px', fontFamily: S.mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.ink, borderBottom: `1px solid ${T.ink}` }}>
                            {sec.name}<span style={{ color: T.textMute, marginLeft: 10, fontWeight: 400 }}>{sec.rows.reduce((s, pi) => s + (pi.qty || 0), 0)}</span>
                          </td>
                        </tr>
                        {sec.rows.map(renderRow)}
                      </tbody>
                    ));
                  }
                  return <tbody>{items.map(renderRow)}</tbody>;
                })()}
              </table>
            )}
        </div>
      </ModalShell>
    );
  }

  window.STUDIO_MODALS = { NewProjectModal, EditItemModal, ExportPDFModal };
})();
