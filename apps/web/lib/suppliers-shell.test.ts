/**
 * suppliers-shell.test.ts — the rules under the one-screen Suppliers page
 * (owner 2026-10-07; corpus `SUPPLIERS_HANDOFF_2026-10-07_fable.md` PR1),
 * EXECUTED against `lib/suppliers-shell.ts`:
 *
 *   T1  every key the shipped bus carries opens one of the three bodies — and
 *       each body's own key opens it at its top, `compare` inside Build;
 *   T2  "Build N/M" counts a category that holds a booked supplier or a build
 *       pick, out of the categories that hold anybody — covered ≠ filled;
 *   T3  the build's money is the prices that EXIST; a pick with no recorded
 *       price is counted, and with none recorded there is no money to print
 *       (never ₱0);
 *   T4  the date reads at its own precision; the place names a BOOKED venue;
 *       an unset fact is an ask, drawn open;
 *   T5  Find opens one category at a time — until Expand all, when a header
 *       tap folds just that one, and a search unfolds every row with a hit.
 *
 * SABOTAGE, each seen red (2026-10-08; the PR body has the runs):
 *   T1 send `compare` to Find            T2 count a covered category as filled
 *   T3 drop the unpriced count · say there is money when nothing is priced ·
 *      sum without `teamMoney`
 *   T4 print a month-only date as a day · name an area as if it were the venue
 *   T5 ignore the folded set under Expand all
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { BUDGET_BUILD_TABS } from './budget-build';
import { stripComments } from './strip-comments';
import {
  SUPPLIERS_MODES,
  SUPPLIERS_MODE_LABEL,
  SUPPLIERS_MODE_TAB,
  buildTally,
  isCategoryOpen,
  isModeTab,
  suppliersDateFact,
  suppliersModeOfTab,
  suppliersPlaceFact,
  tallyHasMoney,
  type TallyChild,
} from './suppliers-shell';

/* ── T1 · the bus and the three bodies ───────────────────────────────────── */

test('T1 · every bus key opens exactly one body, and each body owns one key', () => {
  for (const tab of BUDGET_BUILD_TABS) {
    assert.ok(SUPPLIERS_MODES.includes(suppliersModeOfTab(tab)), `${tab} opens no body`);
  }
  assert.deepEqual(
    BUDGET_BUILD_TABS.map((t) => [t, suppliersModeOfTab(t)]),
    [
      ['shortlist', 'find'],
      ['build', 'build'],
      ['budget', 'booked'],
      ['compare', 'build'],
    ],
  );
  // A press on a segment dispatches that body's OWN key, which opens that body.
  for (const m of SUPPLIERS_MODES) assert.equal(suppliersModeOfTab(SUPPLIERS_MODE_TAB[m]), m);
  // Three keys open a body at its top; the saved builds are scrolled to inside Build.
  assert.deepEqual(
    BUDGET_BUILD_TABS.filter((t) => isModeTab(t)),
    ['shortlist', 'build', 'budget'],
  );
  assert.equal(isModeTab('compare'), false);
});

test('T1 · the words are Find · Build · Booked — never Picks, never vendor', () => {
  assert.deepEqual(
    SUPPLIERS_MODES.map((m) => SUPPLIERS_MODE_LABEL[m]),
    ['Find', 'Build', 'Booked'],
  );
});

/* ── T2 / T3 · Build N/M and the build's money ───────────────────────────── */

const pick = (vendor_id: string, raw_status: string, rolled_cost_php: number | null) => ({
  vendor_id,
  raw_status,
  rolled_cost_php,
});

/** Reception booked ₱1,056,000 · Ceremony booked, no price · Catering one build
 *  pick at ₱198,000 beside a candidate · Cake covered by the venue · Bridal Car
 *  holds a candidate nobody picked · a planned category nobody is in. */
const CHILDREN: TallyChild[] = [
  { picks: [pick('seda', 'deposit_paid', 1_056_000)], buildPickVendorIds: ['seda'] },
  { picks: [pick('santuario', 'contracted', null)], buildPickVendorIds: [] },
  { picks: [pick('kusina', 'shortlisted', 198_000), pick('bituin', 'considering', 240_000)], buildPickVendorIds: ['kusina'] },
  { picks: [], buildPickVendorIds: [], coveredBy: { vendorName: 'Seda', fromGroupLabel: 'Reception', locked: true } },
  { picks: [pick('impala', 'considering', 35_000)], buildPickVendorIds: [] },
  { picks: [], buildPickVendorIds: [] },
];
/** `model.chosenCentavos` — the plan model's own Σ of locked picks. */
const LOCKED_CENTAVOS = 1_056_000 * 100;

test('T2 · filled = booked or in the build; total = the categories that hold anybody', () => {
  const t = buildTally(CHILDREN, LOCKED_CENTAVOS);
  assert.equal(t.filled, 3, 'reception (booked) · ceremony (booked) · catering (in the build)');
  assert.equal(t.total, 5, 'the empty planned category is not on the event yet; the covered one is');
});

