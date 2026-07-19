-- Corrective, idempotent price fix for the Maria & Jose sample wedding's catering
-- demo services. The original seed (#1902) fat-fingered an extra digit on the 3
-- catering rows (₱1.2M–₱1.6M each = ~₱8,000/pax), which made the public tour's
-- budget stop show Catering at 85.7% of the budget — an obviously broken pie.
-- Real PH catering for this guest count is ~₱1,800–₱2,600/pax → ₱270k–₱385k total.
--
-- buildVendorPricingLookup (lib/budget.ts) derives each vendor's committed total
-- from vendor_services.starting_price_php (service fallback), so this is the field
-- the budget reads; starts_at_centavos is kept in lock-step (= php × 100).
--
-- Matched by demo_batch_id + exact title so it only ever touches these 3 rows and
-- is safe to re-run. The source seed (scripts/seed-sample-event-maria-jose.sql)
-- was corrected in the same change, so a future re-seed lands these values too.
--   cat scripts/fix-sample-catering-prices.sql | supabase db query --db-url "$SUPABASE_DB_URL"

UPDATE public.vendor_services vs
SET starting_price_php = fix.php,
    starts_at_centavos = fix.php * 100
FROM (
  VALUES
    ('Plated · 150 pax',            330000::bigint),  -- Hain Catering
    ('Buffet · 200 pax',            385000::bigint),  -- Salu-Salo Kitchen
    ('Filipino Spread · 150 pax',   270000::bigint)   -- Kamayan Feast
) AS fix(title, php)
JOIN public.vendor_profiles vp
  ON vp.demo_batch_id = 'a1a1a1a1-0000-4000-8000-000000000a01'
WHERE vs.vendor_profile_id = vp.vendor_profile_id
  AND vs.category = 'catering'
  AND vs.title = fix.title;
