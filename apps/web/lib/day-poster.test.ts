/**
 * 🖼 THE OUR DAY POSTER — its rules, held (owner 2026-11-13, DECISION_LOG "OUR DAY POSTER" rows; approved drawing v4,
 * `prototypes/approved_2026-11-13/our-day-poster-fable.html`):
 *   · six templates with the approved photo ranges; sponsors and the entourage only on Collage and Words + one photo;
 *     Collage the photo print's default, One photo the canvas's; supplier credits off to start; the QR always;
 *   · two size lists (eight photo-print sizes, five canvas); A4 Classic saves free, everything else is Event Pro, and
 *     after the full-quality date every size above A4 locks — one rule, the route refuses with it;
 *   · the free file never has more pixels than A4 at 200 dpi;
 *   · EVERY NAME FITS: 40 principal sponsors and an 80-name entourage at every size of every template, both styles,
 *     with 1 to 16 photos — never cut, never under the floor, never off the safe area, never on the QR;
 *   · it is a post-event piece: never in the before-the-day set, its whole-set file or Everything ◆.
 *
 * Run from apps/web: `npx tsx --test lib/day-poster.test.ts`
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { stripComments } from '@/lib/strip-comments';
import { buildEntourage, type EntourageGuestRow } from './entourage';
import { POST_EVENT_PRINT_KEYS, PRINT_PIECES, PRINT_SET_KEYS, SAFE_MM, PT_PER_MM, isAllInOnePrint, parsePrintDetails, printLookFor, serializePrintDetails } from './print-pieces';
import { PRINT_MIN_BODY_PT, layoutDayPosterDocs, type PrintDoc, type PrintImages, type PrintOp, type PrintSetData } from './print-layout';
import {
  CANVAS_MIN_BODY_PT,
  CANVAS_WRAP_MM,
  DAY_POSTER_FREE_PX,
  DAY_POSTER_SIZES,
  DAY_POSTER_TEMPLATES,
  DAY_POSTER_TEMPLATE_KEYS,
  DEFAULT_DAY_POSTER,
  DEFAULT_DAY_POSTER_SHOW,
  DEFAULT_DAY_POSTER_TEMPLATE,
  dayPosterFullQuality,
  dayPosterHash,
  dayPosterLock,
  dayPosterNotReady,
  dayPosterSizesFor,
  parseDayPoster,
  serializeDayPoster,
  sizesForTemplate,
  type DayPosterLook,
  type DayPosterSizeId,
  type DayPosterStyle,
  type DayPosterTemplateKey,
} from './day-poster';
import { flatDayPosterPdf } from './day-poster-file';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const E = '0e6a4f2c-1b2d-4c3e-8f9a-0b1c2d3e4f50';

/* ── the approved registry ─────────────────────────────────────────────────────────────────────────────────────── */

test('six templates, the approved ranges, rolls only on Collage and Words + one photo', () => {
  assert.deepEqual([...DAY_POSTER_TEMPLATE_KEYS], ['one-photo', 'collage', 'film-strip', 'magazine', 'three-moments', 'words']);
  const range = (k: DayPosterTemplateKey) => [DAY_POSTER_TEMPLATES[k].min, DAY_POSTER_TEMPLATES[k].max];
  assert.deepEqual(range('collage'), [4, 16]);
  assert.deepEqual(range('film-strip'), [3, 8]);
  assert.deepEqual(range('magazine'), [0, 3]);
  assert.deepEqual(range('three-moments'), [2, 2]);
  assert.deepEqual(range('words'), [0, 2]);
  assert.deepEqual(range('one-photo'), [0, 0]);
  const rolls = DAY_POSTER_TEMPLATE_KEYS.filter((k) => DAY_POSTER_TEMPLATES[k].rolls);
  assert.deepEqual(rolls, ['collage', 'words'], 'sponsors and the entourage print on Collage and Words + one photo only');
  for (const k of rolls) assert.deepEqual(DAY_POSTER_TEMPLATES[k].styles, ['photo'], `${k}: a name-roll template is photo print only`);
  assert.equal(DEFAULT_DAY_POSTER_TEMPLATE.photo, 'collage');
  assert.equal(DEFAULT_DAY_POSTER_TEMPLATE.canvas, 'one-photo');
  assert.equal(DEFAULT_DAY_POSTER_SHOW.credits, false, 'supplier credits start off');
  assert.ok(!('qr' in DEFAULT_DAY_POSTER_SHOW), 'the QR is a switch — it is always printed');
  // Words + one photo: A2 and larger.
  assert.deepEqual(sizesForTemplate(DAY_POSTER_TEMPLATES.words, 'photo').map((s) => s.id), ['a2', 'p20x24', 'p20x30', 'a1', 'p24x30']);
});

