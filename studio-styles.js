// Studio — shared style tokens, used across all studio-* JSX modules.
window.STUDIO_STYLES = (function () {
  const T = window.GEAR.tokens;
  return {
    T,
    mono: '"JetBrains Mono", ui-monospace, monospace',
    sans: '"Inter", -apple-system, system-ui, sans-serif',
    btnP: { background: T.orange, color: '#fff', border: 'none', padding: '8px 14px', fontSize: 11, fontFamily: '"JetBrains Mono", monospace', cursor: 'pointer', letterSpacing: '0.06em', fontWeight: 600, borderRadius: 4, textTransform: 'uppercase' },
    btnG: { background: 'transparent', color: T.ink, border: `1px solid ${T.paperEdge}`, padding: '8px 14px', fontSize: 11, fontFamily: '"JetBrains Mono", monospace', cursor: 'pointer', letterSpacing: '0.06em', borderRadius: 4, textTransform: 'uppercase' },
    btnDark: { background: T.ink, color: '#fff', border: 'none', padding: '8px 14px', fontSize: 11, fontFamily: '"JetBrains Mono", monospace', cursor: 'pointer', letterSpacing: '0.06em', fontWeight: 600, borderRadius: 4, textTransform: 'uppercase' },
    label: { fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.textMute, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 },
    pill: (bg, fg) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 999, background: bg, color: fg, fontSize: 9, fontWeight: 600, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em', textTransform: 'uppercase' }),
    input: { padding: '9px 12px', borderRadius: 4, border: `1px solid ${T.paperEdge}`, background: '#fff', fontSize: 13, fontFamily: '"Inter", system-ui, sans-serif', color: T.ink, outline: 'none', width: '100%' },
    modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(20,16,12,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
    modal: { background: '#fff', borderRadius: 8, width: 540, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.25)' },
    modalHead: { padding: '20px 24px', borderBottom: '1px solid #f0ebe2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    modalTitle: { fontFamily: '"JetBrains Mono", monospace', fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' },
    modalBody: { padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 },
    modalFoot: { padding: '14px 24px', borderTop: '1px solid #f0ebe2', display: 'flex', gap: 8, justifyContent: 'flex-end', background: '#faf7f2' },
    field: { display: 'flex', flexDirection: 'column', gap: 6 },
  };
})();
