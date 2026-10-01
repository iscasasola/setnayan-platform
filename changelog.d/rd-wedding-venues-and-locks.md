## 2026-10-01 · feat(onboarding): "We already have our venue" — parish + reception lists, the date chain, and a couple's own venue (Lane 2)

On the wedding onboarding's Area card, **We already have our venue ›** opens a
Parish ▾ (the ceremony venue) and a Reception ▾ (DECISION_LOG 2026-10-01 "WE
ALREADY HAVE OUR VENUE / PICKING A VENUE IN ONBOARDING = A LIST OF WHAT IS FREE
ON THEIR DATES — AND PARISH ↔ RECEPTION CHAIN"):

- each lists the suppliers **not marked busy** on at least one of the couple's
  candidate dates (the engine's own rule, `searchOnboardingReceptionVenues`,
  extended with `role: 'parish'` over the `ceremony_venue` tile, a name search
  and per-venue `freeDates` / pin — no second search, no new server action);
- pick one and the dates narrow to the ones it is free on; the other list is
  then ordered **nearest first with its distance in kilometres**, the rest behind
  "Show farther options ›". **No drive time anywhere** (owner: "don't guess a
  number") — a guard fails if one appears;
- a venue picked from the list is **shortlisted as "considering"** (`event_vendors`,
  category `religious_venue` / `venue`); **the lock stays a Your Team action** —
  onboarding never sends a lock request or takes a booking fee;
- **Add it yourself** (name · city · pin) writes the couple's own venue as a manual
  supplier and **locks it at once** (`contracted`, the same direct lock an
  off-platform supplier gets in Your Team), so the Event Hub's Venue scene reads it.
  The Hub is unchanged: locked venue first, the couple's typed name as the fallback;
- a couple who already has a venue is not asked the Area ▾ (it comes from the venue),
  but is never left without one;
- "I'll pick later" · "My supplier will fill this in" write nothing.

**Migration `20271259075750_couple_own_venue_contact_is_optional`** (owner 2026-10-01:
the contact is optional for a couple's own venue): `event_manual_vendors.contact_person`
and `.contact_number` drop NOT NULL; a value that IS given must still be non-blank.
RLS unchanged (`event_manual_vendors_host_all` governs every column). The "Add manually"
sheet still asks for both for every other supplier. Your Team's contact card says
"No contact yet. Add one so you can reach {name}." for a venue with none.

Also: the false "pre-set things like halal catering" / "pre-set dietary + protocols"
promises are gone from the onboarding shell (and "vendors" → "suppliers" in those lines).

Guards: `lib/onboarding/venue-chain.test.ts`, `tests/db/a-couples-own-venue-needs-no-contact.db.test.ts`,
`tests/db/a-couples-own-venue-is-locked-at-once.db.test.ts` (the exact rows the commit
writes, against the replayed schema) — each sabotage-checked.

SPEC IMPACT: None beyond the DECISION_LOG rows already recorded. Flagged for owner:
the spec said parishes come from the `church_fees` supplier type — in the shipped
taxonomy `church_fees` is a budget line, not a bookable supplier, so parishes come
from the `ceremony_venue` tile and are saved under `religious_venue`.
