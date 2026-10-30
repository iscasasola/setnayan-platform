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
-- ── WHAT IS PUBLIC — A FROZEN COPY, NEVER THE BOARD ROW (security review #7089) ──
-- NOTHING in the table is readable by anon. The service card reads ONLY
-- `service_card_couple_photos(ids)`, which returns an APPROVED share's own
-- `public_key` — a COPY of the photo the server made at Approve under a neutral
-- key `couple-looks/<share_id>/<attempt>.<ext>` (no event id, no original file name; F3).
-- It never reads `event_inspiration_assets`: that row is editable by every event
-- member under its existing policy, so reading it live would let anyone on the
-- event swap the picture behind an approved, credited card (F1).
--   · At SHARE the board row's `r2_key` + `image_url` are SNAPSHOT onto the
--     share; the shop approves THAT snapshot, and the copy is made from it.
--   · Any later change to the board row's picture, uploader, kind or removal
--     WITHDRAWS the live share (trigger `couple_photo_shares_follow_the_board`),
--     so a removal can never be undone by someone else, and a swap never shows.
--   · Waiting / declined / withdrawn never have a public_key that is served;
--     the server deletes the copy on withdraw/decline and sweeps any orphan.
-- (`tests/db/a-couples-photo-reaches-a-card-only-when-approved.db.test.ts`).
--
-- ── WHO SEES IT — THE COUPLE'S AUDIENCE (owner 2026-10-30, "set who gets to see it
-- (only hosts, exclusive, private, public)") ───────────────────────────────────
-- Every share carries `audience`: 'hosts' · 'exclusive' · 'private' · 'public'
-- (the 2026-10-27 Event Hub viewing terms, plus Only hosts). The shop approves
-- every share whatever its audience. The cached public card reads ONLY 'public'
-- (`service_card_couple_photos`); a signed-in viewer gets the non-public ones
-- they are inside through `viewer_service_card_couple_photos`:
--   hosts     → the event's couple (current_couple_event_ids) + the shop's team
--   exclusive → every member of the event (current_event_ids: hosts, guests,
--               coordinators, booked shops' members) + the shop's team
--   private   → ⚠ FAILS CLOSED TO EXCLUSIVE. "All the people around me" is still
--               OPEN (2026-10-27 row) and has no resolver; it never widens.
-- Copies live by audience: 'public' in the public media bucket; every other
-- audience in a PRIVATE bucket, served only as short-lived signed URLs. A change
-- of audience across that line moves the copy (a new key, same shape).
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
  -- The couple's OWN board photo, as it was when shared. Any later change to it
  -- withdraws this share (trigger below); erasing the row cascades the share away.
  inspiration_id     UUID NOT NULL
                       REFERENCES public.event_inspiration_assets(inspiration_id) ON DELETE CASCADE,
  vendor_profile_id  UUID NOT NULL
                       REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  vendor_service_id  UUID NOT NULL
                       REFERENCES public.vendor_services(vendor_service_id) ON DELETE CASCADE,
  -- The uploader. Their account going takes their shares with it (RA 10173).
  shared_by_user_id  UUID NOT NULL
                       REFERENCES public.users(user_id) ON DELETE CASCADE,
  -- THE SNAPSHOT the shop approves (F1): the board row's object key and URL at share time.
  snapshot_r2_key    TEXT NOT NULL
                       CONSTRAINT couple_photo_shares_snapshot_is_an_upload
                       CHECK (snapshot_r2_key LIKE 'inspiration/%' AND position('..' IN snapshot_r2_key) = 0),
  snapshot_image_url TEXT NOT NULL,
  -- THE FROZEN PUBLIC COPY (F1 + F3): set only at Approve, pinned to this share's
  -- id, carrying no event id and no file name. The card serves only this.
  public_key         TEXT
                       CONSTRAINT couple_photo_shares_public_key_shape
                       CHECK (public_key IS NULL OR public_key ~ ('^couple-looks/' || share_id::text || '/[0-9a-f]{16}\.(jpg|jpeg|png|webp)$')),
  -- WHO SEES IT on the card — the uploader's choice, changeable later.
  -- No DEFAULT on purpose: the share door writes it (the event's own setting by default).
  audience           TEXT NOT NULL
                       CONSTRAINT couple_photo_shares_audience_allowed
                       CHECK (audience IN ('hosts', 'exclusive', 'private', 'public')),
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
    CHECK (state <> 'withdrawn' OR withdrawn_at IS NOT NULL),
  -- An approved share always has its frozen copy; nothing else ever keeps one.
  CONSTRAINT couple_photo_shares_published_iff_approved
    CHECK ((state = 'approved') = (public_key IS NOT NULL))
);

COMMENT ON TABLE public.couple_photo_shares IS
  'A couple''s OWN board photo (an upload under inspiration/<event>/) sent to one '
  'service card of a supplier linked to the event, waiting for THAT shop''s Approve '
  '(owner 2026-10-30). The board photo is SNAPSHOT at share; Approve publishes a frozen '
  'copy at public_key (couple-looks/<share_id>/<attempt>.<ext>). Written only by the SECURITY '
  'DEFINER doors and the board trigger; public only through service_card_couple_photos. No money.';

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
CREATE INDEX IF NOT EXISTS couple_photo_shares_photo_live_idx
  ON public.couple_photo_shares (inspiration_id)
  WHERE state IN ('waiting', 'approved');

ALTER TABLE public.couple_photo_shares ENABLE ROW LEVEL SECURITY;

-- Pattern B (read half): the event's couple reads its own shares.
DROP POLICY IF EXISTS couple_photo_shares_couple_read ON public.couple_photo_shares;
CREATE POLICY couple_photo_shares_couple_read
  ON public.couple_photo_shares
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()) OR (SELECT public.is_admin()));

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
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

