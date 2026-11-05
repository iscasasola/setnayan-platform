/**
 * budget-list-filter.test.ts — the Budget page's thumb row (plan row B3 of
 * `BUDGET_PAGE_2026-10-08_fable.md`): All ▾ (All · Owing · Paid) and search
 * narrow all three groups, and an emptied group says why.
 *
 * 🛑 The one property that matters most: a group whose read was REFUSED is
 * `null`, and no filter or search may turn it into `[]` — an empty array draws
 * "Nothing owed to a supplier.", which is a claim nobody measured.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIST_FILTERS,
  filterBudgetList,
  filterLine,
  isListFilter,
  whyEmpty,
  type BudgetList,
} from '@/lib/budget-page-view';

const LIST: BudgetList = {
  suppliers: [
    {
      vendorId: 'sv',
      name: 'Seda Vertis North',
      initials: 'SV',
      service: 'Reception',
      agreedPhp: 1_056_000,
      paidPhp: 105_600,
      owedPhp: 950_400,
      dues: [],
      status: 'owing',
    },
    {
      vendorId: 'sd',
      name: 'Santuario de San Vicente de Paúl',
      initials: 'SD',
      service: 'Ceremony',
      agreedPhp: 26_499,
      paidPhp: 26_499,
      owedPhp: 0,
      dues: [],
      status: 'paid',
    },
  ],
  orders: [
    { orderId: 'o1', name: 'Event Hub Pro', bookedOn: '2026-09-14', amountPhp: 2_499, owedPhp: 0, status: 'paid' },
  ],
  expenses: [
    {
      costId: 'c1',
      name: 'Church offering',
      initials: 'CH',
      category: 'Ceremony',
      amountPhp: 15_000,
      paidPhp: 15_000,
      owedPhp: 0,
      status: 'paid',
    },
    {
      costId: 'c2',
      name: 'Entourage gowns',
      initials: 'EN',
      category: 'Attire',
      amountPhp: 84_000,
      paidPhp: 40_000,
      owedPhp: 44_000,
      status: 'owing',
    },
  ],
};

const names = (l: BudgetList) => ({
  suppliers: l.suppliers?.map((r) => r.name) ?? null,
  orders: l.orders?.map((r) => r.name) ?? null,
  expenses: l.expenses?.map((r) => r.name) ?? null,
});

test('All with no search is the list itself', () => {
  assert.deepEqual(filterBudgetList(LIST, 'all', ''), LIST);
});

test('Owing keeps only what still has money owed — in all three groups', () => {
  assert.deepEqual(names(filterBudgetList(LIST, 'owing', '')), {
    suppliers: ['Seda Vertis North'],
    orders: [],
    expenses: ['Entourage gowns'],
  });
});

test('Paid keeps only what is paid in full — in all three groups', () => {
  assert.deepEqual(names(filterBudgetList(LIST, 'paid', '')), {
    suppliers: ['Santuario de San Vicente de Paúl'],
    orders: ['Event Hub Pro'],
    expenses: ['Church offering'],
  });
});

test('search matches a name or its sub-line word, ignoring case and accents', () => {
  assert.deepEqual(names(filterBudgetList(LIST, 'all', 'CEREMONY')), {
    suppliers: ['Santuario de San Vicente de Paúl'],
    orders: [],
    expenses: ['Church offering'],
  });
  assert.deepEqual(names(filterBudgetList(LIST, 'all', ' paul ')).suppliers, ['Santuario de San Vicente de Paúl']);
  assert.deepEqual(names(filterBudgetList(LIST, 'owing', 'gown')).expenses, ['Entourage gowns']);
});

test('A REFUSED GROUP STAYS null through every filter and every search', () => {
  const refused: BudgetList = { suppliers: null, orders: null, expenses: null };
  for (const f of LIST_FILTERS) {
    for (const q of ['', 'seda', 'zzz']) {
      const out = filterBudgetList(refused, f.key, q);
      assert.equal(out.suppliers, null, `${f.key} / "${q}": suppliers became ${JSON.stringify(out.suppliers)}`);
      assert.equal(out.orders, null);
      assert.equal(out.expenses, null);
    }
  }
  // …and one refused group beside two that answered keeps its own null.
  const one = filterBudgetList({ ...LIST, orders: null }, 'owing', '');
  assert.equal(one.orders, null);
  assert.deepEqual(one.suppliers?.map((r) => r.vendorId), ['sv']);
});

test("an emptied group says why, in the prototype's words", () => {
  assert.equal(whyEmpty('suppliers', 'owing', ''), 'Nothing owed to a supplier.');
  assert.equal(whyEmpty('orders', 'owing', ''), 'Everything bought here is paid.');
  assert.equal(whyEmpty('expenses', 'owing', ''), 'No expense still owing.');
  for (const g of ['suppliers', 'orders', 'expenses'] as const) {
    assert.equal(whyEmpty(g, 'paid', ''), 'None fully paid yet.');
    assert.equal(whyEmpty(g, 'all', ''), null, 'with no filter on, an empty group is not "emptied"');
    assert.equal(whyEmpty(g, 'owing', 'x'), 'No match.', 'a search that finds nothing says so, whatever the filter');
  }
});

test('the filter line names the filter; All has none', () => {
  assert.equal(filterLine('all'), null);
  assert.equal(filterLine('owing'), 'Showing what is still owed.');
  assert.equal(filterLine('paid'), 'Showing what is paid in full.');
});

test('the dropdown offers exactly All · Owing · Paid, in that order', () => {
  assert.deepEqual(
    LIST_FILTERS.map((f) => f.label),
    ['All', 'Owing', 'Paid'],
  );
  assert.ok(LIST_FILTERS.every((f) => isListFilter(f.key)));
  assert.equal(isListFilter('owed'), false);
});
