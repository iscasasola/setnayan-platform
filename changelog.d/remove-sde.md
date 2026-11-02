## 2026-06-28 · chore(papic): remove SDE (Same-Day Edit) fully

Retired the crew-delivered Same-Day Edit add-on (SKU/serviceKey `SDE`, key `sde`)
end to end across the web app:

- Deleted dedicated surfaces: `app/admin/sde/`, `app/dashboard/[eventId]/studio/sde/`,
  `app/[slug]/_components/sde-film-block.tsx`, and the offline `sde-handler.ts`.
- Removed all SDE renders/links/nav entries: day-of + recap pages, admin sidebar +
  mobile More, the Studio `[addon]` route, Panood studio surfaces, the offline queue
  (`lib/offline/*`), and the indexedDB media-service union.
- Stripped SDE from every catalog/entitlement/onboarding/marketing/pricing source
  (`add-ons-catalog`, `add-ons-detail`, `sku-catalog`, `v2-catalog`, `sku-catalog-v2`,
  `entitlements` MEDIA_PACK + PAPIC_UNLOCK, persona-packs, experience-personas,
  onboarding-shell + onboarding-pricing, wizard, marketing sections/fixtures,
  for-vendors, /pricing, `public/llms.txt`, billing/manpower API books, add-on-stats).
- Auto-Recap keeps working: removed only the SDE-embedding (`sdeFilmUrl`/
  `sdeFilmPosterUrl` + the `eventSkuActive(...,'SDE')` block) from `lib/auto-recap.ts`.
- Stories kept intact: `StoriesTemplateCategory` is now `'stories'` only (the `'sde'`
  variant removed); the former `sde-fast-cut-30` template was rebranded
  `midnight-fast-cut-30` (category `stories`) so the picker keeps its fast-cut style.
- New forward migration `supabase/migrations/20270316000000_remove_sde.sql`: drops
  `events.sde_video_r2_key/sde_poster_r2_key/sde_published_at`, soft-deactivates the
  SDE rows in `platform_retail_catalog_v2` + v1 `service_catalog`, and re-defines
  `bundles_granting_sku()` without the MEDIA_PACK SDE child.
- `lint:entitlement-gates` Guard 2 now parses the LATEST migration that defines
  `bundles_granting_sku()` (via `CREATE OR REPLACE`) instead of one fixed historical
  file, so the forward migration is the authority (migrations stay immutable).

Tests updated (no Stories/Auto-Recap coverage weakened): `entitlements.test.ts`,
`add-ons-catalog.test.ts`, `stories-templates.test.ts`, `onboarding/*.test.ts`.

Intentionally KEPT (not the SDE SKU): the vendor taxonomy facet `same_day_edit`
(`lib/taxonomy.ts`) + its vendor-schedule label + seed regex, the Patiktok
template-style category `'sde'`, the `pvIncluded` photo-package preference option,
the `vendor-timeline` schedule-item classifier regex, and the published blog article
about the industry same-day-edit concept (`lib/blog-batches/capture-coverage.ts`).

SPEC IMPACT: SDE (Same-Day Edit) SKU retired — removed from the customer catalog,
bundles (MEDIA_PACK / PAPIC_UNLOCK), onboarding personas, and all marketing/pricing
surfaces. Stories (`PAPIC_ADDON_STORIES`) and Auto-Recap are kept. Update the SKU
tables in the spec corpus accordingly (`Pricing.md`, CLAUDE.md SKU lists,
`0012`/`0017` iteration notes that reference SDE).
