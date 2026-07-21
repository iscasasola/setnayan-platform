-- Camera Bridge — deactivate a SHELVED product that is still purchasable.
-- Wave 0 of Papic_Website_Strategy_Council_Verdict_2026-07-20.md § 2.
--
-- ── THE DEFECT ────────────────────────────────────────────────────────────
-- `CAMERA_BRIDGE` is is_active = TRUE at ₱500 in prod, titled
--   "Camera Bridge (per event/day — unlocks DSLR for ALL Papic cameras)"
-- …while the feature itself was SHELVED by the owner on 2026-07-17.
--
-- It is not merely unbuilt. The connectivity research
-- (0012_papic/Camera_Connectivity_Research_2026-07-17.md) found the premise does
-- not hold:
--   • Fujifilm — the SDK the docs referenced DOES NOT EXIST
--   • Canon    — "EOS Camera Connect SDK" is FICTIONAL; the real thing is CCAPI,
--                ~25 bodies, and 5D IV / 6D II are permanently absent
--   • Nikon / Sony — UNVERIFIED
--   • Panasonic · DJI Osmo — not possible
--   • Actually working: GoPro · Insta360 (OSC) · Ricoh THETA — action cams, not
--     the DSLRs a wedding photographer shoots
--
-- So the title's promise — "ALL Papic cameras" — is false for essentially every
-- camera a customer would bring, and a couple can buy it today for ₱500.
-- **A purchasable false promise is the most expensive kind of fake door**, which
-- is why this is a deactivation and not a copy edit.
--
-- ── WHY DEACTIVATE, NOT DELETE ───────────────────────────────────────────
-- The row stays for lineage: `orders` reference `service_key` as free-form TEXT,
-- and prod holds ONE historical paid CAMERA_BRIDGE order (June 2026). Deleting
-- the catalog row would orphan it. Deactivation removes it from every buy
-- surface while the history stays readable. No refund is implied and none is
-- issued here — that is an owner/admin decision, not a migration's.
--
-- ── ALSO RECORDED, DELIBERATELY NOT FIXED HERE ───────────────────────────
-- `billing_period = 'one_time'` while the title reads "per event/day" — a
-- billing-UNIT bug independent of price, first logged in the 2026-07-20
-- Live Studio row. Left alone: the SKU is being switched off, so correcting its
-- billing unit now would be churn on a dormant row. Fix it if it is ever
-- revived — and the revival path is FTP push (camera → our FTPS server,
-- brand-agnostic, no SDK), not the vendor-SDK approach that failed.

UPDATE public.platform_retail_catalog_v2
SET is_active  = FALSE,
    updated_at = NOW()
WHERE service_code = 'CAMERA_BRIDGE'
  AND is_active IS DISTINCT FROM FALSE;

DO $$
DECLARE
  v_active BOOLEAN;
  v_dupes  INTEGER;
BEGIN
  SELECT is_active INTO v_active
  FROM public.platform_retail_catalog_v2 WHERE service_code = 'CAMERA_BRIDGE';

  IF v_active IS NULL THEN
    RAISE EXCEPTION 'CAMERA_BRIDGE missing from platform_retail_catalog_v2';
  END IF;
  IF v_active IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'CAMERA_BRIDGE is still active';
  END IF;

  -- Re-assert the invariant migration 20270828150000 established: no two ACTIVE
  -- customer SKUs may share a title, because /pricing emits each as a schema.org
  -- Offer verbatim. Deactivating a row can only help, but assert it anyway so a
  -- future edit cannot quietly reintroduce a duplicate.
  SELECT COUNT(*) INTO v_dupes FROM (
    SELECT title FROM public.platform_retail_catalog_v2
    WHERE is_active GROUP BY title HAVING COUNT(*) > 1
  ) d;
  IF v_dupes > 0 THEN
    RAISE EXCEPTION 'duplicate titles among ACTIVE catalog SKUs (% group(s))', v_dupes;
  END IF;
END $$;
