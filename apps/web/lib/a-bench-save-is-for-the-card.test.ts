/**
 * A BENCH SAVE IS FOR THE CARD THE COUPLE WAS LOOKING AT.
 *
 * The owner's live test round 1 (2026-09-11), couple testnayan4 and supplier
 * Saysay — a shop with TWO untitled cards made in the same statement: a Live
 * Band card with a cover (`live_band`) and a Host / MC card without one
 * (`host_mc`), and no shop logo.
 *
 * 🔴 1 · SAVED FROM "More in Live Band", THE PICK KEPT NO CARD. The save posted
 * only the shop, so `event_vendors.service_id` stayed NULL: the saved card lost
 * the Live Band card's cover, price and inclusions, and the inquiry anchored on
 * "the first active service" — an unordered read over two cards with one
 * timestamp.
 * 🔴 2 · THE SEARCH CARD DREW "SL" FOR A SHOP WITH A COVER. The bench search
 * dropped the cover the recommendations read had already resolved.
 * 🔴 4 · THE THREAD SAID "Inquiring about Miscellaneous" (and "Band / DJ"). The
 * chip fell to the interest's COARSE key when the card had no title; the card's
 * own category was never asked.
 * 🔴 3 · THE PERK LINE PRINTED MARKDOWN, RAW KEYS AND A RETIRED NAME:
 * `**Setnayan Exclusive unlocked 🎁** live_band: …`. Old rows are READ into the
 * new wording at render; the stored text is not rewritten.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { benchCardImage } from './bench-card-image';
import { cardForTile, type ShopCard } from './bench-save-card';
import { parsePerkUnlock, perkUnlockBody, renderPerkUnlock, shortPerkUnlock } from './perk-unlock-message';
import { stripComments } from './strip-comments';
import { interestChipLabel } from './thread-interests';
import { canonicalServicesForTile } from './vendor-counts';
import { shortenGeneratedBody } from './conversation-list';

const WEB = join(import.meta.dirname, '..');
const code = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

// Saysay as measured in production — same created_at on both cards.
const AT = '2026-09-10T03:12:44.101+00';
const SAYSAY: ShopCard[] = [
  { vendor_service_id: 'e7e4c742-host', category: 'host_mc', created_at: AT },
  { vendor_service_id: 'db383ac7-band', category: 'live_band', created_at: AT },
];

test('1 · the tile names the card — including a card that stores the tile id', () => {
  const band = cardForTile(SAYSAY, 'live_band', canonicalServicesForTile('live_band'));
  assert.equal(band?.vendor_service_id, 'db383ac7-band');
  // `host_mc` is NOT one of its tile's canonicals (host_emcee · tea_ceremony_master);
  // shops store the tile id, so the tile id has to match too.
  assert.ok(!canonicalServicesForTile('host_mc').includes('host_mc'), 'premise moved: host_mc became its own canonical');
  const host = cardForTile(SAYSAY, 'host_mc', canonicalServicesForTile('host_mc'));
  assert.equal(host?.vendor_service_id, 'e7e4c742-host', 'a Host / MC save found no card — the tile id is not being matched');
  // a tile the shop has no card in picks nothing (the save falls back to the shop)
  assert.equal(cardForTile(SAYSAY, 'cake', canonicalServicesForTile('cake')), null);
  // a card stored under a canonical still matches
  const canon: ShopCard[] = [{ vendor_service_id: 'x', category: 'host_emcee', created_at: AT }];
  assert.equal(cardForTile(canon, 'host_mc', canonicalServicesForTile('host_mc'))?.vendor_service_id, 'x');
});

test('1b · two cards in one tile resolve the same way every time', () => {
  const two: ShopCard[] = [
    { vendor_service_id: 'bbb', category: 'live_band', created_at: AT },
    { vendor_service_id: 'aaa', category: 'band_live_music', created_at: AT },
    { vendor_service_id: 'zzz', category: 'live_band', created_at: '2026-01-01T00:00:00+00' },
  ];
  const pick = (cards: ShopCard[]) => cardForTile(cards, 'live_band', canonicalServicesForTile('live_band'))?.vendor_service_id;
  assert.equal(pick(two), 'zzz', 'the earliest card should win');
  const tied = two.slice(0, 2);
  assert.equal(pick(tied), 'aaa');
  assert.equal(pick([...tied].reverse()), 'aaa', 'a tie is broken by the read order — not deterministic');
});

test('1c · every bench save says which tile, and the save records that card', () => {
  const bench = code('app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx');
  assert.match(bench, /if \(moreTile\) fd\.set\('tile', moreTile\)/, '"More in X" saves the shop, not the card, again');
  const sheet = code('app/dashboard/[eventId]/vendors/_components/category-search-overlay.tsx');
  assert.match(sheet, /if \(tile\) fd\.set\('tile', tile\)/, 'the search sheet saves the shop, not the card, again');
  assert.match(sheet, /fd\.set\('event_id', eventId\)/, 'the search sheet no longer says which event');

  const save = code('app/(shell)/explore/actions.ts');
  assert.match(save, /formData\.get\('tile'\)/);
  assert.match(save, /service_id: tileCard\?\.vendor_service_id \?\? null/, 'the new pick no longer records its card');
  assert.match(save, /category = tileCategory \?\? coerceCategory\(/, 'the pick is filed by the shop’s first service again');
  // a re-save may fill a missing card, but never MOVE a pick between tiles
  assert.match(
    save,
    /existing\.service_id == null && tileCategory && existing\.category === tileCategory/,
    'a re-save can now overwrite or move an existing pick',
  );
});

test('1d · the inquiry’s fallback card is chosen by an ORDER, not by chance', () => {
  const src = code('app/dashboard/[eventId]/vendors/_actions/contact-shortlist-vendor.ts');
  assert.match(src, /\.order\('created_at', \{ ascending: true \}\)\s*\.order\('vendor_service_id', \{ ascending: true \}\)/);
});

test('2 · the search card shows the service card’s cover before the logo', () => {
  assert.equal(benchCardImage({ photoUrl: 'cover.jpg', logoUrl: 'logo.png' }), 'cover.jpg');
  assert.equal(benchCardImage({ photoUrl: '  ', logoUrl: 'logo.png' }), 'logo.png');
  assert.equal(benchCardImage({ photoUrl: null, logoUrl: null }), null, 'no picture → the caller draws initials');
  const search = code('app/dashboard/[eventId]/vendors/_actions/category-search.ts');
  assert.match(search, /photoUrl: r\.primary_photo_url \?\? null/, 'the search dropped the card cover again');
  for (const f of ['shortlist-categories.tsx', 'category-search-overlay.tsx']) {
    const src = code(`app/dashboard/[eventId]/vendors/_components/${f}`);
    assert.match(src, /benchCardImage\((v|r)\)/, `${f} draws the logo only again`);
  }
});

test('4 · the interest chip asks the card what it is before the coarse key', () => {
  // Cale & Ice: interest written before the save fix → key `misc`, card is Live Band
  assert.equal(interestChipLabel({ category_key: 'misc' }, null, 'live_band'), 'Live Band');
  // testnayan4 × Saysay: coarse `band_dj`, card is Live Band
  assert.equal(interestChipLabel({ category_key: 'band_dj' }, null, 'live_band'), 'Live Band');
  assert.equal(interestChipLabel({ category_key: 'band_dj' }, null, 'host_mc'), 'Host / MC');
  // a card title still wins; no card at all keeps the old fallback
  assert.equal(interestChipLabel({ category_key: 'misc' }, 'Saysay Live', 'live_band'), 'Saysay Live');
  assert.equal(interestChipLabel({ category_key: 'band_dj' }), 'Band / DJ');
  assert.equal(interestChipLabel({ category_key: null }), 'Service');
});

test('4b · every thread surface labels interests through the one labeller', () => {
  for (const f of [
    'app/_components/thread-interest-chips.tsx',
    'app/dashboard/[eventId]/messages/[threadId]/page.tsx',
    'app/vendor-dashboard/messages/[threadId]/page.tsx',
  ]) {
    const src = code(f);
    assert.match(src, /interestLabeller\(/, `${f} stopped using interestLabeller`);
    assert.ok(!/interestChipLabel\(/.test(src), `${f} labels an interest without asking its card`);
  }
});

const OLD = '**Setnayan Exclusive unlocked 🎁** live_band: Free 1-hour extension for Setnayan couples';

test('3 · an OLD perk line reads in the new words — stored text untouched', () => {
  const shown = renderPerkUnlock(OLD);
  assert.equal(shown, '🎁 A perk for Setnayan couples · Live Band — Free 1-hour extension for Setnayan couples');
  assert.equal(renderPerkUnlock('**Setnayan Exclusive unlocked 🎁** host_mc: FREE'), '🎁 A perk for Setnayan couples · Host / MC — FREE');
  for (const s of [shown, shortPerkUnlock(OLD)!, shortenGeneratedBody(OLD)]) {
    assert.ok(!/\*\*|live_band|Exclusive/.test(s), `markdown, a raw key or the retired name reached a person: ${s}`);
  }
  assert.equal(shortenGeneratedBody(OLD), '🎁 Perk: Live Band', 'the list / What’s new preview');
});

test('3b · the NEW line round-trips, and nothing else is touched', () => {
  const body = perkUnlockBody('live_band', '  Free 1-hour extension  ');
  assert.equal(body, '🎁 A perk for Setnayan couples · Live Band — Free 1-hour extension');
  assert.deepEqual(parsePerkUnlock(body), { label: 'Live Band', perk: 'Free 1-hour extension' });
  assert.equal(renderPerkUnlock(body), body);
  // a titled card keeps its title as written
  assert.equal(perkUnlockBody('Saysay Band', 'FREE'), '🎁 A perk for Setnayan couples · Saysay Band — FREE');
  // any other system line passes through
  assert.equal(renderPerkUnlock('Deposit received'), 'Deposit received');
  assert.equal(shortPerkUnlock('Deposit received'), null);
});

test('3c · the writer and the chat both go through the one module', () => {
  assert.match(code('lib/chat-actions.ts'), /perkUnlockBody\(label, s\.exclusive_perk_text\)/);
  assert.match(code('app/_components/chat-message-stream.tsx'), /renderPerkUnlock\(m\.body \?\? ''\)/, 'the chat prints a stored perk line raw again');
});
