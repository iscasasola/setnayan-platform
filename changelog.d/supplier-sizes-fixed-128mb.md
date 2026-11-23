## 2026-11-23 · feat(plans): supplier sizes fixed to 128 MB · 1 GB · 100 GB · 500 GB · 1 TB, and every plan card says how many clients fit

Owner, 23 Nov: *"Let's fix this · Free Unverified 128MB · Free Verified 1Gb · Plus 100Gb · Pro 500Gb · Ultra 1Tb"* · *"Give them a quick range of how many clients can they serve"*. One client = one booked event with that supplier.

- **The sizes, in both places.**
  - `TIER_CAPS[t].storageBytes` (`lib/vendor-tier-caps.ts`): Free 128 MB · Verified 1 GB · Plus 100 GB · Pro 500 GB · Ultra 1 TB. It was 256 MB · 2 GB · 128 GB · 500 GB · 1 TB.
  - **Migration `20271361280498_supplier_sizes_fixed_2026_11_23.sql`:** `vendor_tier_limit(…,'storage_mb')` = 128 · 1,000 · 100,000 · 500,000 · 1,000,000. The body is the current definition from `20271360033501`, with only these numbers and the comment changed. `enforce_supplier_storage_allowance` reads the key, so it refuses past the new sizes with no change of its own. Prod has no stored `vendor_plan_contents` storage row (SELECT, 23 Nov). Grandfathered: nothing stored is touched.
- **The client range:** `lib/supplier-client-room.ts` (`clientRange`, `clientRangeWords`). It is computed from the plan's size, and every constant names its source:
  - one client = 5 photos, at ~1 MB to ~150 KB each, plus ~13 KB of records with chat included (measured on prod 23 Nov);
  - the shop's own ~2–10 MB comes off the top;
  - both ends are rounded to a friendly number.

  Result: Free "Room for about 25–150 clients" · Verified "about 200–1,200" · Plus "tens of thousands" · Pro and Ultra "hundreds of thousands".
- **Where a person reads it:**
  - the /for-suppliers plan picker card, under its size meter (`planStair().clients`);
  - `planLine`, which is the /for-coordinators plan lines;
  - the Plans page's "What your plan gives you", plus the plan picker's "What changes" (a new `clients` gives-line).
- **Every displayed size** already reads from `TIER_CAPS` through `storageWords`; no typed size was on a screen. Tests and comments that pinned the old numbers now say the new ones.
- Guards:
  - `lib/supplier-client-room.test.ts` (new);
  - `tests/db/supplier-storage-allowance.db.test.ts`: TS ↔ SQL parity, plus the exact-fit and one-byte-past tests at the new sizes;
  - `supplier-storage`, `vendor-tier-caps`, `vendor-plan-rows`, `supplier-front-reads-its-numbers` (every card's range is the helper's), `supplier-plan-table-tells-the-truth`, `open-shop-more-services`.
- Server actions: no new export.

SPEC IMPACT: Supplier storage sizes and the client range. Specs DECISION_LOG 2026-11-23 "SUPPLIER SIZES FIXED" (c94e9bf6) supersedes the 23 Nov "VERIFIED SUPPLIER STORAGE IS 2 GB", the 23 Nov "free unverified is 256 MB" and the 22 Nov "PLUS CUT TO 128 GB" sizes. Open with the controller: the ruled chat & documents rooms (Free 0.5 GB, Verified 1 GB) no longer fit Free 128 MB and Verified 1 GB. #8191 caps a room at half its plan.
