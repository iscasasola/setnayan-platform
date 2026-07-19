## 2026-06-22 · fix(onboarding): hide the "building" mirror ribbon on desktop (no-scroll budget)

Owner 2026-06-22: "make sure all onboarding is fit on screen… this rule should apply for all" +
agreed to "trim it on the question steps to win the space back."

The accreting "your website is building" mirror ribbon (`.mirror`, the `A&B · names · type · pax · …`
chip that grows a tag per answer from the `name` step on) sits in the top chrome and eats ~70px of
every step's vertical budget — the single biggest reason bottom controls (search / Near me / sliders)
get pushed below the fold on a laptop. On desktop the two-pane layout already conveys progress, so
the ribbon is hidden ≥1024px. Mobile (<1024) keeps it (the locked phone design).

Verified at 1366×768: the experience-quiz screens now fit with **0 overflow**. This reclaims the ~70px
across every step.

SPEC IMPACT None (desktop-only chrome trim for the no-scroll rule).
