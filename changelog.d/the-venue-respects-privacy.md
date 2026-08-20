## 2026-08-20 · fix(event-hub): the 3D venue asks whether the celebration is private — its own comments already claimed it did

`/{slug}/venue` — the guest-facing "explore the venue" room — **never checked the
event's visibility**. Its own file said twice that it did: the header claimed *"all
data + privacy scoping lives in the `public_venue_scene()` RPC"*, and a note further
down called the check *"EARNED"*.

Read out of production **by the object** (`pg_get_functiondef`, not a migration and
not a comment), that routine's only conditions are the address, whether the event
type allows seating, and whether the plan is **published**. `landing_page_visibility`
appears **nowhere** in it — and appeared nowhere in the page either.

**So a couple who set their celebration to private** — whom our own lock screen
promises that only their guests and hosts can see it — **published a seating plan and
served the room, the tables, the booths and which seats are taken to anyone holding
the address.** Guest names and photos still required a valid personal token, so this
was the layout and the occupancy, not the guest list.

⚠ **Nothing was exposed.** Measured 2026-08-20: the only two events with a published
plan are both public, and both private events with an address have no plan. This was
a trap waiting for the first private event to publish one — not a live leak.

🔑 **A SENTENCE IS NOT A MECHANISM**, and this file carried two of them. One pointed
confidently at a **different layer**, which is the most expensive kind: it sends the
next reader somewhere else to be reassured.

🔑 **THE FIX IS THE SHIPPED GATE, NOT A NEW ONE.** `canViewSlugEvent` already backs
the money-gift page and find-seat, and already knows the four ways in — open to
strangers · a redeemed guest session · a signed-in host · an invited account for that
visibility only. A refused viewer is **redirected to the event's own page**, exactly
as find-seat does, so somebody who has not yet redeemed lands where the lock screen
tells them how to get in rather than on a dead 404.

Guard — `lib/the-venue-respects-privacy.test.ts` is written across **all five** guest
doors, not against the one that was broken; the next door added is the one that will
forget. Its door list is a **bill, not a decision**: deleting a line to go green is
deciding a stranger may read a private event. It also asserts it is scanning at least
four real doors, so a route move cannot turn it silently green.

Mutations, each confirmed to have LANDED by occurrence count, all red: removing the
gate (3→2) · dropping the column from the SELECT (1→0) · dead-ending a refused guest
with a 404 (1→0) · a **sibling** door losing its gate (1→0). Baseline green.

🪤 **TWO OF MY OWN MEASUREMENTS WERE WRONG FIRST, AND BOTH ARE THE SAME OLD FAMILY.**
(1) The visibility assertion was **decoration**: it asked whether the file contained
`landing_page_visibility` anywhere, and deleting it from the SELECT left it green,
because the gate call itself names the column when it casts the row. **A file-level
substring cannot say where a name is used** — it now reads the select list.
(2) `[slug]` is a **glob to `git` as well as to a shell**, so
`git checkout -- 'apps/web/app/[slug]/venue/page.tsx'` matched **nothing** and my
restores silently did not happen, compounding mutations on top of each other. Use
`:(literal)`. The pre-mutation commit is the only reason that was recoverable —
**commit before you mutate.**

Full suite 8928 passing, typecheck exit 0, lint clean.

SPEC IMPACT: None — enforces the existing privacy promise on one more surface.
