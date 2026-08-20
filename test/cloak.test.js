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

test('the former production base automatically migrates to the dedicated link domain', () => {
  const originalBase = process.env.PUBLIC_BASE_URL;
  process.env.PUBLIC_BASE_URL = 'https://nebulabkm.xyz/';
  try {
    assert.equal(cloak.cloakBase(), 'https://nebulabkmlinks.shop');
  } finally {
    process.env.PUBLIC_BASE_URL = originalBase;
  }
});

async function signup(username, ip) {
  const r = await handle({
    method: 'POST',
    path: '/api/signup',
    body: { username, password: 'password123' },
    ip,
  });
  return r.json.token;
}

test('links are per-user root-path cloak URLs that never leak the destination', async () => {
  const ip = '10.0.0.1';
  const token = await signup('cloaktester', ip);
  const auth = 'Bearer ' + token;

  const gen = await handle({ method: 'GET', path: '/api/links', authHeader: auth, ip });
  assert.equal(gen.status, 200);
  assert.ok(gen.json.added, 'a link was generated');

  // The user only ever sees a short root-path cloak URL on the custom domain.
  assert.match(gen.json.added, /^https:\/\/example\.test\/[A-Za-z0-9]{16,64}$/);
  assert.ok(cloak.isCloakUrl(gen.json.added));
  for (const link of gen.json.links) assert.ok(cloak.isCloakUrl(link));

  const tok = cloak.tokenFromUrl(gen.json.added);
  const resolved = await cloak.resolveToken(tok);
  assert.match(resolved.url, /^https?:\/\//, 'server holds a real destination');
  assert.ok(resolved.owner, 'the token records an owner');

  // The real destination leaks nowhere in the response.
  assert.ok(!JSON.stringify(gen.json).includes(resolved.url));
});

test('the same destination gives different users different tokens', async () => {
  const a = await cloak.cloakUrl('https://example.com/game', 'usera');
  const b = await cloak.cloakUrl('https://example.com/game', 'userb');
  assert.notEqual(a, b, 'per-user tokens differ');
  assert.equal((await cloak.resolveToken(cloak.tokenFromUrl(a))).owner, 'usera');
  assert.equal((await cloak.resolveToken(cloak.tokenFromUrl(b))).owner, 'userb');
});

test('the gateway page hides the destination and enforces access client-side', async () => {
  const ip = '10.0.0.2';
  const auth = 'Bearer ' + (await signup('pagetester', ip));
  const gen = await handle({ method: 'GET', path: '/api/links', authHeader: auth, ip });
  const tok = cloak.tokenFromUrl(gen.json.added);
  const dest = (await cloak.resolveToken(tok)).url;

  const page = await handle({ method: 'GET', path: '/' + tok, ip: '9.9.9.9' });
  assert.equal(page.status, 200);
  assert.equal(page.contentType, 'text/html; charset=utf-8');
  assert.ok(/frame-src/.test(page.headers['Content-Security-Policy']), 'relaxed CSP allows framing');
  // The page proves ownership via the session before loading anything.
  assert.ok(page.body.includes('/api/frame-ticket'), 'page requests an access ticket');
  assert.ok(page.body.includes('voidext_token'), 'page reads the signed-in session');
  assert.ok(!page.body.includes(dest), 'gateway HTML never prints the destination');
});

test('only the owner can mint a ticket, and the ticket is single-use', async () => {
  const ipA = '10.0.0.3';
  const ipB = '10.0.0.4';
  const authA = 'Bearer ' + (await signup('owneruser', ipA));
  const authB = 'Bearer ' + (await signup('otheruser', ipB));
  const gen = await handle({ method: 'GET', path: '/api/links', authHeader: authA, ip: ipA });
  const tok = cloak.tokenFromUrl(gen.json.added);
  const dest = (await cloak.resolveToken(tok)).url;

  // No session -> denied.
  const anon = await handle({ method: 'POST', path: '/api/frame-ticket', body: { token: tok }, ip: '1.1.1.1' });
  assert.equal(anon.status, 401);

  // A different account -> denied (owner-only).
  const other = await handle({ method: 'POST', path: '/api/frame-ticket', authHeader: authB, body: { token: tok }, ip: ipB });
  assert.equal(other.status, 403);

  // The owner -> gets a one-time ticket.
  const mint = await handle({ method: 'POST', path: '/api/frame-ticket', authHeader: authA, body: { token: tok }, ip: ipA });
  assert.equal(mint.status, 200);
  assert.ok(mint.json.ticket);
  // The ticket response never contains the destination.
  assert.ok(!JSON.stringify(mint.json).includes(dest));

  // The ticket loads the site inside the iframe (a redirect the top bar never sees).
  const frame1 = await handle({ method: 'GET', path: '/api/frame/' + mint.json.ticket, ip: ipA });
  assert.equal(frame1.status, 302);
  assert.equal(frame1.location, dest);

  // Single use: the same ticket cannot be replayed.
  const frame2 = await handle({ method: 'GET', path: '/api/frame/' + mint.json.ticket, ip: ipA });
  assert.equal(frame2.status, 404);
});

test('unknown and revoked links do not resolve or open', async () => {
  const bogus = 'Zz'.repeat(11); // 22 chars
  const missingPage = await handle({ method: 'GET', path: '/' + bogus, ip: '9.9.9.9' });
  assert.equal(missingPage.status, 404);
  const missingTicket = await handle({ method: 'POST', path: '/api/frame-ticket', authHeader: 'Bearer ' + (await signup('missu', '10.0.0.9')), body: { token: bogus }, ip: '10.0.0.9' });
  assert.equal(missingTicket.status, 404);

  const ip = '10.0.0.5';
  const auth = 'Bearer ' + (await signup('revoker', ip));
  const gen = await handle({ method: 'GET', path: '/api/links', authHeader: auth, ip });
  const tok = cloak.tokenFromUrl(gen.json.added);
  const dest = (await cloak.resolveToken(tok)).url;

  await cloak.revokeDestination(dest);
  assert.equal(await cloak.resolveToken(tok), null, 'revoked token stops resolving');
  const afterRevoke = await handle({ method: 'POST', path: '/api/frame-ticket', authHeader: auth, body: { token: tok }, ip });
  assert.equal(afterRevoke.status, 404);

  await cloak.unrevokeDestination(dest);
  assert.ok(await cloak.resolveToken(tok), 'restoring re-enables the token');
});

test('cloak URLs sent back by the client resolve to the real destination', async () => {
  const ip = '10.0.0.6';
  const auth = 'Bearer ' + (await signup('roundtrip', ip));
  const gen = await handle({ method: 'GET', path: '/api/links', authHeader: auth, ip });
  const cloakUrl = gen.json.added;

  const pin = await handle({ method: 'POST', path: '/api/links/pin', authHeader: auth, body: { url: cloakUrl, pinned: true }, ip });
  assert.equal(pin.json.ok, true);
  assert.ok(cloak.isCloakUrl(pin.json.pinned[0]), 'pinned list stays cloaked');

  const del = await handle({ method: 'POST', path: '/api/links/delete', authHeader: auth, body: { url: cloakUrl }, ip });
  assert.equal(del.json.ok, true);
  assert.equal(del.json.links.length, 0, 'the cloaked link resolved back and was removed');
});
