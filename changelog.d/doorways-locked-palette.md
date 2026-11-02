## 2026-08-13 · fix(marketing): the eight public doorways wear the locked palette — and two of them were failing AA

design#6, first half. The eight public product pages (`/papic` `/panood` `/pawebsite` `/pa3d` `/palogo` `/alaala` `/patiktok` `/setnayan-ai`) already carried the shipped shell — all eight are registered in `NAV_ROUTES`, so `SiteChrome` + the footer were never missing. **That half of the brief was already done and nothing was rebuilt.** What was actually wrong was the colour, and because these pages were built by copy-paste, every wrong colour was eight pages wide.

### 1 · A REAL WCAG FAILURE, ON EVERY DOORWAY, IN THE SECTION THAT MATTERS MOST

The "what it's like without → what it's like with" comparison rendered its struck-through half in a hand-typed `#9A8F86`. Measured against the cream page: **3.06:1**, below the 4.5:1 AA floor for normal text. Not a token — a hex somebody typed, on all eight public product pages, in the one section whose entire job is the comparison. It is now `--m-slate-2` at **5.21:1**, and the hierarchy survives because the affirmed half is ink at 13.82:1.

⚠ `--m-slate-3` would NOT have fixed it (3.55:1). The nearest-looking token was not the right one; the arithmetic decided.

### 2 · THE CARDS WERE WHITE ON A CREAM PAGE

`bg-white/60` composited over `bg-cream` is `#FEFDFC` — white in all but name — on a `#FDFBF7` body. The lock says the page and its cards are **both cream, separated by a border and a shadow**. They now are. Same for the alternating differentiator rows, which now alternate `--m-paper` / `--m-paper-2` instead of two strengths of white.

### 3 · WHY TWO EXISTING CONTRAST GUARDS BOTH MISSED IT

Neither was broken; each was looking at the half it owns.

- `lib/palette-lock.test.ts` checks the **token definitions**. Every token here is fine in isolation, so it was green and right to be.
- `scripts/lint-label-on-fill-contrast.mjs` checks **call sites** — but by its own documented limit it judges only pairings where BOTH sides are opaque. The card fill was an alpha over an unknown parent, so every pairing on it was skipped.

The defect lived exactly in the seam. New `app/_components/marketing/doorway-palette.test.ts` closes it: it bans a raw colour literal (hex **or** `*-white`) in any doorway source with **no baseline**, and computes AA for the pairings the kit renders.

🪤 **AND ITS FIRST DRAFT WAS DECORATIVE — CAUGHT BY THE MUTATION RUN, NOT BY REVIEW.** That draft hand-wrote the surface for each pairing (`gold on paper`). A sabotage that moved the step card from `--m-paper` to `--m-paper-2` in the kit **landed cleanly (occurrences 0 → 1) and the test stayed GREEN**, because the table still said `paper` while the component said `paper-2` — where gold measures 4.42:1 and fails. It was checking that I had typed the same word twice. Both sides are now read out of source: the tokens from `globals.css`, the surfaces from `DOORWAY_TONE`, the zebra from the kit's own ternary. **5 sabotages, all verified to have landed by occurrence count, all 5 caught.**

### 4 · THREE DOORWAYS JOINED THE SHARED KIT; ONE DELIBERATELY DID NOT

`/papic` and `/setnayan-ai` now mount `DoorwayPage` like the other five. Every string is verbatim — no copy, route, CTA, metadata or JSON-LD change. Two private forks of the archetype are deleted: `_setnayan-ai-motion.tsx` entirely, and `_papic-motion.tsx` down to the one thing that was genuinely its own (the step-02 tile-settle, which now reaches the archetype through a step's `figure` field — CONTENT belonging to one step, not a layout escape carved into the shared spine). `/papic`'s price anchor and "Two ways to run it" move BELOW the differentiator, because that is where the archetype puts what it does not model.

**`/alaala` stays on its own composition, on purpose.** It is the umbrella over the other five: no how-it-works panel, no differentiator lede, and it closes on TWO destinations. Forcing it through the archetype would mean inventing two sections it has never had and deleting a live CTA — redrawing, which is the one thing a port may not do. It takes the archetype's colours from the exported `DOORWAY_TONE`, so the palette still has exactly one home, and the new guard bans a raw hex there just as loudly.

### 5 · 🚨 A GUARD REPORTED A LOSS THAT NEVER HAPPENED — AND FIVE PAGES HAD ALREADY BEEN BASELINED ON IT

`lint-port-no-lost-controls.mjs` said `/papic` and `/setnayan-ai` "can no longer reach" `/onboarding/wedding` and `/pricing`. **The claim was checked before its regenerate-the-baseline hatch was taken, and it was false.** `HREF_RE` matched only the JSX attribute form `href="…"`; the doorway kit takes its links as DATA (`primary={{ href: '/pricing', … }}`), and an object property is `href:` not `href=`.

The consequence had already happened and nobody had noticed: **the five doorways ported earlier were baselined with `"destinations": []`**. Their links render fine — but the guard's memory of them was gone, so deleting "See pricing" from any of those pages would have passed CI in silence. This is the disease `port-controls.mjs` already documents for `action=` ("a blind spot here gets written down as a DELIBERATE REMOVAL THAT NEVER HAPPENED, and the guard then defends the lie") — the identical hole existed one constant above it.

`HREF_RE` now accepts `[:=]`. Measured, comparing SETS rather than diff lines: **0 destinations lost app-wide, 115 gained.** The three removals visible in the raw diff were sorted-list comma artefacts — a diff line is not a set membership. The only genuine losses are on the two ported routes, and every one is a component name that moved into the kit or into the deleted forks.

### VERIFIED

`tsc --noEmit` clean · **415/415** app unit tests · **all 22** `lint-*.mjs` green · 5/5 mutations caught with before → after counts printed.

SPEC IMPACT: None — no SKU, price, copy, route or schema change. Colour tokens and component structure only.
