-- ============================================================================
-- A shop is born making NO claim about venues — and can say so out loud
-- ============================================================================
--
-- ── 1 · THE DEFAULT NARROWED EVERY NEW SHOP ─────────────────────────────────
--
-- `vendor_profiles.compatible_venue_settings` has shipped since iteration 0043
-- with DEFAULT ARRAY['banquet_hall','garden','heritage']. The read side asks
--
--     compatible_venue_settings.is.null , compatible_venue_settings.cs.{X}
--
-- (app/(shell)/explore/page.tsx · lib/wizard-recommendations.ts), so NULL means
-- "makes no claim — show me to everyone" and a populated array means "ONLY
-- these". The default therefore does not open a shop up; it NARROWS it, to
-- three settings the shop never chose. A couple with a beach, resort, tent,
-- city-hall or restaurant reception sees fewer suppliers than actually exist.
--
-- Verified in production before writing this: the default is still that array
-- and BOTH live shops hold exactly it — one of them literally named
-- "(FIXTURE)". lib/vendor-compatibility.ts already records why: the columns
-- shipped with a reader, a filter, a validator and a public badge, and no
-- writer at all, so every shop matched on whatever the seed left behind.
--
-- ── 2 · AND THE WRITER THAT NOW EXISTS COULD NOT SAVE "I SERVE EVERYONE" ────
--
-- `parseCompatibility` returns NULL, never [], when nothing is ticked — its own
-- docblock explains that this is load-bearing, because [] would match NOBODY.
-- `saveVenueMatch` writes that NULL straight into a NOT NULL column.
--
-- Probed against production in a rolled-back transaction: the UPDATE is
-- REFUSED with sqlstate 23502 (not-null violation). The action maps 42703,
-- 42P01 and 23514 to friendly words and does NOT map 23502, so a shop owner
-- who unticked every setting to say "I take any venue" got a raw Postgres
-- string and no save — permanently. Same family as the location_city CHECK:
-- the database refuses, nothing throws in CI, and the only symptom is that a
-- control does not work.
--
-- ── WHAT THIS CHANGES ───────────────────────────────────────────────────────
--
--   a. DROP NOT NULL on BOTH compatibility columns. They are written together
--      in ONE update, so leaving either NOT NULL keeps the whole save failing
--      whenever the other one is cleared.
--   b. DEFAULT NULL on compatible_venue_settings only.
--   c. Backfill the venue column to NULL for rows still holding the EXACT seed
--      array, restoring them to "no claim".
--
-- ⚠ `compatible_ceremony_types` KEEPS its DEFAULT ARRAY['catholic','civil',
-- 'christian']. That default is deliberate and documented in migration
-- 20260521000000: shops must OPT IN to serving INC, Muslim and Cultural
-- ceremonies so a couple is not shown a supplier who cannot serve them (the
-- alcohol-serving caterer surfaced to an INC couple). Widening that is a
-- product and sensitivity call, not a defect, and it is NOT made here. Only
-- its NOT NULL is lifted, so the shipped control can save.
--
-- The backfill matches the seed array EXACTLY (same three values, same order)
-- rather than as a set. That is the narrowest possible predicate: it can only
-- touch a row that is byte-identical to what the database itself wrote, and it
-- can only ever WIDEN that shop's visibility. Both current production rows
-- qualify. A shop that later ticks those same three deliberately is not
-- affected, because this runs once.
--
-- Fully idempotent: DROP NOT NULL / SET DEFAULT are declarative, and the
-- backfill's WHERE clause stops matching the moment it has run.
-- ============================================================================

ALTER TABLE public.vendor_profiles
  ALTER COLUMN compatible_venue_settings DROP NOT NULL,
  ALTER COLUMN compatible_venue_settings SET DEFAULT NULL,
  ALTER COLUMN compatible_ceremony_types DROP NOT NULL;

UPDATE public.vendor_profiles
   SET compatible_venue_settings = NULL
 WHERE compatible_venue_settings = ARRAY['banquet_hall','garden','heritage']::TEXT[];

COMMENT ON COLUMN public.vendor_profiles.compatible_venue_settings IS
  'Reception settings this shop declares it serves. NULL = MAKES NO CLAIM = '
  'visible to every couple; a populated array = ONLY these. The read side is '
  '"is.null OR contains{setting}", so NULL is the OPEN value and an array is '
  'the narrowing one. Defaults to NULL so a new shop starts unnarrowed — it '
  'previously defaulted to banquet_hall+garden+heritage, which silently hid '
  'every shop from beach, resort, tent, city-hall and restaurant receptions. '
  'Written by saveVenueMatch (the Wedding fit card in /vendor-dashboard/shop).';

COMMENT ON COLUMN public.vendor_profiles.compatible_ceremony_types IS
  'Ceremonies this shop declares it serves. NULL = makes no claim = visible to '
  'every couple. DEFAULT catholic+civil+christian is DELIBERATE (migration '
  '20260521000000): serving INC, Muslim and Cultural ceremonies is opt-in so a '
  'couple is not shown a supplier who cannot serve them. Nullable so the '
  'Wedding fit card can save when a shop clears every tick.';
