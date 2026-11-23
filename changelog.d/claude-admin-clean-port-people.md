## 2026-11-19 · refactor(admin): clean port 3 of 6 — People (verification-docs · supplier partnerships · supplier recommendations)

Moved three People screens onto the clean admin template, following the Money drawing the owner approved on 19 Nov (DECISION_LOG, specs `3745f051`). This only moves things around: the reads, server actions, posted fields and copy are all unchanged. Every lede and blurb now sits, word for word, behind an ⓘ on its section. Sections, rows, numbers frames and empty or failed lines use the template parts, and the buttons use `actionButtonClass`. All three pages now score 0 on `lib/template-score.ts`. The template-score and no-card baselines were regenerated and only lowered.

Held for now, because open PRs edit them: users/[userId], vendors/[id] (with edit, plan, team and renewal-record), and verify.

SPEC IMPACT: None. This applies the approved admin clean-template drawing; DECISION_LOG already records it.
