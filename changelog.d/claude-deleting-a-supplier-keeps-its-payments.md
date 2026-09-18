## 2026-09-18 · fix(budget): deleting a supplier can no longer destroy a logged payment (SUP-67)

`event_vendor_payments` cascades off `event_vendors`. `deleteVendor()` and
`cancelBookingAsHost()` decided "has money moved?" from a status list
(`deposit_paid / delivered / complete`) plus the legacy `deposit_paid_php`.
The budget page's "record a cost" door locks its supplier at `contracted` and
writes the money to the payment log, so it reaches neither. Removing that
supplier silently erased the payment. The replay shows the same thing at
`considering`.

Fixed by the property, not a longer list. New BEFORE DELETE trigger
`event_vendors_refuse_delete_with_payments` (migration `20271233096294`)
refuses any delete of a supplier row with a payment logged against it. Two
deletes still pass: the cascade from deleting the whole celebration (the event
row is already gone) and a booking already preserved with `event_id` NULL.
Both actions ask first, so the couple reads why and what to do: delete the
payment on the Budget page if it was a mistake, then remove the supplier.
`cancelBookingAsHost` returns a new `has_logged_payments` result that the
cancel dialog shows. It is not routed to disputes.

Proved by `tests/db/a-logged-payment-outlives-the-supplier-delete.db.test.ts`
(red on main: 2 of 5. Rewriting the trigger into the old status-list shape turns the same 2 red. The event-still-exists clause is defensive and unproven: the replay cannot produce the cascade order it guards against.)

SPEC IMPACT: None. This restores what the delete guard was always meant to do.
