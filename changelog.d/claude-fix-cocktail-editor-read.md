## 2026-11-14 · fix(supplier): RW-285c — the client page stops asking the cocktail editor when it can't open

- **RW-285c (live fault)** Admin › Problems logged "Saving the supplier cocktail editor — could not save" 62× in a day.
  `get_vendor_cocktail_editor` refuses, by design and as an access error (42501), whenever the shop is not booked
  (`not_booked`), the booking fee is not settled (`fee_unsettled`) or the couple has not opened the cocktail area to
  suppliers (`vendor_edit_off`). The supplier's client page asked it on EVERY client visit, inquiries included, so each
  of those ordinary "no editor here" answers was recorded as a refused write. It is now asked only when the shop is
  booked, the fee is settled and the event's floor plan has the cocktail area open to suppliers; otherwise the page
  already knows the answer (no editor) and asks nothing. The "Arrange the cocktail area" door and its page are
  unchanged. No database change.
- Guard: `apps/web/app/vendor-dashboard/clients/the-cocktail-editor-is-asked-only-when-open.test.ts`.

SPEC IMPACT: None.
