-- =============================================================================
-- 20260719000000_onboarding_v2_event_columns.sql
--
-- Iteration 0016 — Onboarding V2 (Wedding) · Phase 1 of 5
-- Spec corpus: Onboarding_Wedding_Flow_2026-06-01.html + Onboarding_Blueprint_2026-05-30.md
-- CLAUDE.md decision log 2026-06-02 "Production port · cutover locked".
--
-- WHY: The locked /proto onboarding captures fields not yet on the events
-- table (bride/groom split, candidate-set dates, budget feel-band, mono
-- frame+font, top-100 music seed, mood feel, region). These need to land
-- BEFORE Phase 4 wires the final commit screen (account-or-skip → write
-- events row) so the column writes don't fail at commit-time.
--
-- Schema philosophy: all NEW columns are ADDITIVE + NULLABLE + idempotent
-- via IF NOT EXISTS. Zero impact on existing rows; zero rollback risk.
-- Existing columns (ceremony_type, secondary_ceremony_type, venue_setting,
-- monogram_text, estimated_pax, estimated_budget_centavos) carry forward
-- unchanged and are written by Phase 4 alongside these new ones.
--
-- Per the locked V2 architecture, the events row is created LAZILY at
-- screen 13 (account-or-skip gate) with ALL captured data committed in
-- one shot. Screens 1-12 hold state in client localStorage + sessionStorage,
-- so this migration is forward-prep for Phase 4 — Phase 1 does not write
-- any of these columns yet.
-- =============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Names — bride + groom captured distinctly on screen 5 (CLAUDE.md
--    2026-06-01 "🤍 Bride + Groom captured distinctly"). Bride/Groom split
--    is vital for invitation surfaces + monogram derivation; events.display_name
--    is the combined "Bride & Groom" string used as the event label.
-- ----------------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS bride_name TEXT,
  ADD COLUMN IF NOT EXISTS groom_name TEXT;

COMMENT ON COLUMN public.events.bride_name IS
  'First name of the bride (Onboarding screen 5 — Bride field). Used for invitation surfaces, monogram derivation, and addressing. Iteration 0016 V2.';

COMMENT ON COLUMN public.events.groom_name IS
  'First name of the groom (Onboarding screen 5 — Groom field). Same purpose as bride_name. Iteration 0016 V2.';


-- ----------------------------------------------------------------------------
-- 2. Region — screen 7 captures the wedding region (NCR · CALABARZON ·
--    Central Visayas · etc.). Drives the region-tiered vendor monetization
--    + area-match for the marketplace. Stored as a slug; UI labels resolved
--    client-side from a static map.
-- ----------------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS region TEXT;

COMMENT ON COLUMN public.events.region IS
  'Region slug — ncr · calabarzon · central_visayas · western_visayas · central_luzon · etc. Per CLAUDE.md 2026-06-01 "💰 Region-tiered vendor monetization" locks this as the basis for vendor coverage + monetization tiers. NULL until screen 7 lands.';