test('two size lists — eight photo-print sizes (A4 free first), five canvas sizes', () => {
  assert.deepEqual(dayPosterSizesFor('photo').map((s) => s.id), ['a4', 'a3plus', 'p16x20', 'a2', 'p20x24', 'p20x30', 'a1', 'p24x30']);
  assert.deepEqual(dayPosterSizesFor('canvas').map((s) => s.id), ['c11x14', 'c12x18', 'c14x17', 'c16x20', 'c20x24']);
  assert.equal(Math.round(DAY_POSTER_SIZES.a4.wMm), 210);
  assert.equal(Math.round(DAY_POSTER_SIZES.a1.hMm), 841);
});

/* ── the one gate ─────────────────────────────────────────────────────────────────────────────────────────────── */

test('A4 Classic saves free; every larger size, every canvas and the theme look are Event Pro; the store shell keeps the free file', () => {
  const lock = (o: Partial<Parameters<typeof dayPosterLock>[0]>) =>
    dayPosterLock({ ownsPro: false, storeShell: false, style: 'photo', size: 'a4', look: 'classic', fullQualityEnded: false, ...o });
  assert.equal(lock({}), null, 'A4 Classic is not free');
  assert.equal(lock({ storeShell: true }), null, 'the store shell lost the free file');
  for (const s of dayPosterSizesFor('photo').filter((x) => x.id !== 'a4')) assert.equal(lock({ size: s.id }), 'pro-size', `${s.id} is free`);
  for (const s of dayPosterSizesFor('canvas')) assert.equal(lock({ style: 'canvas', size: s.id }), 'pro-canvas', `${s.id} canvas is free`);
  assert.equal(lock({ look: 'theme' }), 'pro-look', 'the theme look is free');
  assert.equal(lock({ size: 'a2', storeShell: true }), 'store', 'the store shell offers a Pro file');
  // With Event Pro everything opens…
  for (const s of Object.values(DAY_POSTER_SIZES)) for (const look of ['classic', 'theme'] as DayPosterLook[]) {
    assert.equal(lock({ ownsPro: true, style: s.style, size: s.id, look }), null, `${s.id} ${look} is locked for a Pro event`);
  }
  // …until the full-size photos are gone: every size above A4 locks, Pro or not; A4 stays.
  assert.equal(lock({ ownsPro: true, size: 'a1', fullQualityEnded: true }), 'kept');
  assert.equal(lock({ ownsPro: true, style: 'canvas', size: 'c16x20', fullQualityEnded: true }), 'kept');
  assert.equal(lock({ ownsPro: true, size: 'a4', look: 'theme', fullQualityEnded: true }), null);
  assert.equal(lock({ fullQualityEnded: true }), null, 'the free A4 locked after the date');
});

test('the full-quality date is the shipped clock: 92 days after the last day', () => {
  // Last day 12 Dec 2026 → originals kept through 13 Mar 2027 (`originalsKeptUntil` is the first drop day).
  const before = dayPosterFullQuality('2026-12-12', null, Date.parse('2027-01-10T04:00:00Z'));
  assert.equal(before.ended, false);
  assert.match(before.until ?? '', /Mar 13, 2027|13 Mar 2027/);
  const after = dayPosterFullQuality('2026-12-12', null, Date.parse('2027-04-01T04:00:00Z'));
  assert.equal(after.ended, true);
  assert.match(after.until ?? '', /Mar 13, 2027|13 Mar 2027/);
  // An end date moves the clock.
  assert.match(dayPosterFullQuality('2026-12-12', '2026-12-14', Date.parse('2027-01-10T04:00:00Z')).until ?? '', /Mar 15, 2027|15 Mar 2027/);
  assert.deepEqual(dayPosterFullQuality(null, null, Date.now()), { until: null, ended: false }, 'no date → no clock, never a guess');
});

