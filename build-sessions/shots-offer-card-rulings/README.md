# Shots · offer card rulings 2026-11-13 · the supplier's offer picker (390 px, deviceScaleFactor 2)

AWAITING OWNER APPROVAL OF THE LOOK. Taken from `/dev/offer-card-lab` on `next dev` with dummy env and
sample data (nobody real, no real price). Scenario: the live quote is ₱110,000 and already carries
"Book early" (₱5,000 off), so the couple currently pays ₱105,000.

| Now | Proposed |
|---|---|
| `../shots-offer-card/1-drop-sheet-pick.png`: every running offer can be picked | `proposed-1-picker-greyed.png`: "Book early" (already on the quote) and "Weekday · ₱3,000 off" (saves less) are listed but greyed out (`aria-disabled`, the reason in the ⓘ: "Saves no more than the current quotation"); only "Rainy-season weekday · 10% off" can be picked |
| (no line) | `proposed-2-better-picked.png`: the better offer picked: "Ana & Miguel will save ₱4,000 more than the current quotation" / "New total is ₱101,000", then Next |

Couple side (not shot, it renders nothing): a paused, ended, expired, removed or not-better drop is no longer
shown to the couple at all; an applied one stays as history.
