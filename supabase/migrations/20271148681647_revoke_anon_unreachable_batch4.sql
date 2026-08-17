-- ============================================================================
-- THE SECOND LOCK — batch 4 of N. 21 tables no signed-OUT visitor can reach.
--
-- Follows batch 1 (20271145190664, 16) · batch 2 (20271145286482, 17) ·
-- batch 3 (20271147692197, 16). 🟢 NOTHING IS LEAKING: RLS is on for all 384
-- public tables and none of these has a policy that could admit an anonymous
-- reader, so this changes no answer any client receives. What goes is the SPARE
-- KEY under that lock.
--
-- ── MEASURED IN PROD, AFTER BATCH 3 LANDED ─────────────────────────────────
--   384 public tables · RLS on all 384 · anon SELECT on 257 (was 273)
--   155 candidates remain (anon grant · no anon-reaching policy · gates 3+6)
-- 306 → 290 → 273 → 257 → 236 after this. 70 of 180 closed.
--
-- ── THE THIRD GATE-4 REFINEMENT, BECAUSE THE EASY SETS ARE GONE ────────────
-- Batches 1–2 took every table with NO query at all. Batch 3 took every table
-- queried ONLY by the SERVICE ROLE. Both sets are exhausted, so the question had
-- to move again:
--
--     Can a SIGNED-OUT visitor's code path reach this table at all?
--
-- All 21 below are queried exclusively from files inside the three login-gated
-- route trees — `app/dashboard/**` (the couple), `app/vendor-dashboard/**` (the
-- supplier) and their own actions. A signed-out visitor is redirected out before
-- any of it renders, and a signed-IN visitor authenticates as `authenticated`,
-- never `anon`. So an `anon` revoke cannot reach them.
--
-- 🔒 THE REDIRECTS WERE READ, NOT COUNTED. `app/dashboard/layout.tsx`:
-- `if (!user) redirect(loginRedirectPath('/dashboard'))`. `app/admin/layout.tsx`
-- does the same and then `await requireAdmin()`. A grep COUNT of auth-ish words
-- would have "passed" a file full of comments about auth.
--
-- 🚨 AND "BEHIND A LOGIN" IS NOT SUFFICIENT ON ITS OWN — THIS IS THE TRAP THAT
-- ALMOST CARRIED THIS BATCH. A SERVER ACTION is a POST endpoint. The gating
-- LAYOUT NEVER RUNS FOR IT, so a signed-out caller can invoke one directly
-- without the page ever rendering. Every action file behind these 21 was
-- therefore opened and read; all of them establish the caller first:
--   • most call `auth.getUser()` and bail when there is no user;
--   • `seating/walkthrough/actions.ts` and `guests/souvenirs/actions.ts` use
--     `getCurrentUser()` from `lib/auth` instead, then check `event_members`
--     for `couple` / `coordinator` — the souvenirs file even says in a comment
--     that RLS is the security layer and its own check is "the friendly-error
--     layer", which is exactly the right division.
-- ⚠ My first VERIFICATION grep missed `getCurrentUser` and reported those two as
-- unguarded. The original scan was right and the check was too narrow — worth
-- recording, because the instinct "the scan was wrong again" was itself wrong.
--
-- ── WHAT WAS HELD BACK, AND WHY ────────────────────────────────────────────
-- Three candidates that otherwise qualify are DEFERRED to batch 5:
--   `platform_compliance_facts` · `vendor_recommendation_feedback` ·
--   `vendor_review_appeals`
-- They are queried from the ADMIN tree, which is gated by a DIFFERENT guard
-- (`requireAdmin()`), and one of their files —
-- `app/admin/compliance/data-sheet/page.tsx` — is being edited by OPEN PR #4519
-- right now. A migration is judged against the state it LANDS in, so a table
-- whose access path is mid-rewrite is not a table to reason about tonight.
--
-- ── GATES 1·2·3·6 UNCHANGED ────────────────────────────────────────────────
--   1. anon holds privileges      2. no policy can admit anon
--   3. NO column-level grants     6. NOT reachable through an anon-readable
--      (a table REVOKE drops         `security_invoker` view chain (recursive
--       column grants; 6 tables      pg_rewrite/pg_depend walk)
--       here carry 532)
-- 🚨 Gate 6 is why this stays in small batches: such a view reads its base tables
-- with the CALLER'S privileges, so a table nothing in the app names can still
-- carry a public page. Batch 2 nearly emptied the public supplier listing that
-- way, and the failing test named only ONE of the two tables involved.
--
-- 🪤 READ THE COLUMN DEFAULT BEFORE YOU REVOKE — cannot apply here: that trap
-- bites when a revoke removes the app's ability to NAME a column and a
-- privileged DEFAULT fills it in instead. No policy below admits `anon`, so no
-- anon insert reaches any of them.
--
-- 🔍 TWO WERE RE-CHECKED BY HAND because earlier notes claimed a wider reach:
--   • `event_category_build_state` — a note said the couple's marketplace "reads
--     it on every page load". True, and that marketplace is INSIDE the gated
--     tree: exactly two `from()` sites, both in the dashboard action.
--   • `papic_missions` — a guest-facing product, so a guest surface was the
--     worry. All eight `from()` sites are under
--     `app/dashboard/[eventId]/studio/papic/`. Two are client components, which
--     is fine: a client component in a gated tree runs with the signed-in user's
--     own session (`authenticated`), and a signed-out visitor never gets there.
-- ============================================================================

