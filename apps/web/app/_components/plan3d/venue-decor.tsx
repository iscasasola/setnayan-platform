'use client';

/**
 * VenueDecor + VenueShell — Wave 2b theming for every 3D seat-plan surface
 * (2026-07-03). Two long-untapped data sources finally reach 3D here:
 *
 *   1. `events.reception_design` (JSONB) — the couple's per-part treatment
 *      choices (ceiling · backdrop · stage · tables · entrance …). Until now it
 *      only drove the 2D SVG in `reception-scene.ts`; `VenueDecor` is its first
 *      3D consumer. The vocabulary + `sel()` fall-through live in that module —
 *      this file NEVER hardcodes an option id it can't read back from `sel()`.
 *
 *      MB1 (2026-09-03) closed three silent gaps in exactly that data: the
 *      `walls` · `photo_wall` · `welcome_signage` zones were stored, offered in
 *      the editor and printed in the concept PDF while reaching no geometry at
 *      all; and `role_palette.reception[4]` — the owner-locked FIFTH major
 *      colour — was drawn nowhere. All four now render. `sel()` still draws ONE
 *      treatment per attribute; what a multi-selection therefore leaves off
 *      screen is disclosed to the couple by `primaryOnlyNotice()` in the room's
 *      legend, so an unseen pick is never mistaken for an unmade one.
 *
 *   2. `events.venue_setting` (TEXT, default 'banquet_hall') — the room ARCHETYPE.
 *      `VenueShell` swaps the room's walls / background / floor tone per setting
 *      (garden loses its walls for perimeter greenery, chapel goes tall + narrow
 *      with warm window glow, barn gets wood walls + trusses, …). Unknown values
 *      fall back to banquet_hall.
 *
 * DESIGN RULES (same discipline as `venue-objects.tsx` / `instanced-chairs.tsx`):
 *   · Palette-tinted: everything colours from the caller's `Lab3DPalette`, so a
 *     mood-board recolour picks the decor up for free (the whole point of 2b).
 *   · Instanced or trivially cheap: chandeliers, string-light bulbs, floral
 *     blossoms, candles, centrepieces, perimeter shrubs and window panels are
 *     all `InstancedMesh` (one/two draws for a whole set) or a handful of meshes.
 *   · No fetched assets, no troika text, no CDN/HDRI (offline-first — no asset
 *     pipeline; NOT a CSP limit).
 *   · Degrades to nothing: `{}` (the default `reception_design`) renders the
 *     DEFAULT_DESIGN treatments; an explicit 'none'/'bare' renders nothing.
 *   · `quality: 'low'` (phone walk / guest venue) drops the most expensive bits
 *     (chandelier emissive halos, per-table centrepiece density) — the shapes
 *     stay, the glow budget shrinks.
 *
 * READ-ONLY + presentational — no DB, no state, no editing.
 */

import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import {
  pctToWorld,
  type Lab3DPalette,
  type Lab3DTable,
  type Lab3DFloor,
} from '@/lib/seating-3d';
import { sel, selAll, type DrawnAttribute, type ReceptionDesign } from '@/lib/reception-scene';
import { ColdSparkTunnel } from '@/app/_components/plan3d/kit/entrance-tunnel';

type Room = { w: number; d: number };
export type DecorQuality = 'high' | 'low';

// ─────────────────────────────────────────────────────────────────────────────
// Small colour helpers (pure, no THREE state) — lighten/darken a palette hue so
// treatments read against the surface they sit on without new palette fields.
// ─────────────────────────────────────────────────────────────────────────────

function mix(a: string, b: string, t: number): string {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  return `#${ca.lerp(cb, t).getHexString()}`;
}
/** A soft "bloom" tint from the accent — warm floral/foliage read. */
function bloomColor(palette: Lab3DPalette): string {
  // The couple's floral colour when they set one on the mood board. Otherwise
  // the lightened accent this has always used — NOT `resolveRoomDressing`'s
  // derived value, which is raw reception[0] and would deepen every existing
  // room's blooms without anyone asking.
  return palette.florals ?? mix(palette.accent, '#ffffff', 0.35);
}
function leafColor(palette: Lab3DPalette): string {
  // Bias toward green but keep a hint of the palette so a bold theme still shows.
  return mix('#6f9b6a', palette.accent, 0.18);
}
/**
 * THE SECOND TONE OF A TWO-TONE FLORAL — and the first place the couple's
 * FIFTH major colour has ever reached a pixel.
 *
 * `BlossomInstances` has always painted alternating instances two tones: the
 * bloom, and the bloom mixed toward the linen. When the couple's reception
 * palette carries a fifth colour ("Accent 2", `reception[4]`), that IS the
 * second tone — it is what the slot is for, and it is why a five-colour theme
 * used to look identical to the same theme with four.
 *
 * The fallback is the EXACT expression each call site used before, `t` and
 * all, so a board with three or four colours renders byte-for-byte as it did.
 * That is the whole safety argument, and it is structural: `accent2` is
 * `undefined` unless `reception[4]` exists.
 *
 * ⚠ NOT `resolveRoomDressing`. That helper derives a floral colour when the
 * couple set none, from a different slot; wiring it here would restyle every
 * room already sold. See `Lab3DPalette.florals`/`.accent2`.
 */
function bloomSecondary(palette: Lab3DPalette, bloom: string, t: number): string {
  return palette.accent2 ?? mix(bloom, palette.table, t);
}

// ═════════════════════════════════════════════════════════════════════════════
// CEILING TREATMENTS
// ═════════════════════════════════════════════════════════════════════════════

/** A tight cluster of small crystal-fixture instances hung on a grid across the
 *  room — a slim hanging rod from the ceiling, a faceted crystal body, and a
 *  warm emissive core at its lower tip. Three InstancedMesh draws for the whole
 *  ceiling regardless of count. The glow renders at BOTH qualities (it's what
 *  makes the fixture read as "lit" instead of a floating gray rock from the
 *  top-down overview — taste-review fix 2026-07-03). */
