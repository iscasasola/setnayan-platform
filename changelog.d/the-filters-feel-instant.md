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

## 2026-09-14 · fix(guests): the roster fits the screen it is on

Three reports from the owner's own browser, all one shape — a layout decision
described in more than one place.

**1 · The table rendered on a phone, overlapping its own columns.** Three
classNames described ONE decision ("is this a desktop?") and had drifted: the
seven-column table showed from `sm` (640px), the card grid hid from `sm`, and
the bulk-action bar only appeared at `lg` (1024px). So 640–1023px got the table
AND no bulk actions at all — and `overflow-hidden` made "too narrow" render as
"~Table 3" printed on top of a mobile number instead of a scrollbar.

The component's own directive already said phones AND TABLETS use the
carousel's Customize + Assign sheets, so `lg` is what that sentence always
meant; the table simply never followed it. All three now agree, and the table
carries `overflow-x-auto` so at ANY width it scrolls rather than stacking cells.

🔑 Each class was individually sensible. The SET was wrong — which is why no
test of any one of them could have caught it.

**2 · The name column was too narrow for the name.** Six columns claimed 56%,
leaving the name 96px measured on the owner's screen — "Indalecio Casasola" was
already cut to "Indalecio Casa…" BEFORE full names existed. Shipping the whole
name into an unchanged column would have shown LESS of it than before. Trimmed
the other six to 46% total (their chips are short and fixed-width) and added a
`title` so a name that still cannot fit is recoverable on hover.

**3 · Contact is icons now.** Owner: "contact number should just show icon to
call." A raw `+63…` was the widest string in the row, spent in the column
squeezing the name. Now a `tel:` phone icon and a `mailto:` mail icon — one tap
on a phone, the full value in `title`. Both show when a guest has both; picking
one for the host would be a guess. An em dash still marks "no contact yet",
because a blank cell reads as a rendering failure.

`one-breakpoint-one-decision.test.ts` pins all three. Sabotage-verified:
returning the table to `sm` turns it red, and so does restoring the raw contact
string.

SPEC IMPACT: None.