-- No client writes — the doors below are the only way in. SELECT only, for the two parties.
REVOKE ALL ON TABLE public.couple_photo_shares FROM anon, authenticated;
GRANT SELECT ON TABLE public.couple_photo_shares TO authenticated;

-- ── 2 · THE BOARD ROW MOVES → THE LIVE SHARE IS WITHDRAWN (F1 · F2) ──────────
-- event_inspiration_assets is editable by every event member under its existing
-- policy (a separate, owner-held fix). Whatever moves the picture (image_url /
-- r2_key), the uploader, the kind, or the removal withdraws every waiting or
-- approved share of that photo and drops its public copy from the row, so a
-- swap never shows and a removal can never be undone by someone else. The
-- server sweeps the orphaned object (`reconcileCoupleLooks`).
CREATE OR REPLACE FUNCTION public.couple_photo_shares_follow_the_board()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.couple_photo_shares
     SET state = 'withdrawn', withdrawn_at = NOW(), public_key = NULL
   WHERE inspiration_id = OLD.inspiration_id
     AND state IN ('waiting', 'approved');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.couple_photo_shares_follow_the_board() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS couple_photo_shares_follow_the_board ON public.event_inspiration_assets;
CREATE TRIGGER couple_photo_shares_follow_the_board
  BEFORE UPDATE ON public.event_inspiration_assets
  FOR EACH ROW
  WHEN (
    OLD.image_url IS DISTINCT FROM NEW.image_url
    OR OLD.r2_key IS DISTINCT FROM NEW.r2_key
    OR OLD.removed_at IS DISTINCT FROM NEW.removed_at
    OR OLD.added_by_user_id IS DISTINCT FROM NEW.added_by_user_id
    OR OLD.source_kind IS DISTINCT FROM NEW.source_kind
    OR OLD.event_id IS DISTINCT FROM NEW.event_id
  )
  EXECUTE FUNCTION public.couple_photo_shares_follow_the_board();

