## 2026-10-23 · feat(event bar): Memories joins as the fifth tab — this event's photos on an edge-to-edge grid; Home's header carries ⚙ Settings

Owner, 23 Oct ("Yes", on `prototypes/event_bar_memories_tab_2026-10-23.html`, corpus 984518d7): the event bar is
**Home · Guests · Suppliers · Hub · Memories**; Home has **no** segmented tabs — its header carries one **Settings**
button (the Event Details door); Memories is this event's gallery.

- **The fifth tab** (`lib/customer-menu.ts`, key `memories`, the account bar's Sparkles glyph) after Hub, every phase,
  every event type, web and app; registry slots `customer.bottom-nav.memories` / `customer.sidebar.memories`; the
  desktop rail draws the same row; `/galleries` lights Memories now (it is this event's photo sources).
- **`/dashboard/[eventId]/memories`** — `app/_components/memories/event-memories-gallery.tsx`: frameless, edge to
  edge, square tiles, 1.5 px gaps; the count; the shared ThumbRow ("Search memories"); a tap opens the shipped
  lightbox (`PapicLightbox`).
- **Columns follow the zoom like Apple Photos** — phone 3 · 5 · 7 · 1, desktop 6 · 9 · 12 · 16, remembered on the
  device (`lib/gallery-zoom.ts`). Owner, after trying the prototype: *"The pinch changes too fast"* → **one step per
  gesture** (`use-grid-pinch.ts`): the grid scales live while the fingers move (transform only), snaps one step past
  ×0.8 / ×1.25 or springs back; a trackpad/⌃-wheel gesture (events < 250 ms apart) applies at most one step; the snap
  keeps the photo under the fingers and eases 200 ms; reduced motion snaps without animation.
- **Compressed only** (owner: *"on the memories, always use the compressed version"*): `fetchPapicGallery(…,
  { compressedOnly })` → `memoriesRefs` — grid = the 320 thumb (640 tile one-across), viewer = the 1280 display copy,
  a clip plays its web copy; the original is only an explicit Download.
- **First-visit spotlight** (`customer_memories_v1`, a new feature's tour): the grid · the count · the search.
- **Home**: the cover's one button is ⚙ Settings → `/details` (#6838's one door); Papic's "See N photos" opens Memories.
- Guards: `memories/the-memories-tab-is-this-events-memories.test.ts` (5) · `lib/gallery-zoom.test.ts` ·
  `lib/event-memories-words.test.ts` · `lib/memories-never-shows-an-original.test.ts`; the four-tab guards now say five.

SPEC IMPACT: DECISION_LOG row 2026-10-23 "MEMORIES JOINS THE EVENT BAR; HOME CARRIES ⚙ SETTINGS; ONE ZOOM STEP PER
GESTURE; MEMORIES DRAWS ONLY COMPRESSED COPIES" (Setnayan-specs).

Review fixes (#6851): a clip with no web copy opens as a still with "Download snippet" whenever a file exists; the
count is the grid-filtered `countGalleryFrames` (not hidden, not blocked, not expired); any refused read says
"couldn't load"; a non-couple fails closed when the hidden-suppliers read fails; ⌃-wheel is heard on the window; a
frame with no compressed copy is a "Processing" tile; tour copy is role-neutral. Clip originals are still presigned at
render (a local HMAC, no network) — signing on the Download press would need a route; left for a follow-up.
