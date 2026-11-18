-- ceremonies_start_blank_until_the_supplier_picks
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ════════════════════════════════════════════════════════════════════════════
-- CEREMONIES START BLANK — owner ruling 16 Nov 2026 (16), and the owner's "Yes, all 8" on the controller's picks
-- (DECISION_LOG 16 Nov): blank is the EMPTY array `{}`, which matches nobody until the supplier picks.
-- ════════════════════════════════════════════════════════════════════════════
-- Walk W1-B8: a brand-new shop showed "Catholic · Civil · Christian" pre-ticked on its profile and its public page.
-- Nobody ticked them: `vendor_profiles.compatible_ceremony_types` has defaulted to ARRAY['catholic','civil','christian']
-- since 20260521000000, and 20271146556997 deliberately kept that default (it only lifted NOT NULL).
--
-- What `{}` means on the read side (unchanged by this file, measured in the code before writing it):
--   · Find (`app/(shell)/explore/_lib/marketplace-view.tsx`) asks `compatible_ceremony_types.is.null OR cs.{X}` —
--     `{}` contains nothing, so a shop that picked nothing is shown for NO ceremony filter;
--   · the wizard count, the couple's supplier pages and religion-readiness all test `includes` / `some` / `@>` — `{}`
--     matches none of them either. NULL stays the legacy "makes no claim" value those readers already understand.
--
-- What this changes:
--   a. DEFAULT '{}' — a new shop is born with no ceremony claimed;
--   b. a row still holding the EXACT seed array (same three values, same order — byte-identical to what the database
--      itself wrote) goes to '{}'. A shop that later ticked those three on purpose in another order is untouched; one
--      that ticked exactly them in that order is indistinguishable from the seed and is reset — it re-ticks once.
-- Idempotent: SET DEFAULT is declarative and the backfill's WHERE stops matching once it has run.
-- NEVER RUN BY HAND — it reaches prod only through merge → deploy-prod db push.

ALTER TABLE public.vendor_profiles
  ALTER COLUMN compatible_ceremony_types SET DEFAULT '{}'::TEXT[];

UPDATE public.vendor_profiles
   SET compatible_ceremony_types = '{}'::TEXT[]
 WHERE compatible_ceremony_types = ARRAY['catholic','civil','christian']::TEXT[];

COMMENT ON COLUMN public.vendor_profiles.compatible_ceremony_types IS
  'Ceremonies this shop declares it serves. ''{}'' (the default since 16 Nov 2026) = NOTHING PICKED YET = matches no '
  'ceremony filter; a populated array = ONLY these; NULL = legacy "makes no claim". Blank until the supplier picks '
  '(owner ruling 16 Nov 2026 (16)).';
