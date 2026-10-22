import { NextResponse } from 'next/server';
import { renderStyledUrlQrPng, renderStyledUrlQrSvg } from '@/lib/qr';
import { QR_LOOK_COLUMNS, resolveEventQrLook } from '@/lib/qr-look.server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchGuestsByEvent, guestDisplayName } from '@/lib/guests';
import { fetchAssignments, fetchTables } from '@/lib/seating';
import { publicEventUrl, resolveEventOwnerSlug } from '@/lib/public-event-url';
import { layoutSeatingPack, seatingSignLine, type SeatingPackUnit } from '@/lib/print-seating-pack';
import {
  azEntries,
  chartFileStem,
  chartSizeSpec,
  chartUnits,
  entranceChartPreviewPng,
  entranceChartTooBigWords,
  layoutEntranceChart,
  parseChartLayout,
  parseChartSize,
  seatingUnits,
  unseatedCount,
  type SeatedUnit,
} from '@/lib/print-entrance-chart';
import { registryDate } from '@/lib/print-guest-registry';
import { printFileName } from '@/lib/print-report';
import { renderPrintPdf } from '@/lib/print-render-pdf';
import { bytesStream } from '@/lib/stream-file';
import { renderPrintSvg } from '@/lib/print-render-svg';
import type { PrintImages } from '@/lib/print-layout';
import { seatingPackHtml } from './pack-html';
import { eventWordsForEvent } from '@/app/[slug]/_lib/event-words';
import { PAPER_HOW, previewPage, printPaperHeader } from '@/lib/print-paper';
import { printOwnsPro } from '@/lib/print-set.server';
import { isStoreShellRequest } from '@/lib/request-platform';
import { allInOneRefusal } from '@/lib/studio-prints-six';

export const dynamic = 'force-dynamic';
/* ⏱ 300 s, the shipped big-file route's ceiling (`/api/guest/pass-card/all`): a print file is drawn whole, then streamed
   (`lib/stream-file.ts`) — a buffered body over 4.5 MB is refused by Vercel (live fault 2026-10-17). */
export const maxDuration = 300;

const GUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The one card's guest, as a file word — `place-card-bea-santillan.pdf`. */
function placeCardWord(units: SeatingPackUnit[]): string {
  const name = units.find((u) => u.guests.length)?.guests[0]?.name ?? 'guest';
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'guest';
}

// ---------------------------------------------------------------------------
// Seating print pack — the browser-print page (`?format=` absent) is drawn by
// `pack-html.ts`: the cover + directory, one sign per table, the place cards,
// each part closing with the "Made with Setnayan" line (owner 2026-10-22).
// QR payloads point at the live event site; the opaque table/guest tokens ride
// along so the future find-my-seat + Papic fan-out can resolve a scan precisely.
// ---------------------------------------------------------------------------