-- ── 2b · A BOARD PHOTO KEEPS ITS PROVENANCE (F2) ────────────────────────────
-- The share door trusts `added_by_user_id` (who may give the photo away),
-- `source_kind` and `from_suggestion_id` (whether it is the couple's own or a
-- supplier's), and the existing policy lets any event member UPDATE all three:
-- a co-host could write themselves in as the uploader of the partner's photo,
-- or a kept supplier suggestion could be relabelled an own upload and shared
-- onto a competitor's card. No code path in the app or in SQL changes any of
-- them after insert (grep: only INSERTs set them; from_suggestion_id's FK is ON
-- DELETE CASCADE, never SET NULL). The ONE legitimate move is the account-erasure
-- FK (users → added_by_user_id SET NULL), which this lets through. A narrow
-- integrity trigger, NOT a change to the table's policies or grants (those are
-- the separate, owner-held fix).
CREATE OR REPLACE FUNCTION public.a_board_photo_keeps_its_provenance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.added_by_user_id IS NOT NULL
     AND NEW.added_by_user_id IS DISTINCT FROM OLD.added_by_user_id THEN
    RAISE EXCEPTION 'A board photo keeps the person who uploaded it.' USING ERRCODE = '42501';
  END IF;
  IF NEW.source_kind IS DISTINCT FROM OLD.source_kind
     OR NEW.from_suggestion_id IS DISTINCT FROM OLD.from_suggestion_id THEN
    RAISE EXCEPTION 'A board photo keeps where it came from.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.a_board_photo_keeps_its_provenance() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS a_board_photo_keeps_its_provenance ON public.event_inspiration_assets;
CREATE TRIGGER a_board_photo_keeps_its_provenance
  BEFORE UPDATE OF added_by_user_id, source_kind, from_suggestion_id ON public.event_inspiration_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.a_board_photo_keeps_its_provenance();

