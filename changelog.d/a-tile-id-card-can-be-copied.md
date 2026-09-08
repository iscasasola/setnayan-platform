## 2026-09-08 · fix(vendor): a card filed under a wedding tile id can be copied

Owner, on his own shop: *"when i click the copy icon, the link fails."*

"Start a new card from this one" builds `/vendor-dashboard/services/new/<the
card's kind>?from=<id>`. On a shop with two cards, `live_band` opened and
`host_mc` returned **"This page doesn't exist on Setnayan"** — so the same button
worked on one card and 404'd on the other, with nothing to explain the
difference.

### What the door accepted, measured

```
live_band   VENDOR_CATEGORY false   WEDDING_TILE true   → passed on the LEAF arm
host_mc     VENDOR_CATEGORY false   WEDDING_TILE true   → matched neither → 404
dj, choir   VENDOR_CATEGORY false   WEDDING_TILE true   → passed on the LEAF arm
```

**None of the four is a `VENDOR_CATEGORIES` member.** The three that worked did
so only because they also happen to be coverage leaves on that shop's live tree.
`host_mc` is not, so the route refused a kind the product had already saved on a
real card. Reproduced on production four ways — with and without `?from=`, and
under both `host_mc` and `host-mc`.

🔑 **The route's own comment predicted this and named the wrong second arm** —
*"a leaf card would simply have no copy button that works."* True, and not only
leaf cards. `lib/card-kind-labeller.ts` says it outright: *"cards in production
hold `live_band` / `host_mc`, which are tile ids"*. **A vocabulary the product
SAVES has to be a vocabulary the door ACCEPTS**, and tile ids were being saved
long before this door learned them.

Adds `WEDDING_TILE_SET` as a third arm. Membership only — it does not make a tile
id a `VendorCategory`; it says the door may open for a kind the product stores.

### The guard that had to change, and why that is not a weakening

`service-card-kind.test.ts` pinned the whole two-arm condition as one verbatim
regex, so **widening** the door turned it red — a direction it does not actually
care about. Re-pointed to assert the properties instead: each arm is still
consulted, the new one is consulted, and an unknown kind is still refused.
Mutation-tested three ways — drop the tile arm (the original bug), drop the leaf
arm, stop refusing at all — each turns it red.

SPEC IMPACT: None.
