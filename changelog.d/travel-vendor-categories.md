## 2026-08-01 · feat(taxonomy): travel becomes a real bookable vertical — accommodation + transfers

Owner decision 2026-08-01: travel needs *"location activities like klook, accomodation like
booking and airbnb, restaurant seat reservation"* — and, asked whether those should be affiliate
links out to those platforms or real Setnayan vendors, the owner chose **"Real Setnayan vendors in
those categories."** So this is taxonomy reach, not an integration: local tour operators,
guesthouses and restaurants onboard like any other vendor and are booked through the existing
inquiry flow at 0% commission. No pricing, no entitlement, no SKU, no new event type.

**Three of the four things the owner named already shipped, and were NOT rebuilt.** Travel already
reached 8 tier-2 tiles including `tour_activity` ("Tours & Activities"), `tour_guide` and
`restaurant_reservation`. The real gaps were **accommodation** and **transport**.

### Accommodation — a reuse, and the mirror of a defect we already paid to fix

The canonical leaf `accommodation` **already existed and was already tagged `['travel','wedding']`**
— but it sat on the `reception` tile, the wedding reception-venue shelf (function hall, hotel
ballroom, garden/resort venue), which travel never reaches.

That is the exact inverse of the dead end `20271027794853` fixed for date/hangout, and it is why it
had to be fixed rather than routed around. There a tile offered a type its leaf refused; here the
leaf accepts a type its tile never surfaces. The vendor picker resolves the **leaf** override
(`lib/vendor-coverages.ts`), so a hotel *could* tick Travel; every couple-side surface narrows on
the **tile** (`lib/taxonomy-filters.ts`, consumed by /explore, the Shortlist, the onboarding picker
and `lib/plan-groups-by-event-type.ts`), so no travel host was ever shown a shelf that leaf sits on.
A vendor could declare it and never be found through it — invisible only because prod is pre-launch
(`vendor_services` = 0 rows), the same condition that makes a dead shelf and a new shelf render
identically.

So `accommodation` was **re-shelved onto its own tile, not duplicated.** A second "where you sleep"
concept beside the existing one is how two vocabularies drift apart.

⚠ **This is the one change that touches wedding, deliberately.** The new tile claims
`['travel','wedding']`, not travel alone — scoping it to travel would have *stripped* wedding's
access to a leaf it has today. Wedding's reach is unchanged (a couple can still book a guest room
block); only the shelf changes, from inside "Reception" to "Accommodation". `reception` keeps its 6
real venues, and the leaf keeps its `secondary_tiles = {catering}` cross-list.

### Transport — the only genuinely new family

The `transport` folder held only hosted-event constructs (`bridal_car`, `guest_shuttle`, `escort`).
None describes getting around on a trip and no other tile did either, so `transfers_rentals`
("Transfers & Rentals") is new, scoped **`['travel']` only** — an airport transfer is not a wedding
service, and quietly widening other types' reach is not this change's business.

### New canonical leaves (product surface — named loudly)

- **Accommodation:** `hotel_stay` · `resort_stay` · `guesthouse_homestay` · `vacation_rental`
  (`accommodation` stays the generic catch-all, the same generic+specific shape `reception_venue`
  has beside `hotel_ballroom`)
- **Transfers & Rentals:** `airport_transfer` · `private_car_charter` · `van_rental` ·
  `motorcycle_scooter_rental` · `boat_ferry_charter`

Admins edit tile reach at **`/admin/event-types/travel/categories`** and the tiles/leaves themselves
at **`/admin/taxonomy`** (Taxonomy Studio). Seeds are `ON CONFLICT DO NOTHING` + guarded UPDATEs, so
admin edits survive a replay.

### Also fixed in passing

`lib/vendor-category-taxonomy.ts`: the couple-side `accommodation` category anchored to the
`reception` tile (it had nowhere better to point), so "shop this category" sent someone looking for
a hotel into the reception-venue shelf. Re-anchored. `transportation` gains `transfers_rentals`.

### Guards

The migration asserts its own end state, including the two things a later edit could quietly break:
that wedding **keeps** accommodation, and that no tile:event_type pair was left unfillable. A
regression pin was added to `tests/db/tile-event-type-fillable.db.test.ts` — the generic guard there
is blind to this defect class by construction, because a leaf that is reachable by the vendor and
invisible to the host is not an "unfillable pair".

SPEC IMPACT: None — no corpus file states travel's category list; the DB taxonomy is canonical
(`AS_BUILT_GROUND_TRUTH` source-of-truth order puts shipped code + prod DB above the iteration
specs). The owner decision itself is worth a `DECISION_LOG.md` row.
