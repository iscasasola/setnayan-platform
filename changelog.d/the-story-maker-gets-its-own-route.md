## 2026-09-09 · refactor(story): the Story Maker moves to /dashboard/[eventId]/story

Build order `08` step **1.1**. "Editorial" is retired from customer language: the
surface is **the story** and the tool is **the Story Maker**. The route follows —
`/dashboard/[eventId]/website/editorial` → `/dashboard/[eventId]/story`.

* The three route files move (`page.tsx`, `actions.ts`,
  `_components/editorial-editor.tsx`); a **redirect stub stays behind** at the old
  path so bookmarks, the library tab's deep link and every already-written
  `admin/editorial-review` notification `relatedUrl` still resolve.
* The stub is deliberately NOT a `next.config.ts` redirect: `website/page.tsx`'s
  docblock states "EVERY `/website/<child>` KEEPS ITS ROUTE" and
  `one-event-hub-door.test.ts` asserts each child's `page.tsx` exists on disk. A
  config redirect would delete the directory and fail that guard.
* Twelve live-code references repointed, including **both `revalidatePath` calls
  inside the route's own `actions.ts`** — miss those and saving the story stops
  refreshing the page it was saved from.
* `event-hub-control.ts`'s `ctaPath` and the **Untold shelf's `storyHref`** now
  point at `/story`. The shelf's own words are untouched — they were already
  right, and `two-levels-and-the-board.test.ts` asserts the retired
  "Write the story of" chip does not come back.
* Fifteen guards/tests that pinned the old path updated to pin the new one — the
  property each one tests is unchanged. Three were easy to miss: the **escaped**
  regexes in `two-levels-and-the-board.test.ts`, the bare `'editorial'` entry in
  `one-event-hub-door.test.ts`'s hand-listed `CHILDREN`, and the relative-import
  guard in `channel-four-opens-a-workroom.test.ts` (now `../story/_components/…`,
  since `story/` is a SIBLING of `launch/` — left as `./story/…` it would have
  been a `doesNotMatch` on a path that can never occur, i.e. decoration).

The customer-facing WORD ("Editorial" in the rail and the masthead) is not
changed here; it changes in the desk PR, where the surface it names is built.

SPEC IMPACT: None — `02_The_Story_Maker.md` already specifies this rename and the
route it names is now the one that ships.
