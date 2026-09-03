## 2026-09-03 · feat(rail): the Mood Board joins the Studio group, with a public door to open

Owner, looking at the Studio group in the front-door rail: **"i do not see it."**

It was not a bug. `apps/web/lib/studio-rail.ts` records the 2026-08-21 directive
that the Studio group holds the NAMED PRODUCTS while *"the free parts (the seat
plan, the mood board, the day-of page)"* live on the services hub — the "All
services" row that group ends with. So the mood board was reachable at Studio →
All services → Mood Board.

That collided with the older 2026-07-17/18 lock naming the mood board one of six
"always free" first-class doorways that must stay **directly** reachable, and the
collision sharpened once the board became what the paid 3D Plan reads from: the
paid product one tap away, the free tool that makes it worth buying two taps
behind a generic word. The owner resolved it in favour of the older lock —
promote the row. **"All services" is untouched: this is an addition, not a move,**
and `studio-rail.ts` is unchanged.

**The href was resolved, not guessed.** `front-door-invariants.test.ts` already
required every signed-out Studio row to resolve to `app/(shell)/<href>/page.tsx`,
and `railToolsSignedOut()` hands a stranger `StudioApp.href` verbatim — so
pointing the row at the in-event route `/dashboard/[eventId]/studio/mood-board`
was not available: there is no eventId to substitute, and the row would have
404'd for exactly the people a rail row exists to introduce a product to. So
`/mood-board` lands as a public doorway in the same commit, the same shape
`/pakanta` took on 2026-08-21. Signed in with one event the row opens the
couple's own board through `addOnHref('mood-board', …)`; with several it opens
the picker; with none it keeps the page that explains the product.

**Free is configured nowhere in the rail, and that is the finding.** `tier:
'free'` and the absent `serviceKey` live on the `add-ons-catalog.ts` entry, which
is where the Suite grid paints a "Free" pill. `RailTool` is a name, a line, an
href and an optional demo marker — no price, no tier, no lock — so a free row and
a paid row render identically by construction. `studio-apps.test.ts` now asserts
that as a SHAPE comparison rather than the absence of a string, so a price would
have to arrive as a new field and would fail there.

Also in this change, both found by repairing a stale list rather than by looking
for them:

- **`/pakanta` shipped with no `loading.tsx` and nothing said so.** It joined the
  Studio group on 2026-08-21 but was never added to `DOORWAYS` in
  `doorway-shell.test.ts`, so the one guard that checks a doorway's shell
  contract never looked at it. A force-dynamic route without a loading boundary
  prefetches an empty tree (162 bytes, measured), so the Pakanta row was the one
  Studio press that waited on a blank frame. Both missing entries are added and
  the boundary now exists.
- **That guard's own non-vacuity floor was the literal `7`** — a number about the
  size of a list, written where the list cannot reach it. It is now
  `DOORWAYS.length`.

Guards updated to expect the ninth row, never weakened: `studio-apps.test.ts`
(8 → 9, plus two new assertions), `studio-menu-adapts-to-event.test.ts`
(wedding 9→10 · ceremonial 8→9 · simple_event 7→8 · date/hangout/travel 5→6, and
a new per-profile assertion that the row is present in all four — counts alone
would also be satisfied by four different rows),
`doorway-invariants.test.ts` (9 → 10 doorways), `doorway-shell.test.ts`,
`add-to-event-is-the-only-difference.test.ts`. `lib/reserved-slugs.ts` and
`scripts/port-control-baseline.json` regenerated; `/mood-board` added to
`sitemap-static.xml` and to `lib/seo/health-checks.ts`.

Not fixed, surfaced: the `mood-board` catalogue entry is the only free tool
WITHOUT `opensDirect: true` (`seating` and `indoor-blueprint` both carry it —
and `indoor-blueprint`'s own comment claims it "Mirrors the mood-board / seat
plan free-tool pattern", which is false for the mood board). So on the Suite
grid the card's CTA reads "Open board" and its href resolves to
`/dashboard/[id]/studio/about/mood-board`, a learn-more page. Different surface,
owner's call.

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` — a row
recording that the 2026-08-21 rail structure (free parts on the services hub) and
the 2026-07-17/18 free-doorway lock were in direct conflict, and that the owner
resolved it in favour of the older lock for the mood board specifically, without
disturbing "All services" or the other free parts.

## 2026-09-03 · fix(slug-mint): `mood-board` is our page, not a shop's

The new public `/mood-board` doorway made `mood-board` a word the shop-address
mint could still hand out. `lib/reserved-slugs.ts` (generated from route
folders) picked it up automatically; `public.business_slug_is_reserved` does
not regenerate itself, and it is the half that decides at shop registration.
`tests/db/vendor-business-slug-mint.db.test.ts` caught it — the only failing
check on PR #5141.

A shop address is immutable once minted, so a business named "Mood Board"
would have held setnayan.com/mood-board forever. Verified in production
before writing the migration: `business_slug_is_reserved('mood-board')` was
false and zero shops hold it, so this takes nothing from anybody. The function
body was reproduced from `pg_get_functiondef` read out of production, not from
the newest migration file — `CREATE OR REPLACE` silently reverts anything a
reader forgot was in there.

SPEC IMPACT: None — reserving a route word the platform already owns.
