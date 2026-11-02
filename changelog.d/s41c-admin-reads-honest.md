## 2026-09-19 · fix(admin): result-dropped-silently, ADMIN/OPS tier (S41c)

Fourteen ADMIN/OPS sites from S26's both-ends orphan baseline (#5625,
`tier=ADMIN/OPS`, `class=result-dropped-silently`) read a Supabase `{ data,
error }` result and branched on `error` as a bare boolean — the branch
recorded nothing, so a REFUSED read rendered/behaved identically to a
legitimately empty one. All fifteen call sites are now shape-1 fixes (log via
`logQueryError`, no fallback-default behaviour changed):

- `app/admin/compliance/data-sheet/page.tsx` — `countOf(table)` and
  `activeFaceCount()` now log before returning null (the NPC-sheet honest
  render state for `platform_compliance_facts` was already correct and is
  untouched).
- `lib/auto-recap.ts` — `patiktok_render_jobs` read.
- `lib/brand-settings.ts` — `platform_settings` read.
- `lib/daily-email-jobs.ts` — all four idempotency-lock inserts
  (`anniversary_email_log`, `anniversary_headsup_log`,
  `godchild_reminder_log`, `renewal_reminder_log`) now log any lock-insert
  failure whose code is NOT `23505` (the expected "already sent" case stays
  silent, since logging it would just be noise on the mechanism working as
  designed).
- `lib/demand-radar.ts` — `demand_radar_admin` RPC.
- `lib/demo-sessions.ts` — `demo_sessions` insert (every attempt in the
  retry loop, since token collisions are not an expected path).
- `lib/firstlook.ts` — `platform_settings` read.
- `lib/loader-settings.ts` — `platform_settings` read.
- `lib/platform-settings.ts` — both discarded-error call sites
  (`fetchPlatformSettings` main select, `fetchVendorValidateContacts`).
- `lib/telemetry/fault-log.ts` — both the insert and the update (this file
  IS the logging/audit-trail mechanism, so a discarded error here was
  doubly silent).

New test: `lib/s41c-admin-reads-are-honest.test.ts` — 10 tests, functional
(stubbed `SupabaseClient`, asserts `console.error` fired with the error and
the fallback default is unchanged) for the three sites with an injectable
client, source-assertion for the rest (several construct their own
`createAdminClient()`, are `unstable_cache`-wrapped, or — `demand-radar.ts` —
open with `import 'server-only'`, which this repo's plain `tsx --test`
runner cannot resolve at all). Every assertion was sabotage-checked red
locally before finalizing.

Closes out the ADMIN/OPS tier of the S41 `result-dropped-silently` sweep.

SPEC IMPACT: None
