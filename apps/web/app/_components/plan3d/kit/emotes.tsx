'use client';

/**
 * kit/emotes — pooled EMOTE BUBBLES for every 3D seat-plan surface (Fable
 * dossier §3.6). Sprites, NOT drei Html: the plan3d surfaces deliberately have
 * zero in-scene Html (DOM overlays only; the sole billboard is the selfie
 * disc) — Html doesn't occlude, costs DOM layout per guest, and fights the
 * chase cam. A bubble here is a `THREE.Sprite` (auto-billboarded quad) reading
 * one cell of a glyph ATLAS.
 *
 * ATLAS: one CanvasTexture, rasterized ONCE at module scope (the
 * `danceMuralTexture` / `floorRoughnessMap` lazy-singleton discipline —
 * browser-only, cached forever, shared across every surface). Six glyphs,
 * every one DRAWN with canvas paths — no emoji fonts (they render
 * platform-inconsistently and break the mascot-smooth look):
 *   check   ✓-stroke on the bubble — RSVP confirmed
 *   pending drawn question hook + dot — RSVP pending
 *   maybe   tilde stroke — RSVP maybe
 *   meal    plate (double ring) + fork tines — guest picked a meal (lab only)
 *   music   eighth note — ambient, near the dance floor
 *   chat    three typing dots — idle chatter at a table
 * Glyph inks are fixed semantic constants (status colours), deliberately NOT
 * palette-tinted — the atlas is painted once for every event.
 *
 * POOL: exactly `EMOTE_MAX_VISIBLE` (6) sprites, one per rotation LANE — the
 * ≤6 cap is structural, not policed. All scheduling (which emitter, which
 * glyph, pop scale) is the PURE `lib/emote-schedule` policy sampled per frame
 * from `clock.elapsedTime` — closed-form wall-clock math, so a starved rAF
 * frame lands exactly where the elapsed time says (the arrival-fix law; no
 * frame-count accumulation anywhere). Each glyph owns ONE module-scope
 * SpriteMaterial (an atlas-windowed texture view); the frame loop only swaps
 * `sprite.material` — zero per-frame texture or material mutation.
 *
 * Reduced motion: static bubbles (each lane pins its first emitter's first
 * glyph at full scale — no tweens), still ≤6. Sprites never raycast, so they
 * can't steal the QR-mint click or a roam floor tap.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { usePrefersReducedMotion } from '@/lib/use-responsive';
import {
  emoteLanes,
  sampleLane,
  EMOTE_MAX_VISIBLE,
  type EmoteEmitter,
  type EmoteGlyph,
} from '@/lib/emote-schedule';

export type { EmoteEmitter, EmoteGlyph };

// ── Bubble anchor heights (m) — shared so surfaces agree with the rig ───────
// Figure head centres: standing ≈1.44, seated ≈1.14 (kit/figure.tsx rig
// constants); bubble centres clear the head + hair with a small gap.
export const EMOTE_SEATED_Y = 1.62;
export const EMOTE_STANDING_Y = 1.92;
/** Ambient chatter over a table centre (tabletop 0.74 + seated heads). */
export const EMOTE_TABLE_Y = 1.5;
/** Ambient music notes floating over the dance floor. */
export const EMOTE_DANCE_Y = 1.8;

/** Bubble world size (m) at full pop — reads at both chase-cam and orbit range. */
const EMOTE_SIZE_M = 0.36;

// ── Glyph atlas — 3×2 grid, rasterized once (module singleton) ───────────────

const CELL = 128;
const COLS = 3;
const ROWS = 2;
/** Atlas cell per glyph: [col, row]. Row 0 is the TOP of the canvas. */
const GLYPH_CELL: Record<EmoteGlyph, readonly [number, number]> = {
  check: [0, 0],
  pending: [1, 0],
  maybe: [2, 0],
  meal: [0, 1],
  music: [1, 1],
  chat: [2, 1],
};

// Semantic inks — status colours stay fixed per glyph (never palette-tinted).
const INK: Record<EmoteGlyph, string> = {
  check: '#3f9d6b', // confirmed green
  pending: '#cf9a3a', // the seating surfaces' tentative amber family
  maybe: '#b08a3e',
  meal: '#8a6f52', // warm crockery brown
  music: '#4c5d9e', // slate blue
  chat: '#55606e', // neutral ink
};

