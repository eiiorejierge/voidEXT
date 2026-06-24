// Vercel serverless function — catch-all for /api/*
// Thin adapter over lib/core.js. Handles CORS so the bookmarklet can call it
// from any page it's run on.
const { handle } = require('../lib/core.js');

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

  // Derive the path from req.url (reliable on Vercel), falling back to the
  // catch-all segments if needed.
  let path = (req.url || '').split('?')[0];
  if (!path.startsWith('/api/')) {
    const segs = req.query && req.query.path ? [].concat(req.query.path) : [];
    path = '/api/' + segs.join('/');
  }

  // Vercel parses JSON bodies automatically; guard for string/empty.
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }

  try {
    const { status, json } = await handle({
      method: req.method,
      path,
      body: body || {},
      authHeader: req.headers['authorization'],
    });
    res.statusCode = status;
    if (json === null) return res.end();
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(json));
  } catch (err) {
    console.error('[voidEXT] error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Server error.' }));
  }
};