test('T2 · a build pick that is already booked is counted once, as booked', () => {
  const t = buildTally([CHILDREN[0]!], LOCKED_CENTAVOS);
  assert.deepEqual([t.filled, t.total, t.knownPhp, t.unpriced], [1, 1, 1_056_000, 0]);
});

test('T3 · the money is the prices that exist — an unpriced pick is counted, never ₱0', () => {
  const t = buildTally(CHILDREN, LOCKED_CENTAVOS);
  assert.equal(t.knownPhp, 1_056_000 + 198_000, 'booked + still to book; the unpicked candidates are not in the build');
  assert.equal(t.unpriced, 1, 'the ceremony venue is booked with no price recorded');
  assert.equal(tallyHasMoney(t), true);
});

test('T3 · a build pick with no price is counted as unpriced and adds nothing', () => {
  const t = buildTally(
    [
      { picks: [pick('kusina', 'shortlisted', 198_000)], buildPickVendorIds: ['kusina'] },
      { picks: [pick('lola', 'considering', null)], buildPickVendorIds: ['lola'] },
    ],
    0,
  );
  assert.deepEqual([t.filled, t.total, t.knownPhp, t.unpriced], [2, 2, 198_000, 1]);
});

test('T3 · nothing priced → no figure at all', () => {
  const t = buildTally([CHILDREN[1]!, CHILDREN[4]!], 0);
  assert.deepEqual([t.filled, t.total, t.knownPhp, t.unpriced], [1, 2, 0, 1]);
  assert.equal(tallyHasMoney(t), false, 'with nothing priced the peek would print ₱0 as the build’s total');
});

test('T3 · ONE sum — the tally goes through the Build body’s own teamMoney', () => {
  const src = stripComments(readFileSync(join(process.cwd(), 'lib', 'suppliers-shell.ts'), 'utf8'));
  assert.match(src, /import \{ teamMoney \} from '\.\/your-team'/);
  assert.match(src, /teamMoney\(\{ lockedCentavos, lockedUnpricedCount: lockedUnpriced, candidateCostsPhp, budgetPhp: null \}\)/);
  assert.match(src, /import \{ LOCKED_VENDOR_STATUSES \} from '\.\/shortlist-taxonomy'/, 'a second list of what "booked" means');
});

/* ── T5 · which categories are open ──────────────────────────────────────── */

test('T5 · one open at a time — until Expand all, then a header tap folds just that one', () => {
  const none = new Set<string>();
  const at = (tile: string, over: Partial<Parameters<typeof isCategoryOpen>[0]> = {}) =>
    isCategoryOpen({ tile, searching: false, openTile: null, openAll: false, folded: none, ...over });
  // Nothing opened: every row is closed.
  assert.deepEqual(['catering', 'cake'].map((t) => at(t)), [false, false]);
  // One opened: that one only.
  assert.deepEqual(['catering', 'cake'].map((t) => at(t, { openTile: 'catering' })), [true, false]);
  // Expand all: every row — whichever one had been open before.
  assert.deepEqual(['catering', 'cake'].map((t) => at(t, { openAll: true, openTile: 'catering' })), [true, true]);
  // …and a tap on one header folds JUST that one.
  assert.deepEqual(
    ['catering', 'cake'].map((t) => at(t, { openAll: true, folded: new Set(['cake']) })),
    [true, false],
  );
  // A folded row is not remembered once "all" is off.
  assert.equal(at('cake', { openAll: false, openTile: 'cake', folded: new Set(['cake']) }), true);
  // Searching: the rows with hits unfold by themselves, folded or not.
  assert.equal(at('cake', { searching: true, openAll: true, folded: new Set(['cake']) }), true);
});

/* ── T4 · the date · place line ──────────────────────────────────────────── */

test('T4 · the date reads at its own precision', () => {
  assert.deepEqual(suppliersDateFact('2026-12-18', 'day'), { text: 'Fri, Dec 18, 2026', open: false });
  assert.deepEqual(suppliersDateFact('2026-12-01', 'month'), { text: 'December 2026', open: true });
  assert.deepEqual(suppliersDateFact('2026-01-01', 'year'), { text: '2026', open: true });
  // No precision recorded is a day (the column's default), as the page's other formatter reads it.
  assert.equal(suppliersDateFact('2027-02-14', null).text, 'Sun, Feb 14, 2027');
});

test('T4 · no date is an ask, never a made-up day', () => {
  for (const none of [null, undefined, '', 'soon', '2026-13']) {
    assert.deepEqual(suppliersDateFact(none, 'day'), { text: 'Pick your date', open: true });
  }
});

test('T4 · the place is the booked venue and its area; the area alone while none is booked', () => {
  assert.deepEqual(suppliersPlaceFact('Seda Vertis North', 'Metro Manila'), {
    text: 'Seda Vertis North, Metro Manila',
    open: false,
  });
  assert.deepEqual(suppliersPlaceFact('Seda Vertis North', null), { text: 'Seda Vertis North', open: false });
  assert.deepEqual(suppliersPlaceFact(null, 'Metro Manila'), { text: 'Metro Manila', open: true });
  assert.deepEqual(suppliersPlaceFact('  ', ''), { text: 'Pick the place', open: true });
});
