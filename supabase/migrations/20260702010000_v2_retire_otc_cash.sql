-- =============================================================================
-- 20260702010000_v2_retire_otc_cash.sql
-- Retire the 6th Setnayan Pay method · otc_cash (OTC: 7-11, M Lhuillier, Bayad)
-- =============================================================================
-- Companion to 20260702000000 which missed this row · the prior migration's
-- IN clause only listed 5 method codes (the audit query that gave me the
-- list was truncated by `head -20` and missed this one). Same 5% fee · same
-- owner directive · retire same as the others.
-- Applied directly to prod 2026-05-28 · this migration codifies it in git.
-- =============================================================================

BEGIN;

UPDATE public.setnayan_pay_methods
   SET is_active  = FALSE,
       updated_at = NOW()
 WHERE method_code = 'otc_cash'
   AND is_active = TRUE;

COMMIT;
