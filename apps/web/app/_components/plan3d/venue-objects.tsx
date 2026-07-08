'use client';

/**
 * Shared, READ-ONLY 3D renderers for the couple's placed VENUE FIXTURES —
 * everything on the seat-plan canvas that isn't a guest table: the 10
 * VENUE_OBJECT_CATALOG kinds (arch / buffet / bar / cake & gift & registration
 * tables / photo booth / lounge / LED wall / greenery), vendor BOOTHS
 * (event_floor_booths), wayfinding SIGNS (event_floor_signs) and the cocktail /
 * waiting ROOM (event_floor_plan.cocktail_*).
 *
 * One module, three call sites (owner 2026-06-26 "make full use of this so our
 * edit is not just a seat plan"): the couple 3D lab, the homepage 3D-Plan demo,
 * and the public guest venue explorer. Each passes its own `Lab3DPalette`, so a
 * Wave-2 mood-board recolour picks the fixtures up automatically — the same
 * discipline the shared `TableMesh` follows.
 *
 * Tasteful low-poly primitives on purpose (the demo is a homepage overlay; the
 * guest walk runs on phones): boxes / cylinders / cones, no fetched assets
 * (the cocktail floor shares the procedural roughness map only), no troika
 * text (so nothing fetches a font at runtime). Labels are color-coded panels the
 * surfaces' existing HTML-HUD conventions complement — the fixture READS as what
 * it is from its silhouette + accent colour. Footprints come from
 * `venueObjectDims` (metres); every fixture respects its stored `rotationDeg`.
 *
 * Pure presentational — no DB, no state, no editing. Dragging/adding these stays
 * with the 2D editor + the couple lab's own table tooling.
 */

import { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { floorRoughnessMap } from '@/app/_components/plan3d/scene-lighting';
import {
  pctToWorld,
  venueObjectDims,
  BOOTH_FOOTPRINT_M,
  boothCanBrand,
  type Lab3DPalette,
  type Lab3DSceneObject,
  type Lab3DBooth,
  type Lab3DSign,
  type Lab3DCocktail,
} from '@/lib/seating-3d';
import { BoothTemplate } from '@/app/_components/plan3d/kit/booth-template';
import { boothTemplateFor } from '@/app/_components/plan3d/kit/booth-templates';
import { CHASSIS_SPECS } from '@/app/_components/plan3d/kit/booth-chassis';

type Room = { w: number; d: number };

/** Convert a stored rotation (degrees, clockwise on the 2D canvas) to the scene
 *  Y-rotation the rest of the lab uses (`-deg` in radians — matches TableMesh). */
function ry(deg: number): number {
  return (-deg * Math.PI) / 180;
}

/**
 * One placed venue object, rendered as a small low-poly prop sized to its
 * catalog footprint. A `switch` on kind picks the silhouette; unknown kinds fall
 * back to a plain slab so a future catalog addition still shows up.
 */
export function SceneObjectMesh({
  object,
  room,
  palette,
}: {
  object: Lab3DSceneObject;
  room: Room;
  palette: Lab3DPalette;
}) {
  const pos = useMemo(() => pctToWorld(object.xPct, object.yPct, room), [object.xPct, object.yPct, room]);
  const { w, d } = venueObjectDims(object.kind);

  return (
    <group position={[pos.x, 0, pos.z]} rotation={[0, ry(object.rotationDeg), 0]}>
      {renderKind(object.kind, w, d, palette)}
    </group>
  );
}

function renderKind(kind: string, w: number, d: number, palette: Lab3DPalette) {
  switch (kind) {
    case 'arch':
      // Two posts + a curved lintel (a torus half) — the ceremony arch.
      return (
        <group>
          <mesh position={[-w / 2 + 0.12, 1.1, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.09, 2.2, 10]} />
            <meshStandardMaterial color={palette.wall} roughness={0.8} />
          </mesh>
          <mesh position={[w / 2 - 0.12, 1.1, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.09, 2.2, 10]} />
            <meshStandardMaterial color={palette.wall} roughness={0.8} />
          </mesh>
          <mesh position={[0, 2.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[w / 2 - 0.12, 0.09, 8, 20, Math.PI]} />
            <meshStandardMaterial color={palette.accent} roughness={0.6} />
          </mesh>
        </group>
      );
    case 'led_wall':
      // A tall thin emissive panel — the LED wall (metal frame grade, Wave 2a).
      return (
        <mesh position={[0, 1.4, 0]} castShadow>
          <boxGeometry args={[w, 2.8, Math.max(0.12, d)]} />
          <meshStandardMaterial color="#10131b" emissive={palette.accent} emissiveIntensity={0.45} roughness={0.3} metalness={0.7} />
        </mesh>
      );
    case 'plant':
      // A pot + a soft foliage sphere — greenery.
      return (
        <group>
          <mesh position={[0, 0.18, 0]} castShadow>
            <cylinderGeometry args={[0.24, 0.3, 0.36, 12]} />
            <meshStandardMaterial color={palette.wall} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.75, 0]} castShadow>
            <sphereGeometry args={[0.42, 12, 12]} />
            <meshStandardMaterial color="#6f9b6a" roughness={0.9} />
          </mesh>
        </group>
      );
    case 'lounge':
      // A low seat block + a back cushion — a lounge set.
      return (
        <group>
          <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, 0.5, d]} />
            <meshStandardMaterial color={palette.accent} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.7, -d / 2 + 0.15]} castShadow>
            <boxGeometry args={[w, 0.55, 0.3]} />
            <meshStandardMaterial color={palette.table} roughness={0.8} />
          </mesh>
        </group>
      );
    case 'bar':
    case 'buffet':
      // A counter with a raised back rail — bar / buffet station. The counter
      // top is the room's clearest metal accent (Wave 2a materials pass).
      return (
        <group>
          <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, 1.1, d]} />
            <meshStandardMaterial color={palette.table} roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.16, 0]} castShadow>
            <boxGeometry args={[w, 0.06, d]} />
            <meshStandardMaterial color={palette.accent} roughness={0.3} metalness={0.7} />
          </mesh>
        </group>
      );
    case 'photo_booth':
      // A backdrop panel + a slim frame — the photo booth.
      return (
        <group>
          <mesh position={[0, 1.1, -d / 2 + 0.1]} castShadow>
            <boxGeometry args={[w, 2.2, 0.14]} />
            <meshStandardMaterial color={palette.accent} roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.1, -d / 2 + 0.1]}>
            <boxGeometry args={[w * 0.7, 1.5, 0.16]} />
            <meshStandardMaterial color={palette.table} roughness={0.5} />
          </mesh>
        </group>
      );
    case 'cake_table':
      // A round pedestal table with a stacked "cake" on top.
      return (
        <group>
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[w / 2, w / 2, 0.06, 20]} />
            <meshStandardMaterial color={palette.table} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.14, 0.18, 0.42, 10]} />
            <meshStandardMaterial color={palette.wall} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.62, 0]} castShadow>
            <cylinderGeometry args={[0.34, 0.4, 0.3, 16]} />
            <meshStandardMaterial color="#f7f2ea" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.86, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.28, 0.24, 16]} />
            <meshStandardMaterial color={palette.accent} roughness={0.5} />
          </mesh>
        </group>
      );
    case 'gift_table':
    case 'registration':
    default:
      // A plain draped table — gift / registration tables + the safe fallback.
      return (
        <group>
          <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, 0.06, d]} />
            <meshStandardMaterial color={palette.table} roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.36, 0]}>
            <boxGeometry args={[w * 0.94, 0.72, d * 0.94]} />
            <meshStandardMaterial color={palette.wall} roughness={0.9} transparent opacity={0.85} />
          </mesh>
        </group>
      );
  }
}

/** A vendor booth — a compact station block with an accent canopy edge. */
// Neutral prop tones for the booth silhouettes. A drum kit / range hood / amp
// reads WRONG if recoloured to the wedding palette, so these stay fixed while
// counters + risers still take palette.table / palette.accent.
const BOOTH_METAL = '#6b6f76';
const BOOTH_CHROME = '#b9bec7';
const BOOTH_WARM = '#d98a3d'; // cooktop heat + performance spotlight glow
const BOOTH_DARK = '#2a2c30'; // amps / speakers

/** A slim mic stand (post + ball head + base) — shared by band + performance. */
function MicStand({ x = 0, z = 0 }: { x?: number; z?: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.62, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 1.24, 6]} />
        <meshStandardMaterial color={BOOTH_METAL} roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[0, 1.28, 0]} castShadow>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color={BOOTH_DARK} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.04, 12]} />
        <meshStandardMaterial color={BOOTH_METAL} roughness={0.5} metalness={0.5} />
      </mesh>
    </group>
  );
}

/** Per-type booth silhouette. Band / live-cooking / live-performance /
 *  mobile-bar each get their own read; everything else keeps the generic
 *  station block + canopy lip. Low-poly, no fetched assets. */
