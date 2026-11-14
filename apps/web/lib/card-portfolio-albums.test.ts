/**
 * 🔒 ONE ALBUM, TWO PLACES — the guard (DECISION_LOG 2026-10-08 "EACH SERVICE CARD COLLECTS ITS OWN PROOF AND ITS OWN
 * PORTFOLIO" · "ONE ALBUM, TWO PLACES" · "APPROVED — THE SERVICE CARD MAKER DRAWING", frames 71–78; 2026-10-03 the
 * 7-day guest notice).
 *
 *   §1 one album, two places, NO COPY — a card's album IS Their work's album object, photo for photo
 *   §2 the 7-day rule — an album photo is shown only after the notice ran out, unremoved, not taken down
 *   §3 a multi-card booking — one album, one "Booked on" row per card; a Files photo stays on its own card
 *   §4 a retired card — keeps its name and says "retired"
 *   §5 refusals are said, never drawn as nothing · the card's own uploads are never proof
 *   §6 the couple's page carries no event id
 *   §7 the flag: OFF reads and draws nothing new
 *   §8 the one new read is a function, not a table, and only the server may call it
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  bookedOnRows,
  cardAlbums,
  passedTheGuestNotice,
  portfolioSummary,
  shopWorkAlbums,
  toAlbumViews,
  albumLabel,
  type AlbumEvent,
  type BookedPair,
  type CardRef,
  type ListedFileRow,
  type PageNoticeRow,
} from './card-portfolio-albums';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const strip = stripComments;

const NOW = new Date('2026-11-13T00:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();
const ago = (days: number) => iso(NOW.getTime() - days * DAY);

/** A notice that went up properly: noticed 10 days ago, public 3 days ago, published then. */
const notice = (over: Partial<PageNoticeRow> = {}): PageNoticeRow => ({
  photoId: 'p1',
  eventId: 'E1',
  url: 'https://media/p1.jpg',
  noticedAt: ago(10),
  publicFrom: ago(3),
  publishedAt: ago(3),
  removedAt: null,
  albumHiddenAt: null,
  ...over,
});

const EVENTS = new Map<string, AlbumEvent>([
  ['E1', { eventId: 'E1', eventType: 'debut', eventDate: '2026-08-15', venueName: 'Tagaytay Highlands', isPrivate: false }],
  ['E2', { eventId: 'E2', eventType: 'wedding', eventDate: '2026-06-02', venueName: 'Juan and Maria’s garden', isPrivate: true }],
  ['E3', { eventId: 'E3', eventType: 'christening', eventDate: '2026-05-09', venueName: 'Quezon City', isPrivate: false }],
]);
const PAIRS: BookedPair[] = [
  // E1 booked TWO cards of the shop (a multi-service lock).
  { serviceId: 'HALF', eventId: 'E1', delivered: true, via: 'booking' },
  { serviceId: 'SDE', eventId: 'E1', delivered: true, via: 'lock' },
  // E2 delivered, no photo yet.
  { serviceId: 'HALF', eventId: 'E2', delivered: true, via: 'booking' },
  // E3 booked a card since retired.
  { serviceId: 'BOOTH', eventId: 'E3', delivered: false, via: 'booking' },
];
const FILES: ListedFileRow[] = [
  { fileId: 'f-half', eventId: 'E1', serviceId: 'HALF', url: 'https://signed/half.jpg', at: ago(5) },
  { fileId: 'f-sde', eventId: 'E1', serviceId: 'SDE', url: 'https://signed/sde.jpg', at: ago(4) },
  // filed under a card E1 never booked → in no album at all (every photo in Their work is on a card)
  { fileId: 'f-other', eventId: 'E1', serviceId: 'OTHER', url: 'https://signed/other.jpg', at: ago(4) },
  { fileId: 'f-booth', eventId: 'E3', serviceId: 'BOOTH', url: 'https://signed/booth.jpg', at: ago(6) },
];
const CARDS = new Map<string, CardRef>([
  ['HALF', { id: 'HALF', title: 'Half-day coverage', category: 'photography', isActive: true }],
  ['SDE', { id: 'SDE', title: 'Same-day edit', category: 'videography', isActive: true }],
  ['BOOTH', { id: 'BOOTH', title: 'Pabati booth', category: 'photo_booth', isActive: false }],
]);
const work = () => shopWorkAlbums({ pairs: PAIRS, events: EVENTS, notices: [notice()], files: FILES, now: NOW });

test('§1 · one album, two places — the card holds the SAME album object and the SAME photo objects as Their work', () => {
  const albums = work();
  const e1 = albums.find((a) => a.eventId === 'E1')!;
  for (const card of ['HALF', 'SDE']) {
    const mine = cardAlbums(albums, card).find((c) => c.album.eventId === 'E1')!;
    assert.equal(mine.album, e1, `${card}: a copy of the album, not the album`);
    for (const ph of mine.photos) assert.ok(e1.photos.includes(ph), `${card}: a copied photo (${ph.key}) — photos are shared by reference`);
  }
  // …and the papic photo is ONE object on both cards.
  const half = cardAlbums(albums, 'HALF')[0]!.photos.find((p) => p.from === 'papic');
  const sde = cardAlbums(albums, 'SDE')[0]!.photos.find((p) => p.from === 'papic');
  assert.ok(half && half === sde, 'the event album photo must be the same object on every card the event booked');
});

