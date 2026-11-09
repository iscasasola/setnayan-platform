-- ============================================================================
-- service_card_checks_fix_before_create
--
-- 🃏 SERVICE CARD CHECKS — FIX BEFORE CREATE.
--
-- Owner 2026-10-26 (DECISION_LOG "SERVICE CARD CHECKS — FIX BEFORE CREATE",
-- "CARD CHECKS — NO PRICE BAND; ONE PHOTO, ONE SERVICE CARD", "NO PRICE CHECK ON
-- SERVICE CARDS AT ALL"): *"when there is something they need to change, they
-- must fix it before the service card is created"* · *"once a photo is used. it
-- technically cannot be used on another service card."* ⇒ the checks run live in
-- the shipped maker (Create / Save stays disabled while one is open) and again in
-- `commitVendorService`, which REFUSES. Nothing here holds a card, queues one, or
-- touches the publish gate. No price anything.
--
-- Rebuilt from the stale draft #6956 (its `20271292638647` never reached main and
-- is not reused); this file is allocated forward with `pnpm migration:new`.
--
-- WHAT CHANGES
--   1. `card_claim_words` — the admin-editable list the claim-word check reads,
--      seeded with the owner's six (guaranteed · #1 · best in · lowest price ·
--      official · 100%). No brand names. RLS at CREATE: admin only; the maker's
--      page and the save read it with the service role.
--   2. `card_claim_word_allowances` — a per-shop allowance: admin lets ONE shop
--      use ONE word (an appointed "official" supplier, say). Admin only.
--   3. The repost-watch surface CHECKs learn `service_showcase` — a service
--      card's showcase photos are hashed too. Re-listed in FULL from
--      20271202522764 (a shorter re-list would drop `moodboard_library`).
--   4. `vendor_image_hashes.vendor_service_id` — WHICH card a cover/showcase
--      hash belongs to. A hash blocks another card only while it names one; SET
--      NULL when the card is deleted frees its photos. Backfilled for the cover
--      hashes that already exist.
--   5. `vendor_image_flags.supplier_reported_at` + `supplier_report_note` —
--      "It's mine — report it": a note on the repost-watch row admin already
--      reads, shown there as a list. The card stays blocked.
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
  'best in · lowest price · official · 100%; admin-editable on /admin/repost-watch). '
  'Matched as whole words, any case, in the name, what''s-included lines and '
  'extras by lib/service-card-checks.ts — live in the maker (Create waits) and '
  'again in the save, which refuses. Stored lower-case. `note` is the one-line why '
  'the supplier reads.';

INSERT INTO public.card_claim_words (phrase, note) VALUES
  ('guaranteed',   'A promise we can’t stand behind for you.'),
  ('#1',           'A ranking nobody measured.'),
  ('best in',      'A ranking nobody measured.'),
  ('lowest price', 'A comparison with other shops we can’t check.'),
  ('official',     'Reads as an appointment by a brand or a venue.'),
  ('100%',         'A promise we can’t stand behind for you.')
ON CONFLICT (phrase) DO NOTHING;

-- ── 2 · a per-shop allowance ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.card_claim_word_allowances (
  vendor_profile_id  UUID NOT NULL
                       REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  phrase             TEXT NOT NULL
                       REFERENCES public.card_claim_words(phrase) ON DELETE CASCADE ON UPDATE CASCADE,
  note               TEXT CHECK (note IS NULL OR length(note) <= 200),
  granted_by         UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  granted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
  'A claim word ONE shop may use (owner 2026-10-26 — an appointed supplier may say '
  '"official"). Admin grants and removes it on /admin/repost-watch; the maker and '
  'the save skip that word for that shop only. Deleting the word removes every '
  'allowance for it.';

-- ── 3 · repost-watch learns the showcase photos ─────────────────────────────
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

-- ── 4 · which card a photo's hash belongs to ────────────────────────────────
ALTER TABLE public.vendor_image_hashes
  ADD COLUMN IF NOT EXISTS vendor_service_id UUID
    REFERENCES public.vendor_services(vendor_service_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS vendor_image_hashes_service_idx
  ON public.vendor_image_hashes(vendor_service_id)
  WHERE vendor_service_id IS NOT NULL;

COMMENT ON COLUMN public.vendor_image_hashes.vendor_service_id IS
  'One photo = one service card (owner 2026-10-26): the card a service_primary / '
  'service_showcase hash is on. Written by the card save; read by the maker''s '
  'photo check (lib/card-photo-check.server.ts). A hash blocks another card only '
  'while this is set. NULL for portfolio and moodboard hashes, for a photo the '
  'card no longer carries, and once the card is deleted (SET NULL frees it).';

-- The cover hashes made before this rule name their card now, so a cover that is
-- on a card today is protected from the first save after this ships. One card per
-- hash: where two of a shop's cards share one stored ref, the older card keeps it.
UPDATE public.vendor_image_hashes h
   SET vendor_service_id = s.vendor_service_id
  FROM (
    SELECT DISTINCT ON (vs.vendor_profile_id, vs.primary_photo_r2_key)
           vs.vendor_profile_id, vs.primary_photo_r2_key, vs.vendor_service_id
      FROM public.vendor_services vs
     WHERE vs.primary_photo_r2_key IS NOT NULL
     ORDER BY vs.vendor_profile_id, vs.primary_photo_r2_key, vs.created_at ASC
  ) s
 WHERE h.vendor_service_id IS NULL
   AND h.surface = 'service_primary'
   AND h.vendor_profile_id = s.vendor_profile_id
   AND h.r2_ref = s.primary_photo_r2_key;

-- ── 5 · "It's mine — report it" ─────────────────────────────────────────────
ALTER TABLE public.vendor_image_flags
  ADD COLUMN IF NOT EXISTS supplier_reported_at TIMESTAMPTZ;
ALTER TABLE public.vendor_image_flags
  ADD COLUMN IF NOT EXISTS supplier_report_note TEXT;
ALTER TABLE public.vendor_image_flags
  DROP CONSTRAINT IF EXISTS vendor_image_flags_supplier_report_note_check;
ALTER TABLE public.vendor_image_flags
  ADD CONSTRAINT vendor_image_flags_supplier_report_note_check
  CHECK (supplier_report_note IS NULL OR length(supplier_report_note) <= 200);

CREATE INDEX IF NOT EXISTS vendor_image_flags_supplier_reported_idx
  ON public.vendor_image_flags(supplier_reported_at DESC)
  WHERE supplier_reported_at IS NOT NULL;

COMMENT ON COLUMN public.vendor_image_flags.supplier_reported_at IS
  '"It''s mine — report it" (owner 2026-10-26): when the supplier who was stopped '
  'from using this photo said it is theirs. The card stays blocked; admin reads '
  'the reports as a LIST on /admin/repost-watch. NULL = no report.';

COMMIT;
