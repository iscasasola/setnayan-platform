## 2026-07-11 · feat(plan3d): ghost-booth selection core (3D Booth Ads · slice 9 · Part A, PR 1/N)

First layer of "3D Booth Ads · Part A" (owner-locked 2026-07-08): dashed GHOST
BOOTHS for the vendor categories a couple hasn't booked yet, shown ONLY in the
couple's own 3D planning lab (never a guest page). Tapping one deep-links to that
category's marketplace grid (`/explore?tile=<slug>`, where Boosted/Pro rank
first) — a native, in-room "you still need a caterer → here are caterers" ad.

This PR adds ONLY the network/DOM-free PURE selection core (nothing imports it
yet) so it's 100% unit-testable; the schema (dismissal + master toggle), the 3D
render, and the tap wiring are later phases.

`lib/ghost-booths.ts`:
- `GHOST_BOOTH_CATEGORIES` — the curated DOMAIN: the 12 core reception-floor
  categories that read as a physical booth AND are prime ad inventory (catering,
  photographer, videographer, band/DJ, florist, cake, photobooth, mobile bar,
  makeup, hair, host/emcee, decor). Deliberately excludes non-booth categories
  (venue, officiant, rings, attire boutiques, accommodation, …).
- `unbookedGhostCategories({ bookedCategories, dismissed, enabled })` — the ghost
  booths to show: domain minus booked minus dismissed, in domain order, each
  resolved to its label + marketplace tile slug via the existing taxonomy bridge;
  empty when the master toggle is off. A category with no marketplace tile is
  skipped (nothing to sell).
- `ghostBoothExploreHref(slug)`.

8 unit tests (`lib/ghost-booths.test.ts`) — toggle gating, booked/dismissed
filters, domain-order preservation, non-domain exclusion, every domain category
resolves to a tappable tile. All green · guards clean.

⚠ OWNER SIGN-OFF: which categories get a ghost booth (the `GHOST_BOOTH_CATEGORIES`
array) is a product/ad-inventory decision — I curated a sensible core 12; tweak
the one array to add/remove/reorder.

Behind the upcoming `NEXT_PUBLIC_PLAN3D_BOOTH_ADS` flag (off by default). This PR
wires nothing → inert.

SPEC IMPACT: None (implements the locked slice-9 Part A; corpus DECISION_LOG 2026-07-08 describes it).
