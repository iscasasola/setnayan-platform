## 2026-07-10 · chore(plan3d): booth staff stay matte-white — drop the dead outfit machinery

Owner decision (gap 12): booth STAFF follow the locked matte-white featureless
mannequin look, same as guests — NOT garment-differentiated. This was already
the runtime behaviour (`figure.tsx` ignores `spec.outfit`), so no visual change;
this just removes the now-confirmed-dead code the audit flagged (gaps 14/15):

- **Deleted** `outfitGeometry`, `outfitIsSkirted` (outfits.ts) — zero consumers
  since the one-piece rebuild; the per-guest figure places no wardrobe shells.
- **Deleted** `skinMaterial` + its cache — dead since skin/hair accents were
  replaced by the single shared body material.
- **Trimmed** the `kit/index.ts` re-export to just `outfitMaterial` + `OutfitKind`
  (both still live — booth decor).
- **Corrected** the stale `outfits.ts` module doc: the gown/suit/barong/
  filipiniana shells + `outfitMaterial` now serve ONLY static booth decor
  (booth-props.tsx dress-forms / garment rails), not the per-guest figure.

Kept: `outfitMaterial`, `OutfitKind`, `staffGarmentTexture`, `isStaffOutfit`, the
GOWN_GEO/SUIT_GEO/NEUTRAL_GEO buffers, and the `outfit` FigureSpec field — all
still used (booth decor + the lab still sets `outfit`, harmlessly ignored at
render).

`tsc` + guards clean; no dangling references to the deleted symbols.

SPEC IMPACT: None (dead-code removal; matte-white staff was already the behaviour).
