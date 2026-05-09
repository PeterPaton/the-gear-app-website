window.GEAR_PROJECTS = [
  { id: 'p01', name: 'Test Project', client: 'Internal', status: 'planning', shoot: 'Nov 12', location: 'Studio 4', items: ['i02','i02','i02','i03','i03','i03','i11','i11','i11'] },
  { id: 'p02', name: 'Atlas Doc', client: 'Atlas Films', status: 'active', shoot: 'Nov 14–18', location: 'Topanga, CA', items: ['i12','i14','i13','i18','i06','i06','i06','i17','i15','i16','i01','i05'] },
  { id: 'p03', name: 'Monday', client: 'Holm & Co.', status: 'active', shoot: 'Nov 18', location: 'Downtown LA', items: ['i06','i12','i06','i17','i14','i13','i01','i16'] },
  { id: 'p04', name: 'Lens Test', client: '—', status: 'planning', shoot: 'TBD', location: '—', items: ['i15','i15'] },
  { id: 'p05', name: 'Beach Doc', client: 'Saltwater', status: 'wrapped', shoot: 'Oct 28–30', location: 'Malibu', items: ['i07','i03','i17','i16','i12','i06'] },
  { id: 'p06', name: 'Ad Spot — Lume', client: 'Lume Skincare', status: 'active', shoot: 'Nov 22', location: 'Studio 2', items: ['i05','i15','i17','i12','i12','i14','i13','i16','i06','i06'] },
];

window.GEAR_CATEGORIES = ['All','Camera','Lens','Lighting','Audio','Monitor','Storage','Rigging','Cinema'];

// Inline-SVG placeholder per category. Built as plain strings (no encoding)
// then base64'd for the data: URL — keeps category icons crisp at any size.
window.GEAR_PLACEHOLDER = (category) => {
  const C = '#191919', A = '#FF570C', BG = '#e8e2d8';
  const svgs = {
    Camera: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='${BG}'/><g fill='none' stroke='${C}' stroke-width='2'><rect x='18' y='34' width='64' height='40' rx='3'/><circle cx='50' cy='54' r='13'/><circle cx='50' cy='54' r='7'/><rect x='38' y='28' width='24' height='8' rx='1'/></g><circle cx='72' cy='42' r='2.2' fill='${A}'/></svg>`,
    Lens: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='${BG}'/><g fill='none' stroke='${C}' stroke-width='2'><rect x='30' y='22' width='40' height='56' rx='2'/><circle cx='50' cy='50' r='14'/><circle cx='50' cy='50' r='8'/><line x1='30' y1='34' x2='70' y2='34'/><line x1='30' y1='66' x2='70' y2='66'/></g></svg>`,
    Lighting: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='${BG}'/><g fill='none' stroke='${C}' stroke-width='2'><polygon points='30,30 70,30 78,55 22,55'/><line x1='50' y1='55' x2='50' y2='80'/><line x1='40' y1='80' x2='60' y2='80'/><line x1='40' y1='42' x2='60' y2='42'/></g></svg>`,
    Audio: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='${BG}'/><g fill='none' stroke='${C}' stroke-width='2'><rect x='42' y='18' width='16' height='48' rx='8'/><path d='M30 50 a20 20 0 0 0 40 0'/><line x1='50' y1='70' x2='50' y2='84'/><line x1='40' y1='84' x2='60' y2='84'/></g></svg>`,
    Monitor: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='${BG}'/><g fill='none' stroke='${C}' stroke-width='2'><rect x='14' y='26' width='72' height='48' rx='3'/><rect x='22' y='34' width='56' height='32'/></g><circle cx='80' cy='32' r='1.6' fill='${A}'/></svg>`,
    Storage: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='${BG}'/><g fill='none' stroke='${C}' stroke-width='2'><rect x='22' y='28' width='56' height='44' rx='2'/><line x1='22' y1='44' x2='78' y2='44'/><line x1='22' y1='58' x2='78' y2='58'/></g><circle cx='70' cy='36' r='2' fill='${A}'/></svg>`,
    Rigging: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='${BG}'/><g fill='none' stroke='${C}' stroke-width='2'><rect x='26' y='38' width='48' height='30' rx='2'/><line x1='38' y1='38' x2='38' y2='28'/><line x1='62' y1='38' x2='62' y2='28'/><circle cx='50' cy='53' r='8'/></g></svg>`,
    Cinema: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='${BG}'/><g fill='none' stroke='${C}' stroke-width='2'><rect x='18' y='34' width='52' height='38' rx='2'/><circle cx='44' cy='53' r='12'/><rect x='70' y='42' width='14' height='22'/><rect x='30' y='28' width='16' height='6'/></g></svg>`,
  };
  const svg = svgs[category] || svgs.Camera;
  return 'data:image/svg+xml;base64,' + btoa(svg);
};
