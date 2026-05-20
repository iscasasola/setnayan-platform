-- Data-integrity hardening — two unrelated fixes bundled because both
-- touch the same iteration-0009 / iteration-0005 tables and ship as a
-- single bug-sweep PR.
--
--   (1) photo_delivery_jobs.triggered_by_user_id had no ON DELETE clause
--       on its FK to public.users, so the FK defaulted to NO ACTION.
--       Deleting any couple member (GDPR / RA 10173 right-of-erasure
--       request, account self-delete, admin offboard) would error out
--       at this row and leave the user-deletion half-applied.
--
--       Audit semantics favor keeping the delivery row (admin debug +
--       trail per the column COMMENT), so relax the column to nullable
--       and use ON DELETE SET NULL — the row survives, the FK clears,
--       the audit text loses the link to a deleted person but the
--       trail itself stays intact.
--
--   (2) Four iteration-0009 / iteration-0005 tables ship with RLS
--       enabled and NO policies, documented as "service-role-only" in
--       their original migrations. RLS-on / no-policies silently
--       returns zero rows to anon + authenticated, which means an
--       accidental app query in a future PR would look like "no data"
--       instead of an error — easy to miss in review, hard to debug
--       in prod.
--
--       REVOKE the table grants from anon + authenticated so any such
--       query fails loudly with `permission denied for table ...`.
--       service_role bypasses table grants (and RLS) in Supabase by
--       default, so the existing photo-delivery + LED-background
--       flows (which all use createAdminClient) keep working.
--
--       Verified no non-admin callers exist in apps/web for any of
--       the four tables before shipping this.

-- (1) FK fix — photo_delivery_jobs.triggered_by_user_id ON DELETE SET NULL.

ALTER TABLE public.photo_delivery_jobs
  ALTER COLUMN triggered_by_user_id DROP NOT NULL;

ALTER TABLE public.photo_delivery_jobs
  DROP CONSTRAINT IF EXISTS photo_delivery_jobs_triggered_by_user_id_fkey;

ALTER TABLE public.photo_delivery_jobs
  ADD CONSTRAINT photo_delivery_jobs_triggered_by_user_id_fkey
  FOREIGN KEY (triggered_by_user_id)
  REFERENCES public.users(user_id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.photo_delivery_jobs.triggered_by_user_id IS
  '0009 Photo Delivery — couple member who clicked Release. Audit-only; ON DELETE SET NULL so user erasure does not block. Row remains for the trail.';

-- (2) Loud-failure REVOKE on the four service-role-only tables.

REVOKE ALL ON public.photo_delivery_jobs        FROM anon, authenticated;
REVOKE ALL ON public.photo_delivery_artifacts   FROM anon, authenticated;
REVOKE ALL ON public.led_background_configs     FROM anon, authenticated;
REVOKE ALL ON public.led_background_renders     FROM anon, authenticated;