test('the route refuses with the same rule, before a photo is fetched; the save takes only this event’s photos', () => {
  const route = read('lib/day-poster-route.server.ts');
  const file = route.slice(route.indexOf('export async function dayPosterGet'));
  const lockAt = file.indexOf('const lock = dayPosterLock(');
  const loadAt = file.indexOf("loadPrintSet(eventId, { mode: 'print'");
  assert.ok(lockAt > 0, 'the file route does not ask dayPosterLock');
  assert.ok(loadAt > lockAt, 'the lock is asked after the photos are fetched');
  assert.match(file, /if \(lock\) return plain\(dayPosterRefusal\(lock, PLAN_NAME\.pro, quality\.until\), 403\);/);
  assert.match(route, /if \(photos\.some\(\(p\) => !dayPosterRefAllowed\(p\.ref, eventId, allowed\)\)\) return NextResponse\.json/);
  assert.match(route, /if \(dayPosterFileIsFlat\(ownsPro\)\)/, 'a free event got the crisp file');
  const hub = read('app/api/hub-print/[piece]/route.ts');
  assert.ok(hub.indexOf('if (rawPiece === DAY_POSTER_KEY) return dayPosterGet(url, eventId);') > hub.indexOf('const g = await gate('), 'the poster is served before the host gate');
  assert.ok(hub.indexOf('if (piece === DAY_POSTER_KEY) return dayPosterPost(form, eventId);') > hub.indexOf("const g = await gate(String(form.get('event_id')"), 'the poster saves before the host gate');
});

/* ── the record ───────────────────────────────────────────────────────────────────────────────────────────────── */

test('the record round-trips; an untouched event stores no day_poster; every other save carries it', () => {
  const ref = (n: number) => `r2://setnayan-media/events/${E}/poster/${n}.jpg`;
  const raw = {
    template: 'film-strip',
    main: { ref: ref(0), w: 4000, h: 6000 },
    supporting: [1, 2, 3, 1, 4].map((n) => ({ ref: ref(n), w: null, h: null })),
    show: { credits: true, sponsors: false },
    line: '  We planned this for a year,   and it went by in an afternoon. ',
    style: 'photo',
    size: 'a2',
    finalized_at: '2026-12-20T03:00:00.000Z',
  };
  const d = parseDayPoster(raw);
  assert.equal(d.template, 'film-strip');
  assert.deepEqual(d.supporting.map((p) => p.ref), [ref(1), ref(2), ref(3), ref(4)], 'a doubled photo survived');
  assert.equal(d.show.credits, true);
  assert.equal(d.show.sponsors, false);
  assert.equal(d.line, 'We planned this for a year, and it went by in an afternoon.');
  assert.deepEqual(parseDayPoster(serializeDayPoster(d)), d);
  // A template that cannot take the style, or a size from the other list, falls back — never a mismatched pair.
  assert.equal(parseDayPoster({ template: 'collage', style: 'canvas' }).template, 'one-photo');
  assert.equal(parseDayPoster({ style: 'canvas', size: 'a2' }).size, 'c11x14');
  assert.equal(parseDayPoster({ template: 'words', size: 'a4' }).size, 'a2', 'Words + one photo drawn at A4');
  assert.equal(parseDayPoster({ main: { ref: 'https://evil.example/a.jpg' } }).main, null);
  // print_details: absent stays absent; a words save carries the poster.
  assert.equal('day_poster' in serializePrintDetails(parsePrintDetails({ opening_line: 'Hi' })), false, 'every event now stores an empty poster');
  const stored = parsePrintDetails({ opening_line: 'Hi', day_poster: raw });
  const afterWords = parsePrintDetails(serializePrintDetails({ ...stored, openingLine: 'Hello' }));
  assert.deepEqual(afterWords.dayPoster, d, 'a words save erased the poster');
  // Never saved with an empty photo box.
  assert.match(dayPosterNotReady({ ...DEFAULT_DAY_POSTER }) ?? '', /main photo/);
  assert.match(dayPosterNotReady({ ...DEFAULT_DAY_POSTER, main: d.main, supporting: d.supporting.slice(0, 2) }) ?? '', /needs 4/);
  assert.equal(dayPosterNotReady({ ...d, template: 'magazine' }), null);
  // The preview address is the cache's shape (16 hex) and moves with every choice.
  assert.match(dayPosterHash(d, 'x'), /^[0-9a-f]{16}$/);
  assert.notEqual(dayPosterHash(d, 'x'), dayPosterHash({ ...d, size: 'a1' }, 'x'));
});

