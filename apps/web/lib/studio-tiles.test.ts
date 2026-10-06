/**
 * 🗂 THE STUDIO HOME'S ELEVEN TILES (owner 2026-10-06, DECISION_LOG "STUDIO OPENS
 * ON A HOME OF TEN TILES…" + "PRINTS IS THE ELEVENTH STUDIO TILE").
 *
 *   1. Eleven keys, in the order an event gets made — Prints the eleventh.
 *   2. Each tile's ✓ / Missing IS the shipped "done" of the item it opens: the
 *      Details rows' and the guided flow's `guidedItemDone` over the same facts,
 *      `wordsAndPlansItem` for the Schedule and the Love Story, the RSVP setup
 *      step's own done, the counts the page read. Never a second truth.
 *   3. A fact that was not read makes no claim — never a "Missing" nobody measured.
 *   4. Each tile opens a real Event Details item.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STUDIO_TILE_KEYS, STUDIO_TILES, studioReady, studioTiles, type StudioTilesInput } from './studio-tiles';
import { guidedItemDone, wordsAndPlansInputFrom, type GuidedDoneFacts } from './details-guided-flow';
import { DETAILS_ITEM_KEYS, wordsAndPlansItem, type DetailsItemKey } from './maker-details-items';
import { hubSetupDone, type HubSetupFacts } from './hub-setup-steps';
import { parsePrintDetails } from './print-pieces';
import type { YourEventFacts } from './details-your-event';

const YE: YourEventFacts = {
  names: ['Maria', 'Jose'],
  date: { value: '2027-06-12', dayPrecise: true },
  venueCount: 2,
  parentCount: 2,
  hostCount: 0,
  marchLines: 9,
};

function facts(over: Partial<GuidedDoneFacts> = {}, moments: { story: number | null; schedule: number | null } = { story: 3, schedule: 0 }): GuidedDoneFacts {
  const words = wordsAndPlansInputFrom({
    specialMessage: 'Two hearts, one home',
    pabuyaMessage: null,
    stored: parsePrintDetails({}),
    loveStoryMoments: moments.story,
    scheduleMoments: moments.schedule,
  });
  return { yourEvent: YE, kind: null, themeChosen: true, palette: false, logo: true, hero: false, words, seatPlanArranged: false, ...over };
}

const SETUP: HubSetupFacts = {
  guestList: true,
  arrival: null,
  venuesLocked: null,
  venuesNamed: null,
  loveStoryMoments: 3,
  wear: null,
  replyBy: true,
  guests: 120,
};

const all = (): boolean => true;
function input(over: Partial<StudioTilesInput> = {}): StudioTilesInput {
  return { facts: facts(), setup: SETUP, giftMethods: 2, seat: { tables: 12, seated: 0 }, offered: all, ...over };
}

test('1 · eleven tiles, in the order an event gets made — Prints is the eleventh', () => {
  assert.deepEqual(
    [...STUDIO_TILE_KEYS],
    ['info', 'look', 'logo', 'mood', 'schedule', 'story', 'march', 'seats', 'gifts', 'rsvp', 'prints'],
  );
  const tiles = studioTiles(input());
  assert.equal(tiles.length, 11);
  assert.deepEqual(
    tiles.map((t) => t.label),
    ['Info', 'Look', 'Logo', 'Mood Board & Dress Code', 'Schedule', 'Love Story', 'Wedding March', 'Seat plan', 'E-Gifts', 'RSVP', 'Prints'],
  );
  assert.equal(tiles[10]!.key, 'prints');
  assert.deepEqual(tiles.filter((t) => t.immersive).map((t) => t.key), ['march', 'seats'], 'only the Wedding March and the Seat plan go full screen');
});

test('2 · each tile opens a real Event Details item', () => {
  for (const k of STUDIO_TILE_KEYS) {
    assert.ok((DETAILS_ITEM_KEYS as readonly string[]).includes(STUDIO_TILES[k].item), `${k} opens "${STUDIO_TILES[k].item}", which is no Details item`);
  }
});

test('3 · ✓ / Missing IS the shipped "done" — the same function the Details rows and the guided flow read', () => {
  for (const f of [facts(), facts({ themeChosen: false, palette: true, logo: false, seatPlanArranged: true }), facts({}, { story: 0, schedule: 4 })]) {
    const tiles = studioTiles(input({ facts: f }));
    const done = (k: string) => tiles.find((t) => t.key === k)!.done;
    const item = (k: DetailsItemKey) => guidedItemDone(k, f);
    assert.equal(done('look'), item('theme'));
    assert.equal(done('logo'), item('logo'));
    assert.equal(done('mood'), item('mood-board'));
    assert.equal(done('march'), item('march'));
    assert.equal(done('seats'), item('seating'));
    assert.equal(done('schedule'), wordsAndPlansItem('schedule', f.words).done);
    assert.equal(done('story'), wordsAndPlansItem('love-story', f.words).done);
    assert.equal(done('info'), item('names')! && item('date')! && item('venues')!);
    assert.equal(done('rsvp'), hubSetupDone('ask', SETUP));
    assert.equal(done('prints'), true, 'Prints has nothing to fill — always ✓');
  }
  // The status lines that carry a count say the shipped words.
  const f = facts({}, { story: 3, schedule: 0 });
  const t = studioTiles(input({ facts: f }));
  assert.equal(t.find((x) => x.key === 'schedule')!.status, wordsAndPlansItem('schedule', f.words).sub);
  assert.equal(t.find((x) => x.key === 'story')!.status, wordsAndPlansItem('love-story', f.words).sub);
  assert.equal(t.find((x) => x.key === 'seats')!.status, '12 tables · 0 seated');
  assert.equal(t.find((x) => x.key === 'gifts')!.status, '2 ways to give');
  assert.equal(t.find((x) => x.key === 'gifts')!.done, true);
});

test('4 · a fact that was not read makes no claim — never a Missing nobody measured', () => {
  const tiles = studioTiles(
    input({ facts: facts({ yourEvent: null, seatPlanArranged: null }, { story: null, schedule: null }), giftMethods: null, setup: null, seat: { tables: null, seated: null } }),
  );
  for (const k of ['info', 'march', 'seats', 'story', 'schedule', 'gifts', 'rsvp'] as const) {
    assert.equal(tiles.find((t) => t.key === k)!.done, undefined, `${k} claims a done it never read`);
  }
  assert.equal(tiles.find((t) => t.key === 'gifts')!.status, 'Could not be read just now');
  assert.equal(tiles.find((t) => t.key === 'seats')!.status, 'Could not be read just now');
});

test('5 · "n of N ready" counts only what is really done; an event without an item has no tile for it', () => {
  const tiles = studioTiles(input());
  const { ready, total } = studioReady(tiles);
  assert.equal(total, 11);
  assert.equal(ready, tiles.filter((t) => t.done === true).length);
  const birthday = studioTiles(input({ offered: (k) => !['love-story', 'march', 'seating'].includes(k) }));
  assert.deepEqual(birthday.map((t) => t.key), ['info', 'look', 'logo', 'mood', 'schedule', 'gifts', 'rsvp', 'prints']);
  // The march in the type's own words.
  assert.equal(studioTiles(input({ marchLabel: 'Grand March' })).find((t) => t.key === 'march')!.label, 'Grand March');
});
