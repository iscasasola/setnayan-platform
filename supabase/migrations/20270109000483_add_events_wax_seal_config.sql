-- Candle Stamp Maker (0024 §3 · PR2) — the couple-minted wax-seal recipe for the
-- Save-the-Date reveal. DETERMINISTIC config + seed (NOT a per-couple image):
-- the monogram SVG (monogram_uploaded_svg ?? monogram_custom_svg) is the stamp
-- DIE, read live; this column stores only the wax / pour / press levers + the
-- pour seed. paintWaxSeal (lib/wax-seal/paint.ts) renders it client-side, so the
-- seal recolours to the moodboard deep accent at ₱0 and looks identical in the
-- maker preview and the live guest reveal. Free — included with the website.
--
-- RLS: events already carries RLS. Couples UPDATE their own row via the existing
-- `couple_can_update_event` policy (20260512000000_setnayan_base.sql:254-263);
-- the saveWaxSeal action writes through the couple's authenticated client, so the
-- policy is the database-level enforcement. The public reveal READS it via the
-- admin client in app/[slug]/page.tsx (anonymous visitors). No new policy needed;
-- ON DELETE of the event carries it away (RA 10173). Additive + nullable +
-- idempotent + length-capped (mirrors the monogram_cipher_config precedent).

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS wax_seal_config JSONB
    CHECK (wax_seal_config IS NULL OR length(wax_seal_config::text) <= 4096);

COMMENT ON COLUMN public.events.wax_seal_config IS
  'Candle Stamp Maker (0024 §3): deterministic minted wax-seal recipe {v, seed, wax{color,finish}, pour{amount,irregularity,bubbles}, press{crispness,depth,offset,skew}, mark, isDefault}. Rendered CLIENT-SIDE by paintWaxSeal from the monogram die + moodboard accent — never an image, recolours at ₱0. Validated by sanitizeWaxSealConfig before write. NULL = not minted → render from a public_id-derived fallback seed.';

COMMIT;
