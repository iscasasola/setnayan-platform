-- Tayo V1 — Iteration 0003: Token Wallet & Pack System (locked 2026-05-09)
--
-- Spec: docs/0003_token_wallet_and_packs/0003_token_wallet_and_packs.md
--
-- Ships the full data + spend primitive for the token wallet:
--   1. service_catalog — single source of PHP prices for every paid SKU
--   2. token_packs     — 6 V1 pack tiers (Starter → Luxury) with FREE-tokens
--   3. token_wallets   — one per event, couple-shared (event-scoped not user-scoped)
--   4. token_purchases — pack purchase audit trail
--   5. token_transactions — the ledger (every credit/debit)
--   6. wallet_spend()  — atomic spend RPC: deduct + ledger + insufficient-balance handling
--   7. provision_event_wallet trigger — auto-create token_wallets on event INSERT
--
-- Replaces the placeholder paparazzi_wallet_skus table from the 0012 migration:
-- service_catalog now holds those rows (under canonical service_keys per the
-- 0003 spec — paparazzi_3, paparazzi_5, template_addon — instead of the
-- earlier paparazzi_3_seat / paparazzi_5_seat / paparazzi_template names).
--
-- All operations idempotent so the migration can re-run.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. service_catalog — central PHP-price registry for every paid SKU
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS service_catalog (
  service_key         TEXT         PRIMARY KEY,
  display_name        TEXT         NOT NULL,
  category            TEXT         NOT NULL CHECK (category IN (
    'pro_widget',
    'pro_bundle',
    'paparazzi',
    'template',
    'live_stream',
    'photo_delivery',
    'led_background',
    'mood_board',
    'other'
  )),
  php_price_centavos  BIGINT       NOT NULL CHECK (php_price_centavos >= 0),
  description         TEXT,
  iteration_origin    TEXT,
  one_time_per_event  BOOLEAN      NOT NULL DEFAULT TRUE,
  is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Defensive: if the table pre-existed (hand-rolled stub or older partial
-- migration), top up any columns that may be missing. ADD COLUMN IF NOT
-- EXISTS is idempotent on the no-pre-existing path.
ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS description       TEXT;
ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS iteration_origin  TEXT;
ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS one_time_per_event BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS is_active         BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE service_catalog ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_service_catalog_active_category
  ON service_catalog(category) WHERE is_active = TRUE;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_service_catalog_updated_at') THEN
    CREATE TRIGGER trg_service_catalog_updated_at BEFORE UPDATE ON service_catalog
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

COMMENT ON TABLE service_catalog IS
  'Single source of truth for every paid SKU''s PHP price. Downstream iterations register their service_keys here; the spend() RPC reads from it. Tokens are a render-time display unit derived via 30 tokens = ₱1.';
COMMENT ON COLUMN service_catalog.one_time_per_event IS
  'TRUE = one purchase per event_id (Paparazzi tier, Pro widgets, Custom Monogram Pack). FALSE = multi-purchase (template add-ons, Live Stream camera/hour add-ons, AI highlights).';

-- V1 SKU seeds. Iterations that haven''t shipped yet still pre-register their
-- service_keys here so the spend() RPC has the row to read; the iteration that
-- consumes the SKU is responsible for actually wiring spend() into its flow.
INSERT INTO service_catalog (
  service_key, display_name, category, php_price_centavos, description, iteration_origin, one_time_per_event
) VALUES
  -- 0004 invitation widgets
  ('pro_hero_monogram',   'Hero Monogram — Pro animation',           'pro_widget',  10000,  'Animated monogram intro on the couple''s landing page.',                  '0004', TRUE),
  ('pro_our_story',       'Our Story — Pro scroll animations',       'pro_widget',  10000,  'Scroll-animated story timeline.',                                          '0004', TRUE),
  ('pro_schedule',        'Schedule — Pro live highlight',           'pro_widget',  10000,  'Live highlighting of the current schedule block.',                         '0004', TRUE),
  ('pro_bundle_widgets',  'Pro Bundle (all current Pros)',           'pro_bundle',  20000,  'All three Pro widgets at a single bundle price.',                          '0004', TRUE),

  -- 0012 paparazzi (replaces paparazzi_wallet_skus)
  ('paparazzi_3',         '3 Paparazzi seat pack',                   'paparazzi',  150000,  '3 native-app seats for the couple''s paparazzi crew.',                    '0012', TRUE),
  ('paparazzi_5',         '5 Paparazzi seat pack',                   'paparazzi',  250000,  '5 native-app seats for the couple''s paparazzi crew.',                    '0012', TRUE),
  ('template_addon',      'Personal Reel template (per template)',   'template',    20000,  'Unlock one Personal Reel template for the event. Multi-purchase.',         '0012', FALSE),

  -- 0011 live stream — base + capacity + service add-ons
  ('live_stream_base',          'Live Stream — Base (3 cameras × 3 hours)', 'live_stream', 250000,  'Base broadcast: 1 broadcaster + 3 cameras + 3 hours of stream capacity.', '0011', TRUE),
  ('live_stream_camera_addon',  'Live Stream — +1 camera',                  'live_stream', 100000,  '+1 camera slot. Multi-purchase up to +2 (max 5 cameras total).',          '0011', FALSE),
  ('live_stream_hour_addon',    'Live Stream — +1 hour',                    'live_stream', 100000,  '+1 hour of stream capacity. Multi-purchase, unlimited.',                  '0011', FALSE),
  ('custom_monogram_pack',      'Custom Monogram Pack (Remove Watermark)',  'live_stream', 200000,  'Replaces Tayo branding with the couple''s monogram across Live Stream, Paparazzi exports, Personal Reels, and gallery chrome.', '0011', TRUE),
  ('broadcast_style_pack',      'Broadcast Style Pack',                     'live_stream', 300000,  '4 broadcast modes (News / Cinematic / Sports / Royalty) + transitions + 4 color presets per mode.', '0011', TRUE),
  ('ai_video_highlight',        'AI Video Highlight (per 60s)',             'live_stream', 200000,  '60-second AI-compiled highlight reel. Multi-purchase.',                   '0011', FALSE),
  ('ai_edited_highlight',       'AI Edited Highlight (per 3-min)',          'live_stream', 500000,  '3-minute themed multi-segment polished reel. Multi-purchase.',            '0011', FALSE)
ON CONFLICT (service_key) DO UPDATE SET
  display_name        = EXCLUDED.display_name,
  category            = EXCLUDED.category,
  php_price_centavos  = EXCLUDED.php_price_centavos,
  description         = EXCLUDED.description,
  iteration_origin    = EXCLUDED.iteration_origin,
  one_time_per_event  = EXCLUDED.one_time_per_event;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. token_packs — 6 V1 pack tiers
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS token_packs (
  pack_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 TEXT         NOT NULL UNIQUE,
  display_name         TEXT         NOT NULL,
  php_price_centavos   BIGINT       NOT NULL CHECK (php_price_centavos > 0),
  base_tokens          INTEGER      NOT NULL CHECK (base_tokens > 0),
  bonus_tokens         INTEGER      NOT NULL DEFAULT 0 CHECK (bonus_tokens >= 0),
  is_active            BOOLEAN      NOT NULL DEFAULT TRUE,
  display_order        INTEGER      NOT NULL,
  badge_text           TEXT,
  description          TEXT,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Defensive: top up columns if the table pre-existed without them. slug is
-- added nullable first; if any row predates this migration it gets a fallback
-- slug derived from display_name; then SET NOT NULL + UNIQUE constraint.
ALTER TABLE token_packs ADD COLUMN IF NOT EXISTS slug                TEXT;
ALTER TABLE token_packs ADD COLUMN IF NOT EXISTS display_name        TEXT;
ALTER TABLE token_packs ADD COLUMN IF NOT EXISTS php_price_centavos  BIGINT;
ALTER TABLE token_packs ADD COLUMN IF NOT EXISTS base_tokens         INTEGER;
ALTER TABLE token_packs ADD COLUMN IF NOT EXISTS bonus_tokens        INTEGER NOT NULL DEFAULT 0;
ALTER TABLE token_packs ADD COLUMN IF NOT EXISTS is_active           BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE token_packs ADD COLUMN IF NOT EXISTS display_order       INTEGER;
ALTER TABLE token_packs ADD COLUMN IF NOT EXISTS badge_text          TEXT;
ALTER TABLE token_packs ADD COLUMN IF NOT EXISTS description         TEXT;
ALTER TABLE token_packs ADD COLUMN IF NOT EXISTS created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE token_packs ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE token_packs
   SET slug = COALESCE(slug, lower(regexp_replace(COALESCE(display_name, pack_id::TEXT), '[^a-z0-9]+', '_', 'g')))
 WHERE slug IS NULL;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'token_packs' AND column_name = 'slug' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE token_packs ALTER COLUMN slug SET NOT NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'token_packs_slug_key'
  ) THEN
    ALTER TABLE token_packs ADD CONSTRAINT token_packs_slug_key UNIQUE (slug);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_token_packs_active_order
  ON token_packs(display_order) WHERE is_active = TRUE;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_token_packs_updated_at') THEN
    CREATE TRIGGER trg_token_packs_updated_at BEFORE UPDATE ON token_packs
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

COMMENT ON TABLE token_packs IS '6-tier pack ladder. Bonus tokens framed as "FREE tokens" in UI — never as a percentage discount.';

-- V1 pack ladder (per 0003 spec).
INSERT INTO token_packs (slug, display_name, php_price_centavos, base_tokens, bonus_tokens, display_order, badge_text, description)
VALUES
  ('starter',       'Starter',         10000,    3000,     0, 1, NULL,           'Tip-jar tier. One template add-on or a Pro widget.'),
  ('reception',     'Reception',       50000,   15000,   750, 2, NULL,           'A Pro Bundle plus a couple of Templates with room to spare.'),
  ('wedding_party', 'Wedding Party',  150000,   45000,  4500, 3, NULL,           'Covers a 3-Paparazzi event with a Pro Bundle.'),
  ('wedding_pack',  'The Wedding Pack',300000,  90000, 13500, 4, 'Most popular', 'Recommended default — 5-Paparazzi + Pro Bundle + 2 Templates.'),
  ('premium',       'Premium',        500000,  150000, 30000, 5, NULL,           '5-Paparazzi + Live Stream + Pro Bundle, with budget for upgrades.'),
  ('luxury',       'Luxury',         1000000,  300000, 75000, 6, 'Best value',   'Full V1 service set with deep buffer for AI Highlights and add-ons.')
ON CONFLICT (slug) DO UPDATE SET
  display_name       = EXCLUDED.display_name,
  php_price_centavos = EXCLUDED.php_price_centavos,
  base_tokens        = EXCLUDED.base_tokens,
  bonus_tokens       = EXCLUDED.bonus_tokens,
  display_order      = EXCLUDED.display_order,
  badge_text         = EXCLUDED.badge_text,
  description        = EXCLUDED.description;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. token_wallets — one per event, couple-shared
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS token_wallets (
  wallet_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id               UUID         NOT NULL UNIQUE REFERENCES events(event_id) ON DELETE CASCADE,
  balance_tokens         INTEGER      NOT NULL DEFAULT 0 CHECK (balance_tokens >= 0),
  total_purchased_tokens INTEGER      NOT NULL DEFAULT 0 CHECK (total_purchased_tokens >= 0),
  total_spent_tokens     INTEGER      NOT NULL DEFAULT 0 CHECK (total_spent_tokens >= 0),
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Defensive: top up columns if the table pre-existed with a different shape.
ALTER TABLE token_wallets ADD COLUMN IF NOT EXISTS balance_tokens         INTEGER NOT NULL DEFAULT 0;
ALTER TABLE token_wallets ADD COLUMN IF NOT EXISTS total_purchased_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE token_wallets ADD COLUMN IF NOT EXISTS total_spent_tokens     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE token_wallets ADD COLUMN IF NOT EXISTS created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE token_wallets ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_token_wallets_event ON token_wallets(event_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_token_wallets_updated_at') THEN
    CREATE TRIGGER trg_token_wallets_updated_at BEFORE UPDATE ON token_wallets
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

COMMENT ON TABLE token_wallets IS 'Couple-shared wallet, one row per event. Both partners and any couple-authorized collaborator spend from this single balance.';

-- Backfill: one wallet per existing event (zero balance).
INSERT INTO token_wallets (event_id)
SELECT event_id FROM events
ON CONFLICT (event_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. token_purchases — pack purchase audit trail
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS token_purchases (
  purchase_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id          UUID         NOT NULL REFERENCES token_wallets(wallet_id) ON DELETE CASCADE,
  pack_id            UUID         NOT NULL REFERENCES token_packs(pack_id) ON DELETE RESTRICT,
  php_paid_centavos  BIGINT       NOT NULL CHECK (php_paid_centavos > 0),
  base_tokens        INTEGER      NOT NULL CHECK (base_tokens > 0),
  bonus_tokens       INTEGER      NOT NULL DEFAULT 0 CHECK (bonus_tokens >= 0),
  total_tokens       INTEGER      GENERATED ALWAYS AS (base_tokens + bonus_tokens) STORED,
  payment_provider   TEXT         NOT NULL CHECK (payment_provider IN ('paymongo', 'stripe')),
  payment_ref        TEXT         NOT NULL,
  refunded_at        TIMESTAMPTZ,
  refund_reason      TEXT,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Defensive: top up additive columns; total_tokens is a generated column and
-- can't be added retroactively cleanly, so left to the CREATE-only path.
ALTER TABLE token_purchases ADD COLUMN IF NOT EXISTS bonus_tokens     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE token_purchases ADD COLUMN IF NOT EXISTS refunded_at      TIMESTAMPTZ;
ALTER TABLE token_purchases ADD COLUMN IF NOT EXISTS refund_reason    TEXT;
ALTER TABLE token_purchases ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_token_purchases_wallet ON token_purchases(wallet_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_token_purchases_payment_ref
  ON token_purchases(payment_provider, payment_ref);

COMMENT ON TABLE token_purchases IS 'Audit trail of every pack purchase. payment_ref + provider unique to dedupe webhook re-deliveries.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. token_transactions — the ledger (every credit/debit)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS token_transactions (
  txn_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id       UUID         NOT NULL REFERENCES token_wallets(wallet_id) ON DELETE CASCADE,
  delta_tokens    INTEGER      NOT NULL,
  reason          TEXT         NOT NULL CHECK (reason IN (
    'pack_purchase', 'pack_bonus', 'spend', 'refund', 'grant', 'correction'
  )),
  ref_table       TEXT,
  ref_id          UUID,
  display_label   TEXT         NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Defensive: top up additive columns if the table pre-existed.
ALTER TABLE token_transactions ADD COLUMN IF NOT EXISTS ref_table     TEXT;
ALTER TABLE token_transactions ADD COLUMN IF NOT EXISTS ref_id        UUID;
ALTER TABLE token_transactions ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_token_transactions_wallet ON token_transactions(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_transactions_ref ON token_transactions(ref_table, ref_id) WHERE ref_id IS NOT NULL;

COMMENT ON TABLE token_transactions IS 'Pure ledger. Every token movement = one row. Pack purchase = 2 rows (base + bonus). Spend = 1 row negative. Refund = 1 row positive referencing the original spend.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. provision_event_wallet — extend the 0000 event-shell trigger
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION provision_event_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO token_wallets (event_id) VALUES (NEW.event_id)
  ON CONFLICT (event_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_provision_event_wallet') THEN
    CREATE TRIGGER trg_provision_event_wallet
      AFTER INSERT ON events
      FOR EACH ROW EXECUTE FUNCTION provision_event_wallet();
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. wallet_spend(event_id, service_key, ref_id) — atomic spend RPC
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Returns a row with ok=TRUE on success or ok=FALSE with reason='insufficient_balance'
-- and tokens_short. SECURITY DEFINER so callers don''t need direct write access
-- to token_wallets / token_transactions; RLS still gates SELECTs from outside.
-- The token math uses the 30:1 multiplier from spec §3 (Pricing convention).

CREATE OR REPLACE FUNCTION wallet_spend(
  p_event_id    UUID,
  p_service_key TEXT,
  p_ref_id      UUID
) RETURNS TABLE (
  ok            BOOLEAN,
  reason        TEXT,
  txn_id        UUID,
  tokens_charged INTEGER,
  tokens_short  INTEGER,
  balance_after INTEGER
) AS $$
DECLARE
  v_service       service_catalog%ROWTYPE;
  v_wallet        token_wallets%ROWTYPE;
  v_tokens        INTEGER;
  v_new_txn_id    UUID;
BEGIN
  SELECT * INTO v_service FROM service_catalog WHERE service_key = p_service_key AND is_active;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'unknown_service'::TEXT, NULL::UUID, 0, 0, 0; RETURN;
  END IF;

  v_tokens := (v_service.php_price_centavos * 30 / 100)::INTEGER;

  SELECT * INTO v_wallet FROM token_wallets WHERE event_id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'no_wallet'::TEXT, NULL::UUID, v_tokens, v_tokens, 0; RETURN;
  END IF;

  IF v_wallet.balance_tokens < v_tokens THEN
    RETURN QUERY SELECT
      FALSE,
      'insufficient_balance'::TEXT,
      NULL::UUID,
      v_tokens,
      (v_tokens - v_wallet.balance_tokens),
      v_wallet.balance_tokens;
    RETURN;
  END IF;

  UPDATE token_wallets
     SET balance_tokens     = balance_tokens - v_tokens,
         total_spent_tokens = total_spent_tokens + v_tokens
   WHERE wallet_id = v_wallet.wallet_id;

  INSERT INTO token_transactions (wallet_id, delta_tokens, reason, ref_table, ref_id, display_label)
  VALUES (
    v_wallet.wallet_id,
    -v_tokens,
    'spend',
    v_service.category,
    p_ref_id,
    v_service.display_name
  )
  RETURNING txn_id INTO v_new_txn_id;

  RETURN QUERY SELECT
    TRUE,
    NULL::TEXT,
    v_new_txn_id,
    v_tokens,
    0,
    (v_wallet.balance_tokens - v_tokens);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION wallet_spend IS
  'Atomic spend primitive. Looks up the service in service_catalog, converts PHP centavos → tokens (30:1), checks balance, deducts + ledger row in a single transaction. Returns ok=FALSE / reason=''insufficient_balance'' with tokens_short when balance is too low.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Retire paparazzi_wallet_skus — service_catalog supersedes it
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS paparazzi_wallet_skus CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE service_catalog      ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_packs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_wallets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_purchases      ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_catalog_authenticated_select ON service_catalog;
CREATE POLICY service_catalog_authenticated_select ON service_catalog FOR SELECT
  TO authenticated USING (is_active = TRUE);

DROP POLICY IF EXISTS token_packs_authenticated_select ON token_packs;
CREATE POLICY token_packs_authenticated_select ON token_packs FOR SELECT
  TO authenticated USING (is_active = TRUE);

DROP POLICY IF EXISTS token_wallets_couple_select ON token_wallets;
CREATE POLICY token_wallets_couple_select ON token_wallets FOR SELECT
  USING (is_couple_of(event_id));

DROP POLICY IF EXISTS token_purchases_couple_select ON token_purchases;
CREATE POLICY token_purchases_couple_select ON token_purchases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM token_wallets w
      WHERE w.wallet_id = token_purchases.wallet_id AND is_couple_of(w.event_id)
    )
  );

DROP POLICY IF EXISTS token_transactions_couple_select ON token_transactions;
CREATE POLICY token_transactions_couple_select ON token_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM token_wallets w
      WHERE w.wallet_id = token_transactions.wallet_id AND is_couple_of(w.event_id)
    )
  );

-- Writes to wallets / purchases / transactions go through wallet_spend()
-- (SECURITY DEFINER) and through server-side checkout actions running with
-- service_role. No client-side INSERT/UPDATE policies on purpose.
