// Studio — shared style tokens, used across all studio-* JSX modules.
window.STUDIO_STYLES = (function () {
  const T = window.GEAR.tokens;
  const MONO = '"Orbit", "JetBrains Mono", ui-monospace, monospace';
  return {
    T,
    // Orbit: display type, labels, numbers and buttons (one weight only).
    mono: '"Orbit", "JetBrains Mono", ui-monospace, monospace',
    // The wordmark next to the logo.
    wordmark: { fontFamily: MONO, letterSpacing: '0.06em' },
    sans: '"Inter", -apple-system, system-ui, sans-serif',
    btnP: { background: T.orange, color: '#fff', border: 'none', padding: '8px 14px', fontSize: 11, fontFamily: MONO, cursor: 'pointer', letterSpacing: '0.06em', fontWeight: 600, textTransform: 'uppercase' , whiteSpace: 'nowrap' },
    btnG: { background: 'transparent', color: T.ink, border: `1px solid ${T.paperEdge}`, padding: '8px 14px', fontSize: 11, fontFamily: MONO, cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase' , whiteSpace: 'nowrap' },
    btnDark: { background: T.ink, color: '#fff', border: 'none', padding: '8px 14px', fontSize: 11, fontFamily: MONO, cursor: 'pointer', letterSpacing: '0.06em', fontWeight: 600, textTransform: 'uppercase' , whiteSpace: 'nowrap' },
    label: { fontFamily: MONO, fontSize: 10, color: T.textMute, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 },
    pill: (bg, fg) => ({ display: 'inline-block', padding: '2px 8px', background: bg, color: fg, fontSize: 9, fontWeight: 600, fontFamily: MONO, letterSpacing: '0.06em', textTransform: 'uppercase' }),
    input: { padding: '9px 12px', border: `1px solid ${T.paperEdge}`, background: '#fff', fontSize: 13, fontFamily: '"Inter", system-ui, sans-serif', color: T.ink, outline: 'none', width: '100%' },
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(20,16,12,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
    modal: { background: '#fff', width: 540, maxWidth: 'calc(100vw - 24px)', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.25)' },
    modalHead: { padding: '20px 24px', borderBottom: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    modalTitle: { fontFamily: MONO, fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' },
    modalBody: { padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 },
    modalFoot: { padding: '14px 24px', borderTop: `1px solid ${T.line}`, display: 'flex', gap: 8, justifyContent: 'flex-end', background: '#faf7f2' },
    field: { display: 'flex', flexDirection: 'column', gap: 6 },
  };
})();
