## 2026-08-08 · design(#4): the couple's dashboard broke the "gold is never a button" lock

First unit of the Warm Editorial Archive port. Style-only, zero behaviour change.

🚨 **THE SHIPPED PAGE VIOLATED A STANDING LOCK.** The palette lock is explicit —
terracotta `#C24E25` is the **only** action colour and **gold is never a button** —
yet every primary action pill on `/dashboard/[eventId]` was gold-filled, with the
secondaries gold-outlined. Found by the Fable design pass and verified by reading the
component, not the spec.

**Changed (6 sites, all actions):** the decisions-digest CTA pills, the top-priority
task CTA, and the board's per-item action pills — filled → `rgb(var(--color-mulberry))`
with a cream `#FDFBF7` label; outlined → mulberry border + mulberry text.

**Deliberately NOT changed** — gold is correct on both:
- the budget **progress bar** fill (data visualisation, not an action)
- the **"PRIORITY n" badge** (a status label, not an action)

🪤 **TWO DEFECTS IN MY OWN FIRST PASS, caught before commit:**
1. **I wrote a phantom CSS variable.** `var(--color-mulberry-hex)` does not exist —
   the real token is `--color-mulberry: 194 78 37`, an RGB triplet consumed as
   `rgb(var(--color-mulberry))`. Every button would have rendered with **no
   background at all**. Same phantom-identifier class as the phantom column, enum
   value and RPC argument this project has already been bitten by — a CSS variable
   fails just as silently.
2. **An over-broad string replace caught the PRIORITY badge**, because a status label
   and a primary button shared the exact same style string. Restored to gold.

🔑 **The naming trap is why this is easy to get wrong:** the token named
`--color-terracotta` holds **GOLD** (`rgb(169,131,75)` = `#A9834B`); the rust CTA
colour is named `--color-mulberry` (`rgb(194,78,37)` = `#C24E25`). Anyone reaching
for "terracotta" expecting the button colour gets gold — which is plausibly how this
violation happened in the first place.

**Integration checks (per `INTEGRATION_RULES.md`)** — 6 insertions / 6 deletions ·
zero components removed · zero conditionals removed (both primary/secondary ternaries
replaced in place, not collapsed) · **zero non-colour changed lines**.

Typecheck clean · 7085/7085 unit tests · all 12 `lint-*.mjs` clean.

SPEC IMPACT: None — this enforces an existing lock rather than changing one.
