-- THE TEN EVENT HUB THEMES — the CHECK on events.invite_theme widens to the ten.
--
-- Owner, 2026-09-24 (DECISION_LOG "THE THEME LIST, REVISED TO TEN"):
-- *"Classic · Rustic · Modern · Cinderella · Luxe · Vintage · Whimsical ·
-- Bridgerton · Great Gatsby · Cyber (Neon)"*, and 2026-09-25: themes are the ten
-- only (*"these are not our themes anymore"*). The registry is
-- apps/web/lib/invite-themes.ts; Event Hub Maker build plan §3 Phase 3.
--
-- ── IDS KEPT, IDS ADDED ─────────────────────────────────────────────────────
-- An id that already meant the same look keeps its key, so no live choice is
-- rewritten: house → Classic · abaca → Rustic · galeriya → Modern · velvet → Luxe.
-- Added: vintage · cinderella · whimsical · regency (public name Regency) ·
-- gatsby · cyber.
--
-- ── THE ONE RETIRED ID STILL STORED: `capiz` ────────────────────────────────
-- Measured 2026-09-25, read-only:
--     select invite_theme, count(*) from events group by 1;
--     → NULL: 13 · capiz: 1        (house / velvet / galeriya / abaca: 0)
-- The one `capiz` row is the owner's own PUBLIC wedding page, which he is editing
-- the night this ships. `minimalist`, `fairytale` and `custom` were never in the
-- CHECK, so no row can hold them.
--
-- 🔑 DELIBERATELY NO BACKFILL. `deploy-prod.yml` pushes migrations BEFORE the
-- Vercel build it triggers, so for the minutes between the two, the OLD code
-- serves the NEW data. Rewriting `capiz` → `vintage` here would show that page as
-- House for that window (old code has no ready `vintage`). Instead the new code
-- READS `capiz` as Vintage (`LEGACY_THEME_ALIASES`), and `capiz` stays admissible
-- here — so the page renders correctly in every order: old code + capiz = Capiz,
-- new code + capiz = Vintage. The app never WRITES `capiz` again (the picker
-- offers only the ten, and `setInviteTheme` refuses anything else).
-- ⏭ Follow-up once this has deployed: `UPDATE events SET invite_theme = 'vintage'
-- WHERE invite_theme = 'capiz'` and drop `capiz` from this list — one migration.
--
-- ── NO GRANT, NO VIEW REBUILD ───────────────────────────────────────────────
-- Only the constraint changes. The column, its grant and `events_host` are
-- untouched (20271219583821 created all three).
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_invite_theme_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_invite_theme_check
  CHECK (invite_theme IS NULL
         OR invite_theme IN ('house','abaca','galeriya','cinderella','velvet','vintage','whimsical','regency','gatsby','cyber','capiz'));

COMMENT ON COLUMN public.events.invite_theme IS
  'The Event Hub theme, as the couple saved it in the Event Hub Maker (owner 2026-09-24): '
  'house = Classic (Free) | abaca = Rustic | galeriya = Modern | cinderella | velvet = Luxe | '
  'vintage | whimsical | regency | gatsby = Great Gatsby | cyber = Cyber Neon (Event Hub Pro, '
  'COUPLE_WEBSITE_PRO). capiz is RETIRED and read as vintage by the app; never written. NULL '
  'means never chosen and renders as house. A Pro theme on an event without an active Event '
  'Hub Pro unlock also renders as house — the gate lives in the app.';
