-- a_couples_photo_says_it_was_a_real_booking
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ============================================================================
-- ✓ A COUPLE'S PHOTO ON A SUPPLIER'S CARD SAYS "VERIFIED BOOKING" — ONLY WHEN
--   IT WAS ONE.
--
-- The Supplier front page (corpus prototypes/for_suppliers_2026-11-06, README
-- "Coming soon is gone"; DECISION_LOG 2026-11-06) promises: "Photos from
-- couples — a couple shares, you approve, it lands on your card with the
-- Verified booking mark."
--
-- WHAT WAS ALREADY TRUE (20271297221336, owner 2026-10-30): a couple shares its
-- own board photo to a linked shop's card, the shop approves, and the card's
-- "From couples" strip shows it with the couple's credit line. NO MARK: the two
-- card reads returned no booking fact, and the share door lets any LINKED shop
-- receive a photo — "booked or added" — so a mark drawn on every approved photo
-- would claim a booking for a supplier the couple only added to a list.
--
-- WHAT THIS FILE ADDS: one more column on the two card reads,
-- `verified_booking`, DERIVED AT READ (never stored, never written by anybody):
-- TRUE only while the event's own supplier row names this shop, is not
-- archived, is not voided for fraud, and stands at a booked status — the set
-- `current_vendor_booked_event_ids()` and CONFIRMED_VENDOR_STATUSES
-- (apps/web/lib/events.ts) already use: contracted · deposit_paid · delivered
-- · complete. A shop booking itself is NOT a verified booking — the same
-- exclusions `vendor_completed_events` applies (the shop's owner or a team
-- member is a couple of the event; a self-comp grant). Because it is derived,
-- a booking that is cancelled, archived or voided takes the mark off on the
-- next read; nothing has to remember to.
--
-- Nothing else changes: same arguments, same filters (approved · frozen copy ·
-- audience · active card), same grants. The new column says nothing about the
-- event beyond one yes/no, and names no event, couple or status.
--
-- A RETURNS TABLE cannot gain a column through CREATE OR REPLACE, so each
-- function is dropped and created again in this one transaction, with its
-- grants restated exactly as 20271297221336 left them.
--
-- 🛑 NOT APPLIED BY HAND. deploy-prod.yml runs `supabase db push --include-all
-- --yes` on the committed file; a direct apply orphans the prod ledger.
-- ============================================================================

BEGIN;

-- ── the one rule — is this approved share a verified booking? ────────────────
-- Internal (no grant to anybody): only the two card reads below call it, as
-- their definer.
CREATE OR REPLACE FUNCTION public.couple_photo_share_is_verified_booking(
  p_event_id          UUID,
  p_vendor_profile_id UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.event_vendors ev
    JOIN public.vendor_profiles vp ON vp.vendor_profile_id = p_vendor_profile_id
    WHERE ev.event_id = p_event_id
      AND (ev.marketplace_vendor_id = p_vendor_profile_id OR ev.linked_vendor_profile_id = p_vendor_profile_id)
      AND ev.archived_at IS NULL
      AND ev.voided_by_fraud IS NOT TRUE
      AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')
      -- A shop is never its own verified booking: not when its owner is a couple of the event,
      AND NOT EXISTS (
        SELECT 1 FROM public.event_members em
        WHERE em.event_id = p_event_id AND em.member_type = 'couple' AND em.user_id = vp.user_id
      )
      -- not when one of its team is,
      AND NOT EXISTS (
        SELECT 1 FROM public.event_members em
        JOIN public.vendor_team_members vtm
          ON vtm.user_id = em.user_id AND vtm.vendor_profile_id = p_vendor_profile_id
        WHERE em.event_id = p_event_id AND em.member_type = 'couple'
      )
      -- and not when the booking is a self-comp.
      AND NOT EXISTS (
        SELECT 1 FROM public.comp_grants cg
        WHERE cg.vendor_profile_id = p_vendor_profile_id
          AND cg.source = 'vendor_self_comp'
          AND (cg.order_id = ev.vendor_id OR EXISTS (
            SELECT 1 FROM public.event_members em3
            WHERE em3.event_id = p_event_id AND em3.member_type = 'couple' AND em3.user_id = cg.created_by_user_id
          ))
      )
  );
