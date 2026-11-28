### Attire Maker v207: Duchess satin, Bias satin and Taffeta

- Three new fabric types in the admin Fabric-types registry: Duchess satin, Bias satin and Taffeta. A small seed migration takes their numbers from the prototype's v207 feel cards (weight, stiffness, gloss as sheen, see-through as sheer, stretch). Every row is marked not verified ("Values to check"), like the original 15.
- "Duchess satin" and "duchesse" move from plain satin's aliases to the new Duchess satin type, so a swatch labelled Duchess finds the right cloth.
- The price list gains three unpriced per-metre lines in Fabrics: `fab_duchess`, `fab_bias_satin` and `fab_taffeta`. No amount is set.
- Bias satin is laid at 45°, so it takes more cloth. The multiplier (×1.35) lives once, in `GOWN_FABRIC_METRES_MULT`. The cutting list applies it to the outer fabric only, so the list agrees with the quote.
- The other feel-card numbers (folds, edge, swing, shine type) stay in the prototype and code: no new columns (coordinator, 28 Nov).

SPEC IMPACT: None. This ports the v207 fabric additions the coordinator scoped on 28 Nov.
