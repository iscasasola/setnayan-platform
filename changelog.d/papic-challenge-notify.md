## 2026-07-22 · feat(papic-games): notify the couple when a vendor submits a challenge

Gap analysis #6: a booked vendor's pending custom challenge could stall unseen —
its only reveal was the self-hiding approval panel deep in the Papic studio, so a
paid challenge might never reach the couple. This adds the proactive alert.

- **Migration** `20270904548818` — `ALTER TYPE public.notification_type ADD VALUE
  IF NOT EXISTS 'papic_challenge_pending'` (bare, idempotent — matches the other
  notification_type_* migrations).
- **`lib/notifications.ts`** — the union member + the two exhaustive `Record`
  entries (`NOTIFICATION_TYPE_LABEL` = "Photo challenge to approve",
  `NOTIFICATION_TYPE_TONE` = amber action-needed, matching `schedule_suggestion`).
  In-app tray only (not email/push) — same as `schedule_suggestion`.
- **`createVendorChallengeAction`** — on a successful submit, best-effort fan-out
  of `papic_challenge_pending` to the event's couple members (admin client over
  `event_members`, mirroring `suggestScheduleChange`), linking to the Papic studio
  where the approval panel lives. Only reached when the games flag is on (the
  create wrapper no-ops with the flag off, so `res.ok` is false).

SPEC IMPACT: None — closes the §3.6 approval-loop visibility gap noted when Phase
4b deferred the couple notification. `tsc --noEmit` clean.
