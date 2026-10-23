# HANDOVER — rd/event-bar-memories (builder, 2026-10-23)

Contract: `prototypes/event_bar_memories_tab_2026-10-23.html` (corpus 984518d7) + `prototypes/papic_controller_one_page_2026-10-23.html` (9fa5b271).
Built on (merged locally, not yet on main): #6791 · #6838 · #6839.

## PR-A (this branch) — status: building
- 5th tab **Memories** (key `memories`, Sparkles = the account bar's Memories glyph) after Hub — `lib/customer-menu.ts`;
  registry slots `customer.bottom-nav.memories` + `customer.sidebar.memories`; rail slot key; preload set.
- `/dashboard/[eventId]/memories` — `app/_components/memories/event-memories-gallery.tsx` (edge-to-edge grid, count,
  foot line, shared ThumbRow "Search memories", shipped `PapicLightbox` on tap) + `use-grid-pinch.ts` (one step per
  gesture, live scale, snap 200 ms, reduced motion) + `lib/gallery-zoom.ts` + `lib/event-memories-words.ts`.
- Home cover: the one button is ⚙ **Settings** → `/details` (the #6838 door). Home has no tabs.
- Papic row "See N photos" → `/memories`.
- Guards: `app/dashboard/[eventId]/memories/the-memories-tab-is-this-events-memories.test.ts` (5 tests, 5 sabotages red→green),
  `lib/gallery-zoom.test.ts`, `lib/event-memories-words.test.ts`; the four-tab guards updated to five.

- 🗜 Compressed only (owner 23 Oct): `fetchPapicGallery(…, { compressedOnly: true })` → `memoriesRefs` (lib/papic-display-ref.ts):
  grid = thumb 320 (tile 640 one-across), viewer = display 1280, clip plays clip_web; the original is only a Download
  (photo: save-photo route = the kept original while held, else the compressed copy that replaced it; clip: original
  unless dropped, else clip_web). Guard `lib/memories-never-shows-an-original.test.ts` (2 sabotages red→green).
  Prod (read 2026-10-23): 12 seat captures, all with thumb/display/clip_web; 0 guest, 0 vendor captures.
  Avg bytes: thumb 2,229 · tile 7,533 · display 23,477 · original 241,545.
- Pinch (owner "too fast"): one step per gesture, live scale, snap 200 ms, reduced motion = no animation.
  Walk script: ~/Documents/Claude/Projects/shots-2026-10-23/event-memories/scripts/walk-pinch.mjs.

## Calls made (not covered by a ruling)
- `/galleries` (after-day photo sources hub) now lights **Memories**, not Home — it is this event's photos.
- The Home cover keeps its shipped height/ground (hub image when there is one); only the button changed. The prototype's
  `.cover.img` min-height 168 is a sketch of "the photo behind it", which ships already.
- Account-level Memories (#6778) is NOT restyled: its approved prototype (people_and_memories M1–M4) is the contract for that
  page. The event page uses the gallery prototype's edge-to-edge grid; the zoom engine (`lib/gallery-zoom.ts` +
  `use-grid-pinch.ts`) is the shared piece account Memories can adopt.
- Pinch: owner after trying the prototype — "The pinch changes too fast" → one step per gesture (controller brief).
- "gallery" → "Memories" sweep is another builder's (rd/no-gallery-word); only strings this branch creates say Memories.
- Albums ▾ / ⚙ Gallery settings / + Add photos / photo-sheet moderation → PR-B.

## Known reds that are NOT this branch's
- From #6839 (merged in locally): `supplier-never-vendor.test.ts` ("Off in Your info" at studio/papic/page.tsx) and
  `the-couple-books-never-locks.test.ts` (allowlist row `studio/papic/` stale). #6839's builder owns them.
