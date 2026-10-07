// Image-proxying Vercel serverless function. Used by the PDF export to
// bypass CORS when remote image hosts don't return Access-Control-Allow-Origin
// headers — we fetch the bytes server-side and re-serve them with CORS, so
// html2canvas can bake them into the PDF without tainting the canvas.
//
// Usage from the client:
//   /api/proxy?url=https%3A%2F%2Fexample.com%2Fimage.jpg
//
// Locally (python3 serve.py) this endpoint doesn't exist — the export will
// fall back to placeholders for non-CORS images. On Vercel the function
// auto-deploys and the export will fetch the real bytes through this route.
//
// Responses are served from the app's own origin, where the Supabase session
// lives in localStorage — so anything that could run script (HTML, SVG) must
// never come back through here. Only raster images are passed through, with
// headers that stop the browser sniffing or executing them, and private
// network hosts are refused so the function can't be pointed inward.

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);
const MAX_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 8000;

function isPrivateAddress(ip) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168);
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7));
  return v6 === '::' || v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80');
}

async function isPrivateHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) return true;
  if (isIP(host)) return isPrivateAddress(host);
  try {
    const addrs = await lookup(host, { all: true });
    return addrs.some(a => isPrivateAddress(a.address));
  } catch (e) {
    return true; // unresolvable — nothing to fetch anyway
  }
}

export default async function handler(req, res) {
  const url = req.query && req.query.url;
  if (!url || typeof url !== 'string') {
    res.status(400).send('Missing url query parameter');
    return;
  }
  let target;
  try { target = new URL(url); } catch (e) {
    res.status(400).send('Invalid url');
    return;
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    res.status(400).send('Only http and https URLs are supported');
    return;
  }
  if (await isPrivateHost(target.hostname)) {
    res.status(403).send('Host not allowed');
    return;
  }
  try {
    // Follow redirects by hand so every hop gets the private-host check —
    // otherwise a public URL could bounce us somewhere internal.
    let upstream;
    for (let hops = 0; ; hops++) {
      upstream = await fetch(target, {
        headers: { 'User-Agent': 'GearAppProxy/1.0' },
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const location = upstream.status >= 300 && upstream.status < 400 && upstream.headers.get('location');
      if (!location) break;
      if (hops >= 3) {
        res.status(502).send('Too many redirects');
        return;
      }
      target = new URL(location, target);
      if ((target.protocol !== 'http:' && target.protocol !== 'https:') || await isPrivateHost(target.hostname)) {
        res.status(403).send('Host not allowed');
        return;
      }
    }
    if (!upstream.ok) {
      res.status(upstream.status).send('Upstream returned ' + upstream.status);
      return;
    }
    const contentType = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.has(contentType)) {
      res.status(415).send('Only raster images are proxied');
      return;
    }
    if (Number(upstream.headers.get('content-length')) > MAX_BYTES) {
      res.status(413).send('Image too large');
      return;
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      res.status(413).send('Image too large');
      return;
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(buf);
  } catch (e) {
    res.status(502).send('Proxy error');
  }
}
