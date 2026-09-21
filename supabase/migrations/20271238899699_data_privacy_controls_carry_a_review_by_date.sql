-- A TEMPORARY APPROVAL HAS A DATE ON IT.
--
-- WHY THIS EXISTS
-- Owner, 2026-09-22, asked how to record what he had already decided: the
-- data-privacy controls are approved **temporarily**, to be revisited in
-- January. Measured the same day, `data_privacy_controls` could not express
-- that. Its columns are status / approved_by / approved_at / note / risk_note —
-- and NOTHING that says "until when".
--
-- 🔑 SO A TEMPORARY APPROVAL AND A PERMANENT ONE WERE THE SAME ROW. The only
-- place the word "temporary" existed was in conversation, and conversations do
-- not raise alarms in January. This is the whole defect: a provisional decision
-- that is stored as an unconditional one does not decay — it just quietly
-- becomes the permanent answer, and the day it was meant to be revisited passes
-- with nothing on screen.
--
-- Context, measured 2026-09-22 and the reason this matters: all 20 controls read
-- `status='active'` in production while all 15 `npc_filing_tasks` read
-- `not_started` — including the tier-0 blocker "Route the full packet to
-- external PH counsel". The features are on; the filing work has not begun.
-- `review_by` is what makes that a dated position instead of a drift.
--
-- WHAT THIS DOES
--   • adds `review_by date` — NULL means a settled, open-ended approval;
--     a date means "this is provisional and must be looked at again by then".
--   • stamps every control that is ALREADY active with 2027-01-31, which is the
--     January the owner named. Only where `review_by IS NULL`, so a re-run and
--     any later hand-set date both survive.
--
-- ⚠ THIS CHANGES NO GATE. `isDataPrivacyControlActive` reads `status` and keeps
-- reading only `status`. An overdue review does NOT switch a feature off — that
-- would take the site down on a date nobody was watching, which is a worse
-- failure than the one being fixed. It makes the deadline VISIBLE and leaves
-- the switch where it belongs: with the owner.

ALTER TABLE public.data_privacy_controls
  ADD COLUMN IF NOT EXISTS review_by date;

COMMENT ON COLUMN public.data_privacy_controls.review_by IS
  'Provisional approval deadline. NULL = settled, no review owed. A date = this approval is TEMPORARY and must be revisited by then; the admin board shows it, and shows it as overdue once passed. Never gates a feature — isDataPrivacyControlActive reads status only.';

-- The January the owner named, on everything that is already switched on.
UPDATE public.data_privacy_controls
   SET review_by  = DATE '2027-01-31',
       updated_at = NOW()
 WHERE status     = 'active'
   AND review_by IS NULL;

-- Prove the column is really there and really usable. An ADD COLUMN IF NOT
-- EXISTS that silently no-ops against a differently-typed pre-existing column
-- would leave every read below returning something unexpected, and the UPDATE
-- above would have been a zero-row success-shaped nothing.
DO $$
DECLARE
  v_type TEXT;
  v_active INT;
  v_stamped INT;
BEGIN
  SELECT data_type INTO v_type
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'data_privacy_controls'
     AND column_name  = 'review_by';

  IF v_type IS DISTINCT FROM 'date' THEN
    RAISE EXCEPTION
      'data_privacy_controls.review_by is %, expected date', COALESCE(v_type, '(missing)');
  END IF;

  SELECT count(*) FILTER (WHERE status = 'active'),
         count(*) FILTER (WHERE status = 'active' AND review_by IS NOT NULL)
    INTO v_active, v_stamped
    FROM public.data_privacy_controls;

  -- An empty table is legitimate (a fresh replay seeds later), so only complain
  -- when active rows exist and none of them took the date.
  IF v_active > 0 AND v_stamped = 0 THEN
    RAISE EXCEPTION
      '% controls are active and none carry a review_by — the stamp did not land', v_active;
  END IF;
END $$;
