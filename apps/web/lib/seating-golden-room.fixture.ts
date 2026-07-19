/**
 * GOLDEN SEAT-PLAN FIXTURE (Seat_Plan_2D3D_Sync_Council_Verdict_2026-07-16 · § 6).
 *
 * Two rooms shaped exactly as `event_tables` / `event_floor_plan` rows — a SIZED
 * 12×18 m room and a FREE board (venue dims null ⇒ the default 20×30) — each with
 * a `round_10`, a `long_banquet_8` @ 45°, a `sweetheart`, a NULL-position table,
 * and a CONNECTED S-bend serpentine pair whose SECOND pose is the literal
 * `legalJoinPoseM` output. The proof suite (`seating-parity.test.ts`) drives both
 * projection paths through these rows and asserts identical world poses, so the
 * three Guns can never silently regress.
 *
 * The connected pair is COMPUTED from the shared projection API (contract v2), so
 * the fixture stays self-consistent with the one geometry family: B is exactly
 * where A's tip S-bends to, projected back to percent.
 */
import {
  metricGeometry,
  metricPoseM,
  legalJoinPoseM,
  worldToPctM,
  roomBoxM,
  rotatePoint,
  type TableType,
} from './seating';

export type GoldenTableRow = {
  table_id: string;
  table_type: TableType;
  capacity: number;
  x_pos: number | null;
  y_pos: number | null;
  rotation_deg: number;
  link_group_id: string | null;
};

export type GoldenFloor = {
  venue_width_m: number | null;
  venue_length_m: number | null;
  stage_x: number;
  stage_y: number;
  stage_w: number;
  stage_h: number;
};

export type GoldenRoom = {
  name: string;
  floor: GoldenFloor;
  tables: GoldenTableRow[];
  /** The anchor + mover ids of the connected S-bend pair. */
  sBend: { anchorId: string; moverId: string };
};

const STAGE = { stage_x: 50, stage_y: 6, stage_w: 24, stage_h: 7 };

// The anchor serpentine's canonical pose — the owner's screenshot as data.
const ANCHOR = { x_pos: 40, y_pos: 55, rotation_deg: 20 };

/** Compute the S-bend mover pose for a serpentine anchor, via the shared API, and
 *  return it as a percent-space row (the literal `legalJoinPoseM` output). */
function sBendMover(
  anchor: GoldenTableRow,
  room: { w: number; d: number },
): { xPct: number; yPct: number; rot: number } {
  const aPose = metricPoseM(anchor, anchor.x_pos!, anchor.y_pos!, room);
  // A's +tip in world metres (local metric tip rotated by the anchor angle).
  const tipLocal = metricGeometry('serpentine', anchor.capacity).tipsM!.plus;
  const tw = rotatePoint({ x: tipLocal.x, y: tipLocal.y }, anchor.rotation_deg);
  const tip = { x: aPose.x + tw.x, y: aPose.y + tw.y };
  // The S-bend reflects the anchor's centre through the tip → nearest candidate.
  const drag = { ...aPose, x: 2 * tip.x - aPose.x, y: 2 * tip.y - aPose.y, rot: (anchor.rotation_deg + 180) % 360 };
  const snap = legalJoinPoseM(aPose, drag);
  if (!snap) throw new Error('golden fixture: S-bend snap did not resolve');
  const pct = worldToPctM(snap.x, snap.y, room);
  return { xPct: pct.xPct, yPct: pct.yPct, rot: snap.rot };
}

function buildRoom(name: string, venue_width_m: number | null, venue_length_m: number | null): GoldenRoom {
  const floor: GoldenFloor = { venue_width_m, venue_length_m, ...STAGE };
  const room = roomBoxM(floor);

  const anchor: GoldenTableRow = {
    table_id: `${name}-serpA`,
    table_type: 'serpentine',
    capacity: 5,
    x_pos: ANCHOR.x_pos,
    y_pos: ANCHOR.y_pos,
    rotation_deg: ANCHOR.rotation_deg,
    link_group_id: null,
  };
  const b = sBendMover(anchor, room);
  const mover: GoldenTableRow = {
    table_id: `${name}-serpB`,
    table_type: 'serpentine',
    capacity: 5,
    x_pos: b.xPct,
    y_pos: b.yPct,
    rotation_deg: b.rot,
    link_group_id: null,
  };

  const tables: GoldenTableRow[] = [
    { table_id: `${name}-round`, table_type: 'round_10', capacity: 10, x_pos: 25, y_pos: 30, rotation_deg: 0, link_group_id: null },
    { table_id: `${name}-banquet`, table_type: 'long_banquet_8', capacity: 8, x_pos: 70, y_pos: 35, rotation_deg: 45, link_group_id: null },
    { table_id: `${name}-sweet`, table_type: 'sweetheart_2', capacity: 2, x_pos: 50, y_pos: 8, rotation_deg: 0, link_group_id: null },
    { table_id: `${name}-null`, table_type: 'round_10', capacity: 10, x_pos: null, y_pos: null, rotation_deg: 0, link_group_id: null },
    anchor,
    mover,
  ];

  return { name, floor, tables, sBend: { anchorId: anchor.table_id, moverId: mover.table_id } };
}

/** SIZED 12×18 m room — rows already conform to contract v2 (isotropic % of metres). */
export const GOLDEN_SIZED: GoldenRoom = buildRoom('sized', 12, 18);

/** FREE board — venue dims null ⇒ the default 20×30, the canonical read (verdict § 4). */
export const GOLDEN_FREE: GoldenRoom = buildRoom('free', null, null);

export const GOLDEN_ROOMS: GoldenRoom[] = [GOLDEN_SIZED, GOLDEN_FREE];
