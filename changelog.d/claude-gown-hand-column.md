### Attire Maker: room for the bride's hand work (migration only; wiring follows)

- `gown_designs` gains a `hand` column. It holds the beads, holes, lace motifs and cuts the bride places by hand (Builder A's A7b), which are too big for `config`'s 8 KB cap.
- The column is empty by default. It must be an object of at most 393,216 bytes (`GOWN_HAND_MAX_BYTES`).
- It is read exactly like the rest of the design: the event's hosts and that shop, through the table's one read policy.
- Only the server writes it. The designer's tape stays shop-only.
- Nothing writes it yet. A second PR wires Send, the design read, the order view's "Painted by hand" line and the bead and lace quote counts, once Builder A's `sanitizeGownHand` lands.

SPEC IMPACT: None (storage for an approved prototype feature, A7b).
