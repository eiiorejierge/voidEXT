// Single source of truth for the app version. Bump this on each release:
//   - the build script bakes it into the bookmarklet (its "installed" version)
//   - the server serves it at /api/version (the "latest" version)
// When latest > installed, the popup shows an update prompt.
module.exports = '1.1.0';
