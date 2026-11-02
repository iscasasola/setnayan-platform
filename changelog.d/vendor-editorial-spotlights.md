## 2026-06-29 · feat(vendors): Editorial & Journal Spotlights — credit a vendor inside a Journal article (Wave 5)

Ships the Wave 5 "Soon" vendor benefit end-to-end. The Setnayan Journal stays
FILE/CODE-BASED (`apps/web/lib/blog.ts` — typed `BlogArticle` constants, "no DB,
no CMS"); this adds a thin DB **overlay** that credits vendors inside published
articles, joined by `blog_slug`. The Journal is **not** migrated to a CMS.

- **Migration `20270323790338_journal_vendor_spotlights.sql`** — new
  `public.journal_vendor_spotlights(spotlight_id UUID PK, public_id S89J-…,
  blog_slug TEXT (validated in app code against the in-code registry — NOT a FK),
  vendor_profile_id FK→vendor_profiles ON DELETE CASCADE, placement CHECK
  in('featured_partner','recommended','sponsored'), is_sponsored BOOLEAN,
  sponsored_sku_code FK→service_catalog ON DELETE SET NULL, admin_approved_at
  TIMESTAMPTZ, sort_order INT, …)` with `UNIQUE(blog_slug, vendor_profile_id)`.
  **RLS enabled at CREATE**: public read of APPROVED rows only
  (`USING (admin_approved_at IS NOT NULL)`) + admin `FOR ALL` `public.is_admin()`
  for every write. Partial indexes (approved-only) on slug+sort and per-vendor;
  `updated_at` touch trigger with `SET search_path = public` (advisory-clean).
  Idempotent + additive; verified via a `BEGIN…ROLLBACK` dry-run against prod,
  then applied to prod with the file-matching ledger version (no drift).
  - **Two-admin gate for paid slots**: extends the four-eyes queue
    (`admin_approval_requests`) `action_type` CHECK with
    `'approve_journal_spotlight'` (mirrors `approve_vendor_partnership`). A
    `sponsored` placement can NEVER publish on one admin's say-so — first admin
    initiates, a DIFFERENT admin confirms (atomic `.neq('initiated_by', me)`
    claim) before `admin_approved_at` is stamped.
  - **Price is admin-managed, never hardcoded**: seeds an inactive
    `journal_sponsored_spotlight` SKU in `service_catalog` (`is_active=FALSE` —
    selling sponsored slots awaits owner sign-off, like the Spotlight Awards
    homepage gate). The app reads the price from `service_catalog` by sku_code.

- **`lib/journal-spotlights.ts`** — shared read helpers: public
  `fetchApprovedSpotlightsForSlug` (approved-only, vendor display joined), vendor
  `fetchVendorJournalSpotlights` (resolves article title/cover from the file-based
  registry), admin `fetchAllSpotlightsForAdmin` (service-role; sees drafts), and
  `fetchSponsoredSlotPrice` (single catalog price lookup). All fail-soft.

- **Public `app/blog/[slug]/page.tsx`** — renders a "Featured in this story"
  credit block (`_components/journal-partner-credit.tsx`) for approved spotlights:
  vendor logo + name + a **dofollow** link to the vendor's marketplace presence
  (`/v/[slug]`). A `sponsored` credit carries an unambiguous **"Sponsored"** badge
  (0038 disclosure rule). Fetched cookie-free so the route stays on hourly ISR.

- **Admin `app/admin/journal-spotlights/`** (NEW) — attach a vendor to an article
  with a placement; single-admin Approve & publish for FREE placements; the
  two-admin Start→Confirm handshake for SPONSORED (the Confirm button is disabled
  on a request the viewer initiated); Remove. New sidebar + nav-registry entry
  (BookOpen icon). The /admin layout already 404s non-admins; actions re-check.

- **Vendor `vendor-dashboard/page.tsx`** — read-only "You're featured in the
  Journal" list (`_components/journal-feature-card.tsx`), mounted as a new
  component mirroring the Real-Stories vendor page; links each approved credit to
  its live article. Renders nothing when the vendor isn't featured anywhere.

SPEC IMPACT: None — new overlay + curation + surfacing layer over the existing
file-based Journal; no Journal-to-CMS migration, no Journal content change. New
SKU `journal_sponsored_spotlight` is seeded INACTIVE (admin-managed price,
gated behind owner sign-off) so there is no live pricing/payment-flow change.
⚠ Flag for owner: paid "Sponsored" Journal placements are wired but DORMANT
(SKU inactive) — selling them needs owner sign-off + a real catalog price.
