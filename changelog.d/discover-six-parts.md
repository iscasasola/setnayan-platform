## 2026-11-16 · feat(discover): Discover in six parts — verified shops only, signed out sees the front door only

Owner, 16 Nov 2026 (DECISION_LOG "Discover in six parts"; rulings 41057aae · 45fd9c21 · 448fd3c1 · a85b0260; drawing `prototypes/discover_six_parts_2026-11-16/`).

- **Signed out, `/` is the promotional front door only.** A search, the supplier view or either "See all" view sends the visitor to sign in and back to the same address (`signedOutRedirect`, `lib/discover-six-parts.ts`). Exact links (a shop, its QR, an event, a story) are other routes and stay open.
- **Six parts, in order,** after the viewer's own events and the upcoming shelves: People to follow · Suppliers · Service cards · Event stories · Articles · Inspiration. New uploads and Trending are retired.
- **Verified shops only on Discover** — through the ONE findable fact: `is_findable` means verified AND listed since #7828, so every Discover read (Suppliers shelf, search, service cards, inspiration, the supplier view on `/`) asks it and nothing re-types "verified" for Discover. Its Filters no longer offers a "Verified only" switch there; `/explore` keeps it (now redundant there too — left for the owner).
- See-all choices (Event type · Sort · Parts) use the shared dropdown, each option a page address; the Articles placeholder is hidden in the store app (`data-coming-soon`).
- **Service cards** use the shipped `ServiceCardView` through one new face builder, `lib/marketplace-service-card-faces.ts`, now shared with the supplier grid — so a card on Discover is no thinner than one click later (logo, record, hidden prices, cover, inclusions, discount, Serves line, showcase). See all → `/?browse=1`.
- **Event stories** — published post-event stories; See all (`/?stories=1`) has Event type ▾ and Sort ▾ (Newest only — "Most read" needs a read count stories do not have yet, a follow-up).
- **Articles** — a one-line placeholder.
- **Inspiration** — photos verified shops already show on their own shop, credited to the shop, with type · venue · month and never a name; fails closed on the listing gate. See all (`/?inspiration=1`) has Parts ▾. "Save to Mood Board" is a link into the viewer's one event's Mood Board (several events → their events list; none → no Save).
- Every shelf says in one line when it is empty or could not load. Zero new server actions, no migrations.

Guard: `app/_components/frontdoor/discover-in-six-parts.test.ts` (9 tests, 12 sabotages all red). Successor edits to 17 existing guards that pinned the old shelves or the grid's inline card block.

SPEC IMPACT: None — implements the 16 Nov ruling already recorded in DECISION_LOG.
