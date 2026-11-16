import Link from 'next/link';
import { ReadRefusedNotice } from '@/app/dashboard/[eventId]/_components/read-refused-notice';
import { redirect } from 'next/navigation';
import { ArrowLeft, Gift, QrCode } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { loadRoleNames } from '@/lib/role-names.server';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';
import { eventHasSides } from '@/lib/guest-side-question';
import { RoleNamesProvider } from '../_components/role-names-context';
import { fetchEventViewer, isDelegateWithoutArea } from '@/lib/event-viewer.server';
import { NotSharedWithYou } from '../../_components/not-shared-with-you';
import { logQueryError } from '@/lib/supabase/error-detect';
import { getCurrentUser } from '@/lib/auth';
import { guestDisplayName, type GuestRole, type GuestSide } from '@/lib/guests';
import { CheckinDesk, type DeskGuest, type DeskCheckin } from './_components/checkin-desk';
import { LiveRefresher } from '@/app/_components/live-refresher';
import { guestPhotoDisplayUrls } from '@/lib/uploads';
import { PASSED_AWAY, REPRESENTED_BY, REQUEST_ENTRY_SOURCE } from '@/lib/guests';
import { companionNames } from '@/lib/extra-seats';
import { DeskSavedMark } from '@/app/_components/offline-ready/desk-saved-mark';
import { EVENT_CLOCK_COLUMNS, theDayInstantsOf } from '@/lib/event-clock';
import { eventClockOf } from '@/lib/event-clock.server';
import { readDeskViewer } from '@/lib/checkin-desk.server';
import { ARRIVAL_PRESETS, arrivalsBoard, teamOnDesk, type DeskActivity, type DeskRole, type TeamPerson } from '@/lib/checkin-desk';
import { BOOKED_EVENT_VENDOR_STATUSES } from '@/lib/coordinator-trade';
import { eventDateToEpoch } from '@/lib/day-of-mode';
import { updateTimeLabel } from '@/lib/day-requests';
import { ownClockWords, isOwnClock } from '@/lib/supplier-own-times';
import { seatIsFullCohost } from '@/lib/guest-access';
import { DeskParts, type DoorCandidate } from './_components/desk-parts';
import { SuppliersPart, TeamPart } from './_components/desk-parts-board';

export const metadata = { title: 'Check-in desk' };

type Props = {
  params: Promise<{ eventId: string }>;
};

type GuestRow = {
  guest_id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  side: GuestSide;
  role: GuestRole;
  rsvp_status: 'pending' | 'attending' | 'declined' | 'maybe';
  photo_url: string | null;
  plus_one_name: string | null;
  qr_token: string;
  plus_one_allowed: boolean | null;
  plus_one_of_guest_id: string | null;
  plus_one_name_confirmed_at: string | null;
  created_at: string | null;
};

