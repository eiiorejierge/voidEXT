// Vercel route for the gateway page. Rewrites in vercel.json map both
// /:token and /go/:token here. We call the shared core handler with the
// canonical /<token> path so the exact same owner-locked gateway page is
// produced as on the standalone server, and forward its headers (the relaxed
// CSP that lets the target site load in the frame).
const { handle } = require('../../lib/core.js');

module.exports = async (req, res) => {
  const token = (req.query && req.query.token) ||
    (req.url || '').split('?')[0].split('/').pop();
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    (req.socket && req.socket.remoteAddress) || '';
  const result = await handle({ method: 'GET', path: '/' + token, body: {}, ip });
  res.statusCode = result.status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', result.contentType || 'text/html; charset=utf-8');
  if (result.headers) {
    for (const [k, v] of Object.entries(result.headers)) res.setHeader(k, v);
  }
  return res.end(result.body || '');
};
