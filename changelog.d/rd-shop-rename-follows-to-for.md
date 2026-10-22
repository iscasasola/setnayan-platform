## 2026-10-22 · fix(people): a renamed shop renames its business alaga

Opening a shop writes the business a `dependents` row named after the shop AT OPEN TIME
(`lib/business-alaga.ts`, `becomeVendor`). Nothing kept it in step, so a renamed shop kept
its OLD name in the event picker's "For ▾" dropdown and on People.

- New `lib/business-alaga-sync.ts` · `syncBusinessAlagaName(adminClient, { ownerUserId,
  vendorProfileId, shopName })` — renames exactly the shop's own business row (owner + shop +
  `dependent_kind='business'`), same 128-char normalisation as the insert, best-effort: never
  throws, never fails the rename.
- Called by every writer of `vendor_profiles.business_name` on an owned shop:
  `updateVendorProfileField` (My Shop rename), `applyCorrectionRequest` (admin-approved name
  correction — a verified shop's only rename door), and `becomeVendor`'s re-run branch.
- Guard `lib/business-alaga-sync.test.ts`: behaviour via a fake client, plus a payload-level scan
  of `app/` + `lib/` that finds every `vendor_profiles` update/upsert writing `business_name`
  and requires the sync (one reasoned exemption: admin staging of an UNCLAIMED shop, which has
  no owner and so no alaga). Stale exemptions fail.
- Prod: 1 business alaga, 0 stale (read-only count) — no data fix needed.

SPEC IMPACT: None
