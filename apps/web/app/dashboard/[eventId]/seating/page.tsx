import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';
import { getCurrentUser } from '@/lib/auth';
import {
  fetchGuestsByEvent,
  fetchGuestGroupsByEvent,
  fetchGroupMembershipsByEvent,
  guestDisplayName,
  guestInitials,
} from '@/lib/guests';
import {
  effectiveCapacity,
  fetchAssignments,
  fetchBooths,
  fetchFloorPlan,
  fetchSeatingConstraints,
  fetchSigns,
  fetchTables,
  groupColorFor,
} from '@/lib/seating';
import { fetchBookedVendorsForBooths } from '@/lib/vendors';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { isChineseWedding } from '@/lib/chinese-wedding';
import { MiniTour } from '@/app/_components/mini-tour';
import { SeatingEditor, type SeatingGuest, type SeatingGroup } from './_components/seating-editor';
import { setSeatingAutoplace, setSeatingGroupAdjacency } from './actions';

export const metadata = { title: 'Seating chart' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ view?: string }>;
};

export default async function SeatingPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const { view: viewParam } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const [tables, assignments, guests, groupsRaw, memberships, floorPlan, booths, signs, eventRow, constraints, roleSet, bookedVendors] =
    await Promise.all([
      fetchTables(supabase, eventId),
      fetchAssignments(supabase, eventId),
      fetchGuestsByEvent(supabase, eventId),
      fetchGuestGroupsByEvent(supabase, eventId),
      fetchGroupMembershipsByEvent(supabase, eventId),
      fetchFloorPlan(supabase, eventId),
      fetchBooths(supabase, eventId),
      fetchSigns(supabase, eventId),
      supabase
        .from('events')
        .select('event_date, ceremony_type, secondary_ceremony_type, gender_separation, seating_autoplace_enabled, seating_group_adjacency')
        .eq('event_id', eventId)
        .maybeSingle(),
      fetchSeatingConstraints(supabase, eventId),
      // Iteration 0053 P4 Unit 6: per-event-type role set for seating tiers/labels.
      resolveRoleSetForEvent(eventId),
      // Booth picker (decision #9): only BOOKED vendors are offered as booths.
      fetchBookedVendorsForBooths(supabase, eventId),
    ]);
  const eventDate = (eventRow.data?.event_date as string | null) ?? null;
  // Chinese (Tsinoy) tradition avoids table number 4 (四 ≈ 死). Advisory only:
  // drives a gentle notice on a manual "Table 4" + the skip-4 auto-draft. Derived
  // via the shared overlay predicate (primary OR secondary Chinese rite).
  const chineseTradition = isChineseWedding(eventRow.data ?? null);
  // Muslim walima seating posture the couple chose in the Nikah card. Advisory
  // only — Setnayan does NOT auto-reflow seats (the couple confirms the exact
  // arrangement with their imam); this is a banner so whoever lays out the tables
  // knows the couple's intent. 'none' (default / most common) shows nothing.
  const genderSeparation =
    (eventRow.data as { gender_separation?: string | null } | null)
      ?.gender_separation ?? null;
  const genderSeparationNote =
    genderSeparation === 'sections'
      ? 'This couple requested separate men’s & women’s sections for the walima — arrange tables accordingly.'
      : genderSeparation === 'separate_spaces'
        ? 'This couple requested separate spaces / halls for men and women at the walima — plan the layout accordingly.'
        : null;

  const seatByGuest = new Map(assignments.map((a) => [a.guest_id, a]));

  // Guest photo_url is a stored r2:// ref (or a raw avatar URL) — resolve each
  // to a display URL the same way the guest list does, signing in parallel.
  const photoDisplayUrls: Record<string, string> = Object.fromEntries(
    (
      await Promise.all(
        guests
          .filter((g) => g.photo_url)
          .map(async (g) => [g.photo_url!, await displayUrlForStoredAsset(g.photo_url)] as const),
      )
    ).filter((e): e is [string, string] => e[1] !== null),
  );

  // Deterministic per-group accent colour, indexed by the group's position in
  // the event's group list (no schema column needed). Drives the sidebar dots,
  // each chair's ring, and the table's group-tint halo on the canvas.
  const groups: SeatingGroup[] = groupsRaw.map((g, i) => ({
    group_id: g.group_id,
    label: g.label,
    color: groupColorFor(i),
    member_count: g.member_count,
  }));

  const seatingGuests: SeatingGuest[] = guests.map((g) => {
    const seat = seatByGuest.get(g.guest_id);
    const groupIds = memberships.get(g.guest_id) ?? [];
    return {
      guest_id: g.guest_id,
      name: guestDisplayName(g),
      initials: guestInitials(g),
      photo_url: g.photo_url ? photoDisplayUrls[g.photo_url] ?? null : null,
      side: g.side,
      group_id: groupIds[0] ?? null,
      rsvp_status: g.rsvp_status,
      seated_table_id: seat?.table_id ?? null,
      seat_number: seat?.seat_number ?? null,
      seat_locked: seat?.locked ?? false,
      role: g.role,
      group_category: g.group_category,
      meal_preference: g.meal_preference,
      dietary_restrictions: g.dietary_restrictions,
      seating_priority: g.seating_priority,
    };
  });

  // Seat-reservation summary (RSVP "holds a place" → couple seats them).
  // Reserved = guests who confirmed attendance; seated = those already in a
  // chair; the rest still need a seat. Plus-ones are their own guest rows.
  const reservedGuests = seatingGuests.filter((g) => g.rsvp_status === 'attending');
  const reservedCount = reservedGuests.length;
  const seatedCount = reservedGuests.filter((g) => g.seated_table_id !== null).length;
  const toSeatCount = reservedCount - seatedCount;

  // Smart Seat-Plan Phase 5: live auto-seating on/off + a capacity check.
  // Reconcile can only seat as many guests as there are chairs, so surface when
  // the couple needs more tables. Counts every NON-declined guest (pending +
  // maybe get held seats too) against total effective (occupiable) capacity.
  const autoplaceEnabled =
    (eventRow.data as { seating_autoplace_enabled?: boolean | null } | null)
      ?.seating_autoplace_enabled ?? true;
  // Group-overflow adjacency (gap G8) — ON unless the couple opted out.
  const adjacencyEnabled =
    (eventRow.data as { seating_group_adjacency?: boolean | null } | null)
      ?.seating_group_adjacency ?? true;
  const nonDeclinedCount = seatingGuests.filter((g) => g.rsvp_status !== 'declined').length;
  const totalSeats = tables.reduce(
    (sum, t) => sum + effectiveCapacity(t.capacity, t.removed_seats),
    0,
  );
  const seatShortfall = Math.max(0, nonDeclinedCount - totalSeats);

  return (
    <>
      {/* Heading kept screen-reader-only for a11y/SEO. The whole editor is now a
          fixed 100dvh frame (scroll-less council verdict 2026-07-15): the
          reserved→seated stats, the two seating policies, the walkthrough link,
          and the day-of / walima / capacity banners all moved INTO the editor's
          command bar + banner slot. This wrapper bleeds the shell content
          padding so the frame fills the viewport with no document scroll. */}
      <h1 className="sr-only">Seating chart</h1>
      <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-8">
        <SeatingEditor
          eventId={eventId}
          roleSetKey={roleSet.key}
          chineseTradition={chineseTradition}
          tables={tables}
          guests={seatingGuests}
          groups={groups}
          floorPlan={floorPlan}
          booths={booths}
          signs={signs}
          bookedVendors={bookedVendors}
          constraints={constraints}
          eventDate={eventDate}
          genderSeparationNote={genderSeparationNote}
          seatShortfall={seatShortfall}
          nonDeclinedCount={nonDeclinedCount}
          totalSeats={totalSeats}
          autoplaceEnabled={autoplaceEnabled}
          adjacencyEnabled={adjacencyEnabled}
          reservedCount={reservedCount}
          toSeatReserved={toSeatCount}
          setSeatingAutoplace={setSeatingAutoplace}
          setSeatingGroupAdjacency={setSeatingGroupAdjacency}
          initialView={viewParam === 'list' ? 'list' : 'plan'}
          me={{
            id: user.id,
            name:
              (user.user_metadata?.display_name as string | undefined) ||
              (user.user_metadata?.full_name as string | undefined) ||
              user.email?.split('@')[0] ||
              'Someone',
          }}
        />
      </div>

      <MiniTour tourKey="customer_seat_plan_v1" />
    </>
  );
}
