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

## Main files

- server.js: Railway HTTP server and static-file host.
- lib/core.js: authentication, roles, usage, messages, reports, and admin APIs.
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
- GET /api/links: generate a rotating link batch.
- POST /api/report: report a destination.
- GET /api/health: check application and storage health.
- GET /api/admin/session: validate a signed-in staff session.
- GET /api/admin/stats: load the admin dashboard overview.
- POST /api/admin/signups: open or close new account registration.

All /api/admin endpoints require a bearer token belonging to a signed-in
owner, admin, or support account, plus the role capability needed by the
specific endpoint.
