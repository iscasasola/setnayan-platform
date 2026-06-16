-- Migration: vendor_services discount fields + Setnayan Exclusive perk
-- Part A: 4 discount columns (type, value, expiry, conditions)
-- Part B: exclusive_perk_text — hidden from public, revealed on token-pursue
-- Required to publish (is_active=true) but not required to save a draft.

ALTER TABLE vendor_services
  ADD COLUMN IF NOT EXISTS discount_type       TEXT
    CHECK (discount_type IN ('early_booking','off_peak','bundle','promo','returning')),
  ADD COLUMN IF NOT EXISTS discount_value      NUMERIC
    CHECK (discount_value > 0),
  ADD COLUMN IF NOT EXISTS discount_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discount_conditions_md TEXT,
  ADD COLUMN IF NOT EXISTS exclusive_perk_text TEXT;

-- Guard: discount_value must be set when discount_type is
COMMENT ON COLUMN vendor_services.discount_type IS
  'One of: early_booking, off_peak, bundle, promo, returning. '
  'discount_value MUST also be set when this is non-null.';
COMMENT ON COLUMN vendor_services.discount_expires_at IS
  'Required when discount_type = ''promo''. Null for all other types.';
COMMENT ON COLUMN vendor_services.exclusive_perk_text IS
  'Setnayan Exclusive perk (v2.1 §7.2). Never shown publicly. '
  'Revealed in the chat thread when the vendor token-pursues the inquiry. '
  'Required to publish (is_active=true); drafts may omit it.';
