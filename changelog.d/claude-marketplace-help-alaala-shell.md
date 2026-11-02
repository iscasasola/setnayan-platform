## 2026-08-15 · fix(shell): the marketplace, help and alaala join the shared shell — and the top bar was 7px taller than its own token said

SPEC IMPACT: None. No price, SKU, schema or product-rule change. This finishes
the One Top Bar work recorded in `DECISION_LOG.md` 2026-08-14/15 on the last
public routes that were still drawing their own chrome.

**Five routes converted:** `/explore`, `/explore?category=…`, `/explore/compare`,
`/help` (index only) and `/alaala`. The owner had asked twice for the
marketplace and its sub-pages; the two objections in the way were re-measured
against the code and **both dissolved**:

- *"the shell would add a second `<main>`"* — **false, and backwards.**
  `MainEl = ownsMain ? 'div' : 'main'`: `ownsMain` means the HOST page owns it,
  so the shell renders a `<div>` for doorways. Every converted page keeps its
  own `<main>`. Measured: one per route.
- *"two pinned bars would stack"* — **real, and already solved elsewhere.**
  `.fd-rail` and `.fd-chipbar` park at `top: var(--fd-bar)` on the front page.
  The marketplace's three pinned strips now do the same, at `z-8` under the
  bar's `z-12`. Measured in a browser at 1440/1280/375: bar 0→56, strips stuck
  at 56, **gap 0** — flush, no overlap.

**Width:** the rail costs 240px and that IS the shell. The other squeeze — 48px
of gutter plus the 1600px cap — is given back by a new opt-in `bleed` prop, and
it matters: without it the grid lands at exactly **1152px** on a 1440px laptop,
which is the `max-w-6xl` cap the owner explicitly struck out of this page in
PR #655. Shipping the conversion without `bleed` would have re-imposed a retired
cap as a side effect of unrelated work.

### 🚨 The top bar was 7px taller than the token that describes it

`--fd-bar: 56px` is derived as `--fd-ctl` (40) + 8 + 8. That holds on the front
door, whose search is the 40px GET form. **Every other shelled page renders the
command palette instead, and its trigger came in at 46.5px** (10px padding each
side + a 24.5px ⌘K chip + two borders) — so the bar measured **63px** while
everything parking beneath it read 56 from the token. Measured, not derived:
`.fd-topbar` 0→63 with `.fd-rail` stuck at 56.

The token was NOT the thing to change — it is correct arithmetic about a
control-height bar, and raising it would have moved the owner-approved front
door for no reason. The palette trigger simply never went through the
control-sizing pass that gave `.fd-searchbox`, `.fd-iconbtn` and `.fd-chip`
their heights. **The 44px tap target is preserved** by the same `min-height: 0`
+ `::after` expander technique already used three times in that file. Bar now
measures exactly 56.

This bug was live on the front page. Its own docblock had recorded the same
class of error ("pinned `top: 60px` against a bar that renders 63px") and the
fix at the time set the token to 56 — correct for the form, 7px wrong for the
palette.

### The guards

- **`lint-no-stacked-pinned-bars.mjs` could not see the bar it most exists for.**
  `PIN` required `sticky` and `top-0` to be ADJACENT, so
  `sm:sticky sm:bottom-auto sm:top-0` — the marketplace's own header — never
  matched. It now asks the question **per class attribute**, which is the unit
  the question is about. Found by mutation: reverting that file left the lint
  green while two sibling mutations turned it red.
- **Removing a route from `NAV_ROUTES` silently dropped it from that lint's
  scope at the exact moment the collision became possible.** A second, opposite
  check now covers the shelled routes: their pinned strips must park at
  `var(--fd-bar)`, never bare `top-0`. **On its first run it found a THIRD
  pinned bar nobody had listed** (`mega-column-tabs.tsx`).
- **And that new check cried wolf on its own subject matter** — it reported
  `explore/page.tsx`, matching a COMMENT describing the behaviour being removed.
  Comments are stripped now, same fix the NAV_ROUTES parser already needed.
- **The last count floor is gone.** `navRoutes.size < 10` was tuned to today's
  size while NAV_ROUTES drops 16 → 13 here; replaced with a positive control on
  `/download` + `/waitlist`, matching what both test files already did.
- **Two positive controls named `/help` and `/explore` as routes that would
  never convert.** Repointed to `/download` and `/waitlist`, with the reason
  written down: a control must name routes with a REASON not to convert.
- **The `/alaala` tripwire fired and was re-aimed, not deleted.** It pinned
  `force-static` to stop an accidental sweep; the page was converted
  deliberately, so it now guards the half that still matters — that /alaala is
  NOT ported onto `DoorwayPage` (which would delete a live CTA and strip the
  hrefs off five pillar cards).
- **`one-main-per-page.test.ts` pinned a literal for the second time in one
  file** — `<MainEl className="fd-main"` broke when the class became a ternary.
  Repointed to the act; both real regressions still fire.
- New `SHELLED_PUBLIC` block asserts all three halves of the contract
  (force-dynamic · loading boundary · out of NAV_ROUTES) without misnaming these
  routes as Studio doorways.
- `navRoutes()` extracted so two callers share ONE parser instead of a copy.

### 🔴 A deleted header stranded signed-out visitors, and the lint caught it

Removing `/explore/compare`'s brand header also removed **"Back to
marketplace"** — and the shared rail's marketplace group is **signed-in only**
(owner 2026-08-12). Measured: a signed-out render contained **zero**
`href="/explore"`. Restored as page CONTENT above the `<h1>`, not chrome: a back
link to where you just came from is a property of that page, not of a bar shared
by every page. The port baseline was regenerated only after each remaining
removal was checked as genuinely still reachable.

### Found, not fixed (named so it is not mistaken for new)

- `/explore?category=…` renders **zero `<h1>`**. Pre-existing — confirmed zero
  in `origin/main` too. Adding a heading is a copy decision on a public page.
- The 75 `/help/<slug>` articles are deliberately NOT converted: they are
  prerendered, force-dynamic would drop the prerender on 75 indexed URLs, and
  their docblock forbids a loading boundary because streaming would commit HTTP
  200 before `notFound()`. They keep the shared footer; the index loses it —
  the same seam `/blog` and `/blog/<slug>` already ship.
- `/explore/compare` calls `redirect()` twice, which a loading boundary turns
  into a client-side redirect. Pre-existing: the skeleton it replaced forced
  streaming identically.