-- ----------------------------------------------------------------------------
-- 3. Date capture — three modes per CLAUDE.md 2026-06-01 "🎀 Mixed = interfaith
--    multi-select faith + 3rd date mode" then refined to two modes on
--    2026-06-01 "🎀 Onboarding batch — 5 Golden Rules + date modes merged
--    3→2 (1-4 specific + flexible window)". Specific dates = 1-4 candidates.
--    Flexible window = up to 30 days inclusive. The final wedding_date is
--    resolved at vendor-availability convergence time (intersection of
--    locked vendors' free candidates), stamping events.event_date.
-- ----------------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS date_mode TEXT,
  ADD COLUMN IF NOT EXISTS date_candidates DATE[],
  ADD COLUMN IF NOT EXISTS date_window_start DATE,
  ADD COLUMN IF NOT EXISTS date_window_end DATE;

-- Constraint via DO block (avoids CHECK syntax pitfalls if column already exists with constraint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_date_mode_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_date_mode_check
      CHECK (date_mode IS NULL OR date_mode IN ('specific', 'window'));
  END IF;
END$$;

COMMENT ON COLUMN public.events.date_mode IS
  'specific | window — how the couple expressed their date(s) on screen 6. specific = 1-4 candidate dates in date_candidates. window = a contiguous date_window_start..date_window_end range up to 30 days. The final wedding_date stamps events.event_date when vendor availability converges.';

COMMENT ON COLUMN public.events.date_candidates IS
  'Array of 1-4 specific dates the couple is considering (date_mode=specific). Resolution: at vendor-lock time, the intersection of locked vendors free-days narrows this set; the resolved final stamps event_date.';

COMMENT ON COLUMN public.events.date_window_start IS
  'Inclusive start of the flexible date window (date_mode=window). Max 30 days inclusive with date_window_end.';

COMMENT ON COLUMN public.events.date_window_end IS
  'Inclusive end of the flexible date window (date_mode=window). Capped at start + 29 days at the UI layer.';


-- ----------------------------------------------------------------------------
-- 4. Budget feel-band — screen 9 captures the band, not a peso amount
--    (CLAUDE.md 2026-06-01 "🎯 pax-tier nuggets + budget feel-band ladder").
--    Each band carries a per-head median; events.estimated_budget_centavos
--    is the median×pax working figure committed for ranking. The band itself
--    drives which feel-photo tier renders + the bundle pricing.
-- ----------------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS budget_band TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_budget_band_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_budget_band_check
      CHECK (budget_band IS NULL OR budget_band IN (
        'essentials', 'simple', 'classic', 'elevated', 'premium', 'luxury', 'no_limit'
      ));
  END IF;
END$$;

COMMENT ON COLUMN public.events.budget_band IS
  '7-band budget feel ladder from onboarding screen 9. essentials · simple · classic (the sweet spot, default pre-select) · elevated · premium · luxury · no_limit. Median per-head locked at the UI layer (essentials ₱2,000 → luxury ₱15,000). events.estimated_budget_centavos is the median×pax working figure.';


-- ----------------------------------------------------------------------------
-- 5. Monogram frame + font — screen 5 lets the couple style the monogram
--    via 4 luxe gold frames × 5 premium fonts (CLAUDE.md 2026-06-01 luxury
--    frames + 2026-06-01 onboarding refinements). events.monogram_text already
--    holds the rendered initials ("M & J"); these two add the styling.
-- ----------------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS monogram_frame_key TEXT,
  ADD COLUMN IF NOT EXISTS monogram_font_key TEXT;

COMMENT ON COLUMN public.events.monogram_frame_key IS
  'Frame slug — wreath · crest · square · oval · none (or one of the Monogram Lab extensions: art_deco · laurel · baroque · ribbon · botanical · diamond · flourish). Sets the gold filigree frame for the rendered monogram.';

COMMENT ON COLUMN public.events.monogram_font_key IS
  'Font slug — cormorant · cinzel · playfair · great_vibes · marcellus. Sets the italic-serif / engraved-caps / script style for the monogram initials.';


-- ----------------------------------------------------------------------------
-- 6. Mood feel + music seed — screens 11 (palette feel) + 11 (top-100 song
--    picker) capture brand/mood inputs that flow to (a) the mood board
--    initial palette, (b) the post-booking playlist builder, (c) vendor
--    matching as soft signals.
-- ----------------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS mood_feel_key TEXT,
  ADD COLUMN IF NOT EXISTS music_playlist_seed TEXT[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_mood_feel_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_mood_feel_check
      CHECK (mood_feel_key IS NULL OR mood_feel_key IN (
        'timeless', 'modern', 'boho', 'rustic', 'glam', 'royalty', 'filipiniana', 'others'
      ));
  END IF;
END$$;

COMMENT ON COLUMN public.events.mood_feel_key IS
  '8-feel mood ladder from onboarding palette screen. timeless · modern · boho · rustic · glam · royalty · filipiniana · others (couple builds in mood board). Drives the feel-photo example + suggested-palette colors. Feeds iteration 0010 Mood Board as the initial seed.';

COMMENT ON COLUMN public.events.music_playlist_seed IS
  'Couple-picked songs from the top-100 list (onboarding music screen). At least 10 picks required to advance. Feeds the post-booking playlist builder (CLAUDE.md 2026-05-23 Today''s Focus wizard) — the booked DJ/band syncs to it.';

COMMIT;

-- =============================================================================
-- Verification
-- =============================================================================
-- Run after apply:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'events'
--     AND column_name IN ('bride_name','groom_name','region','date_mode',
--                         'date_candidates','date_window_start','date_window_end',
--                         'budget_band','monogram_frame_key','monogram_font_key',
--                         'mood_feel_key','music_playlist_seed')
--   ORDER BY column_name;
-- Expect: 12 rows, all is_nullable='YES'.
