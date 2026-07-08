/**
 * kit/booth-templates — the CONFIG TABLE of the booth-template kit: taxonomy
 * leaf key → { chassis, props, staff, sign fallback, card kind } per the
 * owner-locked catalog (`0008_3DPlan_Booth_Template_Catalog_2026-07-08.md`,
 * 9 chassis × 57 categories). THIS PR ships the SYSTEM + the TOP-20
 * highest-traffic categories; the remaining 37 leaves deliberately resolve to
 * `null` here and FALL BACK to the existing generic BoothMesh silhouette in
 * venue-objects.tsx — the complete catalog is the next PR
 * (`3dplan-booth-catalog-complete`), exactly as the catalog doc sequences it.
 *
 * Data only (no React) — the renderer is kit/booth-template.tsx. Placements
 * are authored booth-local (origin = booth centre, front = +z, metres);
 * chassis surface heights: COUNTER top ≈1.075 · STATION top ≈0.93 · DESK
 * top ≈0.78 · RISER deck ≈0.175 · DISPLAY shelves ≈0.98/1.53 (lathe-based
 * props sit a few mm proud of their surface so caps never z-fight it).
 */

import type { WeddingTile } from '@/lib/taxonomy';
import type { OutfitKind } from './outfits';
import type { StaffIdleKind } from '@/lib/figure-rig';
import {
  CHASSIS_SPECS,
  type BoothChassisKind,
  type ChassisSpec,
} from './booth-chassis';
import type { BoothPropKind } from './booth-props';
import {
  BOOTH_FOOTPRINT_M,
  pctToWorld,
  type Lab3DBooth,
  type ObstacleDisc,
} from '@/lib/seating-3d';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** What the booth vendor card renders for this category (slice-4 hook — the
 *  kit only CARRIES the kind; the card body ships with the vendor-card slice). */
export type BoothCardKind = 'menu' | 'songlist' | 'drinks' | 'inclusions';

/** One placed prop: kind + booth-local position (+ optional yaw/scale). */
export type PropPlacement = {
  kind: BoothPropKind;
  position: readonly [number, number, number];
  rotY?: number;
  scale?: number;
};

export type BoothTemplateSpec = {
  chassis: BoothChassisKind;
  props: readonly PropPlacement[];
  staff: {
    outfit: OutfitKind;
    idle: StaffIdleKind;
    /** How many mascots the booth staffs (≤ 3 — the catalog's multi-figure
     *  cap; clamped to the chassis' available anchors at render). */
    count: 1 | 2 | 3;
  };
  /** Sign text when the booth has no label and no brandable vendor logo. */
  signText: string;
  cardKind: BoothCardKind;
};

// ─────────────────────────────────────────────────────────────────────────────
// The top-20 table
// ─────────────────────────────────────────────────────────────────────────────

