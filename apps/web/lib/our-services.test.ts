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

/** Live Watch's card entry — the unified tile when it is appended, else Cast (the card's own `addOnKeys` order). The
 *  paid, day-of example these tests used to take from Patiktok, retired 2026-11-20 (lib/retired-products.ts). */
const LIVE = (ADD_ONS.find((a) => a.key === 'live-studio-roam') ?? ADD_ONS.find((a) => a.key === 'panood'))!;

const byKey = (i: OurServicesInput, key: string) => {
  const c = buildOurServices(i).find((s) => s.key === key);
  assert.ok(c, `no "${key}" card`);
  return c;
};

test('the services, in the owner’s order, with the owner’s names', () => {
  const cards = buildOurServices(input());
  assert.deepEqual(
    cards.map((c) => c.name),
    // Music (Music Maker) and Video booth (Patiktok) left 2026-11-20 — retired (lib/retired-products.ts).
    ['Planner', 'Papic', 'Live stream'],
  );
  // Owner d17 (2026-10-02): the plain name first, the Setnayan name small under it.
  assert.deepEqual(
    cards.map((c) => c.brand),
    ['Setnayan AI', 'Guest photos', 'Live Watch'],
  );
});

test('each card opens the page its menu row opens; Papic carries the Memories', () => {
  const cards = buildOurServices(input());
  const hrefs = Object.fromEntries(cards.map((c) => [c.key, c.href]));
  assert.equal(hrefs.papic, addOnHref('papic', EVENT));
  assert.equal(hrefs['live-studio'], addOnHref(LIVE.key, EVENT));
  assert.equal(hrefs.patiktok, undefined, 'Patiktok is retired');
  assert.equal(hrefs['music-maker'], undefined, 'Music Maker is retired');
  assert.equal(hrefs['setnayan-ai'], addOnHref('setnayan-ai', EVENT));
  // Owner 2026-09-30: "gallery inside Papic" · "Editorial inside Post Event".
  const papic = cards.find((c) => c.key === 'papic')!;
  assert.deepEqual(
    papic.parts.map((p) => [p.name, p.href]),
    [
      ['Thank-You Video', appStoreDetailHref('thank-you', EVENT)],
      ['Memories', `/dashboard/${EVENT}/galleries`],
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
test('the Memories is NEVER a More item — not even where there is no Papic card (owner 2026-10-02)', () => {
  const noPapic = buildOurServices(input({ offered: (a) => a.key !== 'papic' }));
  assert.equal(noPapic.some((c) => c.key === 'gallery'), false, 'the Gallery stands as a card again');
  assert.deepEqual(noPapic.map((c) => c.key), ['setnayan-ai', 'live-studio']);
  // The rail row and the phone More sheet draw exactly these cards.
  const kids = ourServicesMenuChildren(noPapic, '/dashboard/E/suite');
  assert.equal(kids.some((k) => k.key === 'gallery' || k.icon === 'galleries'), false);
  // On a full event it is three items (five until Music Maker and Patiktok retired 2026-11-20), none of them Gallery.
  const five = ourServicesMenuChildren(buildOurServices(input()), '/dashboard/E/suite');
  assert.equal(five.length, 3);
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
  // Live Watch's tile is free to start; a paid tile is the same card with no free tier (Patiktok, the old example, is
  // retired), so the price rule is exercised on exactly the builder's own code path.
  const paidCatalogue = ADD_ONS.map((a) => (a.key === LIVE.key ? { ...a, tier: undefined, freeTrial: undefined } : a));
  const priced = byKey(input({ catalogue: paidCatalogue, prices: new Map([[LIVE.serviceKey!, '₱1,234']]) }), 'live-studio');
  assert.equal(priced.state, 'price');
  assert.equal(priced.stateText, 'Add for ₱1,234');
  assert.equal(priced.pro, true, 'a paid service not yet added carries the ◆');

  const unknown = byKey(input({ catalogue: paidCatalogue }), 'live-studio');
  assert.equal(unknown.state, 'unpriced');
  assert.equal(unknown.stateText, 'See the price');
  assert.doesNotMatch(unknown.stateText, /free|₱\s*0/i);

  // No peso figure is ever written into the builder itself.
  const src = read(LIB, 'our-services.ts').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  assert.doesNotMatch(src, /₱\s*\d|\bPHP\s*\d/, 'a price was typed into lib/our-services.ts');
});

test('owned beats every other state; pending says so', () => {
  const owned = input({
    owned: { active: new Set([LIVE.serviceKey!]), pending: new Set() },
    sellableNow: () => false, // the day has passed — a paid service stays open
  });
  const c = byKey(owned, 'live-studio');
  assert.equal(c.state, 'added');
  assert.equal(c.href, addOnHref(LIVE.key, EVENT));
  assert.equal(c.pro, false);

  const pending = byKey(
    input({ owned: { active: new Set(), pending: new Set([LIVE.serviceKey!]) } }),
    'live-studio',
  );
  assert.equal(pending.state, 'pending');

  const papic = byKey(
    input({ owned: { active: new Set(['PAPIC_GUEST']), pending: new Set() } }),
    'papic',
  );
  assert.equal(papic.state, 'added', 'the Papic Pool means Papic is on');
});

test('a day-of service not owned closes after the day, inert with a reason', () => {
  const c = byKey(input({ sellableNow: (a: AddOnEntry) => !a.dayOfOnly }), 'live-studio');
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
  const noAi = input({ offered: (a) => a.key !== 'setnayan-ai' });
  assert.equal(buildOurServices(noAi).some((c) => c.key === 'setnayan-ai'), false);
});

test('the store shell drops what it refuses', () => {
  const shell = input({ refusesPath: (p) => p.includes('/studio/') });
  assert.deepEqual(
    buildOurServices(shell).map((c) => c.key),
    [],
  );
});

/* ── The page ─────────────────────────────────────────────────────────────── */

/*
  The page tests ("the Suite route IS Our Services", "the lists below leave the
  six out") left 2026-10-02 with the page (owner, tracker d1: "remove the old
  full-page More Services — the More menu is the one place"). The cards are
  still built here and drawn by the menu — `more-services-is-the-one-row-that-
  opens.test.ts` and `legacy-redirects.test.ts` hold that.
*/

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
    // 💰 Budget is Home's page since 2026-11-01 (owner: "Okay place it in home"): Home lights /budget.
    budget: () => Boolean(row('home')?.alsoMatch?.includes(`${base}/budget`)) && fs.existsSync(path.join(EV, 'budget', 'page.tsx')),
    // 📅 Home's page since 2026-11-02 ("BOOKED IS JUST THE TEAM") — the Maker still draws it inside Details.
    schedule: () =>
      Boolean(row('home')?.alsoMatch?.includes(`${base}/schedule`)) &&
      (DETAILS_ITEM_KEYS as readonly string[]).includes('schedule') &&
      fs.existsSync(path.join(EV, 'schedule', 'page.tsx')),
    'mood-board': () =>
      (DETAILS_ITEM_KEYS as readonly string[]).includes('mood-board') &&
      read(EV, 'studio', 'mood-board', 'page.tsx').includes("redirect(detailsItemHref(eventId, 'mood-board'))"),
    // 🗂 R4: the seat plan is Guests › Seats — its old page lands there, and the Guests row lights it.
    seating: () =>
      read(EV, 'seating', 'page.tsx').includes("redirect(guestsViewHref(eventId, 'seats'") &&
      Boolean(row('guests')?.alsoMatch?.includes(`${base}/seating`)) &&
      !row('seat'),
    'landing-page': () => row('launch')?.href === addOnHref('landing-page', EVENT),
    rsvp: () =>
      addOnHref('rsvp', EVENT).startsWith(`${base}/website/`) &&
      row('launch')?.matchPrefix === `${base}/website`,
    checklist: () =>
      // The Checklist merged into Planning Stage (owner 2026-11-01): the doorway opens its To do filter.
      read(EV, '_components', 'event-dashboard.tsx').includes('href={planningTodoHref(eventId)}'),
    compare: () => read(EV, 'vendors', 'page.tsx').includes('<BuildCompare'),
    'save-the-date': () =>
      read(EV, 'website', 'editor', 'page.tsx').includes('`${base}/studio/save-the-date`'),
    'animated-monogram': () =>
      STUDIO_ABSORBED.palogo?.into === 'launch' &&
      fs.existsSync(path.join(EV, 'launch', '_components', 'maker-logo.tsx')),
    // Guests › Seats draws the shipped studio in its right part (R4), and the old page lands there.
    'indoor-blueprint': () =>
      read(EV, 'seating', '_components', 'seating-editor.tsx').includes('<BlueprintStudio') &&
      read(EV, 'studio', 'indoor-blueprint', 'page.tsx').includes("guestsViewHref(eventId, 'seats', { seat: 'map' })"),
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
});

/* ── Owner "yes to all 4" (2026-09-29) ───────────────────────────────────── */

test('Event Pro is not a card — it is unlocked at the Maker’s Apply', () => {
  // Owner 2026-09-30: "Event Pro has its own place too".
  assert.equal(buildOurServices(input()).some((c) => c.key === 'event-hub-pro'), false);
  assert.ok(OUR_SERVICE_ADD_ON_KEYS.has('website-pro'), 'the lists below would bring it back');
});

test('Thank-You Video lives under Papic; Playlist falls to the lists below now Music Maker is retired', () => {
  const cards = buildOurServices(input());
  const papic = cards.find((c) => c.key === 'papic')!;
  assert.deepEqual(papic.parts[0] && [papic.parts[0].name, papic.parts[0].href], [
    'Thank-You Video',
    appStoreDetailHref('thank-you', EVENT),
  ]);
  assert.equal(cards.some((c) => c.key === 'music-maker'), false, 'Music Maker is retired (2026-11-20)');
  const shown = shownAddOnKeys(cards);
  assert.ok(shown.has('thank-you'), 'the lists below would repeat it');
  assert.equal(shown.has('playlist'), false, 'Playlist (free) must stay reachable in the lists below');
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
