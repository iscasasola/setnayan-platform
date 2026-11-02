## 2026-07-03 · feat(taxonomy): representation layer (icons + photos) — backend + read path

Taxonomy Studio PR 1 of 3. Adds an admin-editable representation layer to the
service taxonomy (`service_categories`, 10 folders + 56 tiles) and wires the
DB-first, fallback-safe read path — no visual change for couples until an admin
sets an icon (every row's `icon_name` is NULL today).

- **Migration** `20270506707877_taxonomy_icon_name.sql` — `ALTER TABLE
  public.service_categories ADD COLUMN IF NOT EXISTS icon_name text` + a COMMENT.
  NULL = fall back to the code default. (Not applied here — the orchestrator
  applies via Supabase after merge.) The companion `sample_photo_r2_key` column
  already existed.
- **Snapshot** `getTaxonomy()` now selects `icon_name` + `sample_photo_r2_key`
  and exposes two new maps on `TaxonomySnapshot`: `categoryIcons` and
  `categoryPhotos` (both `Record<categoryId, string | null>`, covering folders
  AND tiles). The fallback snapshot returns empty maps + `source:'fallback'`,
  so the DB-first + const-fallback contract is intact.
- **Refactor** the pure snapshot reconstruction (`fallbackSnapshot`,
  `snapshotFromRows`, types) split into a new client-safe `lib/taxonomy-snapshot.ts`
  so it's unit-testable without pulling in `next/headers`; `lib/taxonomy-db.ts`
  re-exports `TaxonomySnapshot` for backward-compat.
- **Consumer** the `/explore` `IconTileFolderStrip` resolves an admin `icon_name`
  DB-first via `getLucideIcon()` (the nav-registry Lucide allowlist), falling
  back to the hardcoded `FOLDER_ICON` when unset/unknown — unknown names never
  crash. Photo refs are exposed on the snapshot for consumers (resolve via
  `displayUrlForStoredAsset()`); no couple-facing photo rendering ships here.
- **Admin actions** `setCategoryIcon` + `setCategoryPhoto` in
  `app/admin/taxonomy/actions.ts` (requireAdmin, `admin_audit_log` before/after,
  `taxonomy.set_icon` / `taxonomy.set_photo`). Icon names validated against the
  Lucide allowlist (shared `lib/taxonomy-icon-name.ts` `normalizeIconName`);
  photo refs validated by the `/admin/refinements` VALID_PHOTO regex (`/public`
  path or `r2://` ref). Empty clears. No new admin UI (PR 2 builds the studio).
- **Tests** in `lib/taxonomy.test.ts`: snapshot carries icon/photo maps for both
  tiers, fallback yields empty maps, and `normalizeIconName` rejects bogus names.

SPEC IMPACT: None. Additive plumbing behind an admin-set column; no product/spec
behavior changes until PR 2 ships the studio UI and an admin sets an icon.
