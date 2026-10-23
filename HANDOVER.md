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

## PR-B (rd/papic-camera-only-and-memories-albums, worktree wt-event-memories-b) — status: building
- Papic page = the camera (`studio/papic/page.tsx`, `data-papic-page="camera"`): ← Home · the one line (Papic switch =
  the existing `papic_on` answer through `AnswerPicker as="switch"` — no new column; dates = the shipped window picker)
  · PapicTopBand (credits · meter · Add more; its "See your N photos" → Memories) · Settings (Filter = StylePicker
  inline, When guests can shoot, Credits per guest, Face tagging, Face blocking) · Challenges · Magazine/Recap/
  Life-Flash (kept, see calls) · Setup & help.
- Memories (PR-A page) gains: Albums ▾ (All · Papic · Challenges · Event Hub · Suppliers · Your uploads), Needs a
  look N, ⚙ Gallery settings sheet (Follow the moments in order · Photo wall · Thank-You · Guests see all · Google Drive
  · Keep full res), + Add photos (thumb row), the photo sheet (View · Approve/Hide · Report why ▾ · Stop/Let shoot ·
  Delete forever with confirm; supplier file: hide that supplier's photos; Hub file: Save to phone).
  Read: `lib/event-memories.server.ts` (one read, every album; per-part refusals). Pure: `lib/event-memories.ts`.
- Challenges: the link that exists — `papic_mission_completions.capture_id`; board order (board_slot, created_at);
  supplier name in the ⓘ; In All a "Challenge" tag. Account Memories › Show ▾ › Also kept › Challenges
  (`challenges-tab.tsx`, hosted events that had challenges only; screened/hidden frames never drawn).
- How guests get in: `OneCodeUnderGetIn` under the Event Details row (QR · Copy link · Print poster · "N ready").
- Supplier hide: `SupplierPhotosSwitch` on each supplier row in Event access (`setVendorCapturesHidden`, back=details).
- Guests: "Setup" → "Settings" (`guests-screen.tsx`).
- Face blocking: `FaceBlockingList` + new action `setGuestFaceblock` (writes faceblock_enabled + the card's consequences);
  the action budget kept at 1,225 by deleting `dismissVendorRecommendation` (no caller).
- Moderation actions + `setVendorCapturesHidden` accept a fixed `back` (memories / details).

## PR-B calls (not covered by a ruling)
- Face tagging opt-in: NO `face_tagging_opted_in` column — #6826 (DPO rulings) already makes it opt-in by flipping
  `face_tagging_declined_by_couple` default (CLAUDE.md rule 8: one fact, one column). No migration in PR-B.
- "When guests can shoot" (GuestCamerasChoice) KEPT: the prototype calls it a half-duplicate "see Q1", but Q1 does not
  rule it, and retiring `papic_guest_capture_early` needs the capture gate changed.
- Magazine / Recap / Life-Flash cards stay on the Papic page (in neither of the owner's two lists).
- "Adding photos by hand" folds into + Add photos: when off, the sheet offers the same switch (UploadsOpenChoice).
- Report is offered on guest captures only (the shipped `reportCapture` names a guest capture); a camera seat's photo is
  hidden or deleted instead.
- The moderation PAGE stays (it also moderates Kwento messages); the Papic page no longer links to it.
- ThumbRow + Add photos: the shipped one-thumb-row rule (icon-only round, the word is the accessible name) over the
  prototype's visible "Add photos" label.
- "Follow the moments in order" is remembered per device (a way of looking, like the zoom), not a shared setting.
- Event Hub album: image files the APPLIED Hub points at in this event's own folders (cover, background, scene photos,
  our photos, love story), read-only, "Used on your Event Hub".
- NOT built (left): the Home Papic widget redesign (coverage line + strip + "N in your Memories · latest first ·
  See all"); the widget-grows-into-the-page animation; the photo wall's "saves on change" (its Save stays).
