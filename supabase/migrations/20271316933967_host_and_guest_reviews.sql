-- host_and_guest_reviews
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ⭐👥 HOST REVIEWS AND GUEST REVIEWS ARE DIFFERENT (owner, 6 Nov 2026).
--
-- Owner, verbatim: *"Guest review and cohosts' review are different. Cohosts reviews are the ones who experience
-- planning with the supplier. Guests only experience the end result."* Owner answers (clicked, 6 Nov ~13:30 PHT):
--   (1) a shop's overall stars = HOSTS / CO-HOSTS ONLY; guest reviews show in their own section, never move the stars;
--   (2) a guest who writes a review gets the supplier's gift if the supplier set one, otherwise a thank-you;
--   (3) COORDINATORS DO NOT WRITE HOST REVIEWS of other suppliers (conflict of interest);
-- and on the one-store question (clicked, 6 Nov): ONE guest-review store, ONE "From guests" section; the guest is
-- shown as first name + initial ("Gabriel D."); a guest review is PUBLIC AT ONCE and Setnayan admin can hide it (no
-- approval queue); the gate is a door check-in (`guest_checkins`) OR a received scanner claim, through ONE writer
-- that both doors call. Prototype: claude.ai/artifact/GWJhmWLcRijfyofpTLLs8o, sections 7–10.
--
-- This migration:
--   1. vendor_reviews (the HOST review) — the INSERT gate admits member_type = 'couple' ONLY (the couple + their
--      co-hosts; `current_couple_event_ids()`), so a coordinator's INSERT is refused by the database, not only by the
--      server action. DELETE follows the same helper (it was couple-or-coordinator since 20270206186005).
--      The event_vendors predicate is kept EXACTLY as live (see ⚠ below) — this migration changes WHO, not WHEN.
--   2. vendor_reviews.service_id — the service card the review is for ("A review shows the service, not its price",
--      6 Nov). Nullable: every review written before today has no card and shows no "For" line; nothing is guessed.
--   3. vendor_guest_reviews — the GUEST review. Its own table (a guest row would have to NULL four required host
--      axes and every host stats view would blend it in by accident). Pattern D served server-side: the public reads
--      what is not hidden through the server; the shop's team and Setnayan admin may SELECT by policy; anon has no
--      grant. NO direct INSERT/UPDATE/DELETE for anyone: written only by `vendor_guest_review_submit` (service role),
--      replied to only through `vendor_guest_review_reply` (the shop's own team, once), hidden by Setnayan admin
--      through the admin console (service role).
--   4. vendor_guest_review_stats — a view beside, never inside, `vendor_trusted_review_stats` (owner ruling 1).
--
-- ⚠ FOUND, NOT FIXED HERE: the live `vendor_reviews_couple_insert` (as re-created by 20270321252758 and rewritten by
-- 20271281556823) checks that SOME supplier on the event is delivered/complete — it does not correlate the
-- event_vendors row to the supplier being reviewed (20270206186005 did; 20270321252758 dropped it). The review page
-- and `submitCoupleReview` gate per supplier through the completion handshake, so the app is correct; the database
-- floor is looser than the app. Restoring the correlation also needs the contact-email-linked bookings (no
-- `marketplace_vendor_id`) handled, so it is surfaced to the controller rather than changed in a review-kind PR.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Host review — couples and co-hosts only (owner ruling 3).
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS vendor_reviews_couple_insert ON public.vendor_reviews;
CREATE POLICY vendor_reviews_couple_insert
  ON public.vendor_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    couple_user_id = (SELECT auth.uid())
    -- 🔒 member_type = 'couple' only: the couple and their co-hosts. A coordinator is a supplier too and must not
    -- rate the other suppliers on an event they run (owner, 6 Nov: conflict of interest).
    AND event_id IN (SELECT public.current_couple_event_ids())
    AND EXISTS (
      SELECT 1 FROM public.event_vendors ev
       WHERE ev.event_id = vendor_reviews.event_id
         AND ev.status IN ('delivered', 'complete')
    )
  );

DROP POLICY IF EXISTS vendor_reviews_couple_delete ON public.vendor_reviews;
CREATE POLICY vendor_reviews_couple_delete
  ON public.vendor_reviews FOR DELETE
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

