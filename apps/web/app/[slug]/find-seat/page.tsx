import type { RoomLink } from '../_lib/room-links';
import { RoomFooter } from '../_components/room-footer';
import { loadRoomLinks } from '../_lib/room-links.server';
import { loadEventShell, loadGuestLook } from '../_lib/loaders';
import { notFound, redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveProfile, surfaceEnabled } from '@/lib/event-type-profile';
import { eventWordsFromProfile } from '../_lib/event-words';
import { canViewSlugEvent } from '@/lib/slug-access';
import { readGuestViewerForEvent } from '@/lib/guest-one-path.server';
import { fetchEntrance } from '@/lib/indoor-blueprint';
import type { EventTableRow } from '@/lib/seating';
import { renderInvitationQrSvg } from '@/lib/qr';
import { resolveMonogram } from '@/lib/monogram';
import { formatEventDate } from '@/lib/events';
import { getDayOfPhase } from '@/lib/day-of-mode';
import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';
import { fetchPublicScheduleBlocks, formatBlockTimeRange } from '@/lib/schedule';
import { INVITE_THEMES } from '@/lib/invite-themes';
import { LiveRefresher } from '@/app/_components/live-refresher';
import {
  checkedInClock,
  findSeatMode,
  postmarkDate,
  publicDisplayName,
  seatsStillOpen,
  type SeatViewerKind,
} from '@/lib/find-your-seat';
import { NameSearch } from './_components/name-search';
import { RefreshOnReturn } from './_components/refresh-on-return';
import { Lace, RoomPlaceholder, SeatFrame } from './_components/seat-frame';
import { SeatBackLink } from './_components/seat-back-link';
import { findSeatBackHref } from './_lib/back-to-the-invitation';
import { YourSeat, type Tablemate } from './_components/your-seat';
import type { DoorPassData } from './_components/door-pass';

export const metadata = { title: 'Find your seat' };

// Personal for a key holder, and the search is dynamic — never statically cached.
export const dynamic = 'force-dynamic';

/**
 * /[slug]/find-seat — "Find your seat", in the couple's theme, with your key or
 * without (owner 2026-09-27, "ok to all" — spec corpus `DECISION_LOG.md` row
 * "FIND YOUR SEAT, REDESIGNED", prototype `prototypes/find_your_seat_2026-09-27.html`).
 *
 * WHO IS ASKING decides the screen, through the ONE resolver the event page
 * uses (`resolveGuestViewer`, lib/guest-one-path.ts, via
 * `readGuestViewerForEvent`): the guest-session cookie a key minted
 * (`setnayan_guest_session`), or a signed-in account bound to a seat here
 * (`event_members`, member_type 'guest'). No new session, no new column.
 *
 *   · key holder → section A: their seat, straight away, NO FIELD (A1 before the
 *     day · A2 on the day · A4 not seated yet), read from their OWN
 *     `event_seat_assignments` row; tablemates from their own table only, as
 *     first name + last initial; the on-screen door pass (A3);
 *   · anonymous  → section B: the exact-full-name search (B1–B3), which reveals
 *     a table and the room and never a name; or B5 when nothing is published.
 *
 * 💰 FREE, ALL OF IT (decision (5)): the table, the map and the door pass. This
 * page never asks for CUSTOM_QR_GUEST — only the printed branded QR cards stay
 * paid, on `/[slug]/seat`. Pinned by `find-seat-is-free-and-private.test.ts`.
 *
 * Read safety: the event is resolved by slug through the cached shell loader
 * (the layout already read it); seat reads use the admin client and are scoped
 * by the viewer's OWN guest_id — the id the resolver returned, never input.
 * Nothing on the anonymous path reads a guest: its lookup is the SECURITY
 * DEFINER `public_seat_lookup()` RPC behind `/api/seat-lookup/[slug]`.
 */

