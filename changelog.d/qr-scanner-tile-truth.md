## 2026-08-04 · fix(vendor): a day-of tile that promised a scanner and opened a client record

The vendor's day-of console offered a tile called **"QR scanner"**, promising
*"scan a guest's QR to look them up or mark a hand-off"*. It was switched on by
default for coordinators **and caterers**, and tapping it opened the ordinary
client page — which has no scanner on it.

Two separate things were untrue. There is **no hand-off scan anywhere**, for any
supplier. And the seat scanner that does exist is part of the coordinator's floor
panel, so a caterer who switched the tile on could never have reached one.

The tile is now called **"Find a guest's seat"**, says what it actually does —
scan a guest's QR on the floor to see which table they're on — and is offered
only to coordinators, who are the only people the panel renders for.

SPEC IMPACT: None. Nothing was removed; a promise the product could not keep was.
