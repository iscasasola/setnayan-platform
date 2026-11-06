## 2026-11-06 · feat(shops): a demo shop says "Sample shop", in the sample event's own chip; admins switch it in place

Owner, 6 Nov: *"They are demo shops. The only real shop is the wedding planner."* — then approved marking demo shops **"Sample shop"** the way the sample event is marked, and asked that it reuse the shipped look exactly.

- **No new column.** `vendor_profiles.is_demo` already says "this is not a real supplier", and every public reader keys on it (`shopPageGate`, the marketplace, the sitemap, Discover's Shops shelf). A second `is_sample` would be a competing answer to one question (CLAUDE.md rule 8), so there is no migration.
- **One marker, moved — not redrawn.** `app/_components/sample-marker.tsx` holds the sample event's chip exactly as `app/realstories/[slug]/page.tsx` drew it ("Sample showcase"); that page now draws it through the same component, byte-identical. `SampleShopMarker` is that chip as the label of the one ⓘ: *"A sample to show how a shop looks on Setnayan. Its photos are illustrations."*
- **Where it shows:** the shop page `/v/[slug]` beside the name (outside the flagship-hero branch, so every plan shows it), and the shop's marketplace card (`VendorCard`), which loses its old amber "Demo" pill and amber ring. Nowhere else.
- **Admin:** `/admin/vendors/<id>` — the read-only "Demo shop" fact becomes one **Sample shop** switch that saves in place (no redirect), posts an explicit on/off, is guarded on the value it read, and is audited (`vendor_sample_shop_on` / `_off`). It rides the existing `moderateServiceCard` dispatcher (`op=sample_shop`) — the server-action budget is at its ceiling.
- **Visibility is unchanged:** an `is_demo` shop still opens only for its own team and for admins in demo mode, and stays out of search (owner ruling 2026-09-29, "LANE 2 §2C" (1)).
- Lab: `/dev/shop-page-lab?sample=1` and `?view=card&sample=1` (dev-only).
- Guard: `app/_components/the-sample-shop-wears-the-sample-marker.test.ts`.

SPEC IMPACT: controller records the ruling (owner 6 Nov 2026 — demo shops are labelled "Sample shop" with the sample event's marker; the admin switch writes `vendor_profiles.is_demo`).
