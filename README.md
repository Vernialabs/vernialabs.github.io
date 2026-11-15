# Vernia Labs

The physical AI research website at https://vernia.in, published from `main` through GitHub Pages.

## Local preview

Run `python -m http.server 4173` in this directory and open http://localhost:4173. No build step or package installation is required.

## Files

- `index.html`: product-led company homepage with scroll-driven Grip One, company vision, and Hardware / Data lineup.
- `home.css`: scoped full-width product cover, responsive layout, and editorial lineup styling.
- `hardware.html`: enlarged scroll-driven Grip One cover, concise product details, and tactile gloves marked Coming soon.
- `hardware.css`: Hardware-specific details and tactile chapter, using the shared homepage design.
- `styles.css`: responsive layouts, visual design, and motion preferences.
- `app.js`: navigation, reveal effects, and the articulated Three.js CAD viewer.
- `cinematic-motion.js`: archived hand animation, not used on the current site.
- `gesture-rig.js`: archived hand rig, retained with its source assets.
- `assets/models/gesture-hand/`: preserved CC0 anatomical hand GLB and source provenance.
- `assets/brand/cinematic-hand.png`: preserved artwork from the earlier treatment, no longer loaded. Hand-scene WebP posters are also preserved but unused.
- `assets/models/grip-one/`: assembled CAD, matching rendered fallback, original URDF, provenance, and upstream license notices.
- `assets/vendor/`: locally hosted Three.js 0.170.0 and its MIT license.
- `CNAME`: existing custom domain; keep this file when updating the site.

## Content and navigation

The homepage immediately introduces Grip One to physical AI researchers, then explains Vernia’s data-layer focus. The Hardware page provides product details. Main navigation links to Our vision, Hardware, and Data. Data remains a compact coming-soon section, without a catalog or platform claims. Existing `/#grip-one` links redirect to `hardware.html#grip-one`. Product and general inquiries open the owner's email client. The shared waitlist collects product interest with explicit consent.

The owner supplied the Product Website Builder skill on 2026-11-15. It is installed locally in Codex and used for this information architecture, copy, and verification pass. The original brief, supplied brand assets, and product geometry are preserved. The existing charcoal, lavender, serif accents, and metallic product styling carry across both pages. The homepage now opens with Grip One in a full-width product cover: oversized typography, a diagonal lavender light field, and the metallic CAD at its centre. A larger gripper rotates through roughly 120 degrees as visitors scroll through the opening cover. Exponential interpolation eases the motion; it settles when scrolling stops and reverses when visitors scroll up. No drag, close, reset, or pause controls appear on the homepage. The Hardware page uses the same large scroll-driven cover and has no close, reset, drag, or pause controls. The primary CTA opens `hardware.html#grip-one`; a secondary action opens a product email inquiry. A concise human / hardware / data explanation leads to a three-row lineup for Grip One, tactile gloves, and Data. The latter two are clearly marked Coming soon. The earlier hand animation files remain archived in the repository and are no longer requested by the homepage. Reduced-motion preferences disable homepage rotation and its extended scroll section. The product poster covers unavailable JavaScript/WebGL without an extended scroll section. Homepage body copy is at least 16px, secondary labels are 11–12px, and contrast is strengthened across the hero, lineup, and contact sections. Product motion stops offscreen and in background tabs.

| Claim | Source / date | Status | Public wording / location |
| --- | --- | --- | --- |
| Vernia researches the physical AI data layer | Owner brief, 2026-11-14 | Owner-stated | Company introduction on homepage |
| Grip One is a handheld UMI gripper | Owner brief, 2026-11-14 | Owner-stated offering; fulfillment details unspecified | Homepage and Hardware page; inquiry CTA |
| Tactile gloves are forthcoming | Owner request, 2026-11-15 | Planned | Coming soon, Hardware page; no specs or release date |
| Data offering is not ready to present | Owner request, 2026-11-15 | Deferred | Coming soon, homepage; no availability claims |

## Product assets

The working product name is **Vernia Grip One**, with pricing currently hidden from the page and metadata. Contact links use `ishan.upadhyay.iitb@gmail.com` and `+91 83029 52133` (India country code assumed from the supplied ten-digit number).

