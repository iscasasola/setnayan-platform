## 2026-07-30 · feat(ugat): Papic joins the map — the first concept promoted off the backlog

The coverage guard shipped hours earlier measured a 44-subsystem `map-backlog`. This clears the largest entry: **Papic, 17 tables**, the biggest single cluster on the platform and a flagship SKU, invisible on `/admin/ugat/map` until now.

**The node is anchored on the SEAT, not the photo.** `paparazzi_seats` is the real hub — 6 inbound foreign keys, and a seat is the unit of entitlement that captures hang off. Anchoring on `papic_photos` (39 columns) would have put the node on the volume table rather than the concept. Asserted in a test so a later edit can't quietly re-anchor it.

**Five joints, every claim authored from foreign keys read out of live production:**

| | Bond | Via | Trap recorded |
|---|---|---|---|
| **J16** | Papic → Events | `paparazzi_seats.event_id`, CASCADE | Deleting an event CASCADEs the **entire** cluster — seats, captures, missions, counters — with no tombstone. Sits awkwardly beside the 5-year originals-retention promise. |
| **J17** | Papic ↔ Users | `claimer_user_id` | `NO ACTION`, unlike `event_id`'s CASCADE: deleting a seat-holding user **fails** rather than orphaning. Safer, and one of the FK classes behind the broken admin "Delete user". |
| **J18** | Papic ↔ Guests | `papic_guest_captures.guest_id` + seat-holding | `papic_photos` has **no `guest_id` at all** — tagging is a separate relation. And the two guest bonds disagree on delete: captures CASCADE, seats don't. |
| **J19** | Papic → Orders | three parallel order tables | Entitlement activates on **admin approval**, never on order creation. Three order shapes means "is Papic paid for?" has three answers; no single column to read. |
| **J20** | Papic ↔ Vendors | `papic_missions.vendor_id`, sponsorships | 🔴 `vendor_id` is named like a vendor reference but points at `event_vendors` — a **booking** id. The exact J7 trap, repeated. The two vendor bonds are at different grains and are not interchangeable. |

**The naming lock is respected.** The product types are **Papic Pool** and **Papic One**; "Papic Guest" never appears as a product name. Several tables still carry the older `papic_guest_*` naming and are cited verbatim — table names are facts, product names are the lock, and the node comment says so explicitly so a future session doesn't "tidy" one into the other.

**The guard caught my own imprecision, twice over.** I first claimed `no_fk` on `papic_photos.guest_id` — but that column doesn't exist at all, so the claim was **vacuous**, and the vacuity check built yesterday said so. `no_column` is what the trap actually asserts. That is the deliberate design working on its author: a claim that cannot fail is worse than no claim.

**Both backlog lines were deleted, not amended** — and that is the file's shape working. The stale-line check would have failed had they been left behind, because a table that is now mapped must not also carry a "declined" record. First entry off the `map-backlog`; **42 to go**, and the count is a debt figure.

Cache key `v2 → v3` for the new `papic` count plus its two capture sub-figures — a stale payload would render them as a plausible blank rather than an error. Capture volumes are head-counts only: those rows carry geo, device and EXIF metadata that an admin roll-up has no need for.

Two cross-concept dependencies surfaced while mapping, both worth knowing before the next promotion: **`papic_photos.captured_by_person_id` already foreign-keys into `people`** — the counsel-gated person spine, itself still on the backlog. And the three tier tables key into `platform_retail_catalog_v2`, so Papic's pricing is FK-anchored to a catalogue that is also unmapped. Papic is not an island; the backlog has an order to it.

SPEC IMPACT: `DECISION_LOG.md` row — Papic promoted to `TYPE-PAPIC` with joints J16–J20, anchored on `paparazzi_seats`; `map-backlog` reduced from 44 to 42. No schema change, no RLS edit, no flag; no exposure-baseline regeneration.
