'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.DATABASE_URL;
delete process.env.ADMIN_KEY;
process.env.OWNER_SETUP_PASSWORD = 'owner-password-123';
delete globalThis.__voidMem;

const { handle, usagePeriod } = require('../lib/core.js');

let ownerToken = '';

async function call(path, options) {
  options = options || {};
  const result = await handle({
    method: options.method || 'GET',
    path,
    body: options.body || {},
    authHeader: options.admin
      ? 'Bearer ' + ownerToken
      : options.token
        ? 'Bearer ' + options.token
        : '',
    ip: options.ip || '127.0.0.1',
  });
  return result;
}

test('admin controls, announcements, and support conversations work end to end', async () => {
  const rejectedOwnerSignup = await call('/api/signup', {
    method: 'POST',
    body: { username: 'w7ll', password: 'someone-elses-password' },
  });
  assert.equal(rejectedOwnerSignup.status, 403);

  const ownerSignup = await call('/api/signup', {
    method: 'POST',
    body: { username: 'w7ll', password: 'owner-password-123' },
  });
  assert.equal(ownerSignup.status, 200);
  assert.equal(ownerSignup.json.account.role, 'owner');
  ownerToken = ownerSignup.json.token;
  const ownerSession = await call('/api/admin/session', { token: ownerToken });
  assert.equal(ownerSession.status, 200);
  assert.equal(ownerSession.json.role, 'owner');
  assert.equal((await call('/api/admin/session', { token: 'test-admin' })).status, 401);

  const signup = await call('/api/signup', {
    method: 'POST',
    body: { username: 'reporter', password: 'password123' },
  });
  assert.equal(signup.status, 200);
  const token = signup.json.token;
  assert.equal(signup.json.account.usagePercent, 0);
  assert.equal(signup.json.account.usageAvailable, 5);
  assert.equal(signup.json.account.usageCredits, 0);
  assert.equal(signup.json.account.role, 'member');
  assert.equal('limit' in signup.json.account, false);
  assert.equal('remaining' in signup.json.account, false);
  assert.equal('bonus' in signup.json.account, false);

  const sampleWeek = usagePeriod(Date.parse('2026-08-18T12:00:00Z'));
  assert.equal(new Date(sampleWeek.start).toISOString(), '2026-08-15T00:00:00.000Z');
  assert.equal(new Date(sampleWeek.resetAt).toISOString(), '2026-08-22T00:00:00.000Z');

  const secondSignup = await call('/api/signup', {
    method: 'POST',
    body: { username: 'another_user', password: 'password123' },
  });
  assert.equal(secondSignup.status, 200);

  for (let index = 1; index <= 5; index++) {
    const generated = await call('/api/links', { token: secondSignup.json.token });
    assert.equal(generated.status, 200);
    assert.equal(generated.json.usagePercent, index * 20);
    assert.equal(generated.json.usageAvailable, 5 - index);
    assert.equal(generated.json.usageCredits, 0);
    assert.equal('remaining' in generated.json, false);
    assert.equal('limit' in generated.json, false);
  }
  const atCapacity = await call('/api/links', { token: secondSignup.json.token });
  assert.equal(atCapacity.status, 429);
  assert.equal(atCapacity.json.usagePercent, 100);
  assert.equal(atCapacity.json.usageAvailable, 0);
  assert.equal(atCapacity.json.usageCredits, 0);
  assert.equal(/\b5\b/.test(atCapacity.json.error), false);

  const grant = await call('/api/admin/grant-tokens', {
    admin: true,
    method: 'POST',
    body: { username: 'another_user', amount: 3 },
  });
  assert.equal(grant.status, 200);
  const credited = await call('/api/me', { token: secondSignup.json.token });
  assert.equal(credited.json.account.usagePercent, 63);
  assert.equal(credited.json.account.usageAvailable, 3);
  assert.equal(credited.json.account.usageCredits, 3);

  const creditUse = await call('/api/links', { token: secondSignup.json.token });
  assert.equal(creditUse.status, 200);
  assert.equal(creditUse.json.usagePercent, 75);
  assert.equal(creditUse.json.usageAvailable, 2);
  assert.equal(creditUse.json.usageCredits, 2);

  const roleSet = await call('/api/admin/role-set', {
    admin: true,
    method: 'POST',
    body: { username: 'another_user', role: 'support' },
  });
  assert.equal(roleSet.status, 200);
  assert.equal(roleSet.json.role, 'support');

  const ownerDemotion = await call('/api/admin/role-set', {
    admin: true,
    method: 'POST',
    body: { username: 'w7ll', role: 'member' },
  });
  assert.equal(ownerDemotion.status, 403);
  const ownerDeletion = await call('/api/admin/delete-user', {
    admin: true,
    method: 'POST',
    body: { username: 'w7ll' },
  });
  assert.equal(ownerDeletion.status, 403);

  const supportSession = await call('/api/admin/session', { token: secondSignup.json.token });
  assert.equal(supportSession.status, 200);
  assert.equal(supportSession.json.role, 'support');
  assert.equal(supportSession.json.capabilities.includes('support'), true);
  assert.equal(supportSession.json.capabilities.includes('links'), false);
  assert.equal((await call('/api/admin/bugs', { token: secondSignup.json.token })).status, 200);
  assert.equal((await call('/api/admin/pool', { token: secondSignup.json.token })).status, 403);
  assert.equal((await call('/api/admin/role-set', {
    token: secondSignup.json.token,
    method: 'POST',
    body: { username: 'reporter', role: 'admin' },
  })).status, 403);

  const builtInReleases = await call('/api/releases');
  assert.equal(builtInReleases.status, 200);
  assert.equal(builtInReleases.json.releases.some((item) => item.version === '2.4.0'), true);
  assert.equal(builtInReleases.json.releases.some((item) => item.version === '2.4.1'), true);
  assert.equal(builtInReleases.json.releases.some((item) => item.version === '2.4.2'), true);
  const publishedRelease = await call('/api/admin/release', {
    admin: true,
    method: 'POST',
    body: { version: '2.4.1', title: 'Small follow-up', text: 'A test release note.' },
  });
  assert.equal(publishedRelease.status, 200);
  const publicReleases = await call('/api/releases');
  assert.equal(publicReleases.json.releases.some((item) => item.version === '2.4.1'), true);
  assert.equal((await call('/api/admin/release-delete', {
    admin: true,
    method: 'POST',
    body: { id: publishedRelease.json.release.id },
  })).status, 200);

  const announce = await call('/api/admin/announce', {
    admin: true,
    method: 'POST',
    body: { title: 'General announcement', text: 'Support conversations are live.' },
  });
  assert.equal(announce.status, 200);
  assert.equal(announce.json.recipients, 3);

  const publicFeed = await call('/api/announcements');
  assert.equal(publicFeed.status, 200);
  assert.equal(publicFeed.json.announcements[0].title, 'General announcement');
  assert.equal(publicFeed.json.announcements[0].text, 'Support conversations are live.');

  assert.equal((await call('/api/global/messages')).status, 401);
  const globalPost = await call('/api/global/send', {
    token,
    method: 'POST',
    body: { text: 'Hello from the global room.' },
  });
  assert.equal(globalPost.status, 200);
  assert.equal(globalPost.json.message.from, 'reporter');
  assert.equal(globalPost.json.message.role, 'member');
  assert.equal(globalPost.json.message.mine, true);
  assert.equal(globalPost.json.message.canDelete, true);
  assert.equal((await call('/api/global/send', {
    token,
    method: 'POST',
    body: { text: 'This should be rate limited.' },
  })).status, 429);
  assert.equal((await call('/api/global/send', {
    admin: true,
    method: 'POST',
    body: { text: 'Owner checking in.' },
  })).status, 200);
  const globalFeed = await call('/api/global/messages', { token });
  assert.equal(globalFeed.status, 200);
  assert.equal(globalFeed.json.messages.length, 2);
  assert.equal(globalFeed.json.messages[1].role, 'owner');
  assert.equal(globalFeed.json.messages[1].canDelete, false);
  assert.equal(globalFeed.json.online >= 1, true);
  assert.equal((await call('/api/global/delete', {
    token,
    method: 'POST',
    body: { id: globalFeed.json.messages[1].id },
  })).status, 403);
  assert.equal((await call('/api/global/delete', {
    admin: true,
    method: 'POST',
    body: { id: globalPost.json.message.id },
  })).status, 200);
  const globalAfterDelete = await call('/api/global/messages', { token });
  assert.equal(globalAfterDelete.json.messages.some((message) => message.id === globalPost.json.message.id), false);

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
  assert.equal(login.json.account.role, 'member');
  assert.equal(login.json.account.usagePercent, 0);
  assert.equal(login.json.account.usageAvailable, 8);
  assert.equal(login.json.account.usageCredits, 3);
  assert.equal('bonus' in login.json.account, false);
  assert.equal('remaining' in login.json.account, false);

  const stats = await call('/api/admin/stats', { admin: true });
  assert.equal(stats.status, 200);
  assert.equal(stats.json.weekly.averageUsage, 25);
  assert.equal(stats.json.roles.support, 1);
  assert.equal(stats.json.roles.owner, 1);
  assert.equal(stats.json.activity.length, 7);
  assert.equal(stats.json.viewer.role, 'owner');

  const operations = await call('/api/admin/operations', { admin: true });
  assert.equal(operations.status, 200);
  assert.equal(operations.json.accounts, 3);
  assert.equal(operations.json.maintenance.enabled, false);
  assert.equal((await call('/api/admin/operations', { token: secondSignup.json.token })).status, 403);

  const maintenanceOn = await call('/api/admin/maintenance', {
    admin: true,
    method: 'POST',
    body: { enabled: true, message: 'Brief maintenance test.' },
  });
  assert.equal(maintenanceOn.status, 200);
  assert.equal(maintenanceOn.json.maintenance.enabled, true);
  const publicMaintenance = await call('/api/maintenance');
  assert.equal(publicMaintenance.json.maintenance.message, 'Brief maintenance test.');
  assert.equal((await call('/api/signup', {
    method: 'POST',
    body: { username: 'blocked_signup', password: 'password123' },
  })).status, 503);
  assert.equal((await call('/api/links', { token })).status, 503);
  assert.equal((await call('/api/me', { token })).status, 200);

  const rewardAll = await call('/api/admin/reward-all', {
    admin: true,
    method: 'POST',
    body: { amount: 2, message: 'Thanks for waiting.' },
  });
  assert.equal(rewardAll.status, 200);
  assert.equal(rewardAll.json.rewarded, 3);
  assert.equal(rewardAll.json.totalCredits, 6);

  const resetAll = await call('/api/admin/usage-reset-all', { admin: true, method: 'POST' });
  assert.equal(resetAll.status, 200);
  assert.equal(resetAll.json.accounts, 3);
  assert.equal(resetAll.json.reset, 1);

  const rewardedReporter = await call('/api/me', { token });
  assert.equal(rewardedReporter.json.account.usagePercent, 0);
  assert.equal(rewardedReporter.json.account.usageAvailable, 10);
  assert.equal(rewardedReporter.json.account.usageCredits, 5);
  assert.equal(rewardedReporter.json.notifications.some((item) => item.text === 'Thanks for waiting. (2 usage credits added.)'), true);

  const resetSecond = await call('/api/me', { token: secondSignup.json.token });
  assert.equal(resetSecond.json.account.usagePercent, 0);
  assert.equal(resetSecond.json.account.usageAvailable, 9);
  assert.equal(resetSecond.json.account.usageCredits, 4);

  const maintenanceOff = await call('/api/admin/maintenance', {
    admin: true,
    method: 'POST',
    body: { enabled: false },
  });
  assert.equal(maintenanceOff.status, 200);
  assert.equal((await call('/api/maintenance')).json.maintenance.enabled, false);
  const afterMaintenance = await call('/api/links', { token: secondSignup.json.token });
  assert.equal(afterMaintenance.status, 200);
  assert.equal(afterMaintenance.json.usagePercent, 11);
  assert.equal(afterMaintenance.json.usageAvailable, 8);
});
