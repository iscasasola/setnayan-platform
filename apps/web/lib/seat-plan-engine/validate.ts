/**
 * lib/seat-plan-engine/validate.ts — ✅ IS THIS PLAN ONE WE CAN SAVE AND DRAW?
 *
 * One check for both sides. The overlap test is the couple's own placement oracle (`layoutViolations` in
 * `lib/seating.ts`, council verdict 2026-07-16: "there is exactly ONE placement oracle") — a supplier table is handed to
 * it as the couple shape whose body it has (Round and the Half-moon booth as a round body, Long and the square as a
 * banquet body), so a supplier floor and an event floor refuse the same overlaps.
 *
 * Each problem carries plain words (12 or fewer) for the screen, and what it is about, so the page can put the words
 * by the field. Pure. 🔒 lib/seat-plan-engine/engine.test.ts
 */
import { DOOR_CORNER_CLEAR, PLAN_MAX_CHAIRS, PLAN_MAX_SIDE_M, isCoupleTableType, planDrawnShape, planFootprintM, planRoomM, planRoomSized, planTablePositions, type Plan, type PlanTable } from './plan';
import { shapeHintFor, tableGeometry, type TableShapeHint } from './geometry';
import { duplicateNames } from './floors';
import { layoutViolations, stageZone, type OracleZone, type WorldPose } from '@/lib/seating';

export type PlanProblem =
  | { kind: 'room_size'; words: string }
  | { kind: 'chairs'; tableId: string; words: string }
  | { kind: 'duplicate_name'; name: string; words: string }
  | { kind: 'door'; doorId: string; words: string }
  | { kind: 'outside'; tableId: string; words: string }
  | { kind: 'overlap'; tableId: string; otherId: string | null; words: string };

/** The couple body a table is checked as. */
export function oracleShapeOf(t: PlanTable): TableShapeHint {
  if (isCoupleTableType(t.kind)) return shapeHintFor(t.kind);
  const drawn = planDrawnShape(t);
  return drawn === 'long' || drawn === 'square' ? 'long_banquet' : 'round';
}

/** Every table as an oracle pose, in centimetres of the real room (so the oracle measures true sizes). */
export function planOraclePoses(plan: Plan): WorldPose[] {
  const { widthM, depthM } = planRoomM(plan.room);
  const at = planTablePositions(plan.tables);
  return plan.tables.map((t, i) => {
    const shape = oracleShapeOf(t);
    const capacity = Math.max(1, Math.floor(t.chairs));
    const geo = tableGeometry(shape, capacity);
    return {
      tableId: t.id,
      linkGroupId: null,
      shape,
      capacity,
      x: (at[i]!.x / 100) * widthM * 100,
      y: (at[i]!.y / 100) * depthM * 100,
      rot: t.rotationDeg ?? 0,
      scale: (planFootprintM(t) * 100) / geo.box.w,
    };
  });
}

export function validatePlan(plan: Plan): PlanProblem[] {
  const out: PlanProblem[] = [];
  const { widthM, depthM } = plan.room;
  const oneSide = (widthM == null) !== (depthM == null);
  const badSide = [widthM, depthM].some((v) => v != null && (!Number.isFinite(v) || v <= 0 || v > PLAN_MAX_SIDE_M));
  if (oneSide || badSide) out.push({ kind: 'room_size', words: `Give both sides, each up to ${PLAN_MAX_SIDE_M} m.` });

  for (const t of plan.tables) {
    if (!Number.isFinite(t.chairs) || t.chairs < 1 || t.chairs > PLAN_MAX_CHAIRS || Math.floor(t.chairs) !== t.chairs) {
      out.push({ kind: 'chairs', tableId: t.id, words: `${t.label || 'A table'}: 1 to ${PLAN_MAX_CHAIRS} chairs.` });
    }
  }
  for (const name of duplicateNames(plan.tables.map((t) => t.label))) {
    out.push({ kind: 'duplicate_name', name, words: `Two tables are named ${name}.` });
  }

  let mains = 0;
  for (const d of plan.doors) {
    if (d.kind === 'main') mains++;
    if (!Number.isFinite(d.at) || d.at < DOOR_CORNER_CLEAR || d.at > 100 - DOOR_CORNER_CLEAR) {
      out.push({ kind: 'door', doorId: d.id, words: 'A door is too close to a corner.' });
    }
  }
  if (mains > 1) {
    const second = plan.doors.filter((d) => d.kind === 'main')[1]!;
    out.push({ kind: 'door', doorId: second.id, words: 'A room has one main door.' });
  }

  // A free board (no size) may grow past its edges (seat-plan coordinate contract § 1); a sized room may not.
  if (planRoomSized(plan.room)) {
    for (const t of plan.tables) {
      if (t.x === null || t.y === null) continue;
      if (t.x < 0 || t.x > 100 || t.y < 0 || t.y > 100) {
        out.push({ kind: 'outside', tableId: t.id, words: `${t.label || 'A table'} is outside the room.` });
      }
    }
  }

  const { widthM: w, depthM: dpt } = planRoomM(plan.room);
  const zones: OracleZone[] = plan.stage ? [stageZone({ stage_x: plan.stage.x, stage_y: plan.stage.y, stage_w: plan.stage.w, stage_h: plan.stage.h }, { width: w * 100, height: dpt * 100 })] : [];
  const label = new Map(plan.tables.map((t) => [t.id, t.label || 'A table']));
  for (const v of layoutViolations(planOraclePoses(plan), zones, 0)) {
    const first = v.violations.find((x) => x.kind === 'overlap');
    if (!first) continue;
    const other = first.otherId ? label.get(first.otherId) ?? 'a table' : 'the stage';
    out.push({ kind: 'overlap', tableId: v.tableId, otherId: first.otherId, words: `${label.get(v.tableId)} overlaps ${other}.` });
  }
  return out;
}
