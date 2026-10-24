import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getHostUserId } from '@/lib/host-gate';
import { isStoreShellRequest } from '@/lib/request-platform';
import { loadGuestPasses, loadPrintSet, printInputsVersion, printOwnsPro, printThemeFor, readPrintEvent, type LoadedPrintSet } from '@/lib/print-set.server';
import { PDFDocument } from 'pdf-lib';
import { GET as seatingPrintGET } from '@/app/dashboard/[eventId]/seating/print/route';
import { GET as seatingExportGET } from '@/app/dashboard/[eventId]/seating/export/route';
import { GET as catererGET } from '@/app/dashboard/[eventId]/seating/caterer/route';
import { PRINT_VERSION_HEADER } from '@/lib/printed-stamp';
import { bytesStream } from '@/lib/stream-file';
import { qrLookForHostDraft, resolveEventQrLook } from '@/lib/qr-look.server';
import { layoutPasses, layoutPieceDocs, layoutPieceView, layoutQrCodes, type PrintDoc, type PrintImages, type PrintSetData } from '@/lib/print-layout';
import { PASS_CARD_DESIGNS, passCardDesignFrom } from '@/lib/pass-card';
import { layoutGuestRegistry, registryDate, registryRows } from '@/lib/print-guest-registry';
import { fetchGuestsByEventMeasured } from '@/lib/guests';
import { fetchAssignments, fetchTables } from '@/lib/seating';
import { INVITE_THEMES, type InviteThemeId } from '@/lib/invite-themes';
import { renderPrintSvg } from '@/lib/print-render-svg';
import { renderImposedPdf, renderPrintBook, renderPrintPdf } from '@/lib/print-render-pdf';
import { renderSampleJpeg, renderSampleSheetJpeg } from '@/lib/print-sample-raster';
import {
  PRINT_PIECES,
  PRINT_SET_KEYS,
  formatFamilyOf,
  formatFor,
  isPrintPieceKey,
  isPrintSetKey,
  isProPrint,
  isThemedPrint,
  isAllInOnePrint,
  mayServe,
  menuHasDishes,
  parseMenu,
  parsePrintDetails,
  printAccess,
  storyHasMoments,
  printFileName,
  posterPhotoRefAllowed,
  posterPhotoTooSmall,
  spotLayersFor,
  type PrintMode,
  type PrintPieceKey,
  type PrintSetKey,
} from '@/lib/print-pieces';
import { logQueryError } from '@/lib/supabase/error-detect';
import { NAME_STYLES, nameStyleFrom } from '@/lib/name-style';
import { resolveEventOwnerSlug } from '@/lib/public-event-url';
import { formatCount } from '@/lib/format-number';
import { previewCacheControl } from '@/lib/print-preview-cache';
import { updatePrintDetails } from '@/lib/print-details-write';
import { sampleView } from '@/lib/print-sample-door.server';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { readHubDraft, saveHubDraftPatch } from '@/lib/hub-draft-store';
import type { HubDraftEvents } from '@/lib/hub-draft';
import { printDraftOf } from '@/lib/ceremony-time';
import { allInOneRefusal } from '@/lib/studio-prints-six';
import { PAPER_HOW, previewPage, printPaperHeader, type PrintPaperFacts } from '@/lib/print-paper';

/**
 * /api/hub-print/[piece] — PRINTS & TICKETS (Event Hub Maker Phase 9, the
 * plan's one +1 route handler).
 *
 * GET  ?event=<uuid>&mode=screen|sample|print[&theme=<preview>]
 * ⚖ Owner 2026-09-25, "EVERY PRINT IS FREE IN THE CLASSIC LOOK; THE THEMED
 * VERSION IS PRO": `theme=house` (Classic) is print-ready for EVERY event; a
 * Pro theme is print-ready only with Event Hub Pro. Since 2026-09-29 the free
 * themes (Classic, Modern, Cyber Neon — `isProPrint` false) all print free.
 *
 *   · a set piece (`invitation` · `entourage` · `details` · `menu` · `pass` ·
 *     `poster` · `story-poster` · `card`):
 *       `sample` — ONE flattened JPEG, ≤ 800 px, quality 60, the tiled
 *                  "SAMPLE · SETNAYAN" watermark burned into the pixels,
 *                  placeholder QRs. Never a PDF, never a vector.
 *       `screen` — what the Maker shows: the unmarked SVG in a free theme or
 *                  with Pro, the same watermarked JPEG as `sample` for a Pro
 *                  theme without Pro;
 *       `print`  — the print-ready PDF (bleed, crop marks, Foil / White ink /
 *                  Die cut layers), no watermark. A free theme: everyone. A Pro theme: Pro.
 *   · `set` — the themed pieces (the Menu only once it has a dish, the Our Story
 *     poster only once there is a Love Story): one print-ready PDF, or one sample sheet JPEG.
 *   · `passes` — every guest's pass, ganged on A4, each QR the guest's own
 *     invitation code. A free theme: everyone. A Pro theme: Pro.
 *   · the FREE GROUP (`kind: 'free'`, no themed version, store shell included):
 *       `qr-codes` — every guest's QR with their name (owner 2026-09-25: "the
 *                    free version is the PDF of QRs … found on Guestlist");
 *       `guest-registry` — the reception-desk list (lib/print-guest-registry.ts).
 *     `mode=screen` is page 1 as an SVG (the Maker's thumbnail); otherwise the PDF.
 * POST /api/hub-print/words — saves `events.print_details`: the opening line and
 *   the "Kindly reply" CHOICE (a host / the coordinator, or manual words). The
 *   Maker's Words panel posts it and says "Saves immediately". Parents come from
 *   the Guest list and gifts from E-Gifts — never typed here.
 * POST /api/hub-print/name-style — `style=full|middle-initial|surname-first`,
 *   the event's Name style (`print_details.name_style`, lib/name-style.ts).
 *
 * 🔒 THE GATE IS HERE, NOT A HIDDEN BUTTON. A free event asking for a PRO-THEMED
 * `print` or `passes` gets 403, whatever the page did or did not render.
 */

