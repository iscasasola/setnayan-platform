## 2026-10-07 · feat(event-details): Event access is its own fold — Hosts · Coordinator · Helpers · Booked suppliers

Owner, on his phone (2026-10-07), verbatim:
- *"the Event Access is not here: Host: Helper: Vendors: and toggles on what they can access?"*
- *"you placed people with access under Host/MC … they are different"*
- *"no edit. Guestlist (i) toggle. so it is easy to control"* → *"3 way toggle Edit - OFF - View"*
- *"Coordinator Access? Booked Vendor Access? is defined depending on the category they provide for your event."*
- *"Coordinator Access is Same as User Host of the event. so toggle is just yes or no. Always auto YES"* → *"On allows them to edit values inside and create schedules. Off only provides them the initial information they received."*

People with access was drawn inside the collapsed **Guests & money** fold, directly under the last supplier row, so it read as part of that supplier.

- **Its own top-level fold, "Event access"** (`RECORD_GROUPS` gains `access`), after Guests & money and before Put this away. Closed line counted from the real rows (`accessFoldSummary`: "2 hosts · 1 coordinator · 1 helper · 12 suppliers"); a failed read says "Couldn’t load", never 0. The old mount inside Guests & money is gone — exactly one mount. The section's own bordered box is gone (the fold is the tile).
- **Four plain groups** — Hosts · Coordinator · Helpers · Booked suppliers (`ACCESS_GROUPS`). "Add a person" from the guest list stays, under Helpers.
- **Helper areas: one three-way toggle, Edit · Off · View** (Off in the middle), each with an ⓘ saying what the area lets them do (`DELEGATE_AREA_DOES`). Same `setDelegateArea`, same optimistic save, old value back with the reason on refusal. A position the area cannot take (Budget, Photos: never Edit) is disabled; Event Hub and Mood Board (fixed, nothing enforces a level yet) show the toggle disabled at View with an ⓘ saying why. This overrides the "any set of choices is a dropdown" rule for this control only, per the owner.
- **Coordinator: one switch, "Same access as you"**, ⓘ "On — can change details and build the schedule. Off — sees only what you first shared." ON = Guest list · Seat plan · The Day · Suppliers at Edit — exactly the `COORDINATOR_AREAS` grant every coordinator seat is created with, so it is YES by default with no write and no migration. OFF = every settable area Off (their booked-supplier brief and thread are a separate door and stay). Built on the same per-area grant via `setDelegateArea`; no schema, no RLS change. Budget (locked D1) and Photos ("only upon approval", 2026-08-06) are never raised by ON.
- **Booked suppliers: name + category only**, one line that their category sets what they see. The category → access matrix lives only in the corpus (`Feature_Access_By_Vendor_Category_2026-06-12.md` § 7) and scattered SQL gates — no single map in code, so nothing is copied here.
- **Coordinator Remove**: one "Remove…" on the row; the reason dropdown and the Remove button open on their own line beneath it (same `removeHost` form, same reasons).

No reader, action or RLS changed. Guards: `details/event-access-is-its-own-fold.test.ts` (new); `event-details-shows-the-map.test.ts` and `the-record-is-four-folds-on-the-phone.test.ts` moved to the new place.

SPEC IMPACT: None (DECISION_LOG row "EVENT ACCESS IS ITS OWN FOLD — TOGGLES, ONE COORDINATOR SWITCH" records the owner's rulings).
