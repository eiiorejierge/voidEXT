// =============================================================================
// Builds the one-line "javascript:..." bookmarklet from bookmarklet.src.js and
// publishes it everywhere the site needs it:
//   - ./bookmarklet.min.js          (repo copy, for reference)
//   - ./public/bookmarklet.min.js   (served by Vercel at /bookmarklet.min.js)
//   - injected directly into ./public/index.html so the landing page always
//     shows the newest string with NO runtime fetch (the fetch was hitting a
//     404 page on Vercel because the file wasn't under public/).
//
// Run:  node build-bookmarklet.js
// =============================================================================
const fs = require('fs');
const path = require('path');

const VERSION = require('./lib/version.js');

let src = fs.readFileSync(path.join(__dirname, 'bookmarklet.src.js'), 'utf8');

// Stamp the current version in (the bookmarklet's "installed" version).
src = src.replace(/__VERSION__/g, VERSION);

// Drop the leading /* ... */ banner comment for compactness.
const body = src.replace(/^\/\*[\s\S]*?\*\/\s*/, '').trim();
const bookmarklet = 'javascript:' + encodeURIComponent(body);

// 1) repo copy + 2) served copy
fs.writeFileSync(path.join(__dirname, 'bookmarklet.min.js'), bookmarklet);
fs.writeFileSync(path.join(__dirname, 'public', 'bookmarklet.min.js'), bookmarklet);

// 3) inject into the landing page (idempotent — replaces the marked block)
const indexPath = path.join(__dirname, 'public', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
const injected = `<script id="bm-data">window.__BOOKMARKLET__=${JSON.stringify(bookmarklet)};</script>`;
const re = /<script id="bm-data">[\s\S]*?<\/script>/;
if (re.test(html)) {
  html = html.replace(re, injected);
} else {
  // First run: insert just before </head>.
  html = html.replace('</head>', injected + '\n</head>');
}
fs.writeFileSync(indexPath, html);

console.log('Wrote bookmarklet.min.js v' + VERSION + ' (' + bookmarklet.length + ' chars) + injected into landing page.');
