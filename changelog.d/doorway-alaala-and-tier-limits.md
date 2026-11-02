## 2026-08-13 · fix(marketing,vendors): four defects design#6 introduced, found by an adversarial pass over its own two PRs

design#6 shipped as #4417 + #4419. An adversarial review of those two diffs — five lenses, every candidate attacked by two independent skeptics — surfaced four regressions, **all of them introduced by that work**. Each was re-verified by hand against `origin/main` and the live site before being touched.

### 1 · 🚨 `/alaala` BROKE THE RULE THE SAME COMMIT WROTE DOWN

The port changed the pillar-card hover from `hover:bg-white/80` to `hover:bg-[var(--m-paper-2)]`. That card's eyebrow is `text-[var(--m-orange-2)]`. **Gold on `--m-paper-2` is 4.42:1 — below AA** — so a card that passed at rest failed the moment a visitor pointed at it, on a live public page.

`_doorway.tsx` states that exact number in a docblock written *in the same commit*: *"gold `--m-orange-2` clears AA on `--m-paper` (4.79:1) and FAILS on `--m-paper-2` (4.42:1)."*

🔑 **GOLD HAS 0.29 OF HEADROOM ON CREAM, SO ANY TINT UNDER IT FAILS** — including the kit's own `hover:bg-[var(--m-ink)]/[0.04]`, measured at **4.47:1**. There is no darker surface that works. A hover under gold must move the **border or the shadow**, never the fill, which is what it now does.

### 2 · 🚨 A DOCBLOCK DESCRIBED A MECHANISM THAT DID NOT EXIST

`/alaala`'s header claimed *"It takes the archetype's COLOURS from `DOORWAY_TONE`… so the palette still has exactly one home."* **There was no import.** The colours had been swapped by hand, one string at a time, and the sentence asserting otherwise was the only thing holding the claim up.

That is this repo's oldest lesson — *a sentence is not a mechanism* — committed while writing about it. `/alaala` now genuinely imports `DOORWAY_TONE` and uses it in **11** places, so the docblock is true by construction and a hand-typed colour there is caught.

### 3 · 🚨 THE PUBLIC `/vendors` PAGE PRINTED THE WORD `Infinity`

The Enterprise card read:

> Service listings / category&nbsp;&nbsp;&nbsp;5 → **Infinity**

`TIER_CAPS.enterprise.servicesPerLeaf` is the JavaScript value `Infinity`, and three of the seven limit rows interpolated the cap directly. `String(Infinity)` is a valid string, so nothing threw, nothing logged, typecheck was clean. **The four rows that DID handle it are what hid how easy the other three were to miss** — the fix is one formatter, not seven correct authors.

### 4 · A FIELD WITH ZERO READERS, SO TWO SURFACES QUOTED DIFFERENT PRICES

`aiHasSignupPrice` was added, derived correctly and unit-tested — and **nothing consumed it**. So `/pricing` led with the ₱1,499 sign-up price while the nav "Prices" popup still showed only ₱2,499. The same visitor was quoted two different prices for one product depending on which surface they opened.

🔑 **A field with no readers is a gate with no handle** — the fifth time this repo has hit that shape. Deriving the right value is half the job; something has to ask for it.

### THE GUARDS — AND THE ONE THAT REPRODUCED THE BUG IT WAS WRITTEN TO CATCH

`doorway-palette.test.ts` could not see `/alaala` at all: its pairing table derives surfaces from `DOORWAY_TONE` and the kit's own zebra, which is strictly stronger *for the seven pages that mount the kit* and blind to the one that does not. It now scans every doorway's own JSX including `hover:` variants.

🪤 **Its first cut skipped ALPHA fills — the exact blind spot that let the original defect through.** `lint-label-on-fill-contrast.mjs` declines alpha pairings because the parent is unknown; this guard was written to close that gap and reproduced it, letting `hover:bg-[var(--m-ink)]/[0.04]` sail past. Measured: the mutation landed (occurrences 2 → 3) and the test stayed **green**. Alphas are now composited against the cream page, which is a *known* parent.

🪤 **And the fix for that immediately cried wolf.** Asking "does this file render gold anywhere?" flagged the kit's `SECONDARY_CTA` — a button whose label is ink — because a gold eyebrow sits 200 lines away. That is the file-level-match defect this repo has already paid for, and a guard that cries wolf teaches you to skim past the one time it is right. Scoped to the surrounding block instead.

`vendor-tier-limits.test.ts` is new: it asserts the **rendered strings** over every tier × every limit, not the presence of a `Number.isFinite` call, and separately pins that the component still routes every row through the one formatter — plus a check that the table still *contains* infinities, so the guard cannot quietly become decoration.

### VERIFIED

`tsc --noEmit` clean · **7,953/7,953** unit tests · **all 22** `lint-*.mjs` green · **5/5 mutations caught**, each restoring the exact defect that shipped and each verified to have landed by occurrence count.

SPEC IMPACT: None — no price, SKU or schema change. Corrects four defects introduced by #4417 / #4419.
