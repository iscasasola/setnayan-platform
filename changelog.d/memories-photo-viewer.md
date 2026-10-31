## 2026-10-30 · feat(memories): a photo opens in the viewer template — Share · Tag · Add to Chapter · Hide · Delete

Owner, live iPhone, on the old "YOUR UPLOAD" sheet: *"the preview is wrong and the buttons are not arranged properly
to our design template. like how we open inspiration photos but with the buttons for memories. Share, Hide, Delete,
Tag, Add to Chapter."* · *"download means we download the high res and not the preview"* · *"remember to make this a
template. so when we go to user memories and it opens a preview. the same template will show but no need for tagging."*

- **One template** — `app/_components/gallery/photo-viewer.tsx` (`PhotoViewer`), the shared `GalleryLightbox` in a new
  `screen` layout copied from the approved Find inspiration viewer (`carry-2026-10-29/suppliers-final-proto`,
  `drawViewer`): ✕ · "3 of 40 · Papic" · ⋯, the photo as large as the screen allows, ‹ › and a sideways swipe, what it
  is, then ONE row of equal buttons in the thumb zone. Panels (Share · Tag · confirms) rise inside the viewer.
- **The event's Memories** — a tile opens the photo itself (`memories-photo-viewer.tsx`); buttons Share · Tag · Add
  to Chapter · Hide · Delete (controller's logged order, destructive last), each only for whom it was already theirs
  (`lib/memories-viewer.ts`). Hide/Show/Approve and Delete are the shipped actions with their guarantees (kept, not
  deleted · every copy) behind confirms; Report and Stop this guest shooting moved into ⋯ (Apple 1.2).
- **The account's Memories** (`/dashboard/library`) — a frame opens the same template (`memories-wall-viewer.tsx`):
  Share + your own event's door, **no Tag**. A guest's frame no longer opens a bare picture in a new tab.
- **Share = the high-res original** — a photo through the hosts' save route (original, location removed), a clip
  through its kept original; never the grid/screen copy. When the original is gone (Keep full resolution off, past
  6 months) the panel says so in words. A guest's frame shares the copy they were given, and says it is not the original.
- **Tag** — one dispatcher action, `memoriesPhotoTags` (read · add · remove), hosts + the coordinator
  (`memoriesManagerRole`), re-checked on the server: a wrong face-match tag is tombstoned (`removed_by = 'couple'`, never
  re-added by the face match), the right person is added as `manual_pick`; a guest's own "Not me" is never overridden.
  No migration. Server actions stay at 1,225: `dismissGhostBooth` (no caller) un-exported.
- **Add to Chapter** — drawn, but your own chapters have no storage yet: it says "Chapters you make arrive soon".
- Guard: `app/_components/memories/memories-photos-open-in-the-shared-viewer.test.ts`. Baselines regenerated:
  `lib/ugat/screens.generated.json`, `scripts/dup-rule.baseline.txt` (the Tag list's deliberate narrow guests read).

SPEC IMPACT: DECISION_LOG row "MEMORIES PHOTOS OPEN IN THE VIEWER TEMPLATE" (corpus). Own chapters (a photo's chapter)
still need a prototype + schema — unchanged from the 2026-10-30 Memories ⚙ row.
