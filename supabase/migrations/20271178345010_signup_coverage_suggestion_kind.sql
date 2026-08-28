-- signup_coverage_suggestion_kind
--
-- C5 (2026-08-28, owner + DPO ruling "C5 yes"): a shop's own public website
-- may be read, ONCE, for FREE, on Setnayan's own initiative, to SUGGEST
-- coverage trades the shop then confirms on screen — never applied silently.
-- This reuses the existing Deep Search engine + store
-- (apps/web/lib/vendor-deep-search.ts, vendor_web_dossiers) rather than a
-- second reader; these two columns exist only to keep a system-initiated,
-- allowance-free "signup_suggestion" dossier distinguishable from an admin
-- due-diligence run or a vendor's own paid/free-cycle run — three different
-- purposes now sharing one table on purpose, never conflated.
--
-- KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).

BEGIN;

ALTER TABLE public.vendor_web_dossiers
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'lookup';

-- CHECK constraints have no IF NOT EXISTS — drop-then-add keeps this idempotent.
ALTER TABLE public.vendor_web_dossiers
  DROP CONSTRAINT IF EXISTS vendor_web_dossiers_kind_check;
ALTER TABLE public.vendor_web_dossiers
  ADD CONSTRAINT vendor_web_dossiers_kind_check
    CHECK (kind IN ('lookup', 'signup_suggestion'));

ALTER TABLE public.vendor_web_dossiers
  ADD COLUMN IF NOT EXISTS suggestion_dismissed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.vendor_web_dossiers.kind IS
  'lookup = every dossier this table held before 2026-08-28: an admin
   verification run or a vendor''s own manual (paid or free-cycle) Deep
   Search. signup_suggestion = C5: a FREE, Setnayan-initiated read of the
   shop''s own website at sign-up, run to suggest coverage trades — never
   applied automatically, never charged against the vendor_deep_search_uses
   allowance. Governed by VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED (default
   OFF) and gated on the same vendor_deep_search privacy control as every
   other Deep Search read.';

COMMENT ON COLUMN public.vendor_web_dossiers.suggestion_dismissed_at IS
  'signup_suggestion rows only. Set once the shop dismisses the suggestion
   ("Not now") or acts on it (adds at least one suggested trade) — a
   resolved suggestion never resurfaces from the same dossier. NULL on every
   pre-2026-08-28 row and on every non-signup_suggestion row; unused there.';

CREATE INDEX IF NOT EXISTS vendor_web_dossiers_signup_suggestion_idx
  ON public.vendor_web_dossiers (vendor_profile_id, kind)
  WHERE kind = 'signup_suggestion';

COMMIT;
