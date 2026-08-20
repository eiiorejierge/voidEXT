// =============================================================================
// Scale XT core logic (framework-agnostic)
// -----------------------------------------------------------------------------
// Exposes handle({ method, path, body, authHeader }) -> { status, json }.
// Both the Vercel serverless function (api/[...path].js) and the standalone
// server (server.js) are thin adapters over this.
// =============================================================================

const crypto = require('crypto');
const store = require('./store.js');
const RAW_LINKS = require('./links.js');
const VERSION = require('./version.js');
const cloak = require('./cloak.js');

// ---- Config -----------------------------------------------------------------
// Weekly quota. Every account receives a fresh allowance each Saturday at
// 00:00 UTC. The public UI exposes percentage plus the exact available balance.
const RATE_LIMIT_ENABLED = true;
const LINKS_PER_WEEK = 5;
const LINKS_PER_BATCH = 5;
const OWNER_USERNAME = 'w7ll';
const OWNER_SETUP_PASSWORD = process.env.OWNER_SETUP_PASSWORD || '';
const USER_ROLES = ['member', 'support', 'admin'];
const STAFF_ROLES = new Set(['support', 'admin', 'owner']);

const BUILT_IN_RELEASES = [{
  id: 'scale-xt-2.9.2',
  version: '2.9.2',
  title: 'Personal, owner-locked links',
  text: 'Your links are now short personal links on the Scale XT domain, and each one is locked to the account that created it. Only you, signed in to Scale XT, can open your links — if anyone else finds one, it simply will not open for them. The site still loads full screen inside the viewer with the real destination hidden from the address bar and the page, so your links stay yours and can no longer be handed off to link thieves.',
  at: Date.UTC(2026, 7, 20, 16, 0, 0),
  source: 'built-in',
}, {
  id: 'scale-xt-2.9.1',
  version: '2.9.1',
  title: 'Hidden in-gateway viewer',
  text: 'The link gateway now opens your content inside the Scale XT viewer instead of redirecting to it. The address bar stays on your short Scale XT link the whole time, so the real destination is never shown anywhere — but the site loads full screen and stays fully usable. Nobody can read the destination off the address bar or the page, so links can be enjoyed without leaking to link thieves.',
  at: Date.UTC(2026, 7, 20, 12, 0, 0),
  source: 'built-in',
}, {
  id: 'scale-xt-2.9.0',
  version: '2.9.0',
  title: 'Private link gateway',
  text: 'Generated links are now cloaked behind an opaque, per-link gateway. Instead of a raw destination, you get and share a short Scale XT link that routes every visitor through the service. The real destination is never shown, so links can no longer be copied out of the app or used to bypass the service, and blocking a link instantly disables every gateway link that points at it.',
  at: Date.UTC(2026, 7, 20, 8, 0, 0),
  source: 'built-in',
}, {
  id: 'scale-xt-2.8.0',
  version: '2.8.0',
  title: 'Lean workflow and security update',
  text: 'Adds saved-link search and domain filters, random open, undo delete, report reasons, pool export, registration controls, expiring revocable sessions, global-chat mute and unread state, and baseline security headers.',
  at: Date.UTC(2026, 7, 19, 8, 0, 0),
  source: 'built-in',
}, {
  id: 'scale-xt-2.7.0',
  version: '2.7.0',
  title: 'Global chat',
  text: 'Scale XT now has a shared live room for every signed-in member, with persistent history, online presence, role labels, send protection, and message deletion for authors and staff.',
  at: Date.UTC(2026, 7, 19, 7, 0, 0),
  source: 'built-in',
}, {
  id: 'scale-xt-2.6.2',
  version: '2.6.2',
  title: 'Clean login screen',
  text: 'The signed-in workspace now stays completely hidden on the login and sign-up screen. This fixes the split-screen layout introduced by the compact navigation update.',
  at: Date.UTC(2026, 7, 19, 6, 30, 0),
  source: 'built-in',
}, {
  id: 'scale-xt-2.6.1',
  version: '2.6.1',
  title: 'Announcements on the bookmark home',
  text: 'The newest admin announcement now appears directly on the Scale XT bookmark home screen, refreshes while the bookmark is open, and returns automatically whenever a new broadcast is published.',
  at: Date.UTC(2026, 7, 19, 6, 0, 0),
  source: 'built-in',
}, {
  id: 'scale-xt-2.6.0',
  version: '2.6.0',
  title: 'Compact navigation and real update status',
  text: 'Scale XT now shows the bookmarklet version you are actually using, alerts you when an update is ready, and adds a compact icon rail, top utility controls, and Ctrl/Cmd+K quick actions.',
  at: Date.UTC(2026, 7, 19, 5, 0, 0),
  source: 'built-in',
}, {
  id: 'scale-xt-2.5.0',
  version: '2.5.0',
  title: 'Railway accounts and owner login',
  text: 'Accounts now persist in Railway PostgreSQL. The admin panel requires a signed-in staff account, and w7ll is protected as the owner account.',
  at: Date.UTC(2026, 7, 19, 3, 0, 0),
  source: 'built-in',
}, {
  id: 'scale-xt-2.4.2',
  version: '2.4.2',
  title: 'Maintenance operations',
  text: 'Admins can now pause the service for maintenance, reset weekly usage for every account, and reward all users with a chosen number of usage credits.',
  at: Date.UTC(2026, 7, 19, 2, 0, 0),
  source: 'built-in',
}, {
  id: 'scale-xt-2.4.1',
  version: '2.4.1',
  title: 'Credit-aware weekly usage',
  text: 'Weekly usage now includes account credits and shows the exact number of link uses and credits you still have available.',
  at: Date.UTC(2026, 7, 19, 1, 0, 0),
  source: 'built-in',
}, {
  id: 'scale-xt-2.4.0',
  version: '2.4.0',
  title: 'Weekly usage and staff tools',
  text: 'Weekly usage now resets every Saturday. Staff roles, release notes, and a more useful admin dashboard are also available.',
  at: Date.UTC(2026, 7, 18, 18, 0, 0),
  source: 'built-in',
}];

// Admin endpoints only accept a real signed-in staff account. There is no
// separate reusable admin-code bypass.
const ADMIN_MAX_ATTEMPTS = 5;
const ADMIN_LOCK_SECONDS = 3600; // 1 hour

// Input caps (guard against abuse / scrypt CPU-DoS on huge passwords).
const MAX_PASSWORD = 256;
const MAX_URL = 2048;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const REPORT_REASONS = new Set(['dead', 'blocked', 'wrong-destination', 'other']);
const DEFAULT_MAINTENANCE_MESSAGE = 'Scale XT is temporarily unavailable while maintenance is in progress. Please check back shortly.';
const MAINTENANCE_EXEMPT = new Set([
  '/api/maintenance', '/api/health', '/api/version', '/api/bookmarklet',
  '/api/announcements', '/api/releases', '/api/login', '/api/me', '/api/logout',
]);
let maintenanceCache = { value: null, expiresAt: 0 };

function normalizeMaintenance(input) {
  const state = input && typeof input === 'object' ? input : {};
  return {
    enabled: state.enabled === true,
    message: String(state.message || DEFAULT_MAINTENANCE_MESSAGE).trim().slice(0, 500) || DEFAULT_MAINTENANCE_MESSAGE,
    startedAt: Number(state.startedAt) || null,
    updatedAt: Number(state.updatedAt) || null,
    by: state.by ? String(state.by).slice(0, 64) : null,
  };
}
async function maintenanceInfo(force) {
  const now = Date.now();
  if (!force && maintenanceCache.value && maintenanceCache.expiresAt > now) return maintenanceCache.value;
  const raw = await store.get('maintenance:state');
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch (e) { parsed = {}; }
  }
  const value = normalizeMaintenance(parsed);
  maintenanceCache = { value, expiresAt: now + 3000 };
  return value;
}
async function saveMaintenance(input) {
  const value = normalizeMaintenance(input);
  await store.set('maintenance:state', JSON.stringify(value));
  maintenanceCache = { value, expiresAt: Date.now() + 3000 };
  return value;
}
function publicMaintenance(state) {
  return {
    enabled: state.enabled,
    message: state.message,
    startedAt: state.startedAt,
    updatedAt: state.updatedAt,
  };
}

async function signupsEnabled() {
  const value = await store.get('signups:enabled');
  return value == null ? true : value !== '0';
}

async function saveSignupsEnabled(enabled) {
  await store.set('signups:enabled', enabled ? '1' : '0');
  return enabled;
}

