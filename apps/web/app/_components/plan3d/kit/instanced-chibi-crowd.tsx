'use client';

/**
 * kit/instanced-chibi-crowd — every seated guest who made an avatar, drawn as
 * their chibi, in one InstancedMesh per distinct part buffer (the crowd PR the
 * chibi-geometry BATCHING CONTRACT was written for; owner 2026-09-06 "build
 * what is not done").
 *
 * Sits beside `InstancedSeatedCrowd` (the neutral mannequins): the walk splits
 * its occupants — a seat with a valid avatar config comes here, every other
 * seat stays there. Materials are WHITE and per-instance colour comes from the
 * same `resolveChibiPaint` the individual `<ChibiFigure>` uses (via
 * lib/chibi-sit chibiCrowdBatches), so the maker's chibi and the seated one
 * cannot drift. DoubleSide is the solid-figure law (closed lathes +
 * DoubleSide; the transparency the owner rejected cannot recur).
 *
 * Statically baked — no per-frame work, no idle sway (the phone crowd budget,
 * the same SCOPE note as the mannequin crowd). Geometries are shared module
 * caches: never disposed here.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { chibiCrowdBatches, type ChibiSeat } from '@/lib/chibi-sit';

const _color = new THREE.Color();

export function InstancedChibiCrowd({ seats }: { seats: readonly ChibiSeat[] }) {
  const batches = useMemo(() => chibiCrowdBatches(seats), [seats]);
  const refs = useRef<Array<THREE.InstancedMesh | null>>([]);

  useLayoutEffect(() => {
    batches.forEach((b, bi) => {
      const mesh = refs.current[bi];
      if (!mesh) return;
      for (let i = 0; i < b.instances.length; i++) {
        const inst = b.instances[i]!;
        mesh.setMatrixAt(i, inst.matrix);
        mesh.setColorAt(i, _color.set(inst.hex));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  }, [batches]);

  if (batches.length === 0) return null;
  return (
    <>
      {batches.map((b, bi) => (
        // key carries the count: instance count is fixed at construction.
        <instancedMesh
          key={`${b.key}-${b.instances.length}`}
          ref={(el) => void (refs.current[bi] = el)}
          args={[b.geometry, undefined, b.instances.length]}
          frustumCulled={false}
        >
          <meshStandardMaterial color="#ffffff" roughness={b.roughness} side={THREE.DoubleSide} />
        </instancedMesh>
      ))}
    </>
  );
}
