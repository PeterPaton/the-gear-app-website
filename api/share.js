// Public share page: gearapp.io/s/<slug>-<token>
//
// Serves a read-only copy of a project's kit list to anyone with the link,
// signed in or not. vercel.json rewrites /s/:slug to this function.
//
// The page is built on the server (no client script) so link previews in
// WhatsApp, iMessage and Slack, which don't run JavaScript, get a real title,
// and so it loads fast on a phone. Data comes from the get_shared_kit()
// database function, which only returns anything for an active link and only
// a fixed set of fields (see supabase/migrations/20261119150000_shared_lists.sql).
//
// The slug is cosmetic ("salt-road-" in front of the token); only the last 20
// hex characters are used. Everything from the database is escaped before it
// goes into the HTML, and the response carries a strict Content-Security-Policy.

// Public by design: the same anon key and URL the app ships in index.html.
// Override with SUPABASE_URL / SUPABASE_ANON_KEY if the project ever moves.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uoivcbkzovccudjksrfg.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvaXZjYmt6b3ZjY3VkamtzcmZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDA3NDAsImV4cCI6MjA5MDg3Njc0MH0.y5ymEa4rV9FY0TToeOx43GzW4lpspZ0c_deqTP-Dlho';

const TIMEOUT_MS = 6000;
const MAX_ITEMS = 500;
const MAX_DATA_IMAGE_CHARS = 250000;
const STATUSES = ['planning', 'active', 'wrapped'];

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// "salt-road-3f9a…" or just the token → the 20-char token, or null.
export function tokenFromSlug(slug) {
  const m = /(?:^|-)([a-f0-9]{20})$/.exec(String(slug || '').toLowerCase());
  return m ? m[1] : null;
}

