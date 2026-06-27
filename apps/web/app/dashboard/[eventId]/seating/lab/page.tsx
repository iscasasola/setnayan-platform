import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';
import { getCurrentUser } from '@/lib/auth';
import {
  fetchGuestsByEvent,
  guestDisplayName,
  resolveGuestAttire,
  fetchGuestGroupsByEvent,
  fetchGroupMembershipsByEvent,
} from '@/lib/guests';
import {
  fetchTables,
  fetchAssignments,
  fetchFloorPlan,
  fetchSeatingConstraints,
  defaultPriorityOrder,
  guestTier,
  defaultTablePosition,
} from '@/lib/seating';
import { shapeHintFor, type Lab3DTable, type Lab3DFloor, type Lab3DFloorExtras, type Lab3DGuest, type Lab3DGroup, type Lab3DMonogram } from '@/lib/seating-3d';
import { resolveMonogram } from '@/lib/monogram';
import { eventAnimatedMonogramActive } from '@/lib/animated-monogram';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { SeatingLabLoader } from './_components/seating-lab-loader';

export const metadata = { title: 'Seating · 3D lab (prototype)' };

type Props = { params: Promise<{ eventId: string }> };

/**
 * 3D seating lab — a 3D editor that renders the couple's real plan as a
 * navigable 3D room ("Sims build" + walk-to-seat). On for every couple by
 * default; `NEXT_PUBLIC_SEATING_3D='false'` is the kill-switch (→ 404, so the
 * route disappears) if the prototype needs pulling in production.
 * Edits (move / rotate / delete / add) persist through the SAME single-editor
 * lock + server actions as the 2D editor, so 3D and 2D share one plan. See the
 * as-built doc `0008_Seating_AS_BUILT_2026-06-21.md` for the data contract.
 */
