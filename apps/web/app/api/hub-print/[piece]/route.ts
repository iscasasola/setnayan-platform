import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getHostUserId } from '@/lib/host-gate';
import { isStoreShellRequest } from '@/lib/request-platform';
import { loadGuestPasses, loadPrintSet, printOwnsPro, readPrintEvent } from '@/lib/print-set.server';
import { layoutPasses, layoutPiece, layoutQrCodes, type PrintDoc } from '@/lib/print-layout';
import { renderPrintSvg } from '@/lib/print-render-svg';
import { renderImposedPdf, renderPrintPdf } from '@/lib/print-render-pdf';
import { renderSampleJpeg, renderSampleSheetJpeg } from '@/lib/print-sample-raster';
import {
  PRINT_PIECES,
  PRINT_SET_KEYS,
  formatFamilyOf,
  formatFor,
  isPrintPieceKey,
  isPrintSetKey,
  mayServe,
  parsePrintDetails,
  printAccess,
  serializePrintDetails,
  spotLayersFor,
  type PrintMode,
  type PrintPieceKey,
  type PrintSetKey,
} from '@/lib/print-pieces';
import { logQueryError } from '@/lib/supabase/error-detect';
import { resolveEventOwnerSlug } from '@/lib/public-event-url';

/**
 * /api/hub-print/[piece] — PRINTS & TICKETS (Event Hub Maker Phase 9, the
 * plan's one +1 route handler).
 *
 * GET  ?event=<uuid>&mode=screen|sample|print[&theme=<preview>]
 *   · a set piece (`invitation` · `entourage` · `details` · `pass` · `poster` ·
 *     `card`):
 *       `sample` — for everyone: ONE flattened JPEG, ≤ 800 px, quality 60, the
 *                  tiled "SAMPLE · SETNAYAN" watermark burned into the pixels,
 *                  placeholder QRs. Never a PDF, never a vector.
 *       `screen` — what the Maker shows: the unmarked SVG for Pro, the same
 *                  watermarked JPEG as `sample` for everyone else;
 *       `print`  — Event Hub Pro: the print-ready PDF (bleed, crop marks, Foil /
 *                  White ink / Die cut layers), no watermark.
 *   · `set` — the six pieces: one print-ready PDF (Pro) or one sample sheet JPEG.
 *   · `passes` — every guest's pass, one page each, each QR the guest's own
 *     invitation code. Pro.
 *   · `qr-codes` — the FREE do-it-yourself sheet: every guest's QR with their
 *     name (owner 2026-09-25: "the free version is the PDF of QRs … found on
 *     Guestlist"). Free for every event, store shell included.
 * POST /api/hub-print/words — saves `events.print_details`: the opening line and
 *   the "Kindly reply" CHOICE (a host / the coordinator, or manual words). The
 *   Maker's Words panel posts it and says "Saves immediately". Parents come from
 *   the Guest list and gifts from E-Gifts — never typed here.
 *
 * 🔒 THE GATE IS HERE, NOT A HIDDEN BUTTON. A free event asking for `print` or
 * `passes` gets 403, whatever the page did or did not render.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Gate =
  | { ok: true; eventId: string }
  | { ok: false; res: NextResponse };

async function gate(eventId: string | null): Promise<Gate> {
  if (!eventId || !UUID.test(eventId)) return { ok: false, res: new NextResponse('Which event?', { status: 400 }) };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, res: new NextResponse('Sign in to download your prints.', { status: 401 }) };
  const host = await getHostUserId(eventId);
  if (!host) return { ok: false, res: new NextResponse('Only the hosts of this event can download its prints.', { status: 403 }) };
  return { ok: true, eventId };
}

function fileName(slug: string | null, piece: string, mode: PrintMode): string {
  const base = (slug || 'event').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'event';
  return `${base}-${piece}${mode === 'print' ? '-print-ready' : mode === 'sample' ? '-sample' : ''}.pdf`;
}

function pdfResponse(bytes: Uint8Array, name: string, inline: boolean): NextResponse {
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${name}"`,
      'cache-control': 'private, no-store',
    },
  });
}

export async function GET(req: Request, ctx: { params: Promise<{ piece: string }> }) {
  const { piece: rawPiece } = await ctx.params;
  const url = new URL(req.url);
  const g = await gate(url.searchParams.get('event'));
  if (!g.ok) return g.res;
  const eventId = g.eventId;

  const wantsSet = rawPiece === 'set';
  if (!wantsSet && !isPrintPieceKey(rawPiece)) return new NextResponse('No such piece.', { status: 404 });
  const piece = (wantsSet ? 'invitation' : rawPiece) as PrintPieceKey;
  const rawMode = url.searchParams.get('mode');
  const mode: PrintMode = rawMode === 'print' ? 'print' : rawMode === 'screen' ? 'screen' : 'sample';
  // The couple's chosen sizes (`PRINT_FORMATS`), one per family —
  // `pass_format` · `invitation_format` · `card_format` (or one `format`). A
  // piece that cannot wear the asked size gets its default.
  const formatParam = (k: PrintPieceKey): string | null => {
    const family = formatFamilyOf(k);
    return (family && url.searchParams.get(`${family}_format`)) || url.searchParams.get('format');
  };

  // ── THE FREE SHEET — no Pro question at all.
  if (piece === 'qr-codes') {
    const event = await readPrintEvent(createAdminClient(), eventId);
    if (!event) return new NextResponse('Event not found.', { status: 404 });
    const set = {
      event,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app',
      ownerSlug: await resolveEventOwnerSlug(createAdminClient(), eventId).catch(() => null),
    };
    const { passes, images, measured } = await loadGuestPasses(set, { width: 420 });
    if (!measured) return new NextResponse('We could not read your guest list just now. Please try again.', { status: 503 });
    const docs = layoutQrCodes(
      event.display_name ?? 'Guest QR codes',
      passes.map((p) => ({ name: p.name, sub: p.seat, qrRef: p.qrRef! })),
    );
    const bytes = await renderPrintPdf(docs, images, { mode: 'plain', title: `${event.display_name ?? 'Guest'} — QR codes`, subject: `${passes.length} guests` });
    return pdfResponse(bytes, fileName(event.slug, 'qr-codes', 'screen'), false);
  }

  const [ownsPro, storeShell] = await Promise.all([printOwnsPro(eventId), isStoreShellRequest()]);
  const access = printAccess({ ownsPro, storeShell });

  // ══ THE PRINT-READY PATH — Event Hub Pro only, and checked HERE, on the
  // server, before anything is read or drawn. Nothing below this block can
  // produce a PDF or a vector for a couple without Pro.
  if (mode === 'print' || piece === 'passes' || (mode === 'screen' && access.printReady)) {
    if (!access.printReady || !mayServe(piece, 'print', access)) {
      return new NextResponse(
        storeShell ? 'Not available here.' : 'The print-ready file comes with Event Hub Pro. You can download a sample.',
        { status: 403 },
      );
    }
    // The pass batch and the print file lay out (and fetch their still) at
    // print resolution; Pro's on-screen view is the same design, unmarked.
    const drawMode: PrintMode = mode === 'screen' ? 'screen' : 'print';
    const set = await loadPrintSet(eventId, { mode: drawMode, previewTheme: url.searchParams.get('theme') });
    if (!set) return new NextResponse('Event not found.', { status: 404 });
    const spot = spotLayersFor(set.theme);
    const input = { look: set.look, data: set.data, mode: drawMode, foil: spot.foil, whiteInk: spot.whiteInk };

    if (piece === 'passes') {
      const { passes, images, measured } = await loadGuestPasses(set, { width: 600 });
      if (!measured) return new NextResponse('We could not read your guest list just now. Please try again.', { status: 503 });
      const docs = layoutPasses({ ...input, format: formatParam('passes') }, passes);
      if (!docs.length) return new NextResponse('Add guests first — every guest gets a pass.', { status: 409 });
      // Ganged on A4 with cut lines (owner: print at home or at a shop).
      const fmt = formatFor('passes', formatParam('passes'))!;
      const bytes = await renderImposedPdf(docs, { ...set.images, ...images }, {
        ...fmt.sheet!,
        title: `${set.event.display_name ?? 'Event'} — guest passes`,
        subject: `${docs.length} passes · ${fmt.label} ${fmt.wMm} × ${fmt.hMm} mm · ${fmt.sheet!.cols * fmt.sheet!.rows} per A4`,
      });
      return pdfResponse(bytes, fileName(set.event.slug, 'passes', 'print'), false);
    }
    if (mode === 'screen') {
      const svg = renderPrintSvg(layoutPiece(piece as PrintSetKey, { ...input, format: formatParam(piece) }), set.images);
      return new NextResponse(svg, {
        status: 200,
        headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'private, max-age=60' },
      });
    }
    const keys = wantsSet ? [...PRINT_SET_KEYS] : [piece as PrintSetKey];
    const docs: PrintDoc[] = keys.map((k) => layoutPiece(k, { ...input, format: formatParam(k) }));
    const label = wantsSet ? 'The print set' : PRINT_PIECES[piece].label;
    const bytes = await renderPrintPdf(docs, set.images, {
      mode: 'print',
      title: `${set.event.display_name ?? 'Event'} — ${label}`,
      subject: 'Print-ready · 3 mm bleed · crop marks · layers: Foil, White ink, Die cut',
    });
    return pdfResponse(bytes, fileName(set.event.slug, wantsSet ? 'set' : piece, 'print'), false);
  }

  // ══ THE SAMPLE PATH — everyone (owner 2026-09-25: "we can show them a sample.
  // just compressed so not print ready" · "watermark … they cannot simply edit
  // and remove" · "make it low res"). ONE flattened, watermarked, low-resolution
  // JPEG with placeholder QRs — never a PDF, never a vector. This is also what
  // a free couple's Maker shows on screen.
  if (!isPrintSetKey(piece) && !wantsSet) return new NextResponse('No such piece.', { status: 404 });
  const set = await loadPrintSet(eventId, { mode: 'sample', previewTheme: url.searchParams.get('theme') });
  if (!set) return new NextResponse('Event not found.', { status: 404 });
  const spot = spotLayersFor(set.theme);
  const input = { look: set.look, data: set.data, mode: 'sample' as const, foil: spot.foil };
  const jpeg = wantsSet
    ? await renderSampleSheetJpeg(PRINT_SET_KEYS.map((k) => layoutPiece(k, { ...input, format: formatParam(k) })), set.images)
    : await renderSampleJpeg(layoutPiece(piece as PrintSetKey, { ...input, format: formatParam(piece) }), set.images);
  const name = `${(set.event.slug || 'event').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'event'}-${wantsSet ? 'set' : piece}-sample.jpg`;
  return new NextResponse(Buffer.from(jpeg), {
    status: 200,
    headers: {
      'content-type': 'image/jpeg',
      'content-disposition': `${mode === 'screen' ? 'inline' : 'attachment'}; filename="${name}"`,
      'cache-control': 'private, max-age=60',
    },
  });
}

/** `words` — the form in Prints & Tickets. Everything else is refused. */
export async function POST(req: Request, ctx: { params: Promise<{ piece: string }> }) {
  const { piece } = await ctx.params;
  if (piece !== 'words') return new NextResponse('Not found.', { status: 404 });

  // A form post from another site carries no Origin of ours.
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host && new URL(origin).host !== host) return new NextResponse('Refused.', { status: 403 });

  const form = await req.formData();
  const g = await gate(String(form.get('event_id') ?? ''));
  if (!g.ok) return g.res;
  const eventId = g.eventId;

  // The reply line is a CHOICE: `host:<moderator_id>` (a host or the
  // coordinator, read from their own account at print time) or `manual` with
  // the couple's own words. Parents live on the Guest list and gifts on
  // E-Gifts — neither is ever typed here.
  const choice = String(form.get('rsvp_choice') ?? '');
  const rsvp = choice.startsWith('host:')
    ? { kind: 'host', moderator_id: choice.slice(5) }
    : choice === 'manual'
      ? { kind: 'manual', text: form.get('rsvp_manual') }
      : null;
  // The include toggles (owner: "toggles are better"). An unticked checkbox
  // posts nothing, so the form's `include_form` marker is what makes "all
  // off" an answer rather than an absence.
  const on = (k: string) => form.get(k) === 'on';
  const include = form.get('include_form')
    ? {
        guestNames: on('inc_guest_names'),
        parents: on('inc_parents'),
        seatPlan: on('inc_seat_plan') ? String(form.get('seat_plan_kind') ?? 'list') : 'none',
        giftDetails: on('inc_gift_details'),
        thankYou: on('inc_thank_you'),
        loveStory: on('inc_love_story') ? 'excerpt' : 'none',
        schedule: on('inc_schedule'),
        moodBoard: on('inc_mood_board'),
        nfc: on('inc_nfc'),
        openingLine: on('inc_opening_line'),
        rsvp: on('inc_rsvp'),
        specialMessage: on('inc_special_message'),
      }
    : undefined;
  // Round-trip through the parser: what is stored is exactly what prints.
  const details = parsePrintDetails({ opening_line: form.get('opening_line'), rsvp, include });

  const admin = createAdminClient();
  const { error } = await admin
    .from('events')
    .update({ print_details: serializePrintDetails(details) })
    .eq('event_id', eventId);
  const back = new URL(`/dashboard/${eventId}/launch`, req.url);
  back.searchParams.set('tool', 'details');
  if (error) {
    logQueryError('hub-print.words', error, { event_id: eventId }, 'graceful_degrade');
    back.searchParams.set('print_error', '1');
  } else back.searchParams.set('print_saved', '1');
  return NextResponse.redirect(back, 303);
}
