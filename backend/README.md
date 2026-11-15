# Vernia operations

Live dashboard: https://admin.vernia.in/admin. The existing `vernia-waitlist` Cloudflare Worker serves the dashboard, protected APIs, event collector, and waitlist. GitHub Pages still hosts the public website. Source remains in the website repository so form, analytics, and backend changes can be reviewed together.

## Access

Only the four exact addresses in `deployment.json` can sign in. SMTP emails an eight-digit, single-use code; it expires in ten minutes, with five attempts maximum. Login sends are limited to three per address per hour and ten attempts per IP per minute per Cloudflare location. Sessions use hashed random tokens in D1 and secure, HttpOnly, SameSite=Strict cookies, expiring after eight hours. Every data request rechecks the allowlist; removing an address revokes its existing sessions. The dashboard shell is public but contains no customer data or credentials; its APIs deny unauthenticated requests. The same protection applies on workers.dev.

## Automated confirmation emails

`operations.sql` adds an outbox trigger in the same transaction as each new signup. Duplicate submissions never enqueue another email. Successful acceptance triggers delivery through Spacemail; a `*/5 * * * *` Worker cron retries pending jobs and cleans expired auth data and 90-day-old analytics events. Existing leads are not backfilled automatically.

The only new secret is `SMTP_PASSWORD`, entered by the owner directly into Cloudflare. The sender and SMTP username are `team@vernia.in`. TLS connects to `mail.spacemail.com:465`, verifies the hostname and certificate, and uses Nodemailer's provided-socket interface so the Workers TLS stack resolves the hostname. Never use a fixed mail-server IP or disable certificate checking.

`sent` means accepted by SMTP, not inbox delivery. Safe pre-send/transient failures retry up to five attempts with backoff. Ambiguous completion or an expired in-flight lease becomes `uncertain` and is not automatically resent. Inspect the mailbox/provider before manually requeueing such a message. The dashboard reports pending/sent/failed/uncertain counts; sanitized SMTP health is in `service_health`. No passwords or complete provider payloads are logged.

Replies and unsubscribe requests go to the team inbox. Mark a verified request `withdrawn` to prevent queued delivery, or delete the specific lead and associated outbox data on a deletion request. These are operator actions; this release does not send bulk marketing or parse inbound replies automatically. Provider quotas still apply.

## Analytics

The public site retains Cloudflare Web Analytics. Additional first-party tracking runs only after visitors select Allow analytics, and respects Do Not Track / Global Privacy Control. It sends page paths, referring hostname, campaign labels, country, device category, engagement, and opaque session IDs. It does not capture form content or full URLs. Session IDs are random, scoped to one tab, and refreshed after 30 minutes of inactivity or 24 hours total; UUIDv7 timestamps enable PostHog session aggregation; D1 stores a hash. Browser choices use local storage. Events in D1 are retained for 90 days.

The central dashboard queries D1 directly. PostHog project **737840** receives the same consented events through its public ingestion token. PostHog is an exploration destination, not the dashboard's source of historical numbers. The integration does not use a personal PostHog API key. Do not describe data from before installation as available here; prior aggregate Cloudflare history remains in Cloudflare. PostHog retention is governed by that project's settings.

Public events: `$pageview`, `vernia_engaged`, `vernia_waitlist_view`, and `vernia_cta`; `vernia_signup` is emitted only after a server-confirmed new signup. The dashboard counts all submitted leads independently of analytics consent. Known-bot user agents, Cloudflare bot signals when available, duplicate event IDs, and rate-limited traffic are filtered. These are estimates, not proof of humans or identified customers. Session replay, fingerprinting, form autocapture, and RB2B are not enabled. Team members should disable optional analytics in each browser at https://vernia.in/privacy.html#analytics-preferences.

## Development and deployment

From `backend`: `npm ci`, `npm test`, then `npm run build`. `node deploy.mjs` reads a scoped Cloudflare token from the process environment and uploads the bundle with `deployment.json`; it preserves existing secrets. Never put the token or SMTP password into Git, deployment metadata, client files, or shell arguments. The built bundle is ignored. Initial D1 setup applies `schema.sql` then `operations.sql`; both are additive/idempotent. Verify bindings, existing secrets, the five-minute cron, and custom hostname after deployment. The helper only uploads code/settings and does not run migrations or create cron/domain resources.

Run `node tools/operations-preview.mjs` from the repository root for a loopback-only dashboard preview with clearly labelled sample data. It is never bundled into production. Production has no auth bypass or test SMTP endpoint. `node --test backend/*.test.mjs` runs signup, outbox, auth, and analytics tests against in-memory SQLite.

Rollback code through Cloudflare Worker deployment history. Retain the additive tables and customer data. Roll back public pages separately through GitHub Pages. Disabling automated mail is possible by removing the SMTP secret (new signups remain in the persistent outbox); this also disables email-based admin sign-in. Never purge the database as a rollback step.
