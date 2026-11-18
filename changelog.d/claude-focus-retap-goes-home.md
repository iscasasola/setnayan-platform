## 2026-11-18 · fix(admin): pressing the Focus icon you are already in goes back to Focus home

The top bar's Focus | Full switch ignored a press on the half already selected, so from any admin page
the Focus icon did nothing. It now returns to /admin (Focus home) and scrolls to the top — the app-wide
"re-tap a tab goes to the top" rule.

SPEC IMPACT: None
