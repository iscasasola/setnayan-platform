## 2026-11-12 · feat(forms): view first · an edit saves a new form with the event · "Also keep in my library" · the couple's one "Forms from <shop>" list (Piece 3a)

Piece 3 of the negotiation-chat redesign (DECISION_LOG 2026-11-12 "A FORM IS VIEWED BEFORE IT IS EDITED OR SENT; AN EDIT
SAVES A NEW FORM", "FORMS, OFFERS AND BUNDLES HAVE NO PLAN LIMIT", "FILES · HUB · FORMS DESIGN APPROVED" calls 3 + 5;
prototype `Build_Files_Hub_Forms_2026-11-12/quote-maker-polish.html` legend rows 137 · 146 · 147).

- **Schema** (`20271340142149_an_edited_form_stays_with_its_event`): `vendor_forms` gains `for_event_id`,
  `edited_from_form_id`, `in_library` (TRUE for every existing row). Three triggers: an event-only form is sent only into
  its own event (the on-booking service-role lane included), links to no service card, and a library form leaves the
  library only by retiring. No new table, RLS unchanged.
- **Supplier · client › Forms**: a library form opens READ-ONLY first (`FormViewSheet` — its lines as the couple sees
  them · Edit · Send to chat / "Sent · 4 Nov"). Edit opens the Form Maker on a COPY "… · for <couple>" — "Save for
  <couple>" + "Also keep in my library" (off by default); the original and anything already sent stay as they were.
  New section "This event's forms · N"; an event-only form offers "Save to my library · reuse with other clients"
  (op `keep`). Sent forms read Open · Answered N of M · All answered · Final (the shipped `event_form_sends.locked`).
- **Couple · picked supplier › Forms**: ONE "Forms from <shop> · N" list heads the sections, open ones first, each with
  its state; the privacy line sits behind its (i). No cap on forms per event.
- Shop › Makers' library edit is unchanged (edits in place there, as shipped).
- Guards: `tests/db/an-edited-form-stays-with-its-event.db.test.ts` (8) · `lib/an-edited-form-stays-with-its-event.test.ts` (6) · Ugat J62 claims the three columns.
- Dev lab: `/dev/forms-lab?m=view` · `?m=edit` · `?m=couple-list`.

SPEC IMPACT: None
