## 2026-06-25 · a11y(onboarding): keyboard-operable love-story chips + skip links (final a11y unit)

Completes the onboarding a11y cluster from the reliability/a11y sweep (after #2172 role/kind + #2173 date/pcard). The love-story chip selectors (spark anchor, obstacle cue, proposal setting `.sc`; proposal voice `.wa`; magic-fill title `.mf-chip`; tone `.chip`) and the four `.ghost` skip links ("Add it later", "Ours was easy — skip", "Change a line", "Use email instead") were clickable `<span>`/`<div>`s with no keyboard/SR affordance — keyboard users couldn't pick a chip or skip a step.

Each is now a `<button type="button">` (chips carry `aria-pressed` for their selected state; the mf-chip is a fill-suggestion, no pressed state). Scoped resets (`button.<class>`, never touching the same-class non-button elements):
- `.sc`/`.wa`/`.mf-chip` already own display + font-family + box → only `appearance:none`.
- `.chip` sets no font props → `font:inherit` matches the prior `<div>` exactly (selected/locked variants override at higher specificity).
- `.ghost` is a bare text link → clear button chrome + restore `display:block;width:100%`, but leave `font`/`text-align` to `.ghost` (its 13px + center must survive).
The `.ghost` link-wrapper at the sign-in row (a `<div>` holding an `<a>`, no onClick) stays a div — converting it would nest an `<a>` in a `<button>`.

Verification: tsc clean; lint clean (no new). Layout + Tab/Enter to confirm on the CI Vercel preview's love-story + email-capture screens (local preview tooling resolves to main, not this worktree). With this, every swept onboarding a11y gap is closed.

SPEC IMPACT: None.