-- couple dashboard — vendors / build state
REVOKE ALL ON public.build_requote_nudges              FROM anon;
REVOKE ALL ON public.event_category_build_state         FROM anon;
REVOKE ALL ON public.event_manual_vendors               FROM anon;
REVOKE ALL ON public.vendor_lock_proposals              FROM anon;

-- couple dashboard — schedule, seating walkthrough, guests, alaala, studio
REVOKE ALL ON public.event_schedule_suggestions         FROM anon;
REVOKE ALL ON public.event_walkthrough_zones            FROM anon;
REVOKE ALL ON public.guest_message_blocks               FROM anon;
REVOKE ALL ON public.guest_souvenir_claims              FROM anon;
REVOKE ALL ON public.kwento_assignments                 FROM anon;
REVOKE ALL ON public.papic_missions                     FROM anon;
REVOKE ALL ON public.patiktok_render_job_clips          FROM anon;
REVOKE ALL ON public.patiktok_source_clips              FROM anon;

-- recommendations — written from the couple studio, read by the supplier
REVOKE ALL ON public.coordinator_feature_recommendations FROM anon;
REVOKE ALL ON public.vendor_feature_recommendations      FROM anon;
REVOKE ALL ON public.vendor_recommendation_optins        FROM anon;

-- supplier dashboard — website, clients, messages, on-the-day, manpower
REVOKE ALL ON public.custom_domains                     FROM anon;
REVOKE ALL ON public.inquiry_outcomes                   FROM anon;
REVOKE ALL ON public.manpower_gigs                      FROM anon;
REVOKE ALL ON public.vendor_client_notes                FROM anon;
REVOKE ALL ON public.vendor_event_access_grants         FROM anon;
REVOKE ALL ON public.vendor_portion_rules               FROM anon;

-- ── HOW TO CONTINUE ────────────────────────────────────────────────────────
-- 70 of 180 closed. The remaining ~110 are queried from files OUTSIDE the gated
-- trees — shared `lib/` helpers with an INJECTED client (the caller picks the
-- privilege, so the file cannot tell you), public routes, and the guest-facing
-- `app/[slug]/**` tree where `anon` is the ordinary case and the grant is
-- genuinely load-bearing. There is no fourth shortcut: from here each table is
-- one reading, and some of them must KEEP the grant.
--
-- Do NOT convert this into `REVOKE … ON ALL TABLES`.
-- 🚨 RE-READ THE LIVE GRANTS IMMEDIATELY BEFORE MERGING — two sessions collided
-- on exactly this on 2026-08-17, one revoking and the other re-granting hours
-- later, both correct in isolation, and neither PR able to show it.