export const dynamic = 'force-dynamic';
/* ⏱ 300 s, the shipped big-file route's ceiling (`/api/guest/pass-card/all`): a print file is drawn whole, then streamed
   (`lib/stream-file.ts`) — a buffered body over 4.5 MB is refused by Vercel (live fault 2026-10-17). Everything ◆ (the set, every
   guest's pass and the day's sheets in one request) runs under the same ceiling. */
export const maxDuration = 300;

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

/**
 * ✍ THE TAPPABLE WORDS (owner 2026-09-28, "tap it, edit it on the right"): an
 * on-screen picture carries where its print-only words landed (`PrintDoc.fields`,
 * in the doc's points, with the doc's size to scale by). The Maker's Details
 * body lays a tap target over each. A header, so the picture itself — SVG or
 * the sample JPEG — is unchanged and its cache is the picture's.
 */
function fieldsHeader(doc: PrintDoc): Record<string, string> {
  return doc.fields?.length
    ? { 'x-print-fields': JSON.stringify({ w: doc.w, h: doc.h, fields: doc.fields.map((b) => ({ ...b, x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.w.toFixed(1), h: +b.h.toFixed(1) })) }) }
    : {};
}

/**
 * `pass_design=<key>` — the pass card's look for THIS drawing only (the Prints
 * panel shows each look before the couple picks; a preview never writes).
 * Without it the couple's saved pick (`print_details.pass_design`) stands.
 */
function withPassDesign(data: PrintSetData, url: URL): PrintSetData {
  const asked = url.searchParams.get('pass_design');
  if (!asked || !(PASS_CARD_DESIGNS as readonly string[]).includes(asked)) return data;
  return { ...data, details: { ...data.details, passDesign: passCardDesignFrom(asked) } };
}

/** 📤 Every print PDF leaves as a STREAM — the same bytes, no Content-Length (`lib/stream-file.ts`: a buffered body stops at 4.5 MB on Vercel). */
function pdfResponse(bytes: Uint8Array, name: string, inline: boolean, version: string | null = null): NextResponse {
  return new NextResponse(bytesStream(bytes), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${name}"`,
      'cache-control': 'private, no-store',
      // 🖨 "CHANGED SINCE YOU PRINTED" (owner 2026-09-29, OWNER ANSWERS (5)):
      // the hash of every input this paper was drawn from (`printInputsVersion`,
      // the same one the Maker's previews carry as `v`). The Save button keeps
      // it (lib/printed-stamp.ts); the piece says so once the inputs move on.
      ...(version ? { [PRINT_VERSION_HEADER]: version } : {}),
    },
  });
}

type FreeSheet =
  | { ok: true; docs: PrintDoc[]; images: PrintImages; subject: string; paper: (pages: number, page: number) => PrintPaperFacts }
  | { ok: false; res: NextResponse };

/**
 * The Guest QR codes sheet or the guest list registry, laid out — ONE reader for the free sheet's own file and for Everything ◆
 * (the same pages in both). `thumb`: the on-screen picture (one page of QRs, the drafted QR look when its address names one).
 */
async function freeSheet(
  piece: 'qr-codes' | 'guest-registry',
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  event: NonNullable<Awaited<ReturnType<typeof readPrintEvent>>>,
  { thumb, url }: { thumb: boolean; url: URL },
): Promise<FreeSheet> {
  let docs: PrintDoc[];
  let images: PrintImages = {};
  let subject: string;
  /* 📄 The preview's page (`?page=N`, Studio › Prints' preview sheet) and what the sheet says about its paper (`x-print-paper`). */
  let paper: (pages: number, page: number) => PrintPaperFacts;
  if (piece === 'qr-codes') {
    /* 💾 THE MAKER'S THUMBNAIL WEARS THE DRAFTED QR LOOK (owner 2026-10-06: "i
       changed the QR Code style, why did the QR codes not change?"). Only the
       on-screen picture whose address names the draft (`draft=<hash>`,
       `lib/free-prints.ts`), read through the host's own session after the
       host gate above. The saved PDF is always drawn from what is live. */
    const sheetDraft: HubDraftEvents | null =
      thumb && url.searchParams.get('draft')
        ? await readHubDraft(await createClient(), eventId)
            .then((d) => printDraftOf(d?.events as Record<string, unknown> | undefined))
            .catch((err) => {
              // The thumbnail then shows the live look — said in the logs, not silently.
              logQueryError('hub-print.qr-codes.draft', err, { eventId }, 'graceful_degrade');
              return null;
            })
        : null;
    const set = {
      event,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app',
      ownerSlug: await resolveEventOwnerSlug(admin, eventId).catch(() => null),
      // The free QR sheet wears the event's look too — the Setnayan mark, or
      // the couple's own on Event Hub Pro (lib/qr-look.ts).
      qrLook: qrLookForHostDraft(event, sheetDraft) ?? (await resolveEventQrLook(admin, eventId, event)),
    };
    /* 📄 The thumbnail draws ONE page's twelve codes (page 1 unless `?page=N`), the sheet still laid out whole. */
    const askedPage = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
    const loaded = await loadGuestPasses(set, { width: thumb ? 160 : 420, ...(thumb ? { drawOnly: { from: (askedPage - 1) * 12, count: 12 } } : {}) });
    if (!loaded.measured) return { ok: false, res: new NextResponse('We could not read your guest list just now. Please try again.', { status: 503 }) };
    images = loaded.images;
    docs = layoutQrCodes(
      event.display_name ?? 'Guest QR codes',
      loaded.passes.map((p) => ({ name: p.name, sub: p.seat, qrRef: p.qrRef! })),
      set.qrLook.shape,
    );
    subject = `${formatCount(loaded.passes.length)} guests`;
    const codes = loaded.passes.length;
    paper = (pages, page) => ({ pages, page, how: PAPER_HOW.qrCodes(codes, pages), empty: codes === 0 ? 'guests' : null });
  } else {
    // THE GUEST LIST REGISTRY — the reception-desk list (lib/print-guest-registry.ts).
    // The measured read: a refused guest list is "we could not read it", never
    // a registry that says the wedding has no guests.
    const [guests, tables, seats] = await Promise.all([
      // 🕯 The desk LISTS a guest who passed away ("In loving memory") and
      // counts them nowhere — `registryRows` / `listedNotCounted`.
      fetchGuestsByEventMeasured(admin, eventId, { includePassedAway: true }),
      fetchTables(admin, eventId),
      fetchAssignments(admin, eventId),
    ]);
    if (!guests.measured) return { ok: false, res: new NextResponse('We could not read your guest list just now. Please try again.', { status: 503 }) };
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
    subject = `${rows.filter((r) => r.counted).length} guests`;
    const listed = rows.length;
    paper = (pages, page) => ({ pages, page, how: PAPER_HOW.registry(listed, pages), empty: listed === 0 ? 'guests' : null });
  }
  return { ok: true, docs, images, subject, paper };
}

