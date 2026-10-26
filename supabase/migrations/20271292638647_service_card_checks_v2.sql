-- ============================================================================
-- service_card_checks_v2
--
-- 🃏 SERVICE CARD CHECKS — FIX BEFORE CREATE (the schema half).
--
-- Owner 2026-10-26 (DECISION_LOG "SERVICE CARD CHECKS — FIX BEFORE CREATE",
-- "CARD CHECKS — NO PRICE BAND; ONE PHOTO, ONE SERVICE CARD", "NO PRICE CHECK ON
-- SERVICE CARDS AT ALL"; corpus prototypes/service_card_checks_2026-10-26/ PLAN
-- §5): *"when there is something they need to change, they must fix it before
-- the service card is created"* · *"once a photo is used. it technically cannot
-- be used on another service card."* ⇒ the checks run in the maker before
-- Create and again in the save action, which REFUSES. Nothing here holds a card,
-- queues one, or touches the publish gate. No price anything.
--
-- WHAT CHANGES
--   1. `card_claim_words` — the admin-editable list the words check reads
--      (seeded with the owner's six: guaranteed · #1 · best in · lowest price ·
--      official · 100%). RLS at CREATE: admin only; the maker's page and the
--      save read it with the service role.
--   2. The repost-watch surface CHECKs learn `service_showcase` — a service
--      card's showcase photos are hashed too. Re-listed in FULL from
--      20271202522764 (a shorter re-list would drop `moodboard_library`).
--   3. `vendor_image_hashes.vendor_service_id` — WHICH card a cover/showcase
--      hash belongs to, so "one photo = one service card" can name the card
--      (own shop) or refuse it (another shop). SET NULL: a deleted card frees
--      its photos.
--   4. `vendor_image_flags.supplier_reported_at` + `supplier_report_note` —
--      "It's mine — report it": a note on the repost-watch row admin already
--      reads. The card stays blocked (PLAN §3).
--
-- KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ============================================================================

BEGIN;

-- ── 1 · the claim words ─────────────────────────────────────────────────────
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
  'Words a service card may not carry (owner 2026-10-26: seed guaranteed · #1 · '
  'best in · lowest price · official · 100%; admin-editable on /admin/settings). '
  'Matched as whole words, any case, in the name, inclusion lines and add-on '
  'names by lib/service-card-checks.ts — in the maker before Create, and again '
  'in the save, which refuses. Stored lower-case.';

INSERT INTO public.card_claim_words (phrase, note) VALUES
  ('guaranteed',   'a promise we can’t stand behind'),
  ('#1',           'a ranking nobody measured'),
  ('best in',      'a ranking nobody measured'),
  ('lowest price', 'a comparison'),
  ('official',     'implies an appointment'),
  ('100%',         'a promise we can’t stand behind')
ON CONFLICT (phrase) DO NOTHING;

-- ── 2 · repost-watch learns the showcase photos ─────────────────────────────
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

-- ── 3 · which card a photo's hash belongs to ────────────────────────────────
ALTER TABLE public.vendor_image_hashes
  ADD COLUMN IF NOT EXISTS vendor_service_id UUID
    REFERENCES public.vendor_services(vendor_service_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS vendor_image_hashes_service_idx
  ON public.vendor_image_hashes(vendor_service_id)
  WHERE vendor_service_id IS NOT NULL;

COMMENT ON COLUMN public.vendor_image_hashes.vendor_service_id IS
  'One photo = one service card (owner 2026-10-26): the card a service_primary / '
  'service_showcase hash is on. Written by the card save; read by the maker''s '
  'upload-time photo check (lib/card-photo-check.server.ts). NULL for portfolio '
  'and moodboard hashes, for hashes made before the rule, and once the card is '
  'deleted (SET NULL frees the photo).';

-- ── 4 · "It's mine — report it" ─────────────────────────────────────────────
ALTER TABLE public.vendor_image_flags
  ADD COLUMN IF NOT EXISTS supplier_reported_at TIMESTAMPTZ;
ALTER TABLE public.vendor_image_flags
  ADD COLUMN IF NOT EXISTS supplier_report_note TEXT;
ALTER TABLE public.vendor_image_flags
  DROP CONSTRAINT IF EXISTS vendor_image_flags_supplier_report_note_check;
ALTER TABLE public.vendor_image_flags
  ADD CONSTRAINT vendor_image_flags_supplier_report_note_check
  CHECK (supplier_report_note IS NULL OR length(supplier_report_note) <= 200);

COMMENT ON COLUMN public.vendor_image_flags.supplier_reported_at IS
  '"It''s mine — report it" (owner 2026-10-26): when the supplier who was blocked '
  'from using this photo said it is theirs. The card stays blocked; admin reads '
  'it on /admin/repost-watch. NULL = no report.';

COMMIT;
