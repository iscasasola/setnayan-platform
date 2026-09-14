## 2026-09-14 · perf(guests): facet pills warm their payload before the click

Owner: "clicking here takes a lot of time to show."

**Measured before changing anything.** The roster query runs in **1.2 ms**
(`explain analyze` against prod, 92 rows) — so essentially none of that wait is
the database. Every facet is a `<Link>`, so a click is a full server
navigation: auth, five parallel reads, the JavaScript filter, an RSC render,
the transfer.

🔑 **AND THE ROUND TRIP RECOMPUTES NOTHING NEW.** No facet reaches SQL — the
page fetches the identical roster on every click and filters it in JavaScript
(`page.tsx` passes only the filtered subset to the client). The click pays for
a render of data that did not change.

This ships the cheap half of the fix: the pills warm their RSC payload on
HOVER and FOCUS, so the click lands on a cache. The reach for the pill — the
pointer travel plus the decision — is the budget the fetch spends.

**Why hover and not `<Link prefetch>`:** on a dynamic route, `prefetch` warms
when the link enters the VIEWPORT, and every pill is on screen at once (Side,
RSVP, seven views, every group, every tag). That is ~25 full page renders per
load, competing with the very paint the host is waiting for. Making the first
render slower to make a later click faster is the wrong trade, so
`prefetch={false}` is explicit and guarded.

`LensPill` moved out of the server page into `_components/lens-pill.tsx` as a
client component, because a server component cannot prefetch. Group chips got
the same treatment in `groups-sidebar.tsx` (already a client component). Both
skip the pill/group already applied — its href is the page you are standing on.

`facets-warm-on-hover.test.ts` guards both halves. Sabotage-verified: removing
the hover warm turns it red, and so does flipping `prefetch` back to true.

**NOT the structural fix, and deliberately labelled as such.** The real answer
is to filter on the client and stop navigating at all: the server already holds
every guest and the filter is one pure `filter()` + `filterByRoleGroup()` +
`sort()`. That is a larger refactor of the page and is not in this PR.

SPEC IMPACT: None.