test('§1 · nothing in the read or the view writes, uploads or copies a photo', () => {
  for (const f of ['lib/card-portfolio-albums.ts', 'lib/card-portfolio-albums.server.ts', 'app/_components/card-portfolio-section.tsx']) {
    const code = strip(read(f));
    assert.doesNotMatch(code, /\.(insert|upsert|update|delete)\(|copyObject|CopyObjectCommand|putObject|PutObjectCommand|\.rpc\('(?!card_portfolio_booked_events')/, `${f} writes or copies`);
  }
  // cardAlbums FILTERS the album's photos — a map/spread there would mint copies.
  const fn = read('lib/card-portfolio-albums.ts').match(/export function cardAlbums[\s\S]*?\n}\n/)![0];
  assert.match(fn, /album\.photos\.filter\(/);
  assert.doesNotMatch(fn, /\.map\(|\{\s*\.\.\.(p|ph|photo)\b/, 'cardAlbums must not copy photos');
});

test('§2 · the 7-day rule — shown only once the notice ran out, unremoved, not taken down, published in time', () => {
  assert.equal(passedTheGuestNotice(notice(), NOW), true);
  const no: [string, Partial<PageNoticeRow>][] = [
    ['still inside the 7 days', { noticedAt: ago(2), publicFrom: iso(NOW.getTime() + 5 * DAY), publishedAt: null }],
    ['not published', { publishedAt: null }],
    ['published before the window closed', { publishedAt: ago(5) }],
    ['a window shorter than 7 days', { noticedAt: ago(9), publicFrom: ago(3) }],
    ['a guest removed it', { removedAt: ago(1) }],
    ['a takedown hid the album photo', { albumHiddenAt: ago(1) }],
    ['the takedown state was not read back', { albumHiddenAt: 'unknown' }],
    ['the window is in the future', { noticedAt: ago(1), publicFrom: iso(NOW.getTime() + 6 * DAY), publishedAt: iso(NOW.getTime() + 6 * DAY) }],
  ];
  for (const [why, over] of no) assert.equal(passedTheGuestNotice(notice(over), NOW), false, why);
  // …and the album leaves such a photo out.
  const albums = shopWorkAlbums({ pairs: PAIRS, events: EVENTS, notices: [notice({ removedAt: ago(1) })], files: [], now: NOW });
  assert.equal(albums.find((a) => a.eventId === 'E1')!.photos.length, 0);
});

test('§2 · the server reads the notice table, not the private album, for an event album photo', () => {
  const code = strip(read('lib/card-portfolio-albums.server.ts'));
  assert.match(code, /\.from\('supplier_page_photo_notices'\)[\s\S]{0,400}\.not\('published_at', 'is', null\)[\s\S]{0,60}\.is\('removed_at', null\)/);
  assert.doesNotMatch(code, /\.from\('vendor_papic_portfolio_photos'\)/, 'the private album is never read as a public source');
  // Files photos come only through the couple-approved listing view.
  assert.match(code, /\.from\('event_supplier_photos_listed'\)/);
  assert.doesNotMatch(code, /\.from\('event_supplier_files'\)/, 'unapproved Files rows must not reach an album');
});

test('§3 · a multi-card booking is ONE album with one "Booked on" row per card; a Files photo stays on its own card', () => {
  const albums = work();
  const e1 = albums.filter((a) => a.eventId === 'E1');
  assert.equal(e1.length, 1, 'one event = one album, however many cards it booked');
  assert.deepEqual(bookedOnRows(e1[0]!, CARDS).map((r) => r.name), ['Half-day coverage', 'Same-day edit']);
  const keys = (card: string) => cardAlbums(albums, card).find((c) => c.album.eventId === 'E1')!.photos.map((p) => p.key).sort();
  assert.deepEqual(keys('HALF'), ['files:f-half', 'papic:p1']);
  assert.deepEqual(keys('SDE'), ['files:f-sde', 'papic:p1']);
  assert.ok(!e1[0]!.photos.some((p) => p.key === 'files:f-other'), 'a photo under a card the event never booked joined the album');
});

test('§4 · a retired card keeps its name and says "retired"', () => {
  const e3 = work().find((a) => a.eventId === 'E3')!;
  assert.deepEqual(bookedOnRows(e3, CARDS), [{ serviceId: 'BOOTH', name: 'Pabati booth', retired: true }]);
  const page = read('app/vendor-dashboard/services/their-work/their-work-list.tsx');
  assert.match(page, /r\.retired \? <span[^>]*>retired</, 'Their work must draw the retired pill');
  assert.match(page, /Booked on/);
});

test('§4 · a delivered event with no photo is the honest line; an undelivered one with none is not an album', () => {
  const albums = work();
  const e2 = albums.find((a) => a.eventId === 'E2')!;
  assert.equal(toAlbumViews(cardAlbums(albums, 'HALF')).find((v) => v.label.startsWith('Wedding'))!.line, 'delivered · no photos');
  assert.equal(e2.label, 'Wedding · private venue · Jun 2026', 'a private event never names its venue');
  const quiet = shopWorkAlbums({ pairs: [{ serviceId: 'X', eventId: 'E3', delivered: false, via: 'booking' }], events: EVENTS, notices: [], files: [], now: NOW });
  assert.equal(quiet.length, 0);
});

test('§5 · a refused read is said ("Couldn’t load · Retry"), never drawn as an empty portfolio or record', () => {
  assert.equal(portfolioSummary(null), 'Couldn’t load · Retry');
  const view = read('app/_components/card-portfolio-section.tsx');
  assert.match(view, /if \(albums === null\)[\s\S]{0,300}Couldn’t load this card’s portfolio/);
  assert.match(view, /Retry/);
  const page = read('app/vendor-dashboard/services/[serviceId]/page.tsx');
  assert.match(page, /records === null \? \(\s*<CardRecordUnread/, 'a refused record read must be said (frame 75)');
  assert.match(page, /Couldn’t load this card’s record/);
  assert.match(page, /readOneCardRecord\(/, 'the edit sheet must use the reader that keeps a refusal apart from "no record"');
  const sheet = read('app/v/[slug]/_components/service-details-sheet.tsx');
  assert.match(sheet, /const workShown = work === null \|\|/, 'the grown card must say a refused read');
  assert.match(read('lib/card-portfolio-albums.server.ts'), /return null;/);
});

test('§5 · the card’s own uploads are the supplier’s own — "yours, not from an event", last, never proof', () => {
  const view = read('app/_components/card-portfolio-section.tsx');
  const own = view.indexOf('Your own uploads');
  assert.ok(own > view.indexOf('albums.map('), 'own uploads must come LAST');
  assert.match(view, /yours, not from an event/);
  // The album read never takes a card's cover or showcase photo.
  assert.doesNotMatch(strip(read('lib/card-portfolio-albums.server.ts')), /primary_photo_r2_key|showcase_photo_r2_keys|portfolio_r2_keys/);
});

test('§6 · the couple’s page carries no event id', () => {
  const views = toAlbumViews(cardAlbums(work(), 'HALF'));
  const json = JSON.stringify(views);
  for (const id of ['E1', 'E2', 'E3', 'HALF', 'SDE']) assert.ok(!json.includes(`"${id}"`) && !json.includes(`-${id}`), `${id} leaked`);
  assert.ok(views.every((v) => v.href === null));
  const shop = read('app/v/[slug]/page.tsx');
  assert.match(shop, /toAlbumViews\(cardAlbums\(shopWork\.albums, id\)\)/, 'the shop page must pass no href (an href carries the event id)');
  assert.equal(albumLabel(EVENTS.get('E1')), 'Debut · Tagaytay Highlands · Aug 2026');
});

test('§7 · the flag: OFF reads nothing new and draws nothing new', () => {
  const edit = read('app/vendor-dashboard/services/[serviceId]/page.tsx');
  assert.match(edit, /const recordOn = cardRecordEnabled\(\);/);
  assert.match(edit, /recordOn\s*\?\s*cardPortfolioAlbums\(/, 'the album read must sit behind the flag');
  assert.match(edit, /albums === undefined \? null :/, 'flag off → no portfolio slot (the fold says what it always said)');
  assert.match(read('app/vendor-dashboard/services/their-work/page.tsx'), /if \(!cardRecordEnabled\(\)\) notFound\(\);/);
  const shop = read('app/v/[slug]/page.tsx');
  // ⚡ Started early since 2026-11-14 (speed pass) — still only behind the flag, still awaited before use.
  assert.match(shop, /const shopWorkP = cardRecordEnabled\(\)\s*\?\s*startRead\(\s*readShopWork\(/);
  assert.match(shop, /albumsByService: Map<string, AlbumView\[\] \| null> \| null =\s*shopWork === undefined\s*\? null/);
  assert.match(shop, /albumsByService \? \{ \.\.\.card, eventWork:/, 'flag off → no card carries eventWork');
  const maker = read('app/vendor-dashboard/services/_components/canvas-maker.tsx');
  assert.match(maker, /\{portfolioSlot \?\? \(/, 'with no slot the Portfolio fold keeps its shipped words');
});

test('§8 · the one new read is a function (no table), arm’s length, server-only', () => {
  const dir = join(WEB, '../../supabase/migrations');
  const sql = readFileSync(join(dir, '20271344732290_card_portfolio_booked_events.sql'), 'utf8');
  assert.doesNotMatch(sql, /CREATE TABLE/i, 'the drawing named NO new table');
  assert.match(sql, /vendor_booking_is_arms_length\(/, 'a self-dealt booking must not become proof');
  assert.match(sql, /booked_event_vendor_statuses\(\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.card_portfolio_booked_events\(uuid\[\]\) FROM PUBLIC, anon, authenticated;/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.card_portfolio_booked_events\(uuid\[\]\) TO service_role;/);
  assert.doesNotMatch(sql, /TO (anon|authenticated)/, 'it returns couples’ event ids — never a browser role');
});
