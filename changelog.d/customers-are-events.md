## 2026-10-30 · fix(supplier-customers): Customers' first section is Events — one row per event, its hosts inside

Owner, on the live supplier dashboard: *"supplier dashboard>Customers still show people and not events"* — against the
2026-10-29 ruling "CUSTOMERS ARE EVENTS, NOT PEOPLE" and the approved v13 prototype. PR #7059 had already made the list
one row per event and made each row open to the event's fixed lines; what still read as people was the WORDS: the menu
said **People ▾**, each row was titled with one person's first name ("Indalecio's Wedding (Dec 18)") and repeated the
couple on the line under it, the search said "Search customers", and an opened row's Hosted by gave names with no role.

- **The section is Events.** `customers/segments.ts`: `CUSTOMER_SEGMENTS = events · dates · money` ("Events" on the
  phone picker and on the bar's page menu ▾). QR is not added — it ships as its own page (`/vendor-dashboard/invite`,
  reached from Dates); making it a Customers section is the S4 build.
- **The old address still lands.** `?seg=people` forwards to `/vendor-dashboard/customers` with every other param kept
  (`oldPeopleAddressForward`, called first in the page); `customersSegmentOf` reads it as Events meanwhile. Every caller
  that wrote it now writes Events: the Messages landing (`anchors.ts`), the chat's ‹ home (`lib/page-home.ts`), the
  outside-booking Add / Remove return (`return_to=events`, `calendar/actions.ts` — still accepts `people` from a form
  already open), the Customers ⚙ return, the dev lab's view links. The bottom bar and Today's links already point at the
  bare hub, which IS Events.
- **A row is the event.** `eventRowTitle` (`lib/event-chat-title.ts`): "Indalecio & Claire · Wedding · Dec 18" — the
  event's whole name · kind · day, the day from the chat title's own formatter. A host with two events is two rows. The
  line under it says what the event wants and where it stands — "Asks for Styling · ~40 guests · asked today", or
  "Coordinator / Planner + Styling · ₱65,000 · ₱25,000 paid · next ₱20,000 Nov 18" — never the couple again. The chat
  keeps its own 2026-10-28 words ("User's event (date)").
- **Price · paid · next.** `computeEventMoneyPositions` now also returns `nextDue` (the earliest unconfirmed installment
  with an amount); a booked row says it. An unread payday still says "couldn't load" first.
- **Headed EVENTS ⓘ**, search "Search events", found line and pager count events, empty lines say events.
- **Hosted by, with roles + the booked coordinator** (ruling "THE OPENED EVENT ROW SHOWS A FIXED SET OF LINES"): each
  host (the couple and every co-host — live co-hosts are `couple` members) carries Bride / Groom / Celebrant (in the
  couple's own word when renamed), Co-host (their seat), or Host (made the event); the booked coordinator joins — "You ·
  Coordinator" when it is this shop. Two more reads in the existing second round (`guests` roles, `event_moderators`
  seats); a refused role read drops the word, never the names.
- The row's line may take two lines (opt-in `lineWrap` on `Fold` / `SupplierOpenRow`, Customers rows only) so the money is
  never cut to "…" on a phone, as v13 draws it.
- Tour copy (`vendor_people_v1` keeps its key — it is the seen-mark suppliers already hold) says Events ▾.
- Dev lab: `/dev/supplier-lab?s=events` draws the approved v13's own five events (Indalecio & Claire twice).

Doors kept as four (Asking · Talking · Booked · Done) per the build brief; v13 and the 29 Oct pinned-row ruling show three
(Asking · Booked · Done) — flagged for the owner, not changed.

No migration · no new server action · no new table.

SPEC IMPACT: None — implements the 2026-10-29 DECISION_LOG rows "CUSTOMERS ARE EVENTS, NOT PEOPLE" and "SUPPLIER ›
CUSTOMERS › EVENTS — THE OPENED EVENT ROW SHOWS A FIXED SET OF LINES" as written; no ruling changed.
