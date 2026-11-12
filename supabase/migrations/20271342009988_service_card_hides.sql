-- service_card_hides
-- ============================================================================
-- 🃏 HIDE PER CARD NEVER DELETES (Build 5 Lane C — DECISION_LOG 2026-11-10 "SERVICE CARD GROWN — PROTOTYPE APPROVED":
-- "… and hide per card never deletes"; plan `plans/supplier_build_5_2026-11-10/00-BUILD-5-PLAN.md` Lane C: "New table
-- keyed (card × item). NOT a column on the photo.").
--
-- In the grown card the supplier taps a photo, the clip, an event or an inspiration photo to hide it ON THIS CARD
-- only: it greys out, says "Hidden on this card", and a second tap restores it. Nothing is deleted, and it stays on the
-- shop page, the Portfolio, Inspiration and every other card. Couples (and the supplier's 👁 Couple view) get the card
-- without it.
--
-- One row = one hidden (card × item). The item is named by a KIND and a KEY the app derives from what the card already
-- carries — never a new id:
--   photo  the showcase photo's stored ref (`vendor_services.showcase_photo_r2_keys[]` entry)
--   clip   the clip's stored ref (`vendor_services.showcase_video_r2_key`)
--   event  the anonymised record line (type · month · guest band, + its occurrence) — the record carries NO event id on
--          purpose (`service_card_records`), so nor does this
--   insp   the approved inspiration look's id
-- A key that no longer matches anything simply hides nothing.
--
-- 🔑 NO vendor_profile_id COLUMN, ON PURPOSE: a second foreign key to vendor_profiles beside vendor_services makes
-- PostgREST read the table as a junction and every services→shop embed fails with PGRST201 (prod incident 2026-11-12,
-- 20271339373845). The shop is reached through the card.
--
-- RLS AT CREATE TIME (pattern C, vendor-owned): the shop's owner/admin team (`current_vendor_profile_ids()`) reads,
-- adds and removes its own cards' rows; admins read. anon has nothing. The public shop page reads it on the server.
-- NEVER APPLIED BY HAND — the pipeline pushes it. KEEP IDEMPOTENT.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_service_card_hides (
  vendor_service_id UUID NOT NULL
                      REFERENCES public.vendor_services(vendor_service_id) ON DELETE CASCADE,
  item_kind         TEXT NOT NULL CHECK (item_kind IN ('photo', 'clip', 'event', 'insp')),
  item_key          TEXT NOT NULL CHECK (length(item_key) BETWEEN 1 AND 600),
  hidden_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (vendor_service_id, item_kind, item_key)
);

ALTER TABLE public.vendor_service_card_hides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_service_card_hides_select ON public.vendor_service_card_hides;
CREATE POLICY vendor_service_card_hides_select
  ON public.vendor_service_card_hides FOR SELECT
  TO authenticated
  USING (
    vendor_service_id IN (
      SELECT s.vendor_service_id FROM public.vendor_services s
       WHERE s.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    )
    OR (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS vendor_service_card_hides_insert ON public.vendor_service_card_hides;
CREATE POLICY vendor_service_card_hides_insert
  ON public.vendor_service_card_hides FOR INSERT
  TO authenticated
  WITH CHECK (
    vendor_service_id IN (
      SELECT s.vendor_service_id FROM public.vendor_services s
       WHERE s.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    )
  );

DROP POLICY IF EXISTS vendor_service_card_hides_delete ON public.vendor_service_card_hides;
CREATE POLICY vendor_service_card_hides_delete
  ON public.vendor_service_card_hides FOR DELETE
  TO authenticated
  USING (
    vendor_service_id IN (
      SELECT s.vendor_service_id FROM public.vendor_services s
       WHERE s.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    )
  );

-- No UPDATE: a hide is added or removed, never edited.
REVOKE ALL ON public.vendor_service_card_hides FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.vendor_service_card_hides TO authenticated;
GRANT INSERT (vendor_service_id, item_kind, item_key) ON public.vendor_service_card_hides TO authenticated;

COMMENT ON TABLE public.vendor_service_card_hides IS
  'Hide per card never deletes (DECISION_LOG 2026-11-10 "SERVICE CARD GROWN — PROTOTYPE APPROVED"). One row = one item (photo · clip · event line · inspiration look) the shop hid on ONE card; it stays everywhere else. Couples and the 👁 Couple view get the card without it. Written by the shop''s owner/admin team under RLS; the public shop page reads it on the server.';

COMMIT;
