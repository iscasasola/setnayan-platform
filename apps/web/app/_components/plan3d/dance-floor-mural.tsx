'use client';

/**
 * DanceFloorMural — the SHARED dance-floor mesh for every 3D seat-plan surface
 * (Fable dossier §3.7). One component, three call sites: the couple lab
 * (replaces its old flat accent plane), the homepage 3D-Plan demo and the
 * public guest venue walk (which had NO dance mesh at all — `floor.dance` fed
 * their walk obstacles but nothing rendered, so avatars dodged an invisible
 * rectangle). Renders the mood-board mural from `lib/dance-mural-texture`
 * (rasterized once, module-cached, shared GPU texture across surfaces).
 *
 * MonogramPlane discipline (seating-lab-3d.tsx): `meshBasicMaterial` +
 * `toneMapped:false` so the painted mural reads true (projected light, not lit
 * vinyl), `alphaTest` so the texture's transparent rounded corners feather
 * into the venue floor, `depthWrite:false` + a small y-lift so it never
 * z-fights the floor plane, and `raycast` disabled so it can't steal the
 * floor-tap (roam) or drag/deselect pointer beneath it.
 *
 * The optional `monogram` bakes the couple's STATIC mark into the mural
 * texture (free-tier look). The paid ANIMATED_MONOGRAM bloom is NOT this
 * component's job — that stays on the lab's MonogramPlane, gate untouched.
 *
 * No disposal on unmount ON PURPOSE: the texture is module-cache-owned (same
 * lifetime contract as `floorRoughnessMap`), so remounting surfaces keep
 * hitting the one rasterization.
 */

import { useMemo } from 'react';
import { danceMuralTexture } from '@/lib/dance-mural-texture';
import { pctToWorld, type Lab3DFloor, type Lab3DMonogram } from '@/lib/seating-3d';
import type { RolePalette } from '@/lib/mood-board';

export function DanceFloorMural({
  floor,
  room,
  rolePalette = null,
  monogram = null,
  y = 0.02,
}: {
  /** Only `.dance` is read — structural, so any Lab3DFloor-shaped scene fits. */
  floor: Pick<Lab3DFloor, 'dance'>;
  room: { w: number; d: number };
  /** Couple's mood board; null/absent → the mural's neutral template triple. */
  rolePalette?: RolePalette | null;
  /** Bake the couple's static mark at the mural centre (free-tier look). */
  monogram?: Lab3DMonogram;
  /** Height above the floor plane — callers slot it under their monogram decal. */
  y?: number;
}) {
  const enabled = floor.dance.enabled;
  // Hook order is render-stable (enabled only gates the work inside); the
  // texture is a module-cache lookup after the first rasterization.
  const tex = useMemo(
    () => (enabled ? danceMuralTexture(rolePalette, monogram) : null),
    [enabled, rolePalette, monogram],
  );
  if (!enabled || !tex) return null;

  const dance = pctToWorld(floor.dance.xPct, floor.dance.yPct, room);
  const danceW = Math.max(1.5, (floor.dance.wPct / 100) * room.w);
  const danceD = Math.max(1.5, (floor.dance.hPct / 100) * room.d);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[dance.x, y, dance.z]} raycast={() => null}>
      <planeGeometry args={[danceW, danceD]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.01} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
