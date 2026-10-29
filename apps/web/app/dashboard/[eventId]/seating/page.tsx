import { Suspense } from 'react';
import { seatDayHasCome } from '@/lib/guests-may-see-seats';
import { redirect } from 'next/navigation';
import { fetchBookedVenueRoomSize, shouldSuggestVenueSize } from '@/lib/venue-room-size';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchEventViewer, isDelegateWithoutArea } from '@/lib/event-viewer.server';
import { NotSharedWithYou } from '../_components/not-shared-with-you';
import { resolveRoleSetForEvent, resolveProfileByEvent, surfaceEnabled } from '@/lib/event-type-profile';
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
import { guestPhotoDisplayUrls } from '@/lib/uploads';
import { isChineseWedding } from '@/lib/chinese-wedding';
import { Spotlight } from '@/app/_components/spotlight';
import { HOST_PAGE_TOURS, HOST_PAGE_TOURS_AFTER, MAKER_INNER_TOURS_AFTER } from '@/lib/host-page-tours';
import { guestsViewHref, parseSeatView } from '@/lib/guests-views';
import { SIDE_ORDER } from '@/lib/guests';
import { peopleLabels } from '@/lib/details-your-event';
import type { SeatingDetailsShell, SeatingGuest, SeatingGroup } from './_components/seating-editor';
/* ⚡ The editor loads when the Seat plan is opened — never with the Maker (`seating-lazy.tsx`). */
import { SeatingEditor } from './_components/seating-lazy';
import { loadRoleNames } from '@/lib/role-names.server';
import { roleSeatingLabels } from '@/lib/role-seating-labels';
import { setSeatingAutoplace, setSeatingGroupAdjacency } from './actions';
import SeatingLabPage from './lab/page';
import { SeatPlanInGuests } from './_components/seat-plan-in-guests';

export const metadata = { title: 'Seating chart' };

type Props = {
  params: Promise<{ eventId: string }>;
  /**
   * `maker=1` — drawn inside the Maker, as Details › Your event › Seat plan
   * (the launch page renders this page there, like the Schedule). `seat` —
   * Details' view of the plan: `3d` streams the 3D lab into the middle part,
   * `list` opens on the List, `map` opens the Guests' map (the Indoor Blueprint).
   * `host=guests` — drawn by Guests › Seats (R4, `guests/page.tsx`): the same Details shell, the columns Guests' own.
   */
  searchParams: Promise<{ view?: string; maker?: string; seat?: string; host?: string }>;
};