test('a post-event piece: never in the before-the-day set, its whole-set file or Everything ◆', () => {
  assert.deepEqual([...POST_EVENT_PRINT_KEYS], ['day-poster']);
  assert.ok(!(PRINT_SET_KEYS as readonly string[]).includes('day-poster'));
  assert.equal(PRINT_PIECES['day-poster'].label, 'Our Day poster');
  assert.equal(isAllInOnePrint('day-poster', 'print'), false, 'the poster is gated as an all-in-one file');
});

/* ── every name fits ──────────────────────────────────────────────────────────────────────────────────────────── */

const FIRST = ['Nene', 'Hernan', 'Ofelia', 'Corazon', 'Jun', 'Queenie', 'Elvie', 'Lito', 'Susan', 'Gloria', 'Nestor', 'Ben', 'Imelda', 'Pepito', 'Danilo', 'Kristina'];
const LAST = ['Reyes', 'Aquino', 'Flores', 'Navarro', 'Ramos', 'Villaseñor-Castañeda', 'Zamora', 'Lim', 'Bautista', 'Garcia', 'Ocampo', 'Salazar', 'Dimaculangan'];
let serial = 0;
function person(role: string, title: string | null = null): EntourageGuestRow {
  serial += 1;
  return { guest_id: `g-${serial}`, march: null, name_prefix: title, first_name: FIRST[serial % FIRST.length]!, middle_name: null, last_name: LAST[(serial * 7) % LAST.length]!, name_suffix: serial % 9 === 0 ? 'Jr.' : null, role } as EntourageGuestRow;
}
/** A real wedding, sized up (DECISION_LOG "SIZED TO A REAL WEDDING"): 40 principal sponsors + an 80-name entourage. */
function wedding(): ReturnType<typeof buildEntourage> {
  const rows: EntourageGuestRow[] = [];
  for (const r of ['groom_parents', 'groom_parents', 'bride_parents', 'bride_parents']) rows.push(person(r));
  rows.push(person('maid_of_honor'), person('maid_of_honor'), person('best_man'));
  for (let i = 0; i < 40; i += 1) rows.push(person(i % 2 ? 'principal_sponsor_ninang' : 'principal_sponsor_ninong', i % 2 ? 'Mrs.' : 'Hon.'));
  for (const r of ['candle_sponsor', 'candle_sponsor', 'veil_sponsor', 'veil_sponsor', 'cord_sponsor', 'cord_sponsor']) rows.push(person(r));
  for (let i = 0; i < 16; i += 1) rows.push(person('bridesmaid'));
  for (let i = 0; i < 16; i += 1) rows.push(person('groomsman'));
  for (let i = 0; i < 12; i += 1) rows.push(person('groom_immediate_family'));
  for (let i = 0; i < 12; i += 1) rows.push(person('bride_immediate_family'));
  for (const r of ['ring_bearer', 'bible_bearer', 'coin_bearer', 'ring_bearer', 'flower_girl', 'flower_girl', 'flower_girl', 'flower_girl', 'flower_girl', 'flower_girl', 'flower_girl']) rows.push(person(r));
  return buildEntourage(rows);
}
const GROUPS = wedding();
const countNames = GROUPS.reduce((a, g) => a + g.rows.reduce((b, [l, r]) => b + (l ? 1 : 0) + (r ? 1 : 0), 0), 0);

function data(template: DayPosterTemplateKey, style: DayPosterStyle, size: DayPosterSizeId, photos: number): PrintSetData {
  const record = { ...parseDayPoster({ template, style, size, show: { credits: true } }), main: { ref: 'r2://x/m', w: null, h: null } };
  return {
    names: { first: 'Maria Clarissa Isabel', second: 'Juan Indalecio Ramon' },
    eyebrow: 'The wedding of',
    dateLabel: 'Saturday · December 12, 2026',
    ceremonyTime: null,
    ceremonyVenue: null,
    receptionTime: null,
    receptionVenue: null,
    monogram: null,
    initials: 'M & J',
    details: { parents: [], openingLine: null, rsvpContact: null, giftLines: [] },
    entourage: [],
    attire: [],
    swatches: [],
    hubAddress: null,
    hasStill: false,
    hasEventQr: true,
    dayPoster: {
      record,
      main: 'dp-main',
      supporting: Array.from({ length: Math.min(photos, DAY_POSTER_TEMPLATES[template].max) }, (_, i) => `dp-${i}`),
      line: 'We planned this for a year, and it went by in an afternoon — thank you for being there with us.',
      place: 'Santuario de San Vicente de Paul Parish, Tagaytay Highlands',
      credits: ['The Ridge Events Place', 'Liwanag Studio', 'Kusina ni Rosa Catering', 'Talulot Florals', 'Ganda by Bea', 'Emcee Migs', 'Tunog Band'],
      groups: DAY_POSTER_TEMPLATES[template].rolls ? GROUPS : [],
    },
  };
}

