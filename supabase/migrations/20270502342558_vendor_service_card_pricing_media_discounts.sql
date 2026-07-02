-- vendor_service_card_pricing_media_discounts
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)
--
-- ============================================================================
-- SERVICE-CARD REDESIGN — Phase 1 (schema). Owner-approved 2026-07-02 (see
-- DECISION_LOG + [[project_setnayan_service_card_prototype_final]]). The
-- finalized quote-based fast card. RECONCILED to the shipped schema: refinements
-- REUSE vendor_service_attributes, add-ons REUSE vendor_service_addons,
-- comes-with REUSE vendor_service_links, downpayment REUSE
-- vendor_service_payment_schedules + Locked-QR, serves-event-types REUSE
-- vendor_coverages.event_types. This migration adds ONLY the six genuine gaps:
--
--   1. vendor_services pricing basis + per-hour + minimums + crew-meal/transport
--      included flags + showcase media (video + up to 5 photos).
--   2. vendor_service_price_brackets — the "Fixed" pax-bracket tiers (one open
--      bracket = a flat price; add brackets to price by venue size).
--   3. vendor_service_inclusions — FREE items with a stated worth (the value
--      story; "₱X free"). Distinct from PAID vendor_service_addons.
--   4. vendor_service_discounts — MULTI-discount (couples see the best they
--      qualify for). FULL CUT-OVER: backfill the single legacy discount_* into
--      one row, then DROP the legacy columns + rewrite save_vendor_service.
--   5. vendor_coverages.faiths — faiths served (mirrors event_types; validated
--      app-side against faith_vocab; empty = all faiths welcomed).
--   6. save_vendor_service RPC — drop discount_* writes, add p_discounts /
--      p_brackets / p_inclusions replace-all + the new scalar columns.
--
-- Additive + NULL-safe: existing rows read as pricing_basis='fixed' (their
-- starting_price_php IS the anchor), crew-meal/transport not-included, no media,
-- their single discount migrated into one discounts row.
--
-- Patterns copied verbatim (do-not-invent), all from vendor_service_addons /
-- vendor_coverages (20270426250948): id + generate_public_id + denormalized
-- vendor_profile_id; public-read gated (vendor published + anchor active);
-- vendor-org RLS via current_vendor_profile_ids(); console-admin via
-- is_console_admin(). ⚠ NEW public_id type letters 'K' (bracKet) / 'N' (iNclusion)
-- / 'D' (Discount) are content-free labels (mirrors the V/O sign-off in
-- 20270426250948) — flagged for owner sign-off in the PR.
-- ============================================================================

