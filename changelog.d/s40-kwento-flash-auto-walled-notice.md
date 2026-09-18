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

Wired it in, debounced to match the existing `kwento_story_batch` pattern exactly (a
live reception can auto-wall dozens of clean Flash captures in a few minutes, and this
is an audit-trail notice, not a per-message alert): new migration `20271234798804` adds
`events.last_kwento_flash_wall_notify_at`, its own column separate from the flagged-Story
debounce (`last_kwento_notify_at`) so a busy Flash stream can never delay the
more important flagged-Story review nudge. Notifies the couple, not the guest —
best-effort, wrapped so a notify failure can never undo the wall approval it follows.

Verified: `tests/db/schema-drift.db.test.ts` and `tests/db/exposure-freeze.db.test.ts`
both pass against the new migration (7/7 and 6/6).

SPEC IMPACT: None — the notification type and its email-allowlist exclusion already
existed; this only adds the missing emit site.
