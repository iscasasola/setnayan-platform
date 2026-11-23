import sharp from 'sharp';
import { printLookFor, spotLayersFor } from '@/lib/print-pieces';
import { layoutDayPosterDocs, type PrintImages, type PrintSetData } from '@/lib/print-layout';
import { renderPrintSvg } from '@/lib/print-render-svg';
import { renderEventLandingQrPng } from '@/lib/qr';
import { FREE_QR_LOOK } from '@/lib/qr-look';
import { flatDayPosterPdf } from '@/lib/day-poster-file';
import {
  DEFAULT_DAY_POSTER,
  DAY_POSTER_TEMPLATES,
  dayPosterFileIsFlat,
  dayPosterLock,
  dayPosterNotReady,
  dayPosterRefusal,
  drawnSupporting,
  parseDayPoster,
  serializeDayPoster,
  type DayPoster,
  type DayPosterLook,
} from '@/lib/day-poster';
import { PLAN_NAME } from '@/lib/plan-buy-doors';
import { LAB_BASE, LAB_CREDITS, LAB_GROUPS, LAB_LINE, LAB_PHOTOS, labData, labRef } from '../fixture';

/**
 * 🧪 THE OUR DAY POSTER LAB'S STAND-IN FOR `/api/hub-print/day-poster` (DEV-ONLY). The SAME layout
 * (`layoutDayPosterDocs`), the SAME gate (`dayPosterLock`) and the SAME two file writers (`flatDayPosterPdf` for a free
 * event, `renderPrintPdf` for Pro) — on the lab's sample event instead of the database, with no sign-in. EXACTLY what it
 * fakes: the event (fixture.ts), the photos (drawn here), the record's home (this server's memory), and the plan and the
 * date (`?pro=1`, `?after=1` on the lab's address, read from each request's referrer).
 */
let record: DayPoster = { ...DEFAULT_DAY_POSTER };

function flags(req: Request): { pro: boolean; after: boolean } {
  // The lab page's own address names the view (`?pro=1`, `?after=1`); every request from it carries that address.
  const ref = req.headers.get('referer');
  const q = ref ? new URL(ref).searchParams : new URLSearchParams();
  return { pro: q.get('pro') === '1', after: q.get('after') === '1' };
}

const HUES = [28, 200, 340, 95, 15, 260, 160, 45, 300, 120, 220, 5, 75, 180, 250];
async function photo(i: number, w = 900, h = 1200): Promise<Uint8Array> {
  const a = HUES[i % HUES.length]!;
  const b = (a + 140) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${a},55%,78%)"/><stop offset="0.6" stop-color="hsl(${(a + 40) % 360},35%,58%)"/><stop offset="1" stop-color="hsl(${b},30%,32%)"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><circle cx="${w * 0.44}" cy="${h * 0.5}" r="${w * 0.08}" fill="#f4efe6"/><circle cx="${w * 0.56}" cy="${h * 0.48}" r="${w * 0.07}" fill="#2a2522"/><ellipse cx="${w * 0.46}" cy="${h * 0.72}" rx="${w * 0.12}" ry="${h * 0.15}" fill="#efe8dc"/><ellipse cx="${w * 0.57}" cy="${h * 0.73}" rx="${w * 0.11}" ry="${h * 0.15}" fill="#26211e"/></svg>`;
  return new Uint8Array(await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer());
}
const indexOf = (ref: string) => Number(/photo-(\d+)\.jpg$/.exec(ref)?.[1] ?? -1);

