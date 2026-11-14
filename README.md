# Vernia Labs

The physical AI research website at https://vernia.in, published from `main` through GitHub Pages.

## Local preview

Run `python -m http.server 4173` in this directory and open http://localhost:4173. No build step or package installation is required.

## Files

- `index.html`: company homepage, vision, Hardware entry point, and Data coming-soon section. No Grip One imagery or product pitch appears here.
- `hardware.html`: Grip One with interactive 3D, followed by tactile gloves marked Coming soon.
- `styles.css`: responsive layouts, visual design, and motion preferences.
- `app.js`: navigation, reveal effects, and the articulated Three.js CAD viewer.
- `assets/models/grip-one/`: assembled CAD, matching rendered fallback, original URDF, provenance, and upstream license notices.
- `assets/vendor/`: locally hosted Three.js 0.170.0 and its MIT license.
- `CNAME`: existing custom domain; keep this file when updating the site.

## Content and navigation

The homepage introduces Vernia Labs to physical AI researchers; the Hardware page answers what tools Vernia offers. Main navigation links to Our vision, Hardware, and Data. Data remains a compact coming-soon section, without a catalog or platform claims. Existing `/#grip-one` links redirect to `hardware.html#grip-one`. Product and general inquiries open the owner's email client; no form or waitlist collects data.

The owner supplied the Product Website Builder skill on 2026-11-15. It is installed locally in Codex and used for this information architecture, copy, and verification pass. The original brief, supplied brand assets, and product geometry are preserved. The existing charcoal, lavender, serif accents, and metallic product styling carry across both pages. The homepage's abstract trajectory graphic is decorative, not a dataset or application screenshot.

| Claim | Source / date | Status | Public wording / location |
| --- | --- | --- | --- |
| Vernia researches the physical AI data layer | Owner brief, 2026-11-14 | Owner-stated | Company introduction on homepage |
| Grip One is a handheld UMI gripper | Owner brief, 2026-11-14 | Owner-stated offering; fulfillment details unspecified | Hardware page; inquiry CTA |
| Tactile gloves are forthcoming | Owner request, 2026-11-15 | Planned | Coming soon, Hardware page; no specs or release date |
| Data offering is not ready to present | Owner request, 2026-11-15 | Deferred | Coming soon, homepage; no availability claims |

## Product assets

The working product name is **Vernia Grip One**, with pricing currently hidden from the page and metadata. Contact links use `ishan.upadhyay.iitb@gmail.com` and `+91 83029 52133` (India country code assumed from the supplied ten-digit number).

The Hardware page uses the assembled right-hand viewer CAD from [Pollen Robotics' Grabette repository](https://github.com/pollen-robotics/grabette), pinned to commit `1707d4e2ec542a3038b858fae7e919f95ea27305`. All 64 visual instances from 30 source STL meshes are retained, with the original URDF transforms and joint axes. The model is converted to indexed glTF 2.0, with a 1.8 MB gzip download and a standard GLB fallback for browsers without native decompression. The Hardware page fetches the model for its interactive viewer. The homepage does not load the CAD or Three.js.

Grip One remains Vernia's public product name. This reference CAD does not certify Vernia's final hardware configuration. Satin aluminum, graphite metal, and studio-reflection finishes are illustrative; the closure animation moves the two original joints within their source limits and is not a physics simulation or a measured hardware stroke. A matching transparent CAD render replaces the old procedural fallback. The upstream copyright, Apache-2.0 license, and notices are retained under `assets/models/grip-one/`, without a public-facing source/license link in the product showcase.

To reproduce the conversion, run `python tools/fetch-gripper-source.py` followed by `python tools/build-gripper-model.py .qa/cad-source`. Both scripts use Python's standard library. Source mesh hashes and the output GLB hash are recorded in `provenance.json`. The bundled Three.js loader and geometry utility retain their MIT license; their module import paths were changed to local vendor files.

The site deliberately leaves hardware specifications, shipping terms, headquarters, testimonials, and other unconfirmed details unspecified. Purchase interest opens an email inquiry; no order or payment is taken.

## Verification

Browser checks cover desktop and mobile layouts (1440, 1024, 768, 760, 640, 390, and 320 px), WebGL rendering, gripper open/close and reset, keyboard rotation, mobile navigation, contact links, anchor targets, reduced motion, and the static fallback. The renderer pauses offscreen and in background tabs, and caps rendering at approximately 30 fps. The Pause motion control stops automatic model movement.

## Brand assets

The two supplied original logo JPGs are preserved in `assets/brand/`. The first is used in the header with a CSS dark-background treatment. The second is the social preview; a transparent PNG cutout is used for the footer lockup. The header uses an inline SVG view box; the footer loads a true RGBA PNG without a JPG wrapper or blend filters. The favicon is a simplified vector adaptation of the first mark for small sizes. Violet and lavender accents follow the supplied identity.
