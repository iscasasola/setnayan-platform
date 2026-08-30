import { RoomFooter } from '../_components/room-footer';
import { loadRoomLinks } from '../_lib/room-links.server';
import type { RoomLink } from '../_lib/room-links';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, DoorOpen, MapPin, Users } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { readGuestSession } from '@/lib/guest-session';
import { resolveProfile, surfaceEnabled } from '@/lib/event-type-profile';
import { eventWordsFor } from '../_lib/event-words';
import { eventNoun } from '@/lib/event-noun';
import { Logo } from '@/app/_components/logo';
import { fetchEntrance, type EntrancePos } from '@/lib/indoor-blueprint';
import {
  eventOwnsCustomQrGuest,
  eventOwnsPakanta,
  eventSeatingPublished,
} from '@/lib/seat-pass';
import { eventOwnsAnimatedMonogram } from '@/lib/animated-monogram';
import { resolveMonogram } from '@/lib/monogram';
import type { EventTableRow } from '@/lib/seating';
import { WayfindingMap } from '@/app/_components/wayfinding-map';
import { LiveRefresher } from '@/app/_components/live-refresher';
import { ArrivalBloom } from './_components/arrival-bloom';
import { GuestPushPrompt } from './_components/guest-push-prompt';

export const metadata = { title: 'Your seat pass' };

// Gated, token-bearing, never cached.
export const dynamic = 'force-dynamic';

/**
 * /[slug]/seat — the personalized Seat Pass + public QR resolver
 * (seat-finding PR 4/6 · gated on the paid CUSTOM_QR_GUEST SKU, ₱1,499 · 'live').
 *
 * TWO entry shapes, branched on whether `?t=` is present:
 *
 *   A) /[slug]/seat?t={token}  — a freshly scanned QR. `t` is EITHER a
 *      guests.qr_token (per-guest Custom-QR) OR an event_tables.qr_token
 *      (table-sign QR). We query BOTH tables (disjoint 32-hex UNIQUE indexes →
 *      unambiguous) and branch:
 *        • guest hit  → REDIRECT through /[slug]/seat/claim?t={token}, the
 *                       cookie-set hop. It consumes the personal token, signs
 *                       the guest-session cookie, and bounces to the CLEAN
 *                       /[slug]/seat (no token) URL. The personal token NEVER
 *                       renders directly — it's swapped for a session so the
 *                       per-guest token doesn't linger in browser history /
 *                       Referer. Mirrors /[slug]/redeem.
 *        • table hit  → PUBLIC table view (stateless public wayfinding —
 *                       label · occupants by first name + last initial · route
 *                       to that table). Mirrors the physical table sign, no
 *                       per-guest PII, no cookie.
 *        • neither    → notFound().
 *
 *   B) /[slug]/seat  (no `t`)  — the clean URL the claim hop lands on. Renders
 *      the PERSONAL seat pass from the guest-session cookie (name · table ·
 *      seat marker · route · arrival bloom). No valid session for this event →
 *      a friendly "open from your invitation" prompt.
 *
 * GATING — every branch gates on the event owning CUSTOM_QR_GUEST BEFORE any
 * token lookup or seating read (don't even confirm a token's validity to an
 * unentitled event). Graceful-degrade on a missing/legacy orders table
 * (checkOrderOwnership → false on 42P01 / 42703) → friendly "ask the couple"
 * card, no seating leaked.
 *
 * PUBLICATION — both surfaces ALSO gate on the couple having PUBLISHED the
 * seating pack (event_floor_plan.published_at IS NOT NULL · eventSeatingPublished),
 * mirroring the PR1 free finder. A DRAFT plan never leaks the table roster
 * (table view) nor a guest's room/seat (personal pass) — the guest sees a
 * "seating isn't posted yet" / "your seat is being arranged" card instead.
 *
 * SESSION — the table-QR path is unauthenticated, stateless public wayfinding.
 * The personal pass renders FROM the guest-session cookie (set by the /claim
 * hop), never from a raw token in the URL. Cookie writes live only in the
 * /claim Route Handler (Next.js permits cookie writes only in Route Handlers /
 * Server Actions).
 *
 * SCOPE — strictly additive. find-my-table (INDOOR_BLUEPRINT) is a SEPARATE,
 * untouched surface; this reuses the same WayfindingMap geometry but changes
 * nothing about it.
 */

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
};

