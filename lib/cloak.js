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
    'https://nebulabkmlinks.shop';
  const normalized = String(base).replace(/\/+$/, '');
  // Migrate Railway deployments that still have the former production origin configured.
  return normalized === 'https://nebulabkm.xyz' ? 'https://nebulabkmlinks.shop' : normalized;
}

// Per-user opaque token. Two different accounts get two different tokens for the
// same destination, so a link is tied to the account that generated it and can
// be locked to that owner. Deterministic (a keyed hash of owner + destination)
// so a user's saved links stay stable and the token table does not grow without
// bound. Looks like a random string of letters/digits.
function tokenFor(dest, owner) {
  return crypto
    .createHmac('sha256', CLOAK_SECRET)
    .update(String(owner || '') + '\n' + String(dest))
    .digest('base64')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 24);
}

// A destination-only key used for revocation, so blocking a pool entry disables
// every user's cloak link for it at once (tokens themselves are per-user).
function destKey(dest) {
  return crypto
    .createHmac('sha256', CLOAK_SECRET)
    .update('dest\n' + String(dest))
    .digest('hex')
    .slice(0, 24);
}

// Ensure a destination has a stored token for this owner and return the
// shareable cloak URL, of the form <base>/<token> (root path, short).
async function cloakUrl(dest, owner) {
  if (typeof dest !== 'string' || !/^https?:\/\//i.test(dest)) return dest;
  const token = tokenFor(dest, owner);
  try {
    // Idempotent write — same (owner, destination) always lands on the same key.
    await store.set(`cloak:${token}`, JSON.stringify({ u: dest, o: owner || null }));
  } catch (e) {
    /* deterministic token still resolves once the store recovers */
  }
  return `${cloakBase()}/${token}`;
}

// Cloak a list of destinations for display, all owned by `owner`.
async function cloakList(list, owner) {
  if (!Array.isArray(list)) return [];
  return Promise.all(list.map((u) => cloakUrl(u, owner)));
}

// Extract the token from a cloak URL. Accepts the new root form `<base>/<token>`
// and the legacy `<base>/go/<token>` form. Returns null for anything else (a
// real multi-segment destination URL never matches).
function tokenFromUrl(url) {
  if (typeof url !== 'string') return null;
  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch (e) {
    const noProto = url.replace(/^[a-z]+:\/\/[^/]+/i, '');
    pathname = noProto || url;
  }
  const m = pathname.match(/^\/(?:go\/)?([A-Za-z0-9]{16,64})\/?$/);
  return m ? m[1] : null;
}

function isCloakUrl(url) {
  return tokenFromUrl(url) !== null;
}

// Resolve a token to { url, owner } (or null), honoring per-destination
// revocation. Tolerates the legacy plain-string storage format.
async function resolveToken(token) {
  if (!/^[A-Za-z0-9]{16,64}$/.test(String(token || ''))) return null;
  try {
    const raw = await store.get(`cloak:${token}`);
    if (!raw) return null;
    let url = null;
    let owner = null;
    if (typeof raw === 'string' && raw[0] === '{') {
      const parsed = JSON.parse(raw);
      url = parsed.u;
      owner = parsed.o || null;
    } else {
      url = raw; // legacy: value was the destination string itself
    }
    if (!url || !/^https?:\/\//i.test(url)) return null;
    if (await store.get(`cloakblock:${destKey(url)}`)) return null; // revoked
    return { url, owner };
  } catch (e) {
    return null;
  }
}

// Given something the client sent back (which we only ever handed out cloaked),
// return the underlying real destination. Falls back to the input unchanged so
// callers can pass raw URLs safely.
async function resolveInbound(url) {
  const token = tokenFromUrl(url);
  if (!token) return url;
  const resolved = await resolveToken(token);
  return resolved ? resolved.url : url;
}

// Revoke every cloak link pointing at a destination (used when an admin blocks
// or removes a pool entry) — one write, keyed by the destination.
async function revokeDestination(dest) {
  if (typeof dest !== 'string' || !dest) return;
  try {
    await store.set(`cloakblock:${destKey(dest)}`, '1');
  } catch (e) {
    /* best effort */
  }
}

// Undo a revocation (used when an admin restores a previously removed entry).
async function unrevokeDestination(dest) {
  if (typeof dest !== 'string' || !dest) return;
  try {
    await store.del(`cloakblock:${destKey(dest)}`);
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

// localStorage key the app stores the signed-in session bearer under. The
// gateway page reads it (same origin) to prove who is opening the link.
const SESSION_KEY = 'voidext_token';

// The gateway served at <base>/<token>. Access is OWNER-ONLY: the page reads the
// viewer's Scale XT session from same-origin localStorage, asks the server for a
// one-time frame ticket (which the server grants only if that session owns this
// token), and loads the target into a full-viewport sandboxed iframe via the
// ticket. As a result:
//   * the browser address bar stays on <base>/<token> — the real destination is
//     never shown there,
//   * the destination URL never appears in this page's HTML or in any
//     JavaScript the page runs (the page only ever sees a single-use ticket),
//   * only the account that generated the link can open it,
//   * the sandbox omits allow-top-navigation, so the embedded site cannot break
//     out of the frame and reveal itself.
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
    background:#06030e;z-index:2;display:none}
  #load{position:fixed;inset:0;display:flex;flex-direction:column;
    align-items:center;justify-content:center;z-index:1;padding:24px;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#fff;
    background:radial-gradient(ellipse at 50% -10%,#170d30 0%,#06030e 55%,#000 100%)}
  .logo{font-weight:800;font-size:24px;letter-spacing:.5px;
    background:linear-gradient(115deg,#c084fc,#f472b6 55%,#38bdf8);
    -webkit-background-clip:text;background-clip:text;color:transparent;margin-bottom:20px}
  .spin{width:42px;height:42px;border-radius:50%;
    border:3px solid rgba(255,255,255,.14);border-top-color:#c084fc;
    animation:spin .8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .hint{margin-top:18px;font-size:13px;color:rgba(255,255,255,.5);
    max-width:340px;text-align:center;line-height:1.5}
  .hint a{color:#c084fc;text-decoration:none}
  .err .spin{display:none}
  .err .hint{color:#fb7185}
</style></head><body>
<div id="load">
  <div class="logo">Scale XT</div>
  <div class="spin" id="spin"></div>
  <div class="hint" id="hint">Checking your access&hellip;</div>
</div>
<iframe id="frame"
  allow="autoplay; fullscreen; clipboard-write; encrypted-media; gamepad"
  allowfullscreen
  sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-pointer-lock allow-same-origin allow-scripts allow-downloads"></iframe>
<script>
(function(){
  var token=${JSON.stringify(safe)};
  var frame=document.getElementById('frame');
  var load=document.getElementById('load');
  var hint=document.getElementById('hint');
  function fail(t){
    load.className='err';
    hint.innerHTML=t;
  }
  var session='';
  try{ session=localStorage.getItem(${JSON.stringify(SESSION_KEY)})||''; }catch(e){}
  if(!session){
    return fail('Open this link from your own Scale XT account.<br>Launch the Scale XT bookmark and sign in first, then open your link again.');
  }
  fetch('/api/frame-ticket',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+session},
    body:JSON.stringify({token:token})
  }).then(function(r){
    if(r.status===401) throw new Error('signin');
    if(r.status===403) throw new Error('owner');
    if(r.status===429) throw new Error('rate');
    if(!r.ok) throw new Error('gone');
    return r.json();
  }).then(function(d){
    if(!d||!d.ticket) throw new Error('gone');
    frame.addEventListener('load',function(){
      load.style.display='none'; frame.style.display='block';
    });
    frame.style.display='block';
    frame.src='/api/frame/'+encodeURIComponent(d.ticket);
    setTimeout(function(){
      if(load.style.display!=='none'){
        hint.innerHTML='Still loading&hellip; <a href="javascript:location.reload()">retry</a>';
      }
    },9000);
  }).catch(function(e){
    var m=e&&e.message;
    if(m==='signin') return fail('Your session has expired. Open the Scale XT bookmark, sign in, then open your link again.');
    if(m==='owner') return fail('This link belongs to a different Scale XT account and can only be opened by its owner.');
    if(m==='rate') return fail('Too many requests. Please wait a moment and refresh.');
    return fail('This link has expired or is no longer available.<br>Generate a fresh one from your dashboard.');
  });
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
