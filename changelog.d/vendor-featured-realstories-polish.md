## 2026-06-29 · feat(real-stories): "you got featured" vendor email + prod drift repair (Soon-benefits Wave 1)

Polish on the already-shipped Featured-in-Real-Stories benefit.

**Vendor email.** When an admin features a wedding (`setShowcaseFeatured`,
`apps/web/app/admin/real-stories/actions.ts`), we already notified the couple;
now we also email every **credited** vendor — booked marketplace vendors whose
`linked_vendor_profile_id` was stamped on lock (the same join that builds the
editorial credit), tier-filtered to skip free vendors (hidden from the credit).
New `sendVendorFeaturedInStoryEmail` in `apps/web/lib/vendor-email-triggers.ts`
(clones the existing Resend plain-text pattern), linking the couple's canonical
`/[slug]` editorial. Idempotent: fires only on the **first** feature
(null→set transition), never on re-feature/rank tweaks. Best-effort — never
blocks the admin action.

**⚠ Prod drift repaired.** Verifying the two Featured migrations surfaced a real
drift: `20261221000000_realstories_featuring` is recorded as applied in
`supabase_migrations.schema_migrations`, but its columns
`events.showcase_featured_at` / `events.showcase_feature_rank` did **not exist**
in prod — so the entire featuring feature (admin pin/order, public `/realstories`
index, couple notify) was erroring in prod. Re-ran the migration's idempotent
`ADD COLUMN IF NOT EXISTS` DDL via the Supabase MCP to bring the live schema in
line with the ledger. (`event_vendors.linked_vendor_profile_id` from
`20270129232225` was already present.) **This ledger-vs-schema mismatch may not
be isolated — a broader migration-ledger audit is recommended.**

Backlink note: the optional dofollow `website_url` backlink in the editorial
credit is **deferred** — `vendor_profiles.website_url` does not exist, so it's a
4-surface build (column + vendor settings UI + editorial render + admin
moderation), not polish. Tracked as a follow-up.

Typecheck + lint clean.

SPEC IMPACT: None — additive vendor email on an existing feature + a prod schema
drift repair; no schema table/SKU/pricing change in the repo.
