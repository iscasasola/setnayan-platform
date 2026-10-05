import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getHostUserId } from '@/lib/host-gate';
import { isStoreShellRequest } from '@/lib/request-platform';
import { loadGuestPasses, loadPrintSet, printInputsVersion, printOwnsPro, printThemeFor, readPrintEvent } from '@/lib/print-set.server';
import { PRINT_VERSION_HEADER } from '@/lib/printed-stamp';
import { resolveEventQrLook } from '@/lib/qr-look.server';
import { layoutPasses, layoutPieceDocs, layoutPieceView, layoutQrCodes, type PrintDoc, type PrintImages, type PrintSetData } from '@/lib/print-layout';
import { PASS_CARD_DESIGNS, passCardDesignFrom } from '@/lib/pass-card';
import { layoutGuestRegistry, registryDate, registryRows } from '@/lib/print-guest-registry';
import { fetchGuestsByEventMeasured } from '@/lib/guests';
import { fetchAssignments, fetchTables } from '@/lib/seating';
import { FREE_THEMES, INVITE_THEMES, themeNames, type InviteThemeId } from '@/lib/invite-themes';
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
  isProPrint,
  isThemedPrint,
  mayServe,
  menuHasDishes,
  parseMenu,
  parsePrintDetails,
  printAccess,
  storyHasMoments,
  printFileName,
  serializePrintDetails,
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
import { sampleView } from '@/lib/print-sample-door.server';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { readHubDraft } from '@/lib/hub-draft-store';
import type { HubDraftEvents } from '@/lib/hub-draft';
import { printDraftOf } from '@/lib/ceremony-time';

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

function pdfResponse(bytes: Uint8Array, name: string, inline: boolean, version: string | null = null): NextResponse {
  return new NextResponse(Buffer.from(bytes), {
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

export async function GET(req: Request, ctx: { params: Promise<{ piece: string }> }) {
  const { piece: rawPiece } = await ctx.params;
  const url = new URL(req.url);
  if (url.searchParams.get('sample') === '1') return sampleView(rawPiece, url);
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
        // The free QR sheet wears the event's look too — the Setnayan mark, or
        // the couple's own on Event Hub Pro (lib/qr-look.ts).
        qrLook: await resolveEventQrLook(admin, eventId, event),
      };
      const loaded = await loadGuestPasses(set, { width: thumb ? 160 : 420, limit: thumb ? 12 : undefined });
      if (!loaded.measured) return new NextResponse('We could not read your guest list just now. Please try again.', { status: 503 });
      images = loaded.images;
      docs = layoutQrCodes(
        event.display_name ?? 'Guest QR codes',
        loaded.passes.map((p) => ({ name: p.name, sub: p.seat, qrRef: p.qrRef! })),
        set.qrLook.shape,
      );
      subject = `${formatCount(loaded.passes.length)} guests`;
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
      subject = `${rows.filter((r) => r.counted).length} guests`;
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
          : `The print-ready file in ${INVITE_THEMES[theme].name} comes with Event Hub Pro. ${themeNames(FREE_THEMES)} prints are free.`,
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
    if (mode === 'screen') {
      /* 🎫 THE REAL TICKET (owner 2026-10-05, "isn't this the digital pass?"):
         `pass_guest=first` draws the first guest who is coming — their name and
         their own QR — instead of the stand-in, for the Maker's Guest's ticket
         scene. One guest is read (`limit: 1`); none yet → the stand-in. */
      const guestPass =
        piece === 'pass' && url.searchParams.get('pass_guest') === 'first'
          ? await loadGuestPasses(set, { width: 360, limit: 1, ticketsOnly: true }).catch(() => null)
          : null;
      const firstPass = guestPass?.passes[0];
      const view = layoutPieceView(piece as PrintSetKey, { ...input, format: formatParam(piece), ...(firstPass ? { pass: firstPass } : {}) });
      const svg = renderPrintSvg(view, firstPass ? { ...set.images, ...guestPass!.images } : set.images, { compact: true });
      return new NextResponse(svg, {
        status: 200,
        // ⚡ A VERSIONED ADDRESS IS IMMUTABLE (owner 2026-09-28: the
        // boarding-pass preview took ~8 s). The Maker names every input this
        // picture is drawn from in `v` (`printInputsVersion`), so the same
        // address can only ever mean the same picture — a year, `immutable`.
        // Without a `v`, the old 60 s + `stale-while-revalidate` (a couple
        // flipping between theme chips paints the last render instantly).
        headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': previewCacheControl(url.searchParams.get('v')), ...fieldsHeader(view) },
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
  if (!current) {
    back.searchParams.set(piece === 'menu' ? 'menu_error' : 'print_error', '1');
    return NextResponse.redirect(back, 303);
  }
  const stored = parsePrintDetails(current.print_details);

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
    const { error } = await admin
      .from('events')
      .update({ print_details: serializePrintDetails({ ...stored, nameStyle: nameStyleFrom(asked) }) })
      .eq('event_id', eventId);
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
      const { error } = await admin.from('events').update({ print_details: serializePrintDetails({ ...stored, posterPhoto: null }) }).eq('event_id', eventId);
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
    const { error } = await admin.from('events').update({ print_details: serializePrintDetails({ ...stored, posterPhoto: photo }) }).eq('event_id', eventId);
    if (error) logQueryError('hub-print.poster-photo', error, { event_id: eventId }, 'graceful_degrade');
    return NextResponse.json({ ok: !error, photo, tooSmall: posterPhotoTooSmall(photo) }, { status: error ? 500 : 200 });
  }

  if (piece === 'menu') {
    // The editor posts the whole menu as JSON; the parser drops anything unknown
    // and caps it, so what is stored is exactly what can print.
    let raw: unknown = [];
    try {
      raw = JSON.parse(String(form.get('menu_json') ?? '[]'));
    } catch {
      raw = null;
    }
    if (!Array.isArray(raw)) {
      back.searchParams.set('menu_error', '1');
      return NextResponse.redirect(back, 303);
    }
    const { error } = await admin
      .from('events')
      .update({ print_details: serializePrintDetails({ ...stored, menu: parseMenu(raw) }) })
      .eq('event_id', eventId);
    if (error) {
      logQueryError('hub-print.menu', error, { event_id: eventId }, 'graceful_degrade');
      back.searchParams.set('menu_error', '1');
    } else back.searchParams.set('menu_saved', '1');
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
  const details = { ...stored, openingLine: words.openingLine, rsvp: words.rsvp, include: words.include };

  const { error } = await admin
    .from('events')
    .update({ print_details: serializePrintDetails(details) })
    .eq('event_id', eventId);
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
