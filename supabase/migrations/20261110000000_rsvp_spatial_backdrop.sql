-- RSVP spatial backdrop (Wedding_Website_Effects_and_Editing_Spec_2026-06-11 §2.1b).
--
-- One nullable JSONB on events: `{ "theme": "<registry key>", "intensity":
-- "subtle" | "standard" | "lavish" }`, or NULL = no backdrop. The couple picks
-- an AI-generated "world" that renders fixed behind their public RSVP page
-- (/[slug]) with scroll-linked spatial depth. The DB stores ONLY the theme key
-- + intensity word — asset paths live in the code registry
-- (apps/web/lib/spatial-backdrop.ts), so a hostile row cannot inject arbitrary
-- image URLs into the public page; unknown keys parse to NULL (backdrop off).
--
-- RLS: no new policies needed — `events` UPDATE is already host-scoped, and
-- the public page reads via the admin client like every other landing column
-- (slug-scoped single-row fetch, no PII in this column).
--
-- Additive + idempotent; safe on a live database.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS rsvp_backdrop JSONB DEFAULT NULL;

COMMENT ON COLUMN public.events.rsvp_backdrop IS
  'Spatial backdrop config for the public RSVP page: {theme, intensity} or NULL (off). Theme keys resolve against the code registry in apps/web/lib/spatial-backdrop.ts; unknown keys are treated as off.';
