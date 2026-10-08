/**
 * the-lab-never-ships.test.ts — /dev/budget-lab 404s in production. The same
 * rule `/dev/guests-lab` holds: the production check is the FIRST thing the
 * page does, before it reads a single search param or renders a fixture.
 *
 * And the lab draws the page's own components over the resolver's own core —
 * a lab with its own copy of the summary would be a second Budget page that
 * the side-by-side then approves instead of the real one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { knownMoneyTotals } from '@/lib/budget-truth';
import { pickNextPayment } from '@/lib/budget-page-view';
import { labMoney } from './fixture';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

test('the budget lab calls notFound() in production, before anything else', () => {
  assert.match(LAB, /import \{ notFound \} from 'next\/navigation';/, 'notFound is not imported');
  const page = LAB.slice(LAB.indexOf('export default async function BudgetLabPage('));
  assert.ok(page.length > 0, 'the lab page function is gone');
  const body = page.slice(page.indexOf('{', page.indexOf(')')) + 1).trimStart();
  assert.match(
    body,
    /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/,
    'the production 404 is not the first statement — the lab can render on the live site',
  );
});

test('the lab draws the REAL components, not a copy', () => {
  assert.match(LAB, /from '@\/app\/dashboard\/\[eventId\]\/budget\/_components\/budget-screen'/);
  assert.match(LAB, /buildBudgetList\(money\)/, 'the lab lists through the real builder');
  assert.doesNotMatch(LAB, /formatPhp\(|toLocaleString\(/, 'the lab formats no figure of its own');
});

test("the fixture reproduces the approved prototype's figures through the real core", () => {
  const money = labMoney();
  const known = knownMoneyTotals(money);
  assert.equal(money.targetPhp, 2_250_000);
  assert.equal(known.agreedPhp, 1_189_397);
  assert.equal(known.paidPhp, 194_997);
  assert.equal(known.owedAtLeastPhp, 994_400);
  assert.deepEqual(pickNextPayment(money.lines), {
    amountPhp: 528_000,
    name: 'Seda Vertis North',
    dueDate: '2026-10-05',
    vendorId: 'sv',
    costId: null,
  });
});

test('with "Bought on Setnayan" refused, the fixture says so — the lab can show the unknown state', () => {
  const known = knownMoneyTotals(labMoney({ suppliers: 'ok', orders: 'failed', costs: 'ok' }));
  assert.equal(known.partial, true);
  assert.equal(known.agreedPhp, null);
  assert.equal(known.owedAtLeastPhp, 994_400, 'the floor the prototype prints as "₱994,400+"');
});