export const BOOTH_TEMPLATES: Partial<Record<WeddingTile, BoothTemplateSpec>> = {
  // ── FEAST ──────────────────────────────────────────────────────────────────
  catering: {
    chassis: 'STATION',
    props: [
      { kind: 'chafing_dish', position: [-0.5, 0.94, 0] },
      { kind: 'chafing_dish', position: [-0.05, 0.94, 0.05] },
      { kind: 'plate_stack', position: [0.55, 0.94, 0] },
    ],
    staff: { outfit: 'chef_whites', idle: 'present', count: 1 },
    signText: 'Catering',
    cardKind: 'menu',
  },
  cake: {
    chassis: 'STATION',
    props: [{ kind: 'tiered_cake', position: [0, 0.94, 0] }],
    staff: { outfit: 'chef_whites', idle: 'pipingSwirl', count: 1 },
    signText: 'Wedding Cake',
    cardKind: 'menu',
  },
  stations: {
    chassis: 'STATION',
    props: [
      { kind: 'chafing_dish', position: [-0.35, 0.94, 0], scale: 1.2 },
      { kind: 'plate_stack', position: [0.45, 0.94, 0.1] },
      { kind: 'plate_stack', position: [0.62, 0.94, -0.12], scale: 0.85 },
    ],
    staff: { outfit: 'apron', idle: 'shake', count: 1 },
    signText: 'Live Station',
    cardKind: 'menu',
  },
  // ── BOOTHS (food + drink) ──────────────────────────────────────────────────
  mobile_bar: {
    chassis: 'COUNTER',
    props: [
      { kind: 'bottle_shelf', position: [0, 1.34, -0.42] },
      { kind: 'shaker', position: [0.45, 1.08, 0.15] },
    ],
    staff: { outfit: 'vest', idle: 'shake', count: 1 },
    signText: 'Mobile Bar',
    cardKind: 'drinks',
  },
  coffee_espresso: {
    chassis: 'COUNTER',
    props: [
      { kind: 'espresso_machine', position: [-0.4, 1.07, 0.05] },
      { kind: 'plate_stack', position: [0.45, 1.08, 0.12], scale: 0.9 },
    ],
    staff: { outfit: 'apron', idle: 'tamp', count: 1 },
    signText: 'Coffee & Espresso',
    cardKind: 'drinks',
  },
  dessert: {
    chassis: 'COUNTER',
    props: [
      { kind: 'donut_board', position: [0, 1.1, -0.42] },
      { kind: 'tiered_cake', position: [-0.55, 1.08, 0.1], scale: 0.62 },
    ],
    staff: { outfit: 'apron', idle: 'present', count: 1 },
    signText: 'Desserts',
    cardKind: 'menu',
  },
  food_cart: {
    chassis: 'VEHICLE',
    props: [
      { kind: 'umbrella', position: [-0.9, 0, 0.35], scale: 0.9 },
      { kind: 'awning', position: [0.35, 1.45, 0.62] },
    ],
    staff: { outfit: 'apron', idle: 'wave', count: 1 },
    signText: 'Food Cart',
    cardKind: 'menu',
  },
  food_truck: {
    chassis: 'VEHICLE',
    props: [
      { kind: 'awning', position: [0.35, 1.52, 0.66] },
      { kind: 'clipboard_board', position: [1.35, 0, 0.75], rotY: -0.4 },
    ],
    staff: { outfit: 'apron', idle: 'present', count: 1 },
    signText: 'Food Truck',
    cardKind: 'menu',
  },
  // ── DOCUMENTARY + BOOTH capture ────────────────────────────────────────────
  photo_booth: {
    chassis: 'BACKDROP',
    props: [
      { kind: 'tripod_camera', position: [0.4, 0, 1.15], rotY: Math.PI },
      { kind: 'drape_wall', position: [0, 0, -0.52], scale: 0.9 },
    ],
    staff: { outfit: 'vest', idle: 'wave', count: 1 },
    signText: 'Photo Booth',
    cardKind: 'inclusions',
  },
  photo_video: {
    chassis: 'STATION',
    props: [
      { kind: 'tripod_camera', position: [0.75, 0, 0.45], rotY: 0.3 },
      { kind: 'clipboard_board', position: [-0.3, 0.94, 0] },
    ],
    staff: { outfit: 'vest', idle: 'snap', count: 1 },
    signText: 'Photo & Video',
    cardKind: 'inclusions',
  },
  livestream: {
    chassis: 'STATION',
    props: [
      { kind: 'tripod_camera', position: [-0.8, 0, 0.4], rotY: -0.3 },
      { kind: 'live_lamp', position: [0.35, 1.05, 0.05] },
    ],
    staff: { outfit: 'vest', idle: 'tamp', count: 1 },
    signText: 'Live Stream',
    cardKind: 'inclusions',
  },
  // ── PROGRAM ────────────────────────────────────────────────────────────────
  live_band: {
    chassis: 'RISER',
    props: [
      { kind: 'drum_kit', position: [0, 0.18, -0.45] },
      { kind: 'mic_stand', position: [-0.35, 0.18, 0.45] },
      { kind: 'mic_stand', position: [0.45, 0.18, 0.35] },
    ],
    staff: { outfit: 'uniform', idle: 'headBob', count: 3 },
    signText: 'Live Band',
    cardKind: 'songlist',
  },
  dj: {
    chassis: 'STATION',
    props: [
      { kind: 'console_speakers', position: [0, 0.94, 0], scale: 0.95 },
      { kind: 'moving_head', position: [0.85, 0, -0.4] },
    ],
    staff: { outfit: 'uniform', idle: 'headBob', count: 1 },
    signText: 'DJ',
    cardKind: 'songlist',
  },
  wedding_singer: {
    chassis: 'RISER',
    props: [
      { kind: 'mic_stand', position: [0, 0.18, 0.4] },
      { kind: 'stage_monitor', position: [0.55, 0.18, 0.6], rotY: Math.PI },
    ],
    staff: { outfit: 'uniform', idle: 'headBob', count: 1 },
    signText: 'Wedding Singer',
    cardKind: 'songlist',
  },
  host_mc: {
    chassis: 'RISER',
    props: [
      { kind: 'podium', position: [-0.45, 0.18, 0.25], scale: 0.9 },
      { kind: 'mic_stand', position: [0.4, 0.18, 0.35] },
    ],
    staff: { outfit: 'suit', idle: 'cardFlip', count: 1 },
    signText: 'Host / MC',
    cardKind: 'inclusions',
  },
  // ── DESIGN ─────────────────────────────────────────────────────────────────
  florist: {
    chassis: 'GARDEN',
    props: [{ kind: 'bloom_cart', position: [-0.35, 0, 0.25], rotY: 0.25 }],
    staff: { outfit: 'apron', idle: 'snap', count: 1 },
    signText: 'Florist',
    cardKind: 'inclusions',
  },
  stylist_decorator: {
    chassis: 'DISPLAY',
    props: [
      { kind: 'drape_wall', position: [0, 0, -0.55], scale: 0.85 },
      { kind: 'easel', position: [0.8, 0, 0.35], rotY: -0.4 },
    ],
    staff: { outfit: 'vest', idle: 'wave', count: 1 },
    signText: 'Styling & Decor',
    cardKind: 'inclusions',
  },
  lights_sound: {
    chassis: 'STATION',
    props: [
      { kind: 'console_speakers', position: [0, 0.94, 0], scale: 0.9 },
      { kind: 'moving_head', position: [-0.85, 0, -0.45] },
      { kind: 'moving_head', position: [0.85, 0, -0.45] },
    ],
    staff: { outfit: 'uniform', idle: 'tamp', count: 1 },
    signText: 'Lights & Sound',
    cardKind: 'inclusions',
  },
  // ── LOOK + PLANNING ────────────────────────────────────────────────────────
  hmua: {
    chassis: 'CHAIR_STATION',
    props: [{ kind: 'bulb_mirror', position: [-0.55, 0, -0.42], rotY: 0.35, scale: 1.35 }],
    staff: { outfit: 'apron', idle: 'brushDab', count: 1 },
    signText: 'Hair & Makeup',
    cardKind: 'inclusions',
  },
  coordinator: {
    chassis: 'DESK',
    props: [
      { kind: 'clipboard_board', position: [-0.35, 0.79, 0.05], rotY: 0.15 },
      { kind: 'plate_stack', position: [0.5, 0.79, 0.1], scale: 0.7 },
    ],
    staff: { outfit: 'uniform', idle: 'cardFlip', count: 1 },
    signText: 'Coordinator',
    cardKind: 'inclusions',
  },
};

