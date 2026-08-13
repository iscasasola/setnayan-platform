## 2026-08-13 · fix(a11y): the 3.06:1 text colour is gone from /why-setnayan and the /tour tree

design#6b. design#6 (PR #4417) removed the hand-typed `#9A8F86` from the eight public doorways because it measures **3.06:1 on cream**, below the 4.5:1 AA floor for normal text. The sweep afterwards found the identical colour still live on five other public routes. This is that half.

**Measured in the HTML actually served by `www.setnayan.com`, re-verified before the change:**

| route | HTTP | occurrences | what it was colouring |
|---|---|---|---|
| `/why-setnayan` | 200 | 6 | an `<h3>` SECTION HEADING at `text-lg` |
| `/tour/vendors` | 200 | 14 | category counts + the empty-state on `bg-white/50` cards |
| `/tour/gallery` | 200 | 7 | captions at `text-xs`, swatch slot labels at `text-[10px]` |
| `/tour/seating` | 200 | 5 | an input PLACEHOLDER + the map caption |
| `/tour` | 200 | 0 | the source's one "soon" pill did not reach the served markup |

13 source sites across 9 files, all now `--m-slate-2` (**5.21:1** on cream, 5.30:1 on the `bg-white/50` cards).

⚠ **The `text-lg` heading was not exempt.** WCAG's large-text allowance needs ≥24px, or ≥18.66px **bold**. `text-lg` is 18px at normal weight and takes the full 4.5:1 floor.

⚠ **`--m-slate-3` would not have fixed it** (3.55:1) — the same trap design#6 hit. The arithmetic picked the token, not the eye.

### THE COLOUR WAS WORSE THAN THE BRIEF SAID, ON THE SURFACES NOBODY MEASURED

The brief carried 3.06:1 on cream and 3.11:1 on the cards. On the tour's own tinted panels it is **2.98:1 (`#FBF8F1`) and 2.93:1 (`#FBF6EA`)** — below even the 3:1 floor that applies to non-text UI. Nothing was sized against those surfaces because nobody had listed them.

### THIS WAS NOT A FIND-AND-REPLACE — THE TOUR'S SURFACES WERE DECIDED FIRST

The /tour tree carries its own pre-lock palette in ~290 hand-typed hexes (`#1B1A17` ink, `#5F5E5A` body, `#8C6932` gold). So the question was what these pages actually render on, and the answer is in the markup: **no tour route sets a page background at all** — every `<main>` is bare and inherits `bg-cream` from the root layout. The tour is already on cream. That is what makes `--m-slate-2` the right token rather than merely an available one, and the guard now asserts that premise instead of assuming it (test 3).

**What was deliberately NOT changed:** the `bg-white/50` card fills. design#6 replaced them on the doorways because the terracotta lock says page and cards are both cream — but that lock does not cover /tour, replacing them is a visual redesign rather than an accessibility fix, and `--m-slate-2` clears AA on `bg-white/50` (5.30:1) either way. Named here rather than silently widened or silently dropped.

**One occurrence was not required to move.** The `aria-hidden` search glyph in `/tour/seating` is non-text UI and needs only 3:1, which it already met (3.16:1 on the white input). It moved anyway, because it sits inside the field it labels and beside the placeholder that did have to change; leaving it would have split a matched pair to preserve a colour with no other user.

### A THIRD GUARD WAS WATCHING, AND ALSO COULD NOT SEE IT

design#6 documented two contrast guards with a seam between them. There were three, and the new one had the same shape of gap:

- `lib/palette-lock.test.ts` checks **token definitions** — a hand-typed hex is not a token.
- `scripts/lint-label-on-fill-contrast.mjs` checks **call sites**, but by its own documented limit judges only pairings where BOTH sides are opaque. These cards are `bg-white/50`.
- `app/_components/marketing/doorway-palette.test.ts` — written by design#6 for exactly this defect — scans the eight doorways by an **explicit route list**. /tour and /why-setnayan are not on it. It was green and right to be.

New `lib/public-page-text-contrast.test.ts` covers the two route trees that had no guard. It could not simply copy the doorway guard: that one bans the **act** (any raw colour literal, no baseline), which is affordable only because the doorways were ported to tokens in the same unit. Banning the act here would fail on its first run and force a ~290-line baseline — "a bill, not a decision". So this guard checks the **outcome**: whatever colour a page names for text, the arithmetic must come out readable. Still no baseline.

🪤 **It scans recursively, unlike the doorway guard's flat `readdirSync`.** 9 of this defect's 13 occurrences live in `_components/` subfolders that a flat scan never opens. Test 4 fails if the recursion is ever removed.

### THE GUARD'S FIRST TWO DRAFTS WERE WRONG, AND MEASUREMENT SAID SO — NOT REVIEW

**A blind cross-product of every ink against every surface was drafted, measured, and rejected.** It reports two failures that cannot render: gold `#8C6932` on `--m-paper-2` at 4.48:1 (gold text renders on the cream page at 4.86:1; the `--m-paper-2` cards carry only ink and body), and body `#5F5E5A` on the `bg-[#1B1A17]/20` toggle **track** at 4.02:1 — a switch with no text on it at all. A guard whose first act is to demand a baseline for things that are fine teaches the next reader to add lines to the baseline.

**Then the surviving draft made a milder version of the same mistake and shipped red.** Test 2 took the lightest dark panel across BOTH trees at once and reported the `/tour` ribbon's `#FBF6EA` against the `/why-setnayan` mulberry CTA at 4.42:1 — two different routes, a pairing that cannot exist. It is now scoped per-route.

**And its failure messages pointed at the wrong lines.** Comments are stripped before scanning so that a docblock quoting `#9A8F86` is not counted as a use of it; the first draft deleted them outright, every line below a docblock shifted up, and the guard's first real failure named `why-setnayan/page.tsx:232` — an unrelated FAQ block. Comments are now replaced by their own newlines, and the mutation run checks the reported line against the source (M3 below).

### VERIFIED — 7 SABOTAGES, EACH CONFIRMED TO HAVE LANDED BY OCCURRENCE COUNT, ALL 7 CAUGHT

| # | sabotage | landed (measured) | result |
|---|---|---|---|
| M1 | revert all 13 sites to `#9A8F86` | token sites 14 → 1 | 🔴 test 1 |
| M2 | swap to `--m-slate-3` (3.55:1) | slate-2 sites 13 → 0 | 🔴 test 1 — **resolved through globals.css**, not hex-matched |
| M3 | one site only: the `text-lg` `<h3>` | hex in file 0 → 1 | 🔴 test 1, and reported **line 171 = the sabotaged line** |
| M4 | remove the recursive descent | recursive calls 1 → 0 | 🔴 test 4 |
| M5 | give a `<main>` its own `bg-` fill | fills 0 → 1 | 🔴 test 3 |
| M6 | pale the tour ribbon's light text | 1 site | 🔴 test 2 |
| M7 | move `--m-slate-2`'s VALUE in `globals.css` | defs 1 → 0 | 🔴 test 1 — proves the arithmetic is **derived, not re-typed** |

M7 is the one that matters: change the token and the guard re-runs the arithmetic. A hand-written `assert.equal(MUTED, '#6E6A62')` would be two humans agreeing with each other.

SPEC IMPACT: None — no SKU, price, copy, route or schema change. One colour token per site, on 13 sites.
