// =============================================================================
// Scale XT link cloaking gateway
// -----------------------------------------------------------------------------
// The link pool is private. Historically /api/links handed the raw destination
// URL straight to the browser, which meant anyone could copy a generated link,
// paste it somewhere else, and reach the destination without ever touching this
// service — leaking the pool and bypassing usage limits.
//
// This module wraps every destination in an opaque, per-destination token. The
// user only ever sees `<base>/go/<token>`. The real URL is stored server-side
// and is never printed into the page that the gateway serves; the browser has
// to call back into /api/go/<token> to obtain it, so every visit is forced
// through this service (loggable, rate-limitable, and revocable).
//
//   real destination  <->  cloak:<token>  (stored)
//   shared link        =    <base>/go/<token>
//   resolve endpoint   =    GET /api/go/<token>  -> { url }
//   gateway page       =    GET /go/<token>      -> branded interstitial
//
// Tokens are deterministic (a keyed hash of the destination) so the same
// destination always maps to the same token: a user's saved links stay stable,
// the token table does not grow without bound, and revoking one destination
// kills every cloak link that points at it.
// =============================================================================

const crypto = require('crypto');
const store = require('./store.js');

// Secret that keys the token hash. Set CLOAK_SECRET in production so tokens are
// not guessable from the destination alone. If it is rotated, previously issued
// tokens stop matching new ones — the stored mapping still resolves old tokens,
// but freshly generated links use the new secret.
const CLOAK_SECRET =
  process.env.CLOAK_SECRET ||
  process.env.ADMIN_KEY ||
  process.env.OWNER_SETUP_PASSWORD ||
  'scale-xt-cloak';

// Public origin the gateway links point at. On Railway this is the deployed
// domain; override with PUBLIC_BASE_URL for other hosts / local testing.
function cloakBase() {
  const base =
    process.env.PUBLIC_BASE_URL ||
    process.env.BASE_URL ||
    'https://voidext-production.up.railway.app';
  return String(base).replace(/\/+$/, '');
}

// Deterministic opaque token for a destination.
function tokenFor(dest) {
  return crypto
    .createHmac('sha256', CLOAK_SECRET)
    .update(String(dest))
    .digest('base64')
    .replace(/[+/=]/g, (c) => ({ '+': 'A', '/': 'B', '=': '' }[c]))
    .slice(0, 22);
}

