## 2026-11-19 · feat(card-maker): new photos stop at 5 — a card with 6 keeps them (part 6)

The card maker's one gallery now stops ADDING at 5 photos (the primary + 4), per the card-maker drawing's Decided Q5. A
card that already holds 6 is opened with a limit of 6 for that visit — nothing is taken from a saved card, and deleting
one of the six lets the supplier put one back. `CARD_NEW_PHOTO_LIMIT` + `cardPhotoLimit(heldAtOpen)` in
`lib/card-photos.ts` are the one rule; the gallery (add tile, `maxFiles`, count line) and the maker's Photos group
(count + ⓘ) both read it. The database CHECK (6 total) and the server clamp `cardPhotoFields` are unchanged, so an older
tab that posts 6 is still saved — the limit is the maker's, not a new refusal.

The part's other two lines were already shipped and are NOT rebuilt: the name is a text box filled with the service name
(drawing v36 Decided — the "<Service> by <Shop>" suggestion in the parts list was wrong), and two cards with the same
name are already refused across the whole shop (check 9 "flooding", `lib/fair-presentation.ts`, in the maker and on save).

SPEC IMPACT: None — implements the approved drawing's Decided Q5; no corpus text changes.
