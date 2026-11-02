## 2026-06-25 · a11y(onboarding): keyboard-operable wedding-date cells + RefineCard/PCard photo cards

Reliability/a11y sweep follow-up (HIGH date-picker + MED photo-cards, decision-free; continues #2172 which did the role/kind pickers). Both were clickable `<div onClick>`s with no keyboard/SR affordance:

- **Date picker** (`onboarding-shell.tsx` calendar grid): each non-empty day is now a `<button type="button">` with native `disabled` (replacing the `onClick=undefined` guard) + `aria-pressed` for the selected/range days (derived from an exact cls-token match — deterministic, no hydration risk). Empty placeholder cells stay non-interactive divs. Scoped reset `.onbw button.calday{font-family:inherit;background:none;padding:0;appearance:none}` — the `.sel`/`.inrange`/`.disabled` variants keep their fills (higher specificity); width is the grid `1fr` track, display/height/border owned by `.calday`.
- **RefineCard / PCard** (`.pcard`): root `<div>` → `<button type="button" aria-pressed={selected}>`. `.pcard` owns its box (border/radius/overflow/bg) + display (flex in grid/carousel contexts) + width (grid/flex parent), so the reset `.onbw button.pcard{font:inherit;text-align:left;appearance:none}` only neutralizes UA chrome.

Verification: tsc clean; lint clean (no new). The no-scroll layout + Tab/Enter to confirm on the CI Vercel preview's date + refinement/AI-team screens (local preview tooling resolves to the main checkout, not this worktree). Remaining swept a11y gaps — love-story chips (`.sc`/`.wa`/`.mf-chip`/`.chip`) + `.ghost` skip links — teed up in DECISION_LOG for the final a11y unit.

SPEC IMPACT: None.
