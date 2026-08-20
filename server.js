// =============================================================================
// Standalone HTTP server — runs the whole app from one Node process.
// -----------------------------------------------------------------------------
// Serves the static site in public/ and routes /api/* through lib/core.js, the
// same handler the Vercel serverless functions use. This is what runs on
// long-lived hosts like Railway / Render: `npm start` -> `node server.js`,
// binding to process.env.PORT.
//
// Without persistent storage, accounts live in memory and reset when the process
// restarts. On Railway, attach Postgres and reference its DATABASE_URL variable.
// =============================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const { handle } = require('./lib/core.js');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"
  );
}

function readBody(req) {
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => {
      d += c;
      if (d.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(d ? JSON.parse(d) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  cors(res);
  securityHeaders(res);
  const pathname = req.url.split('?')[0];

  // /api/* is JSON; the link-cloaking gateway is served at /<token> (root) and
  // the legacy /go/<token>. All funnel through lib/core.js handle(). The
  // root-token pattern is a long alphanumeric single segment, which never
  // collides with the app's static files (they have extensions) or its short
  // page routes (/admin, /app, /index).
  const GATEWAY_TOKEN = /^\/(?:go\/)?[A-Za-z0-9]{16,64}$/;
  if (pathname.startsWith('/api/') || GATEWAY_TOKEN.test(pathname)) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }
    const body = req.method === 'POST' ? await readBody(req) : {};
    try {
      const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
        req.socket.remoteAddress || 'unknown';
      const result = await handle({
        method: req.method,
        path: pathname,
        body,
        authHeader: req.headers['authorization'],
        ip,
      });
      const { status, json, body: rawBody, contentType, location, headers } = result;
      res.statusCode = status;
      if (headers) for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
      if (location) {
        res.setHeader('Location', location);
        return res.end();
      }
      if (typeof rawBody === 'string') {
        res.setHeader('Content-Type', contentType || 'text/html; charset=utf-8');
        return res.end(rawBody);
      }
      if (json === null || json === undefined) return res.end();
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(json));
    } catch (err) {
      console.error('[Scale XT] error:', err);
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: 'Server error.' }));
    }
  }

  // static
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/index.html';
  // Clean URLs (mirrors Vercel's cleanUrls): /admin -> /admin.html, so links
  // like <a href="/admin"> resolve to the file when served from this host.
  if (!path.extname(rel)) rel = rel.replace(/\/$/, '') + '.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.statusCode = 404;
      return res.end('Not found');
    }
    res.setHeader('Content-Type', MIME[path.extname(filePath)] || 'application/octet-stream');
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`[Scale XT] Server listening on http://localhost:${PORT}`);
});
