## 2026-10-29 · feat(suppliers): Find — one list per category, every service's cards share its spot

Owner rulings 29 Oct (Find v4 approved, then v4.3 → v4.8 the same evening). In an open category on Suppliers ›
Find, ROW 2 ("More to compare") is now ONE list of service CARDS — every card of every service in the category —
instead of one card per supplier. ROW 1 (the couple's own picks) is unchanged, and a supplier there is never repeated
below (`excludeBenchVendors`, as before).

- **Never a card that is not free on the event's date(s).** One date → free that day; a month or date choices → free
  on at least one. The booking path's own per-card refusals (`service_cards_unbookable_on`, new reader
  `readCardRefusals` in `lib/bench-bookable-days.server.ts`). Unreadable → the list says "We couldn't check who's free
  on your date — every card is shown." with Try again (never a silent all / none).
- **✎ Services to show** on the open row (it pins with the head): a sheet of only the services that HAVE cards, each
  with its count; ticks are a draft — the list changes only on **Done**; "Tick all"; any other close discards. The
  row then reads "✎ 2 of 4". A typed service name (≥ 3 letters) in the open category ticks only that service.
- **A shop stays together**: its first card in full, its others tucked under it as "also <Service> · <card>" with
  their own price and Save (the Save now records THAT card — `service_id`, honoured only for the shop's own active
  card in the category). "Show 20 more" never splits a shop. Cards name their service while more than one shows.
- **Count line** in cards: "Showing 20 of 35 cards · All 4 services · free on Dec 18" (+ "Filters · N · Clear").
- **⇅ in the thumb row** (the shared `ThumbMenu` + Guests' `FilterFace`): Sort (the bench's own sort — moved here
  from the list head) · Price (the category's own thirds) · Rating. Style is not offered: no card carries a style yet.
- **Nearest to the venue first** by default when the event has a venue to measure from (the shipped 'near' lens).
- **Best for your event** — up to ten, PERFORMERS ONLY: suppliers with ≥ 1 vetted completed Setnayan event
  (`vendor_public_completed_events_stats`, the anti-fraud count behind the Most Booked badge). None → no strip;
  unreadable → said.
- **Go to a category**: a row of the thumb row's empty-box category list that is on the page now opens HERE (the
  open one folds, that one lands pinned) instead of leaving for the Find page.
- The open row hides its "In your plan" / "Booked ✓" word.

Labels are admin-managed (`canonical_service_schemas.display_name_en`, `lib/service-labels.ts`). Pure rules in
`lib/find-service-cards.ts` (executed by `find-service-cards.test.ts`). One read per category open, as before
(`fetchInlineMoreRow`); the ✎, ⇅ and "Show 20 more" ask nothing. No migration. +0 exported server actions.

SPEC IMPACT: Suppliers › Find (owner rulings 29 Oct, recorded by the controller in
`carry-2026-10-29/OWNER-NOTES-SUPPLIER-FINAL-CHECK.md` notes 26–46 and the `find-scale-proto` v4.2–v4.8 prototype).
A DECISION_LOG row "FIND v4 — ONE LIST PER CATEGORY" is the controller's to write once the owner settles the two open
questions in the PR (Inspiration switch vs carousel; "Nearest to <place>" wording).
