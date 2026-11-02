'use client';

/**
 * 🪑 The small VIP mark over a VIP table in the 3D room (owner 2026-11-02, "VIP Table/s will be identified" — shown
 * with a small VIP mark in List, 2D and 3D). One shared texture for every VIP table (cached, never re-drawn); a
 * sprite, so it always faces the camera. Display only — it takes no pointer.
 * 🔒 lib/vip-tables-seat-role-first.test.ts
 */
import { useMemo } from 'react';
import * as THREE from 'three';

let shared: THREE.CanvasTexture | null = null;

function vipTexture(): THREE.CanvasTexture {
  if (shared) return shared;
  const W = 128;
  const H = 64;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(92,37,66,0.92)'; // brand mulberry
  ctx.beginPath();
  ctx.roundRect(4, 4, W - 8, H - 8, 18);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 32px system-ui, -apple-system, sans-serif';
  ctx.fillText('VIP', W / 2, H / 2 + 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  shared = tex;
  return tex;
}

/** Drawn as a child of the table's own group, so it moves with the table. */
export function VipTableMark({ height = 1.7 }: { height?: number }) {
  const map = useMemo(() => vipTexture(), []);
  return (
    <sprite position={[0, height, 0]} scale={[0.8, 0.4, 1]} raycast={() => null}>
      <spriteMaterial map={map} transparent depthWrite={false} />
    </sprite>
  );
}