type Box = { x: number; y: number; w: number; h: number };
const meet = (a: Box, b: Box) => a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01;

/** Every problem on one sheet: text past the face's safe area, under the floor, on the QR, or on a photo it does not caption. */
function problems(doc: PrintDoc, where: string, canvas: boolean, magazine: boolean): string[] {
  const out: string[] = [];
  const wrap = canvas ? CANVAS_WRAP_MM * PT_PER_MM : 0;
  const s = SAFE_MM * PT_PER_MM;
  const safe: Box = { x: wrap + s, y: wrap + s, w: doc.w - 2 * wrap - 2 * s, h: doc.h - 2 * wrap - 2 * s };
  const floor = canvas ? CANVAS_MIN_BODY_PT : PRINT_MIN_BODY_PT;
  const qr = doc.ops.find((o): o is Extract<PrintOp, { t: 'image' }> => o.t === 'image' && o.ref === 'eventqr');
  if (!qr) out.push(`${where}: no QR`);
  const photos = doc.ops.filter((o): o is Extract<PrintOp, { t: 'image' }> => o.t === 'image' && o.ref.startsWith('dp-'));
  if (doc.overflow) out.push(`${where}: the layout says it overflowed`);
  for (const o of doc.ops) {
    if (o.t !== 'path' || !o.text?.box || o.brand) continue;
    const b = o.text.box;
    const inside = b.x >= safe.x - 0.5 && b.y >= safe.y - 0.5 && b.x + b.w <= safe.x + safe.w + 0.5 && b.y + b.h <= safe.y + safe.h + 0.5;
    if (!inside) out.push(`${where}: "${o.text.s.slice(0, 30)}" leaves the safe area`);
    if (o.text.size < floor - 0.01) out.push(`${where}: "${o.text.s.slice(0, 30)}" at ${o.text.size.toFixed(2)} pt, under the ${floor} pt floor`);
    if (qr && meet(b, { x: qr.x - 3, y: qr.y - 3, w: qr.w + 6, h: qr.h + 6 })) out.push(`${where}: "${o.text.s.slice(0, 30)}" touches the QR`);
    if (!magazine) for (const p of photos) if (meet(b, p)) out.push(`${where}: "${o.text.s.slice(0, 30)}" sits on a photo`);
  }
  // Photos never overlap one another.
  // (A magazine cover's moments are framed ON its cover photo, by design.)
  for (let i = 0; i < photos.length; i += 1) for (let j = i + 1; j < photos.length; j += 1) if (!(magazine && photos[i]!.ref === 'dp-main') && meet(photos[i]!, photos[j]!)) out.push(`${where}: photos ${photos[i]!.ref} and ${photos[j]!.ref} overlap`);
  return out;
}

test('every template, every size it takes, both styles: 40 sponsors and an 80-name entourage fit, with 1 to 16 photos', () => {
  assert.ok(countNames >= 120, `the probe wedding has ${countNames} names, not ≥ 120`);
  const look = printLookFor('house');
  const all: string[] = [];
  let drawn = 0;
  for (const k of DAY_POSTER_TEMPLATE_KEYS) {
    const t = DAY_POSTER_TEMPLATES[k];
    for (const style of t.styles) {
      for (const size of sizesForTemplate(t, style)) {
        const counts = t.max === 0 ? [0] : [...new Set([t.min, Math.ceil((t.min + t.max) / 2), t.max, ...(k === 'collage' ? [5, 7, 9, 13] : [])])];
        for (const n of counts) {
          const docs = layoutDayPosterDocs({ look, data: data(k, style, size.id, n), mode: 'print', foil: false });
          assert.equal(docs.length, 1, `${k} ${size.id}: one sheet`);
          const doc = docs[0]!;
          drawn += 1;
          const wrap = style === 'canvas' ? 2 * CANVAS_WRAP_MM : 0;
          assert.ok(Math.abs(doc.w - (size.wMm + wrap) * PT_PER_MM) < 0.5 && Math.abs(doc.h - (size.hMm + wrap) * PT_PER_MM) < 0.5, `${k} ${size.id}: the sheet is not its size`);
          assert.equal(doc.ops.filter((o) => o.t === 'image' && o.ref.startsWith('dp-') && o.ref !== 'dp-main').length, n, `${k} ${size.id}: ${n} photos picked, a different number drawn`);
          all.push(...problems(doc, `${k} · ${style} · ${size.id} · ${n} photos`, style === 'canvas', k === 'magazine'));
        }
      }
    }
  }
  assert.ok(drawn > 60, `only ${drawn} posters drawn`);
  assert.deepEqual(all, []);
});

