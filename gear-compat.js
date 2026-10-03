// Gear · Compatibility engine
// ------------------------------------------------------------------
// Decides whether the items in a kit actually work together. The AI on the
// Suggest page only *proposes* kits — this file has the final say.
//
// Every item is resolved to a spec: a role (body, lens, battery, …) plus the
// interfaces it provides or needs. Specs come from, in priority order:
//   1. item.specs            — a future `specs jsonb` column on `equipment`
//   2. curated tables below  — camera bodies, gimbals, monitors
//   3. the product name      — "Sigma 85mm T1.5 FF – Sony E Mount" etc.
// Anything that can't be resolved is reported as "unverified", never as OK.
//
// checkKit() then runs every rule over the kit:
//   mount        lens ↔ body, directly, via an adapter in the kit, or by a
//                mount swap; otherwise names the adapter that's needed
//   coverage     lens image circle vs sensor size (crop-mode conditions)
//   power        body battery type vs batteries / plates in the kit
//   media        body card slots vs cards in the kit
//   payload      gimbal capacity vs heaviest body + lens (estimated)
//   signal       monitor inputs vs camera outputs (SDI / HDMI, converters)
//   audio        XLR mics need an XLR input with phantom power
//   lock-in      cages, plates, monitors made for one camera family
//   overrides    hand-entered known-good / known-bad pairs
//
// Exposes window.GEAR_COMPAT = { specOf, describe, checkKit, findFixes,
// assembleKit, buildCandidatePool }.
(function () {
  // ── Vocabulary ────────────────────────────────────────────────────────────
  const SENSOR_RANK = { '2/3': 0, 'MFT': 1, 'S35': 2, 'FF': 3, 'LF': 4, 'MF': 5 };
  const SENSOR_LABEL = { '2/3': '2/3"', 'MFT': 'Micro 4/3', 'S35': 'S35 / APS-C', 'FF': 'full frame', 'LF': 'large format', 'MF': 'medium format' };
  const MOUNT_LABEL = { 'EF': 'Canon EF', 'EF-S': 'Canon EF-S', 'EF-M': 'Canon EF-M', 'RF': 'Canon RF', 'RF-S': 'Canon RF-S', 'E': 'Sony E', 'Z': 'Nikon Z', 'F': 'Nikon F', 'L': 'L-Mount', 'X': 'Fujifilm X', 'G': 'Fujifilm G', 'MFT': 'Micro 4/3', 'PL': 'PL', 'LPL': 'LPL', 'B4': 'B4', 'DL': 'DJI DL', 'M': 'Leica M', 'fixed': 'built-in lens' };
  const BATTERY_LABEL = { 'NP-FZ100': 'Sony NP-FZ100', 'NP-FW50': 'Sony NP-FW50', 'NP-F': 'Sony NP-F (L-series)', 'BP-U': 'Sony BP-U', 'LP-E6': 'Canon LP-E6', 'LP-E17': 'Canon LP-E17', 'LP-E10': 'Canon LP-E10', 'BP-A': 'Canon BP-A', 'BP-9': 'Canon BP-9xx', 'EN-EL15': 'Nikon EN-EL15', 'EN-EL18': 'Nikon EN-EL18', 'EN-EL25': 'Nikon EN-EL25', 'BLJ31': 'Panasonic DMW-BLJ31', 'BLK22': 'Panasonic DMW-BLK22', 'BLF19': 'Panasonic DMW-BLF19', 'NP-W126': 'Fujifilm NP-W126', 'NP-W235': 'Fujifilm NP-W235', 'MICRO-V': 'Micro V-Lock', 'V-MOUNT': 'V-Mount', 'GOLD': 'Gold Mount', 'B-MOUNT': 'B-Mount', 'TB50': 'DJI TB50' };
  const MEDIA_LABEL = { 'CFEXPRESS-B': 'CFexpress Type B', 'CFEXPRESS-A': 'CFexpress Type A', 'CFAST': 'CFast 2.0', 'XQD': 'XQD', 'SD': 'SD', 'MICROSD': 'microSD', 'CF': 'CompactFlash', 'CODEX': 'Codex Compact Drive', 'PROSSD': 'DJI PROSSD' };

  // Mount adaptations that exist as real, common adapters: lens side > body side.
  const ADAPTABLE = new Set([
    'EF>RF', 'EF>E', 'EF>L', 'EF>Z', 'EF>X', 'EF>MFT', 'EF>EF-M',
    'F>Z', 'F>E',
    'M>E', 'M>L', 'M>Z', 'M>RF', 'M>X', 'M>MFT',
    'PL>RF', 'PL>E', 'PL>L', 'PL>Z', 'PL>MFT', 'PL>X', 'PL>LPL',
  ]);

  // Known-good / known-bad pairs the specs can't express (cage clearance,
  // firmware quirks, crew experience). Each: { a: RegExp, b: RegExp,
  // verdict: 'ok' | 'conditional' | 'conflict', note: string }.
  // `a` and `b` are matched against item names; a match on both in one kit
  // overrides whatever the rules decided for that pair.
  const OVERRIDES = [];

  // ── Curated camera bodies ─────────────────────────────────────────────────
  // mounts: lens mounts the body accepts natively. sensor: largest sensor
  // mode. crop: has S35/APS-C crop modes. battery / media: accepted types.
  // out: video outputs — only listed where known; null = unknown, so the
  // signal check reports "unverified" rather than guessing. xlr: built-in XLR
  // input with phantom power. kg: body only, approximate.
  const B = (key, label, brand, re, p) => ({ key, label, brand, re, ...p });
  const BODIES = [
    // Sony
    B('fx30', 'Sony FX30', /sony|ilme/i, /\bfx\s?30\b/i, { mounts: ['E'], sensor: 'S35', battery: ['NP-FZ100'], media: ['CFEXPRESS-A', 'SD'], out: ['hdmi'], kg: 0.56 }),
    B('fx3', 'Sony FX3', /sony|ilme/i, /\bfx\s?3a?\b/i, { mounts: ['E'], sensor: 'FF', crop: true, battery: ['NP-FZ100'], media: ['CFEXPRESS-A', 'SD'], out: ['hdmi'], xlr: true, kg: 0.64 }),
    B('fx2', 'Sony FX2', /sony|ilme/i, /\bfx\s?2\b/i, { mounts: ['E'], sensor: 'FF', crop: true, battery: ['NP-FZ100'], media: ['CFEXPRESS-A', 'SD'], out: ['hdmi'] }),
    B('fx6', 'Sony FX6', /sony|ilme/i, /\bfx\s?6\b/i, { mounts: ['E'], sensor: 'FF', crop: true, battery: ['BP-U'], media: ['CFEXPRESS-A', 'SD'], out: ['sdi', 'hdmi'], xlr: true, kg: 0.89 }),
    B('fx9', 'Sony FX9', /sony|pxw/i, /\bfx\s?9\b/i, { mounts: ['E'], sensor: 'FF', crop: true, battery: ['BP-U'], media: ['XQD'], out: ['sdi', 'hdmi'], xlr: true, kg: 2.0 }),
    B('burano', 'Sony Burano', /sony/i, /\bburano\b/i, { mounts: ['PL', 'E'], sensor: 'FF', crop: true, xlr: true }),
    B('venice', 'Sony Venice', /sony/i, /\bvenice\b/i, { mounts: ['PL'], sensor: 'FF', crop: true }),
    B('a7s3', 'Sony A7S III', /sony|alpha|ilce/i, /\b(?:a|alpha\s?|ilce-?)7\s?s\s?(?:iii|3|m3|mark\s?iii)\b/i, { mounts: ['E'], sensor: 'FF', crop: true, battery: ['NP-FZ100'], media: ['CFEXPRESS-A', 'SD'], out: ['hdmi'], kg: 0.70 }),
    B('a7s2', 'Sony A7S II', /sony|alpha|ilce/i, /\b(?:a|alpha\s?|ilce-?)7\s?s\s?(?:ii|2|m2|mark\s?ii)\b/i, { mounts: ['E'], sensor: 'FF', crop: true, battery: ['NP-FW50'], media: ['SD'], out: ['hdmi'], kg: 0.63 }),
    B('a7r5', 'Sony A7R V', /sony|alpha|ilce/i, /\b(?:a|alpha\s?|ilce-?)7\s?r\s?(?:v|5|m5|mark\s?v)\b/i, { mounts: ['E'], sensor: 'FF', crop: true, battery: ['NP-FZ100'], media: ['CFEXPRESS-A', 'SD'], out: ['hdmi'], kg: 0.72 }),
    B('a7r', 'Sony A7R III / IV', /sony|alpha|ilce/i, /\b(?:a|alpha\s?|ilce-?)7\s?r\s?(?:iv|4|m4|iii|3|m3|mark\s?(?:iv|iii))a?\b/i, { mounts: ['E'], sensor: 'FF', crop: true, battery: ['NP-FZ100'], media: ['SD'], out: ['hdmi'], kg: 0.67 }),
    B('a7-5', 'Sony A7 V', /sony|alpha|ilce/i, /\b(?:a|alpha\s?|ilce-?)7\s?(?:v|5|m5|mark\s?v)\b/i, { mounts: ['E'], sensor: 'FF', crop: true, battery: ['NP-FZ100'], out: ['hdmi'] }),
    B('a7-4', 'Sony A7 IV', /sony|alpha|ilce/i, /\b(?:a|alpha\s?|ilce-?)7\s?(?:iv|4|m4|mark\s?iv)\b/i, { mounts: ['E'], sensor: 'FF', crop: true, battery: ['NP-FZ100'], media: ['CFEXPRESS-A', 'SD'], out: ['hdmi'], kg: 0.66 }),
    B('a7-3', 'Sony A7 III', /sony|alpha|ilce/i, /\b(?:a|alpha\s?|ilce-?)7\s?(?:iii|3|m3|mark\s?iii)\b/i, { mounts: ['E'], sensor: 'FF', crop: true, battery: ['NP-FZ100'], media: ['SD'], out: ['hdmi'], kg: 0.65 }),
    B('a7c', 'Sony A7C', /sony|alpha|ilce/i, /\b(?:a|alpha\s?|ilce-?)7\s?c(?:r|\s?ii|2)?\b/i, { mounts: ['E'], sensor: 'FF', crop: true, battery: ['NP-FZ100'], media: ['SD'], out: ['hdmi'], kg: 0.51 }),
    B('a1', 'Sony A1', /sony/i, /\b(?:a|alpha\s?|ilce-?)1(?:\s?ii)?\b/i, { mounts: ['E'], sensor: 'FF', crop: true, battery: ['NP-FZ100'], media: ['CFEXPRESS-A', 'SD'], out: ['hdmi'], kg: 0.74 }),
    B('a6x00fz', 'Sony A6600 / A6700', /sony|alpha|ilce/i, /\b(?:a|alpha\s?|ilce-?)6[67]00\b/i, { mounts: ['E'], sensor: 'S35', battery: ['NP-FZ100'], media: ['SD'], out: ['hdmi'], kg: 0.50 }),
    B('a6x00fw', 'Sony A6100 / A6400', /sony|alpha|ilce/i, /\b(?:a|alpha\s?|ilce-?)6[14]00\b/i, { mounts: ['E'], sensor: 'S35', battery: ['NP-FW50'], media: ['SD'], out: ['hdmi'], kg: 0.40 }),
    B('zve1', 'Sony ZV-E1', /sony/i, /\bzv-?e1\b/i, { mounts: ['E'], sensor: 'FF', crop: true, battery: ['NP-FZ100'], media: ['SD'], out: ['hdmi'], kg: 0.48 }),
    B('zve10', 'Sony ZV-E10', /sony/i, /\bzv-?e10\b/i, { mounts: ['E'], sensor: 'S35', battery: ['NP-FW50'], media: ['SD'], out: ['hdmi'], kg: 0.34 }),
    // Canon
    B('c50', 'Canon EOS C50', /canon|eos/i, /\bc50\b/i, { mounts: ['RF'], sensor: 'FF', crop: true }),
    B('c200', 'Canon EOS C200', /canon|eos/i, /\bc200\b/i, { mounts: ['EF'], sensor: 'S35', battery: ['BP-A'], media: ['CFAST', 'SD'], out: ['sdi', 'hdmi'], xlr: true, kg: 1.43 }),
    B('c70', 'Canon EOS C70', /canon|eos/i, /\bc70\b/i, { mounts: ['RF'], sensor: 'S35', battery: ['BP-A'], media: ['SD'], out: ['hdmi'], xlr: true, kg: 1.17 }),
    B('c80', 'Canon EOS C80', /canon|eos/i, /\bc80\b/i, { mounts: ['RF'], sensor: 'FF', crop: true, battery: ['BP-A'], xlr: true }),
    B('c400', 'Canon EOS C400', /canon|eos/i, /\bc400\b/i, { mounts: ['RF'], sensor: 'FF', crop: true, battery: ['BP-A'], xlr: true }),
    B('c300-3', 'Canon C300 Mark III', /canon|eos/i, /\bc300\s?(?:mark|mk)?\s?(?:iii|3)\b/i, { mounts: ['EF'], sensor: 'S35', battery: ['BP-A'], media: ['CFEXPRESS-B'], xlr: true, kg: 1.75 }),
    B('c500-2', 'Canon C500 Mark II', /canon|eos/i, /\bc500\s?(?:mark|mk)?\s?(?:ii|2)\b/i, { mounts: ['EF'], sensor: 'FF', crop: true, battery: ['BP-A'], media: ['CFEXPRESS-B'], xlr: true, kg: 1.75 }),
    B('r5', 'Canon EOS R5', /canon|eos/i, /\br5(?:\s?c)?(?:\s?(?:mark|mk)?\s?(?:ii|2))?\b/i, { mounts: ['RF'], sensor: 'FF', crop: true, battery: ['LP-E6'], media: ['CFEXPRESS-B', 'SD'], out: ['hdmi'], kg: 0.74 }),
    B('r6', 'Canon EOS R6', /canon|eos/i, /\br6\b/i, { mounts: ['RF'], sensor: 'FF', crop: true, battery: ['LP-E6'], media: ['SD'], out: ['hdmi'], kg: 0.68 }),
    B('r8', 'Canon EOS R8', /canon|eos/i, /\br8\b/i, { mounts: ['RF'], sensor: 'FF', crop: true, battery: ['LP-E17'], media: ['SD'], out: ['hdmi'], kg: 0.46 }),
    B('rp', 'Canon EOS RP', /canon|eos/i, /\beos\s?rp\b/i, { mounts: ['RF'], sensor: 'FF', crop: true, battery: ['LP-E17'], media: ['SD'], out: ['hdmi'], kg: 0.49 }),
    B('r7', 'Canon EOS R7', /canon|eos/i, /\br7\b/i, { mounts: ['RF'], sensor: 'S35', battery: ['LP-E6'], media: ['SD'], out: ['hdmi'], kg: 0.61 }),
    B('r10', 'Canon EOS R10 / R50 / R100', /canon|eos/i, /\br(?:10|50|100)\b/i, { mounts: ['RF'], sensor: 'S35', battery: ['LP-E17'], media: ['SD'], out: ['hdmi'], kg: 0.40 }),
    B('eosr', 'Canon EOS R', /canon|eos/i, /\beos\s?r\b(?![\w-])/i, { mounts: ['RF'], sensor: 'FF', crop: true, battery: ['LP-E6'], media: ['SD'], out: ['hdmi'], kg: 0.66 }),
    B('5d', 'Canon EOS 5D', /canon|eos/i, /\b5d\b/i, { mounts: ['EF'], sensor: 'FF', battery: ['LP-E6'], media: ['CF', 'SD'], out: ['hdmi'], kg: 0.89 }),
    B('6d', 'Canon EOS 6D', /canon|eos/i, /\b6d\b/i, { mounts: ['EF'], sensor: 'FF', battery: ['LP-E6'], media: ['SD'], out: ['hdmi'], kg: 0.77 }),
    B('x0d', 'Canon EOS 70D / 80D / 90D', /canon|eos/i, /\b[789]0d\b/i, { mounts: ['EF'], sensor: 'S35', battery: ['LP-E6'], media: ['SD'], out: ['hdmi'], kg: 0.70 }),
    B('rebel-e10', 'Canon Rebel T6 / T7', /canon|eos/i, /\bt[67]\b(?!i)|\b(?:1300|2000|4000)d\b/i, { mounts: ['EF'], sensor: 'S35', battery: ['LP-E10'], media: ['SD'], out: ['hdmi'], kg: 0.475 }),
    B('rebel-e17', 'Canon Rebel (LP-E17)', /canon|eos/i, /\bt[78]i\b|\bsl[23]\b|\b(?:800|850|200|250)d\b/i, { mounts: ['EF'], sensor: 'S35', battery: ['LP-E17'], media: ['SD'], out: ['hdmi'], kg: 0.50 }),
    // Nikon
    B('zr', 'Nikon ZR', /nikon/i, /\bzr\b/i, { mounts: ['Z'], sensor: 'FF', crop: true }),
    B('z8', 'Nikon Z8', /nikon/i, /\bz\s?8\b/i, { mounts: ['Z'], sensor: 'FF', crop: true, battery: ['EN-EL15'], media: ['CFEXPRESS-B', 'SD'], out: ['hdmi'], kg: 0.91 }),
    B('z9', 'Nikon Z9', /nikon/i, /\bz\s?9\b/i, { mounts: ['Z'], sensor: 'FF', crop: true, battery: ['EN-EL18'], media: ['CFEXPRESS-B'], out: ['hdmi'], kg: 1.34 }),
    B('z67-2', 'Nikon Z6 / Z7 II–III', /nikon/i, /\bz\s?[67]\s?(?:ii|iii|2|3)\b/i, { mounts: ['Z'], sensor: 'FF', crop: true, battery: ['EN-EL15'], media: ['CFEXPRESS-B', 'XQD', 'SD'], out: ['hdmi'], kg: 0.72 }),
    B('z67', 'Nikon Z6 / Z7', /nikon/i, /\bz\s?[67]\b/i, { mounts: ['Z'], sensor: 'FF', crop: true, battery: ['EN-EL15'], media: ['CFEXPRESS-B', 'XQD'], out: ['hdmi'], kg: 0.675 }),
    B('z5', 'Nikon Z5 / Zf', /nikon/i, /\bz\s?(?:5|f)\b/i, { mounts: ['Z'], sensor: 'FF', crop: true, battery: ['EN-EL15'], media: ['SD'], out: ['hdmi'], kg: 0.69 }),
    B('zdx', 'Nikon Z50 / Z30 / Zfc', /nikon/i, /\bz\s?(?:50|30|fc)\b/i, { mounts: ['Z'], sensor: 'S35', battery: ['EN-EL25'], media: ['SD'], out: ['hdmi'], kg: 0.43 }),
    B('dslr-ff', 'Nikon D850 / D780 / D750', /nikon/i, /\bd(?:850|780|750|810)\b/i, { mounts: ['F'], sensor: 'FF', crop: true, battery: ['EN-EL15'], media: ['XQD', 'SD'], out: ['hdmi'], kg: 0.85 }),
    // Panasonic
    B('s1', 'Panasonic S1 / S1R / S1H', /panasonic|lumix/i, /\bs1[rh]?(?:\s?iie?|m2e?)?\b/i, { mounts: ['L'], sensor: 'FF', crop: true, battery: ['BLJ31'], media: ['XQD', 'CFEXPRESS-B', 'SD'], out: ['hdmi'], kg: 1.02 }),
    B('s5', 'Panasonic S5 / S5 II', /panasonic|lumix/i, /\bs5(?:\s?(?:ii|m2)x?)?\b/i, { mounts: ['L'], sensor: 'FF', crop: true, battery: ['BLK22'], media: ['SD'], out: ['hdmi'], kg: 0.74 }),
    B('s9', 'Panasonic S9', /panasonic|lumix/i, /\bs9\b/i, { mounts: ['L'], sensor: 'FF', crop: true, battery: ['BLK22'], media: ['SD'], out: ['hdmi'], kg: 0.49 }),
    B('bs1h', 'Panasonic BS1H', /panasonic|lumix/i, /\bbs1h\b/i, { mounts: ['L'], sensor: 'FF', crop: true, media: ['SD'], out: ['sdi', 'hdmi'], kg: 0.59 }),
    B('bgh1', 'Panasonic BGH1', /panasonic|lumix/i, /\bbgh1\b/i, { mounts: ['MFT'], sensor: 'MFT', media: ['SD'], out: ['sdi', 'hdmi'], kg: 0.55 }),
    B('gh67', 'Panasonic GH6 / GH7', /panasonic|lumix/i, /\bgh[67]l?\b/i, { mounts: ['MFT'], sensor: 'MFT', battery: ['BLK22'], media: ['CFEXPRESS-B', 'SD'], out: ['hdmi'], kg: 0.81 }),
    B('gh5', 'Panasonic GH5 / GH5S', /panasonic|lumix/i, /\bgh5(?:s|\s?(?:ii|m2))?\b/i, { mounts: ['MFT'], sensor: 'MFT', battery: ['BLF19'], media: ['SD'], out: ['hdmi'], kg: 0.69 }),
    B('g9-2', 'Panasonic G9 II', /panasonic|lumix/i, /\bg9\s?(?:ii|m2)\b/i, { mounts: ['MFT'], sensor: 'MFT', battery: ['BLK22'], media: ['SD'], out: ['hdmi'], kg: 0.66 }),
    B('g9', 'Panasonic G9', /panasonic|lumix/i, /\bg9\b/i, { mounts: ['MFT'], sensor: 'MFT', battery: ['BLF19'], media: ['SD'], out: ['hdmi'], kg: 0.66 }),
    // Fujifilm
    B('xh2', 'Fujifilm X-H2 / X-H2S', /fuji/i, /\bx-?h2s?\b/i, { mounts: ['X'], sensor: 'S35', battery: ['NP-W235'], media: ['CFEXPRESS-B', 'SD'], out: ['hdmi'], kg: 0.66 }),
    B('xw235', 'Fujifilm X-T4 / X-T5 / X-S20', /fuji/i, /\bx-?(?:t4|t5|s20)\b/i, { mounts: ['X'], sensor: 'S35', battery: ['NP-W235'], media: ['SD'], out: ['hdmi'], kg: 0.58 }),
    B('xw126', 'Fujifilm X (NP-W126)', /fuji/i, /\bx-?(?:t[23]0?|pro[23]|s10|e[34])\b/i, { mounts: ['X'], sensor: 'S35', battery: ['NP-W126'], media: ['SD'], out: ['hdmi'], kg: 0.50 }),
    B('gfx', 'Fujifilm GFX', /fuji/i, /\bgfx\s?\d/i, { mounts: ['G'], sensor: 'MF' }),
    // Blackmagic
    B('bmpcc4k', 'Blackmagic Pocket 4K', /blackmagic|bmpcc/i, /\bpocket\b.*\b4k\b|\bbmpcc\s?4k\b/i, { mounts: ['MFT'], sensor: 'MFT', battery: ['LP-E6'], media: ['CFAST', 'SD'], out: ['hdmi'], xlr: true, kg: 0.72 }),
    B('bmpcc6kg2', 'Blackmagic Pocket 6K G2 / Pro', /blackmagic|bmpcc/i, /\b(?:pocket\b.*|bmpcc\s?)6k\s?(?:g2|pro)\b/i, { mounts: ['EF'], sensor: 'S35', battery: ['NP-F'], media: ['CFAST', 'SD'], out: ['hdmi'], xlr: true, kg: 1.24 }),
    B('bmpcc6k', 'Blackmagic Pocket 6K', /blackmagic|bmpcc/i, /\b(?:pocket\b.*|bmpcc\s?)6k\b/i, { mounts: ['EF'], sensor: 'S35', battery: ['LP-E6'], media: ['CFAST', 'SD'], out: ['hdmi'], xlr: true, kg: 0.90 }),
    B('bmcc6k', 'Blackmagic Cinema Camera 6K', /blackmagic/i, /blackmagic\s?(?:design\s?)?cinema\s?camera\s?6k/i, { mounts: ['L'], sensor: 'FF', crop: true, battery: ['BP-U'], media: ['CFEXPRESS-B'], xlr: true }),
    B('ursa-bc', 'Blackmagic URSA Broadcast', /blackmagic/i, /ursa\s?broadcast/i, { mounts: ['B4'], sensor: '2/3', out: ['sdi'], xlr: true }),
    B('ursa', 'Blackmagic URSA', /blackmagic/i, /\bursa\b/i, { sensor: 'S35', out: ['sdi'], xlr: true }),
    B('pyxis', 'Blackmagic PYXIS 6K', /blackmagic/i, /\bpyxis\b/i, { sensor: 'FF', crop: true }),
    // RED
    B('komodox', 'RED Komodo-X', /red\b/i, /komodo-?\s?x\b/i, { mounts: ['RF'], sensor: 'S35', battery: ['MICRO-V'], media: ['CFEXPRESS-B'], out: ['sdi'], kg: 1.28 }),
    B('komodo', 'RED Komodo', /red\b/i, /\bkomodo\b/i, { mounts: ['RF'], sensor: 'S35', battery: ['BP-9'], media: ['CFAST'], out: ['sdi'], kg: 0.95 }),
    B('vraptor', 'RED V-Raptor', /red\b/i, /v-?\s?raptor/i, { mounts: ['RF'], crop: true, battery: ['MICRO-V'], media: ['CFEXPRESS-B'], out: ['sdi'], kg: 1.83 }),
    // ARRI
    B('minilf', 'ARRI Alexa Mini LF', /arri|alexa/i, /alexa\s?mini\s?lf/i, { mounts: ['LPL'], sensor: 'LF', crop: true, media: ['CODEX'], out: ['sdi'], kg: 2.6 }),
    B('alexa35', 'ARRI Alexa 35', /arri|alexa/i, /alexa\s?35/i, { mounts: ['LPL'], sensor: 'S35', media: ['CODEX'], out: ['sdi'], kg: 2.9 }),
    B('alexalf', 'ARRI Alexa LF', /arri|alexa/i, /alexa\s?lf/i, { mounts: ['LPL'], sensor: 'LF', crop: true, media: ['CODEX'], out: ['sdi'] }),
    B('alexamini', 'ARRI Alexa Mini', /arri|alexa/i, /alexa\s?mini\b/i, { mounts: ['PL'], sensor: 'S35', media: ['CFAST'], out: ['sdi'], kg: 2.3 }),
    B('amira', 'ARRI Amira', /arri/i, /\bamira\b/i, { mounts: ['PL'], sensor: 'S35', media: ['CFAST'], out: ['sdi'] }),
    // DJI
    B('ronin4d', 'DJI Ronin 4D', /dji|ronin/i, /ronin\s?4d/i, { mounts: ['DL'], sensor: 'FF', crop: true, battery: ['TB50'], media: ['PROSSD', 'CFEXPRESS-B'] }),
  ];

  // Gimbal payloads (kg), manufacturer-tested figures.
  const GIMBALS = [
    [/\brs\s?[234]\s?mini\b/i, 2.0],
    [/\brs\s?[234]\s?pro\b/i, 4.5],
    [/\brsc\s?2\b/i, 3.0],
    [/\brs\s?2\b/i, 4.5],
    [/\brs\s?[34]\b/i, 3.0],
    [/\bronin[- ]?sc\b/i, 2.0],
    [/\bronin[- ]?s\b(?!c)/i, 3.6],
    [/\bronin\s?2\b/i, 13.6],
  ];

  // Cine lens lines whose names don't state the mount: [re, mount, coverage].
  const LENS_FAMILIES = [
    [/arri\s?signature\s?(?:prime|zoom)/i, 'LPL', 'LF'],
    [/arri\s?(?:master|ultra)\s?prime|cooke\s?s4/i, 'PL', 'S35'],
  ];

  // Monitor inputs for models whose names don't say.
  const MONITORS = [
    [/smallhd\s?(?:cine|indie|ultra|702|703)/i, ['sdi', 'hdmi']],
    [/smallhd\s?focus/i, ['hdmi']],
    [/atomos\s?(?:shogun|sumo)/i, ['sdi', 'hdmi']],
    [/atomos\s?(?:ninja|shinobi)/i, ['hdmi']],
  ];

  // ── Name parsing ──────────────────────────────────────────────────────────
  const MOUNT_TOKENS = [
    [/^lpl$/i, 'LPL'], [/^pl(?:[- ]?mount)?$/i, 'PL'],
    [/^(?:canon\s?)?rf-s$/i, 'RF-S'], [/^(?:canon\s?)?rf(?:[- ]?mount)?$/i, 'RF'],
    [/^(?:canon\s?)?ef-s$/i, 'EF-S'], [/^(?:canon\s?)?ef-m$/i, 'EF-M'], [/^(?:canon\s?)?ef(?:[- ]?mount)?$|^canon\s?mount$/i, 'EF'],
    [/^sony\s?(?:fe|e)(?:[- ]?mount)?$|^fe$|^e[- ]?mount$|^sony\s?mount$/i, 'E'],
    [/^(?:nikon|nikkor)\s?z(?:[- ]?mount)?$|^z[- ]?mount$/i, 'Z'], [/^nikon\s?f$|^f[- ]?mount$/i, 'F'],
    [/^l[- ]?mount$|^leica\s?l$|^lumix\s?s$/i, 'L'],
    [/^fuji(?:film)?\s?x(?:[- ]?mount)?$|^x[- ]?mount$|^xf$|^xc$/i, 'X'],
    [/^gfx$|^g[- ]?mount$|^fuj(?:i)?film\s?g$/i, 'G'],
    [/^canon\s?m[- ]?mount$/i, 'EF-M'], [/^leica\s?m$|^m[- ]?mount$/i, 'M'],
    [/^mft$|^m4\/3$|^micro\s?four\s?thirds$|^lumix\s?g$|^m\.\s?zuiko$/i, 'MFT'],
    [/^b4$/i, 'B4'], [/^dl[- ]?mount$/i, 'DL'],
  ];
  const MOUNT_SCAN = /\b(LPL|PL(?:[- ]?mount)?|(?:Canon\s?)?RF-S|(?:Canon\s?)?RF(?!-S)(?:[- ]?mount)?|(?:Canon\s?)?EF-[SM]|(?:Canon\s?)?EF(?!-[SM])(?:[- ]?mount)?|Canon\s?Mount|Sony\s?(?:FE|E)(?:[- ]?mount)?|FE|E[- ]?mount|Sony\s?Mount|(?:Nikon|Nikkor)\s?Z(?:[- ]?mount)?|Z[- ]?mount|Nikon\s?F|F[- ]?mount|L[- ]?mount|Leica\s?L|Lumix\s?S|Fuji(?:film)?\s?X(?:[- ]?mount)?|X[- ]?mount|XF|XC|GFX|G[- ]?mount|Fuj(?:i)?film\s?G|Canon\s?M[- ]?mount|Leica\s?M|M[- ]?mount|MFT|M4\/3|Micro\s?Four\s?Thirds|Lumix\s?G|M\.\s?Zuiko|B4|DL[- ]?mount)\b/gi;

  function parseMounts(name) {
    const out = [];
    for (const m of String(name).matchAll(MOUNT_SCAN)) {
      const tok = m[1];
      const hit = MOUNT_TOKENS.find(([re]) => re.test(tok));
      if (hit && !out.includes(hit[1])) out.push(hit[1]);
    }
    return out;
  }

  function parseCoverage(name, mount) {
    if (/\b(?:LF|VV|large\s?format)\b/i.test(name)) return 'LF';
    if (/\b(?:FF|full[- ]?frame|DG)\b/i.test(name)) return 'FF';
    if (/\b(?:S35|super\s?35|APS-?C|DX|DC|DT)\b/i.test(name)) return 'S35';
    if (mount === 'EF-S' || mount === 'RF-S' || mount === 'X' || mount === 'EF-M') return 'S35';
    if (mount === 'MFT') return 'MFT';
    if (mount === 'B4') return '2/3';
    if (mount === 'G') return 'MF';
    if (mount === 'RF' || mount === 'EF' || mount === 'F' || mount === 'L' || mount === 'M') return 'FF';
    if (mount === 'Z') return /\bDX\b/.test(name) ? 'S35' : 'FF';
    if (mount === 'E' && /\bFE\b/.test(name)) return 'FF';
    return null;
  }

  const BATTERY_SCAN = [
    [/NP-?FZ100/i, 'NP-FZ100'], [/NP-?FW50/i, 'NP-FW50'], [/NP-?F(?:5[57]0|7[57]0|9[5-8]0)\b|\bNP-F\b|\bL-series\b/i, 'NP-F'],
    [/BP-?U\d+|BP-?\d{2,3}U\b|\bBP-U\b/i, 'BP-U'], [/LP-?E6(?:N|NH|P)?\b/i, 'LP-E6'], [/LP-?E17/i, 'LP-E17'], [/LP-?E10/i, 'LP-E10'],
    [/BP-?A\d+/i, 'BP-A'], [/BP-?9[1-9]\d|redvolt\s?bp\b/i, 'BP-9'], [/EN-?EL15/i, 'EN-EL15'], [/EN-?EL18/i, 'EN-EL18'], [/EN-?EL25/i, 'EN-EL25'],
    [/BLJ31/i, 'BLJ31'], [/BLK22/i, 'BLK22'], [/BLF19/i, 'BLF19'], [/NP-?W126/i, 'NP-W126'], [/NP-?W235/i, 'NP-W235'],
    [/micro\s?v[- ]?(?:lock|mount)/i, 'MICRO-V'], [/(?<!micro[\s-]?)\bV[- ]?(?:mount|lock|lok)\b/i, 'V-MOUNT'], [/gold[- ]?mount|anton\s?bauer|\bAB[- ]mount/i, 'GOLD'],
    [/\bB[- ]?mount\b/i, 'B-MOUNT'], [/\bTB50\b/i, 'TB50'],
  ];
  const MEDIA_SCAN = [
    [/CFexpress\s?(?:type\s?)?B|\bCFE-?B\b/i, 'CFEXPRESS-B'], [/CFexpress\s?(?:type\s?)?A|\bCFE-?A\b/i, 'CFEXPRESS-A'],
    [/\bCFast/i, 'CFAST'], [/\bXQD\b/i, 'XQD'], [/micro\s?SD/i, 'MICROSD'], [/\bSD(?:XC|HC)?\b|\bSD\s?card/i, 'SD'],
    [/codex\s?compact/i, 'CODEX'], [/\bPROSSD\b/i, 'PROSSD'], [/\bCompactFlash\b/i, 'CF'],
  ];
  const scanAll = (table, name) => table.filter(([re]) => re.test(name)).map(([, v]) => v);

  // Words that mark a listing as an accessory *for* a camera rather than the
  // camera itself. Applied to the name with any "with …" clause removed, so
  // "FX2 Cinema Camera With XLR Handle" still reads as a body.
  const ACCESSORY = /\b(?:cage|half[- ]cage|monitor|battery|batteries|charger|grip|plate|baseplate|case|bag|strap|protector|cable|adapter|remote|cap|dummy|rig|bracket|l-bracket|handle|dovetail|shoulder|mount\s?kit|screen|hood|filter|replacement|skin|cover|housing|lens\s?mount|lemo|\d-?pin|a-box|ssd\s?mount|kit\s?for|mod(?:ification)?\s?kit|loupe|eye\s?piece|sunhood|slide|transmitter|receiver|backpack)\b/i;
  const FIXED_LENS = /camcorder|\bptz\b|document\s?cam|box\s?cam|action\s?cam|gopro|osmo\s?(?:pocket|action)|insta360|vlog(?:ging)?\s?camera|webcam|\bx100|ricoh\s?gr|compact\s?camera|powershot|cyber-?shot|\brx100|\bzv-1\b|vixia/i;

  function matchBody(name) {
    for (const b of BODIES) if (b.re.test(name) && b.brand.test(name)) return b;
    return null;
  }
  function bodyFamilies(name) {
    return BODIES.filter(b => b.re.test(name) && b.brand.test(name)).map(b => b.key);
  }

  // ── Spec resolution ───────────────────────────────────────────────────────
  const cache = new Map();
  function specOf(item) {
    if (!item) return { role: 'other', source: 'none' };
    const key = item.id + '|' + item.name;
    if (cache.has(key)) return cache.get(key);
    const s = item.specs && typeof item.specs === 'object'
      ? { source: 'database', ...item.specs }
      : inferSpec(String(item.name || ''), String(item.category || '').toLowerCase());
    cache.set(key, s);
    return s;
  }

  function inferSpec(name, cat) {
    const mounts = parseMounts(name);

    // Mount adapters: first mount named is the lens side, second the body side.
    if (/adapter|speed\s?booster|\bmc-11\b|\bftz\b|mount\s?converter/i.test(name) && cat !== 'audio') {
      let from = mounts[0], to = mounts[1];
      if (/\bmc-11\b/i.test(name)) { from = 'EF'; to = 'E'; }
      else if (/\bftz\b/i.test(name)) { from = 'F'; to = 'Z'; }
      else if (/ef-?eos\s?r\b/i.test(name)) { from = 'EF'; to = 'RF'; }
      else if (/ef-?eos\s?m\b/i.test(name)) { from = 'EF'; to = 'EF-M'; }
      if (from === 'EF-S') from = 'EF';
      if (from && to && from !== to) return { role: 'adapter', from, to, booster: /speed\s?booster|focal\s?reducer/i.test(name), source: 'name' };
    }
    // Video converters.
    const conv = name.match(/\b(sdi|hdmi)\s?(?:to|-|>)\s?(sdi|hdmi)\b/i);
    if (conv && conv[1].toLowerCase() !== conv[2].toLowerCase() && /convert/i.test(name)) {
      return { role: 'converter', from: conv[1].toLowerCase(), to: conv[2].toLowerCase(), source: 'name' };
    }
    // Power.
    const batt = scanAll(BATTERY_SCAN, name);
    if (batt.length && !/charger/i.test(name) && /plate|adapter\s?plate|battery\s?mount|camera\s?mount|battery\s?slide/i.test(name)) {
      return { role: 'battery-plate', battery: batt, locks: bodyFamilies(name), source: 'name' };
    }
    if (/charger/i.test(name)) return { role: 'charger', battery: batt, source: 'name' };
    if (/dummy|coupler|eliminator/i.test(name)) return { role: 'dc-coupler', battery: batt, source: 'name' };
    if (batt.length && (/batter|\bbatt\b|\d\s?wh\b|mah\b|redvolt/i.test(name))) return { role: 'battery', battery: batt, source: 'name' };
    // Media.
    const media = scanAll(MEDIA_SCAN, name);
    if (media.length && /reader/i.test(name)) return { role: 'reader', media, source: 'name' };
    if (media.length && /card|memory|\b\d+\s?(?:gb|tb)\b/i.test(name)) return { role: 'media', media, source: 'name' };

    // Camera bodies.
    const notLensish = cat !== 'lens' && cat !== 'audio' && cat !== 'lighting';
    if (notLensish && (cat === 'camera' || cat === 'cinema' || cat === '')) {
      if (FIXED_LENS.test(name) && !ACCESSORY.test(name.replace(/\bwith\b.*$/i, '')) && !/mount|accessor|clamp|holder|\brod\b|strap|\bfor\b|compatible|case|bag|filter|cable/i.test(name)) {
        return { role: 'body', label: name, mounts: ['fixed'], fixed: true, source: 'name' };
      }
    }
    const body = notLensish ? matchBody(name) : null;
    // "Rain Slicker for Sony FX6": a camera named after "for" is what the item fits.
    const forAt = name.search(/\b(?:for|fits|compatible\s?with)\b/i);
    const namedAfterFor = body && forAt >= 0 && name.search(body.re) > forAt;
    const accessoryWords = namedAfterFor || ACCESSORY.test(name.replace(/\bwith\b.*$/i, ''));
    if (body && !accessoryWords) {
      const s = { role: 'body', family: body.key, label: body.label, source: 'curated',
        mounts: body.mounts ? body.mounts.slice() : (mounts.length ? mounts : null),
        sensor: body.sensor || null, crop: !!body.crop, battery: body.battery || null, media: body.media || null,
        out: body.out || null, xlr: !!body.xlr || /\bxlr\b/i.test(name), kg: body.kg || null };
      // Bodies sold in several mounts name the mount ("PYXIS 6K – L-Mount").
      const bare = name.replace(/\bwith\b.*$/i, '');
      const stated = parseMounts((bare.match(/[\w-]+(?:\s[\w-]+)?[- ]mount\b/gi) || []).join(' '));
      if (stated.length) s.mounts = stated;
      else if ((!body.mounts || body.key === 'ursa' || body.key === 'pyxis') && mounts.length) s.mounts = mounts;
      if (body.key === 'pyxis' && !stated.length) { const m = bare.match(/-\s?(L|EF|PL)\s*(?:\(|$)/i); if (m) s.mounts = [m[1].toUpperCase()]; }
      if (body.key === 'komodox' && /\bZ\b/.test(bare)) s.mounts = ['Z'];
      if (body.key === 'vraptor') s.sensor = /\bS35\b/i.test(name) ? 'S35' : /\bVV\b/i.test(name) ? 'FF' : null;
      return s;
    }

    // Lenses.
    const lensName = name.replace(/\(no drop[- ]?in filter\)/i, '');
    const lensAccessory = /filter|hood|\bcap\b|case|pouch|collar|gear\s?ring|protector|clean|adapter|support|follow\s?focus|matte\s?box|wrap|cover|tripod\s?foot/i;
    const notLensThing = /microphone|\bmic\b|stand|ball\s?head|monitor|fresnel|phone|extension\s?tube|toolkit|boom|lavalier|spotlight|clip|tissue|cloth|kit\s?-|case/i;
    const looksLens = (cat === 'lens' && /\d\s?mm\b|\bT\s?\d|\/T\d|\bf\/?\d|\blens\b|\bprime\b/i.test(name)) || (/\b\d{1,3}(?:-\d{1,3})?\s?mm\b/i.test(name) && /\bf\/?\d|\bT\d(?:\.\d)?\b|\blens\b|\bprime\b/i.test(name));
    if (looksLens && !lensAccessory.test(lensName) && !notLensThing.test(lensName) && !body) {
      const fam = LENS_FAMILIES.find(([re]) => re.test(name));
      const mount = mounts[0] || (fam && fam[1]) || null;
      const cine = /\bT\s?\d(?:\.\d)?\b|\/T\d|\bcine\b/i.test(name);
      const zoom = /\b\d{1,3}\s?-\s?\d{1,3}\s?mm\b/i.test(name);
      return {
        role: 'lens', mount, altMounts: mounts.slice(1), coverage: (fam && !mounts.length && fam[2]) || parseCoverage(name, mount),
        swappable: /interchangeable/i.test(name), cine, zoom,
        kg: cine ? 1.0 : zoom ? 0.8 : 0.5, kgEstimated: true, source: 'name',
      };
    }

    // Stabilisers.
    if (/gimbal|stabili[sz]er|\bronin\b|\brsc?\s?\d/i.test(name) && !/ronin\s?4d/i.test(name) && !/plate|bracket|case|bag|battery|grip\b/i.test(name)) {
      const g = GIMBALS.find(([re]) => re.test(name));
      return { role: 'gimbal', payload: g ? g[1] : null, source: g ? 'curated' : 'name' };
    }
    // Monitors.
    if ((cat === 'monitor' || /\bmonitor\b|ninja|shogun|shinobi|smallhd/i.test(name)) && !/headphone|in-?ear|\biem\b|speaker|studio\s?monitor|audio|baby|\barm\b|mount\b|bracket|hood|cable|protector|plate|case|bag|stand|shade|cover|skin/i.test(name)) {
      const known = MONITORS.find(([re]) => re.test(name));
      const ins = [];
      if (/\bsdi\b/i.test(name)) ins.push('sdi');
      if (/\bhdmi\b/i.test(name)) ins.push('hdmi');
      const inputs = ins.length ? ins : known ? known[1] : null;
      return { role: 'monitor', inputs, locks: bodyFamilies(name), source: known || ins.length ? 'name' : 'none' };
    }
    // Audio.
    // XLR inputs. Shoe-mounted XLR adapters only work on their own maker's
    // cameras (Sony Multi Interface shoe, Panasonic hot shoe).
    if (/zoom\s?(?:f\d|h\d)|mixpre|sound\s?devices|tascam\s?(?:dr|ca-xlr)|dmw-xlr|xlr-?(?:h1|k\d)|xlr\s?(?:adapter|adaptor|handle|module|interface)|field\s?recorder/i.test(name)) {
      const brandLock = /xlr-?(?:h1|k\d)|\bsony\b/i.test(name) && !/zoom|tascam\s?dr|mixpre|sound\s?devices|recorder/i.test(name) ? 'sony'
        : /dmw-?xlr/i.test(name) ? 'panasonic' : null;
      return { role: 'xlr-input', brandLock, source: 'name' };
    }
    // XLR shotguns: named pro lines, or "shotgun" + "XLR". Camera-shoe digital
    // mics (Panasonic DMW-DMS1, Sony ECM-B) are not XLR.
    const shoeMic = /digital|hot-?shoe|multi\s?interface|\bdms1|\becm-[bgw]|videomic|on-?camera|wireless|usb/i.test(name);
    const proShotgun = /\bmkh\s?\d|\bntg\s?[1-9]\b|\bntg-?[1-9]\b|\bmke\s?600|\bcmit\b|\bme\s?66\b|\bat\s?(?:875|897)|deity\s?s-?mic|\bkms?\s?\d|\bcs-?[123]\b|\bmke\s?2\b.*xlr/i.test(name);
    if ((proShotgun || (/shotgun/i.test(name) && /\bxlr\b/i.test(name))) && !shoeMic && !/holder|shock|wind|blimp|boom\s?pole|mount\b|cable|furry|foam|case|pistol\s?grip/i.test(name)) {
      return { role: 'mic-xlr', source: 'name' };
    }
    if (/videomic|on-?camera\s?mic|wireless\s?(?:go|mic)|\bdji\s?mic|lav(?:alier)?\b/i.test(name) && cat === 'audio') {
      return { role: 'mic', source: 'name' };
    }
    // Lights & support.
    if (cat === 'lighting' && /\bled\b|light|panel|tube|fresnel|\bcob\b|\d{2,4}\s?w\b|\b\d{2,4}[dcx]\b/i.test(name) && !/stand|reflector|sandbag|diffus|softbox|modifier|gel|clamp|flag|scrim|bracket|cable|bag|case|skid|yoke|dome|lantern|barn|grid|adapter|battery|plate|reflector|fresnel\s?attachment/i.test(name)) {
      return { role: 'light', source: 'name' };
    }
    if (/tripod|fluid\s?head|monopod/i.test(name) && !/plate|bag|case|dolly|spreader|light|\bled\b|phone|selfie/i.test(name)) return { role: 'tripod', source: 'name' };

    // Anything made for specific camera bodies ("Tilta Cage for Sony FX6").
    const locks = bodyFamilies(name);
    if (locks.length) return { role: 'accessory', locks, source: 'name' };
    return { role: 'other', source: 'none' };
  }

  // Short tag string for one spec — used in the AI candidate list and the UI.
  function describe(s) {
    if (!s) return '';
    const t = [];
    switch (s.role) {
      case 'body':
        if (s.fixed) { t.push('built-in lens'); break; }
        if (s.mounts) t.push('mount=' + s.mounts.join('/'));
        if (s.sensor) t.push('sensor=' + s.sensor);
        if (s.battery) t.push('batt=' + s.battery.join('/'));
        if (s.media) t.push('media=' + s.media.join('/'));
        if (s.out) t.push('out=' + s.out.join('/'));
        if (s.xlr) t.push('xlr');
        if (s.kg) t.push('kg≈' + s.kg);
        break;
      case 'lens':
        t.push('mount=' + (s.mount || '?') + (s.swappable ? '(swappable)' : ''));
        if (s.coverage) t.push('covers=' + s.coverage);
        if (s.cine) t.push('cine');
        break;
      case 'adapter': t.push(`${s.from}>${s.to}` + (s.booster ? ' booster' : '')); break;
      case 'converter': t.push(`${s.from}>${s.to}`); break;
      case 'battery': case 'battery-plate': case 'charger': t.push('batt=' + s.battery.join('/')); break;
      case 'media': case 'reader': t.push('media=' + s.media.join('/')); break;
      case 'gimbal': t.push('payload=' + (s.payload ? s.payload + 'kg' : '?')); break;
      case 'monitor': t.push('in=' + (s.inputs ? s.inputs.join('/') : '?')); break;
      default: break;
    }
    if (s.locks && s.locks.length) t.push('fits=' + s.locks.join('/'));
    return t.join(' ');
  }

  // ── Rules ─────────────────────────────────────────────────────────────────
  const RANK = { conflict: 4, need: 3, conditional: 2, unverified: 1, ok: 0, neutral: -1 };

  // How a lens mount relates to one body: direct / via adapter in kit / by
  // swapping the lens mount / needs an adapter / impossible.
  function lensOnBody(lens, body, adapters) {
    if (!lens.mount || !body.mounts) return { status: 'unverified', text: !lens.mount ? 'Lens mount not stated in the product name' : `${body.label || 'Camera'} mount unknown` };
    if (body.fixed || body.mounts.includes('fixed')) return { status: 'conflict', text: `${body.label || 'This camera'} has a built-in lens` };
    for (const bm of body.mounts) {
      if (lens.mount === bm) return { status: 'ok', text: `${MOUNT_LABEL[bm] || bm} native` };
      if (bm === 'RF' && lens.mount === 'RF-S') return { status: 'ok', text: 'RF-S on RF body' };
      if (bm === 'EF' && lens.mount === 'EF-S') {
        return body.sensor && SENSOR_RANK[body.sensor] > SENSOR_RANK.S35
          ? { status: 'conflict', text: 'EF-S lenses do not physically mount on full-frame EF bodies' }
          : { status: 'ok', text: 'EF-S on APS-C EF body' };
      }
    }
    const lm = lens.mount === 'EF-S' ? 'EF' : lens.mount;
    for (const bm of body.mounts) {
      const a = adapters.find(ad => ad.spec.from === lm && ad.spec.to === bm);
      if (a) return { status: 'ok', text: `via ${a.item.name}`, via: a.item.id };
    }
    if (lens.swappable) {
      const target = body.mounts.find(bm => (lens.altMounts || []).includes(bm)) || body.mounts[0];
      return { status: 'conditional', text: `Interchangeable mount — fit the ${MOUNT_LABEL[target] || target} mount before the shoot` };
    }
    for (const bm of body.mounts) {
      if (ADAPTABLE.has(`${lm}>${bm}`)) {
        return { status: 'need', text: `Needs a ${MOUNT_LABEL[lm]} → ${MOUNT_LABEL[bm]} adapter`, need: { kind: 'adapter', from: lm, to: bm } };
      }
    }
    return { status: 'conflict', text: `${MOUNT_LABEL[lens.mount] || lens.mount} lens can't be adapted to ${body.mounts.map(m => MOUNT_LABEL[m] || m).join('/')}` };
  }

  function coverageOnBody(lens, body, booster) {
    if (!lens.coverage || !body.sensor) return null;
    if (booster) return null; // focal reducers deliberately cover a larger sensor
    if (SENSOR_RANK[lens.coverage] >= SENSOR_RANK[body.sensor]) return null;
    return body.crop
      ? { status: 'conditional', text: `Covers ${SENSOR_LABEL[lens.coverage]} only — shoot ${body.label || 'the camera'} in a crop mode` }
      : { status: 'conditional', text: `Covers ${SENSOR_LABEL[lens.coverage]} only — will vignette on a ${SENSOR_LABEL[body.sensor]} sensor` };
  }

  function checkKit(kitItems) {
    const rows = kitItems.map(it => ({ item: it, spec: specOf(it) }));
    const byRole = r => rows.filter(x => x.spec.role === r);
    const bodies = byRole('body');
    const realBodies = bodies.filter(b => !b.spec.fixed);
    const adapters = byRole('adapter');
    const result = {};
    const issues = [];
    const set = (id, status, text, extra) => {
      const r = result[id] || (result[id] = { status: 'neutral', notes: [] });
      if (RANK[status] > RANK[r.status]) r.status = status;
      if (text) r.notes.push({ status, text, ...(extra || {}) });
    };
    rows.forEach(r => set(r.item.id, r.spec.role === 'other' ? 'neutral' : 'ok'));
    const label = r => r.spec.label || r.item.name;
    const families = new Set(realBodies.map(b => b.spec.family).filter(Boolean));
    const usedAdapters = new Set();

    // Lenses ↔ bodies (mount + coverage). A lens is judged on its best body.
    byRole('lens').forEach(l => {
      if (!realBodies.length) {
        set(l.item.id, bodies.length ? 'conflict' : 'unverified', bodies.length ? 'The camera in this kit has a built-in lens' : 'No camera body in the kit to check against');
        return;
      }
      let best = null;
      realBodies.forEach(b => {
        const m = lensOnBody(l.spec, b.spec, adapters);
        const booster = m.via && adapters.find(a => a.item.id === m.via)?.spec.booster;
        const c = m.status === 'ok' || m.status === 'conditional' ? coverageOnBody(l.spec, b.spec, booster) : null;
        const worst = c && RANK[c.status] > RANK[m.status] ? c : m;
        const cand = { m, c, worst, body: b };
        if (!best || RANK[cand.worst.status] < RANK[best.worst.status]) best = cand;
      });
      const onWhat = realBodies.length > 1 ? ` (${label(best.body)})` : '';
      set(l.item.id, best.m.status, best.m.text + onWhat, best.m.need ? { need: best.m.need } : null);
      if (best.m.via) usedAdapters.add(best.m.via);
      if (best.c) set(l.item.id, best.c.status, best.c.text);
      else if ((best.m.status === 'ok' || best.m.status === 'conditional') && !l.spec.coverage && SENSOR_RANK[best.body.spec.sensor] >= SENSOR_RANK.S35) {
        set(l.item.id, 'unverified', `Image circle not stated — confirm it covers ${SENSOR_LABEL[best.body.spec.sensor]}`);
      }
      if (best.m.status === 'need') issues.push({ level: 'need', text: `${l.item.name}: ${best.m.text}`, ids: [l.item.id], need: best.m.need });
      if (best.m.status === 'conflict') issues.push({ level: 'conflict', text: `${l.item.name}: ${best.m.text}`, ids: [l.item.id] });
      if (best.c) issues.push({ level: 'conditional', text: `${l.item.name}: ${best.c.text}`, ids: [l.item.id] });
    });
    adapters.forEach(a => {
      const fitsBody = realBodies.some(b => (b.spec.mounts || []).includes(a.spec.to));
      if (!realBodies.length) set(a.item.id, 'unverified', 'No camera body to check against');
      else if (!fitsBody) { set(a.item.id, 'conflict', `Adapts to ${MOUNT_LABEL[a.spec.to]}, which no camera here uses`); issues.push({ level: 'conflict', text: `${a.item.name} adapts to ${MOUNT_LABEL[a.spec.to]}, which no camera in the kit uses`, ids: [a.item.id] }); }
      else if (!usedAdapters.has(a.item.id)) set(a.item.id, 'conditional', `No ${MOUNT_LABEL[a.spec.from]} lens in the kit uses it`);
      else set(a.item.id, 'ok', `${MOUNT_LABEL[a.spec.from]} → ${MOUNT_LABEL[a.spec.to]}`);
    });

    // Power & media per body.
    const batteries = byRole('battery'), plates = byRole('battery-plate'), cards = byRole('media');
    realBodies.forEach(b => {
      const s = b.spec;
      if (s.battery) {
        const direct = batteries.find(x => x.spec.battery.some(t => s.battery.includes(t)));
        const viaPlate = plates.find(p => (!p.spec.locks.length || p.spec.locks.includes(s.family)) && batteries.some(x => x.spec.battery.some(t => p.spec.battery.includes(t))));
        if (direct) { set(b.item.id, 'ok', `Power: ${direct.item.name}`); set(direct.item.id, 'ok', `Fits ${label(b)}`); }
        else if (viaPlate) set(b.item.id, 'ok', `Power via ${viaPlate.item.name}`);
        else {
          const text = `${label(b)} needs ${s.battery.map(t => BATTERY_LABEL[t] || t).join(' or ')} batteries`;
          set(b.item.id, 'need', text); issues.push({ level: 'need', text, ids: [b.item.id], need: { kind: 'battery', types: s.battery } });
        }
      } else if (!s.fixed) set(b.item.id, 'unverified', 'Battery type not on file');
      if (s.media) {
        const card = cards.find(x => x.spec.media.some(t => s.media.includes(t)));
        if (card) { set(b.item.id, 'ok', `Media: ${card.item.name}`); set(card.item.id, 'ok', `Fits ${label(b)}`); }
        else {
          const text = `${label(b)} records to ${s.media.map(t => MEDIA_LABEL[t] || t).join(' or ')}`;
          set(b.item.id, 'need', text); issues.push({ level: 'need', text, ids: [b.item.id], need: { kind: 'media', types: s.media } });
        }
      } else if (!s.fixed) set(b.item.id, 'unverified', 'Media type not on file');
    });
    if (realBodies.length) {
      batteries.forEach(x => {
        const usedByBody = realBodies.some(b => (b.spec.battery || []).some(t => x.spec.battery.includes(t)));
        const usedByPlate = plates.some(p => p.spec.battery.some(t => x.spec.battery.includes(t)));
        const bigFormat = x.spec.battery.some(t => ['V-MOUNT', 'GOLD', 'B-MOUNT', 'NP-F'].includes(t)); // also powers lights / monitors
        if (!usedByBody && !usedByPlate && !bigFormat) {
          set(x.item.id, 'conflict', 'Fits none of the cameras in this kit');
          issues.push({ level: 'conflict', text: `${x.item.name} fits none of the cameras in this kit`, ids: [x.item.id] });
        }
      });
      cards.forEach(x => {
        if (!realBodies.some(b => (b.spec.media || []).some(t => x.spec.media.includes(t))) && realBodies.every(b => b.spec.media)) {
          set(x.item.id, 'conflict', 'No camera in this kit takes this card');
          issues.push({ level: 'conflict', text: `${x.item.name}: no camera in this kit takes this card`, ids: [x.item.id] });
        }
      });
    }

    // Gimbal payload: heaviest body + heaviest lens that fits it.
    byRole('gimbal').forEach(g => {
      if (!g.spec.payload) { set(g.item.id, 'unverified', 'Payload rating not on file'); return; }
      if (!realBodies.length) return;
      let worst = null;
      realBodies.forEach(b => {
        if (!b.spec.kg) return;
        const lensKg = Math.max(0, ...byRole('lens').filter(l => lensOnBody(l.spec, b.spec, adapters).status !== 'conflict').map(l => l.spec.kg || 0));
        const total = b.spec.kg + lensKg + 0.25; // + plate, cables, small accessories
        if (!worst || total > worst.total) worst = { total, b };
      });
      if (!worst) { set(g.item.id, 'unverified', 'Camera weight not on file'); return; }
      const t = `≈${worst.total.toFixed(1)}kg on a ${g.spec.payload}kg gimbal (lens weight estimated)`;
      if (worst.total > g.spec.payload) { set(g.item.id, 'conflict', 'Over payload: ' + t); issues.push({ level: 'conflict', text: `${g.item.name} is over payload: ${t}`, ids: [g.item.id, worst.b.item.id] }); }
      else if (worst.total > g.spec.payload * 0.85) { set(g.item.id, 'conditional', 'Near payload limit: ' + t); issues.push({ level: 'conditional', text: `${g.item.name} is near its payload limit: ${t}`, ids: [g.item.id] }); }
      else set(g.item.id, 'ok', t);
    });

    // Monitors: shared connector with at least one camera, or a converter.
    const converters = byRole('converter');
    byRole('monitor').forEach(m => {
      if (m.spec.locks && m.spec.locks.length) return; // handled by lock-in below
      if (!m.spec.inputs) { set(m.item.id, 'unverified', 'Inputs not stated'); return; }
      const known = realBodies.filter(b => b.spec.out);
      if (!known.length) { if (realBodies.length) set(m.item.id, 'unverified', 'Camera outputs not on file'); return; }
      const direct = known.find(b => b.spec.out.some(o => m.spec.inputs.includes(o)));
      if (direct) { set(m.item.id, 'ok', `${direct.spec.out.find(o => m.spec.inputs.includes(o)).toUpperCase()} from ${label(direct)}`); return; }
      const b = known[0], from = b.spec.out[0], to = m.spec.inputs[0];
      const conv = converters.find(c => c.spec.from === from && c.spec.to === to);
      if (conv) set(m.item.id, 'ok', `via ${conv.item.name}`);
      else {
        const text = `${label(b)} outputs ${b.spec.out.join('/').toUpperCase()}, monitor takes ${m.spec.inputs.join('/').toUpperCase()}`;
        set(m.item.id, 'need', text); issues.push({ level: 'need', text: `${m.item.name}: ${text}`, ids: [m.item.id], need: { kind: 'converter', from, to } });
      }
    });

    // XLR microphones need an XLR input with phantom power somewhere.
    const brandOf = b => String(b.spec.label || b.item.name).split(' ')[0].toLowerCase();
    const xlrIn = realBodies.find(b => b.spec.xlr)
      || byRole('xlr-input').find(x => !x.spec.brandLock || realBodies.some(b => brandOf(b) === x.spec.brandLock));
    byRole('xlr-input').filter(x => x.spec.brandLock && realBodies.length && !realBodies.some(b => brandOf(b) === x.spec.brandLock)).forEach(x => {
      const text = `Shoe-mount XLR adapter — only works on ${x.spec.brandLock[0].toUpperCase() + x.spec.brandLock.slice(1)} cameras`;
      set(x.item.id, 'conflict', text); issues.push({ level: 'conflict', text: `${x.item.name}: ${text}`, ids: [x.item.id] });
    });
    byRole('mic-xlr').forEach(mic => {
      if (xlrIn) set(mic.item.id, 'ok', `XLR into ${xlrIn.spec.label || xlrIn.item.name}`);
      else {
        set(mic.item.id, 'need', 'XLR mic — needs an XLR input with phantom power');
        issues.push({ level: 'need', text: `${mic.item.name} is XLR — no camera here has an XLR input`, ids: [mic.item.id], need: { kind: 'xlr-input', brands: realBodies.map(brandOf) } });
      }
    });

    // Camera-specific accessories (cages, plates, system monitors).
    rows.filter(r => r.spec.locks && r.spec.locks.length && r.spec.role !== 'body').forEach(r => {
      if (!realBodies.length) { set(r.item.id, 'unverified', 'Made for a specific camera — none in the kit'); return; }
      if (r.spec.locks.some(f => families.has(f))) { set(r.item.id, 'ok', 'Made for this camera'); return; }
      const names = r.spec.locks.map(k => (BODIES.find(b => b.key === k) || {}).label || k).join(' / ');
      set(r.item.id, 'conflict', `Only fits ${names}`);
      issues.push({ level: 'conflict', text: `${r.item.name} only fits ${names}`, ids: [r.item.id] });
    });

    // Hand-entered overrides win over the rules for their pair.
    OVERRIDES.forEach(o => {
      const a = rows.find(r => o.a.test(r.item.name)), b = rows.find(r => o.b.test(r.item.name));
      if (a && b) { [a, b].forEach(r => { result[r.item.id].status = o.verdict; result[r.item.id].notes.push({ status: o.verdict, text: o.note }); }); if (o.verdict !== 'ok') issues.push({ level: o.verdict, text: o.note, ids: [a.item.id, b.item.id] }); }
    });

    issues.sort((x, y) => RANK[y.level] - RANK[x.level]);
    const counts = { conflict: 0, need: 0, conditional: 0, unverified: 0, ok: 0 };
    Object.values(result).forEach(r => { if (counts[r.status] != null) counts[r.status]++; });
    return { items: result, issues, counts, bodies: realBodies.length };
  }

  // ── Fixes: catalog items that satisfy a `need` ───────────────────────────
  function satisfies(spec, need) {
    switch (need.kind) {
      case 'adapter': return spec.role === 'adapter' && spec.from === need.from && spec.to === need.to;
      case 'battery': return spec.role === 'battery' && spec.battery.some(t => need.types.includes(t));
      case 'media': return spec.role === 'media' && spec.media.some(t => need.types.includes(t));
      case 'converter': return spec.role === 'converter' && spec.from === need.from && spec.to === need.to;
      case 'xlr-input': return spec.role === 'xlr-input' && (!spec.brandLock || (need.brands || []).includes(spec.brandLock));
      default: return false;
    }
  }
  function findFixes(need, catalog, limit = 3) {
    const out = [];
    for (const it of catalog) {
      if (satisfies(specOf(it), need)) out.push(it);
      if (out.length >= limit * 4) break;
    }
    // Prefer genuine first-party-looking names, then shorter (less bundled) listings.
    return out.sort((a, b) => a.name.length - b.name.length).slice(0, limit);
  }

  // ── Brief matching ───────────────────────────────────────────────────────
  // Whole-word matches between the brief and a product name. Brand / camera
  // names in the brief ("on a RED", "FX6") weigh far more than general words.
  const STOP = new Set('the and for with from into onto our your their this that some lots very good nice shoot shooting shot shots day days kit need needs mostly using use small big large two three four five one multi cam cams camera cameras look'.split(' '));
  const BRANDS = /^(?:sony|canon|red|arri|alexa|blackmagic|bmpcc|panasonic|lumix|nikon|fuji|fujifilm|dji|ronin|komodo|raptor|v-raptor|burano|venice|fx\d+|a7s?\w*|c\d{2,3}|r\d|gh\d\w?|s\d\w*|z\d\w*|ursa|pyxis|pocket|sigma|zeiss|cooke|atomos|smallhd|sennheiser|rode|aputure|amaran|nanlite|godox)$/;
  function briefWords(prompt) {
    return [...new Set(String(prompt).toLowerCase().split(/[^a-z0-9-]+/).filter(w => w.length > 1 && !STOP.has(w)))]
      .map(w => ({ re: new RegExp('(?:^|[^a-z0-9])' + w.replace(/[-]/g, '\\-') + '(?![a-z0-9])', 'i'), weight: BRANDS.test(w) ? 10 : w.length > 3 ? 2 : 1 }));
  }
  const wordScore = (name, words) => words.reduce((s, w) => s + (w.re.test(name) ? w.weight : 0), 0);

  // ── Candidate pool for the AI ────────────────────────────────────────────
  // The catalog is thousands of rows; send the model a relevant, spec-tagged
  // slice instead. Each line: ref|name|role|tags.
  function buildCandidatePool(prompt, catalog, cap = 320) {
    const words = briefWords(prompt);
    const score = it => wordScore(it.name, words);
    const roles = {};
    catalog.forEach(it => { const s = specOf(it); (roles[s.role] || (roles[s.role] = [])).push(it); });
    const take = (role, n, filter) => (roles[role] || []).filter(it => !filter || filter(specOf(it))).map(it => [it, score(it)]).sort((a, b) => b[1] - a[1]).slice(0, n).map(x => x[0]);
    const wantsFixed = /ptz|stream|live|camcorder|conference|webinar|document/i.test(prompt);
    const bodies = take('body', 50, s => wantsFixed || !s.fixed);
    const mountsInPlay = new Set(bodies.flatMap(b => specOf(b).mounts || []));
    const lensesByMount = {};
    (roles.lens || []).forEach(it => { const m = specOf(it).mount; if (m && (mountsInPlay.has(m) || m === 'EF' || m === 'PL')) (lensesByMount[m] || (lensesByMount[m] = [])).push(it); });
    const lenses = Object.values(lensesByMount).flatMap(list => list.map(it => [it, score(it)]).sort((a, b) => b[1] - a[1]).slice(0, 12).map(x => x[0]));
    const battTypes = new Set(bodies.flatMap(b => specOf(b).battery || []));
    const mediaTypes = new Set(bodies.flatMap(b => specOf(b).media || []));
    const picked = [
      ...bodies, ...lenses,
      ...take('adapter', 12), ...take('battery', 20, s => s.battery.some(t => battTypes.has(t) || ['V-MOUNT', 'NP-F'].includes(t))),
      ...take('battery-plate', 5), ...take('media', 16, s => s.media.some(t => mediaTypes.has(t))),
      ...take('gimbal', 8), ...take('monitor', 10), ...take('converter', 4),
      ...take('mic-xlr', 8), ...take('mic', 8), ...take('xlr-input', 6),
      ...take('light', 20), ...take('tripod', 8),
      ...catalog.map(it => [it, score(it)]).filter(x => x[1] >= 4).sort((a, b) => b[1] - a[1]).slice(0, 30).map(x => x[0]),
    ];
    const seen = new Set(), pool = [];
    for (const it of picked) {
      if (seen.has(it.id) || pool.length >= cap) continue;
      seen.add(it.id);
      const s = specOf(it);
      pool.push({ ref: 'c' + pool.length, id: it.id, line: `c${pool.length}|${it.name}|${s.role}|${describe(s)}` });
    }
    return pool;
  }

  // ── Offline assembler ─────────────────────────────────────────────────────
  // Used when the AI service is unavailable. Builds outward from one camera so
  // every pick is checked against it.
  const SCENARIOS = [
    { match: /wedding|bride|groom|ceremony/i, name: '2-Cam Wedding Kit', bodies: 2, lenses: 3, mics: 2, lights: 1, monitor: true, gimbal: true, tripod: true },
    { match: /interview|talking head|sit[- ]?down|testimonial/i, name: 'Interview Kit', bodies: 1, lenses: 2, mics: 2, lights: 3, monitor: true, tripod: true },
    { match: /music|band|performance|concert/i, name: 'Music Video Kit', bodies: 1, lenses: 3, lights: 3, monitor: true, gimbal: true, cinema: true },
    { match: /doc|documentary|run[- ]?and[- ]?gun|news|eng/i, name: 'Run-and-Gun Doc Kit', bodies: 1, lenses: 2, mics: 1, lights: 1, monitor: true, xlr: true },
    { match: /product|tabletop|macro|ecommerce|e-commerce|still life/i, name: 'Product / Tabletop Kit', bodies: 1, lenses: 2, lights: 3, monitor: true, tripod: true },
    { match: /podcast|talk show|roundtable/i, name: 'Podcast Kit', bodies: 2, lenses: 2, mics: 3, lights: 2, tripod: true },
    { match: /commercial|ad spot|advert|brand film/i, name: 'Commercial Kit', bodies: 1, lenses: 3, mics: 1, lights: 3, monitor: true, cinema: true, tripod: true },
    { match: /event|conference|live|keynote|stage/i, name: 'Event Coverage Kit', bodies: 2, lenses: 2, mics: 2, monitor: true, tripod: true },
  ];
  const DEFAULT_SCENARIO = { name: 'General Production Kit', bodies: 1, lenses: 2, mics: 1, lights: 2, monitor: true, tripod: true };

  function assembleKit(prompt, catalog) {
    const sc = SCENARIOS.find(s => s.match.test(prompt)) || DEFAULT_SCENARIO;
    const words = briefWords(prompt);
    const byRole = role => catalog.filter(it => specOf(it).role === role);
    const kit = [];
    const add = (it, qty, reason) => { if (it && !kit.some(k => k.id === it.id)) kit.push({ id: it.id, name: it.name, qty, reason }); };

    // 1. Camera: most complete spec, nudged by the brief.
    const bodies = byRole('body').filter(it => !specOf(it).fixed && specOf(it).mounts);
    const bodyScore = it => {
      const s = specOf(it), n = it.name;
      let v = (s.battery ? 2 : 0) + (s.media ? 2 : 0) + (s.out ? 1 : 0) + (s.kg ? 1 : 0) + (s.sensor ? 1 : 0);
      v += wordScore(n, words) * 2;
      if (sc.cinema && (s.out || []).includes('sdi')) v += 3;
      if (sc.xlr && s.xlr) v += 3;
      if (sc.gimbal && s.kg && s.kg < 1.2) v += 2;
      if (/kit|bundle|combo|\bwith\b/i.test(n)) v -= 1;
      return v;
    };
    const body = bodies.sort((a, b) => bodyScore(b) - bodyScore(a))[0];
    if (!body) return { name: sc.name, summary: 'No camera bodies with known specs in the catalog.', items: [] };
    const bs = specOf(body);
    add(body, sc.bodies, `${bs.label} — ${SENSOR_LABEL[bs.sensor] || ''} ${MOUNT_LABEL[bs.mounts[0]] || ''}`.trim());

    // 2. Lenses that fit natively and cover the sensor, spread across focal lengths.
    const fits = byRole('lens').filter(l => {
      const s = specOf(l);
      return lensOnBody(s, bs, []).status === 'ok' && !coverageOnBody(s, bs, false);
    }).sort((a, b) => wordScore(b.name, words) - wordScore(a.name, words) || (specOf(b).coverage ? 1 : 0) - (specOf(a).coverage ? 1 : 0) || ((sc.cinema || /cine/i.test(prompt)) ? (specOf(b).cine ? 1 : 0) - (specOf(a).cine ? 1 : 0) : 0) || a.name.length - b.name.length);
    const focal = it => { const m = it.name.match(/(\d{1,3})(?:\s?-\s?(\d{1,3}))?\s?mm/i); return m ? +m[1] : 0; };
    const lensPicks = [];
    for (const l of fits) {
      if (lensPicks.length >= sc.lenses) break;
      if (lensPicks.every(p => Math.abs(focal(p) - focal(l)) >= 15)) lensPicks.push(l);
    }
    lensPicks.forEach(l => add(l, 1, `${MOUNT_LABEL[specOf(l).mount]}` + (specOf(l).coverage ? `, covers ${SENSOR_LABEL[specOf(l).coverage]}` : '')));

    // 3–7. Support, monitoring, audio, light — each checked against the body.
    if (sc.gimbal) {
      const need = (bs.kg || 1) + 1.0;
      const g = byRole('gimbal').filter(x => specOf(x).payload && specOf(x).payload >= need * 1.15)
        .sort((a, b) => wordScore(b.name, words) - wordScore(a.name, words) || specOf(a).payload - specOf(b).payload)[0];
      add(g, 1, `Payload ${g && specOf(g).payload}kg`);
    }
    if (sc.monitor && bs.out) {
      const m = byRole('monitor').filter(x => !specOf(x).locks.length && (specOf(x).inputs || []).some(i => bs.out.includes(i)))
        .sort((a, b) => wordScore(b.name, words) - wordScore(a.name, words))[0];
      add(m, 1, `${(specOf(m || {}).inputs || []).join('/').toUpperCase()} input matches camera`);
    }
    if (sc.mics) {
      const mic = byRole('mic-xlr').sort((a, b) => wordScore(b.name, words) - wordScore(a.name, words) || (/mkh|ntg|mke\s?600|cmit/i.test(b.name) ? 1 : 0) - (/mkh|ntg|mke\s?600|cmit/i.test(a.name) ? 1 : 0))[0];
      add(mic, Math.min(sc.mics, 2), bs.xlr ? 'XLR into the camera' : 'XLR shotgun');
      const lav = byRole('mic')[0];
      if (sc.mics > 1) add(lav, 1, 'Wireless / lav coverage');
    }
    if (sc.lights) {
      const watts = x => { const m = x.name.match(/\b(\d{2,4})\s?(?:w|d|c|x)\b/i); return m ? +m[1] : 0; };
      const lights = byRole('light').filter(x => watts(x) >= 60 && watts(x) <= 1200 && !/on[- ]?camera|mini|pocket|phone|ring\s?light|desk|nail|lamp|clip/i.test(x.name))
        .sort((a, b) => watts(b) - watts(a));
      // Key, then progressively smaller fill / back lights.
      const picks = [];
      for (const l of lights) { if (picks.length >= sc.lights) break; if (!picks.length || watts(l) <= watts(picks[picks.length - 1]) * 0.7) picks.push(l); }
      picks.forEach((l, i) => add(l, 1, ['Key light', 'Fill light', 'Back / hair light'][i] || 'Lighting'));
    }
    if (sc.tripod) {
      const tripods = byRole('tripod').filter(x => !/mini|pixi|selfie|desktop|tabletop|phone|travel|table/i.test(x.name))
        .sort((a, b) => [b, a].map(x => (/fluid|video/i.test(x.name) ? 1 : 0) + (/tripod|legs|system|kit/i.test(x.name) ? 1 : 0)).reduce((d, v, i) => i ? d - v : v, 0));
      add(tripods[0], sc.bodies, 'Fluid-head support');
    }

    // Power, media, adapters, converters, XLR inputs: resolve every need.
    for (let pass = 0; pass < 3; pass++) {
      const chk = checkKit(kit.map(k => catalog.find(c => c.id === k.id)).filter(Boolean));
      const needs = chk.issues.filter(i => i.level === 'need');
      if (!needs.length) break;
      needs.forEach(n => {
        const fix = findFixes(n.need, catalog, 1)[0];
        if (fix) add(fix, n.need.kind === 'battery' ? 3 * sc.bodies : n.need.kind === 'media' ? 2 * sc.bodies : 1, n.text.replace(/^.*?: /, ''));
      });
    }
    return {
      name: sc.name,
      summary: `Built around the ${bs.label}; every pick was checked against it. Assembled offline — the AI service wasn't available.`,
      items: kit,
    };
  }

  window.GEAR_COMPAT = { specOf, describe, checkKit, findFixes, assembleKit, buildCandidatePool, MOUNT_LABEL, SENSOR_LABEL };
})();
