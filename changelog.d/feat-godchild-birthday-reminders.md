## 2026-07-12 · feat(reminders): godchild birthday reminders — cron-free, flag-off

Phase 3 of the date-anchor family graph. A ninong/ninang with `reminders_enabled`
+ an email gets a heads-up ~2 weeks before their godchild's birthday (a greeting /
gift nudge). Cron-FREE — `runGodchildBirthdayReminders` runs off public-page
`after()` traffic via `claimPeriodicJob('godchild-birthday-reminder', …)`, same as
the anniversary heads-up. No Vercel cron.

- New migration `20270802538246_godchild_birthday_reminder_rpc_and_log.sql`:
  `godchildren_with_birthday_soon(p_today, p_within)` RPC (next-birthday math,
  Feb-29 safe) + `godchild_reminder_log` per-(godparent, year) idempotency lock
  (admin/service-only RLS).
- `lib/godchild-reminder-emails.ts` — pure, self-contained email for a third-party
  godparent (no account assumed, real RFC 8058 opt-out, no e-gift CTA yet).
- Runner gated behind `dependentPeopleEnabled()` (default OFF) — short-circuits
  before the RPC in prod; the godparents/dependents tables are empty until the DPO
  clears counsel (G1) + flips the flag.

SPEC IMPACT: None (family-graph design already in the corpus —
`Faith_Aware_Person_Graph_2026-07-12.md` + `Family_Life_OS_Master_Build_Plan_2026-07-12.md`;
owner gate in `Family_Graph_Owner_Actions_2026-07-12.md`).
