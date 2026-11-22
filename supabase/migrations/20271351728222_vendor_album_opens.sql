-- vendor album opens
-- ============================================================================
-- 🖼 "OPENED BY YOU" — THE ALBUMS A SHOP OPENED LAST (Portfolio, simpler · owner
-- 2026-11-19 "portfolio simpler approved"; drawing artifact 7SfMdJW9mryK59pm7bKa5A).
--
-- The Portfolio's Sort offers "Opened by you": the shop's albums ordered by when
-- its own people last opened each one. Nothing recorded that, so this is the
-- record: one row per (shop, album), `opened_at` = the LAST open.
--
-- An album has no table of its own — it is a group the Portfolio already draws
-- (`lib/portfolio-groups.ts`): the page gallery, one per event, one per service
-- card, one per inspiration part. So a row is keyed on (album_kind, album_key),
-- the key being what that group is already keyed on (an event id, a service id,
-- a part name, or 'page'). No FK to the album: the group is computed, and a row
-- whose album is gone is simply never drawn.
--
-- ⛔ NO VIEW COUNTER HERE, ON PURPOSE. "Most viewed" reads the counters the app
-- already has — `service_card_opens()` (20271337268841) and
-- `vendor_portfolio_photo_views` (20271331531509). A second counter for the same
-- fact would be a competing source of truth.
--
-- WHO WRITES: the shop's own signed-in people, through RLS (the shop's own rows
-- only, both halves of the predicate) — the same small own-row write as
-- `notice_closes`. It holds no user id: the row belongs to the shop.
--
-- RLS AT CREATE TIME. NEVER APPLIED BY HAND — the pipeline pushes it.
-- Created via `pnpm migration:new`. KEEP IDEMPOTENT.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_album_opens (
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  album_kind        TEXT NOT NULL CHECK (album_kind IN ('page', 'event', 'service', 'inspiration')),
  album_key         TEXT NOT NULL CHECK (char_length(album_key) BETWEEN 1 AND 200),
  opened_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (vendor_profile_id, album_kind, album_key)
);

COMMENT ON TABLE public.vendor_album_opens IS
  'Portfolio "Opened by you" — when a shop''s own people last opened each of its albums (album_kind + album_key = the group lib/portfolio-groups.ts draws). One row per shop and album; holds no user id. Not a view counter: couples'' views stay in service_card_opens() and vendor_portfolio_photo_views.';

ALTER TABLE public.vendor_album_opens ENABLE ROW LEVEL SECURITY;

-- The shop's own rows only, every verb it uses, both halves of the predicate.
DROP POLICY IF EXISTS vendor_album_opens_vendor_select ON public.vendor_album_opens;
CREATE POLICY vendor_album_opens_vendor_select ON public.vendor_album_opens
  FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS vendor_album_opens_vendor_insert ON public.vendor_album_opens;
CREATE POLICY vendor_album_opens_vendor_insert ON public.vendor_album_opens
  FOR INSERT TO authenticated
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS vendor_album_opens_vendor_update ON public.vendor_album_opens;
CREATE POLICY vendor_album_opens_vendor_update ON public.vendor_album_opens
  FOR UPDATE TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

-- ALTER DEFAULT PRIVILEGES hands anon + authenticated everything on a new relation. Revoke first, then grant back
-- exactly the three verbs the three policies above use. anon gets nothing; nobody deletes (the shop's cascade does).
REVOKE ALL ON TABLE public.vendor_album_opens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.vendor_album_opens TO authenticated;

COMMIT;
