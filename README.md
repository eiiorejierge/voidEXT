# Scale XT

Scale XT is a bookmarklet-driven link dashboard with account authentication,
weekly usage limits, support tickets, announcements, release notes, and a
staff administration panel.

## Production deployment

The production application runs on Railway and is served on the custom domain:

https://nebulabkmlinks.shop

Add `nebulabkmlinks.shop` as a custom domain on the Railway web service (Railway's own
`*.up.railway.app` URL keeps working too). The bookmarklet and the per-user link
gateway are generated with the `nebulabkmlinks.shop` address, so the whole app — the
launcher, `/api`, and the `/<token>` links — is served from one origin, which is
what lets links be locked to the signed-in owner.

## Railway PostgreSQL setup

1. Add a PostgreSQL database to the same Railway project as the web service.
2. Open the VoidEXT web service, then open Variables.
3. Click Add Reference Variable.
4. Select DATABASE_URL from the PostgreSQL service.
5. Add OWNER_SETUP_PASSWORD with the password you want to use for w7ll.
6. Deploy the staged changes.
7. Create the w7ll account once, then remove OWNER_SETUP_PASSWORD and redeploy.
8. Open /api/health on the production domain. A successful connection reports
   configured: true, persistent: true, reachable: true, provider: postgres.

Scale XT creates its scale_xt_store table automatically. A new database begins
empty; data from a deleted database requires an export or provider backup.

## Accounts and staff access

Users create an account through the bookmarklet. Passwords are hashed with
scrypt and sessions use random bearer tokens that expire after 30 days.
Changing a password revokes older sessions, and users can sign out every device
from the Account page.

Staff can open or close new account registration from Admin > Operations.
Existing accounts and staff access continue working while registration is
closed.

The username w7ll is the permanent owner account. It receives full owner
permissions automatically and cannot be demoted or deleted.

The admin panel is available at /admin. It only accepts a normal signed-in
owner, admin, or support account. There is no separate admin code.

- Owner: every administrative capability, including assigning staff roles.
- Admin: account, link, announcement, release, maintenance, and support tools.
- Support: reports, support conversations, account visibility, and messages.

## Link cloaking gateway

Generated links are never handed out as raw destinations. Every destination is
wrapped in a short, opaque, **per-user** token, so a user only ever sees and
shares a personal gateway link of the form:

    https://nebulabkmlinks.shop/<token>

Two different accounts get two different tokens for the same destination, and
each token is **locked to the account that created it**.

Opening a `/<token>` link loads the destination **inside a full-screen frame on
the Scale XT viewer** — the browser address bar stays on the `/<token>` link the
whole time, so the real destination is never shown in the URL bar or the page.
The site remains fully usable inside the frame.

How the owner lock works (no destination ever reaches page JavaScript):

1. The `/<token>` page reads the viewer's Scale XT session from same-origin
   `localStorage` (this is why the domain must serve the whole app).
2. It calls `POST /api/frame-ticket` with that session. The server grants a
   short-lived, single-use ticket **only if that account owns the token**.
   Otherwise it returns 401 (not signed in) or 403 (someone else's link).
3. The page loads `GET /api/frame/<ticket>` into the iframe, which redirects
   *inside the frame* to the destination and immediately discards the ticket.

So a link that is copied and shared simply will not open for anyone but its
owner, the destination never appears in the address bar/page/JS, and every open
is forced through the service — loggable, rate-limited, and revocable.

- Tokens are a per-user keyed hash of the destination, so a user's saved links
  stay stable and the token table does not grow without bound.
- Blocking or removing a pool entry from Admin revokes it for every user at
  once; restoring it re-enables it.
- `POST /api/frame-ticket` is rate-limited per IP (`CLOAK_RESOLVE_LIMIT`,
  default 120/min).
- Set `CLOAK_SECRET` to a long random value in production, and
  `PUBLIC_BASE_URL` to the public origin the links point at (e.g.
  `https://nebulabkmlinks.shop`).

Deployment note: the owner lock requires `nebulabkmlinks.shop` (or whatever
`PUBLIC_BASE_URL` is) to serve the **whole app** — add it as a custom domain on
the same Railway service so `app.html`, `/api`, and the `/<token>` gateway are
all one origin. The bookmarklet loads the app from this domain
(`API_BASE` in `bookmarklet.src.js` and the app base in `build-bookmarklet.js`);
after changing it, run `npm run build:bookmarklet`. Existing users sign in once
on the new domain so their session lives there.

A technically sophisticated visitor who is signed in as the owner could still
read the destination from the browser's network devtools (any embedded page is
ultimately fetched by the browser). Fully hiding it from that case would require
a server-side reverse proxy, which is heavier and can break some target sites.

## Main files

- server.js: Railway HTTP server and static-file host.
- lib/core.js: authentication, roles, usage, messages, reports, and admin APIs.
- lib/cloak.js: link cloaking gateway (tokens, resolver, and pass-through page).
- lib/store.js: Railway PostgreSQL, Upstash Redis REST, and local-memory storage.
- lib/links.js: built-in private destination pool.
- public/admin.html: staff dashboard and account login.
- bookmarklet.src.js: readable bookmarklet source.
- build-bookmarklet.js: generates the production bookmarklet and application.

## Commands

Install dependencies:

    npm install

Run locally:

    npm start

Run tests:

    npm test

Rebuild the bookmarklet:

    npm run build:bookmarklet

Without DATABASE_URL or Upstash variables, local development uses temporary
in-memory storage. That data disappears when the process stops.

## Important endpoints

- POST /api/signup: create an account.
- POST /api/login: sign in and receive a session token.
- GET /api/me: validate the current session.
- POST /api/logout: invalidate the current session.
- POST /api/logout-all: invalidate every session for the current account.
- GET /api/links: generate a rotating link batch (returned as personal /<token> links).
- GET /<token>: owner-locked gateway page that embeds the destination in a hidden frame.
- POST /api/frame-ticket: owner-only check that mints a one-time frame ticket (rate limited).
- GET /api/frame/<ticket>: single-use in-frame loader that redirects to the destination.
- POST /api/report: report a destination.
- GET /api/health: check application and storage health.
- GET /api/admin/session: validate a signed-in staff session.
- GET /api/admin/stats: load the admin dashboard overview.
- POST /api/admin/signups: open or close new account registration.

All /api/admin endpoints require a bearer token belonging to a signed-in
owner, admin, or support account, plus the role capability needed by the
specific endpoint.