test('every name is printed — none cut, none "and N more"', () => {
  const doc = layoutDayPosterDocs({ look: printLookFor('house'), data: data('collage', 'photo', 'a4', 16), mode: 'print', foil: false })[0]!;
  const words = doc.ops.flatMap((o) => (o.t === 'path' && o.text ? [o.text.s] : [])).join(' ');
  for (const g of GROUPS) for (const [l, r] of g.rows) for (const p of [l, r]) if (p) assert.ok(words.includes(p.name), `${p.name} is missing from the poster`);
  assert.doesNotMatch(words, /and \d+ more/i);
});

test('the free file is A4 at 200 dpi — never more pixels — and carries no watermark', async () => {
  const doc = layoutDayPosterDocs({ look: printLookFor('house'), data: data('collage', 'photo', 'a4', 8), mode: 'sample', foil: false })[0]!;
  const px = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#88aa77' } }).jpeg().toBuffer();
  const images: PrintImages = { eventqr: { bytes: new Uint8Array(px), mime: 'image/jpeg' }, 'dp-main': { bytes: new Uint8Array(px), mime: 'image/jpeg' } };
  for (let i = 0; i < 8; i += 1) images[`dp-${i}`] = { bytes: new Uint8Array(px), mime: 'image/jpeg' };
  const { pdf, px: size } = await flatDayPosterPdf(doc, images, 'probe');
  assert.ok(size.w <= DAY_POSTER_FREE_PX.w && size.h <= DAY_POSTER_FREE_PX.h, `the free file is ${size.w} × ${size.h}`);
  assert.deepEqual(DAY_POSTER_FREE_PX, { w: 1654, h: 2339 });
  const { PDFDocument } = await import('pdf-lib');
  const loaded = await PDFDocument.load(pdf);
  assert.equal(loaded.getPageCount(), 1, 'the free file is not one page');
  const page = loaded.getPage(0);
  assert.ok(Math.abs(page.getWidth() - 210 * PT_PER_MM) < 1 && Math.abs(page.getHeight() - 297 * PT_PER_MM) < 1, 'the free file is not an A4 page');
  // The one page is the one picture — the layout's ops never reach the file, so no watermark and no vector type.
  assert.equal(doc.ops.some((o) => o.t === 'path' && o.text?.s.includes('SAMPLE')), false, 'the free file carries a watermark');
  // The flat file is drawn from no vector: nothing in the layout reaches the PDF but the one picture.
  assert.doesNotMatch(read('lib/day-poster-file.ts'), /layoutDayPosterDocs|renderPrintPdf\(\s*docs/);
});

test('the builder is reached two ways — the Prints row and the end of the story — couple and co-hosts only', () => {
  const items = read('lib/maker-details-items.ts');
  assert.match(items, /k === 'story-poster' \? \[k, DAY_POSTER_ITEM\]/, 'the row is not after the Our Story poster');
  const story = read('app/[slug]/_components/editorial/editorial-content.tsx');
  assert.match(story, /!isSample && viewer\.isHost && readsAsStory \?/, '"Print your day" is shown to guests');
  assert.match(story, /printsPageHref\(eventId, 'day-poster', 'build=1'\)/);
  const builder = read('app/dashboard/[eventId]/launch/_components/day-poster-builder.tsx');
  assert.match(builder, /get\('build'\) === '1'/, 'the story’s door does not rise the builder');
  assert.match(builder, /<RiseScreen\b/, 'the builder is not the one full screen');
  assert.match(builder, /dayPosterLock\(/, 'the builder decides its own locks');
  assert.doesNotMatch(builder, /₱|\bPHP\b|\d+,\d{3}/, 'a price is typed in the builder');
  const carousel = read('app/dashboard/[eventId]/launch/_components/studio-prints-carousel.tsx');
  assert.match(carousel, /const openEdit = \(\) => \(slide\.build \? slide\.build\.open\(\) : setEditOpen\(true\)\);/);
});