export default async function SeatingPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const { view: viewParam, maker: makerParam, seat: seatParam, host: hostParam } = await searchParams;
  const inGuests = hostParam === 'guests';
  const inMaker = makerParam === '1' || inGuests;
  /* 🗂 R4 · THE SEAT PLAN'S HOME IS GUESTS › SEATS (owner 2026-10-27/28, DECISION_LOG "GUESTS = LIST · MAP · SEATS ·
     MARCH"; "all mapping will be kept"). This address — bookmarks, a print's link, the day-of card, a coordinator's
     habit — lands there for everyone, carrying its List view, decided by the address alone before any read. Guests ›
     Seats draws this same page (`host=guests`), so nothing here is lost; the seat rules below still decide who sees it.
     🔒 lib/r4-seats-march-forwards.test.ts */
  if (!inMaker) redirect(guestsViewHref(eventId, 'seats', { seat: viewParam === 'list' ? 'list' : null }));
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  // 🪑 THE WRITER HALF OF THE SEAT-ROOM GATE (owner 2026-08-28, "only its own
  // rooms"). The three guest seat rooms and the 3D walk now refuse a kind whose
  // profile has no 'seating'. Leaving THIS door open would let that host build a
  // seat plan and buy the branded per-guest QR pass whose guests then land on
  // "this page does not exist" — the exact defect app/[slug]/seat/page.tsx was
  // repaired for. Narrowing a read rule makes every writer of it a cliff, so
  // both halves ship together. Mirrors the budget guard exactly.
  const seatingProfile = await resolveProfileByEvent(eventId);
  if (!surfaceEnabled(seatingProfile, 'seating')) {
    // Inside the Maker the item is not drawn for such a type at all
    // (`DETAILS_ITEM_APPLIES.seating`); never a redirect out of the Maker.
    if (inMaker) return null;
    redirect(`/dashboard/${eventId}`);
  }
  const supabase = await createClient();

  // A delegate the host never shared the guest list with reads ZERO guest rows
  // — an RLS refusal and an empty event are the same value — so without this
  // the page would tell a coordinator the couple has invited nobody. Say what
  // is true instead. The couple never reach this branch.
  const viewer = await fetchEventViewer(supabase, eventId, user.id);
  if (isDelegateWithoutArea(viewer, 'guest_list')) {
    return <NotSharedWithYou title="Seating chart" thing="guest list" />;
  }
  // 👥 People with access (owner 2026-10-03): the seat plan is its own area.
  // Off means the tables are not theirs to read (20271262573732 closed the
  // door too) — say so, never draw an empty room.
  if (isDelegateWithoutArea(viewer, 'seat_plan')) {
    return <NotSharedWithYou title="Seating chart" thing="seat plan" />;
  }

  const [tables, assignments, guests, groupsRaw, memberships, floorPlan, booths, signs, eventRow, constraints, roleSet, bookedVendors, venueRoomSize, roleNames] =
    await Promise.all([
      fetchTables(supabase, eventId),
      fetchAssignments(supabase, eventId),
      fetchGuestsByEvent(supabase, eventId),
      fetchGuestGroupsByEvent(supabase, eventId),
      fetchGroupMembershipsByEvent(supabase, eventId),
      fetchFloorPlan(supabase, eventId),
      fetchBooths(supabase, eventId, { brandedReader: createAdminClient() }),
      fetchSigns(supabase, eventId),
      supabase
        .from('events')
        .select('event_date, event_date_precision, ceremony_type, secondary_ceremony_type, gender_separation, seating_autoplace_enabled, seating_group_adjacency')
        .eq('event_id', eventId)
        .maybeSingle(),
      fetchSeatingConstraints(supabase, eventId),
      // Iteration 0053 P4 Unit 6: per-event-type role set for seating tiers/labels.
      resolveRoleSetForEvent(eventId),
      // Booth picker (decision #9): only BOOKED vendors are offered as booths.
      fetchBookedVendorsForBooths(supabase, eventId),
      // The booked venue's own stated room size — a SUGGESTION only, used
      // below when the couple has not sized their room yet.
      fetchBookedVenueRoomSize(supabase, eventId),
      // The couple's own role words — the Auto Arrange "sit together" toggles
      // name each role set the way they do ("Bride's Crew & Groom's Crew").
      loadRoleNames(supabase, eventId, 'SeatingPage.roleNames'),
    ]);
  const eventDate = (eventRow.data?.event_date as string | null) ?? null;
  // 🪑 From the event's day guests always see their seats (lib/guests-may-see-seats.ts);
  // the switch's words say so.
  const seatsDayHasCome = seatDayHasCome(eventDate, (eventRow.data?.event_date_precision as string | null) ?? null);
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
  const photoDisplayUrls = await guestPhotoDisplayUrls(guests);

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
      plus_one_of: g.plus_one_of_guest_id,
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

  // ONE editor element — the props are never listed twice.
  const editorFor = (initialView: 'plan' | 'list', details: SeatingDetailsShell) => (
    <SeatingEditor
      eventId={eventId}
      roleSetKey={roleSet.key}
      roleSeatingLabels={roleSeatingLabels(roleNames)}
      chineseTradition={chineseTradition}
      tables={tables}
      guests={seatingGuests}
      groups={groups}
      floorPlan={floorPlan}
      booths={booths}
      signs={signs}
      bookedVendors={bookedVendors}
      // The venue's own size, offered ONLY when the couple has not set
      // their room. Their number always wins, and a room they sized once
      // and have been placing tables into ever since counts as set.
      suggestedRoomSize={
        venueRoomSize &&
        shouldSuggestVenueSize(floorPlan?.venue_width_m, floorPlan?.venue_length_m)
          ? venueRoomSize
          : null
      }
      constraints={constraints}
      eventDate={eventDate}
      seatDayHasCome={seatsDayHasCome}
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
      initialView={initialView}
      details={details}
      me={{
        id: user.id,
        name:
          (user.user_metadata?.display_name as string | undefined) ||
          (user.user_metadata?.full_name as string | undefined) ||
          user.email?.split('@')[0] ||
          'Someone',
      }}
    />
  );

  // 🪑 Details › Seat plan: the SAME editor, its shell re-split into three
  // parts. The sides are the event type's own words (only where it has
  // two named people — else the seated are listed by group); 3D is the lab
  // page, streamed in only while it is the view. (Since R4 there is no
  // standalone shell: every couple and every coordinator opens the plan in
  // Guests › Seats, and the Maker's old item forwards there.)
  const people = peopleLabels(seatingProfile.terminology.personA, seatingProfile.terminology.personB);
  const sideWord = (side: 'bride' | 'groom' | 'both') =>
    side === 'both' ? 'Both sides' : `${people![side === 'bride' ? 0 : 1]}'s side`;
  const sides = people ? SIDE_ORDER.map((side) => ({ side, label: sideWord(side) })) : null;
  /* 🗂 R4: in Guests › Seats the 3D room is ALWAYS streamed with the page and opened in place (a client switch, no new
     request); its code loads only when it is first opened (`SeatingLabLoader`'s own dynamic import). */
  const lab =
    (inGuests || seatParam === '3d') && process.env.NEXT_PUBLIC_SEATING_3D !== 'false' ? (
      <Suspense fallback={<p className="p-6 text-sm text-ink/60">Opening the 3D room…</p>}>
        <SeatingLabPage params={Promise.resolve({ eventId })} searchParams={Promise.resolve({ maker: '1' })} />
      </Suspense>
    ) : null;
  const editor = editorFor(seatParam === 'list' ? 'list' : 'plan', {
    lab,
    sides,
    part: seatParam === 'map' ? 'map' : null,
    host: inGuests ? 'guests' : 'maker',
    open3d: seatParam === '3d',
  });
  /* 🗂 R4: Guests › Seats holds the columns the Maker held — the same editor, drawn whole. */
  if (inGuests) {
    return (
      <SeatPlanInGuests seat={parseSeatView(seatParam)}>
        {editor}
        {/* 🔦 First visit only — the spotlight, after the host journey (the page's own, as on the old address). */}
        <Spotlight tourKey={HOST_PAGE_TOURS.seatPlan} after={HOST_PAGE_TOURS_AFTER} replay="page" />
      </SeatPlanInGuests>
    );
  }
  return (
    <div data-seat-plan-details="" className="flex min-h-0 flex-1 flex-col">
      {editor}
      {/* 🔦 Inside the Maker: after the Maker's own tour, and the engine does not pause for it. */}
      <Spotlight tourKey={HOST_PAGE_TOURS.seatPlan} after={MAKER_INNER_TOURS_AFTER} inMaker />
    </div>
  );
}
