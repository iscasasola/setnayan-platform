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
  ourServicesMenuChildren,
  OUR_SERVICE_ADD_ON_KEYS,
  shownAddOnKeys,
  TOOL_HOMES,
  toolHasGoneHome,
  type OurServicesInput,
} from './our-services';
import { buildEventMenuSections, eventMenuRows, STUDIO_ABSORBED } from './customer-menu';
import { yourTeamParts } from './pillar-parts';
import { DETAILS_ITEM_KEYS } from './maker-details-items';

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
    ['Setnayan AI (SAI)', 'Papic', 'Live Watch', 'Music Maker', 'Patiktok'],
  );
});

test('each card opens the page its menu row opens; Papic carries the Gallery', () => {
  const cards = buildOurServices(input());
  const hrefs = Object.fromEntries(cards.map((c) => [c.key, c.href]));
  assert.equal(hrefs.papic, addOnHref('papic', EVENT));
  assert.equal(hrefs.patiktok, addOnHref('patiktok', EVENT));
  assert.equal(hrefs['music-maker'], addOnHref('pakanta', EVENT));
  assert.equal(hrefs['setnayan-ai'], addOnHref('setnayan-ai', EVENT));
  // Owner 2026-09-30: "gallery inside Papic" · "Editorial inside Post Event".
  const papic = cards.find((c) => c.key === 'papic')!;
  assert.deepEqual(
    papic.parts.map((p) => [p.name, p.href]),
    [
      ['Thank-You Video', appStoreDetailHref('thank-you', EVENT)],
      ['Gallery', `/dashboard/${EVENT}/galleries`],
    ],
  );
  assert.equal(cards.some((c) => c.key === 'gallery'), false, 'the Gallery is not a card beside Papic');
  assert.equal(
    cards.some((c) => c.parts.some((p) => p.key === 'editorial')),
    false,
    'Editorial lives in the Maker’s Post Event, not here',
  );
  assert.ok(OUR_SERVICE_ADD_ON_KEYS.has('editorial'), 'the lists below would bring Editorial back');
});

// SABOTAGE: restore a standalone Gallery card in buildOurServices → RED.
test('the Gallery is NEVER a More item — not even where there is no Papic card (owner 2026-10-02)', () => {
  const noPapic = buildOurServices(input({ offered: (a) => a.key !== 'papic' }));
  assert.equal(noPapic.some((c) => c.key === 'gallery'), false, 'the Gallery stands as a card again');
  assert.deepEqual(noPapic.map((c) => c.key), ['setnayan-ai', 'live-studio', 'music-maker', 'patiktok']);
  // The rail row and the phone More sheet draw exactly these cards.
  const kids = ourServicesMenuChildren(noPapic, '/dashboard/E/suite');
  assert.equal(kids.some((k) => k.key === 'gallery' || k.icon === 'galleries'), false);
  // On a full event it is five items, none of them Gallery.
  const five = ourServicesMenuChildren(buildOurServices(input()), '/dashboard/E/suite');
  assert.equal(five.length, 5);
  assert.equal(five.some((k) => /gallery/i.test(k.label) || /\/galleries/.test(k.href)), false);
});

test('Live Watch is whichever livestream tile the event is offered — never both', () => {
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
    [],
  );
});

/* ── The page ─────────────────────────────────────────────────────────────── */

const SUITE_DIR = path.join(APP, 'dashboard', '[eventId]', 'suite');
const PAGE = read(SUITE_DIR, 'page.tsx');
const GRID = read(SUITE_DIR, '_components', 'our-services-grid.tsx');

