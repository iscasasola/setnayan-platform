## 2026-07-01 · feat(spotlight): surface Spotlight Awards (vendor banner + gated homepage strip)

The Spotlight Awards engine, admin console, cron-free recompute, and the
persisted `vendor_spotlight_awards` schema already shipped, but the
`SpotlightAwardBanner` component was exported and imported NOWHERE (orphaned),
and there was no public surface. This wires both consumers, reusing the shipped
award schema + read helpers — NO new award logic.

- **Vendor-facing (LIVE):** `/vendor-dashboard` Overview now mounts
  `SpotlightAwardBanner`, fed by `fetchVendorCurrentAwards(supabase, profileId)`
  read with the vendor's OWN RLS-scoped session client. A spotlighted vendor
  sees their "You earned a Spotlight Award this month" banner with their award
  badges; an empty award list renders nothing. Safe to ship — a vendor only ever
  sees their own award (public-read table, keyed to their profile in app code).

- **Public homepage strip (DARK by default):** new
  `app/_components/home/HomeSpotlightStrip.tsx` renders the admin-featured
  vendors on the marketing homepage, resolved by a new
  `fetchHomepageSpotlight()` loader in `lib/spotlight-awards.ts`. DOUBLE-GATED
  and inert until sign-off: (1) owner master switch
  `platform_settings.spotlight_homepage_enabled` (new additive column, migration
  `20270417213000`, DEFAULT FALSE) AND (2) per-row `is_homepage_featured`
  admin curation (already shipped). While either gate is unset the loader
  returns `[]` and the strip renders nothing — publicly featuring vendors needs
  owner approval. Reads with the service-role admin client (homepage is
  anonymous), mirroring `fetchOnboardingBgMusicUrl`.

No award-computation, pricing, or SKU logic touched. Did not touch
`vendor-stats-panel.tsx` or any other feature's files.

Owner follow-up: flip `platform_settings.spotlight_homepage_enabled = TRUE`
(default FALSE) when ready to feature vendors publicly — the code path is inert
until then. No admin-settings UI toggle was added (out of scope / other feature's
file); flip via the admin settings action or DB.

SPEC IMPACT: Additive — `platform_settings.spotlight_homepage_enabled boolean
NOT NULL DEFAULT false` (owner gate for the public homepage Spotlight strip). No
new tables, no pricing/SKU/flow change; reuses the shipped `vendor_spotlight_awards`
schema.
