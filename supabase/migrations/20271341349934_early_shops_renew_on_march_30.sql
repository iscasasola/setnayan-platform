-- early_shops_renew_on_march_30
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every existing migration.
--
-- 📄 ONE RENEWAL DAY: 30 MARCH (owner, 12 Nov 2026). The shops verified before the papers check existed were given
-- 12 March 2027 by `20271221359289_verified_badge_deadlines` (182 days from the 2026-09-11 ruling). Owner, verbatim:
-- "Yes, their due is on March 30, 2027." — the same day every verified shop now renews (`lib/papers-due.ts`).
--
-- Moves exactly the rows that still carry that migration's date — the profile's badge day and the vouch row's own
-- deadline — and nothing else: a date anyone set since (a founders verification, an approval, a hand edit) is not
-- 12 March 2027 to the second and is left alone. Idempotent: a second run finds no row at the old date.
-- Data only: no table, column, policy or grant changes.

-- BACKFILL:BEGIN
WITH moved AS (
  UPDATE public.vendor_profiles vp
     SET next_renewal_due_at = TIMESTAMPTZ '2027-03-30 23:59:59+08'
   WHERE vp.next_renewal_due_at = TIMESTAMPTZ '2027-03-12 23:59:59+08'
  RETURNING vp.vendor_profile_id, vp.business_name, vp.public_id
),
vouch AS (
  UPDATE public.vendor_verification_bypasses b
     SET expires_at = TIMESTAMPTZ '2027-03-30 23:59:59+08',
         updated_at = now()
   WHERE b.expires_at = TIMESTAMPTZ '2027-03-12 23:59:59+08'
  RETURNING b.vendor_profile_id
)
INSERT INTO public.admin_audit_log (action, target_table, target_id, reason, actor_user_id, metadata)
SELECT 'vendor_badge_deadline_moved',
       'vendor_profiles',
       m.vendor_profile_id::text,
       'Owner ruling 2026-11-12: every verified shop renews on 30 March; the early shops are due 30 March 2027.',
       NULL,
       jsonb_build_object(
         'business_name', m.business_name,
         'public_id', m.public_id,
         'from', '2027-03-12T15:59:59.000Z',
         'to', '2027-03-30T15:59:59.000Z',
         'vouch_row_moved', EXISTS (SELECT 1 FROM vouch v WHERE v.vendor_profile_id = m.vendor_profile_id),
         'source', 'migration 20271341349934 (owner ruling 2026-11-12)'
       )
  FROM moved m;
-- BACKFILL:END

-- ── Post-condition ───────────────────────────────────────────────────────────
DO $$
DECLARE
  v_left BIGINT;
BEGIN
  SELECT count(*) INTO v_left
    FROM public.vendor_profiles
   WHERE next_renewal_due_at = TIMESTAMPTZ '2027-03-12 23:59:59+08';
  IF v_left > 0 THEN
    RAISE EXCEPTION 'POST-CONDITION FAILED: % shop(s) still carry the 12 March 2027 badge day.', v_left;
  END IF;
END
$$;
