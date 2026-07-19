-- vendor_category_crew_meals_enum_value
--
-- Adds 'crew_meals' to the `public.vendor_category` enum so a booked crew-meal
-- provider (`event_vendors.category`) buckets cleanly into the new "Crew Meals"
-- plan group, and so vendors can list under it. Part of the Crew-Meal Provider
-- Marketplace (owner-locked 2026-07-08; taxonomy tile shipped in PR #2868).
--
-- Follows the established additive-enum-value pattern in this repo
-- (`ALTER TYPE public.vendor_category ADD VALUE 'accommodation'` — 20260604150000;
-- `'bridal_gown'` etc. — 20260621000000). Purely additive + idempotent; existing
-- categories are untouched. This migration ONLY adds the value — it never USES it
-- (all usage is in application code), so it is safe regardless of transaction
-- wrapping (a new enum value cannot be used in the same transaction that adds it).
--
-- `vendor_services.category` is TEXT (not this enum), so it needs no change.

ALTER TYPE public.vendor_category ADD VALUE IF NOT EXISTS 'crew_meals';
