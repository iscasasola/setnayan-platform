-- ============================================================================
-- THE SECOND LOCK — batch 3 of N. 16 tables reached ONLY by the service role.
--
-- Continues 20271145190664 (batch 1, 16) and 20271145286482 (batch 2, 17).
-- 🟢 NOTHING IS LEAKING. RLS is on for all 384 public tables and none of these
-- has a policy that could ever admit an anonymous reader, so this changes no
-- answer any client receives. What goes is the SPARE KEY under that lock.
--
-- ── MEASURED IN PROD TONIGHT, NOT READ FROM A DOC ──────────────────────────
--   384 public tables · RLS on all 384
--   273 grant `anon` SELECT · 275 grant it something
--   180 of those have NO policy that could admit an anonymous reader
-- 306 → 290 (batch 1) → 273 (batch 2). Re-measured AFTER `3c0e6edab`
-- ("revoke on all THREE rebuilt matviews") landed, because a rebuilt view is a
-- privilege RESET and a count taken before it would have been stale.
--
-- ── WHY THIS BATCH NEEDED A SHARPER GATE 4 ─────────────────────────────────
-- Batches 1 and 2 took every table with NO query at all. That set is EXHAUSTED:
-- all 171 remaining candidates are queried by application code. So "does the app
-- query it?" no longer separates anything, and the honest question became:
--
--     Does any ANON-KEY path query it — or only the service role?
--
-- `lib/supabase/` ships three factories and only one is grant-independent:
--   • admin.ts        `createAdminClient` / `createMoneyWriterClient` → SERVICE ROLE
--   • server.ts       `createClient` → the caller's session, which is ANON when
--                     the visitor is signed out
--   • client.ts       `createClient` → the BROWSER, i.e. the publishable key
--
-- Revoking `anon` cannot affect a service-role query, so a table queried only
-- through `admin.ts` is safe by construction. All 16 below qualify: every file
-- that queries them imports the admin client and imports NEITHER of the other
-- two.
--
-- 🪤 AND THE INJECTED-CLIENT TRAP IS EXCLUDED EXPLICITLY. A `lib/` helper that
-- takes `supabase: SupabaseClient` as a PARAMETER tells you nothing — the caller
-- chooses the privilege level, and this repo has been bitten by exactly that. Any
-- querying file with an injected-client signature was disqualified rather than
-- guessed at.
--
-- ── THE THREE I DID NOT TRUST, AND WHY THEY SURVIVED ───────────────────────
-- The scan is not the verdict. Three looked dangerous and were read by hand:
--   • `promo_free_windows` — named in `lib/sku-catalog.ts`, which feeds PUBLIC
--     pricing. Measured: that mention is a COMMENT; `from('promo_free_windows')`
--     appears there ZERO times.
--   • `demo_sessions` — named in two `'use client'` HOMEPAGE overlays. Both
--     mentions are docblocks; the only write is `app/_actions/plan3d-demo-actions.ts`,
--     which imports `createAdminClient`. A client component calling a server
--     action is not an anon-key query.
--   • `guest_claims` — a guest-facing concept, so an anon path was the
--     expectation. `lib/guest-claim-core.ts` turns out to be PURE logic (name
--     normalisation and match scoring, zero `from(` calls); the real writes are
--     `UPDATE public.guest_claims` inside a SECURITY DEFINER function in
--     migration 20261102000000, which runs as its owner and never consults the
--     caller's grants.
--
-- ── GATES 1·2·3·6 (unchanged, applied in one catalog query) ─────────────────
--   1. `anon` holds privileges          2. no policy can admit `anon`
--   3. NO column-level grants           6. NOT reachable through an
--      (a table-level REVOKE drops         anon-readable `security_invoker`
--       column grants; six tables in       view chain — a recursive
--       this schema carry 532)             pg_rewrite/pg_depend walk
--
-- 🚨 GATE 6 IS WHY THIS GOES IN SMALL BATCHES. A `security_invoker` view reads
-- its base tables WITH THE CALLER'S OWN privileges, so a table nothing in the app
-- names can still be load-bearing for a public page. Batch 2 nearly emptied the
-- public supplier listing that way, and the failing test named only ONE of the
-- two tables involved — tracing the chain found the second, which nothing tests.
--
-- 🪤 READ THE COLUMN DEFAULT BEFORE YOU REVOKE — checked, and it cannot apply
-- here: that trap bites when a revoke removes the app's ability to NAME a column
-- and a privileged DEFAULT fills it in instead (a payout status defaulting to
-- 'approved' would have shipped silent universal auto-approval). No policy on any
-- table below admits `anon`, so no anon insert can be reaching them at all.
--
-- ⚠ All 16 confirmed PRESENT IN THE PGlite REPLAY, so a plain REVOKE is
-- replay-safe and none needs the `to_regclass` guard that batch 1's two
-- prod-only tables required.
-- ============================================================================

-- daily email / reminder jobs — lib/daily-email-jobs.ts (service role)
REVOKE ALL ON public.anniversary_email_log      FROM anon;
REVOKE ALL ON public.anniversary_headsup_log    FROM anon;
REVOKE ALL ON public.godchild_reminder_log      FROM anon;
REVOKE ALL ON public.renewal_reminder_log       FROM anon;

-- homepage demo bookkeeping — written only by a server action (service role)
REVOKE ALL ON public.demo_sessions              FROM anon;

-- Drive copy jobs — lib/drive-copy.ts (service role)
REVOKE ALL ON public.drive_copy_folders         FROM anon;

-- guest seat claims — app-side is PURE logic; writes are a SECURITY DEFINER RPC
REVOKE ALL ON public.guest_claims               FROM anon;

-- promo free windows — admin pricing surface + its action (service role)
REVOKE ALL ON public.promo_free_windows         FROM anon;

-- SEO cron + the admin readout (service role)
REVOKE ALL ON public.seo_health_snapshots       FROM anon;
REVOKE ALL ON public.seo_metrics                FROM anon;

-- Setnayan AI guard log — lib/setnayan-ai-notify.ts (service role)
REVOKE ALL ON public.setnayan_ai_guard_log      FROM anon;

-- social milestones — lib/social/flush.ts (service role)
REVOKE ALL ON public.social_milestones          FROM anon;

-- repost / theft watch — admin surface + its libs (service role)
REVOKE ALL ON public.vendor_image_flags         FROM anon;
REVOKE ALL ON public.vendor_image_hashes        FROM anon;
REVOKE ALL ON public.vendor_qr_media_flags      FROM anon;

-- vendor verification documents — lib/verification-docs-server.ts (service role)
REVOKE ALL ON public.vendor_verifications       FROM anon;

-- ── HOW TO CONTINUE ────────────────────────────────────────────────────────
-- 49 of 180 closed after this batch. The remaining ~131 are queried through
-- `server.ts` (the caller's own session — ANON when signed out) or the BROWSER
-- client, so each one needs the question the scan cannot answer for it: does a
-- SIGNED-OUT visitor's code path actually reach this table, or only a signed-in
-- one? Where the answer is "only signed-in", the revoke is still safe — but that
-- is a per-table reading, not a sweep, because a wrong one turns an RLS-empty
-- result into a permission ERROR on a live page.
--
-- Do NOT convert this into `REVOKE … ON ALL TABLES`: that takes the 532 column
-- grants, the view-backed tables and the reachable tables with it.
-- 🚨 RE-READ THE LIVE GRANTS IMMEDIATELY BEFORE MERGING — two sessions collided
-- on exactly this on 2026-08-17, one revoking and the other re-granting hours
-- later, both correct in isolation, and neither PR able to show it.
