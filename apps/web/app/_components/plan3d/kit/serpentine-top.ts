import * as THREE from 'three';
import { serpentineBand } from '@/lib/seating-3d';

/**
 * The serpentine tabletop as a real curved ribbon (104° quarter-donut), NOT a
 * bounding rectangle. Extruded once from the canonical band outline and laid
 * flat — the extrude axis becomes world +Y, so the ribbon rises from the floor
 * (y=0) to the tabletop height (0.74 m), matching every other table's top.
 *
 * `serpentineBand()` is capacity-independent (the 2026-05-09 lock: ONE 104°
 * band), so a SINGLE module-scoped geometry serves every serpentine table on
 * every surface — the seating lab, the homepage demo, and the guest venue walk.
 * This is the shared source that replaces each surface's `boxGeometry` fallback
 * (the lab already rendered the ribbon inline; the demo + walk showed a
 * rectangle). Callers place it at the table group origin (y=0, no separate leg
 * post — the ribbon is floor-to-top solid) and let the group's `rotationDeg`
 * turn it, exactly like the box it replaces.
 */
export const SERPENTINE_TOP_GEO: THREE.ExtrudeGeometry = (() => {
  const shape = new THREE.Shape();
  serpentineBand().outline.forEach((p, i) => {
    // Shape lives in XY; after rotateX(−90°) it maps (x, −z) → world (x, h, z).
    if (i === 0) shape.moveTo(p.x, -p.z);
    else shape.lineTo(p.x, -p.z);
  });
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.74, bevelEnabled: false, steps: 1 });
  geo.rotateX(-Math.PI / 2);
  return geo;
})();
