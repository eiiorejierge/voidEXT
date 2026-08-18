'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
process.env.ADMIN_KEY = 'test-admin';
delete globalThis.__voidMem;

const { handle } = require('../lib/core.js');

async function call(path, options) {
  options = options || {};
  const result = await handle({
    method: options.method || 'GET',
    path,
    body: options.body || {},
    authHeader: options.admin
      ? 'Bearer test-admin'
      : options.token
        ? 'Bearer ' + options.token
        : '',
    ip: options.ip || '127.0.0.1',
  });
  return result;
}

test('admin controls, announcements, and support conversations work end to end', async () => {
  const signup = await call('/api/signup', {
    method: 'POST',
    body: { username: 'reporter', password: 'password123' },
  });
  assert.equal(signup.status, 200);
  const token = signup.json.token;

  const secondSignup = await call('/api/signup', {
    method: 'POST',
    body: { username: 'another_user', password: 'password123' },
  });
  assert.equal(secondSignup.status, 200);

  const announce = await call('/api/admin/announce', {
    admin: true,
    method: 'POST',
    body: { title: 'General announcement', text: 'Support conversations are live.' },
  });
  assert.equal(announce.status, 200);
  assert.equal(announce.json.recipients, 2);

  const publicFeed = await call('/api/announcements');
  assert.equal(publicFeed.status, 200);
  assert.equal(publicFeed.json.announcements[0].title, 'General announcement');
  assert.equal(publicFeed.json.announcements[0].text, 'Support conversations are live.');

  const created = await call('/api/bug', {
    token,
    method: 'POST',
    body: { title: 'Generate button stalls', text: 'The generate button stays disabled after a request.' },
  });
  assert.equal(created.status, 200);
  const bugId = created.json.bug.id;

  const adminInbox = await call('/api/admin/bugs', { admin: true });
  assert.equal(adminInbox.status, 200);
  assert.equal(adminInbox.json.bugs[0].id, bugId);
  assert.equal(adminInbox.json.bugs[0].unread, 1);

  const adminThread = await call('/api/admin/bug-thread', {
    admin: true,
    method: 'POST',
    body: { id: bugId },
  });
  assert.equal(adminThread.status, 200);
  assert.equal(adminThread.json.bug.messages.length, 1);

  const adminReply = await call('/api/admin/bug-reply', {
    admin: true,
    method: 'POST',
    body: { id: bugId, text: 'Thanks. Please try it again now.', status: 'waiting' },
  });
  assert.equal(adminReply.status, 200);
  assert.equal(adminReply.json.bug.status, 'waiting');

  const userInbox = await call('/api/bugs', { token });
  assert.equal(userInbox.status, 200);
  assert.equal(userInbox.json.unread, 1);

  const otherUsersThread = await call('/api/bugs/thread', {
    token: secondSignup.json.token,
    method: 'POST',
    body: { id: bugId },
  });
  assert.equal(otherUsersThread.status, 403);

  const userThread = await call('/api/bugs/thread', {
    token,
    method: 'POST',
    body: { id: bugId },
  });
  assert.equal(userThread.status, 200);
  assert.equal(userThread.json.bug.messages.length, 2);
  assert.equal(userThread.json.bug.unread, 0);

  const userReply = await call('/api/bugs/reply', {
    token,
    method: 'POST',
    body: { id: bugId, text: 'It works now. You can close it.' },
  });
  assert.equal(userReply.status, 200);
  assert.equal(userReply.json.bug.messages.length, 3);

  const resolved = await call('/api/admin/bug-resolve', {
    admin: true,
    method: 'POST',
    body: { id: bugId, tokens: 3 },
  });
  assert.equal(resolved.status, 200);
  assert.equal(resolved.json.bug.status, 'fixed');
  assert.equal(resolved.json.bug.messages.length, 4);

  const duplicateReward = await call('/api/admin/bug-resolve', {
    admin: true,
    method: 'POST',
    body: { id: bugId, tokens: 3 },
  });
  assert.equal(duplicateReward.status, 409);

  const customUrl = 'https://admin-control.example/';
  const add = await call('/api/admin/link-add', {
    admin: true,
    method: 'POST',
    body: { text: customUrl },
  });
  assert.equal(add.status, 200);
  assert.equal(add.json.added, 1);

  let pool = await call('/api/admin/pool', { admin: true });
  let custom = pool.json.links.find((item) => item.url === customUrl);
  assert.deepEqual(custom, { url: customUrl, source: 'custom', status: 'active' });

  const pause = await call('/api/admin/block', {
    admin: true,
    method: 'POST',
    body: { url: customUrl },
  });
  assert.equal(pause.status, 200);
  pool = await call('/api/admin/pool', { admin: true });
  assert.equal(pool.json.links.find((item) => item.url === customUrl).status, 'paused');

  const remove = await call('/api/admin/link-remove', {
    admin: true,
    method: 'POST',
    body: { url: customUrl },
  });
  assert.equal(remove.status, 200);
  pool = await call('/api/admin/pool', { admin: true });
  assert.equal(pool.json.links.find((item) => item.url === customUrl).status, 'removed');

  const restore = await call('/api/admin/link-restore', {
    admin: true,
    method: 'POST',
    body: { url: customUrl },
  });
  assert.equal(restore.status, 200);

  const removeForever = await call('/api/admin/link-delete', {
    admin: true,
    method: 'POST',
    body: { url: customUrl },
  });
  assert.equal(removeForever.status, 200);
  pool = await call('/api/admin/pool', { admin: true });
  assert.equal(pool.json.links.some((item) => item.url === customUrl), false);

  const login = await call('/api/login', {
    method: 'POST',
    body: { username: 'reporter', password: 'password123' },
  });
  assert.equal(login.status, 200);
  assert.equal(login.json.account.bonus, 3);
});
