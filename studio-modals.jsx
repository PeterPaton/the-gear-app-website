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
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
          <div style={{ padding: '16px 28px', borderTop: `1px solid ${T.paperEdge}`, background: '#faf7f2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
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

  // `branding` (Free plan) stamps The Gear App on the sheet; Pro exports are
  // clean and show the studio name, if one is set, in its place.
  function ExportPDFModal({ project, items = [], mode = 'project', groups = [], branding = true, studioName, onUpgrade, onClose }) {
    const [showPhotos, setShowPhotos] = useState(true);
    const [density, setDensity] = useState('comfortable'); // 'tight' | 'comfortable'
    // Subheaders default on — for projects this groups by category (Camera /
    // Lens / etc.), for inventory by user-created group with an "Items"
    // bucket for ungrouped rows.
    const [showSubheaders, setShowSubheaders] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    // Phones: the finished PDF, handed over by Share / Open. iOS ignores a
    // scripted download (and share() needs a fresh tap), so it's two steps.
    const [pdf, setPdf] = useState(null); // { blob, url, file }
    const isPhone = window.STUDIO_AUTH ? window.STUDIO_AUTH.useIsMobile() : false;
    const sheetRef = React.useRef(null);
    const dropPdf = () => setPdf(p => { if (p) URL.revokeObjectURL(p.url); return null; });
    React.useEffect(() => dropPdf, []);
    React.useEffect(() => { dropPdf(); }, [showPhotos, density, showSubheaders]);

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
    // Convert a remote URL into a data: URL. Tries the direct CORS fetch
    // first (works for Supabase Storage and other CORS-friendly hosts), then
    // falls through to our /api/proxy serverless route which re-serves
    // anything CORS-restricted with the right headers attached.
    // Each fetch gives up after a few seconds so one slow image host can't
    // leave the export stuck on "Generating…".
    const fetchToDataUrl = async (url) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(url, { mode: 'cors', cache: 'no-store', signal: ctrl.signal }).finally(() => clearTimeout(timer));
      if (!res.ok) throw new Error('fetch ' + res.status);
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
    };

    const inlineImagesAsDataUrls = async (node) => {
      const imgs = Array.from(node.querySelectorAll('img'));
      await Promise.all(imgs.map(async (img) => {
        if (!img.src || img.src.startsWith('data:')) return;
        const orig = img.src;
        try {
          img.src = await fetchToDataUrl(orig);
        } catch (e1) {
          try {
            // Fallback: our same-origin serverless image proxy.
            img.src = await fetchToDataUrl('/api/proxy?url=' + encodeURIComponent(orig));
          } catch (e2) {
            // Last resort — the category-shaped placeholder so the row isn't blank.
            const cat = img.getAttribute('data-category') || 'Camera';
            img.src = window.GEAR_PLACEHOLDER(cat);
          }
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

    // A small JPEG thumbnail for the phone PDF, or null if the image can't be
    // had within a few seconds.
    const thumbFor = async (url) => {
      let data = url;
      if (!url.startsWith('data:')) {
        try { data = await fetchToDataUrl(url); }
        catch (e1) {
          try { data = await fetchToDataUrl('/api/proxy?url=' + encodeURIComponent(url)); }
          catch (e2) { return null; }
        }
      }
      return await new Promise(resolve => {
        const img = new Image();
        const timer = setTimeout(() => resolve(null), 4000);
        img.onload = () => {
          clearTimeout(timer);
          try {
            // SVGs without a size report 0×0 on iOS; treat those as square.
            const nw = img.naturalWidth || 120, nh = img.naturalHeight || 120;
            const k = Math.min(1, 120 / Math.max(nw, nh));
            const c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(nw * k));
            c.height = Math.max(1, Math.round(nh * k));
            const ctx = c.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, c.width, c.height);
            ctx.drawImage(img, 0, 0, c.width, c.height);
            resolve({ data: c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height });
          } catch (e) { resolve(null); }
        };
        img.onerror = () => { clearTimeout(timer); resolve(null); };
        img.src = data;
      });
    };

    // Phones: draw the list straight into a PDF with jsPDF, as text plus
    // small thumbnails. Rendering the whole sheet to one big canvas
    // (html2canvas) freezes iPhones on all but the shortest lists.
    const buildPhonePdf = async () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      const W = 612, H = 792, M = 40, right = W - M;
      const ink = [25, 25, 25], mute = [122, 113, 106], rule = [232, 226, 216];
      const th = showPhotos ? (isTight ? 22 : 34) : 0;
      const pad = isTight ? 4 : 8;
      const qtyX = M, photoX = M + 36, nameX = photoX + (th ? th + 12 : 0), catX = right - 100, nameW = catX - nameX - 12;
      let y = M;
      const ensure = (h) => { if (y + h > H - M - 20) { doc.addPage(); y = M; } };
      const hline = (color, width) => { doc.setDrawColor(...color); doc.setLineWidth(width); doc.line(M, y, right, y); };

      const thumbs = new Map();
      if (th) {
        await Promise.all(items.map(async pi => {
          thumbs.set(pi.id, await thumbFor(pi.image_url || window.GEAR_PLACEHOLDER(pi.category)));
        }));
      }

      // Header: title, details, branding, totals.
      doc.setFont('courier', 'normal'); doc.setFontSize(8); doc.setTextColor(...mute);
      doc.text('FULL LIST', M, y + 8);
      const mark = branding ? 'THE GEAR APP' : (studioName ? String(studioName).toUpperCase() : '');
      if (mark) { doc.setFont('courier', 'bold'); doc.setFontSize(11); doc.setTextColor(...ink); doc.text(mark, right, y + 8, { align: 'right' }); }
      y += 20;
      doc.setFont('courier', 'bold'); doc.setFontSize(22); doc.setTextColor(...ink);
      const titleLines = doc.splitTextToSize(project.name || 'Kit list', W - 2 * M - 120);
      titleLines.forEach(line => { y += 22; doc.text(line, M, y); });
      const meta = [project.client, project.shoot, project.location].filter(Boolean).join(' · ');
      if (meta) { y += 16; doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...mute); doc.text(doc.splitTextToSize(meta, W - 2 * M)[0], M, y); }
      y += 12; hline(ink, 1.5);
      y += 18;
      doc.setFont('courier', 'normal'); doc.setFontSize(7); doc.setTextColor(...mute);
      doc.text('ITEMS', M, y); doc.text('UNIQUE', W / 2, y);
      y += 16; doc.setFontSize(14); doc.setTextColor(...ink);
      doc.text(String(totalQty), M, y); doc.text(String(uniqueCount), W / 2, y);
      y += 20;

      if (items.length === 0) {
        doc.setFont('courier', 'normal'); doc.setFontSize(9); doc.setTextColor(...mute);
        doc.text('NO ITEMS IN THIS PROJECT', W / 2, y + 30, { align: 'center' });
      } else {
        doc.setFont('courier', 'bold'); doc.setFontSize(7); doc.setTextColor(...ink);
        doc.text('QTY', qtyX, y); doc.text('ITEM', nameX, y); doc.text('CATEGORY', catX, y);
        y += 6; hline(ink, 0.75);
        (sections || [{ name: null, rows: items }]).forEach(sec => {
          if (sec.name) {
            ensure(24 + Math.max(th, 12) + pad * 2); // keep the heading with its first row
            y += 18;
            doc.setFont('courier', 'bold'); doc.setFontSize(8); doc.setTextColor(...ink);
            doc.text(String(sec.name).toUpperCase(), M, y);
            doc.setFont('courier', 'normal'); doc.setTextColor(...mute);
            doc.text(String(sec.rows.reduce((n, pi) => n + (pi.qty || 0), 0)), M + doc.getTextWidth(String(sec.name).toUpperCase()) + 10, y);
            y += 6; hline(ink, 0.75);
          }
          sec.rows.forEach(pi => {
            doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
            const lines = doc.splitTextToSize(pi.name || '', nameW);
            const h = Math.max(th, lines.length * 12) + pad * 2;
            ensure(h);
            const mid = y + h / 2;
            doc.setFont('courier', 'bold'); doc.setFontSize(10); doc.setTextColor(...ink);
            doc.text(`${pi.qty}x`, qtyX, mid + 3);
            if (th) {
              doc.setDrawColor(224, 224, 224); doc.setLineWidth(0.5);
              doc.roundedRect(photoX, y + pad, th, th, 3, 3);
              const t = thumbs.get(pi.id);
              if (t) {
                const k = Math.min((th - 4) / t.w, (th - 4) / t.h);
                const w = t.w * k, ih = t.h * k;
                doc.addImage(t.data, 'JPEG', photoX + (th - w) / 2, y + pad + (th - ih) / 2, w, ih);
              }
            }
            doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...ink);
            const top = mid - (lines.length * 12) / 2 + 9;
            lines.forEach((line, i) => doc.text(line, nameX, top + i * 12));
            doc.setFont('courier', 'normal'); doc.setFontSize(8); doc.setTextColor(...mute);
            doc.text(doc.splitTextToSize(pi.category || '', right - catX)[0] || '', catX, mid + 3);
            y += h; hline(rule, 0.5);
          });
        });
      }

      if (branding) {
        ensure(30);
        y += 22;
        doc.setFont('courier', 'normal'); doc.setFontSize(7); doc.setTextColor(...mute);
        doc.text('MADE WITH THE GEAR APP', M, y);
        doc.text('GEARAPP.IO', right, y, { align: 'right' });
      }
      return doc.output('blob');
    };

    const downloadPDF = async () => {
      const node = sheetRef.current;
      if (!node || busy) return;
      const filename = `${project.name.replace(/[^a-z0-9_\- ]/gi, '_').trim() || 'pull-list'}.pdf`;

      if (isPhone) {
        if (!window.jspdf) { setError('The PDF tool didn’t load. Check your connection and try again.'); return; }
        setBusy(true);
        setError('');
        try {
          const blob = await buildPhonePdf();
          dropPdf();
          setPdf({ blob, url: URL.createObjectURL(blob), file: new File([blob], filename, { type: 'application/pdf' }) });
        } catch (err) {
          console.warn('[Export] phone PDF failed:', err);
          setError('Couldn’t create the PDF. Try again, or turn Photos off.');
        } finally {
          setBusy(false);
        }
        return;
      }

      if (!window.html2pdf) return;
      setBusy(true);
      setError('');
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
          filename,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'], avoid: 'tr' },
        }).save();
      } catch (err) {
        console.warn('[Export] html2pdf failed:', err);
        setError('Couldn’t create the PDF. Try Compact, or turn Photos off for a long list.');
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

    const canShare = !!(pdf && navigator.canShare && navigator.canShare({ files: [pdf.file] }));
    const sharePdf = async () => {
      try { await navigator.share({ files: [pdf.file], title: project.name }); }
      catch (err) { if (err && err.name !== 'AbortError') setError('Sharing didn’t work. Use Open PDF instead.'); }
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
          {pdf ? (
            <React.Fragment>
              <a href={pdf.url} target="_blank" rel="noopener" download={pdf.file.name} style={{ ...S.btnG, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Open PDF</a>
              {canShare && <button style={S.btnP} onClick={sharePdf}>Share PDF</button>}
            </React.Fragment>
          ) : (
            <button style={{ ...S.btnP, opacity: busy ? 0.6 : 1 }} onClick={downloadPDF} disabled={busy}>{busy ? 'Generating…' : isPhone ? 'Create PDF' : 'Download PDF'}</button>
          )}
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
        {/* minWidth keeps the sheet at its desktop width on a phone (the
            preview scrolls sideways), so the PDF comes out the same. */}
        <div style={{ overflowX: 'auto' }}>
        <div ref={sheetRef} style={{ background: '#fff', border: `1px solid ${T.paperEdge}`, borderRadius: 4, padding: '32px 36px', minWidth: 680 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingBottom: 16, borderBottom: `2px solid ${T.ink}` }}>
              <div>
                <div style={{ fontFamily: S.mono, fontSize: 10, color: T.textMute, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Full list</div>
                <div style={{ fontFamily: S.mono, fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1 }}>{project.name}</div>
                <div style={{ fontSize: 12, color: T.textMute, marginTop: 6 }}>{[project.client, project.shoot, project.location].filter(Boolean).join(' · ')}</div>
              </div>
              {branding
                ? <div style={{ fontFamily: S.mono, fontSize: 14, fontWeight: 700 }}>THE GEAR APP</div>
                : studioName ? <div style={{ fontFamily: S.mono, fontSize: 14, fontWeight: 700, textTransform: 'uppercase' }}>{studioName}</div> : null}
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
            {branding && (
              <div style={{ marginTop: 22, paddingTop: 10, borderTop: '1px solid #f0ebe2', display: 'flex', justifyContent: 'space-between', fontFamily: S.mono, fontSize: 9, color: T.textMute, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                <span>Made with The Gear App</span>
                <span>gearapp.io</span>
              </div>
            )}
        </div>
        </div>
        {error && (
          <div style={{ background: '#fde6dd', color: T.err, border: `1px solid ${T.err}`, borderRadius: 4, padding: '9px 12px', fontSize: 12, fontFamily: S.mono, marginTop: 10 }}>{error}</div>
        )}
        {branding && onUpgrade && (
          <div style={{ fontSize: 11, color: T.textMute, fontFamily: S.mono, marginTop: 10 }}>
            Free exports carry Gear branding. <a href="#" onClick={(e) => { e.preventDefault(); onUpgrade(); }} style={{ color: T.orange, fontWeight: 600 }}>Go Pro for clean exports</a>
          </div>
        )}
      </ModalShell>
    );
  }

  window.STUDIO_MODALS = { NewProjectModal, EditItemModal, ExportPDFModal };
})();
