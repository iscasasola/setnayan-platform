## 2026-09-30 · feat(event-hub): try first, pay at Apply — three places that locked a free couple out now let them make it

Owner rule (2026-09-29): ◆ marks Pro and never blocks; there are no padlocks; Apply is the gate
("Unlock Pro and Apply"). Three places still met a couple without Event Hub Pro with a lock before
they had made anything:

- **Galleries → Photos you add** (`website/our-photos/page.tsx`) returned an early
  `WebsiteProLock`. Now every couple uploads and sees their gallery; without Pro the form saves to
  the Event Hub draft (`draft=1` — `updateOurPhotos` already screens and drafts), the page marks it
  ◆ and says guests see it after Apply with Pro. The Maker's Apply sheet already names the gallery.
- **Story workroom** (`story/_components/editorial-editor.tsx`): moments, own columns and featured
  guest wishes were `disabled={!isPro}` behind a padlock and an "Unlock Editorial PRO" link. Every
  field is editable now, marked ◆. `saveEditorial` keeps a non-Pro couple's extras in the Event Hub
  draft (new `chapterOverrides` / `customColumns` / `reviews` keys on the draft's `editorial`,
  `lib/post-event-draft.ts`) instead of dropping them — own columns were silently dropped before.
  Apply names each one ("Your moments' names and stories", "Your own columns", "Featured guest
  wishes"), holds it without Pro (a removal is free), and writes it into `event_editorial` with
  Pro. The workroom opens on what the couple wrote. UI copy says "Event Hub Pro"; the separate
  `EDITORIAL_PRO` SKU still exists and still counts (`isEditorialProActive`).
- **Maker · Post Event row** (`website/editor/page.tsx`): `locked: !ownsPro` → `draftedRowLockedIf`,
  like every other row. `EditorialPanel` drops both link-outs ("Open the editor's desk →" and the
  unlock button) — every Post Event scene is already in the scene list.
- One set of story-extra sanitizers (`lib/story-pro-extras.ts`) serves the live save and the draft.
- Guard `lib/nothing-locks-before-apply.test.ts`: a sweep of every couple-side Event Hub source
  (Maker, its pages, the story workroom) for a Pro lock, padlock, Pro-disabled field or the retired
  unlock — with a shrink-only list of the three pages still locking (hero photo, living hero, music
  & video hero; their writers are still live) — plus a seeded property test that, for any story,
  Apply without Pro never writes a Pro extra and never loses one, and with Pro writes them all.

SPEC IMPACT: None — implements the 2026-09-28/29 DECISION_LOG rulings ("try first, pay at Apply";
"◆ never blocks, no padlocks"). Flag for the owner: the `EDITORIAL_PRO` à-la-carte SKU and its buy
page `/studio/editorial-pro` still exist under that name; nothing links to it from the workroom now.