function boothSilhouette(kind: string, w: number, d: number, palette: Lab3DPalette) {
  switch (kind) {
    case 'band':
      return (
        <group>
          {/* Stage riser */}
          <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
            <boxGeometry args={[w + 0.4, 0.2, d + 0.4]} />
            <meshStandardMaterial color={palette.accent} roughness={0.5} metalness={0.1} />
          </mesh>
          {/* Drum kit — body + two cymbals */}
          <mesh position={[0, 0.42, -0.1]} castShadow>
            <cylinderGeometry args={[0.28, 0.28, 0.34, 16]} />
            <meshStandardMaterial color="#efe7d8" roughness={0.4} />
          </mesh>
          <mesh position={[-0.42, 0.7, -0.1]} rotation={[0.2, 0, 0.2]}>
            <cylinderGeometry args={[0.22, 0.22, 0.015, 16]} />
            <meshStandardMaterial color={BOOTH_CHROME} roughness={0.3} metalness={0.8} />
          </mesh>
          <mesh position={[0.42, 0.66, -0.1]} rotation={[0.2, 0, -0.2]}>
            <cylinderGeometry args={[0.18, 0.18, 0.015, 16]} />
            <meshStandardMaterial color={BOOTH_CHROME} roughness={0.3} metalness={0.8} />
          </mesh>
          {/* Amp */}
          <mesh position={[w / 2 - 0.1, 0.42, 0.2]} castShadow>
            <boxGeometry args={[0.42, 0.44, 0.3]} />
            <meshStandardMaterial color={BOOTH_DARK} roughness={0.7} />
          </mesh>
          <MicStand x={-w / 2 + 0.2} z={0.3} />
        </group>
      );
    case 'live_cooking':
      return (
        <group>
          {/* Stainless counter */}
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, 0.9, d]} />
            <meshStandardMaterial color={BOOTH_CHROME} roughness={0.35} metalness={0.6} />
          </mesh>
          {/* Warm cooktop heat bar (reads as a live flame/griddle) */}
          <mesh position={[0, 0.92, 0]}>
            <boxGeometry args={[w * 0.7, 0.04, d * 0.6]} />
            <meshStandardMaterial color={BOOTH_WARM} emissive={BOOTH_WARM} emissiveIntensity={0.6} roughness={0.4} />
          </mesh>
          {/* Range hood on two posts */}
          <mesh position={[-w / 2 + 0.08, 1.3, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.8, 6]} />
            <meshStandardMaterial color={BOOTH_METAL} roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh position={[w / 2 - 0.08, 1.3, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.8, 6]} />
            <meshStandardMaterial color={BOOTH_METAL} roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh position={[0, 1.72, 0]} castShadow>
            <boxGeometry args={[w + 0.1, 0.16, d + 0.1]} />
            <meshStandardMaterial color={BOOTH_METAL} roughness={0.4} metalness={0.6} />
          </mesh>
        </group>
      );
    case 'live_performance': {
      const r = Math.max(w, d) / 2;
      return (
        <group>
          {/* Round riser */}
          <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[r + 0.2, r + 0.3, 0.16, 24]} />
            <meshStandardMaterial color={palette.accent} roughness={0.5} />
          </mesh>
          <MicStand z={0.1} />
          {/* Small speaker */}
          <mesh position={[w / 2, 0.35, 0.2]} castShadow>
            <boxGeometry args={[0.28, 0.5, 0.26]} />
            <meshStandardMaterial color={BOOTH_DARK} roughness={0.7} />
          </mesh>
          {/* Spotlight glow cone */}
          <mesh position={[0, 1.5, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.5, 1.1, 20, 1, true]} />
            <meshStandardMaterial
              color={BOOTH_WARM}
              emissive={BOOTH_WARM}
              emissiveIntensity={0.25}
              transparent
              opacity={0.14}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      );
    }
    case 'mobile_bar':
      return (
        <group>
          <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, 1.0, d]} />
            <meshStandardMaterial color={palette.table} roughness={0.5} />
          </mesh>
          <mesh position={[0, 1.06, 0]} castShadow>
            <boxGeometry args={[w + 0.16, 0.06, d + 0.16]} />
            <meshStandardMaterial color={palette.accent} roughness={0.4} metalness={0.2} />
          </mesh>
          {/* Back shelf + a row of bottles */}
          <mesh position={[0, 1.3, -d / 2 + 0.06]}>
            <boxGeometry args={[w * 0.9, 0.04, 0.18]} />
            <meshStandardMaterial color={palette.wall} roughness={0.6} />
          </mesh>
          {[-0.5, -0.2, 0.1, 0.4].map((bx, i) => (
            <mesh key={i} position={[bx, 1.44, -d / 2 + 0.06]}>
              <cylinderGeometry args={[0.04, 0.04, 0.24, 8]} />
              <meshStandardMaterial color={i % 2 ? '#3a5a4a' : '#6a3a3a'} roughness={0.3} />
            </mesh>
          ))}
        </group>
      );
    default:
      // Generic station block + canopy lip (front desk / dessert / gift /
      // souvenir / photo booth / custom / unassigned) — unchanged.
      return (
        <group>
          <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, 1.0, d]} />
            <meshStandardMaterial color={palette.table} roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.06, 0]} castShadow>
            <boxGeometry args={[w + 0.2, 0.08, d + 0.2]} />
            <meshStandardMaterial color={palette.accent} roughness={0.5} metalness={0.15} />
          </mesh>
        </group>
      );
  }
}