$$;
COMMENT ON FUNCTION public.couple_photo_share_is_verified_booking(UUID, UUID) IS
  'TRUE while the event''s own supplier row names this shop at a booked status (contracted · deposit_paid · '
  'delivered · complete), not archived, not voided for fraud, and not a self-booking (owner / team is a couple '
  'of the event, or a self-comp). Derived at read for the "Verified booking" mark on a couple''s card photo.';
REVOKE ALL ON FUNCTION public.couple_photo_share_is_verified_booking(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.couple_photo_share_is_verified_booking(UUID, UUID) FROM anon, authenticated;

-- ── 7 · THE PUBLIC CARD'S PHOTOS — now with the mark ─────────────────────────
DROP FUNCTION IF EXISTS public.service_card_couple_photos(UUID[]);
CREATE OR REPLACE FUNCTION public.service_card_couple_photos(
  p_vendor_service_ids UUID[]
) RETURNS TABLE (
  vendor_service_id UUID,
  share_id          UUID,
  public_key        TEXT,
  credit_line       TEXT,
  verified_booking  BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.vendor_service_id, s.share_id, s.public_key, s.credit_line,
         public.couple_photo_share_is_verified_booking(s.event_id, s.vendor_profile_id)
  FROM public.couple_photo_shares s
  JOIN public.vendor_services vs ON vs.vendor_service_id = s.vendor_service_id
  WHERE s.vendor_service_id = ANY (COALESCE(p_vendor_service_ids, ARRAY[]::UUID[]))
    AND s.state = 'approved'
    AND s.public_key IS NOT NULL
    AND s.audience = 'public'
    AND vs.is_active IS TRUE
  ORDER BY s.vendor_service_id, s.decided_at DESC
  LIMIT 500;
$$;
COMMENT ON FUNCTION public.service_card_couple_photos(UUID[]) IS
  'The public service card''s "From couples" photos: APPROVED, audience PUBLIC shares only, as their own '
  'frozen copy (couple-looks/<share_id>/<attempt>.<ext>) + credit line + verified_booking (derived at read: '
  'the shop is booked on that event) — never the couple''s board row, nothing that names the event. '
  'Waiting / declined / withdrawn never leave here.';
REVOKE ALL ON FUNCTION public.service_card_couple_photos(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.service_card_couple_photos(UUID[]) TO anon, authenticated;

-- ── 8 · THE SIGNED-IN VIEWER'S EXTRA PHOTOS — now with the mark ──────────────
DROP FUNCTION IF EXISTS public.viewer_service_card_couple_photos(UUID[]);
CREATE OR REPLACE FUNCTION public.viewer_service_card_couple_photos(
  p_vendor_service_ids UUID[]
) RETURNS TABLE (
  vendor_service_id UUID,
  share_id          UUID,
  public_key        TEXT,
  credit_line       TEXT,
  audience          TEXT,
  verified_booking  BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.vendor_service_id, s.share_id, s.public_key, s.credit_line, s.audience,
         public.couple_photo_share_is_verified_booking(s.event_id, s.vendor_profile_id)
  FROM public.couple_photo_shares s
  JOIN public.vendor_services vs ON vs.vendor_service_id = s.vendor_service_id
  WHERE auth.uid() IS NOT NULL
    AND s.vendor_service_id = ANY (COALESCE(p_vendor_service_ids, ARRAY[]::UUID[]))
    AND s.state = 'approved'
    AND s.public_key IS NOT NULL
    AND s.audience <> 'public'
    AND vs.is_active IS TRUE
    AND (
      s.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
      OR (s.audience = 'hosts' AND s.event_id IN (SELECT public.current_couple_event_ids()))
      OR (s.audience IN ('exclusive', 'private') AND s.event_id IN (SELECT public.current_event_ids()))
    )
  ORDER BY s.vendor_service_id, s.decided_at DESC
  LIMIT 500;
$$;
COMMENT ON FUNCTION public.viewer_service_card_couple_photos(UUID[]) IS
  'A signed-in viewer''s NON-public "From couples" photos: approved shares whose audience '
  'admits them — hosts (the couple), exclusive + private (every event member; private fails '
  'closed to exclusive), and always the approving shop''s team — each with verified_booking '
  '(derived at read). Never anon; never cached.';
REVOKE ALL ON FUNCTION public.viewer_service_card_couple_photos(UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.viewer_service_card_couple_photos(UUID[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.viewer_service_card_couple_photos(UUID[]) TO authenticated;

COMMIT;
