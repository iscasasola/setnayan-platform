## 2026-11-25 · fix(admin): insights, setup and the shell say what is true (final check area 8, batch 10)

- Home: an "Answered on Focus" search row is answered in place in Full mode too (it opened the Work list).
- Admin log: actions read as plain words ("Supplier tier set"), never "vendor" or a table name.
- Insights: each Overview card says "—" or "Couldn't read" for its own failed read; Fastest movers says "not
  computed" for the entity rows and its footnote is true; Operations shows when its numbers are from and labels
  them stale (the view does not refresh), and says a failed read; every comparison names its window ("vs last
  month", "vs the 90 days before", "of previous step"); the Growth CSV writes `unread` and an errors row where a
  read failed, never 0.
- Business: a failed settings read shows every field as "Couldn't read", with every save off (identity, brand
  icon, loading animation). The owner's numbers (Today's lines, real-guests minimum, trust step, Deep Search
  searches) are editable here again.
- Shell: nine pages get their own loading skeleton, and /admin's no longer draws the retired overview. The staging
  kit lists each admin address where the middleware really sends it.
- Fees owed: each supplier under review says why it is listed, and that listing charges nothing.
- Guards: `apps/web/app/admin/insights-setup-and-shell-say-what-is-true.test.ts`,
  `lib/admin/admin-log-words.test.ts`, `lib/admin/growth-csv.test.ts`.
- Findings: A8·C-4 A8·C-11 A8·H-7 A8·H-8 A8·H-9 A8·H-11 A8·H-16 A8·I-3 A8·I-6 A8·L-5 A8·L-9 A8·P-B-3.

SPEC IMPACT: None. No amount, fee, plan content or sign-in rule changes.
