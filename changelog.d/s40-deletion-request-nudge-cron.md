## 2026-09-19 · fix(deletion): a supplier sitting on a deletion ask now gets a reminder

`deletion_request_nudge` has been a registered `NotificationType` + DB enum value
since the deletion handshake shipped (owner 2026-08-21, migration `20271151830396`),
alongside `deletion_request_received` / `_agreed` / `_declined` — all three of which
ARE wired. The nudge never was: a supplier who is asked whether they agree to a
couple removing their celebration, and never answers, got no reminder, leaving the
couple's request permanently blocked on a question nobody prompted anyone to revisit
(S26 orphan sweep, `notice-no-emitter` class, UNCLASSIFIED tier, assigned to S40).

Modelled directly on `lib/lock-request-expiry.ts` (the closest sibling: same
event_vendors handshake shape, a cron-free traffic-driven sweep): new migration
`20271234626790` adds `event_vendors.delete_request_nudged_at`, extends the existing
`guard_event_vendor_delete_handshake()` trigger to protect it, resets it on every
(re-)ask inside `request_event_deletion`, and adds a new `SECURITY DEFINER` RPC
`nudge_stale_deletion_requests(p_days DEFAULT 3, p_limit DEFAULT 200)` that atomically
claims due rows (`FOR UPDATE SKIP LOCKED`) and stamps them so each ask round is
reminded exactly once. Unlike the lock handshake, a deletion ask has **no expiry** —
it stays pending until answered or cancelled — so this ships the reminder half only.

New `lib/deletion-request-nudge.ts` (`runDeletionRequestNudgeSweep` /
`maybeRunDeletionRequestNudge`) notifies the supplier's `vendor_profiles.user_id`.
Mounted on BOTH `app/admin/layout.tsx` and `app/vendor-dashboard/layout.tsx` — same
dual-mount reasoning as the lock-request nudge: production is pre-launch-quiet, and
an admin-only mount would leave a supplier's reminder waiting on somebody opening
`/admin`. Registered in `lib/periodic-job-registry.ts` and both cron-free-jobs guard
tests (`admin-carries-the-cron-free-jobs.test.ts`, `vendor-rail-context.test.ts`).

**3-day window is a placeholder, not an owner ruling** (unlike the lock handshake's
explicit 48-hour figure) — flagged in the migration comment for whoever eventually
sets a real one.

**Exposure baseline:** the new column inherits `anon=SIU authenticated=SIU` from the
table grant (measured — a column-level REVOKE is a documented no-op here per
`20270820292403`'s own note: table-level GRANT dominates unless revoked and
re-granted on every other column). Every sibling handshake column on `event_vendors`
already carries this exact exposure level; this one row extends an already-accepted
pattern. `supabase/security/exposure-surface.baseline.txt` regenerated in this PR —
+1 line, matches its siblings exactly.

Verified: `tests/db/exposure-freeze.db.test.ts`, `schema-drift.db.test.ts`,
`rpc-argument-names.db.test.ts`, `anon-table-grants-closed.db.test.ts`,
`anon-rpc-surface.db.test.ts`, `lib/the-supplier-can-answer.test.ts` — 34/34 pass.
Pure-logic guards (`jobs-close-what-they-claim`, `periodic-job-registry`,
`admin-carries-the-cron-free-jobs`, `vendor-rail-context`) — 66/66 pass.

SPEC IMPACT: None — the notification type already existed; this adds the missing
emit site and its supporting sweep infrastructure.
