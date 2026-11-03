## 2026-11-03 · feat(sponsors): a sponsor's Remove is the card's swipe, with Undo

Owner 2026-11-03 (DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS"), the Sponsors slice:
the sponsor card's small trash form left; the card is wrapped in the shared `SwipeToDelete` (`SponsorSwipe`, new) and
the removal waits out the Undo window (`deleteWithUndo`) — the same `removeSponsor` with the same FormData. A removal
takes the sponsor's invitation and answer with it, so the Undo matters; a refused remove (`?error=…`) draws the card
again.

SPEC IMPACT: None — implements the 2026-11-03 DECISION_LOG row; no spec text changes.
