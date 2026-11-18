## 2026-11-18 · perf(launch): the Hub Maker page stops carrying what it never draws

Speed pass toward the owner's 18 Nov ruling (all loading under 0.7 s). Measured on production that day, the
signed-in Hub Maker (`/dashboard/[eventId]/launch`) shipped 1,062 KB of HTML + RSC with 54 signed R2 addresses.

- **Mood Board Studio is handed only the inspiration parts it draws** (`studioPartsSnapshot` in
  `lib/inspiration-slots.ts`). It was handed all ~300 parts with their services (111 KB of the page) and reads
  them only through `palettePhotoParts` / `libraryPhotoParts`, which reach ~30. Both lists are proven identical
  from the filtered and the full snapshot.
- **Our moving backgrounds are built once on the editor page** (`themeLoops`, `themeLoopPosters` in
  `website/editor/page.tsx`) and handed to the Background panel, the Look sample and the Scene ◆ tiles, instead of
  three hand-built copies (54 signed addresses for 18 files).
- **The desktop top bar's name leaves with the page's first batch** (`deskTitleRead` in `launch/page.tsx`). It needs
  only the host gate and the event type's profile but was awaited alone after every other read. Same read, same gate
  (`makerHasWork`), same null on a failure. Read harness: the page 6 → 5 trips deep, the Maker with its editor
  10 → 9, the tools' lane 13 → 12, still 95 reads. `the-maker-reads-start-together.test.ts` now holds 5 / 9 and
  test 6 (red on main).

Nothing a couple sees or does changes. Guard: `lib/the-studio-is-handed-only-its-parts.test.ts`.

SPEC IMPACT: None
