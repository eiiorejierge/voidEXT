// =============================================================================
// Nebula core logic (framework-agnostic)
// -----------------------------------------------------------------------------
// Exposes handle({ method, path, body, authHeader }) -> { status, json }.
// Both the Vercel serverless function (api/[...path].js) and the standalone
// server (server.js) are thin adapters over this.
// =============================================================================

const crypto = require('crypto');
const store = require('./store.js');
const RAW_LINKS = require('./links.js');
const VERSION = require('./version.js');

// ---- Config -----------------------------------------------------------------
// Daily quota. RATE_LIMIT_ENABLED is OFF for now so you can test freely.
// When you turn it back on: each account may generate LINKS_PER_DAY links per
// UTC day, and refreshing replaces (removes) the previous set.
const RATE_LIMIT_ENABLED = true; // daily quota is ON
const LINKS_PER_DAY = 5; // each account may generate 5 links per UTC day
const LINKS_PER_BATCH = 5;

// Admin code. Defaults to 7238; override with the ADMIN_KEY env var if you want.
const ADMIN_KEY = process.env.ADMIN_KEY || '7238';
// Brute-force protection on the admin gate: N failed attempts from one IP locks
// that IP out of admin endpoints for LOCK_SECONDS.
const ADMIN_MAX_ATTEMPTS = 5;
const ADMIN_LOCK_SECONDS = 3600; // 1 hour

// Input caps (guard against abuse / scrypt CPU-DoS on huge passwords).
const MAX_PASSWORD = 256;
const MAX_URL = 2048;

// ---- Per-account settings ---------------------------------------------------
const DEFAULT_SETTINGS = {
  theme: 'void', // void | nebula | eclipse (black & white space)
  openInNewTab: true,
  batchSize: LINKS_PER_DAY, // how many links "Generate" returns (1-5, capped by daily quota)
  confirmReport: false, // ask before reporting a link as blocked
};
function sanitizeSettings(input) {
  const s = Object.assign({}, DEFAULT_SETTINGS);
  if (input && typeof input === 'object') {
    if (['void', 'nebula', 'eclipse'].includes(input.theme)) s.theme = input.theme;
    if (typeof input.openInNewTab === 'boolean') s.openInNewTab = input.openInNewTab;
    if (typeof input.confirmReport === 'boolean') s.confirmReport = input.confirmReport;
  }
  s.batchSize = LINKS_PER_DAY; // fixed: 5 per day, not user-configurable
  return s;
}
function settingsOf(user) {
  return sanitizeSettings(user && user.settings);
}
function accountInfo(user) {
  const day = new Date().toISOString().slice(0, 10);
  const used = (user && user.usage && user.usage[day]) || 0;
  const bonus = (user && user.bonus) || 0;
  return {
    created: (user && user.created) || null,
    used,
    bonus, // refunded "extra link tokens" from confirmed blocked reports
    remaining: Math.max(0, LINKS_PER_DAY - used) + bonus,
    limit: LINKS_PER_DAY,
  };
}
function unread(user) {
  return ((user && user.notifications) || []).filter((n) => !n.read).length;
}
// Reports are stored as individual records (report:<id>) indexed by 'reportids'
// so their status (pending/confirmed/denied) can be updated.
async function listReports() {
  const ids = (await store.lrange('reportids', 0, -1)) || [];
  const out = [];
  for (const id of ids) {
    const raw = await store.get(`report:${id}`);
    if (!raw) continue;
    try { out.push(JSON.parse(raw)); } catch (e) {}
  }
  return out;
}
async function listBugs() {
  const ids = (await store.lrange('bugids', 0, -1)) || [];
  const out = [];
  for (const id of ids) {
    const raw = await store.get(`bug:${id}`);
    if (!raw) continue;
    try { out.push(JSON.parse(raw)); } catch (e) {}
  }
  return out;
}
// Every account key (SCAN catches accounts created before the 'users' index).
async function scanUserKeys() {
  let keys = [];
  try {
    const scanned = await store.scan('user:*');
    keys = (scanned || []).map((k) => k.replace(/^user:/, ''));
  } catch (e) {
    keys = [];
  }
  if (!keys.length) keys = (await store.smembers('users')) || [];
  return keys;
}
async function pushNotification(userKey, text, extra) {
  const u = await getUser(userKey);
  if (!u) return false;
  u.notifications = u.notifications || [];
  u.notifications.push(Object.assign({ id: crypto.randomBytes(5).toString('hex'), text, at: Date.now(), read: false }, extra || {}));
  if (u.notifications.length > 50) u.notifications = u.notifications.slice(-50);
  await putUser(userKey, u);
  return true;
}

