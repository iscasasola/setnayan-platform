## 2026-08-24 · security(db): anon grant sweep batch 7 — the dashboards' fifteen tables give up their public key

Migration `20271162239362_anon_grant_batch7.sql` revokes all `anon` privileges on
15 tables reached only from the login-gated trees or the admin client:
`event_blocked_users`, `event_meaningful_dates`, `event_recaps`,
`event_vendor_3d_plan_unlocks`, `guest_columns`, `invitation_widgets`,
`photo_messages`, `reel_music_tracks`, `vendor_calendar_day_states`,
`vendor_creator_offers`, `vendor_disputes`, `vendor_schedule_pool_categories`,
`vendor_schedule_pools`, `wall_display_sessions`, `wall_feed`.

All six gates re-run against production 2026-08-24, including the
constant-indirection shape a `from('name')` grep cannot see
(`event_vendor_3d_plan_unlocks` is reached only through an exported table-name
constant — every caller passes the admin client). The public wall routes state
the invariant this enforces: "no anon read path to wall_feed". Dry-run in an
explicitly rolled-back prod transaction moved all 15 SELECT true → false.
Guarded forever by `CLOSED_IN_BATCH_7` in
`apps/web/tests/db/anon-table-grants-closed.db.test.ts`.

SPEC IMPACT: None
