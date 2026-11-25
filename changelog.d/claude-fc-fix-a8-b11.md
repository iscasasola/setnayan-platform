## 2026-11-25 · fix(admin): Insights saves and counts say what happened (final check area 8, batch 11)

- Entity map: a count or table that could not be read shows "—" and "couldn't read", never 0 under "live"
  (orders and billing included).
- Problems › Every trace: a refused Resolve, Ignore or Archive says so and the rows go back to Active (no "Saved").
- The Sentry smoke test says it did not reach the server on a network failure, never "fired ✓".
- Menus: a refused rename, icon, hide, reset or upload returns its reason and writes no audit row; Hide and Reset
  now say what happened.
- Guard: `apps/web/app/admin/insights-h-rows-say-what-happened.test.ts`.
- Findings: A8·H-3 A8·H-6 A8·H-10 A8·H-15 (owner's word: taken from the area 8 fixer's b5/b6; A8·H-1 is in #8337).

SPEC IMPACT: None. No amount, fee, plan content or sign-in rule changes.
