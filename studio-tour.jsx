// Studio tour — a first-login walkthrough that gets new users to add gear to
// their inventory and create a project. Each task step finishes itself when
// the user actually does it. Skippable at any point; App records it as done
// (on the account and in this browser) so it only ever shows once.
//
// Steps point at elements marked with data-tour="…" in the other modules.
(function () {
  const { useState, useEffect } = React;
  const S = window.STUDIO_STYLES;
  const T = S.T;

  const STEPS = [
    { key: 'welcome' },
    { key: 'gear', page: 'database', target: '[data-tour="add-to-inventory"]', waitFor: 'item',
      title: 'Add gear to your inventory', text: 'Search the database for something you own, then click + Add to Inventory.' },
    { key: 'project', page: 'projects', target: '[data-tour="new-project"]', waitFor: 'project',
      title: 'Create your first project', text: 'One project per shoot. Click + New Project, give it a name and create it.' },
    { key: 'pack', page: 'inventory', target: '[data-tour="project-panel"]', waitFor: 'packed',
      title: 'Put your gear in the project', text: 'Drag an item from your inventory onto the project panel on the right.' },
    { key: 'explore', page: 'inventory', target: '[data-tour="nav-suggest"]',
      title: 'Let AI build a kit', text: 'Describe a shoot in Suggest and get a kit list where every item is checked to work together. Discover has the latest gear, explained.' },
    { key: 'done' },
  ];
  const TASKS = STEPS.filter(s => s.title).length;

  // Pulsing outline that follows the step's target as the layout moves.
  function Spotlight({ selector }) {
    const [rect, setRect] = useState(null);
    useEffect(() => {
      if (!selector) { setRect(null); return; }
      const measure = () => {
        const el = [...document.querySelectorAll(selector)].find(e => e.offsetParent !== null);
        const r = el && el.getBoundingClientRect();
        setRect(r && r.width ? { top: r.top, left: r.left, width: r.width, height: r.height } : null);
      };
      measure();
      const t = setInterval(measure, 300);
      return () => clearInterval(t);
    }, [selector]);
    if (!rect) return null;
    const pad = 6;
    return (
      <div aria-hidden="true" style={{ position: 'fixed', top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, border: `2px solid ${T.orange}`, borderRadius: 8, pointerEvents: 'none', zIndex: 400, animation: 'gearTourPulse 1.4s ease-in-out infinite', transition: 'top .2s, left .2s, width .2s, height .2s' }}>
        <style>{'@keyframes gearTourPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,87,12,0.45); } 50% { box-shadow: 0 0 0 8px rgba(255,87,12,0); } }'}</style>
      </div>
    );
  }

  function Tour({ step, name, justDone, onStart, onNext, onSkip, onFinish, onOpen }) {
    const s = STEPS[step];
    const card = { background: '#fff', border: `1px solid ${T.paperEdge}`, borderRadius: 10, boxShadow: '0 18px 50px rgba(20,16,12,0.28)', color: T.ink };
    const skip = <button onClick={onSkip} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: T.textMute, fontFamily: S.mono, fontSize: 11 }}>Skip tour</button>;

    if (s.key === 'welcome' || s.key === 'done') {
      const welcome = s.key === 'welcome';
      return (
        <div style={{ ...S.modalOverlay, zIndex: 450 }}>
          <div style={{ ...card, width: 460, maxWidth: 'calc(100vw - 32px)', padding: '28px 30px' }} role="dialog" aria-label={welcome ? 'Welcome tour' : 'Tour complete'}>
            <img src="app-icon.jpg" alt="" style={{ width: 40, height: 40, borderRadius: 9, marginBottom: 16 }} />
            <div style={{ fontFamily: S.mono, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
              {welcome ? `Welcome${name ? `, ${name}` : ''}` : 'You’re all set'}
            </div>
            <div style={{ fontSize: 14, color: T.textMute, lineHeight: 1.6, marginTop: 8 }}>
              {welcome
                ? 'Let’s get you set up: add your first piece of gear, create a project for a shoot and pack it. It takes about a minute.'
                : 'Your inventory and first project are ready. The Guide in the sidebar covers everything else whenever you need it.'}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 22, flexWrap: 'wrap' }}>
              {welcome ? (
                <React.Fragment>
                  <button onClick={onStart} style={{ ...S.btnP, padding: '11px 18px' }}>Start the tour</button>
                  <button onClick={onSkip} style={{ ...S.btnG, padding: '11px 18px' }}>Skip for now</button>
                </React.Fragment>
              ) : (
                <React.Fragment>
                  <button onClick={onFinish} style={{ ...S.btnP, padding: '11px 18px' }}>Start using Gear</button>
                  <button onClick={() => onOpen('suggest')} style={{ ...S.btnG, padding: '11px 18px' }}>Try Suggest</button>
                  <button onClick={() => onOpen('guide')} style={{ ...S.btnG, padding: '11px 18px' }}>Open the guide</button>
                </React.Fragment>
              )}
            </div>
            {welcome && <div style={{ fontSize: 11, color: T.textMute, fontFamily: S.mono, marginTop: 14 }}>You’ll only see this once.</div>}
          </div>
        </div>
      );
    }

    const n = STEPS.slice(0, step).filter(x => x.title).length + 1;
    return (
      <React.Fragment>
        <Spotlight selector={justDone ? null : s.target} />
        <div role="dialog" aria-label={s.title} style={{ ...card, position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', width: 440, maxWidth: 'calc(100vw - 32px)', padding: '18px 20px', zIndex: 450 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ ...S.label, color: T.orange }}>Step {n} of {TASKS}</span>
            {skip}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
            {Array.from({ length: TASKS }).map((_, i) => (
              <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < n - (justDone ? 0 : 1) ? T.orange : T.paperLight }} />
            ))}
          </div>
          <div style={{ fontFamily: S.mono, fontSize: 16, fontWeight: 700, marginTop: 12 }}>
            {justDone ? <span style={{ color: T.ok }}>✓ Nice — done</span> : s.title}
          </div>
          {!justDone && <div style={{ fontSize: 13, color: T.textMute, lineHeight: 1.55, marginTop: 4 }}>{s.text}</div>}
          {!justDone && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={onNext} style={s.waitFor ? { ...S.btnG, padding: '7px 12px' } : { ...S.btnP, padding: '7px 14px' }}>
                {s.waitFor ? 'Skip this step' : 'Next'}
              </button>
            </div>
          )}
        </div>
      </React.Fragment>
    );
  }

  window.STUDIO_TOUR = { Tour, STEPS };
})();