const TABLES_SELECT =
  'table_id,public_id,event_id,table_label,table_type,capacity,sort_order,x_pos,y_pos';

export default async function SeatPassPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { t } = await searchParams;
  if (!slug) notFound();

  const admin = createAdminClient();

  const { data: event, error: eventErr } = await admin
    .from('events')
    .select(
      'event_id, display_name, slug, event_date, venue_name, event_type, monogram_text, monogram_color, monogram_font_key, monogram_style, monogram_frame_key',
    )
    .ilike('slug', slug)
    .maybeSingle();

  // 🔴 A FAILED READ IS NOT A CELEBRATION THAT DOES NOT EXIST. `notFound()` here
  // told a guest holding a printed QR that their wedding is not a real page.
  // Throwing surfaces a real error instead of a confident lie about the event.
  if (eventErr) throw new Error('seat pass: could not read the event');
  if (!event) notFound();
  // 🔴 THIS USED TO BE `event.event_type !== 'wedding'`, WHICH 404'd A PAID
  // FEATURE. Nothing on the couple's side gates the seat plan by event type: a
  // debut, a birthday or a christening host can build it, publish it, AND BUY
  // the Custom QR seat pass — and their guests, holding the QR that pass
  // printed, landed on "this page does not exist". They were sold something
  // their guests could not open.
  //
  // Now the same line every sibling sub-route uses (find-seat, find-my-table,
  // recap): the event-type profile decides, and a missing profile row degrades
  // to ENABLED, matching GENERIC_PROFILE. A wedding is unchanged.
  if (!surfaceEnabled(await resolveProfile(event.event_type), 'website')) notFound();
  // 🪑 THE SEAT ROOMS BELONG TO THE KINDS THAT SEAT PEOPLE (owner 2026-08-28,
  // "only its own rooms"; the grid is EVENT_HUB_UNIVERSAL_DESIGN_2026-08-17 § A).
  // A trip, a dinner date and a hangout have no banquet floor, so this pass
  // could only ever have shown its "no seat yet" plate forever. ABSENT, NEVER
  // GREYED (§ D rule 2) — hence notFound(), not an empty state.
  //
  // 🔴 READ THE COMMENT ABOVE BEFORE WIDENING THIS. This gate is only safe
  // because the same commit closes the WRITER: the seating room redirects, the
  // day-of Seats tab is omitted, and the paid CUSTOM_QR_GUEST add-on carries
  // `surface: 'seating'`. Narrowing this line ALONE re-creates the exact defect
  // the block above records — a host who bought the branded QR pass, whose
  // guests then land on "this page does not exist".
  if (!surfaceEnabled(await resolveProfile(event.event_type), 'seating')) notFound();

  // The three guest-facing strings below said "wedding" outright. That was
  // harmless while the page 404'd for everything else; opening it to a debut or
  // a christening makes it reachable and wrong, so it is fixed in the same
  // change rather than left as a known defect on a newly-unlocked audience.
  const noun = eventNoun(event.event_type);
  // EARNED, not assumed: this room already ran the same visibility gate the
  // money-gift page applies, and refused otherwise.
  const roomLinks = await loadRoomLinks({
    event,
    current: 'seat',
    pabuyaViewerAllowed: true,
  });


  // Gate FIRST — before any token lookup. Unowned events get a friendly prompt
  // and we never confirm whether a token is valid for this wedding.
  const owns = await eventOwnsCustomQrGuest(admin, event.event_id);
  if (!owns) {
    return (
      <SeatPassShell roomLinks={roomLinks} displayName={event.display_name} slug={slug} eventDate={event.event_date}>
        <PromptCard
          title={`No seat pass for this ${noun} yet`}
          body={`The host hasn’t added the Custom QR seat pass for this ${noun}. You’ll find your table on the printed seating signs at the venue.`}
        />
      </SeatPassShell>
    );
  }

  // ── Shape A: a token is in the URL (a freshly scanned QR) ──────────────────
  if (t) {
    // Dual token lookup, both scoped to this event.
    const [{ data: guestRow, error: tokenGuestErr }, { data: tableRow, error: tokenTableErr }] =
      await Promise.all([
      admin
        .from('guests')
        .select('guest_id, event_id')
        .eq('event_id', event.event_id)
        .eq('qr_token', t)
        .is('deleted_at', null)
        .maybeSingle(),
      admin
        .from('event_tables')
        .select('table_id, table_label, event_id')
        .eq('event_id', event.event_id)
        .eq('qr_token', t)
        .maybeSingle(),
    ]);

    // 🔴 A FAILED LOOKUP IS NOT A DEAD TOKEN. Both reads resolve `data: null` on
    // error — the same value as "no such token" — so a database blip told a
    // guest holding a perfectly good QR that their code had been REPLACED, and
    // invited them to go and get another. Of every absence on this page that is
    // the most alarming and the least true.
    if (tokenGuestErr || tokenTableErr) {
      return <SeatCouldNotLoad event={event} slug={slug} roomLinks={roomLinks} />;
    }

    // Dead token — fail CLOSED with a helpful landing instead of a bare 404.
    // The most likely cause is a rotated QR (build ④): the old code died the
    // moment it was replaced, and only the current QR gets you in.
    if (!guestRow && !tableRow) {
      return (
        <SeatPassShell roomLinks={roomLinks} displayName={event.display_name} slug={slug} eventDate={event.event_date}>
          <PromptCard
            title="This QR code isn’t active"
            body="It may have been replaced with a new one. If it’s a guest’s personal QR, ask the guest for their current QR — hosts can also reprint it from their dashboard. At the door, the check-in desk can always find guests by name."
          />
        </SeatPassShell>
      );
    }

    // Personal token → never render it directly. Hand off to the claim hop,
    // which consumes the token, signs the guest-session cookie, and redirects
    // to the CLEAN /[slug]/seat (no token) URL. Keeps the per-guest token out
    // of browser history / Referer (mirrors /[slug]/redeem).
    if (guestRow) {
      redirect(`/${slug}/seat/claim?t=${encodeURIComponent(t)}`);
    }

    // Table hit → stateless public table view (publication-gated below).
    const { rows: tables, failed: tablesFailed } = await fetchTables(admin, event.event_id);
    const entrance = await fetchEntrance(admin, event.event_id);
    if (tablesFailed) return <SeatCouldNotLoad event={event} slug={slug} roomLinks={roomLinks} />;
    const published = await eventSeatingPublished(admin, event.event_id);

    if (!published) {
      return (
        <SeatPassShell roomLinks={roomLinks} displayName={event.display_name} slug={slug} eventDate={event.event_date}>
          <PromptCard
            title="Seating isn’t posted yet"
            body={`The host hasn’t published the seating for this ${noun}. Check back closer to the day — this table’s guests will appear here once it’s posted.`}
          />
        </SeatPassShell>
      );
    }

    return (
      <PublicTableView
        admin={admin}
        event={event}
        slug={slug}
        table={tableRow!}
        tables={tables}
        entrance={entrance}
      />
    );
  }

  // ── Shape B: clean URL (no token) → personal pass from the session cookie ──
  const session = await readGuestSession();
  if (!session || session.event_id !== event.event_id) {
    return (
      <SeatPassShell roomLinks={roomLinks} displayName={event.display_name} slug={slug} eventDate={event.event_date}>
        <PromptCard
          title="Open this from your invitation"
          body="Your seat pass is part of your personal invitation. Open your invitation link (or scan your personal QR), then tap your seat pass."
        />
      </SeatPassShell>
    );
  }

  const { data: guestRow, error: guestErr } = await admin
    .from('guests')
    .select('guest_id, first_name, last_name, event_id')
    .eq('event_id', event.event_id)
    .eq('guest_id', session.guest_id)
    .is('deleted_at', null)
    .maybeSingle();

  // 🔴 THE SHARPEST ONE. A discarded error made a failed read look like "you
  // are not a guest here", so the page told somebody who had just scanned their
  // own invitation to go and open their invitation. Blaming the person holding
  // the correct ticket is worse than admitting the read failed.
  if (guestErr) return <SeatCouldNotLoad event={event} slug={slug} roomLinks={roomLinks} />;

  if (!guestRow) {
    return (
      <SeatPassShell roomLinks={roomLinks} displayName={event.display_name} slug={slug} eventDate={event.event_date}>
        <PromptCard
          title="Open this from your invitation"
          body="Your seat pass is part of your personal invitation. Open your invitation link (or scan your personal QR), then tap your seat pass."
        />
      </SeatPassShell>
    );
  }

  const { rows: tables, failed: tablesFailed } = await fetchTables(admin, event.event_id);
  const entrance = await fetchEntrance(admin, event.event_id);

  return (
    <PersonalPass
      admin={admin}
      event={event}
      slug={slug}
      guest={guestRow}
      tables={tables}
      entrance={entrance}
    />
  );
}

