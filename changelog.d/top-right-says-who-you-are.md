## 2026-08-17 · fix(shell): the account control in the top bar says who is signed in

Owner, with a zoom of the top-right corner of the signed-in front door: *"what
happened to the top nav?"* The bar was whole — wordmark, search, "+ Create
event", the live bell, the account menu. **The account menu is the part that
looked broken: a box with an arrow in it and nothing else.**

**Measured against the tokens, not guessed.** The avatar circle was the gold
slot at 15% alpha over the cream pill:

| | measured | required |
|---|---|---|
| the circle's shape, vs the pill | **1.17:1** | 3:1 (WCAG 1.4.11) |
| the initial inside it | **4.17:1** | 4.5:1 (WCAG 1.4.3) |

…and the initial is one letter with no name beside it — for this account, `I`,
a single vertical stroke. Nothing was missing from the bar; the only thing
identifying the person was invisible.

🔑 **GOLD COULD NOT PASS AT ANY ALPHA, SO THIS WAS NEVER A "STRONGER TINT" FIX.**
Solid `#A9834B` on cream is **3.37:1**, which is the ceiling every tint of it
sits below. The fill moves to the ink slot — 13.82:1 for the shape and 13.82:1
for the initial — and ink/cream are the pair the dark theme swaps, so both
themes are correct by construction rather than by a second measurement.

**Three changes, all in the trigger pill:**

- the avatar is `bg-ink` / `text-cream` instead of an invisible gold tint;
- the initial comes from the **display name** before the email, matching the
  order the panel header two hundred lines above it already used — a person
  with a real name on their account was being identified by whatever their
  mail provider happens to start with;
- the pill **names the signed-in person in words** from `lg` up, filling the
  slot that `currentEventName` claims on the event / shop / HQ surfaces. That
  leaves the launcher and the front door — the two surfaces where nothing else
  was claiming it — reading `Ice Casasola ⌄` instead of `⌄`.

⚠ **The `lg` gate is a width decision, not a taste one.** The shared bar carries
identity, the search and this cluster on ONE row (the owner struck the second
row down on 2026-07-30) and "+ Create event" beside it is already hidden below
1024 for the same reason. On a phone the avatar is the whole mark — which is
why it had to become visible before the name could be gated at all.

🔒 **The panel header's own pale circle is deliberately untouched.** It sits
beside "Signed in as {name}", so the words identify the person there and the
circle is decoration whose faintness costs nothing. A test asserts that
boundary in both directions, so a future sweep cannot "tidy" the two into one.

🪤 **TWO GUARDS WATCH COLOUR AND NEITHER COULD SEE THIS — the same seam that let
`#9A8F86` live on five public routes.** `lib/palette-lock.test.ts` checks token
DEFINITIONS and the token is correct: the defect was the ALPHA at the call
site. `scripts/lint-label-on-fill-contrast.mjs` checks call sites but, by its
own docblock, judges only pairings where BOTH sides are opaque — an alpha fill
is skipped by design. So `identity-is-visible.test.ts` composites the alpha
itself and asserts the ARITHMETIC: banning `bg-terracotta/15` by name would
pass while the same colour arrived spelled any other way.

🛡 **6 assertions, every one mutation-checked by occurrence count** (gold tint
restored 1→0 · initial back to email-only 1→0 · the name branch deleted 1→0 ·
the `lg` gate dropped 1→0 · the panel circle changed too 1→0 · the gold token
made near-black 1→0), each turning exactly its own test red with the baseline
green before and after. It strips comments before matching, because the
component and the guard both QUOTE the retired class to explain why it is gone.

🪤 **The guard's first cut read the PILL BUTTON's own `bg-cream` as the avatar's
fill** — the button is `rounded-full` too — and reported a defect that was not
there. Each of the three circles in the file is now located by its own anchor;
a file-level match cannot tell them apart.

⚠ **My own first arithmetic said the initial measured 3.90:1. Measured from the
tokens it is 4.17:1** — still under the floor, same conclusion, but the number
in the docblocks is the one the code computes, not the one I did by hand.

SPEC IMPACT: None. No price, SKU, schema, flag or locked decision moves; the
palette tokens are unchanged and only one call site's use of them changes.