/** An inline SVG as an <img> source — the table signs and place cards below. */
const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export async function GET(req: Request, ctx: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await ctx.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  // ⚠ RLS SCOPES THIS TO A MEMBER, NOT TO THE COUPLE — the sentence that used
  // to sit here named the wrong audience. `events_moderator_read` admits every
  // accepted delegate, so a helper reaches this route; what they get back from
  // the guest read depends on whether the couple granted them the guest list,
  // and a refusal arrives as zero rows with no error. A delegate holding the
  // seat plan alone therefore downloads a complete-looking, empty document.
  // Left as it is deliberately: refusing on `guest_list` would also strip the
  // floor plan and the table signs from somebody the couple DID give the seat
  // plan to, and that widening is not what the owner ruled on.
  const { data: event } = await supabase
    .from('events')
    // + the QR look's columns: every code on the pack (table signs, place
    // cards) wears the event's look — lib/qr-look.ts.
    .select(`display_name, slug, event_date, event_type, ${QR_LOOK_COLUMNS}`)
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) return new NextResponse('Event not found', { status: 404 });

  // ── THE ENTRANCE SEATING CHART (owner 2026-10-13, "one seating chart for the
  // entrance"): `?chart=table|az&size=a3|a2|a1|24x36`, as `format=pdf` (the file) or
  // `format=preview` (its picture). ONE large sheet, no QR codes — so none of
  // the pack's QR work below runs for it. Same seat plan, same grouping
  // (`seatingUnits`), same name the place card prints. lib/print-entrance-chart.ts.
  const params = new URL(req.url).searchParams;
  const chart = parseChartLayout(params.get('chart'));
  if (chart) {
    const size = parseChartSize(params.get('size'));
    const [cTables, cAssignments, cGuests] = await Promise.all([
      fetchTables(supabase, eventId),
      fetchAssignments(supabase, eventId),
      fetchGuestsByEvent(supabase, eventId),
    ]);
    const cUnits = seatingUnits(cTables, cAssignments, cGuests);
    const untitledChart = ((event as { event_type?: string | null }).event_type ?? 'wedding') === 'wedding' ? 'Our Wedding' : 'Our Event';
    const coupleName = event.monogram_text || event.display_name || untitledChart;
    const result = layoutEntranceChart({
      coupleName,
      dateLabel: registryDate(event.event_date as string | null),
      layout: chart,
      size,
      units: chartUnits(cUnits),
      entries: azEntries(cUnits, cGuests),
    });
    if (params.get('format') === 'preview') {
      // A picture, not the vector: a full chart's SVG is ~5 MB of letter outlines.
      /* 📄 Beside it (Studio › Prints' preview, owner 2026-10-14): how many names, who is not on it, and — the chart's own
         measure — whether every name fits on this size and which size does (`x-print-paper`). */
      const names = result.seated;
      const unseated = unseatedCount(cTables, cAssignments, cGuests);
      return new NextResponse(Buffer.from(await entranceChartPreviewPng(result.doc)), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'private, no-store',
          ...printPaperHeader({
            pages: 1,
            page: 1,
            how: PAPER_HOW.chart(names, unseated),
            empty: cTables.length === 0 ? 'tables' : names === 0 ? 'seated' : null,
            fits: result.ok,
            suggest: result.ok ? null : result.suggest,
            tooFull: result.ok ? null : entranceChartTooBigWords(result.seated, size, result.suggest),
          }),
        },
      });
    }
    // Never a chart that loses someone: too many names for this sheet is said, not printed.
    if (!result.ok) {
      return new NextResponse(entranceChartTooBigWords(result.seated, size, result.suggest).join(' '), {
        status: 422,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
    const bytes = await renderPrintPdf([result.doc], {}, {
      mode: 'plain',
      title: `${coupleName} — seating chart`,
      subject: `${chartSizeSpec(size).label} · ${result.seated} seated`,
    });
    /* 📤 Streamed — the same bytes, no Content-Length (`lib/stream-file.ts`). */
    return new NextResponse(bytesStream(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${printFileName(event.slug, chartFileStem(chart))}"`,
        'Cache-Control': 'no-store',
      },
    });
  }
  // Pro is an event-level fact while `orders` RLS is purchaser-scoped, so the
  // look is resolved with the admin client AFTER the member read above.
  const look = await resolveEventQrLook(createAdminClient(), eventId, event);

  const [tables, assignments, guests] = await Promise.all([
    fetchTables(supabase, eventId),
    fetchAssignments(supabase, eventId),
    fetchGuestsByEvent(supabase, eventId),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  // Nested /u/ under the cutover flag, bare root otherwise (self-noops OFF).
  const ownerSlug = await resolveEventOwnerSlug(createAdminClient(), eventId);
  const site = event.slug ? publicEventUrl(appUrl, event.slug, ownerSlug) : appUrl;

  // Group linked tables into ONE printed unit (identity + QR only — owner-locked
  // 2026-06-10): the unit prints a single sign under its shared label, carrying
  // the LEAD table's QR (first member in sort order); sibling tables emit no
  // sign of their own. Unlinked tables are single-member units. ONE grouping for
  // the pack and the entrance chart — `seatingUnits` (lib/print-entrance-chart.ts);
  // seated guests per unit by name.
  type Unit = SeatedUnit<(typeof tables)[number], (typeof guests)[number]>;
  const units = seatingUnits(tables, assignments, guests);
  const unitGuests = (u: Unit) => u.guests.map((g) => ({ name: guestDisplayName(g), qr_token: g.qr_token }));

  const eventWords = await eventWordsForEvent(eventId).catch(() => null);
  // The sign says the event's own word — "our wedding", "our birthday",
  // "this gathering" for a wake — never a wedding's, whatever the event is.
  // ONE line for the HTML pack AND the PDF pack (`seatingSignLine`).
  const signSub = seatingSignLine(eventWords);
  // A nameless event's pack says "Our Wedding" only on a wedding.
  const untitled = ((event as { event_type?: string | null }).event_type ?? 'wedding') === 'wedding' ? 'Our Wedding' : 'Our Event';
  const coupleNameEarly = event.monogram_text || event.display_name || untitled;
  const dateLabelEarly = (() => {
    if (!event.event_date) return null;
    const d = new Date(event.event_date as string);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  })();

  // ── THE FILE (owner 2026-09-25, "PRINTS & TICKETS HOLDS EVERY PRINT": every
  // free print SAVES a file). `?format=pdf` is the same pack as a PDF — a phone
  // saves it in one tap, and the App Store app, whose web view has no print
  // dialog, can have it at all. `?format=preview` is page 1 as an SVG, the
  // thumbnail Prints & Tickets shows. The HTML below stays for the dialog.
  const format = params.get('format');
  if (format === 'pdf' || format === 'preview') {
    /* 👤 ONE GUEST'S PLACE CARD, FREE (owner 2026-10-17, "View as ▾"): `guest=<guest id>` draws that guest's card only — their
       name, their table, their own QR — on the pack's own card page. A guest who is not seated has no card: said, never a blank. */
    const oneGuest = params.get('guest');
    if (oneGuest !== null && !GUEST_ID.test(oneGuest)) return new NextResponse('Which guest?', { status: 400 });
    /* 🗂 …and the whole pack — the directory, every sign and every place card in one file — is Event Hub Pro (owner 2026-10-17,
       "ALL GUESTS ◆"; `isAllInOnePrint('seating-pack')`): refused before anything is drawn. Its on-screen picture stays free. */
    if (format === 'pdf' && oneGuest === null) {
      const [ownsPro, storeShell] = await Promise.all([printOwnsPro(eventId), isStoreShellRequest()]);
      if (!ownsPro) return new NextResponse(storeShell ? 'Not available here.' : allInOneRefusal('seating-pack'), { status: 403 });
    }
    const packUnits: SeatingPackUnit[] = units.map((u) => ({
      label: u.label,
      joined: u.members.length,
      qrRef: `t-${u.key}`,
      guests: u.guests
        .filter((g) => oneGuest === null || g.guest_id === oneGuest)
        .map((g) => ({ name: guestDisplayName(g), qrRef: `g-${g.qr_token}` })),
    }));
    if (oneGuest !== null && !packUnits.some((u) => u.guests.length > 0)) {
      return new NextResponse('That guest has no seat yet — a place card prints once a guest is seated in your seat plan.', { status: 404 });
    }
    const docs = layoutSeatingPack({ coupleName: coupleNameEarly, dateLabel: dateLabelEarly, units: packUnits, signLine: signSub, cardsOnly: oneGuest !== null });
    if (format === 'preview') {
      /* 📄 `?page=N` — the preview sheet's page N (Studio › Prints, owner 2026-10-14); its paper in `x-print-paper`. */
      const page = previewPage(params, docs.length);
      const cards = packUnits.reduce((a, u) => a + u.guests.length, 0);
      return new NextResponse(renderPrintSvg(docs[page - 1]!, {}), {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'private, max-age=60',
          ...printPaperHeader({ pages: docs.length, page, how: PAPER_HOW.seatingPack(docs.length, units.length, cards), empty: units.length === 0 ? 'tables' : null }),
        },
      });
    }
    const images: PrintImages = {};
    const png = async (text: string) => new Uint8Array(await renderStyledUrlQrPng(text, look, 600));
    if (oneGuest === null) for (const u of units) images[`t-${u.key}`] = { bytes: await png(`${site}?t=${u.lead.public_id}`), mime: 'image/png' };
    for (const pu of packUnits) {
      for (const g of pu.guests) images[g.qrRef] = { bytes: await png(`${site}?g=${g.qrRef.slice(2)}`), mime: 'image/png' };
    }
    const bytes = await renderPrintPdf(docs, images, { mode: 'plain', title: `${coupleNameEarly} — seating pack`, subject: `${units.length} tables` });
    /* 📤 Streamed — the same bytes, no Content-Length (`lib/stream-file.ts`). */
    return new NextResponse(bytesStream(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${printFileName(event.slug, oneGuest === null ? 'seating-pack' : `place-card-${placeCardWord(packUnits)}`)}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  // Pre-render every QR to a data URL (server-side, no network), then draw the page (`pack-html.ts`).
  const html = seatingPackHtml({
    eventId,
    coupleName: coupleNameEarly,
    dateStr: dateLabelEarly ?? '',
    signSub,
    units: await Promise.all(
      units.map(async (u) => ({
        key: u.key,
        label: u.label,
        joined: u.members.length,
        signQr: svgDataUrl(await renderStyledUrlQrSvg(`${site}?t=${u.lead.public_id}`, look)),
        guests: await Promise.all(
          unitGuests(u).map(async (g) => ({ name: g.name, qr: svgDataUrl(await renderStyledUrlQrSvg(`${site}?g=${g.qr_token}`, look)) })),
        ),
      })),
    ),
  });

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
