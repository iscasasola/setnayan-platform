## 2026-11-28 · feat(gown-maker): v199 Straps and edges price lines, and the v196 cape lines wired into the quote

A small follow-up on top of B10 (coordinator, 27–28 Nov; drawing `prototypes/gown_maker_2026-11-27/gown_maker_v199.html`). It stacks on Builder A's A6f (`claude/gown-a6f-capes`) for the cape quantities.

- **Price list, all unpriced** (amounts only from the designer's own list). A new **Straps and edges** group:
  - "Straps: cutting, sewing and attaching", per pair;
  - "Scalloped edge: shaping and finishing", per piece.
- **The cape on the quote**, from A6f's quantities. A cape now prices on the shop's own list:
  - its own labour line by type ("Cape (side cape): cutting, sewing and finishing");
  - its cloth, `capeM`: the cape's own tulle, chiffon, organza or lace, or the gown fabric in the accent colour;
  - the narrow strap a one-shoulder cape needs on a strapless neckline, `ribbonM` on the ribbon item.
  
  A lace, appliqué or beaded edge was already in the lace and bead lines. An unpriced line stays unpriced.
- **Fit and flare:** "Starting price: Fit and flare" now comes from Builder A's own silhouette list (A6e). The separate entry added in #8467 is dropped so the key isn't listed twice. A guard caught that.
- **Guards:** `lib/gown-maker.test.ts` 7f covers the new group, unpriced at start, and the cape labour, cloth and strap lines from A6f quantities (unpriced, then priced). 7e still guards one key, one group.
- **Not yet:** the strap and scallop QUANTITIES (strap metres by type, crystals for the straps) arrive with Builder A's v199 step. The quote lines that use them follow then.

SPEC IMPACT: None. This follows the v196 and v199 drawings.
