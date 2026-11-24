/**
 * 🔒 SPACES (lib/spaces.ts — owner 19 Nov; specs prototypes/spaces_final_screens_2026-11-19.html).
 *   · booked-whole kinds read the day's halls view; counted kinds never claim a "Free" they cannot know;
 *   · names count on from the shop's own (Hall001 → Hall003), number by floor on Pro, and are refused whole on a clash;
 *   · a kind keeps only its own rows; clothing's count is its sizes added up;
 *   · the drawing's tile words; the date reads as a calendar day (never shifted a day by a time zone).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KIND_MENU,
  SHOW_CHOICES,
  bookedWhole,
  cleanDetails,
  clothingCount,
  dateChoices,
  dayWords,
  kindForShop,
  matchesSearch,
  namesForRun,
  previewWords,
  spacesCountLine,
  tileLine,
  tilesOnDay,
  type Space,
} from './spaces';

const sp = (over: Partial<Space> & Pick<Space, 'id' | 'kind' | 'name'>): Space => ({
  seated: null,
  standing: null,
  widthM: null,
  lengthM: null,
  connectsTo: null,
  floor: null,
  count: null,
  inRepair: 0,
  details: {},
  ...over,
});

test('the ＋ menu is the six kinds in the drawing’s order; Show is All then the six', () => {
  assert.deepEqual(KIND_MENU.map((k) => k.label), ['Halls and rooms', 'Carts', 'Clothing', 'Objects', 'Vehicles', 'Others']);
  assert.deepEqual(SHOW_CHOICES.map((k) => k.label), ['All', 'Halls and rooms', 'Carts', 'Clothing', 'Objects', 'Vehicles', 'Others']);
  assert.ok(bookedWhole('hall') && bookedWhole('room') && bookedWhole('cart') && bookedWhole('vehicle') && bookedWhole('item'));
  assert.ok(!bookedWhole('object') && !bookedWhole('clothing'), 'a counted kind was booked whole');
});

test('names count on from the shop’s own; by floor on Pro; a clash is refused whole', () => {
  assert.deepEqual(namesForRun('hall', ['Hall001', 'Hall002', 'Cart001'], 1, { naming: 'generic' }), { ok: true, names: ['Hall003'] });
  const rooms = namesForRun('room', [], 12, { naming: 'generic' });
  assert.ok(rooms.ok && rooms.names[0] === 'Room001' && rooms.names[11] === 'Room012');
  assert.deepEqual(namesForRun('room', [], 3, { naming: 'by_floor', floorLevel: 2, startAt: 201 }), { ok: true, names: ['201', '202', '203'] });
  assert.deepEqual(namesForRun('room', [], 2, { naming: 'letters', floorLevel: 3 }), { ok: true, names: ['3A', '3B'] });
  assert.equal(namesForRun('hall', [], 1, { naming: 'by_floor', floorLevel: 2 }).ok, false, 'a hall was numbered by floor');
  const clash = namesForRun('room', ['202'], 3, { naming: 'by_floor', floorLevel: 2, startAt: 201 });
  assert.deepEqual(clash, { ok: false, error: '202 is already a name in your shop.' });
  assert.deepEqual(namesForRun('hall', [], 1, { naming: 'own', own: '  Grand   Ballroom ' }), { ok: true, names: ['Grand Ballroom'] });
  assert.equal(namesForRun('hall', [], 1, { naming: 'own', own: ' ' }).ok, false);
  assert.equal(namesForRun('room', [], 0, { naming: 'generic' }).ok, false);
  assert.equal(namesForRun('room', [], 201, { naming: 'generic' }).ok, false, 'a run past 200 was made');
  assert.equal(previewWords(['Room001', 'Room002', 'Room003', 'Room012']), 'Room001, Room002 … Room012');
});

test('a kind keeps only its own rows; clothing counts its sizes', () => {
  assert.deepEqual(cleanDetails('cart', { type: ' Fries ', needsPower: true, sizes: { M: 2 }, seats: 4 }), { type: 'Fries', needsPower: true });
  assert.deepEqual(cleanDetails('vehicle', { type: 'Bridal car', seats: 4, driver: true, needsPower: true }), { type: 'Bridal car', seats: 4, driver: true });
  assert.deepEqual(cleanDetails('clothing', { sizes: { S: 1, M: 2, L: 0, Q: 9 }, cleaningDays: 3 }), { sizes: { S: 1, M: 2 }, cleaningDays: 3 });
  assert.deepEqual(cleanDetails('vehicle', { seats: 0 }), {}, 'a vehicle kept 0 seats');
  assert.deepEqual(cleanDetails('hall', { type: 'x' }), {}, 'a hall kept another kind’s row');
  assert.equal(clothingCount({ S: 1, M: 2, L: 1 }), 4);
});

test('the drawing’s tile words', () => {
  assert.equal(tileLine(sp({ id: 'h', kind: 'hall', name: 'Hall001', seated: 300 })), '300 seated');
  assert.equal(tileLine(sp({ id: 'r', kind: 'room', name: 'Room001', details: { beds: 2 } })), '2 beds');
  assert.equal(tileLine(sp({ id: 'c', kind: 'cart', name: 'Cart001', details: { type: 'Fries' } })), 'Fries');
  assert.equal(tileLine(sp({ id: 'o', kind: 'object', name: 'Object001', count: 200, details: { type: 'Chairs' } })), 'Chairs · 200');
  assert.equal(tileLine(sp({ id: 'v', kind: 'vehicle', name: 'Vehicle001', details: { type: 'Bridal car' } })), 'Bridal car');
});

test('on a day: a booked hall names who holds it; a closure says so; a counted space never claims "Free"', () => {
  const spaces = [
    sp({ id: 'h1', kind: 'hall', name: 'Hall001' }),
    sp({ id: 'h2', kind: 'hall', name: 'Hall002' }),
    sp({ id: 'c1', kind: 'cart', name: 'Cart001' }),
    sp({ id: 'o1', kind: 'object', name: 'Object001', count: 200, inRepair: 8 }),
    sp({ id: 'o2', kind: 'object', name: 'Object002', count: 30 }),
  ];
  const day = '2027-02-14';
  const m = tilesOnDay(day, spaces, [{ poolId: 'h1', eventId: 'e1', title: 'Reyes wedding' }], [
    { poolId: 'c1', source: 'manual', startDate: day, endDate: day, label: 'In repair' },
  ]);
  assert.deepEqual(m.get('h1'), { tone: 'booked', word: 'Booked', who: ['Reyes wedding'] });
  assert.deepEqual(m.get('h2'), { tone: 'free', word: 'Free' });
  assert.deepEqual(m.get('c1'), { tone: 'closed', word: 'In repair' });
  assert.deepEqual(m.get('o1'), { tone: 'count', word: '8 in repair' });
  assert.deepEqual(m.get('o2'), { tone: 'count', word: '30 owned' });
});

test('the date pick reads calendar days: Today, Tomorrow, then "Sat 14 Feb"', () => {
  const c = dateChoices('2027-02-12', 4);
  assert.deepEqual(c.map((x) => x.key), ['2027-02-12', '2027-02-13', '2027-02-14', '2027-02-15']);
  assert.deepEqual(c.map((x) => x.label).slice(0, 2), ['Today', 'Tomorrow']);
  assert.equal(dayWords('2027-02-14'), 'Sun 14 Feb');
  assert.equal(dateChoices('2026-12-31', 2)[1]!.key, '2027-01-01', 'the year did not roll over');
});

test('search, the shop’s own kind, and the admin count line', () => {
  const chairs = sp({ id: 'o', kind: 'object', name: 'Object001', count: 200, details: { type: 'Chairs' } });
  assert.ok(matchesSearch(chairs, 'chair'));
  assert.ok(matchesSearch(chairs, 'object'));
  assert.ok(!matchesSearch(chairs, 'gown'));
  assert.equal(kindForShop(['Venues', 'Hotels']), 'hall');
  assert.equal(kindForShop(['Gowns and barong']), 'clothing');
  assert.equal(kindForShop(['Bridal car']), 'vehicle');
  assert.equal(kindForShop(['Photo and video']), null);
  assert.equal(
    spacesCountLine([sp({ id: 'a', kind: 'hall', name: 'A' }), sp({ id: 'b', kind: 'hall', name: 'B' }), sp({ id: 'c', kind: 'room', name: 'C' }), chairs]),
    '2 halls · 1 room · 1 object',
  );
});
