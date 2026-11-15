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

The homepage immediately introduces Grip One to physical AI researchers, then explains Vernia’s data-layer focus. The Hardware page provides product details. Main navigation links to Our vision, Hardware, and Data. Data remains a compact coming-soon section, without a catalog or platform claims. Existing `/#grip-one` links redirect to `hardware.html#grip-one`. Product and general inquiries open the owner's email client; no form or waitlist collects data.

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


## Analytics and shared waitlist plan

Status: not activated. The owner selected one waitlist with interest choices on 2026-11-15. No analytics beacon, form endpoint, signup storage, or email automation is connected yet. Existing contact links remain email inquiries.

Recommended initial setup: Cloudflare Web Analytics plus one embedded Tally form connected to a private Google Sheet. Keep hosting on GitHub Pages.

### Traffic

In the owner's Cloudflare account, open Web Analytics, add `vernia.in`, and copy the public JavaScript snippet from Manage site. Add the snippet to both HTML pages before `</body>`; a DNS migration is not needed. Verify the beacon request and dashboard data after publishing. This reports traffic and performance, with country, referrer, path, and device breakdowns. It does not provide visitor email addresses or a named lead list.

Official setup: https://developers.cloudflare.com/web-analytics/get-started/
Service overview: https://developers.cloudflare.com/web-analytics/about/
Dimensions: https://developers.cloudflare.com/web-analytics/data-metrics/dimensions/

### One waitlist, several interests

Create a form in the owner's Tally account with this content:

- Title: Join the Vernia waitlist
- Introduction: Tell us what you’re building. We’ll keep you updated on the tools you’re interested in.
- Email: required email field
- Name: optional
- Organisation or lab: optional
- Interested in: required multiple selection — Grip One, Tactile gloves, Data
- What are you working on?: optional short text
- Consent: I’d like Vernia Labs to email me updates about my selected interests.
- Submit button: Join the waitlist
- Confirmation after a successful submission: You’re on the list. We’ll be in touch as there’s more to share.

Enable duplicate prevention using the email field before launch. Connect the form to a private Google Sheet through Tally's Integrations tab. Publish the form and provide its public share/embed link for the website integration. Use one destination from both pages, preserving a source-page hidden field if useful. A successful signup must be verified in Tally and in the connected Sheet before calling the waitlist live; duplicate prevention, mobile layout, keyboard access, and failed submission behavior must also be checked. Keep email addresses out of analytics events and the public repository. A form submission is not a product order or delivery commitment.

Official embed guide: https://tally.so/help/embed-your-form
Sheets integration: https://tally.so/help/google-sheets-integration
Duplicate handling: https://tally.so/help/prevent-duplicate-submissions

Required activation inputs: the public Cloudflare beacon snippet and the published Tally form link. Passwords and private API credentials are not required for these client-side integrations. Costs, if any, for optional paid form customization or email campaigns are separate from this proposed basic setup.
