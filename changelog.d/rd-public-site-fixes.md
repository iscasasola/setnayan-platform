## 2026-10-13 · fix(public): the live quality sweep's code items (2–10)

From the read-only production sweep of 2026-10-13 (controller `sweep/REPORT.md`), one commit per item:

- **/panood** — the "This is what turning it on looks like." section wrapped a control-room film that was never recorded (two 404s, an empty gap). Omitted until the file exists; `spotlights-are-real.test.ts` now refuses any add-on page naming a `/add-ons/demo/` file that is not in `public/`.
- **Sideways scroll** on `/pa3d`, `/download`, `/alaala` — the decorative glows are clipped (`overflow-x-clip` on each `<main>`); guard `decorative-glow-is-clipped.test.ts`.
- **React #418** — `/u/<slug>`: the view beacon was a cookie-setting server action, which re-renders the page mid-hydration (server "10 views", client "11"); it is now `POST /api/u/view` (same cookie, same RPCs, no second render, −2 server actions). `/tour/vendors`: the scripted chat's clock prints after hydration.
- **Safari** — the /explore landing's two filter selects are 44px in WebKit (were 26px).
- **44px presses** on the shared chrome (footer links + Cookie settings, help/article top bars, the Taglish/English switch, the header wordmark) with no change to the look.
- **ActionButton as a link** (`<a class="ab">`) presses at 44px like its button form — a vertical-only `::after` expander in the shared `.ab` rules; look unchanged, CSS only.
- **Faint words** — Explore folder counts, /login + /signup labels, onboarding hints, Real Stories + blog fine print → ≥12px, ≥4.5:1.
- **CSP (report-only)** names `*.mzstatic.com`, `images.unsplash.com` (img-src) and `*.itunes.apple.com` (media-src).
- **Brand words at 4.5:1** — text-only remap in `tailwind.config.ts`: `text-terracotta` → `--color-terracotta-700` (5.02:1); `text-ink/50–/65` render at ink/70 (5.40:1). Fills, borders, gold icons and the logo unchanged; no CSS token value changed. `lint:contrast` reads the remap back and fails without it.
- **/tl** is the Taglish prefix in robots (`/tl/`); a bare `/explore/compare` is a 307 at the edge (no more aborted Safari prefetches).

SPEC IMPACT: None — applies existing locks (palette lock: gold carries words only at terracotta-700; WCAG AA 4.5:1; the 44px tap floor) and the corpus's `/tl` locale-prefix intent; no locked decision changed.