/**
 * 🗂 EVERYTHING ◆ (owner 2026-10-17, DECISION_LOG "PRINTS: ONE SETTINGS SHEET, ONE DOWNLOAD PER PIECE, VIEW AS ▾ ON GUEST PRINTS, ALL
 * GUESTS ◆, EVERYTHING ◆": *"Everything ◆ = the set + the day's sheets + the pass batch"*). ONE PDF, Event Hub Pro (checked by the
 * caller, `isAllInOnePrint('everything')`), in this order:
 *
 *   1 · the invitation set (the whole set's own pages, print-ready, its layers), then the guest list registry and every guest's QR
 *       — drawn into the SAME document (`renderPrintPdf` draws a free sheet plain, page by page);
 *   2 · every guest's pass, ganged on A4 with cut lines, in the size picked (`passes`' own drawing);
 *   3 · the day's sheets that live under /dashboard/<id>/seating — the table signs & place cards, the entrance seating chart (by
 *       table, its default size), the caterer's meal counts and the 2D seat plan — each asked of ITS OWN route handler, in this
 *       request (the same session, the same reads, the same refusals), and its pages copied in.
 *
 * A part with nothing to print (no guest coming yet, no tables, a chart too full for its sheet) is left out — that is the part's
 * own answer (a 4xx with its words), never an empty page. A part that FAILED (5xx, a refused read) fails the whole file, in the
 * part's words — never a file that is quietly missing a section. The event QR is a picture, not a sheet: it is not in the PDF.
 */
type DayPart = { name: string; call: () => Promise<Response> };
async function everythingPdf(
  req: Request,
  { eventId, set, docs, input, passFormat }: { eventId: string; set: LoadedPrintSet; docs: PrintDoc[]; input: Parameters<typeof layoutPasses>[0]; passFormat: string | null },
): Promise<Response> {
  const admin = createAdminClient();
  const url = new URL(req.url);
  /* 📦 ONE QR PICTURE PER GUEST (2026-10-17, measured: three per guest made 240 guests a 21.9 MB file): every guest's invitation QR is
     drawn ONCE (`all`, the QR sheet's list) and the passes reuse it — the ticket list (`tickets`) is read WITHOUT drawing a QR (its
     refs are the same `qr-<guest id>` keys), and the set, the registry, the QR sheet and the passes are ONE document, each picture
     embedded once (`renderPrintBook`). */
  const [registry, all, tickets] = await Promise.all([
    freeSheet('guest-registry', admin, eventId, set.event, { thumb: false, url }),
    loadGuestPasses(set, { width: EVERYTHING_QR_PX }),
    loadGuestPasses(set, { width: EVERYTHING_QR_PX, ticketsOnly: true, drawOnly: { from: 0, count: 0 } }),
  ]);
  if (!registry.ok) return registry.res;
  if (!all.measured || !tickets.measured) return new NextResponse('We could not read your guest list just now. Please try again.', { status: 503 });
  const title = `${set.event.display_name ?? 'Event'} — everything`;
  const qrSheet = layoutQrCodes(set.event.display_name ?? 'Guest QR codes', all.passes.map((p) => ({ name: p.name, sub: p.seat, qrRef: p.qrRef! })), set.qrLook.shape);
  /* 2 · every guest's pass (nobody coming yet: no pages — the set says the rest), ganged on A4, in the same book. */
  const passDocs = layoutPasses({ ...input, format: passFormat }, tickets.passes.filter((p) => p.qrRef && all.images[p.qrRef]));
  const fmt = formatFor('passes', passFormat)!;
  const head = await renderPrintBook(
    [
      { kind: 'pages', docs: [...docs, ...registry.docs, ...qrSheet] },
      ...(passDocs.length ? [{ kind: 'imposed' as const, docs: passDocs, ...fmt.sheet! }] : []),
    ],
    { ...set.images, ...all.images },
    { title, subject: 'The set, every guest’s pass and place card, the day’s sheets' },
  );
  const out = await PDFDocument.load(head);
  const append = async (bytes: Uint8Array) => {
    const src = await PDFDocument.load(bytes);
    for (const page of await out.copyPages(src, src.getPageIndices())) out.addPage(page);
  };
  /* 3 · the day's sheets, each from its own route handler. */
  const at = (path: string) => new Request(new URL(`/dashboard/${encodeURIComponent(eventId)}/seating/${path}`, url.origin), { headers: req.headers });
  const params = Promise.resolve({ eventId });
  const parts: DayPart[] = [
    { name: 'Table signs & place cards', call: () => seatingPrintGET(at('print?format=pdf'), { params }) },
    { name: 'Entrance seating chart', call: () => seatingPrintGET(at('print?chart=table&format=pdf'), { params }) },
    { name: 'Caterer meal counts', call: () => catererGET(at('caterer?format=pdf'), { params }) },
    { name: '2D seat plan', call: () => seatingExportGET(at('export?mode=moodboard'), { params }) },
  ];
  for (const part of parts) {
    const res = await part.call();
    if (res.status >= 500) {
      const why = (await res.text().catch(() => '')).trim();
      return new NextResponse(`${part.name} could not be drawn just now${why ? ` — ${why}` : ''}. Please try again.`, { status: 503 });
    }
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('application/pdf')) continue;
    await append(new Uint8Array(await res.arrayBuffer()));
  }
  const bytes = await out.save();
  /* 📤 STREAMED like every print PDF (`pdfResponse` → `bytesStream`, lib/stream-file.ts): a buffered Vercel body stops at 4.5 MB. The
     file's size and time at 240 and 400 guests are measured in the PR that made it (#6597), never written here. */
  return pdfResponse(bytes, fileName(set.event.slug, 'everything', set.theme), false, await printInputsVersion(eventId).catch(() => null));
}