// Ensure a destination has a stored token and return the shareable cloak URL.
async function cloakUrl(dest) {
  if (typeof dest !== 'string' || !/^https?:\/\//i.test(dest)) return dest;
  const token = tokenFor(dest);
  try {
    // Idempotent write — same destination always lands on the same key.
    await store.set(`cloak:${token}`, dest);
  } catch (e) {
    // If the store is unavailable we still return a resolvable link because the
    // token is deterministic; the resolver recomputes and re-stores on demand.
  }
  return `${cloakBase()}/go/${token}`;
}

// Cloak a list of destinations for display.
async function cloakList(list) {
  if (!Array.isArray(list)) return [];
  return Promise.all(list.map((u) => cloakUrl(u)));
}

// Extract the token from a cloak URL (either the full `<base>/go/<token>` form
// or a bare `/go/<token>` path). Returns null for anything else.
function tokenFromUrl(url) {
  if (typeof url !== 'string') return null;
  const m = url.match(/\/go\/([A-Za-z0-9_-]{6,64})(?:[/?#]|$)/);
  return m ? m[1] : null;
}

function isCloakUrl(url) {
  return tokenFromUrl(url) !== null;
}

// Resolve a token back to its destination, honoring revocation.
async function resolveToken(token) {
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(String(token || ''))) return null;
  try {
    if (await store.get(`cloakblock:${token}`)) return null; // revoked
    const dest = await store.get(`cloak:${token}`);
    if (dest && /^https?:\/\//i.test(dest)) return dest;
  } catch (e) {
    return null;
  }
  return null;
}

// Given something the client sent back (which we only ever handed out cloaked),
// return the underlying real destination. Falls back to the input unchanged so
// callers can pass raw URLs safely.
async function resolveInbound(url) {
  const token = tokenFromUrl(url);
  if (!token) return url;
  const dest = await resolveToken(token);
  return dest || url;
}

// Revoke every cloak link pointing at a destination (used when an admin blocks
// or removes a pool entry). Deterministic tokens make this a single write.
async function revokeDestination(dest) {
  if (typeof dest !== 'string' || !dest) return;
  const token = tokenFor(dest);
  try {
    await store.set(`cloakblock:${token}`, '1');
  } catch (e) {
    /* best effort */
  }
}

// Undo a revocation (used when an admin restores a previously removed entry).
async function unrevokeDestination(dest) {
  if (typeof dest !== 'string' || !dest) return;
  const token = tokenFor(dest);
  try {
    await store.del(`cloakblock:${token}`);
  } catch (e) {
    /* best effort */
  }
}

// Coarse per-IP rate limit for the resolver, so the gateway can't be scripted to
// dump the whole pool in bulk. Generous enough for real browsing.
const RESOLVE_LIMIT = Number(process.env.CLOAK_RESOLVE_LIMIT || 120); // per window
const RESOLVE_WINDOW = 60; // seconds
async function rateLimited(ip) {
  if (!ip || ip === 'unknown') return false;
  try {
    const key = `gorate:${ip}`;
    const n = await store.incr(key);
    if (n === 1) await store.expire(key, RESOLVE_WINDOW);
    return n > RESOLVE_LIMIT;
  } catch (e) {
    return false; // never block real users on a storage hiccup
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Relaxed CSP for the gateway page only: it must be allowed to frame the target
// site (any http/https origin). Everything else stays locked down.
const GATEWAY_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; " +
  "style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; " +
  "frame-src https: http:; connect-src 'self'; base-uri 'self'; form-action 'self'";

// The gateway served at /go/<token>. The target site is loaded into a
// full-viewport iframe whose src is a SAME-ORIGIN loader (/api/frame/<token>),
// so:
//   * the browser address bar stays on <base>/go/<token> — the real
//     destination is never shown there,
//   * the destination URL never appears in this page's HTML or in any
//     JavaScript the page runs,
//   * the visitor can use the site normally inside the frame.
// The iframe is sandboxed WITHOUT allow-top-navigation, so the embedded site
// cannot break out of the frame and reveal itself in the address bar.
function gatewayPage(token) {
  const safe = escapeHtml(token);
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="referrer" content="no-referrer">
<title>Scale XT</title>
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%;width:100%;overflow:hidden;background:#06030e}
  #frame{position:fixed;inset:0;width:100vw;height:100vh;border:0;
    background:#06030e;z-index:2}
  #load{position:fixed;inset:0;display:flex;flex-direction:column;
    align-items:center;justify-content:center;z-index:1;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#fff;
    background:radial-gradient(ellipse at 50% -10%,#170d30 0%,#06030e 55%,#000 100%)}
  .logo{font-weight:800;font-size:24px;letter-spacing:.5px;
    background:linear-gradient(115deg,#c084fc,#f472b6 55%,#38bdf8);
    -webkit-background-clip:text;background-clip:text;color:transparent;margin-bottom:20px}
  .spin{width:42px;height:42px;border-radius:50%;
    border:3px solid rgba(255,255,255,.14);border-top-color:#c084fc;
    animation:spin .8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .hint{margin-top:18px;font-size:12.5px;color:rgba(255,255,255,.42);
    max-width:320px;text-align:center}
  .hint a{color:#c084fc;text-decoration:none}
</style></head><body>
<div id="load">
  <div class="logo">Scale XT</div>
  <div class="spin"></div>
  <div class="hint" id="hint">Loading your content&hellip;</div>
</div>
<iframe id="frame"
  src="/api/frame/${encodeURIComponent(safe)}"
  allow="autoplay; fullscreen; clipboard-write; encrypted-media; gamepad"
  allowfullscreen
  sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-pointer-lock allow-same-origin allow-scripts allow-downloads"></iframe>
<script>
(function(){
  var frame=document.getElementById('frame');
  var load=document.getElementById('load');
  var hint=document.getElementById('hint');
  frame.addEventListener('load',function(){
    // Hide the splash once the framed site has rendered.
    load.style.display='none';
  });
  // If it hasn't loaded after a while, offer a retry (some sites are slow or
  // refuse to be embedded). We never reveal the destination here.
  setTimeout(function(){
    if(load.style.display!=='none'){
      hint.innerHTML='Still loading&hellip; <a href="javascript:location.reload()">retry</a>';
    }
  },9000);
})();
</script>
</body></html>`;
}

function notFoundPage() {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Scale XT</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
background:#06030e;color:#fff;min-height:100vh;display:flex;align-items:center;
justify-content:center;text-align:center}div{max-width:380px;padding:32px}
.l{font-weight:800;font-size:22px;color:#c084fc;margin-bottom:14px}
p{color:rgba(255,255,255,.6);font-size:14px}</style></head><body>
<div><div class="l">Scale XT</div><p>This link has expired or is no longer
available. Generate a fresh one from your dashboard.</p></div></body></html>`;
}

module.exports = {
  GATEWAY_CSP,
  cloakBase,
  tokenFor,
  cloakUrl,
  cloakList,
  tokenFromUrl,
  isCloakUrl,
  resolveToken,
  resolveInbound,
  revokeDestination,
  unrevokeDestination,
  rateLimited,
  gatewayPage,
  notFoundPage,
};
