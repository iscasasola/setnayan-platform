import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canUndoInlineSave,
  classifyInlineMoreRow,
  excludeBenchVendors,
  shouldRunInlineMoreQuery,
  toggleInlineMoreTile,
} from './inline-more-row';
import {
  inlineMoreEmpty,
  inlineMoreHeading,
  inlineMoreSavedNote,
  inlineMoreSaveLabel,
  inlineMoreSearchPlaceholder,
  inlineMoreSeeAllLabel,
  inlineMoreSunkNote,
  INLINE_MORE_SEE_ALL,
} from './explore-info-copy';
import {
  noSharedDateBadge,
  type BuildDateWindow,
  type TeamCalendarMember,
} from './build-date-window';

const V = (vendorProfileId: string, name = vendorProfileId) => ({ vendorProfileId, name });

const PROBE = ['2027-09-12', '2027-09-26', '2027-10-09'];

function buildWindow(dayKeys: string[], memberCount = 1): BuildDateWindow {
  return {
    source: 'build',
    dayKeys,
    memberCount,
    windowSize: PROBE.length,
    conflictPair: null,
  };
}

function member(vendorId: string, name: string, freeDays: string[]): TeamCalendarMember {
  return { vendorId, name, freeDays: new Set(freeDays) };
}

/* ── single-open toggle ───────────────────────────────────────────────────── */

test('toggleInlineMoreTile opens a closed row and closes its own', () => {
  assert.equal(toggleInlineMoreTile(null, 'reception'), 'reception');
  assert.equal(toggleInlineMoreTile('reception', 'reception'), null);
});

test('toggleInlineMoreTile moves to the newly tapped row (single-open)', () => {
  assert.equal(toggleInlineMoreTile('reception', 'catering'), 'catering');
});

/* ── row 2 never repeats row 1 ────────────────────────────────────────────── */

test('excludeBenchVendors drops candidates already on this row', () => {
  const rows = [V('p1'), V('p2'), V('p3')];
  assert.deepEqual(
    excludeBenchVendors(rows, ['p2']).map((r) => r.vendorProfileId),
    ['p1', 'p3'],
  );
});

test('excludeBenchVendors ignores off-platform picks with no profile id', () => {
  const rows = [V('p1'), V('p2')];
  // A manually-added vendor carries `marketplaceVendorId: null` — it must not
  // silently swallow a candidate, and must not throw.
  assert.equal(excludeBenchVendors(rows, [null, undefined, '']).length, 2);
});

test('a vendor saved in this session stays put, so its Undo stays reachable', () => {
  const rows = [V('p1'), V('p2')];
  // p2 was just saved from row 2 and a refresh has since put it in row 1.
  assert.deepEqual(
    excludeBenchVendors(rows, ['p2'], ['p2']).map((r) => r.vendorProfileId),
    ['p1', 'p2'],
  );
});

test('keeping a session save does not resurrect an unrelated row-1 pick', () => {
  const rows = [V('p1'), V('p2')];
  assert.deepEqual(
    excludeBenchVendors(rows, ['p1', 'p2'], ['p2']).map((r) => r.vendorProfileId),
    ['p2'],
  );
});

test('excludeBenchVendors preserves the owner-locked result order', () => {
  const rows = [V('boosted'), V('reviewed'), V('nearest')];
  assert.deepEqual(
    excludeBenchVendors(rows, ['nothing']).map((r) => r.vendorProfileId),
    ['boosted', 'reviewed', 'nearest'],
  );
});

/* ── constraint 2: row 2 inherits the shared-date sink ────────────────────── */

test('a candidate sharing a day with the build window fits', () => {
  const out = classifyInlineMoreRow({
    rows: [V('p1')],
    freeDaysByProfileId: new Map([['p1', ['2027-09-26']]]),
    window: buildWindow(['2027-09-26']),
    members: [member('ev-hacienda', 'Hacienda Ilog', ['2027-09-26'])],
    probeDayKeys: PROBE,
  });
  assert.equal(out.fits.length, 1);
  assert.equal(out.clashes.length, 0);
  assert.equal(out.fits[0]!.clashWith, null);
});

test('a candidate with no day inside the window sinks, and names the clash', () => {
  const out = classifyInlineMoreRow({
    rows: [V('p1')],
    freeDaysByProfileId: new Map([['p1', ['2027-09-12']]]),
    window: buildWindow(['2027-09-26']),
    members: [member('ev-hacienda', 'Hacienda Ilog', ['2027-09-26'])],
    probeDayKeys: PROBE,
  });
  assert.equal(out.fits.length, 0);
  assert.equal(out.clashes.length, 1);
  assert.equal(out.clashes[0]!.clashWith, 'Hacienda Ilog');
  // The badge row 1 draws is the badge row 2 draws — same function, same words.
  assert.equal(
    noSharedDateBadge(out.clashes[0]!.clashWith),
    'No shared date with Hacienda Ilog',
  );
});

