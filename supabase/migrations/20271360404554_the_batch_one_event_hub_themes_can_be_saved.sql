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