-- ── 3 · SHARE — the uploader sends their own photo to a linked shop's card ─────
CREATE OR REPLACE FUNCTION public.couple_share_photo_with_supplier(
  p_inspiration_id    UUID,
  p_vendor_service_id UUID,
  p_credit_style      TEXT,
  p_credit_line       TEXT,
  p_consent_version   TEXT,
  p_audience          TEXT
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
  IF p_audience IS NULL OR p_audience NOT IN ('hosts', 'exclusive', 'private', 'public') THEN
    RETURN jsonb_build_object('status', 'bad_audience');
  END IF;

  SELECT * INTO v_photo FROM public.event_inspiration_assets
   WHERE inspiration_id = p_inspiration_id AND removed_at IS NULL;
  IF NOT FOUND OR NOT public.colour_access_caller_is_couple(v_photo.event_id) THEN
    RAISE EXCEPTION 'not_your_event' USING ERRCODE = '42501';
  END IF;
  -- Only the couple's OWN upload (F2): source_kind is client-writable, so the
  -- proof is the OBJECT — a key the upload action wrote under THIS event's own
  -- inspiration folder, held by no other board row (a second row reusing a
  -- partner's key is refused). image_url is never trusted: the shop approves
  -- and the card shows the object at r2_key, copied by the server.
  IF v_photo.source_kind <> 'file_upload'
     OR v_photo.r2_key IS NULL
     OR v_photo.r2_key NOT LIKE ('inspiration/' || v_photo.event_id::TEXT || '/%')
     OR position('..' IN v_photo.r2_key) > 0
     -- A SUPPLIER'S suggested photo is stored inside the couple's folder
     -- (inspiration/<event>/suggestions/…) and its key is readable by the couple:
     -- it is never "their own", however the row is labelled (review #7089, round 2).
     OR v_photo.r2_key LIKE ('inspiration/' || v_photo.event_id::TEXT || '/suggestions/%')
     OR v_photo.from_suggestion_id IS NOT NULL
     OR EXISTS (SELECT 1 FROM public.event_inspiration_suggestions sg WHERE sg.r2_key = v_photo.r2_key)
     OR EXISTS (
       SELECT 1 FROM public.event_inspiration_assets o
        WHERE o.r2_key = v_photo.r2_key AND o.inspiration_id <> v_photo.inspiration_id
     ) THEN
    RETURN jsonb_build_object('status', 'not_own_photo');
  END IF;
  -- Only the person who uploaded it (F4: a NULL uploader is nobody's).
  IF v_photo.added_by_user_id IS DISTINCT FROM auth.uid() THEN
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
     snapshot_r2_key, snapshot_image_url, audience,
     credit_style, credit_line, consent_version, consented_at, state)
  VALUES
    (v_photo.event_id, p_inspiration_id, v_shop, p_vendor_service_id, auth.uid(),
     v_photo.r2_key, v_photo.image_url, p_audience,
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
COMMENT ON FUNCTION public.couple_share_photo_with_supplier(UUID, UUID, TEXT, TEXT, TEXT, TEXT) IS
  'The uploader sends their OWN board photo (an upload under inspiration/<event>/, not '
  'removed, its key on no other row) to one ACTIVE card of a shop linked to the event, '
  'with consent and a credit line; the photo is snapshot onto the share, which waits for '
  'that shop. Answers no_consent / not_own_photo / not_your_photo / no_card / not_on_event / '
  'bad_credit / bad_audience / already; raises not_your_event.';
REVOKE ALL ON FUNCTION public.couple_share_photo_with_supplier(UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.couple_share_photo_with_supplier(UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.couple_share_photo_with_supplier(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ── 4 · ANSWER — only THAT shop's owner/admin team approves or declines ───────
-- Approve PUBLISHES: p_public_key names the frozen copy the server already made
-- (couple-looks/<share_id>/<attempt>.<ext>, CHECKed). Decline on an APPROVED row takes it
-- back off the card. Either way the old public key comes back so the server can
-- delete the object.
CREATE OR REPLACE FUNCTION public.vendor_answer_couple_photo(
  p_share_id    UUID,
  p_approve     BOOLEAN,
  p_public_key  TEXT DEFAULT NULL,
  -- Where the server put the copy: TRUE = the public bucket. Must match the
  -- share's audience NOW, or the couple changed it mid-approve ('audience_changed').
  p_copy_public BOOLEAN DEFAULT NULL
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
  IF p_approve AND v_row.state <> 'waiting' THEN
    RETURN jsonb_build_object('status', 'already', 'state', v_row.state);
  END IF;
  IF NOT p_approve AND v_row.state NOT IN ('waiting', 'approved') THEN
    RETURN jsonb_build_object('status', 'already', 'state', v_row.state);
  END IF;
  IF p_approve AND (p_public_key IS NULL
       OR p_public_key !~ ('^couple-looks/' || v_row.share_id::text || '/[0-9a-f]{16}\.(jpg|jpeg|png|webp)$')) THEN
    RETURN jsonb_build_object('status', 'bad_key');
  END IF;
  IF p_approve AND (p_copy_public IS NULL OR p_copy_public <> (v_row.audience = 'public')) THEN
    RETURN jsonb_build_object('status', 'audience_changed');
  END IF;
  UPDATE public.couple_photo_shares
     SET state = CASE WHEN p_approve THEN 'approved' ELSE 'declined' END,
         public_key = CASE WHEN p_approve THEN p_public_key ELSE NULL END,
         decided_at = NOW(),
         decided_by_user_id = auth.uid()
   WHERE share_id = p_share_id;
  RETURN jsonb_build_object(
    'status', 'ok',
    'approved', p_approve,
    'was', v_row.state,
    'unpublished_key', CASE WHEN p_approve THEN NULL ELSE v_row.public_key END,
    'unpublished_public', v_row.audience = 'public',
    'event_id', v_row.event_id,
    'shared_by_user_id', v_row.shared_by_user_id
  );
END;
$$;
COMMENT ON FUNCTION public.vendor_answer_couple_photo(UUID, BOOLEAN, TEXT, BOOLEAN) IS
  'The shop''s Approve / Decline on a couple''s shared photo (owner/admin team via '
  'current_vendor_profile_ids, else not_yours). Approve requires the frozen copy''s key '
  '(couple-looks/<share_id>/<attempt>.<ext>, else bad_key) and publishes it; Decline on an approved '
  'row takes it off the card and hands back the key to delete. A withdrawn photo changes nothing.';
REVOKE ALL ON FUNCTION public.vendor_answer_couple_photo(UUID, BOOLEAN, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_answer_couple_photo(UUID, BOOLEAN, TEXT, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.vendor_answer_couple_photo(UUID, BOOLEAN, TEXT, BOOLEAN) TO authenticated;

-- ── 5 · WITHDRAW — the uploader takes it back; it leaves the card ────────────
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
  IF NOT FOUND OR (v_row.shared_by_user_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'not_yours' USING ERRCODE = '42501';
  END IF;
  IF v_row.state NOT IN ('waiting', 'approved') THEN
    RETURN jsonb_build_object('status', 'already', 'state', v_row.state);
  END IF;
  UPDATE public.couple_photo_shares
     SET state = 'withdrawn', withdrawn_at = NOW(), public_key = NULL
   WHERE share_id = p_share_id;
  RETURN jsonb_build_object('status', 'ok', 'was', v_row.state, 'unpublished_key', v_row.public_key,
                            'unpublished_public', v_row.audience = 'public');
END;
$$;
COMMENT ON FUNCTION public.couple_withdraw_photo_share(UUID) IS
  'The uploader (or admin) withdraws a waiting or approved share; an approved photo '
  'leaves the service card at once and the key of its copy comes back to be deleted.';
REVOKE ALL ON FUNCTION public.couple_withdraw_photo_share(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.couple_withdraw_photo_share(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.couple_withdraw_photo_share(UUID) TO authenticated;

-- ── 6 · THE SHOP'S LIST — what was sent to the caller's shops ────────────────
-- photo_key: the SNAPSHOT for a waiting share (what the shop is approving), the
-- frozen copy for an approved one. Never the live board row.
CREATE OR REPLACE FUNCTION public.vendor_couple_photo_shares()
RETURNS TABLE (
  share_id          UUID,
  state             TEXT,
  created_at        TIMESTAMPTZ,
  decided_at        TIMESTAMPTZ,
  credit_line       TEXT,
  photo_key         TEXT,
  audience          TEXT,
  vendor_profile_id UUID,
  vendor_service_id UUID,
  service_title     TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.share_id, s.state, s.created_at, s.decided_at, s.credit_line,
         CASE WHEN s.state = 'approved' THEN s.public_key ELSE s.snapshot_r2_key END,
         s.audience,
         s.vendor_profile_id, s.vendor_service_id, vs.title
  FROM public.couple_photo_shares s
  JOIN public.vendor_services vs ON vs.vendor_service_id = s.vendor_service_id
  WHERE s.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    AND s.state IN ('waiting', 'approved')
  ORDER BY (s.state = 'waiting') DESC, s.created_at DESC
  LIMIT 200;
$$;
COMMENT ON FUNCTION public.vendor_couple_photo_shares() IS
  'The caller''s shops'' waiting + approved couple photos, waiting first — the Shop''s '
  '"Photos couples shared" list. photo_key = the snapshot (waiting) or the frozen copy (approved).';
REVOKE ALL ON FUNCTION public.vendor_couple_photo_shares() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_couple_photo_shares() FROM anon;
GRANT EXECUTE ON FUNCTION public.vendor_couple_photo_shares() TO authenticated;

-- ── 7 · THE CARD — the ONLY public read: an approved share's frozen copy ──────
CREATE OR REPLACE FUNCTION public.service_card_couple_photos(
  p_vendor_service_ids UUID[]
) RETURNS TABLE (
  vendor_service_id UUID,
  share_id          UUID,
  public_key        TEXT,
  credit_line       TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.vendor_service_id, s.share_id, s.public_key, s.credit_line
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
  'frozen copy (couple-looks/<share_id>/<attempt>.<ext>) + credit line — never the couple''s board row, '
  'nothing that names the event. Waiting / declined / withdrawn never leave here.';
REVOKE ALL ON FUNCTION public.service_card_couple_photos(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.service_card_couple_photos(UUID[]) TO anon, authenticated;

-- ── 8 · THE SIGNED-IN VIEWER'S EXTRA PHOTOS — never in the cached page ───────
-- Approved, NON-public shares the caller is inside the audience of. Read after
-- the page by a signed-in viewer only; the URLs are signed by the server.
CREATE OR REPLACE FUNCTION public.viewer_service_card_couple_photos(
  p_vendor_service_ids UUID[]
) RETURNS TABLE (
  vendor_service_id UUID,
  share_id          UUID,
  public_key        TEXT,
  credit_line       TEXT,
  audience          TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.vendor_service_id, s.share_id, s.public_key, s.credit_line, s.audience
  FROM public.couple_photo_shares s
  JOIN public.vendor_services vs ON vs.vendor_service_id = s.vendor_service_id
  WHERE auth.uid() IS NOT NULL
    AND s.vendor_service_id = ANY (COALESCE(p_vendor_service_ids, ARRAY[]::UUID[]))
    AND s.state = 'approved'
    AND s.public_key IS NOT NULL
    AND s.audience <> 'public'
    AND vs.is_active IS TRUE
    AND (
      -- The shop that approved it always sees its own card.
      s.vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
      -- Only hosts: the event's couple.
      OR (s.audience = 'hosts' AND s.event_id IN (SELECT public.current_couple_event_ids()))
      -- Exclusive — and Private, which FAILS CLOSED to Exclusive until "the people
      -- around me" has a resolver (2026-10-27 OPEN): every member of the event.
      OR (s.audience IN ('exclusive', 'private') AND s.event_id IN (SELECT public.current_event_ids()))
    )
  ORDER BY s.vendor_service_id, s.decided_at DESC
  LIMIT 500;
$$;
COMMENT ON FUNCTION public.viewer_service_card_couple_photos(UUID[]) IS
  'A signed-in viewer''s NON-public "From couples" photos: approved shares whose audience '
  'admits them — hosts (the couple), exclusive + private (every event member; private fails '
  'closed to exclusive), and always the approving shop''s team. Never anon; never cached.';
REVOKE ALL ON FUNCTION public.viewer_service_card_couple_photos(UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.viewer_service_card_couple_photos(UUID[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.viewer_service_card_couple_photos(UUID[]) TO authenticated;

-- ── 9 · THE COUPLE CHANGES WHO SEES IT — at once, no re-approval ─────────────
-- Same person as Take back (the uploader, or admin). On an APPROVED share whose
-- change crosses the public line, the copy must move bucket: the server makes
-- the new copy first and names it here (p_public_key, same shape, a NEW key);
-- the old key comes back to be deleted. Otherwise p_public_key must be NULL.
CREATE OR REPLACE FUNCTION public.couple_set_photo_share_audience(
  p_share_id   UUID,
  p_audience   TEXT,
  p_public_key TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row   public.couple_photo_shares%ROWTYPE;
  v_moves BOOLEAN;
BEGIN
  IF p_share_id IS NULL OR auth.uid() IS NULL THEN
    RETURN jsonb_build_object('status', 'bad_input');
  END IF;
  IF p_audience IS NULL OR p_audience NOT IN ('hosts', 'exclusive', 'private', 'public') THEN
    RETURN jsonb_build_object('status', 'bad_audience');
  END IF;
  SELECT * INTO v_row FROM public.couple_photo_shares
   WHERE share_id = p_share_id FOR UPDATE;
  IF NOT FOUND OR (v_row.shared_by_user_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'not_yours' USING ERRCODE = '42501';
  END IF;
  IF v_row.state NOT IN ('waiting', 'approved') THEN
    RETURN jsonb_build_object('status', 'already', 'state', v_row.state);
  END IF;
  IF v_row.audience = p_audience THEN
    RETURN jsonb_build_object('status', 'ok', 'moved', FALSE);
  END IF;
  v_moves := v_row.state = 'approved' AND ((v_row.audience = 'public') <> (p_audience = 'public'));
  IF v_moves THEN
    IF p_public_key IS NULL OR p_public_key = v_row.public_key
       OR p_public_key !~ ('^couple-looks/' || v_row.share_id::text || '/[0-9a-f]{16}\.(jpg|jpeg|png|webp)$') THEN
      RETURN jsonb_build_object('status', 'needs_move', 'state', v_row.state);
    END IF;
  ELSIF p_public_key IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'bad_key');
  END IF;
  UPDATE public.couple_photo_shares
     SET audience = p_audience,
         public_key = CASE WHEN v_moves THEN p_public_key ELSE public_key END
   WHERE share_id = p_share_id;
  RETURN jsonb_build_object(
    'status', 'ok',
    'moved', v_moves,
    'unpublished_key', CASE WHEN v_moves THEN v_row.public_key ELSE NULL END,
    'unpublished_public', v_row.audience = 'public'
  );
END;
$$;
COMMENT ON FUNCTION public.couple_set_photo_share_audience(UUID, TEXT, TEXT) IS
  'The uploader (or admin) changes who sees a waiting or approved share — at once, no '
  're-approval. An approved share crossing the public line needs the server''s new copy '
  '(needs_move otherwise); the old key comes back to be deleted.';
REVOKE ALL ON FUNCTION public.couple_set_photo_share_audience(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.couple_set_photo_share_audience(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.couple_set_photo_share_audience(UUID, TEXT, TEXT) TO authenticated;

COMMIT;
