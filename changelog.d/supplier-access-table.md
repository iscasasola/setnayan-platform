## 2026-10-07 · feat(supplier-access): display-only map of what each kind of supplier can see of an event

New `apps/web/lib/supplier-access-by-category.ts`: parent supplier family → `[{ area, level }]` over a closed set of areas (Guest list · Seat plan · The Day · Suppliers · Event Hub · Mood Board · Budget & payments · Photos · Schedule) and levels (`view` · `edit`). `supplierAccessFor(category)` resolves sub-categories through `parentsOfCategory`; `supplierAccessWords(category)` returns plain words ("… · Schedule: View").

**Display only — it grants nothing.** It mirrors `Feature_Access_By_Vendor_Category_2026-06-12.md` § 7 + the 2026-10-03 DECISION_LOG rows + `SUPPLIER_PHOTO_ACCESS_2026-10-03_fable.md`, and where those disagree with the code it follows the RPCs (`get_vendor_event_brief`, `get_vendor_seat_plan`, `get_vendor_mood_board`, `papic_vendor_challenge_photos`, the booked-supplier timeline policy). The test reads the newest migration defining each RPC and fails when the words drift from the database (sabotage-checked: dropping `security` from the seat-plan list fails it).

No UI, no migration, no server action.

SPEC IMPACT: None
