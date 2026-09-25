import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getHostUserId } from '@/lib/host-gate';
import { isStoreShellRequest } from '@/lib/request-platform';
import { loadGuestPasses, loadPrintSet, printOwnsPro, printThemeFor, readPrintEvent } from '@/lib/print-set.server';
import { layoutPasses, layoutPiece, layoutQrCodes, type PrintDoc, type PrintImages } from '@/lib/print-layout';
import { layoutGuestRegistry, registryDate, registryRows } from '@/lib/print-guest-registry';
import { fetchGuestsByEventMeasured } from '@/lib/guests';
import { fetchAssignments, fetchTables } from '@/lib/seating';
import { INVITE_THEMES, type InviteThemeId } from '@/lib/invite-themes';
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
  isThemedPrint,
  mayServe,
  parsePrintDetails,
  printAccess,
  printFileName,
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
 * ⚖ Owner 2026-09-25, "EVERY PRINT IS FREE IN THE CLASSIC LOOK; THE THEMED
 * VERSION IS PRO": `theme=house` (Classic) is print-ready for EVERY event; any
 * other theme is print-ready only with Event Hub Pro.
 *
 *   · a set piece (`invitation` · `entourage` · `details` · `pass` · `poster` ·
 *     `card`):
 *       `sample` — ONE flattened JPEG, ≤ 800 px, quality 60, the tiled
 *                  "SAMPLE · SETNAYAN" watermark burned into the pixels,
 *                  placeholder QRs. Never a PDF, never a vector.
 *       `screen` — what the Maker shows: the unmarked SVG in Classic or with
 *                  Pro, the same watermarked JPEG as `sample` for a theme
 *                  without Pro;
 *       `print`  — the print-ready PDF (bleed, crop marks, Foil / White ink /
 *                  Die cut layers), no watermark. Classic: everyone. A theme: Pro.
 *   · `set` — the six pieces: one print-ready PDF, or one sample sheet JPEG.
 *   · `passes` — every guest's pass, ganged on A4, each QR the guest's own
 *     invitation code. Classic: everyone. A theme: Pro.
 *   · the FREE GROUP (`kind: 'free'`, no themed version, store shell included):
 *       `qr-codes` — every guest's QR with their name (owner 2026-09-25: "the
 *                    free version is the PDF of QRs … found on Guestlist");
 *       `guest-registry` — the reception-desk list (lib/print-guest-registry.ts).
 *     `mode=screen` is page 1 as an SVG (the Maker's thumbnail); otherwise the PDF.
 * POST /api/hub-print/words — saves `events.print_details`: the opening line and
 *   the "Kindly reply" CHOICE (a host / the coordinator, or manual words). The
 *   Maker's Words panel posts it and says "Saves immediately". Parents come from
 *   the Guest list and gifts from E-Gifts — never typed here.
 *
 * 🔒 THE GATE IS HERE, NOT A HIDDEN BUTTON. A free event asking for a THEMED
 * `print` or `passes` gets 403, whatever the page did or did not render.
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

/**
 * `<event slug>-<print>[-<theme>].pdf` — the owner's naming rule (event first,
 * then the print). A Classic file carries no theme word; a themed one names
 * its theme, so both can sit in one Downloads folder.
 */
function fileName(slug: string | null, piece: string, theme: InviteThemeId): string {
  const t = isThemedPrint(theme) ? `-${INVITE_THEMES[theme].name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : '';
  return printFileName(slug, `${piece}${t}`);
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

  // ── THE FREE GROUP — no Pro question at all (`kind: 'free'`). `mode=screen`
  // is page 1 as an SVG, the thumbnail Prints & Tickets shows; anything else is
  // the whole PDF, saved as `<event slug>-<print>.pdf`.
  if (piece === 'qr-codes' || piece === 'guest-registry') {
    const admin = createAdminClient();
    const event = await readPrintEvent(admin, eventId);
    if (!event) return new NextResponse('Event not found.', { status: 404 });
    const thumb = mode === 'screen';
    let docs: PrintDoc[];
    let images: PrintImages = {};
    let subject: string;
    if (piece === 'qr-codes') {
      const set = {
        event,
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app',
        ownerSlug: await resolveEventOwnerSlug(admin, eventId).catch(() => null),
      };
      const loaded = await loadGuestPasses(set, { width: thumb ? 160 : 420, limit: thumb ? 12 : undefined });
      if (!loaded.measured) return new NextResponse('We could not read your guest list just now. Please try again.', { status: 503 });
      images = loaded.images;
      docs = layoutQrCodes(
        event.display_name ?? 'Guest QR codes',
        loaded.passes.map((p) => ({ name: p.name, sub: p.seat, qrRef: p.qrRef! })),
      );
      subject = `${loaded.passes.length} guests`;
    } else {
      // THE GUEST LIST REGISTRY — the reception-desk list (lib/print-guest-registry.ts).
      // The measured read: a refused guest list is "we could not read it", never
      // a registry that says the wedding has no guests.
      const [guests, tables, seats] = await Promise.all([
        fetchGuestsByEventMeasured(admin, eventId),
        fetchTables(admin, eventId),
        fetchAssignments(admin, eventId),
      ]);
      if (!guests.measured) return new NextResponse('We could not read your guest list just now. Please try again.', { status: 503 });
      const label = new Map(tables.map((t) => {
        const l = t.link_group_label ?? t.table_label;
        return [t.table_id, /^\d+$/.test(l) ? `Table ${l}` : l] as const;
      }));
      const tableOf = new Map<string, string>();
      for (const s of seats) {
        const l = label.get(s.table_id);
        if (l) tableOf.set(s.guest_id, l);
      }
      const rows = registryRows(guests.rows, tableOf);
      docs = layoutGuestRegistry({ title: event.display_name ?? 'Guest list', dateLabel: registryDate(event.event_date), rows });
      subject = `${rows.length} guests`;
    }
    if (thumb) {
      return new NextResponse(renderPrintSvg(docs[0]!, images), {
        status: 200,
        headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'private, max-age=60' },
      });
    }
    const bytes = await renderPrintPdf(docs, images, { mode: 'plain', title: `${event.display_name ?? 'Guest'} — ${PRINT_PIECES[piece].label}`, subject });
    return pdfResponse(bytes, printFileName(event.slug, piece === 'guest-registry' ? 'guest-registry' : 'qr-codes'), false);
  }
  // The other free documents are served by their own routes (seating pack,
  // caterer report — under /dashboard/<id>/seating); never drawn here.
  if (PRINT_PIECES[piece].kind === 'free') return new NextResponse('No such piece.', { status: 404 });

  const [ownsPro, storeShell, printEvent] = await Promise.all([
    printOwnsPro(eventId),
    isStoreShellRequest(),
    readPrintEvent(createAdminClient(), eventId),
  ]);
  if (!printEvent) return new NextResponse('Event not found.', { status: 404 });
  const access = printAccess({ ownsPro, storeShell });
  // The theme this request would draw — decided ONCE, here, and handed to the
  // loader below, so the gate and the drawing cannot disagree about it.
  const theme = printThemeFor(printEvent, url.searchParams.get('theme'));
  const classic = !isThemedPrint(theme);

  // ══ THE PRINT-READY PATH — checked HERE, on the server, before anything is
  // drawn (owner 2026-09-25: "EVERY PRINT IS FREE IN THE CLASSIC LOOK; THE
  // THEMED VERSION IS PRO"). Classic is print-ready for everyone; a theme is
  // print-ready only with Event Hub Pro. Nothing below this block can produce
  // a PDF or a vector of a THEMED piece for a couple without Pro.
  if (mode === 'print' || piece === 'passes' || (mode === 'screen' && (access.printReady || classic))) {
    if (!mayServe(piece, 'print', access, theme)) {
      return new NextResponse(
        storeShell ? 'Not available here.' : 'The print-ready file in your theme comes with Event Hub Pro. Classic prints are free.',
        { status: 403 },
      );
    }
    // The pass batch and the print file lay out (and fetch their still) at
    // print resolution; the on-screen view is the same design, unmarked.
    const drawMode: PrintMode = mode === 'screen' ? 'screen' : 'print';
    const set = await loadPrintSet(eventId, { mode: drawMode, previewTheme: theme });
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
      return pdfResponse(bytes, fileName(set.event.slug, 'passes', set.theme), false);
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
    return pdfResponse(bytes, fileName(set.event.slug, wantsSet ? 'set' : piece, set.theme), false);
  }

  // ══ THE SAMPLE PATH — everyone (owner 2026-09-25: "we can show them a sample.
  // just compressed so not print ready" · "watermark … they cannot simply edit
  // and remove" · "make it low res"). ONE flattened, watermarked, low-resolution
  // JPEG with placeholder QRs — never a PDF, never a vector. This is also what
  // a free couple's Maker shows on screen.
  if (!isPrintSetKey(piece) && !wantsSet) return new NextResponse('No such piece.', { status: 404 });
  const set = await loadPrintSet(eventId, { mode: 'sample', previewTheme: theme });
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
