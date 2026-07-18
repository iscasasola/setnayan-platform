## 2026-07-12 · feat(reminders): first-anniversary heads-up — CRON-FREE (planning-timing)

The proactive nudge the lifecycle research valued most: ~6 weeks BEFORE a couple's **1st wedding anniversary**, a warm "your first anniversary is coming up — plan something" email, linking to their Year view. The natural Membership touch, and it means they never miss the moment.

**Cron-FREE (owner-locked strategy):** runs inside `runDailyEmailJobs` via `claimPeriodicJob('anniversary-headsup', DAILY_GAP_MS)`, driven by public-page `after()` traffic — no Vercel cron.

- **Reuses the existing RPC** — `couples_with_anniversary_today(today + 42 days)` filtered to `years_ago === 1` is exactly the couples whose 1st anniversary is 6 weeks out. No new candidate RPC.
- **Migration `20270801712902`** — `anniversary_headsup_log` (event_id, anniversary_year PK), a SEPARATE idempotency lock from the day-of `anniversary_email_log` so the heads-up and the day-of email can't collide. RLS admin-only, mirrors the existing log.
- **`lib/anniversary-emails.ts`** — `buildAnniversaryHeadsupEmail` (pure, forward-looking copy + RFC 8058 unsubscribe).
- **`lib/anniversary-dates.ts`** — pure `addDaysToIso` (Manila calendar), 2 unit tests; extracted so it's testable outside the `server-only` job module.
- **`lib/daily-email-jobs.ts`** — `runAnniversaryHeadsup()` (lock-first, send, release-on-failure — same shape as the day-of digest) + wired into the orchestrator.

Own-data only (the couple's wedding date) — zero PII beyond what the day-of digest already reads. Silver/golden heads-ups + the full lead-time ladder for dependent milestones stay Phase-3 (need the dependent layer).

SPEC IMPACT: implements the master plan's Phase-1 planning-timing reminder (first-anniversary), cron-free per the locked strategy.
