-- ============================================================================
-- THE SECOND LOCK — batch 1 of N. 18 tables no code can reach and anon cannot read.
--
-- ── WHAT IS ACTUALLY TRUE TODAY (measured in prod 2026-08-17) ──────────────
--   383 public tables · RLS enabled on ALL 383 · 306 grant `anon` something
--   213 of those have NO POLICY that could ever admit an anonymous reader
--
-- 🟢 NOTHING IS LEAKING. Row-level security is on everywhere and denies every
-- one of these. This migration changes no answer any client receives today.
--
-- 🔴 BUT THE GRANT IS MUCH WIDER THAN "read". On those 213 tables `anon` holds:
--
--        SELECT 212 · DELETE 212 · UPDATE 207 · INSERT 206 · TRUNCATE 213
--
-- That is the Supabase default privilege set, applied to `public` and never
-- narrowed — the same default that makes a NEW table arrive open rather than
-- closed. RLS is the only thing standing between an anonymous holder of the
-- publishable key (which ships in the public JavaScript bundle) and all of it.
-- One policy written too broadly, one `ENABLE ROW LEVEL SECURITY` forgotten on
-- a future table, and there is no second lock underneath.
--
-- ⚠ ONE OF THOSE VERBS IS NOT COVERED BY RLS AT ALL: TRUNCATE ignores row
-- policies entirely. It is not reachable here — PostgREST exposes SELECT,
-- INSERT, UPDATE and DELETE over HTTP and never TRUNCATE — so this is an
-- over-grant rather than a live hole. It is still a grant nobody chose.
--
-- ── WHY THIS BATCH IS SAFE, BY CONSTRUCTION ────────────────────────────────
-- Revoking a TABLE grant cannot disturb the guest-facing product: a guest has
-- no auth.uid(), so every guest write and most guest reads go through
-- SECURITY DEFINER functions, which run as their owner and do not consult
-- these grants at all. The only behaviour a revoke can change is a DIRECT
-- PostgREST read using the anonymous key — and on a table with no anon-reaching
-- policy, that read already returns an empty result.
--
-- The one real risk is therefore narrow and specific: an empty result becomes a
-- PERMISSION ERROR, and calling code that distinguishes the two could show a
-- failure where it used to show nothing. So batch 1 is drawn as tightly as it
-- can be drawn. Every table below satisfies ALL of:
--
--   1. `anon` holds privileges on it                        (there is something to revoke)
--   2. NO policy on it can ever admit `anon`                (verified: 0 policies reaching anon)
--   3. NO column-level grants exist on it                   (verified: 0 — a table-level
--      REVOKE silently drops column grants, and six tables in this schema carry
--      532 of them; none of them are in this batch)
--   4. NO application code performs `from('<table>')` on it (verified by scan)
--   5. The table name appears NOWHERE in application source (verified by scan)
--
-- (4) and (5) together mean there is no query path to change the behaviour of.
-- 175 of the 212 fail (4) and are deliberately NOT touched here; the 19 that
-- pass (4) but fail (5) are held back for the next batch, where each mention
-- gets read first.
--
-- 🪤 READ THE COLUMN DEFAULT BEFORE YOU REVOKE — checked, and it does not
-- apply: that trap bites when a revoke removes the app's ability to NAME a
-- column and a privileged DEFAULT then fills it in (a payout destination that
-- defaulted to 'approved' would have shipped silent universal auto-approval).
-- Nothing here revokes from a role any application code writes as: `anon` has
-- no policy on any of these tables, so no insert can be reaching them now.
--
-- ── HOW TO CONTINUE ────────────────────────────────────────────────────────
-- Same five gates, next 20 tables, one migration each, verified in prod by the
-- object between batches. Do NOT convert this into one sweeping
-- `REVOKE ... ON ALL TABLES` — that is precisely the blunt instrument that
-- would take the column grants and the reachable tables with it.
-- ============================================================================

