-- THE TEN THEME FACES ARE FACES A COUPLE CAN SAVE.
--
-- Owner, 2026-10-04, verbatim: "Yes to both" (DECISION_LOG.md, "THE TEN REAL THEME
-- FONTS JOIN THE FONT ▾ DROPDOWN…"). PR #6332 committed the real Event Hub theme
-- faces — Lora · Libre Baskerville · Crimson Pro · Josefin Sans · Kaushan Script ·
-- Alex Brush · Parisienne · Cookie · Mrs Saint Delafield · Monoton — declared in
-- apps/web/app/_fonts/choice-faces.ts with preload:false. They now join the Maker's
-- Look › Font dropdown (apps/web/lib/hub-fonts.ts HUB_FONT_KEYS), so a couple who
-- picks one for the whole Event Hub must not be refused by the database.
--
-- The CHECK is re-stated from its LATEST definition
-- (20271249835872_every_font_we_ship_is_a_face_a_couple_can_save.sql) with the FULL
-- current vocabulary, in the same order as HUB_FONT_KEYS, plus the ten appended —
-- `hub-fonts-are-loaded.test.ts` reads the latest migration stating this CHECK and
-- fails on any difference from the app's list.
--
-- ⛔ Only WIDENED: every key the previous CHECK accepted is still accepted, so every
-- stored value stays legal. No column, grant or view changes.
--
-- Idempotent: DROP IF EXISTS + ADD.
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_site_font_key_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_site_font_key_check
  CHECK (site_font_key IS NULL
         OR site_font_key IN ('cormorant','fraunces','playfair','caslon','vidaloka',
                              'cinzel','script','tangerine','luxurious',
                              'cormorantsc','playfairsc','bodoni','prata','instrument',
                              'cardo','gilda','cinzeldeco','italiana','marcellus',
                              'yeseva','limelight','alfaslab','oswald','syne','poiret',
                              'pinyon','herrvon','haviland','manrope','hanken','jost',
                              'quicksand','outfit','schibsted','poppins',
                              'lora','baskerville','crimson','josefin','kaushan',
                              'alexbrush','parisienne','cookie','delafield','monoton'));

COMMENT ON COLUMN public.events.site_font_key IS
  'The Event Hub''s display typeface, as the couple saved it (Event Hub Pro). One of the '
  'keys in apps/web/lib/hub-fonts.ts — every face the app ships, each declared by '
  'app/layout.tsx or app/_fonts/choice-faces.ts (including the ten theme faces, 2026-10-04). '
  'NULL means never chosen and renders as the theme''s own face. A saved face on an event '
  'without an active Event Hub Pro unlock also falls back — the gate lives in the app. '
  'Written by the website editor through the host''s own session.';

-- ── PROVE IT ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  def TEXT;
  k TEXT;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO def
    FROM pg_constraint c
   WHERE c.conrelid = 'public.events'::regclass
     AND c.conname = 'events_site_font_key_check';
  IF def IS NULL THEN
    RAISE EXCEPTION 'events_site_font_key_check is missing — a typo could become a silent fallback face';
  END IF;
  -- The ten new faces are accepted, and keys from both earlier lists still are.
  FOREACH k IN ARRAY ARRAY['lora','baskerville','crimson','josefin','kaushan','alexbrush',
                           'parisienne','cookie','delafield','monoton',
                           'cormorant','luxurious','jost','poppins','haviland'] LOOP
    IF position(quote_literal(k) IN def) = 0 THEN
      RAISE EXCEPTION 'events_site_font_key_check does not accept %', k;
    END IF;
  END LOOP;
  IF position('comic' IN def) > 0 THEN
    RAISE EXCEPTION 'events_site_font_key_check accepts a face the app does not ship';
  END IF;
END $$;
