## 2026-11-27 · feat(gown-maker): v196 price list: one cape item per cape type, and ribbon by the metre (follow-up to B3+B4)

Gown maker port, a small follow-up to #8458. The approved drawing moved to `prototypes/gown_maker_2026-11-27/gown_maker_v196.html`.

- **Cover-ups:** the single "Cape" item becomes one item per cape type, each per piece and unpriced until the designer prices it: neck cape · back cape · pair of shoulder capes · side cape · capelet · one-shoulder drape ("Cape (…): cutting, sewing and finishing").
- **Trims:** "Ribbon (sash)" by the metre. It prices the sash and bow, and the narrow strap a cape needs on a strapless neckline.
- A cape's fabric, edge (lace, appliqué, crystals) and strap price on the existing fabric, lace, bead and ribbon items.
- The quote lines that use them come when the design config (Builder A) carries the v196 cape fields.
- The retired single `cape` key is refused by the shop-options check. Nothing was ever saved under it: the gown tables are not live yet.
- **Guards:** `lib/gown-maker.test.ts` 7b (the six items, their group and that they start unpriced) and 7b2 (ribbon, and the retired key).

SPEC IMPACT: None. This follows the v196 drawing.
