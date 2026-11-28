## 2026-11-28 · feat(gown-maker): the bride's Fabric step grouped by type, offering only what suits the garment: data side (port step B15)

Gown maker port, step B15 (corpus `WHATS_NEXT_Gown_Maker_Port_2026-11-27.md` § 5; prototype `INTEGRATION-PLAN.md` "v186: The Fabric step groups by type and offers only what suits the garment"). Data side only: Builder A wires the step from it in a small A PR.

- **`gownFabricGroups(slot, types, shopFabrics)`** (`lib/gown-maker.ts`, pure). Each slot offers only the types that suit it:
  - gown: types used for the gown body or the skirt;
  - accent: types used for sleeves and accents;
  - lining: types used for lining.
- **Grouping:**
  - headings by family, in the family order (Satins, Structured, Crepes, Sheers, Laces, …);
  - men's-only and lining-only types are hidden from the gown and accent choices;
  - the designer's own cloths come first, each under its type;
  - a cloth whose type does not suit the slot is not offered.
- **The `open` read** now carries `fabricGroups: { gown, accent, lining }`, built from the registry (`family`, `used_for`) and the shop's own fabrics. Still never a price.
- **Guards:** `lib/gown-fabric-groups.test.ts` (4):
  - each slot's filter; wool suiting is never offered for a gown (sabotage-checked);
  - the family order;
  - the hidden families;
  - designer cloths first;
  - the open read carries all three slots, and no price reaches the choices.

SPEC IMPACT: None. This builds step B15 as planned.
