'use client';

/**
 * Client-only loader for the 3D seating lab. Three.js needs the browser's
 * WebGL context + `window`, which don't exist during SSR — so the heavy scene
 * is dynamically imported with `ssr: false` (the same proven pattern the
 * Save-the-Date veil reveal uses). This wrapper renders a lightweight
 * placeholder while the WebGL bundle streams in.
 */

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import { PlanPoster } from '@/app/_components/plan-maker/plan-maker';
import { isCoupleTableType, snapDoor, type Plan } from '@/lib/seat-plan-engine';
import { DEFAULT_ROOM_M } from '@/lib/seating';
import { formatCount } from '@/lib/format-number';
import type {
  Lab3DTable,
  Lab3DFloor,
  Lab3DFloorExtras,
  Lab3DGuest,
  Lab3DGroup,
  Lab3DMonogram,
  Lab3DSceneObject,
  Lab3DBooth,
  Lab3DSign,
} from '@/lib/seating-3d';
import type { KeepApartRule, PriorityOrder } from '@/lib/seating';
import type { RolePalette } from '@/lib/mood-board';
import type { BookedZoneCandidate } from '@/lib/reception-suggestion-chips';
import type { ReceptionDesign } from '@/lib/reception-scene';
import type { MoodboardStyleFamily } from '@/lib/moodboard-templates';
import type { GhostBooth3D } from '@/lib/ghost-booths';

/* 🖼 NEVER A BLANK SCREEN (owner 2026-11-20, drawing § 6; the fault, live: 15–20 s of black while the room loaded). The
   room's code and its scene take that long on a phone; the couple's own floor plan is already known. So the plan is
   drawn AT ONCE as a poster, with "Building your room…" over it, and it lifts when the room has drawn its first frames
   (`onRoomReady`). The bundle's own placeholder is therefore nothing — the poster is what shows. */
const SeatingLab3D = dynamic(() => import('./seating-lab-3d'), { ssr: false, loading: () => null });

type Props = {
  eventId: string;
  /** Drawn inside the Maker's Details › Seat plan (its 3D view), beside the 2D editor. */
  inMaker?: boolean;
  tables: Lab3DTable[];
  floor: Lab3DFloor;
  guests: Lab3DGuest[];
  rolePalette: RolePalette;
  /** Couple's saved reception treatments (Wave 2b) — drives the 3D decor. */
  receptionDesign: ReceptionDesign;
  /** The couple's own inspiration photos, keyed by design part. Only the five
   *  parts with a matching slot appear; a part with none is simply absent, and
   *  shows no reference rather than an unrelated photo. */
  inspirationByPart?: Record<string, string[]>;
  /** MB15 — the room zones a supplier has AGREED to build, keyed by RECEPTION
   *  part id, resolved on the server through `isPartFinalized`. An entry means
   *  the chips for that zone are frozen and the panel says who agreed and when.
   *  Absent = nothing agreed, which is the common case. */
  finalizedByPart?: Record<string, { vendorName: string | null; agreedAt: string | null }>;
  /** RV2 — booked suppliers whose trade reaches a reception zone (owner ruling
   *  Q9, 2026-09-06). OFFERS, not settings: nothing here has been applied to
   *  `receptionDesign`, and rendering them applies nothing. Resolved on the
   *  server because the trade map reaches `next/headers`. */
  bookedSuggestions?: BookedZoneCandidate[];
  /** RV2 — suggestion keys this couple has already waved away
   *  (`events.dismissed_room_suggestions`). */
  dismissedSuggestions?: string[];
  /** MB15 — `events.moodboard_theme_name`, the couple's own name for this
   *  look. Null when they have not named one; the room then says nothing rather
   *  than inventing a title. */
  themeName?: string | null;
  /** `events.moodboard_style_family` — which theme family produced this board,
   *  or null when the couple hasn't applied a template. Drives the reception
   *  decor AI-image layer pilot's asset lookup (@/lib/reception-decor-layers). */
  styleFamily: MoodboardStyleFamily | null;
  /** Room archetype (`events.venue_setting`) — swaps the 3D room shell. */
  venueSetting: string;
  monogram: Lab3DMonogram;
  /** Couple owns the paid ANIMATED_MONOGRAM → the floor mark blooms on Play. */
  animatedMonogram: boolean;
  me: { id: string; name: string };
  /** Smart seat-plan rules — keep-apart pairs + the couple's tier priority order. */
  keepApart: KeepApartRule[];
  priorityOrder: PriorityOrder;
  roleSetKey: string;
  groups: Lab3DGroup[];
  floorExtras: Lab3DFloorExtras;
  /** Placed venue fixtures rendered read-only in 3D (the 2D editor owns edits). */
  sceneObjects: Lab3DSceneObject[];
  booths: Lab3DBooth[];
  signs: Lab3DSign[];
  /** 3D Booth Ads Part A (flag-gated) — dashed ghost booths for unbooked vendor
   *  categories + the couple's master toggle. Empty/true when the flag is off. */
  ghostBooths: GhostBooth3D[];
  ghostBoothsEnabled: boolean;
};

export function SeatingLabLoader(props: Props) {
  const [ready, setReady] = useState(false);
  const onRoomReady = useCallback(() => setReady(true), []);
  return (
    <>
      <SeatingLab3D {...props} onRoomReady={onRoomReady} />
      {ready ? null : <RoomBuilding tables={props.tables} floor={props.floor} guests={props.guests} />}
    </>
  );
}

/** The plan as a poster while the 3D room builds — the shared core's drawing (`PlanPoster`), nothing of its own. */
export function RoomBuilding({ tables, floor, guests }: Pick<Props, 'tables' | 'floor' | 'guests'>) {
  const plan: Plan = {
    room: { widthM: floor.venueWidthM, depthM: floor.venueLengthM },
    doors: floor.entrance.enabled ? [{ id: 'entrance', kind: 'main', ...snapDoor(floor.entrance.xPct, floor.entrance.yPct) }] : [],
    tables: tables.map((t) => ({
      id: t.id,
      label: t.label.match(/\d+/)?.[0] ?? t.label,
      kind: isCoupleTableType(t.type) ? t.type : 'round',
      chairs: t.capacity,
      x: t.xPct,
      y: t.yPct,
      rotationDeg: t.rotationDeg,
      removedSeats: t.removedSeats,
      linked: t.linkGroupId != null,
    })),
  };
  // The couple's unsized board is 20 × 30 m (the plan core's own default is a shop's landscape room).
  if (plan.room.widthM === null || plan.room.depthM === null) plan.room = { widthM: DEFAULT_ROOM_M.w, depthM: DEFAULT_ROOM_M.d };
  const seated = guests.filter((g) => g.seatedTableId).length;
  return (
    <div data-room-building="" role="status" aria-live="polite" className="absolute inset-0 z-40 flex items-center justify-center bg-[#13151c] p-6 text-white">
      <PlanPoster plan={plan} className="max-h-full max-w-full opacity-40" />
      <div className="absolute left-1/2 top-1/2 w-[min(18rem,80%)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-black/60 p-4 backdrop-blur-md">
        <p className="text-[15px] font-semibold">Building your room…</p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/20" aria-hidden>
          <div className="h-full w-1/2 animate-pulse rounded-full bg-champagne" />
        </div>
        <p className="mt-2 text-[13px] text-white/75">
          {formatCount(tables.length)} {tables.length === 1 ? 'table' : 'tables'}, {formatCount(seated)} of {formatCount(guests.length)} guests seated. Your floor plan shows meanwhile.
        </p>
      </div>
    </div>
  );
}
