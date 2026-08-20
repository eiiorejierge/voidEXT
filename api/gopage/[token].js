// Vercel route for the public gateway page at /go/<token>.
// A rewrite in vercel.json maps /go/:token -> /api/gopage/:token. We call the
// shared core handler with the original /go/<token> path so the exact same
// branded interstitial is produced as on the standalone server.
const { handle } = require('../../lib/core.js');

module.exports = async (req, res) => {
  const token = (req.query && req.query.token) ||
    (req.url || '').split('?')[0].split('/').pop();
  const result = await handle({ method: 'GET', path: '/go/' + token, body: {}, ip: '' });
  res.statusCode = result.status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', result.contentType || 'text/html; charset=utf-8');
  return res.end(result.body || '');
};
