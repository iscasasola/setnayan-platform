## 2026-09-19 · fix(kwento): the flash-tier auto-wall now actually logs its audit-trail notice

`kwento_flash_auto_walled` has existed as a `NotificationType` union member and a
`notification_type` enum value since migration `20261227000000` (Kwento Monumental
Upgrade, Flash tier), and its own comment in `lib/notifications.ts` describes it:
"informational coordinator-only count shown in the live console... Logged as a
notification row for the audit trail." Nothing ever emitted it — the intake route
(`app/api/papic/kwento/route.ts`) auto-walls a clean Flash caption via
`wall_approve_caption()` and returned, with no `emitNotification` call in that branch.
Flagged as a `notice-no-emitter` orphan in S26's baseline (`ugat-both-ends.baseline.txt`),
assigned UNCLASSIFIED to S40.

Wired it in, debounced to a 10-minute window like the existing `kwento_story_batch`
pattern (a live reception can auto-wall dozens of clean Flash captures in a few minutes,
and this is an audit-trail notice, not a per-message alert). The debounce reads the
notification rows this notice itself writes (`type` + `related_url` + `created_at`) rather
than a stamp column on `events`: an earlier cut added `events.last_kwento_flash_wall_notify_at`,
which under the events column lockdown would have needed its own `GRANT SELECT` plus an
`events_host` rebuild for a value only the admin client reads — no schema change is needed.
Every Supabase `error` in the new block is read and logged via `logQueryError`; an
unreadable debounce still sends (an extra audit row beats a silently missing one).
Notifies the couple, not the guest — best-effort, wrapped so a notify failure can never
undo the wall approval it follows.

SPEC IMPACT: None — the notification type and its email-allowlist exclusion already
existed; this only adds the missing emit site.