The Hardware page uses the assembled right-hand viewer CAD from [Pollen Robotics' Grabette repository](https://github.com/pollen-robotics/grabette), pinned to commit `1707d4e2ec542a3038b858fae7e919f95ea27305`. All 64 visual instances from 30 source STL meshes are retained, with the original URDF transforms and joint axes. The model is converted to indexed glTF 2.0, with a 1.8 MB gzip download and a standard GLB fallback for browsers without native decompression. The homepage and Hardware page each fetch the model once for their scroll-driven viewer. The homepage does not load the hand animation or its assets.

Grip One remains Vernia's public product name. This reference CAD does not certify Vernia's final hardware configuration. Satin aluminum, graphite metal, and studio-reflection finishes are illustrative; the closure animation moves the two original joints within their source limits and is not a physics simulation or a measured hardware stroke. A matching transparent CAD render replaces the old procedural fallback. The upstream copyright, Apache-2.0 license, and notices are retained under `assets/models/grip-one/`, without a public-facing source/license link in the product showcase.

To reproduce the conversion, run `python tools/fetch-gripper-source.py` followed by `python tools/build-gripper-model.py .qa/cad-source`. Both scripts use Python's standard library. Source mesh hashes and the output GLB hash are recorded in `provenance.json`. The bundled Three.js loader and geometry utility retain their MIT license; their module import paths were changed to local vendor files.

The site deliberately leaves hardware specifications, shipping terms, headquarters, testimonials, and other unconfirmed details unspecified. Purchase interest opens an email inquiry; no order or payment is taken.

## Verification

Browser checks cover desktop and mobile layouts (1920, 1440, 1024, 768, 640, 390, 360, and 320 px), 200% zoom, smooth scroll rotation and reversal, settling at rest, readable body text, WebGL rendering, absence of visible model controls, mobile navigation, contact links, anchor targets, reduced motion, and the static fallback. The renderer pauses offscreen and in background tabs, and caps rendering at approximately 30 fps. Both product covers rest when scrolling stops, and reduced motion disables rotation.

## Brand assets

The two supplied original logo JPGs are preserved in `assets/brand/`. The first is used in the header with a CSS dark-background treatment. The second is the social preview; a transparent PNG cutout is used for the footer lockup. The header uses an inline SVG view box; the footer loads a true RGBA PNG without a JPG wrapper or blend filters. The favicon is a simplified vector adaptation of the first mark for small sizes. Violet and lavender accents follow the supplied identity.


## Production waitlist and analytics

The site now includes `waitlist.html`, `privacy.html`, and a custom `404.html`. Home and Hardware link to one shared waitlist; Hardware preselects the relevant product. The charcoal/lavender design and scroll-driven CAD remain in place. No prices, shipping commitments, customer logos, or hardware specifications were invented.

The waitlist API uses Cloudflare Workers, a dedicated D1 database, and Turnstile with server-side verification. Public configuration lives in `site-config.js`; the Turnstile secret is stored only as a Worker secret. It must never be copied into the site, Git, or a client-side environment variable.

- Endpoint: `https://vernia-waitlist.ishan-upadhyay-iitb.workers.dev/waitlist`
- Worker: `vernia-waitlist`
- Database: `vernia-waitlist` (`85335bb0-0538-4ef4-8926-d61c8de16288`)
- Database schema and private-console reports: `backend/schema.sql`, `backend/reports.sql`
- Worker source and meaningful request/storage tests: `backend/worker.mjs`, `backend/worker.test.mjs`
- Web Analytics site: `fe77e964d511440992019b9863ebcb76`

Run `node --test backend/worker.test.mjs` with Node 22. Tests use an in-memory SQLite database and an injected verification stub, never the live database. For browser integration testing, run `node tools/preview.mjs` and open `http://127.0.0.1:4173/waitlist.html`. This loopback-only preview replaces public config with the official Turnstile test site key and an in-memory backend; it sends no signup emails and is not deployed. `python -m http.server 4173` remains available for a plain static preview, but the production Turnstile key intentionally does not accept localhost.

### Signup behavior

Email and at least one interest are required, along with explicit update consent. Name and organisation are optional. The backend normalizes email, uses bound SQL parameters, restricts request size, checks origin, validates Turnstile success/hostname/action, and applies a per-IP limit of five attempts per minute per Cloudflare location. Cloudflare rate limits are approximate, not a strict global quota. Raw IP addresses are not stored in D1.

The database assigns increasing signup numbers. A repeated email keeps the original record and cannot change its interests or retrieve its number without authentication. Concurrent duplicate submissions cannot create multiple records. The UI reports success only after a database write or a verified duplicate lookup path. Signup numbers are not promised delivery positions. No automated email is sent yet; email ownership is not verified, so report these as submitted leads, not confirmed customers.

Open D1 in the Cloudflare dashboard to manage the private FIFO queue. Use `backend/reports.sql` for daily signups, interests, source/campaign breakdowns, and the waiting list. Do not publish query results or customer exports. An operator can mark contacted/invited entries, correct preferences after verifying the requester, or delete a specific record on an authenticated removal request. Keep database exports outside this public repository. D1 recovery is managed through Cloudflare; the source schema is not a customer-data backup.

### Traffic measurement

Cloudflare Web Analytics is installed explicitly on all five public HTML pages. GitHub Pages serves this hostname directly, so automatic Cloudflare proxy injection does not reach the site. The public beacon token is not a secret. The dashboard should use `Exclude bots = Yes`. Browser visits, page views, referrers, countries, devices, and page performance are separate from raw edge requests.

The page does not send email/name/organisation to Web Analytics. Browser analytics remain estimates: script blockers can suppress visits and sophisticated bots can execute JavaScript. A signup is a stronger expression of interest but is not a verified email owner or paying customer. There is no fingerprinting, advertising pixel, or bespoke visitor cookie.

Waitlist links support `from=home` or `from=hardware`, `interest=grip-one|tactile-gloves|data`, and an optional `utm_campaign` label containing only letters, digits, underscores and hyphens (80 characters maximum). Never put an email, name, or sensitive identifier in a tracking URL. Form content is sent in the POST body, not the URL.

### Email setup

Requested addresses: `sanskar@vernia.in`, `dewaansh@vernia.in`, `ishan@vernia.in`, and `team@vernia.in`. Full mailbox provisioning depends on the owner's provider choice and account setup; `team@` is intended as a shared team address. Until these are provisioned and tested, public contact links continue to use the established owner inbox. No mail DNS records have been changed.

### Deployment and rollback

Website publication remains GitHub Pages from `main`; retain `CNAME` and `.nojekyll`. Check mobile and desktop form behavior, privacy links, and beacon loading before publication, then verify the live version. The pre-change website revision is `86955d3`. Revert the website change to roll back; do not delete the D1 database. The Worker is independently deployed and should be rolled back independently if required.

The current Cloudflare plugin connection supports Workers and D1 but lacks DNS, account-settings and Turnstile management scopes. The existing logged-in Cloudflare dashboard was used to configure the analytics site and Turnstile widget. These are not access grants to new people. Any future email DNS change must use the selected provider's exact verification, MX, SPF, DKIM and DMARC instructions and preserve unrelated records.
