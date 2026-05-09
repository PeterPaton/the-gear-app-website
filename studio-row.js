// Gear · Shared item-row styles used by Inventory, Database, and Project detail.
// All three pages render the same row structure so the UI feels unified.
(function () {
  const S = window.STUDIO_STYLES;
  const T = S.T;

  // Shared row height constants
  window.GEAR_ROW = {
    // Heights
    rowH: (density) => density === 'tight' ? 44 : 64,

    // ── Shared static styles ──────────────────────────────────────────────
    sH: {
      textAlign: 'left',
      padding: '11px 14px',
      fontFamily: S.mono,
      fontSize: 9,
      letterSpacing: '0.12em',
      color: T.textMute,
      borderBottom: `2px solid ${T.ink}`,
      borderRight: `1px solid ${T.paperEdge}`,
      background: '#f6f3ee',
      position: 'sticky',
      top: 0,
      zIndex: 2,
      textTransform: 'uppercase',
      fontWeight: 600,
      userSelect: 'none',
    },

    tD: { borderBottom: '1px solid #f0ebe2', verticalAlign: 'middle' },

    pageHead: {
      padding: '18px 28px',
      borderBottom: `1px solid ${T.paperEdge}`,
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flexShrink: 0,
    },

    pageTitle: {
      fontFamily: S.mono,
      fontSize: 24,
      fontWeight: 600,
      letterSpacing: '-0.02em',
    },

    countChip: {
      fontFamily: S.mono,
      fontSize: 11,
      color: T.textMute,
      padding: '4px 10px',
      background: '#f1ece2',
      borderRadius: 3,
      letterSpacing: '0.04em',
    },

    catRow: {
      display: 'flex',
      gap: 6,
      padding: '12px 28px',
      borderBottom: `1px solid ${T.paperEdge}`,
      background: '#faf7f2',
      overflowX: 'auto',
      flexShrink: 0,
    },

    catChip: (active) => ({
      padding: '5px 12px',
      fontSize: 10,
      fontFamily: S.mono,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      borderRadius: 999,
      border: active ? 'none' : `1px solid ${T.paperEdge}`,
      background: active ? T.ink : 'transparent',
      color: active ? '#fff' : T.ink,
      cursor: 'pointer',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }),

    densityToggle: {
      display: 'flex',
      border: `1px solid ${T.paperEdge}`,
      borderRadius: 4,
      overflow: 'hidden',
    },

    densityBtn: (active) => ({
      background: active ? T.ink : '#fff',
      color: active ? '#fff' : T.ink,
      border: 'none',
      padding: '7px 10px',
      fontSize: 13,
      cursor: 'pointer',
    }),

    // The +/- edit buttons shown in edit mode
    qBox: (active) => ({
      flex: 1,
      background: '#fff',
      border: 'none',
      borderRight: `1px solid #f0ebe2`,
      cursor: active ? 'pointer' : 'default',
      fontSize: 22,
      fontWeight: 300,
      color: active ? T.ink : '#c9c2b3',
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),

    // Shared pill-style +/- stepper used in inventory, project, and cart rows.
    // `dark` swaps colors for use against the cart panel's ink background.
    qPill: (dark = false) => ({
      display: 'inline-flex',
      alignItems: 'center',
      background: dark ? 'rgba(255,255,255,0.12)' : '#f1ece2',
      borderRadius: 999,
      padding: 2,
      gap: 0,
    }),
    qPillBtn: (dark = false) => ({
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      width: 24,
      height: 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: dark ? '#fff' : T.ink,
      fontSize: 14,
      fontWeight: 400,
      padding: 0,
      borderRadius: 999,
    }),

    // Edit mode toggle button
    editToggleBtn: (active) => ({
      display: 'flex',
      alignItems: 'center',
      gap: 6,
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
      transition: 'all .12s',
    }),
  };
})();