export default async function SeatingLabPage({ params }: Props) {
  if (process.env.NEXT_PUBLIC_SEATING_3D === 'false') notFound();

  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const [tablesRaw, assignments, guestsRaw, floorPlan, constraints, groupsRaw, memberships, moodboard, eventRow, roleSet] = await Promise.all([
    fetchTables(supabase, eventId),
    fetchAssignments(supabase, eventId),
    fetchGuestsByEvent(supabase, eventId),
    fetchFloorPlan(supabase, eventId),
    fetchSeatingConstraints(supabase, eventId),
    fetchGuestGroupsByEvent(supabase, eventId),
    fetchGroupMembershipsByEvent(supabase, eventId),
    supabase
      .from('event_moodboard_saves')
      .select('palette_snapshot')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // The couple's monogram columns — to render their canonical mark on the 3D
    // floor (animated-logo rollout). RLS already scopes this to the member; the
    // sibling seating/print route reads `events` by event_id the same way.
    supabase
      .from('events')
      .select(
        'display_name, monogram_text, monogram_color, monogram_font_key, monogram_style, monogram_frame_key, monogram_custom_svg, monogram_uploaded_svg, role_palette',
      )
      .eq('event_id', eventId)
      .maybeSingle(),
    // Iteration 0053 P4 Unit 6: per-event-type role set for the 3D tier annotation.
    resolveRoleSetForEvent(eventId),
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

  // Guest photo_url is a stored r2:// ref (or a raw avatar URL) — resolve each to
  // a display URL so the 3D avatars wear the guest's actual selfie (owner
  // 2026-06-25). Mirrors the 2D seating page's resolver; signs in parallel.
  const photoDisplayUrls: Record<string, string> = Object.fromEntries(
    (
      await Promise.all(
        guestsRaw
          .filter((g) => g.photo_url)
          .map(async (g) => [g.photo_url!, await displayUrlForStoredAsset(g.photo_url)] as const),
      )
    ).filter((e): e is [string, string] => e[1] !== null),
  );

  // Attire motif colours from the mood-board role palette: a gown takes the
  // wedding-party (else bride) attire colour, a suit takes the groom attire
  // colour — each with a tasteful fallback (blush / charcoal) so an avatar
  // always has a sensible hue even before the couple builds a palette.
  const rolePalette = sanitizeRolePalette((eventRow.data as Record<string, unknown> | null)?.role_palette);
  const gownColor = rolePalette.wedding_party?.[0] ?? rolePalette.bride?.[0] ?? '#c9a4ad';
  const suitColor = rolePalette.groom?.[0] ?? '#2b2f38';

  const guests: Lab3DGuest[] = guestsRaw.map((g) => {
    const seat = seatByGuest.get(g.guest_id);
    const rsvp = (['attending', 'pending', 'maybe', 'declined'] as const).includes(
      g.rsvp_status as 'attending' | 'pending' | 'maybe' | 'declined',
    )
      ? (g.rsvp_status as 'attending' | 'pending' | 'maybe' | 'declined')
      : 'pending';
    const attire = resolveGuestAttire(g.role, g.attire);
    return {
      id: g.guest_id,
      name: guestDisplayName(g),
      seatedTableId: seat?.table_id ?? null,
      seatNumber: seat?.seat_number ?? null,
      tier: guestTier(g.role, g.group_category, g.seating_priority, roleSet),
      seatingPriority: g.seating_priority ?? null,
      groupId: memberships.get(g.guest_id)?.[0] ?? null,
      rsvp,
      side: g.side,
      plusOneAllowed: Boolean(g.plus_one_allowed),
      plusOneOfGuestId: g.plus_one_of_guest_id ?? null,
      photoUrl: g.photo_url ? photoDisplayUrls[g.photo_url] ?? null : null,
      attire,
      attireColor: attire === 'gown' ? gownColor : attire === 'suit' ? suitColor : null,
    };
  });

  // Custom guest groups (for "seat this whole group at a table"). Only groups
  // that actually have members are worth offering.
  const groups: Lab3DGroup[] = groupsRaw
    .filter((gr) => gr.member_count > 0)
    .map((gr) => ({ id: gr.group_id, label: gr.label, memberCount: gr.member_count }));

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

  // Fields the lab doesn't edit but must preserve on save (saveFloorPlan writes
  // the whole row) — the service door + the cocktail/waiting room.
  const floorExtras: Lab3DFloorExtras = {
    serviceEntranceEnabled: floorPlan.service_entrance_enabled,
    serviceEntranceX: floorPlan.service_entrance_x,
    serviceEntranceY: floorPlan.service_entrance_y,
    cocktailEnabled: floorPlan.cocktail_enabled,
    cocktailX: floorPlan.cocktail_x,
    cocktailY: floorPlan.cocktail_y,
    cocktailW: floorPlan.cocktail_w,
    cocktailH: floorPlan.cocktail_h,
    cocktailLabel: floorPlan.cocktail_label,
    cocktailVendorEdit: floorPlan.cocktail_vendor_edit,
    cocktailLinked: floorPlan.cocktail_linked,
  };

  const snapshot = (moodboard.data?.palette_snapshot ?? {}) as Record<string, unknown>;
  const paletteHexes = Object.values(snapshot).filter((v): v is string => typeof v === 'string');

  // The couple's canonical mark for the 3D floor medallion. Precedence mirrors
  // the public hero (owner rule 2026-06-15): an uploaded SVG outranks the
  // AI/Cipher mark, which outranks the lettered lockup/initials. resolveMonogram
  // derives initials from display_name when no monogram_text is set, so the
  // config branch always yields a mark — no separate fallback needed. null only
  // when the event row is missing (e.g. RLS/race) → the scene renders mark-free.
  const event = eventRow.data;
  const bespoke =
    (typeof event?.monogram_uploaded_svg === 'string' && event.monogram_uploaded_svg.trim()
      ? event.monogram_uploaded_svg
      : null) ??
    (typeof event?.monogram_custom_svg === 'string' && event.monogram_custom_svg.trim()
      ? event.monogram_custom_svg
      : null);
  const monogram: Lab3DMonogram = event
    ? bespoke
      ? { kind: 'svg', svg: bespoke }
      : { kind: 'config', monogram: resolveMonogram(event) }
    : null;

  // Paid ANIMATED_MONOGRAM gate — when owned, the floor medallion blooms in as
  // the Play-mode camera settles (free events keep the static mark, so the
  // seat-plan tool stays free). A missing orders table/column resolves to false
  // (no bloom); other read errors propagate, matching the codebase pattern.
  const ownsAnimatedMonogram = await eventAnimatedMonogramActive(supabase, eventId);

  return (
    <section className="space-y-3">
      <SeatingLabLoader
        eventId={eventId}
        tables={tables}
        floor={floor}
        guests={guests}
        paletteHexes={paletteHexes}
        rolePalette={rolePalette}
        monogram={monogram}
        animatedMonogram={ownsAnimatedMonogram}
        me={{
          id: user.id,
          name:
            (user.user_metadata?.display_name as string | undefined) ||
            (user.user_metadata?.full_name as string | undefined) ||
            user.email?.split('@')[0] ||
            'Someone',
        }}
        keepApart={constraints}
        priorityOrder={floorPlan.priority_order ?? defaultPriorityOrder(roleSet)}
        roleSetKey={roleSet.key}
        groups={groups}
        floorExtras={floorExtras}
      />
    </section>
  );
}
