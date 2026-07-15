import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Users, Video, Wand2 } from 'lucide-react';
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
import { DayOfEditingBanner } from './_components/day-of-editing-banner';
import { setSeatingAutoplace, setSeatingGroupAdjacency } from './actions';

export const metadata = { title: 'Seating chart' };

type Props = { params: Promise<{ eventId: string }> };

export default async function SeatingPage({ params }: Props) {
  const { eventId } = await params;
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
    <section className="space-y-3">
      {/* The hero title + description were removed so the editor canvas fills
          the screen (owner request 2026-06-21). Heading kept screen-reader-only
          for a11y/SEO; the reserved→seated summary sits left and walkthrough
          access is a single icon button pinned upper-right. */}
      <h1 className="sr-only">Seating chart</h1>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Reserved → seated. RSVP confirmation holds a guest's place; this is
            the couple's view of how many reserved guests still need a chair. */}
        {reservedCount > 0 ? (
          <div className="flex items-stretch divide-x divide-ink/10 overflow-hidden rounded-xl border border-ink/10 bg-white/70">
            <SeatStat label="Reserved" value={reservedCount} hint="confirmed attending" />
            <SeatStat label="Seated" value={seatedCount} hint="in a chair" />
            <SeatStat label="To seat" value={toSeatCount} highlight={toSeatCount > 0} />
          </div>
        ) : (
          <span aria-hidden />
        )}
        <div className="flex items-center gap-2">
          {/* Smart Seat-Plan Phase 5: turn live auto-seating on/off. A plain
              server-action form (no client JS) that flips the flag. */}
          <form action={setSeatingAutoplace}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="enabled" value={autoplaceEnabled ? 'false' : 'true'} />
            <button
              type="submit"
              title={
                autoplaceEnabled
                  ? 'Auto-seating is ON — new guests get a provisional seat and role/group changes re-seat them. Click to turn off.'
                  : 'Auto-seating is OFF — seat guests manually with Auto-Arrange or drag. Click to turn on.'
              }
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
                autoplaceEnabled
                  ? 'border-terracotta/40 bg-terracotta/5 text-terracotta hover:border-terracotta/60'
                  : 'border-ink/15 bg-white text-ink/55 hover:border-ink/30'
              }`}
            >
              <Wand2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              Auto-seating {autoplaceEnabled ? 'On' : 'Off'}
            </button>
          </form>
          {/* Smart Seat-Plan Phase 6 (gap G8): keep a group's overflow on adjacent
              tables, or revert to the classic stage-order fill. */}
          <form action={setSeatingGroupAdjacency}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="enabled" value={adjacencyEnabled ? 'false' : 'true'} />
            <button
              type="submit"
              title={
                adjacencyEnabled
                  ? 'Groups stay together — an overflowing group spills to the nearest table. Click to use the classic stage-order fill instead.'
                  : 'Classic fill — an overflowing group spills to the next stage-ranked table. Click to keep a group on adjacent tables.'
              }
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
                adjacencyEnabled
                  ? 'border-terracotta/40 bg-terracotta/5 text-terracotta hover:border-terracotta/60'
                  : 'border-ink/15 bg-white text-ink/55 hover:border-ink/30'
              }`}
            >
              <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
              Keep groups together {adjacencyEnabled ? 'On' : 'Off'}
            </button>
          </form>
          {/* Walkthrough videos — icon-only so it stays out of the editor's way
              (owner request 2026-06-21). Title/aria-label carry the meaning. */}
          <Link
            href={`/dashboard/${eventId}/seating/walkthrough`}
            title="Walkthrough videos"
            aria-label="Walkthrough videos"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/12 bg-white text-terracotta shadow-sm transition-colors hover:border-terracotta/40 hover:bg-terracotta/5"
          >
            <Video className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </Link>
        </div>
      </div>

      <DayOfEditingBanner eventDate={eventDate} />

      {genderSeparationNote ? (
        <div className="rounded-xl border border-success-200/70 bg-success-50/40 px-4 py-3 text-sm text-ink/80">
          <span className="font-medium text-success-800">Walima seating:</span>{' '}
          {genderSeparationNote}
        </div>
      ) : null}

      {/* Smart Seat-Plan Phase 5/6: capacity shortfall — reconcile can only seat
          guests it has chairs for, so nudge the couple to add tables. */}
      {seatShortfall > 0 ? (
        <div className="rounded-xl border border-warn-200/70 bg-warn-50/50 px-4 py-3 text-sm text-ink/80">
          <span className="font-medium text-warn-800">Not enough seats:</span>{' '}
          {nonDeclinedCount} guests but only {totalSeats} {totalSeats === 1 ? 'seat' : 'seats'} — add{' '}
          more tables to seat everyone
          {autoplaceEnabled ? ' (auto-seating fills them as you add tables)' : ''}.
        </div>
      ) : null}

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
        me={{
          id: user.id,
          name:
            (user.user_metadata?.display_name as string | undefined) ||
            (user.user_metadata?.full_name as string | undefined) ||
            user.email?.split('@')[0] ||
            'Someone',
        }}
      />

      <MiniTour tourKey="customer_seat_plan_v1" />
    </section>
  );
}

/** One cell of the reserved → seated summary strip. */
function SeatStat({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: number;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex-1 px-4 py-3 text-center">
      <p className={`font-mono text-2xl font-semibold ${highlight ? 'text-terracotta' : 'text-ink'}`}>
        {value}
      </p>
      <p className="text-xs font-medium uppercase tracking-wide text-ink/55">{label}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-ink/45">{hint}</p> : null}
    </div>
  );
}