/** The template keys shipped in this slice (exported for the admin/debug
 *  surfaces + the next PR's completeness check). */
export const BOOTH_TEMPLATE_KEYS = Object.keys(BOOTH_TEMPLATES) as WeddingTile[];

// ─────────────────────────────────────────────────────────────────────────────
// Resolution — which template (if any) a placed booth renders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `event_vendors.category` (the couple's registry enum, lib/vendors.ts
 * VendorCategory) → taxonomy leaf. Only the categories whose template shipped
 * in this slice are mapped; everything else resolves null → generic BoothMesh.
 * `band_dj` maps to the band template (the fuller stage read — a booked
 * band_dj vendor gets the riser; the DJ template still serves taxonomy-keyed
 * callers and the booth_type fallback below).
 */
const VENDOR_CATEGORY_TO_TILE: Record<string, WeddingTile> = {
  catering: 'catering',
  cake_maker: 'cake',
  photographer: 'photo_video',
  videographer: 'photo_video',
  florist: 'florist',
  host_emcee: 'host_mc',
  band_dj: 'live_band',
  planner_coordinator: 'coordinator',
  makeup_artist: 'hmua',
  hair_stylist: 'hmua',
  lights_and_sound: 'lights_sound',
  photobooth: 'photo_booth',
  mobile_bar: 'mobile_bar',
  reception_decor: 'stylist_decorator',
};

/**
 * `event_floor_booths.booth_type` → taxonomy leaf, for UNLINKED booths (no
 * booked vendor yet) whose type still names an obvious template.
 */
const BOOTH_KIND_TO_TILE: Record<string, WeddingTile> = {
  photo_booth: 'photo_booth',
  mobile_bar: 'mobile_bar',
  band: 'live_band',
  live_cooking: 'stations',
  dessert_station: 'dessert',
  live_performance: 'wedding_singer',
};

