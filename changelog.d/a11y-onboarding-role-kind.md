## 2026-06-25 · a11y(onboarding): make the role & kind pickers keyboard/SR-operable

Reliability/a11y sweep finding (HIGH, decision-free). The two earliest mandatory onboarding selections — "What's your role?" and "What kind of wedding?" (`onboarding-shell.tsx` ~3149/3178) — rendered each option as a clickable `<div onClick>` with no role/tabIndex/keyboard handler, so keyboard + screen-reader users were blocked at funnel step 2–3. The sibling service picker (`PickCard`, line 750) is already a real accessible `<button>`, so this was an oversight, not a design choice.

Fix: render each role/kind option as `<button type="button" aria-pressed={selected}>` (keeping the `key`-remount that replays the `.sn-bounce` selection animation, the className, and the `selectRole`/`selectKind` handler). Layout is preserved by a scoped reset `.onbw button.opt{font:inherit;text-align:left;appearance:none}` — it touches ONLY the converted buttons (not the remaining `.opt` divs), and only the UA-default chrome that differs from a `<div>`; the card's box stays owned by `.opt`, and width comes from the `.stack` flex stretch, so the no-scroll layout is unchanged.

Verification: tsc clean; lint clean (the one onboarding-shell warning is pre-existing, unrelated); the no-scroll layout + keyboard (Tab/Enter) to confirm on the CI Vercel preview's role + kind screens. Scoped intentionally to role/kind this pass; the other swept a11y gaps (date cells `.calday`, love-story chips, `.ghost` skips, RefineCard/PCard) are teed up in DECISION_LOG with their per-class resets.

SPEC IMPACT: None.
