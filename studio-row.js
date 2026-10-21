// Gear · Shared item-row styles used by Inventory, Database, and Project detail.
// All three pages render the same row structure so the UI feels unified.
(function () {
  const S = window.STUDIO_STYLES;
  const T = S.T;

  // Shared row height constants
  window.GEAR_ROW = {
    // Heights
    // List row heights: compact rows vs large rows with bigger photos.
    rowH: (density) => density === 'tight' ? 38 : 68,

    // ── Shared static styles ──────────────────────────────────────────────
    sH: {
      textAlign: 'left',
      padding: '11px 14px',
      fontFamily: S.mono,
      fontSize: 9,
      letterSpacing: '0.12em',
      color: T.textMute,
      borderBottom: `1px solid ${T.ink}`,
      borderRight: `1px solid ${T.ink}`,
      background: T.paperLight,
      position: 'sticky',
      top: 0,
      zIndex: 2,
      textTransform: 'uppercase',
      fontWeight: 600,
      userSelect: 'none',
    },

    tD: { borderBottom: `1px solid ${T.ink}`, verticalAlign: 'middle' },

    pageHead: {
      padding: '12px 24px',
      minHeight: 64,
      borderBottom: '1px solid #000',
      background: T.ink,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      flexShrink: 0,
    },

    pageTitle: {
      fontFamily: S.mono,
      fontSize: 24,
      letterSpacing: '0.02em',
    },

    countChip: {
      fontFamily: S.mono,
      fontSize: 11,
      color: 'rgba(255,255,255,0.6)',
      padding: '4px 10px',
      background: 'rgba(255,255,255,0.08)',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    },

    catRow: {
      display: 'flex',
      gap: 6,
      padding: '10px 24px',
      borderBottom: `1px solid ${T.ink}`,
      background: T.paperLight,
      overflowX: 'auto',
      flexShrink: 0,
    },

    catChip: (active) => ({
      padding: '7px 12px',
      fontSize: 10,
      fontFamily: S.mono,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      border: `1px solid ${active ? T.orange : T.ink}`,
      background: active ? T.orange : '#fff',
      color: active ? '#fff' : T.ink,
      cursor: 'pointer',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }),

    densityToggle: {
      display: 'flex',
      border: '1px solid #000',
      overflow: 'hidden',
    },

    densityBtn: (active) => ({
      background: active ? T.orange : '#fff',
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
      borderRight: `1px solid #e2d9cd`,
      cursor: active ? 'pointer' : 'default',
      fontSize: 22,
      fontWeight: 300,
      color: active ? T.ink : '#c9c2b3',
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),

    // Shared +/- stepper used in inventory, project, and cart rows: square
    // cells with hard dividers. `dark` is for use on an ink background.
    qPill: (dark = false) => ({
      display: 'inline-flex',
      alignItems: 'stretch',
      background: dark ? 'transparent' : '#fff',
      border: `1px solid ${dark ? 'rgba(255,255,255,0.25)' : T.ink}`,
    }),
    qPillBtn: (dark = false, first = false) => ({
      background: 'none',
      border: 'none',
      borderLeft: first ? 'none' : `1px solid ${dark ? 'rgba(255,255,255,0.25)' : T.ink}`,
      cursor: 'pointer',
      width: 30,
      height: 30,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: dark ? '#fff' : T.ink,
      fontSize: 16,
      fontWeight: 400,
      padding: 0,
    }),
    // The number between − and + in a stepper; orange once there's more than one.
    qPillNum: (qty, dark = false) => ({
      minWidth: 30,
      padding: '0 6px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderLeft: `1px solid ${dark ? 'rgba(255,255,255,0.25)' : T.ink}`,
      fontFamily: S.mono,
      fontSize: 13,
      background: qty > 1 ? T.orange : 'transparent',
      color: qty > 1 ? '#fff' : (dark ? '#fff' : T.ink),
    }),

    // ── Kit grid: photo | item | category | qty/action ─────────────────
    // Shared by the project page, Inventory and Database so every list of
    // gear reads the same way.
    kitCols: (rowH, lastW = 120) => `${rowH}px minmax(0, 1fr) 130px ${lastW}px`,
    kitHeadRow: {
      display: 'grid',
      height: 28,
      background: T.paperLight,
      borderBottom: `1px solid ${T.ink}`,
      position: 'sticky',
      top: 0,
      zIndex: 3,
    },
    kitHeadCell: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '0 14px',
      borderRight: `1px solid ${T.ink}`,
      fontFamily: S.mono,
      fontSize: 10,
      letterSpacing: '0.12em',
      color: T.textMute,
      textTransform: 'uppercase',
      userSelect: 'none',
    },
    kitBar: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      minHeight: 30,
      padding: '0 10px 0 14px',
      background: T.ink,
      color: '#fff',
      borderBottom: `1px solid ${T.ink}`,
      fontFamily: S.mono,
      fontSize: 11,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
    },
    kitCell: {
      display: 'flex',
      alignItems: 'center',
      borderRight: `1px solid ${T.ink}`,
      minWidth: 0,
    },
    kitImgCell: {
      position: 'relative',
      overflow: 'hidden',
      background: '#fff',
      borderRight: `1px solid ${T.ink}`,
      minWidth: 0,
    },
    // The photo, scaled to fill its white cell with a small margin.
    kitImg: {
      position: 'absolute',
      top: 5,
      left: 5,
      width: 'calc(100% - 10px)',
      height: 'calc(100% - 10px)',
      objectFit: 'contain',
    },
    kitName: {
      fontFamily: S.mono,
      fontSize: 13,
      color: T.ink,
      lineHeight: 1.3,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    kitCat: {
      padding: '0 14px',
      fontFamily: S.mono,
      fontSize: 10,
      letterSpacing: '0.08em',
      color: T.textMute,
      textTransform: 'uppercase',
    },
    kitStepBtn: {
      border: 'none',
      background: 'transparent',
      fontSize: 18,
      fontWeight: 300,
      cursor: 'pointer',
      color: T.ink,
      padding: 0,
    },
    // The ×N count in an item row's last column (dim, like the side panel).
    kitCount: (ruled = false) => ({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: S.mono,
      fontSize: 12,
      color: T.textMute,
      borderLeft: ruled ? `1px solid ${T.ink}` : 'none',
      borderRight: ruled ? `1px solid ${T.ink}` : 'none',
    }),
    // Hover handlers that fill a stepper button orange.
    kitStepHover: {
      onMouseEnter: (e) => { e.currentTarget.style.background = T.orange; e.currentTarget.style.color = '#fff'; },
      onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.ink; },
    },
    // The quantity cell between − and +; orange once there's more than one.
    kitQty: (qty, ruled = true) => ({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: S.mono,
      fontSize: 14,
      borderLeft: ruled ? `1px solid ${T.ink}` : 'none',
      borderRight: ruled ? `1px solid ${T.ink}` : 'none',
      background: qty > 1 ? T.orange : 'transparent',
      color: qty > 1 ? '#fff' : T.ink,
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
      whiteSpace: 'nowrap',
      border: `1px solid ${active ? T.orange : '#000'}`,
      background: active ? T.orange : '#fff',
      color: active ? '#fff' : T.ink,
      cursor: 'pointer',
      transition: 'all .12s',
    }),

    // Secondary button inside a dark page header (Export PDF and the like).
    headBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '7px 14px',
      fontSize: 11,
      fontFamily: S.mono,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      border: '1px solid #000',
      background: '#fff',
      color: T.ink,
      cursor: 'pointer',
    },

    // Search field inside a dark page header.
    headSearch: (hasQuery) => ({
      padding: hasQuery ? '8px 30px 8px 32px' : '8px 12px 8px 32px',
      border: '1px solid #000',
      background: '#2a2a2a',
      color: '#fff',
      fontSize: 13,
      fontFamily: S.sans,
      outline: 'none',
      width: '100%',
    }),
  };
})();
