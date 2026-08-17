## 2026-08-17 · fix(guards): the port guard never looked at 41 files — and said nothing about it

`lint-port-no-lost-controls` exists so a design port cannot silently delete a button or a link. Its reach is set by `PRIVATE_SUBDIRS` in `scripts/port-controls.mjs`, which named **two** private-folder conventions — `_components` and `_lib` — while this codebase uses **nine**.

**Measured before the fix, key by key rather than by total:** **41 `_surfaces/*.tsx` files under `app/admin`, and all 41 absent from the baseline.** `/admin/studio` was recorded as `files: [loading.tsx, page.tsx] · destinations: [] · actions: []` while its thirteen surfaces carried thirteen destinations and twenty-six server actions. `/admin/accounts` the same shape.

So for every tab-hub route the guard has never protected anything — and it did **not** cry wolf. It said nothing, which is indistinguishable from a clean pass. Four sessions were porting exactly those files when this was found.

🔑 **A GUARD'S REACH IS SET BY ITS LIST, NOT BY ITS RULES.** Third instance of that shape in one day: the hand-enumerated door list that missed three doors, the `CONVERTED` list that could be silently shortened one line at a time, and this. The rules were all correct each time. **A list that decides what gets checked has to be pinned to something measured, or it narrows without a word.**

### And a destination handed to a shared component is still a destination

`HREF_RE` required the literal token `href`. `PageMasthead` takes `back="/admin/demo-vendors"` and renders the `<Link href={back}>` itself — so the moment a page adopted the shared masthead its back link became invisible. That is worse than a miss: **the sanctioned response to a reported "loss" is to regenerate the baseline**, which would have written the route down as having ZERO destinations and then defended that absence forever. The `ACTION_EXPR_RE` docblock four lines below already warns about exactly this, one prop earlier.

Widened to the four props measured to carry a literal route today: `back` · `backHref` · `returnTo` · `cancelHref`.

### The numbers, and nothing was lost

| | before | after |
|---|---|---|
| destinations guarded | 796 | **849** |
| server actions guarded | 526 | **579** |
| routes | 402 | 402 |

**Absorption checked per route, not by totals: 0 routes gone · 0 destinations lost · 0 actions lost.** Purely additive — this regeneration can only add protection. Gains land where predicted: `/admin/studio` +13 destinations +26 actions, `/admin/accounts` +13 +12, `/admin/pricing` +5 +5, `/admin/settings` +5 +5.

🛑 **A CORRECTION TO MY OWN REASONING, KEPT IN THE SOURCE BECAUSE THE MISTAKE IS THE USEFUL PART.** I added `_actions` believing its 15 files of `'use server'` were "invisible actions". **Measured before and after: adding it changed the action count by ZERO** (579 → 579). Actions are counted where a form USES them, not where they are DEFINED, so an unwalked definition file hides nothing. Correct fact, invented consequence — the same error I made three times earlier today. `_actions` and `_shared` stay in the set because a future destination in them would count, but they are **not load-bearing and nobody should cite them as a fix**.

`_data` (9 files · 0 destinations · 0 `'use server'`), `_styles` and `_fonts` (0 files) are deliberately out, each with the measurement that justifies it.

### The guard on the guard

`port-guard-reach.test.ts` — 3 assertions, all mutation-checked with the occurrence count printed before → after, all RED:

- drop `_surfaces` from the set → `1 → 0`, **2 of 3 fail**
- narrow `HREF_RE` back to `href` only → `1 → 0`, **1 fail**
- a new `_probe` convention appears on disk carrying a link → **1 fail**

It derives the question from the disk: every underscore folder that exists must be **either walked or named with a measured reason for being out**. The second assertion is a positive control — the first is satisfiable by moving every folder into the exclusion list, which would pass while guarding nothing.

⏭ **This is what unblocks PR #4519 (lane D).** Its `lint port keeps every control` failure was a blocking required check, and one of its four reported "losses" was this false positive: a back link handed to `PageMasthead`. With the extractor fixed, that lane can regenerate and absorb only its three genuine component removals.

SPEC IMPACT: None — build tooling and a guard. No product surface, no schema, no migration.