-- ============================================================================
-- 1 · vendor_services — pricing basis, per-hour, minimums, crew/transport, media
-- ============================================================================
ALTER TABLE public.vendor_services
  -- How the base "from ₱X" anchor is computed. Existing rows = 'fixed' (their
  -- starting_price_php is the anchor). starting_price_php STAYS the synced
  -- display/Explore/budget anchor for ALL bases (the app keeps it = the computed
  -- floor: min bracket / per_pax_price×min_pax / hour_base_php).
  ADD COLUMN IF NOT EXISTS pricing_basis TEXT NOT NULL DEFAULT 'fixed'
    CHECK (pricing_basis IN ('fixed', 'per_pax', 'per_hour')),
  -- Per-pax basis: the per-head rate + the minimum pax floor (anchor = rate×min).
  ADD COLUMN IF NOT EXISTS per_pax_price_php INTEGER
    CHECK (per_pax_price_php IS NULL OR per_pax_price_php >= 0),
  ADD COLUMN IF NOT EXISTS min_pax INTEGER
    CHECK (min_pax IS NULL OR min_pax > 0),
  -- Per-hour basis: base covers a minimum block; extra hours bill per-hour.
  ADD COLUMN IF NOT EXISTS hour_base_php INTEGER
    CHECK (hour_base_php IS NULL OR hour_base_php >= 0),
  ADD COLUMN IF NOT EXISTS min_hours NUMERIC
    CHECK (min_hours IS NULL OR min_hours > 0),
  ADD COLUMN IF NOT EXISTS extra_hour_php INTEGER
    CHECK (extra_hour_php IS NULL OR extra_hour_php >= 0),
  -- Crew meal + transport included flags. Default NOT included → the couple
  -- provides / pays (feeds the 0007 budget's Crew-Meal + Transportation lines);
  -- the card flags whatever is not included. transport_flat_fee_php set only when
  -- transport is a flat fee (else NULL = quote-by-distance).
  ADD COLUMN IF NOT EXISTS crew_meal_included BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS transport_included BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS transport_flat_fee_php INTEGER
    CHECK (transport_flat_fee_php IS NULL OR transport_flat_fee_php >= 0),
  -- Showcase media: one 30s video (r2 key) + up to 5 photos. primary_photo_r2_key
  -- stays the cover (typically photos[0]); this adds the gallery + the clip.
  ADD COLUMN IF NOT EXISTS showcase_video_r2_key TEXT,
  ADD COLUMN IF NOT EXISTS showcase_photo_r2_keys TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
    CHECK (cardinality(showcase_photo_r2_keys) <= 5);

COMMENT ON COLUMN public.vendor_services.pricing_basis IS
  'How the base "from ₱X" anchor is computed: fixed (starting_price_php / price brackets) | per_pax (per_pax_price_php × min_pax) | per_hour (hour_base_php over min_hours + extra_hour_php). starting_price_php is kept synced = the computed floor for Explore/budget. Service-card redesign 2026-07-02.';
COMMENT ON COLUMN public.vendor_services.min_pax IS
  'Per-pax basis: minimum guaranteed pax (the pricing floor; anchor = per_pax_price_php × min_pax).';
COMMENT ON COLUMN public.vendor_services.extra_hour_php IS
  'Per-hour basis: charge per hour beyond min_hours (the base covers the minimum block).';
COMMENT ON COLUMN public.vendor_services.crew_meal_included IS
  'TRUE = crew meal is in the price. FALSE (default) = not included, couple provides — the card flags it and it feeds the couple''s Crew-Meal budget line (iteration 0007). Supersedes the legacy crew_meal_required flag.';
COMMENT ON COLUMN public.vendor_services.transport_included IS
  'TRUE = transport included within coverage. FALSE (default) = not included; transport_flat_fee_php set → flat fee, NULL → quote by distance. Feeds the couple''s Transportation budget line.';
COMMENT ON COLUMN public.vendor_services.showcase_photo_r2_keys IS
  'Up to 5 showcase photo r2 keys for the service card (paired with showcase_video_r2_key, a single 30s clip). primary_photo_r2_key remains the cover.';

-- ============================================================================
-- 2 · vendor_service_price_brackets — Fixed-basis pax tiers
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vendor_service_price_brackets (
  id                 BIGSERIAL PRIMARY KEY,
  public_id          TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('K'),
  vendor_service_id  UUID NOT NULL
                     REFERENCES public.vendor_services(vendor_service_id) ON DELETE CASCADE,
  vendor_profile_id  UUID NOT NULL
                     REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- Guest-count band this locked price covers. min_pax NULL = from 0; max_pax
  -- NULL = "any size" (an open bracket ⇒ a flat price). price_php is the locked
  -- base for the band.
  min_pax            INTEGER CHECK (min_pax IS NULL OR min_pax >= 0),
  max_pax            INTEGER CHECK (max_pax IS NULL OR max_pax > 0),
  price_php          INTEGER NOT NULL CHECK (price_php >= 0),
  sort_order         INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vendor_service_price_brackets_pax_order
    CHECK (min_pax IS NULL OR max_pax IS NULL OR max_pax >= min_pax)
);

CREATE INDEX IF NOT EXISTS vendor_service_price_brackets_service_idx
  ON public.vendor_service_price_brackets (vendor_service_id, sort_order);
CREATE INDEX IF NOT EXISTS vendor_service_price_brackets_vendor_idx
  ON public.vendor_service_price_brackets (vendor_profile_id);

ALTER TABLE public.vendor_service_price_brackets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_service_price_brackets_public_read ON public.vendor_service_price_brackets;
CREATE POLICY vendor_service_price_brackets_public_read
  ON public.vendor_service_price_brackets FOR SELECT
  TO authenticated
  USING (
    vendor_profile_id IN (SELECT vendor_profile_id FROM public.vendor_profiles WHERE is_published = TRUE)
    AND vendor_service_id IN (SELECT vendor_service_id FROM public.vendor_services WHERE is_active = TRUE)
  );

DROP POLICY IF EXISTS vendor_service_price_brackets_vendor_all ON public.vendor_service_price_brackets;
CREATE POLICY vendor_service_price_brackets_vendor_all ON public.vendor_service_price_brackets
  FOR ALL
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS vendor_service_price_brackets_admin_all ON public.vendor_service_price_brackets;
CREATE POLICY vendor_service_price_brackets_admin_all ON public.vendor_service_price_brackets
  FOR ALL
  USING (public.is_console_admin())
  WITH CHECK (public.is_console_admin());

COMMENT ON TABLE public.vendor_service_price_brackets IS
  'Fixed-basis pax pricing tiers on a service card: a locked price per guest-count band (max_pax NULL = "any size" ⇒ a single open bracket = a flat price; multiple = tiered by venue size). The card "from ₱X" anchor = the lowest bracket price. Public-read gated like vendor_service_addons; vendor-org + console-admin write. Service-card redesign 2026-07-02.';

-- ============================================================================
-- 3 · vendor_service_inclusions — FREE items with a stated worth
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vendor_service_inclusions (
  id                 BIGSERIAL PRIMARY KEY,
  public_id          TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('N'),
  vendor_service_id  UUID NOT NULL
                     REFERENCES public.vendor_services(vendor_service_id) ON DELETE CASCADE,
  vendor_profile_id  UUID NOT NULL
                     REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  label              TEXT NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 80),
  -- The item's peso worth, shown to couples as free value ("₱X free"). NULL =
  -- included but no stated worth. Adds ₱0 to the price (that's what makes it an
  -- inclusion, not an add-on).
  worth_php          INTEGER CHECK (worth_php IS NULL OR worth_php >= 0),
  sort_order         INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_service_inclusions_service_idx
  ON public.vendor_service_inclusions (vendor_service_id, sort_order);
CREATE INDEX IF NOT EXISTS vendor_service_inclusions_vendor_idx
  ON public.vendor_service_inclusions (vendor_profile_id);

ALTER TABLE public.vendor_service_inclusions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_service_inclusions_public_read ON public.vendor_service_inclusions;
CREATE POLICY vendor_service_inclusions_public_read
  ON public.vendor_service_inclusions FOR SELECT
  TO authenticated
  USING (
    vendor_profile_id IN (SELECT vendor_profile_id FROM public.vendor_profiles WHERE is_published = TRUE)
    AND vendor_service_id IN (SELECT vendor_service_id FROM public.vendor_services WHERE is_active = TRUE)
  );

DROP POLICY IF EXISTS vendor_service_inclusions_vendor_all ON public.vendor_service_inclusions;
CREATE POLICY vendor_service_inclusions_vendor_all ON public.vendor_service_inclusions
  FOR ALL
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS vendor_service_inclusions_admin_all ON public.vendor_service_inclusions;
CREATE POLICY vendor_service_inclusions_admin_all ON public.vendor_service_inclusions
  FOR ALL
  USING (public.is_console_admin())
  WITH CHECK (public.is_console_admin());

COMMENT ON TABLE public.vendor_service_inclusions IS
  'FREE items (or services) bundled in a service card, each with a stated peso worth shown to couples ("Includes … · ₱X free"). Adds ₱0 to the price — this is the value story, distinct from the PAID vendor_service_addons. Public-read gated like vendor_service_addons; vendor-org + console-admin write. Service-card redesign 2026-07-02.';

-- ============================================================================
-- 4 · vendor_service_discounts — MULTI-discount (couple sees the best)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vendor_service_discounts (
  id                 BIGSERIAL PRIMARY KEY,
  public_id          TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('D'),
  vendor_service_id  UUID NOT NULL
                     REFERENCES public.vendor_services(vendor_service_id) ON DELETE CASCADE,
  vendor_profile_id  UUID NOT NULL
                     REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  discount_type      TEXT NOT NULL
                     CHECK (discount_type IN ('early_booking','off_peak','bundle','promo','returning')),
  -- The rate. unit says whether it is a percent or a peso amount off.
  rate               NUMERIC NOT NULL CHECK (rate > 0),
  unit               TEXT NOT NULL DEFAULT 'pct' CHECK (unit IN ('pct','php')),
  expires_at         TIMESTAMPTZ,   -- required for 'promo' (app-enforced)
  conditions_md      TEXT,
  sort_order         INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_service_discounts_service_idx
  ON public.vendor_service_discounts (vendor_service_id, sort_order);
CREATE INDEX IF NOT EXISTS vendor_service_discounts_vendor_idx
  ON public.vendor_service_discounts (vendor_profile_id);

ALTER TABLE public.vendor_service_discounts ENABLE ROW LEVEL SECURITY;

-- Public read — couples see the discounts to compute the best they qualify for.
DROP POLICY IF EXISTS vendor_service_discounts_public_read ON public.vendor_service_discounts;
CREATE POLICY vendor_service_discounts_public_read
  ON public.vendor_service_discounts FOR SELECT
  TO authenticated
  USING (
    vendor_profile_id IN (SELECT vendor_profile_id FROM public.vendor_profiles WHERE is_published = TRUE)
    AND vendor_service_id IN (SELECT vendor_service_id FROM public.vendor_services WHERE is_active = TRUE)
  );

DROP POLICY IF EXISTS vendor_service_discounts_vendor_all ON public.vendor_service_discounts;
CREATE POLICY vendor_service_discounts_vendor_all ON public.vendor_service_discounts
  FOR ALL
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS vendor_service_discounts_admin_all ON public.vendor_service_discounts;
CREATE POLICY vendor_service_discounts_admin_all ON public.vendor_service_discounts
  FOR ALL
  USING (public.is_console_admin())
  WITH CHECK (public.is_console_admin());

COMMENT ON TABLE public.vendor_service_discounts IS
  'Multiple discounts a vendor offers on a service card; each couple is shown the single best one they qualify for. unit = pct|php. Replaces the single vendor_services.discount_* columns (backfilled + dropped in this migration). Public-read gated like vendor_service_addons; vendor-org + console-admin write. Service-card redesign 2026-07-02.';

-- Backfill: migrate each legacy single discount into one row. The legacy
-- discount_value was unit-ambiguous (whole number = % OR peso flat); heuristic
-- value <= 100 ⇒ 'pct', else 'php' (matches the old DiscountFields help). Only
-- rows that don't already have a discount row (idempotent re-run).
INSERT INTO public.vendor_service_discounts
  (vendor_service_id, vendor_profile_id, discount_type, rate, unit, expires_at, conditions_md, sort_order)
SELECT vs.vendor_service_id, vs.vendor_profile_id, vs.discount_type, vs.discount_value,
       CASE WHEN vs.discount_value <= 100 THEN 'pct' ELSE 'php' END,
       vs.discount_expires_at, vs.discount_conditions_md, 0
FROM public.vendor_services vs
WHERE vs.discount_type IS NOT NULL
  AND vs.discount_value IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.vendor_service_discounts d
    WHERE d.vendor_service_id = vs.vendor_service_id
  );

-- Full cut-over: drop the legacy single-discount columns (RPC + reads updated in
-- this same PR). IF EXISTS keeps the migration idempotent.
ALTER TABLE public.vendor_services
  DROP COLUMN IF EXISTS discount_type,
  DROP COLUMN IF EXISTS discount_value,
  DROP COLUMN IF EXISTS discount_expires_at,
  DROP COLUMN IF EXISTS discount_conditions_md;

-- ============================================================================
-- 5 · vendor_coverages.faiths — faiths served (mirrors event_types)
-- ============================================================================
ALTER TABLE public.vendor_coverages
  -- Faiths the vendor serves for this coverage. Empty = all faiths welcomed
  -- (the couple-side religion filter treats empty as "compatible with all").
  -- Members are TITLE-CASE FaithKey values validated app-side against faith_vocab
  -- (same app-validated pattern as canonical_service — no FK/trigger, since the
  -- vocab is admin-editable + the storage compares with strict === in code).
  ADD COLUMN IF NOT EXISTS faiths TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS vendor_coverages_faiths_gin
  ON public.vendor_coverages USING GIN (faiths);

COMMENT ON COLUMN public.vendor_coverages.faiths IS
  'Faiths the vendor serves for this coverage (TITLE-CASE FaithKey, app-validated against faith_vocab). Empty = all faiths welcomed (the religion filter treats empty as compatible-with-all). Mirrors event_types. Service-card redesign 2026-07-02.';

-- ============================================================================
-- 6 · save_vendor_service RPC — drop discount_* writes, add discounts/brackets/
--     inclusions replace-all + the new scalar columns.
-- ============================================================================
-- Drop the old 6-arg signature before creating the 9-arg one (overload-safe).
DROP FUNCTION IF EXISTS public.save_vendor_service(uuid, uuid, jsonb, jsonb, jsonb, boolean);

CREATE OR REPLACE FUNCTION public.save_vendor_service(
  p_vendor_profile_id uuid,
  p_service_id        uuid,     -- NULL = create, else update
  p_fields            jsonb,    -- vendor_services column values (TS-validated)
  p_links             jsonb,    -- [{linked_canonical_service,linked_label,display_order}]
  p_schedule          jsonb,    -- [{seq,label,amount_kind,percent_bps,amount_centavos,due_anchor,due_offset_days}]
  p_discounts         jsonb,    -- [{discount_type,rate,unit,expires_at,conditions_md,sort_order}]
  p_brackets          jsonb,    -- [{min_pax,max_pax,price_php,sort_order}]  (fixed basis)
  p_inclusions        jsonb,    -- [{label,worth_php,sort_order}]
  p_publish           boolean
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_id uuid;
  v_perk       text;
BEGIN
  v_perk := NULLIF(btrim(COALESCE(p_fields->>'exclusive_perk_text', '')), '');

  IF p_publish AND v_perk IS NULL THEN
    RAISE EXCEPTION 'A Setnayan Exclusive perk is required to publish this service.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_service_id IS NULL THEN
    INSERT INTO public.vendor_services (
      vendor_profile_id, category, title, starting_price_php, added_pax_price_php,
      base_pax, coverage_id,
      pricing_basis, per_pax_price_php, min_pax, hour_base_php, min_hours, extra_hour_php,
      crew_size, crew_meal_required, crew_meal_included,
      transport_included, transport_flat_fee_php,
      showcase_video_r2_key, showcase_photo_r2_keys,
      branch_id, recommended_lead_time_months,
      last_minute_end_months, last_minute_surcharge_pct, daily_capacity,
      exclusive_perk_text, primary_photo_r2_key, is_active
    ) VALUES (
      p_vendor_profile_id,
      p_fields->>'category',
      NULLIF(p_fields->>'title', ''),
      (p_fields->>'starting_price_php')::int,
      (p_fields->>'added_pax_price_php')::int,
      (p_fields->>'base_pax')::int,
      (p_fields->>'coverage_id')::bigint,
      COALESCE(p_fields->>'pricing_basis', 'fixed'),
      (p_fields->>'per_pax_price_php')::int,
      (p_fields->>'min_pax')::int,
      (p_fields->>'hour_base_php')::int,
      (p_fields->>'min_hours')::numeric,
      (p_fields->>'extra_hour_php')::int,
      (p_fields->>'crew_size')::int,
      COALESCE((p_fields->>'crew_meal_required')::boolean, FALSE),
      COALESCE((p_fields->>'crew_meal_included')::boolean, FALSE),
      COALESCE((p_fields->>'transport_included')::boolean, FALSE),
      (p_fields->>'transport_flat_fee_php')::int,
      NULLIF(p_fields->>'showcase_video_r2_key', ''),
      COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_fields->'showcase_photo_r2_keys', '[]'::jsonb))),
        ARRAY[]::text[]
      ),
      (p_fields->>'branch_id')::uuid,
      (p_fields->>'recommended_lead_time_months')::numeric,
      (p_fields->>'last_minute_end_months')::int,
      (p_fields->>'last_minute_surcharge_pct')::int,
      (p_fields->>'daily_capacity')::int,
      v_perk,
      NULLIF(p_fields->>'primary_photo_r2_key', ''),
      p_publish
    )
    RETURNING vendor_service_id INTO v_service_id;
  ELSE
    UPDATE public.vendor_services SET
      title                        = NULLIF(p_fields->>'title', ''),
      starting_price_php           = (p_fields->>'starting_price_php')::int,
      added_pax_price_php          = (p_fields->>'added_pax_price_php')::int,
      base_pax                     = (p_fields->>'base_pax')::int,
      coverage_id                  = (p_fields->>'coverage_id')::bigint,
      pricing_basis                = COALESCE(p_fields->>'pricing_basis', 'fixed'),
      per_pax_price_php            = (p_fields->>'per_pax_price_php')::int,
      min_pax                      = (p_fields->>'min_pax')::int,
      hour_base_php                = (p_fields->>'hour_base_php')::int,
      min_hours                    = (p_fields->>'min_hours')::numeric,
      extra_hour_php               = (p_fields->>'extra_hour_php')::int,
      crew_size                    = (p_fields->>'crew_size')::int,
      crew_meal_required           = COALESCE((p_fields->>'crew_meal_required')::boolean, FALSE),
      crew_meal_included           = COALESCE((p_fields->>'crew_meal_included')::boolean, FALSE),
      transport_included           = COALESCE((p_fields->>'transport_included')::boolean, FALSE),
      transport_flat_fee_php       = (p_fields->>'transport_flat_fee_php')::int,
      showcase_video_r2_key        = NULLIF(p_fields->>'showcase_video_r2_key', ''),
      showcase_photo_r2_keys       = COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_fields->'showcase_photo_r2_keys', '[]'::jsonb))),
        ARRAY[]::text[]
      ),
      branch_id                    = (p_fields->>'branch_id')::uuid,
      recommended_lead_time_months = (p_fields->>'recommended_lead_time_months')::numeric,
      last_minute_end_months       = (p_fields->>'last_minute_end_months')::int,
      last_minute_surcharge_pct    = (p_fields->>'last_minute_surcharge_pct')::int,
      daily_capacity               = (p_fields->>'daily_capacity')::int,
      exclusive_perk_text          = v_perk,
      primary_photo_r2_key         = NULLIF(p_fields->>'primary_photo_r2_key', ''),
      is_active                    = p_publish,
      updated_at                   = NOW()
    WHERE vendor_service_id = p_service_id
      AND vendor_profile_id = p_vendor_profile_id
    RETURNING vendor_service_id INTO v_service_id;

    IF v_service_id IS NULL THEN
      RAISE EXCEPTION 'Service not found.' USING ERRCODE = 'no_data_found';
    END IF;
  END IF;

  -- Replace-all "comes with" links.
  DELETE FROM public.vendor_service_links
    WHERE vendor_service_id = v_service_id AND vendor_profile_id = p_vendor_profile_id;
  INSERT INTO public.vendor_service_links
    (vendor_service_id, vendor_profile_id, linked_canonical_service, linked_label, display_order)
  SELECT v_service_id, p_vendor_profile_id,
         e->>'linked_canonical_service', e->>'linked_label',
         COALESCE((e->>'display_order')::int, 0)
  FROM jsonb_array_elements(COALESCE(p_links, '[]'::jsonb)) AS e;

  -- Replace-all payment schedule.
  DELETE FROM public.vendor_service_payment_schedules
    WHERE vendor_service_id = v_service_id AND vendor_profile_id = p_vendor_profile_id;
  INSERT INTO public.vendor_service_payment_schedules
    (vendor_service_id, vendor_profile_id, seq, label, amount_kind, percent_bps, amount_centavos, due_anchor, due_offset_days)
  SELECT v_service_id, p_vendor_profile_id,
         (e->>'seq')::int, e->>'label', e->>'amount_kind',
         (e->>'percent_bps')::int, (e->>'amount_centavos')::bigint,
         e->>'due_anchor', (e->>'due_offset_days')::int
  FROM jsonb_array_elements(COALESCE(p_schedule, '[]'::jsonb)) AS e;

  -- Replace-all discounts (multi; couple sees the best).
  DELETE FROM public.vendor_service_discounts
    WHERE vendor_service_id = v_service_id AND vendor_profile_id = p_vendor_profile_id;
  INSERT INTO public.vendor_service_discounts
    (vendor_service_id, vendor_profile_id, discount_type, rate, unit, expires_at, conditions_md, sort_order)
  SELECT v_service_id, p_vendor_profile_id,
         e->>'discount_type', (e->>'rate')::numeric,
         COALESCE(e->>'unit', 'pct'),
         (e->>'expires_at')::timestamptz, e->>'conditions_md',
         COALESCE((e->>'sort_order')::int, 0)
  FROM jsonb_array_elements(COALESCE(p_discounts, '[]'::jsonb)) AS e;

  -- Replace-all fixed-basis price brackets.
  DELETE FROM public.vendor_service_price_brackets
    WHERE vendor_service_id = v_service_id AND vendor_profile_id = p_vendor_profile_id;
  INSERT INTO public.vendor_service_price_brackets
    (vendor_service_id, vendor_profile_id, min_pax, max_pax, price_php, sort_order)
  SELECT v_service_id, p_vendor_profile_id,
         (e->>'min_pax')::int, (e->>'max_pax')::int, (e->>'price_php')::int,
         COALESCE((e->>'sort_order')::int, 0)
  FROM jsonb_array_elements(COALESCE(p_brackets, '[]'::jsonb)) AS e;

  -- Replace-all inclusions (free items with worth).
  DELETE FROM public.vendor_service_inclusions
    WHERE vendor_service_id = v_service_id AND vendor_profile_id = p_vendor_profile_id;
  INSERT INTO public.vendor_service_inclusions
    (vendor_service_id, vendor_profile_id, label, worth_php, sort_order)
  SELECT v_service_id, p_vendor_profile_id,
         e->>'label', (e->>'worth_php')::int,
         COALESCE((e->>'sort_order')::int, 0)
  FROM jsonb_array_elements(COALESCE(p_inclusions, '[]'::jsonb)) AS e;

  RETURN v_service_id;
END;
$$;

COMMENT ON FUNCTION public.save_vendor_service(uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,boolean) IS
  'Atomic writer for the guided service-card save. Writes vendor_services + replace-all links/payment-schedule/discounts/price-brackets/inclusions. Discount columns removed from vendor_services (multi-discount table). Service-card redesign 2026-07-02.';
