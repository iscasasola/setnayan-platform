-- ============================================================================
-- 20270820292403_guard_thread_provenance_columns.sql
--
-- SECURITY — attribution-integrity guard on public.chat_threads (defense-in-depth).
--
-- PR #3340 (migration 20270819553697) added three PROVENANCE columns to
-- chat_threads — referring_chapter_id, inquiry_source, is_returning — with NO
-- write protection. The base RLS policy `chat_threads_member_write`
-- (20260821000000) is `FOR ALL TO authenticated`, so ANY thread party (couple
-- member OR the vendor) can PATCH these columns via the raw PostgREST API,
-- bypassing the server-side validation in stampThreadProvenance /
-- resolveReferringChapter (apps/web/lib/inquiry-attribution.ts). A party could
-- forge referring_chapter_id to any existing chapter (the FK only checks
-- existence), inflating the public "inquiries driven" count, firing a false
-- chapter_drove_inquiry notification, and mislabeling the vendor's real token
-- burn as spend_source='lead_unlock' (G1 of the PR-C money-path review).
--
-- WHY A TRIGGER, NOT A COLUMN-LEVEL REVOKE:
--   Supabase's platform baseline grants TABLE-LEVEL UPDATE to `authenticated`
--   (GRANT ALL … + ALTER DEFAULT PRIVILEGES). In PostgreSQL a table-level
--   UPDATE privilege is checked BEFORE column-level grants, so a bare
--   `REVOKE UPDATE (cols) … FROM authenticated` is a NO-OP unless you also
--   revoke the table-level grant and re-GRANT UPDATE on every OTHER column —
--   fragile (must enumerate ~18 columns; silently re-opens on any new column).
--   The BEFORE UPDATE trigger below is the established house pattern
--   (mirrors 20270814328403_guard_users_privilege_columns +
--   20261214000000_guard_pax_finalize_columns): for any NON-privileged caller,
--   changes to the guarded columns are silently reverted to their OLD value,
--   so a forgery PATCH no-ops while every other thread edit is untouched.
--
-- "Privileged" = the write runs with elevated authority:
--   • auth.role() IS NULL          — direct/superuser/migration connection.
--   • auth.role() = 'service_role' — the elevated admin client
--                                    (`createAdminClient`). The ONLY legitimate
--                                    writer of these columns is
--                                    stampThreadProvenance, which runs on the
--                                    service-role admin client — so it passes.
--   • public.is_admin()            — belt-and-suspenders (an authenticated
--                                    admin session; today none writes these).
--
-- Legit paths verified unaffected (traced end-to-end 2026-07-17):
--   (a) startServiceInquiry (apps/web/app/v/[slug]/inquiry-actions.ts) upserts
--       the thread on the AUTHENTICATED client WITHOUT any provenance column,
--       then calls stampThreadProvenance which UPDATEs the 3 columns on the
--       SERVICE-ROLE admin client → privileged → the first-stamp succeeds.
--   (b) A brand-new thread has OLD.(cols) = NULL/FALSE; the authenticated
--       upsert never sets them, so the revert-to-OLD is a no-op → the ordinary
--       inquiry flow (pax snapshot, interests, messages) is completely
--       unaffected.
--   (c) A thread party PATCHing referring_chapter_id / inquiry_source /
--       is_returning via the raw REST API → not privileged → reverted → forgery
--       blocked (G1 closed).
--
-- BEFORE UPDATE only: the columns are never set at INSERT by an authenticated
-- caller (the upsert omits them), so there is nothing to guard on INSERT.
-- Idempotent (CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_thread_provenance_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_role      TEXT := auth.role();  -- NULL under a direct/superuser connection
  privileged  BOOLEAN;
BEGIN
  privileged := (v_role IS NULL)                 -- migration / superuser / direct DB
             OR (v_role = 'service_role')        -- elevated admin client (stampThreadProvenance)
             OR public.is_admin();               -- authenticated admin session

  IF privileged THEN
    RETURN NEW;
  END IF;

  -- Non-privileged caller: neutralize any attempt to forge/overwrite the
  -- server-validated provenance stamp. Every OTHER column edit still succeeds.
  NEW.referring_chapter_id := OLD.referring_chapter_id;
  NEW.inquiry_source       := OLD.inquiry_source;
  NEW.is_returning         := OLD.is_returning;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_thread_provenance_columns_trg ON public.chat_threads;
CREATE TRIGGER guard_thread_provenance_columns_trg
  BEFORE UPDATE ON public.chat_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_thread_provenance_columns();

COMMIT;
