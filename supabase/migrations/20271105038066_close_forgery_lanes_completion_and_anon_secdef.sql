-- close_forgery_lanes_completion_and_anon_secdef
-- ============================================================================
-- Close two forgery lanes on event_vendors, and two dead anon grants.
--
-- ⛔ SCOPE NOTE — WHAT THIS DELIBERATELY DOES *NOT* DO.
-- It does NOT guard `event_vendors.status`. That was scoped on 2026-08-04 and
-- REJECTED (`Six_State_Mount_and_Forgery_Guard_SCOPE_2026-08-04.md`):
--   · SEVEN legitimate couple-facing writers set a confirmed status while
--     running as `authenticated`, so a role-keyed guard refuses every real lock;
--   · the package lock is a multi-row INSERT whose per-row RAISE rolls back and
--     DELETES the booking;
--   · with the payment-gated lock on, money reaches the vendor BEFORE the
--     blocked write — a couple could pay and be left with no booking;
--   · and the owner's rule forbids repurposing `status` for handshake meaning,
--     so it is not becoming the "vendor agreed" column in the first place.
-- That guard belongs in PR-H, keyed on the vendor's own `lock_agreed_at`.
--
-- ✅ WHAT *IS* CLOSED HERE are columns that already assert "a specific party did
-- something", where EVERY legitimate writer is service_role — established by
-- reading the call sites, not assumed:
--   · vendorMarkServiceComplete  → createAdminClient()   (vendor marks done)
--   · confirmReceipt             → createAdminClient()   (couple confirms)
--   · disputeCompletion          → createAdminClient()   (couple disputes)
--   · /admin/completions         → createAdminClient()   (admin override)
-- A repo-wide grep for a SESSION-client write of these columns returns NOTHING,
-- so refusing `authenticated`/`anon` breaks no shipped path.
--
-- Why it matters: the couple holds a table-wide UPDATE grant plus a
-- column-unrestricted RLS policy on their own event's rows, so today they can
-- write "the vendor marked this delivered" onto their own booking themselves.
-- ============================================================================

BEGIN;

-- ── 1 · The completion columns are party-authored, not couple-writable ──────
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
    -- on its value alone. Watching only UPDATE is the exact hole step 2 fixes.
    IF TG_OP = 'INSERT' THEN
      IF NEW.service_marked_complete_at IS NOT NULL
         OR NEW.customer_confirmed_received_at IS NOT NULL
         OR NEW.completion_disputed_at IS NOT NULL
         OR NEW.completion_status IS NOT NULL THEN
        RAISE EXCEPTION
          'event_vendors: completion columns record who did what and are written only by the app backend'
          USING ERRCODE = '42501',
                HINT = 'A booking is created with no completion state; the vendor marks it complete and the couple then confirms.';
      END IF;
    ELSE  -- UPDATE
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

DROP TRIGGER IF EXISTS event_vendors_guard_completion ON public.event_vendors;
CREATE TRIGGER event_vendors_guard_completion
  BEFORE INSERT OR UPDATE ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.guard_event_vendor_completion();

COMMENT ON FUNCTION public.guard_event_vendor_completion() IS
  'Refuses a session-role (authenticated/anon) write of the completion columns on event_vendors. Every legitimate writer — vendor marks complete, couple confirms, couple disputes, admin override — runs as service_role, so this breaks no shipped path. Non-DEFINER deliberately: inside a DEFINER function current_user is the owner and the role test would never fire.';

-- ── 2 · The deposit-ack guard had an INSERT hole ────────────────────────────
-- `event_vendors_guard_deposit_ack` was BEFORE UPDATE only, so the column it
-- exists to protect could simply ARRIVE already set on a couple-authored
-- INSERT — the forgery it prevents, through the one verb it did not watch.
CREATE OR REPLACE FUNCTION public.guard_event_vendor_deposit_ack()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only the SECURITY DEFINER RPC (runs as owner 'postgres') and the
  -- service_role admin client may set the vendor's acknowledgement. A direct
  -- couple/guest PostgREST write (role authenticated/anon) cannot forge it —
  -- on EITHER verb.
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.deposit_acknowledged_at IS NOT NULL THEN
        RAISE EXCEPTION 'deposit_acknowledged_at is vendor-set only (via acknowledge_vendor_deposit)'
          USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.deposit_acknowledged_at IS DISTINCT FROM OLD.deposit_acknowledged_at THEN
      RAISE EXCEPTION 'deposit_acknowledged_at is vendor-set only (via acknowledge_vendor_deposit)'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_vendors_guard_deposit_ack ON public.event_vendors;
CREATE TRIGGER event_vendors_guard_deposit_ack
  BEFORE INSERT OR UPDATE ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.guard_event_vendor_deposit_ack();

-- ── 3 · Two dead `anon` EXECUTE grants on booking-writing SECDEF functions ──
-- Both are SECURITY DEFINER and both write a CONFIRMED booking status. Neither
-- is reachable by anon in practice — `acquire_service_time_slot` gates on
-- `current_couple_event_ids()` (empty when auth.uid() is NULL) and
-- `vendor_claim_locked_qr` refuses a NULL auth.uid() outright — so this removes
-- dead surface rather than closing an active breach.
--
-- Worth doing regardless: both sit on the 190-strong unreviewed anon-callable
-- SECDEF register, and "the gate happens to save us" is a weaker guarantee than
-- "anon cannot call it at all" on the one surface where a bug mints a booking.
--
-- ⚠ Signatures read from prod via pg_get_function_identity_arguments — note
-- `vendor_claim_locked_qr` is (text, uuid), NOT (uuid, text). A wrong signature
-- here does not error; it silently REVOKEs nothing.
REVOKE EXECUTE ON FUNCTION public.acquire_service_time_slot(UUID, UUID, UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.vendor_claim_locked_qr(TEXT, UUID) FROM anon;

-- ── 4 · Post-conditions — fail loudly if any of the above silently no-opped ─
-- Every statement here has a quiet failure mode: a trigger that does not
-- install, a REVOKE against a signature that does not exist, a guard attached
-- to the wrong verb. Assert the OBJECTS, not the migration's own success.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     WHERE c.relname = 'event_vendors' AND t.tgname = 'event_vendors_guard_completion'
  ) THEN
    RAISE EXCEPTION 'post-condition failed: completion guard trigger not installed';
  END IF;

  -- tgtype bit 2 (value 4) = INSERT. BOTH guards must now watch INSERT — that
  -- is the entire point of step 2, and it is invisible from the function body.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     WHERE c.relname = 'event_vendors' AND t.tgname = 'event_vendors_guard_completion'
       AND (t.tgtype & 4) = 4
  ) THEN
    RAISE EXCEPTION 'post-condition failed: completion guard does not fire on INSERT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
     WHERE c.relname = 'event_vendors' AND t.tgname = 'event_vendors_guard_deposit_ack'
       AND (t.tgtype & 4) = 4
  ) THEN
    RAISE EXCEPTION 'post-condition failed: deposit-ack guard still does not fire on INSERT';
  END IF;

  IF has_function_privilege('anon', 'public.acquire_service_time_slot(uuid,uuid,uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'post-condition failed: anon can still execute acquire_service_time_slot';
  END IF;

  IF has_function_privilege('anon', 'public.vendor_claim_locked_qr(text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'post-condition failed: anon can still execute vendor_claim_locked_qr';
  END IF;
END $$;

COMMIT;
