## 2026-06-22 · feat(onboarding): clean question+answer screens (nuggets removed) + true two-pane desktop canvas

Two owner asks on the wedding onboarding (`/onboarding/wedding`). All layout work is desktop ≥1024px only — mobile + tablet (<1024) stay byte-for-byte the locked phone prototype (`onboarding.css` untouched).

**1. Clear question, clear answer — no nuggets, no side-notes.** Owner: "remove all the nuggets … text should be what they only need. no side notes or anything. clear question. clear answer." Removed every `.sub` explanatory line (31) + `.note`/`.note mul` nugget box (6) in `onboarding-shell.tsx`, the date "why-this-date" nugget in the calendar, and the per-city nuggets in `location-step.tsx`. Kept eyebrows, question headings, and the answer options (titles + descriptions). The one load-bearing instruction ("pick up to 2 areas") is folded into the location question heading, not re-added as a side-note. Dead code that only fed the removed displays was pruned. Each onboarding step still captures a stored signal for the app + Setnayan AI (owner rule 2026-06-22) — no step is decorative.

**2. True two-pane desktop (not "a mobile version with a static left side").** Owner: "the desktop version should not be just a mobile version with a static left side … maximize the capabilities of the desktop view." Per the 2026-06-21 responsive ruleset, onboarding's desktop model is sanctioned as "purely additive enrichment" — but the live aside was a dead, aria-hidden brand block (the forbidden static rail). Replaced it in `onboarding-desktop.css`, all behind `@media (min-width:1024px)`:
- **Un-pin the phone** → a full-width editorial sheet (`width: min(1180px, calc(100vw-96px))`). ⚠ Deliberately crosses the 2026-06-02 "phone frame never restyled" lock — DESKTOP ONLY, mobile untouched, owner-approved 2026-06-22.
- **Opt-in `.onb-twopane` grid** (imagery/question LEFT · answer cards RIGHT, `minmax(0,1fr) minmax(0,0.82fr)`) on the 10 question screens (role/kind/faith + 5 experience axes + 2 dials). Single-column-wide for control/editorial screens (welcome/date/region/pax/budget/find/reveal/congrats/…).
- Editorial type + hero min-heights, `:focus-visible` rings on `.opt`/`.chip`, retargeted the short-desktop (`max-height:940px`) scroll fallback.
- **Retired the dead aside** (`desktop-aside.tsx` deleted; shell stops rendering `OnboardingDesktopAside`).

Verified: `tsc --noEmit` 0, `next lint` 0 new, `next build` ✓. Browser-verified at 1440px (two-pane grid 616+480px, imagery-left / answers-right, clean) and 390px (locked single-column phone unchanged). Note: the experience flow is live behind `NEXT_PUBLIC_EXPERIENCE_QUIZ_ENABLED` (true in prod since 2026-06-21).

SPEC IMPACT: iter 0016 (onboarding / Setnayan AI) — onboarding screens are now clean question+answer (no nuggets/side-notes); desktop ≥1024 renders a true two-pane editorial canvas while mobile/tablet stay the locked phone port. → DECISION_LOG row.