/**
 * The template a placed booth renders, or null → the caller keeps the
 * existing generic BoothMesh silhouette (the documented fallback for the 37
 * categories the next PR completes). The booked vendor's category wins over
 * the couple's booth_type — the vendor IS the booth's identity once linked.
 * Accepts raw taxonomy leaf keys too (a vendor payload that already speaks
 * WeddingTile resolves directly).
 */
export function boothTemplateFor(
  booth: Pick<Lab3DBooth, 'kind' | 'vendor'>,
): BoothTemplateSpec | null {
  const cat = booth.vendor?.category;
  if (cat) {
    const direct = BOOTH_TEMPLATES[cat as WeddingTile];
    if (direct) return direct;
    const mapped = VENDOR_CATEGORY_TO_TILE[cat];
    if (mapped) return BOOTH_TEMPLATES[mapped] ?? null;
  }
  const byKind = BOOTH_KIND_TO_TILE[booth.kind];
  return byKind ? BOOTH_TEMPLATES[byKind] ?? null : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Obstacle registration (the slice-3 contract)
// ─────────────────────────────────────────────────────────────────────────────

/** The chassis spec a booth's template resolves to, or null (generic booth). */
export function boothChassisSpec(
  booth: Pick<Lab3DBooth, 'kind' | 'vendor'>,
): ChassisSpec | null {
  const t = boothTemplateFor(booth);
  return t ? CHASSIS_SPECS[t.chassis] : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tap volume (the invisible booth hit box, sized to the resolved chassis)
// ─────────────────────────────────────────────────────────────────────────────

/** An invisible booth tap box: `size` = [w, h, d] metres, `center` = the box
 *  centre relative to the booth's floor origin. */
export type BoothHitVolume = {
  size: readonly [number, number, number];
  center: readonly [number, number, number];
};

/** The historical fixed box (a touch larger than the generic 2×1 m booth
 *  footprint, floor-anchored) — still exactly right for the 37 fallback
 *  categories that render the generic BoothMesh. */
export const GENERIC_BOOTH_HIT: BoothHitVolume = {
  size: [2.3, 1.3, 1.3],
  center: [0, 0.6, 0],
};

/**
 * The tap volume a placed booth's hit target should use — sized from the
 * resolved chassis' footprint (w/d + the generic box's 0.3 m slack) with the
 * spec's `hit` overrides for tall or front-extended builds, so the widest
 * chassis (VEHICLE cab ends, RISER deck, BACKDROP panel + tripod) have no
 * dead tap zones. Non-templated booths keep the exact historical box.
 */
export function boothHitVolume(
  booth: Pick<Lab3DBooth, 'kind' | 'vendor'>,
): BoothHitVolume {
  const spec = boothChassisSpec(booth);
  if (!spec) return GENERIC_BOOTH_HIT;
  const w = spec.w + 0.3;
  const h = spec.hit?.h ?? 1.3;
  const d = spec.hit?.d ?? spec.d + 0.3;
  // Floor-anchored like the generic box (its 1.3-tall span sits at y −0.05…1.25).
  return { size: [w, h, d], center: [0, h / 2 - 0.05, spec.hit?.z ?? 0] };
}

/**
 * Template-aware avoidance discs for placed booths — the drop-in upgrade for
 * seating-3d's `boothObstacles` at every 3D call site: a templated booth
 * registers its CHASSIS' authored footprint discs (a food-truck capsule, a
 * backdrop's two-lobe zone) placed at the booth's world centre; a
 * non-templated booth keeps the exact disc `boothObstacles` has always
 * emitted, so the 37 fallback categories steer identically to before.
 * (Booths don't rotate on the percent canvas — no rotation composition.)
 */
export function templateBoothObstacles(
  booths: Lab3DBooth[],
  room: { w: number; d: number },
): ObstacleDisc[] {
  const genericR = Math.max(BOOTH_FOOTPRINT_M.w, BOOTH_FOOTPRINT_M.d) / 2 + 0.4;
  const out: ObstacleDisc[] = [];
  for (const b of booths) {
    const c = pctToWorld(b.xPct, b.yPct, room);
    const spec = boothChassisSpec(b);
    if (!spec) {
      out.push({ c, r: genericR });
      continue;
    }
    for (const d of spec.discs) {
      out.push({ c: { x: c.x + d.x, z: c.z + d.z }, r: d.r });
    }
  }
  return out;
}
