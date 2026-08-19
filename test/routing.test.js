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

test('the compact bookmarklet shell tracks the installed launcher version', () => {
  const source = fs.readFileSync(path.join(root, 'bookmarklet.src.js'), 'utf8');
  const builtApp = fs.readFileSync(path.join(root, 'public', 'app.html'), 'utf8');
  const stylesheet = fs.readFileSync(path.join(root, 'public', 'bookmarklet-scale.css'), 'utf8');
  const launcher = fs.readFileSync(path.join(root, 'bookmarklet.min.js'), 'utf8').trim();
  const version = require(path.join(root, 'lib', 'version.js'));

  assert.match(source, /URLSearchParams\(window\.location\.search\)\.get\('v'\)/);
  assert.match(source, /isNewer\(latestVersion,INSTALLED_VERSION\)/);
  assert.doesNotMatch(source, /BUILT_VERSION/);
  assert.match(builtApp, /id="commandPalette"/);
  assert.match(builtApp, /id="versionBtn"/);
  assert.match(builtApp, /id="moreMenu"/);
  assert.match(builtApp, /id="homeAnnouncement"/);
  assert.match(builtApp, /id="page-global"/);
  assert.match(source, /api\('\/api\/global\/messages'\)/);
  assert.match(source, /api\('\/api\/global\/send'/);
  assert.match(source, /api\('\/api\/announcements'\)/);
  assert.match(source, /scale_xt_dismissed_announcement/);
  assert.match(stylesheet, /\.app\.hidden\{display:none!important\}/);
  assert.doesNotMatch(builtApp, /__VERSION__/);
  assert.equal(launcher.includes('/app.html?v=' + version), true);
  assert.equal(launcher.length <= 5000, true, 'Launcher grew to ' + launcher.length + ' characters');

  const ids = [...builtApp.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'The generated app contains duplicate element IDs');
});