/** A PRO / ENTERPRISE vendor's branded backdrop behind their booth: an accent-
 *  framed board carrying the vendor's logo (loaded from the resolved,
 *  same-origin display URL). Free / verified / solo booths never render this
 *  (gated by boothCanBrand at the call site). Manual TextureLoader (no Suspense
 *  boundary in these scenes); the plane keeps the logo's real aspect ratio so a
 *  wordmark isn't stretched, and drops silently if the image fails. */
export function BoothSign({ url, w, palette }: { url: string; w: number; palette: Lab3DPalette }) {
  const [logo, setLogo] = useState<{ tex: THREE.Texture; aspect: number } | null>(null);
  useEffect(() => {
    let live = true;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      url,
      (t) => {
        if (!live) {
          t.dispose();
          return;
        }
        t.colorSpace = THREE.SRGBColorSpace;
        const img = t.image as { width?: number; height?: number } | undefined;
        const aspect = img?.width && img?.height ? img.width / img.height : 1;
        setLogo({ tex: t, aspect });
      },
      undefined,
      () => {
        /* a broken/blocked logo just leaves the booth unbranded */
      },
    );
    return () => {
      live = false;
    };
  }, [url]);

  // Fit the logo inside a max box, preserving aspect.
  const maxW = Math.min(w, 1.4);
  const maxH = 0.62;
  const logoW = logo ? Math.min(maxW, maxH * logo.aspect) : maxW;
  const logoH = logo ? logoW / logo.aspect : maxH;

  return (
    <group position={[0, 0, -0.62]}>
      {/* Backdrop board */}
      <mesh position={[0, 1.75, 0]} castShadow>
        <boxGeometry args={[w + 0.3, 0.9, 0.06]} />
        <meshStandardMaterial color={palette.table} roughness={0.6} />
      </mesh>
      {/* Accent top rail */}
      <mesh position={[0, 2.24, 0]}>
        <boxGeometry args={[w + 0.4, 0.08, 0.1]} />
        <meshStandardMaterial color={palette.accent} roughness={0.4} metalness={0.2} />
      </mesh>
      {/* Logo — once resolved; sits just proud of the board, facing the room. */}
      {logo ? (
        <mesh position={[0, 1.75, 0.04]}>
          <planeGeometry args={[logoW, logoH]} />
          <meshBasicMaterial map={logo.tex} transparent toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}

/** A vendor booth. Booth-template kit (2026-07-08): when the booked vendor's
 *  category (or the booth type) resolves a catalog template — all 57
 *  taxonomy leaves now do — the full chassis + props + staff-mascot build
 *  renders (kit/booth-template.tsx); only booths with no template identity
 *  (unlinked custom pins, no-booth vendor categories) keep the generic
 *  silhouette below as the safe fallback.
 *  Pro / enterprise vendors additionally get the branded logo backdrop,
 *  hung at the template chassis' sign anchor when one is in play. */
export function BoothMesh({ booth, room, palette }: { booth: Lab3DBooth; room: Room; palette: Lab3DPalette }) {
  const pos = useMemo(() => pctToWorld(booth.xPct, booth.yPct, room), [booth.xPct, booth.yPct, room]);
  const { w, d } = BOOTH_FOOTPRINT_M;
  const branded = boothCanBrand(booth.vendor?.tier) && !!booth.vendor?.logoUrl;
  const template = boothTemplateFor(booth);
  if (template) {
    const anchor = CHASSIS_SPECS[template.chassis].signAnchor;
    return (
      <group>
        <BoothTemplate booth={booth} template={template} room={room} palette={palette} />
        {branded ? (
          <group position={[pos.x + anchor[0], anchor[1], pos.z + anchor[2]]}>
            <BoothSign url={booth.vendor!.logoUrl!} w={w} palette={palette} />
          </group>
        ) : null}
      </group>
    );
  }
  return (
    <group position={[pos.x, 0, pos.z]}>
      {boothSilhouette(booth.kind, w, d, palette)}
      {branded ? <BoothSign url={booth.vendor!.logoUrl!} w={w} palette={palette} /> : null}
    </group>
  );
}

/** A wayfinding sign — a slim post + an arrow panel rotated to its heading.
 *  `rotationDeg` = 0 points up on the canvas (−z in world). */
export function SignMesh({ sign, room, palette }: { sign: Lab3DSign; room: Room; palette: Lab3DPalette }) {
  const pos = useMemo(() => pctToWorld(sign.xPct, sign.yPct, room), [sign.xPct, sign.yPct, room]);
  return (
    <group position={[pos.x, 0, pos.z]} rotation={[0, ry(sign.rotationDeg), 0]}>
      {/* Post */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 1.2, 8]} />
        <meshStandardMaterial color={palette.wall} roughness={0.8} />
      </mesh>
      {/* Label panel */}
      <mesh position={[0, 1.35, 0]} castShadow>
        <boxGeometry args={[0.7, 0.32, 0.05]} />
        <meshStandardMaterial color={palette.table} roughness={0.5} />
      </mesh>
      {/* Direction arrow (a flat cone) on the panel front, pointing along the heading (−z). */}
      <mesh position={[0, 1.35, -0.06]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.12, 0.26, 3]} />
        <meshStandardMaterial color={palette.accent} roughness={0.4} />
      </mesh>
    </group>
  );
}

