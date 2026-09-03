-- a_default_is_a_write_nobody_made
-- ============================================================================
-- NO COUPLE HAS BEEN ABLE TO ADD A SUPPLIER SINCE 20271105038066 SHIPPED.
--
-- ── HOW THIS WAS FOUND ─────────────────────────────────────────────────────
-- Not by looking for it. BA7 needed to prove that its "name a supplier" path
-- could really create the LOCKED Merkado row it promises, so it wrote a db test
-- that performs the insert AS THE COUPLE instead of asserting that the server
-- action spells it. The database refused. Re-run against PRODUCTION inside a
-- rolled-back transaction on 2026-09-03, an `authenticated` INSERT naming no
-- completion column at all comes back:
--
--   INSERT REFUSED: event_vendors: completion columns record who did what and
--                   are written only by the app backend
--
-- 🔑 THE SOURCE GUARD COULD NEVER HAVE SEEN THIS. Every server action spells
-- the insert correctly; a trigger refuses it. Code review, typecheck, lint and
-- a source scan all pass on a feature that cannot write a row.
--
-- ── THE DEFECT, IN ONE SENTENCE ────────────────────────────────────────────
-- `guard_event_vendor_completion` refuses a session-role INSERT whose
-- `NEW.completion_status IS NOT NULL` — but that column is
-- `NOT NULL DEFAULT 'awaiting_vendor'`, and a column default is applied when
-- the tuple is FORMED, before any BEFORE ROW trigger runs. So `NEW`.
-- `completion_status` is NEVER null on any insert, by anyone, ever. The guard
-- refuses 100% of couple-authored bookings, which is every one of them.
--
-- ⚖ ITS THREE SIBLINGS ARE CORRECT AND ARE NOT TOUCHED.
-- `service_marked_complete_at`, `customer_confirmed_received_at` and
-- `completion_disputed_at` are nullable with NO default (verified in prod
-- 2026-09-03), so `IS NOT NULL` is exactly the right test for them. Only one
-- column of the four carries a default, and only that one condition changes.
-- The sibling `guard_event_vendor_deposit_ack` in the same migration is also
-- correct: `deposit_acknowledged_at` is nullable with no default.
--
-- ── WHERE THE MISTAKE CAME FROM, so it is not repeated ─────────────────────
-- 20271105038066's own docblock says it out loud:
--
--   "A repo-wide grep for a SESSION-client write of these columns returns
--    NOTHING, so refusing `authenticated`/`anon` breaks no shipped path."
--
-- The grep was correct and the conclusion was wrong. 🔑 A `NOT NULL DEFAULT`
-- WRITES A COLUMN THAT NOBODY NAMED. Searching application code for writers
-- cannot find a writer that lives in the schema. Before refusing a non-NULL
-- value on INSERT, read the column's default — if it has one, the test must be
-- against THAT, not against NULL.
--
-- ── WHAT IT COST, MEASURED NOT ESTIMATED ───────────────────────────────────
-- Production, 2026-09-03: 45 rows in `event_vendors`, ALL 45 carrying a
-- non-null `completion_status`; the NEWEST was created 2026-07-30; ZERO have
-- been created since. `createVendor`, `attachManualVendorToCategory` and
-- `attachMarketplaceVendorToCategory` are all session-client inserts and are
-- all affected — the whole couple-facing "add a supplier" surface. Re-measure
-- with `select max(created_at) from public.event_vendors;` rather than trusting
-- these figures.
--
-- ── WHAT THIS DOES *NOT* DO ────────────────────────────────────────────────
-- ⛔ It does not relax the forgery protection. A couple still cannot post a
-- booking that ARRIVES already marked `vendor_marked`, `confirmed`,
-- `auto_confirmed` or `disputed`, and still cannot change the column on UPDATE
-- — the UPDATE branch is untouched. What it now permits is the ONE value the
-- guard's own HINT describes as correct: "A booking is created with no
-- completion state". `'awaiting_vendor'` IS that state.
-- ⛔ It does not add SECURITY DEFINER. The original is SECURITY INVOKER on
-- purpose — inside a DEFINER function `current_user` is the owner, the role
-- test never matches, and the guard would be permanently inert while looking
-- correct. That reasoning is preserved verbatim.
--
-- Idempotent (CREATE OR REPLACE) and re-run safe.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_event_vendor_completion()
RETURNS trigger
LANGUAGE plpgsql
-- ⚠ SECURITY INVOKER ON PURPOSE (no SECURITY DEFINER). Inside a DEFINER
-- function `current_user` becomes the function OWNER, so the role test would
-- never match and this guard would be permanently INERT while looking correct.
-- Every sibling guard here (`guard_event_vendor_deposit_ack`,
-- `guard_events_ai_entitlement`, `guard_custom_domain_verification`) is
-- non-DEFINER for exactly this reason. Do not "harden" it by adding DEFINER.
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    -- INSERT and UPDATE are handled separately on purpose: on INSERT there is
    -- no OLD to diff against, so a row that ARRIVES pre-stamped must be refused
    -- on its value alone.
    IF TG_OP = 'INSERT' THEN
      IF NEW.service_marked_complete_at IS NOT NULL
         OR NEW.customer_confirmed_received_at IS NOT NULL
         OR NEW.completion_disputed_at IS NOT NULL
         -- 🔑 `<> 'awaiting_vendor'`, NOT `IS NOT NULL`. This column is
         -- NOT NULL DEFAULT 'awaiting_vendor', and a default is applied before
         -- any BEFORE ROW trigger fires — so the original `IS NOT NULL` was
         -- true on EVERY insert and refused every couple-authored booking for
         -- roughly five weeks. The three columns above are nullable with no
         -- default, so `IS NOT NULL` remains right for them.
         --
         -- Written as `IS DISTINCT FROM` rather than `<>` so that a future
         -- migration dropping the NOT NULL cannot silently turn this condition
         -- into NULL — which SQL reads as "not true", i.e. permitted. The
         -- forged-value branch must never fail open.
         OR NEW.completion_status IS DISTINCT FROM 'awaiting_vendor' THEN
        RAISE EXCEPTION
          'event_vendors: completion columns record who did what and are written only by the app backend'
          USING ERRCODE = '42501',
                HINT = 'A booking is created with no completion state; the vendor marks it complete and the couple then confirms.';
      END IF;
    ELSE  -- UPDATE — unchanged. A diff against OLD needs no default awareness.
      IF NEW.service_marked_complete_at       IS DISTINCT FROM OLD.service_marked_complete_at
         OR NEW.customer_confirmed_received_at IS DISTINCT FROM OLD.customer_confirmed_received_at
         OR NEW.completion_disputed_at         IS DISTINCT FROM OLD.completion_disputed_at
         OR NEW.completion_status              IS DISTINCT FROM OLD.completion_status THEN
        RAISE EXCEPTION
          'event_vendors: completion columns record who did what and are written only by the app backend'
          USING ERRCODE = '42501',
                HINT = 'Use the confirm-receipt or dispute action; both write as service_role after checking membership.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_event_vendor_completion() IS
  'Refuses a session-role (authenticated/anon) write of the completion columns on event_vendors. Every legitimate writer -- vendor marks complete, couple confirms, couple disputes, admin override -- runs as service_role, so this breaks no shipped path. Non-DEFINER deliberately: inside a DEFINER function current_user is the owner and the role test would never fire. ⚠ completion_status is tested against its DEFAULT (''awaiting_vendor''), not against NULL: the column is NOT NULL DEFAULT ''awaiting_vendor'' and a default is applied before BEFORE ROW triggers run, so the original IS NOT NULL test was true on every insert and refused every couple-authored booking from 20271105038066 until 20271194295412. Before adding a column to this guard, read its default.';

COMMIT;