/** The PDF size at which Everything's QR is drawn — the passes' own (600 px), shared by the QR sheet. */
const EVERYTHING_QR_PX = 600;


export async function GET(req: Request, ctx: { params: Promise<{ piece: string }> }) {
  const { piece: rawPiece } = await ctx.params;
  const url = new URL(req.url);
  if (url.searchParams.get('sample') === '1') return sampleView(rawPiece, url);
  const g = await gate(url.searchParams.get('event'));
  if (!g.ok) return g.res;
  const eventId = g.eventId;

  /* 🗂 EVERYTHING ◆ (owner 2026-10-17): the whole set's PDF with every guest's pass and the day's sheets after it — always the
     print-ready file (`everythingPdf`), never a sample sheet. */
  const wantsEverything = rawPiece === 'everything';
  const wantsSet = rawPiece === 'set' || wantsEverything;
  if (!wantsSet && !isPrintPieceKey(rawPiece)) return new NextResponse('No such piece.', { status: 404 });
  const piece = (wantsSet ? 'invitation' : rawPiece) as PrintPieceKey;
  const rawMode = url.searchParams.get('mode');
  const mode: PrintMode = wantsEverything || rawMode === 'print' ? 'print' : rawMode === 'screen' ? 'screen' : 'sample';
  const allName = wantsEverything ? 'everything' : wantsSet ? 'set' : piece;
  // The couple's chosen sizes (`PRINT_FORMATS`), one per family —
  // `pass_format` · `invitation_format` · `card_format` (or one `format`). A
  // piece that cannot wear the asked size gets its default.
  const formatParam = (k: PrintPieceKey): string | null => {
    const family = formatFamilyOf(k);
    return (family && url.searchParams.get(`${family}_format`)) || url.searchParams.get('format');
  };

  // ── THE FREE GROUP (`kind: 'free'`). `mode=screen` is page 1 as an SVG, the
  // thumbnail Prints & Tickets shows; anything else is the whole PDF, saved as
  // `<event slug>-<print>.pdf`. Free — the Guest QR sheet too (an all-guests ◆
  // file 2026-10-17 → free again 2026-10-22, below).
  if (piece === 'qr-codes' || piece === 'guest-registry') {
    const admin = createAdminClient();
    const event = await readPrintEvent(admin, eventId);
    if (!event) return new NextResponse('Event not found.', { status: 404 });
    const thumb = mode === 'screen';
    /* 🎟 EVERY GUEST'S QR ON ONE SHEET IS FREE (owner 2026-10-22, DECISION_LOG "FREE IS READY, PRO IS PERSONAL — ALL TICKETS AND THE
       QR SHEET ARE FREE": *"the goal of the free is to keep everything minimum ready but no personalization."*). It was an all-guests
       ◆ file from 2026-10-17; it is a plain utility sheet a free event needs to run its day, so no Pro question is asked here. */
    const sheet = await freeSheet(piece, admin, eventId, event, { thumb, url });
    if (!sheet.ok) return sheet.res;
    const { docs, images, subject, paper } = sheet;
    if (thumb) {
      const page = previewPage(url.searchParams, docs.length);
      return new NextResponse(renderPrintSvg(docs[page - 1]!, images), {
        status: 200,
        headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'private, max-age=60', ...printPaperHeader(paper(docs.length, page)) },
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
  /* 🗂 THE DESIGNED SET IN ONE FILE IS EVENT HUB PRO (owner 2026-10-16, DECISION_LOG "PRINTS: ONE AT A TIME IS FREE — EVERY
     'DOWNLOAD ALL' IS EVENT HUB PRO"; narrowed 2026-10-22, "FREE IS READY, PRO IS PERSONAL — ALL TICKETS AND THE QR SHEET ARE
     FREE"): the whole set in one PDF and Everything — in EVERY theme, Classic too — need the event's Event Hub Pro, the SAME read
     the ticket zip's route makes (`printOwnsPro` → `eventSkuActive`, an internal host included: an unlock belongs to the event).
     Refused here, before anything is drawn, whatever the page did or did not show. Every guest's pass in one file (`passes`) is
     FREE since 2026-10-22 — drawn plain white for a free event like every free print (`printLookForEvent`) — as are each
     piece's own file and ONE guest's pass (`pass_guest=<id>`, below). */
  if (isAllInOnePrint(allName, mode) && !ownsPro) {
    return new NextResponse(storeShell ? 'Not available here.' : allInOneRefusal(allName), { status: 403 });
  }
  /* ✍ THE MAKER'S PREVIEW DRAWS THE DRAFT (owner 2026-10-04: "the preview
     above shows the new time at once"): an on-screen picture whose address
     names the draft (`draft=<hash of it>`, `maker-prints.tsx`) is drawn with
     the host's drafted names, date and ceremony time laid on — read through
     the host's own session, after the host gate above. A file that is saved
     or printed (`mode=print`, `passes`) is always drawn from what is live. */
  const draft: HubDraftEvents | null =
    mode !== 'print' && piece !== 'passes' && url.searchParams.get('draft')
      ? await readHubDraft(await createClient(), eventId)
          .then((d) => printDraftOf(d?.events as Record<string, unknown> | undefined))
          .catch(() => null)
      : null;
  // The theme this request would draw — decided ONCE, here, and handed to the
  // loader below, so the gate and the drawing cannot disagree about it.
  const theme = printThemeFor(printEvent, url.searchParams.get('theme'));
  // A FREE theme (Classic, Modern, Cyber Neon — the registry's `tier`, never a
  // typed list) prints like Classic: unmarked on screen, print-ready for all.
  const freeTheme = !isProPrint(theme);

  // ══ THE PRINT-READY PATH — checked HERE, on the server, before anything is
  // drawn (owner 2026-09-25: "EVERY PRINT IS FREE IN THE CLASSIC LOOK; THE
  // THEMED VERSION IS PRO"; 2026-09-29: Modern and Cyber Neon free too). A free
  // theme is print-ready for everyone; a Pro theme only with Event Hub Pro.
  // Nothing below this block can produce a PDF or a vector of a PRO-THEMED
  // piece for a couple without Pro.
  if (mode === 'print' || piece === 'passes' || (mode === 'screen' && (access.printReady || freeTheme))) {
    if (!mayServe(piece, 'print', access, theme)) {
      return new NextResponse(
        storeShell
          ? 'Not available here.'
          : `The print-ready file in ${INVITE_THEMES[theme].name} comes with Event Hub Pro. Free prints are plain white; your Event Hub look on paper is Event Hub Pro.`,
        { status: 403 },
      );
    }
    // The pass batch and the print file lay out (and fetch their still) at
    // print resolution; the on-screen view is the same design, unmarked.
    const drawMode: PrintMode = mode === 'screen' ? 'screen' : 'print';
    const set = await loadPrintSet(eventId, { mode: drawMode, previewTheme: theme }, drawMode === 'screen' ? draft : null);
    if (!set) return new NextResponse('Event not found.', { status: 404 });
    const spot = spotLayersFor(set.theme);
    const input = { look: set.look, data: withPassDesign(set.data, url), mode: drawMode, foil: spot.foil, whiteInk: spot.whiteInk };

    if (piece === 'passes') {
      // 🎟 Printed tickets only for who is coming (owner 2026-09-29, OWNER ANSWERS (9)).
      const { passes, images, measured } = await loadGuestPasses(set, { width: 600, ticketsOnly: true });
      if (!measured) return new NextResponse('We could not read your guest list just now. Please try again.', { status: 503 });
      const docs = layoutPasses({ ...input, format: formatParam('passes') }, passes);
      if (!docs.length) return new NextResponse('No guest has a ticket yet — a ticket appears once a guest is on your list and coming.', { status: 409 });
      // Ganged on A4 with cut lines (owner: print at home or at a shop).
      const fmt = formatFor('passes', formatParam('passes'))!;
      const bytes = await renderImposedPdf(docs, { ...set.images, ...images }, {
        ...fmt.sheet!,
        title: `${set.event.display_name ?? 'Event'} — guest passes`,
        subject: `${docs.length} passes · ${fmt.label} ${fmt.wMm} × ${fmt.hMm} mm · ${fmt.sheet!.cols * fmt.sheet!.rows} per A4`,
      });
      return pdfResponse(bytes, fileName(set.event.slug, 'passes', set.theme), false, await printInputsVersion(eventId).catch(() => null));
    }
    /* 🎟 ONE GUEST'S PASS, FREE (owner 2026-10-16: *"each guest's own pass one at a time, stay free"*): `pass_guest=<guest id>`
       prints that one guest's pass — their name, their own QR, the size picked — when they have one (the ticket rule:
       `ticketsOnly`, the same as every guest's file). Anyone else is refused in words, never a stand-in. */
    const passGuest = url.searchParams.get('pass_guest');
    if (piece === 'pass' && mode === 'print' && passGuest && UUID.test(passGuest)) {
      const one = await loadGuestPasses(set, { width: 600, ticketsOnly: true, onlyGuest: passGuest });
      if (!one.measured) return new NextResponse('We could not read your guest list just now. Please try again.', { status: 503 });
      const pass = one.passes[0];
      if (!pass) return new NextResponse('That guest has no pass — a pass is printed for a guest who is on your list and coming.', { status: 404 });
      const docs = layoutPieceDocs('pass', { ...input, format: formatParam('pass'), pass });
      const bytes = await renderPrintPdf(docs, { ...set.images, ...one.images }, {
        mode: 'print',
        title: `${set.event.display_name ?? 'Event'} — ${pass.name}`,
        subject: 'Print-ready · 3 mm bleed · crop marks · layers: Foil, White ink, Die cut',
      });
      const who = pass.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'guest';
      return pdfResponse(bytes, fileName(set.event.slug, `pass-${who}`, set.theme), false, await printInputsVersion(eventId).catch(() => null));
    }
    if (mode === 'screen') {
      /* 🎫 THE REAL TICKET (owner 2026-10-05, "isn't this the digital pass?"):
         `pass_guest=first` draws the first guest who is coming — their name and
         their own QR — instead of the stand-in, for the Maker's Guest's ticket
         scene. One guest is read (`limit: 1`); none yet → the stand-in. */
      /* 👤 …and `pass_guest=<guest id>` draws THAT guest's pass (owner 2026-10-17, "View as ▾": pick a guest once and every guest
         print redraws for them). A guest without a pass draws the stand-in, as `first` does with nobody. */
      const asked = url.searchParams.get('pass_guest');
      const guestPass =
        piece === 'pass' && asked === 'first'
          ? await loadGuestPasses(set, { width: 360, limit: 1, ticketsOnly: true }).catch(() => null)
          : piece === 'pass' && asked && UUID.test(asked)
            ? await loadGuestPasses(set, { width: 360, ticketsOnly: true, onlyGuest: asked }).catch(() => null)
            : null;
      const firstPass = guestPass?.passes[0];
      const view = layoutPieceView(piece as PrintSetKey, { ...input, format: formatParam(piece), ...(firstPass ? { pass: firstPass } : {}) });
      const svg = renderPrintSvg(view, firstPass ? { ...set.images, ...guestPass!.images } : set.images, { compact: true });
      /* 📄 The picture shows every side at once (Front · Back side by side); the file's pages are the sides it prints. */
      const sides = layoutPieceDocs(piece as PrintSetKey, { ...input, format: formatParam(piece) }).length;
      return new NextResponse(svg, {
        status: 200,
        // ⚡ A VERSIONED ADDRESS IS IMMUTABLE (owner 2026-09-28: the
        // boarding-pass preview took ~8 s). The Maker names every input this
        // picture is drawn from in `v` (`printInputsVersion`), so the same
        // address can only ever mean the same picture — a year, `immutable`.
        // Without a `v`, the old 60 s + `stale-while-revalidate` (a couple
        // flipping between theme chips paints the last render instantly).
        headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': previewCacheControl(url.searchParams.get('v')), ...fieldsHeader(view), ...printPaperHeader({ pages: 1, page: 1, sides: Math.max(1, sides) }) },
      });
    }
    // THE MENU IS NEVER PRINTED BLANK: with no dishes it is refused on its own
    // and left out of the whole set.
    const hasMenu = menuHasDishes(set.data.menu);
    if (!wantsSet && piece === 'menu' && !hasMenu) {
      return new NextResponse('Add your menu first — the moments of your night and their dishes — in Prints & Tickets.', { status: 409 });
    }
    // …and neither is the Our Story poster: with no Love Story it is refused
    // on its own and left out of the whole set.
    const hasStory = storyHasMoments(set.data.story);
    if (!wantsSet && piece === 'story-poster' && !hasStory) {
      return new NextResponse('Add your Love Story first — its moments are what the poster prints — in the Maker’s Love Story.', { status: 409 });
    }
    const keys = wantsSet
      ? PRINT_SET_KEYS.filter((k) => k !== 'menu' || hasMenu).filter((k) => k !== 'story-poster' || hasStory)
      : [piece as PrintSetKey];
    // EVERY SIDE prints — a piece with a back (a large Entourage) is two pages.
    const docs: PrintDoc[] = keys.flatMap((k) => layoutPieceDocs(k, { ...input, format: formatParam(k) }));
    if (wantsEverything) {
      return everythingPdf(req, { eventId, set, docs, input, passFormat: formatParam('passes') });
    }
    const label = wantsSet ? 'The print set' : PRINT_PIECES[piece].label;
    const bytes = await renderPrintPdf(docs, set.images, {
      mode: 'print',
      title: `${set.event.display_name ?? 'Event'} — ${label}`,
      subject: 'Print-ready · 3 mm bleed · crop marks · layers: Foil, White ink, Die cut',
    });
    return pdfResponse(bytes, fileName(set.event.slug, wantsSet ? 'set' : piece, set.theme), false, await printInputsVersion(eventId).catch(() => null));
  }

  // ══ THE SAMPLE PATH — everyone (owner 2026-09-25: "we can show them a sample.
  // just compressed so not print ready" · "watermark … they cannot simply edit
  // and remove" · "make it low res"). ONE flattened, watermarked, low-resolution
  // JPEG with placeholder QRs — never a PDF, never a vector. This is also what
  // a free couple's Maker shows on screen.
  if (!isPrintSetKey(piece) && !wantsSet) return new NextResponse('No such piece.', { status: 404 });
  const set = await loadPrintSet(eventId, { mode: 'sample', previewTheme: theme }, draft);
  if (!set) return new NextResponse('Event not found.', { status: 404 });
  const spot = spotLayersFor(set.theme);
  const input = { look: set.look, data: withPassDesign(set.data, url), mode: 'sample' as const, foil: spot.foil };
  const pieceView = wantsSet ? null : layoutPieceView(piece as PrintSetKey, { ...input, format: formatParam(piece) });
  const jpeg = wantsSet
    ? await renderSampleSheetJpeg(
        PRINT_SET_KEYS.filter((k) => k !== 'menu' || menuHasDishes(set.data.menu))
          .filter((k) => k !== 'story-poster' || storyHasMoments(set.data.story))
          .map((k) => layoutPieceView(k, { ...input, format: formatParam(k) })),
        set.images,
      )
    : await renderSampleJpeg(pieceView!, set.images);
  const name = `${(set.event.slug || 'event').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'event'}-${wantsSet ? 'set' : piece}-sample.jpg`;
  return new NextResponse(Buffer.from(jpeg), {
    status: 200,
    headers: {
      'content-type': 'image/jpeg',
      'content-disposition': `${mode === 'screen' ? 'inline' : 'attachment'}; filename="${name}"`,
      // See the `screen` SVG branch above — the on-screen sample is versioned
      // the same way; a download (`mode=sample`) carries no `v` and keeps 60 s.
      'cache-control': mode === 'screen' ? previewCacheControl(url.searchParams.get('v')) : previewCacheControl(null),
      ...(mode === 'screen' && pieceView ? fieldsHeader(pieceView) : {}),
    },
  });
}

/**
 * `words` — the Details form; `menu` — the Menu editor in Prints & Tickets.
 * Everything else is refused. Both write `events.print_details`, and each
 * keeps what the OTHER owns: a Details save never erases the menu, a menu save
 * never touches the words. So both first READ the stored value — and if it
 * cannot be read, nothing is written (a blind write would wipe the other half).
 */
/**
 * 👥 TWO HOSTS NEVER OVERWRITE EACH OTHER (owner 2026-10-18, round 2): every write below is a CHANGE applied to
 * `print_details` as it is when the write lands (`updatePrintDetails`, lib/print-details-write.ts) — never the value
 * read at the top of the request, which another save (the other host's, or this host's menu autosave beside the poster
 * photo) may already have passed. `said` turns its answer into the `{ message }` the logs take, or null.
 */
const said = (r: Awaited<ReturnType<typeof updatePrintDetails>>): { message: string } | null => (r.ok ? null : { message: r.error });

export async function POST(req: Request, ctx: { params: Promise<{ piece: string }> }) {
  const { piece } = await ctx.params;
  if (piece !== 'words' && piece !== 'menu' && piece !== 'poster-photo' && piece !== 'name-style') return new NextResponse('Not found.', { status: 404 });

  // A form post from another site carries no Origin of ours.
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host && new URL(origin).host !== host) return new NextResponse('Refused.', { status: 403 });

  const form = await req.formData();
  const g = await gate(String(form.get('event_id') ?? ''));
  if (!g.ok) return g.res;
  const eventId = g.eventId;
  const admin = createAdminClient();
  const current = await readPrintEvent(admin, eventId);
  const back = new URL(`/dashboard/${eventId}/launch`, req.url);
  // Both land on Details (Prints & Tickets folded in, 2026-09-28) — the Menu on its own item.
  back.searchParams.set('tool', 'details');
  back.searchParams.set('item', piece === 'menu' ? 'menu' : 'invitation');
  /* A quiet save (Studio › Prints' menu) is told in its own words — never answered with a whole Maker page. */
  if (!current && piece === 'menu' && (req.headers.get('accept') ?? '').includes('application/json')) return NextResponse.json({ ok: false }, { status: 500 });
  if (!current) {
    back.searchParams.set(piece === 'menu' ? 'menu_error' : 'print_error', '1');
    return NextResponse.redirect(back, 303);
  }

  // 🎫 THE PASS CARD'S LOOK IS NOT WRITTEN HERE ANY MORE (owner 2026-10-02 Q7,
  // "the pass look waits for Apply"; built 2026-10-05): the Ticket style ▾ saves
  // to the Event Hub DRAFT (`passDesignDraftPatch`, lib/pass-design-save.ts) and
  // Apply merges it into `print_details` (`hub-draft-actions.ts`). A post here
  // naming `pass-design` is refused above ("Not found.") and writes nothing.

  // 🔤 THE EVENT'S NAME STYLE (owner 2026-09-30, DECISION_LOG "THE COUPLE
  // PICKS A NAME STYLE") — Full · Middle initial · Surname first, the Maker's
  // Details › Names dropdown. Saved at once, like the pass card's look; live,
  // never drafted (a ticket or a printed card is drawn from what is stored).
  // Everything else in `print_details` is carried over untouched. Answers JSON.
  if (piece === 'name-style') {
    const asked = String(form.get('style') ?? '');
    if (!(NAME_STYLES as readonly string[]).includes(asked)) return NextResponse.json({ ok: false }, { status: 400 });
    const error = said(await updatePrintDetails(admin, eventId, (now) => ({ ...now, nameStyle: nameStyleFrom(asked) })));
    if (error) logQueryError('hub-print.name-style', error, { event_id: eventId }, 'graceful_degrade');
    return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
  }

  // 🖼 THE OUR STORY POSTER'S OWN PHOTO (owner 2026-09-29, OWNER ANSWERS (1)) —
  // optional; an empty `ref` goes back to the theme's picture. Only the
  // couple's own upload for THIS event (`posterPhotoRefAllowed`), measured here
  // so the panel can say when it is too small for A3. Answers JSON.
  if (piece === 'poster-photo') {
    const ref = String(form.get('ref') ?? '').trim();
    if (!ref) {
      const error = said(await updatePrintDetails(admin, eventId, (now) => ({ ...now, posterPhoto: null })));
      if (error) logQueryError('hub-print.poster-photo', error, { event_id: eventId }, 'graceful_degrade');
      return NextResponse.json({ ok: !error, photo: null }, { status: error ? 500 : 200 });
    }
    if (!posterPhotoRefAllowed(ref, eventId)) return NextResponse.json({ ok: false }, { status: 400 });
    let w: number | null = null;
    let h: number | null = null;
    try {
      const url = await displayUrlForStoredAsset(ref);
      const res = url ? await fetch(url, { signal: AbortSignal.timeout(10000) }) : null;
      if (res?.ok) {
        const sharp = (await import('sharp')).default;
        const meta = await sharp(new Uint8Array(await res.arrayBuffer())).metadata();
        // EXIF-rotated photos report their stored sides; either way round is fine (the check is by short/long side).
        w = meta.width ?? null;
        h = meta.height ?? null;
      }
    } catch (err) {
      logQueryError('hub-print.poster-photo.measure', err, { event_id: eventId }, 'graceful_degrade');
    }
    if (!w || !h) return NextResponse.json({ ok: false, error: 'That photo could not be read — try another.' }, { status: 422 });
    const photo = { ref, w, h };
    // 👥 Applied to print_details as it is NOW — the measuring above held the first read for seconds.
    const error = said(await updatePrintDetails(admin, eventId, (now) => ({ ...now, posterPhoto: photo })));
    if (error) logQueryError('hub-print.poster-photo', error, { event_id: eventId }, 'graceful_degrade');
    return NextResponse.json({ ok: !error, photo, tooSmall: posterPhotoTooSmall(photo) }, { status: error ? 500 : 200 });
  }

  if (piece === 'menu') {
    // The editor posts the whole menu as JSON; the parser drops anything unknown
    // and caps it, so what is stored is exactly what can print.
    // 🧭 Studio › Prints saves the menu AS YOU GO (owner "approved" 2026-10-13): the SAME post, quietly — asked with
    // `Accept: application/json`, the answer is `{ ok }` instead of the 303 (the words form's `SoftPost` rule, below).
    const quiet = (req.headers.get('accept') ?? '').includes('application/json');
    let raw: unknown = [];
    try {
      raw = JSON.parse(String(form.get('menu_json') ?? '[]'));
    } catch {
      raw = null;
    }
    if (!Array.isArray(raw)) {
      if (quiet) return NextResponse.json({ ok: false }, { status: 400 });
      back.searchParams.set('menu_error', '1');
      return NextResponse.redirect(back, 303);
    }
    const menu = parseMenu(raw);
    const error = said(await updatePrintDetails(admin, eventId, (now) => ({ ...now, menu })));
    if (error) logQueryError('hub-print.menu', error, { event_id: eventId }, 'graceful_degrade');
    if (quiet) return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
    if (error) back.searchParams.set('menu_error', '1');
    else back.searchParams.set('menu_saved', '1');
    back.hash = 'print-menu';
    return NextResponse.redirect(back, 303);
  }

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
        passCorners: form.get('pass_corners'),
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
  // Round-trip through the parser: what is stored is exactly what prints. The
  // menu is carried over untouched — it is the Menu editor's, not this form's.
  // …and so is the invite message (`invite_message`, the guest list's Send
  // invite wording) and the pass card's look (the Prints panel's) — neither
  // is this form's.
  //
  // 🔑 CARRY EVERYTHING THIS FORM DOES NOT OWN — by spreading what is stored
  // FIRST, never by naming each key: the list of carried keys (menu, message,
  // pass look) had already missed the poster's own photo, so a words save put
  // the A3 poster back to the theme's picture, silently. The words form owns
  // three things — the opening line, the reply line, the include toggles.
  const words = parsePrintDetails({ opening_line: form.get('opening_line'), rsvp, include });
  /* ⏳ THE OPENING LINE WAITS FOR APPLY IN THE MAKER (owner 2026-10-08, "draft 1-3"): the Maker's
     words form marks it (`opening_line_to_draft`), and the line goes into the hub DRAFT as ONE key of
     `print_details` (Apply merges it); the switches and the reply line on the same form stay live.
     The draft write is the couple's own session (the draft table's RLS is the fence). */
  const draftLine = form.get('opening_line_to_draft') === '1' && form.has('opening_line');
  if (draftLine) {
    try {
      await saveHubDraftPatch(eventId, { events: { print_details: { opening_line: words.openingLine } } });
    } catch (e) {
      logQueryError('hub-print.words.draft', { message: e instanceof Error ? e.message : String(e) } as never, { event_id: eventId }, 'graceful_degrade');
      if ((req.headers.get('accept') ?? '').includes('application/json')) return NextResponse.json({ ok: false }, { status: 500 });
      back.searchParams.set('print_error', '1');
      return NextResponse.redirect(back, 303);
    }
  }
  const error = said(
    await updatePrintDetails(admin, eventId, (now) => ({ ...now, openingLine: draftLine ? now.openingLine : words.openingLine, rsvp: words.rsvp, include: { ...words.include, passCorners: form.has('pass_corners') ? words.include.passCorners : now.include.passCorners } })),
  );
  if (error) logQueryError('hub-print.words', error, { event_id: eventId }, 'graceful_degrade');
  /* 🧷 The Maker saves this form IN PLACE (`launch/_components/soft-post.tsx`,
     owner 2026-09-28: *"it reloads the whole page. which shouldn't"*): asked
     for JSON, it gets the answer, not a 303 that reloads the whole document.
     A plain form post (no JavaScript) still comes back to the Maker. */
  if ((req.headers.get('accept') ?? '').includes('application/json')) {
    return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
  }
  if (error) back.searchParams.set('print_error', '1');
  else back.searchParams.set('print_saved', '1');
  return NextResponse.redirect(back, 303);
}