function Chandeliers({ room, palette, quality }: { room: Room; palette: Lab3DPalette; quality: DecorQuality }) {
  const rodRef = useRef<THREE.InstancedMesh>(null);
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const positions = useMemo(() => gridHangPoints(room, quality === 'low' ? 6 : 9), [room, quality]);
  const count = positions.length;
  // Warm champagne crystal (accent-tinted) instead of bare wall-gray.
  const crystal = useMemo(() => mix(mix(palette.accent, '#ffffff', 0.55), '#ffe9c4', 0.35), [palette.accent]);
  const glow = useMemo(() => mix(palette.accent, '#ffe4a8', 0.65), [palette.accent]);
  const bodyY = CEILING_Y - 0.55;

  useLayoutEffect(() => {
    const rod = rodRef.current;
    const body = bodyRef.current;
    const glowM = glowRef.current;
    if (!body) return;
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const { x, z } = positions[i]!;
      // Rod: from the ceiling down to the crystal.
      if (rod) {
        p.set(x, (CEILING_Y + bodyY) / 2 + 0.12, z);
        s.set(1, 1, 1);
        m.compose(p, q, s);
        rod.setMatrixAt(i, m);
      }
      // Crystal body.
      p.set(x, bodyY, z);
      s.set(1, 1.4, 1);
      m.compose(p, q, s);
      body.setMatrixAt(i, m);
      // Glow core at the crystal's LOWER tip — visible from below AND from the
      // top-down overview (peeks past the body's waist).
      if (glowM) {
        p.set(x, bodyY - 0.22, z);
        s.set(1, 1, 1);
        m.compose(p, q, s);
        glowM.setMatrixAt(i, m);
      }
    }
    if (rod) rod.instanceMatrix.needsUpdate = true;
    body.instanceMatrix.needsUpdate = true;
    if (glowM) glowM.instanceMatrix.needsUpdate = true;
  }, [positions, count, bodyY]);

  return (
    <>
      <instancedMesh key={`chand-rod-${count}`} ref={rodRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <cylinderGeometry args={[0.02, 0.02, 0.55, 6]} />
        <meshStandardMaterial color={mix(palette.accent, '#000', 0.25)} roughness={0.5} metalness={0.6} />
      </instancedMesh>
      <instancedMesh key={`chand-${count}`} ref={bodyRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <octahedronGeometry args={[0.24, 0]} />
        <meshStandardMaterial color={crystal} roughness={0.15} metalness={0.35} transparent opacity={0.75} />
      </instancedMesh>
      <instancedMesh key={`chand-glow-${count}`} ref={glowRef} args={[undefined, undefined, count]} frustumCulled={false}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={2.0} toneMapped={false} />
      </instancedMesh>
    </>
  );
}

/** Warm string lights strung in catenary sags across the room — the bulbs are a
 *  single InstancedMesh of tiny emissive spheres sampled along each sag. Wires
 *  are cheap thin line-tubes (a few draws). */
function StringLights({ room, palette }: { room: Room; palette: Lab3DPalette }) {
  const bulbRef = useRef<THREE.InstancedMesh>(null);
  const glow = useMemo(() => mix(palette.accent, '#ffe9b8', 0.6), [palette.accent]);
  const { bulbs, sags } = useMemo(() => catenaryRuns(room), [room]);

  useLayoutEffect(() => {
    const mesh = bulbRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < bulbs.length; i++) {
      p.set(bulbs[i]!.x, bulbs[i]!.y, bulbs[i]!.z);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [bulbs]);

  return (
    <group>
      {sags.map((pts, i) => (
        <SagWire key={i} points={pts} color={mix(palette.wall, '#000000', 0.4)} />
      ))}
      <instancedMesh key={`bulb-${bulbs.length}`} ref={bulbRef} args={[undefined, undefined, bulbs.length]} frustumCulled={false}>
        <sphereGeometry args={[0.055, 6, 6]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={1.8} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

function SagWire({ points, color }: { points: THREE.Vector3[]; color: string }) {
  const geo = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  useLayoutEffect(() => () => geo.dispose(), [geo]);
  return (
    <line>
      <primitive object={geo} attach="geometry" />
      <lineBasicMaterial color={color} transparent opacity={0.5} />
    </line>
  );
}

/** Clustered hanging paper lanterns — a handful of soft emissive spheres on a
 *  grid, a warmer, sparser cousin of the chandeliers. */
function Lanterns({ room, palette, quality }: { room: Room; palette: Lab3DPalette; quality: DecorQuality }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const positions = useMemo(() => gridHangPoints(room, quality === 'low' ? 5 : 7), [room, quality]);
  const count = positions.length;
  const color = useMemo(() => mix(palette.accent, '#fff4e0', 0.55), [palette.accent]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1.15, 1);
    for (let i = 0; i < count; i++) {
      p.set(positions[i]!.x, CEILING_Y - 0.7 - (i % 3) * 0.25, positions[i]!.z);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [positions, count]);

  return (
    <instancedMesh key={`lantern-${count}`} ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[0.32, 10, 10]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={quality === 'high' ? 0.7 : 0.4} roughness={0.7} />
    </instancedMesh>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STAGE BACKDROP TREATMENTS
// ═════════════════════════════════════════════════════════════════════════════

/** A wall of draped fabric behind the stage — a few gently curved vertical
 *  panels with a soft sheen. Cheap (one lathe-ish curved plane per panel). */
function DrapedBackdrop({ center, width, palette }: { center: THREE.Vector3; width: number; palette: Lab3DPalette }) {
  const panels = Math.max(4, Math.round(width / 0.7));
  const panelW = width / panels;
  const color = useMemo(() => mix(palette.wall, '#ffffff', 0.25), [palette.wall]);
  const geo = useMemo(() => curvedPanelGeo(panelW * 1.05, 3.0, 0.14), [panelW]);
  useLayoutEffect(() => () => geo.dispose(), [geo]);
  return (
    <group position={[center.x, 0, center.z]}>
      {Array.from({ length: panels }).map((_, i) => {
        const x = -width / 2 + panelW * (i + 0.5);
        return (
          <mesh key={i} geometry={geo} position={[x, 1.6, 0]} castShadow>
            <meshStandardMaterial color={color} roughness={0.55} metalness={0.08} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
}

/** A floral wall — instanced blossom clusters (spheres) tiled over a backing
 *  panel of greenery. One blossom InstancedMesh + one greenery InstancedMesh. */
function FloralWall({ center, width, palette, quality }: { center: THREE.Vector3; width: number; palette: Lab3DPalette; quality: DecorQuality }) {
  const height = 3.0;
  const cols = Math.max(6, Math.round(width / (quality === 'low' ? 0.5 : 0.34)));
  const rows = quality === 'low' ? 6 : 9;
  const blossoms = useMemo(() => blossomGrid(width, height, cols, rows), [width, cols, rows]);
  const bloom = useMemo(() => bloomColor(palette), [palette]);
  const leaf = useMemo(() => leafColor(palette), [palette]);
  return (
    <group position={[center.x, height / 2, center.z]}>
      {/* Greenery backing so the gaps between blooms read as foliage, not void. */}
      <mesh position={[0, 0, -0.06]}>
        <boxGeometry args={[width, height, 0.1]} />
        <meshStandardMaterial color={leaf} roughness={0.95} />
      </mesh>
      <BlossomInstances points={blossoms} colorA={bloom} colorB={bloomSecondary(palette, bloom, 0.4)} radius={0.16} />
    </group>
  );
}

/** A subtle emissive LED panel backdrop — dark glass frame, palette-accent glow. */
function LedBackdrop({ center, width, palette }: { center: THREE.Vector3; width: number; palette: Lab3DPalette }) {
  return (
    <mesh position={[center.x, 1.55, center.z]} castShadow>
      <boxGeometry args={[width, 3.0, 0.16]} />
      <meshStandardMaterial color="#10131b" emissive={palette.accent} emissiveIntensity={0.5} roughness={0.25} metalness={0.7} />
    </mesh>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ENTRANCE TREATMENT (arch over the entrance mark)
// ═════════════════════════════════════════════════════════════════════════════

/** A floral- or draped-covered arch over the entrance. Two posts + a torus-half
 *  lintel; a floral arch adds a ring of blossom instances hugging the lintel. */
function EntranceArch({
  position,
  palette,
  variant,
}: {
  position: THREE.Vector3;
  palette: Lab3DPalette;
  variant: 'floral' | 'draped' | 'greenery' | 'plain';
}) {
  const w = 1.9;
  const postColor = variant === 'draped' ? mix(palette.wall, '#ffffff', 0.2) : mix(palette.wall, '#000', 0.15);
  const archBloom = variant === 'greenery' ? leafColor(palette) : bloomColor(palette);
  const ringPts = useMemo(() => (variant === 'plain' ? [] : archRingPoints(w / 2 - 0.12, 2.2, 18)), [variant]);
  return (
    <group position={[position.x, 0, position.z]}>
      <mesh position={[-w / 2 + 0.1, 1.15, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.1, 2.3, 10]} />
        <meshStandardMaterial color={postColor} roughness={0.85} />
      </mesh>
      <mesh position={[w / 2 - 0.1, 1.15, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.1, 2.3, 10]} />
        <meshStandardMaterial color={postColor} roughness={0.85} />
      </mesh>
      <mesh position={[0, 2.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[w / 2 - 0.1, 0.1, 8, 22, Math.PI]} />
        <meshStandardMaterial color={variant === 'draped' ? postColor : archBloom} roughness={0.6} />
      </mesh>
      {ringPts.length > 0 ? (
        <BlossomInstances points={ringPts} colorA={archBloom} colorB={bloomSecondary(palette, archBloom, 0.4)} radius={0.13} />
      ) : null}
    </group>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// THE THREE ZONES THE ROOM USED TO IGNORE
//
// `walls` · `photo_wall` · `welcome_signage` are stored in
// `events.reception_design` exactly like ceiling/backdrop/tunnel, are offered
// in the reception-design editor, are printed in the concept PDF, and reached
// NO 3D geometry at all. A couple dressed their side walls and put a
// step-and-repeat by the door, and the room looked byte-identical to a room
// where they had chosen nothing — a silent absence rendering as a confident
// answer.
//
// 🔑 EVERY ONE OF THE THREE DEFAULTS TO "NOTHING HERE" (`DEFAULT_DESIGN`:
// walls → 'bare', photo_wall → 'none', welcome_signage → 'minimal'), so a
// board that never touched them mounts none of this and renders exactly as it
// did. The non-regression proof leans on that and nothing else.
//
// Every group carries a `name` — three.js `Object3D.name`, which is also what
// makes "did this reach the RENDER?" answerable by something other than
// trusting the resolver. See `the-room-draws-what-the-couple-saved.test.ts`.
// ═════════════════════════════════════════════════════════════════════════════

/** Where the room's two long side walls are, and how tall the dressing runs. */
const WALL_DRESS_Y = 1.5;
const WALL_DRESS_H = 2.6;

/**
 * Side walls & pillars. Suppressed on open-air archetypes for the same reason
 * ceiling decor is: a garden has no side wall to drape (the couple's choice is
 * kept and simply has nothing to hang on — `VenueShell` already replaces those
 * walls with perimeter greenery).
 */
function WallTreatment({
  room,
  palette,
  quality,
  treatment,
}: {
  room: Room;
  palette: Lab3DPalette;
  quality: DecorQuality;
  treatment: string;
}) {
  const halfW = room.w / 2;
  const bloom = useMemo(() => bloomColor(palette), [palette]);
  const leaf = useMemo(() => leafColor(palette), [palette]);
  const runs = useMemo<Array<{ x: number; ry: number }>>(
    () => [
      { x: -halfW + 0.12, ry: Math.PI / 2 },
      { x: halfW - 0.12, ry: -Math.PI / 2 },
    ],
    [halfW],
  );

  // Points along one wall, in that wall's local frame (x runs along the room's
  // depth once the group is rotated), used by the garland + greenery passes.
  const along = useMemo(() => {
    const n = quality === 'low' ? 14 : 24;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const z = -room.d / 2 + t * room.d;
      pts.push(new THREE.Vector3(z, 0, 0));
    }
    return pts;
  }, [room.d, quality]);

  const drapeGeo = useMemo(() => curvedPanelGeo(0.62, WALL_DRESS_H, 0.1), []);
  useLayoutEffect(() => () => drapeGeo.dispose(), [drapeGeo]);
  const drapePanels = Math.max(6, Math.round(room.d / 0.72));

  return (
    <group name={`decor-walls-${treatment}`}>
      {runs.map((run, ri) => (
        <group key={ri} position={[run.x, 0, 0]} rotation={[0, run.ry, 0]}>
          {treatment === 'fabric_drape'
            ? Array.from({ length: drapePanels }).map((_, i) => {
                const z = -room.d / 2 + (room.d / drapePanels) * (i + 0.5);
                return (
                  <mesh key={i} geometry={drapeGeo} position={[z, WALL_DRESS_Y, 0]}>
                    <meshStandardMaterial
                      color={mix(palette.wall, '#ffffff', 0.18)}
                      roughness={0.62}
                      metalness={0.06}
                      side={THREE.DoubleSide}
                    />
                  </mesh>
                );
              })
            : null}

          {treatment === 'greenery_wall' ? (
            <>
              <mesh position={[0, WALL_DRESS_Y, 0.06]}>
                <boxGeometry args={[room.d, WALL_DRESS_H, 0.1]} />
                <meshStandardMaterial color={leaf} roughness={0.95} />
              </mesh>
              <BlossomInstances
                points={along.map((p) => new THREE.Vector3(p.x, WALL_DRESS_Y + (((p.x * 7) % 5) / 5 - 0.5) * 1.6, 0.16))}
                colorA={leaf}
                colorB={bloomSecondary(palette, leaf, 0.3)}
                radius={0.17}
              />
            </>
          ) : null}

          {treatment === 'floral_garland' ? (
            <BlossomInstances
              points={along.map((p) => new THREE.Vector3(p.x, WALL_DRESS_Y + 0.75, 0.14))}
              colorA={bloom}
              colorB={bloomSecondary(palette, bloom, 0.4)}
              radius={0.15}
            />
          ) : null}

          {/* "Uplighting only" is a real choice, not an empty one — the couple
              said the walls stay bare AND lit. A slim emissive wash at the
              skirting is what that looks like, and it is why it must not
              render the same as 'bare'. */}
          {treatment === 'uplighting_only'
            ? Array.from({ length: quality === 'low' ? 5 : 8 }).map((_, i, arr) => {
                const z = -room.d / 2 + (room.d / arr.length) * (i + 0.5);
                return (
                  <mesh key={i} position={[z, 0.28, 0.1]}>
                    <boxGeometry args={[0.34, 0.5, 0.06]} />
                    <meshStandardMaterial
                      color={mix(palette.ambient, '#ffffff', 0.3)}
                      emissive={palette.ambient}
                      emissiveIntensity={quality === 'high' ? 1.4 : 0.8}
                      toneMapped={false}
                    />
                  </mesh>
                );
              })
            : null}
        </group>
      ))}
    </group>
  );
}

/**
 * The step-and-repeat / photo-op backdrop. Deliberately NOT the stage
 * backdrop — the catalogue blurb says so in words ("separate from your stage
 * backdrop"), so it stands against a side wall on the entrance half of the
 * room, facing in.
 */
function PhotoWall({
  room,
  palette,
  quality,
  style,
}: {
  room: Room;
  palette: Lab3DPalette;
  quality: DecorQuality;
  style: string;
}) {
  const w = Math.min(3.2, Math.max(2.0, room.w * 0.2));
  const h = 2.6;
  const x = -room.w / 2 + 0.5;
  const z = room.d * 0.16;
  const bloom = useMemo(() => bloomColor(palette), [palette]);
  const leaf = useMemo(() => leafColor(palette), [palette]);
  const grid = useMemo(
    () => blossomGrid(w, h, quality === 'low' ? 6 : 9, quality === 'low' ? 5 : 8),
    [w, h, quality],
  );

  return (
    <group name={`decor-photo-wall-${style}`} position={[x, h / 2, z]} rotation={[0, Math.PI / 2, 0]}>
      {/* Every style stands on the same panel — one physical wall. */}
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[w, h, 0.12]} />
        <meshStandardMaterial
          color={
            style === 'neon_backdrop'
              ? '#14161f'
              : style === 'greenery_wall'
                ? leaf
                : mix(palette.wall, '#ffffff', 0.2)
          }
          roughness={style === 'neon_backdrop' ? 0.3 : 0.8}
          metalness={style === 'neon_backdrop' ? 0.5 : 0.05}
          emissive={style === 'neon_backdrop' ? palette.accent : '#000000'}
          emissiveIntensity={style === 'neon_backdrop' ? 0.45 : 0}
        />
      </mesh>

      {style === 'floral_wall' || style === 'greenery_wall' ? (
        <BlossomInstances
          points={grid.map((p) => new THREE.Vector3(p.x, p.y, 0.08))}
          colorA={style === 'greenery_wall' ? leaf : bloom}
          colorB={bloomSecondary(palette, style === 'greenery_wall' ? leaf : bloom, 0.4)}
          radius={0.15}
        />
      ) : null}

      {/* Step & repeat — the couple's monogram tiled across the panel. Small
          plates rather than text: no fonts are loaded in the 3D room. */}
      {style === 'step_repeat'
        ? Array.from({ length: 5 }).map((_, r) =>
            Array.from({ length: 4 }).map((__, c) => (
              <mesh key={`${r}-${c}`} position={[-w / 2 + (w / 4) * (c + 0.5), -h / 2 + (h / 5) * (r + 0.5), 0.07]}>
                <boxGeometry args={[w * 0.12, w * 0.12, 0.02]} />
                <meshStandardMaterial color={palette.accent2 ?? palette.accent} roughness={0.45} metalness={0.4} />
              </mesh>
            )),
          )
        : null}

      {style === 'balloon_garland'
        ? Array.from({ length: quality === 'low' ? 14 : 22 }).map((_, i, arr) => {
            const t = i / (arr.length - 1);
            const bx = -w / 2 + t * w;
            const by = h / 2 - 0.25 - Math.sin(t * Math.PI) * 0.5 + (((i * 13) % 5) / 5 - 0.5) * 0.3;
            const tone = [palette.accent, palette.accent2 ?? palette.table, bloom][i % 3]!;
            return (
              <mesh key={i} position={[bx, by, 0.16]}>
                <sphereGeometry args={[0.13 + ((i * 7) % 3) * 0.03, 8, 7]} />
                <meshStandardMaterial color={tone} roughness={0.35} />
              </mesh>
            );
          })
        : null}

      {style === 'neon_backdrop' ? (
        <mesh position={[0, 0.1, 0.09]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[w * 0.26, 0.035, 6, 26]} />
          <meshStandardMaterial
            color={palette.accent2 ?? palette.accent}
            emissive={palette.accent2 ?? palette.accent}
            emissiveIntensity={2.4}
            toneMapped={false}
          />
        </mesh>
      ) : null}
    </group>
  );
}

/**
 * The welcome table by the door — easel sign, framed seating chart, floral
 * guestbook. Sits beside the entrance mark, offset along the wall so it never
 * stands in the doorway the walkers use.
 */
/** Gap between pieces on the welcome table when the couple chose more than one. */
const WELCOME_ITEM_SPACING_M = 1.15;
/** Keep a piece inside the room on either axis (the single-item version clamped
 *  its one position; every stepped item needs the same guard). */
function clampToRoom(v: number, extent: number): number {
  return Math.max(-extent / 2 + 0.5, Math.min(extent / 2 - 0.5, v));
}

function WelcomeSignage({
  entrance,
  room,
  palette,
  styles,
}: {
  entrance: THREE.Vector3;
  room: Room;
  palette: Lab3DPalette;
  /** EVERY style the couple put on the welcome table, in their chosen order.
   *
   *  This zone is multi-select and a real welcome table carries several things
   *  at once — an easel sign, the seating chart, the guestbook. The room used to
   *  draw the primary and silently drop the rest.
   *
   *  ⚠ INDEX 0 MUST LAND WHERE THE SINGLE-STYLE VERSION LANDED. `selAll(…)[0]`
   *  is `sel(…)` by construction, so a board that chose one thing renders that
   *  thing in the same spot as before and this change is additive by
   *  construction rather than by promise — the rule that existing rooms, which
   *  couples have shown suppliers and booked against, must not restyle. */
  styles: readonly string[];
}) {
  // Push inward off the wall, then step sideways along it.
  const inward = useMemo(() => {
    const v = new THREE.Vector3(-entrance.x, 0, -entrance.z);
    return v.lengthSq() < 1e-6 ? new THREE.Vector3(0, 0, -1) : v.normalize();
  }, [entrance.x, entrance.z]);
  const side = useMemo(() => new THREE.Vector3(-inward.z, 0, inward.x), [inward]);
  const pos = useMemo(() => {
    const p = new THREE.Vector3(entrance.x, 0, entrance.z)
      .addScaledVector(inward, 0.9)
      .addScaledVector(side, 1.7);
    // Never outside the room.
    p.x = Math.max(-room.w / 2 + 0.5, Math.min(room.w / 2 - 0.5, p.x));
    p.z = Math.max(-room.d / 2 + 0.5, Math.min(room.d / 2 - 0.5, p.z));
    return p;
  }, [entrance.x, entrance.z, inward, side, room.w, room.d]);
  const yaw = useMemo(() => Math.atan2(inward.x, inward.z), [inward]);
  const bloom = useMemo(() => bloomColor(palette), [palette]);
  const wood = useMemo(() => mix(palette.accent, '#2a1c12', 0.45), [palette.accent]);

  return (
    <>
      {styles.map((style, i) => {
        // Step each additional piece along the wall the table stands against.
        // i === 0 adds nothing, so the first piece keeps its exact position.
        const ix = clampToRoom(pos.x + side.x * (i * WELCOME_ITEM_SPACING_M), room.w);
        const iz = clampToRoom(pos.z + side.z * (i * WELCOME_ITEM_SPACING_M), room.d);
        return (
    <group key={style} name={`decor-welcome-${style}`} position={[ix, 0, iz]} rotation={[0, yaw, 0]}>
      {style === 'easel_sign' ? (
        <>
          {[-0.34, 0.34].map((dx) => (
            <mesh key={dx} position={[dx, 0.62, -0.12]} rotation={[0.16, 0, dx > 0 ? -0.1 : 0.1]}>
              <cylinderGeometry args={[0.025, 0.03, 1.3, 6]} />
              <meshStandardMaterial color={wood} roughness={0.85} />
            </mesh>
          ))}
          <mesh position={[0, 0.62, 0.62]} rotation={[0.14, 0, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.03, 1.3, 6]} />
            <meshStandardMaterial color={wood} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.95, 0]} rotation={[0.1, 0, 0]} castShadow>
            <boxGeometry args={[0.86, 1.18, 0.04]} />
            <meshStandardMaterial color={mix(palette.table, '#ffffff', 0.35)} roughness={0.7} />
          </mesh>
        </>
      ) : null}

      {style === 'framed_seating_chart' ? (
        <>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[0.5, 1.0, 0.5]} />
            <meshStandardMaterial color={mix(palette.table, '#ffffff', 0.25)} roughness={0.8} />
          </mesh>
          <mesh position={[0, 1.62, 0]} castShadow>
            <boxGeometry args={[1.24, 1.16, 0.07]} />
            <meshStandardMaterial color={palette.accent2 ?? wood} roughness={0.5} metalness={0.3} />
          </mesh>
          <mesh position={[0, 1.62, 0.05]}>
            <boxGeometry args={[1.06, 0.98, 0.02]} />
            <meshStandardMaterial color={mix(palette.table, '#ffffff', 0.5)} roughness={0.75} />
          </mesh>
        </>
      ) : null}

      {style === 'floral_guestbook' ? (
        <>
          <mesh position={[0, 0.37, 0]}>
            <cylinderGeometry args={[0.52, 0.52, 0.74, 16]} />
            <meshStandardMaterial color={palette.chairs ?? mix(palette.table, '#ffffff', 0.3)} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.76, 0]}>
            <cylinderGeometry args={[0.56, 0.56, 0.04, 16]} />
            <meshStandardMaterial color={mix(palette.table, '#ffffff', 0.45)} roughness={0.6} />
          </mesh>
          <BlossomInstances
            points={Array.from({ length: 16 }).map((_, i) => {
              const a = (i / 16) * Math.PI * 2;
              const r = 0.3 + ((i * 5) % 4) * 0.06;
              return new THREE.Vector3(Math.cos(a) * r, 0.9 + ((i * 3) % 4) * 0.05, Math.sin(a) * r);
            })}
            colorA={bloom}
            colorB={bloomSecondary(palette, bloom, 0.4)}
            radius={0.11}
          />
        </>
      ) : null}
    </group>
        );
      })}
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TABLE CENTREPIECES (instanced across every table)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * One centrepiece per table per the `tables.centerpiece` treatment. Tall/low
 * florals = a blossom cluster on a stem; candles = small emissive cylinders;
 * candelabra = a branched form; greenery = a low leaf mound; lanterns = a warm
 * lantern. Blossoms + candle flames are instanced ACROSS all tables (one draw),
 * so a 15-table room adds ~2 draws, not 15.
 */
function Centerpieces({
  tables,
  room,
  palette,
  quality,
  variant,
}: {
  tables: Lab3DTable[];
  room: Room;
  palette: Lab3DPalette;
  quality: DecorQuality;
  variant: string;
}) {
  const centers = useMemo(
    () => tables.map((t) => pctToWorld(t.xPct, t.yPct, room)),
    [tables, room],
  );
  const bloom = useMemo(() => bloomColor(palette), [palette]);
  const leaf = useMemo(() => leafColor(palette), [palette]);
  const flame = '#ffcf7a';

  // Blossom points across every table (tall/low florals + candelabra tips).
  const blossomPoints = useMemo(() => {
    if (variant !== 'tall' && variant !== 'low') return [];
    const h = variant === 'tall' ? 1.15 : 0.55;
    const pts: THREE.Vector3[] = [];
    const per = quality === 'low' ? 5 : 9;
    for (const c of centers) {
      for (let i = 0; i < per; i++) {
        const a = (i / per) * Math.PI * 2;
        const r = 0.16 + (i % 2) * 0.08;
        pts.push(new THREE.Vector3(c.x + Math.cos(a) * r, h + (i % 3) * 0.08, c.z + Math.sin(a) * r));
      }
    }
    return pts;
  }, [centers, variant, quality]);

  // Candle flame points (candles + candelabra).
  const flamePoints = useMemo(() => {
    if (variant !== 'candles' && variant !== 'candelabra') return [];
    const pts: THREE.Vector3[] = [];
    const per = variant === 'candelabra' ? 5 : 3;
    const baseH = variant === 'candelabra' ? 0.95 : 0.42;
    for (const c of centers) {
      for (let i = 0; i < per; i++) {
        const a = (i / per) * Math.PI * 2;
        const r = variant === 'candelabra' ? 0.28 : 0.12;
        pts.push(new THREE.Vector3(c.x + Math.cos(a) * r, baseH, c.z + Math.sin(a) * r));
      }
    }
    return pts;
  }, [centers, variant]);

  return (
    <group>
      {/* Per-table stems / stands / bases (cheap primitives). */}
      {centers.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]}>
          {(variant === 'tall' || variant === 'low') && (
            <mesh position={[0, (variant === 'tall' ? 1.15 : 0.55) / 2 + 0.74, 0]} castShadow>
              <cylinderGeometry args={[0.035, 0.05, variant === 'tall' ? 1.15 : 0.55, 8]} />
              <meshStandardMaterial color={mix(palette.wall, '#000', 0.2)} roughness={0.7} />
            </mesh>
          )}
          {variant === 'candelabra' && <Candelabra palette={palette} />}
          {variant === 'candles' &&
            [0, 1, 2].map((k) => {
              const a = (k / 3) * Math.PI * 2;
              return (
                <mesh key={k} position={[Math.cos(a) * 0.12, 0.74 + 0.18, Math.sin(a) * 0.12]} castShadow>
                  <cylinderGeometry args={[0.04, 0.045, 0.36, 8]} />
                  <meshStandardMaterial color={mix(palette.table, '#ffffff', 0.4)} roughness={0.5} />
                </mesh>
              );
            })}
          {variant === 'greenery_runner' || variant === 'greenery' ? (
            <mesh position={[0, 0.86, 0]} castShadow>
              <sphereGeometry args={[0.3, 10, 8]} />
              <meshStandardMaterial color={leaf} roughness={0.95} />
            </mesh>
          ) : null}
          {variant === 'lanterns' ? (
            <mesh position={[0, 0.98, 0]} castShadow>
              <cylinderGeometry args={[0.16, 0.16, 0.34, 10]} />
              <meshStandardMaterial color={mix(palette.accent, '#fff4e0', 0.5)} emissive={mix(palette.accent, '#fff4e0', 0.5)} emissiveIntensity={quality === 'high' ? 0.5 : 0.25} roughness={0.6} />
            </mesh>
          ) : null}
        </group>
      ))}

      {blossomPoints.length > 0 ? (
        <BlossomInstances points={blossomPoints} colorA={bloom} colorB={bloomSecondary(palette, bloom, 0.4)} radius={0.11} />
      ) : null}
      {/* Emissive flames drop on 'low' — candles keep their wax bodies, no glow draw. */}
      {flamePoints.length > 0 && quality === 'high' ? (
        <FlameInstances points={flamePoints} color={flame} />
      ) : null}
    </group>
  );
}

function Candelabra({ palette }: { palette: Lab3DPalette }) {
  const metal = mix(palette.accent, '#000', 0.05);
  return (
    <group position={[0, 0.74, 0]}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.06, 0.9, 8]} />
        <meshStandardMaterial color={metal} roughness={0.35} metalness={0.7} />
      </mesh>
      {[-0.28, 0, 0.28].map((x, i) => (
        <mesh key={i} position={[x, 0.9, 0]} castShadow>
          <cylinderGeometry args={[0.028, 0.03, 0.24, 8]} />
          <meshStandardMaterial color={mix(palette.table, '#ffffff', 0.4)} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SHARED INSTANCED PRIMITIVES
// ═════════════════════════════════════════════════════════════════════════════

/** A cloud of blossom spheres at the given world points, two-tone for depth.
 *  ONE InstancedMesh for the whole set. */
function BlossomInstances({
  points,
  colorA,
  colorB,
  radius,
}: {
  points: THREE.Vector3[];
  colorA: string;
  colorB: string;
  radius: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = points.length;
  const ca = useMemo(() => new THREE.Color(colorA), [colorA]);
  const cb = useMemo(() => new THREE.Color(colorB), [colorB]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      p.copy(points[i]!);
      const sc = 0.8 + ((i * 37) % 10) / 22; // deterministic size jitter
      s.setScalar(sc);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      c.copy(i % 2 === 0 ? ca : cb);
      mesh.setColorAt(i, c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [points, count, ca, cb]);
  return (
    <instancedMesh key={`blossom-${count}`} ref={ref} args={[undefined, undefined, count]} frustumCulled={false} castShadow>
      <sphereGeometry args={[radius, 7, 6]} />
      <meshStandardMaterial color="#ffffff" roughness={0.85} />
    </instancedMesh>
  );
}

/** Warm candle flames — one InstancedMesh of tiny emissive cones. */
function FlameInstances({ points, color }: { points: THREE.Vector3[]; color: string }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = points.length;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < count; i++) {
      p.copy(points[i]!);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [points, count]);
  return (
    <instancedMesh key={`flame-${count}`} ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <coneGeometry args={[0.03, 0.1, 6]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.2} toneMapped={false} />
    </instancedMesh>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// GEOMETRY / LAYOUT HELPERS (pure)
// ═════════════════════════════════════════════════════════════════════════════

const CEILING_Y = 3.6;

/** A padded grid of hang points across the room (chandeliers / lanterns). */
function gridHangPoints(room: Room, target: number): THREE.Vector3[] {
  const cols = Math.max(2, Math.round(Math.sqrt(target * (room.w / room.d))));
  const rows = Math.max(2, Math.round(target / cols));
  const pts: THREE.Vector3[] = [];
  const padX = room.w * 0.16;
  const padZ = room.d * 0.16;
  const spanX = room.w - padX * 2;
  const spanZ = room.d - padZ * 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -spanX / 2 + (cols === 1 ? spanX / 2 : (spanX / (cols - 1)) * c);
      const z = -spanZ / 2 + (rows === 1 ? spanZ / 2 : (spanZ / (rows - 1)) * r);
      pts.push(new THREE.Vector3(x, CEILING_Y, z));
    }
  }
  return pts;
}

/** Catenary string-light runs across the room's width, sagging between the two
 *  long walls. Returns sampled bulb points + the polyline of each sag for wires. */
function catenaryRuns(room: Room): { bulbs: THREE.Vector3[]; sags: THREE.Vector3[][] } {
  const runs = Math.max(3, Math.round(room.d / 3.5));
  const bulbs: THREE.Vector3[] = [];
  const sags: THREE.Vector3[][] = [];
  const topY = CEILING_Y - 0.2;
  const sagDepth = 0.9;
  for (let r = 0; r < runs; r++) {
    const z = -room.d / 2 + (room.d / (runs + 1)) * (r + 1);
    const line: THREE.Vector3[] = [];
    const segs = 14;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs; // 0..1 across width
      const x = -room.w / 2 + t * room.w;
      // Parabolic sag (cheap stand-in for a true catenary).
      const y = topY - sagDepth * (1 - Math.pow(2 * t - 1, 2));
      const v = new THREE.Vector3(x, y, z);
      line.push(v);
      if (i % 2 === 0 && i > 0 && i < segs) bulbs.push(v.clone());
    }
    sags.push(line);
  }
  return { bulbs, sags };
}

/** Points hugging the inner face of a floral entrance arch (half-torus). */
function archRingPoints(radius: number, cy: number, n: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = Math.PI * (i / n); // 0..π (half arch)
    pts.push(new THREE.Vector3(Math.cos(a) * radius, cy - Math.sin(a) * radius + radius, 0));
  }
  return pts;
}

/** A jittered grid of blossom points filling a w×h backdrop wall (local coords,
 *  centred on the wall). */
function blossomGrid(w: number, h: number, cols: number, rows: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const jx = (((r * 31 + c * 17) % 7) / 7 - 0.5) * (w / cols) * 0.6;
      const jy = (((r * 13 + c * 29) % 7) / 7 - 0.5) * (h / rows) * 0.6;
      const x = -w / 2 + (w / cols) * (c + 0.5) + jx;
      const y = -h / 2 + (h / rows) * (r + 0.5) + jy;
      pts.push(new THREE.Vector3(x, y, 0.02));
    }
  }
  return pts;
}

/** A gently curved vertical panel (drape) — a thin box bent along its width. */
function curvedPanelGeo(w: number, h: number, bow: number): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(w, h, 6, 1);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const t = x / (w / 2); // -1..1
    pos.setZ(i, -bow * (1 - t * t)); // bow toward the room
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Open-air archetypes have no slab to hang ceiling decor from. */
function isOpenAir(archetype: VenueArchetype | undefined): boolean {
  return archetype === 'garden' || archetype === 'beach' || archetype === 'rooftop';
}

/**
 * True when the couple's ceiling choice already renders HUNG decor in the
 * ~2.2–3.4 m band (fairy-light runs, chandelier crystals, lanterns, hanging
 * florals/greenery — mirroring EXACTLY the mount conditions in VenueDecor
 * below, open-air suppression included). The cinematic Play string lights
 * (kit/string-lights.tsx) occupy the same band, so their call sites skip
 * mounting when this returns true: a fairy_lights choice would otherwise
 * double up two near-identical string systems, and the other treatments would
 * have strands threading through crystals/floral clusters.
 */
export function ceilingDecorOccupied(
  design: ReceptionDesign | null | undefined,
  archetype: VenueArchetype | undefined,
): boolean {
  if (!design) return false;
  const ceiling = sel(design, 'ceiling', 'treatment');
  if (ceiling === 'fairy_lights') return true;
  return (
    !isOpenAir(archetype) &&
    (ceiling === 'chandeliers' ||
      ceiling === 'lanterns' ||
      ceiling === 'hanging_florals' ||
      ceiling === 'hanging_greenery')
  );
}

/**
 * EXACTLY the part+attributes `VenueDecor` draws — nothing more.
 *
 * The reception catalogue has ten parts and sixteen attributes; this room
 * renders SEVEN of them. It draws no stage florals, no aisle runner and no
 * backdrop-floral overlay — those live only in the 2D scene today.
 *
 * 🔑 THIS LIST EXISTS SO THE ROOM'S LEGEND CANNOT LIE ABOUT WHAT IS ON SCREEN.
 * `primaryOnlyNotice` says "showing X" about a couple's multi-selection, and a
 * first cut of it walked every part — which told a couple *"Stage (showing
 * Arch)"* about a stage this room does not draw at all. The disclosure may only
 * speak about what is actually rendered, so it is handed this list, and
 * `the-room-draws-what-the-couple-saved.test.ts` pins the list to the `sel()`
 * calls in this file. Add a `sel(design, …)` below without adding it here and
 * that test goes red.
 */
export const ROOM_DRAWN_ATTRIBUTES: ReadonlyArray<DrawnAttribute> = [
  ['ceiling', 'treatment'],
  ['backdrop', 'style'],
  ['tables', 'centerpiece'],
  ['tunnel', 'style'],
  ['walls', 'treatment'],
  ['photo_wall', 'style'],
  ['welcome_signage', 'style'],
] as const;

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC: VenueDecor — one call renders every reception_design treatment.
// ═════════════════════════════════════════════════════════════════════════════

export function VenueDecor({
  design,
  floor,
  tables,
  room,
  palette,
  quality = 'high',
  archetype = 'banquet_hall',
  tunnelProgressRef,
}: {
  /** `events.reception_design`. Empty `{}` (the default) → DEFAULT_DESIGN via `sel()`. */
  design: ReceptionDesign;
  floor: Lab3DFloor;
  tables: Lab3DTable[];
  room: Room;
  palette: Lab3DPalette;
  quality?: DecorQuality;
  /** Room archetype — open-air settings (garden/beach/rooftop) have no ceiling,
   *  so ceiling-HUNG decor (chandeliers/lanterns/hanging florals) is suppressed
   *  there; string lights stay (outdoor fairy-light canopies are strung, not
   *  hung from a slab). Pass the same value the surface gives `VenueShell`. */
  archetype?: VenueArchetype;
  /** Walker path-t along the entrance-tunnel segment (see `coldSparkProgress`)
   *  for walk-sequenced treatments like `cold_spark`; −1/absent = idle shimmer.
   *  Only walking surfaces (plan3d-scene) feed it — the lab/orbit views omit it. */
  tunnelProgressRef?: MutableRefObject<number>;
}) {
  // No ceiling → nothing to hang chandeliers/lanterns/floral clusters from.
  const openAir = isOpenAir(archetype);
  const ceiling = sel(design, 'ceiling', 'treatment');
  const backdrop = sel(design, 'backdrop', 'style');
  const centerpiece = sel(design, 'tables', 'centerpiece');
  const tunnel = sel(design, 'tunnel', 'style');
  // The three zones the room used to ignore entirely. `sel()` — the PRIMARY
  // treatment only, deliberately, because there is one physical wall / panel /
  // welcome table. What the room is therefore NOT drawing is disclosed to the
  // couple by `primaryOnlyNotice()` in the room's legend; see that function.
  const walls = sel(design, 'walls', 'treatment');
  const photoWall = sel(design, 'photo_wall', 'style');
  // The welcome table is MULTI-SELECT and holds several things at once. selAll
  // rather than sel, so the couple's whole table reaches the room; selAll(…)[0]
  // is sel(…) by construction, so this can only ever ADD pieces and never move
  // or replace the one already drawn. 'minimal' is the explicit "nothing here"
  // choice and is dropped from the list rather than rendered as an object.
  const welcomeStyles = useMemo(
    () => selAll(design, 'welcome_signage', 'style').filter((v) => v !== 'minimal'),
    [design],
  );

  const stageCenter = useMemo(() => {
    const s = pctToWorld(floor.stage.xPct, floor.stage.yPct, room);
    // Backdrop sits just behind the stage, toward the far wall.
    const depth = Math.max(1, (floor.stage.hPct / 100) * room.d);
    return new THREE.Vector3(s.x, 0, Math.max(s.z - depth / 2 - 0.2, -room.d / 2 + 0.3));
  }, [floor.stage, room]);
  const stageWidth = useMemo(
    () => Math.max(2.4, (floor.stage.wPct / 100) * room.w * 1.15),
    [floor.stage.wPct, room.w],
  );

  const entranceWorld = useMemo(() => {
    const e = floor.entrance.enabled ? floor.entrance : { xPct: 50, yPct: 96 };
    const w = pctToWorld(e.xPct, e.yPct, room);
    return new THREE.Vector3(w.x, 0, w.z);
  }, [floor.entrance, room]);

  const entranceVariant: 'floral' | 'draped' | 'greenery' | 'plain' =
    tunnel === 'none'
      ? 'plain'
      : tunnel === 'draped'
        ? 'draped'
        : tunnel === 'greenery'
          ? 'greenery'
          : tunnel === 'floral' || tunnel === 'cherry_blossom' || tunnel === 'butterfly'
            ? 'floral'
            : 'plain';

  return (
    <group>
      {/* Ceiling — hung fixtures only exist where there IS a ceiling; open-air
          archetypes keep string lights (strung, not slab-hung) and drop the rest. */}
      {!openAir && ceiling === 'chandeliers' && <Chandeliers room={room} palette={palette} quality={quality} />}
      {(ceiling === 'fairy_lights') && <StringLights room={room} palette={palette} />}
      {!openAir && ceiling === 'lanterns' && <Lanterns room={room} palette={palette} quality={quality} />}
      {!openAir && (ceiling === 'hanging_florals' || ceiling === 'hanging_greenery') && (
        <HangingFlorals room={room} palette={palette} quality={quality} greenery={ceiling === 'hanging_greenery'} />
      )}
      {/* 'draped' | 'geometric' | 'bare' → no ceiling decor (drape reads as the room itself) */}

      {/* Stage backdrop */}
      {(backdrop === 'draped') && <DrapedBackdrop center={stageCenter} width={stageWidth} palette={palette} />}
      {(backdrop === 'floral_wall' || backdrop === 'greenery') && (
        <FloralWall center={stageCenter} width={stageWidth} palette={palette} quality={quality} />
      )}
      {(backdrop === 'led' || backdrop === 'neon' || backdrop === 'marquee') && (
        <LedBackdrop center={stageCenter} width={stageWidth} palette={palette} />
      )}
      {/* moon_gate / balloon / fringe → left to the fixture layer / future 2b */}

      {/* Entrance treatment: evolved tunnels render their own build (tunnel
          catalog 2026-07-08 — cold_spark is ship-first #1); the rest keep the
          classic arch. The tunnel runs along the entrance approach (inward
          wall normal) — its machine-box obstacle discs are registered by each
          surface via `coldSparkObstacles` (the booth-disc pattern). */}
      {tunnel === 'cold_spark' ? (
        <ColdSparkTunnel
          entrance={{ x: entranceWorld.x, z: entranceWorld.z }}
          room={room}
          palette={palette}
          quality={quality}
          progressRef={tunnelProgressRef}
        />
      ) : entranceVariant !== 'plain' ? (
        <EntranceArch position={entranceWorld} palette={palette} variant={entranceVariant} />
      ) : null}

      {/* Walls & surroundings. 'bare' is the DEFAULT and draws nothing, which
          is why a board that never touched this zone is unchanged. Open-air
          archetypes have no side wall to dress (VenueShell replaces them with
          perimeter greenery), so the choice is kept and simply has nothing to
          hang on — same rule as the ceiling above. */}
      {!openAir && walls !== 'bare' && (
        <WallTreatment room={room} palette={palette} quality={quality} treatment={walls} />
      )}

      {/* Photo wall — the step-and-repeat, explicitly NOT the stage backdrop. */}
      {photoWall !== 'none' && (
        <PhotoWall room={room} palette={palette} quality={quality} style={photoWall} />
      )}

      {/* Welcome table by the door. */}
      {welcomeStyles.length > 0 && (
        <WelcomeSignage entrance={entranceWorld} room={room} palette={palette} styles={welcomeStyles} />
      )}

      {/* Table centrepieces (instanced across all tables) */}
      {tables.length > 0 && (
        <Centerpieces tables={tables} room={room} palette={palette} quality={quality} variant={centerpiece} />
      )}
    </group>
  );
}

/** Suspended hanging floral (or greenery) clusters — blossom instances dangling
 *  from ceiling grid points on short stems. */
function HangingFlorals({ room, palette, quality, greenery }: { room: Room; palette: Lab3DPalette; quality: DecorQuality; greenery: boolean }) {
  const anchors = useMemo(() => gridHangPoints(room, quality === 'low' ? 5 : 7), [room, quality]);
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const per = quality === 'low' ? 5 : 8;
    for (const a of anchors) {
      for (let i = 0; i < per; i++) {
        const t = i / per;
        pts.push(new THREE.Vector3(a.x + (Math.random() - 0.5) * 0.3, CEILING_Y - 0.3 - t * 1.1, a.z + (Math.random() - 0.5) * 0.3));
      }
    }
    return pts;
  }, [anchors, quality]);
  const bloom = greenery ? leafColor(palette) : bloomColor(palette);
  return <BlossomInstances points={points} colorA={bloom} colorB={bloomSecondary(palette, bloom, 0.35)} radius={0.14} />;
}

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC: VenueShell — archetype room shell (walls / background / floor tone).
// ═════════════════════════════════════════════════════════════════════════════

export type VenueArchetype =
  | 'banquet_hall'
  | 'garden'
  | 'beach'
  | 'chapel'
  | 'barn'
  | 'rooftop'
  | 'restaurant'
  | 'heritage'
  | 'civic';

/** Map the stored `events.venue_setting` (or any prop override) to an archetype.
 *  Unknown / null → banquet_hall (the DB default). */
export function archetypeFor(venueSetting: string | null | undefined): VenueArchetype {
  switch ((venueSetting ?? '').toLowerCase()) {
    case 'garden':
    case 'park':
      return 'garden';
    case 'beach':
    case 'poolside':
      return 'beach';
    case 'chapel':
    case 'church':
      return 'chapel';
    case 'barn':
    case 'farm':
    case 'outdoor_tent':
      return 'barn';
    case 'rooftop':
    case 'rooftop_bar':
      return 'rooftop';
    // RESTAURANT now has its own look (owner: "build it", 2026-08-06). It used
    // to share the `default:` line with everything unknown, which drew it as a
    // hotel ballroom — right in kind, wrong in character.
    case 'restaurant':
      return 'restaurant';
    // HERITAGE / HACIENDA — adobe walls and an arcade, not a ballroom.
    case 'heritage':
    case 'hacienda':
      return 'heritage';
    // CIVIL REGISTRAR — a small plain civic room. The defect being fixed is that
    // it read as GRAND: a registrar's office is the least grand room a couple
    // will stand in, and drawing it as a ballroom set the wrong expectation.
    case 'civil_registrar':
      return 'civic';
    // DESTINATION → the beach shell. ⚠ A JUDGEMENT CALL, and the corpus flagged
    // it as genuinely ambiguous: "destination" means AWAY FROM HOME, not a room
    // shape, and defaulting it to a ballroom was defensible. In the Philippines
    // a destination resort is overwhelmingly beachfront — Boracay, Palawan,
    // Bohol — so sand and water is the likelier truth for most couples, and it
    // costs no new drawing. Reversing it is one line if the owner disagrees.
    case 'destination':
      return 'beach';
    case 'banquet_hall':
    case 'ballroom':
    case 'hotel':
    default:
      return 'banquet_hall';
  }
}

/** Per-archetype floor tint (overrides `palette.floor` where the setting demands
 *  it — sand for beach, grass edge for garden). Returns null to keep the palette
 *  floor as-is. Still blended with the palette so a bold theme still reads. */
export function archetypeFloorColor(archetype: VenueArchetype, palette: Lab3DPalette): string {
  switch (archetype) {
    case 'beach':
      return mix('#e9dcc0', palette.floor, 0.35); // warm sand
    case 'garden':
      return mix('#cdd8c2', palette.floor, 0.4); // soft lawn-stone
    case 'barn':
      return mix('#c8b090', palette.floor, 0.4); // warm timber floor
    case 'rooftop':
      return mix('#c9cdd3', palette.floor, 0.45); // pale deck
    // ⚠ These three MUST be listed. Every branch here ends in `default:`, so a
    // new archetype type-checks with zero edits and silently inherits the
    // ballroom's floor — compiling green while looking wrong.
    case 'restaurant':
      return mix('#8f7a63', palette.floor, 0.35); // dark timber / parquet
    case 'heritage':
      return mix('#b9a184', palette.floor, 0.4); // worn terracotta tile
    case 'civic':
      return mix('#c4c6c9', palette.floor, 0.4); // plain municipal vinyl
    default:
      return palette.floor;
  }
}

/** Per-archetype scene background/fog colour — the sky or room ambiance behind
 *  the walls. Surfaces spread this onto their <color attach="background">. */
export function archetypeBackground(archetype: VenueArchetype): string {
  switch (archetype) {
    case 'garden':
      return '#b9d3e6'; // soft daytime sky
    case 'beach':
      return '#bfe0e6'; // pale horizon
    case 'rooftop':
      return '#3a3350'; // dusk
    case 'chapel':
      return '#141118'; // warm dark
    case 'barn':
      return '#171410';
    case 'restaurant':
      return '#191512'; // warm, low-lit interior
    case 'heritage':
      return '#1b1611'; // candle-warm stone
    case 'civic':
      return '#171a1e'; // cool, plain, daylight-lit
    default:
      return '#13151c';
  }
}

/**
 * The archetype room shell — walls / trusses / parapet / greenery / windows /
 * sky per `venue_setting`. Drop inside a Canvas ABOVE the floor + fixtures. It
 * renders ONLY the archetype-specific shell (perimeter + overhead); the floor
 * plane, stage, grid, monogram and entrance stay owned by each surface (so the
 * lab's editing affordances keep working). Every piece is a handful of meshes or
 * one InstancedMesh — cheap on phones.
 */
export function VenueShell({
  archetype,
  room,
  palette,
  quality = 'high',
}: {
  archetype: VenueArchetype;
  room: Room;
  palette: Lab3DPalette;
  quality?: DecorQuality;
}) {
  switch (archetype) {
    case 'garden':
      return <GardenShell room={room} palette={palette} quality={quality} />;
    case 'beach':
      return <BeachShell room={room} palette={palette} />;
    case 'chapel':
      return <ChapelShell room={room} palette={palette} />;
    case 'barn':
      return <BarnShell room={room} palette={palette} />;
    case 'rooftop':
      return <RooftopShell room={room} palette={palette} />;
    case 'restaurant':
      return <RestaurantShell room={room} palette={palette} />;
    case 'heritage':
      return <HeritageShell room={room} palette={palette} />;
    case 'civic':
      return <CivicShell room={room} palette={palette} />;
    case 'banquet_hall':
    default:
      return <BanquetShell room={room} palette={palette} />;
  }
}

/** Banquet hall — solid perimeter walls + a flat ceiling plane (the "current"
 *  room, now with a real ceiling so chandeliers hang from something). */
function BanquetShell({ room, palette }: { room: Room; palette: Lab3DPalette }) {
  const wallColor = mix(palette.wall, '#ffffff', 0.15);
  const h = CEILING_Y;
  return (
    <group>
      <PerimeterWalls room={room} height={h} color={wallColor} opacity={0.92} />
      {/* Ceiling wash — the plane's normal points DOWN into the room, rendered
          FrontSide so a guest walking inside sees a lit ceiling overhead while
          the top-down orbit/overview camera (above it) has its face culled and
          looks straight through into the room. */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, h, 0]}>
        <planeGeometry args={[room.w, room.d]} />
        <meshStandardMaterial color={mix(palette.wall, '#ffffff', 0.3)} roughness={0.95} side={THREE.FrontSide} />
      </mesh>
    </group>
  );
}

/** Restaurant — an enclosed room that is SMALLER and LOWER than a ballroom, with
 *  a bar counter along one wall and a warm window band. The character is the
 *  whole point: a restaurant reception is close-packed and bar-led, and drawing
 *  it as a hotel ballroom told a couple their venue was something it is not. */
function RestaurantShell({ room, palette }: { room: Room; palette: Lab3DPalette }) {
  const wallColor = mix(palette.wall, '#7a4f33', 0.22); // warmer than the ballroom
  const h = CEILING_Y - 0.6; // lower ceiling — the main cue that this is not a hall
  const barLen = Math.min(room.w * 0.5, 6);
  return (
    <group>
      <PerimeterWalls room={room} height={h} color={wallColor} opacity={0.94} />
      {/* Bar counter along the far wall — the one piece of furniture that reads
          "restaurant" instantly from across the room. */}
      <mesh position={[0, 0.55, -room.d / 2 + 0.45]}>
        <boxGeometry args={[barLen, 1.1, 0.6]} />
        <meshStandardMaterial color={mix('#4a3325', palette.wall, 0.25)} roughness={0.7} />
      </mesh>
      {/* Warm window band on the long wall. */}
      <mesh position={[room.w / 2 - 0.06, h * 0.62, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[room.d * 0.75, 0.85]} />
        <meshStandardMaterial color="#f0c98a" emissive="#f0c98a" emissiveIntensity={0.45} roughness={1} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, h, 0]}>
        <planeGeometry args={[room.w, room.d]} />
        <meshStandardMaterial color={mix(wallColor, '#000000', 0.35)} roughness={0.95} side={THREE.FrontSide} />
      </mesh>
    </group>
  );
}

/** Heritage / hacienda — adobe walls, a run of arcade columns, capiz-warm
 *  windows and a HIGHER ceiling. Ancestral houses and restored haciendas are the
 *  Philippine heritage venue, and their signature is the arcade. */
function HeritageShell({ room, palette }: { room: Room; palette: Lab3DPalette }) {
  const adobe = mix(palette.wall, '#c2a887', 0.45);
  const h = CEILING_Y + 0.8; // taller than a ballroom — these rooms are lofty
  const columns = useMemo(() => {
    const out: [number, number][] = [];
    const n = Math.max(3, Math.min(6, Math.round(room.d / 3)));
    for (let i = 0; i < n; i++) {
      const z = -room.d / 2 + ((i + 1) * room.d) / (n + 1);
      out.push([-room.w / 2 + 1.1, z]);
      out.push([room.w / 2 - 1.1, z]);
    }
    return out;
  }, [room]);
  return (
    <group>
      <PerimeterWalls room={room} height={h} color={adobe} opacity={0.95} />
      {columns.map(([x, z], i) => (
        <mesh key={i} position={[x, h / 2, z]}>
          <cylinderGeometry args={[0.22, 0.26, h, 10]} />
          <meshStandardMaterial color={mix(adobe, '#ffffff', 0.22)} roughness={0.9} />
        </mesh>
      ))}
      {/* Capiz-tone window band — the warm shell light of an ancestral house. */}
      <mesh position={[0, h * 0.66, -room.d / 2 + 0.06]}>
        <planeGeometry args={[room.w * 0.7, 1.1]} />
        <meshStandardMaterial color="#f3e3c0" emissive="#f3e3c0" emissiveIntensity={0.4} roughness={1} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, h, 0]}>
        <planeGeometry args={[room.w, room.d]} />
        <meshStandardMaterial color={mix(adobe, '#000000', 0.3)} roughness={0.95} side={THREE.FrontSide} />
      </mesh>
    </group>
  );
}

/** Civil registrar — a small, plain, cool civic room with a LOW ceiling.
 *  Deliberately modest: the defect being fixed is that this read as grand, and a
 *  registrar's office is the least grand room a couple will ever stand in.
 *  Showing it as a ballroom set an expectation the day cannot meet. */
function CivicShell({ room, palette }: { room: Room; palette: Lab3DPalette }) {
  const wallColor = mix(palette.wall, '#dfe3e8', 0.5); // cool, plain
  const h = CEILING_Y - 0.8; // the lowest ceiling of any archetype
  return (
    <group>
      <PerimeterWalls room={room} height={h} color={wallColor} opacity={0.96} />
      <mesh position={[room.w / 2 - 0.06, h * 0.6, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[room.d * 0.5, 0.9]} />
        <meshStandardMaterial color="#dceaf5" emissive="#dceaf5" emissiveIntensity={0.3} roughness={1} />
      </mesh>
      {/* Flat ceiling, NO wash — the wash is what makes the ballroom feel grand. */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, h, 0]}>
        <planeGeometry args={[room.w, room.d]} />
        <meshStandardMaterial color={mix(wallColor, '#000000', 0.12)} roughness={0.98} side={THREE.FrontSide} />
      </mesh>
    </group>
  );
}

/** Garden — NO walls. A ring of instanced shrubs + a few taller trees around the
 *  perimeter, open to the sky background the surface sets. */
function GardenShell({ room, palette, quality }: { room: Room; palette: Lab3DPalette; quality: DecorQuality }) {
  const leaf = useMemo(() => leafColor(palette), [palette]);
  const darkLeaf = useMemo(() => mix(leaf, '#000', 0.25), [leaf]);
  const shrubs = useMemo(() => perimeterRing(room, quality === 'low' ? 22 : 40, 0.6), [room, quality]);
  const trees = useMemo(() => perimeterRing(room, quality === 'low' ? 5 : 8, 1.4), [room, quality]);
  return (
    <group>
      <ShrubInstances points={shrubs} color={leaf} />
      {trees.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh position={[0, 1.0, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.16, 2.0, 8]} />
            <meshStandardMaterial color={mix('#7a5b3a', palette.accent, 0.1)} roughness={0.9} />
          </mesh>
          <mesh position={[0, 2.5, 0]} castShadow>
            <sphereGeometry args={[1.05, 10, 9]} />
            <meshStandardMaterial color={darkLeaf} roughness={0.95} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Beach — no solid walls; a low horizon band + a subtle water plane beyond the
 *  floor. The sand floor tint comes from `archetypeFloorColor`. */
function BeachShell({ room, palette }: { room: Room; palette: Lab3DPalette }) {
  const water = mix('#5fa8bf', palette.accent, 0.1);
  return (
    <group>
      {/* Water plane on the far side, just below floor level, wide + calm. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, -room.d / 2 - room.d * 0.5]}>
        <planeGeometry args={[room.w * 4, room.d]} />
        <meshStandardMaterial color={water} roughness={0.2} metalness={0.3} transparent opacity={0.85} />
      </mesh>
      {/* A faint sand berm ring so the edges read as a beach, not a void. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[Math.min(room.w, room.d) / 2, Math.max(room.w, room.d) / 2 + 4, 40]} />
        <meshStandardMaterial color={mix('#e9dcc0', palette.floor, 0.3)} roughness={1} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Chapel / church — taller, narrower shell with warm glowing "window" panels
 *  down the two long walls and a peaked roof line hint. */
function ChapelShell({ room, palette }: { room: Room; palette: Lab3DPalette }) {
  const h = CEILING_Y + 2.2; // taller nave
  const wallColor = mix(palette.wall, '#ffffff', 0.1);
  const glow = mix(palette.accent, '#ffe6b0', 0.5);
  const windows = useMemo(() => {
    const n = Math.max(3, Math.round(room.d / 4));
    const out: { x: number; z: number }[] = [];
    for (let i = 0; i < n; i++) {
      const z = -room.d / 2 + (room.d / (n + 1)) * (i + 1);
      out.push({ x: -room.w / 2 + 0.08, z });
      out.push({ x: room.w / 2 - 0.08, z });
    }
    return out;
  }, [room]);
  return (
    <group>
      <PerimeterWalls room={room} height={h} color={wallColor} opacity={0.95} />
      {/* Warm arched window glow panels. */}
      {windows.map((w, i) => (
        <mesh key={i} position={[w.x, h * 0.55, w.z]} rotation={[0, w.x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
          <planeGeometry args={[1.4, h * 0.5]} />
          <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={0.9} roughness={0.4} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* Peaked roof ridge (two sloped planes). */}
      <mesh rotation={[Math.PI / 2 - 0.5, 0, 0]} position={[0, h + 0.6, -room.d / 4]}>
        <planeGeometry args={[room.w, room.d / 1.6]} />
        <meshStandardMaterial color={mix(palette.wall, '#000', 0.1)} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Barn — warm wood-tone perimeter walls + exposed A-frame roof trusses. */
function BarnShell({ room, palette }: { room: Room; palette: Lab3DPalette }) {
  const h = CEILING_Y + 0.6;
  const wood = mix('#9a6f43', palette.accent, 0.12);
  const beam = mix('#6f4d2c', palette.accent, 0.08);
  const trusses = useMemo(() => {
    const n = Math.max(3, Math.round(room.d / 3.2));
    return Array.from({ length: n }, (_, i) => -room.d / 2 + (room.d / (n + 1)) * (i + 1));
  }, [room]);
  return (
    <group>
      <PerimeterWalls room={room} height={h} color={wood} opacity={1} roughness={0.95} />
      {/* A-frame trusses across the width. */}
      {trusses.map((z, i) => (
        <group key={i} position={[0, h, z]}>
          <mesh position={[-room.w / 4, 0.7, 0]} rotation={[0, 0, -0.5]} castShadow>
            <boxGeometry args={[room.w / 1.7, 0.12, 0.12]} />
            <meshStandardMaterial color={beam} roughness={0.9} />
          </mesh>
          <mesh position={[room.w / 4, 0.7, 0]} rotation={[0, 0, 0.5]} castShadow>
            <boxGeometry args={[room.w / 1.7, 0.12, 0.12]} />
            <meshStandardMaterial color={beam} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0, 0]} castShadow>
            <boxGeometry args={[room.w, 0.12, 0.12]} />
            <meshStandardMaterial color={beam} roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Rooftop — low solid parapet walls (no full-height shell), open to the dusk
 *  sky the surface sets. */
function RooftopShell({ room, palette }: { room: Room; palette: Lab3DPalette }) {
  const parapet = mix(palette.wall, '#000', 0.15);
  const h = 1.0;
  return (
    <group>
      <PerimeterWalls room={room} height={h} color={parapet} opacity={0.95} roughness={0.85} solidCap />
      {/* A warm coping rail along the parapet top. */}
      {[
        { p: [0, h, -room.d / 2] as const, s: [room.w, 0.1, 0.2] as const },
        { p: [0, h, room.d / 2] as const, s: [room.w, 0.1, 0.2] as const },
        { p: [-room.w / 2, h, 0] as const, s: [0.2, 0.1, room.d] as const },
        { p: [room.w / 2, h, 0] as const, s: [0.2, 0.1, room.d] as const },
      ].map((r, i) => (
        <mesh key={i} position={r.p}>
          <boxGeometry args={r.s} />
          <meshStandardMaterial color={mix(palette.accent, '#000', 0.1)} roughness={0.5} metalness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Four perimeter walls, rendered as INWARD-FACING planes (THREE.BackSide). This
 * is the architectural-cutaway trick: from an orbit camera OUTSIDE the room the
 * near wall's back face is culled, so you see straight into the room (no wall
 * ever paints over the tables) — while a guest standing INSIDE still sees a
 * solid, lit enclosure on every side. `solidCap` (parapets) keeps the walls
 * opaque + low so they read as a ledge; otherwise a gentle translucency softens
 * the far walls. `receiveShadow` on so the key light grounds the room.
 */
function PerimeterWalls({
  room,
  height,
  color,
  opacity,
  roughness = 0.95,
  solidCap = false,
}: {
  room: Room;
  height: number;
  color: string;
  opacity: number;
  roughness?: number;
  solidCap?: boolean;
}) {
  // Each wall is a plane whose NORMAL points INTO the room (front face toward the
  // centre). Rendered FrontSide: the near wall (its normal pointing away from an
  // outside orbit camera) is culled → the camera sees straight in; the far walls
  // (normals toward the camera) render → the room reads as enclosed. A guest
  // standing INSIDE sees every wall's front face → a solid enclosure. Parapets
  // (solidCap) stay double-sided so the low ledge reads from any angle.
  const walls: { p: readonly [number, number, number]; ry: number; w: number }[] = [
    { p: [0, height / 2, -room.d / 2], ry: 0, w: room.w },
    { p: [0, height / 2, room.d / 2], ry: Math.PI, w: room.w },
    { p: [-room.w / 2, height / 2, 0], ry: Math.PI / 2, w: room.d },
    { p: [room.w / 2, height / 2, 0], ry: -Math.PI / 2, w: room.d },
  ];
  return (
    <group>
      {walls.map((wall, i) => (
        <mesh key={i} position={wall.p as [number, number, number]} rotation={[0, wall.ry, 0]} receiveShadow>
          <planeGeometry args={[wall.w, height]} />
          <meshStandardMaterial
            color={color}
            roughness={roughness}
            side={solidCap ? THREE.DoubleSide : THREE.FrontSide}
            transparent={!solidCap && opacity < 1}
            opacity={solidCap ? 1 : opacity}
          />
        </mesh>
      ))}
    </group>
  );
}

/** A ring of leafy shrubs around the room perimeter — one InstancedMesh. */
function ShrubInstances({ points, color }: { points: THREE.Vector3[]; color: string }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = points.length;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      p.copy(points[i]!);
      const sc = 0.8 + ((i * 53) % 10) / 16;
      s.set(sc, sc * 0.85, sc);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [points, count]);
  return (
    <instancedMesh key={`shrub-${count}`} ref={ref} args={[undefined, undefined, count]} frustumCulled={false} castShadow>
      <sphereGeometry args={[0.45, 8, 7]} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </instancedMesh>
  );
}

/** Points spread just outside the room perimeter for greenery/shrub rings. */
function perimeterRing(room: Room, n: number, offset: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const hw = room.w / 2 + offset;
  const hd = room.d / 2 + offset;
  const perim = 2 * (room.w + room.d);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * perim;
    let x: number, z: number;
    if (t < room.w) {
      x = -hw + (t / room.w) * room.w * (hw / (room.w / 2));
      x = -hw + (t / room.w) * (room.w + offset * 2) - offset;
      z = -hd;
    } else if (t < room.w + room.d) {
      x = hw;
      z = -hd + ((t - room.w) / room.d) * (room.d + offset * 2) - offset;
    } else if (t < 2 * room.w + room.d) {
      x = hw - ((t - room.w - room.d) / room.w) * (room.w + offset * 2) + offset;
      z = hd;
    } else {
      x = -hw;
      z = hd - ((t - 2 * room.w - room.d) / room.d) * (room.d + offset * 2) + offset;
    }
    // jitter outward a touch
    const jit = ((i * 41) % 7) / 7 - 0.5;
    pts.push(new THREE.Vector3(x + jit * 0.3, 0.35, z + jit * 0.3));
  }
  return pts;
}

