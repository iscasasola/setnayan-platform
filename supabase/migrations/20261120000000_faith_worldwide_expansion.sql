-- ============================================================================
-- 20261120000000_faith_worldwide_expansion.sql (slot 20261117 was burned by a concurrent-session ledger stub)
--
-- Faith platform expansion — owner directive 2026-06-11 ("fix all religions
-- and add the rest for the worldwide market"; completeness audit
-- Taxonomy_Events_Faiths_Completeness_Audit_2026-06-11.md).
--
-- Adds 8 faiths: Aglipayan (IFI ~1.4% PH — the audit's largest omission),
-- LDS, Seventh-day Adventist, Jehovah's Witnesses (PH-significant Christian
-- denominations), Hindu, Sikh, Buddhist, Orthodox (worldwide set).
--   • faith_vocab +8 rows (title-case keys — NEVER lowercase; === filter)
--   • 5 ceremony_type CHECKs widened with the 8 new lowercase keys
--   • wedding_type_launch_status seeds the 8 as 'coming_soon' (the 0043
--     per-faith launch lever — owner flips each active in /admin/wedding-types
--     when its content/vendor supply is ready)
-- The TS picker/label layer is extended in the SAME PR. Additive + idempotent.
-- ============================================================================

BEGIN;

-- 1. faith_vocab — the source of truth gains the 8 new keys.
INSERT INTO public.faith_vocab (faith_key, label_en, sort_order, is_civil) VALUES
  ('Aglipayan', 'Aglipayan (IFI)',          10, FALSE),
  ('LDS',       'LDS (Latter-day Saints)',  11, FALSE),
  ('SDA',       'Seventh-day Adventist',    12, FALSE),
  ('JW',        'Jehovah''s Witnesses',     13, FALSE),
  ('Hindu',     'Hindu',                    14, FALSE),
  ('Sikh',      'Sikh',                     15, FALSE),
  ('Buddhist',  'Buddhist',                 16, FALSE),
  ('Orthodox',  'Orthodox Christian',       17, FALSE)
ON CONFLICT (faith_key) DO NOTHING;

-- 2. Widen the five ceremony_type CHECKs (drop + recreate, preserving each
-- constraint's existing shape and membership exactly, + the 8 new keys).
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_ceremony_type_check;
ALTER TABLE public.events ADD CONSTRAINT events_ceremony_type_check
  CHECK (ceremony_type IS NULL OR ceremony_type = ANY (ARRAY[
    'catholic','civil','inc','christian','muslim','cultural','chinese','jewish','born_again','mixed',
    'aglipayan','lds','sda','jw','hindu','sikh','buddhist','orthodox']::text[]));

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_secondary_ceremony_check;
ALTER TABLE public.events ADD CONSTRAINT events_secondary_ceremony_check
  CHECK (secondary_ceremony_type IS NULL OR secondary_ceremony_type = ANY (ARRAY[
    'catholic','civil','inc','christian','muslim','cultural','chinese','jewish','born_again',
    'aglipayan','lds','sda','jw','hindu','sikh','buddhist','orthodox']::text[]));

ALTER TABLE public.wedding_type_launch_status DROP CONSTRAINT IF EXISTS wedding_type_launch_status_ceremony_type_check;
ALTER TABLE public.wedding_type_launch_status ADD CONSTRAINT wedding_type_launch_status_ceremony_type_check
  CHECK (ceremony_type = ANY (ARRAY[
    'catholic','civil','inc','christian','muslim','cultural','chinese','jewish','born_again',
    'aglipayan','lds','sda','jw','hindu','sikh','buddhist','orthodox']::text[]));

ALTER TABLE public.couple_wedding_type_notify_signups DROP CONSTRAINT IF EXISTS couple_wedding_type_notify_signups_ceremony_interested_check;
ALTER TABLE public.couple_wedding_type_notify_signups ADD CONSTRAINT couple_wedding_type_notify_signups_ceremony_interested_check
  CHECK (ceremony_type_interested = ANY (ARRAY[
    'catholic','civil','inc','christian','muslim','cultural','chinese','jewish','born_again',
    'aglipayan','lds','sda','jw','hindu','sikh','buddhist','orthodox']::text[]));

ALTER TABLE public.wedding_tradition_items DROP CONSTRAINT IF EXISTS wedding_tradition_items_ceremony_type_check;
ALTER TABLE public.wedding_tradition_items ADD CONSTRAINT wedding_tradition_items_ceremony_type_check
  CHECK (ceremony_type = ANY (ARRAY[
    'catholic','civil','inc','christian','muslim','cultural','chinese','mixed',
    'aglipayan','lds','sda','jw','hindu','sikh','buddhist','orthodox','jewish','born_again']::text[]));

-- 3. Launch gating: the 8 new faiths land as coming_soon (notify-me cards),
-- owner activates each from /admin/wedding-types when ready.
INSERT INTO public.wedding_type_launch_status (ceremony_type, region, status) VALUES
  ('aglipayan', 'all', 'coming_soon'),
  ('lds',       'all', 'coming_soon'),
  ('sda',       'all', 'coming_soon'),
  ('jw',        'all', 'coming_soon'),
  ('hindu',     'all', 'coming_soon'),
  ('sikh',      'all', 'coming_soon'),
  ('buddhist',  'all', 'coming_soon'),
  ('orthodox',  'all', 'coming_soon')
ON CONFLICT DO NOTHING;

-- 4. Fail loud: vocab must now hold 17 keys; every launch row's type valid.
DO $$
DECLARE n INT;
BEGIN
  SELECT count(*) INTO n FROM public.faith_vocab;
  IF n < 17 THEN RAISE EXCEPTION 'faith_vocab expected >=17 rows, found %', n; END IF;
END $$;

COMMIT;
