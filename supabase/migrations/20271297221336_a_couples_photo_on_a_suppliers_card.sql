-- a_couples_photo_on_a_suppliers_card
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ============================================================================
-- 📸 A COUPLE'S OWN PHOTO, SHARED TO A SUPPLIER'S SERVICE CARD
-- (owner 2026-10-30, DECISION_LOG "A CUSTOMER'S PHOTO SHARED TO A SUPPLIER'S
-- INSPIRATION — THE SUPPLIER APPROVES, IT SYNCS TO THEIR SERVICE CARD; THE
-- CUSTOMER GETS A CREDIT LINE + AN OPTIONAL SUPPLIER GIFT, NEVER CASH").
--
-- The mirror of `event_inspiration_suggestions` (20271279311294), which carries
-- a supplier's photo TO the couple's board and waits for the couple. This one
-- carries the couple's OWN board photo (`source_kind = 'file_upload'`) TO one of
-- a linked supplier's service cards and waits for the SUPPLIER.
--
-- ── WHY A TABLE, NOT A FLAG ON event_inspiration_assets (CLAUDE.md rule 3) ──
-- A flag was the first answer and it is wrong here for one reason: the couple
-- can already UPDATE their own board rows (row-level RLS), and RLS is
-- ROW-level, never VALUE-level (20271202522764 §1b). A `share_state` column on
-- the board row would be one PATCH away from a couple approving their own photo
-- onto somebody else's shop. Three parties (the uploader, the shop, the public
-- card) and a state only the SHOP may move need their own row, with NO client
-- writes at all — every move goes through the SECURITY DEFINER doors below,
-- which decide who you are in SQL.
--
-- ── WHAT IS PUBLIC ──────────────────────────────────────────────────────────
-- NOTHING in the table. anon holds no grant on it. The service card reads ONLY
-- `service_card_couple_photos(ids)`, which returns state = 'approved' rows
-- whose board photo is still on the board and whose card is still active — so
-- a WAITING, DECLINED or WITHDRAWN photo cannot reach a public page by any path
-- (`tests/db/a-couples-photo-reaches-a-card-only-when-approved.db.test.ts`).
--
-- ── 🔓 OPEN (owner) — DOES IT COUNT TOWARD THE PAID PAGE-PHOTO ROOM? ─────────
-- The 2026-10-28 wallet row prices a supplier's own page photos (free room, then
-- 1 credit a photo — `file_supplier_page_notice` / `shop_portfolio_commit`).
-- Whether an APPROVED couple photo uses that room is NOT decided. As built it
-- does NOT: nothing here touches the wallet or the room, and none of those
-- functions reads this table. The one place that says so in code is
-- `COUPLE_PHOTOS_USE_PAGE_ROOM` in apps/web/lib/couple-photo-share.ts.
--
-- ── NO MONEY ────────────────────────────────────────────────────────────────
-- No price, credit, payout or wallet column; no call to any spend door. The
-- owner ruled the customer's thank-you is a CREDIT LINE plus an OPTIONAL shop
-- Gift (the 2026-10-28 Gift feature), never cash and never a Setnayan-funded
-- credit.
--
-- 🛑 NOT APPLIED BY HAND. deploy-prod.yml runs `supabase db push --include-all
-- --yes` on the committed file; a direct apply orphans the prod ledger.
-- ============================================================================

-- The two in-app notices (no email — they are not on EMAIL_ENABLED_TYPES).
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'couple_photo_shared';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'couple_photo_answered';

BEGIN;

