# Vernia Labs

The physical AI research website at https://vernia.in, published from `main` through GitHub Pages.

## Local preview

Run `python -m http.server 4173` in this directory and open http://localhost:4173. No build step or package installation is required.

## Files

- `index.html`: page content, price, contact links, and metadata.
- `styles.css`: responsive layouts, visual design, and motion preferences.
- `app.js`: navigation, reveal effects, and procedural Three.js product concepts.
- `assets/gripper-concept.svg`: original static fallback when WebGL is unavailable.
- `assets/vendor/`: locally hosted Three.js 0.170.0 and its MIT license.
- `CNAME`: existing custom domain; keep this file when updating the site.

## Prototype content

The working product name is **Vernia Grip One**, displayed at **$499 USD**. Contact links use `ishan.upadhyay.iitb@gmail.com` and `+91 83029 52133` (India country code assumed from the supplied ten-digit number).

Both product visualizations are original, illustrative geometry created for this website. They are not production CAD, verified dimensions, or a claim about the supplied hardware's precise components. Replace the procedural model and fallback with final approved CAD/photos when available. Product origin information supplied during the brief is not used as the public product name. No upstream hardware models, images, or software were copied into the site.

The site deliberately leaves hardware specifications, shipping terms, headquarters, testimonials, and other unconfirmed details unspecified. Purchase interest opens an email inquiry; no order or payment is taken.

## Verification

Browser checks cover desktop and mobile layouts (1440, 1024, 768, 760, 640, 390, and 320 px), WebGL rendering, gripper open/close and reset, keyboard rotation, mobile navigation, contact links, anchor targets, reduced motion, and the static fallback. The renderer pauses offscreen and in background tabs, and caps rendering at approximately 30 fps. The Pause motion control stops automatic model movement.
