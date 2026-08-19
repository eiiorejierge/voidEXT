'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('every nested client API namespace has a Vercel adapter', () => {
  const clientSources = [
    fs.readFileSync(path.join(root, 'bookmarklet.src.js'), 'utf8'),
    fs.readFileSync(path.join(root, 'public', 'admin.html'), 'utf8'),
  ].join('\n');
  const namespaces = new Set();

  for (const match of clientSources.matchAll(/['"]\/api\/([a-z-]+)\/[a-z-]+['"]/g)) {
    namespaces.add(match[1]);
  }

  for (const namespace of namespaces) {
    const adapter = path.join(root, 'api', namespace, '[action].js');
    assert.equal(
      fs.existsSync(adapter),
      true,
      `Missing Vercel adapter for /api/${namespace}/*`
    );
  }
});
