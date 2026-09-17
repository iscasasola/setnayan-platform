## 2026-09-17 · fix(story): the recap's photo wall shows the photos that exist

The recap's "Live Photo Wall" section could never render. It read
`events.photo_wall_photos` — a `jsonb` column with **no writer anywhere in the
application**. Every occurrence in the tree was a read, a column-grant list, a media
sweep, a migration or a comment. It defaults to `'[]'::jsonb`, so the block's own gate
was permanently false and the section was dark for every couple who had paid for
LIVE_WALL.

🔑 **The obvious fix was the wrong one.** An absent writer reads as *"somebody forgot
to build the writer"* — and the capability was two files away under a different noun.
`getWallSnapshot` is the same screened feed (`wall_visible_photos`: moderation plus the
guests' own takedowns) that the venue projector and the day-of guest wall already
render. Writing a second store for "the day's candid photos" would have manufactured a
**rival source of truth for one fact**, and the two would disagree the first time
either was fixed.

- the recap now reads that feed, sliced to the 24 tiles it actually draws so the
  presigning matches the render;
- the paid gate is unchanged — `LIVE_WALL` still decides the section exists, and the
  feed is only asked for once the SKU is owned, so no tiles are signed for a couple who
  never bought the wall;
- a refused feed **hides the section**; it never draws the caption strip over zero
  tiles. A missing recap section is a gap and survives a reload; a wall announcing that
  the day was empty is not.

`photo_wall_photos` stays in the select, now read by nothing, with a comment saying so —
the pair of reads has to stay byte-identical to its fallback. Retiring the column itself
is a migration-sized decision, not this resolver's.

Guarded by `apps/web/lib/the-photo-wall-block-shows-real-photos.test.ts`. Everything in
it is PARSED and it says so: `data.ts` is a `server-only` resolver a unit test cannot
import. Its third assertion is the load-bearing one — **nothing in the app writes that
column** — which fails the day somebody "fixes" the dead column instead of the dead
read. Sabotage-checked four ways with counts printed: the feed read removed · the dead
column restored as the source · a writer added for the column · the entitlement gate
bypassed.

SPEC IMPACT: None.
