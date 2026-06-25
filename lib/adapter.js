// =============================================================================
// Shared Vercel serverless adapter over lib/core.js.
// -----------------------------------------------------------------------------
// Used by the route files in /api. We derive the path from req.url (reliable on
// Vercel) and thread the client IP through for the admin rate limiter.
//
// Routing note: a single multi-segment catch-all (api/[...path].js) only matched
// one path segment on this project, so /api/admin/* 404'd. We instead use nested
// single-segment dynamic routes (api/[action].js + api/admin/[action].js), which
// both funnel here.
// =============================================================================
const { handle } = require('./core.js');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const path = (req.url || '').split('?')[0];

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    (req.socket && req.socket.remoteAddress) || 'unknown';

  try {
    const { status, json } = await handle({
      method: req.method,
      path,
      body: body || {},
      authHeader: req.headers['authorization'],
      ip,
    });
    res.statusCode = status;
    if (json === null) return res.end();
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(json));
  } catch (err) {
    console.error('[Nebula] error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Server error.' }));
  }
};