// ---- Per-account settings ---------------------------------------------------
const DEFAULT_SETTINGS = {
  theme: 'void', // stored keys for the Core | Slate | Paper visual themes
  openInNewTab: true,
  batchSize: LINKS_PER_BATCH,
  confirmReport: false, // ask before reporting a link as blocked
};
function sanitizeSettings(input) {
  const s = Object.assign({}, DEFAULT_SETTINGS);
  if (input && typeof input === 'object') {
    if (['void', 'nebula', 'eclipse'].includes(input.theme)) s.theme = input.theme;
    if (typeof input.openInNewTab === 'boolean') s.openInNewTab = input.openInNewTab;
    if (typeof input.confirmReport === 'boolean') s.confirmReport = input.confirmReport;
  }
  s.batchSize = LINKS_PER_BATCH;
  return s;
}
function settingsOf(user) {
  return sanitizeSettings(user && user.settings);
}
function roleOf(user) {
  if (user && String(user.username || '').toLowerCase() === OWNER_USERNAME) return 'owner';
  return USER_ROLES.includes(user && user.role) ? user.role : 'member';
}
function usagePeriod(now) {
  const stamp = Number.isFinite(now) ? now : Date.now();
  const date = new Date(stamp);
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const daysSinceSaturday = (date.getUTCDay() + 1) % 7;
  const start = midnight - daysSinceSaturday * 86400000;
  const startDate = new Date(start).toISOString().slice(0, 10);
  return { key: `week:${startDate}`, start, resetAt: start + 7 * 86400000 };
}
function weeklyUsed(user, now) {
  const period = usagePeriod(now);
  const usage = (user && user.usage) || {};
  if (Object.prototype.hasOwnProperty.call(usage, period.key)) {
    return Math.max(0, Number(usage[period.key]) || 0);
  }
  // Carry this week's legacy daily counters into the new model once.
  return Object.keys(usage).reduce((sum, key) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return sum;
    const at = Date.parse(`${key}T00:00:00.000Z`);
    if (!Number.isFinite(at) || at < period.start || at >= period.resetAt) return sum;
    return sum + Math.max(0, Number(usage[key]) || 0);
  }, 0);
}
function seedWeeklyUsage(user, now) {
  user.usage = user.usage || {};
  const period = usagePeriod(now);
  if (!Object.prototype.hasOwnProperty.call(user.usage, period.key)) user.usage[period.key] = weeklyUsed(user, now);
  return period;
}
function creditUsageKey(period) {
  return `credits:${period.key}`;
}
function weeklyCreditsUsed(user, now) {
  const usage = (user && user.usage) || {};
  return Math.max(0, Number(usage[creditUsageKey(usagePeriod(now))]) || 0);
}
function spendUsageCredit(user, period) {
  user.usage = user.usage || {};
  const key = creditUsageKey(period);
  user.usage[key] = Math.max(0, Number(user.usage[key]) || 0) + 1;
  user.bonus = Math.max(0, (Number(user.bonus) || 0) - 1);
}
function accountInfo(user, now) {
  const period = usagePeriod(now);
  const used = Math.min(LINKS_PER_WEEK, weeklyUsed(user, now));
  const creditsUsed = weeklyCreditsUsed(user, now);
  const bonus = Math.max(0, Number(user && user.bonus) || 0);
  const remaining = Math.max(0, LINKS_PER_WEEK - used) + bonus;
  const consumed = used + creditsUsed;
  const limit = consumed + remaining;
  return {
    created: (user && user.created) || null,
    used,
    creditsUsed,
    bonus,
    remaining,
    limit,
    usagePercent: limit > 0 ? Math.max(0, Math.min(100, Math.round((consumed / limit) * 100))) : 100,
    resetAt: period.resetAt,
    role: roleOf(user),
  };
}
function publicAccountInfo(user, now) {
  const info = accountInfo(user, now);
  return {
    created: info.created,
    role: info.role,
    usagePercent: info.usagePercent,
    usageAvailable: info.remaining,
    usageCredits: info.bonus,
    resetAt: info.resetAt,
    period: 'weekly',
    hasUsageRemaining: info.remaining > 0,
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

function bugIsOpen(bug) {
  return !['fixed', 'dismissed'].includes((bug && bug.status) || 'open');
}

function bugTitle(text) {
  const first = String(text || '').split(/\r?\n/)[0].trim();
  if (!first) return 'Untitled bug report';
  return first.length > 72 ? first.slice(0, 69) + '...' : first;
}

function normalizeBug(bug) {
  const item = Object.assign({}, bug || {});
  item.title = String(item.title || bugTitle(item.text)).trim().slice(0, 80) || 'Untitled bug report';
  item.status = item.status || 'open';
  item.messages = Array.isArray(item.messages) ? item.messages.slice() : [];
  if (!item.messages.length && item.text) {
    item.messages.push({
      id: `legacy-${item.id || 'bug'}`,
      from: 'user',
      fromName: item.by || 'User',
      text: String(item.text),
      at: item.at || Date.now(),
    });
  }
  item.updatedAt = item.updatedAt || (item.messages.length ? item.messages[item.messages.length - 1].at : item.at) || Date.now();
  item.lastUserReadAt = item.lastUserReadAt || item.at || 0;
  item.lastAdminReadAt = item.lastAdminReadAt || 0;
  return item;
}

function bugSummary(bug, viewer) {
  const item = normalizeBug(bug);
  const last = item.messages[item.messages.length - 1] || null;
  const readAt = viewer === 'admin' ? item.lastAdminReadAt : item.lastUserReadAt;
  const incoming = viewer === 'admin' ? 'user' : 'admin';
  return {
    id: item.id,
    title: item.title,
    by: item.by,
    at: item.at,
    updatedAt: item.updatedAt,
    status: item.status,
    tokens: item.tokens || 0,
    resolvedAt: item.resolvedAt || null,
    messageCount: item.messages.length,
    unread: item.messages.filter((message) => message.from === incoming && message.at > readAt).length,
    lastMessage: last ? { text: last.text, at: last.at, from: last.from, fromName: last.fromName } : null,
  };
}

function nextBugTime(bug) {
  const messages = Array.isArray(bug && bug.messages) ? bug.messages : [];
  const lastAt = messages.length ? Number(messages[messages.length - 1].at || 0) : Number((bug && bug.at) || 0);
  return Math.max(Date.now(), lastAt + 1);
}

async function listAnnouncements(limit) {
  const ids = ((await store.lrange('announceids', 0, -1)) || []).slice().reverse();
  const items = [];
  for (const id of ids) {
    const raw = await store.get(`announce:${id}`);
    if (!raw) continue;
    try {
      const item = JSON.parse(raw);
      items.push(Object.assign({ title: 'General announcement' }, item));
    } catch (e) {}
    if (limit && items.length >= limit) break;
  }
  return items;
}

async function listReleases(limit) {
  const ids = ((await store.lrange('releaseids', 0, -1)) || []).slice().reverse();
  const items = [];
  for (const id of ids) {
    const raw = await store.get(`release:${id}`);
    if (!raw) continue;
    try { items.push(Object.assign({ source: 'published' }, JSON.parse(raw))); } catch (e) {}
  }
  for (const release of BUILT_IN_RELEASES) {
    if (!items.some((item) => item.id === release.id || item.version === release.version)) items.push(release);
  }
  items.sort((a, b) => Number(b.at || 0) - Number(a.at || 0));
  return limit ? items.slice(0, limit) : items;
}

function metricDate(at) {
  return new Date(Number.isFinite(at) ? at : Date.now()).toISOString().slice(0, 10);
}
async function incrementMetric(name, at) {
  return store.incr(`metric:${name}:${metricDate(at)}`);
}
async function metricSeries(days) {
  const count = Math.max(1, Math.min(30, days || 7));
  const rows = [];
  const today = Date.now();
  for (let offset = count - 1; offset >= 0; offset--) {
    const date = metricDate(today - offset * 86400000);
    const [generations, signups, support, reports] = await Promise.all([
      store.get(`metric:generations:${date}`),
      store.get(`metric:signups:${date}`),
      store.get(`metric:support:${date}`),
      store.get(`metric:reports:${date}`),
    ]);
    rows.push({
      date,
      generations: Number(generations) || 0,
      signups: Number(signups) || 0,
      support: Number(support) || 0,
      reports: Number(reports) || 0,
    });
  }
  return rows;
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

async function removeLinkFromUsers(url) {
  const keys = await scanUserKeys();
  let affected = 0;
  for (const key of keys) {
    const user = await getUser(key);
    if (!user || !Array.isArray(user.links) || !user.links.includes(url)) continue;
    user.links = user.links.filter((item) => item !== url);
    user.pinned = (user.pinned || []).filter((item) => item !== url);
    await putUser(key, user);
    affected++;
  }
  return affected;
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
  const partners = (await store.smembers('convos:' + key)) || [];
  let total = 0;
  for (const pk of partners) {
    const c = await getConvo(convoId(key, pk));
    if (c) total += convoUnread(c, key);
  }
  return total;
}

const GLOBAL_CHAT_KEY = 'globalchat:messages';
const GLOBAL_CHAT_DELETED_KEY = 'globalchat:deleted';
async function globalChatMessages(limit) {
  const raw = (await store.lrange(GLOBAL_CHAT_KEY, -(limit || 120), -1)) || [];
  const deleted = new Set((await store.smembers(GLOBAL_CHAT_DELETED_KEY)) || []);
  const messages = [];
  for (const item of raw) {
    try {
      const message = JSON.parse(item);
      if (message && message.id && !deleted.has(message.id)) messages.push(message);
    } catch (error) {}
  }
  return messages;
}
function publicGlobalMessage(message, viewer) {
  const viewerRole = roleOf(viewer.user);
  return {
    id: message.id,
    from: message.from,
    text: message.text,
    at: message.at,
    role: message.role || 'member',
    mine: message.fromKey === viewer.key,
    canDelete: message.fromKey === viewer.key || STAFF_ROLES.has(viewerRole),
  };
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
async function adminIdentity(authHeader) {
  const auth = await userFromAuth(authHeader);
  if (!auth || !STAFF_ROLES.has(roleOf(auth.user))) return null;
  return { role: roleOf(auth.user), username: auth.user.username, key: auth.key, user: auth.user };
}
function adminCapabilities(role) {
  if (role === 'owner') return ['overview', 'links', 'reports', 'support', 'accounts', 'accountsWrite', 'roles', 'operations', 'messages', 'announcements', 'releases'];
  if (role === 'admin') return ['overview', 'links', 'reports', 'support', 'accounts', 'accountsWrite', 'operations', 'messages', 'announcements', 'releases'];
  if (role === 'support') return ['overview', 'reports', 'support', 'accounts', 'messages'];
  return [];
}
function adminEndpointAllowed(role, endpoint) {
  if (role === 'owner') return true;
  const adminOnly = new Set(['pool', 'link-add', 'link-remove', 'link-restore', 'link-delete', 'unblock', 'block', 'clear-reports', 'grant-tokens', 'operations', 'maintenance', 'signups', 'usage-reset-all', 'reward-all', 'announce', 'announcements', 'releases', 'release', 'release-delete', 'delete-user']);
  const ownerOnly = new Set(['role-set']);
  if (ownerOnly.has(endpoint)) return false;
  if (role === 'support' && adminOnly.has(endpoint)) return false;
  return role === 'admin' || role === 'support';
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
function ownerSetupAllowed(password) {
  if (!OWNER_SETUP_PASSWORD || typeof password !== 'string') return false;
  const supplied = Buffer.from(password);
  const expected = Buffer.from(OWNER_SETUP_PASSWORD);
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
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
async function createSession(key, user) {
  const token = newToken();
  const session = JSON.stringify({ key, version: Math.max(0, Number(user.sessionVersion) || 0) });
  await store.set(`token:${token}`, session);
  await store.expire(`token:${token}`, SESSION_TTL_SECONDS);
  return token;
}
async function userFromAuth(authHeader) {
  const token = bearer(authHeader);
  if (!token) return null;
  const rawSession = await store.get(`token:${token}`);
  if (!rawSession) return null;
  let key = rawSession;
  let version = 0;
  let legacy = true;
  if (typeof rawSession === 'string' && rawSession.charAt(0) === '{') {
    try {
      const parsed = JSON.parse(rawSession);
      key = parsed.key;
      version = Math.max(0, Number(parsed.version) || 0);
      legacy = false;
    } catch (error) { return null; }
  }
  const user = await getUser(key);
  if (user && version !== Math.max(0, Number(user.sessionVersion) || 0)) return null;
  if (user && legacy) {
    await store.set(`token:${token}`, JSON.stringify({ key, version }));
    await store.expire(`token:${token}`, SESSION_TTL_SECONDS);
  }
  return user ? { key, user } : null;
}

// ---- Link rotation ----------------------------------------------------------
async function allLinks() {
  const custom = (await store.smembers('customlinks')) || [];
  return cleanLinks(LINKS.concat(custom));
}

async function activeLinks() {
  const [links, blockedList, removedList] = await Promise.all([
    allLinks(),
    store.smembers('blocked'),
    store.smembers('removedlinks'),
  ]);
  const blocked = new Set(blockedList || []);
  const removed = new Set(removedList || []);
  return links.filter((url) => !blocked.has(url) && !removed.has(url));
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

  // ---- Link cloaking gateway ------------------------------------------------
  // The gateway page, served at <base>/<token> (and the legacy /go/<token>). It
  // embeds the target in a full-viewport iframe loaded via a one-time ticket, so
  // the address bar stays on /<token> and the real destination never appears in
  // the page HTML or the URL bar. Access is enforced by the page + frame-ticket
  // endpoint below (owner-only). Served with a relaxed CSP so the frame loads.
  if (method === 'GET' && (/^\/[A-Za-z0-9]{16,64}$/.test(p) || /^\/go\/[A-Za-z0-9]{16,64}$/.test(p))) {
    const token = p.replace(/^\/(?:go\/)?/, '');
    const resolved = await cloak.resolveToken(token);
    return {
      status: resolved ? 200 : 404,
      contentType: 'text/html; charset=utf-8',
      headers: { 'Content-Security-Policy': cloak.GATEWAY_CSP },
      body: resolved ? cloak.gatewayPage(token) : cloak.notFoundPage(),
    };
  }

  // Owner-only access check + one-time ticket mint. The gateway page calls this
  // with the viewer's Scale XT session; we grant a short-lived, single-use
  // ticket ONLY if that session owns the token. The destination is never
  // returned here — only an opaque ticket.
  if (p === '/api/frame-ticket' && method === 'POST') {
    if (await cloak.rateLimited(ip)) {
      return { status: 429, json: { error: 'Too many requests. Please slow down.' } };
    }
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    const token = typeof body.token === 'string' ? body.token : '';
    const resolved = await cloak.resolveToken(token);
    if (!resolved) return { status: 404, json: { error: 'Link not found.' } };
    // Owner-only: a link opens only for the account that generated it. (Links
    // with no recorded owner are legacy and fall through to the owner's use.)
    if (resolved.owner && resolved.owner !== auth.key) {
      return { status: 403, json: { error: 'This link belongs to another account.' } };
    }
    const ticket = crypto.randomBytes(18).toString('hex');
    await store.set(`frameticket:${ticket}`, resolved.url);
    await store.expire(`frameticket:${ticket}`, 30); // single-use, short-lived
    return { status: 200, json: { ticket } };
  }

  // The frame loader the gateway iframe points at. It consumes a one-time ticket
  // and redirects *inside the iframe* to the real destination, so the target
  // loads and stays usable while the top-level address bar is untouched. The
  // ticket is deleted on use, so it cannot be replayed or shared.
  if (method === 'GET' && /^\/api\/frame\/[a-f0-9]{16,80}$/.test(p)) {
    const ticket = p.slice('/api/frame/'.length);
    const dest = await store.get(`frameticket:${ticket}`);
    if (!dest) return { status: 404, contentType: 'text/html; charset=utf-8', body: cloak.notFoundPage() };
    await store.del(`frameticket:${ticket}`); // single use
    await incrementMetric('redirects');
    return { status: 302, location: dest };
  }

  if (p === '/api/maintenance' && method === 'GET') {
    return {
      status: 200,
      json: {
        maintenance: publicMaintenance(await maintenanceInfo(true)),
        signupsEnabled: await signupsEnabled(),
      },
    };
  }
  if (!p.startsWith('/api/admin/') && !MAINTENANCE_EXEMPT.has(p)) {
    const maintenance = await maintenanceInfo();
    if (maintenance.enabled) {
      return {
        status: 503,
        json: {
          error: maintenance.message,
          maintenance: publicMaintenance(maintenance),
        },
      };
    }
  }

  // Public announcement feed for the landing page. It contains only messages
  // deliberately published by an admin and never exposes account data.
  if (p === '/api/announcements' && method === 'GET') {
    return { status: 200, json: { announcements: await listAnnouncements(5) } };
  }
  // Public release notes. This feed contains product updates only.
  if (p === '/api/releases' && method === 'GET') {
    return { status: 200, json: { releases: await listReleases(12) } };
  }


  // signup
  if (p === '/api/signup' && method === 'POST') {
    if (!(await signupsEnabled())) {
      return { status: 403, json: { error: 'New account registration is currently closed.' } };
    }
    const { username, password } = body;
    if (!validUsername(username))
      return { status: 400, json: { error: 'Username must be 3-32 chars (letters, numbers, _ . -).' } };
    if (typeof password !== 'string' || password.length < 8)
      return { status: 400, json: { error: 'Password must be at least 8 characters.' } };
    if (password.length > MAX_PASSWORD)
      return { status: 400, json: { error: 'Password is too long.' } };
    const key = username.toLowerCase();
    if (await getUser(key)) return { status: 409, json: { error: 'That username is already taken.' } };
    if (key === OWNER_USERNAME && !ownerSetupAllowed(password)) {
      return { status: 403, json: { error: 'The owner account must be created with the configured setup password.' } };
    }
    const { salt, hash } = hashPassword(password);
    const settings = Object.assign({}, DEFAULT_SETTINGS);
    const newUser = {
      username,
      salt,
      hash,
      created: Date.now(),
      role: key === OWNER_USERNAME ? 'owner' : 'member',
      usage: {},
      settings,
      links: [],
    };
    await putUser(key, newUser);
    await store.sadd('users', key); // index for admin enumeration
    await incrementMetric('signups');
    const token = await createSession(key, newUser);
    return { status: 200, json: { token, username, settings, links: [], account: publicAccountInfo(newUser), notifications: [], unread: 0, messagesUnread: 0 } };
  }

  // login
  if (p === '/api/login' && method === 'POST') {
    const { username, password } = body;
    const key = typeof username === 'string' ? username.toLowerCase() : '';
    const user = key ? await getUser(key) : null;
    if (!user || !verifyPassword(password || '', user.salt, user.hash))
      return { status: 401, json: { error: 'Incorrect username or password.' } };
    const token = await createSession(key, user);
    return { status: 200, json: { token, username: user.username, settings: settingsOf(user), links: await cloak.cloakList(user.links || [], key), pinned: await cloak.cloakList(user.pinned || [], key), account: publicAccountInfo(user), notifications: user.notifications || [], unread: unread(user), messagesUnread: await totalUnreadMessages(key) } };
  }

  // whoami
  if (p === '/api/me' && method === 'GET') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    return { status: 200, json: { username: auth.user.username, settings: settingsOf(auth.user), links: await cloak.cloakList(auth.user.links || [], auth.key), pinned: await cloak.cloakList(auth.user.pinned || [], auth.key), account: publicAccountInfo(auth.user), notifications: auth.user.notifications || [], unread: unread(auth.user), messagesUnread: await totalUnreadMessages(auth.key) } };
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
    const period = seedWeeklyUsage(user);
    user.links = Array.isArray(user.links) ? user.links : [];
    const usedThisWeek = Math.max(0, Number(user.usage[period.key]) || 0);
    const bonus = user.bonus || 0;
    const baseRemaining = Math.max(0, LINKS_PER_WEEK - usedThisWeek);
    const totalRemaining = baseRemaining + bonus;

    if (RATE_LIMIT_ENABLED && totalRemaining <= 0)
      return {
        status: 429,
        json: Object.assign({ error: 'Weekly usage is at 100%. It resets Saturday.', links: user.links, added: null }, publicAccountInfo(user)),
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
      // Nothing new to give, so weekly usage is unchanged.
      const info = publicAccountInfo(user);
      return {
        status: 200,
        json: Object.assign({ links: await cloak.cloakList(user.links, key), added: null, poolSize: pool.length, note: 'No new links available right now.', rateLimit: RATE_LIMIT_ENABLED }, info),
      };
    }

    user.links.push(added);
    if (RATE_LIMIT_ENABLED) {
      if (baseRemaining > 0) user.usage[period.key] = usedThisWeek + 1;
      else spendUsageCredit(user, period);
    }
    await putUser(key, user);
    await incrementMetric('generations');
    const info = publicAccountInfo(user);
    return {
      status: 200,
      json: {
        links: await cloak.cloakList(user.links, key),
        added: await cloak.cloakUrl(added, key),
        poolSize: pool.length,
        rateLimit: RATE_LIMIT_ENABLED,
        usagePercent: info.usagePercent,
        usageAvailable: info.usageAvailable,
        usageCredits: info.usageCredits,
        resetAt: info.resetAt,
        pinned: await cloak.cloakList(user.pinned || [], key),
      },
    };
  }

  // delete one of your own links (removes it from your list + pins)
  if (p === '/api/links/delete' && method === 'POST') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    const raw = typeof body.url === 'string' ? body.url : '';
    if (!raw) return { status: 400, json: { error: 'No link specified.' } };
    // The client only ever sees cloak URLs, so translate back to the real
    // destination before matching against the stored list.
    const url = await cloak.resolveInbound(raw);
    const { key, user } = auth;
    user.links = (user.links || []).filter((x) => x !== url);
    user.pinned = (user.pinned || []).filter((x) => x !== url);
    await putUser(key, user);
    return { status: 200, json: { ok: true, links: await cloak.cloakList(user.links, key), pinned: await cloak.cloakList(user.pinned, key) } };
  }

  // pin / unpin one of your own links (pinned links sort to the top)
  if (p === '/api/links/pin' && method === 'POST') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    const raw = typeof body.url === 'string' ? body.url : '';
    const url = await cloak.resolveInbound(raw);
    const wantPinned = body.pinned !== false; // default true
    const { key, user } = auth;
    if (!url || !(user.links || []).includes(url)) return { status: 404, json: { error: 'Link not found.' } };
    user.pinned = user.pinned || [];
    if (wantPinned) {
      if (!user.pinned.includes(url)) user.pinned.push(url);
    } else {
      user.pinned = user.pinned.filter((x) => x !== url);
    }
    await putUser(key, user);
    return { status: 200, json: { ok: true, links: await cloak.cloakList(user.links, key), pinned: await cloak.cloakList(user.pinned, key) } };
  }

  // report dead/blocked link(s) — creates PENDING reports for admin review.
  // Does NOT block anything; nothing changes until an admin confirms.
  if (p === '/api/report' && method === 'POST') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    const rawUrls = Array.isArray(body.urls) ? body.urls : body.url ? [body.url] : [];
    // Reports arrive as cloak URLs; resolve them to the real destinations so the
    // admin queue and pool matching operate on the underlying links.
    const urls = await Promise.all(rawUrls.map((u) => cloak.resolveInbound(u)));
    const valid = urls.filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u) && u.length <= MAX_URL);
    if (!valid.length) return { status: 400, json: { error: 'Select at least one valid link.' } };
    const reason = REPORT_REASONS.has(body.reason) ? body.reason : 'other';
    let count = 0;
    for (const url of valid) {
      const id = crypto.randomBytes(6).toString('hex');
      const rep = { id, url, by: auth.user.username, reason, at: Date.now(), status: 'pending' };
      await store.set(`report:${id}`, JSON.stringify(rep));
      await store.rpush('reportids', id);
      await incrementMetric('reports');
      count++;
      console.log(`[Scale XT] REPORT (pending) by ${auth.user.username}: ${url}`);
    }
    return { status: 200, json: { ok: true, reported: count, pending: true } };
  }

  // Create a support ticket. Older one-line bug records are upgraded lazily by
  // normalizeBug(), so existing reports remain readable.
  if (p === '/api/bug' && method === 'POST') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    let text = typeof body.text === 'string' ? body.text.trim() : '';
    let title = typeof body.title === 'string' ? body.title.trim() : '';
    if (text.length < 5) return { status: 400, json: { error: 'Describe the bug in a bit more detail.' } };
    if (text.length > 2000) text = text.slice(0, 2000);
    if (title.length > 80) title = title.slice(0, 80);
    const id = crypto.randomBytes(6).toString('hex');
    const at = Date.now();
    const bug = {
      id,
      by: auth.user.username,
      title: title || bugTitle(text),
      text,
      at,
      updatedAt: at,
      status: 'open',
      tokens: 0,
      lastUserReadAt: at,
      lastAdminReadAt: 0,
      messages: [{
        id: crypto.randomBytes(6).toString('hex'),
        from: 'user',
        fromName: auth.user.username,
        text,
        at,
      }],
    };
    await store.set(`bug:${id}`, JSON.stringify(bug));
    await incrementMetric('support');
    await store.rpush('bugids', id);
    console.log(`[Scale XT] BUG by ${auth.user.username}: ${text.slice(0, 80)}`);
    return { status: 200, json: { ok: true, bug: bugSummary(bug, 'user') } };
  }

  // List only the signed-in user's own support tickets.
  if (p === '/api/bugs' && method === 'GET') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    const bugs = (await listBugs())
      .filter((bug) => String(bug.by || '').toLowerCase() === auth.key)
      .map((bug) => bugSummary(bug, 'user'))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return { status: 200, json: { bugs, unread: bugs.reduce((sum, bug) => sum + bug.unread, 0) } };
  }

  // Open one ticket, return its full conversation, and mark admin replies read.
  if (p === '/api/bugs/thread' && method === 'POST') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    const id = typeof body.id === 'string' ? body.id : '';
    const raw = id ? await store.get(`bug:${id}`) : null;
    if (!raw) return { status: 404, json: { error: 'Bug report not found.' } };
    const bug = normalizeBug(JSON.parse(raw));
    if (String(bug.by || '').toLowerCase() !== auth.key)
      return { status: 403, json: { error: 'This report belongs to another account.' } };
    bug.lastUserReadAt = Date.now();
    await store.set(`bug:${id}`, JSON.stringify(bug));
    return { status: 200, json: { bug: Object.assign(bugSummary(bug, 'user'), { messages: bug.messages }) } };
  }

  // Add a user reply. Replying to a completed ticket reopens it automatically.
  if (p === '/api/bugs/reply' && method === 'POST') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    const id = typeof body.id === 'string' ? body.id : '';
    let text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) return { status: 400, json: { error: 'Enter a reply.' } };
    if (text.length > 2000) text = text.slice(0, 2000);
    const raw = id ? await store.get(`bug:${id}`) : null;
    if (!raw) return { status: 404, json: { error: 'Bug report not found.' } };
    const bug = normalizeBug(JSON.parse(raw));
    if (String(bug.by || '').toLowerCase() !== auth.key)
      return { status: 403, json: { error: 'This report belongs to another account.' } };
    const at = nextBugTime(bug);
    bug.messages.push({ id: crypto.randomBytes(6).toString('hex'), from: 'user', fromName: auth.user.username, text, at });
    if (bug.messages.length > 200) bug.messages = bug.messages.slice(-200);
    if (!bugIsOpen(bug)) {
      bug.status = 'open';
      bug.reopenedAt = at;
      delete bug.resolvedAt;
    }
    bug.updatedAt = at;
    bug.lastUserReadAt = at;
    await store.set(`bug:${id}`, JSON.stringify(bug));
    return { status: 200, json: { ok: true, bug: Object.assign(bugSummary(bug, 'user'), { messages: bug.messages }) } };
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
    const global = await globalChatMessages(1);
    return {
      status: 200,
      json: {
        unread: await totalUnreadMessages(auth.key),
        globalLatestId: global.length ? global[global.length - 1].id : null,
      },
    };
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

  // Shared global room. History is persisted as a bounded list, and every
  // response is shaped for the signed-in viewer (mine / canDelete).
  if (p === '/api/global/messages' && method === 'GET') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    const [messages, onlineKeys] = await Promise.all([
      globalChatMessages(120),
      store.scan('online:*'),
    ]);
    return {
      status: 200,
      json: {
        messages: messages.map((message) => publicGlobalMessage(message, auth)),
        online: Math.max(1, (onlineKeys || []).length),
      },
    };
  }

  if (p === '/api/global/send' && method === 'POST') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) return { status: 400, json: { error: 'Enter a message.' } };
    if (text.length > 500) return { status: 400, json: { error: 'Keep global messages to 500 characters or less.' } };
    const cooldownKey = 'globalchat:cooldown:' + auth.key;
    if (await store.get(cooldownKey)) {
      return { status: 429, json: { error: 'Slow down for a second before sending again.' } };
    }
    await store.set(cooldownKey, '1');
    await store.expire(cooldownKey, 2);
    const message = {
      id: crypto.randomBytes(6).toString('hex'),
      from: auth.user.username,
      fromKey: auth.key,
      role: roleOf(auth.user),
      text,
      at: Date.now(),
    };
    await store.rpush(GLOBAL_CHAT_KEY, JSON.stringify(message));
    await store.ltrim(GLOBAL_CHAT_KEY, -200, -1);
    return { status: 200, json: { ok: true, message: publicGlobalMessage(message, auth) } };
  }

  if (p === '/api/global/delete' && method === 'POST') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    const id = typeof body.id === 'string' ? body.id : '';
    if (!/^[a-f0-9]{12}$/i.test(id)) return { status: 400, json: { error: 'Invalid message.' } };
    const message = (await globalChatMessages(200)).find((item) => item.id === id);
    if (!message) return { status: 404, json: { error: 'Message not found.' } };
    const canDelete = message.fromKey === auth.key || STAFF_ROLES.has(roleOf(auth.user));
    if (!canDelete) return { status: 403, json: { error: 'You cannot delete this message.' } };
    await store.sadd(GLOBAL_CHAT_DELETED_KEY, id);
    return { status: 200, json: { ok: true, id } };
  }

  // presence heartbeat — marks this user "online" for ~35s. The client pings
  // this on a short interval; absence of the key means offline.
  if (p === '/api/heartbeat' && method === 'POST') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    const seenAt = Date.now();
    await Promise.all([
      store.set(`online:${auth.key}`, '1'),
      store.set(`lastseen:${auth.key}`, String(seenAt)),
    ]);
    await Promise.all([store.expire(`online:${auth.key}`, 35), store.expire(`lastseen:${auth.key}`, 2592000)]);
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
    const storage = await store.health();
    return {
      status: storage.reachable ? 200 : 503,
      json: { service: 'voidext', version: VERSION, storage },
    };
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
    const [links, pool, blocked, removed] = await Promise.all([
      allLinks(),
      activeLinks(),
      store.smembers('blocked'),
      store.smembers('removedlinks'),
    ]);
    return {
      status: 200,
      json: Object.assign(
        {
          totalLinks: links.length,
          poolSize: pool.length,
          blockedCount: (blocked || []).length,
          removedCount: (removed || []).length,
        },
        publicAccountInfo(auth.user)
      ),
    };
  }

  // Share one usage credit with another user, rate limited per recipient.
  if (p === '/api/send-token' && method === 'POST') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    const to = typeof body.to === 'string' ? body.to.toLowerCase() : '';
    if (!to) return { status: 400, json: { error: 'Pick a recipient.' } };
    if (to === auth.key) return { status: 400, json: { error: "You can't share usage with yourself." } };
    const recipient = await getUser(to);
    if (!recipient) return { status: 404, json: { error: 'User not found.' } };

    // rate limit: 1 token to this same person per hour
    const rlKey = `tokengift:${auth.key}:${to}`;
    if (await store.get(rlKey)) {
      let ttl = await store.ttl(rlKey);
      if (!ttl || ttl < 0) ttl = 3600;
      return { status: 429, json: { error: `You can only share usage with ${recipient.username} once per hour. Try again in ~${Math.ceil(ttl / 60)} min.` } };
    }

    const sender = auth.user;
    const period = seedWeeklyUsage(sender);
    const usedThisWeek = Math.max(0, Number(sender.usage[period.key]) || 0);
    const bonus = sender.bonus || 0;
    const available = Math.max(0, LINKS_PER_WEEK - usedThisWeek) + bonus;
    if (available < 1) return { status: 400, json: { error: 'Your weekly usage is already at 100%.' } };
    if (bonus > 0) spendUsageCredit(sender, period);
    else sender.usage[period.key] = usedThisWeek + 1;
    await putUser(auth.key, sender);

    // credit the recipient + notify them
    recipient.bonus = (recipient.bonus || 0) + 1;
    recipient.notifications = recipient.notifications || [];
    recipient.notifications.push({ id: crypto.randomBytes(5).toString('hex'), text: `${auth.user.username} shared a usage credit with you.`, at: Date.now(), read: false, from: auth.user.username });
    if (recipient.notifications.length > 50) recipient.notifications = recipient.notifications.slice(-50);
    await putUser(to, recipient);

    await store.set(rlKey, '1');
    await store.expire(rlKey, 3600);
    return { status: 200, json: { ok: true, sentTo: recipient.username, account: publicAccountInfo(sender) } };
  }

  // change password
  if (p === '/api/password' && method === 'POST') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    const { current, newPassword } = body;
    if (!verifyPassword(current || '', auth.user.salt, auth.user.hash))
      return { status: 401, json: { error: 'Current password is incorrect.' } };
    if (typeof newPassword !== 'string' || newPassword.length < 8)
      return { status: 400, json: { error: 'New password must be at least 8 characters.' } };
    if (newPassword.length > MAX_PASSWORD)
      return { status: 400, json: { error: 'New password is too long.' } };
    const { salt, hash } = hashPassword(newPassword);
    auth.user.salt = salt;
    auth.user.hash = hash;
    auth.user.sessionVersion = Math.max(0, Number(auth.user.sessionVersion) || 0) + 1;
    await putUser(auth.key, auth.user);
    const token = await createSession(auth.key, auth.user);
    return { status: 200, json: { ok: true, token } };
  }

  if (p === '/api/logout-all' && method === 'POST') {
    const auth = await userFromAuth(authHeader);
    if (!auth) return { status: 401, json: { error: 'Not logged in.' } };
    auth.user.sessionVersion = Math.max(0, Number(auth.user.sessionVersion) || 0) + 1;
    await putUser(auth.key, auth.user);
    return { status: 200, json: { ok: true } };
  }

  // ---- admin: signed-in staff accounts only ---------------------------------
  if (p.startsWith('/api/admin/')) {
    const failKey = `adminfail:${ip}`;
    const fails = parseInt((await store.get(failKey)) || '0', 10);
    const identity = await adminIdentity(authHeader);

    if (!identity) {
      if (fails >= ADMIN_MAX_ATTEMPTS) {
        let ttl = await store.ttl(failKey);
        if (!ttl || ttl < 0) ttl = ADMIN_LOCK_SECONDS;
        return { status: 429, json: { error: `Too many attempts. This IP is locked for ~${Math.ceil(ttl / 60)} min.`, lockedFor: ttl } };
      }
      const n = await store.incr(failKey);
      if (n === 1) await store.expire(failKey, ADMIN_LOCK_SECONDS);
      const left = Math.max(0, ADMIN_MAX_ATTEMPTS - n);
      return {
        status: 401,
        json: {
          error: left > 0 ? `Admin access denied. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Admin access denied. This IP is now locked for 1 hour.',
          attemptsLeft: left,
        },
      };
    }

    if (fails > 0) await store.del(failKey);
    const endpoint = p.slice('/api/admin/'.length);
    if (!adminEndpointAllowed(identity.role, endpoint)) {
      return { status: 403, json: { error: 'Your staff role does not have permission for this action.' } };
    }
    const capabilities = adminCapabilities(identity.role);

    if (p === '/api/admin/session' && method === 'GET') {
      return { status: 200, json: { role: identity.role, username: identity.username, capabilities } };
    }

    const allUserKeys = scanUserKeys;

    if (p === '/api/admin/operations' && method === 'GET') {
      const keys = await allUserKeys();
      return {
        status: 200,
        json: {
          maintenance: await maintenanceInfo(true),
          signupsEnabled: await signupsEnabled(),
          accounts: keys.length,
          period: usagePeriod(),
        },
      };
    }

    if (p === '/api/admin/maintenance' && method === 'POST') {
      if (typeof body.enabled !== 'boolean') return { status: 400, json: { error: 'Choose whether maintenance mode is on or off.' } };
      const current = await maintenanceInfo(true);
      const now = Date.now();
      const message = typeof body.message === 'string' && body.message.trim()
        ? body.message.trim().slice(0, 500)
        : current.message || DEFAULT_MAINTENANCE_MESSAGE;
      const maintenance = await saveMaintenance({
        enabled: body.enabled,
        message,
        startedAt: body.enabled ? current.startedAt || now : null,
        updatedAt: now,
        by: identity.username,
      });
      return { status: 200, json: { ok: true, maintenance } };
    }

    if (p === '/api/admin/signups' && method === 'POST') {
      if (typeof body.enabled !== 'boolean') return { status: 400, json: { error: 'Choose whether registration is open or closed.' } };
      const enabled = await saveSignupsEnabled(body.enabled);
      return { status: 200, json: { ok: true, signupsEnabled: enabled } };
    }

    if (p === '/api/admin/usage-reset-all' && method === 'POST') {
      const keys = await allUserKeys();
      const period = usagePeriod();
      let reset = 0;
      for (let index = 0; index < keys.length; index += 20) {
        const results = await Promise.all(keys.slice(index, index + 20).map(async (key) => {
          const user = await getUser(key);
          if (!user) return 0;
          const hadUsage = weeklyUsed(user) > 0 || weeklyCreditsUsed(user) > 0;
          user.usage = user.usage || {};
          user.usage[period.key] = 0;
          user.usage[creditUsageKey(period)] = 0;
          if (hadUsage) {
            user.notifications = user.notifications || [];
            user.notifications.push({
              id: crypto.randomBytes(5).toString('hex'),
              text: 'Your weekly usage was reset by Scale XT staff.',
              at: Date.now(),
              read: false,
              from: 'admin',
            });
            if (user.notifications.length > 50) user.notifications = user.notifications.slice(-50);
          }
          await putUser(key, user);
          return hadUsage ? 1 : 0;
        }));
        reset += results.reduce((sum, value) => sum + value, 0);
      }
      return { status: 200, json: { ok: true, accounts: keys.length, reset, resetAt: period.resetAt } };
    }

    if (p === '/api/admin/reward-all' && method === 'POST') {
      let amount = parseInt(body.amount, 10);
      if (!Number.isFinite(amount) || amount < 1) return { status: 400, json: { error: 'Enter at least one usage credit.' } };
      amount = Math.min(100, amount);
      const keys = await allUserKeys();
      const customMessage = typeof body.message === 'string' ? body.message.trim().slice(0, 500) : '';
      const creditLabel = `${amount} usage credit${amount === 1 ? '' : 's'}`;
      let rewarded = 0;
      for (let index = 0; index < keys.length; index += 20) {
        const results = await Promise.all(keys.slice(index, index + 20).map(async (key) => {
          const user = await getUser(key);
          if (!user) return 0;
          user.bonus = Math.max(0, Number(user.bonus) || 0) + amount;
          user.notifications = user.notifications || [];
          user.notifications.push({
            id: crypto.randomBytes(5).toString('hex'),
            text: customMessage ? `${customMessage} (${creditLabel} added.)` : `Thanks for your patience during maintenance. ${creditLabel} ${amount === 1 ? 'was' : 'were'} added to your account.`,
            at: Date.now(),
            read: false,
            from: 'admin',
          });
          if (user.notifications.length > 50) user.notifications = user.notifications.slice(-50);
          await putUser(key, user);
          return 1;
        }));
        rewarded += results.reduce((sum, value) => sum + value, 0);
      }
      return { status: 200, json: { ok: true, rewarded, amount, totalCredits: rewarded * amount } };
    }

    // stats overview
    if (p === '/api/admin/stats' && method === 'GET') {
      const now = Date.now();
      const period = usagePeriod(now);
      const [blocked, removed, custom, links, pool, userKeys, reports, bugs, activity] = await Promise.all([
        store.smembers('blocked'),
        store.smembers('removedlinks'),
        store.smembers('customlinks'),
        allLinks(),
        activeLinks(),
        allUserKeys(),
        listReports(),
        listBugs(),
        metricSeries(7),
      ]);
      const users = (await Promise.all(userKeys.map((key) => getUser(key)))).filter(Boolean);
      const lastSeen = await Promise.all(userKeys.map((key) => store.get(`lastseen:${key}`)));
      const usage = users.map((user) => accountInfo(user, now));
      const pending = reports.filter((report) => report.status === 'pending').length;
      const openBugs = bugs.filter(bugIsOpen).length;
      const bugUnread = bugs.reduce((sum, bug) => sum + bugSummary(bug, 'admin').unread, 0);
      const roleCounts = users.reduce((out, user) => {
        const role = roleOf(user);
        out[role] = (out[role] || 0) + 1;
        return out;
      }, { member: 0, support: 0, admin: 0, owner: 0 });
      const weeklyGenerations = usage.reduce((sum, item) => sum + Math.min(LINKS_PER_WEEK, item.used), 0);
      const averageUsage = usage.length ? Math.round(usage.reduce((sum, item) => sum + item.usagePercent, 0) / usage.length) : 0;
      return {
        status: 200,
        json: {
          viewer: { role: identity.role, username: identity.username, capabilities },
          accounts: userKeys.length,
          newThisWeek: users.filter((user) => Number(user.created || 0) >= period.start).length,
          onlineNow: lastSeen.filter((stamp) => Number(stamp || 0) >= now - 45000).length,
          active24h: lastSeen.filter((stamp) => Number(stamp || 0) >= now - 86400000).length,
          active7d: lastSeen.filter((stamp) => Number(stamp || 0) >= now - 7 * 86400000).length,
          totalLinks: links.length,
          activeLinks: pool.length,
          blockedCount: (blocked || []).length,
          removedCount: (removed || []).length,
          customLinks: (custom || []).length,
          reportsCount: reports.length,
          pendingReports: pending,
          bugsCount: bugs.length,
          openBugs,
          bugUnread,
          roles: roleCounts,
          weekly: { generations: weeklyGenerations, averageUsage, atCapacity: usage.filter((item) => item.usagePercent >= 100).length, resetAt: period.resetAt },
          activity,
        },
      };
    }

    // blocked list + all reports (newest first)
    if (p === '/api/admin/blocked' && method === 'GET') {
      const [blocked, removed, links, pool, reports, userKeys] = await Promise.all([
        store.smembers('blocked'),
        store.smembers('removedlinks'),
        allLinks(),
        activeLinks(),
        listReports(),
        allUserKeys(),
      ]);
      return { status: 200, json: { blocked, removed, reports: reports.slice().reverse(), totalLinks: links.length, activeLinks: pool.length, accounts: userKeys.length } };
    }

    // Full link-pool inventory for the admin control panel.
    if (p === '/api/admin/pool' && method === 'GET') {
      const [links, customList, blockedList, removedList] = await Promise.all([
        allLinks(),
        store.smembers('customlinks'),
        store.smembers('blocked'),
        store.smembers('removedlinks'),
      ]);
      const custom = new Set(customList || []);
      const blocked = new Set(blockedList || []);
      const removed = new Set(removedList || []);
      const entries = links.map((url) => ({
        url,
        source: custom.has(url) ? 'custom' : 'built-in',
        status: removed.has(url) ? 'removed' : blocked.has(url) ? 'paused' : 'active',
      }));
      return {
        status: 200,
        json: {
          links: entries,
          total: entries.length,
          active: entries.filter((item) => item.status === 'active').length,
          paused: entries.filter((item) => item.status === 'paused').length,
          removed: entries.filter((item) => item.status === 'removed').length,
          custom: entries.filter((item) => item.source === 'custom').length,
        },
      };
    }

    // Add one or many URLs. Existing removed/paused URLs are restored.
    if (p === '/api/admin/link-add' && method === 'POST') {
      const input = Array.isArray(body.urls)
        ? body.urls
        : typeof body.text === 'string'
          ? body.text.split(/[\s,]+/)
          : body.url
            ? [body.url]
            : [];
      const valid = cleanLinks(input).slice(0, 100);
      if (!valid.length) return { status: 400, json: { error: 'Enter at least one valid http(s) URL.' } };
      const existing = new Set(await allLinks());
      let added = 0;
      let restored = 0;
      for (const url of valid) {
        if (!existing.has(url)) {
          await store.sadd('customlinks', url);
          existing.add(url);
          added++;
        } else {
          restored++;
        }
        await store.srem('removedlinks', url);
        await store.srem('blocked', url);
        await cloak.unrevokeDestination(url);
      }
      return { status: 200, json: { ok: true, added, restored, total: (await allLinks()).length } };
    }

    // Remove any URL from rotation while keeping a restore path.
    if (p === '/api/admin/link-remove' && method === 'POST') {
      const url = typeof body.url === 'string' ? body.url.trim() : '';
      if (!url || !(await allLinks()).includes(url)) return { status: 404, json: { error: 'Link not found in the pool.' } };
      await store.sadd('removedlinks', url);
      await store.srem('blocked', url);
      await cloak.revokeDestination(url);
      const affected = await removeLinkFromUsers(url);
      return { status: 200, json: { ok: true, affected, activeLinks: (await activeLinks()).length } };
    }

    if (p === '/api/admin/link-restore' && method === 'POST') {
      const url = typeof body.url === 'string' ? body.url.trim() : '';
      if (!url || !(await allLinks()).includes(url)) return { status: 404, json: { error: 'Link not found in the pool.' } };
      await store.srem('removedlinks', url);
      await cloak.unrevokeDestination(url);
      return { status: 200, json: { ok: true, activeLinks: (await activeLinks()).length } };
    }

    // Custom URLs can also be deleted completely. Built-ins use remove/restore.
    if (p === '/api/admin/link-delete' && method === 'POST') {
      const url = typeof body.url === 'string' ? body.url.trim() : '';
      const custom = (await store.smembers('customlinks')) || [];
      if (!custom.includes(url)) return { status: 400, json: { error: 'Built-in links can be removed but not deleted from source.' } };
      await store.srem('customlinks', url);
      await store.srem('removedlinks', url);
      await store.srem('blocked', url);
      await cloak.revokeDestination(url);
      const affected = await removeLinkFromUsers(url);
      return { status: 200, json: { ok: true, affected, total: (await allLinks()).length } };
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
      await cloak.revokeDestination(url);

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
          text: 'A link in your list was removed and its weekly usage was returned to your account.',
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
        const info = accountInfo(u);
        users.push({
          username: u.username,
          created: u.created || null,
          linkCount: Array.isArray(u.links) ? u.links.length : 0,
          links: Array.isArray(u.links) ? u.links : [],
          tokens: info.remaining,
          bonus: info.bonus,
          usagePercent: info.usagePercent,
          usageAvailable: info.remaining,
          usageCredits: info.bonus,
          resetAt: info.resetAt,
          role: roleOf(u),
          settings: settingsOf(u),
        });
      }
      users.sort((a, b) => (b.created || 0) - (a.created || 0));
      return { status: 200, json: { users, accounts: users.length } };
    }

    // Only the signed-in owner can promote or demote staff accounts.
    if (p === '/api/admin/role-set' && method === 'POST') {
      const userKey = typeof body.username === 'string' ? body.username.toLowerCase() : '';
      const role = typeof body.role === 'string' ? body.role.toLowerCase() : '';
      if (!USER_ROLES.includes(role)) return { status: 400, json: { error: 'Choose member, support, or admin.' } };
      if (userKey === OWNER_USERNAME) return { status: 403, json: { error: 'The owner account cannot be demoted.' } };
      const user = userKey ? await getUser(userKey) : null;
      if (!user) return { status: 404, json: { error: 'User not found.' } };
      user.role = role;
      user.notifications = user.notifications || [];
      user.notifications.push({ id: crypto.randomBytes(5).toString('hex'), text: `Your Scale XT role is now ${role}.`, at: Date.now(), read: false, from: 'admin' });
      if (user.notifications.length > 50) user.notifications = user.notifications.slice(-50);
      await putUser(userKey, user);
      return { status: 200, json: { ok: true, username: user.username, role } };
    }

    // restore a link to rotation
    if (p === '/api/admin/unblock' && method === 'POST') {
      const { url } = body;
      if (url) { await store.srem('blocked', url); await cloak.unrevokeDestination(url); }
      const [pool, blocked] = await Promise.all([activeLinks(), store.smembers('blocked')]);
      return { status: 200, json: { ok: true, activeLinks: pool.length, blockedCount: (blocked || []).length } };
    }

    // manually block a link (admin-initiated; no user refund needed)
    if (p === '/api/admin/block' && method === 'POST') {
      const { url } = body;
      if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return { status: 400, json: { error: 'Invalid url.' } };
      if (!(await allLinks()).includes(url)) return { status: 404, json: { error: 'Link not found in the pool.' } };
      await store.sadd('blocked', url);
      await store.srem('removedlinks', url);
      await cloak.revokeDestination(url);
      const [pool, blocked] = await Promise.all([activeLinks(), store.smembers('blocked')]);
      return { status: 200, json: { ok: true, activeLinks: pool.length, blockedCount: (blocked || []).length } };
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
          text: 'An admin added extra weekly usage to your account.',
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

    // Publish to the public home-page feed and every account's notification inbox.
    if (p === '/api/admin/announce' && method === 'POST') {
      let title = typeof body.title === 'string' ? body.title.trim() : '';
      let text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text) return { status: 400, json: { error: 'Enter an announcement.' } };
      if (!title) title = 'General announcement';
      if (title.length > 80) title = title.slice(0, 80);
      if (text.length > 1000) text = text.slice(0, 1000);
      const keys = await allUserKeys();
      const aid = crypto.randomBytes(5).toString('hex');
      const at = Date.now();
      let sent = 0;
      for (const k of keys) {
        const u = await getUser(k);
        if (!u) continue;
        u.notifications = u.notifications || [];
        u.notifications.push({ id: crypto.randomBytes(5).toString('hex'), title, text, at, read: false, from: 'announcement', announcementId: aid });
        if (u.notifications.length > 50) u.notifications = u.notifications.slice(-50);
        await putUser(k, u);
        sent++;
      }
      await store.set(`announce:${aid}`, JSON.stringify({ id: aid, title, text, at, recipients: sent }));
      await store.rpush('announceids', aid);
      console.log(`[Scale XT] ANNOUNCE to ${sent} account(s): ${title}`);
      return { status: 200, json: { ok: true, id: aid, recipients: sent } };
    }

    // Announcement history (newest first), shared with the public feed.
    if (p === '/api/admin/announcements' && method === 'GET') {
      return { status: 200, json: { announcements: await listAnnouncements() } };
    }
    // Publish and manage product release notes shown inside the extension.
    if (p === '/api/admin/releases' && method === 'GET') {
      return { status: 200, json: { releases: await listReleases() } };
    }

    if (p === '/api/admin/release' && method === 'POST') {
      let version = typeof body.version === 'string' ? body.version.trim() : VERSION;
      let title = typeof body.title === 'string' ? body.title.trim() : '';
      let text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!/^\d+\.\d+\.\d+(?:[-+][a-z0-9.-]+)?$/i.test(version)) return { status: 400, json: { error: 'Use a version like 2.4.0.' } };
      if (!title) return { status: 400, json: { error: 'Enter a release title.' } };
      if (!text) return { status: 400, json: { error: 'Enter release notes.' } };
      title = title.slice(0, 100);
      text = text.slice(0, 2000);
      const id = crypto.randomBytes(6).toString('hex');
      const release = { id, version, title, text, at: Date.now(), by: identity.username, source: 'published' };
      await store.set(`release:${id}`, JSON.stringify(release));
      await store.rpush('releaseids', id);
      return { status: 200, json: { ok: true, release } };
    }

    if (p === '/api/admin/release-delete' && method === 'POST') {
      const id = typeof body.id === 'string' ? body.id : '';
      if (BUILT_IN_RELEASES.some((release) => release.id === id)) return { status: 400, json: { error: 'Built-in release notes cannot be deleted.' } };
      const raw = id ? await store.get(`release:${id}`) : null;
      if (!raw) return { status: 404, json: { error: 'Release note not found.' } };
      await store.del(`release:${id}`);
      return { status: 200, json: { ok: true } };
    }


    // Support inbox: compact ticket summaries, sorted by the latest activity.
    if (p === '/api/admin/bugs' && method === 'GET') {
      const bugs = (await listBugs())
        .map((bug) => bugSummary(bug, 'admin'))
        .sort((a, b) => b.updatedAt - a.updatedAt);
      return {
        status: 200,
        json: {
          bugs,
          open: bugs.filter(bugIsOpen).length,
          unread: bugs.reduce((sum, bug) => sum + bug.unread, 0),
        },
      };
    }

    // Open a full support conversation and mark the user's messages as read.
    if (p === '/api/admin/bug-thread' && method === 'POST') {
      const id = typeof body.id === 'string' ? body.id : '';
      const raw = id ? await store.get(`bug:${id}`) : null;
      if (!raw) return { status: 404, json: { error: 'Bug report not found.' } };
      const bug = normalizeBug(JSON.parse(raw));
      bug.lastAdminReadAt = Date.now();
      await store.set(`bug:${id}`, JSON.stringify(bug));
      return { status: 200, json: { bug: Object.assign(bugSummary(bug, 'admin'), { messages: bug.messages }) } };
    }

    // Reply inside the report itself. The user sees it in the same thread and
    // also gets a lightweight notification that support responded.
    if (p === '/api/admin/bug-reply' && method === 'POST') {
      const id = typeof body.id === 'string' ? body.id : '';
      let text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text) return { status: 400, json: { error: 'Enter a reply.' } };
      if (text.length > 2000) text = text.slice(0, 2000);
      const raw = id ? await store.get(`bug:${id}`) : null;
      if (!raw) return { status: 404, json: { error: 'Bug report not found.' } };
      const bug = normalizeBug(JSON.parse(raw));
    const at = nextBugTime(bug);
      bug.messages.push({ id: crypto.randomBytes(6).toString('hex'), from: 'admin', fromName: 'Scale XT support', text, at });
      if (bug.messages.length > 200) bug.messages = bug.messages.slice(-200);
      const requestedStatus = typeof body.status === 'string' ? body.status : '';
      if (['open', 'waiting', 'fixed', 'dismissed'].includes(requestedStatus)) bug.status = requestedStatus;
      else if (bugIsOpen(bug)) bug.status = 'waiting';
      if (!bugIsOpen(bug)) bug.resolvedAt = at;
      else delete bug.resolvedAt;
      bug.updatedAt = at;
      bug.lastAdminReadAt = at;
      await store.set(`bug:${id}`, JSON.stringify(bug));
      await pushNotification(String(bug.by || '').toLowerCase(), `Support replied to "${bug.title}".`, { from: 'support', bugId: id });
      return { status: 200, json: { ok: true, bug: Object.assign(bugSummary(bug, 'admin'), { messages: bug.messages }) } };
    }

    // resolve a bug -> mark fixed + award up to 10 tokens + notify the reporter
    if (p === '/api/admin/bug-resolve' && method === 'POST') {
      const id = typeof body.id === 'string' ? body.id : '';
      const raw = id ? await store.get(`bug:${id}`) : null;
      if (!raw) return { status: 404, json: { error: 'Bug not found.' } };
      const bug = normalizeBug(JSON.parse(raw));
      if (bug.status === 'fixed') return { status: 409, json: { error: 'This report is already fixed.' } };
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
              ? 'Your bug report was reviewed and extra weekly usage was added to your account.'
              : 'Your bug report was reviewed. Thanks for the heads up!',
          at: Date.now(),
          read: false,
        });
        if (u.notifications.length > 50) u.notifications = u.notifications.slice(-50);
        await putUser(ukey, u);
      }
    const at = nextBugTime(bug);
      bug.status = 'fixed';
      bug.tokens = tokens;
      bug.resolvedAt = at;
      bug.updatedAt = at;
      bug.lastAdminReadAt = at;
      bug.messages.push({
        id: crypto.randomBytes(6).toString('hex'),
        from: 'admin',
        fromName: 'Scale XT support',
        text: tokens > 0
          ? 'Marked fixed. Extra weekly usage was added to the reporter account.'
          : 'Marked fixed. Thanks for helping improve Scale XT.',
        at,
        system: true,
      });
      await store.set(`bug:${id}`, JSON.stringify(bug));
      return { status: 200, json: { ok: true, tokens, rewarded: Boolean(u), bug: Object.assign(bugSummary(bug, 'admin'), { messages: bug.messages }) } };
    }

    // dismiss a bug -> mark dismissed, notify reporter, no tokens
    if (p === '/api/admin/bug-dismiss' && method === 'POST') {
      const id = typeof body.id === 'string' ? body.id : '';
      const raw = id ? await store.get(`bug:${id}`) : null;
      if (!raw) return { status: 404, json: { error: 'Bug not found.' } };
      const bug = normalizeBug(JSON.parse(raw));
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
    const at = nextBugTime(bug);
      bug.status = 'dismissed';
      bug.resolvedAt = at;
      bug.updatedAt = at;
      bug.lastAdminReadAt = at;
      bug.messages.push({
        id: crypto.randomBytes(6).toString('hex'),
        from: 'admin',
        fromName: 'Scale XT support',
        text: 'This report was closed. Reply from your support inbox if the problem is still happening.',
        at,
        system: true,
      });
      await store.set(`bug:${id}`, JSON.stringify(bug));
      return { status: 200, json: { ok: true, bug: Object.assign(bugSummary(bug, 'admin'), { messages: bug.messages }) } };
    }

    // delete an account
    if (p === '/api/admin/delete-user' && method === 'POST') {
      const key = typeof body.username === 'string' ? body.username.toLowerCase() : '';
      if (key === OWNER_USERNAME) return { status: 403, json: { error: 'The owner account cannot be deleted.' } };
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

module.exports = { handle, LINKS, RATE_LIMIT_ENABLED, LINKS_PER_WEEK, usagePeriod };
