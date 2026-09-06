# RV3 — the room draws near things over far things

**Model · effort: Sonnet · high.** One file (`lib/reception-scene.ts`), one guard that renders and
measures, no migration. Small, but it is the second depth-order defect in that renderer this week
and the guard must make a third impossible.

## The defect (found by RV2 by rendering and looking, then measured)

After a couple accepts a live-band chip, the band paints OVER the nearer guest table's tall
centrepiece. Measured on the rendered SVG: riser + figures span `y[332, 378]`; the centrepiece on
the `cx=720` table spans `y[335, 396]`. In this projection larger `y` is nearer the viewer, so the
band (`y≈362`) is FURTHER than that table (`y≈432`) and is still appended last. RV1 found and fixed
the same class once already (the dance floor painted over the guest tables); RV2 makes this zone one
click away, so it will now be seen by real couples.

## What exists

`renderVenueSvg` in `lib/reception-scene.ts` composites 13 zones. RV1's PR (#5242) records the
dance-floor fix; read how it was done and whether it was a local reorder or a general rule. If it
was local, that is why this recurred.

## The build

1. **One depth rule, not another reorder.** Every drawn element carries an anchor `y` (its
   ground-contact line, not its top); the compositor sorts by it once, ascending, before emitting.
   Zones that are genuinely behind everything (ceiling, backdrop, walls) keep a fixed first slot;
   everything that stands on the floor (tables, band riser and figures, booths, dance floor, feast
   stations, program elements, tunnel) sorts by anchor.
2. **Guard that renders and measures**, extending `lib/reception-scene.test.ts`: for a room with a
   band and the standard tables, rasterise at the component size and assert the centrepiece's pixels
   at its known coordinates are the centrepiece's colour, not the band's. Add the symmetric case:
   a table that IS further than the band must sit behind it. Sabotage: append the band last again →
   red; flip the sort direction → red; anchor on top-edge instead of ground-contact → red on the
   tall centrepiece.
3. **Byte-identity where nothing overlaps.** RV1/MB14b/RV2 pinned renders for rooms without
   overlap; those must not change. Assert a room with no band and default tables renders
   byte-identical before and after.

## Out of lane

Every zone's artwork (RA1). The suggestion chips (RV2). The 3D room.

## Report

The four lines in `MB-OVERSIGHT.md`, plus the before/after render of the band-and-table room and
the measured pixel colours at the centrepiece coordinates.
