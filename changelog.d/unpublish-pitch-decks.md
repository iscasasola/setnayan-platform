## 2026-08-12 · chore(decks): take the internal pitch decks off the open web

**Owner decision 2026-08-12**, after being shown what was actually in them.

### Why

Everything under `apps/web/public/` is served at the site root with no auth. The
dated internal decks lived there, so **anyone with a link opened them on the live
site**. `robots.ts` had disallowed `/keynote` + `/proto` on 2026-06-13 for exactly
this reason — but that only asks crawlers politely. **A person with the link kept
reading them for another two months.**

Verified against the live catalog before acting:

- **Every à-la-carte price was wrong** — paparazzi app ₱8,000, livestream ₱18,000,
  same-day reel ₱12,000, photo booth ₱6,500, song ₱4,500, photo delivery ₱3,500,
  invitation widgets ₱1,500.
- It listed **"Pailaw · LED background loops · from ₱6,000 · 8K, USB-deliverable"** —
  removed from the product 2026-08-11 (PRs #4356 · #4362).
- 🚨 **The vendors deck made a commercial promise about it**, verbatim: *"Vendors can
  purchase Setnayan Productions services (Panood, Papic, AI Reel, Pailaw, Pakanta)
  at the platform rate and resell them as part of their own package… you keep the
  markup, we deliver the service."* An offer to a business partner to **resell a
  product we cannot deliver**. That is what moved this from "file it" to "do it".
- Retired names throughout ("Panood", a "Today's Focus" panel), and a prototype page
  offering a ₱2,499 "Grand Bundle" including the LED backdrop.

### What changed

`apps/web/public/keynote/` and `apps/web/public/proto/` → **`internal-decks/`**
(255 files, pure renames — kept, not deleted; the owner still has them). ~10.6 MB
also leaves the deployed bundle. `internal-decks/README.md` records what was in
them, how to view one locally, and what to fix before ever republishing.

Two dependents handled rather than discovered later:

- `scripts/regen-brand-rasters.mjs` **wrote into both folders** (`public/proto/assets/
  setnayan-mark.svg`, `public/keynote/brand/setnayan-mark.png`). Both outputs dropped
  with a reason — the decks are a frozen 2026-05-28 snapshot, so their assets freeze
  too; regenerating brand art into an unpublished archive is churn nobody reads.
- `robots.ts` keeps its two disallow entries **as a backstop**, with the comment
  corrected to say plainly that it was never the control.

### 🛡 The mechanism

`lib/no-published-decks.test.ts` fails if either folder reappears under `public/`.
Republishing is one `git mv` away and **looks harmless in a diff** — a folder
appears and the site silently serves stale pricing again. This does not forbid it;
it makes it a deliberate decision, taken by deleting an assertion that says why not.
Mutation-tested: created `public/keynote/index.html`, watched it go red, removed it,
watched it go green. Includes a vacuity check so it cannot pass by looking at nothing.

### 🪤 Two false alarms, recorded because counting beat reading

- `keynote/components/admin-dashboard.jsx` holds the worst-looking content of all —
  every paid add-on with `takeRate: 5`, contradicting the "0% commission · we never
  touch your transactions" the same decks display. **No deck ever loaded that file.**
  Dead code; nobody saw it.
- "commission" appears in nine files. Every one says **"0% commission"** — the
  correct, owner-locked line, not a stale claim.

Also found: **`/keynote` (no filename) never worked at all.** It resolves its scripts
relative to the URL, so from `/keynote` it looked for them at the site root, 404'd,
and sat on "Loading the keynote…" forever. Only `/keynote/index.html` rendered —
anyone sent the shorter link saw a blank page.

### Checks

`tsc` clean · **7643/7643** unit · all 22 lint scripts · `csp-report.test.ts` (which
asserts the CSP config excludes these paths) still 17/17 · raster script syntax-checked
and free of dangling paths.

SPEC IMPACT: None — no product decision changes; this removes stale public material.
`DECISION_LOG.md` row added 2026-08-12.
