// api/upstox/[...path].js
//
// Vercel catch-all serverless function. Any request to /api/upstox/* lands
// here — e.g. /api/upstox/v2/market-quote/ltp — and gets forwarded to
// https://api.upstox.com/v2/market-quote/ltp with the Analytics Token
// attached server-side. The browser never sees the token.
//
// Setup:
//   Vercel dashboard → Project → Settings → Environment Variables →
//   add UPSTOX_ANALYTICS_TOKEN = <your Analytics Token> → redeploy.
//
// No vercel.json needed — this file's path (api/upstox/[...path].js) is
// automatically routed by Vercel to match /api/upstox/*.

export default async function handler(req, res) {
  const token = process.env.UPSTOX_ANALYTICS_TOKEN;

  if (!token) {
    res.status(500).json({ error: "UPSTOX_ANALYTICS_TOKEN is not set on the server." });
    return;
  }

  const { path, ...query } = req.query;
  const upstreamPath = Array.isArray(path) ? path.join("/") : path;

  if (!upstreamPath) {
    res.status(400).json({ error: "Missing upstream Upstox path." });
    return;
  }

  const qs = new URLSearchParams(query).toString();
  const url = `https://api.upstox.com/${upstreamPath}${qs ? `?${qs}` : ""}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    const body = await upstream.text();
    res.status(upstream.status).setHeader("Content-Type", "application/json").send(body);
  } catch (err) {
    res.status(502).json({ error: "Failed to reach Upstox API", details: err.message });
  }
}
