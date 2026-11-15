/**
 * THE SERVICE CARD'S COVER PLAYS, AND A SWIPE TURNS IT — on every card, because every card is the one face.
 *
 * Owner, 12 Nov 2026: *"on service cards the photos will slideshow play so even if there is a bundle created, it will
 * also show the slideshow of all the services it includes."* · *"can we swipe it to go the the next photo?"* ·
 * *"incorporating this properly. check our events>suppliers>find page"* → *"Yes, build it"* (DECISION_LOG 12 Nov
 * "SERVICE CARD PHOTOS PLAY AS A SLIDESHOW"; corpus `prototypes/service_card_slideshow_2026-11-12/`).
 *
 * 🔑 WHAT WOULD BREAK IT QUIETLY: a surface that stops handing its photos to the face (the card goes still and every
 * test still passes), a swipe that starts fighting a rail or a row's swipe-to-delete, a tap on the photo that stops
 * opening the card, and a withheld supplier whose photos name them. Each is held here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  COVER_AXIS_PX,
  COVER_BEAT_MS,
  COVER_FLIP_PX,
  MAX_COVER_PHOTOS,
  coverDragMove,
  coverPhotoList,
  coverStep,
  interleaveServicePhotos,
} from '@/lib/service-cover-show';
import { withholdCardNames, type BenchServiceCard } from '@/lib/bench-service-card';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p: string) => stripComments(readFileSync(resolve(WEB, p), 'utf8'));

const FACE = src('app/_components/service-face.tsx');
const SHOW = src('app/_components/service-face-cover-show.tsx');
const DOOR = src('app/_components/service-face-door.tsx');

test('the list: the cover first, each photo once, six at most', () => {
  const l = coverPhotoList('a', ['b', 'a', ' ', null, 'c', 'd', 'e', 'f', 'g', 'h']);
  assert.deepEqual(
    l.map((p) => p.url),
    ['a', 'b', 'c', 'd', 'e', 'f'],
  );
  assert.equal(MAX_COVER_PHOTOS, 6);
  assert.deepEqual(coverPhotoList(null, []), []);
  // One photo → the caller draws the still cover it always drew.
  assert.equal(coverPhotoList('a', ['a']).length, 1);
});

test('a bundle: one photo from each of its services in turn, each named by its service', () => {
  const l = interleaveServicePhotos([
    { name: 'Mobile bar', urls: ['b1', 'b2', 'b3'] },
    { name: 'Photo booth', urls: [null, 'p2'] },
    { name: 'Lights', urls: ['l1'] },
  ]);
  assert.deepEqual(
    l.map((p) => `${p.caption}:${p.url}`),
    // A service with no cover still takes its turn with its first real photo.
    ['Mobile bar:b1', 'Photo booth:p2', 'Lights:l1', 'Mobile bar:b2', 'Mobile bar:b3'],
  );
});

test("the beat is the front door hero's five seconds", () => {
  assert.equal(COVER_BEAT_MS, 5000);
  const hero = src('app/_components/frontdoor/front-door-hero.tsx');
  assert.match(hero, /LOOP_MS\s*=\s*5000\b/, 'the front door hero changed its beat — say whether the card follows');
  assert.match(SHOW, /setInterval\([\s\S]{0,120}COVER_BEAT_MS\)/);
});

test('the swipe: decided on the first 8 px, sideways 28 px turns ONE photo, up/down never turns it', () => {
  assert.equal(COVER_AXIS_PX, 8, "the same 8 px as swipe-to-delete and Find's long-press slop");
  const start = { x: 100, y: 100, axis: null, flipped: false } as const;
  // Still finger: nothing decided — a tap, or Find's long-press, untouched.
  assert.deepEqual(coverDragMove(start, 104, 103), { drag: start, step: 0 });
  // Up/down wins → the page scrolls, the photo never turns, however far it then goes sideways.
  const vertical = coverDragMove(start, 103, 120).drag;
  assert.equal(vertical.axis, 'y');
  assert.equal(coverDragMove(vertical, 20, 120).step, 0);
  // Sideways: not yet at 28 px …
  const side = coverDragMove(start, 90, 101).drag;
  assert.equal(side.axis, 'x');
  assert.equal(coverDragMove(side, 100 - COVER_FLIP_PX + 1, 101).step, 0);
  // … then left = next, right = back, and once per swipe.
  const turned = coverDragMove(side, 100 - COVER_FLIP_PX, 101);
  assert.equal(turned.step, 1);
  assert.equal(coverDragMove(turned.drag, 0, 101).step, 0);
  assert.equal(coverDragMove(coverDragMove(start, 110, 101).drag, 100 + COVER_FLIP_PX, 101).step, -1);
  assert.equal(coverStep(0, -1, 4), 3);
  assert.equal(coverStep(3, 1, 4), 0);
});

test('the face plays its photos when it has two or more, and its door can be found from the photo', () => {
  assert.match(FACE, /const show = coverPhotoList\(cover \? null : coverUrl, photos\);/);
  assert.match(FACE, /const plays = show\.length >= 2;/);
  assert.match(FACE, /plays \? \(\s*<ServiceFaceCoverShow photos=\{show\}/);
  // Both doors are marked — the photo sits above the door and hands it the tap.
  assert.match(FACE, /<Link[\s\S]{0,200}data-service-face-door=""/);
  assert.match(DOOR, /data-service-face-door=""/);
  assert.match(SHOW, /querySelector<HTMLElement>\(':scope > \[data-service-face-door\]'\)/);
  // No door of its own (the supplier's Services list stretches its Card Maker link BESIDE the face) → what lies under.
  assert.match(SHOW, /\?\? underThePhoto\(show, e\.clientX, e\.clientY\)/);
  // …a TRUE hit test: only the topmost element counts, so a control painted beneath the card is never pressed.
  assert.match(SHOW, /document\.elementsFromPoint\(x, y\)\.find\(\(el\) => !show\.contains\(el\)\)/);
});

test('the photo owns only a swipe that STARTS on it — no fight with a rail, a row, or a long-press', () => {
  // Up/down still scrolls the page from the photo; a sideways drag is the photo's, so a rail it sits in stays still.
  assert.match(SHOW, /touch-pan-y/);
  // The supplier sheet's next-supplier swipe skips a gesture that starts inside `data-swipe-photo`.
  assert.match(SHOW, /data-swipe-photo=""/);
  // A row's swipe-to-delete listens to touch events — they stop at the photo.
  assert.match(SHOW, /onTouchStart=\{\(e\) => e\.stopPropagation\(\)\}/);
  assert.match(SHOW, /onTouchMove=\{\(e\) => e\.stopPropagation\(\)\}/);
  // Pointer events are NOT stopped: Find's long-press listens to them and cancels itself past 8 px.
  assert.doesNotMatch(SHOW, /onPointer(Down|Move)=\{\(e\) => e\.stopPropagation/);
  // The tap that ends a swipe never opens the card.
  assert.match(SHOW, /if \(swallow\.current\) \{[\s\S]{0,80}e\.preventDefault\(\);\s*e\.stopPropagation\(\);/);
});

test('it plays only on screen, never under reduced motion, and loads only the first photo with the page', () => {
  assert.match(SHOW, /new IntersectionObserver\([\s\S]*threshold: 0\.5/);
  assert.match(SHOW, /prefers-reduced-motion: reduce/);
  assert.match(SHOW, /if \(!onScreen \|\| held \|\| still \|\| !armed \|\| count < 2\) return;/);
  assert.match(SHOW, /k === 0 \|\| armed \?/);
  // A swipe pauses this card until it leaves the screen.
  assert.match(SHOW, /if \(!e\.isIntersecting\) setHeld\(false\);/);
});

test('every surface hands the face its photos', () => {
  assert.match(src('app/_components/service-card-view.tsx'), /photos=\{c\.photos\}/);
  assert.match(src('app/vendor-dashboard/services/_components/service-card-face.tsx'), /photos=\{photos\}/);
  assert.match(src('app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx'), /photos=\{svc\?\.photos \?\? null\}/);
  assert.match(src('app/vendor-dashboard/shop/_components/shop-bundle-card.tsx'), /photos=\{bundle\.photos \?\? null\}/);
  // Find's cards read the showcase in the SAME read as the cover — no request per card.
  const bench = src('lib/bench-service-cards.ts');
  assert.match(bench, /'primary_photo_r2_key,showcase_photo_r2_keys'/);
  assert.match(bench, /photos: \(row\.showcase_photo_r2_keys \?\? \[\]\)/);
  // A bundle: its services' photos, one from each in turn.
  const shop = src('app/vendor-dashboard/shop/page.tsx');
  assert.match(shop, /vendor_services\(title, starting_price_php, primary_photo_r2_key, showcase_photo_r2_keys,/);
  assert.match(shop, /photos: interleaveServicePhotos\(photosOf\[i\] \?\? \[\]\)/);
});

test('a supplier whose name is withheld is not named by their photos either', () => {
  const card: BenchServiceCard = {
    name: 'Harana Live Band',
    priceText: null,
    discountBadge: null,
    includesLine: null,
    notIncluded: [],
    givesSetnayanGift: false,
    coverUrl: 'c',
    photos: ['p1', 'p2'],
  };
  const out = withholdCardNames({ a: card, b: card }, ['a']);
  assert.deepEqual(out.a?.photos, []);
  assert.deepEqual(out.b?.photos, ['p1', 'p2']);
});
