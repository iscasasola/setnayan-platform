/**
 * kit/booth-templates — the CONFIG TABLE of the booth-template kit: taxonomy
 * leaf key → { chassis, props, staff, sign fallback, card kind } per the
 * owner-locked catalog (`0008_3DPlan_Booth_Template_Catalog_2026-07-08.md`,
 * chassis × 57 categories). CATALOG COMPLETE — all 57 taxonomy leaves carry a
 * template (the chassis PR shipped the system + the top-20; this PR lands the
 * remaining 37), enforced at compile time by the full
 * `Record<WeddingTile, BoothTemplateSpec>` below. The generic BoothMesh
 * silhouette in venue-objects.tsx remains only for booths that resolve NO
 * template at all (unlinked `custom` / `unassigned` pins, non-leaf vendor
 * categories like `misc`).
 *
 * Data only (no React) — the renderer is kit/booth-template.tsx. Placements
 * are authored booth-local (origin = booth centre, front = +z, metres);
 * chassis surface heights: COUNTER top ≈1.075 · STATION top ≈0.93 · BUFFET
 * top ≈0.94 · DESK top ≈0.78 · RISER deck ≈0.175 · DISPLAY plinth ≈0.32,
 * shelves ≈0.98/1.53 · CHAIR_STATION cart tray ≈0.835 (lathe-based props sit
 * a few mm proud of their surface so caps never z-fight it).
 *
 * PLACEMENT RULE (the polish-pass lesson): floor-standing props NEVER sit
 * inside a staff anchor's spot — check the chassis' staffAnchors (booth-props
 * figures read ~0.25 m radius) before authoring any y=0 placement.
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
  boothFacingY,
  rotateLocalRad,
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
// The full 57-template table (top-20 shipped with the chassis slice; the
// remaining 37 land here — the full Record type IS the completeness check)
// ─────────────────────────────────────────────────────────────────────────────

export const BOOTH_TEMPLATES: Record<WeddingTile, BoothTemplateSpec> = {
  // ── FEAST ──────────────────────────────────────────────────────────────────
  catering: {
    // 2026-07-08 owner polish: "they have a LONG table of food" — the classic
    // PH buffet run: draped table, a row of chafing dishes with OPEN trays of
    // visible food between them, plates at the service end, two staff behind.
    chassis: 'BUFFET',
    props: [
      { kind: 'chafing_dish', position: [-1.25, 0.95, 0] },
      { kind: 'food_tray', position: [-0.7, 0.95, 0.02] },
      { kind: 'chafing_dish', position: [-0.15, 0.95, 0] },
      { kind: 'food_tray', position: [0.4, 0.95, 0.02] },
      { kind: 'chafing_dish', position: [0.95, 0.95, 0] },
      { kind: 'plate_stack', position: [1.4, 0.95, 0] },
    ],
    staff: { outfit: 'chef_whites', idle: 'present', count: 2 },
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
    // 2026-07-08 polish: the DJ is TURNTABLES + a vinyl crate — the console
    // silhouette belongs to Lights & Sound (owner: "look the same"). Floor
    // props sit BESIDE the counter, clear of the staff anchor (z −0.55).
    props: [
      { kind: 'turntable_deck', position: [0, 0.94, 0] },
      { kind: 'vinyl_crate', position: [1.0, 0, 0.35] },
      { kind: 'stage_monitor', position: [-1.0, 0, 0.35] },
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
    staff: { outfit: 'vest', idle: 'cardFlip', count: 1 },
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
    // 2026-07-08 polish: the mixing console stays, and the identity comes
    // from tall PA TOWERS flanking the station + a LIGHT TREE rising behind
    // the tech (heads up high — they were floor-standing at z −0.45, inside
    // the staff anchor's spot, which is the owner-caught people overlap).
    props: [
      { kind: 'console_speakers', position: [0, 0.94, 0], scale: 0.85 },
      { kind: 'speaker_tower', position: [-1.25, 0, 0.1] },
      { kind: 'speaker_tower', position: [1.25, 0, 0.1] },
      { kind: 'light_tree', position: [0, 0, -1.05] },
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
  // ═══ Catalog completion (2026-07-08 · the remaining 37) ═══════════════════
  // ── VENUE ──────────────────────────────────────────────────────────────────
  reception: {
    chassis: 'DESK',
    // The ballroom scale model on the welcome table — the venue's sales piece.
    props: [{ kind: 'maquette', position: [0, 0.79, 0.08] }],
    staff: { outfit: 'uniform', idle: 'present', count: 1 },
    signText: 'Reception Venue',
    cardKind: 'inclusions',
  },
  ceremony_venue: {
    chassis: 'BACKDROP',
    // Chapel arch across the floor zone + warm-gold capiz string in front of
    // the panel. Arch offset left so its right pew clears the greeter anchor
    // (0.95, 0.45) — pew lands at (0.47, 0.68), ~0.53 m away.
    props: [
      { kind: 'chapel_arch', position: [-0.3, 0, 0], scale: 0.9 },
      { kind: 'capiz_string', position: [0, 0, -0.35] },
    ],
    staff: { outfit: 'uniform', idle: 'present', count: 1 },
    signText: 'Ceremony Venue',
    cardKind: 'inclusions',
  },
  // ── PLANNING ───────────────────────────────────────────────────────────────
  date_specialist: {
    chassis: 'DESK',
    props: [{ kind: 'calendar_board', position: [0, 0.79, 0.05] }],
    staff: { outfit: 'vest', idle: 'cardFlip', count: 1 },
    signText: 'Date Specialist',
    cardKind: 'inclusions',
  },
  // ── FEAST ──────────────────────────────────────────────────────────────────
  crew_meals: {
    chassis: 'STATION',
    // Warmer on the table, packed-meal crates beside it (the dj vinyl-crate
    // floor spot — proven clear of both staff anchors at z −0.55/−0.62).
    props: [
      { kind: 'chafing_dish', position: [-0.35, 0.94, 0] },
      { kind: 'plate_stack', position: [0.35, 0.94, 0.08] },
      { kind: 'crate_stack', position: [1.0, 0, 0.35] },
    ],
    staff: { outfit: 'apron', idle: 'boxPass', count: 1 },
    signText: 'Crew Meals',
    cardKind: 'menu',
  },
  // ── DESIGN ─────────────────────────────────────────────────────────────────
  dance_floor: {
    chassis: 'BACKDROP',
    // The LED tile sample laid flat ON the activity-zone pad (top y 0.0355 —
    // at y 0 the 6 cm frame is 58% swallowed by the pad); panel spans x ±0.65
    // so the staff anchor at x 0.95 stays clear.
    props: [{ kind: 'led_floor', position: [0, 0.04, 0.3] }],
    staff: { outfit: 'uniform', idle: 'present', count: 1 },
    signText: 'Dance Floor',
    cardKind: 'inclusions',
  },
  outdoor: {
    chassis: 'GARDEN',
    // Capiz string swung under the pergola beam (pole tops ≈1.76 < beam 1.98)
    // + a market umbrella clear of the planters and the florist-gap anchor.
    props: [
      { kind: 'capiz_string', position: [0, 0, -0.45] },
      { kind: 'umbrella', position: [-0.7, 0, 0.55], scale: 0.9 },
    ],
    staff: { outfit: 'apron', idle: 'present', count: 1 },
    signText: 'Outdoor & Garden',
    cardKind: 'inclusions',
  },
  fireworks: {
    chassis: 'STATION',
    // The mortar battery demos in FRONT of the table (z 0.75 clears the
    // tabletop's z ±0.46 span for BOTH sub-groups — the tubes at local −0.25
    // AND the starburst sign post at local +0.5; the old beside-the-table
    // x −0.85 spot only cleared the tubes and the post skewered the slab).
    props: [{ kind: 'mortar_rack', position: [-0.6, 0, 0.75] }],
    staff: { outfit: 'uniform', idle: 'thumbsUp', count: 1 },
    signText: 'Fireworks',
    cardKind: 'inclusions',
  },
  led_wall: {
    chassis: 'BACKDROP',
    // The animated panel hangs just in front of the backdrop panel (z −0.68)
    // so it reads wall-mounted, not floating.
    props: [{ kind: 'led_panel', position: [0, 0.15, -0.56] }],
    staff: { outfit: 'vest', idle: 'tamp', count: 1 },
    signText: 'LED Wall',
    cardKind: 'inclusions',
  },
  digital_services: {
    chassis: 'DESK',
    props: [{ kind: 'tech_set', position: [0, 0.79, 0.08] }],
    staff: { outfit: 'vest', idle: 'typing', count: 1 },
    signText: 'Digital Services',
    cardKind: 'inclusions',
  },
  // ── PROGRAM ────────────────────────────────────────────────────────────────
  choir: {
    chassis: 'RISER',
    // Folder stands flank the front singer — ≥0.58 m from every deck anchor.
    props: [
      { kind: 'music_stand', position: [-0.55, 0.18, 0.35] },
      { kind: 'music_stand', position: [0.55, 0.18, 0.4] },
    ],
    staff: { outfit: 'robe', idle: 'swaySing', count: 3 },
    signText: 'Choir',
    cardKind: 'songlist',
  },
  orchestra: {
    chassis: 'RISER',
    // Two players (front + left anchors); the cello leans by the UNUSED
    // right anchor spot — count stays 2 so nobody stands in it.
    props: [
      { kind: 'music_stand', position: [0.3, 0.18, 0.55], rotY: Math.PI },
      { kind: 'music_stand', position: [-0.55, 0.18, 0.3], rotY: 2.8 },
      { kind: 'cello', position: [0.65, 0.18, -0.25], rotY: -0.5 },
    ],
    staff: { outfit: 'robe', idle: 'bowDraw', count: 2 },
    signText: 'Orchestra',
    cardKind: 'songlist',
  },
  choreographer: {
    chassis: 'BACKDROP',
    // Numbered floor marks are flat decals — walkable, so anchor clearance
    // doesn't apply; they own the activity zone. Lifted to the chassis'
    // floor-zone pad TOP (y 0.0355 + a few mm) — at y 0 the 12 mm discs sit
    // entirely inside the pad and the booth reads as a bare backdrop.
    props: [{ kind: 'dance_marks', position: [0, 0.038, 0.1] }],
    staff: { outfit: 'uniform', idle: 'countBeat', count: 1 },
    signText: 'Choreographer',
    cardKind: 'inclusions',
  },
  performers: {
    chassis: 'RISER',
    // Hoop + frozen ribbon swirl stage-left; the ribbon column stays ~0.45 m
    // from the front anchor so the idle's swinging arm never clips it.
    props: [{ kind: 'hoop_ribbon', position: [-0.7, 0.18, 0.35], scale: 0.9 }],
    staff: { outfit: 'uniform', idle: 'ribbonSwirl', count: 1 },
    signText: 'Performers',
    cardKind: 'songlist',
  },
  // ── DOCUMENTARY ────────────────────────────────────────────────────────────
  editorial: {
    chassis: 'DESK',
    props: [{ kind: 'magazine_rack', position: [0, 0.79, 0.02] }],
    staff: { outfit: 'vest', idle: 'cardFlip', count: 1 },
    signText: 'Editorial',
    cardKind: 'inclusions',
  },
  // ── LOOK ───────────────────────────────────────────────────────────────────
  brides_attire: {
    chassis: 'DISPLAY',
    // Gown forms stand in FRONT of the plinth (z > 0.4 keeps their bases off
    // its face) and ≥0.74 m from the attendant anchor (0.85, 0.3).
    props: [
      { kind: 'gown_form', position: [-0.45, 0, 0.62] },
      { kind: 'gown_form', position: [0.15, 0, 0.68], scale: 0.9 },
    ],
    staff: { outfit: 'apron', idle: 'measure', count: 1 },
    signText: "Bride's Attire",
    cardKind: 'inclusions',
  },
  grooms_attire: {
    chassis: 'DISPLAY',
    props: [
      { kind: 'barong_form', position: [-0.45, 0, 0.62] },
      { kind: 'suit_form', position: [0.15, 0, 0.68], scale: 0.95 },
    ],
    staff: { outfit: 'vest', idle: 'measure', count: 1 },
    signText: "Groom's Attire",
    cardKind: 'inclusions',
  },
  womens_attire: {
    chassis: 'DISPLAY',
    // The rolling rack sits in front of the plinth — its uprights would
    // pierce the plinth slab anywhere inside z ±0.4.
    props: [{ kind: 'garment_rack', position: [-0.3, 0, 0.6] }],
    staff: { outfit: 'apron', idle: 'present', count: 1 },
    signText: "Women's Attire",
    cardKind: 'inclusions',
  },
  mens_attire: {
    chassis: 'DISPLAY',
    props: [{ kind: 'suit_rack', position: [-0.3, 0, 0.6] }],
    staff: { outfit: 'vest', idle: 'brushDab', count: 1 },
    signText: "Men's Attire",
    cardKind: 'inclusions',
  },
  filipiniana_barongs: {
    chassis: 'DISPLAY',
    // Barong + terno pair up front; the capiz string stands ON the plinth
    // (y 0.32) — warm-gold heritage accent, right pole ~0.37 m from the
    // attendant anchor (thin capsule, clears the figure's 0.25 m read).
    props: [
      { kind: 'barong_form', position: [-0.45, 0, 0.62] },
      { kind: 'gown_form', position: [0.1, 0, 0.66], scale: 0.9 },
      { kind: 'capiz_string', position: [-0.2, 0.32, 0.26], scale: 0.8 },
    ],
    staff: { outfit: 'vest', idle: 'measure', count: 1 },
    signText: 'Filipiniana & Barongs',
    cardKind: 'inclusions',
  },
  grooming: {
    chassis: 'CHAIR_STATION',
    // Spinning pole clear of the chair (0.68 m) + towels on the cart tray.
    props: [
      { kind: 'barber_pole', position: [-0.9, 0, 0.35] },
      { kind: 'towel_stack', position: [0.62, 0.84, -0.35], scale: 0.7 },
    ],
    staff: { outfit: 'vest', idle: 'polishWipe', count: 1 },
    signText: 'Grooming',
    cardKind: 'inclusions',
  },
  wellness_fitness: {
    chassis: 'STATION',
    // Towels on the table + the 1.6× floor stack reading as the mat roll,
    // front-right and clear of the table legs + both rear staff anchors.
    props: [
      { kind: 'towel_stack', position: [-0.35, 0.94, 0] },
      { kind: 'towel_stack', position: [0.95, 0, 0.5], scale: 1.6 },
    ],
    staff: { outfit: 'uniform', idle: 'stretch', count: 1 },
    signText: 'Wellness & Fitness',
    cardKind: 'inclusions',
  },
  jewelleries_accessories: {
    chassis: 'DISPLAY',
    // Free-standing vitrines (each carries its own sparkle bulbs) in FRONT
    // of the plinth — the DISPLAY rule the attire templates follow: z > 0.4
    // keeps their 0.4 m-deep bases off the plinth face (at the old z 0.35 /
    // 0.25 the cases sank 60–90% into the slab). Both stay 0.75+ m from the
    // jeweler anchor (0.85, 0.3).
    props: [
      { kind: 'glass_case', position: [-0.45, 0, 0.62] },
      { kind: 'glass_case', position: [0.15, 0, 0.6], scale: 0.85 },
    ],
    staff: { outfit: 'uniform', idle: 'present', count: 1 },
    signText: 'Jewelry & Accessories',
    cardKind: 'inclusions',
  },
  // ── BOOTHS ─────────────────────────────────────────────────────────────────
  mocktail: {
    chassis: 'COUNTER',
    props: [
      { kind: 'fruit_tower', position: [-0.45, 1.08, 0.05] },
      { kind: 'shaker', position: [0.4, 1.08, 0.12] },
    ],
    staff: { outfit: 'apron', idle: 'pourArc', count: 1 },
    signText: 'Mocktail Bar',
    cardKind: 'drinks',
  },
  massage_chair: {
    chassis: 'CHAIR_STATION',
    // The lounger angles across the front-left corner — legrest overhangs
    // the footprint but the chassis discs (r 1.4) keep walkers off it.
    props: [
      { kind: 'recliner', position: [-0.8, 0, 0.55], rotY: 0.35 },
      { kind: 'towel_stack', position: [0.62, 0.84, -0.35], scale: 0.7 },
    ],
    staff: { outfit: 'uniform', idle: 'present', count: 1 },
    signText: 'Massage',
    cardKind: 'inclusions',
  },
  perfume_bar: {
    chassis: 'COUNTER',
    props: [{ kind: 'perfume_organ', position: [0, 1.08, -0.1] }],
    staff: { outfit: 'vest', idle: 'present', count: 1 },
    signText: 'Perfume Bar',
    cardKind: 'inclusions',
  },
  arcade_games: {
    chassis: 'STATION',
    // Claw machine + hoop are floor cabinets — they play out FRONT of the
    // worktable (z ≥ 0.5 clears the tabletop's ±0.46 edge).
    props: [{ kind: 'arcade_set', position: [0.1, 0, 0.78], scale: 0.9 }],
    staff: { outfit: 'uniform', idle: 'present', count: 1 },
    signText: 'Arcade & Games',
    cardKind: 'inclusions',
  },
  henna_tattoo: {
    chassis: 'CHAIR_STATION',
    // Low table + cushion ring front-left: table corner 0.32 m off the chair
    // pedestal disc, nearest cushion 0.97 m from the artist anchor.
    props: [{ kind: 'low_table_cushions', position: [-0.8, 0, 0.5], scale: 0.8 }],
    staff: { outfit: 'apron', idle: 'strokeWork', count: 1 },
    signText: 'Henna & Tattoo',
    cardKind: 'inclusions',
  },
  mini_nail_bar: {
    chassis: 'CHAIR_STATION',
    props: [{ kind: 'polish_rack', position: [0.62, 0.84, -0.36], scale: 0.9 }],
    staff: { outfit: 'apron', idle: 'strokeWork', count: 1 },
    signText: 'Nail Bar',
    cardKind: 'inclusions',
  },
  tarot_astrology_palmistry: {
    chassis: 'DESK',
    props: [{ kind: 'crystal_set', position: [0, 0.79, 0.12] }],
    staff: { outfit: 'robe', idle: 'cardFlip', count: 1 },
    signText: 'Tarot & Astrology',
    cardKind: 'inclusions',
  },
  caricature_calligraphy_painting: {
    chassis: 'DESK',
    // Sketch pad on the desk + working easel beside it (the shipped
    // stylist_decorator easel read), clear of the rear artist anchor.
    props: [
      { kind: 'clipboard_board', position: [-0.3, 0.79, 0.08], rotY: 0.12 },
      { kind: 'easel', position: [0.85, 0, 0.5], rotY: -0.5 },
    ],
    staff: { outfit: 'apron', idle: 'strokeWork', count: 1 },
    signText: 'Caricature & Art',
    cardKind: 'inclusions',
  },
  engraving_embroidery: {
    chassis: 'STATION',
    props: [
      { kind: 'embroidery_hoop', position: [-0.35, 0.94, 0.02] },
      { kind: 'embroidery_hoop', position: [0.4, 0.94, 0.05], rotY: 0.35, scale: 0.8 },
    ],
    staff: { outfit: 'apron', idle: 'strokeWork', count: 1 },
    signText: 'Engraving & Embroidery',
    cardKind: 'inclusions',
  },
  // ── PRINTS ─────────────────────────────────────────────────────────────────
  printing: {
    chassis: 'STATION',
    props: [
      { kind: 'print_press', position: [-0.3, 0.94, 0] },
      { kind: 'magazine_rack', position: [0.5, 0.94, 0.02], rotY: -0.12 },
    ],
    staff: { outfit: 'apron', idle: 'present', count: 1 },
    signText: 'Printing',
    cardKind: 'inclusions',
  },
  souvenir_giveaways: {
    chassis: 'DISPLAY',
    // Ribboned boxes dress both shelves + the plinth top.
    props: [
      { kind: 'gift_shelf', position: [-0.35, 0.98, -0.12] },
      { kind: 'gift_shelf', position: [0.35, 1.53, -0.12], scale: 0.85 },
      { kind: 'gift_shelf', position: [0.3, 0.32, 0.12] },
    ],
    staff: { outfit: 'apron', idle: 'boxPass', count: 1 },
    signText: 'Souvenirs & Giveaways',
    cardKind: 'inclusions',
  },
  trophies_awards: {
    chassis: 'DISPLAY',
    props: [
      { kind: 'trophy_shelf', position: [0, 0.985, -0.12] },
      { kind: 'trophy_shelf', position: [0, 1.535, -0.12], scale: 0.9 },
    ],
    staff: { outfit: 'uniform', idle: 'polishWipe', count: 1 },
    signText: 'Trophies & Awards',
    cardKind: 'inclusions',
  },
  // ── TRANSPORT ──────────────────────────────────────────────────────────────
  bridal_car: {
    chassis: 'VEHICLE',
    // Bow against the boot face (body rear = x 1.3), can trail strung out
    // behind — rotY π/2 turns the trail down +x, away from the hatch anchor.
    props: [{ kind: 'ribbon_cans', position: [1.35, 0, 0], rotY: Math.PI / 2 }],
    staff: { outfit: 'uniform', idle: 'present', count: 1 },
    signText: 'Bridal Car',
    cardKind: 'inclusions',
  },
  guest_shuttle: {
    chassis: 'VEHICLE',
    // Route board at the door (the food_truck menu-board floor spot).
    props: [{ kind: 'clipboard_board', position: [1.35, 0, 0.75], rotY: -0.4 }],
    staff: { outfit: 'uniform', idle: 'wave', count: 1 },
    signText: 'Guest Shuttle',
    cardKind: 'inclusions',
  },
  escort: {
    chassis: 'VEHICLE',
    props: [
      { kind: 'traffic_cone', position: [-1.3, 0, 0.6] },
      { kind: 'traffic_cone', position: [1.35, 0, 0.45], scale: 0.9 },
    ],
    staff: { outfit: 'vest', idle: 'thumbsUp', count: 1 },
    signText: 'Escort',
    cardKind: 'inclusions',
  },
  // ── NON-WEDDING EVENT-TYPE GAP LEAVES (2026-07-20 · §gap-leaves) ──────────
  // Simple DESK/RISER/STATION/BACKDROP compositions from existing chassis +
  // props only — no new geometry; surface heights per the header cheat-sheet.
  tour_activity: {
    chassis: 'DESK',
    // Itinerary maquette + brochure board — a tour operator's booking desk.
    props: [
      { kind: 'maquette', position: [-0.35, 0.79, 0], scale: 0.9 },
      { kind: 'clipboard_board', position: [0.45, 0.79, 0.08], rotY: -0.15 },
    ],
    staff: { outfit: 'vest', idle: 'present', count: 1 },
    signText: 'Tours & Activities',
    cardKind: 'inclusions',
  },
  tour_guide: {
    chassis: 'DESK',
    props: [{ kind: 'clipboard_board', position: [0, 0.79, 0.05], rotY: 0.1 }],
    staff: { outfit: 'vest', idle: 'wave', count: 1 },
    signText: 'Tour Guide',
    cardKind: 'inclusions',
  },
  restaurant_reservation: {
    chassis: 'DESK',
    // Reservation book (calendar grid) + place settings — a maître d' stand.
    props: [
      { kind: 'calendar_board', position: [-0.35, 0.79, 0.05] },
      { kind: 'plate_stack', position: [0.45, 0.79, 0.1], scale: 0.75 },
    ],
    staff: { outfit: 'vest', idle: 'cardFlip', count: 1 },
    signText: 'Restaurant',
    cardKind: 'menu',
  },
  referee_official: {
    chassis: 'DESK',
    // Officials' table — scoresheet board; the cardFlip idle reads as
    // flipping the score.
    props: [{ kind: 'clipboard_board', position: [0, 0.79, 0.05] }],
    staff: { outfit: 'uniform', idle: 'cardFlip', count: 1 },
    signText: 'Referees & Officials',
    cardKind: 'inclusions',
  },
  event_medic: {
    chassis: 'STATION',
    // First-aid post — supply crates below, towel rolls on the counter.
    props: [
      { kind: 'crate_stack', position: [-1.2, 0, 0.15], scale: 0.9 },
      { kind: 'towel_stack', position: [0.3, 0.94, 0.05] },
    ],
    staff: { outfit: 'uniform', idle: 'wave', count: 1 },
    signText: 'Medic / First-aid',
    cardKind: 'inclusions',
  },
  event_insurance: {
    chassis: 'DESK',
    props: [{ kind: 'clipboard_board', position: [-0.2, 0.79, 0.05], rotY: 0.12 }],
    staff: { outfit: 'uniform', idle: 'cardFlip', count: 1 },
    signText: 'Event Insurance',
    cardKind: 'inclusions',
  },
  personal_accident_insurance: {
    chassis: 'DESK',
    props: [{ kind: 'clipboard_board', position: [0.2, 0.79, 0.05], rotY: -0.12 }],
    staff: { outfit: 'uniform', idle: 'cardFlip', count: 1 },
    signText: 'Personal Accident',
    cardKind: 'inclusions',
  },
  travel_insurance: {
    chassis: 'DESK',
    props: [
      { kind: 'clipboard_board', position: [-0.3, 0.79, 0.05], rotY: 0.1 },
      { kind: 'calendar_board', position: [0.45, 0.79, 0], scale: 0.85 },
    ],
    staff: { outfit: 'uniform', idle: 'cardFlip', count: 1 },
    signText: 'Travel Insurance',
    cardKind: 'inclusions',
  },
  av_production: {
    chassis: 'STATION',
    // Production control — mixing console + camera on sticks + light tree
    // behind the tech (heights mirror lights_sound's cleared placements).
    props: [
      { kind: 'console_speakers', position: [0, 0.94, 0], scale: 0.85 },
      { kind: 'tripod_camera', position: [-1.2, 0, 0.25] },
      { kind: 'light_tree', position: [0, 0, -1.05] },
    ],
    staff: { outfit: 'uniform', idle: 'typing', count: 1 },
    signText: 'AV / Production',
    cardKind: 'inclusions',
  },
  speaker_talent: {
    chassis: 'RISER',
    // Keynote setup — podium + mic (the host_mc anchors, cleared spots).
    props: [
      { kind: 'podium', position: [-0.45, 0.18, 0.25], scale: 0.9 },
      { kind: 'mic_stand', position: [0.4, 0.18, 0.35] },
    ],
    staff: { outfit: 'suit', idle: 'present', count: 1 },
    signText: 'Speakers & Talent',
    cardKind: 'inclusions',
  },
  kids_entertainer: {
    chassis: 'RISER',
    // Party act — the performers hoop-and-ribbon stage-left; waving greeter.
    props: [{ kind: 'hoop_ribbon', position: [-0.7, 0.18, 0.35], scale: 0.9 }],
    staff: { outfit: 'uniform', idle: 'wave', count: 1 },
    signText: "Kids' Entertainer",
    cardKind: 'inclusions',
  },
  reveal_element: {
    chassis: 'BACKDROP',
    // Draped reveal wall — the moment rig stays hidden until the cue.
    props: [{ kind: 'drape_wall', position: [0, 0, -0.35] }],
    staff: { outfit: 'uniform', idle: 'present', count: 1 },
    signText: 'Reveal Element',
    cardKind: 'inclusions',
  },
};

/** All 57 template keys (exported for the admin/debug surfaces — the
 *  /dev/booth-lab stepper counts these). */
