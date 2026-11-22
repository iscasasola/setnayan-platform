/**
 * suppliers-build.test.ts — the pure rules behind the Build body of the
 * couple's Suppliers page (Suppliers PR3; prototype
 * `prototypes/suppliers_page_2026-10-07_fable.html`, Build mode).
 *
 * Every case is a state the approved prototype draws, with its numbers.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PICK_ASKED_NOTE,
  PICK_DECLINED_NOTE,
  PICK_LAPSED_NOTE,
  buildBarOf,
  buildCardOf,
  buildCounts,
  buildFitOf,
  buildKeyOf,
  buildLinesOf,
  buildMoneyOf,
  buildSnapshotOf,
  buildViewOf,
  noPriceNote,
  sameBuild,
  saveSheetOf,
  shortSupplierName,
  twinOf,
  type BuildLineInputVendor,
} from './suppliers-build';
import { planSaveAs } from './named-builds';
import { teamMoney } from './your-team';

const v = (vendorId: string, name: string, planGroupId: string | null, status: BuildLineInputVendor['status'] = 'considering') => ({
  vendorId,
  name,
  status,
  planGroupId,
});
const TILES = [
  { tile: 'reception', label: 'Reception', vendors: [v('seda', 'Seda Vertis North', 'reception_venue', 'locked')] },
  { tile: 'ceremony_venue', label: 'Ceremony', vendors: [v('santuario', 'Santuario de San Vicente de Paul', 'ceremony_venue', 'locked')] },
  { tile: 'cake', label: 'Cake', vendors: [v('asukal', 'Asukal Cakes', 'cake')] },
  {
    tile: 'catering',
    label: 'Catering',
    vendors: [v('bituin', 'Bituin Catering', 'catering'), v('luntian', 'Luntian Buffet', 'catering'), v('mesa', 'Mesa Kusina', 'catering'), v('halo', 'Halo Catering', null)],
  },
  { tile: 'bridal_car', label: 'Bridal Car', vendors: [] },
];
const PRICES: Record<string, number> = { seda: 1_056_000, bituin: 171_000, luntian: 270_000, mesa: 153_000, halo: 176_400 };
const BLOCKED = new Map([['mesa', 'Not available on your date']]);
const lines = (inBuild: string[] = []) =>
  buildLinesOf({ tiles: TILES, priceOf: (id) => PRICES[id] ?? null, inBuild: new Set(inBuild), blocked: BLOCKED });

test('a line holds the booked supplier, or the pick, or the dropdown of the priced and free shortlist', () => {
  const ls = lines(['luntian']);
  const by = Object.fromEntries(ls.map((l) => [l.tile, l]));
  assert.equal(by.reception!.booked?.name, 'Seda Vertis North');
  assert.equal(by.reception!.booked?.pricePhp, 1_056_000);
  assert.equal(by.ceremony_venue!.booked?.pricePhp, null, 'a booked supplier with no price is null, never 0');
  assert.deepEqual(by.cake!.candidates, [], 'an unpriced supplier is not offered');
  assert.equal(by.cake!.pick, null);
  assert.deepEqual(
    by.catering!.candidates.map((c) => c.vendorId),
    ['bituin', 'luntian'],
    'only priced, bookable suppliers with a plan group — Mesa is taken on the date, Halo has no group',
  );
  assert.equal(by.catering!.pick?.vendorId, 'luntian');
  assert.equal(by.catering!.pickNote, null);
  assert.deepEqual(by.bridal_car!.candidates, []);
});

test('a pick that cannot be booked stays on its line and says why', () => {
  const catering = lines(['mesa']).find((l) => l.tile === 'catering')!;
  assert.equal(catering.pick?.vendorId, 'mesa');
  assert.equal(catering.pickNote, 'Not available on your date');
  assert.ok(!catering.candidates.some((c) => c.vendorId === 'mesa'));
});

test('a booked supplier is never also the pick, even when a build pick row still points at it', () => {
  const reception = lines(['seda']).find((l) => l.tile === 'reception')!;
  assert.equal(reception.pick, null);
  assert.deepEqual(reception.candidates, []);
});

test('"N of M categories" counts booked and picked lines; "to book" only the picks', () => {
  assert.deepEqual(buildCounts(lines()), { filled: 2, total: 5, toBook: 0 });
  assert.deepEqual(buildCounts(lines(['bituin'])), { filled: 3, total: 5, toBook: 1 });
});

test('a pick the couple has already asked to book waits for the supplier — it is not asked again', () => {
  const one = (lockState: BuildLineInputVendor['lockState']) =>
    buildLinesOf({
      tiles: [{ tile: 'catering', label: 'Catering', vendors: [{ ...v('bituin', 'Bituin Catering', 'catering'), lockState }] }],
      priceOf: (id) => PRICES[id] ?? null,
      inBuild: new Set(['bituin']),
      blocked: new Map(),
    });
  assert.equal(one('requested')[0]!.pickAsked, true);
  assert.deepEqual(buildCounts(one('requested')), { filled: 1, total: 1, toBook: 0 });
  assert.equal(lines(['bituin']).find((l) => l.tile === 'catering')!.pickAsked, false);
});

test('each answer to the ask has its state on the line: declined and lapsed are said, and may be asked again', () => {
  const one = (lockState: BuildLineInputVendor['lockState']) =>
    buildLinesOf({
      tiles: [{ tile: 'catering', label: 'Catering', vendors: [{ ...v('bituin', 'Bituin Catering', 'catering'), lockState }] }],
      priceOf: (id) => PRICES[id] ?? null,
      inBuild: new Set(['bituin']),
      blocked: new Map(),
    })[0]!;
  assert.equal(one('declined').pickAnswer, 'declined');
  assert.equal(one('expired').pickAnswer, 'expired');
  // Withdrawn by the couple: a pick again, with nothing to say.
  assert.equal(one('cancelled').pickAnswer, null);
  assert.equal(one('none').pickAnswer, null);
  for (const s of ['declined', 'expired', 'cancelled'] as const) {
    assert.equal(one(s).pickAsked, false);
    assert.deepEqual(buildCounts([one(s)]), { filled: 1, total: 1, toBook: 1 }, `${s}: the pick can be asked again`);
  }
  assert.equal(PICK_DECLINED_NOTE, 'They said no to this booking — you can ask again');
  assert.equal(PICK_LAPSED_NOTE, 'They did not answer in time — you can ask again');
  assert.equal(PICK_ASKED_NOTE, 'Asked to book · waiting for their yes');
});

test('GOLDEN: the snapshot Save posts keeps the shipped fields, and holds only what is in the build', () => {
  const snap = buildSnapshotOf(lines(['luntian']), 2_250_000);
  assert.deepEqual(Object.keys(snap).sort(), ['budgetPhp', 'picks', 'totalPhp']);
  assert.equal(snap.budgetPhp, 2_250_000);
  assert.equal(snap.totalPhp, 1_056_000 + 270_000);
  assert.deepEqual(
    snap.picks.map((p) => Object.keys(p).sort()),
    snap.picks.map(() => ['costPhp', 'groupId', 'inclusions', 'label', 'locked', 'vendorId', 'vendorName']),
    'a pick is exactly the PlanBuildPick the saved builds already hold',
  );
  assert.deepEqual(
    snap.picks.map((p) => [p.groupId, p.vendorId, p.locked, p.costPhp]),
    [
      ['reception_venue', 'seda', true, 1_056_000],
      ['ceremony_venue', 'santuario', true, null],
      ['catering', 'luntian', false, 270_000],
    ],
    'the booked suppliers and the picks — never a shortlisted supplier who is not in the build',
  );
});

test('what a price comes with is saved with the build and shown on its card', () => {
  const ls = buildLinesOf({
    tiles: TILES,
    priceOf: (id) => PRICES[id] ?? null,
    inclusionsOf: (id) => (id === 'luntian' ? ['Dessert bar', 'Crew meals'] : []),
    inBuild: new Set(['luntian']),
    blocked: BLOCKED,
  });
  const snap = buildSnapshotOf(ls, null);
  assert.deepEqual(snap.picks.find((p) => p.vendorId === 'luntian')!.inclusions, ['Dessert bar', 'Crew meals']);
  const card = buildCardOf({ id: 'g', name: 'G', picks: snap.picks, categories: [{ label: 'Catering', groupId: 'catering' }], budgetPhp: null, free: null, lockedGroupIds: new Set() });
  assert.deepEqual(card.rows, [{ label: 'Catering', supplier: 'Luntian', inclusions: ['Dessert bar', 'Crew meals'] }]);
});

test('twins: the same supplier in every category, whatever the order, the prices or the names', () => {
  const a = [
    { groupId: 'catering', vendorId: 'luntian', vendorName: 'Luntian Buffet' },
    { groupId: 'reception_venue', vendorId: 'seda', vendorName: 'Seda' },
  ];
  const b = [
    { groupId: 'reception_venue', vendorId: 'seda', vendorName: 'Seda Vertis North' },
    { groupId: 'catering', vendorId: 'luntian', vendorName: 'x' },
  ];
  assert.ok(sameBuild(a, b));
  assert.ok(!sameBuild(a, [...b, { groupId: 'cake', vendorId: 'asukal', vendorName: 'Asukal' }]), 'one more category is a different build');
  assert.ok(!sameBuild(a, [b[0]!, { groupId: 'catering', vendorId: 'mesa', vendorName: 'Mesa' }]));
  assert.ok(!sameBuild(a, [b[0]!, { groupId: 'cake', vendorId: 'luntian', vendorName: 'x' }]), 'the same supplier under another category is not the same build');
  assert.equal(buildKeyOf([]), '');
  assert.equal(buildKeyOf(null), '');
});

test('twinOf finds the saved build that is exactly these picks; an empty build is nobody’s twin', () => {
  const garden = { id: 'g', picks: buildSnapshotOf(lines(['luntian']), null).picks };
  const simple = { id: 's', picks: buildSnapshotOf(lines(['mesa']), null).picks };
  assert.equal(twinOf(buildSnapshotOf(lines(['luntian']), null).picks, [simple, garden])?.id, 'g');
  assert.equal(twinOf(buildSnapshotOf(lines(['bituin']), null).picks, [simple, garden]), null);
  assert.equal(twinOf(buildSnapshotOf(lines(['luntian']), null).picks, [simple, garden], 'g'), null, 'the build being overwritten is left out');
  assert.equal(twinOf([], [{ id: 'empty', picks: [] }]), null);
});

test('the bar: Saved · Save + Save as new · Save this build — and Book this build while a pick is unbooked', () => {
  assert.deepEqual(buildBarOf({ twinId: 'g', openId: 'g', openIsEdited: false, filled: 3, toBook: 1 }), { kind: 'saved', canSave: true, book: true });
  assert.deepEqual(buildBarOf({ twinId: null, openId: 'g', openIsEdited: true, filled: 3, toBook: 1 }), { kind: 'edited', canSave: true, book: true });
  assert.deepEqual(buildBarOf({ twinId: null, openId: null, openIsEdited: false, filled: 2, toBook: 0 }), { kind: 'new', canSave: true, book: false });
  assert.deepEqual(buildBarOf({ twinId: null, openId: null, openIsEdited: false, filled: 0, toBook: 0 }), { kind: 'new', canSave: false, book: false });
  // A twin outranks an edited open build (the prototype's order).
  assert.equal(buildBarOf({ twinId: 's', openId: 'g', openIsEdited: true, filled: 3, toBook: 1 }).kind, 'saved');
});

test('the save sheet: Nothing changed · Already saved · the name', () => {
  assert.equal(saveSheetOf({ twinId: 'g', openId: 'g' }), 'nothing_changed');
  assert.equal(saveSheetOf({ twinId: 'g', openId: null }), 'already_saved');
  assert.equal(saveSheetOf({ twinId: 'g', openId: 's' }), 'already_saved');
  assert.equal(saveSheetOf({ twinId: null, openId: 'g' }), 'name');
});

test('the save itself refuses a twin, and says "unchanged" for the open build — a rename still saves', () => {
  const garden = buildSnapshotOf(lines(['luntian']), null).picks;
  const existing = [{ build_id: 'g', label: null, title: 'Garden build', picks: garden }];
  assert.deepEqual(planSaveAs({ rawName: 'Another', overwriteBuildId: null, existing, picks: garden }), {
    mode: 'twin',
    buildId: 'g',
    twinTitle: 'Garden build',
  });
  assert.deepEqual(planSaveAs({ rawName: 'Garden build', overwriteBuildId: 'g', existing, picks: garden }), {
    mode: 'unchanged',
    buildId: 'g',
    twinTitle: 'Garden build',
  });
  assert.deepEqual(planSaveAs({ rawName: 'Garden, renamed', overwriteBuildId: 'g', existing, picks: garden }), {
    mode: 'overwrite',
    buildId: 'g',
    title: 'Garden, renamed',
  });
  const other = buildSnapshotOf(lines(['bituin']), null).picks;
  assert.deepEqual(planSaveAs({ rawName: null, overwriteBuildId: 'g', existing, picks: other }), { mode: 'overwrite', buildId: 'g', title: null });
  assert.deepEqual(planSaveAs({ rawName: 'New', overwriteBuildId: null, existing, picks: other }), { mode: 'create', title: 'New' });
  // No picks handed in → the name-only rules, exactly as before.
  assert.deepEqual(planSaveAs({ rawName: 'Another', overwriteBuildId: null, existing }), { mode: 'create', title: 'Another' });
  // An empty build is never refused as a twin of another empty one.
  assert.deepEqual(planSaveAs({ rawName: 'E', overwriteBuildId: null, existing: [{ build_id: 'e', label: null, title: 'Empty', picks: [] }], picks: [] }), {
    mode: 'create',
    title: 'E',
  });
});

test('the money is the segment’s own sum, and a missing price is counted, never ₱0', () => {
  const children = [
    { picks: [{ vendor_id: 'seda', raw_status: 'contracted', rolled_cost_php: 1_056_000 }], buildPickVendorIds: [] },
    { picks: [{ vendor_id: 'santuario', raw_status: 'contracted', rolled_cost_php: null }], buildPickVendorIds: [] },
    {
      picks: [
        { vendor_id: 'luntian', raw_status: 'considering', rolled_cost_php: 270_000 },
        { vendor_id: 'bituin', raw_status: 'considering', rolled_cost_php: 171_000 },
      ],
      buildPickVendorIds: ['luntian'],
    },
  ];
  const money = buildMoneyOf(children, 105_600_000, 2_250_000);
  assert.equal(money.lockedPhp, 1_056_000);
  assert.equal(money.inBuildPhp, 270_000);
  assert.equal(money.lockedUnpriced, 1);
  assert.equal(money.bufferPhp, null, 'a buffer is not knowable while a booked supplier has no price');
  assert.equal(noPriceNote(1), 'of your people has no price');
  assert.equal(noPriceNote(2), 'of your people have no price');
});

test('the fit line counts a pick as free only where the calendar was read', () => {
  const fit = new Map<string, 'free' | 'booked'>([
    ['luntian', 'free'],
    ['mesa', 'booked'],
  ]);
  assert.deepEqual(buildFitOf(lines(['luntian']), fit), { priced: 2, free: 2, taken: 0, unread: 0 }, 'the booked reception holds the date');
  assert.deepEqual(buildFitOf(lines(['mesa']), fit), { priced: 2, free: 1, taken: 1, unread: 0 });
  assert.deepEqual(buildFitOf(lines(['bituin']), fit), { priced: 2, free: 1, taken: 0, unread: 1 }, 'no calendar read → neither free nor taken');
  assert.deepEqual(buildFitOf(lines(), null), { priced: 1, free: 1, taken: 0, unread: 0 });
});

test('a build card: total of the prices that exist, one row per category, the buffer only when every price is known', () => {
  const categories = [
    { label: 'Reception', groupId: 'reception_venue' },
    { label: 'Ceremony', groupId: 'ceremony_venue' },
    { label: 'Cake', groupId: null },
    { label: 'Catering', groupId: 'catering' },
  ];
  const picks = buildSnapshotOf(lines(['luntian']), null).picks;
  const card = buildCardOf({ id: 'g', name: 'Garden build', picks, categories, budgetPhp: 2_250_000, free: null, lockedGroupIds: new Set(['reception_venue', 'ceremony_venue']) });
  assert.equal(card.totalPhp, 1_326_000);
  assert.equal(card.unpriced, 1);
  assert.equal(card.bufferPhp, null);
  assert.deepEqual(card.rows, [
    { label: 'Reception', supplier: 'Seda', inclusions: [] },
    { label: 'Ceremony', supplier: 'Santuario', inclusions: [] },
    { label: 'Cake', supplier: null, inclusions: [] },
    { label: 'Catering', supplier: 'Luntian', inclusions: [] },
  ]);
  assert.deepEqual(card.apply, [{ planGroupId: 'catering', vendorId: 'luntian' }], 'a Use never re-opens a booked category');
  const priced = buildCardOf({ id: 'p', name: 'P', picks: picks.filter((p) => p.costPhp != null), categories, budgetPhp: 2_250_000, free: null, lockedGroupIds: new Set() });
  assert.equal(priced.bufferPhp, 2_250_000 - 1_326_000);
  assert.equal(shortSupplierName('  Kusina ni Lola '), 'Kusina');
});

test('the whole body: this build first, then the saved ones, with the twin findable', () => {
  const ls = lines(['luntian']);
  const money = teamMoney({ lockedCentavos: 105_600_000, lockedUnpricedCount: 1, candidateCostsPhp: [270_000], budgetPhp: 2_250_000 });
  const garden = buildSnapshotOf(lines(['luntian']), 2_250_000).picks;
  const view = buildViewOf({
    lines: ls,
    money,
    dateFit: null,
    dateLabel: 'Dec 18',
    saved: [{ id: 'g', name: 'Garden build', title: 'Garden build', budgetPhp: 2_250_000, picks: garden }],
    buildsMeasured: true,
    freeByBuildId: { g: { kind: 'dates', labels: ['Dec 18'], more: 0 } },
  });
  assert.deepEqual(view.cards.map((c) => c.id), ['current', 'g']);
  assert.equal(view.cards[0]!.name, 'This build');
  assert.deepEqual(view.counts, { filled: 3, total: 5, toBook: 1 });
  assert.equal(view.money.bookedPhp + view.money.toBookPhp, 1_326_000);
  assert.equal(view.money.bufferPhp, null);
  assert.equal(view.money.unpriced, 1);
  assert.deepEqual(view.lockedGroupIds.sort(), ['ceremony_venue', 'reception_venue']);
  assert.equal(twinOf(view.snapshot.picks, view.cards.slice(1))?.id, 'g');
  assert.deepEqual(view.cards[1]!.free, { kind: 'dates', labels: ['Dec 18'], more: 0 });
  assert.equal(view.cards[1]!.title, 'Garden build');
});
