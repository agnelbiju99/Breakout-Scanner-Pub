// Vercel serverless function — Upstox API proxy
// Forwards all requests to Upstox v2 API with server-side token
// URL: /api/upstox-proxy/historical-candle/...
//      /api/upstox-proxy/instruments/search?...
//      /api/upstox-proxy/market-quote/ltp?...
//
// Set UPSTOX_TOKEN in Vercel environment variables (Settings → Environment Variables)
// Token must be renewed daily — set it fresh each morning before scanning

const https = require('https');

const UPSTOX_BASE = 'https://api.upstox.com/v2';
const TOKEN = process.env.UPSTOX_ANALYTICS_TOKEN || '';

function fetchUpstox(path, ms = 15000) {
  return new Promise((resolve, reject) => {
    const url = `${UPSTOX_BASE}${path}`;
    const req = https.get(url, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      timeout: ms,
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!TOKEN) {
    return res.status(500).json({
      error: 'UPSTOX_TOKEN not set. Add it in Vercel → Settings → Environment Variables.'
    });
  }

  // Extract the path after /api/upstox-proxy
  // e.g. /api/upstox-proxy/historical-candle/...
  //   → /historical-candle/...
  const url = new URL(req.url, 'http://localhost');
  let upstoxPath = url.pathname.replace(/^\/api\/upstox-proxy/, '');

  // Preserve query string
  const qs = url.search || '';
  const fullPath = upstoxPath + qs;

  if (!fullPath || fullPath === '/') {
    return res.status(400).json({ error: 'No Upstox path specified' });
  }

  try {
    const result = await fetchUpstox(fullPath);

    // Pass through status and body from Upstox
    res.setHeader('Cache-Control', 'public, max-age=30'); // cache 30s for candle data
    return res.status(result.status).send(result.body);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
