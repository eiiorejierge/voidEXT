'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.DATABASE_URL;
process.env.PUBLIC_BASE_URL = 'https://example.test';
delete globalThis.__voidMem;

const { handle } = require('../lib/core.js');
const cloak = require('../lib/cloak.js');

async function signup(username, ip) {
  const r = await handle({
    method: 'POST',
    path: '/api/signup',
    body: { username, password: 'password123' },
    ip,
  });
  return r.json.token;
}

test('generated links are cloaked and never leak the real destination', async () => {
  const ip = '10.0.0.1';
  const token = await signup('cloaktester', ip);
  const auth = 'Bearer ' + token;

  const gen = await handle({ method: 'GET', path: '/api/links', authHeader: auth, ip });
  assert.equal(gen.status, 200);
  assert.ok(gen.json.added, 'a link was generated');

  // The user only ever sees a /go/<token> gateway URL.
  assert.ok(cloak.isCloakUrl(gen.json.added), 'added link is a cloak URL');
  assert.match(gen.json.added, /^https:\/\/example\.test\/go\/[A-Za-z0-9_-]{6,64}$/);
  for (const link of gen.json.links) assert.ok(cloak.isCloakUrl(link));

  const tok = cloak.tokenFromUrl(gen.json.added);
  const dest = await cloak.resolveToken(tok);
  assert.match(dest, /^https?:\/\//, 'server holds a real destination');

  // The real destination leaks nowhere in the /api/links response.
  assert.ok(!JSON.stringify(gen.json).includes(dest), 'response never contains the destination');

  // The gateway page renders, embeds a same-origin frame loader, and does NOT
  // contain the destination anywhere in its HTML.
  const page = await handle({ method: 'GET', path: '/go/' + tok, ip: '9.9.9.9' });
  assert.equal(page.status, 200);
  assert.equal(page.contentType, 'text/html; charset=utf-8');
  assert.ok(page.headers && /frame-src/.test(page.headers['Content-Security-Policy']), 'relaxed CSP allows framing');
  assert.ok(page.body.includes('/api/frame/' + tok), 'page frames the same-origin loader');
  assert.ok(!page.body.includes(dest), 'gateway HTML never prints the destination');

  // The frame loader redirects *inside the iframe* to the destination; the
  // real URL only appears as a redirect Location, never in the top document.
  const frame = await handle({ method: 'GET', path: '/api/frame/' + tok, ip: '9.9.9.9' });
  assert.equal(frame.status, 302);
  assert.equal(frame.location, dest);
});

test('unknown and revoked tokens do not resolve', async () => {
  const bogus = 'Zz'.repeat(11);
  const missing = await handle({ method: 'GET', path: '/api/frame/' + bogus, ip: '9.9.9.9' });
  assert.equal(missing.status, 404);
  const missingPage = await handle({ method: 'GET', path: '/go/' + bogus, ip: '9.9.9.9' });
  assert.equal(missingPage.status, 404);

  const ip = '10.0.0.2';
  const auth = 'Bearer ' + (await signup('revoketester', ip));
  const gen = await handle({ method: 'GET', path: '/api/links', authHeader: auth, ip });
  const tok = cloak.tokenFromUrl(gen.json.added);
  const dest = await cloak.resolveToken(tok);

  await cloak.revokeDestination(dest);
  const afterRevoke = await handle({ method: 'GET', path: '/api/frame/' + tok, ip: '9.9.9.9' });
  assert.equal(afterRevoke.status, 404, 'revoked token stops loading');

  await cloak.unrevokeDestination(dest);
  const afterRestore = await handle({ method: 'GET', path: '/api/frame/' + tok, ip: '9.9.9.9' });
  assert.equal(afterRestore.status, 302, 'restoring re-enables the token');
});

test('cloak URLs sent back by the client resolve to the real destination', async () => {
  const ip = '10.0.0.3';
  const auth = 'Bearer ' + (await signup('roundtrip', ip));
  const gen = await handle({ method: 'GET', path: '/api/links', authHeader: auth, ip });
  const cloakUrl = gen.json.added;

  // Pin, then delete, using the cloak URL the client actually holds.
  const pin = await handle({ method: 'POST', path: '/api/links/pin', authHeader: auth, body: { url: cloakUrl, pinned: true }, ip });
  assert.equal(pin.json.ok, true);
  assert.ok(cloak.isCloakUrl(pin.json.pinned[0]), 'pinned list stays cloaked');

  const del = await handle({ method: 'POST', path: '/api/links/delete', authHeader: auth, body: { url: cloakUrl }, ip });
  assert.equal(del.json.ok, true);
  assert.equal(del.json.links.length, 0, 'the cloaked link resolved back and was removed');
});
