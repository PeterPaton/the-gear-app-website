// Shared design tokens, primitives, and helpers across all 3 directions.
// Loaded as plain JS so each direction's JSX file can read window.GEAR.

window.GEAR = window.GEAR || {};

window.GEAR.tokens = {
  // From iOS app — exact RGBs lifted off the Figma metadata.
  ink: '#191919',          // primary text & black bar
  inkSoft: '#332f30',      // secondary text on dark
  paper: '#d9d2ca',        // beige content bg
  paperLight: '#e8e2d8',   // lighter beige (placeholder bg, hovers)
  paperEdge: '#c8bfb4',    // beige border
  white: '#ffffff',
  orange: '#FF570C',
  orangeAlt: '#F04C23',
  textMute: '#7a716a',
  // Status accents
  ok: '#1f8a5b',
  warn: '#c98a1d',
  err: '#c44a2c',
};

// Stat colors for project status pills
window.GEAR.statusColor = {
  planning: { bg: '#efe8db', fg: '#6a5a3a' },
  active:   { bg: '#FF570C', fg: '#ffffff' },
  wrapped:  { bg: '#e7e7e4', fg: '#666' },
};

// Item availability colors
window.GEAR.availColor = {
  available:    { bg: '#e3efe5', fg: '#1f8a5b', label: 'Available' },
  'checked-out':{ bg: '#fde6dd', fg: '#c44a2c', label: 'Out' },
  maintenance:  { bg: '#f4ecd6', fg: '#8a6a14', label: 'Service' },
};

// Build sticky group counts: how many of an item are in this project's items[] list
window.GEAR.groupItems = (itemIds) => {
  const counts = {};
  itemIds.forEach(id => counts[id] = (counts[id] || 0) + 1);
  return counts;
};

// Utility: get item by id
window.GEAR.byId = (id) => window.GEAR_ITEMS.find(it => it.id === id);

// Utility: real image_url if the item came from Supabase and has one,
// otherwise the per-category SVG placeholder. Centralized so every thumbnail
// in the UI gets the same fallback rules.
window.GEAR.itemImage = (it) => {
  if (!it) return window.GEAR_PLACEHOLDER('Camera');
  const u = it.image_url || it.imageUrl;
  if (u && typeof u === 'string' && u.trim()) return u;
  return window.GEAR_PLACEHOLDER(it.category);
};

// Utility: nice short name
window.GEAR.shortName = (it) => {
  if (!it) return '';
  const n = it.name;
  return n.length > 38 ? n.slice(0, 36) + '…' : n;
};

// Utility: total project value
window.GEAR.projectValue = (proj) => proj.items.reduce((sum, id) => {
  const it = window.GEAR.byId(id);
  return sum + (it ? it.value : 0);
}, 0);