-- ---------------------------------------------------------------------------
-- 2. The service card a host review is for.
-- ---------------------------------------------------------------------------

ALTER TABLE public.vendor_reviews
  ADD COLUMN IF NOT EXISTS service_id UUID
    REFERENCES public.vendor_services (vendor_service_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS vendor_reviews_service_id_idx
  ON public.vendor_reviews (service_id) WHERE service_id IS NOT NULL;

COMMENT ON COLUMN public.vendor_reviews.service_id IS
  'The service card this host review is for — the booking''s event_vendors.service_id, or the card the couple picked when they booked several from one shop. NULL for reviews written before 2026-11-06 (no "For" line; nothing guessed). One review per supplier per event still (UNIQUE (vendor_profile_id, event_id)).';

-- ---------------------------------------------------------------------------
-- 3. vendor_guest_reviews — what a guest who was there saw.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_guest_reviews (
  review_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id  UUID NOT NULL REFERENCES public.vendor_profiles (vendor_profile_id) ON DELETE CASCADE,
  event_id           UUID NOT NULL,
  guest_id           UUID NOT NULL,
  service_id         UUID REFERENCES public.vendor_services (vendor_service_id) ON DELETE SET NULL,
  rating_overall     SMALLINT NOT NULL CHECK (rating_overall BETWEEN 1 AND 5),
  line               TEXT CHECK (line IS NULL OR char_length(line) <= 140),
  capture_id         UUID REFERENCES public.papic_guest_captures (capture_id) ON DELETE SET NULL,
  shown_as           TEXT NOT NULL DEFAULT 'name',
  door               TEXT NOT NULL,
  vendor_reply       TEXT CHECK (vendor_reply IS NULL OR char_length(vendor_reply) <= 500),
  vendor_reply_at    TIMESTAMPTZ,
  hidden_at          TIMESTAMPTZ,
  hidden_by_user_id  UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (event_id, guest_id) REFERENCES public.guests (event_id, guest_id) ON DELETE CASCADE,
  -- One per guest per supplier per event — the same shape as the hosts' rule.
  UNIQUE (vendor_profile_id, event_id, guest_id)
);

ALTER TABLE public.vendor_guest_reviews ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vendor_guest_reviews DROP CONSTRAINT IF EXISTS vendor_guest_reviews_shown_as_check;
ALTER TABLE public.vendor_guest_reviews
  ADD CONSTRAINT vendor_guest_reviews_shown_as_check CHECK (shown_as IN ('name', 'initials'));
-- Which proof admitted the guest: the door's check-in, or a supplier scanner claim marked received.
ALTER TABLE public.vendor_guest_reviews DROP CONSTRAINT IF EXISTS vendor_guest_reviews_door_check;
ALTER TABLE public.vendor_guest_reviews
  ADD CONSTRAINT vendor_guest_reviews_door_check CHECK (door IN ('checkin', 'scan'));

CREATE INDEX IF NOT EXISTS vendor_guest_reviews_vendor_idx
  ON public.vendor_guest_reviews (vendor_profile_id, created_at DESC) WHERE hidden_at IS NULL;
CREATE INDEX IF NOT EXISTS vendor_guest_reviews_event_idx ON public.vendor_guest_reviews (event_id);
CREATE INDEX IF NOT EXISTS vendor_guest_reviews_guest_idx ON public.vendor_guest_reviews (guest_id);
CREATE INDEX IF NOT EXISTS vendor_guest_reviews_service_idx
  ON public.vendor_guest_reviews (service_id) WHERE service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS vendor_guest_reviews_capture_idx
  ON public.vendor_guest_reviews (capture_id) WHERE capture_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS vendor_guest_reviews_hidden_by_idx
  ON public.vendor_guest_reviews (hidden_by_user_id) WHERE hidden_by_user_id IS NOT NULL;

COMMENT ON TABLE public.vendor_guest_reviews IS
  'A guest''s review of a supplier they saw at an event (owner 2026-11-06: guests experience only the end result). Overall stars + one line (140) + an optional Papic shot of their own. One per guest per supplier per event. Public at once; Setnayan admin can hide (hidden_at). Written ONLY by vendor_guest_review_submit (service role) after a door check-in or a received scanner claim. Never counted in vendor_trusted_review_stats / vendor_review_stats — the shop''s stars are hosts only.';

-- Pattern D, SERVED SERVER-SIDE (the hosts' reviews are read the same way: `fetchReviewsForVendorWithCouple(admin, …)`
-- on /v/<slug>). The public reads what is not hidden THROUGH THE SERVER, which names the guest as "Gabriel D." — so
-- `anon` gets NO grant at all (a REST read would hand out guest_id / event_id for nothing). `authenticated` may SELECT
-- only what the two policies below admit: the shop's own team, and Setnayan admin. No direct writes for anyone: the
-- writer, the reply and the admin hide are functions / the service role.
REVOKE ALL ON public.vendor_guest_reviews FROM anon;
REVOKE ALL ON public.vendor_guest_reviews FROM authenticated;
GRANT SELECT ON public.vendor_guest_reviews TO authenticated;

DROP POLICY IF EXISTS vendor_guest_reviews_team_read ON public.vendor_guest_reviews;
CREATE POLICY vendor_guest_reviews_team_read
  ON public.vendor_guest_reviews FOR SELECT
  TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    -- the shop's owning account, as the hosts' reply policy reads it (an owner with no team row still owns the shop)
    OR vendor_profile_id IN (SELECT vp.vendor_profile_id FROM public.vendor_profiles vp WHERE vp.user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS vendor_guest_reviews_admin_read ON public.vendor_guest_reviews;
CREATE POLICY vendor_guest_reviews_admin_read
  ON public.vendor_guest_reviews FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));

