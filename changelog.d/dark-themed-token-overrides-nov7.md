## 2026-11-07 · fix(dark): a dark: override on a themed token flipped it back — 1 fixed, 15 kept with measured reasons, guard added

The sibling of #7377 (ramps), for the THEMED tokens (`cream`, `ink`, `raised`, `ink-on-plate`, `link`, `accent*`,
`surface*`, `sn-*`). These already flip under `html.dark` in `globals.css`, so a `dark:` swap to the opposite
token flips them back.

- **Fixed:** `supplier-answers-form.tsx`'s "Save answers" button (`bg-ink text-cream dark:bg-cream dark:text-ink`).
  In dark its fill was the page's own colour (1.00:1 against the page, 1.12:1 against a card), so the button had
  no shape. With the two `dark:` classes deleted it is a light pill, 17.37:1. Only `dark:` classes were removed,
  so light mode does not change.
- **Kept, in ALLOW with measured contrast (15 classes in 5 files):** the Life-Flash launcher (white words, 16.25:1
  vs 1.04:1), look-sample on the light plate (12.64:1 vs 1.08:1), the bad peek toast (4.90:1 vs 3.54:1), the
  Next card's day state (12.44:1 vs 1.40:1), and the Build cart peek (a dark card on purpose, 15.57:1).
- **Not flipped back, so not flagged:** the 83 `bg-white dark:bg-raised` / `bg-cream dark:bg-raised` pairings,
  `text-white dark:text-cream` on a lightened fill (better in dark: 6.20:1 vs 2.93:1 on mulberry), same-token alpha
  steps (`border-ink/12 dark:border-ink/15`).
- **New guard `apps/web/lib/a-flipping-token-takes-no-flip-back-override.test.ts`:** it reads the tokens from
  `tailwind.config.ts`, their light and dark values from `globals.css` (`:root` / `html.dark`, resolving `var()`
  chains), and flags a `dark:` class on a themed token when its base class in the same string already flips and
  the override's dark value lands back on the base's light side. ALLOW entries must match exactly; DEBT may only
  fall (empty: no flagged file was in an open PR).

SPEC IMPACT: None
