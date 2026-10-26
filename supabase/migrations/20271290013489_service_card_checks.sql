-- ============================================================================
-- 20271290013489_service_card_checks.sql
--
-- 🃏 SERVICE CARD CHECKS — the schema half (PR 1 of the PLAN's order).
--
-- Owner 2026-10-26, verbatim: *"Cards go live right away after automatic
-- checks; only flagged cards wait for admin review. Prototype it first."* —
-- then *"Yes"* to the prototype (DECISION_LOG "APPROVED — SERVICE CARD CHECKS
-- AS DRAWN", corpus `prototypes/service_card_checks_2026-10-26/` + PLAN.md).
--
-- WHAT A HELD CARD IS. No new column on `vendor_services`. A card is HELD when
-- `is_active = false` AND an `integrity_flags` row exists for it with
-- `kind = 'service_card'` and a holding status (open · asked_to_fix ·
-- rejected). The checks themselves live in TypeScript
-- (`apps/web/lib/service-card-checks.ts`, run inside `commitVendorService`);
-- this file stores the flag and makes the hold impossible for a supplier to
-- undo on their own.
--
-- WHAT CHANGES
--   1. integrity_flags gains `subject_service_id` (→ vendor_services, CASCADE),
--      the kind `service_card`, and the verdict statuses `approved` ·
--      `asked_to_fix` · `rejected`. Both CHECKs are RE-LISTED IN FULL from the
--      latest definitions (kind: 20270929100000; status: the inline CHECK of
--      20270412000042, never re-listed since) — a re-listed CHECK that copies a
--      shorter, older list silently drops a later value.
--   2. One partial unique index: at most ONE holding flag per card.
--   3. `card_claim_words` — the admin-editable list of claim words, seeded with
--      the owner's six (guaranteed · #1 · best in · lowest price · official ·
--      100%), and `card_claim_word_allowances` — "Not a problem — stop flagging
--      “…” for this shop". RLS at CREATE: admin only; the check reads them with
--      the service role.
--   4. `platform_settings.card_price_band_tolerance` — NULL, and NULL MEANS THE
--      PRICE CHECK IS OFF. The ruling: "admin-set tolerance in platform
--      settings, OFF until set — no guessed number". There is deliberately no
--      default.
--   5. The repost-watch surface CHECKs learn `service_showcase` (the ruling:
--      "photo match (repost-watch pHash, cover + showcase)"). Re-listed in full
--      from 20271202522764.
--   6. `service_card_held(uuid)` — SECURITY DEFINER, because `integrity_flags`
--      is admin-only under RLS: a supplier's session would read NO rows and the
--      hold below would read as "not held" for exactly the person it fences.
--   7. `enforce_service_publish_gate` grows ONE arm: a card that is held may
--      not GO live, except through an admin (`is_admin()`) or the verdict door
--      (`app.service_card_verdict`, opened only inside `approve_service_card`).
--      `authenticated` holds UPDATE on every column of `vendor_services`, so a
--      hold that lived only in TypeScript could be undone with one PATCH.
--   8. `approve_service_card(...)` — the one door: approves the flag and puts
--      the card live in one transaction. service_role only.
--
-- RA 10173: `detail` stays non-PII — reason codes, the card's OWN price and the
-- band's aggregates, matched words, a repost-watch row id. No names, no bodies.
--
-- KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ============================================================================

BEGIN;

-- ── 1 · integrity_flags learns the card ─────────────────────────────────────
ALTER TABLE public.integrity_flags
  ADD COLUMN IF NOT EXISTS subject_service_id UUID
    REFERENCES public.vendor_services(vendor_service_id) ON DELETE CASCADE;

ALTER TABLE public.integrity_flags DROP CONSTRAINT IF EXISTS integrity_flags_kind_check;
ALTER TABLE public.integrity_flags
  ADD CONSTRAINT integrity_flags_kind_check
  CHECK (kind IN (
    'review_fraud',
    'ghost_listing',
    'inquiry_concentration',
    'price_underdeclaration',
    'service_card'
  ));

-- The status vocabulary was an inline CHECK on CREATE TABLE (auto-named
-- integrity_flags_status_check) and has never been re-listed.
ALTER TABLE public.integrity_flags DROP CONSTRAINT IF EXISTS integrity_flags_status_check;
ALTER TABLE public.integrity_flags
  ADD CONSTRAINT integrity_flags_status_check
  CHECK (status IN (
    'open',
    'dismissed',
    'confirmed_fraud',
    'listing_hidden',
    'approved',
    'asked_to_fix',
    'rejected'
  ));

-- Shape: a service_card flag names a card and nothing else; every older kind
-- must NOT name a card (keeps the subject columns exclusive by kind).
ALTER TABLE public.integrity_flags DROP CONSTRAINT IF EXISTS integrity_flags_kind_shape;
ALTER TABLE public.integrity_flags
  ADD CONSTRAINT integrity_flags_kind_shape CHECK (
    (kind = 'review_fraud'           AND subject_review_id IS NOT NULL AND subject_event_vendor_id IS NULL     AND subject_service_id IS NULL) OR
    (kind = 'ghost_listing'          AND subject_review_id IS NULL     AND subject_event_vendor_id IS NULL     AND subject_service_id IS NULL) OR
    (kind = 'inquiry_concentration'  AND subject_review_id IS NULL     AND subject_event_vendor_id IS NULL     AND subject_service_id IS NULL) OR
    (kind = 'price_underdeclaration' AND subject_review_id IS NULL     AND subject_event_vendor_id IS NOT NULL AND subject_service_id IS NULL) OR
    (kind = 'service_card'           AND subject_review_id IS NULL     AND subject_event_vendor_id IS NULL     AND subject_service_id IS NOT NULL)
  );

-- ── 2 · at most ONE holding flag per card ───────────────────────────────────
-- Holding = the three statuses that keep a card out of Explore. A rejected
-- card's next save RE-OPENS that same row (detail.previous = 'rejected') rather
-- than stacking a second one; a closed row (approved · dismissed) is history
-- and any number of them may exist.
CREATE UNIQUE INDEX IF NOT EXISTS integrity_flags_card_uniq
  ON public.integrity_flags(subject_service_id)
  WHERE kind = 'service_card' AND status IN ('open', 'asked_to_fix', 'rejected');

CREATE INDEX IF NOT EXISTS integrity_flags_subject_service_idx
  ON public.integrity_flags(subject_service_id)
  WHERE subject_service_id IS NOT NULL;

COMMENT ON COLUMN public.integrity_flags.subject_service_id IS
  'Service card checks (owner 2026-10-26): the card (vendor_services) a '
  'kind=service_card flag holds out of Explore. NULL for every other kind. The '
  'card is held while this row is open · asked_to_fix · rejected and '
  'vendor_services.is_active is false; enforce_service_publish_gate refuses a '
  'supplier flip. Approved only through approve_service_card().';

-- ── 3 · the claim words and the per-shop allowance ──────────────────────────
CREATE TABLE IF NOT EXISTS public.card_claim_words (
  phrase      TEXT PRIMARY KEY
                CHECK (length(phrase) BETWEEN 1 AND 60 AND phrase = lower(btrim(phrase))),
  note        TEXT CHECK (note IS NULL OR length(note) <= 200),
  created_by  UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.card_claim_words ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS card_claim_words_admin_all ON public.card_claim_words;
CREATE POLICY card_claim_words_admin_all ON public.card_claim_words
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

REVOKE ALL ON public.card_claim_words FROM anon;

COMMENT ON TABLE public.card_claim_words IS
  'Words that hold a service card for a quick check (owner 2026-10-26: seed '
  'guaranteed · #1 · best in · lowest price · official · 100%; admin-editable '
  'under Integrity watch › Cards). Matched as whole words, any case, in the '
  'title, inclusion lines and add-on names by lib/service-card-checks.ts. A hit '
  'never refuses a save — it holds the card. Stored lower-case.';

INSERT INTO public.card_claim_words (phrase, note) VALUES
  ('guaranteed',   'a promise we can’t stand behind'),
  ('#1',           'a ranking nobody measured'),
  ('best in',      'a ranking nobody measured'),
  ('lowest price', 'a comparison'),
  ('official',     'implies an appointment'),
  ('100%',         'a promise we can’t stand behind')
ON CONFLICT (phrase) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.card_claim_word_allowances (
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  phrase            TEXT NOT NULL
                      REFERENCES public.card_claim_words(phrase) ON DELETE CASCADE ON UPDATE CASCADE,
  allowed_by        UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (vendor_profile_id, phrase)
);
ALTER TABLE public.card_claim_word_allowances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS card_claim_word_allowances_admin_all ON public.card_claim_word_allowances;
CREATE POLICY card_claim_word_allowances_admin_all ON public.card_claim_word_allowances
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

REVOKE ALL ON public.card_claim_word_allowances FROM anon;

COMMENT ON TABLE public.card_claim_word_allowances IS
  '"Not a problem — stop flagging “…” for this shop" (owner 2026-10-26: claim '
  'words are admin-editable with a per-shop allowance). Written from an open '
  'card on Integrity watch › Cards. Removing the word removes its allowances.';

-- ── 4 · the owner's price tolerance — OFF until set ─────────────────────────
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS card_price_band_tolerance NUMERIC(4, 3);

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_card_price_band_tolerance_check;
ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_card_price_band_tolerance_check
  CHECK (card_price_band_tolerance IS NULL
         OR (card_price_band_tolerance >= 0 AND card_price_band_tolerance <= 1));

COMMENT ON COLUMN public.platform_settings.card_price_band_tolerance IS
  'Service card checks: how far BELOW a service''s market price band a new or '
  'edited card''s price may sit before the card waits for a quick check — a '
  'FRACTION of the band''s low (0.30 = held below 70 % of low). NULL = the price '
  'check is OFF. Owner 2026-10-26: below the band only; admin-set; off until '
  'set — no guessed number, so there is no default. Edited on /admin/settings.';

-- ── 5 · repost-watch learns the showcase photos ─────────────────────────────
ALTER TABLE public.vendor_image_hashes
  DROP CONSTRAINT IF EXISTS vendor_image_hashes_surface_check;
ALTER TABLE public.vendor_image_hashes
  ADD CONSTRAINT vendor_image_hashes_surface_check
  CHECK (surface IN ('service_primary', 'portfolio', 'moodboard_library', 'service_showcase'));

ALTER TABLE public.vendor_image_flags
  DROP CONSTRAINT IF EXISTS vendor_image_flags_flagged_surface_check;
ALTER TABLE public.vendor_image_flags
  ADD CONSTRAINT vendor_image_flags_flagged_surface_check
  CHECK (flagged_surface IN ('service_primary', 'portfolio', 'moodboard_library', 'service_showcase'));

ALTER TABLE public.vendor_image_flags
  DROP CONSTRAINT IF EXISTS vendor_image_flags_source_surface_check;
ALTER TABLE public.vendor_image_flags
  ADD CONSTRAINT vendor_image_flags_source_surface_check
  CHECK (source_surface IN ('service_primary', 'portfolio', 'moodboard_library', 'service_showcase'));

-- ── 6 · is this card held? — readable by the session that is fenced ─────────
CREATE OR REPLACE FUNCTION public.service_card_held(p_service_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.integrity_flags f
     WHERE f.kind = 'service_card'
       AND f.subject_service_id = p_service_id
       AND f.status IN ('open', 'asked_to_fix', 'rejected')
  );
$function$;

COMMENT ON FUNCTION public.service_card_held(UUID) IS
  'TRUE while a service card waits for a quick check (an open · asked_to_fix · '
  'rejected service_card flag). SECURITY DEFINER because integrity_flags is '
  'admin-only under RLS — the supplier''s session must see its own hold. Says '
  'only yes/no; never the reason or any other shop.';

REVOKE ALL ON FUNCTION public.service_card_held(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.service_card_held(UUID) TO authenticated, service_role;

-- ── 7 · the publish gate refuses a held card going live ─────────────────────
-- Reproduced from 20271222415682 (the live body). ONE delta: the HOLD arm,
-- asked FIRST of a card going live by UPDATE (a card inserted live cannot have
-- a flag yet — the flag names the card's id). Every other line is unchanged.
CREATE OR REPLACE FUNCTION public.enforce_service_publish_gate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_priced     boolean;
  v_going_live boolean;
  v_judging    boolean;
BEGIN
  -- A draft is nobody's business. Every card is born one.
  IF NEW.is_active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Judge only the act of publishing, or of emptying what publishing required.
  --
  -- ⚠ `exclusive_perk_text` is deliberately GONE from this test as well as
  -- from the check below. Leaving it here would re-judge a live card every
  -- time its gift text changed and refuse it for a missing PRICE it never had
  -- — a refusal triggered by editing an unrelated, now-optional field.
  IF TG_OP = 'INSERT' THEN
    v_going_live := TRUE;
  ELSE
    v_going_live := OLD.is_active IS NOT TRUE;
  END IF;
  v_judging := v_going_live
            OR (TG_OP = 'UPDATE' AND NEW.starting_price_php IS DISTINCT FROM OLD.starting_price_php);

  IF NOT v_judging THEN
    RETURN NEW;
  END IF;

  -- 🃏 THE HOLD (service card checks, owner 2026-10-26). A card waiting for a
  -- quick check goes live only on an admin's Approve — never by the supplier's
  -- switch, a PostgREST PATCH, or a save that skipped the check. The door is
  -- the admin's own session, or `approve_service_card()`, which opens
  -- `app.service_card_verdict` for its one transaction.
  IF v_going_live AND TG_OP = 'UPDATE'
     AND public.service_card_held(NEW.vendor_service_id)
     AND NOT public.is_admin()
     AND COALESCE(current_setting('app.service_card_verdict', true), '') <> 'approve' THEN
    RAISE EXCEPTION
      'This card is waiting for a quick check, so it can''t be switched on yet.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- THE COVER — asked only of a card GOING live. A card already live without
  -- one is flagged to its shop, never refused an edit (see the header).
  IF v_going_live AND NULLIF(btrim(COALESCE(NEW.primary_photo_r2_key, '')), '') IS NULL THEN
    RAISE EXCEPTION
      'Add a cover photo before you publish this card — it is the first thing a couple sees. You can still save it as a draft.'
      USING ERRCODE = 'check_violation';
  END IF;

  v_priced := NEW.starting_price_php IS NOT NULL AND NEW.starting_price_php > 0;

  IF NOT v_priced THEN
    RAISE EXCEPTION
      'Set a starting price before you publish this card — it is how couples planning a budget find you. You can still save it as a draft.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

-- ── 8 · Approve — the one door ──────────────────────────────────────────────
-- Closes the holding flag as `approved` and puts the card live, in ONE
-- transaction, so a card can never be approved-but-hidden or live-but-held.
-- The cover · price · what's-included gate still runs on the flip: an Approve
-- cannot publish a card the gate would refuse. Returns FALSE (and changes
-- nothing) when the flag is not holding any more — a stale second click.
CREATE OR REPLACE FUNCTION public.approve_service_card(
  p_flag_id  BIGINT,
  p_reviewer UUID,
  p_note     TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_service UUID;
BEGIN
  UPDATE public.integrity_flags
     SET status           = 'approved',
         resolution_notes = COALESCE(NULLIF(btrim(COALESCE(p_note, '')), ''), 'Approved — the card is live.'),
         reviewed_by      = p_reviewer,
         reviewed_at      = NOW()
   WHERE id = p_flag_id
     AND kind = 'service_card'
     AND status IN ('open', 'asked_to_fix', 'rejected')
  RETURNING subject_service_id INTO v_service;

  IF v_service IS NULL THEN
    RETURN FALSE;
  END IF;

  -- `true` = LOCAL: the door dies with this transaction (connections are
  -- pooled), and is shut again explicitly right after the one flip.
  PERFORM set_config('app.service_card_verdict', 'approve', true);
  UPDATE public.vendor_services
     SET is_active = TRUE, updated_at = NOW()
   WHERE vendor_service_id = v_service;
  PERFORM set_config('app.service_card_verdict', '', true);

  RETURN TRUE;
END;
$function$;

COMMENT ON FUNCTION public.approve_service_card(BIGINT, UUID, TEXT) IS
  'Integrity watch › Cards › Approve: closes a holding service_card flag as '
  'approved and puts the card live in one transaction (the publish gate''s '
  'cover · price · inclusions arms still apply). service_role only — called by '
  'the admin action after requireAdmin().';

REVOKE ALL ON FUNCTION public.approve_service_card(BIGINT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_service_card(BIGINT, UUID, TEXT) TO service_role;

COMMIT;
