## 2026-10-25 · feat(discover): search answers with events · people · suppliers — the person first

Owner, after searching "cale" on Discover and getting only help/guide cards: *"what i want is the discover being their
place to see suppliers, people, and their events. From their own, the the people they connected, to the rest of the
users of setnayan that made their event public."* — then *"so it is like how youtube searches · find the user, and the
videos related to the search"*.

- Signed-in Discover search (`/?q=`, in place) now lists, in order: a matching **person** (else a matching shop) as the
  top "channel" row → **events** (your own, from your search index; then your followed/connected people's; then
  anybody's public event) → the rest of the **people** → **suppliers** (yours, then the shops we publish).
- **No stories, guides or spaces on Discover** (DECISION_LOG 2026-10-01, "ARTICLES LEAVE DISCOVER") — the reading search
  is not even asked there. `/dashboard/search` and the signed-out `/?q=` are unchanged.
- Events come from `searchDiscoverEvents` (`lib/discover-events.ts`): the Discover shelves' own reads and allow-list
  (`readEventShelves` → `isDiscoverable`, public only, upcoming only), the world read narrowed by an `ilike` on name or
  address, every card matched by the ONE matcher (`matchesCommandQuery`) over its title, address words and public host.
- A refused events or people read says so ("couldn’t finish" / "We couldn’t search events just now…"), never "nothing".
- Every row is an existing card (`OwnCard`, `DiscoverEventCard`, the people rows, `ShopHitCard`). No migration, no new
  server action, no new client code. Guard: `discover-search-finds-events-people-suppliers.test.ts` (seen failing once).

SPEC IMPACT: Discover search scope — DECISION_LOG row "DISCOVER SEARCH = EVENTS · PEOPLE · SUPPLIERS" (2026-10-25).
