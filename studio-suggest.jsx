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
  const { useState, useMemo, useRef, useEffect } = React;

  // Saved per user in this browser: the open kit (with its undo steps), the
  // brief being typed, and recent kits — so leaving the page, opening a
  // project or reloading never loses a kit that cost a credit.
  const HISTORY_LIMIT = 20;
  const storeKey = (userId) => `gear.suggest.${userId || 'anon'}`;
  function loadStore(userId) {
    try { return JSON.parse(localStorage.getItem(storeKey(userId)) || 'null') || {}; } catch (e) { return {}; }
  }
  const newKitId = () => 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
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

  function SuggestPage({ userId, catalog = [], supabaseUrl, anonKey, accessToken, projects = [], activeProjectId, billing, onCreditsChange, onUpgrade, onAddKitToProject, onCreateProjectFromKit }) {
    const [prompt, setPrompt] = useState('');
    const [stage, setStage] = useState(''); // '' when idle, otherwise a progress label
    const [busyMode, setBusyMode] = useState(null); // 'generate' | 'refine' while working
    const [error, setError] = useState('');
    // { name, summary, engine, notice, notes, revised, brief, lastChange, items: [{ id, name, qty, reason }] }
    const [result, setResult] = useState(null);
    const [history, setHistory] = useState([]); // earlier versions of the kit, for "Undo last change"
    const [change, setChange] = useState('');
    const [saved, setSaved] = useState([]); // recent kits: [{ id, savedAt, result }], newest first
    const [showHistory, setShowHistory] = useState(false);
    const [toast, setToast] = useState('');
    const typed = useTypewriter(EXAMPLES, !prompt);
    const toastTimer = useRef(null);
    const loadedFor = useRef(undefined);

    // Restore this user's Suggest state, then keep it saved as it changes.
    useEffect(() => {
      const st = loadStore(userId);
      setPrompt(st.prompt || '');
      setResult(st.current || null);
      setHistory(st.undo || []);
      setSaved(st.saved || []);
      loadedFor.current = userId;
    }, [userId]);
    useEffect(() => {
      if (loadedFor.current !== userId) return;
      try {
        localStorage.setItem(storeKey(userId), JSON.stringify({ prompt, current: result, undo: history.slice(-5), saved }));
      } catch (e) {}
    }, [userId, prompt, result, history, saved]);
    // Every version of the open kit is mirrored into its history entry.
    useEffect(() => {
      if (!result || !result.id) return;
      setSaved(list => {
        const rest = list.filter(e => e.id !== result.id);
        const existing = list.find(e => e.id === result.id);
        const entry = { id: result.id, savedAt: existing ? existing.savedAt : Date.now(), result };
        return [entry, ...rest].sort((a, b) => b.savedAt - a.savedAt).slice(0, HISTORY_LIMIT);
      });
    }, [result]);

    function openSaved(entry) {
      setResult(entry.result);
      setHistory([]);
      setPrompt(entry.result.brief || '');
      setShowHistory(false);
      setError('');
    }
    function deleteSaved(id) {
      setSaved(list => list.filter(e => e.id !== id));
    }

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
        setResult({ ...kit, brief: q, id: newKitId() });
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
        if (local.items.length) setResult({ ...local, id: newKitId(), brief: q, engine: 'offline', notice: why + ' — this kit was assembled offline. No credit was used.' });
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
        setResult({ ...kit, id: result.id, brief: result.brief, lastChange: instruction });
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
    const swapItem = (oldId, it) => setResult(r => ({ ...r, items: r.items.map(x => x.id === oldId ? { ...x, id: it.id, name: it.name, reason: `Swapped in for ${x.name}` } : x) }));
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

    // Other options from the catalog for the key items in the kit.
    const alternatives = useMemo(() => result ? findAlternatives(result.items, catById, catalog) : [], [result, catById, catalog]);

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
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 28px 80px' }}>

          <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={S.label}>Suggestions</div>
              <h1 style={{ fontFamily: S.mono, fontSize: 26, fontWeight: 700, margin: '6px 0 4px', letterSpacing: '-0.02em' }}>Build a kit list</h1>
              <div style={{ fontSize: 13, color: T.textMute, maxWidth: 600, lineHeight: 1.5 }}>
                Describe the shoot and I’ll assemble a kit from the equipment database.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {saved.length > 0 && (
                <button onClick={() => setShowHistory(v => !v)} aria-expanded={showHistory}
                  style={{ ...S.btnG, background: '#fff', padding: '7px 12px' }}>
                  History · {saved.length} {showHistory ? '▴' : '▾'}
                </button>
              )}
              {window.STUDIO_BILLING && <window.STUDIO_BILLING.CreditBadge status={billing} onGetMore={() => onUpgrade && onUpgrade('credits')} />}
            </div>
          </div>

          {showHistory && saved.length > 0 && (
            <div style={{ background: '#fff', border: `1px solid ${T.paperEdge}`, marginBottom: 14, maxHeight: 300, overflowY: 'auto' }}>
              {saved.map(entry => {
                const k = entry.result;
                const open = result && result.id === entry.id;
                return (
                  <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: '1px solid #f0ebe2', background: open ? '#fff8f4' : '#fff' }}>
                    <button onClick={() => openSaved(entry)} disabled={working} title="Open this kit (free)"
                      style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: T.ink }}>
                      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {k.name}{open && <span style={{ color: T.orange, fontFamily: S.mono, fontSize: 10, marginLeft: 8 }}>OPEN</span>}
                      </div>
                      <div style={{ fontSize: 11, color: T.textMute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.brief}</div>
                    </button>
                    <span style={{ fontFamily: S.mono, fontSize: 10, color: T.textMute, flexShrink: 0 }}>
                      {k.items.length} items · {new Date(entry.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                    <button onClick={() => deleteSaved(entry.id)} title="Remove from history"
                      style={{ background: 'none', border: 'none', color: T.textMute, cursor: 'pointer', fontSize: 15, padding: '0 2px', flexShrink: 0 }}>×</button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Brief */}
          <div style={{ background: '#fff', border: `1px solid ${T.paperEdge}`, padding: 16 }}>
            <style>{`.suggest-brief::placeholder { color: #b3aba1; opacity: 1; }`}</style>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !working) generate(); }}
              placeholder={typed}
              className="suggest-brief"
              rows={3}
              style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', border: `1px solid ${T.paperEdge}`, padding: '11px 12px', fontSize: 14, fontFamily: S.sans, color: T.ink, lineHeight: 1.5, background: '#fff' }}
            />
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
          {busyMode === 'generate' && <Progress stage={stage} />}

          {result && check && busyMode !== 'generate' && (
            <div style={{ marginTop: 18 }}>
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
                  <Progress stage={stage} compact />
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



                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {/* Items */}
                <div style={{ flex: '1 1 520px', minWidth: 0, marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {grouped.map(group => (
                    <div key={group.category}>
                      <div style={{ ...S.label, marginBottom: 5 }}>{group.category} · {group.items.length}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', border: `1px solid ${T.paperEdge}`, borderBottom: 'none' }}>
                        {group.items.map(it => (
                          <ItemRow key={it.id} it={it} full={catById.get(it.id)} res={check.items[it.id]}
                            onQty={d => bumpQty(it.id, d)} onRemove={() => removeItem(it.id)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Notes and alternatives, tabbed on the right */}
                <SidePanel notes={result.notes || []} alternatives={alternatives} onSwap={swapItem} />
                </div>

                <div style={{ marginTop: 22, display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                  {blocking > 0 && <span style={{ fontSize: 11, fontFamily: S.mono, color: T.err }}>{blocking} unresolved issue{blocking === 1 ? '' : 's'}</span>}
                  {actions}
                </div>

                {/* Disclaimer */}
                <div style={{ marginTop: 22, padding: '8px 10px', background: T.paperLight, border: `1px solid ${T.paperEdge}`, fontSize: 11, color: T.textMute, lineHeight: 1.5 }}>
                  Suggested kits are AI-generated and may contain mistakes. Always check every item, quantity and connection yourself, and test the kit before a shoot or rental. You’re responsible for the gear you send out.
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

  // Types each example brief out letter by letter as the placeholder, pauses,
  // erases it and moves on. Stops once the user types something.
  function useTypewriter(lines, active) {
    const [text, setText] = useState('');
    useEffect(() => {
      if (!active) return;
      let line = 0, pos = 0, dir = 1, t;
      const tick = () => {
        const full = lines[line];
        pos += dir;
        setText(full.slice(0, pos));
        let wait = dir > 0 ? 45 : 18;
        if (dir > 0 && pos >= full.length) { dir = -1; wait = 1800; }
        else if (dir < 0 && pos <= 0) { dir = 1; line = (line + 1) % lines.length; wait = 400; }
        t = setTimeout(tick, wait);
      };
      t = setTimeout(tick, 400);
      return () => clearTimeout(t);
    }, [active]);
    return active ? text : '';
  }

  const ALT_ROLES = ['body', 'lens', 'gimbal', 'monitor', 'light', 'mic-xlr', 'mic', 'tripod'];

  // For each key item, up to 3 catalog items in the same role (and the same
  // lens mount for bodies and lenses), ranked by shared words in the name.
  function findAlternatives(kitItems, catById, catalog) {
    const kitIds = new Set(kitItems.map(i => i.id));
    const byRole = {};
    catalog.forEach(it => { const role = C.specOf(it).role; if (ALT_ROLES.includes(role)) (byRole[role] || (byRole[role] = [])).push(it); });
    const words = n => new Set(String(n).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1));
    const out = [];
    kitItems.forEach(k => {
      const full = catById.get(k.id);
      if (!full) return;
      const spec = C.specOf(full);
      if (!ALT_ROLES.includes(spec.role)) return;
      const mount = spec.role === 'lens' ? spec.mount : null;
      const mounts = spec.role === 'body' ? new Set(spec.mounts || []) : null;
      const w = words(full.name);
      const options = (byRole[spec.role] || [])
        .filter(it => it.image_url && !kitIds.has(it.id) && it.name !== full.name)
        .filter(it => {
          const s2 = C.specOf(it);
          if (mount) return s2.mount === mount;
          if (mounts && mounts.size) return (s2.mounts || []).some(m => mounts.has(m));
          return true;
        })
        .map(it => { let sc = 0; words(it.name).forEach(x => { if (w.has(x)) sc++; }); return [it, sc]; })
        .sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
      if (options.length) out.push({ for: k, options });
    });
    return out.slice(0, 8);
  }

  function SidePanel({ notes, alternatives, onSwap }) {
    const [tab, setTab] = useState(notes.length ? 'notes' : 'alts');
    const tabs = [['notes', `Notes · ${notes.length}`], ['alts', `Alternatives · ${alternatives.length}`]];
    return (
      <div style={{ flex: '0 1 320px', minWidth: 260, marginTop: 14, position: 'sticky', top: 16, background: '#fff', border: `1px solid ${T.paperEdge}` }}>
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.paperEdge}` }}>
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ flex: 1, background: tab === id ? '#fff' : T.paperLight, border: 'none', borderBottom: `2px solid ${tab === id ? T.orange : 'transparent'}`,
                padding: '10px 8px', fontFamily: S.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                color: tab === id ? T.ink : T.textMute, cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ padding: '12px 14px', maxHeight: '70vh', overflowY: 'auto' }}>
          {tab === 'notes' && (notes.length
            ? notes.map((n, i) => <div key={i} style={{ fontSize: 12, color: T.ink, lineHeight: 1.5, padding: '8px 0', borderTop: i ? '1px solid #f0ebe2' : 'none' }}>{n}</div>)
            : <div style={{ fontSize: 12, color: T.textMute }}>No notes for this kit.</div>)}
          {tab === 'alts' && (alternatives.length ? alternatives.map((a, i) => (
            <div key={a.for.id} style={{ marginTop: i ? 14 : 0 }}>
              <div style={{ fontSize: 11, color: T.textMute, marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={a.for.name}>
                Instead of <span style={{ color: T.ink, fontWeight: 600 }}>{a.for.name}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {a.options.map(o => (
                  <button key={o.id} onClick={() => onSwap(a.for.id, o)} title={`Swap in ${o.name}`}
                    style={{ background: '#fff', border: `1px solid ${T.paperEdge}`, padding: 6, cursor: 'pointer', textAlign: 'left', minWidth: 0 }}>
                    <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={o.image_url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    </div>
                    <div style={{ marginTop: 4, fontSize: 10, lineHeight: 1.3, color: T.ink, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', height: 26 }}>{o.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )) : <div style={{ fontSize: 12, color: T.textMute }}>No alternatives found in the database.</div>)}
        </div>
      </div>
    );
  }

  // Summary of the kit check, with one-click fixes for anything missing.
  function CompatPanel({ check, catalog, kitIds, onAdd }) {
    const { counts, issues } = check;
    const clean = !issues.some(i => i.level === 'conflict' || i.level === 'need');
    const [open, setOpen] = useState(!clean);
    useEffect(() => { if (!clean) setOpen(true); }, [clean]);
    const headline = clean
      ? (counts.unverified ? 'No conflicts found — some items couldn’t be verified' : 'Everything in this kit works together')
      : `${counts.conflict} conflict${counts.conflict === 1 ? '' : 's'} · ${issues.filter(i => i.level === 'need').length} missing`;
    const tone = clean ? (counts.unverified ? STATUS.unverified : STATUS.ok) : STATUS.conflict;
    return (
      <div style={{ marginTop: 12, background: '#fff', border: `1px solid ${clean ? T.paperEdge : T.err}`, padding: '9px 12px' }}>
        <div onClick={() => issues.length && setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', cursor: issues.length ? 'pointer' : 'default' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...badge(tone), width: 18, height: 18 }}>{tone.icon}</span>
            <span style={{ fontFamily: S.mono, fontSize: 12, fontWeight: 600, color: T.ink }}>{headline}</span>
            {issues.length > 0 && <span style={{ fontFamily: S.mono, fontSize: 11, color: T.textMute }}>{open ? '▴' : `▾ ${issues.length} detail${issues.length === 1 ? '' : 's'}`}</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['ok', 'conditional', 'unverified'].filter(k => counts[k]).map(k => (
              <span key={k} style={S.pill(STATUS[k].bg, STATUS[k].fg)}>{counts[k]} {STATUS[k].label}</span>
            ))}
          </div>
        </div>
        {open && issues.length > 0 && (
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

  // One line per item; reason, compatibility notes and specs in a dropdown.
  function ItemRow({ it, full, res, onQty, onRemove }) {
    const [open, setOpen] = useState(false);
    const st = res && STATUS[res.status];
    const tags = C.describe(C.specOf(full));
    const hasDetails = !!(it.reason || (res && res.notes.length) || tags);
    const firstNote = res && res.notes.find(n => n.status !== 'ok');
    return (
      <div style={{ background: '#fff', borderBottom: `1px solid ${T.paperEdge}`, borderLeft: `3px solid ${st && res.status === 'conflict' ? T.err : 'transparent'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 8px' }}>
          <div style={{ width: 30, height: 30, flexShrink: 0, background: T.paperLight, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={window.GEAR.itemImage(full || it)} alt=""
              onError={e => { e.currentTarget.src = window.GEAR_PLACEHOLDER(full ? full.category : 'Camera'); }}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
          {st && <span style={badge(st)} title={st.label}>{st.icon}</span>}
          <div onClick={() => hasDetails && setOpen(o => !o)} style={{ flex: 1, minWidth: 0, cursor: hasDetails ? 'pointer' : 'default' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</div>
            {!open && firstNote && (
              <div style={{ fontSize: 11, fontFamily: S.mono, color: (STATUS[firstNote.status] || STATUS.ok).fg, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{firstNote.text}</div>
            )}
          </div>
          {hasDetails && (
            <button onClick={() => setOpen(o => !o)} aria-expanded={open} title={open ? 'Hide details' : 'Show details'}
              style={{ background: 'none', border: 'none', color: T.textMute, cursor: 'pointer', fontSize: 12, padding: '4px 6px', flexShrink: 0 }}>{open ? '▴' : '▾'}</button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, border: `1px solid ${T.paperEdge}` }}>
            <button onClick={() => onQty(-1)} style={stepBtn}>−</button>
            <span style={{ minWidth: 24, textAlign: 'center', fontFamily: S.mono, fontSize: 12, fontWeight: 600 }}>{it.qty}</span>
            <button onClick={() => onQty(+1)} style={stepBtn}>+</button>
          </div>
          <button onClick={onRemove} title="Remove from list"
            style={{ background: 'transparent', border: 'none', color: T.textMute, cursor: 'pointer', fontSize: 15, padding: '2px 4px', flexShrink: 0 }}>×</button>
        </div>
        {open && (
          <div style={{ padding: '0 12px 8px 58px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {it.reason && <div style={{ fontSize: 11, color: T.textMute }}>{it.reason}</div>}
            {res && res.notes.map((n, i) => (
              <div key={i} style={{ fontSize: 11, fontFamily: S.mono, color: (STATUS[n.status] || STATUS.ok).fg, lineHeight: 1.4 }}>{n.text}</div>
            ))}
            {tags && <div style={{ fontSize: 10, fontFamily: S.mono, color: T.textMute, opacity: 0.8 }}>{tags}</div>}
          </div>
        )}
      </div>
    );
  }

  // Spinner, step list and timer while the AI works (usually 20–60s).
  const STEPS = ['Choosing gear', 'Checking compatibility', 'Fixing issues'];
  function Progress({ stage, compact }) {
    const [seconds, setSeconds] = useState(0);
    useEffect(() => {
      const t = setInterval(() => setSeconds(x => x + 1), 1000);
      return () => clearInterval(t);
    }, []);
    const offline = /offline/i.test(stage);
    const step = /^Fixing/.test(stage) ? 2 : /^Checking/.test(stage) ? 1 : 0;
    const spinner = <span style={{ width: compact ? 12 : 16, height: compact ? 12 : 16, border: `2px solid ${T.paperEdge}`, borderTopColor: T.orange, borderRadius: '50%', display: 'inline-block', animation: 'gearSuggestSpin .8s linear infinite', flexShrink: 0 }} />;
    return (
      <div role="status" aria-live="polite" style={compact
        ? { marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: T.textMute, fontFamily: S.mono }
        : { marginTop: 18, background: '#fff', border: `1px solid ${T.paperEdge}`, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <style>{'@keyframes gearSuggestSpin { to { transform: rotate(360deg); } }'}</style>
        {spinner}
        {compact || offline ? (
          <span style={{ fontFamily: S.mono, fontSize: compact ? 11 : 13, color: compact ? T.textMute : T.ink }}>{stage} {seconds}s</span>
        ) : (
          <React.Fragment>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', flex: 1 }}>
              {STEPS.map((label, i) => (
                <span key={label} style={{ fontFamily: S.mono, fontSize: 12, color: i < step ? T.ok : i === step ? T.ink : T.textMute, fontWeight: i === step ? 600 : 400 }}>
                  {i < step ? '✓' : i === step ? '●' : '○'} {label}{i === 2 ? ' (if needed)' : ''}
                </span>
              ))}
            </div>
            <span style={{ fontFamily: S.mono, fontSize: 11, color: T.textMute }}>{seconds}s · usually under a minute</span>
          </React.Fragment>
        )}
      </div>
    );
  }

  function Dropdown({ title, style, children }) {
    const [open, setOpen] = useState(false);
    return (
      <div style={{ background: '#fff', border: `1px solid ${T.paperEdge}`, ...style }}>
        <button onClick={() => setOpen(o => !o)} aria-expanded={open}
          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', padding: '9px 12px', cursor: 'pointer', ...S.label, color: T.ink }}>
          <span>{title}</span><span>{open ? '▴' : '▾'}</span>
        </button>
        {open && <div style={{ padding: '0 12px 10px' }}>{children}</div>}
      </div>
    );
  }

  const badge = (st) => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, flexShrink: 0, background: st.bg, color: st.fg, fontSize: 10, fontWeight: 700, fontFamily: S.mono, border: `1px solid ${st.fg}` });
  const stepBtn = { background: 'transparent', border: 'none', width: 24, height: 24, fontSize: 16, cursor: 'pointer', color: T.ink, lineHeight: 1, fontFamily: S.mono };
  function truncate(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  window.STUDIO_SUGGEST = SuggestPage;
})();
