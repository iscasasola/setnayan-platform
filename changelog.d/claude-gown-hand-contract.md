### Gown maker: the hand-work contract (GownHand), beside the design

- **A new `GownHand` object** carries what the bride places by hand (A7b):
  - `handBeads`, at most 4,000;
  - `handHoles` (the eraser's wipes), at most 400;
  - `handLace`, at most 400;
  - `handCuts` (round holes or drawn shapes), at most 60, with 4–400 points a shape.
- **It travels beside the design, never inside it.** The stored design keeps its 8 KB cap; the hand work has its own (`GOWN_HAND_MAX_BYTES`). Looks never carry hand work.
- **`sanitizeGownHand` is the one check** the send path calls:
  - it holds every piece to its range, a catalog bead kind, a named colour or a hex, the bead and lace size ranges, and a stock lace;
  - it refuses (never repairs) anything over a cap or off its range;
  - nothing at all, or a missing list, is empty.
- No screen and no storage yet: A7b's tools write it, and Builder B's send path stores it once the `gown_designs.hand` column lands.

SPEC IMPACT: None (contract for prototype v202's hand tools; shape approved by the coordinator 2026-11-28).
