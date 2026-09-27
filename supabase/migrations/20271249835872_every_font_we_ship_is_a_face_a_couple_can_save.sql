-- EVERY FONT WE SHIP IS A FACE A COUPLE CAN SAVE.
--
-- Owner, 2026-09-27: "remember to use all our fonts on the dropdown". The Maker's
-- Font dropdown (per element, per letter, and the Event Hub-wide typeface) now
-- offers every family the repo ships — the nine it had, plus twenty-six more
-- (apps/web/lib/hub-fonts.ts; the new faces are declared in
-- apps/web/app/_fonts/choice-faces.ts with preload:false, so a face nobody chose
-- costs a guest nothing).
--
-- The Event Hub-wide choice is stored in `events.site_font_key`, whose CHECK
-- (20271242571950) names exactly the nine keys. Left alone, a couple who picks
-- Jost for the whole Event Hub is refused by the database. So the CHECK is
-- re-stated with the full list — the same list, in the same order, as
-- HUB_FONT_KEYS (`hub-fonts-are-loaded.test.ts` compares the two and fails on
-- any difference).
--
-- ⛔ Only WIDENED: the nine original keys are unchanged, so every stored value
-- stays legal. No column, grant or view changes — the events_host projection is
-- computed from column grants, and none move here.
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
                              'quicksand','outfit','schibsted','poppins'));

COMMENT ON COLUMN public.events.site_font_key IS
  'The Event Hub''s display typeface, as the couple saved it (Event Hub Pro). One of the '
  'keys in apps/web/lib/hub-fonts.ts — every face the app ships, each declared by '
  'app/layout.tsx or app/_fonts/choice-faces.ts. NULL means never chosen and renders as the '
  'theme''s own face. A saved face on an event without an active Event Hub Pro unlock also '
  'falls back — the gate lives in the app. Written by the website editor through the host''s '
  'own session.';

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
  -- A face the app offers must be one the database accepts, and the nine stored
  -- keys must still be legal.
  FOREACH k IN ARRAY ARRAY['cormorant','luxurious','jost','poppins','haviland'] LOOP
    IF position(quote_literal(k) IN def) = 0 THEN
      RAISE EXCEPTION 'events_site_font_key_check does not accept %', k;
    END IF;
  END LOOP;
  IF position('comic' IN def) > 0 THEN
    RAISE EXCEPTION 'events_site_font_key_check accepts a face the app does not ship';
  END IF;
END $$;