-- ── 1 · the share ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.couple_photo_shares (
  share_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           UUID NOT NULL
                       REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- The couple's OWN board photo. Removing it from the board (removed_at) takes
  -- it off the card at read time; erasing the row cascades the share away.
  inspiration_id     UUID NOT NULL
                       REFERENCES public.event_inspiration_assets(inspiration_id) ON DELETE CASCADE,
  vendor_profile_id  UUID NOT NULL
                       REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  vendor_service_id  UUID NOT NULL
                       REFERENCES public.vendor_services(vendor_service_id) ON DELETE CASCADE,
  -- The uploader. Their account going takes their shares with it (RA 10173).
  shared_by_user_id  UUID NOT NULL
                       REFERENCES public.users(user_id) ON DELETE CASCADE,
  -- The credit the card prints — the uploader's choice, frozen at share time.
  credit_style       TEXT NOT NULL
                       CONSTRAINT couple_photo_shares_credit_style_allowed
                       CHECK (credit_style IN ('names', 'a_couple')),
  credit_line        TEXT NOT NULL
                       CONSTRAINT couple_photo_shares_credit_line_shape
                       CHECK (length(btrim(credit_line)) BETWEEN 1 AND 80),
  -- The consent checkbox: the photo is theirs and the people in it agree.
  consent_version    TEXT NOT NULL
                       CONSTRAINT couple_photo_shares_consent_version_shape
                       CHECK (length(btrim(consent_version)) > 0),
  consented_at       TIMESTAMPTZ NOT NULL,
  -- No DEFAULT on purpose: a default is a write nobody made.
  state              TEXT NOT NULL
                       CONSTRAINT couple_photo_shares_state_allowed
                       CHECK (state IN ('waiting', 'approved', 'declined', 'withdrawn')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at         TIMESTAMPTZ,
  decided_by_user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  withdrawn_at       TIMESTAMPTZ,
  CONSTRAINT couple_photo_shares_a_couple_says_a_couple
    CHECK (credit_style <> 'a_couple' OR credit_line = 'A couple'),
  CONSTRAINT couple_photo_shares_decided_dated
    CHECK (state NOT IN ('approved', 'declined') OR decided_at IS NOT NULL),
  CONSTRAINT couple_photo_shares_withdrawn_dated
    CHECK (state <> 'withdrawn' OR withdrawn_at IS NOT NULL)
);

COMMENT ON TABLE public.couple_photo_shares IS
  'A couple''s OWN board photo (event_inspiration_assets, file_upload) sent to one '
  'service card of a supplier linked to the event, waiting for THAT shop''s Approve '
  '(owner 2026-10-30). Written only by couple_share_photo_with_supplier / '
  'vendor_answer_couple_photo / couple_withdraw_photo_share. Public only through '
  'service_card_couple_photos (approved, still on the board, card active). No money.';

-- One live share per photo per shop (a re-send after a decline/withdraw is a new row).
CREATE UNIQUE INDEX IF NOT EXISTS couple_photo_shares_one_live_per_shop
  ON public.couple_photo_shares (inspiration_id, vendor_profile_id)
  WHERE state IN ('waiting', 'approved');
CREATE INDEX IF NOT EXISTS couple_photo_shares_shop_idx
  ON public.couple_photo_shares (vendor_profile_id, created_at DESC)
  WHERE state IN ('waiting', 'approved');
CREATE INDEX IF NOT EXISTS couple_photo_shares_card_idx
  ON public.couple_photo_shares (vendor_service_id, decided_at DESC)
  WHERE state = 'approved';
CREATE INDEX IF NOT EXISTS couple_photo_shares_event_idx
  ON public.couple_photo_shares (event_id, created_at DESC);

ALTER TABLE public.couple_photo_shares ENABLE ROW LEVEL SECURITY;

-- Pattern B (read half): the event's couple reads its own shares.
DROP POLICY IF EXISTS couple_photo_shares_couple_read ON public.couple_photo_shares;
CREATE POLICY couple_photo_shares_couple_read
  ON public.couple_photo_shares
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()) OR public.is_admin());

-- Pattern C (read half): the shop's owner/admin team reads what was sent to it.
DROP POLICY IF EXISTS couple_photo_shares_vendor_read ON public.couple_photo_shares;
CREATE POLICY couple_photo_shares_vendor_read
  ON public.couple_photo_shares
  FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

-- Pattern F: Setnayan admin.
DROP POLICY IF EXISTS couple_photo_shares_admin_all ON public.couple_photo_shares;
CREATE POLICY couple_photo_shares_admin_all
  ON public.couple_photo_shares FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- No client writes — the doors below are the only way in.
