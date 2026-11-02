## 2026-09-23 · fix(shell): the rail reaches the bottom, and the press commits now

Owner, watching the live site: *"there are menu links that do not load. there
are moments when the whole page disappears because everything is being
reloaded"*, *"times when the sidebar has a line and most does not have a
border"*, and *"also times when the sidebar does not fill the whole left side"*.
Three complaints, measured live, and they were not three bugs.

**The rail's clamp had only one jaw.** `.fd-rail` set
`max-height: calc(100vh - var(--fd-bar))`, which held it down on a long page.
Nothing held it up on a short one — `.fd-body` is a grid whose row is sized by
its tallest item, so on a short page the rail took the CONTENT column's height
and the cream plus the `border-right` hairline stopped partway down the screen.
Measured on `/dashboard/samahan` in a 1204px window: content 549px, rail 549px,
**594px of left column painted with nothing**, border reaching 51% of the way
down. It tracked page length exactly (`/dashboard` 1143 = full · `library` 984 ·
`people` 896 · `samahan` 549), which is why it read as an intermittent border
rather than a missing one — a short border does not look like a bug, it looks
like a design. `.fd[data-chrome='app'] .fd-rail` now sets the matching
`min-height`.

Below 1024 the same rail is the hamburger drawer, and the owner's follow-up —
*"this also applies to the hamburger menu on mobile view, since it serves the
same purpose"* — is right in principle and already true in pixels: measured
live on a 375x812 viewport, the open drawer is 280x812 with `gapBelow: 0`,
because it is `position: fixed; top: 0; bottom: 0` and its height comes from the
viewport rather than from its content. That surface therefore never had the
defect. It shipped for one commit here as `min-height: 0`, which was wrong as a
STATEMENT even while being right in pixels — "no floor here" is the desktop
defect's premise, not its fix, and it would have let the drawer collapse to its
content the day someone dropped one of those two anchors. It now reads
`min-height: 100dvh`: the full viewport, which is what `top: 0; bottom: 0`
already means. `dvh` and not `vh`, because on a phone `100vh` is the viewport at
its tallest and a `vh` floor runs the drawer under the browser's own chrome. The
two floors deliberately differ — the desktop rail starts BELOW the bar, the
drawer starts at the TOP of the screen — and a guard asserts they never get
tidied into one value.

Verified by injecting the exact declaration into the live page and measuring:
rail 549 → 1143, unpainted 594 → **0**, border 51% → **100%**, and `docH` 1204
in both states — **no scrollbar introduced**, which was checked rather than
assumed (`.fd` has exactly two children and `.app-surface` already carries
`min-height: 100dvh`, so the row lands exactly on height already reserved).

**The links loaded; they just gave no sign of it.** Timing `history.pushState`
against the click on the live site: `/guest-list` 380ms, `/marketplace` 431ms,
`/budget` 559ms, `/dashboard` **1445ms** — no URL change, no spinner, no paint
in between. Every one of those routes shipped without a `loading.tsx`; every
route that felt instant had one. With no boundary the router has nothing to
show, so it holds the page you are leaving. `(shell)/explore/loading.tsx` had
already measured the mechanism: dynamic with no boundary prefetches **162
bytes** — nothing — against 58,473 with one. Boundaries added to eight routes
(`budget`, `guest-list`, `marketplace`, `samahan`, `schedule`, `seat-plan`,
`web-only`, `dashboard/(launcher)`), each returning `null` because the shell is
already on screen and a skeleton would paint a second set of furniture inside
the first.

Guarded by `app/_components/frontdoor/the-rail-reaches-the-bottom.test.ts` and
`app/(shell)/the-press-commits-now.test.ts`. Both were sabotaged in ten
directions before being trusted — and the sabotage run earned its keep: the
soft-404 inverse check was scoped to the rail's two route groups, where ZERO
routes qualify, so it was **passing against an empty set**. It now walks the
whole tree and asserts that `app/v/[slug]` — the route the rule was written for
— is inside the set it inspects. Four pre-existing crawlable `notFound()` routes
under a boundary (all single-use token/invite URLs, linked from nowhere) are
carried as a named baseline with a rot check that fails if any stops qualifying.

Both guards first shipped with their own comment-stripping regex and would have
FAILED CI: `scripts/lint-one-comment-stripper.mjs` flagged both, and its baseline
("a debt, not a decision") may only shrink. They now use `stripComments` from
`lib/strip-comments.ts` — which blanks comments to SPACES rather than deleting
them, so the stripped text is the same length as the source. That length
identity briefly read as "the stripper did nothing to a CSS file"; it is instead
what makes the index-walking helpers in the rail guard correct. Proven by a
sabotage that deletes the declaration from the code and writes it into a comment
instead: the guard still fails, so prose cannot satisfy it.

**NOT FIXED, AND DELIBERATELY NOT ATTEMPTED HERE:** the chrome is still torn
down and rebuilt when you cross a route-group boundary. Measured by stamping
the DOM nodes: the bar and rail survive *within* a group
(`/dashboard/people` → `/dashboard/samahan`) and are rebuilt *across* one
(`/dashboard` → `/marketplace`, and `/marketplace` → `/` even though the chrome
is identical on both sides). No browser reload ever happens — `pageId` never
changed — so this is a remount, not the reload it looks like. Cause:
`AppRailShell` is mounted by four sibling layouts (`(shell)/layout.tsx`,
`dashboard/(account)/layout.tsx`, `dashboard/[eventId]/layout.tsx`,
`admin/layout.tsx`) plus `front-door.tsx`, and siblings cannot persist across
each other. The 2026-08-15 `one-shell-mount` fix moved the mount from `page.tsx`
into a layout, which cured this *inside* each group; it cannot cure it
*between* groups. Hoisting into `app/dashboard/layout.tsx` is blocked on a hard
App Router constraint — **a parent layout does not receive a child segment's
dynamic params**, so it cannot read `params.eventId`, and every one of
`[eventId]`'s ~80 lines of shell props is event-scoped. That is a rewrite of how
the event shell is fed, not a hoist, and it belongs in its own PR.

SPEC IMPACT: None. No decision, price, schema or locked claim moves — the rail's
floor and the loading boundaries are both implementations of behaviour the
corpus already assumes (one shell, navigation that does not reload).
