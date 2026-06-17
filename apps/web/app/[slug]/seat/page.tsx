import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, DoorOpen, MapPin, Users } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { readGuestSession } from '@/lib/guest-session';
import { Logo } from '@/app/_components/logo';
import { SeatingChangesListener } from '@/app/[slug]/_components/seating-changes-listener';
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
import { ArrivalBloom } from './_components/arrival-bloom';

export const metadata = { title: 'Your seat pass · Setnayan' };

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

  const { data: event } = await admin
    .from('events')
    .select(
      'event_id, display_name, slug, venue_name, event_type, monogram_text, monogram_color, monogram_font_key, monogram_style, monogram_frame_key',
    )
    .ilike('slug', slug)
    .maybeSingle();

  if (!event || event.event_type !== 'wedding') notFound();

  // Gate FIRST — before any token lookup. Unowned events get a friendly prompt
  // and we never confirm whether a token is valid for this wedding.
  const owns = await eventOwnsCustomQrGuest(admin, event.event_id);
  if (!owns) {
    return (
      <SeatPassShell displayName={event.display_name} slug={slug}>
        <PromptCard
          title="No seat pass for this wedding yet"
          body="The couple hasn’t added the Custom QR seat pass for this wedding. You’ll find your table on the printed seating signs at the venue."
        />
      </SeatPassShell>
    );
  }

  // ── Shape A: a token is in the URL (a freshly scanned QR) ──────────────────
  if (t) {
    // Dual token lookup, both scoped to this event.
    const [{ data: guestRow }, { data: tableRow }] = await Promise.all([
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

    if (!guestRow && !tableRow) notFound();

    // Personal token → never render it directly. Hand off to the claim hop,
    // which consumes the token, signs the guest-session cookie, and redirects
    // to the CLEAN /[slug]/seat (no token) URL. Keeps the per-guest token out
    // of browser history / Referer (mirrors /[slug]/redeem).
    if (guestRow) {
      redirect(`/${slug}/seat/claim?t=${encodeURIComponent(t)}`);
    }

    // Table hit → stateless public table view (publication-gated below).
    const tables = await fetchTables(admin, event.event_id);
    const entrance = await fetchEntrance(admin, event.event_id);
    const published = await eventSeatingPublished(admin, event.event_id);

    if (!published) {
      return (
        <SeatPassShell displayName={event.display_name} slug={slug}>
          <PromptCard
            title="Seating isn’t posted yet"
            body="The couple hasn’t published the seating for this wedding. Check back closer to the day — this table’s guests will appear here once it’s posted."
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
      <SeatPassShell displayName={event.display_name} slug={slug}>
        <PromptCard
          title="Open this from your invitation"
          body="Your seat pass is part of your personal invitation. Open your invitation link (or scan your personal QR), then tap your seat pass."
        />
      </SeatPassShell>
    );
  }

  const { data: guestRow } = await admin
    .from('guests')
    .select('guest_id, first_name, last_name, event_id')
    .eq('event_id', event.event_id)
    .eq('guest_id', session.guest_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!guestRow) {
    return (
      <SeatPassShell displayName={event.display_name} slug={slug}>
        <PromptCard
          title="Open this from your invitation"
          body="Your seat pass is part of your personal invitation. Open your invitation link (or scan your personal QR), then tap your seat pass."
        />
      </SeatPassShell>
    );
  }

  const tables = await fetchTables(admin, event.event_id);
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

// Shared seating fetch. Admin client; constrained to event_id. Same select
// string find-my-table uses.
async function fetchTables(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
): Promise<EventTableRow[]> {
  const { data } = await admin
    .from('event_tables')
    .select(TABLES_SELECT)
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  return (data ?? []) as EventTableRow[];
}

// ─────────────────────────────────────────────────────────────────────────
// Personal pass — the paid, per-guest surface (name · seat · route · bloom).
// ─────────────────────────────────────────────────────────────────────────

type EventRow = {
  event_id: string;
  display_name: string;
  slug: string;
  venue_name: string | null;
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

  // PUBLICATION gate — a DRAFT plan must not reveal the guest's room/seat. The
  // guest's NAME is fine to greet; the room + seat marker stay hidden until the
  // couple publishes the seating pack. (The /claim hop already recorded the
  // personal scan; no scan insert here.)
  const published = await eventSeatingPublished(admin, event.event_id);
  if (!published) {
    return (
      <SeatPassShell displayName={event.display_name} slug={slug}>
        <PromptCard
          title={`Welcome, ${firstName}`}
          body="Your seat is being arranged. Once the couple posts the seating, your exact table and a map to it will appear right here."
        />
      </SeatPassShell>
    );
  }

  // This guest's seat assignment (table + seat number).
  const { data: assignment } = await admin
    .from('event_seat_assignments')
    .select('table_id, seat_number')
    .eq('event_id', event.event_id)
    .eq('guest_id', guest.guest_id)
    .maybeSingle();

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
      <SeatPassShell displayName={event.display_name} slug={slug}>
        <PromptCard
          title="The floor plan is on its way"
          body="The couple is still arranging the venue layout. Check back closer to the day — your seat pass will appear here."
        />
      </SeatPassShell>
    );
  }

  return (
    <SeatPassShell displayName={event.display_name} slug={slug}>
      <div className="space-y-6">
        {/* Re-reads silently when the couple updates this guest's seat */}
        <SeatingChangesListener eventId={event.event_id} />
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
          eventId={event.event_id}
        />

        <header className="space-y-2 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
            Your seat pass
          </p>
          {targetTable ? (
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              You&rsquo;re at{' '}
              <span className="text-emerald-700">{targetTable.table_label}</span>
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
            You haven&rsquo;t been seated at a table yet. Once the couple seats
            you, your spot lights up on this map.
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
    <SeatPassShell displayName={event.display_name} slug={slug}>
      <div className="space-y-6">
        {/* Re-reads silently when the couple updates table occupants */}
        <SeatingChangesListener eventId={event.event_id} />
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
            <span className="text-emerald-700">{table.table_label}</span>
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
  children,
}: {
  displayName: string;
  slug: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-cream text-ink">
      <header className="border-b border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href={`/${slug}`} className="flex items-center gap-2 text-ink">
            <Logo height={28} />
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60">
              Setnayan
            </span>
          </Link>
          <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/50">
            {displayName}
          </span>
        </div>
      </header>
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">{children}</div>
      <footer className="border-t border-ink/10 px-4 py-8 text-center">
        <p className="font-serif text-lg italic text-terracotta">See you soon.</p>
        <p className="mt-3 text-xs text-ink/50">Powered by Setnayan · setnayan.com</p>
      </footer>
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
