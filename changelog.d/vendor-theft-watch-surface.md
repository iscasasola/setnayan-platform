## 2026-07-01 · feat(vendor-dashboard): reverse-image theft-watch vendor surface (Wave 1 · spec A)

The reverse-image repost detection engine (`lib/vendor-image-repost-watch.ts` →
`vendor_image_flags`) already shipped but was admin-only (`/admin/repost-watch`).
This adds the **vendor-facing view**:
- `lib/vendor-theft-watch.ts` · `fetchVendorReposts(vendorProfileId)` — admin-client
  read (the table is RLS-blocked from vendors) scoped to `source_vendor_id = the
  session vendor` (reposts OF their work). Deliberately hides the accused
  reposter's identity — flags can be unconfirmed; adjudication stays with admins.
- `/vendor-dashboard/theft-watch` page — lists the vendor's own flagged images
  (thumbnail + surface + review status + date) with a clean "your work is clean"
  empty state. Session-derived identity, `canManageVendor` gate.
- Nav: `Theft Watch` added to `VENDOR_NAV_GROUPS` (My Shop, `ShieldAlert`);
  `lint:navicon` green.

Flipped `Reverse-Image Theft Watch` `soon`→live (Trust lens) in the homepage
vendor-benefits overlay. tsc + eslint + nav-icon lint all clean.

SPEC IMPACT: clears the `Reverse-Image Theft Watch` SOON. The catalog count +
VENDOR_TIERS_AND_BENEFITS.md §6/§9 sync (with the concurrent profile-tips PR) is
a small follow-up once both land — kept out of this PR to avoid an overlay conflict.