export const BOOTH_TEMPLATE_KEYS = Object.keys(BOOTH_TEMPLATES) as WeddingTile[];

// ─────────────────────────────────────────────────────────────────────────────
// Resolution — which template (if any) a placed booth renders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `event_vendors.category` (the couple's registry enum, lib/vendors.ts
 * VendorCategory) → taxonomy leaf. Categories that ARE leaf keys (catering,
 * florist, mobile_bar, crew_meals, choir…) resolve directly against
 * BOOTH_TEMPLATES and don't need a row. The rest map to the honest template;
 * only the categories with no booth read at all (officiant, church_fees,
 * security, accommodation, misc) resolve null → generic BoothMesh.
 * `band_dj` maps to the band template (the fuller stage read — a booked
 * band_dj vendor gets the riser; the DJ template still serves taxonomy-keyed
 * callers and the booth_type fallback below).
 */
const VENDOR_CATEGORY_TO_TILE: Record<string, WeddingTile> = {
  venue: 'reception',
  religious_venue: 'ceremony_venue',
  cake_maker: 'cake',
  photographer: 'photo_video',
  videographer: 'photo_video',
  host_emcee: 'host_mc',
  band_dj: 'live_band',
  string_quartet: 'orchestra',
  planner_coordinator: 'coordinator',
  makeup_artist: 'hmua',
  hair_stylist: 'hmua',
  gown_designer: 'brides_attire',
  suit_designer: 'grooms_attire',
  rings: 'jewelleries_accessories',
  invitations_stationery: 'printing',
  transportation: 'guest_shuttle',
  lights_and_sound: 'lights_sound',
  led_screens: 'led_wall',
  photobooth: 'photo_booth',
  reception_decor: 'stylist_decorator',
  gifts_and_giveaways: 'souvenir_giveaways',
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
  gift_table: 'souvenir_giveaways',
  souvenir_table: 'souvenir_giveaways',
  // registration_desk / custom / unassigned stay untemplated — the front desk
  // keeps its bespoke generic silhouette; blank pins have no identity yet.
};

