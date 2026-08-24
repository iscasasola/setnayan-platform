-- anon_grant_batch6 — the admin desk's twelve tables give up their public key
--
-- ── WHAT THIS IS ────────────────────────────────────────────────────────────
-- Batch 6 of the anon-grant sweep (batches 1–5: 20271145190664, 20271145286482,
-- 20271147692197, 20271148681647, 20271148202591 — 75 tables closed so far).
-- Twelve more tables whose anon SELECT grant nothing anonymous ever uses:
-- every one has RLS enabled with policies that admit ONLY authenticated
-- principals (none names anon or PUBLIC), and every application query against
-- them runs either on the ADMIN client (grant-independent) or on a signed-in
-- caller's session (`authenticated`, untouched by this revoke).
--
-- This batch finally takes the three tables batch 5's notes explicitly held
-- back — platform_compliance_facts, vendor_recommendation_feedback,
-- vendor_review_appeals — which were deferred because one of their files was
-- being edited by a then-open PR. That PR has long merged; re-verified against
-- origin/main (beb9b5942) and the live catalog on 2026-08-24.
--
-- ── THE GATES, EACH RE-RUN IN PROD ON 2026-08-24 ───────────────────────────
--  1. anon holds table-level privileges          — has_table_privilege, all 12 TRUE
--  2. no policy admits anon (or role 0 / PUBLIC) — pg_policy.polroles scan
--  3. no security_invoker view reads them        — only 3 such views exist
--     (vendor_active_ads · vendor_active_tools · vendor_market_stats) and their
--     recursive base set is vendor_ad_subscriptions · vendor_tool_bundles ·
--     vendor_reviews · vendor_profiles · vendor_review_stats — none of these 12.
--  4. no SECURITY INVOKER function executable by anon names them — pg_proc scan,
--     and the scan was PROVED able to match (a trivially-true pattern returned
--     all 90 anon-executable invoker functions; an empty result from a query
--     that cannot match is not a negative result).
--  5. every application query site verified by file: admin surfaces
--     (app/admin/**, lib/admin/queue-counts.ts, lib/erasure/coverage.ts,
--     lib/social/*, lib/vouchers/validate.ts, lib/referrals.ts,
--     lib/creator-analytics.ts) run on the admin client; the two couple-side
--     sites (checkout's redemption insert, the review page's appeal/dispute
--     writes) authenticate before touching the table.
--  6. no DROP/CREATE in this file, so no default privilege is re-applied.
--
-- ── DRY-RUN ─────────────────────────────────────────────────────────────────
-- Executed against production inside a rolled-back transaction on 2026-08-24:
-- all 12 moved SELECT true → false (and INSERT false after), then rolled back.
-- The revoke MOVES THE MEASURED SURFACE — this is not a column-level no-op.
--
-- ⚠ REVOKE IS A POINT-IN-TIME ACT. The paired test
-- apps/web/tests/db/anon-table-grants-closed.db.test.ts (CLOSED_IN_BATCH_6)
-- re-asserts this forever; a later CREATE OR REPLACE or broad GRANT that
-- reopens any of them goes red there.

REVOKE ALL ON public.chat_message_flags FROM anon;
REVOKE ALL ON public.discount_code_eligible_users FROM anon;
REVOKE ALL ON public.discount_code_redemptions FROM anon;
REVOKE ALL ON public.discount_codes FROM anon;
REVOKE ALL ON public.platform_compliance_facts FROM anon;
REVOKE ALL ON public.platform_expenses FROM anon;
REVOKE ALL ON public.social_evergreen_items FROM anon;
REVOKE ALL ON public.social_posts FROM anon;
REVOKE ALL ON public.social_publish_settings FROM anon;
REVOKE ALL ON public.token_redemptions_log FROM anon;
REVOKE ALL ON public.vendor_recommendation_feedback FROM anon;
REVOKE ALL ON public.vendor_review_appeals FROM anon;