/**
 * The honest answer when a read FAILED, as against a thing that is not there.
 *
 * ⚖ It blames nobody. The three absences this page renders — "open this from
 * your invitation", "your seat is being arranged", "the floor plan is on its
 * way" — each accuse somebody of not having done something: the guest, or the
 * couple. Every one of them was reachable by a database blip, and none of them
 * is recoverable by the person reading it. "Try again" is the only one of the
 * four that is both true and actionable.
 */
function SeatCouldNotLoad({
  event,
  slug,
  roomLinks,
}: {
  event: { display_name: string; event_date: string | null };
  slug: string;
  roomLinks: React.ComponentProps<typeof SeatPassShell>['roomLinks'];
}) {
  return (
    <SeatPassShell
      roomLinks={roomLinks}
      displayName={event.display_name}
      slug={slug}
      eventDate={event.event_date}
    >
      <PromptCard
        title="We couldn't load your seat pass"
        body="Something went wrong on our side — your seat is fine. Refresh the page, or open it again in a moment."
      />
    </SeatPassShell>
  );
}

// Shared seating fetch. Admin client; constrained to event_id. Same select
// string find-my-table uses.
async function fetchTables(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
): Promise<{ rows: EventTableRow[]; failed: boolean }> {
  // 🔴 `return (data ?? [])` threw the error away, and an empty list is exactly
  // what this page renders as "the floor plan is on its way" — i.e. a failed
  // read was shown to the guest as the COUPLE not having done their seating.
  // supabase-js resolves with `data: null` on failure, which is the same value
  // as "no tables yet"; only the error tells them apart.
  const { data, error } = await admin
    .from('event_tables')
    .select(TABLES_SELECT)
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  return { rows: (data ?? []) as EventTableRow[], failed: Boolean(error) };
}