test('the Suite route IS Our Services: six cards first, as CollectionCards', () => {
  assert.match(PAGE, /metadata = \{ title: 'More Services' \}/);
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
    // Stage D: Budget is Your Team's part; Schedule and the Mood Board are
    // Details items, and their old pages land there for the couple.
    budget: () =>
      row('explore')?.href === `${base}/vendors` &&
      yourTeamParts({ eventId: EVENT, budgetEnabled: true }).some((p) => p.key === 'budget') &&
      read(EV, 'budget', 'page.tsx').includes('redirect(yourTeamBudgetHref(eventId))'),
    schedule: () =>
      (DETAILS_ITEM_KEYS as readonly string[]).includes('schedule') &&
      read(EV, 'schedule', 'page.tsx').includes("redirect(detailsDoorHref(eventId, 'schedule'"),
    'mood-board': () =>
      (DETAILS_ITEM_KEYS as readonly string[]).includes('mood-board') &&
      read(EV, 'studio', 'mood-board', 'page.tsx').includes("redirect(detailsItemHref(eventId, 'mood-board'))"),
    seating: () =>
      (DETAILS_ITEM_KEYS as readonly string[]).includes('seating') &&
      read(EV, 'seating', 'page.tsx').includes("redirect(detailsDoorHref(eventId, 'seating'") &&
      !row('seat'),
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
    // Details › Date draws the finder's candidates beside the date row.
    'find-date': () =>
      read(EV, 'launch', '_components', 'details-your-event.tsx').includes('<FindDateCandidates') &&
      fs.existsSync(path.join(EV, 'launch', '_components', 'details-date-finder.tsx')),
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

test('Find your date leaves for Details › Date — but stays where there is no Maker', () => {
  assert.equal(toolHasGoneHome('find-date', true), true);
  assert.equal(toolHasGoneHome('find-date', false), false);
});

test('the lead never recommends a retired (utility) card — Event, Photo Delivery', () => {
  // Both went home long ago (Event → the Maker, Photo Delivery → Papic); the
  // lists dropped them, the "Recommended for you now" row did not (owner 2026-09-30).
  for (const key of ['event', 'photo-delivery']) {
    assert.equal(ADD_ONS.find((a) => a.key === key)?.studioGroup, 'utility', key);
  }
  assert.match(PAGE, /e\.status !== 'coming_soon' &&\s*e\.studioGroup !== 'utility' &&/);
});

test('the page sends both lists home, and drops the section when it is empty', () => {
  assert.match(PAGE, /freeToolOk\(t\) && !toolHasGoneHome\(t\.key, websiteOn\)/);
  assert.match(PAGE, /const onTheCards = shownAddOnKeys\(ourServices\);/);
  assert.match(PAGE, /!onTheCards\.has\(a\.key\) && !toolHasGoneHome\(a\.key, websiteOn\)/);
  assert.match(PAGE, /\{moreCount > 0 \? \(/);
});

/* ── Owner "yes to all 4" (2026-09-29) ───────────────────────────────────── */

test('Event Hub Pro is not a card — it is unlocked at the Maker’s Apply', () => {
  // Owner 2026-09-30: "Event Hub Pro has its own place too".
  assert.equal(buildOurServices(input()).some((c) => c.key === 'event-hub-pro'), false);
  assert.ok(OUR_SERVICE_ADD_ON_KEYS.has('website-pro'), 'the lists below would bring it back');
});

test('Thank-You Video lives under Papic, Playlist under Music Maker', () => {
  const cards = buildOurServices(input());
  const papic = cards.find((c) => c.key === 'papic')!;
  const music = cards.find((c) => c.key === 'music-maker')!;
  assert.deepEqual(papic.parts[0] && [papic.parts[0].name, papic.parts[0].href], [
    'Thank-You Video',
    appStoreDetailHref('thank-you', EVENT),
  ]);
  assert.deepEqual(music.parts.map((p) => [p.name, p.href]), [
    ['Playlist', appStoreDetailHref('playlist', EVENT)],
  ]);
  const shown = shownAddOnKeys(cards);
  assert.ok(shown.has('thank-you') && shown.has('playlist'), 'the lists below would repeat them');
});

test('never unreachable: a part whose card is absent stays in the lists below', () => {
  const noSong = buildOurServices(input({ offered: (a) => a.key !== 'pakanta' }));
  assert.equal(shownAddOnKeys(noSong).has('playlist'), false, 'Playlist must fall back to the section');
  const noThankYou = buildOurServices(input({ offered: (a) => a.key !== 'thank-you' }));
  assert.deepEqual(
    noThankYou.find((c) => c.key === 'papic')!.parts.map((p) => p.key),
    ['gallery'],
    'a part not offered is not drawn',
  );
});
