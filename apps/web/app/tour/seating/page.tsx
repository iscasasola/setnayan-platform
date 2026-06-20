import Link from 'next/link';
import { getSampleEvent, getSampleEventId } from '../_lib/sample-event';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchTables, fetchAssignments, type EventTableRow } from '@/lib/seating';
import { guestDisplayName } from '@/lib/guests';
import { DEFAULT_ENTRANCE } from '@/lib/indoor-blueprint';
import { FindYourSeat, type TourSeat } from './_components/find-your-seat';

/**
 * /tour/seating — Stop 3 of the public Maria & Jose tour: "Every guest finds their table."
 *
 * SERVER component (RSC). It resolves the pinned sample event id through the ONE
 * trust boundary (getSampleEventId), never from params/searchParams, and reads
 * everything through the service-role admin client (SELECTs only). It imports NO
 * server actions — the ESLint `no-restricted-imports` guard on app/tour/** enforces
 * that — and never writes.
 *
 * What it shows:
 *   1. Maria & Jose's published floor plan, rendered read-only by REUSING
 *      <WayfindingMap> (a props-only presentational renderer — no DB, no client
 *      state). The map lives inside the client FindYourSeat wrapper so a search
 *      can light up the matched table.
 *   2. A client-only name-search box (local React state, no network) that
 *      filters the seat list IN MEMORY and highlights the matched table —
 *      exactly the "find my seat" moment a guest gets on the day.
 *
 * PII hygiene: we read the seat assignments + a NARROW display-safe slice of the
 * guest rows (name fields only — never email / mobile / qr_token / meal /
 * seat_number) server-side, resolve each guest's display name with the shipped
 * pure helper, and hand the client only `{ name, tableId, tableLabel }`. The
 * internal guest_id never crosses to the client.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'The seating · A real wedding on Setnayan',
  description:
    'See how every guest finds their table on Setnayan — type a name and the seat lights up on the floor plan. No sign-up, nothing saved.',
  alternates: { canonical: '/tour/seating' },
};

/** Display-safe guest slice — name fields ONLY. No contact, no qr, no meal. */
type GuestNameRow = {
  guest_id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
};

export default async function TourSeatingPage() {
  const ev = await getSampleEvent();
  const eventId = await getSampleEventId();
  const admin = createAdminClient();

  // Floor plan + assignments through the shipped read-only fetchers (re-pinned
  // to the sample event id, per the trust-boundary contract).
  const [tables, assignments] = await Promise.all([
    fetchTables(admin, eventId),
    fetchAssignments(admin, eventId),
  ]);

  // Narrow, display-safe guest read — name columns only. We deliberately do NOT
  // use fetchGuestsByEvent here (it pulls email / mobile / qr_token / meal); the
  // tour must only ever surface a guest's display name.
  const { data: guestData } = await admin
    .from('guests')
    .select('guest_id,first_name,last_name,display_name')
    .eq('event_id', eventId)
    .is('deleted_at', null);
  const guests = (guestData ?? []) as GuestNameRow[];

  // guest_id -> display name (resolved with the shipped pure helper).
  const nameByGuestId = new Map<string, string>();
  for (const g of guests) {
    const name = guestDisplayName({
      display_name: g.display_name,
      first_name: g.first_name ?? '',
      last_name: g.last_name ?? '',
    });
    if (name) nameByGuestId.set(g.guest_id, name);
  }

  // table_id -> label, for the seat chips. (WayfindingMap reads table_label
  // itself; this is just for the search-result line.)
  const labelByTableId = new Map<string, string>();
  for (const t of tables) labelByTableId.set(t.table_id, t.table_label);

  // Build the client-safe seat list: one entry per assigned guest, carrying
  // ONLY a name + which table it maps to. The internal guest_id is dropped here
  // and never serialized to the client.
  const seats: TourSeat[] = [];
  for (const a of assignments) {
    const name = nameByGuestId.get(a.guest_id);
    if (!name) continue; // assignment with no resolvable guest → skip silently
    seats.push({
      name,
      tableId: a.table_id,
      tableLabel: labelByTableId.get(a.table_id) ?? 'Table',
    });
  }
  seats.sort((x, y) => x.name.localeCompare(y.name));

  // WayfindingMap renders display-safe table fields only (label / type /
  // position) — it never reads qr_token, so passing the rows as-is exposes
  // nothing sensitive in the DOM.
  const mapTables: EventTableRow[] = tables;

  const bride = ev.bride_name ?? 'Maria';
  const groom = ev.groom_name ?? 'Jose';
  const seatedCount = seats.length;
  const tableCount = tables.length;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-20 pt-12 sm:pt-16">
      <header className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#8C6932]">
          Tour · Stop 03
        </p>
        <h1 className="mt-3 font-serif text-4xl leading-tight tracking-tight text-[#1E2229] sm:text-5xl">
          Every guest finds their table
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-[#5F5E5A] sm:text-lg">
          {bride} & {groom} arranged{' '}
          {tableCount > 0 ? (
            <>
              <span className="font-medium text-[#1E2229]">{tableCount} tables</span> for{' '}
              <span className="font-medium text-[#1E2229]">{seatedCount} guests</span>
            </>
          ) : (
            'their reception floor'
          )}
          . On the day, a guest just types their name — and the floor plan lights up the
          way. Try it below. Nothing you type is saved.
        </p>
      </header>

      <section className="mt-12">
        {tableCount > 0 ? (
          <FindYourSeat
            tables={mapTables}
            seats={seats}
            entrance={DEFAULT_ENTRANCE}
          />
        ) : (
          <div className="mx-auto max-w-2xl rounded-2xl border border-[#1E2229]/10 bg-white/50 p-8 text-center text-sm text-[#5F5E5A]">
            This sample wedding doesn&rsquo;t have a published seating plan yet.
          </div>
        )}
      </section>

      <nav className="mx-auto mt-16 flex max-w-2xl items-center justify-between gap-4">
        <Link
          href="/tour/vendors"
          className="inline-flex min-h-[44px] items-center text-sm font-medium text-[#5C2542] transition-opacity hover:opacity-80"
        >
          &larr; The vendors
        </Link>
        <Link
          href="/tour"
          className="inline-flex min-h-[44px] items-center font-mono text-xs uppercase tracking-wider text-[#9A8F86] transition-opacity hover:opacity-80"
        >
          All stops
        </Link>
      </nav>

      <section className="mx-auto mt-12 max-w-2xl rounded-3xl border border-[#C5A059]/40 bg-[#FBF6EA] px-6 py-10 text-center">
        <h2 className="font-serif text-2xl text-[#1E2229] sm:text-3xl">Seat your own crowd.</h2>
        <p className="mx-auto mt-3 max-w-lg text-base text-[#5F5E5A]">
          Build your floor plan on Setnayan and every guest gets a clear path to their table —
          free, in minutes. Set na &rsquo;yan.
        </p>
        <Link
          href="/onboarding/wedding?from=tour"
          className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#5C2542] px-7 py-3 text-sm font-semibold text-[#FBFBFA] transition-opacity hover:opacity-90"
        >
          Start planning &middot; free
        </Link>
      </section>
    </main>
  );
}
