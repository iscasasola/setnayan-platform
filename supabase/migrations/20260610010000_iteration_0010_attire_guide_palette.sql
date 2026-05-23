-- Iteration 0010 · Wedding Attire Guide per-role palette
-- ----------------------------------------------------------------------
-- Owner directive 2026-05-23 PM: "we want the capability to change the
-- color of the attires of each role." The V1 Wedding Attire Guide
-- clickable mockup at /dashboard/[eventId]/add-ons/mood-board (component
-- _components/wedding-attire-guide.tsx) tints SVG silhouette figures
-- with the host's chosen colors per role. This column persists those
-- choices so the host doesn't lose work between visits AND so the V1.x
-- Professional Mood Board engine (Higgsfield/Recraft + SAM2 + Color
-- Range Manipulator) has the per-role attire colors as prompt inputs
-- when it ships parallel to the Stylist marketplace launch.
--
-- Schema shape: JSONB object with role-key → hex-color entries. The 10
-- canonical role keys come from the WeddingAttireGuide component:
--   female_ps · male_ps · mothers · fathers · bridesmaids · bride ·
--   groom · groomsmen · guests · men_guests
-- Missing keys fall back to the component's per-role defaultHex (see
-- the ROLES array in wedding-attire-guide.tsx). Empty {} = use all
-- defaults.
--
-- Distinct from `events.role_palette` (existing JSONB used by V1
-- PaletteEditor for the 5-key palette: principal_sponsors /
-- wedding_party / bride / groom / guest). The Attire Guide needs more
-- granular keys (female vs male PS, mothers vs fathers, etc.) than the
-- V1 palette structure provides, so it gets its own dedicated column.
-- Future V1.x cleanup may unify these into one schema if granularity
-- changes; for now they stay separate for clean separation of concerns.
--
-- Idempotent via IF NOT EXISTS — safe to re-run.
-- ----------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS attire_guide_palette JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.events.attire_guide_palette IS
  'Wedding Attire Guide per-role attire colors. Owner directive
   2026-05-23 PM. Stored as { [roleKey]: "#RRGGBB" } where roleKey is
   one of: female_ps | male_ps | mothers | fathers | bridesmaids |
   bride | groom | groomsmen | guests | men_guests. Empty {} = use
   defaults from wedding-attire-guide.tsx ROLES array. V1: written by
   the Wedding Attire Guide clickable mockup. V1.x: consumed by
   Professional Mood Board engine as Higgsfield/Recraft prompt inputs
   for per-role figure attire colors in the AI-rendered group portrait.';
