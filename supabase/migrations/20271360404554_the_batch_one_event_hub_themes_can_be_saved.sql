-- the_batch_one_event_hub_themes_can_be_saved
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

--
-- 🖼 EVENT HUB THEMES REDRAW, BATCH 1 (owner 23 Nov: "Yes, this level" → "themes batch 6 approved"; DECISION_LOG
-- "EVENT HUB THEMES ROUND 2" and "BATCH 6 APPROVED"). Five new Pro themes a couple can save: perlas · waling · hagdan ·
-- solihiya, and capiz, which is a LIVE theme again (no longer read as Vintage — the one row that held it now wears the
-- new Capiz). The ten stay. Only widens the list, so no saved row can fail it. Each later batch widens it again.
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_invite_theme_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_invite_theme_check
  CHECK (invite_theme IS NULL
         OR invite_theme IN ('house','abaca','galeriya','cinderella','velvet','vintage','whimsical','regency','gatsby','cyber',
                             'capiz','perlas','waling','hagdan','solihiya'));

COMMENT ON COLUMN public.events.invite_theme IS
  'The Event Hub theme, as the couple saved it in the Event Hub Maker (lib/invite-themes.ts is the one registry). '
  'house = Classic (Free) | abaca = Rustic | galeriya = Modern | cinderella | velvet = Luxe | vintage | whimsical | '
  'regency | gatsby = Great Gatsby | cyber = Cyber Neon | capiz · perlas · waling = Waling-waling · hagdan · solihiya '
  '(the 23 Nov redraw, batch 1: one still picture each). Every theme but the free ones is Event Hub Pro '
  '(COUPLE_WEBSITE_PRO). NULL means never chosen and renders as house. A Pro theme on an event without an active '
  'Event Hub Pro unlock also renders as house — the gate lives in the app.';

-- 🔤 …and the faces batch 1 brings are faces a couple can save (lib/hub-fonts.ts — every face the app ships is in the
-- Maker's dropdown, owner 2026-09-27 "use all our fonts on the dropdown"). Only widens the list.
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
                              'alexbrush','parisienne','cookie','delafield','monoton',
                              'raleway','gloock','mulish','worksans','epilogue','newsreader'));

DO $$
DECLARE
  theme_def TEXT;
  font_def TEXT;
  k TEXT;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO theme_def FROM pg_constraint c
   WHERE c.conrelid = 'public.events'::regclass AND c.conname = 'events_invite_theme_check';
  SELECT pg_get_constraintdef(c.oid) INTO font_def FROM pg_constraint c
   WHERE c.conrelid = 'public.events'::regclass AND c.conname = 'events_site_font_key_check';
  IF theme_def IS NULL OR font_def IS NULL THEN
    RAISE EXCEPTION 'a CHECK is missing — a typo could become a silent fallback';
  END IF;
  FOREACH k IN ARRAY ARRAY['house','cyber','gatsby','capiz','perlas','waling','hagdan','solihiya'] LOOP
    IF position(quote_literal(k) IN theme_def) = 0 THEN
      RAISE EXCEPTION 'events_invite_theme_check does not accept %', k;
    END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['cormorant','monoton','raleway','gloock','mulish','worksans','epilogue','newsreader'] LOOP
    IF position(quote_literal(k) IN font_def) = 0 THEN
      RAISE EXCEPTION 'events_site_font_key_check does not accept %', k;
    END IF;
  END LOOP;
END $$;