/**
 * The template a placed booth renders, or null → the caller keeps the
 * existing generic BoothMesh silhouette (now only for booths with no template
 * identity at all: unlinked custom/unassigned/registration_desk pins and the
 * few no-booth vendor categories — every taxonomy leaf resolves). The booked
 * vendor's category wins over the couple's booth_type — the vendor IS the
 * booth's identity once linked. Accepts raw taxonomy leaf keys too (a vendor
 * payload that already speaks WeddingTile resolves directly).
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
 *  footprint, floor-anchored) — still exactly right for the untemplated
 *  booths that render the generic BoothMesh. */
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
 * emitted, so generic-silhouette booths steer identically to before.
 * Every booth-local disc offset is rotated by the booth's computed facing
 * (`boothFacingY`) so the avoidance footprint tracks the rotated chassis — a
 * booth turned 90° swings its multi-lobe footprint to the other axis. The
 * generic booth's single disc sits at the booth centre (zero offset) → its
 * position is rotation-invariant, unchanged.
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
    const facingY = boothFacingY(b, room);
    for (const d of spec.discs) {
      const r = rotateLocalRad({ x: d.x, z: d.z }, facingY);
      out.push({ c: { x: c.x + r.x, z: c.z + r.z }, r: d.r });
    }
    // Staff mascots are solid too (2026-07-08 collision pass): one r 0.3 disc
    // per RENDERED staff anchor — some anchors (e.g. the buffet's two servers
    // at z −0.6) stand outside their chassis footprint discs, and walkers
    // could pass straight through them. Rotated by the booth facing so the
    // discs land under the (now rotated) staff.
    const tpl = boothTemplateFor(b);
    if (tpl) {
      const anchors = spec.staffAnchors.slice(0, tpl.staff.count);
      for (const a of anchors) {
        const r = rotateLocalRad({ x: a.x, z: a.z }, facingY);
        out.push({ c: { x: c.x + r.x, z: c.z + r.z }, r: 0.3 });
      }
    }
  }
  return out;
}
