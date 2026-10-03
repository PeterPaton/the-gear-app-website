// Gear · Suggestions page — describe a shoot, get a kit list that works together.
//
// Flow:
//   1. gear-compat.js picks a spec-tagged slice of the catalog that's relevant
//      to the brief (the full catalog is too big to send).
//   2. The `kit-suggest` edge function asks Claude for a kit from that slice.
//   3. The compatibility engine checks the kit. If anything conflicts or is
//      missing, the function is called once more with the problems listed so
//      the model can fix them.
//   4. The result is checked again — live, on every edit — and shown with
//      per-item status, the reasons, and one-click fixes for anything missing.
//
// "Make changes" sends the current kit plus a request ("swap to a lighter
// camera for the gimbal") through the same generate → check → fix loop.
// Generating and each change cost one Suggest credit (the fix-up pass is
// included); the edge function charges, and refunds if the AI call fails.
//
// If the AI service itself is unavailable, the engine assembles a kit offline
// for free. Running out of credits opens the upgrade screen instead.
(function () {
  const { useState, useMemo, useRef } = React;
  const S = window.STUDIO_STYLES;
  const T = S.T;
  const C = window.GEAR_COMPAT;

  const EXAMPLES = [
    'Run-and-gun documentary, mostly handheld, interviews with good sound',
    'Two-camera wedding, ceremony on a gimbal and a locked-off wide',
    'Sit-down interview in a small office, cinematic look',
    'Music video on a RED with cine primes and a director’s monitor',
    'Product / tabletop commercial, macro detail shots',
    'Podcast with three guests, multi-cam',
  ];

  const CHANGE_EXAMPLES = [
    'Swap to a lighter camera that balances on the gimbal',
    'Add a second body for a B-cam',
    'Use zooms instead of primes',
    'Add wireless lavs for two people',
  ];

  const STATUS = {
    conflict:    { label: 'Conflict',   fg: T.err,  bg: '#fde6dd', icon: '✕' },
    need:        { label: 'Needs',      fg: T.warn, bg: '#fbefd9', icon: '+' },
    conditional: { label: 'Check',      fg: T.warn, bg: '#fbefd9', icon: '!' },
    unverified:  { label: 'Unverified', fg: T.textMute, bg: T.paperLight, icon: '?' },
    ok:          { label: 'Compatible', fg: T.ok,   bg: '#e3efe5', icon: '✓' },
  };

  function SuggestPage({ catalog = [], supabaseUrl, anonKey, accessToken, projects = [], activeProjectId, billing, onCreditsChange, onUpgrade, onAddKitToProject, onCreateProjectFromKit }) {
    const [prompt, setPrompt] = useState('');
    const [stage, setStage] = useState(''); // '' when idle, otherwise a progress label
    const [busyMode, setBusyMode] = useState(null); // 'generate' | 'refine' while working
    const [error, setError] = useState('');
    // { name, summary, engine, notice, notes, revised, brief, lastChange, items: [{ id, name, qty, reason }] }
    const [result, setResult] = useState(null);
    const [history, setHistory] = useState([]); // earlier versions of the kit, for "Undo last change"
    const [change, setChange] = useState('');
    const [toast, setToast] = useState('');
    const toastTimer = useRef(null);

    const credits = billing ? window.GEAR_BILLING.totalCredits(billing) : null;
    const outOfCredits = credits === 0;

    const catById = useMemo(() => {
      const m = new Map();
      catalog.forEach(it => m.set(it.id, it));
      return m;
    }, [catalog]);

    const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId) || null, [projects, activeProjectId]);

    // Live compatibility check of whatever is currently in the list.
    const check = useMemo(() => {
      if (!result) return null;
      return C.checkKit(result.items.map(it => catById.get(it.id)).filter(Boolean));
    }, [result, catById]);

    async function callFunction(body) {
      let res;
      try {
        res = await fetch(`${supabaseUrl}/functions/v1/kit-suggest`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'apikey': anonKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch (e) {
        throw Object.assign(new Error('The AI service is unreachable'), { code: 'network' });
      }
      let data = null;
      try { data = await res.json(); } catch (e) {}
      if (data && data.credits && onCreditsChange) onCreditsChange(data.credits);
      if (!res.ok || !data || data.error) {
        const err = new Error((data && data.error) || `Service responded ${res.status}`);
        err.code = (data && data.code) || (res.status === 404 ? 'not-deployed' : res.status === 401 ? 'auth' : 'http');
        throw err;
      }
      return data;
    }

    const issueLines = (chk) => chk.issues
      .filter(i => i.level === 'conflict' || i.level === 'need')
      .map(i => `${i.level.toUpperCase()}: ${i.text}`);

    // One paid AI action: generate (no baseItems) or refine (baseItems +
    // instruction), followed by the free fix-up pass when the check fails.
    async function runAI(mode, brief, instruction, baseItems) {
      if (!supabaseUrl || !anonKey) throw Object.assign(new Error('Supabase is not configured'), { code: 'no-config' });
      if (!accessToken) throw Object.assign(new Error('Sign in to use AI suggestions'), { code: 'auth' });

      // Candidates: what's relevant to the brief (and the change), plus every
      // item already in the kit so the model can keep it.
      const pool = C.buildCandidatePool(instruction ? `${brief}\n${instruction}` : brief, catalog);
      const refOf = new Map(pool.map(p => [p.id, p.ref]));
      const idOf = new Map(pool.map(p => [p.ref, p.id]));
      const addCandidate = (it, prefix) => {
        if (refOf.has(it.id)) return;
        const ref = prefix + pool.length;
        pool.push({ ref, id: it.id, line: `${ref}|${it.name}|${C.specOf(it).role}|${C.describe(C.specOf(it))}` });
        refOf.set(it.id, ref);
        idOf.set(ref, it.id);
      };
      (baseItems || []).forEach(it => { const full = catById.get(it.id); if (full) addCandidate(full, 'k'); });
      const toItems = (lines) => lines.filter(l => idOf.has(l.ref)).map(l => {
        const it = catById.get(idOf.get(l.ref));
        return { id: it.id, name: it.name, qty: l.qty, reason: l.reason };
      });
      const asKit = (items) => items.filter(it => refOf.has(it.id)).map(it => ({ ref: refOf.get(it.id), qty: it.qty, reason: it.reason || '' }));

      const first = await callFunction({
        mode, prompt: brief, instruction, candidates: pool.map(p => p.line),
        kit: baseItems ? asKit(baseItems) : undefined,
      });
      let draft = { ...first, items: toItems(first.items) };
      setStage('Checking compatibility…');
      const chk = C.checkKit(draft.items.map(it => catById.get(it.id)));
      const problems = issueLines(chk);
      let revised = false;
      if (problems.length) {
        // Offer the model the exact items that would satisfy each need.
        chk.issues.filter(i => i.need).forEach(i => C.findFixes(i.need, catalog, 4).forEach(f => addCandidate(f, 'x')));
        setStage(`Fixing ${problems.length} compatibility issue${problems.length === 1 ? '' : 's'}…`);
        try {
          const second = await callFunction({
            mode: 'revise', run_id: first.run_id, prompt: brief, instruction,
            candidates: pool.map(p => p.line), kit: asKit(draft.items), issues: problems,
          });
          draft = { ...second, items: toItems(second.items) };
          revised = true;
        } catch (e) {
          draft.notes = [...(draft.notes || []), 'Automatic fix pass failed: ' + e.message];
        }
      }
      return { ...draft, revised, engine: 'ai' };
    }

    // Shared failure handling. Returns true when the caller should fall back
    // to the offline assembler (only when the AI service itself is down).
    function handleFailure(e) {
      if (e.code === 'no-credits') {
        setError("You're out of Suggest credits.");
        onUpgrade && onUpgrade('credits');
        return false;
      }
      if (e.code === 'auth') {
        setError('Your session has expired. Sign out and back in to use Suggest.');
        return false;
      }
      if (e.code === 'refusal') {
        setError('The AI declined that request. Try rewording it. No credit was used.');
        return false;
      }
      return true;
    }

    async function generate() {
      if (outOfCredits) { onUpgrade && onUpgrade('credits'); return; }
      const q = prompt.trim();
      if (!q) { setError('Describe what you’re shooting first.'); return; }
      if (!catalog.length) { setError('No equipment catalog is loaded yet.'); return; }
      setError('');
      setResult(null);
      setHistory([]);
      setBusyMode('generate');
      setStage('Choosing gear…');
      try {
        const kit = await runAI('generate', q);
        setResult({ ...kit, brief: q });
      } catch (e) {
        if (!handleFailure(e)) return;
        const why = {
          'no-key': 'The AI service has no API key yet',
          'not-deployed': 'The AI service isn’t deployed yet',
          'no-config': 'Supabase isn’t configured',
          'network': 'The AI service is unreachable',
        }[e.code] || ('The AI service failed: ' + (e.message || e));
        setStage('Assembling offline…');
        const local = C.assembleKit(q, catalog);
        if (local.items.length) setResult({ ...local, brief: q, engine: 'offline', notice: why + ' — this kit was assembled offline. No credit was used.' });
        else setError('Could not build a kit list: ' + why);
      } finally {
        setStage('');
        setBusyMode(null);
      }
    }

    async function applyChange(text) {
      if (outOfCredits) { onUpgrade && onUpgrade('credits'); return; }
      const instruction = (text != null ? text : change).trim();
      if (!instruction || !result) return;
      if (!result.items.length) { setError('Add something to the kit first.'); return; }
      setError('');
      setBusyMode('refine');
      setStage('Applying your change…');
      try {
        const kit = await runAI('refine', result.brief, instruction, result.items);
        setHistory(h => [...h.slice(-9), result]);
        setResult({ ...kit, brief: result.brief, lastChange: instruction });
        setChange('');
      } catch (e) {
        if (handleFailure(e)) setError(`Couldn’t apply that change: ${e.message}. No credit was used.`);
      } finally {
        setStage('');
        setBusyMode(null);
      }
    }

    function undoChange() {
      if (!history.length) return;
      setResult(history[history.length - 1]);
      setHistory(h => h.slice(0, -1));
    }

    // ── List editing ─────────────────────────────────────────────────────
    const bumpQty = (id, delta) => setResult(r => ({ ...r, items: r.items.map(it => it.id === id ? { ...it, qty: Math.max(1, Math.min(99, it.qty + delta)) } : it) }));
    const removeItem = (id) => setResult(r => ({ ...r, items: r.items.filter(i => i.id !== id) }));
    const addFix = (it, reason, qty = 1) => setResult(r => r.items.some(x => x.id === it.id) ? r : ({ ...r, items: [...r.items, { id: it.id, name: it.name, qty, reason }] }));

    const grouped = useMemo(() => {
      if (!result) return [];
      const order = ['body', 'lens', 'adapter', 'battery', 'battery-plate', 'media', 'monitor', 'converter', 'gimbal', 'tripod', 'mic-xlr', 'mic', 'xlr-input', 'light'];
      const title = { body: 'Camera', lens: 'Lenses', adapter: 'Adapters', battery: 'Power', 'battery-plate': 'Power', media: 'Media', monitor: 'Monitoring', converter: 'Monitoring', gimbal: 'Support', tripod: 'Support', 'mic-xlr': 'Audio', mic: 'Audio', 'xlr-input': 'Audio', light: 'Lighting' };
      const m = new Map();
      result.items.forEach(it => {
        const role = C.specOf(catById.get(it.id)).role;
        const key = title[role] || 'Other';
        if (!m.has(key)) m.set(key, { rank: order.indexOf(role) < 0 ? 99 : order.indexOf(role), items: [] });
        m.get(key).items.push(it);
      });
      return [...m.entries()].sort((a, b) => a[1].rank - b[1].rank).map(([category, g]) => ({ category, items: g.items }));
    }, [result, catById]);

    const totalUnits = result ? result.items.reduce((s, it) => s + it.qty, 0) : 0;
    const blocking = check ? check.counts.conflict + check.issues.filter(i => i.level === 'need').length : 0;
    const kitPayload = () => result.items.map(it => ({ id: it.id, qty: it.qty }));

    function flash(msg) {
      setToast(msg);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(''), 2600);
    }
    function addToActive() {
      if (!activeProjectId || !result) return;
      onAddKitToProject && onAddKitToProject(kitPayload());
      flash(`Added ${totalUnits} item${totalUnits === 1 ? '' : 's'} to ${activeProject ? activeProject.name : 'project'}`);
    }
    function saveAsProject() {
      if (!result) return;
      const name = window.prompt('Name this project', result.name || 'Suggested Kit');
      if (name == null) return;
      const created = onCreateProjectFromKit && onCreateProjectFromKit(name.trim() || 'Suggested Kit', kitPayload());
      if (created !== false) flash(`Created project “${name.trim() || 'Suggested Kit'}”`);
    }

    const working = !!stage;
    const costLabel = outOfCredits ? 'Get more credits' : '1 credit';
    const actions = (
      <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
        <button onClick={addToActive} disabled={!activeProjectId || working} title={activeProjectId ? '' : 'Select an active project first'}
          style={{ ...S.btnDark, opacity: activeProjectId && !working ? 1 : 0.45, cursor: activeProjectId ? 'pointer' : 'not-allowed' }}>
          {activeProject ? `Add to ${truncate(activeProject.name, 16)}` : 'Add to project'}
        </button>
        <button onClick={saveAsProject} disabled={working} style={{ ...S.btnP, opacity: working ? 0.6 : 1 }}>Save as new project</button>
      </div>
    );

    // ── Render ───────────────────────────────────────────────────────────
    return (
      <div style={{ flex: 1, overflowY: 'auto', background: '#f6f3ee' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 28px 80px' }}>

          <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={S.label}>Suggestions</div>
              <h1 style={{ fontFamily: S.mono, fontSize: 26, fontWeight: 700, margin: '6px 0 4px', letterSpacing: '-0.02em' }}>Build a kit list</h1>
              <div style={{ fontSize: 13, color: T.textMute, maxWidth: 600, lineHeight: 1.5 }}>
                Describe the shoot and I’ll assemble a kit from the equipment database. Every item is checked against the camera:
                mounts and adapters, sensor coverage, batteries, media, monitor connections, gimbal payload and XLR audio.
              </div>
            </div>
            {window.STUDIO_BILLING && <window.STUDIO_BILLING.CreditBadge status={billing} onGetMore={() => onUpgrade && onUpgrade('credits')} />}
          </div>

          {/* Brief */}
          <div style={{ background: '#fff', border: `1px solid ${T.paperEdge}`, padding: 16 }}>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !working) generate(); }}
              placeholder="e.g. Two-camera wedding on Sony bodies — outdoor ceremony on a gimbal, indoor reception, needs solid audio…"
              rows={3}
              style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', border: `1px solid ${T.paperEdge}`, padding: '11px 12px', fontSize: 14, fontFamily: S.sans, color: T.ink, lineHeight: 1.5, background: '#fff' }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {EXAMPLES.map(ex => (
                <button key={ex} onClick={() => setPrompt(ex)} disabled={working} title="Use this brief"
                  style={{ background: T.paperLight, color: T.ink, border: `1px solid ${T.paperEdge}`, padding: '5px 10px', fontSize: 11, fontFamily: S.sans, cursor: 'pointer', lineHeight: 1.3 }}>
                  {ex}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: T.textMute, fontFamily: S.mono }}>
                {catalog.length ? `${catalog.length.toLocaleString()} items in catalog` : 'Catalog loading…'} · ⌘↵ to generate
              </span>
              <button onClick={() => generate()} disabled={working} style={{ ...S.btnP, opacity: working ? 0.6 : 1, padding: '10px 18px' }}>
                {busyMode === 'generate' ? 'Working…' : outOfCredits ? 'Get more credits' : 'Generate kit list · 1 credit'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 14, background: '#fde6dd', color: T.err, border: `1px solid ${T.err}`, padding: '10px 14px', fontSize: 13, fontFamily: S.mono, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <span>{error}</span>
              {outOfCredits && <button onClick={() => onUpgrade && onUpgrade('credits')} style={{ ...S.btnP, flexShrink: 0 }}>Get more credits</button>}
            </div>
          )}
          {busyMode === 'generate' && (
            <div style={{ marginTop: 24, textAlign: 'center', color: T.textMute, fontFamily: S.mono, fontSize: 13 }}>{stage}</div>
          )}

          {result && check && busyMode !== 'generate' && (
            <div style={{ marginTop: 22 }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h2 style={{ fontFamily: S.mono, fontSize: 19, fontWeight: 700, margin: 0 }}>{result.name}</h2>
                    <span style={S.pill(result.engine === 'ai' ? '#e3efe5' : T.paperLight, result.engine === 'ai' ? T.ok : T.textMute)}>
                      {result.engine === 'ai' ? (result.revised ? 'AI · revised' : 'AI') : 'Offline'}
                    </span>
                  </div>
                  {result.summary && <div style={{ fontSize: 13, color: T.textMute, marginTop: 5, lineHeight: 1.5 }}>{result.summary}</div>}
                  <div style={{ fontSize: 11, color: T.textMute, fontFamily: S.mono, marginTop: 6 }}>
                    {result.items.length} line item{result.items.length === 1 ? '' : 's'} · {totalUnits} unit{totalUnits === 1 ? '' : 's'} total
                  </div>
                  {result.notice && <div style={{ fontSize: 11, color: T.warn, fontFamily: S.mono, marginTop: 6 }}>{result.notice}</div>}
                </div>
                {actions}
              </div>

              {/* Make changes */}
              <div style={{ marginTop: 16, background: '#fff', border: `1px solid ${T.paperEdge}`, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
                  <label htmlFor="kit-change" style={S.label}>Make changes</label>
                  {history.length > 0 && !working && (
                    <button onClick={undoChange} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: T.orange, fontFamily: S.mono, fontSize: 11, fontWeight: 600 }}>
                      ↶ Undo last change
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    id="kit-change"
                    value={change}
                    onChange={e => setChange(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !working) applyChange(); }}
                    disabled={working}
                    placeholder="e.g. Swap to a lighter camera that balances on the gimbal"
                    style={{ ...S.input, flex: 1, fontSize: 13, padding: '10px 12px' }}
                  />
                  <button onClick={() => applyChange()} disabled={working || (!change.trim() && !outOfCredits)}
                    style={{ ...S.btnP, flexShrink: 0, padding: '10px 14px', opacity: working || (!change.trim() && !outOfCredits) ? 0.5 : 1 }}>
                    {busyMode === 'refine' ? 'Working…' : outOfCredits ? costLabel : `Apply · ${costLabel}`}
                  </button>
                </div>
                {busyMode === 'refine' ? (
                  <div style={{ marginTop: 8, fontSize: 11, color: T.textMute, fontFamily: S.mono }}>{stage}</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
                    {result.lastChange && (
                      <span style={{ fontSize: 11, color: T.textMute, fontFamily: S.mono, marginRight: 6 }}>Last change: “{truncate(result.lastChange, 70)}”</span>
                    )}
                    {!result.lastChange && CHANGE_EXAMPLES.map(ex => (
                      <button key={ex} onClick={() => setChange(ex)}
                        style={{ background: T.paperLight, color: T.ink, border: `1px solid ${T.paperEdge}`, padding: '4px 9px', fontSize: 11, fontFamily: S.sans, cursor: 'pointer' }}>
                        {ex}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ opacity: busyMode === 'refine' ? 0.45 : 1, pointerEvents: busyMode === 'refine' ? 'none' : 'auto', transition: 'opacity .15s' }}>
                {/* Compatibility panel */}
                <CompatPanel check={check} catalog={catalog} kitIds={new Set(result.items.map(i => i.id))} onAdd={addFix} />

                {result.notes && result.notes.length > 0 && (
                  <div style={{ marginTop: 12, background: '#fff', border: `1px solid ${T.paperEdge}`, padding: '10px 14px' }}>
                    <div style={{ ...S.label, marginBottom: 6 }}>Notes for the crew</div>
                    {result.notes.map((n, i) => <div key={i} style={{ fontSize: 12, color: T.ink, lineHeight: 1.5, marginTop: i ? 4 : 0 }}>• {n}</div>)}
                  </div>
                )}

                {/* Items */}
                <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {grouped.map(group => (
                    <div key={group.category}>
                      <div style={{ ...S.label, marginBottom: 8 }}>{group.category} · {group.items.length}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {group.items.map(it => (
                          <ItemRow key={it.id} it={it} full={catById.get(it.id)} res={check.items[it.id]}
                            onQty={d => bumpQty(it.id, d)} onRemove={() => removeItem(it.id)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 22, display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                  {blocking > 0 && <span style={{ fontSize: 11, fontFamily: S.mono, color: T.err }}>{blocking} unresolved issue{blocking === 1 ? '' : 's'}</span>}
                  {actions}
                </div>
              </div>
            </div>
          )}
        </div>

        {toast && (
          <div style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', background: T.ink, color: '#fff', padding: '11px 18px', fontFamily: S.mono, fontSize: 12, letterSpacing: '0.04em', zIndex: 200 }}>
            {toast}
          </div>
        )}
      </div>
    );
  }

  // Summary of the kit check, with one-click fixes for anything missing.
  function CompatPanel({ check, catalog, kitIds, onAdd }) {
    const { counts, issues } = check;
    const clean = !issues.some(i => i.level === 'conflict' || i.level === 'need');
    const headline = clean
      ? (counts.unverified ? 'No conflicts found — some items couldn’t be verified' : 'Everything in this kit works together')
      : `${counts.conflict} conflict${counts.conflict === 1 ? '' : 's'} · ${issues.filter(i => i.level === 'need').length} missing`;
    const tone = clean ? (counts.unverified ? STATUS.unverified : STATUS.ok) : STATUS.conflict;
    return (
      <div style={{ marginTop: 16, background: '#fff', border: `1px solid ${clean ? T.paperEdge : T.err}`, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...badge(tone), width: 20, height: 20 }}>{tone.icon}</span>
            <span style={{ fontFamily: S.mono, fontSize: 13, fontWeight: 600, color: T.ink }}>{headline}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['ok', 'conditional', 'unverified'].filter(k => counts[k]).map(k => (
              <span key={k} style={S.pill(STATUS[k].bg, STATUS[k].fg)}>{counts[k]} {STATUS[k].label}</span>
            ))}
          </div>
        </div>
        {issues.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {issues.map((iss, i) => {
              const st = STATUS[iss.level] || STATUS.conditional;
              const fixes = iss.need ? C.findFixes(iss.need, catalog, 3).filter(f => !kitIds.has(f.id)) : [];
              return (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ ...badge(st), marginTop: 1 }}>{st.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: T.ink, lineHeight: 1.45 }}>{iss.text}</div>
                    {iss.need && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
                        {fixes.length ? fixes.map(f => (
                          <button key={f.id} onClick={() => onAdd(f, iss.text.replace(/^.*?: /, ''), iss.need.kind === 'battery' ? 3 : iss.need.kind === 'media' ? 2 : 1)}
                            style={{ background: T.paperLight, border: `1px solid ${T.paperEdge}`, padding: '4px 8px', fontSize: 11, fontFamily: S.sans, cursor: 'pointer', color: T.ink, maxWidth: '100%', textAlign: 'left' }}>
                            + {truncate(f.name, 60)}
                          </button>
                        )) : <span style={{ fontSize: 11, color: T.textMute, fontFamily: S.mono }}>Nothing in the catalog matches — source one separately.</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function ItemRow({ it, full, res, onQty, onRemove }) {
    const st = res && STATUS[res.status];
    const spec = C.specOf(full);
    const tags = C.describe(spec);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: `1px solid ${st && res.status === 'conflict' ? T.err : T.paperEdge}`, padding: 10 }}>
        <div style={{ width: 46, height: 46, flexShrink: 0, background: T.paperLight, border: `1px solid ${T.paperEdge}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={window.GEAR.itemImage(full || it)} alt=""
            onError={e => { e.currentTarget.src = window.GEAR_PLACEHOLDER(full ? full.category : 'Camera'); }}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            {st && <span style={badge(st)} title={st.label}>{st.icon}</span>}
            <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</div>
          </div>
          {it.reason && <div style={{ fontSize: 11, color: T.textMute, marginTop: 2 }}>{it.reason}</div>}
          {res && res.notes.length > 0 && (
            <div style={{ marginTop: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {res.notes.map((n, i) => (
                <div key={i} style={{ fontSize: 11, fontFamily: S.mono, color: (STATUS[n.status] || STATUS.ok).fg, lineHeight: 1.4 }}>{n.text}</div>
              ))}
            </div>
          )}
          {tags && <div style={{ fontSize: 10, fontFamily: S.mono, color: T.textMute, marginTop: 3, opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tags}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, border: `1px solid ${T.paperEdge}` }}>
          <button onClick={() => onQty(-1)} style={stepBtn}>−</button>
          <span style={{ minWidth: 30, textAlign: 'center', fontFamily: S.mono, fontSize: 13, fontWeight: 600 }}>{it.qty}</span>
          <button onClick={() => onQty(+1)} style={stepBtn}>+</button>
        </div>
        <button onClick={onRemove} title="Remove from list"
          style={{ background: 'transparent', border: 'none', color: T.textMute, cursor: 'pointer', fontSize: 16, padding: '4px 6px', flexShrink: 0 }}>×</button>
      </div>
    );
  }

  const badge = (st) => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, flexShrink: 0, background: st.bg, color: st.fg, fontSize: 10, fontWeight: 700, fontFamily: S.mono, border: `1px solid ${st.fg}` });
  const stepBtn = { background: 'transparent', border: 'none', width: 28, height: 28, fontSize: 16, cursor: 'pointer', color: T.ink, lineHeight: 1, fontFamily: S.mono };
  function truncate(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  window.STUDIO_SUGGEST = SuggestPage;
})();