// Only plain web images and small raster data URIs make it into an <img>.
function safeImage(u) {
  if (typeof u !== 'string') return null;
  if (/^https?:\/\/[^\s"'<>]{1,2000}$/i.test(u)) return u;
  if (u.length <= MAX_DATA_IMAGE_CHARS && /^data:image\/(png|jpe?g|webp|gif|avif);base64,[a-z0-9+/=]+$/i.test(u)) return u;
  return null;
}

const CSS = `
*{box-sizing:border-box}
html,body{margin:0}
body{background:#f6f3ee;color:#191919;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;font-synthesis:none}
h1,h2,p,dl,dd,ul{margin:0;padding:0}
ul{list-style:none}
a{color:inherit}
:focus-visible{outline:2px solid #FF570C;outline-offset:2px}
.mono{font-family:'Orbit','JetBrains Mono',ui-monospace,monospace}
.in{max-width:980px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left));padding-right:max(16px,env(safe-area-inset-right))}
.top{background:#191919;color:#fff;border-bottom:1px solid #000}
.top .in{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:56px}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-family:'Orbit',monospace;letter-spacing:.06em;font-size:15px;text-transform:uppercase;white-space:nowrap}
.brand img{width:28px;height:28px;display:block}
.btn{display:inline-block;background:#FF570C;color:#fff;border:1px solid #FF570C;padding:9px 16px;font-family:'Orbit',monospace;font-size:11px;letter-spacing:.06em;text-transform:uppercase;text-decoration:none;white-space:nowrap}
.btn:hover{background:#e84d08}
.btn.ghost{background:transparent;border-color:rgba(255,255,255,.35)}
.btn.ghost:hover{background:rgba(255,255,255,.08)}
.head{background:#191919;color:#fff;border-bottom:1px solid #000}
.head .in{padding-top:26px;padding-bottom:0}
.eyebrow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-family:'Orbit',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.55)}
.pill{padding:3px 8px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.12);color:#fff;letter-spacing:.1em}
.pill.active{background:#FF570C;border-color:#FF570C}
h1{font-family:'Orbit',monospace;font-weight:400;font-size:clamp(28px,6vw,46px);line-height:1.1;letter-spacing:.01em;margin:14px 0 22px;overflow-wrap:anywhere}
.facts{display:flex;flex-wrap:wrap;border-top:1px solid #000;margin:0 -16px}
.fact{padding:10px 24px;border-right:1px solid #333;min-width:0}
.fact:last-child{border-right:0}
.fact dt{font-family:'Orbit',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8a827b}
.fact dd{margin-top:1px;font-size:14px;overflow-wrap:anywhere}
.fact dd.n{font-family:'Orbit',monospace;font-size:20px;color:#FF570C;line-height:1.3}
.kit{background:#d9d2ca;border-bottom:1px solid #191919}
.kit .in{padding:0}
.thead,.row{display:grid;grid-template-columns:64px minmax(0,1fr) 130px 72px}
.thead{height:28px;background:#e8e2d8;border-bottom:1px solid #191919}
.thead div{display:flex;align-items:center;padding:0 16px;border-right:1px solid #191919;font-family:'Orbit',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#7a716a}
.thead div:first-child{padding:0}
.thead div:last-child,.c-qty{border-right:0;justify-content:center}
.group{display:flex;align-items:center;justify-content:space-between;min-height:36px;padding:0 16px;background:#191919;color:#fff;font-family:'Orbit',monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase;border-bottom:1px solid #000}
.group span:last-child{color:#FF570C}
.row{min-height:64px;border-bottom:1px solid #191919}
.row>*{border-right:1px solid #191919;min-width:0}
.c-img{position:relative;background:#fff;overflow:hidden}
.c-img img{position:absolute;top:5px;left:5px;width:calc(100% - 10px);height:calc(100% - 10px);object-fit:contain}
.c-name{display:flex;align-items:center;padding:8px 16px;font-family:'Orbit',monospace;font-size:13px;line-height:1.3;overflow-wrap:anywhere}
.c-cat{display:flex;align-items:center;padding:0 16px;font-family:'Orbit',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#7a716a}
.c-qty{display:flex;align-items:center;font-family:'Orbit',monospace;font-size:13px;color:#7a716a}
.c-qty.multi{background:#FF570C;color:#fff}
.empty{padding:48px 16px;text-align:center;font-family:'Orbit',monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7a716a}
.cta{background:#191919;color:#fff}
.cta .in{display:flex;align-items:center;justify-content:space-between;gap:16px 32px;flex-wrap:wrap;padding-top:32px;padding-bottom:32px}
.cta h2{font-family:'Orbit',monospace;font-weight:400;font-size:22px;letter-spacing:.01em;margin-bottom:6px}
.cta p{color:rgba(255,255,255,.65);max-width:52ch}
.foot{padding:18px 0 28px;font-size:12px;color:#7a716a}
.foot .in{display:flex;flex-wrap:wrap;gap:6px 20px;justify-content:space-between}
.msg{max-width:520px;margin:0 auto;padding:72px 16px;text-align:center}
.msg h1{margin:0 0 12px;font-size:28px}
.msg p{color:#7a716a;margin-bottom:24px}
@media (max-width:640px){
  .thead,.row{grid-template-columns:52px minmax(0,1fr) 52px}
  .thead div:nth-child(3),.c-cat{display:none}
  .fact{padding:10px 16px}
  .c-name{padding:8px 12px}
}
`;

function page({ title, description, origin, path, body, robots }) {
  const url = origin + path;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${robots}">
<meta name="theme-color" content="#191919">
<meta property="og:type" content="website">
<meta property="og:site_name" content="The Gear App">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(origin)}/icon-512.png">
<meta name="twitter:card" content="summary">
<link rel="icon" href="/app-icon.jpg" type="image/jpeg">
<link rel="apple-touch-icon" href="/app-icon.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Orbit&family=Inter:wght@400;500;600;700&display=swap">
<style>${CSS}</style>
<script defer src="/_vercel/insights/script.js"></script>
</head>
<body>
<header class="top"><div class="in">
  <a class="brand" href="/?utm_source=share&amp;utm_medium=kitlist"><img src="/app-icon.jpg" alt="">The Gear App</a>
  <a class="btn" href="/?utm_source=share&amp;utm_medium=kitlist&amp;utm_content=header">Sign up free</a>
</div></header>
${body}
</body>
</html>`;
}

const SIGNUP = '/?utm_source=share&amp;utm_medium=kitlist&amp;utm_content=footer';

export function renderSharePage(kit, { origin, path }) {
  const rawItems = Array.isArray(kit.items) ? kit.items.slice(0, MAX_ITEMS) : [];
  const items = rawItems.map((it) => ({
    name: String((it && it.name) || 'Untitled item'),
    category: String((it && it.category) || 'other').trim().toLowerCase() || 'other',
    qty: Math.max(1, Math.min(9999, parseInt(it && it.qty, 10) || 1)),
    image: safeImage(it && it.image_url),
  }));
  const totalQty = items.reduce((s, it) => s + it.qty, 0);
  const isInv = kit.kind === 'inventory';
  const name = String(kit.name || (isInv ? 'Inventory' : 'Kit list'));
  const status = STATUSES.includes(kit.status) ? kit.status : null;

  const facts = [['Client', kit.client], ['Shoot', kit.shoot], ['Location', kit.location]]
    .filter(([, v]) => typeof v === 'string' && v.trim())
    .map(([k, v]) => `<div class="fact"><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
    .join('');

  const order = [];
  const byCat = {};
  items.forEach((it) => { if (!byCat[it.category]) { byCat[it.category] = []; order.push(it.category); } byCat[it.category].push(it); });

  const rows = order.map((cat) => {
    const list = byCat[cat];
    return `<div class="group"><span>${esc(cat)}</span><span>${list.length}</span></div><ul>` +
      list.map((it) => `<li class="row"><div class="c-img">${it.image ? `<img src="${esc(it.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</div><div class="c-name">${esc(it.name)}</div><div class="c-cat">${esc(it.category)}</div><div class="c-qty${it.qty > 1 ? ' multi' : ''}">×${it.qty}</div></li>`).join('') +
      '</ul>';
  }).join('');

  const body = `
<section class="head"><div class="in">
  <div class="eyebrow"><span>${isInv ? 'Shared inventory' : 'Shared kit list'}</span>${status ? `<span class="pill ${status}">${status}</span>` : ''}</div>
  <h1>${esc(name)}</h1>
  <dl class="facts">${facts}<div class="fact"><dt>Items</dt><dd class="n">${totalQty}</dd></div><div class="fact"><dt>Unique</dt><dd class="n">${items.length}</dd></div></dl>
</div></section>
<main class="kit"><div class="in">
${items.length ? `<div class="thead"><div></div><div>Item</div><div>Category</div><div>Qty</div></div>${rows}` : '<div class="empty">No items here yet</div>'}
</div></main>
<section class="cta"><div class="in">
  <div><h2>Make your own kit lists</h2><p>The Gear App keeps your inventory in one place and builds a kit list for every shoot. Free to start, on your laptop or phone.</p></div>
  <a class="btn" href="${SIGNUP}">Sign up free</a>
</div></section>
<footer class="foot"><div class="in"><span>Shared with The Gear App</span><span><a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a></span></div></footer>`;

  const n = items.length;
  return page({
    title: `${name}: ${n} item${n === 1 ? '' : 's'} · The Gear App`,
    description: `${isInv ? 'An inventory' : 'A kit list'} with ${totalQty} piece${totalQty === 1 ? '' : 's'} of gear, shared from The Gear App. Make your own, free.`,
    origin, path, body, robots: 'noindex, nofollow',
  });
}

export function renderMessage({ heading, text }, { origin, path }) {
  const body = `<main class="msg"><h1>${esc(heading)}</h1><p>${esc(text)}</p><a class="btn" href="${SIGNUP}">Try The Gear App free</a></main>`;
  return page({ title: `${heading} · The Gear App`, description: text, origin, path, body, robots: 'noindex, nofollow' });
}

async function fetchKit(token) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_shared_kit`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!r.ok) throw new Error('upstream ' + r.status);
  const data = await r.json();
  return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).send('Method not allowed');
    return;
  }
  const slug = typeof req.query?.slug === 'string' ? req.query.slug : '';
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || 'www.gearapp.io').split(',')[0].trim();
  const origin = `https://${/^[a-z0-9.:-]+$/i.test(host) ? host : 'www.gearapp.io'}`;
  const path = `/s/${encodeURIComponent(slug)}`;
  const ctx = { origin, path };

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src https: data:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");

  const token = tokenFromSlug(slug);
  let kit = null;
  if (token) {
    try {
      kit = await fetchKit(token);
    } catch (e) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(502).send(renderMessage({ heading: 'Couldn’t load this kit list', text: 'Something went wrong on our side. Try the link again in a moment.' }, ctx));
      return;
    }
  }
  if (!kit) {
    // Short cache so a link someone just switched on works within seconds.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=15');
    res.status(404).send(renderMessage({ heading: 'This kit list isn’t available', text: 'The link may have been turned off, or it was copied incorrectly. Ask the person who sent it for a new one.' }, ctx));
    return;
  }
  // Fresh for a minute at the edge so a busy link doesn't hit the database
  // every time, while switching a link off takes effect quickly.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
  res.status(200).send(renderSharePage(kit, ctx));
}
