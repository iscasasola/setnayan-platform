-- audit_append_only_immutable
-- ============================================================================
-- Admin account-access model — Phase 1b (Admin_Account_Access_Model_2026-06-22.md
-- · DECISION_LOG 2026-06-22). Closes the security audit's top finding: the
-- admin audit trail was mutable by a privileged actor (RLS denies admin
-- UPDATE/DELETE, but the SERVICE-ROLE client bypasses RLS, so a rogue/compromised
-- service path could rewrite or erase the trail).
-- ============================================================================
-- Makes public.admin_audit_log + public.admin_data_access_log APPEND-ONLY at the
-- SCHEMA level via a BEFORE trigger that fires for EVERY role (incl. service_role
-- — triggers are not RLS), so the trail can only be inserted, never rewritten or
-- deleted.
--
-- ⚠ CASCADE CARVE-OUT: the actor/subject FK columns are ON DELETE SET NULL
-- (verified on prod: actor_user_id · admin_user_id · accessed_user_id). A user
-- deletion (incl. RA 10173 erasure) cascades a SET-NULL UPDATE onto these rows —
-- which is privacy-preserving and MUST still succeed. So the trigger BLOCKS
-- DELETE outright, and blocks UPDATE EXCEPT the anonymization update (every
-- non-FK column unchanged; FK columns either unchanged or newly NULL). Without
-- this carve-out an append-only trigger would break account deletion.
--
-- Idempotent: CREATE OR REPLACE FUNCTION + DROP/CREATE TRIGGER.
--
-- NOT applied to prod by the author — behavior-changing on a critical path
-- (must be cascade-tested before prod). Applies at merge / via the normal
-- pipeline after review.

CREATE OR REPLACE FUNCTION public.enforce_audit_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'append-only audit table %: DELETE is not permitted', TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;

  -- UPDATE path: permit ONLY the FK ON DELETE SET NULL anonymization (or a
  -- no-op). Every content column must be unchanged; FK id columns may only stay
  -- the same or transition to NULL.
  IF TG_TABLE_NAME = 'admin_audit_log' THEN
    IF NEW.action       IS NOT DISTINCT FROM OLD.action
       AND NEW.target_table IS NOT DISTINCT FROM OLD.target_table
       AND NEW.target_id    IS NOT DISTINCT FROM OLD.target_id
       AND NEW.before_json  IS NOT DISTINCT FROM OLD.before_json
       AND NEW.after_json   IS NOT DISTINCT FROM OLD.after_json
       AND NEW.reason       IS NOT DISTINCT FROM OLD.reason
       AND NEW.created_at   IS NOT DISTINCT FROM OLD.created_at
       AND (NEW.actor_user_id IS NOT DISTINCT FROM OLD.actor_user_id OR NEW.actor_user_id IS NULL)
    THEN
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'admin_data_access_log' THEN
    IF NEW.surface     IS NOT DISTINCT FROM OLD.surface
       AND NEW.context    IS NOT DISTINCT FROM OLD.context
       AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
       AND (NEW.admin_user_id    IS NOT DISTINCT FROM OLD.admin_user_id    OR NEW.admin_user_id    IS NULL)
       AND (NEW.accessed_user_id IS NOT DISTINCT FROM OLD.accessed_user_id OR NEW.accessed_user_id IS NULL)
    THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'append-only audit table %: UPDATE is not permitted (only FK anonymization on user deletion)', TG_TABLE_NAME
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_audit_log_append_only ON public.admin_audit_log;
CREATE TRIGGER trg_admin_audit_log_append_only
  BEFORE UPDATE OR DELETE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.enforce_audit_append_only();

DROP TRIGGER IF EXISTS trg_admin_data_access_log_append_only ON public.admin_data_access_log;
CREATE TRIGGER trg_admin_data_access_log_append_only
  BEFORE UPDATE OR DELETE ON public.admin_data_access_log
  FOR EACH ROW EXECUTE FUNCTION public.enforce_audit_append_only();

-- Belt-and-suspenders: revoke UPDATE/DELETE from the app-reachable roles. The
-- trigger is the real guard (fires for every role); this just removes the grant.
REVOKE UPDATE, DELETE ON public.admin_audit_log FROM authenticated, anon;
REVOKE UPDATE, DELETE ON public.admin_data_access_log FROM authenticated, anon;
