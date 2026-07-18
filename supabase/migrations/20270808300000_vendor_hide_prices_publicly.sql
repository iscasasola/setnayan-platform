-- ============================================================================
-- Vendor "hide my prices from my public page" setting — Option A (invert)
--
-- Council verdict Social_Share_Settings_Council_Verdict_2026-07-16.md #6:
-- `show_prices_publicly` was collected in the attribute form but only skipped
-- itself from the Details list — packages/prices still rendered publicly. The
-- flag was OPT-IN ("Show prices publicly") with a schema default of false, and
-- the vendor form can only ever persist `true` (box checked) or an ABSENT key
-- (unchecked/untouched — the checkbox omits the key). It cannot represent an
-- explicit `false`, so honoring "hide when false" would black out prices for
-- every vendor who never touched the box == the entire marketplace.
--
-- Option A (owner-approved 2026-07-16): invert the semantics. Add a NEW opt-in
-- key `hide_prices_publicly` (boolean, default false = SHOW = today's public
-- behavior). Only a vendor who affirmatively CHECKS it gets their peso figures
-- suppressed on the public microsite. No data migration is needed — absent /
-- false == show, which matches current behavior for every existing vendor.
--
-- The old `show_prices_publicly` key is marked `retired: true` so it disappears
-- from the vendor form (kept for any vendor who already answered it, per the
-- 0044 never-orphan contract) and never gates anything. The public page also
-- keeps both keys in DETAIL_SKIP_KEYS so neither appears in the Details list.
--
-- This is a JSONB merge onto the shared `pricing_signal` attribute group (the
-- same group that defines the pricing fields); the vendor attribute form
-- resolves fields through shared_attribute_groups, so the new key surfaces in
-- the Pricing section exactly like the existing pricing fields.
-- ============================================================================

UPDATE public.shared_attribute_groups
SET attributes = attributes
      -- retire the old, inert opt-in key (kept for never-orphan)
      || jsonb_build_object(
           'show_prices_publicly',
           jsonb_build_object(
             'type', 'boolean',
             'label', 'Show prices publicly',
             'default', false,
             'retired', true
           )
         )
      -- add the new opt-in-to-HIDE key (default false = show, unchanged behavior)
      || jsonb_build_object(
           'hide_prices_publicly',
           jsonb_build_object(
             'type', 'boolean',
             'label', 'Hide my prices from my public page',
             'default', false
           )
         ),
    updated_at = NOW()
WHERE group_name = 'pricing_signal';
