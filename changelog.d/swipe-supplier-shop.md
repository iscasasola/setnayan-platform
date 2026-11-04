## 2026-11-03 · feat(supplier-shop): a custom-domain row deletes by swipe, with Undo

Swipe-to-delete sweep (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON
ROWS"), supplier shop slice. Your page → Your web address: each own-domain row's visible trash button left the row; the
row is wrapped in the one `SwipeToDelete` (swipe left on a phone, hover trash on a computer, named "Remove <domain>"),
and the removal now waits out the Undo window (`deleteWithUndo`) before calling the same `removeVendorDomain` — so an
Undo never has to re-add the address at Vercel, and a refusal brings the row back and says so. The documents form's
client-reference ✕ is a field inside an editor form and stays (`docs-body.tsx` → the guard's `ALLOWED`). The supplier
lab's `?s=page` gains `&domains=1` (two fixture domains) for the screenshots.

SPEC IMPACT: None.
