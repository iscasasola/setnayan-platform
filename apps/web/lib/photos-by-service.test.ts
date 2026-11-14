/**
 * 🔒 PHOTOS BY SERVICE — the guard (owner 2026-11-14, DECISION_LOG d8ec0922; prototype
 * `prototypes/supplier_photos_by_category_2026-11-14_fable.html`, Fable's three picks taken).
 *
 *   §1 by reference — every photo in the view is a URL the card already carries; nothing is uploaded or copied
 *   §2 one heading per card, grouped by the card's service; counts are what is drawn
 *   §3 a caption is kind · month or "Card photo" — never a name, a venue or an id
 *   §4 a service with no photo has no Portfolio tile (Fable's pick: no empty tile) — and its card names still open it
 *   §5 a refused read is said (amber, Try again), never drawn as "no photos"
 *   §6 the shop's own view ("Only you") is asked after the page, refused to anyone who does not run the shop, and
 *      leaves out what a guest or a takedown removed, what was never screened, and the shop's own captures
 *   §7 both ways in are wired: the service name on the card (Ⓐ) and the Portfolio row (Ⓑ)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { cardServicePhotos, photoTiles, serviceLine, servicesFromCards, cardLine } from './photos-by-service';
import { eventPhotosOf, kindMonthLabel, shopWorkAlbums, type BookedPair, type AlbumEvent } from './card-portfolio-albums';
import type { ServiceCard } from './service-card-view-model';

const WEB = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

const card = (id: string, serviceKey: string, serviceLabel: string, over: Partial<ServiceCard> = {}): ServiceCard =>
  ({
    id,
    label: `Card ${id}`,
    serviceKey,
    serviceLabel,
    priceLabel: 'Price on request',
    meta: null,
    discountLabel: null,
    inclusions: [],
    inclusionsMore: 0,
    notIncluded: [],
    priceDetail: null,
    serves: null,
    photos: [],
    videoUrl: null,
    record: null,
    recordRating: null,
    givesSetnayanGift: false,
    anchorId: `card-${id}`,
    ...over,
  }) as unknown as ServiceCard;

const LIGHTS_A = card('A', 'lights_and_sound', 'Lights & Sound', {
  photos: ['https://cdn/own-a1.jpg', 'https://cdn/own-a2.jpg'],
  coupleLooks: [{ id: 'l1', url: 'https://cdn/couple-1.jpg', credit: 'Ana & Ben · Dec 2025', verifiedBooking: true }],
  eventPhotos: [
    { url: 'https://cdn/ev-1.jpg', caption: 'Wedding · Dec 2025', event: 'e0' },
    { url: 'https://cdn/ev-2.jpg', caption: 'Wedding · Dec 2025', event: 'e0' },
    { url: 'https://cdn/ev-3.jpg', caption: 'Debut · Feb 2026', event: 'e1' },
  ],
} as Partial<ServiceCard>);
const LIGHTS_B = card('B', 'lights_and_sound', 'Lights & Sound', {
  eventPhotos: [{ url: 'https://cdn/ev-4.jpg', caption: 'Corporate · Mar 2026', event: 'e2' }],
} as Partial<ServiceCard>);
const BAR = card('C', 'mobile_bar', 'Mobile Bar', { eventPhotos: [] } as Partial<ServiceCard>);

test('§1 by reference — every photo in the view is a URL the card already carries', () => {
  for (const c of [LIGHTS_A, LIGHTS_B, BAR]) {
    const carried = new Set([...c.photos, ...(c.coupleLooks ?? []).map((l) => l.url), ...(c.eventPhotos ?? []).map((e) => e.url)]);
    for (const p of cardServicePhotos(c).photos) assert.ok(carried.has(p.url), `${p.url} is not one of the card's own photos`);
  }
  for (const f of ['lib/photos-by-service.ts', 'lib/photos-by-service.server.ts', 'app/v/[slug]/_components/photos-by-service.tsx']) {
    const code = stripComments(read(f));
    assert.doesNotMatch(code, /\.(insert|upsert|update|delete)\(|PutObjectCommand|CopyObjectCommand|putObject/, `${f} writes or copies a photo`);
  }
});

test('§2 grouped by service, one heading per card, counts are what is drawn', () => {
  const views = servicesFromCards([LIGHTS_A, BAR, LIGHTS_B]);
  assert.deepEqual(views.map((v) => v.key), ['lights_and_sound', 'mobile_bar']);
  const lights = views[0]!;
  assert.deepEqual(lights.cards.map((c) => c.cardId), ['A', 'B']);
  assert.equal(lights.photos, 7);
  assert.equal(lights.events, 3);
  assert.equal(serviceLine(lights), '7 photos · 3 events · 2 service cards');
  assert.equal(cardLine(lights.cards[0]!), '6 photos · 2 events');
  // newest event photos first, then the couples', then the card's own
  assert.deepEqual(lights.cards[0]!.photos.map((p) => p.tag ?? p.caption), [
    'Wedding · Dec 2025',
    'Wedding · Dec 2025',
    'Debut · Feb 2026',
    'couple',
    'Card photo',
    'Card photo',
  ]);
});

test('§3 a caption is kind · month or "Card photo" — never a name, a venue or an id', () => {
  const EV: AlbumEvent = { eventId: 'evt-uuid-123', eventType: 'wedding', eventDate: '2025-12-06', venueName: 'Makati Shangri-La', isPrivate: false };
  assert.equal(kindMonthLabel(EV), 'Wedding · Dec 2025');
  const pairs: BookedPair[] = [{ serviceId: 'A', eventId: 'evt-uuid-123', delivered: true, via: 'booking' }];
  const work = shopWorkAlbums({
    pairs,
    events: new Map([['evt-uuid-123', EV]]),
    notices: [],
    files: [{ fileId: 'f1', eventId: 'evt-uuid-123', serviceId: 'A', url: 'https://cdn/f1.jpg', at: '2025-12-07' }],
    now: new Date('2026-11-14'),
  });
  const photos = eventPhotosOf(work ? { albums: work } : null, ['A']).get('A')!;
  assert.deepEqual(photos, [{ url: 'https://cdn/f1.jpg', caption: 'Wedding · Dec 2025', event: 'e0' }]);
  const json = JSON.stringify(photos);
  assert.doesNotMatch(json, /evt-uuid-123|Makati|Ana|Ben/, 'an event id, venue or name reached the page');
  for (const p of cardServicePhotos(LIGHTS_A).photos) assert.match(p.caption, /^(|Card photo|[A-Z][a-z ]+ · [A-Z][a-z]{2} \d{4})$/);
  // a couple's photo carries no caption — its only date sits beside the couple's names
  assert.equal(cardServicePhotos(LIGHTS_A).photos.find((p) => p.tag === 'couple')!.caption, '');
});

test('§4 a service with no photo has no Portfolio tile — its card names still open the view', () => {
  const views = servicesFromCards([LIGHTS_A, BAR]);
  assert.deepEqual(photoTiles(views).map((t) => t.key), ['lights_and_sound']);
  assert.equal(photoTiles(views)[0]!.line, '6 photos · 1 card');
  assert.equal(serviceLine(views[1]!), '1 service card', 'an empty service still opens, with its cards to tap');
  const sheet = read('app/v/[slug]/_components/photos-by-service.tsx');
  assert.match(sheet, /No event photos for \{view\.label\} yet\./);
  assert.match(sheet, /See the card/);
});

test('§5 a refused read is said (amber, Try again), never drawn as "no photos"', () => {
  const unread = card('D', 'mobile_bar', 'Mobile Bar', { eventPhotos: null } as Partial<ServiceCard>);
  const [v] = servicesFromCards([unread]);
  assert.equal(v!.unread, true);
  const sheet = read('app/v/[slug]/_components/photos-by-service.tsx');
  assert.match(sheet, /view\.unread \? <Failed words="Couldn’t load these photos just now\."/);
  assert.match(sheet, /total === 0 && !view\.unread/, 'the empty line must not show while the read failed');
  assert.match(sheet, /Try again/);
});

test('§6 the shop’s own view is shop-only and leaves out what must not show', () => {
  const code = stripComments(read('lib/photos-by-service.server.ts'));
  assert.match(code, /if \(!\(await viewerRunsShop\(vendorProfileId\)/, 'refuse anyone who does not run the shop');
  assert.match(code, /\.is\('hidden_at', null\)/, 'a takedown hides the album row — never shown');
  assert.match(code, /\.eq\('nsfw_checked', true\)/, 'never an unscreened photo');
  assert.match(code, /notice\?\.state === 'on_page'\) continue;/, 'a photo already on the page is not "Only you"');
  assert.match(code, /card_portfolio_booked_events/, 'the same arm’s-length (card, event) pairs as the card’s portfolio');
  assert.doesNotMatch(code, /vendor_papic_captures/, 'the shop’s own shots at a couple’s event stay out');
  const shop = read('app/v/[slug]/page.tsx');
  assert.doesNotMatch(shop, /readServicePrivatePhotos/, 'the private album must never be in the cached page');
});

test('§7 both ways in are wired — the service name on the card (Ⓐ) and the Portfolio row (Ⓑ)', () => {
  const gallery = read('app/v/[slug]/_components/services-gallery.tsx');
  assert.match(gallery, /pathLead=\{/);
  assert.match(gallery, /<PhotosByServiceSheet/);
  const face = read('app/_components/service-face.tsx');
  assert.match(face, /<span className="relative z-10[^"]*" data-service-face-path="">/, 'the service name sits above the door, never inside it');
  const shop = read('app/v/[slug]/page.tsx');
  assert.match(shop, /<PhotosByServiceRow views=\{photoServiceViews\}/);
  assert.match(shop, /servicesFromCards\(buildServiceGroups\(servicesProps\)/, 'the row gathers the SAME cards the gallery draws');
});
