// =============================================================================
// voidEXT core logic (framework-agnostic)
// -----------------------------------------------------------------------------
// Exposes handle({ method, path, body, authHeader }) -> { status, json }.
// Both the Vercel serverless function (api/[...path].js) and the local dev
// server (dev-server.js) are thin adapters over this.
// =============================================================================

const crypto = require('crypto');
const store = require('./store.js');
const RAW_LINKS = require('./links.js');

// ---- Config -----------------------------------------------------------------
// Daily quota. RATE_LIMIT_ENABLED is OFF for now so you can test freely.
// When you turn it back on: each account may generate LINKS_PER_DAY links per
// UTC day, and refreshing replaces (removes) the previous set.
const RATE_LIMIT_ENABLED = false;
const LINKS_PER_DAY = 10;
const LINKS_PER_BATCH = 10;

const ADMIN_KEY = process.env.ADMIN_KEY || 'void-admin';

// ---- Per-account settings ---------------------------------------------------
const DEFAULT_SETTINGS = {
  theme: 'sunset', // sunset | day | night (beach times-of-day)
  openInNewTab: true,
  batchSize: 10, // how many links "Generate" returns (1-20)
  confirmReport: false, // ask before reporting a link as blocked
};
function sanitizeSettings(input) {
  const s = Object.assign({}, DEFAULT_SETTINGS);
  if (input && typeof input === 'object') {
    if (['sunset', 'day', 'night'].includes(input.theme)) s.theme = input.theme;
    if (typeof input.openInNewTab === 'boolean') s.openInNewTab = input.openInNewTab;
    if (typeof input.confirmReport === 'boolean') s.confirmReport = input.confirmReport;
    const n = parseInt(input.batchSize, 10);
    if (!isNaN(n)) s.batchSize = Math.max(1, Math.min(20, n));
  }
  return s;
}
function settingsOf(user) {
  return sanitizeSettings(user && user.settings);
}