// ─────────────────────────────────────────────────────────────────────────
// Personal pass — the paid, per-guest surface (name · seat · route · bloom).
// ─────────────────────────────────────────────────────────────────────────

type EventRow = {
  event_id: string;
  display_name: string;
  slug: string;
  event_date: string | null;
  venue_name: string | null;
  /** Already SELECTed above (it gates the surface); it was simply never
   *  declared here. Needed so the seat plates can ask this event type for its
   *  own word instead of saying "the couple" at a graduation. */
  event_type: string | null;
  monogram_text: string | null;
  monogram_color: string | null;
  monogram_font_key: string | null;
  monogram_style: string | null;
  monogram_frame_key: string | null;
};

async function PersonalPass({
  admin,
  event,
  slug,
  guest,
  tables,
  entrance,
}: {
  admin: ReturnType<typeof createAdminClient>;
  event: EventRow;
  slug: string;
  guest: { guest_id: string; first_name: string | null; last_name: string | null };
  tables: EventTableRow[];
  entrance: EntrancePos;
}) {
  const firstName = (guest.first_name?.trim() || 'there') as string;
  // Who is throwing this event, in this event type's own word. Wedding →
  // 'couple', so both plates below are byte-identical for a wedding.
  const words = await eventWordsFor(event.event_type);
  // EARNED, not assumed: this room already ran the same visibility gate the
  // money-gift page applies, and refused otherwise.
  const roomLinks = await loadRoomLinks({
    event,
    current: 'seat',
    pabuyaViewerAllowed: true,
  });


  // PUBLICATION gate — a DRAFT plan must not reveal the guest's room/seat. The
  // guest's NAME is fine to greet; the room + seat marker stay hidden until the
  // couple publishes the seating pack. (The /claim hop already recorded the
  // personal scan; no scan insert here.)
  const published = await eventSeatingPublished(admin, event.event_id);
  if (!published) {
    return (
      <SeatPassShell roomLinks={roomLinks} displayName={event.display_name} slug={slug} eventDate={event.event_date}>
        <PromptCard
          title={`Welcome, ${firstName}`}
          body={`Your seat is being arranged. Once ${words.theOrganizer} posts the seating, your exact table and a map to it will appear right here.`}
        />
      </SeatPassShell>
    );
  }

  // This guest's seat assignment (table + seat number).
  // A failed read here silently drops the guest's table number from a pass that
  // otherwise renders perfectly — they read it as "no seat assigned to me yet".
  const { data: assignment, error: assignmentErr } = await admin
    .from('event_seat_assignments')
    .select('table_id, seat_number')
    .eq('event_id', event.event_id)
    .eq('guest_id', guest.guest_id)
    .maybeSingle();
  if (assignmentErr) {
    return <SeatCouldNotLoad event={event} slug={slug} roomLinks={roomLinks} />;
  }

  // Arrival signal — guest_checkins (RLS = couple/coordinator/admin) read via
  // the admin client. checked_in_at non-null ⇒ "arrived" copy in the bloom.
  const { data: checkin } = await admin
    .from('guest_checkins')
    .select('checked_in_at')
    .eq('event_id', event.event_id)
    .eq('guest_id', guest.guest_id)
    .maybeSingle();
  const arrived = Boolean(checkin?.checked_in_at);

  const targetTableId = (assignment?.table_id as string | null) ?? null;
  const targetTable = tables.find((t) => t.table_id === targetTableId) ?? null;
  const seatNumber = (assignment?.seat_number as number | null) ?? null;

  const mono = resolveMonogram(event);
  const hasAnimatedMonogram = await eventOwnsAnimatedMonogram(admin, event.event_id);
  const hasPakanta = await eventOwnsPakanta(admin, event.event_id); // stub → false

  if (tables.length === 0) {
    return (
      <SeatPassShell roomLinks={roomLinks} displayName={event.display_name} slug={slug} eventDate={event.event_date}>
        <PromptCard
          title="The floor plan is on its way"
          body={`${words.TheHost} is still arranging the venue layout. Check back closer to the day — your seat pass will appear here.`}
        />
      </SeatPassShell>
    );
  }

  return (
    <SeatPassShell roomLinks={roomLinks} displayName={event.display_name} slug={slug} eventDate={event.event_date}>
      <div className="space-y-6">
        <ArrivalBloom
          firstName={firstName}
          tableLabel={targetTable?.table_label ?? 'your table'}
          monogramText={mono.text}
          monogramColor={mono.color}
          fontFamily={mono.fontFamily}
          fontStyle={mono.fontStyle}
          hasAnimatedMonogram={hasAnimatedMonogram}
          hasPakanta={hasPakanta}
          arrived={arrived}
        />

        <GuestPushPrompt />

        <header className="space-y-2 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
            Your seat pass
          </p>
          {targetTable ? (
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              You&rsquo;re at{' '}
              <span className="text-gild">{targetTable.table_label}</span>
              {seatNumber !== null ? (
                <span className="ml-2 align-middle text-base font-medium text-ink/55">
                  · Seat {seatNumber}
                </span>
              ) : null}
            </h1>
          ) : (
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Your seat is being arranged
            </h1>
          )}
          {event.venue_name ? (
            <p className="inline-flex items-center justify-center gap-1.5 text-sm text-ink/60">
              <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              {event.venue_name}
            </p>
          ) : null}
        </header>

        <WayfindingMap tables={tables} entrance={entrance} targetTableId={targetTableId} />

        {targetTable ? (
          <p className="flex items-center justify-center gap-2 text-center text-sm text-ink/65">
            <DoorOpen aria-hidden className="h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
            Walk in from the entrance and follow the dotted path to your table.
          </p>
        ) : (
          <p className="rounded-xl border border-dashed border-ink/15 bg-cream p-4 text-center text-sm text-ink/55">
            You haven&rsquo;t been seated at a table yet.{' '}
            {`Once ${words.theHost} seats you, your spot lights up on this map.`}
          </p>
        )}

        <BackLink slug={slug} />
      </div>
    </SeatPassShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Public table view — the table-sign surface (label · occupants · route).
// No bloom, no animated/Pakanta enrichment; static monogram welcome only.
// ─────────────────────────────────────────────────────────────────────────

async function PublicTableView({
  admin,
  event,
  slug,
  table,
  tables,
  entrance,
}: {
  admin: ReturnType<typeof createAdminClient>;
  event: EventRow;
  slug: string;
  table: { table_id: string; table_label: string };
  tables: EventTableRow[];
  entrance: EntrancePos;
}) {
  // Same earned gate as the personal pass above.
  const roomLinks = await loadRoomLinks({
    event,
    current: 'seat',
    pabuyaViewerAllowed: true,
  });
  // No scan_events insert on the table path: scan_events.guest_id is NOT NULL,
  // and the table QR carries no guest, so the insert would always fail. Table
  // scans are anonymous public wayfinding — there's no per-guest analytics to
  // record. (The personal path's scan is recorded by the /claim hop.)

  // Occupants of this table — first name + last initial only. No emails, no QR
  // tokens, no plus-one internal flags. Mirrors what the physical table sign
  // already shows in the room.
  const { data: assignments } = await admin
    .from('event_seat_assignments')
    .select('guest_id, seat_number')
    .eq('event_id', event.event_id)
    .eq('table_id', table.table_id)
    .order('seat_number', { ascending: true });

  const guestIds = (assignments ?? []).map((a) => a.guest_id as string);
  let occupants: string[] = [];
  if (guestIds.length > 0) {
    const { data: guests } = await admin
      .from('guests')
      .select('guest_id, first_name, last_name')
      .eq('event_id', event.event_id)
      .in('guest_id', guestIds)
      .is('deleted_at', null);
    const byId = new Map(
      (guests ?? []).map((g) => [g.guest_id as string, g as { first_name: string | null; last_name: string | null }]),
    );
    occupants = guestIds
      .map((id) => byId.get(id))
      .filter((g): g is { first_name: string | null; last_name: string | null } => Boolean(g))
      .map((g) => publicDisplayName(g.first_name, g.last_name))
      .filter(Boolean);
  }

  const mono = resolveMonogram(event);

  return (
    <SeatPassShell roomLinks={roomLinks} displayName={event.display_name} slug={slug} eventDate={event.event_date}>
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <EventMonogramBadge
            text={mono.text}
            color={mono.color}
            fontFamily={mono.fontFamily}
            fontStyle={mono.fontStyle}
          />
          <p className="font-serif text-xl italic text-terracotta sm:text-2xl">Welcome</p>
        </div>

        <header className="space-y-2 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
            Table view
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            <span className="text-gild">{table.table_label}</span>
          </h1>
          {event.venue_name ? (
            <p className="inline-flex items-center justify-center gap-1.5 text-sm text-ink/60">
              <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              {event.venue_name}
            </p>
          ) : null}
        </header>

        <WayfindingMap tables={tables} entrance={entrance} targetTableId={table.table_id} />

        {occupants.length > 0 ? (
          <section className="rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
            <p className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.18em] text-ink/60">
              <Users aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Seated here
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-ink/75 sm:grid-cols-3">
              {occupants.map((name, i) => (
                <li key={i} className="truncate">
                  {name}
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="rounded-xl border border-dashed border-ink/15 bg-cream p-4 text-center text-sm text-ink/55">
            No one has been seated here yet.
          </p>
        )}

        <p className="rounded-xl border border-dashed border-ink/15 bg-cream p-4 text-center text-sm text-ink/60">
          Scanning your <span className="font-medium text-ink/80">personal</span> QR shows your
          exact seat.{' '}
          <Link href={`/${slug}`} className="font-medium text-terracotta hover:underline">
            Open your invitation
          </Link>
          .
        </p>
      </div>
    </SeatPassShell>
  );
}

function publicDisplayName(first: string | null, last: string | null): string {
  const f = first?.trim() ?? '';
  const lastInitial = last?.trim()?.charAt(0)?.toUpperCase();
  if (f && lastInitial) return `${f} ${lastInitial}.`;
  return f || (lastInitial ? `${lastInitial}.` : '');
}

// ─────────────────────────────────────────────────────────────────────────
// Static monogram badge for the public table view's welcome (no animation /
// no client island). Mirrors the landing-hero static circle.
// ─────────────────────────────────────────────────────────────────────────

function EventMonogramBadge({
  text,
  color,
  fontFamily,
  fontStyle,
}: {
  text: string;
  color: string;
  fontFamily?: string;
  fontStyle?: 'italic' | 'normal';
}) {
  return (
    <span
      aria-hidden
      className="inline-flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 bg-cream text-2xl font-semibold"
      style={{
        color,
        borderColor: color,
        fontFamily: fontFamily ?? "ui-serif, Georgia, serif",
        fontStyle: fontStyle ?? 'italic',
      }}
    >
      {text}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Chrome — self-contained guest-microsite shell (does NOT import from the
// [slug] page, mirroring find-my-table's Shell to stay decoupled).
// ─────────────────────────────────────────────────────────────────────────

function SeatPassShell({
  displayName,
  slug,
  eventDate,
  roomLinks,
  children,
}: {
  displayName: string;
  slug: string;
  eventDate: string | null;
  /** REQUIRED on purpose: an optional prop here would let a branch ship without
   *  a way out, which is the exact defect this closes. */
  roomLinks: RoomLink[];
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-cream text-ink">
      {/* Day-of: when a coordinator reseats a guest during the reception, poll for
          the new table so the Seat Pass matches find-my-table (renders null). */}
      <LiveRefresher eventDate={eventDate} />
      <header className="border-b border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href={`/${slug}`} className="flex items-center gap-2 text-ink">
            <Logo height={28} />
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink/60">
              Setnayan
            </span>
          </Link>
          <span className="font-mono text-xs uppercase tracking-[0.15em] text-ink/50">
            {displayName}
          </span>
        </div>
      </header>
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">{children}</div>
      <footer className="border-t border-ink/10 px-4 py-8 text-center">
        <p className="font-serif text-lg italic text-terracotta">See you soon.</p>
        <p className="mt-3 text-xs text-ink/50">Powered by Setnayan · setnayan.com</p>
      </footer>
      <RoomFooter links={roomLinks} />
    </main>
  );
}

function PromptCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-cream p-6 text-center sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mx-auto mt-3 max-w-prose text-sm text-ink/60">{body}</p>
    </div>
  );
}

function BackLink({ slug }: { slug: string }) {
  // Personal pass: link back to the invitation. The /claim hop already set the
  // cookie when the QR was scanned through it; this is just navigation.
  return (
    <div className="text-center">
      <Link
        href={`/${slug}`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to your invitation
      </Link>
    </div>
  );
}
