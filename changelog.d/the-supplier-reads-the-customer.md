## 2026-09-08 · feat(vendor): the supplier reads the customer's event in one summary

Owner, 2026-09-08: *"User name create a (event type) event called (event name)
last (date created) with the following information: Target Date, Pax, Location,
and other details from the onboarding and progress of the build. with X locked
vendors."*

The customer rail now opens with one sentence — *"Ice Casasola created a wedding
called “Cale & Ice” on June 19, 2026."* — followed by **Target date · Pax ·
Location · Locked suppliers**, plus a guest-list row once the couple has started.

**Built from ONE resolve.** `buildCustomerEventSummary` (pure) produces the
sentence and the rows together, and the rail's separate `eventDate` and
`paxLabel` props are DELETED. Two props feeding rows that a third also describes
is how this screen came to show one wedding day three ways.

🪤 **`formatLongDate` was wrong for `created_at`, and the first real event proved
it.** That helper reads the leading `YYYY-MM-DD`, which is correct for a `date`
column and is the **UTC** date for a `timestamptz`. `events.created_at =
2026-06-18 23:24:45+00` is **2026-06-19 07:24 in Manila** — it would have told
the supplier the couple started planning the day before they did. Roughly a
third of every day falls in that window. New `formatLongTimestamp` converts to
Manila first, then reuses the one formatter.

**Reused, not reinvented:** `CONFIRMED_VENDOR_STATUSES` + the locked definition
from `lib/events.ts` (three modules already keep private copies — this is not a
fourth), `articleFor` from `event-words.ts` ("an anniversary"), `eventTypeLabel`,
`formatLongDate`.

⚠ **The agreement ladder is untouched.** Exact venue, address, timeline, seat
plan and dietary stay hard-NULL until an agreement exists — that ladder rests on
"only an agreement earns those", NOT on the retired token wallet, so the
2026-09-08 identity ruling does not reach it. The builder accepts no such field
and a test pins that absence. **Whether "other details from the onboarding" is
meant to include any of them is an owner call, flagged not assumed.**

SPEC IMPACT: None — the identity ruling is already recorded in `DECISION_LOG.md`
(2026-09-08); this is its rendering.