// ---- Link pool: clean + dedupe ----------------------------------------------
function cleanLinks(list) {
  const seen = new Set();
  const out = [];
  for (let url of list) {
    if (typeof url !== 'string') continue;
    url = url.trim();
    if (!url) continue;
    if (/^https?:\/\/www\.w3\.org\//i.test(url)) continue; // SVG namespaces, not destinations
    if (!/^https?:\/\//i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}
const LINKS = cleanLinks(RAW_LINKS);

// ---- Auth helpers -----------------------------------------------------------
function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(password, salt, expectedHash) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function newToken() {
  return crypto.randomBytes(32).toString('hex');
}
function validUsername(u) {
  return typeof u === 'string' && /^[a-zA-Z0-9_.-]{3,32}$/.test(u);
}
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function bearer(authHeader) {
  const m = (authHeader || '').match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

async function getUser(key) {
  const raw = await store.get(`user:${key}`);
  return raw ? JSON.parse(raw) : null;
}
async function putUser(key, user) {
  await store.set(`user:${key}`, JSON.stringify(user));
}
async function userFromAuth(authHeader) {
  const token = bearer(authHeader);
  if (!token) return null;
  const key = await store.get(`token:${token}`);
  if (!key) return null;
  const user = await getUser(key);
  return user ? { key, user } : null;
}

// ---- Link rotation ----------------------------------------------------------
async function activeLinks() {
  const blocked = new Set(await store.smembers('blocked'));
  return LINKS.filter((u) => !blocked.has(u));
}
async function nextBatch(count) {
  const pool = await activeLinks();
  if (pool.length === 0) return { batch: [], poolSize: 0 };
  const n = Math.min(count, pool.length);
  const after = await store.incrby('rotation', n); // atomic across instances
  const start = (((after - n) % pool.length) + pool.length) % pool.length;
  const batch = [];
  for (let i = 0; i < n; i++) batch.push(pool[(start + i) % pool.length]);
  return { batch, poolSize: pool.length };
}

// ---- Router -----------------------------------------------------------------
async function handle({ method, path, body, authHeader }) {
  body = body || {};
  const p = '/' + path.replace(/^\/+|\/+$/g, '');

  if (method === 'OPTIONS') return { status: 204, json: null };

  // signup
  if (p === '/api/signup' && method === 'POST') {
    const { username, password } = body;
    if (!validUsername(username))
      return { status: 400, json: { error: 'Username must be 3-32 chars (letters, numbers, _ . -).' } };
    if (typeof password !== 'string' || password.length < 4)
      return { status: 400, json: { error: 'Password must be at least 4 characters.' } };
    const key = username.toLowerCase();
    if (await getUser(key)) return { status: 409, json: { error: 'That username is already taken.' } };
    const { salt, hash } = hashPassword(password);
    const settings = Object.assign({}, DEFAULT_SETTINGS);
    await putUser(key, { username, salt, hash, created: Date.now(), usage: {}, settings });
    const token = newToken();
    await store.set(`token:${token}`, key);
    return { status: 200, json: { token, username, settings } };
  }

  // login
  if (p === '/api/login' && method === 'POST') {
    const { username, password } = body;
    const key = typeof username === 'string' ? username.toLowerCase() : '';
    const user = key ? await getUser(key) : null;
    if (!user || !verifyPassword(password || '', user.salt, user.hash))
      return { status: 401, json: { error: 'Incorrect username or password.' } };
    const token = newToken();
    await store.set(`token:${token}`, key);
    return { status: 200, json: { token, username: user.username, settings: settingsOf(user) } };
  }

  // whoami
  if (p === '/api/me' && method === 'GET') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    return { status: 200, json: { username: auth.user.username, settings: settingsOf(auth.user) } };
  }

  // save settings
  if (p === '/api/settings' && method === 'POST') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    const settings = sanitizeSettings(body.settings || body);
    auth.user.settings = settings;
    await putUser(auth.key, auth.user);
    return { status: 200, json: { ok: true, settings } };
  }

  // logout
  if (p === '/api/logout' && method === 'POST') {
    const token = bearer(authHeader);
    if (token) await store.del(`token:${token}`);
    return { status: 200, json: { ok: true } };
  }

  // generate links
  if (p === '/api/links' && method === 'GET') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    const { key, user } = auth;
    const day = todayKey();
    user.usage = user.usage || {};
    const usedToday = user.usage[day] || 0;

    if (RATE_LIMIT_ENABLED && usedToday >= LINKS_PER_DAY)
      return {
        status: 429,
        json: { error: `Daily limit reached (${LINKS_PER_DAY}/day). Try again tomorrow.`, remaining: 0, limit: LINKS_PER_DAY },
      };

    const batchSize = settingsOf(user).batchSize || LINKS_PER_BATCH;
    const { batch, poolSize } = await nextBatch(batchSize);
    if (RATE_LIMIT_ENABLED) {
      user.usage[day] = usedToday + batch.length;
      await putUser(key, user);
    }
    return {
      status: 200,
      json: {
        links: batch,
        poolSize,
        rateLimit: RATE_LIMIT_ENABLED,
        remaining: RATE_LIMIT_ENABLED ? Math.max(0, LINKS_PER_DAY - (user.usage[day] || 0)) : null,
        limit: RATE_LIMIT_ENABLED ? LINKS_PER_DAY : null,
      },
    };
  }

  // report a blocked / dead link
  if (p === '/api/report' && method === 'POST') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    const { url } = body;
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url))
      return { status: 400, json: { error: 'Invalid url.' } };
    await store.sadd('blocked', url);
    await store.rpush('reports', JSON.stringify({ url, by: auth.user.username, at: Date.now() }));
    const pool = await activeLinks();
    console.log(`[voidEXT] BLOCKED reported by ${auth.user.username}: ${url}`);
    return { status: 200, json: { ok: true, poolSize: pool.length } };
  }

  // admin: list blocked + reports
  if (p === '/api/admin/blocked' && method === 'GET') {
    if (bearer(authHeader) !== ADMIN_KEY) return { status: 401, json: { error: 'Bad admin key.' } };
    const blocked = await store.smembers('blocked');
    const reportsRaw = await store.lrange('reports', 0, -1);
    const reports = reportsRaw.map((r) => {
      try {
        return JSON.parse(r);
      } catch (e) {
        return r;
      }
    });
    return { status: 200, json: { blocked, reports, totalLinks: LINKS.length, activeLinks: LINKS.length - blocked.length } };
  }

  // admin: restore a link to rotation
  if (p === '/api/admin/unblock' && method === 'POST') {
    if (bearer(authHeader) !== ADMIN_KEY) return { status: 401, json: { error: 'Bad admin key.' } };
    const { url } = body;
    if (url) await store.srem('blocked', url);
    const pool = await activeLinks();
    return { status: 200, json: { ok: true, activeLinks: pool.length } };
  }

  return { status: 404, json: { error: 'Unknown endpoint.' } };
}

module.exports = { handle, LINKS, RATE_LIMIT_ENABLED, LINKS_PER_DAY };