REVOKE ALL ON TABLE public.couple_photo_shares FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.couple_photo_shares FROM authenticated;

-- ── 2 · SHARE — the uploader sends their own photo to a linked shop's card ─────
CREATE OR REPLACE FUNCTION public.couple_share_photo_with_supplier(
  p_inspiration_id    UUID,
  p_vendor_service_id UUID,
  p_credit_style      TEXT,
  p_credit_line       TEXT,
  p_consent_version   TEXT
) RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_photo   public.event_inspiration_assets%ROWTYPE;
  v_shop    UUID;
  v_label   TEXT;
  v_owner   UUID;
  v_line    TEXT;
  v_live    public.couple_photo_shares%ROWTYPE;
  v_id      UUID;
BEGIN
  IF p_inspiration_id IS NULL OR p_vendor_service_id IS NULL OR auth.uid() IS NULL THEN
    RETURN jsonb_build_object('status', 'bad_input');
  END IF;
  -- The consent checkbox is REQUIRED — no version, no share.
  IF p_consent_version IS NULL OR length(btrim(p_consent_version)) = 0 THEN
    RETURN jsonb_build_object('status', 'no_consent');
  END IF;

  SELECT * INTO v_photo FROM public.event_inspiration_assets
   WHERE inspiration_id = p_inspiration_id AND removed_at IS NULL;
  IF NOT FOUND OR NOT public.colour_access_caller_is_couple(v_photo.event_id) THEN
    RAISE EXCEPTION 'not_your_event' USING ERRCODE = '42501';
  END IF;
  -- Only the couple's OWN upload, and only by the person who uploaded it: a
  -- supplier's gallery pick or a kept suggestion is not theirs to give away.
  IF v_photo.source_kind <> 'file_upload' THEN
    RETURN jsonb_build_object('status', 'not_own_photo');
  END IF;
  IF v_photo.added_by_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('status', 'not_your_photo');
  END IF;

  -- The card must be ACTIVE and its shop LINKED to this event (booked or
  -- added — an un-archived event_vendors row naming the shop).
  SELECT vs.vendor_profile_id, COALESCE(NULLIF(btrim(vp.business_name), ''), 'Your supplier'), vp.user_id
    INTO v_shop, v_label, v_owner
  FROM public.vendor_services vs
  JOIN public.vendor_profiles vp ON vp.vendor_profile_id = vs.vendor_profile_id
  WHERE vs.vendor_service_id = p_vendor_service_id
    AND vs.is_active IS TRUE;
  IF v_shop IS NULL THEN
    RETURN jsonb_build_object('status', 'no_card');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.event_vendors ev
    WHERE ev.event_id = v_photo.event_id
      AND ev.marketplace_vendor_id = v_shop
      AND ev.archived_at IS NULL
  ) THEN
    RETURN jsonb_build_object('status', 'not_on_event');
  END IF;

  IF p_credit_style = 'a_couple' THEN
    v_line := 'A couple';
  ELSIF p_credit_style = 'names' THEN
    v_line := btrim(COALESCE(p_credit_line, ''));
    IF length(v_line) < 1 OR length(v_line) > 80 THEN
      RETURN jsonb_build_object('status', 'bad_credit');
    END IF;
  ELSE
    RETURN jsonb_build_object('status', 'bad_credit');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_inspiration_id::TEXT || ':share:' || v_shop::TEXT, 0));
  SELECT * INTO v_live FROM public.couple_photo_shares
   WHERE inspiration_id = p_inspiration_id AND vendor_profile_id = v_shop
     AND state IN ('waiting', 'approved')
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'already', 'state', v_live.state, 'share_id', v_live.share_id);
  END IF;

  INSERT INTO public.couple_photo_shares
    (event_id, inspiration_id, vendor_profile_id, vendor_service_id, shared_by_user_id,
     credit_style, credit_line, consent_version, consented_at, state)
  VALUES
    (v_photo.event_id, p_inspiration_id, v_shop, p_vendor_service_id, auth.uid(),
     p_credit_style, v_line, btrim(p_consent_version), NOW(), 'waiting')
  RETURNING share_id INTO v_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'share_id', v_id,
    'vendor_profile_id', v_shop,
    'shop_label', v_label,
    'shop_owner_user_id', v_owner
  );
