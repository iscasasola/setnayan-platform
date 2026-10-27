/**
 * supplier-work.test.ts — the rules Admin › Work's supplier section decides by (admin supplier slice, owner
 * 2026-10-28). Each is CALLED, not matched as text.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPLIER_WORK_REASONS,
  coerceSupplierWorkKind,
  countByKind,
  matchPercent,
  orderSupplierWork,
  pickedReason,
  redirectRefusal,
  workBackHref,
  type SupplierWorkItem,
} from './supplier-work';

test('a decline / needs-a-fix without a reason from ITS list is refused (null)', () => {
  assert.equal(pickedReason('names', ''), null);
  assert.equal(pickedReason('names', null), null);
  assert.equal(pickedReason('names', 'because I said so'), null, 'a typed reason is not a reason from the list');
  assert.equal(pickedReason('names', SUPPLIER_WORK_REASONS.docs[0]), null, 'a reason from ANOTHER list is refused');
  assert.equal(pickedReason('docs', ` ${SUPPLIER_WORK_REASONS.docs[1]} `), SUPPLIER_WORK_REASONS.docs[1]);
  assert.equal(pickedReason('cards', SUPPLIER_WORK_REASONS.cards[0]), SUPPLIER_WORK_REASONS.cards[0]);
});

test('no reason can send a price rule the owner ruled out (2026-10-26 "NO PRICE CHECK ON SERVICE CARDS AT ALL")', () => {
  for (const list of Object.values(SUPPLIER_WORK_REASONS)) {
    for (const r of list) assert.doesNotMatch(r, /price/i, `"${r}" names a price check that does not exist`);
  }
});

const item = (key: string, kind: SupplierWorkItem['kind'], at: string) =>
  ({ key, kind, at, title: key, line: '' }) as unknown as SupplierWorkItem;

test('oldest first; a tie keeps the chip order', () => {
  const out = orderSupplierWork([
    item('m', 'msgs', '2026-10-28T03:00:00Z'),
    item('d', 'docs', '2026-10-28T01:00:00Z'),
    item('n', 'names', '2026-10-28T03:00:00Z'),
  ]);
  assert.deepEqual(out.map((i) => i.key), ['d', 'n', 'm']);
  assert.deepEqual(countByKind(out), { docs: 1, names: 1, cards: 0, types: 0, msgs: 1 });
});

test('a settled row comes back to the SAME list: item dropped, chip kept, outcome said', () => {
  const back = workBackHref('/admin/work?kind=docs&item=docs:1&settle=old', 'approved');
  assert.equal(back, '/admin/work?kind=docs&settle=approved');
  const refused = workBackHref('/admin/work', 'refused', 'Pick the reason the shop will see.');
  assert.match(refused, /^\/admin\/work\?settle=refused&why=Pick/);
});

test('a redirect that carries error= is a refusal; a plain redirect is a success', () => {
  assert.equal(redirectRefusal('NEXT_REDIRECT;replace;/admin/corrections?applied=1;307;'), null);
  assert.equal(redirectRefusal('NEXT_REDIRECT;replace;/admin/corrections?declined=1;307;'), null);
  assert.equal(
    redirectRefusal('NEXT_REDIRECT;replace;/admin/corrections?error=That%20address%20was%20just%20taken.;307;'),
    'That address was just taken.',
  );
  assert.equal(redirectRefusal('NEXT_REDIRECT;replace;/admin/corrections;307;'), null);
});

test('kind chips: unknown ⇒ everything; match % from the pHash distance', () => {
  assert.equal(coerceSupplierWorkKind('docs'), 'docs');
  assert.equal(coerceSupplierWorkKind('nope'), undefined);
  assert.equal(matchPercent(0), 100);
  assert.equal(matchPercent(64), 0);
  assert.equal(matchPercent(3), 95);
});