// ---- Direct messages: text-style conversations ------------------------------
// A conversation between two users is one record keyed by their two (lowercased)
// keys sorted + joined, so either side resolves to the same thread. Each user
// also keeps a set of conversation partners for listing their inbox. Messages
// land in the thread — NOT in the recipient's notifications.
function convoId(k1, k2) { return [k1, k2].sort().join('|'); }
async function getConvo(id) {
  const raw = await store.get(`convo:${id}`);
  return raw ? JSON.parse(raw) : null;
}
async function putConvo(id, c) { await store.set(`convo:${id}`, JSON.stringify(c)); }
function convoUnread(c, key) {
  const lr = (c && c.lastRead && c.lastRead[key]) || 0;
  return ((c && c.messages) || []).filter((m) => m.fromKey !== key && m.at > lr).length;
}
async function totalUnreadMessages(key) {
  const partners = (await store.smembers(`convos:${key}`)) || [];
  let total = 0;
  for (const pk of partners) {
    const c = await getConvo(convoId(key, pk));
    if (c) total += convoUnread(c, key);
  }
  return total;
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
  // Random sample without replacement (genuinely random, not sequential).
  const picked = new Set();
  const batch = [];
  while (batch.length < n && picked.size < pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    if (picked.has(i)) continue;
    picked.add(i);
    batch.push(pool[i]);
  }
  return { batch, poolSize: pool.length };
}

