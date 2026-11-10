## 2026-11-10 · feat(onboarding): the wedding step frame's buttons are the house ActionButton (Build 5 Lane P, slice 4)

Owner, 10 Nov ~18:50: *"the rule or uniform buttons and design templates is not followed yet."* HOUSE_TEMPLATES T19 +
T32 (bottom bar: "main verb filled terracotta").

- **The step frame's bar:** the wedding shell's Continue is `ActionButton tone="brand" main` (the full width of the bar,
  `data-testid="onboarding-continue"`), not the hand-styled `.btn btn-primary`; Skip is `ActionButton` quiet neutral. The
  header's ‹ Back stays the shared `btn-ring` (`first-screen-can-cancel.test.ts`), marked `button-ok`.
- **Where will it be? · About how many guests?** "More places" / "We already have our venue" and the − / + steppers are
  `ActionButton` (quiet, icon-only) — `AreaCard` and `PaxCard` hold no bare `<button>`.
- The onboarding button ratchet falls: `OnboardingShell` 41 → 38, `AreaCard` 2 → 0, `PaxCard` 2 → 0.

Left (next slices): the date step's "Not decided yet" inside its dropdown, `ColoursCard`'s `quick=` pill, the setup
cards' quick answers, the services step, the love/legacy screens' bare buttons; then generic `[type]`, simple, open-shop.

SPEC IMPACT: None — applies T19/T32 as ruled.