-- ---------------------------------------------------------------------------
-- 3a. THE ONE WRITER — both doors (the supplier's guest QR / the event's After stage, and the scanner's
--     "received" pop-up) call this. Service role only: a guest is not an RLS user; the app resolves the guest from
--     their verified pass or their bound seat (lib/guest-one-path.server.ts) and never from the browser.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.vendor_guest_review_submit(
  p_event_id          UUID,
  p_guest_id          UUID,
  p_vendor_profile_id UUID,
  p_service_id        UUID,
  p_stars             INTEGER,
  p_line              TEXT,
  p_capture_id        UUID,
  p_shown_as          TEXT
)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line   TEXT := NULLIF(btrim(COALESCE(p_line, '')), '');
  v_door   TEXT;
  v_shown  TEXT := COALESCE(NULLIF(p_shown_as, ''), 'name');
  v_found  BOOLEAN;
  v_id     UUID;
BEGIN
  IF p_stars IS NULL OR p_stars < 1 OR p_stars > 5 THEN
    RAISE EXCEPTION 'bad_stars' USING ERRCODE = '22023';
  END IF;
  IF v_line IS NOT NULL AND char_length(v_line) > 140 THEN
    RAISE EXCEPTION 'line_too_long' USING ERRCODE = '22023';
  END IF;
  IF v_shown NOT IN ('name', 'initials') THEN
    RAISE EXCEPTION 'bad_shown_as' USING ERRCODE = '22023';
  END IF;

  -- The guest is a live seat on THIS event.
  PERFORM 1 FROM public.guests g
   WHERE g.event_id = p_event_id AND g.guest_id = p_guest_id AND g.deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_a_guest' USING ERRCODE = '42501';
  END IF;

  -- "At the event" has to be provable: the door checked them in …
  PERFORM 1 FROM public.guest_checkins c
   WHERE c.event_id = p_event_id AND c.guest_id = p_guest_id;
  IF FOUND THEN
    v_door := 'checkin';
  -- … or this supplier's scanner marked something RECEIVED by them (the scanner's tables ship separately — PR
  -- #7277 → #7291 — so the check is dynamic and simply absent where that table is not yet installed).
  ELSIF to_regclass('public.supplier_scan_claims') IS NOT NULL THEN
    EXECUTE
      'SELECT EXISTS (SELECT 1 FROM public.supplier_scan_claims c
                       WHERE c.event_id = $1 AND c.guest_id = $2 AND c.vendor_profile_id = $3
                         AND c.state = ''received'')'
      INTO v_found
      USING p_event_id, p_guest_id, p_vendor_profile_id;
    IF v_found THEN
      v_door := 'scan';
    END IF;
  END IF;
  IF v_door IS NULL THEN
    RAISE EXCEPTION 'not_at_event' USING ERRCODE = '42501';
  END IF;

  -- The supplier was booked on this event (contracted onward). Not "delivered" only: a guest scans the supplier's QR
  -- on the day, before the supplier marks the service complete.
  PERFORM 1 FROM public.event_vendors ev
   WHERE ev.event_id = p_event_id
     AND p_vendor_profile_id IN (ev.marketplace_vendor_id, ev.linked_vendor_profile_id)
     AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'supplier_not_on_event' USING ERRCODE = '42501';
  END IF;

  IF p_service_id IS NOT NULL THEN
    PERFORM 1 FROM public.vendor_services s
     WHERE s.vendor_service_id = p_service_id AND s.vendor_profile_id = p_vendor_profile_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'service_not_this_supplier' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_capture_id IS NOT NULL THEN
    PERFORM 1 FROM public.papic_guest_captures pc
     WHERE pc.capture_id = p_capture_id AND pc.event_id = p_event_id AND pc.guest_id = p_guest_id
       AND pc.hidden_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'capture_not_yours' USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.vendor_guest_reviews
    (vendor_profile_id, event_id, guest_id, service_id, rating_overall, line, capture_id, shown_as, door)
  VALUES
    (p_vendor_profile_id, p_event_id, p_guest_id, p_service_id, p_stars, v_line, p_capture_id, v_shown, v_door)
  ON CONFLICT (vendor_profile_id, event_id, guest_id) DO NOTHING
  RETURNING review_id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'already_reviewed' USING ERRCODE = '23505';
  END IF;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_guest_review_submit(UUID, UUID, UUID, UUID, INTEGER, TEXT, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_guest_review_submit(UUID, UUID, UUID, UUID, INTEGER, TEXT, UUID, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_guest_review_submit(UUID, UUID, UUID, UUID, INTEGER, TEXT, UUID, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- 3b. The shop's ONE public reply to a guest review (same rule as the hosts': once, final).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.vendor_guest_review_reply(p_review_id UUID, p_reply TEXT)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reply TEXT := NULLIF(btrim(COALESCE(p_reply, '')), '');
BEGIN
  IF v_reply IS NULL OR char_length(v_reply) > 500 THEN
    RAISE EXCEPTION 'bad_reply' USING ERRCODE = '22023';
  END IF;
  UPDATE public.vendor_guest_reviews r
     SET vendor_reply = v_reply, vendor_reply_at = NOW()
   WHERE r.review_id = p_review_id
     AND r.vendor_reply IS NULL
     AND (
       r.vendor_profile_id IN (SELECT public.current_vendor_ids('agent'))
       OR r.vendor_profile_id IN (SELECT vp.vendor_profile_id FROM public.vendor_profiles vp WHERE vp.user_id = auth.uid())
     );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reply_refused' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_guest_review_reply(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_guest_review_reply(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.vendor_guest_review_reply(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. The guests' own line — beside the hosts' number, never inside it.
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS public.vendor_guest_review_stats;
CREATE VIEW public.vendor_guest_review_stats
WITH (security_invoker = true) AS
SELECT
  r.vendor_profile_id,
  COUNT(*)::INT                                   AS guest_review_count,
  COALESCE(AVG(r.rating_overall)::NUMERIC(3,2), 0) AS guest_avg_rating
FROM public.vendor_guest_reviews r
WHERE r.hidden_at IS NULL
GROUP BY r.vendor_profile_id;

-- Read by the server (service role) for the public line; no anon / authenticated REST door.
REVOKE ALL ON public.vendor_guest_review_stats FROM anon, authenticated;

COMMENT ON VIEW public.vendor_guest_review_stats IS
  'Guest reviews per shop (not hidden): count + average. Shown as its own line under the hosts'' overall — never blended into vendor_trusted_review_stats (owner 2026-11-06: the shop''s stars are hosts / co-hosts only).';

COMMIT;
