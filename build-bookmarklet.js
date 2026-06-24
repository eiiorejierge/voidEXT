// =============================================================================
// Builds bookmarklet.min.js (the one-line "javascript:..." URL) from the
// readable source in bookmarklet.src.js.
//
// We keep it dependency-free: light whitespace collapsing outside of template
// literals/strings is risky, so instead we do a safe transform — strip the
// leading block comment, then URL-encode the whole IIFE. Browsers happily run
// a percent-encoded bookmarklet, and encoding avoids breaking on spaces/quotes.
//
// Run:  node build-bookmarklet.js
// =============================================================================
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'bookmarklet.src.js'), 'utf8');

// Drop the leading /* ... */ banner comment for compactness.
const body = src.replace(/^\/\*[\s\S]*?\*\/\s*/, '').trim();

const bookmarklet = 'javascript:' + encodeURIComponent(body);

fs.writeFileSync(path.join(__dirname, 'bookmarklet.min.js'), bookmarklet);
console.log('Wrote bookmarklet.min.js (' + bookmarklet.length + ' chars).');
