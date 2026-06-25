// =============================================================================
// Standalone HTTP server — runs the whole app from one Node process.
// -----------------------------------------------------------------------------
// Serves the static site in public/ and routes /api/* through lib/core.js, the
// same handler the Vercel serverless functions use. This is what runs on
// long-lived hosts like Railway / Render: `npm start` -> `node server.js`,
// binding to process.env.PORT.
//
// Without a KV/Upstash store configured (env vars), accounts live in memory and
// reset when the process restarts — fine for local testing, NOT for production.
// On Railway, provision an Upstash Redis and set UPSTASH_REDIS_REST_URL /
// UPSTASH_REDIS_REST_TOKEN so accounts persist across restarts/deploys.
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
  const pathname = req.url.split('?')[0];

  if (pathname.startsWith('/api/')) {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }
    const body = req.method === 'POST' ? await readBody(req) : {};
    try {
      const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
        req.socket.remoteAddress || 'unknown';
      const { status, json } = await handle({
        method: req.method,
        path: pathname,
        body,
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
      return res.end(JSON.stringify({ error: 'Server error.' }));
    }
  }

  // static
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/index.html';
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
  console.log(`[Nebula] Server listening on http://localhost:${PORT}`);
});