/** Draw the shared bubble chrome (soft white round + tail) into one cell. */
function drawBubble(ctx: CanvasRenderingContext2D): void {
  // Tail first so the circle overlaps its root.
  ctx.beginPath();
  ctx.moveTo(52, 96);
  ctx.lineTo(76, 96);
  ctx.lineTo(64, 118);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(64, 56, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(35,38,46,0.18)';
  ctx.stroke();
}

/** Rasterize one glyph's strokes (cell-local coords; bubble already drawn). */
function drawGlyph(ctx: CanvasRenderingContext2D, glyph: EmoteGlyph): void {
  ctx.strokeStyle = INK[glyph];
  ctx.fillStyle = INK[glyph];
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (glyph) {
    case 'check': {
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(42, 58);
      ctx.lineTo(58, 74);
      ctx.lineTo(88, 40);
      ctx.stroke();
      break;
    }
    case 'pending': {
      // Question hook: arc over the top, easing into the vertical drop + dot.
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(64, 46, 16, Math.PI, Math.PI * 2.4);
      ctx.quadraticCurveTo(66, 62, 64, 68);
      ctx.lineTo(64, 74);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(64, 90, 6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'maybe': {
      // Tilde — two soft humps.
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(38, 62);
      ctx.bezierCurveTo(46, 42, 60, 42, 66, 56);
      ctx.bezierCurveTo(72, 70, 84, 70, 90, 52);
      ctx.stroke();
      break;
    }
    case 'meal': {
      // Plate: rim + well, with fork tines at the left.
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(70, 58, 23, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(70, 58, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 4;
      for (const x of [30, 36, 42]) {
        ctx.beginPath();
        ctx.moveTo(x, 36);
        ctx.lineTo(x, 48);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(36, 48);
      ctx.lineTo(36, 80);
      ctx.stroke();
      break;
    }
    case 'music': {
      // Eighth note: rotated head + stem + flag.
      ctx.save();
      ctx.translate(56, 76);
      ctx.rotate(-0.35);
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(64, 74);
      ctx.lineTo(64, 36);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(64, 36);
      ctx.quadraticCurveTo(78, 40, 80, 54);
      ctx.stroke();
      break;
    }
    case 'chat': {
      // Three typing dots.
      for (const x of [46, 64, 82]) {
        ctx.beginPath();
        ctx.arc(x, 58, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }
}

// Lazy module singletons (browser-only, cached for the page's lifetime — the
// booth-props / dance-mural texture discipline; never disposed on purpose).
let atlasCanvas: HTMLCanvasElement | null = null;
function emoteAtlas(): HTMLCanvasElement {
  if (atlasCanvas) return atlasCanvas;
  const canvas = document.createElement('canvas');
  canvas.width = CELL * COLS;
  canvas.height = CELL * ROWS;
  const ctx = canvas.getContext('2d')!;
  for (const glyph of Object.keys(GLYPH_CELL) as EmoteGlyph[]) {
    const [col, row] = GLYPH_CELL[glyph];
    ctx.save();
    ctx.translate(col * CELL, row * CELL);
    drawBubble(ctx);
    drawGlyph(ctx, glyph);
    ctx.restore();
  }
  atlasCanvas = canvas;
  return canvas;
}

// One SpriteMaterial per glyph — an atlas-windowed CanvasTexture view (clones
// share the ONE canvas; offset/repeat select the cell and are never mutated
// after creation, so the frame loop's only write is `sprite.material = …`).
const glyphMats = new Map<EmoteGlyph, THREE.SpriteMaterial>();
function glyphMaterial(glyph: EmoteGlyph): THREE.SpriteMaterial {
  let m = glyphMats.get(glyph);
  if (!m) {
    const tex = new THREE.CanvasTexture(emoteAtlas());
    tex.colorSpace = THREE.SRGBColorSpace;
    const [col, row] = GLYPH_CELL[glyph];
    tex.repeat.set(1 / COLS, 1 / ROWS);
    // Canvas rows count DOWN from the top; UV v counts UP — flip the row.
    tex.offset.set(col / COLS, 1 - (row + 1) / ROWS);
    m = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false, // soft edges never punch halo holes in the room
      toneMapped: false, // painted UI chrome reads true, like the mural
    });
    glyphMats.set(glyph, m);
  }
  return m;
}

/** Sprites must never steal a pointer: QR-mint clicks on guests and roam
 *  floor taps pass straight through (the DanceFloorMural raycast rule). */
const NO_RAYCAST = () => null;

/**
 * <EmoteBubbles> — mount once per scene with that surface's emitters. The
 * pool renders `EMOTE_MAX_VISIBLE` sprites and the wall-clock scheduler
 * (lib/emote-schedule) decides, per frame, which lane shows which emitter's
 * which glyph at what pop scale. Emitters are expected to be memoised by the
 * caller (lane partition recomputes only when the crowd actually changes).
 */
export function EmoteBubbles({ emitters }: { emitters: readonly EmoteEmitter[] }) {
  const reduced = usePrefersReducedMotion();
  const lanes = useMemo(() => emoteLanes(emitters), [emitters]);
  const sprites = useRef<(THREE.Sprite | null)[]>([]);

  useFrame(({ clock }) => {
    // WALL-CLOCK: elapsedTime is real time — a starved frame consumes every
    // owed slot/tween second in one closed-form sample (arrival-fix law).
    const t = clock.elapsedTime;
    for (let lane = 0; lane < EMOTE_MAX_VISIBLE; lane++) {
      const sprite = sprites.current[lane];
      if (!sprite) continue;
      const laneEmitters = lanes[lane]!;
      const s = sampleLane(t, lane, laneEmitters.length, reduced);
      if (!s || s.scale <= 0.001) {
        sprite.visible = false;
        continue;
      }
      const em = laneEmitters[s.emitterIndex]!;
      const glyph = em.glyphs[s.appearance % em.glyphs.length] ?? em.glyphs[0]!;
      sprite.visible = true;
      sprite.position.set(em.x, em.y, em.z);
      const sc = s.scale * EMOTE_SIZE_M;
      sprite.scale.set(sc, sc, 1);
      sprite.material = glyphMaterial(glyph);
    }
  });

  return (
    <group>
      {Array.from({ length: EMOTE_MAX_VISIBLE }, (_, lane) => (
        <sprite
          key={lane}
          ref={(el) => void (sprites.current[lane] = el)}
          visible={false}
          raycast={NO_RAYCAST}
          material={glyphMaterial('chat')}
        />
      ))}
    </group>
  );
}
