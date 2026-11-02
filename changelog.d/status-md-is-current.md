## 2026-09-06 · docs(status): STATUS.md says what is true today

`STATUS.md` is the anchor doc — its own header sends a cold session here first — and it was
directing them at finished work.

- **The "current stream" was closed.** It said *"a failed read must not be rendered as a fact —
  nine confirmed instances remain"*. Re-measured against `origin/main`: the 11-item list is
  complete (#4583 → #4594), and both rows still carrying a `file:line` in the corpus doc are fixed
  (`lib/roles.ts` no longer tells a supplier who has a shop to "Create your shop";
  `lib/communities.ts` binds its count error instead of printing "0 members · 0 events"). A stale
  "what's next" is worse than none: it is confidently actionable.
- **The production figures were re-measured, not copied.** 12 accounts · 5 events · 43 guests ·
  2 shops · 6 orders (4 paid, 2 cancelled) · 14 Papic photos. The SQL that produces them is now
  inline, so the next session re-runs it instead of trusting the line.
- **Events went DOWN, 8 → 5** — recorded as an open question, not resolved as a finding.
- The deltas since 08-19 are stated **with the caveat that they are not a demand signal** — the
  product has not opened its doors. They explain why defects here are found by reading code rather
  than by anyone complaining.

This file carries a warning about having sat 34 days stale and misdirected a session. It was doing
it again, in the same place, for the same reason.

SPEC IMPACT: None.
