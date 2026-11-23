## 2026-11-23 · feat(plans): supplier sizes are 50 MB · 1 GB · 50 GB · 256 GB · 1 TB, and every plan card leads with how many clients it keeps

Owner, 23 Nov, final: *"free should only be 50 clients compressed photos"* · *"Pro is 256Gb · Ultra is 1TB"* (Plus 50 GB, his pick), confirmed in the builder session · *"Give them a quick range of how many clients can they serve"* · Q "Do we say the Storage is or what the storage can do for them?" → *"Yes, clients first"*. One client = one booked event with that supplier. Free is a trial, not a plan to stay on.

- **The sizes, in both places.**
  - `TIER_CAPS[t].storageBytes` (`lib/vendor-tier-caps.ts`): Free 50 MB · Verified 1 GB · Plus 50 GB · Pro 256 GB · Ultra 1 TB. It was 256 MB · 2 GB · 128 GB · 500 GB · 1 TB.
  - **Migration `20271361280498_supplier_sizes_fixed_2026_11_23.sql`:** `vendor_tier_limit(…,'storage_mb')` = 50 · 1,000 · 50,000 · 256,000 · 1,000,000. The body is the current definition from `20271360033501`, with only these numbers and the comment changed. `enforce_supplier_storage_allowance` reads the key, so it refuses past the new sizes with no change of its own. Prod has no stored `vendor_plan_contents` storage row (SELECT, 23 Nov). Grandfathered: nothing stored is touched.
- **Clients first:** `lib/supplier-client-room.ts` is the ONE helper. It is computed from the size, and every constant names its source.
  - `clientsKept`: (plan − ~2 MB of the shop's own photos) ÷ (5 kept photos × ~150 KB + ~13 KB of records, measured on prod), rounded down.
  - `clientsKeptWords` is the headline: "Keeps about 60 clients at a time*". Above 10,000 it is words: Plus "tens of thousands", Pro "hundreds of thousands", Ultra "over a million".
  - `planStorageLine` is the line under it: "50 MB storage · clear older clients’ photos to make room", or "256 GB storage" on a paid size.
  - `CLIENTS_FOOTNOTE`: "*An estimate: one booked client with 5 photos collected for that event only."
- **Where a person reads it:**
  - the /for-suppliers plan picker card leads with it, with the size line and the meter under it and the footnote under the cards (`planStair().clients` / `.sizeLine`);
  - `planLine` (the /for-coordinators plan lines) leads with it, with the footnote after the plans;
  - the Plans page: a new "Clients you keep" row first in "What your plan gives you" and in the picker's "What changes", each with the footnote.
- **Every displayed size** already read from `TIER_CAPS` through `storageWords`; no typed size was on a screen. Tests and comments that pinned the old numbers now say the new ones.
- Guards:
  - `lib/supplier-client-room.test.ts` (new);
  - `tests/db/supplier-storage-allowance.db.test.ts`: TS ↔ SQL parity, plus the exact-fit and one-byte-past tests at the new sizes;
  - `supplier-storage`, `vendor-tier-caps`, `vendor-plan-rows`, `supplier-front-reads-its-numbers` (every card's headline, size line and footnote come from the helper), `supplier-plan-table-tells-the-truth`, `open-shop-more-services`.
- Server actions: no new export.

SPEC IMPACT: Supplier storage sizes and the clients-first plan card. Specs DECISION_LOG 2026-11-23 "SUPPLIER SIZES FIXED (FINAL)" (1f8dab66) supersedes the 23 Nov "VERIFIED SUPPLIER STORAGE IS 2 GB", the 23 Nov "free unverified is 256 MB" and the 22 Nov "PLUS CUT TO 128 GB" sizes. The room drop is its own row (9abac928). Left to #8191 (it owns `lib/supplier-storage.ts`): when Free is full, offer "Get verified", not Plus.