// ---- Router -----------------------------------------------------------------
async function handle({ method, path, body, authHeader, ip }) {
  body = body || {};
  ip = ip || 'unknown';
  const p = '/' + path.replace(/^\/+|\/+$/g, '');

  if (method === 'OPTIONS') return { status: 204, json: null };

  // signup
  if (p === '/api/signup' && method === 'POST') {
    const { username, password } = body;
    if (!validUsername(username))
      return { status: 400, json: { error: 'Username must be 3-32 chars (letters, numbers, _ . -).' } };
    if (typeof password !== 'string' || password.length < 4)
      return { status: 400, json: { error: 'Password must be at least 4 characters.' } };
    if (password.length > MAX_PASSWORD)
      return { status: 400, json: { error: 'Password is too long.' } };
    const key = username.toLowerCase();
    if (await getUser(key)) return { status: 409, json: { error: 'That username is already taken.' } };
    const { salt, hash } = hashPassword(password);
    const settings = Object.assign({}, DEFAULT_SETTINGS);
    await putUser(key, { username, salt, hash, created: Date.now(), usage: {}, settings, links: [] });
    await store.sadd('users', key); // index for admin enumeration
    const token = newToken();
    await store.set(`token:${token}`, key);
    return { status: 200, json: { token, username, settings, links: [], account: accountInfo({ created: Date.now(), usage: {} }), notifications: [], unread: 0, messagesUnread: 0 } };
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
    return { status: 200, json: { token, username: user.username, settings: settingsOf(user), links: user.links || [], account: accountInfo(user), notifications: user.notifications || [], unread: unread(user), messagesUnread: await totalUnreadMessages(key) } };
  }

  // whoami
  if (p === '/api/me' && method === 'GET') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    return { status: 200, json: { username: auth.user.username, settings: settingsOf(auth.user), links: auth.user.links || [], account: accountInfo(auth.user), notifications: auth.user.notifications || [], unread: unread(auth.user), messagesUnread: await totalUnreadMessages(auth.key) } };
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
    user.links = Array.isArray(user.links) ? user.links : [];
    const usedToday = user.usage[day] || 0;
    const bonus = user.bonus || 0;
    const baseRemaining = Math.max(0, LINKS_PER_DAY - usedToday);
    const totalRemaining = baseRemaining + bonus; // daily quota + refunded tokens

    if (RATE_LIMIT_ENABLED && totalRemaining <= 0)
      return {
        status: 429,
        json: { error: `Daily limit reached (${LINKS_PER_DAY}/day). Try again tomorrow.`, links: user.links, added: null, remaining: 0, limit: LINKS_PER_DAY },
      };

    // Generate ONE link and append it to the user's existing list (don't replace).
    const pool = await activeLinks();
    let added = null;
    for (let i = 0; i < 12 && pool.length; i++) {
      const { batch } = await nextBatch(1);
      if (!batch.length) break;
      if (!user.links.includes(batch[0])) { added = batch[0]; break; }
    }
    if (!added) added = pool.find((u) => !user.links.includes(u)) || null;

    if (!added) {
      // Nothing new to give — don't spend a token.
      const info = accountInfo(user);
      return {
        status: 200,
        json: { links: user.links, added: null, poolSize: pool.length, note: 'No new links available right now.', rateLimit: RATE_LIMIT_ENABLED, remaining: RATE_LIMIT_ENABLED ? info.remaining : null, limit: LINKS_PER_DAY },
      };
    }

    user.links.push(added);
    if (RATE_LIMIT_ENABLED) {
      // Spend daily quota first, then a refunded bonus token.
      if (baseRemaining > 0) user.usage[day] = usedToday + 1;
      else user.bonus = Math.max(0, bonus - 1);
    }
    await putUser(key, user);
    const info = accountInfo(user);
    return {
      status: 200,
      json: {
        links: user.links,
        added,
        poolSize: pool.length,
        rateLimit: RATE_LIMIT_ENABLED,
        remaining: RATE_LIMIT_ENABLED ? info.remaining : null,
        limit: RATE_LIMIT_ENABLED ? LINKS_PER_DAY : null,
      },
    };
  }

  // report dead/blocked link(s) — creates PENDING reports for admin review.
  // Does NOT block anything; nothing changes until an admin confirms.
  if (p === '/api/report' && method === 'POST') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    const urls = Array.isArray(body.urls) ? body.urls : body.url ? [body.url] : [];
    const valid = urls.filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u) && u.length <= MAX_URL);
    if (!valid.length) return { status: 400, json: { error: 'Select at least one valid link.' } };
    let count = 0;
    for (const url of valid) {
      const id = crypto.randomBytes(6).toString('hex');
      const rep = { id, url, by: auth.user.username, at: Date.now(), status: 'pending' };
      await store.set(`report:${id}`, JSON.stringify(rep));
      await store.rpush('reportids', id);
      count++;
      console.log(`[Nebula] REPORT (pending) by ${auth.user.username}: ${url}`);
    }
    return { status: 200, json: { ok: true, reported: count, pending: true } };
  }

  // submit a bug report (earn up to 10 link tokens if the admin rewards it)
  if (p === '/api/bug' && method === 'POST') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    let text = typeof body.text === 'string' ? body.text.trim() : '';
    if (text.length < 5) return { status: 400, json: { error: 'Describe the bug in a bit more detail.' } };
    if (text.length > 2000) text = text.slice(0, 2000);
    const id = crypto.randomBytes(6).toString('hex');
    const bug = { id, by: auth.user.username, text, at: Date.now(), status: 'open', tokens: 0 };
    await store.set(`bug:${id}`, JSON.stringify(bug));
    await store.rpush('bugids', id);
    console.log(`[Nebula] BUG by ${auth.user.username}: ${text.slice(0, 80)}`);
    return { status: 200, json: { ok: true } };
  }

  // notifications: list
  if (p === '/api/notifications' && method === 'GET') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    return { status: 200, json: { notifications: auth.user.notifications || [] } };
  }

  // notifications: mark all read
  if (p === '/api/notifications/read' && method === 'POST') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    (auth.user.notifications || []).forEach((n) => { n.read = true; });
    await putUser(auth.key, auth.user);
    return { status: 200, json: { ok: true } };
  }

  // list usernames for autocomplete (logged-in users only)
  if (p === '/api/users' && method === 'GET') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    const keys = await scanUserKeys();
    const names = [];
    for (const k of keys) {
      const u = await getUser(k);
      if (u && u.username) names.push(u.username);
    }
    names.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    return { status: 200, json: { usernames: names } };
  }

  // send a message to another user — lands in the conversation thread, NOT in
  // the recipient's notifications. Texting-style: open a thread, see the
  // history, reply back and forth.
  if (p === '/api/message' && method === 'POST') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    const to = typeof body.to === 'string' ? body.to.toLowerCase() : '';
    let text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!to) return { status: 400, json: { error: 'Pick a recipient.' } };
    if (!text) return { status: 400, json: { error: 'Enter a message.' } };
    if (to === auth.key) return { status: 400, json: { error: "You can't message yourself." } };
    if (text.length > 1000) text = text.slice(0, 1000);
    const recipient = await getUser(to);
    if (!recipient) return { status: 404, json: { error: 'User not found.' } };
    const id = convoId(auth.key, to);
    const c = (await getConvo(id)) || { users: [auth.key, to], messages: [], lastRead: {} };
    const m = { id: crypto.randomBytes(6).toString('hex'), from: auth.user.username, fromKey: auth.key, text, at: Date.now() };
    c.messages.push(m);
    if (c.messages.length > 500) c.messages = c.messages.slice(-500);
    c.lastRead = c.lastRead || {};
    c.lastRead[auth.key] = m.at; // sender has implicitly read up to their own message
    await putConvo(id, c);
    await store.sadd(`convos:${auth.key}`, to);
    await store.sadd(`convos:${to}`, auth.key);
    await store.del(`typing:${id}:${auth.key}`); // sending a message means we stopped typing
    return {
      status: 200,
      json: { ok: true, with: recipient.username, message: { id: m.id, text: m.text, at: m.at, mine: true, from: m.from } },
    };
  }

  // inbox: list this user's conversations (newest activity first) + unread total
  if (p === '/api/messages' && method === 'GET') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    const partners = (await store.smembers(`convos:${auth.key}`)) || [];
    const conversations = [];
    let unreadTotal = 0;
    for (const pk of partners) {
      const cid = convoId(auth.key, pk);
      const c = await getConvo(cid);
      if (!c || !c.messages || !c.messages.length) continue;
      const last = c.messages[c.messages.length - 1];
      const u = await getUser(pk);
      const unread = convoUnread(c, auth.key);
      unreadTotal += unread;
      conversations.push({
        with: (u && u.username) || pk,
        last: { text: last.text, at: last.at, mine: last.fromKey === auth.key },
        unread,
        online: Boolean(await store.get(`online:${pk}`)),
        typing: Boolean(await store.get(`typing:${cid}:${pk}`)),
        at: last.at,
      });
    }
    conversations.sort((a, b) => b.at - a.at);
    return { status: 200, json: { conversations, unread: unreadTotal } };
  }

  // unread message count (for the sidebar badge — cheap to poll)
  if (p === '/api/messages/unread' && method === 'GET') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    return { status: 200, json: { unread: await totalUnreadMessages(auth.key) } };
  }

  // open a thread: full message history with one user, and mark it read
  if (p === '/api/messages/thread' && method === 'POST') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    const withName = typeof body.with === 'string' ? body.with.trim() : '';
    const withKey = withName.toLowerCase();
    if (!withKey) return { status: 400, json: { error: 'Pick a conversation.' } };
    if (withKey === auth.key) return { status: 400, json: { error: "You can't message yourself." } };
    const other = await getUser(withKey);
    if (!other) return { status: 404, json: { error: 'User not found.' } };
    const id = convoId(auth.key, withKey);
    const c = (await getConvo(id)) || { users: [auth.key, withKey], messages: [], lastRead: {} };
    // Mark read up to the latest message (only write if it actually changed, so
    // polling this endpoint doesn't hammer the store).
    const lastAt = c.messages.length ? c.messages[c.messages.length - 1].at : 0;
    c.lastRead = c.lastRead || {};
    if ((c.lastRead[auth.key] || 0) !== lastAt) {
      c.lastRead[auth.key] = lastAt;
      await putConvo(id, c);
    }
    // Is the OTHER person typing right now? (short-lived flag, see /typing)
    const typing = Boolean(await store.get(`typing:${id}:${withKey}`));
    const online = Boolean(await store.get(`online:${withKey}`));
    return {
      status: 200,
      json: {
        with: other.username,
        typing,
        online,
        messages: (c.messages || []).map((m) => ({ id: m.id, text: m.text, at: m.at, mine: m.fromKey === auth.key, from: m.from })),
      },
    };
  }

  // "user is typing" ping — sets a flag that auto-expires in a few seconds, so
  // the other side's thread poll can show a typing indicator. Stored in its own
  // key (not the convo record) to avoid rewriting/raceing the message history.
  if (p === '/api/messages/typing' && method === 'POST') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    const withKey = typeof body.with === 'string' ? body.with.toLowerCase() : '';
    if (!withKey || withKey === auth.key) return { status: 200, json: { ok: true } };
    const id = convoId(auth.key, withKey);
    await store.set(`typing:${id}:${auth.key}`, '1');
    await store.expire(`typing:${id}:${auth.key}`, 4);
    return { status: 200, json: { ok: true } };
  }

  // presence heartbeat — marks this user "online" for ~35s. The client pings
  // this on a short interval; absence of the key means offline.
  if (p === '/api/heartbeat' && method === 'POST') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    await store.set(`online:${auth.key}`, '1');
    await store.expire(`online:${auth.key}`, 35);
    return { status: 200, json: { ok: true } };
  }

  // notifications: dismiss ONE by id (server stops displaying it)
  if (p === '/api/notifications/dismiss' && method === 'POST') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    const id = typeof body.id === 'string' ? body.id : '';
    auth.user.notifications = (auth.user.notifications || []).filter((n) => n.id !== id);
    await putUser(auth.key, auth.user);
    return { status: 200, json: { ok: true, notifications: auth.user.notifications, count: auth.user.notifications.length } };
  }

  // notifications: clear all
  if (p === '/api/notifications/clear' && method === 'POST') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    auth.user.notifications = [];
    await putUser(auth.key, auth.user);
    return { status: 200, json: { ok: true } };
  }

  // health / store-connectivity check (no secrets leaked)
  if (p === '/api/health' && method === 'GET') {
    return { status: 200, json: { ok: true, storeConnected: store.hasStore, version: VERSION } };
  }

  // current (latest) app version
  if (p === '/api/version' && method === 'GET') {
    return { status: 200, json: { version: VERSION } };
  }

  // latest bookmarklet code — lets the popup self-update (show the new
  // "javascript:..." string to paste over the bookmark) without visiting the site.
  if (p === '/api/bookmarklet' && method === 'GET') {
    let code = '';
    try { code = require('./bookmarklet.gen.js'); } catch (e) { code = ''; }
    return { status: 200, json: { version: VERSION, code } };
  }

  // live vault stats for the logged-in user
  if (p === '/api/stats' && method === 'GET') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    const blocked = await store.smembers('blocked');
    return {
      status: 200,
      json: Object.assign(
        {
          totalLinks: LINKS.length,
          poolSize: LINKS.length - blocked.length,
          blockedCount: blocked.length,
        },
        accountInfo(auth.user)
      ),
    };
  }

  // change password
  if (p === '/api/password' && method === 'POST') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    const { current, newPassword } = body;
    if (!verifyPassword(current || '', auth.user.salt, auth.user.hash))
      return { status: 401, json: { error: 'Current password is incorrect.' } };
    if (typeof newPassword !== 'string' || newPassword.length < 4)
      return { status: 400, json: { error: 'New password must be at least 4 characters.' } };
    if (newPassword.length > MAX_PASSWORD)
      return { status: 400, json: { error: 'New password is too long.' } };
    const { salt, hash } = hashPassword(newPassword);
    auth.user.salt = salt;
    auth.user.hash = hash;
    await putUser(auth.key, auth.user);
    return { status: 200, json: { ok: true } };
  }

  // ---- admin (all require the admin code; brute-force locked per IP) ----
  if (p.startsWith('/api/admin/')) {
    const failKey = `adminfail:${ip}`;
    const fails = parseInt((await store.get(failKey)) || '0', 10);

    // Already locked out?
    if (fails >= ADMIN_MAX_ATTEMPTS) {
      let ttl = await store.ttl(failKey);
      if (!ttl || ttl < 0) ttl = ADMIN_LOCK_SECONDS;
      return {
        status: 429,
        json: { error: `Too many attempts. This IP is locked for ~${Math.ceil(ttl / 60)} min.`, lockedFor: ttl },
      };
    }

    // Wrong code → count the failure (and start the 1h window on first miss).
    if (bearer(authHeader) !== ADMIN_KEY) {
      const n = await store.incr(failKey);
      if (n === 1) await store.expire(failKey, ADMIN_LOCK_SECONDS);
      const left = Math.max(0, ADMIN_MAX_ATTEMPTS - n);
      return {
        status: 401,
        json: {
          error: left > 0 ? `Wrong admin code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Wrong admin code. This IP is now locked for 1 hour.',
          attemptsLeft: left,
        },
      };
    }

    // Correct code → clear the failure counter for this IP.
    if (fails > 0) await store.del(failKey);

    const allUserKeys = scanUserKeys;

    // stats overview
    if (p === '/api/admin/stats' && method === 'GET') {
      const blocked = await store.smembers('blocked');
      const userKeys = await allUserKeys();
      const reports = await listReports();
      const pending = reports.filter((r) => r.status === 'pending').length;
      const bugs = await listBugs();
      const openBugs = bugs.filter((b) => b.status === 'open').length;
      return {
        status: 200,
        json: {
          accounts: userKeys.length,
          totalLinks: LINKS.length,
          activeLinks: LINKS.length - blocked.length,
          blockedCount: blocked.length,
          reportsCount: reports.length,
          pendingReports: pending,
          bugsCount: bugs.length,
          openBugs,
        },
      };
    }

    // blocked list + all reports (newest first)
    if (p === '/api/admin/blocked' && method === 'GET') {
      const blocked = await store.smembers('blocked');
      const reports = (await listReports()).slice().reverse();
      const userKeys = await allUserKeys();
      return { status: 200, json: { blocked, reports, totalLinks: LINKS.length, activeLinks: LINKS.length - blocked.length, accounts: userKeys.length } };
    }

    // reports queue (newest first)
    if (p === '/api/admin/reports' && method === 'GET') {
      const reports = (await listReports()).slice().reverse();
      return { status: 200, json: { reports, pending: reports.filter((r) => r.status === 'pending').length } };
    }

    // CONFIRM a report -> block the link, refund + notify every affected user
    if (p === '/api/admin/report-confirm' && method === 'POST') {
      const id = typeof body.id === 'string' ? body.id : '';
      const raw = id ? await store.get(`report:${id}`) : null;
      if (!raw) return { status: 404, json: { error: 'Report not found.' } };
      const report = JSON.parse(raw);
      if (report.status !== 'pending') return { status: 409, json: { error: `Report already ${report.status}.` } };
      const url = report.url;
      await store.sadd('blocked', url);

      // Refund + notify every user who had this link in their saved rotation.
      const keys = await allUserKeys();
      let affected = 0;
      for (const k of keys) {
        const u = await getUser(k);
        if (!u || !Array.isArray(u.links) || !u.links.includes(url)) continue;
        u.links = u.links.filter((x) => x !== url);
        u.bonus = (u.bonus || 0) + 1; // refunded "extra link token"
        u.notifications = u.notifications || [];
        u.notifications.push({
          id: crypto.randomBytes(5).toString('hex'),
          text: 'A link in your list was labeled as blocked. you have been refunded an extra link token as compensation',
          at: Date.now(),
          read: false,
        });
        if (u.notifications.length > 50) u.notifications = u.notifications.slice(-50);
        await putUser(k, u);
        affected++;
      }

      report.status = 'confirmed';
      report.resolvedAt = Date.now();
      report.affected = affected;
      await store.set(`report:${id}`, JSON.stringify(report));
      const pool = await activeLinks();
      return { status: 200, json: { ok: true, affected, blocked: url, activeLinks: pool.length } };
    }

    // DENY a report -> leave the link in rotation
    if (p === '/api/admin/report-deny' && method === 'POST') {
      const id = typeof body.id === 'string' ? body.id : '';
      const raw = id ? await store.get(`report:${id}`) : null;
      if (!raw) return { status: 404, json: { error: 'Report not found.' } };
      const report = JSON.parse(raw);
      report.status = 'denied';
      report.resolvedAt = Date.now();
      await store.set(`report:${id}`, JSON.stringify(report));
      return { status: 200, json: { ok: true } };
    }

    // list every account (no password material)
    if (p === '/api/admin/users' && method === 'GET') {
      const keys = await allUserKeys();
      const users = [];
      for (const key of keys) {
        const u = await getUser(key);
        if (!u) continue;
        users.push({
          username: u.username,
          created: u.created || null,
          linkCount: Array.isArray(u.links) ? u.links.length : 0,
          links: Array.isArray(u.links) ? u.links : [],
          tokens: accountInfo(u).remaining,
          bonus: u.bonus || 0,
          settings: settingsOf(u),
        });
      }
      users.sort((a, b) => (b.created || 0) - (a.created || 0));
      return { status: 200, json: { users, accounts: users.length } };
    }

    // restore a link to rotation
    if (p === '/api/admin/unblock' && method === 'POST') {
      const { url } = body;
      if (url) await store.srem('blocked', url);
      const pool = await activeLinks();
      return { status: 200, json: { ok: true, activeLinks: pool.length, blockedCount: LINKS.length - pool.length } };
    }

    // manually block a link (admin-initiated; no user refund needed)
    if (p === '/api/admin/block' && method === 'POST') {
      const { url } = body;
      if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return { status: 400, json: { error: 'Invalid url.' } };
      await store.sadd('blocked', url);
      const pool = await activeLinks();
      return { status: 200, json: { ok: true, activeLinks: pool.length, blockedCount: LINKS.length - pool.length } };
    }

    // clear the reports log (records + index)
    if (p === '/api/admin/clear-reports' && method === 'POST') {
      const ids = (await store.lrange('reportids', 0, -1)) || [];
      for (const id of ids) await store.del(`report:${id}`);
      await store.del('reportids');
      return { status: 200, json: { ok: true } };
    }

    // grant link tokens to a user (separate from reports)
    if (p === '/api/admin/grant-tokens' && method === 'POST') {
      const ukey = typeof body.username === 'string' ? body.username.toLowerCase() : '';
      let amount = parseInt(body.amount, 10);
      if (isNaN(amount) || amount === 0) return { status: 400, json: { error: 'Enter a token amount.' } };
      amount = Math.max(-100, Math.min(100, amount));
      const u = ukey ? await getUser(ukey) : null;
      if (!u) return { status: 404, json: { error: 'User not found.' } };
      u.bonus = Math.max(0, (u.bonus || 0) + amount);
      if (amount > 0) {
        u.notifications = u.notifications || [];
        u.notifications.push({
          id: crypto.randomBytes(5).toString('hex'),
          text: `You received ${amount} extra link token${amount === 1 ? '' : 's'} from an admin.`,
          at: Date.now(),
          read: false,
        });
        if (u.notifications.length > 50) u.notifications = u.notifications.slice(-50);
      }
      await putUser(ukey, u);
      return { status: 200, json: { ok: true, bonus: u.bonus, tokens: accountInfo(u).remaining } };
    }

    // message a user (admin -> user notification)
    if (p === '/api/admin/message' && method === 'POST') {
      const ukey = typeof body.username === 'string' ? body.username.toLowerCase() : '';
      let text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text) return { status: 400, json: { error: 'Enter a message.' } };
      if (text.length > 500) text = text.slice(0, 500);
      const u = ukey ? await getUser(ukey) : null;
      if (!u) return { status: 404, json: { error: 'User not found.' } };
      u.notifications = u.notifications || [];
      u.notifications.push({ id: crypto.randomBytes(5).toString('hex'), text, at: Date.now(), read: false, from: 'admin' });
      if (u.notifications.length > 50) u.notifications = u.notifications.slice(-50);
      await putUser(ukey, u);
      return { status: 200, json: { ok: true } };
    }

    // bug reports queue (newest first)
    if (p === '/api/admin/bugs' && method === 'GET') {
      const bugs = (await listBugs()).slice().reverse();
      return { status: 200, json: { bugs, open: bugs.filter((b) => b.status === 'open').length } };
    }

    // resolve a bug -> mark fixed + award up to 10 tokens + notify the reporter
    if (p === '/api/admin/bug-resolve' && method === 'POST') {
      const id = typeof body.id === 'string' ? body.id : '';
      const raw = id ? await store.get(`bug:${id}`) : null;
      if (!raw) return { status: 404, json: { error: 'Bug not found.' } };
      const bug = JSON.parse(raw);
      let tokens = parseInt(body.tokens, 10);
      if (isNaN(tokens)) tokens = 0;
      tokens = Math.max(0, Math.min(10, tokens)); // up to 10
      const ukey = String(bug.by || '').toLowerCase();
      const u = await getUser(ukey);
      if (u) {
        if (tokens > 0) u.bonus = (u.bonus || 0) + tokens;
        u.notifications = u.notifications || [];
        u.notifications.push({
          id: crypto.randomBytes(5).toString('hex'),
          text:
            tokens > 0
              ? `Your bug report was reviewed — you earned ${tokens} link token${tokens === 1 ? '' : 's'}.`
              : 'Your bug report was reviewed. Thanks for the heads up!',
          at: Date.now(),
          read: false,
        });
        if (u.notifications.length > 50) u.notifications = u.notifications.slice(-50);
        await putUser(ukey, u);
      }
      bug.status = 'fixed';
      bug.tokens = tokens;
      bug.resolvedAt = Date.now();
      await store.set(`bug:${id}`, JSON.stringify(bug));
      return { status: 200, json: { ok: true, tokens, rewarded: Boolean(u) } };
    }

    // dismiss a bug -> mark dismissed, notify reporter, no tokens
    if (p === '/api/admin/bug-dismiss' && method === 'POST') {
      const id = typeof body.id === 'string' ? body.id : '';
      const raw = id ? await store.get(`bug:${id}`) : null;
      if (!raw) return { status: 404, json: { error: 'Bug not found.' } };
      const bug = JSON.parse(raw);
      const ukey = String(bug.by || '').toLowerCase();
      const u = await getUser(ukey);
      if (u) {
        u.notifications = u.notifications || [];
        u.notifications.push({
          id: crypto.randomBytes(5).toString('hex'),
          text: 'Your bug report was reviewed and closed. Thanks for reporting!',
          at: Date.now(),
          read: false,
        });
        if (u.notifications.length > 50) u.notifications = u.notifications.slice(-50);
        await putUser(ukey, u);
      }
      bug.status = 'dismissed';
      bug.resolvedAt = Date.now();
      await store.set(`bug:${id}`, JSON.stringify(bug));
      return { status: 200, json: { ok: true } };
    }

    // delete an account
    if (p === '/api/admin/delete-user' && method === 'POST') {
      const key = typeof body.username === 'string' ? body.username.toLowerCase() : '';
      if (key) {
        await store.del(`user:${key}`);
        await store.srem('users', key);
      }
      const users = await store.smembers('users');
      return { status: 200, json: { ok: true, accounts: users.length } };
    }

    return { status: 404, json: { error: 'Unknown admin endpoint.' } };
  }

  return { status: 404, json: { error: 'Unknown endpoint.' } };
}

module.exports = { handle, LINKS, RATE_LIMIT_ENABLED, LINKS_PER_DAY };
