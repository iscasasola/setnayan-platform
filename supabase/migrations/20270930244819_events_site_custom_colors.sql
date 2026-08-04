-- ============================================================================
-- 20270930244819_events_site_custom_colors.sql
--
-- Website Pro · net-new couple-facing site colours (Launch settings-first
-- design, Design_Launch_Settings_2026-07-24 §4.4, PR-C).
--
-- Two NEW settings — Background colour + Button colour — that are part of the
-- ₱3,500 Website Pro bundle. Until now the couple site's colours came ONLY
-- from the Mood Board `role_palette` (lib/site-palette.ts → --color-* token
-- overrides). These two columns let a couple who owns Website Pro override the
-- page background and CTA/button colour directly from
-- `/dashboard/[eventId]/website/colors`.
--
-- Stored as a plain `#rrggbb` hex TEXT (validated `^#[0-9a-fA-F]{6}$` in the
-- editor action). NULLABLE with NO DEFAULT — NULL is the load-bearing "inert"
-- state: the guest site renders EXACTLY as today (Mood-Board palette only, no
-- override). The renderer additionally gates the override on ACTIVE Website Pro
-- ownership, so a non-Pro event never applies these even if a value is somehow
-- present. Fully reversible: drop the two columns and the site is unchanged.
--
-- IDEMPOTENT — ADD COLUMN IF NOT EXISTS, re-appliable without erroring.
-- ============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS site_bg_color TEXT,
  ADD COLUMN IF NOT EXISTS site_button_color TEXT;

COMMENT ON COLUMN public.events.site_bg_color IS
  'Website Pro: couple-chosen guest-site background colour as #rrggbb hex '
  '(overrides the Mood-Board-derived --color-cream token). NULL = inert / use '
  'the palette. Applied on /[slug] ONLY when set AND the event owns active '
  'COUPLE_WEBSITE_PRO. Design_Launch_Settings_2026-07-24 §4.4 (PR-C).';

COMMENT ON COLUMN public.events.site_button_color IS
  'Website Pro: couple-chosen guest-site button/CTA colour as #rrggbb hex '
  '(overrides the Mood-Board-derived --color-mulberry token + its -600/-700 '
  'hover derivatives). NULL = inert / use the palette. Applied on /[slug] ONLY '
  'when set AND the event owns active COUPLE_WEBSITE_PRO. '
  'Design_Launch_Settings_2026-07-24 §4.4 (PR-C).';
