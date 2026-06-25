# Nebula

A beach-themed **bookmarklet** backed by a **Vercel website**. Users sign up / log
in through the popup, then generate a rotating batch of links pulled from a
private server-side vault. The full link list never ships to the client — the
popup only ever sees a small rotating slice, and only after authentication.

## What's here

```
api/[...path].js     Vercel serverless function (catch-all) — the API
lib/core.js          Framework-agnostic request handler (auth, rotation, reports)
lib/store.js         Storage layer (Vercel KV / Upstash Redis REST, in-memory fallback)
lib/links.js         The master link pool (server-side only)
server.js            Standalone Node server (local dev + Railway/Render hosting)
public/index.html    Landing page + bookmarklet installer
bookmarklet.src.js   Readable bookmarklet source
bookmarklet.min.js   Compiled one-line "javascript:..." bookmarklet
build-bookmarklet.js Compiles src -> min
vercel.json          Vercel config (CORS headers, clean URLs)
```

## Features

- **Signup + login** in the popup (passwords hashed with scrypt, token auth).
- **Link rotation** — `Generate Links` returns a batch of 10, cycling through the pool.
- **Blocked-link reporting** — every link has a `blocked` button; tapping it pulls
  the link from *everyone's* rotation and logs it for review (you asked to be alerted
  about dead links). Restore it later via the admin endpoint if it comes back.
- **No native dialogs** — there are zero `alert()`/`confirm()`/`prompt()` calls, so you
  never see the `"<site> says..."` browser chrome. Everything renders inside the popup.
- **Daily quota** — built in (`10/day`, old set replaced on refresh) but **disabled for
  testing right now**. Flip `RATE_LIMIT_ENABLED` in `lib/core.js` to turn it back on.

## Deploy to Vercel

1. Push this repo to GitHub and import it at [vercel.com/new](https://vercel.com/new).
2. **Add a KV store** (required for accounts to persist): in the Vercel project →
   **Storage** → create a KV / Upstash Redis store and connect it. Vercel injects
   `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically. *(Without a store, accounts
   live in memory and reset on every cold start — fine for a quick look, not for real use.)*
3. *(Optional)* Set `ADMIN_KEY` in the project env vars to protect the admin endpoints.
4. Deploy. Your site is at `https://<your-project>.vercel.app`.

## Deploy to Railway

The whole app also runs as a single long-lived Node process (`server.js`), so it
deploys to Railway with no code changes — `npm start` runs `node server.js`,
which serves both the static site and `/api/*` on `process.env.PORT`.

1. Push this repo to GitHub and create a new project at
   [railway.app/new](https://railway.app/new) → **Deploy from GitHub repo**.
   Railway auto-detects Node via Nixpacks; `railway.json` pins the start command.
   There are **no npm dependencies** (pure Node builtins), so the build just
   needs Node ≥18 — no native build step.
2. **Add a Redis store for persistence.** Railway's built-in Redis is TCP-only,
   but this app talks to the **Upstash REST API**. Easiest path: add the
   **Upstash Redis** plugin (or a free database at [upstash.com](https://upstash.com)),
   then set these service **Variables**:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

   *(Without them the app still boots, but accounts live in memory and reset on
   every restart/redeploy.)*
3. *(Optional)* Set `ADMIN_KEY` to protect the admin endpoints.
4. Deploy, then under **Settings → Networking** generate a public domain. Your
   site is at `https://<your-service>.up.railway.app`.

> Render works the same way: a **Web Service**, build command `npm install`
> (a no-op here), start command `node server.js`, plus the same Upstash vars.

### Point the bookmarklet at your deployment

Edit the `API_BASE` constant at the top of `bookmarklet.src.js`:

```js
const API_BASE = 'https://your-project.vercel.app';
```

Then rebuild:

```bash
node build-bookmarklet.js
```

The landing page (`/`) always serves the freshly built bookmarklet — drag the
button to your bookmarks bar, or copy the code from the page.

## Local testing

```bash
npm start                     # http://localhost:3000  (no KV needed; in-memory)
```

Point `API_BASE` at `http://localhost:3000`, rebuild, and test. End-to-end flow
(signup → login → generate → report) all works against the local server.

## API

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/signup` | — | Create account, returns `{token}` |
| POST | `/api/login` | — | Authenticate, returns `{token}` |
| GET | `/api/me` | Bearer | Validate token |
| POST | `/api/logout` | Bearer | Invalidate token |
| GET | `/api/links` | Bearer | Generate a rotating batch of links |
| POST | `/api/report` | Bearer | Report a blocked link (`{url}`) |
| GET | `/api/admin/blocked` | Admin key | List blocked links + reports |
| POST | `/api/admin/unblock` | Admin key | Restore a link to rotation (`{url}`) |

Admin endpoints use `Authorization: Bearer <ADMIN_KEY>` (default `void-admin`).

## Managing the link pool

The list lives in `lib/links.js` — one URL per line. Paste a raw dump (duplicates and
SVG-namespace junk are filtered automatically) and redeploy. Currently **383 links**
in rotation. Heads up per the source: a chunk of these may be blocked at any given time,
and some get re-used every few weeks — the `blocked` reporting flow is how you keep the
pool clean and get alerted.

### Reviewing reported links

```bash
curl https://your-project.vercel.app/api/admin/blocked \
  -H "Authorization: Bearer YOUR_ADMIN_KEY"
```

Returns every reported/blocked URL plus who reported it and when. To put one back:

```bash
curl -X POST https://your-project.vercel.app/api/admin/unblock \
  -H "Authorization: Bearer YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/"}'
```
