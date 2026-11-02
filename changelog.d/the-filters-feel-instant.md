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

## 2026-09-14 · fix(guests): a seated guest no longer reads as unseated

`GuestDetailPage.seatRow` selected `event_tables(label)`. There is no `label`
column on `event_tables` — it is `table_label` — so PostgREST answered 42703 and
REFUSED THE WHOLE QUERY on every render. `seatRow` was null every time, and the
warning already sitting three lines below it —

    ⚠ A SEATED GUEST READS AS UNSEATED. `seatedAt` falls to null on a refused
    ⚠ read … and seating is some of the most laborious work in the product.

— was describing live behaviour, not a hypothesis. The sibling read in
`inline-actions.ts` had `table_label` right the whole time; this one never did.

🔑 Found in the PRODUCTION LOGS while chasing an unrelated report. It could not
be found any other way: the read degrades gracefully by design, so the page
returned 200, no test failed, and the only symptom was a seat that was never
drawn. A phantom column is rejected, never thrown.

## 2026-09-14 · feat(guests): Groomsmen and Bridesmaids are separate sections

Owner: "wedding party needs to show groomsmen and bridesmaid as different
groups. Groomsmen will have Bestman as first row … Bridesmaid will have Maid of
Honor and Matron of Honor as first."

The honour attendants join the side they stand with, and ROLE_IMPORTANCE puts
them first WITHIN their group — that ordering is what makes "first row" true,
not a special case. Split consistently across all four places that describe the
same grouping: the roster sections, the VIEW lens, the bulk role picker and the
mind map. A lens that still said "Wedding Party" would filter to a section the
list no longer draws.

⚠ `wedding_party` STAYS in RoleGroup even though no role maps to it now. It is
ALSO a palette key — the mood board, the 3D seating lab, the concept PDF and the
tour gallery all index it by name, and `moodboard-finalization` documents four
finer keys that fall back to it. Removing it broke thirteen call sites at
compile time. The roster sections by the new groups; the palette space keeps its
name.

SPEC IMPACT: None.

## 2026-09-14 · feat(guests): the selection bar says WHO is selected

Owner: "when selecting someone, can we place them persistent? so it will be
easier to see which ones we are selecting?"

The bar said "2 selected" and nothing else. PAIRING is the case that forces the
fix: the two people you pair are usually far apart in a long roster, so the
tinted rows that record your picks are off-screen from each other AND from the
bar. A count cannot be checked against intent; a name can.

Each selected guest now appears as a chip under the controls, and each chip
removes just that one — a wrong pick costs one click instead of "Clear
selection" and starting the hunt over.

A selected guest the current filter hides still renders a chip ("Not in this
view") rather than a blank, because narrowing the lens must never turn part of
your own selection into nothing.

SPEC IMPACT: None.

## 2026-09-14 · fix(guests): the contact icons do not dial — Rule 1 holds

`lib/no-door-out-of-the-app.test.ts` caught the contact icons: a couple-facing
surface may not COMPUTE a `tel:`/`mailto:`. Zero tolerance, no exemption bill,
deliberately — because a couple who phones a SHOP books off-platform: no
booking fee, no in-app record, no price freeze (owner, verbatim 2026-09-10).

A GUEST is not a shop, so the rule's harm model plainly does not reach this
cell. But Rule 1 has no exemption mechanism ON PURPOSE, and carving the first
one is a product decision, not a refactor. The icons stay — they answer the
actual request and free the width that was squeezing the name — but they SHOW
the contact rather than dialling it, with the value in `title` so it can still
be read and copied. Flagged to the owner.

Also: `the-quick-view-is-not-on-phones.test.ts` pinned `sm:block` as a PROXY for
"the table is not on phones", and the table moved to `lg:block`. The proxy went
stale in the SAFE direction — the table is now hidden on MORE screens, so the
quick view reaches phones LESS. Re-pinned to `lg` rather than loosened to "any
breakpoint": a future move DOWN must still fail.

🔑 Both guards were right and neither was noise. One protected a business rule I
was about to break; the other protected an intent whose literal had gone stale.
Telling those apart is the whole job — the first is obeyed, the second updated.

SPEC IMPACT: None — Rule 1 is unchanged. Whether it should exclude guest
contacts is an OPEN OWNER QUESTION, not a decision taken here.

## 2026-09-14 · feat(guests): tap-to-call, billed under an owner-scoped Rule 1

Asked directly whether tap-to-call on a GUEST should be allowed given
`no-door-out-of-the-app` Rule 1, the owner scoped the rule: **"only for the
couple and if coordinator is given access."**

Rule 1 had NO bill until today, deliberately — zero tolerance so nobody could
argue a case into an exemption. It has one now because the OWNER scoped it, not
because a case was argued. `GUEST_CONTACT_BILL` follows the exact shape of the
file's other two bills: one line, a count, a reason, exact in both directions.

The distinction the rule could not previously express: it stops a couple
reaching a SHOP outside the app, because the booking fee is charged on sourced
clients. A wedding guest is not a shop — no fee, no in-app booking to protect,
and the couple typed the number in themselves.

⚠ THE SCOPE IS ACCESS, NOT SUBJECT. The billed file renders only inside
`/dashboard/[eventId]/guests`, already gated by `guest_list` access
(`resolveAreaLevel`, lib/delegate-areas.ts) — a coordinator without that grant
never reaches it. A public or guest-facing surface printing the same field is
still Rule 1 and still fails.

Sabotage-verified BOTH directions: a third contact link in the billed file turns
it red, and the same link added to a public page turns it red.

🔑 OPEN, NOT DONE — "coordinators will only have access until event day. but no
access after." That is NOT BUILT, and not by this PR. Access in this codebase
has NO time component anywhere: `resolveAreaLevel` has 38 call sites and none
of them consults a date; `invitation_expires_at` expires the INVITE, not the
access. Expiring a coordinator on event day is a platform-wide change to every
area they hold — guest list, seat plan, schedule, suppliers, invitations — not
a contact-link concern, and it belongs in its own PR.

SPEC IMPACT: Rule 1 is now scoped by owner ruling 2026-09-14 — recorded in
GUEST_CONTACT_BILL's docblock with his verbatim words.

## 2026-09-14 · fix(guests): the VIEW lenses fit the event, not just the wedding

Owner: "this guestlist works for weddings. but does not apply to other events."

`viewFiltersFor` only ever asked Muslim-or-Catholic. It never asked whether the
event was a WEDDING at all — so a birthday, whose role set offers
guest/host/vip/family/helper and nothing else, was still offered "Groomsmen",
"Principal Sponsors", "Bearers & Flower Girl" and "Officiants & Readers". Every
one filtered to an empty roster, because no birthday guest can hold those roles.
Four dead controls on a live page.

🔑 DERIVED, NOT HAND-LISTED. A lens now survives only if the event's own
`offeredRoles` contains a role in its group. A hand-kept "wedding-only" set is
exactly what produced this, and a second one would reproduce it — this way a
future event type gets the right lenses the day it is added, with nobody
editing a list.

This was PRE-EXISTING, not introduced by the Groomsmen/Bridesmaids split — the
split just made it four wrong lenses instead of three.

`the-lenses-fit-the-event.test.ts` pins it, including a vacuity check: a
derivation over an empty role list would pass every other assertion forever.

SPEC IMPACT: None.
