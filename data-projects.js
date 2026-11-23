window.GEAR_PROJECTS = [
  { id: 'p01', name: 'Test Project', client: 'Internal', status: 'planning', shoot: 'Nov 12', location: 'Studio 4', items: ['i02','i02','i02','i03','i03','i03','i11','i11','i11'] },
  { id: 'p02', name: 'Atlas Doc', client: 'Atlas Films', status: 'active', shoot: 'Nov 14–18', location: 'Topanga, CA', items: ['i12','i14','i13','i18','i06','i06','i06','i17','i15','i16','i01','i05'] },
  { id: 'p03', name: 'Monday', client: 'Holm & Co.', status: 'active', shoot: 'Nov 18', location: 'Downtown LA', items: ['i06','i12','i06','i17','i14','i13','i01','i16'] },
  { id: 'p04', name: 'Lens Test', client: '—', status: 'planning', shoot: 'TBD', location: '—', items: ['i15','i15'] },
  { id: 'p05', name: 'Beach Doc', client: 'Saltwater', status: 'wrapped', shoot: 'Oct 28–30', location: 'Malibu', items: ['i07','i03','i17','i16','i12','i06'] },
  { id: 'p06', name: 'Ad Spot — Lume', client: 'Lume Skincare', status: 'active', shoot: 'Nov 22', location: 'Studio 2', items: ['i05','i15','i17','i12','i12','i14','i13','i16','i06','i06'] },
];

window.GEAR_CATEGORIES = ['All','Camera','Lens','Lighting','Audio','Monitor','Storage','Rigging','Cinema'];

// Image placeholder: plain white. Used when an item has no photo URL or its
// photo fails to load; the photo cells are white too, so the tile just stays
// blank instead of showing a category icon. (Takes a category for call-site
// compatibility; it no longer changes the result.)
window.GEAR_PLACEHOLDER = () =>
  'data:image/svg+xml;base64,' + btoa("<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='#ffffff'/></svg>");

// Safety net: an older build stored a camera-icon SVG as an item's image (in
// browser caches and saved lists). Photos are never SVG data URIs, so any such
// image is treated as blank: shown white, and skipped by the PDF export.
window.GEAR_CLEAN_IMG = (u) => (typeof u === 'string' && /^data:image\/svg\+xml/i.test(u.trim()) ? '' : u);
(function () {
  const WHITE = window.GEAR_PLACEHOLDER();
  const fix = (img) => {
    const s = img.getAttribute('src') || '';
    if (s !== WHITE && /^data:image\/svg\+xml/i.test(s)) img.setAttribute('src', WHITE);
  };
  const scan = (root) => { if (root.nodeType !== 1) return; if (root.tagName === 'IMG') fix(root); root.querySelectorAll && root.querySelectorAll('img').forEach(fix); };
  const start = () => new MutationObserver((ms) => {
    ms.forEach(m => { if (m.type === 'attributes') fix(m.target); else m.addedNodes.forEach(scan); });
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
  if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start);
})();

