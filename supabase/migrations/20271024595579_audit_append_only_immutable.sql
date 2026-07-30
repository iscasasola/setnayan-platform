-- ============================================================================
-- THE ADMIN AUDIT TRAIL BECOMES APPEND-ONLY AT THE SCHEMA LEVEL.
--
-- Closes the security audit's top finding (Admin_Account_Access_Model_2026-06-22
-- · DECISION_LOG 2026-06-22): the trail was mutable by a privileged actor. RLS
-- denies admin UPDATE/DELETE, but **the service-role client bypasses RLS**, so a
-- rogue or compromised service path could rewrite or erase the record of its own
-- actions. Triggers are not RLS — they fire for EVERY role, service_role
-- included — so the guard belongs here.
--
-- ⚠ VERIFIED STILL OPEN before writing this: prod has both tables, ZERO triggers
-- on either, and no `enforce_audit_append_only` function. Live since 2026-06-22.
--
-- ── WHY THIS IS A RE-SHIP AND NOT PR #2048 ─────────────────────────────────
--
-- #2048 wrote this in June and still merges cleanly today, so landing it was
-- tempting. It would have shipped a guard with a hole. Its UPDATE carve-out
-- enumerated the content columns BY NAME:
--
--     action · target_table · target_id · before_json · after_json · reason ·
--     created_at · actor_user_id
--
-- `admin_audit_log` has since gained a **`metadata`** column. An UPDATE that
-- rewrote ONLY `metadata` satisfies every clause in that list and would be
-- permitted — on a table whose entire purpose is that it cannot be rewritten.
-- A hand-kept column list is precisely the shape that rots, and this one already
-- had, in about four months. #2048 is closed in favour of this.
--
-- ── SO THE CHECK NAMES NO COLUMNS ──────────────────────────────────────────
--
-- Compare the WHOLE ROW as jsonb, minus the FK columns allowed to move. Adding a
-- column to either table can never silently widen what an UPDATE may change,
-- because nothing here enumerates what it protects.
--
-- ── THE CASCADE CARVE-OUT (from #2048 — this part was right) ───────────────
--
-- The actor/subject FKs are ON DELETE SET NULL, so deleting a user — including an
-- RA 10173 erasure — cascades a SET-NULL **UPDATE** onto these rows. That update
-- is privacy-preserving and MUST still succeed; a naive append-only trigger would
-- block it and break account deletion outright.
--
-- So: DELETE is refused unconditionally. UPDATE is refused unless it is exactly
-- the anonymisation — every non-FK column identical, each FK either unchanged or
-- newly NULL. An FK moving from one user to another is still refused: that would
-- be forging attribution, not erasing it.
--
-- Idempotent: CREATE OR REPLACE FUNCTION + DROP/CREATE TRIGGER.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_audit_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_fk_cols TEXT[];
  v_old JSONB;
  v_new JSONB;
  v_col TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'append-only audit table %: DELETE is not permitted', TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;

  -- The only columns permitted to change, and only ever to NULL: the FKs
  -- carrying ON DELETE SET NULL.
  IF TG_TABLE_NAME = 'admin_audit_log' THEN
    v_fk_cols := ARRAY['actor_user_id'];
  ELSIF TG_TABLE_NAME = 'admin_data_access_log' THEN
    v_fk_cols := ARRAY['admin_user_id', 'accessed_user_id'];
  ELSE
    -- A third table adopting this trigger without declaring its FKs gets the
    -- STRICTEST behaviour (nothing may change), never the loosest.
    v_fk_cols := ARRAY[]::TEXT[];
  END IF;

  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);

  -- 1 · Every column EXCEPT those FKs must be identical. Whole-row comparison,
  --     so a column added later is protected the day it is added.
  FOREACH v_col IN ARRAY v_fk_cols LOOP
    v_old := v_old - v_col;
    v_new := v_new - v_col;
  END LOOP;

  IF v_old IS DISTINCT FROM v_new THEN
    RAISE EXCEPTION 'append-only audit table %: rows may not be modified', TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;

  -- 2 · Each FK may stay as it is, or become NULL. Never point somewhere else.
  FOREACH v_col IN ARRAY v_fk_cols LOOP
    IF (to_jsonb(NEW) ->> v_col) IS DISTINCT FROM (to_jsonb(OLD) ->> v_col)
       AND (to_jsonb(NEW) ->> v_col) IS NOT NULL THEN
      RAISE EXCEPTION
        'append-only audit table %: % may only be cleared (anonymisation), not reassigned',
        TG_TABLE_NAME, v_col
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_audit_log_append_only ON public.admin_audit_log;
CREATE TRIGGER admin_audit_log_append_only
  BEFORE UPDATE OR DELETE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.enforce_audit_append_only();

DROP TRIGGER IF EXISTS admin_data_access_log_append_only ON public.admin_data_access_log;
CREATE TRIGGER admin_data_access_log_append_only
  BEFORE UPDATE OR DELETE ON public.admin_data_access_log
  FOR EACH ROW EXECUTE FUNCTION public.enforce_audit_append_only();

COMMENT ON FUNCTION public.enforce_audit_append_only() IS
  'Append-only guard for the admin audit tables. Fires for EVERY role including '
  'service_role (triggers are not RLS) — that is the point, since service_role '
  'bypassing RLS was the finding. DELETE always refused; UPDATE refused unless it '
  'is exactly the ON DELETE SET NULL anonymisation (whole row identical except an '
  'FK moving to NULL), so RA 10173 erasure still succeeds. Compares rows as jsonb '
  'rather than by column name: PR #2048''s hand-kept list had already gone stale '
  'against admin_audit_log.metadata in about four months.';

-- ── Post-conditions ────────────────────────────────────────────────────────
DO $$
DECLARE v_n INT;
BEGIN
  SELECT count(*) INTO v_n FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  WHERE c.relname IN ('admin_audit_log','admin_data_access_log')
    AND t.tgname LIKE '%append_only' AND NOT t.tgisinternal;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'expected 2 append-only triggers, found %', v_n;
  END IF;
END $$;

COMMIT;
