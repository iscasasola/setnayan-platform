## 2026-08-24 · fix(events): one private note could lock a couple out of deleting their celebration

Reproduced against production 2026-08-24 in a rolled-back transaction: book a
real marketplace supplier, write ONE private working note on that booking, press
delete →

```
DELETE REFUSED :: 23503 :: update or delete on table "event_vendors" violates
foreign key constraint "event_vendor_working_notes_vendor_event_fk"
```

Not a wrong answer — a **hard failure**. The couple can never delete their event.

It is the slice-4 trap still open on the table slice 2 itself touches:
`event_vendor_working_notes` carries a composite FK `(event_vendor_id, event_id)
→ event_vendors` with **ON UPDATE NO ACTION**, and slice 2's preserve is an
UPDATE of a referenced column. Measured across the whole schema: six composite
FKs exist in `public`, and this is the only one that both spans a column a
preserve trigger nulls and still says NO ACTION.

⛔ **The obvious fix — mirror slice 4's `ON UPDATE CASCADE` — is the one fix that
must not be made.** The note would follow the booking into orphanhood, stop
matching the event being deleted, and **survive**: 4,000 characters of the
couple's candid assessment of a supplier, attached to that supplier's preserved
record. The notes are therefore deleted a moment earlier, not preserved a moment
longer — they cascade with the event anyway, so nothing about what survives
changes.

Migration `20271165013701`. 4 db tests; the fix mutation-checked by occurrence
count (1 → 0) reproducing the exact production `23503`. Prod dry-run: DELETE
SUCCEEDED, 0 notes left, booking preserved and detached.

Latent today — prod holds 0 working notes and 1 marketplace booking — and it
bites the first time both exist.

SPEC IMPACT: None.
