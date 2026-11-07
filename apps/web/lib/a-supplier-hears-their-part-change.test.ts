/**
 * 🔔 A SUPPLIER HEARS WHEN A HOST CHANGES THEIR PART (supplier gate audit D6, 2026-11-02; owner: *"getting
 * notifications if they are changed by user"*).
 *
 * Two halves, both executed or read from the real files:
 *  1. The rules (`lib/supplier-part-notice.ts`): a delete and a "took you off" are told (the before-side), a guests-only
 *     toggle is not, and one save over many moments is ONE change list per supplier.
 *  2. The wiring: every host schedule action that changes a supplier's moment reads BEFORE its write and tells AFTER it.
 *     Remove either call from any of them and this fails by name.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripComments } from './strip-comments';
import { changesByVendor, supplierPartBody, supplierPartTitle, type PartMoment } from './supplier-part-notice';

const here = dirname(fileURLToPath(import.meta.url));
const ACTIONS = join(here, '..', 'app', 'dashboard', '[eventId]', 'schedule', 'actions.ts');

const m = (id: string, vendors: string[], extra: Partial<PartMoment> = {}): PartMoment => ({
  block_id: id,
  parent_block_id: null,
  label: `Moment ${id}`,
  responsible_vendor_ids: vendors,
  start_at: '2026-12-12T16:00:00Z',
  end_at: '2026-12-12T16:30:00Z',
  ...extra,
});

test('a deleted moment tells every supplier who was on it (the before-side), as "removed"', () => {
  const out = changesByVendor([m('a', ['v1', 'v2'])], []);
  assert.deepEqual(out.get('v1'), [{ blockId: 'a', label: 'Moment a', kind: 'removed' }]);
  assert.equal(out.get('v2')?.[0]?.kind, 'removed');
});

test('re-assigning tells the supplier taken off AND the one put on; one left on with nothing else moved hears nothing', () => {
  const out = changesByVendor([m('a', ['v1', 'v2'])], [m('a', ['v2', 'v3'])]);
  assert.equal(out.get('v1')?.[0]?.kind, 'taken_off');
  assert.equal(out.get('v3')?.[0]?.kind, 'added');
  assert.equal(out.has('v2'), false);
});

test('a retime tells the suppliers on it; a guests-only toggle (is_public) tells nobody', () => {
  const moved = changesByVendor([m('a', ['v1'])], [m('a', ['v1'], { start_at: '2026-12-12T16:15:00Z' })]);
  assert.equal(moved.get('v1')?.[0]?.kind, 'changed');
  const shown = changesByVendor([m('a', ['v1'])], [{ ...m('a', ['v1']), is_public: true } as PartMoment]);
  assert.equal(shown.size, 0);
});

test('a crew line or march (touched) tells the suppliers on the moment even though no field moved', () => {
  const out = changesByVendor([m('a', ['v1'])], [m('a', ['v1'])], new Set(['a']));
  assert.equal(out.get('v1')?.[0]?.kind, 'changed');
});

test('one save over many moments is ONE change list per supplier, and the words count them', () => {
  const before = [m('a', ['v1']), m('b', ['v1']), m('c', ['v1'])];
  const after = before.map((x) => ({ ...x, start_at: '2026-12-12T17:00:00Z' }));
  const list = changesByVendor(before, after).get('v1') ?? [];
  assert.equal(list.length, 3);
  assert.equal(supplierPartTitle(list), 'Your part changed');
  assert.match(supplierPartBody('Ana & Ben', list), /^Ana & Ben changed 3 of your moments/);
  assert.match(supplierPartBody('Ana & Ben', [list[0]!]), /^Ana & Ben changed “Moment a”/);
});

/** The body of one exported action, comments stripped (a call named only in a comment does not count). */
function actionBody(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} is gone from schedule/actions.ts — re-point this guard at where it moved`);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end);
}

const src = stripComments(readFileSync(ACTIONS, 'utf8'));

/** Every host action that changes a moment a supplier may be on. */
const TELLS = ['updateScheduleBlock', 'deleteScheduleBlock', 'setBlockResponsibleParty', 'bulkRetimeScheduleBlocks'] as const;

for (const name of TELLS) {
  test(`${name} reads the suppliers BEFORE its write and tells them AFTER it`, () => {
    const body = actionBody(src, name);
    const before = body.indexOf('partBefore(');
    const tell = body.indexOf('tellPartSuppliers(');
    assert.ok(before >= 0, `${name} never reads who is on the moment before writing — a delete or a "took you off" is silent`);
    assert.ok(tell >= 0, `${name} never tells the suppliers on the moment it changed`);
    assert.ok(before < tell, `${name} tells before it reads — the before-side would be the after-side`);
  });
}

test('updateScheduleBlock covers BOTH its doors: a moment op (crew line, ticked supplier) and the field save / chapter move', () => {
  const body = actionBody(src, 'updateScheduleBlock');
  const opDoor = body.slice(0, body.indexOf('type Patch'));
  assert.match(opDoor, /tellPartSuppliers\(/, 'the moment-op door returns before the field save — it must tell on its own');
  assert.match(body.slice(body.indexOf('type Patch')), /withChildren:\s*withMoments/, 'a chapter move carries its moments — their suppliers must be read too');
});

test('toggleBlockVisibility is deliberately NOT a part change: showing a moment to guests moves nobody', () => {
  // If this starts telling suppliers, take it off this line on purpose — do not let it drift in.
  assert.doesNotMatch(actionBody(src, 'toggleBlockVisibility'), /tellPartSuppliers\(/);
});

test('the notice is in-app only — not on the email allowlist', () => {
  const emit = readFileSync(join(here, 'notification-emit.ts'), 'utf8');
  const allow = emit.slice(emit.indexOf('EMAIL_ENABLED_TYPES'), emit.indexOf(']);', emit.indexOf('EMAIL_ENABLED_TYPES')));
  assert.doesNotMatch(allow, /supplier_part_changed/);
});
