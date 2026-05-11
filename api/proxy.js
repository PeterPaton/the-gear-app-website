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

export default async function handler(req, res) {
  const url = req.query && req.query.url;
  if (!url || typeof url !== 'string') {
    res.status(400).send('Missing url query parameter');
    return;
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    res.status(400).send('Only http and https URLs are supported');
    return;
  }
  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'GearAppProxy/1.0' },
    });
    if (!upstream.ok) {
      res.status(upstream.status).send('Upstream returned ' + upstream.status);
      return;
    }
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(buf);
  } catch (e) {
    res.status(500).send('Proxy error: ' + (e && e.message ? e.message : String(e)));
  }
}
