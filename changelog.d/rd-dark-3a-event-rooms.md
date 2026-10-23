## 2026-10-23 · fix(dark): 3a — the event's Home, Guests, Suppliers, Messages and Budget rooms read in dark

Step 3a of `prototypes/dark_mode_rollout_2026-10-22.html`. No prefix added: `/dashboard` covers the whole event
tree and opens with 3c (one prefix rule, no exception list). Light is unchanged (pixel diff 0 on every room).

- 30 dark-contrast records removed (272 → 241, removals only): ink on a white field / button → `dark:bg-raised`;
  white on terracotta / success → the page colour in dark; white on the light-gold rank chip and the inspector
  CTA → `rgb(var(--color-cream))` (white in light, the page in dark); the colour-access danger chip.
- Words that act (`--color-mulberry-700`) were the light-mode #C24E25 in dark — 3.81:1 on the page ("Buy more",
  "8 to invite", "Download as Excel"); dark now #F2A07D (8.5:1). The QR plate, white in both themes, keeps its
  terracotta letter explicitly.
- The Suppliers stylesheets (`shortlist-categories`, `plan-budget-accordion`, `waiting-for-quotes`) leave the
  retired cool dark (#2A2E36 card, #B6B9BE mute, the wine #C99DB0) for the warm set (#232019 · #B3AEA3 · #E5794E).
- `lint-label-on-fill-contrast.mjs` now reads an arbitrary dark hex (`dark:text-[#…]`) instead of judging the
  base class it replaces (sabotage: `dark:text-[#FFFFFF]` on the white plate → red).

SPEC IMPACT: None — implements the approved plan.
