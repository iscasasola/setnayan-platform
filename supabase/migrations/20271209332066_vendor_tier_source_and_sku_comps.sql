-- vendor_tier_source_and_sku_comps
--
-- G6 /admin/gifts polish (build-sessions/GIFTS-PLAN.md § G6), item 3: the
-- `fetchCompedVendors` trip-wire (lib/vendor-tier-comps.ts docblock). That
-- reader treats `tier_state <> 'free'` as "comped" — true today only because
-- `setVendorTier` is the ONLY writer of a non-free tier (self-serve vendor
-- checkout does not exist yet). The docblock warned this stops being true the
-- moment self-serve ships, with no column to tell a comp from a real payment
-- apart. This migration adds that column NOW, while it is cheap (one writer,
-- zero ambiguity), instead of leaving it for whoever builds checkout to
-- remember under deadline.
--
-- `tier_source` records HOW a vendor reached its current tier:
--   'admin_comp' — set via the admin console (setVendorTier). Every row today.
--   'self_serve' — reserved for the future checkout writer. Unused until then.
--
-- Defaults every existing + future row to 'admin_comp', which is exactly true
-- of every row in production today (setVendorTier is the only writer).

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS tier_source TEXT NOT NULL DEFAULT 'admin_comp';

DO $$
BEGIN
  ALTER TABLE public.vendor_profiles
    ADD CONSTRAINT vendor_profiles_tier_source_check
    CHECK (tier_source IN ('admin_comp', 'self_serve'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.vendor_profiles.tier_source IS
  'How this vendor reached vendor_profiles.tier_state. ''admin_comp'' = set via /admin/gifts or /admin/vendors/:id/plan (setVendorTier) — every row today, since self-serve vendor billing does not exist yet. ''self_serve'' is reserved for the future checkout writer; fetchCompedVendors (lib/vendor-tier-comps.ts) must filter to admin_comp once that writer ships, or a paying vendor reads as a gift.';

-- ----------------------------------------------------------------------------
-- G6 item 2: SKU-level vendor comps via `comp_grants.vendor_profile_id`
-- (dormant until now — its only prior reader was the vendor_self_comp quota
-- trigger, which counts vendor_profile_id rows ONLY when source =
-- 'vendor_self_comp'; see migration 20260515030000_self_review_gate.sql. An
-- admin-issued vendor comp always writes source = 'external_promo', so it can
-- never trip that quota — read the trigger before touching this column again).
--
-- Today's only wired vendor SKU is Papic Challenges: entitlement is ONE
-- column, `vendor_profiles.papic_challenge_expires_at` (see
-- public.vendor_papic_challenge_entitled(), migration 20271182071895), so an
-- admin comp can grant it for real with a direct UPDATE — no order, no new
-- gate. comp_grants gets the audit-grade row; vendor_profiles gets the actual
-- entitlement. Every OTHER vendor add-on (3D Booth, Deep Search, seats,
-- branches, the portfolio pack) has its own resolver with "no shared choke
-- point" (lib/promo-free-windows.ts) and is NOT wired here — extending this to
-- another SKU means writing that SKU's own direct-grant path, not widening a
-- generic switch.
COMMENT ON COLUMN public.comp_grants.vendor_profile_id IS
  'The vendor a comp TARGETS, when granted_by an admin (source=''external_promo'') via issueVendorSkuComp (apps/web/app/admin/vendors/actions.ts) — scope=''specific_skus'', scoped_skus names the SKU (e.g. vendor_photo_challenge). Mutually exclusive with user_id in that case: a vendor SKU comp has no user_id. SEPARATE MEANING when source=''vendor_self_comp'': there it names the vendor who is comping a COUPLE (user_id is the couple, this column is who paid nothing for it) — see enforce_vendor_self_comp_quota(). Same column, two meanings, disambiguated by source; never assume one without checking it.';
