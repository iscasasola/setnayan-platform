/**
 * our-services.test.ts — the event's Our Services page (owner 2026-09-29).
 *
 * What must stay true:
 *   1. The six services, in the owner's order, with the owner's names — Papic ·
 *      Live Studio · Gallery · Patiktok · Music Maker · Setnayan AI (SAI).
 *   2. Each card opens the SAME page its event-menu row opens (`addOnHref`).
 *   3. A price only ever comes from the catalogue read; a missing one says so.
 *   4. Owned beats everything, and a day-of service closes after the day.
 *   5. The page renders them as `CollectionCard`s, first, on the /suite route,
 *      and the lists below never show one of the six a second time.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADD_ONS, addOnHref, type AddOnEntry } from './add-ons-catalog';
import { buildOurServices, OUR_SERVICE_ADD_ON_KEYS, type OurServicesInput } from './our-services';

const LIB = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(LIB, '..', 'app');
const read = (...p: string[]) => fs.readFileSync(path.join(...p), 'utf8');
const EVENT = 'evt-1';

/** Every catalogue entry offered, nothing owned, nothing closed. */
function input(over: Partial<OurServicesInput> = {}): OurServicesInput {
  return {
    eventId: EVENT,
    catalogue: ADD_ONS,
    owned: { active: new Set(), pending: new Set() },
    prices: new Map(),
    offered: () => true,
    sellableNow: () => true,
    aiSellable: true,
    papicOwnedBy: ['PAPIC_UNLOCK', 'PAPIC_SEATS', 'PAPIC_GUEST'],
    refusesPath: () => false,
    ...over,
  };
}

const byKey = (i: OurServicesInput, key: string) => {
  const c = buildOurServices(i).find((s) => s.key === key);
  assert.ok(c, `no "${key}" card`);
  return c;
};

test('the six services, in the owner’s order, with the owner’s names', () => {
  const cards = buildOurServices(input());
  assert.deepEqual(
    cards.map((c) => c.name),
    ['Papic', 'Live Studio', 'Gallery', 'Patiktok', 'Music Maker', 'Setnayan AI (SAI)'],
  );
});

test('each card opens the page its menu row opens; Gallery carries Editorial', () => {
  const cards = buildOurServices(input());
  const hrefs = Object.fromEntries(cards.map((c) => [c.key, c.href]));
  assert.equal(hrefs.papic, addOnHref('papic', EVENT));
  assert.equal(hrefs.patiktok, addOnHref('patiktok', EVENT));
  assert.equal(hrefs['music-maker'], addOnHref('pakanta', EVENT));
  assert.equal(hrefs['setnayan-ai'], addOnHref('setnayan-ai', EVENT));
  assert.equal(hrefs.gallery, `/dashboard/${EVENT}/galleries`);
  const gallery = cards.find((c) => c.key === 'gallery')!;
  assert.deepEqual(
    gallery.part && { name: gallery.part.name, href: gallery.part.href },
    { name: 'Editorial', href: `/dashboard/${EVENT}/story` },
  );
});

test('Live Studio is whichever livestream tile the event is offered — never both', () => {
  const onlyCast = input({ offered: (a) => a.key !== 'live-studio-roam' });
  assert.equal(byKey(onlyCast, 'live-studio').href, addOnHref('panood', EVENT));
  const hasRoam = ADD_ONS.some((a) => a.key === 'live-studio-roam');
  if (hasRoam) {
    const onlyRoam = input({ offered: (a) => a.key !== 'panood' });
    assert.equal(byKey(onlyRoam, 'live-studio').href, addOnHref('live-studio-roam', EVENT));
  }
  const none = input({ offered: (a) => a.key !== 'panood' && a.key !== 'live-studio-roam' });
  assert.equal(buildOurServices(none).some((c) => c.key === 'live-studio'), false);
});

