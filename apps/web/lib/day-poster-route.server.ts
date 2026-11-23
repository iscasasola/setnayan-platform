import 'server-only';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { isStoreShellRequest } from '@/lib/request-platform';
import { loadPrintSet, printOwnsPro, readPrintEvent } from '@/lib/print-set.server';
import { layoutDayPosterDocs } from '@/lib/print-layout';
import { printLooksFor } from '@/lib/print-hub-look';
import type { PrintLook } from '@/lib/print-pieces';
import { flatDayPosterPdf } from '@/lib/day-poster-file';
import { renderPrintSvg } from '@/lib/print-render-svg';
import { renderPrintPdf } from '@/lib/print-drawers-on-demand';
import { bytesStream } from '@/lib/stream-file';
import { previewCacheControl } from '@/lib/print-preview-cache';
import { parsePrintDetails, printFileName, spotLayersFor } from '@/lib/print-pieces';
import { updatePrintDetails } from '@/lib/print-details-write';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { logQueryError } from '@/lib/supabase/error-detect';
import { printsPageHref } from '@/lib/prints-page-href';
import { PLAN_NAME } from '@/lib/plan-buy-doors';
import { dayPosterRefAllowed, readDayPosterPicks } from '@/lib/day-poster-photos.server';
import {
  DAY_POSTER_SIZES,
  DEFAULT_DAY_POSTER,
  dayPosterFileIsFlat,
  dayPosterFullQuality,
  dayPosterLock,
  dayPosterNotReady,
  dayPosterRefusal,
  parseDayPoster,
  type DayPoster,
  type DayPosterLook,
} from '@/lib/day-poster';
import type { PosterPhoto } from '@/lib/print-pieces';

/**
 * lib/day-poster-route.server.ts — 🖼 THE OUR DAY POSTER'S TWO DOORS ON `/api/hub-print/day-poster` (the shipped print
 * route hands over to these after its host gate — the poster adds no route and no server action):
 *
 *   GET  ?event=<id>&mode=screen&look=classic|theme&v=<hash> — the builder's preview: the SAVED record drawn as an SVG,
 *        addressed by a hash of it, so each change is a new cached picture.
 *   GET  ?event=<id>&mode=print&look=classic|theme — the file. 🔒 `dayPosterLock` decides, HERE, before anything is
 *        drawn: a locked size, style or look is a 403 even when asked for directly — hiding a button is never the lock.
 *        Free (no Event Pro): one flattened JPEG page at A4 ≈ 200 dpi in a PDF, no watermark (`DAY_POSTER_FREE_PX`);
 *        Event Pro: the poster at its size, vector type, the full-size photos, bleed and crop marks.
 *   POST event_id, record (JSON) [, finalize=1] — saves the builder's whole record into `print_details.day_poster`;
 *        every photo must be the couple's own upload or one Memories lists for this event (`dayPosterRefAllowed`).
 */

const plain = (s: string, status: number) => new NextResponse(s, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'private, no-store' } });

