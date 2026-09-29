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
import { ADD_ONS, addOnHref, appStoreDetailHref, type AddOnEntry } from './add-ons-catalog';
import {
  buildOurServices,
  OUR_SERVICE_ADD_ON_KEYS,
  shownAddOnKeys,
  TOOL_HOMES,
  toolHasGoneHome,
  type OurServicesInput,
} from './our-services';
import { buildEventMenuSections, eventMenuRows, STUDIO_ABSORBED } from './customer-menu';

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

test('the services, in the owner’s order, with the owner’s names', () => {
  const cards = buildOurServices(input());
  assert.deepEqual(
    cards.map((c) => c.name),
    ['Papic', 'Live Studio', 'Gallery', 'Patiktok', 'Music Maker', 'Setnayan AI (SAI)', 'Event Hub Pro'],
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
  for (const k of ['papic', 'papic-guest', 'panood', 'live-studio-roam', 'patiktok', 'pakanta', 'setnayan-ai', 'website-pro']) {
    assert.ok(OUR_SERVICE_ADD_ON_KEYS.has(k), `${k} would show twice`);
  }
});

/* ── Everything else goes home ────────────────────────────────────────────── */

const EV = path.join(APP, 'dashboard', '[eventId]');

/** How each home is PROVEN to carry its tool on main — one check per key. */
const HOME_PROOF: Record<string, () => boolean> = (() => {
  const menu = eventMenuRows(
    buildEventMenuSections(EVENT, {
      websiteEnabled: true,
      studioRows: [{ key: 'mood-board', href: addOnHref('mood-board', EVENT), name: 'Mood Board' }],
    }),
  );
  const row = (key: string) => menu.find((r) => r.key === key);
  const base = `/dashboard/${EVENT}`;
  return {
    guests: () => row('guests')?.href === `${base}/guests`,
    budget: () => row('budget')?.href === `${base}/budget`,
    schedule: () => row('schedule')?.href === `${base}/schedule`,
    'mood-board': () => !!row('mood-board'),
    seating: () => row('seat')?.href === `${base}/seating`,
    'landing-page': () => row('launch')?.href === addOnHref('landing-page', EVENT),
    rsvp: () =>
      addOnHref('rsvp', EVENT).startsWith(`${base}/website/`) &&
      row('launch')?.matchPrefix === `${base}/website`,
    checklist: () =>
      read(EV, '_components', 'event-dashboard.tsx').includes('href={`${base}/checklist`}'),
    compare: () => read(EV, 'vendors', 'page.tsx').includes('<BuildCompare'),
    'save-the-date': () =>
      read(EV, 'website', 'editor', 'page.tsx').includes('`${base}/studio/save-the-date`'),
    'animated-monogram': () =>
      STUDIO_ABSORBED.palogo?.into === 'launch' &&
      fs.existsSync(path.join(EV, 'launch', '_components', 'maker-logo.tsx')),
    // Details › Seat plan draws the shipped studio in its right part, and the
    // old page lands there.
    'indoor-blueprint': () =>
      read(EV, 'seating', '_components', 'seating-editor.tsx').includes('<BlueprintStudio') &&
      read(EV, 'studio', 'indoor-blueprint', 'page.tsx').includes("detailsDoorHref(eventId, 'seating', { seat: 'map' })"),
  };
})();

test('a tool leaves this page only for a home that carries it on main', () => {
  assert.deepEqual(
    Object.keys(TOOL_HOMES).sort(),
    Object.keys(HOME_PROOF).sort(),
    'every tool sent home needs a proof its home carries it',
  );
  for (const [key, proof] of Object.entries(HOME_PROOF)) {
    assert.ok(proof(), `${key} was sent to ${TOOL_HOMES[key]!.home}, which does not carry it`);
  }
});

test('a tool whose home is the Maker stays here where there is no Maker', () => {
  assert.equal(toolHasGoneHome('save-the-date', false), false);
  assert.equal(toolHasGoneHome('save-the-date', true), true);
  assert.equal(toolHasGoneHome('guests', false), true);
});

test('the tools with no home yet stay on this page', () => {
  for (const key of ['find-date']) {
    assert.equal(toolHasGoneHome(key, true), false, `${key} has no home yet and must stay`);
  }
});

test('the page sends both lists home, and drops the section when it is empty', () => {
  assert.match(PAGE, /freeToolOk\(t\) && !toolHasGoneHome\(t\.key, websiteOn\)/);
  assert.match(PAGE, /const onTheCards = shownAddOnKeys\(ourServices\);/);
  assert.match(PAGE, /!onTheCards\.has\(a\.key\) && !toolHasGoneHome\(a\.key, websiteOn\)/);
  assert.match(PAGE, /\{moreCount > 0 \? \(/);
});

/* ── Owner "yes to all 4" (2026-09-29) ───────────────────────────────────── */

test('Event Hub Pro can be bought upfront: ◆ + the catalogue price → the Pro page', () => {
  const pro = ADD_ONS.find((a) => a.key === 'website-pro')!;
  const priced = byKey(input({ prices: new Map([[pro.serviceKey!, '₱9,999']]) }), 'event-hub-pro');
  assert.equal(priced.stateText, 'Add for ₱9,999');
  assert.equal(priced.pro, true);
  assert.equal(priced.href, addOnHref('website-pro', EVENT));
  assert.equal(byKey(input(), 'event-hub-pro').stateText, 'See the price', 'no price is typed');
  const owned = byKey(
    input({ owned: { active: new Set([pro.serviceKey!]), pending: new Set() } }),
    'event-hub-pro',
  );
  assert.equal(owned.stateText, 'Added to your event');
  assert.equal(owned.pro, false);
});

test('Event Hub Pro is hidden where it is not offered — the store shell, no website', () => {
  // The page's `offered` is the Suite's surfaceOk, which refuses every
  // STORE_SHELL_HIDDEN_ADDON_KEYS entry in the shell; website-pro is one.
  const shell = read(LIB, 'store-shell.ts');
  assert.match(shell, /STORE_SHELL_HIDDEN_ADDON_KEYS[\s\S]*?'website-pro'/);
  assert.match(PAGE, /!\(storeShell && STORE_SHELL_HIDDEN_ADDON_KEYS\.has\(a\.key\)\)/);
  const noPro = input({ offered: (a) => a.key !== 'website-pro' });
  assert.equal(buildOurServices(noPro).some((c) => c.key === 'event-hub-pro'), false);
});

test('Thank-You Video lives under Papic, Playlist under Music Maker', () => {
  const cards = buildOurServices(input());
  const papic = cards.find((c) => c.key === 'papic')!;
  const music = cards.find((c) => c.key === 'music-maker')!;
  assert.deepEqual(papic.part && [papic.part.name, papic.part.href], [
    'Thank-You Video',
    appStoreDetailHref('thank-you', EVENT),
  ]);
  assert.deepEqual(music.part && [music.part.name, music.part.href], [
    'Playlist',
    appStoreDetailHref('playlist', EVENT),
  ]);
  const shown = shownAddOnKeys(cards);
  assert.ok(shown.has('thank-you') && shown.has('playlist'), 'the lists below would repeat them');
});

test('never unreachable: a part whose card is absent stays in the lists below', () => {
  const noSong = buildOurServices(input({ offered: (a) => a.key !== 'pakanta' }));
  assert.equal(shownAddOnKeys(noSong).has('playlist'), false, 'Playlist must fall back to the section');
  const noThankYou = buildOurServices(input({ offered: (a) => a.key !== 'thank-you' }));
  assert.equal(noThankYou.find((c) => c.key === 'papic')!.part, null, 'a part not offered is not drawn');
});
