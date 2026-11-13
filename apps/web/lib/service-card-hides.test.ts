/**
 * 🃏 HIDE PER CARD — the keys (ruling 5970; `lib/service-card-hides.ts`) and the cover morph's clip
 * (ruling 5976; `heroClipFrom` in `lib/rise-motion.ts`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CARD_HIDE_KINDS,
  cardHideKey,
  cardHideSaveError,
  cardItemKeys,
  cardWithoutHidden,
  eventLineKeys,
  hidesByCard,
  pairPhotoRefs,
  parseCardHideKey,
  withCardHides,
} from './service-card-hides';
import { HERO_CLIP_OPEN, heroClipFrom } from './rise-motion';
import type { ServiceCard } from './service-card-view-model';

test('a key goes in and comes back out; anything else is refused', () => {
  assert.deepEqual(parseCardHideKey(cardHideKey('photo', 'r2://setnayan-media/a/b.jpg')), { kind: 'photo', key: 'r2://setnayan-media/a/b.jpg' });
  assert.equal(parseCardHideKey('review:abc'), null, 'reviews are never hidden on a card');
  assert.equal(parseCardHideKey('photo:'), null);
  assert.equal(parseCardHideKey(':x'), null);
  assert.equal(parseCardHideKey(42), null);
  assert.equal(parseCardHideKey(`insp:${'x'.repeat(601)}`), null, 'the table CHECK caps a key at 600');
});

test('the kinds match the table CHECK, and nothing else', () => {
  const sql = readFileSync(join(__dirname, '../../../supabase/migrations/20271342009988_service_card_hides.sql'), 'utf8');
  const inList = sql.match(/item_kind IN \(([^)]+)\)/)?.[1] ?? '';
  assert.deepEqual([...inList.matchAll(/'([a-z]+)'/g)].map((m) => m[1]), [...CARD_HIDE_KINDS]);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/, 'RLS at create time');
  assert.doesNotMatch(sql, /vendor_profile_id UUID[^\n]*REFERENCES/, 'no second FK to vendor_profiles (PGRST201, 2026-11-12)');
  assert.doesNotMatch(sql, /TO anon/, 'anon never reads or writes it');
});

test('two identical event lines can be hidden one at a time, and the same list always gives the same keys', () => {
  const lines = [
    { label: 'Wedding', month: 'Jun 2027', pax: '100–199 pax' },
    { label: 'Debut', month: 'May 2027', pax: null },
    { label: 'Wedding', month: 'Jun 2027', pax: '100–199 pax' },
  ];
  const keys = eventLineKeys(lines);
  assert.deepEqual(keys, ['event:Wedding|Jun 2027|100–199 pax#1', 'event:Debut|May 2027|#1', 'event:Wedding|Jun 2027|100–199 pax#2']);
  assert.deepEqual(eventLineKeys(lines), keys);
  assert.ok(keys.every((k) => parseCardHideKey(k)?.kind === 'event'));
});

test('a photo whose URL failed to resolve drops its ref too, so the pairs never slip', () => {
  assert.deepEqual(pairPhotoRefs(['r2://a', 'r2://b', 'r2://c'], ['https://u/a', null, 'https://u/c']), {
    photos: ['https://u/a', 'https://u/c'],
    photoRefs: ['r2://a', 'r2://c'],
  });
});

test('rows group by card, and an unknown kind is ignored', () => {
  const m = hidesByCard([
    { vendor_service_id: 's1', item_kind: 'photo', item_key: 'r2://a' },
    { vendor_service_id: 's1', item_kind: 'insp', item_key: 'look-1' },
    { vendor_service_id: 's2', item_kind: 'nope', item_key: 'x' },
  ]);
  assert.deepEqual(m.get('s1'), ['photo:r2://a', 'insp:look-1']);
  assert.equal(m.has('s2'), false);
});

const card = (over: Partial<ServiceCard> = {}): ServiceCard =>
  ({ id: 's1', label: 'Mobile Bar', photos: [], videoUrl: null, record: null, ...over }) as unknown as ServiceCard;

test('withCardHides: a card with nothing to hide is returned AS IS (byte-for-byte as before)', () => {
  const c = card();
  assert.equal(withCardHides(c, undefined, undefined), c);
  assert.equal(withCardHides(c, undefined, []), c);
});

test('withCardHides: refs attach only when the card shows the showcase photos (never a cover fallback)', () => {
  const photos = ['https://u/a', 'https://u/b'];
  const media = { photos, videoUrl: 'https://u/v', photoRefs: ['r2://a', 'r2://b'], videoRef: 'r2://v' };
  const shown = withCardHides(card({ photos, videoUrl: 'https://u/v' }), media, ['photo:r2://b']);
  assert.deepEqual(shown.photoRefs, ['r2://a', 'r2://b']);
  assert.equal(shown.clipRef, 'r2://v');
  assert.deepEqual(shown.hiddenOnCard, ['photo:r2://b']);
  assert.deepEqual(cardItemKeys(shown).photos, ['photo:r2://a', 'photo:r2://b']);
  assert.equal(cardItemKeys(shown).clip, 'clip:r2://v');
  // The cover fallback is not the showcase → no refs, nothing to hide there.
  const fallback = withCardHides(card({ photos: ['https://u/cover'] }), { photos: [], videoUrl: null, photoRefs: [] }, undefined);
  assert.equal(fallback.photoRefs, undefined);
  assert.deepEqual(cardItemKeys(fallback).photos, [null]);
});

test('heroClipFrom: at frame 0 the clip sits over the cover, mapped back through the rise; at rest it is open', () => {
  // The layer at rest fills a 390 × 844 phone; the tapped card is 358 × 140 at (16, 300); its cover 80 × 112 at (28, 314).
  const to = { left: 0, top: 0, width: 390, height: 844 };
  const from = { left: 16, top: 300, width: 358, height: 140 };
  const cover = { left: 28, top: 314, width: 80, height: 112 };
  const hero = { left: 0, top: 0, width: 390, height: 320 };
  const sx = 358 / 390;
  const sy = 140 / 844;
  const l = (28 - 16) / sx;
  const t = (314 - 300) / sy;
  const w = 80 / sx;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const clip = heroClipFrom(hero, cover, from, to);
  const [top = 0, right = 0, bottom = 0, left = 0] = [...clip.matchAll(/([\d.]+)px/g)].slice(0, 4).map((m) => Number(m[1]));
  assert.equal(left, r1(l));
  assert.equal(right, r1(390 - (l + w)));
  // The cover's mapped top falls past the hero here, so the clip is clamped to the hero and never inverts.
  assert.equal(top, r1(Math.min(t, 320)));
  assert.ok(top + bottom <= 320 && left + right <= 390, 'a clamped clip never inverts');
  assert.match(clip, /round 8px\)$/);
  assert.equal(HERO_CLIP_OPEN, 'inset(0px 0px 0px 0px round 0px)');
  // A zero-size rect never divides by zero.
  assert.match(heroClipFrom(hero, cover, { left: 0, top: 0, width: 0, height: 0 }, to), /^inset\(/);
});

// ── the fixes from the controller's audit ──────────────────────────────────────────────────────────────────────────
const full = (): ServiceCard =>
  card({
    photos: ['https://u/a', 'https://u/b', 'https://u/c'],
    photoRefs: ['r2://a', 'r2://b', 'r2://c'],
    videoUrl: 'https://u/v',
    clipRef: 'r2://v',
    record: {
      bookedCount: 2,
      mix: [],
      ledger: [
        { label: 'Wedding', month: 'Jun 2027', pax: '100–199' },
        { label: 'Debut', month: 'May 2027', pax: '50–99' },
      ],
      milestones: { earned: [], next: null },
    } as unknown as ServiceCard['record'],
    inspirationLooks: [
      { id: 'look-1', url: 'https://u/l1', part: null },
      { id: 'look-2', url: 'https://u/l2', part: null },
    ] as unknown as ServiceCard['inspirationLooks'],
    hiddenOnCard: ['photo:r2://b', 'clip:r2://v', 'event:Debut|May 2027|50–99#1', 'insp:look-2'],
  });

test('fix 1 · hidden items are DROPPED on the server — a couple\'s card never carries them, greyed or flagged', () => {
  const c = full();
  const out = cardWithoutHidden(c, c.hiddenOnCard ?? []);
  assert.deepEqual(out.photos, ['https://u/a', 'https://u/c']);
  assert.equal(out.videoUrl, null);
  assert.deepEqual(out.record?.ledger.map((l) => l.label), ['Wedding']);
  assert.deepEqual(out.inspirationLooks?.map((l) => l.id), ['look-1']);
  // The shop's working data never rides along: no refs, no list of what was hidden.
  assert.equal(out.photoRefs, undefined);
  assert.equal(out.clipRef, undefined);
  assert.equal(out.hiddenOnCard, undefined);
  assert.equal(out.hidesUnread, undefined, 'a good read is not an error');
  const json = JSON.stringify(out);
  assert.doesNotMatch(json, /u\/b|u\/v|look-2|Debut/, 'nothing hidden is left anywhere in the serialized card');
  // The card itself is not mutated (the shop's copy is built from the same rows).
  assert.equal(c.photos.length, 3);
});

test('fix 1 · nothing hidden → the couple gets every item (just not the refs)', () => {
  const out = cardWithoutHidden({ ...full(), hiddenOnCard: undefined }, []);
  assert.equal(out.photos.length, 3);
  assert.equal(out.videoUrl, 'https://u/v');
  assert.equal(out.record?.ledger.length, 2);
  assert.equal(out.inspirationLooks?.length, 2);
  assert.equal(out.photoRefs, undefined);
});

test('fix 1 · the page drops them on the server, for everyone but the shop, AFTER the looks are attached', () => {
  const page = readFileSync(join(__dirname, '../app/v/[slug]/page.tsx'), 'utf8');
  const strip = page.indexOf('cardWithoutHidden(c,');
  assert.ok(strip > 0, 'the page strips the cards');
  assert.ok(strip > page.indexOf('withInspirationLooks(c, inspirationByService'), 'after every hideable item is on the card');
  assert.ok(strip < page.indexOf('<ServicesGallery', strip), 'before the cards are handed to the client');
  assert.match(page, /if \(detailsEnabled && \(cardHides\.status === 'error' \|\| !viewerCuratesCards\)\)/);
  // "The shop" is decided on the server, fail-closed, with the same check RLS uses for the write.
  assert.match(page, /await viewerRunsShop\(vendor\.vendor_profile_id\)/);
  assert.match(page, /ownerCheckFor=\{viewerCuratesCards \? vendor\.vendor_profile_id : null\}/);
});

test('fix 2 · a FAILED hides read fails closed: nothing hideable is shown, and the card says so', () => {
  const out = cardWithoutHidden({ ...full(), hiddenOnCard: undefined }, 'unread');
  assert.deepEqual(out.photos, [], 'every showcase photo a hide is keyed on is left out');
  assert.equal(out.videoUrl, null);
  assert.deepEqual(out.record?.ledger, []);
  assert.deepEqual(out.inspirationLooks, []);
  assert.equal(out.record?.bookedCount, 2, 'the facts stay — only the hideable items go');
  assert.equal(out.hidesUnread, true, 'the honest line is drawn');
  // A cover fallback (no refs) is not hideable, so it stays — and a card that lost nothing says nothing.
  const cover = cardWithoutHidden(card({ photos: ['https://u/cover'] }), 'unread');
  assert.deepEqual(cover.photos, ['https://u/cover']);
  assert.equal(cover.hidesUnread, undefined);
});

test('fix 2 · readCardHides reports an error — never an empty map that reads as "nothing hidden"', () => {
  const src = readFileSync(join(__dirname, 'service-card-hides.server.ts'), 'utf8');
  const body = src.slice(src.indexOf('export async function readCardHides'), src.indexOf('export async function viewerRunsShop'));
  assert.match(body, /if \(error\) \{[\s\S]{0,160}return \{ status: 'error' \};/);
  assert.doesNotMatch(body, /if \(error\) \{[\s\S]{0,160}return new Map\(\);/);
});

test('fix 3 · a hide save that fails or is refused is a message, never silence', () => {
  assert.equal(cardHideSaveError({ status: 'ok' }, true), null);
  assert.match(cardHideSaveError({ status: 'error' }, true) ?? '', /wasn’t saved\. It is still showing on this card\. Try again\./);
  assert.match(cardHideSaveError({ status: 'error' }, false) ?? '', /It is still hidden on this card/);
  assert.match(cardHideSaveError({ status: 'refused' }, true) ?? '', /can’t change this card/);
  assert.match(cardHideSaveError(null, true) ?? '', /wasn’t saved/, 'no reply (a thrown call) is a failure too');
});
