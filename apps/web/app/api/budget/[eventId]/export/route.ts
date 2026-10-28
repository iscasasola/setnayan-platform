import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveProfileByEvent, surfaceEnabled } from '@/lib/event-type-profile';
import { resolveBudgetVisibility } from '@/lib/budget-visibility';
import { isBudgetTruthEnabled } from '@/lib/budget-truth-flag';
import { moneyReadsAllOk, resolveEventMoney, type EventMoney } from '@/lib/budget-truth';
import { resolveAllocationInputs, fetchSavedAllocationPlan } from '@/lib/budget-allocation-data';
import { buildBudgetLedger, suggestedPlanByBucket } from '@/lib/budget-ledger';
import { budgetExportCsv } from '@/lib/budget-export';
import { BudgetUnreadError, budgetPdf } from '@/lib/budget-pdf';
import { printedDate } from '@/lib/print-pieces';
import { loadVenueBookings, resolveEventVenues, venueNamesLine, type EventVenueColumns } from '@/lib/event-venues';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// SUP-64 · the couple's budget as a FILE: a PDF to share (default, or
// `?format=pdf` — Budget's Share button; lib/budget-pdf.ts) or a CSV
// (`?format=csv`) — the caterer report's shape (`seating/caterer/route.ts`).
//
// 📤 Owner 2026-10-29: "Print Budget can be just a share button". There is no
// print PAGE any more: a page in the app's view needed a "‹ Done" bar to get
// out of, and its buttons printed. The phone's share sheet prints the PDF.
//
// Same doors as `/budget` itself, in the same order, BEFORE any money is read:
//   1. signed in;
//   2. the event type has a Budget surface at all;
//   3. `resolveBudgetVisibility(...).mayRead` — a delegate without the budget
//      area is refused here exactly as the page refuses them. A refusal that
//      still reads the money is a refusal on the screen only.
//
// Same numbers as `/budget`: `resolveEventMoney` + `buildBudgetLedger` fed by
// the saved plan and `suggestedPlanByBucket`. When the resolver gives nothing
// (flag off, or it refused) — OR ANY OF ITS THREE READS WAS REFUSED
// (`moneyReadsAllOk`: its totals are then a floor, not a fact, which is why
// `/budget` itself draws "—" and offers no file) — we say so with a 503: never a
// file of ₱0s or of partial sums, which would look like a real budget.
// ---------------------------------------------------------------------------

type Params = { params: Promise<{ eventId: string }> };

/** The name, the date as precise as the Event Hub holds it, and the columns the Hub's venue resolver falls back to. */
const EVENT_COLUMNS =
  'display_name, event_type, event_date, event_date_precision, venue_name, venue_address, venue_latitude, venue_longitude, ' +
  'std_film_ceremony_name, std_film_venue_name, ceremony_venue_address, ceremony_venue_latitude, ceremony_venue_longitude';

export async function GET(req: Request, { params }: Params) {
  const { eventId } = await params;
  const wantCsv = new URL(req.url).searchParams.get('format') === 'csv';
  const unread = () =>
    new NextResponse("Your budget can't be shared right now — part of it didn't load. Please try again in a few minutes.", {
      status: 503,
      headers: { 'Cache-Control': 'private, no-store' },
    });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Please sign in to export your budget.', { status: 401 });

  const profile = await resolveProfileByEvent(eventId);
  if (!surfaceEnabled(profile, 'budget')) {
    return new NextResponse('This event has no budget to export.', { status: 404 });
  }

  const access = await resolveBudgetVisibility(supabase, eventId, user.id);
  if (!access.mayRead) {
    return new NextResponse("The budget isn't shared with you. Ask the couple for budget access.", {
      status: 403,
    });
  }

  // SEC-2b: `events_host`, the couple/moderator-scoped view (as `/budget`).
  // 📍 The venue (the PDF's head only) is asked for beside the money, not after it — one round trip, not two.
  const bookingsRead = wantCsv ? null : loadVenueBookings(supabase, eventId);
  const [eventRes, money, allocInputs, savedPlanPhp] = await Promise.all([
    supabase.from('events_host').select(EVENT_COLUMNS).eq('event_id', eventId).maybeSingle(),
    isBudgetTruthEnabled()
      ? resolveEventMoney(supabase, eventId).catch((): EventMoney | null => null)
      : Promise.resolve<EventMoney | null>(null),
    resolveAllocationInputs(supabase, eventId),
    fetchSavedAllocationPlan(supabase, eventId),
  ]);
  const event = eventRes.data as
    | ({ display_name: string | null; event_type: string | null; event_date: string | null; event_date_precision: string | null } & EventVenueColumns)
    | null;
  if (!event) return new NextResponse('Event not found.', { status: 404 });

  if (!money || !moneyReadsAllOk(money)) return unread();

  const allocLabels = new Map(allocInputs.leaves.map((l) => [l.canonicalService, l.label]));
  const ledger = buildBudgetLedger({
    money,
    savedPlanPhp,
    suggestedPhp: suggestedPlanByBucket({
      isWedding: (event.event_type ?? 'wedding') === 'wedding',
      budgetPhp: allocInputs.budgetPhp,
      leaves: allocInputs.leaves,
      config: allocInputs.config,
    }),
    labelFor: (id) => allocLabels.get(id) ?? id,
  });

  const eventName = event.display_name?.trim() || 'Your event';
  const input = { eventName, money, ledger, generatedAt: new Date() };

  const fileSlug =
    eventName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'event';

  if (wantCsv) {
    return new NextResponse(budgetExportCsv(input), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="setnayan-${fileSlug}-budget.csv"`,
        'Cache-Control': 'private, no-store',
      },
    });
  }

  // 📤 The PDF. The venue line is the Event Hub's own (`resolveEventVenues`, the pick every printed piece wears) — read
  // for the file only, never for the CSV. A refused venue read degrades to the event's own venue column.
  const venues = resolveEventVenues((await bookingsRead) ?? { ceremony: null, reception: null }, event);
  let bytes: Uint8Array;
  try {
    bytes = await budgetPdf({
      ...input,
      eventDate: printedDate(event.event_date, event.event_date_precision),
      venue: venueNamesLine({ venues, venue_name: event.venue_name ?? null }),
    });
  } catch (e) {
    if (e instanceof BudgetUnreadError) return unread();
    console.error('[budget-export] the PDF could not be drawn', e instanceof Error ? e.message : e, { event_id: eventId });
    return new NextResponse("Your budget's file couldn't be made just now. Please try again.", {
      status: 500,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="setnayan-${fileSlug}-budget.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
