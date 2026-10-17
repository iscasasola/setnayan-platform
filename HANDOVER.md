# HANDOVER — rd/event-day-database · started 2026-10-18 ~03:40 PHT by the controller

Owner, 2026-10-18: "stability and request fix? with speed fix? … make sure app will not collapse when a lot of users are
… connecting to the event". Owner approved the order: double records (#6621 LIVE) → polling → DATABASE (this) → page cache.
Audit: ~/Documents/Claude/Projects/controller-2026-10-12/EVENT-DAY-LOAD-AUDIT-2026-10-18.md (lane L4).

PROD FACTS (read-only measurement, 2026-10-18, pg_stat_statements is cumulative): Postgres 17, max_connections 60, tiny data
(guests 171, events 16). Realtime WAL poll >10x all other DB time. Advisors: 302 auth_rls_initplan, 603
multiple_permissive_policies, duplicate index on guests (guests_event_guest_key = guests_event_guest_uniq) and comp_grants.
event_moderators: 3.2M seq scans (helper/RLS hits it every query), no index on user_id. event_members 780k seq vs 104k idx.
count_unread_message_threads(): 14.6k calls · 47 ms mean. A claim/job-gate RPC (args p_job_key, p_min_gap) 280k calls.
app_telemetry_logs is in the supabase_realtime publication (every telemetry insert goes through the WAL poller).
You MAY read prod with SELECT only via the Supabase MCP (project njrupjnvkjkitfctetvi) — never write, never apply.

BUILD (migrations via `pnpm migration:new`, allocate forward; RLS/grants unchanged in meaning; Ugat + exposure + schema-claims
guards green; regenerate baselines with their generators):
1. RLS `auth.uid()` → `(select auth.uid())` (and same for current_setting / helper calls where safe) in the policies of the
   HOT tables: events, event_members, event_moderators, guests, orders, payments, notifications, papic_photos,
   papic_guest_captures, papic_mission_completions, papic_missions, papic_limited_snapshots, papic_seat_day_usage,
   vendor_profiles, event_vendors. Re-create each policy from prod's LIVE definition (pg_policies), changing only the
   wrapping. A db test proves every rewritten policy admits/denies the same rows as before for owner/guest/stranger.
2. Indexes: event_moderators(user_id) + (event_id, user_id) if absent; event_members(user_id) + (event_id, user_id) if
   absent; chat_messages(thread_id, created_at desc) if absent. CREATE INDEX IF NOT EXISTS. (Tables are tiny: plain
   CREATE INDEX is fine inside the pipeline's transaction.)
3. Drop ONE of each duplicate index pair (keep the one a constraint depends on).
4. Hot RPCs: find the callers of count_unread_message_threads and of the p_job_key claim RPC (claim_periodic_job?) in the
   app. Cut how often they are called (e.g. unread badge cached per user ~30 s; periodic-job claims throttled per
   instance before the RPC is even called) — do not change what they answer. Add (select auth.uid()) inside the RPC if it
   re-evaluates per row.
5. app_telemetry_logs and the realtime publication: find who LISTENS to it (grep `.channel(` / postgres_changes on that
   table, admin live log). If nothing listens, remove it from supabase_realtime. If an admin page listens, leave it and
   say so in the PR.
Skip anything whose equivalence you cannot prove; name it in the PR. No UI change. Changelog fragment
changelog.d/rd-event-day-database.md (SPEC IMPACT: None unless a ruling changes).

## BUILDER STATE (updated as I go)
- DONE + pushed: both migrations; tests/db/event-day-policies-admit-the-same-rows.db.test.ts (7/7, sabotaged 3 ways);
  exposure baseline regenerated (37 policy lines); badge debounce via lib/settle-burst.ts +
  lib/the-unread-badge-asks-once-per-burst.test.ts (sabotaged both halves); changelog fragment.
- Prod measured (SELECT-only): replay's 60 policies on the 15 hot tables are byte-identical to prod (md5 match).
- Item 4: claim_periodic_job already pre-throttled per instance (CHECK_THROTTLE_MS), fires from app/page.tsx /
  explore / admin layout only; pg_stat_statements reset 2026-05-12 so 281k = ~1.8k/day. Skipped. Unread RPC 47 ms
  = cold-connection cost (warm <1 ms measured); wrapped auth.uid in the RPC + badge burst debounce. No 30 s cache.
- Item 5: app_telemetry_logs has a live reader (admin/connection-logs-client.tsx postgres_changes). Left as is.
- PR #6625 open (draft, do-not-auto-merge, autoMerge null). Related db tests green locally (47 files). NEXT: CI loop.
