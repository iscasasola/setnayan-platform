## 2026-11-02 · fix(rls): a Limited coordinator — and a limited helper — cannot write through PostgREST

Event-dashboard audit 2026-11-02 #19, the database half (the server-action half is #7179). Migration `20271302707661_limited_coordinator_is_read_only_at_the_database.sql`.

- `public.is_limited_helper(event_id)` — the predicate of every RESTRICTIVE `lh_ro_*` write refusal and of the server-action gate — also answers TRUE for a live seat the hosts set to Limited (`permissions_json.access_level = 'limited'`, owner 2026-10-29). Every existing lh_ro table (20) and the area-aware ones now refuse her; no policy rewritten.
- The same `lh_ro_*` RESTRICTIVE trio on 13 tables whose write policies admitted a writer by `current_event_ids()` / any accepted seat / `current_moderator_event_ids()` without asking the level (a 'viewer' helper could write there too): coordinator_feature_recommendations · event_category_decisions (vendors area) · event_egift_methods · event_gift_records · event_manual_vendors (vendors area) · event_sponsors · event_wish_items · event_site_drafts · kwento_assignments · patiktok_source_clips · patiktok_render_job_clips (via its job) · proposal_amendments and proposal_amendment_items (vendors area + the booked supplier's own arm).
- Guard: `tests/db/limited-coordinator-is-read-only.db.test.ts` — per table, a Limited coordinator and a limited helper are refused INSERT / UPDATE / DELETE; the host, a Full-access coordinator and an unasked hired planner (the control) succeed; areas set to Edit open. All 15 tests fail with the migration removed.
- Regenerated `supabase/security/exposure-surface.baseline.txt` (32 added RESTRICTIVE policies — narrowing only).

SPEC IMPACT: None — enforces the owner's 2026-10-29 Limited ruling at the database. Not touched on purpose: `event_day_requests` (its coordinator arm is the booked supplier proposing a request the hosts approve).
