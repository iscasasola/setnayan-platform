import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { fetchGuestsByEvent, guestDisplayName } from '@/lib/guests';
import {
  fetchTables,
  fetchAssignments,
  fetchFloorPlan,
  guestTier,
  defaultTablePosition,
} from '@/lib/seating';
import { shapeHintFor, type Lab3DTable, type Lab3DFloor, type Lab3DGuest } from '@/lib/seating-3d';
import { SeatingLabLoader } from './_components/seating-lab-loader';

export const metadata = { title: 'Seating · 3D lab (prototype)' };

type Props = { params: Promise<{ eventId: string }> };

/**
 * 3D seating lab — a flag-gated 3D editor that renders the couple's real plan
 * as a navigable 3D room ("Sims build" + walk-to-seat). Gated by
 * `NEXT_PUBLIC_SEATING_3D`; off → 404 (the route doesn't exist for users).
 * Edits (move / rotate / delete / add) persist through the SAME single-editor
 * lock + server actions as the 2D editor, so 3D and 2D share one plan. See the
 * as-built doc `0008_Seating_AS_BUILT_2026-06-21.md` for the data contract.
 */
export default async function SeatingLabPage({ params }: Props) {
  if (process.env.NEXT_PUBLIC_SEATING_3D !== 'true') notFound();

  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const [tablesRaw, assignments, guestsRaw, floorPlan, moodboard] = await Promise.all([
    fetchTables(supabase, eventId),
    fetchAssignments(supabase, eventId),
    fetchGuestsByEvent(supabase, eventId),
    fetchFloorPlan(supabase, eventId),
    supabase
      .from('event_moodboard_saves')
      .select('palette_snapshot')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Tables created but never dragged onto the spatial canvas have null
  // x_pos/y_pos. Mirror the 2D editor's grid fallback (defaultTablePosition)
  // so the 3D room matches what the couple sees in 2D — Number(null) would
  // otherwise stack every un-positioned table in the back-left corner.
  const spread = !(floorPlan.venue_width_m && floorPlan.venue_length_m);
  const tables: Lab3DTable[] = tablesRaw.map((t, i) => {
    const positioned = t.x_pos != null && t.y_pos != null;
    const pos = positioned
      ? { x: Number(t.x_pos), y: Number(t.y_pos) }
      : defaultTablePosition(i, tablesRaw.length, spread);
    return {
      id: t.table_id,
      label: t.link_group_label ?? t.table_label,
      type: t.table_type,
      shape: shapeHintFor(t.table_type),
      capacity: t.capacity,
      removedSeats: t.removed_seats ?? [],
      xPct: pos.x,
      yPct: pos.y,
      rotationDeg: t.rotation_deg ?? 0,
      linkGroupId: t.link_group_id ?? null,
    };
  });

  const seatByGuest = new Map(assignments.map((a) => [a.guest_id, a]));
  const guests: Lab3DGuest[] = guestsRaw.map((g) => {
    const seat = seatByGuest.get(g.guest_id);
    return {
      id: g.guest_id,
      name: guestDisplayName(g),
      seatedTableId: seat?.table_id ?? null,
      seatNumber: seat?.seat_number ?? null,
      tier: guestTier(g.role, g.group_category, g.seating_priority),
    };
  });

  const floor: Lab3DFloor = {
    venueWidthM: floorPlan.venue_width_m ?? null,
    venueLengthM: floorPlan.venue_length_m ?? null,
    stage: { xPct: floorPlan.stage_x, yPct: floorPlan.stage_y, wPct: floorPlan.stage_w, hPct: floorPlan.stage_h },
    entrance: { enabled: floorPlan.entrance_enabled, xPct: floorPlan.entrance_x, yPct: floorPlan.entrance_y },
    dance: {
      enabled: floorPlan.dance_enabled,
      xPct: floorPlan.dance_x,
      yPct: floorPlan.dance_y,
      wPct: floorPlan.dance_w,
      hPct: floorPlan.dance_h,
    },
    published: floorPlan.published_at != null,
  };

  const snapshot = (moodboard.data?.palette_snapshot ?? {}) as Record<string, unknown>;
  const paletteHexes = Object.values(snapshot).filter((v): v is string => typeof v === 'string');

  return (
    <section className="space-y-3">
      <SeatingLabLoader
        eventId={eventId}
        tables={tables}
        floor={floor}
        guests={guests}
        paletteHexes={paletteHexes}
        coupleNames={null}
        me={{
          id: user.id,
          name:
            (user.user_metadata?.display_name as string | undefined) ||
            (user.user_metadata?.full_name as string | undefined) ||
            user.email?.split('@')[0] ||
            'Someone',
        }}
      />
    </section>
  );
}
