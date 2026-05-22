-- ============================================================================
-- 20260605030000_events_dress_code_config.sql
--
-- Host-curated dress code on the public landing page (owner directive
-- 2026-05-22 — *"how can we edit the wedding's landing page/website"*).
--
-- Before this migration the dress-code section on /[slug] was hardcoded —
-- one "Look magical" palette demo + a do/don't list every couple saw the
-- same way. Hosts had no way to tell their guests what to wear.
--
-- THE SHAPE
-- ---------
-- `events.dress_code_config` is a single JSONB column carrying the four
-- host-curated pieces shown on the landing page:
--
--   {
--     title:       text   (max 80 chars · single headline)
--     description: text   (max 600 chars · 1–3 sentence guidance)
--     dos:         text[] (max 8 items · 80 chars each · "do this")
--     donts:       text[] (max 8 items · 80 chars each · "skip this")
--     palette:     [{ name: text, hex: text }]  (max 6 swatches)
--   }
--
-- The empty default ({}) is intentional — `apps/web/app/[slug]/page.tsx`
-- renders a tasteful brand-voice fallback when every field is empty so
-- guests know the section is intentional but the couple hasn't shared
-- their dress code yet.
--
-- WHY JSONB AND NOT FOUR COLUMNS
-- -------------------------------
-- The four pieces are always read together by the landing page renderer
-- and always edited together by the host editor. Splitting them across
-- separate columns would have meant four parallel UPDATEs in the server
-- action + four parallel SELECTs in the slug page query. JSONB keeps both
-- ends single-statement.
--
-- IDEMPOTENT VIA `IF NOT EXISTS` — safe to re-run.
-- ----------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS dress_code_config JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.events.dress_code_config IS
  'Host-curated dress code shown on the public landing page. Shape: '
  '{ title: text, description: text, dos: text[], donts: text[], '
  'palette: { name: text, hex: text }[] }. Editor lives at '
  '/dashboard/[eventId]/website/dress-code; renderer in '
  'apps/web/app/[slug]/page.tsx DressCodeWidget.';