/**
 * The cocktail / waiting room — a second floor plane with low translucent walls
 * and a faint accent trim, sitting on the same canvas as the reception (it's
 * placed OUTSIDE the reception walls by the 2D editor, so it never overlaps).
 */
export function CocktailRoom({ cocktail, room, palette }: { cocktail: NonNullable<Lab3DCocktail>; room: Room; palette: Lab3DPalette }) {
  const c = useMemo(() => pctToWorld(cocktail.xPct, cocktail.yPct, room), [cocktail.xPct, cocktail.yPct, room]);
  const w = Math.max(0.5, (cocktail.wPct / 100) * room.w);
  const d = Math.max(0.5, (cocktail.hPct / 100) * room.d);
  const wallH = 0.9;
  const walls: { p: readonly [number, number, number]; s: readonly [number, number, number] }[] = [
    { p: [0, wallH / 2, -d / 2], s: [w, wallH, 0.1] },
    { p: [0, wallH / 2, d / 2], s: [w, wallH, 0.1] },
    { p: [-w / 2, wallH / 2, 0], s: [0.1, wallH, d] },
    { p: [w / 2, wallH / 2, 0], s: [0.1, wallH, d] },
  ];
  return (
    <group position={[c.x, 0, c.z]}>
      {/* Floor plane — a hair above the ground so it never z-fights the reception floor. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={palette.floor} roughness={0.95} roughnessMap={floorRoughnessMap()} />
      </mesh>
      {/* Accent trim ring on the floor edge. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[Math.min(w, d) / 2 - 0.1, Math.min(w, d) / 2, 40]} />
        <meshBasicMaterial color={palette.accent} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      {walls.map((wall, i) => (
        <mesh key={i} position={wall.p as [number, number, number]}>
          <boxGeometry args={wall.s as [number, number, number]} />
          <meshStandardMaterial color={palette.wall} roughness={0.95} transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * One-call render of every placed fixture for a scene. Drop it inside a Canvas
 * alongside the tables. Each list defaults to empty so a surface can pass only
 * what it has.
 */
export function VenueFixtures({
  room,
  palette,
  objects = [],
  booths = [],
  signs = [],
  cocktail = null,
}: {
  room: Room;
  palette: Lab3DPalette;
  objects?: Lab3DSceneObject[];
  booths?: Lab3DBooth[];
  signs?: Lab3DSign[];
  cocktail?: Lab3DCocktail;
}) {
  return (
    <group>
      {objects.map((o) => (
        <SceneObjectMesh key={o.id} object={o} room={room} palette={palette} />
      ))}
      {booths.map((b) => (
        <BoothMesh key={b.id} booth={b} room={room} palette={palette} />
      ))}
      {signs.map((s) => (
        <SignMesh key={s.id} sign={s} room={room} palette={palette} />
      ))}
      {cocktail ? <CocktailRoom cocktail={cocktail} room={room} palette={palette} /> : null}
    </group>
  );
}
