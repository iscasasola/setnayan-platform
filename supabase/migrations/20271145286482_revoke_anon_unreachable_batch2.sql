-- ============================================================================
-- THE SECOND LOCK — batch 2 of N. 17 tables no code can reach and anon cannot read.
--
-- Continues 20271145190664 (batch 1, 16 tables). 🟢 NOTHING IS LEAKING: RLS is
-- enabled on every public table and none of these has a policy that could admit
-- an anonymous reader, so this changes no answer any client receives today.
-- What it removes is the SPARE KEY sitting under that lock — the Supabase
-- default privilege set, applied to `public` and never narrowed.
--
-- ── THE SIX GATES, ALL APPLIED IN THIS ORDER ────────────────────────────────
-- Re-derived against the live catalog and `origin/main` today; batch 1's list
-- was NOT reused, because grants and code both move.
--
--   1. `anon` holds privileges on it                    → 188 candidates
--   2. NO policy on it can ever admit `anon`                (in the same query)
--   3. NO column-level grants anywhere on the table         (in the same query)
--   6. NOT reachable by anon through a `security_invoker` view chain
--      (recursive walk of pg_rewrite/pg_depend from every anon-readable
--       invoker view — see below)
--   4. NO application code queries it: no `from('<table>')`, AND no
--      `from(CONST)` where a module declares `const CONST = '<table>'`
--   5. The table name appears nowhere in application source, WORD-BOUNDED
--
-- 171 of the 188 fail gate 4 and are untouched. 15 failed gate 5 and were each
-- READ before inclusion (below). Two passed outright.
--
-- ── WHY GATE 6 EXISTS (batch 1 nearly shipped a broken marketplace) ─────────
-- A `security_invoker` view runs with the CALLER'S privileges on its base
-- tables, so anon reading such a view needs the grant on everything underneath
-- — even though no application code names that table, which is exactly why a
-- source scan calls it safe. In batch 1 that would have emptied the public
-- supplier listing for every signed-out visitor
-- (vendor_market_stats → vendor_active_ads → vendor_ad_subscriptions), and the
-- test suite named only ONE of the two tables involved. A matview or a DEFINER
-- view does NOT count: those run as their owner and ignore the caller's grants.
--
-- ── TWO CORRECTIONS TO BATCH 1'S OWN METHOD, MADE HERE ──────────────────────
-- 🪤 GATE 5 USED A BARE SUBSTRING IN BATCH 1. `render_jobs` looked queried 13
-- times because it is a substring of `patiktok_render_jobs`. That is wrong in
-- the CONSERVATIVE direction — it only ever shrank the batch — but it made the
-- shortlist untrustworthy. Word-bounded here.
-- 🪤 GATE 4 NOW RESOLVES A TABLE NAME HELD IN A CONSTANT. `from(TABLE)` where
-- `const TABLE = '…'` is a real pattern in this repo (18 call sites) and a
-- literal-only scan is blind to it — the same blind spot that made the switches
-- guard accuse a working screen (PR #4490).
--
-- ── THE 15 THAT MENTION THEIR NAME: WHAT THE MENTIONS ACTUALLY ARE ──────────
-- Read individually, because "mentioned" is not "queried" and a promise to read
-- them was made in batch 1:
--
--   • RA 10173 REGISTRIES — `lib/erasure/coverage.ts`,
--     `lib/export-coverage-guardrail.test.ts`, `lib/data-subject-register.ts`
--     list table NAMES for erasure/export coverage. Server-side, service-role.
--     (vendor_2307_filings · vendor_contract_signatures ·
--      vendor_member_token_wallets · vendor_release_history · supplies_orders ·
--      seating_editor_locks)
--   • FUTURE-PR COMMENTS — the supplies marketplace names its schema in
--     comments describing work not yet built ("PR 4 ships … integration").
--     (supplier_vendor_skus · supplier_vendor_sku_pricing · supplies_orders)
--   • COMMENTS EXPLAINING WHY THE TABLE IS *NOT* READ — `booking_fee_ledger`
--     appears three times saying the count comes from `event_vendors`
--     "NOT booking_fee_ledger". `render_jobs` is named in `thank-you-video.ts`
--     as "❌ PHANTOM — the server queue".
--   • FK-SURFACE AND METERING TESTS which query the tables directly through the
--     replay, not through an anon client.
--     (bespoke_monogram_generations · concierge_unanswered_questions)
--
-- 🔑 FOUR OF THEM ARE REACHED ONLY THROUGH `SECURITY DEFINER` FUNCTIONS, WHICH
-- IGNORE THE CALLER'S TABLE GRANTS ENTIRELY — verified in prod by reading
-- `pg_proc.prosecdef`, not inferred:
--   rate_limit_hits         → check_rate_limit (definer; anon CANNOT even execute it)
--   seating_editor_locks    → acquire / refresh / release / assert (all definer)
--   papic_event_pool_usage  → papic_reserve_* / papic_release_* (all definer)
--   papic_seat_day_usage    → the same metering family (all definer)
-- `lib/ugat/graph.ts` says of the second: "LOOKS DEAD AND IS FULLY LIVE. A grep
-- for the table name finds only tests … It was nearly deleted on the strength
-- of that grep." Which is the point: the grep is not the access path.
--
-- 🪤 AND `rate_limit_hits` HAS NO `CREATE TABLE` IN ANY MIGRATION — because it
-- is `CREATE UNLOGGED TABLE`. My declaration check was too narrow, not the
-- schema drifting; `tests/db/schema-drift.db.test.ts` had already written that
-- exact false positive down. All 17 were then confirmed present in the PGlite
-- replay directly, so a plain REVOKE is replay-safe and none needs the
-- `to_regclass` guard batch 1's two prod-only tables required.
--
-- 🪤 READ THE COLUMN DEFAULT BEFORE YOU REVOKE — checked, and it cannot apply:
-- that trap bites when a revoke removes the app's ability to NAME a column and a
-- privileged DEFAULT fills it in instead. No policy on any table here admits
-- `anon`, so no anon insert can be reaching them now, and nothing writes as
-- `anon` to lose a column from.
-- ============================================================================

REVOKE ALL ON public.bespoke_monogram_generations   FROM anon;
REVOKE ALL ON public.booking_fee_ledger             FROM anon;
REVOKE ALL ON public.concierge_unanswered_questions FROM anon;
REVOKE ALL ON public.demand_radar_rollups           FROM anon;
REVOKE ALL ON public.market_funnel_bands            FROM anon;
REVOKE ALL ON public.papic_event_pool_usage         FROM anon;
REVOKE ALL ON public.papic_seat_day_usage           FROM anon;
REVOKE ALL ON public.rate_limit_hits                FROM anon;
REVOKE ALL ON public.render_jobs                    FROM anon;
REVOKE ALL ON public.seating_editor_locks           FROM anon;
REVOKE ALL ON public.supplier_vendor_sku_pricing    FROM anon;
REVOKE ALL ON public.supplier_vendor_skus           FROM anon;
REVOKE ALL ON public.supplies_orders                FROM anon;
REVOKE ALL ON public.vendor_2307_filings            FROM anon;
REVOKE ALL ON public.vendor_contract_signatures     FROM anon;
REVOKE ALL ON public.vendor_member_token_wallets    FROM anon;
REVOKE ALL ON public.vendor_release_history         FROM anon;

-- ── HOW TO CONTINUE ────────────────────────────────────────────────────────
-- 33 of 213 closed after this batch. The remaining ~180 are dominated by gate-4
-- failures — tables the app genuinely queries — so the next batch is NOT another
-- easy sweep: each one needs the question "does any ANON-key path read this, or
-- only a signed-in / service-role one?", and a revoke there turns an RLS-empty
-- result into a permission ERROR for whatever calls it.
--
-- Do NOT convert this into `REVOKE … ON ALL TABLES`: that takes the 532 column
-- grants, the view-backed tables and the reachable tables with it.
-- 🚨 RE-READ THE LIVE GRANTS IMMEDIATELY BEFORE MERGING. Two sessions collided
-- on exactly this on 2026-08-17 — one revoked a grant, another re-granted it
-- hours later, both correct in isolation, and neither PR could show it.
