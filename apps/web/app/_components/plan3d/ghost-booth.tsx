'use client';

/**
 * plan3d/ghost-booth — the dashed, translucent "ghost booths" for 3D Booth Ads
 * Part A (slice 9). One marker per UNBOOKED vendor category, shown ONLY in the
 * couple's own planning lab (never a guest page): a wall-hugging placeholder
 * volume + a dashed floor ring + a canvas-texture "STILL NEED · Caterer" placard,
 * tinted in the couple's palette so it reads as a soft suggestion, not a real
 * booth. Tapping it opens that category's marketplace grid (`/explore?tile=…`,
 * Boosted/Pro ranked first) — a native, in-room "you still need a caterer → here
 * are caterers" ad. Dismiss + master toggle live in the lab's HTML panel.
 *
 * The WebGL look is owner-eyeballed (can't run headless); the SELECTION +
 * PLACEMENT math is unit-tested in lib/ghost-booths.test.ts.
 */

import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { pctToWorld, boothFacingY, BOOTH_FOOTPRINT_M, type Lab3DPalette } from '@/lib/seating-3d';
import { ghostBoothExploreHref, type GhostBooth3D } from '@/lib/ghost-booths';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Lazy per-label placard texture (browser-only — needs `document`; cached).
// Same lazy-CanvasTexture pattern as the booth staff garments / barong bump.
const signCache = new Map<string, THREE.CanvasTexture>();
function ghostSignTexture(label: string): THREE.CanvasTexture {
  const cached = signCache.get(label);
  if (cached) return cached;
  const W = 256;
  const H = 96;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(18,20,26,0.84)';
  roundRect(ctx, 3, 3, W - 6, H - 6, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  ctx.setLineDash([9, 6]);
  roundRect(ctx, 3, 3, W - 6, H - 6, 16);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '700 18px system-ui, -apple-system, sans-serif';
  ctx.fillText('STILL NEED', W / 2, 30);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 30px system-ui, -apple-system, sans-serif';
  ctx.fillText(label, W / 2, 63);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  signCache.set(label, tex);
  return tex;
}

function GhostBoothMesh({
  ghost,
  room,
  palette,
  interactive,
  onOpen,
}: {
  ghost: GhostBooth3D;
  room: { w: number; d: number };
  palette: Lab3DPalette;
  interactive: boolean;
  onOpen: (g: GhostBooth3D) => void;
}) {
  const p = useMemo(() => pctToWorld(ghost.xPct, ghost.yPct, room), [ghost.xPct, ghost.yPct, room]);
  const faceY = useMemo(() => boothFacingY({ xPct: ghost.xPct, yPct: ghost.yPct }, room), [ghost.xPct, ghost.yPct, room]);
  const sign = useMemo(() => ghostSignTexture(ghost.label), [ghost.label]);
  const { w, d } = BOOTH_FOOTPRINT_M;
  const ring = Math.max(w, d);
  const tap = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onOpen(ghost);
  };
  return (
    <group position={[p.x, 0, p.z]} rotation={[0, faceY, 0]}>
      {/* dashed footprint ring on the floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[ring * 0.6, ring * 0.72, 44]} />
        <meshBasicMaterial color={palette.accent} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      {/* translucent placeholder volume (soft "empty slot") */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[w, 1.0, d]} />
        <meshStandardMaterial color={palette.accent} transparent opacity={0.12} roughness={0.7} depthWrite={false} />
      </mesh>
      {/* slim post carrying the placard */}
      <mesh position={[0, 1.05, 0]}>
        <cylinderGeometry args={[0.028, 0.028, 1.1, 8]} />
        <meshStandardMaterial color={palette.accent} transparent opacity={0.5} />
      </mesh>
      {/* the "STILL NEED · Caterer" placard */}
      <mesh position={[0, 1.72, 0]}>
        <planeGeometry args={[1.5, 0.56]} />
        <meshBasicMaterial map={sign} transparent side={THREE.DoubleSide} />
      </mesh>
      {/* invisible tap target → open the marketplace category (disabled while a
          build-mode floor interaction is armed, mirroring LabBoothHitTarget). */}
      {interactive ? (
        <mesh position={[0, 0.9, 0]} visible={false} onPointerDown={tap}>
          <boxGeometry args={[w + 0.3, 1.9, d + 0.3]} />
        </mesh>
      ) : null}
    </group>
  );
}

/** Renders every placed ghost booth. Tapping one opens its `/explore?tile=…`
 *  marketplace grid in a new tab. Draws nothing when the list is empty. */
export function GhostBooths({
  ghosts,
  room,
  palette,
  interactive = true,
}: {
  ghosts: readonly GhostBooth3D[];
  room: { w: number; d: number };
  palette: Lab3DPalette;
  /** false while a build-mode placement is armed → the tap can't fire. */
  interactive?: boolean;
}) {
  if (ghosts.length === 0) return null;
  const open = (g: GhostBooth3D) => {
    if (typeof window !== 'undefined') window.open(ghostBoothExploreHref(g.tileSlug), '_blank', 'noopener');
  };
  return (
    <>
      {ghosts.map((g) => (
        <GhostBoothMesh key={g.category} ghost={g} room={room} palette={palette} interactive={interactive} onOpen={open} />
      ))}
    </>
  );
}
