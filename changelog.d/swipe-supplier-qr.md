## 2026-11-03 · chore(supplier-qr): the locked-QR generator's ✕ marks are kept kinds, named as such

Swipe-to-delete sweep (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON
ROWS"), supplier QR slice. `invite/_components/locked-qr-generator.tsx` has no list row with a delete: a picked
service's ✕ is a chip inside the services field, and a payment's trash removes a draft installment (name, date, ₱)
inside the deal form before it is issued — a field in an editor. No UI change: the file moves from
`no-delete-x-on-list-rows.baseline.txt` to the guard's `ALLOWED` list with its reason.

SPEC IMPACT: None.
