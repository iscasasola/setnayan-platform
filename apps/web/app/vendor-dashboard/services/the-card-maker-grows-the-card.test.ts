/**
 * 🃏 THE CARD MAKER GROWS THE CARD — ruling c160a2aa (owner-approved 2026-11-16; design = the "Approved" side of the
 * prototype artifact P94heHGYfFe3cZg75YR3Ua).
 *
 *   (A) the card AS COUPLES SEE IT is pinned at the top of the Card Maker and updates as you type (it replaces cut 3's
 *       "See it as couples do" tap); a tap on it RISES into the shipped grown card (`ServiceDetailsSheet`), with the
 *       shop's hide per card · 👁 Couple view · opens;
 *   (B) the form's gallery keeps "Set as primary photo · Delete photo" — the grown card only HIDES, never deletes;
 *   (C) hiding lives in ONE place: the shop page shows every viewer, the shop included, the card couples see.
 *
 * Source-level where the claim is about wiring (like the gallery's other guards), behavioural where it is a rule
 * (`overlayTyped`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '../../../lib/strip-comments';
import { overlayTyped } from '../../../lib/service-card-for-maker';
import type { ServiceCard } from '../../../lib/service-card-view-model';

const WEB = join(__dirname, '../../..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const MAKER = read('app/vendor-dashboard/services/_components/canvas-maker.tsx');
const GROWN = read('app/vendor-dashboard/services/_components/maker-grown-card.tsx');
const LOADER = read('lib/service-card-for-maker.server.ts');
const EDIT = read('app/vendor-dashboard/services/[serviceId]/page.tsx');
const GALLERY = read('app/v/[slug]/_components/services-gallery.tsx');
const SHOP = read('app/v/[slug]/page.tsx');
const FORM_GALLERY = read('app/vendor-dashboard/services/_components/card-photo-gallery.tsx');

test('(A) the pinned card is ALWAYS drawn — no toggle, no "See it as couples do"', () => {
  assert.doesNotMatch(MAKER, /peekOpen|setPeekOpen|data-maker-see-as-couples|See it as couples do/, 'the card is behind a tap again');
  const at = MAKER.indexOf('data-maker-card-pinned=""');
  assert.ok(at > 0, 'anti-vacuity: the pinned card was not found');
  // The pinned block is not inside a condition: what opens it is a plain JSX child of the maker, not `x ? (` / `x && (`.
  const before = MAKER.slice(MAKER.lastIndexOf('<div', at) - 40, MAKER.lastIndexOf('<div', at));
  assert.doesNotMatch(before, /\?\s*\(\s*$|&&\s*\(\s*$/, 'the pinned card is drawn only sometimes');
  const block = MAKER.slice(at, MAKER.indexOf('data-maker-split=""'));
  assert.match(block, /As couples see it/);
  assert.match(block, /updates as you type/);
  assert.match(block, /\{pinnedCard\}/);
  // The pinned card IS the live face — reused, never redrawn.
  assert.match(MAKER, /const pinnedCard = \(\s*<div className="relative"[^>]*>\s*\{cardFace\}/);
  assert.match(MAKER, /const cardFace = face \? \(\s*<ServiceCardFace/);
});

test('(A) a tap on the pinned card mounts the shipped grown card, rising from the tapped face, with the owner', () => {
  // The door over the face is the shipped one (it hands its own box to onOpen) and only a SAVED card gets it.
  assert.match(MAKER, /\{grown \? \(\s*<ServiceFaceDoorButton[\s\S]{0,200}onOpen=\{\(from\) => \{\s*grownFrom\.current = from;\s*setGrownOpen\(true\);/);
  assert.match(MAKER, /const grown = grownCard\?\.status === 'ok' \? grownCard : null;/);
  assert.match(MAKER, /<MakerGrownCardSheet\s+open=\{grownOpen\}[\s\S]{0,400}from=\{grownFrom\.current\}/);
  // …which is ServiceDetailsSheet, inert (no Inquire on the shop's own card), with the owner object.
  assert.match(GROWN, /import \{ ServiceDetailsSheet, type GrownCardOwner \} from '@\/app\/v\/\[slug\]\/_components\/service-details-sheet';/);
  const sheet = GROWN.slice(GROWN.indexOf('<ServiceDetailsSheet'));
  assert.match(sheet, /card=\{overlayTyped\(grown\.card, typed\)\}/, 'the grown card does not update as you type');
  assert.match(sheet, /inquireMode="none"/);
  assert.match(sheet, /from=\{from\}/);
  assert.match(sheet, /owner=\{owner\}/, 'the grown card lost its owner — nothing can be hidden');
  assert.match(GROWN, /const owner: GrownCardOwner \| null = grown\.curate\s*\?/);
  // The edit page builds it on the server, only while couples have a grown card at all.
  assert.match(EDIT, /serviceDetailsEnabled\(\)\s*\?\s*loadMakerGrownCard\(/);
  assert.match(EDIT, /grownCard=\{grownCard\}/);
});

test('(A) the Card Maker\'s owner toggles through couplePhotoShare op card_hide — never a new action', () => {
  assert.match(GROWN, /couplePhotoShare\(\{ op: 'card_hide', vendorServiceId: cardId, key, hidden: hide \}\)/);
  assert.match(GROWN, /import \{ couplePhotoShare \} from '@\/app\/_actions\/couple-photo-share-actions';/);
  assert.doesNotMatch(GROWN, /^'use server'|export async function/m, 'a new server action');
  // The toggle is drawn only once the save succeeded (moved from the shop page's gallery, unchanged).
  const toggle = GROWN.slice(GROWN.indexOf('const toggleHide'), GROWN.indexOf('const owner: GrownCardOwner'));
  assert.ok(toggle.indexOf('setHides') > toggle.indexOf('const settle'), 'flipped before the save came back');
});

test('(A) the server loader keeps hidden items for the owner, and a FAILED hides read curates nothing and says so', () => {
  assert.match(LOADER, /card = withCardHides\(card, showcase, hides\.status === 'ok' \? hidden : undefined\);/);
  assert.match(LOADER, /return \{ status: 'ok', card, hidden, curate: true, opens, unread \};/, 'the owner\'s card lost its hidden items');
  assert.match(
    LOADER,
    /if \(hides\.status === 'error'\) \{\s*unread\.push\([^)]*\);\s*return \{ status: 'ok', card: cardWithoutHidden\(card, 'unread'\), hidden: \[\], curate: false/,
    'a refused hides read is drawn as "nothing hidden"',
  );
  // The same lib calls the shop page makes, never a second drawing.
  for (const fn of ['toServiceCard(', 'withCoupleLooks(', 'withCardReviews(', 'buildCardReviews(', 'toAlbumViews(', 'withInspirationLooks(', 'readCardHides(']) {
    assert.ok(LOADER.includes(fn), `the loader no longer calls ${fn}`);
  }
});

test('(C) the shop page no longer curates: no owner on its grown card, hidden items dropped for every viewer', () => {
  assert.doesNotMatch(GALLERY, /owner=\{|ownerFor|toggleHide|card_owner|card_hide|GrownCardOwner/, 'the shop page curates cards again');
  assert.doesNotMatch(SHOP, /viewerCuratesCards|ownerCheckFor/, 'the shop page keeps the hidden items for the shop again');
  assert.match(SHOP, /if \(detailsEnabled\) \{\s*for \(const g of groups\) \{\s*g\.cards = g\.cards\.map\(\(c\) =>\s*cardWithoutHidden\(/);
});

test('(B) the form gallery keeps Set as primary · Delete; the grown card only hides, never deletes', () => {
  assert.match(FORM_GALLERY, /label="Set as primary photo"/);
  assert.match(FORM_GALLERY, /label="Delete photo"/);
  // (A Set's own `.delete(key)` is the in-memory list of what is hidden, not a delete of anything stored.)
  assert.doesNotMatch(GROWN, /Delete photo|deleteVendorService|op: '[a-z_]*(?:delete|remove)/i, 'the grown card deletes');
  const ops = [...GROWN.matchAll(/op: '([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual(ops, ['card_hide'], 'the grown card calls something other than card_hide');
});

const saved = (): ServiceCard => ({
  id: 'svc-1',
  label: 'Open Bar',
  priceLabel: 'from ₱20,000',
  meta: null,
  discountLabel: null,
  inclusions: ['Bartender'],
  inclusionsMore: 0,
  inclusionsFull: ['Bartender'],
  notIncluded: ['Transport not included'],
  priceDetail: null,
  serves: 'Wedding',
  photos: ['https://u/a', 'https://u/b'],
  photoRefs: ['r2://a', 'r2://b'],
  videoUrl: null,
  record: null,
  recordRating: null,
  givesSetnayanGift: false,
  hiddenOnCard: ['photo:r2://b'],
});

test('(A) overlayTyped lays the typed name · price · included over the saved card — and nothing else', () => {
  const out = overlayTyped(saved(), {
    name: 'Mobile Bar ',
    priceText: 'from ₱35,000 · ₱350/guest',
    hasPrice: true,
    inclusionLabels: ['Bartender', ' Ice ', '', 'Glassware', 'Garnish'],
  });
  assert.equal(out.label, 'Mobile Bar');
  assert.equal(out.priceLabel, 'from ₱35,000');
  assert.equal(out.priceDetail, '₱350/guest');
  assert.deepEqual(out.inclusions, ['Bartender', 'Ice', 'Glassware']);
  assert.equal(out.inclusionsMore, 1);
  assert.deepEqual(out.inclusionsFull, ['Bartender', 'Ice', 'Glassware', 'Garnish']);
  // Everything else is the saved card, as couples get it.
  const { label: _l, priceLabel: _p, priceDetail: _d, inclusions: _i, inclusionsMore: _m, inclusionsFull: _f, ...rest } = out;
  const { label: _l2, priceLabel: _p2, priceDetail: _d2, inclusions: _i2, inclusionsMore: _m2, inclusionsFull: _f2, ...savedRest } = saved();
  assert.deepEqual(rest, savedRest);
  // No price typed → the card's own words, never "Inquire"; an empty name keeps the saved one.
  const bare = overlayTyped(saved(), { name: '  ', priceText: 'from ₱—', hasPrice: false, inclusionLabels: [] });
  assert.equal(bare.priceLabel, 'Price on request');
  assert.equal(bare.label, 'Open Bar');
  assert.deepEqual(bare.inclusions, []);
});