/** The event's own dates — the full-quality clock reads its last day. */
async function readEventDays(admin: ReturnType<typeof createAdminClient>, eventId: string): Promise<{ date: string | null; end: string | null } | null> {
  const { data, error } = await admin.from('events').select('event_date, event_end_date').eq('event_id', eventId).maybeSingle();
  if (error) {
    logQueryError('day-poster.event-days', error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  const r = (data ?? {}) as { event_date?: string | null; event_end_date?: string | null };
  return { date: r.event_date ?? null, end: r.event_end_date ?? null };
}

/**
 * The look a poster file wears. The event's own look (`set.look`: its Event Hub on paper for Event Pro, plain white
 * otherwise — the shipped door, `printLookForEvent`) for "Save in your theme ◆"; for "Save · Classic (PDF)" the free
 * print's plain look whatever the plan, keeping the plan's Setnayan mark (`brand`). The gate is `dayPosterLock`.
 */
function dayPosterLookFor(set: { look: PrintLook }, look: DayPosterLook): PrintLook {
  return look === 'classic' ? { ...printLooksFor('house', null).free, brand: set.look.brand } : set.look;
}

/**
 * `mode=picks` — what the builder needs once it is opened (never with the Prints page): every photo the couple may put
 * on the poster (`readDayPosterPicks`), a signed small copy of each photo already on the record, and the full-quality
 * date. `refused`: the Memories read was refused — the builder says "Couldn't read your Memories", never "no photos".
 */
async function dayPosterPicksJson(eventId: string): Promise<NextResponse> {
  const admin = createAdminClient();
  const [picks, event, days] = await Promise.all([readDayPosterPicks(admin, eventId), readPrintEvent(admin, eventId), readEventDays(admin, eventId)]);
  if (!event) return NextResponse.json({ ok: false }, { status: 404 });
  const record = parsePrintDetails(event.print_details).dayPoster ?? DEFAULT_DAY_POSTER;
  const listed = new Map(picks.picks.map((p) => [p.ref, p.thumbUrl]));
  const mine = [record.main, ...record.supporting].filter((p): p is PosterPhoto => Boolean(p));
  const signed: Record<string, string | null> = {};
  await Promise.all(mine.map(async (p) => (signed[p.ref] = listed.get(p.ref) ?? (await displayUrlForStoredAsset(p.ref, { ttlSeconds: 3600 }).catch(() => null)))));
  const quality = days ? dayPosterFullQuality(days.date, days.end, Date.now()) : null;
  return NextResponse.json(
    { ok: true, picks: picks.picks, refused: picks.refused, signed, quality, qualityRead: Boolean(days) },
    { headers: { 'cache-control': 'private, no-store' } },
  );
}

export async function dayPosterGet(url: URL, eventId: string): Promise<NextResponse> {
  if (url.searchParams.get('mode') === 'picks') return dayPosterPicksJson(eventId);
  const mode = url.searchParams.get('mode') === 'print' ? 'print' : 'screen';
  const asked: DayPosterLook = url.searchParams.get('look') === 'theme' ? 'theme' : 'classic';
  const admin = createAdminClient();
  const [ownsPro, storeShell, event, days] = await Promise.all([printOwnsPro(eventId), isStoreShellRequest(), readPrintEvent(admin, eventId), readEventDays(admin, eventId)]);
  if (!event) return plain('Event not found.', 404);
  const record: DayPoster = parsePrintDetails(event.print_details).dayPoster ?? DEFAULT_DAY_POSTER;
  const quality = days ? dayPosterFullQuality(days.date, days.end, Date.now()) : { until: null, ended: false };

  if (mode === 'screen') {
    // A theme preview is drawn only for an event that may save it; anyone else sees Classic (the builder shows the lock).
    const look: DayPosterLook = asked === 'theme' && ownsPro && !storeShell ? 'theme' : 'classic';
    const set = await loadPrintSet(eventId, { mode: 'screen', dayPoster: { record, look } });
    if (!set?.data.dayPoster) return plain('Event not found.', 404);
    const l = dayPosterLookFor(set, look);
    const [doc] = layoutDayPosterDocs({ look: l, data: set.data, mode: 'screen', foil: spotLayersFor(l.theme).foil });
    return new NextResponse(renderPrintSvg(doc!, set.images, { compact: true }), {
      status: 200,
      headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': previewCacheControl(url.searchParams.get('v')) },
    });
  }

  // ══ THE FILE — the gate first, before a photo is fetched.
  const lock = dayPosterLock({ ownsPro, storeShell, style: record.style, size: record.size, look: asked, fullQualityEnded: quality.ended });
  if (lock) return plain(dayPosterRefusal(lock, PLAN_NAME.pro, quality.until), 403);
  const notReady = dayPosterNotReady(record);
  if (notReady) return plain(notReady, 409);
  const set = await loadPrintSet(eventId, { mode: 'print', dayPoster: { record, look: asked } });
  const dp = set?.data.dayPoster;
  if (!set || !dp) return plain('Event not found.', 404);
  if (dp.missingPhotos) return plain('One of your photos could not be read just now. Please try again.', 503);
  if (dp.creditsFailed) return plain('We could not read your suppliers just now. Turn credits off, or try again.', 503);
  const l = dayPosterLookFor(set, asked);
  const spot = spotLayersFor(l.theme);
  const size = DAY_POSTER_SIZES[record.size];
  const title = `${set.event.display_name ?? 'Event'} — Our Day poster`;
  const file = printFileName(set.event.slug, `our-day-poster-${record.template}-${record.size}${asked === 'theme' ? '-theme' : ''}`);
  let bytes: Uint8Array;
  if (dayPosterFileIsFlat(ownsPro)) {
    const [doc] = layoutDayPosterDocs({ look: l, data: set.data, mode: 'sample', foil: false });
    bytes = (await flatDayPosterPdf(doc!, set.images, title)).pdf;
  } else {
    const docs = layoutDayPosterDocs({ look: l, data: set.data, mode: 'print', foil: spot.foil, whiteInk: spot.whiteInk });
    bytes = await renderPrintPdf(docs, set.images, {
      mode: 'print',
      title,
      subject: `${size.label}${size.style === 'canvas' ? ' · canvas, 2 in wrapped over the frame' : ''} · print-ready · 3 mm bleed · crop marks`,
    });
  }
  return new NextResponse(bytesStream(bytes), {
    status: 200,
    headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${file}"`, 'cache-control': 'private, no-store' },
  });
}

/** Measure a photo's pixels once, when it is first picked (the too-small warning reads them). Unreadable → null. */
async function measure(ref: string): Promise<{ w: number; h: number } | null> {
  try {
    const u = await displayUrlForStoredAsset(ref);
    const res = u ? await fetch(u, { signal: AbortSignal.timeout(10000) }) : null;
    if (!res?.ok) return null;
    const sharp = (await import('sharp')).default;
    const meta = await sharp(new Uint8Array(await res.arrayBuffer())).metadata();
    return meta.width && meta.height ? { w: meta.width, h: meta.height } : null;
  } catch {
    return null;
  }
}

export async function dayPosterPost(form: FormData, eventId: string): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get('record') ?? 'null'));
  } catch {
    return NextResponse.json({ ok: false, error: 'That did not save — nothing changed.' }, { status: 400 });
  }
  const finalize = form.get('finalize') === '1';
  const admin = createAdminClient();
  const asked = parseDayPoster(raw);
  const photos = [asked.main, ...asked.supporting].filter((p): p is PosterPhoto => Boolean(p));
  // Every photo is the couple's own upload for THIS event, or one Memories lists for it — read once, only when needed.
  const needsList = photos.some((p) => !dayPosterRefAllowed(p.ref, eventId, new Set()));
  const listed = needsList ? await readDayPosterPicks(admin, eventId, { sign: false }) : { picks: [], refused: false };
  if (needsList && listed.refused) return NextResponse.json({ ok: false, error: 'We could not check your photos just now. Please try again.' }, { status: 503 });
  const allowed = new Set(listed.picks.map((p) => p.ref));
  if (photos.some((p) => !dayPosterRefAllowed(p.ref, eventId, allowed))) return NextResponse.json({ ok: false, error: 'One of those photos is not from this event.' }, { status: 400 });
  // A photo picked for the first time is measured here (unknown sides never warn — `photoTooSmallFor`).
  const sized = async (p: PosterPhoto | null): Promise<PosterPhoto | null> => {
    if (!p || (p.w && p.h)) return p;
    const m = await measure(p.ref);
    return m ? { ref: p.ref, ...m } : p;
  };
  const [main, ...supporting] = await Promise.all([sized(asked.main), ...asked.supporting.map(sized)]);
  if (finalize) {
    const why = dayPosterNotReady({ ...asked, main: main ?? null });
    if (why) return NextResponse.json({ ok: false, error: why }, { status: 409 });
  }
  const record: DayPoster = {
    ...asked,
    main: main ?? null,
    supporting: supporting.filter((p): p is PosterPhoto => Boolean(p)),
    // A change after Finalize is a draft again until it is finalized again (drawing v4: "draft edits never reach guests").
    finalizedAt: finalize ? new Date().toISOString() : null,
  };
  const r = await updatePrintDetails(admin, eventId, (now) => ({ ...now, dayPoster: record }));
  if (!r.ok) {
    logQueryError('hub-print.day-poster', { message: r.error }, { event_id: eventId }, 'graceful_degrade');
    return NextResponse.json({ ok: false, error: 'That did not save — your poster is as it was.' }, { status: 500 });
  }
  revalidatePath(printsPageHref(eventId));
  return NextResponse.json({ ok: true, record: r.details.dayPoster ?? record });
}