test('a price comes only from the catalogue read — and a missing one is not free', () => {
  const patiktok = ADD_ONS.find((a) => a.key === 'patiktok')!;
  const priced = byKey(input({ prices: new Map([[patiktok.serviceKey!, '₱1,234']]) }), 'patiktok');
  assert.equal(priced.state, 'price');
  assert.equal(priced.stateText, 'Add for ₱1,234');
  assert.equal(priced.pro, true, 'a paid service not yet added carries the ◆');

  const unknown = byKey(input(), 'patiktok');
  assert.equal(unknown.state, 'unpriced');
  assert.equal(unknown.stateText, 'See the price');
  assert.doesNotMatch(unknown.stateText, /free|₱\s*0/i);

  // No peso figure is ever written into the builder itself.
  const src = read(LIB, 'our-services.ts').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  assert.doesNotMatch(src, /₱\s*\d|\bPHP\s*\d/, 'a price was typed into lib/our-services.ts');
});

test('owned beats every other state; pending says so', () => {
  const patiktok = ADD_ONS.find((a) => a.key === 'patiktok')!;
  const owned = input({
    owned: { active: new Set([patiktok.serviceKey!]), pending: new Set() },
    sellableNow: () => false, // the day has passed — a paid service stays open
  });
  const c = byKey(owned, 'patiktok');
  assert.equal(c.state, 'added');
  assert.equal(c.href, addOnHref('patiktok', EVENT));
  assert.equal(c.pro, false);

  const pending = byKey(
    input({ owned: { active: new Set(), pending: new Set([patiktok.serviceKey!]) } }),
    'patiktok',
  );
  assert.equal(pending.state, 'pending');

  const papic = byKey(
    input({ owned: { active: new Set(['PAPIC_GUEST']), pending: new Set() } }),
    'papic',
  );
  assert.equal(papic.state, 'added', 'the Papic Pool means Papic is on');
});

test('a day-of service not owned closes after the day, inert with a reason', () => {
  const c = byKey(input({ sellableNow: (a: AddOnEntry) => !a.dayOfOnly }), 'patiktok');
  assert.equal(c.state, 'closed');
  assert.equal(c.href, null);
  assert.ok(c.inertReason && c.inertReason.length > 0);
});

test('Setnayan AI with no price for this event type is not offered (unless owned)', () => {
  assert.equal(
    buildOurServices(input({ aiSellable: false })).some((c) => c.key === 'setnayan-ai'),
    false,
  );
  const owned = input({
    aiSellable: false,
    owned: { active: new Set(['SETNAYAN_AI']), pending: new Set() },
  });
  assert.equal(byKey(owned, 'setnayan-ai').state, 'added');
});

test('a service the event type is not offered drops its card', () => {
  const noSong = input({ offered: (a) => a.key !== 'pakanta' });
  assert.equal(buildOurServices(noSong).some((c) => c.key === 'music-maker'), false);
});

test('the store shell drops what it refuses', () => {
  const shell = input({ refusesPath: (p) => p.includes('/studio/') });
  assert.deepEqual(
    buildOurServices(shell).map((c) => c.key),
    ['gallery'],
  );
});

/* ── The page ─────────────────────────────────────────────────────────────── */

const SUITE_DIR = path.join(APP, 'dashboard', '[eventId]', 'suite');
const PAGE = read(SUITE_DIR, 'page.tsx');
const GRID = read(SUITE_DIR, '_components', 'our-services-grid.tsx');

test('the Suite route IS Our Services: six cards first, as CollectionCards', () => {
  assert.match(PAGE, /metadata = \{ title: 'Our Services' \}/);
  assert.match(PAGE, /buildOurServices\(\{/);
  assert.match(PAGE, /offered: surfaceOk,/, 'the cards must use the Suite’s own offered gate');
  assert.match(PAGE, /prices: priceMap,/, 'the cards must read the catalogue prices');
  const grid = PAGE.indexOf('<OurServicesGrid');
  const search = PAGE.indexOf('<SuiteSearch');
  assert.ok(grid > 0 && search > grid, 'the six cards must come before everything else');
  assert.match(GRID, /<CollectionCard\b/, 'the card is the repo’s one card');
});

test('the lists below leave the six out, so nothing shows twice', () => {
  assert.match(PAGE, /const eligible = ADD_ONS\.filter\(\s*\(a\) =>\s*notOurs\(a\) &&/);
  assert.match(PAGE, /notOurs\(e\) &&/, 'the recommendations must skip the six too');
  for (const k of ['papic', 'papic-guest', 'panood', 'live-studio-roam', 'patiktok', 'pakanta', 'setnayan-ai']) {
    assert.ok(OUR_SERVICE_ADD_ON_KEYS.has(k), `${k} would show twice`);
  }
});