test('the sink partitions a mixed row and keeps each side in result order', () => {
  const out = classifyInlineMoreRow({
    rows: [V('a'), V('b'), V('c'), V('d')],
    freeDaysByProfileId: new Map([
      ['a', ['2027-09-26']],
      ['b', ['2027-09-12']],
      ['c', ['2027-09-26']],
      ['d', ['2027-10-09']],
    ]),
    window: buildWindow(['2027-09-26']),
    members: [member('ev-hacienda', 'Hacienda Ilog', ['2027-09-26'])],
    probeDayKeys: PROBE,
  });
  assert.deepEqual(out.fits.map((e) => e.row.vendorProfileId), ['a', 'c']);
  assert.deepEqual(out.clashes.map((e) => e.row.vendorProfileId), ['b', 'd']);
});

/* ── constraint 3: fail open ──────────────────────────────────────────────── */

test('no calendar signal is never a clash', () => {
  const out = classifyInlineMoreRow({
    rows: [V('unknown')],
    freeDaysByProfileId: new Map(),
    window: buildWindow(['2027-09-26']),
    members: [member('ev-hacienda', 'Hacienda Ilog', ['2027-09-26'])],
    probeDayKeys: PROBE,
  });
  assert.equal(out.clashes.length, 0);
  assert.equal(out.fits.length, 1);
});

test('no build window at all sinks nothing', () => {
  const out = classifyInlineMoreRow({
    rows: [V('p1'), V('p2')],
    freeDaysByProfileId: new Map([
      ['p1', []],
      ['p2', ['2027-09-12']],
    ]),
    window: null,
    members: [],
    probeDayKeys: PROBE,
  });
  assert.equal(out.fits.length, 2);
  assert.equal(out.clashes.length, 0);
});

test("an 'open' or 'anchored' window sinks nothing — the soft tier is not running", () => {
  for (const source of ['open', 'anchored'] as const) {
    const out = classifyInlineMoreRow({
      rows: [V('p1')],
      freeDaysByProfileId: new Map([['p1', []]]),
      window: { source, dayKeys: PROBE, memberCount: 0, windowSize: 3, conflictPair: null },
      members: [],
      probeDayKeys: PROBE,
    });
    assert.equal(out.clashes.length, 0, source);
  }
});

test("an already-empty build window blames nobody — the fault is the build's", () => {
  const out = classifyInlineMoreRow({
    rows: [V('p1')],
    freeDaysByProfileId: new Map([['p1', ['2027-09-12']]]),
    window: buildWindow([], 2),
    members: [
      member('ev-a', 'Hacienda Ilog', ['2027-09-26']),
      member('ev-b', 'Villa Ysabel', ['2027-09-12']),
    ],
    probeDayKeys: PROBE,
  });
  assert.equal(out.clashes.length, 0);
});

test('a clash with no single culprit sinks with an unnamed badge', () => {
  const out = classifyInlineMoreRow({
    rows: [V('p1')],
    freeDaysByProfileId: new Map([['p1', ['2027-10-09']]]),
    window: buildWindow(['2027-09-26']),
    // The one member shares 2027-09-26 with everything in the probe window, so
    // no member is nameable as THE culprit.
    members: [member('ev-a', 'Hacienda Ilog', PROBE)],
    probeDayKeys: PROBE,
  });
  assert.equal(out.clashes.length, 1);
  assert.equal(out.clashes[0]!.clashWith, null);
  assert.equal(noSharedDateBadge(null), 'No shared date with your build');
});

/* ── the mis-tap gap ──────────────────────────────────────────────────────── */

test('undo is offered for a save that created the row', () => {
  assert.equal(canUndoInlineSave('ok'), true);
});

test('undo is refused for an idempotent re-save of a pre-existing pick', () => {
  assert.equal(canUndoInlineSave('already_saved'), false);
  for (const s of ['not_signed_in', 'no_primary_event', 'vendor_not_found', 'error']) {
    assert.equal(canUndoInlineSave(s), false, s);
  }
});

/* ── the row's search field ───────────────────────────────────────────────── */

test('an empty query is the row default and always runs', () => {
  assert.equal(shouldRunInlineMoreQuery(''), true);
  assert.equal(shouldRunInlineMoreQuery('   '), true);
});

test('a one-character query is not worth a round trip; two are', () => {
  assert.equal(shouldRunInlineMoreQuery('h'), false);
  assert.equal(shouldRunInlineMoreQuery('ha'), true);
});

/* ── copy ─────────────────────────────────────────────────────────────────── */

test('the row names the category the couple tapped', () => {
  assert.equal(inlineMoreHeading('Reception'), 'More in Reception');
  assert.equal(inlineMoreSearchPlaceholder('Reception'), 'Search reception…');
  assert.equal(inlineMoreSaveLabel('Reception'), 'Save to Reception');
  assert.equal(inlineMoreSavedNote('Reception'), "Saved to Reception — it's in the row above.");
});

test('"See all" says what it opens, for a reader who cannot see the arrow', () => {
  assert.equal(INLINE_MORE_SEE_ALL, 'See all');
  assert.equal(inlineMoreSeeAllLabel('Reception'), 'See all Reception with filters');
});

test('an empty query and an empty category read differently', () => {
  assert.match(inlineMoreEmpty('villa'), /villa/);
  assert.notEqual(inlineMoreEmpty('villa'), inlineMoreEmpty(''));
});

test('the sunk note agrees with itself in number', () => {
  assert.match(inlineMoreSunkNote(1), /^1 of these shares /);
  assert.match(inlineMoreSunkNote(2), /^2 of these share /);
});
