# Scale XT

Scale XT is a bookmarklet-driven link dashboard with account authentication,
weekly usage limits, support tickets, announcements, release notes, and a
staff administration panel.

## Production deployment

The production application runs on Railway:

https://voidext-production.up.railway.app

The bookmarklet is generated with that address and loads the application from
the Railway service.

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
wrapped in an opaque, per-destination token, so users only ever see and share a
gateway link of the form:

    https://voidext-production.up.railway.app/go/<token>

The real URL is stored server-side and is never printed into the gateway page.
Opening a `/go/<token>` link loads the destination **inside a full-screen frame
on the Scale XT viewer** — the browser address bar stays on the `/go/<token>`
link the whole time, so the real destination is never shown in the URL bar or
the page. The site remains fully usable inside the frame.

Mechanically, the gateway page embeds a same-origin loader,
`GET /api/frame/<token>`, which redirects *inside the iframe* to the real
destination. Because the redirect happens in the frame, the top-level URL never
changes and the destination is never handed to any JavaScript the page runs.
This means the private pool cannot be read off the address bar or copied out of
the app, and every visit is forced through the service — so it can be logged,
rate-limited, and revoked.

Note: a technically sophisticated visitor could still read the destination from
the browser's network devtools (any embedded page must ultimately be fetched by
the browser). Fully hiding it from that case would require a server-side reverse
proxy, which is heavier and can break some target sites. The frame approach
hides the link from the address bar and page for everyone else.

- Tokens are deterministic (a keyed hash of the destination), so a user's saved
  links stay stable and the same destination always maps to the same token.
- Blocking or removing a pool entry from Admin revokes every cloak link that
  points at it; restoring it re-enables them.
- The resolver is rate-limited per IP (`CLOAK_RESOLVE_LIMIT`, default 120/min) so
  the pool cannot be scraped in bulk.
- Set `CLOAK_SECRET` to a long random value in production, and `PUBLIC_BASE_URL`
  to the public origin the links should point at.

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
- GET /api/links: generate a rotating link batch (returned as cloaked /go links).
- GET /go/<token>: gateway page that embeds the destination in a hidden frame.
- GET /api/frame/<token>: in-frame loader that redirects to the destination (rate limited).
- POST /api/report: report a destination.
- GET /api/health: check application and storage health.
- GET /api/admin/session: validate a signed-in staff session.
- GET /api/admin/stats: load the admin dashboard overview.
- POST /api/admin/signups: open or close new account registration.

All /api/admin endpoints require a bearer token belonging to a signed-in
owner, admin, or support account, plus the role capability needed by the
specific endpoint.
