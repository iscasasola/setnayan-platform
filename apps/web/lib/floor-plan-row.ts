/**
 * lib/floor-plan-row.ts — THE SEAT PLAN'S FLOOR ROW, READ FROM WHAT A SCREEN POSTS (moved out of `saveFloorPlan` unchanged,
 * owner 2026-10-18 round 3 of "two hosts never overwrite each other").
 *
 * `saveFloorPlan` upserted the WHOLE `event_floor_plan` row — 28 columns from the screen's copy — so an editor opened
 * before the other host (or the 3D lab beside it) moved the stage put the stage back. Now a save also sends the fields it
 * STARTED FROM (`MERGE_BASE_FIELD`, the same keys), both are read through this ONE parser, and only the columns THIS screen
 * changed are written (`changedFields`, `lib/merge-from-base.ts`). No base (an older page): the whole row, as before.
 * Pure — the action, the editor (for its base) and the test use it.
 */
type Get = (key: string) => unknown;

function clampPct(v: unknown): number | null {
  if (typeof v !== 'string' || v.length === 0) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

/** Every column `saveFloorPlan` writes (but `updated_at`), from the posted fields — absent ones take their defaults. */
export function floorPlanRowFrom(get: Get) {
  const stageX = clampPct(get('stage_x'));
  const stageY = clampPct(get('stage_y'));
  const entranceX = clampPct(get('entrance_x'));
  const entranceY = clampPct(get('entrance_y'));
  const entranceEnabled = get('entrance_enabled') === 'true';
  // Main-entrance geometry (migration 20270717284319): door vs walk-through.
  // The schema value stays 'tunnel'; the UI labels it "Walk-through". Depth is
  // METRES (not a percent — never route it through clampPct), clamped 1.5–8.
  const entranceKind = get('entrance_kind') === 'tunnel' ? 'tunnel' : 'door';
  const entranceDepth = ((): number => {
    const raw = get('entrance_depth_m');
    if (typeof raw !== 'string' || raw.length === 0) return 3;
    const n = Number(raw);
    if (!Number.isFinite(n)) return 3;
    return Math.max(1.5, Math.min(8, n));
  })();
  // Floor-plan kit: stage size + dance-floor zone + optional service door.
  // Sizes clamp to 2–100% so a degenerate drag can't zero an element out.
  const clampSize = (v: unknown): number | null => {
    if (typeof v !== 'string' || v.length === 0) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.max(2, Math.min(100, n));
  };
  const stageW = clampSize(get('stage_w'));
  const stageH = clampSize(get('stage_h'));
  const danceEnabled = get('dance_enabled') === 'true';
  const danceX = clampPct(get('dance_x'));
  const danceY = clampPct(get('dance_y'));
  const danceW = clampSize(get('dance_w'));
  const danceH = clampSize(get('dance_h'));
  const serviceEnabled = get('service_entrance_enabled') === 'true';
  const serviceX = clampPct(get('service_entrance_x'));
  const serviceY = clampPct(get('service_entrance_y'));

  // Cocktail / waiting-area room — a second room on the same canvas. Its centre
  // clamps to a WIDER band than 0–100 so the room can dock just OUTSIDE a
  // reception wall (at the entrance door) without being snapped back on-canvas.
  const clampCocktailCoord = (v: unknown): number | null => {
    if (typeof v !== 'string' || v.length === 0) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.max(-80, Math.min(180, n));
  };
  const cocktailEnabled = get('cocktail_enabled') === 'true';
  const cocktailX = clampCocktailCoord(get('cocktail_x'));
  const cocktailY = clampCocktailCoord(get('cocktail_y'));
  const cocktailW = clampSize(get('cocktail_w'));
  const cocktailH = clampSize(get('cocktail_h'));
  const cocktailLabelRaw = get('cocktail_label');
  const cocktailLabel =
    typeof cocktailLabelRaw === 'string' && cocktailLabelRaw.trim().length > 0
      ? cocktailLabelRaw.trim().slice(0, 80)
      : 'Cocktail Area';
  // Couple revoke switch — absent or anything but 'false' keeps vendor edit on.
  const cocktailVendorEdit = get('cocktail_vendor_edit') !== 'false';
  // Dock mode — absent or anything but 'false' keeps it linked (DB default TRUE).
  const cocktailLinked = get('cocktail_linked') !== 'false';

  // Venue dimensions (metres) — null when the couple hasn't set a room size.
  const parseDim = (v: unknown): number | null => {
    if (typeof v !== 'string' || v.length === 0) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.min(500, n);
  };
  const venueWidth = parseDim(get('venue_width_m'));
  const venueLength = parseDim(get('venue_length_m'));
  return {
    stage_x: stageX ?? 50,
    stage_y: stageY ?? 6,
    stage_w: stageW ?? 24,
    stage_h: stageH ?? 7,
    entrance_enabled: entranceEnabled,
    entrance_x: entranceX ?? 50,
    entrance_y: entranceY ?? 94,
    entrance_kind: entranceKind,
    entrance_depth_m: entranceDepth,
    dance_enabled: danceEnabled,
    dance_x: danceX ?? 50,
    dance_y: danceY ?? 55,
    dance_w: danceW ?? 22,
    dance_h: danceH ?? 18,
    service_entrance_enabled: serviceEnabled,
    service_entrance_x: serviceX ?? 97,
    service_entrance_y: serviceY ?? 50,
    cocktail_enabled: cocktailEnabled,
    cocktail_x: cocktailX ?? 50,
    cocktail_y: cocktailY ?? 40,
    cocktail_w: cocktailW ?? 30,
    cocktail_h: cocktailH ?? 22,
    cocktail_label: cocktailLabel,
    cocktail_vendor_edit: cocktailVendorEdit,
    cocktail_linked: cocktailLinked,
    venue_width_m: venueWidth,
    venue_length_m: venueLength,
  };
}
export type FloorPlanWrite = ReturnType<typeof floorPlanRowFrom>;

/** The posted fields a stored floor row reads as — what an editor that drew this row sends as its base. */
export function floorPlanFieldsOf(row: {
  stage_x: number; stage_y: number; stage_w: number; stage_h: number;
  entrance_enabled: boolean; entrance_x: number; entrance_y: number; entrance_kind: string; entrance_depth_m: number;
  dance_enabled: boolean; dance_x: number; dance_y: number; dance_w: number; dance_h: number;
  service_entrance_enabled: boolean; service_entrance_x: number; service_entrance_y: number;
  cocktail_enabled: boolean; cocktail_x: number; cocktail_y: number; cocktail_w: number; cocktail_h: number;
  cocktail_label: string; cocktail_vendor_edit: boolean; cocktail_linked: boolean;
  venue_width_m: number | null; venue_length_m: number | null;
}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'venue_width_m' || k === 'venue_length_m') continue;
    out[k] = typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v);
  }
  if (row.venue_width_m !== null && row.venue_length_m !== null && row.venue_width_m > 0 && row.venue_length_m > 0) {
    out.venue_width_m = String(row.venue_width_m);
    out.venue_length_m = String(row.venue_length_m);
  }
  return out;
}
