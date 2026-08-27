## 2026-08-28 · feat(event-hub): the supplier's desk has a whole life, not thirty hours

Session `hub2`. The desk a booked supplier opens on the celebration's own page
shipped on 2026-08-27 (#4919) and lived from the day itself until 06:00 the
morning after — **about thirty hours of a booking's life.** Every other day of
the year the same strip was a one-line link out.

The binding design's own strongest sentence is against that, and it is quoted in
the code now: *"a day-only room recreates exactly the midnight-door mistake this
product has already paid once to learn."* The venue's address and the call time
are communicated in the **weeks before**; confirming a shot landed happens the
morning **after**.

**RULE 0 — nothing on the desk was rebuilt.** The venue plate, the running order
with the organiser's private cues marked, the headcount, the tools and the way
out are the same components, in the same order, reading the same way. What
changed is *when* the door is open and *what each piece is able to say* on a day
it cannot yet speak for.

### Four states, one shape

* **Call sheet** — booked, the day ahead. The date and **"43 days to go"**, the
  venue once the organiser sets it, the running order once they write it, the
  headcount so far marked *not settled*, the console link pointing at that
  booking's own setup view, and **Message the couple** — the conversation they
  already have, never a new one (the design refuses a third channel outright).
* **Today** — byte-for-byte what S3 shipped. Frozen by a test that names its
  four sentences.
* **Look back** — the week after. The day as it ran, with the lines the floor
  actually advanced marked, and the honest alternative when nobody advanced
  anything.
* **Long after** — one quiet line. **A supplier's past work is their portfolio,**
  so the door goes quiet rather than shutting.

🔒 **A PIECE THAT CANNOT BE TRUE YET SAYS SO — it never vanishes.** The "Where"
plate used to disappear entirely when no venue was set; a room that loses panels
as the calendar moves reads as broken rather than as early.

### What did NOT widen

🔒 **The read.** Same brief, same booked-stage gate, same run-of-show read under
the **caller's own cookie session** — there is still no `createAdminClient` in
that loader, and the guard still asserts it. A supplier three months out sees
exactly what a supplier on the day sees, **because the database was always
willing to tell them**: `get_vendor_event_brief` has no date gate and neither
does `event_schedule_blocks_booked_vendor_read` (both read out of production
2026-08-28). Only this surface was shut.

🔒 **Who may open it.** `VendorCapability` is still the OUTER gate and is
untouched. Widening the window moved the DATE gate and nothing else. An
anonymous visitor, a guest, and a supplier who was only *asked* still render the
page with no desk and no trace one exists.

### Two traps this could have walked into

* **The live now/next header is gated on the day itself**, not merely on there
  being a programme. Those blocks store the venue's **wall clock**, not an
  instant — pointed at a celebration months out it counts down to a time on the
  wrong day. The same slot carries the countdown before the day, which is what
  the design asks for there anyway.
* **The countdown counts calendar days AT THE VENUE**, never a subtraction of
  instants. `new Date('2026-12-12')` is the 11th west of Greenwich — the family
  that once printed the wrong day on 41 screens. A test proves the zone moves
  the answer.

🔑 **ONE derivation of "when is it over", not two.** `morningAfterInstantMs` was
extracted out of `getMenuLifecyclePhase` and is now read by both the live desk's
closing edge and the look-back's opening edge, so the two states cannot overlap
and cannot leave a gap at 7 a.m. — the hour a photographer checks what they
shot. A second copy of that arithmetic is how the bottom nav once disagreed with
the surface it pointed at by 36 hours.

### Measured

* **Inert in production today.** Exactly one `event_vendors` row carries a
  marketplace shop, and it is the seeded `SONGDESK TEST` fixture on an event with
  **no slug** — so no page exists to render it on. Zero real shop bookings exist.
* **10,603 unit tests green** (`test:unit`, exit 0) and a clean typecheck.
* **12 mutations, every one measured by occurrence count before → after, all 12
  red.** Two of them reported "did not land" on the first count because the
  replacement text *contained* the needle — re-measured against the landing
  marker instead, which is the only honest way to read that number.

⏭ **NAMED, NOT BUILT, and both are in the design:** the bridge between two
celebrations on one day (§ E — it needs the shop's OTHER bookings, which today
can only be read with the service role, so it wants a `SECURITY DEFINER`
function scoped to the caller rather than an admin read inside this page), and
the room surviving a weak-signal venue (§ H, its own project).

SPEC IMPACT: `EVENT_HUB_UNISON_2026-08-28.md` § 6 gap 3 ("the supplier's desk is
day-of only") and gap 5 (the after-the-day surfaces) are closed; a
`DECISION_LOG.md` row is appended in the spec corpus.

---

## 2026-08-28 · fix(event-hub): a supplier never sits through a film to get to work

The call sheet above opens months before the day — and **months before the day
is exactly when the celebration's page is the Save-the-Date film**: `fixed
inset-0 z-[50]`, with the reveal veil above it at z-[60]. The supplier's strip
renders in ordinary document flow underneath both. So a booked photographer
signing in to check the address got a wedding film and **no visible way to their
own call sheet**, for every one of the ~9 months a booking spends more than 90
days out. Shipping the call sheet without this would have been a fix nobody can
reach — three times now in this project.

The binding design puts the door above the film for exactly this reason:
*"a ribbon there sits above everything, including the save-the-date film that
today paints the supplier's only strip out of sight for months."*

**RULE 0 — both halves were already solved on this page.**

* **The chrome is the host's.** `owner-ribbon.tsx` is the same idea for the host
  on the same page, and its docblock had already worked out the hard part:
  `sticky top-0 z-[90]` *"clears the Save-the-Date stack (film z-50/70, reveal
  z-60, touch glow z-80)."* Same stack, same answer, same materials.
* **The way out of the film is the film's own.** The button dispatches
  `STD_FILM_EXIT_EVENT` — the event `StdFilmHandoff` already listens for, and
  which `reveal-overlay.tsx` also listens for **so the veil retires with it**.
  The film is a PAID product: it is lifted, never spent, and *"Watch our film"*
  still brings both back.

It mounts in that one phase only — everywhere else the strip below already IS
the top of the page for a supplier — and it carries nothing that would have
needed a second gate: the trading name from the capability the server proved,
and the countdown the desk model already resolved under the supplier's own
session. A guard pins its prop list, so a fourth prop has to be argued for.

🪤 **AND THE GUARD READS THE STACK'S OWN NUMBERS RATHER THAN A REMEMBERED ONE.**
A hardcoded `> 70` keeps passing on the day somebody raises the film. It scans
the six takeover components for their `z-[n]`, takes the maximum, and fails if
the ribbon is not strictly above it — with a floor so an extractor that stops
matching cannot pass everything by finding nothing.

🚨 **A THIRD GUARD CAUGHT A REAL PROBLEM IN THE FIRST HALF OF THIS BRANCH, AND
IT WAS RIGHT TO.** Folding the day's console link and the call sheet's setup
link into one computed `href` made `lint-port-no-lost-controls` report that
`/{slug}` had LOST `/vendor-dashboard/on-the-day` — its extractor matches `href`
followed by a **literal**, so a ternary is invisible to it. The tempting fix is
to regenerate the baseline, which would have **recorded a removal that had not
happened**. Instead both tiles are now one small component each call site hands
a literal href, which is shorter code and leaves the guard able to see both.

🪤 **AND MY OWN FIRST MUTATION RUN LIED IN A NEW WAY.** Sabotaging `z-[90]` →
`z-[55]` reported the marker landing 0 → 1 and the guard staying **green** — a
decorative guard, seemingly. It was not: the first `z-[90]` in that file is in
the **docblock**, the guard strips comments before matching, and the className
was untouched. Re-run against the className, it goes red. *An occurrence count
proves a sabotage landed somewhere, not that it landed where you aimed.*

**6 mutations on this half, all measured, all red.**

SPEC IMPACT: None beyond the row above — same feature, made reachable.
