### Gown maker v207: how each fabric feels

- **Every fabric has a feel card** (prototype v207 `FEEL`): its fold width and depth, how crisp the folds are, how it takes the light, how see-through it is, how thick its edge is and how far it swings. Everything the stage draws reads only the card, so a new fabric is a new card.
- **Three new fabrics:** Duchess satin, Bias satin (it takes 1.35× the fabric, since bias is cut at 45°) and Taffeta. Each has its weave tile and its line under the fabric step. The fabric list keeps v207's own order.
- **The skirt falls in the fabric's own uneven folds** instead of even ribs, and the folds are drawn into the light as well:
  - long and soft for satin;
  - sharp and broken for taffeta and mikado;
  - fine for chiffon;
  - almost none for crepe.

  Pleats read as pressed edges.
- **A train has a rounded end.** The skirt's folds run out along it and thin onto the floor, and the neckline's edge is as thick as the cloth.
- **Light:**
  - Satin carries a long highlight down each fold.
  - Strong colours lose some gloss (no more latex red).
  - Sequins glint without a time term, so a resting stage stays still.
  - There is no clearcoat on cloth any more.
- **See-through:**
  - A sheer is clear face-on and denser at its edges and where the train pools.
  - A lined sheer shows its lining's colour, and the lining stops at the hem.
  - An unlined sheer draws its far side first, so overlaps read denser.
- **She moves the way her fabric does:** chiffon lifts most, mikado least. The swing now reads the card; before this it kept fixed numbers.
- **Lace in any colour:** "Gown colour", "Black" and "Any colour…" (`laceHex` in the contract). Every colour of her own (the gown, the lace, the beads, the trims) now has the house colour well under its pick, so a design is never left asking for a colour it doesn't have. The send says her own colour as itself.
- **Held to v207:** the dress, cape, flowers, beads, hand work, inside, overlay, parts, sleeves, techniques, trims, quote and pose fixtures were re-captured from v207 (the skirt changed under all of them). One cape flower whose hide is decided by an exact two-triangle tie is named in its test rather than decided.
- **Lab:** `/dev/gown-maker-lab?view=fabrics`.

SPEC IMPACT: None (port of prototype v207; three new fabric ids and three lace colours in the gown contract, which Builder B's catalog prices from its own list).
