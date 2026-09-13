## 2026-09-04 · fix(figure-kit): a garment is a solid, not a cut-out

Owner, looking at a gown in the room: **"all clothes are just half and not
wrapped around."**

They were not. Every garment is a full 360° lathe — the geometry goes all the
way round. **Two rendering facts** made it read as a flat panel:

1. `latheProfile` returned to the axis only at the **hem**. The collar end was an
   open tube, so a camera above the shoulder looked straight down inside it.
2. Every outfit material was **`FrontSide`**, so the far half of the skirt was
   culled — leaving the front shell, hard straight silhouette cuts, and a
   chevron hem where the open bottom showed through.

`chibi-figure.tsx` already names the cure — *"closed lathes + DoubleSide"* — and
`lib/chibi-geometry.ts` enforces the first half with `closedLatheProfile`. **Half
of that law had shipped here**; this brings the other half across and applies
both to `outfitMaterial` (all three branches) and `trouserMaterial`.

⚠ **THE PAIRING IS THE POINT.** Either half alone still reads as cut open: caps
without `DoubleSide` still discard the far side, and `DoubleSide` without caps
still shows a hollow neck. Both are asserted, and sabotages removing either go
red.

**Strictly additive.** Two-sided rendering can only REVEAL surfaces that were
culled and can never remove one; a cap only closes a hole. No existing room
loses anything it was drawing — which is what makes this safe on rooms couples
have already shown suppliers.

⚠ **THE BODY IS DELIBERATELY LEFT ONE-SIDED**, and that is tested too. Skin is
closed capsules and spheres, so two-sided rendering there doubles fragment work
for surfaces no camera can reach — on a phone, for nothing.

🪤 **The first version of this guard went red against correct code.** It counted
every `MeshStandardMaterial` in the file and demanded `side` on all of them —
including `mannequinMaterial`, the skin, where culling is right. Scoped to the
garment functions instead. That is the second over-broad assertion this week to
fail on a correct implementation; a blanket "all of X must have Y" is worth
distrusting when X spans more than one job.

SPEC IMPACT: None — no design decision changes; garments now render as the
solids their geometry always described.
