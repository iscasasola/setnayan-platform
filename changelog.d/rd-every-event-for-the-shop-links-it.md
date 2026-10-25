## 2026-10-22 · feat(create): an event created "for" a shop is the shop's, on every type

Owner, 22 Oct, "yes" to the controller's recommendation: link the shop on every event type created for it.

- A shop's business alaga (`dependents.dependent_kind = 'business'`, written when the shop opens) sits in the create
  picker's "For ▾". Until now the server linked it (`events.honoree_dependent_id`) only on the five life types +
  corporate · gala night and dropped it on every other type — a celebration, a tournament, a trip, a hangout "for"
  the shop was created and never filed under the shop.
- `lib/honoree-dependent-link.ts`: `businessMayBeLinkedOn` (every type except `PERSON_ONLY_TYPES` — exactly what the
  grid offers a business), `honoreeLinkAllowed(type, kind)`, `pickerAsksHonoree`, and ONE server answer for every
  create door, `resolveEventHonoree`. The resolver now reads the record's `dependent_kind` and decides from the ROW,
  never the wire. A person on a widened type is still dropped, label and all; a wedding names nobody; ownership +
  label agreement still required; the one-in-planning cap is untouched (it still keys on `isGatedLifeType`).
- All three create doors call it: the inline form (`create-event/actions.ts`), the wizard
  (`onboarding/_shared/commit-event.ts`, which now also overwrites the label from the server answer) and the
  Get-together (`onboarding/simple/actions.ts`, which carries the "For ▾" answer via `CarriedHonoreeFields`).
- The picker draws "Which business is this for?" on every type offered for a shop; the wizard carries the shop
  silently on types that ask no honoree question.
- Guard `create-event/every-event-for-the-shop-links-it.test.ts`: over the whole type roster + an admin-added type,
  every type offered for a business alaga creates an event with `honoree_dependent_id = that alaga`; people and
  weddings unchanged; all three doors wired. Sabotaged 4 ways, each red.
- Forward only — no backfill of events already created.

SPEC IMPACT: DECISION_LOG.md row 2026-10-22 "AN EVENT CREATED FOR A SHOP IS THE SHOP'S, ON EVERY TYPE" (corpus).