async function set(r: DayPoster): Promise<{ data: PrintSetData; images: PrintImages }> {
  const images: PrintImages = {
    eventqr: { bytes: new Uint8Array(await renderEventLandingQrPng({ appUrl: 'https://setnayan.com', slug: 'maria-and-jose', ownerSlug: null, look: FREE_QR_LOOK, width: 600 })), mime: 'image/png' },
  };
  const sup = drawnSupporting(r);
  if (r.main) images['dp-main'] = { bytes: await photo(indexOf(r.main.ref)), mime: 'image/jpeg' };
  await Promise.all(sup.map(async (p, i) => (images[`dp-${i}`] = { bytes: await photo(indexOf(p.ref)), mime: 'image/jpeg' })));
  const t = DAY_POSTER_TEMPLATES[r.template];
  return {
    images,
    data: {
      ...labData(),
      dayPoster: {
        record: r,
        main: r.main ? 'dp-main' : null,
        supporting: sup.map((_, i) => `dp-${i}`),
        line: r.show.line ? r.line ?? LAB_LINE : null,
        place: r.show.place ? 'The Ridge, Tagaytay' : null,
        credits: r.show.credits ? LAB_CREDITS : [],
        groups: t.rolls && (r.show.sponsors || r.show.entourage) ? LAB_GROUPS : [],
      },
    },
  };
}

export async function GET(req: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') return new Response('Not found', { status: 404 });
  const url = new URL(req.url);
  const { pro, after } = flags(req);
  const img = url.searchParams.get('img');
  if (img !== null) return new Response(Buffer.from(await photo(Number(img), 240, 320)), { headers: { 'content-type': 'image/jpeg', 'cache-control': 'no-store' } });
  const mode = url.searchParams.get('mode');
  if (mode === 'picks') {
    const picks = Array.from({ length: LAB_PHOTOS }, (_, i) => ({ ref: labRef(i), thumbUrl: `${LAB_BASE}?img=${i}`, source: i % 5 === 4 ? 'supplier' : 'memories', full: !after }));
    const signed = Object.fromEntries([record.main, ...record.supporting].filter(Boolean).map((p) => [p!.ref, `${LAB_BASE}?img=${indexOf(p!.ref)}`]));
    return Response.json({ ok: true, picks, refused: false, signed, quality: { until: 'Mar 13, 2027', ended: after }, qualityRead: true });
  }
  const look: DayPosterLook = url.searchParams.get('look') === 'theme' ? 'theme' : 'classic';
  const lookFor = (l: DayPosterLook) => printLookFor(l === 'theme' && pro ? 'vintage' : 'house');
  if (mode === 'screen') {
    const { data, images } = await set(record);
    const l = lookFor(look);
    const [doc] = layoutDayPosterDocs({ look: l, data, mode: 'screen', foil: spotLayersFor(l.theme).foil });
    return new Response(renderPrintSvg(doc!, images, { compact: true }), { headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'no-store' } });
  }
  const lock = dayPosterLock({ ownsPro: pro, storeShell: false, style: record.style, size: record.size, look, fullQualityEnded: after });
  if (lock) return new Response(dayPosterRefusal(lock, PLAN_NAME.pro, 'Mar 13, 2027'), { status: 403 });
  const why = dayPosterNotReady(record);
  if (why) return new Response(why, { status: 409 });
  const { data, images } = await set(record);
  const l = lookFor(look);
  const spot = spotLayersFor(l.theme);
  let bytes: Uint8Array;
  if (dayPosterFileIsFlat(pro)) {
    const [doc] = layoutDayPosterDocs({ look: l, data, mode: 'sample', foil: false });
    bytes = (await flatDayPosterPdf(doc!, images, 'Maria & Jose — Our Day poster')).pdf;
  } else {
    const { renderPrintPdf } = await import('@/lib/print-render-pdf');
    bytes = await renderPrintPdf(layoutDayPosterDocs({ look: l, data, mode: 'print', foil: spot.foil, whiteInk: spot.whiteInk }), images, { mode: 'print', title: 'Maria & Jose — Our Day poster' });
  }
  return new Response(Buffer.from(bytes), { headers: { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="maria-and-jose-our-day-poster.pdf"' } });
}

export async function POST(req: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'production') return new Response('Not found', { status: 404 });
  const form = await req.formData();
  const next = parseDayPoster(JSON.parse(String(form.get('record') ?? 'null')));
  const finalize = form.get('finalize') === '1';
  if (finalize && dayPosterNotReady(next)) return Response.json({ ok: false, error: dayPosterNotReady(next) }, { status: 409 });
  record = { ...next, finalizedAt: finalize ? new Date().toISOString() : null };
  return Response.json({ ok: true, record: serializeDayPoster(record) });
}
