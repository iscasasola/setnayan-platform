import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import {
  fetchGuestsByEvent,
  fetchGuestGroupsByEvent,
  fetchGroupMembershipsByEvent,
  guestDisplayName,
  guestInitials,
} from '@/lib/guests';
import { fetchAssignments, fetchFloorPlan, fetchTables, groupColorFor } from '@/lib/seating';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { MiniTour } from '@/app/_components/mini-tour';
import { SeatingEditor, type SeatingGuest, type SeatingGroup } from './_components/seating-editor';

export const metadata = { title: 'Seating chart' };

type Props = { params: Promise<{ eventId: string }> };

export default async function SeatingPage({ params }: Props) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const [tables, assignments, guests, groupsRaw, memberships, floorPlan] = await Promise.all([
    fetchTables(supabase, eventId),
    fetchAssignments(supabase, eventId),
    fetchGuestsByEvent(supabase, eventId),
    fetchGuestGroupsByEvent(supabase, eventId),
    fetchGroupMembershipsByEvent(supabase, eventId),
    fetchFloorPlan(supabase, eventId),
  ]);

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
      role: g.role,
      group_category: g.group_category,
    };
  });

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Seating</h1>
        <p className="max-w-prose text-base text-ink/65">
          Lay out your reception, then seat each guest in a chair. Group colours flow from your guest
          list, and <span className="font-medium text-ink/80">Auto-seat</span> fills the closest
          tables to the stage by role tier.
        </p>
      </header>

      <SeatingEditor
        eventId={eventId}
        tables={tables}
        guests={seatingGuests}
        groups={groups}
        floorPlan={floorPlan}
      />

      <MiniTour tourKey="customer_seat_plan_v1" />
    </section>
  );
}
