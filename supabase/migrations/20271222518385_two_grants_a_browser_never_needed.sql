-- two_grants_a_browser_never_needed
-- ============================================================================
-- TWO PRIVILEGES NO BROWSER PATH USES, TAKEN BACK. (N5 · part D — hygiene.)
--
-- 1 · TRUNCATE on public.chat_threads (found by N4, #5435).
--     `anon` and `authenticated` hold TABLE-level TRUNCATE on the conversations
--     table (production, read-only, 2026-09-11 — the stock GRANT ALL). RLS is
--     NEVER consulted for TRUNCATE. Not reachable through PostgREST (it has no
--     TRUNCATE verb) — the realistic path is a future SECURITY INVOKER function
--     a browser can call. No app path truncates it; the cost of removing is zero.
--     (The same stock grant sits on 347 public tables for `authenticated` and
--     197 for `anon`. This migration takes it off the one table it was asked
--     for; a sweep is a separate, reviewable change — see the PR.)
--
-- 2 · SELECT on public.vendor_profiles.next_renewal_due_at for `authenticated`
--     (found by L3, #5433). The column now means "the day the Verified badge
--     needs fresh papers", and approval writes one year while a vouch writes
--     182 days — so any signed-in account could read, for every verified shop,
--     whether it was vouched for or approved on papers, and when its badge
--     lapses. That is the admin's knowledge, not the public's.
--     `authenticated` holds only COLUMN-level SELECT on this table since
--     20271217955839 (no table-level grant), so a column revoke is the fence,
--     not inert — asserted below. `anon` never held it.
--
--     EVERY READER, AND WHY IT STILL WORKS (grepped: every select/filter/order
--     naming the column in apps/web):
--       the marketplace's badge (explore/page.tsx) ........ service role
--       the admin verification desk + approve action ...... service role
--       the badge-deadline sweep (lib/verified-badge-sweep) service role
--       the RA 10173 export (the shop's own record) ........ service role
--       the shop itself ........ public.vendor_profiles_self (security_invoker
--                                = false — reads as the view's owner; unchanged)
--       guard_vendor_profiles_entitlement reads NEW/OLD only (no privilege).
--     No view or policy that runs as the caller names the column (production).
--     ⚠ For whoever routes the remaining badge renders through the one
--     predicate (L3's open follow-up): read the deadline on the service role or
--     through a definer view — a session-client select naming it is now refused.
--
-- The shop's own UPDATE privilege on the column is NOT touched here — the
-- entitlement guard (20271221359289) already refuses a shop moving it.
--
-- IDEMPOTENT: REVOKE is a no-op when the privilege is already absent.
-- REVERSIBLE: GRANT TRUNCATE ON public.chat_threads TO anon, authenticated;
--             GRANT SELECT (next_renewal_due_at) ON public.vendor_profiles TO authenticated;
-- ============================================================================

BEGIN;

REVOKE TRUNCATE ON TABLE public.chat_threads FROM PUBLIC, anon, authenticated;

REVOKE SELECT (next_renewal_due_at) ON public.vendor_profiles FROM PUBLIC, anon, authenticated;

-- ── POST-CONDITIONS ────────────────────────────────────────────────────────
DO $$
BEGIN
  -- 1 · no browser role can TRUNCATE the conversations table.
  IF has_table_privilege('anon', 'public.chat_threads', 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.chat_threads', 'TRUNCATE') THEN
    RAISE EXCEPTION 'POST-CONDITION 1 FAILED: a browser role can still TRUNCATE public.chat_threads';
  END IF;
  -- 1b · …and nothing else about the table's browser grants moved.
  IF NOT has_table_privilege('authenticated', 'public.chat_threads', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.chat_threads', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'public.chat_threads', 'UPDATE') THEN
    RAISE EXCEPTION 'POST-CONDITION 1b FAILED: the TRUNCATE revoke took another privilege with it';
  END IF;

  -- 2 · the EFFECTIVE privilege is gone (has_column_privilege is true while a
  --     table-level SELECT stands, so this also proves the revoke is not inert).
  IF has_column_privilege('authenticated', 'public.vendor_profiles', 'next_renewal_due_at', 'SELECT')
     OR has_column_privilege('anon', 'public.vendor_profiles', 'next_renewal_due_at', 'SELECT') THEN
    RAISE EXCEPTION 'POST-CONDITION 2 FAILED: a browser role can still SELECT vendor_profiles.next_renewal_due_at';
  END IF;
  -- 2b · the columns a signed-in caller really reads are still readable.
  IF NOT has_column_privilege('authenticated', 'public.vendor_profiles', 'business_name', 'SELECT')
     OR NOT has_column_privilege('authenticated', 'public.vendor_profiles', 'verification_state', 'SELECT')
     OR NOT has_column_privilege('authenticated', 'public.vendor_profiles', 'last_verified_at', 'SELECT') THEN
    RAISE EXCEPTION 'POST-CONDITION 2b FAILED: the revoke took a column the app reads';
  END IF;
  -- 2c · the shop still reads its own deadline through its definer view.
  IF NOT has_table_privilege('authenticated', 'public.vendor_profiles_self', 'SELECT')
     OR NOT EXISTS (
       SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'vendor_profiles_self'
          AND column_name = 'next_renewal_due_at')
     OR EXISTS (
       SELECT 1 FROM pg_class c
        WHERE c.oid = 'public.vendor_profiles_self'::regclass
          AND 'security_invoker=true' = ANY (coalesce(c.reloptions, ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'POST-CONDITION 2c FAILED: the shop can no longer read its own badge deadline through vendor_profiles_self';
  END IF;
END $$;

COMMIT;
