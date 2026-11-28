### Attire Maker A7b wiring: the bride's hand work reaches the designer

- A design she sends now carries what she painted by hand on the 3D gown (beads and lace motifs). It is checked on the server with `sanitizeGownHand`, Builder A's contract. A bad value is refused, never repaired. It is stored in `gown_designs.hand` (#8492).
- Her painted beads join the existing bead items, by kind, and her lace motifs join the lace motif item. Both also add to the beading and appliqué hours. Her estimate and the designer's cost lines both count them. An unpriced item stays unpriced; no new price item.
- The order view says "Painted by hand: N beads, M lace motifs. Added to the designer's count."
- A design sent without hand work says "Hand work wasn't sent with this design." Hand work that no longer checks out says "Couldn't read her hand work on this design."
- No migration of its own; the column is #8492's.

SPEC IMPACT: None. This wires the coordinator's A7b ruling (28 Nov) onto the existing quote items.
