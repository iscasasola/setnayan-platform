-- Papic Challenges — display-name rename (owner 2026-07-23).
-- "Photo Challenge" is renamed to "Papic Challenges" everywhere users see it:
-- challenges accept clips too (completions attach papic_guest_captures.capture_id,
-- photo OR clip), so the name must not read photo-only. This migration renames
-- ONLY the catalog display title; the sku_code 'vendor_photo_challenge', the
-- papic_missions / papic_photo_challenge_sponsorships tables, and every internal
-- key deliberately keep their names (label-only decision — corpus DECISION_LOG
-- 2026-07-23). price_php untouched: it stays admin-managed at /admin/pricing.
UPDATE public.vendor_billing_catalog
   SET title = 'Papic Challenges (per event)'
 WHERE sku_code = 'vendor_photo_challenge'
   AND title = 'Photo Challenge (per event)';
