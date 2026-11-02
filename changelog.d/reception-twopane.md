## 2026-06-22 · fix(onboarding): reception (venue-setting) → two-pane on desktop (no-scroll)

Owner 2026-06-22 (continuing the onboarding no-scroll pass): the `reception` step — the RefineStep
"What setting do you love?" — overflowed a laptop by ~400px. Its tall 4:3 hero photo stacks on top
of the option carousel (~700px total), far over the desktop sheet.

The RefineStep already uses the standard `.viewzone` (hero + headline) + `.tapzone` (carousel)
skeleton, so the fix is the same two-pane move used across onboarding, scoped to
`#screen-reception-setting` (the other RefineStep uses are dropped in the flag-on flow). On desktop
(`onboarding-desktop.css`, ≥1024px) the `.prefstep` becomes a 2-column grid — the hero + headline
fill the LEFT column, the option carousel sits on the RIGHT — overriding the `.prefstep` 720px cap
and the `.refine-hero` min-height. CSS only; no markup change. Mobile (<1024) is untouched (keeps the
locked single-column RefineStep).

Browser-verified at **1366×768** (two-pane, hero left + carousel right, overflow 2px, no scroll) and
**390×844** (mobile single-column unchanged — `prefstep` stays flex, 0 overflow, carousel + Continue
visible).

SPEC IMPACT iter 0016 onboarding (desktop layout only).
