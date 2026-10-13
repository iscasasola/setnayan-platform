## 2026-10-12 · feat(maker): the last three sample blocks get a real look — Announcements, What to wear, Live hub

Owner's go (2026-10-12): the Event Hub's "sample blocks" become editable in the new Maker like Your seat and the
Digital pass. The fourth of the brief, **Photos of you (animate only)**, was already on main (`c69b073f91`, via #6475)
and is not rebuilt. Each look is kept in `events.style_preferences.block_looks` (no migration), drawn through the
one strict reader in `lib/block-looks.ts`, saved to the draft, live on Apply. A guest's page with nothing kept is the
same bytes (`lib/site-body-fixture.golden.html` and the stranger golden are not regenerated).

**Announcements** (`f:announcements`) — Background (None · Plain · Frosted) and Animate.

- Each guest's own is `DayOfAnnouncement`, drawn by the guest tree's LAYOUT (`app/[slug]/layout.tsx`), not by
  `SiteBody`. The layout now puts the block's own style and hidden mark right before its root
  (`app/[slug]/_components/announcement-look.tsx`), only when a look is kept — from the column it already reads.
- The ground lands on the one card inside the `<aside>` (Banner · Notice) or, for the Line, on the block itself.
  The day's Notice is the ink card (light words on dark): no rule reaches it, as with Photos of you.
- On the day the block rides stuck to the top of the screen; while it does, nothing that follows the scroll plays
  (a Build out would hold the coordinator's words half gone). It is never in a chapter, so a timed Build in plays
  as it is drawn.
- The canvas's sample tags its card shape (`data-sample-card`) so the same rules dress it.

**What to wear** (`f:look`) — Background and Animate.

- Each guest's own is the dress code's "you" panel (`DressCodeWidget` `part="you"` on Welcome, `part="wear"` in
  Me — one or the other). The mark is handed to the widget, which draws it right before its root only when it draws
  (a guest with nothing personal: no panel, no mark). Bare, like the March: the block itself takes the paper or glass.

**Live hub** (`f:live_hub`) — Animate only.

- Both its pieces are dark cards (the wall is the gallery's `sn-gal`, the player the ink card), so — the Photos of
  you reason — it takes no Background. One mark before the arrangement (Theatre · Wall first), or before each piece
  of Player and wall. **No wrapper**: on a guest's page the run of show stands between the stream and the wall, and
  a wrapper would move the wall for every guest. The wall opens a photo inside itself, so what keeps moving stands
  still while one is open.

`BLOCK_SAMPLE_WHY` is now empty — no part of the canvas is a sample. `stage-tools.tsx` is not edited (its pinned
`ownTool` line already gives a motion-only block Animate alone). Nothing added to the Maker's first load.

Guards: `lib/a-fixed-block-has-its-own-motion.test.ts`, `lib/a-fixed-block-has-its-own-background.test.ts` (re-aimed,
dated notes), `lib/a-sample-block-look-reaches-the-real-page.test.ts` (real page, byte-for-byte, per block).

SPEC IMPACT: None to the locked docs — this is the build of the 2026-10-10 hand-off's §A item 4. Two builder calls
are for the owner: the Live hub is Animate-only (same reason as his "animate only" for Photos of you), and the day's
ink Notice keeps its own card under any Background.