type Props = {
  params: Promise<{ slug: string }>;
  /** Only the invitation's own view params are read (`findSeatBackHref`) —
   *  carried back so "Back to the invitation" returns to the same stage. */
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const TABLES_SELECT =
  'table_id,public_id,event_id,table_label,table_type,capacity,sort_order,x_pos,y_pos';

export default async function FindSeatPage({ params, searchParams }: Props) {
  const { slug } = await params;
  if (!slug) notFound();
  // ⬅ The invitation itself, with its Event Bar — never its front cover.
  const backHref = findSeatBackHref(slug, searchParams ? await searchParams : null);

  const event = await loadEventShell(slug);
  if (!event) notFound();
  // Iteration 0053: public guest pages under /[slug] are the 'website' surface.
  const profile = await resolveProfile(event.event_type);
  if (!surfaceEnabled(profile, 'website')) notFound();
  // 🪑 Seat rooms exist only for kinds that seat people — see seat/page.tsx for
  // the full rule and the writer half that makes narrowing this safe.
  if (!surfaceEnabled(profile, 'seating')) notFound();
  const words = eventWordsFromProfile(profile);

  // Visibility gate (owner 2026-06-20): a private (pre-launch) page's couple
  // data never leaks through this sub-route. Strangers bounce to /[slug] (the
  // lock screen); by the day the page is launched, so the venue QR still works.
  if (!(await canViewSlugEvent(event.event_id, event.landing_page_visibility))) {
    redirect(`/${slug}`);
  }

  const admin = createAdminClient();
  const names = event.display_name?.trim() || words.theHost;

  // Publication gate — only a published plan is searchable or shown. Degrade to
  // "not posted yet" on a missing/legacy floor-plan table rather than crashing.
  const { data: plan, error: planError } = await admin
    .from('event_floor_plan')
    .select('published_at')
    .eq('event_id', event.event_id)
    .maybeSingle();
  if (planError && planError.code !== '42P01' && planError.code !== '42703') {
    throw new Error(`Failed to resolve seating publication: ${planError.message}`);
  }
  const published = Boolean(plan?.published_at);

  const [viewer, look] = await Promise.all([
    readGuestViewerForEvent(event.event_id),
    loadGuestLook(slug).catch(() => null),
  ]);
  const viewerKind: SeatViewerKind = viewer.kind;
  const postmark =
    look?.theme && INVITE_THEMES[look.theme]?.ornament === 'lace-postmark' ? postmarkDate(event.event_date) : null;

  // The published room — tables + entrance — for the map. Never read for a
  // draft: a draft plan reveals nothing (the RPC's and `/seat`'s own rule).
  let tables: EventTableRow[] = [];
  const entrance = await fetchEntrance(admin, event.event_id);
  if (published) {
    const { data, error } = await admin
      .from('event_tables')
      .select(TABLES_SELECT)
      .eq('event_id', event.event_id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    // 🔴 A failed read is not an empty room: an empty list would draw "your
    // table will appear here" to a seated guest. Throw to the error boundary.
    if (error) throw new Error(`find-seat: could not read the tables: ${error.message}`);
    tables = (data ?? []) as EventTableRow[];
  }

  // ── B · THE OPEN LINK ────────────────────────────────────────────────────
  if (viewer.kind === 'anonymous') {
    const roomLinks = await loadRoomLinks({ event, current: 'seat', pabuyaViewerAllowed: true });
    const mode = findSeatMode({ viewer: 'anonymous', published, tableId: null });
    return (
      <SeatFrame
        slug={slug}
        backHref={backHref}
        who={names}
        postmark={mode === 'search' ? null : postmark}
        roomFooter={<RoomFooter links={roomLinks} />}
        names={names}
      >
        {mode === 'search' ? (
          <NameSearch
            slug={slug}
            names={names}
            postmark={postmark}
            eventDate={event.event_date as string | null}
            tables={tables}
            entrance={entrance}
          />
        ) : (
          <NotPostedYet names={names} plural={words.twoPeople} slug={slug} backHref={backHref} occasion={words.occasion} />
        )}
      </SeatFrame>
    );
  }

  // ── A · SOMEBODY WE KNOW ─────────────────────────────────────────────────
  const guestId = viewer.session.guest_id;
  const [{ data: guest, error: guestErr }, { data: assignment, error: assignmentErr }] = await Promise.all([
    admin
      .from('guests')
      .select('guest_id, first_name, last_name, display_name, qr_token, plus_one_allowed, plus_one_name')
      .eq('event_id', event.event_id)
      .eq('guest_id', guestId)
      .is('deleted_at', null)
      .maybeSingle(),
    admin
      .from('event_seat_assignments')
      .select('table_id')
      .eq('event_id', event.event_id)
      .eq('guest_id', guestId)
      .maybeSingle(),
  ]);
  // 🔴 A failed read is not "you are not seated" — throw, never draw A4 over it.
  if (guestErr) throw new Error(`find-seat: could not read the guest: ${guestErr.message}`);
  if (assignmentErr) throw new Error(`find-seat: could not read the seat: ${assignmentErr.message}`);
  if (!guest) redirect(`/${slug}`); // removed from the list since the key was issued

  const firstName = guest.first_name?.trim() || 'there';
  const guestToken = (guest.qr_token as string | null) ?? viewer.session.qr_token;
  const roomLinks: RoomLink[] = await loadRoomLinks({
    event,
    current: 'seat',
    guestToken,
    pabuyaViewerAllowed: true,
  });
  const venueHref = roomLinks.find((l) => l.key === 'venue')?.href ?? null;

  const tableId = (assignment?.table_id as string | null) ?? null;
  const mode = findSeatMode({ viewer: viewerKind, published, tableId });
  const table = mode === 'your_seat' ? (tables.find((t) => t.table_id === tableId) ?? null) : null;

  const venueTz = eventTimezoneFromCoords(event.venue_latitude, event.venue_longitude);
  const dayOf = event.event_date ? getDayOfPhase(event.event_date, venueTz) === 'live' : false;

  // Own table only — first name + last initial, the viewer first.
  let mates: Tablemate[] = [];
  let pass: DoorPassData | null = null;
  let doorsOpenLabel: string | null = null;
  if (table) {
    const { data: seatRows, error: seatErr } = await admin
      .from('event_seat_assignments')
      .select('guest_id, seat_number')
      .eq('event_id', event.event_id)
      .eq('table_id', table.table_id)
      .order('seat_number', { ascending: true });
    if (seatErr) throw new Error(`find-seat: could not read the table: ${seatErr.message}`);
    const ids = (seatRows ?? []).map((r) => r.guest_id as string);
    if (ids.length > 0) {
      // 🔒 DELIBERATELY NARROW (baselined in dup-rule.baseline.txt): a tablemate
      // is shown as first name + last initial and nothing else, so the read
      // takes nothing else — no display name, role or pairing of other guests.
      const { data: people, error: peopleErr } = await admin
        .from('guests')
        .select('guest_id, first_name, last_name')
        .eq('event_id', event.event_id)
        .in('guest_id', ids)
        .is('deleted_at', null);
      if (peopleErr) throw new Error(`find-seat: could not read the table's guests: ${peopleErr.message}`);
      const byId = new Map((people ?? []).map((g) => [g.guest_id as string, g]));
      mates = ids
        .map((id) => {
          const g = byId.get(id);
          return g ? { name: publicDisplayName(g.first_name, g.last_name), you: id === guestId } : null;
        })
        .filter((m): m is Tablemate => Boolean(m && m.name))
        .sort((a, b) => Number(b.you) - Number(a.you));
    }

    const [{ data: checkin }, qrSvg] = await Promise.all([
      admin
        .from('guest_checkins')
        .select('checked_in_at')
        .eq('event_id', event.event_id)
        .eq('guest_id', guestId)
        .maybeSingle(),
      renderInvitationQrSvg({
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app',
        slug: event.slug ?? slug,
        qrToken: guestToken,
      }),
    ]);
    const checkedIn = (checkin?.checked_in_at as string | null) ?? null;
    const plusOne = guest.plus_one_allowed && guest.plus_one_name?.trim() ? guest.plus_one_name.trim() : null;
    const plusOneParts = plusOne ? plusOne.split(/\s+/) : [];
    pass = {
      names,
      dateLabel: event.event_date ? formatEventDate(event.event_date) : null,
      tableLabel: table.table_label,
      guestName:
        guest.display_name?.trim() || `${guest.first_name ?? ''} ${guest.last_name ?? ''}`.trim() || firstName,
      partyLine: plusOne
        ? `party of 2 · ${publicDisplayName(plusOneParts[0] ?? plusOne, plusOneParts.slice(1).join(' ') || null)}`
        : null,
      qrSvg,
      seal: resolveMonogram(event).text,
      checkedInAt: checkedInClock(checkedIn, venueTz),
    };

    if (dayOf) {
      const blocks = await fetchPublicScheduleBlocks(admin, event.event_id, true).catch(() => []);
      const first = blocks[0]?.start_at ? formatBlockTimeRange(blocks[0].start_at, null) : '';
      doorsOpenLabel = first ? `Today · doors open ${first.toLowerCase()}` : null;
    }
  }

  const who = viewer.kind === 'seat' ? `Signed in · ${firstName}` : `For ${firstName}`;
  const venueName = event.venue_name?.trim() || null;
  const dateLabel = event.event_date ? formatEventDate(event.event_date) : null;
  const occasionLine = [venueName, dateLabel].filter(Boolean).join(' · ') || null;

  return (
    <SeatFrame
      slug={slug}
      backHref={backHref}
      who={who}
      postmark={dayOf ? null : postmark}
      roomFooter={<RoomFooter links={roomLinks} />}
      names={names}
      footer={!(dayOf && table)}
    >
      {/* A reseat on the day shows without a reload (PR 5); and a guest seated
          while the page sits open in a tab sees it when they come back to it —
          "No need to check back — this updates by itself" (A4) is a promise. */}
      <LiveRefresher eventDate={event.event_date as string | null} />
      <RefreshOnReturn />
      <YourSeat
        firstName={firstName}
        names={names}
        occasionLine={occasionLine}
        dayOf={dayOf}
        doorsOpenLabel={doorsOpenLabel}
        published={published}
        tables={tables}
        entrance={entrance}
        table={table ? { table_id: table.table_id, table_label: table.table_label, capacity: table.capacity ?? null } : null}
        mates={mates}
        seatsOpen={table ? seatsStillOpen(table.capacity, mates.length) : 0}
        venueHref={venueHref}
        inviteHref={backHref}
        slug={slug}
        plural={words.twoPeople}
        pass={pass}
      />
    </SeatFrame>
  );
}

/** B5 · nothing published yet — in the theme, no field at all. Nothing to count, nothing to leak. */
function NotPostedYet({
  names,
  plural,
  slug,
  backHref,
  occasion,
}: {
  names: string;
  /** Two people at the centre (a wedding) — "Indalecio & Claire haven't"; otherwise the plan is the subject. */
  plural: boolean;
  slug: string;
  backHref: string;
  occasion: string;
}) {
  return (
    <div className="lg:mx-auto lg:max-w-md">
      <section className="px-6 pt-3 text-center">
        <p className="m-0 text-[0.72rem] uppercase tracking-[0.22em] text-terracotta-700">Find your seat</p>
        <p className="m-0 mt-1 font-serif text-[2.4rem] italic leading-none text-terracotta-700">soon</p>
        <h1 className="m-0 mt-0.5 font-serif text-[2rem] font-medium leading-[1.12] text-ink">Seating isn&rsquo;t posted yet</h1>
        <p className="mt-2.5 text-[0.84rem] leading-relaxed text-ink/75">
          {plural
            ? `${names} haven’t published the seating plan. Once they do, you’ll find your table here.`
            : `The seating plan for this ${occasion} isn’t published yet. Once it is, you’ll find your table here.`}{' '}
          Your invitation link will show it the moment it&rsquo;s set.
        </p>
      </section>
      <Lace className="my-4" />
      <RoomPlaceholder veil="The room is still being arranged" />
      <SeatBackLink href={backHref} slug={slug} className="mx-6 mt-3.5 block text-center text-sm text-terracotta-700 underline underline-offset-[3px]">
        Back to the invitation
      </SeatBackLink>
    </div>
  );
}