END;
$$;
COMMENT ON FUNCTION public.couple_share_photo_with_supplier(UUID, UUID, TEXT, TEXT, TEXT) IS
  'The uploader sends their OWN board photo (file_upload, not removed) to one ACTIVE '
  'card of a shop linked to the event, with consent and a credit line; the row waits '
  'for that shop. Answers no_consent / not_own_photo / not_your_photo / no_card / '
  'not_on_event / bad_credit / already; raises not_your_event.';
REVOKE ALL ON FUNCTION public.couple_share_photo_with_supplier(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.couple_share_photo_with_supplier(UUID, UUID, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.couple_share_photo_with_supplier(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ── 3 · ANSWER — only THAT shop's owner/admin team approves or declines ───────
-- p_approve FALSE on an APPROVED row takes it back off the card (declined).
CREATE OR REPLACE FUNCTION public.vendor_answer_couple_photo(
  p_share_id UUID,
  p_approve  BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.couple_photo_shares%ROWTYPE;
BEGIN
  IF p_share_id IS NULL OR p_approve IS NULL OR auth.uid() IS NULL THEN
    RETURN jsonb_build_object('status', 'bad_input');
  END IF;
  SELECT * INTO v_row FROM public.couple_photo_shares
   WHERE share_id = p_share_id FOR UPDATE;
  IF NOT FOUND OR v_row.vendor_profile_id NOT IN (SELECT public.current_vendor_profile_ids()) THEN
    RAISE EXCEPTION 'not_yours' USING ERRCODE = '42501';
  END IF;
  IF v_row.state = 'withdrawn' THEN
    RETURN jsonb_build_object('status', 'withdrawn');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.event_inspiration_assets a
    WHERE a.inspiration_id = v_row.inspiration_id AND a.removed_at IS NULL
  ) THEN
    RETURN jsonb_build_object('status', 'gone');
  END IF;
  IF p_approve AND v_row.state <> 'waiting' THEN
    RETURN jsonb_build_object('status', 'already', 'state', v_row.state);
  END IF;
  IF NOT p_approve AND v_row.state NOT IN ('waiting', 'approved') THEN
    RETURN jsonb_build_object('status', 'already', 'state', v_row.state);
  END IF;
  UPDATE public.couple_photo_shares
     SET state = CASE WHEN p_approve THEN 'approved' ELSE 'declined' END,
         decided_at = NOW(),
         decided_by_user_id = auth.uid()
   WHERE share_id = p_share_id;
  RETURN jsonb_build_object(
    'status', 'ok',
    'approved', p_approve,
    'was', v_row.state,
    'event_id', v_row.event_id,
    'shared_by_user_id', v_row.shared_by_user_id
  );
END;
$$;
COMMENT ON FUNCTION public.vendor_answer_couple_photo(UUID, BOOLEAN) IS
  'The shop''s Approve / Decline on a couple''s shared photo (owner/admin team via '
  'current_vendor_profile_ids, else not_yours). Decline on an approved row takes it '
  'off the card. A withdrawn or removed photo answers withdrawn / gone and changes nothing.';
REVOKE ALL ON FUNCTION public.vendor_answer_couple_photo(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_answer_couple_photo(UUID, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.vendor_answer_couple_photo(UUID, BOOLEAN) TO authenticated;

-- ── 4 · WITHDRAW — the uploader takes it back; it leaves the card ────────────
CREATE OR REPLACE FUNCTION public.couple_withdraw_photo_share(
  p_share_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.couple_photo_shares%ROWTYPE;
BEGIN
  IF p_share_id IS NULL OR auth.uid() IS NULL THEN
    RETURN jsonb_build_object('status', 'bad_input');
  END IF;
  SELECT * INTO v_row FROM public.couple_photo_shares
   WHERE share_id = p_share_id FOR UPDATE;
  IF NOT FOUND OR (v_row.shared_by_user_id <> auth.uid() AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'not_yours' USING ERRCODE = '42501';
  END IF;
  IF v_row.state NOT IN ('waiting', 'approved') THEN
    RETURN jsonb_build_object('status', 'already', 'state', v_row.state);
  END IF;
  UPDATE public.couple_photo_shares
     SET state = 'withdrawn', withdrawn_at = NOW()
   WHERE share_id = p_share_id;
  RETURN jsonb_build_object('status', 'ok', 'was', v_row.state);
END;
$$;
COMMENT ON FUNCTION public.couple_withdraw_photo_share(UUID) IS
  'The uploader (or admin) withdraws a waiting or approved share; an approved photo '
  'leaves the service card at once (service_card_couple_photos reads approved only).';
REVOKE ALL ON FUNCTION public.couple_withdraw_photo_share(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.couple_withdraw_photo_share(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.couple_withdraw_photo_share(UUID) TO authenticated;

-- ── 5 · THE SHOP'S LIST — what was sent to the caller's shops ────────────────
-- The photo's URL lives on the couple's board row, which the shop cannot read
-- under RLS; this hands back exactly the fields the Approve screen draws.
CREATE OR REPLACE FUNCTION public.vendor_couple_photo_shares()
RETURNS TABLE (
  share_id          UUID,
  state             TEXT,
  created_at        TIMESTAMPTZ,
  decided_at        TIMESTAMPTZ,
  credit_line       TEXT,
  image_url         TEXT,
  vendor_profile_id UUID,
  vendor_service_id UUID,
  service_title     TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.share_id, s.state, s.created_at, s.decided_at, s.credit_line, a.image_url,
         s.vendor_profile_id, s.vendor_service_id, vs.title
  FROM public.couple_photo_shares s
  JOIN public.event_inspiration_assets a ON a.inspiration_id = s.inspiration_id
  JOIN public.vendor_services vs ON vs.vendor_service_id = s.vendor_service_id
  WHERE s.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    AND s.state IN ('waiting', 'approved')
    AND a.removed_at IS NULL
  ORDER BY (s.state = 'waiting') DESC, s.created_at DESC
  LIMIT 200;
$$;
COMMENT ON FUNCTION public.vendor_couple_photo_shares() IS
  'The caller''s shops'' waiting + approved couple photos (still on the couple''s board), '
  'waiting first — the Shop''s "Photos couples shared" list.';
REVOKE ALL ON FUNCTION public.vendor_couple_photo_shares() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_couple_photo_shares() FROM anon;
GRANT EXECUTE ON FUNCTION public.vendor_couple_photo_shares() TO authenticated;

-- ── 6 · THE CARD — the ONLY public read: approved, still on the board, card active ──
CREATE OR REPLACE FUNCTION public.service_card_couple_photos(
  p_vendor_service_ids UUID[]
) RETURNS TABLE (
  vendor_service_id UUID,
  share_id          UUID,
  image_url         TEXT,
  credit_line       TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.vendor_service_id, s.share_id, a.image_url, s.credit_line
  FROM public.couple_photo_shares s
  JOIN public.event_inspiration_assets a ON a.inspiration_id = s.inspiration_id
  JOIN public.vendor_services vs ON vs.vendor_service_id = s.vendor_service_id
  WHERE s.vendor_service_id = ANY (COALESCE(p_vendor_service_ids, ARRAY[]::UUID[]))
    AND s.state = 'approved'
    AND a.removed_at IS NULL
    AND vs.is_active IS TRUE
  ORDER BY s.vendor_service_id, s.decided_at DESC
  LIMIT 500;
$$;
COMMENT ON FUNCTION public.service_card_couple_photos(UUID[]) IS
  'The public service card''s "From couples" photos: APPROVED shares only, whose '
  'board photo is still on the board and whose card is active — image + credit line, '
  'nothing that names the event. Waiting / declined / withdrawn never leave here.';
REVOKE ALL ON FUNCTION public.service_card_couple_photos(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.service_card_couple_photos(UUID[]) TO anon, authenticated;

COMMIT;