export default async function CheckinDeskPage({ params }: Props) {
  const { eventId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();
  // The couple's own words for roles (owner 2026-09-30) — the desk says them.
  const roleNames = await loadRoleNames(supabase, eventId, 'CheckinDeskPage.roleNames');

  // Door crew = couple OR coordinator (matches guest_checkins RLS).
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .in('member_type', ['couple', 'coordinator'])
    .maybeSingle();
  if (!membership) redirect(`/dashboard/${eventId}`);

  // 🚨 THE DOOR CREW GATE IS A MEMBERSHIP CHECK, AND MEMBERSHIP IS NOT A GRANT.
  // Every accepted delegate is minted a `coordinator` event_members row by
  // trigger, so this passes for a helper the couple never shared the guest list
  // with — and their guest read then comes back 200, zero rows, no error. The
  // desk would open in full, promise "the headcount keeps itself", show an
  // expected count of 0, and refuse every QR scanned at it by blaming the guest
  // standing there. On the one day it matters.
  const viewer = await fetchEventViewer(supabase, eventId, user.id);
  if (isDelegateWithoutArea(viewer, 'guest_list')) {
    return <NotSharedWithYou title="Check-in desk" thing="guest list" />;
  }

  const [
    { data: guestsRaw, error: guestsRawError },
    { data: assignmentsRaw, error: assignmentsRawError },
    { data: tablesRaw, error: tablesRawError },
    { data: checkinsRaw, error: checkinsRawError },
    { data: eventRow, error: eventRowError },
    desk,
    { data: souvenirsRaw, error: souvenirsRawError },
    { data: statusRaw, error: statusRawError },
    { data: vendorsRaw, error: vendorsRawError },
    { data: timesRaw, error: timesRawError },
    { data: seatsRaw, error: seatsRawError },
    { data: couplesRaw, error: couplesRawError },
  ] = await Promise.all([
    supabase
      .from('guests')
      .select(
        // 🪑 The +1 columns: who each guest brings is read off their seat rows in this same list (`companionNames`).
        'guest_id, first_name, last_name, display_name, side, role, rsvp_status, photo_url, plus_one_name, qr_token, plus_one_allowed, plus_one_of_guest_id, plus_one_name_confirmed_at, created_at',
      )
      .eq('event_id', eventId)
      .is('deleted_at', null)
      // 🛂 A request is not inside until Keep or Link.
      .neq('entry_source', REQUEST_ENTRY_SOURCE).eq(PASSED_AWAY, false).is(REPRESENTED_BY, null)
      .order('last_name'),
    supabase
      .from('event_seat_assignments')
      .select('guest_id, table_id')
      .eq('event_id', eventId),
    supabase
      .from('event_tables')
      .select('table_id, table_label, link_group_label')
      .eq('event_id', eventId),
    supabase
      .from('guest_checkins')
      // 🛂 `checked_in_by_user_id` — who worked the door: the Team part reads it (no second read of this table).
      .select('guest_id, checked_in_at, method, checked_in_by_user_id')
      .eq('event_id', eventId),
    supabase.from('events').select(EVENT_CLOCK_COLUMNS).eq('event_id', eventId).maybeSingle(),
    // ── 🛂 THE DESK'S THREE PARTS (owner 16 Nov 2026) — in the SAME batch, every one an existing fact ──
    // Which parts this person may open (their seat, the two booked-supplier answers, the hosts' choice).
    readDeskViewer(supabase, eventId, user.id, { isCouple: viewer.isCouple, isCoordinatorMember: membership.member_type === 'coordinator' }),
    // Team: who handed a souvenir (the souvenir table is part of the desk).
    supabase.from('guest_souvenir_claims').select('claimed_at, claimed_by_user_id').eq('event_id', eventId),
    // Suppliers: their OWN shipped status presets (lib/day-requests.ts) — the vendor lane, arrival presets only.
    supabase
      .from('event_day_requests')
      .select('author_vendor_profile_id, preset_key, created_at')
      .eq('event_id', eventId)
      .eq('origin', 'vendor')
      .in('preset_key', [...ARRIVAL_PRESETS]),
    // Suppliers: who is booked (and on Setnayan, so they can press "On site").
    supabase
      .from('event_vendors')
      .select('linked_vendor_profile_id, vendor_name, status')
      .eq('event_id', eventId)
      .not('linked_vendor_profile_id', 'is', null)
      .in('status', [...BOOKED_EVENT_VENDOR_STATUSES]),
    // Suppliers: the time each said they arrive and are done (cut 5, the venue's wall clock).
    supabase.from('supplier_own_times').select('vendor_profile_id, arrive_clock, done_clock').eq('event_id', eventId),
    // Team + Who runs the desk: the event's live seats, named off this same roster by guest_id.
    supabase
      .from('event_moderators')
      .select('user_id, guest_id, role_subtype')
      .eq('event_id', eventId)
      .is('removed_at', null)
      .not('user_id', 'is', null),
    supabase.from('event_members').select('user_id').eq('event_id', eventId).eq('member_type', 'couple'),
  ]);
  if (guestsRawError) {
    logQueryError('GuestCheckinPage.guestsRaw', guestsRawError, { event_id: eventId }, 'graceful_degrade');
  }
  if (assignmentsRawError) {
    logQueryError('GuestCheckinPage.assignmentsRaw', assignmentsRawError, { event_id: eventId }, 'graceful_degrade');
  }
  if (tablesRawError) {
    logQueryError('GuestCheckinPage.tablesRaw', tablesRawError, { event_id: eventId }, 'graceful_degrade');
  }
  if (checkinsRawError) {
    logQueryError('GuestCheckinPage.checkinsRaw', checkinsRawError, { event_id: eventId }, 'graceful_degrade');
  }
  if (eventRowError) {
    logQueryError('GuestCheckinPage.eventRow', eventRowError, { event_id: eventId }, 'graceful_degrade');
  }
  // ⏱ THE ONE CLOCK (owner ruling 2, 10 Nov 2026): check-in is open while The Day is — 06:00 on the day to 06:00 the
  // morning after the LAST day, at the venue. This desk used to say "the event day" only when the event date equalled
  // TODAY IN MANILA, so it flipped at midnight while the reception was still checking guests in.
  const clock = eventClockOf(eventRow);
  const somethingRefused = Boolean(guestsRawError) || Boolean(assignmentsRawError) || Boolean(tablesRawError) || Boolean(checkinsRawError);
  for (const [what, e] of [
    ['souvenirs', souvenirsRawError],
    ['supplierStatus', statusRawError],
    ['vendors', vendorsRawError],
    ['supplierTimes', timesRawError],
    ['seats', seatsRawError],
    ['couples', couplesRawError],
  ] as const) {
    if (e) logQueryError(`GuestCheckinPage.${what}`, e, { event_id: eventId }, 'graceful_degrade');
  }
  // 🔌 The parts read did not answer: the desk opens as it shipped (Guests), and says so — the actions ask again.
  const parts = desk.parts.length ? desk.parts : desk.unread ? (['guests'] as const) : [];
  if (parts.length === 0) {
    return <NotSharedWithYou title="Check-in desk" thing="check-in desk" />;
  }
  const isHost = desk.role === 'host';

  // Linked tables (#1266) display as the unit's name when one is set.
  const tableLabelById = new Map<string, string>();
  for (const t of tablesRaw ?? []) {
    tableLabelById.set(t.table_id, (t.link_group_label?.trim() || t.table_label || '').trim());
  }
  const tableByGuestId = new Map<string, string>();
  for (const a of assignmentsRaw ?? []) {
    const label = tableLabelById.get(a.table_id);
    if (label) tableByGuestId.set(a.guest_id, label);
  }

  // ⚠ RESOLVE THE REF, DO NOT HAND IT TO AN <img>. `photo_url` holds an
  // `r2://…` reference, not a URL — a raw one renders a broken-image glyph and
  // nothing else. Guaranteed to bite an RSVP selfie: the selfie writers refuse
  // anything that is not an r2:// ref, and a selfie REPLACES the Google avatar
  // that would otherwise have passed through verbatim.
  const photoDisplayUrls = await guestPhotoDisplayUrls(
    (guestsRaw ?? []) as GuestRow[],
  );

  const roster = (guestsRaw ?? []) as GuestRow[];
  const guests: DeskGuest[] = roster.map((g) => ({
    guestId: g.guest_id,
    name: guestDisplayName(g),
    side: g.side,
    role: g.role,
    rsvpStatus: g.rsvp_status,
    photoUrl: g.photo_url ? photoDisplayUrls[g.photo_url] ?? null : null,
    // 🪑 Every named seat, from the rows — never the one-name mirror alone (lib/extra-seats.ts `companionNames`).
    plusOneNames: companionNames(g, roster),
    qrToken: g.qr_token,
    tableLabel: tableByGuestId.get(g.guest_id) ?? null,
  }));

  const checkins: DeskCheckin[] = (checkinsRaw ?? []).map((c) => ({
    guestId: c.guest_id,
    checkedInAt: c.checked_in_at,
  }));

  const expected = guests.filter((g) => g.rsvpStatus === 'attending').length;

  // ── 🛂 Suppliers: the arrivals board — their own presets against their own times ──
  const nowMs = Date.now();
  const eventDay = (eventRow?.event_date as string | null) ?? null;
  const suppliersSeen = new Set<string>();
  const boardSuppliers = ((vendorsRaw ?? []) as { linked_vendor_profile_id: string | null; vendor_name: string | null }[])
    .filter((v) => v.linked_vendor_profile_id && !suppliersSeen.has(v.linked_vendor_profile_id) && suppliersSeen.add(v.linked_vendor_profile_id))
    .map((v) => ({ vendorProfileId: v.linked_vendor_profile_id as string, name: (v.vendor_name ?? '').trim() || 'A supplier' }));
  const board = arrivalsBoard({
    suppliers: boardSuppliers,
    rows: ((statusRaw ?? []) as { author_vendor_profile_id: string | null; preset_key: string | null; created_at: string }[]).map((r) => ({
      vendorProfileId: r.author_vendor_profile_id,
      presetKey: r.preset_key,
      at: r.created_at,
    })),
    times: new Map(
      ((timesRaw ?? []) as { vendor_profile_id: string; arrive_clock: string | null; done_clock: string | null }[]).map((t) => [
        t.vendor_profile_id,
        { arrive: t.arrive_clock, done: t.done_clock },
      ]),
    ),
    nowMs,
    wallToMs: (hhmm) => {
      if (!eventDay || !isOwnClock(hhmm)) return null;
      const day = eventDateToEpoch(eventDay.slice(0, 10), clock.tz);
      if (!Number.isFinite(day)) return null;
      const [h = 0, m = 0] = hhmm.split(':').map(Number);
      return day + (h * 60 + m) * 60_000;
    },
    clockOf: (iso) => updateTimeLabel(iso, clock.tz),
    ownClock: ownClockWords,
  });
  const suppliersUnread = Boolean(statusRawError) || Boolean(vendorsRawError) || Boolean(timesRawError);

  // ── 🛂 Team: who is on the desk now — read off who scanned and who handed a souvenir ──
  const nameByGuestId = new Map(roster.map((g) => [g.guest_id, guestDisplayName(g)]));
  const coupleIds = new Set(((couplesRaw ?? []) as { user_id: string }[]).map((c) => c.user_id));
  const seats = (seatsRaw ?? []) as { user_id: string; guest_id: string | null; role_subtype: string }[];
  const people = new Map<string, TeamPerson>();
  for (const id of coupleIds) people.set(id, { name: null, role: 'host' });
  for (const s of seats) {
    const role: DeskRole =
      coupleIds.has(s.user_id) || seatIsFullCohost(s.role_subtype)
        ? 'host'
        : s.role_subtype === 'wedding_planner_external'
          ? desk.access.door?.userId === s.user_id
            ? 'supplier'
            : 'coordinator'
          : 'helper';
    people.set(s.user_id, { name: (s.guest_id && nameByGuestId.get(s.guest_id)) || null, role });
  }
  const activity: DeskActivity[] = [
    ...((checkinsRaw ?? []) as { checked_in_by_user_id: string | null; checked_in_at: string }[]).map((c) => ({
      userId: c.checked_in_by_user_id,
      at: c.checked_in_at,
      kind: 'scan' as const,
    })),
    ...((souvenirsRaw ?? []) as { claimed_by_user_id: string | null; claimed_at: string }[]).map((c) => ({
      userId: c.claimed_by_user_id,
      at: c.claimed_at,
      kind: 'souvenir' as const,
    })),
  ];
  const team = teamOnDesk({ viewerId: user.id, viewerRole: desk.role, activity, people, nowMs });
  // ⚙ Who runs the desk: the supplier at the door is one of the event's supplier seats (the hired-planner seat kind).
  const doorCandidates: DoorCandidate[] = isHost
    ? seats
        .filter((s) => s.role_subtype === 'wedding_planner_external' && !coupleIds.has(s.user_id))
        .map((s) => ({ userId: s.user_id, name: (s.guest_id && nameByGuestId.get(s.guest_id)) || 'A supplier' }))
    : [];
  // A birthday's door crew never reads "Both sides" (the profile's role set).
  const hasSides = eventHasSides(await resolveRoleSetForEvent(eventId));

  return (
    <div className="mx-auto w-full max-w-2xl tab:max-w-3xl px-4 py-6 sm:px-6">
      <Link
        href={`/dashboard/${eventId}/guests`}
        className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to guest list
      </Link>

      {somethingRefused ? (
        <ReadRefusedNotice
          className="mt-3"
          partial
          what="everything this desk needs — a guest, their table, or who has already arrived"
        />
      ) : null}

      <header className="mt-3 space-y-1">
        {/* The door crew's own page again (F2): the Guest list's parts row is
            gone, so the desk is never drawn inside it and keeps its <h1>. */}
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <QrCode className="h-6 w-6 text-terracotta" /> Check-in desk
        </h1>
        <p className="text-sm text-ink/60">
          Scan a guest&rsquo;s QR (or search their name) as they arrive — you&rsquo;ll see their
          table and party at a glance, and the headcount keeps itself.
        </p>
        <Link
          href={`/dashboard/${eventId}/guests/souvenirs`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-terracotta-700 hover:underline"
        >
          <Gift className="h-4 w-4" strokeWidth={1.75} /> Souvenir table →
        </Link>
        {/* 📶 This phone's copy of the desk, for a no-signal venue (EV3). */}
        <DeskSavedMark
          viewer={user.id}
          eventId={eventId}
          eventDate={(eventRow?.event_date as string | null) ?? null}
          eventDay={clock.theDayOpen}
        />
      </header>

      {desk.unread ? (
        <ReadRefusedNotice className="mt-3" partial what="who runs which part of this desk" />
      ) : null}

      {/* 🛂 One desk, three parts (owner 16 Nov 2026): Guests · Suppliers · Team, one dropdown, ⚙ Who runs the desk. */}
      <DeskParts
        eventId={eventId}
        parts={parts}
        isHost={isHost}
        access={desk.access}
        doorCandidates={doorCandidates}
        guests={
          <RoleNamesProvider names={roleNames}>
            <CheckinDesk
              eventId={eventId}
              viewer={user.id}
              guests={guests}
              initialCheckins={checkins}
              expected={expected}
              hasSides={hasSides}
            />
          </RoleNamesProvider>
        }
        suppliers={<SuppliersPart lines={board.lines} here={board.here} unread={suppliersUnread} />}
        team={<TeamPart lines={team} unread={Boolean(checkinsRawError) || Boolean(souvenirsRawError) || Boolean(seatsRawError) || Boolean(couplesRawError)} />}
      />

      {/* Day-of: silently re-pull the roster so a live reseat updates each
          guest's table on the board without a manual reload (seat-finding PR 5).
          router.refresh() re-runs this server component; the desk's local
          check-in / scanner state is preserved across the refresh. */}
      <LiveRefresher eventDate={theDayInstantsOf(clock)} />
    </div>
  );
}