REVOKE ALL ON public.anon_onboarding_ip_throttle   FROM anon;
REVOKE ALL ON public.couple_briefs                 FROM anon;
REVOKE ALL ON public.cron_job_runs                 FROM anon;
REVOKE ALL ON public.earned_token_vouchers         FROM anon;
REVOKE ALL ON public.guest_qr_rotations            FROM anon;
REVOKE ALL ON public.papic_mission_completions     FROM anon;
REVOKE ALL ON public.seo_suggestions               FROM anon;
REVOKE ALL ON public.supplies_order_line_items     FROM anon;
REVOKE ALL ON public.token_grants_log              FROM anon;
REVOKE ALL ON public.token_rewards_log             FROM anon;
REVOKE ALL ON public.vendor_ad_subscriptions       FROM anon;
REVOKE ALL ON public.vendor_bid_submissions        FROM anon;
REVOKE ALL ON public.vendor_guest_deliveries       FROM anon;
REVOKE ALL ON public.vendor_screen_name_sequences  FROM anon;
REVOKE ALL ON public.vendor_token_boosters         FROM anon;
REVOKE ALL ON public.vendor_tool_bundles           FROM anon;

-- ── TWO OF THE EIGHTEEN EXIST IN PRODUCTION AND IN NO MIGRATION ────────────
-- `event_service_deliveries` and `pioneer_incentive_logs` are real tables in
-- prod, carrying the same wide anon grant as the rest — and NOTHING in
-- supabase/migrations/ creates either one. There is no `CREATE TABLE` for them
-- anywhere; they appear only inside
-- `20271011873973_reconcile_declared_schema_to_production.sql` and
-- `20271115531329_backfill_prod_only_functions_and_triggers.sql`, whose names
-- record that this drift is known and was never finished.
--
-- Found by the PGlite replay refusing a bare REVOKE against a relation it had
-- never been told to create — i.e. the replay is doing its job, and a plain
-- REVOKE list would have failed every db test in the repo while prod was fine.
--
-- 🔑 THE DRIFT IS NOT FIXED HERE, DELIBERATELY. Writing a CREATE TABLE for a
-- table that already exists in prod means guessing its exact shape; getting it
-- wrong is worse than the drift. That is its own task, listed for the owner.
-- What IS done here is close the grant in production — which is the whole point
-- of this migration — while staying replay-safe, so the drift stops being
-- invisible without being papered over.
DO $$
BEGIN
  IF to_regclass('public.event_service_deliveries') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON public.event_service_deliveries FROM anon';
  END IF;
  IF to_regclass('public.pioneer_incentive_logs') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON public.pioneer_incentive_logs FROM anon';
  END IF;
END $$;

-- ============================================================================
-- ALSO CLOSED HERE: the one residual the 2026-08-11 view-grant pass left open.
--
-- `20271132024116_anon_view_grants_narrow.sql` closed the anon holes around the
-- supplier track record and wrote its own remaining gap down, verbatim:
--
--     "RESIDUAL, deliberately left: a matview cannot honour RLS, so any signed
--      -in user could still read any vendor's full count. Closing that needs an
--      RLS-capable wrapper (security-invoker view or a function keyed to the
--      caller's vendor_profile_id), which is a design change, not a grant flip."
--
-- The consequence: subtract the PUBLIC completed-jobs number from this
-- unredacted one and you have the count of a supplier's written-off jobs —
-- comped, bartered, family-rate, fraud-voided. Readable by anybody with an
-- account, and an account is one tap.
--
-- It stays harmless today only by arithmetic: nothing has been written off, and
-- no booked supplier is an account.
--
-- 🔑 THE DESIGN CHANGE TURNS OUT NOT TO BE NEEDED. That note kept the
-- `authenticated` grant because "that is the documented consumer (the vendor's
-- own backend card)" — and in the same breath recorded that its only reader,
-- fetchVendorCompletedEventStats(), has ZERO CALLERS. Re-verified on
-- origin/main 2026-08-17: the only occurrence of that function in the whole
-- repo is its own definition. So the grant is speculative — it is held open for
-- a screen that does not exist, and it discloses every supplier's private
-- figure to every account holder in the meantime.
--
-- Revoking it closes the residual completely and changes nothing observable.
-- When the vendor's own backend card IS built, it needs a reader scoped to the
-- caller — which is what the original note asked for, now with nothing leaking
-- while it waits. lib/vendor-profile.ts carries that instruction at the
-- function itself, so whoever wires it up meets it there rather than meeting a
-- bare permission error with no explanation.
REVOKE ALL ON public.vendor_full_completed_events_stats FROM authenticated;

-- Belt and braces for the NEXT table somebody adds to these families: the
-- default privileges that handed anon these grants in the first place are
-- unchanged and out of scope for this batch. The exposure-surface freeze
-- (supabase/security/exposure-surface.baseline.txt) is what notices if any of
-- the above drifts back open — a widening fails CI, a narrowing does not.
