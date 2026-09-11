/**
 * deposit-refusal-history — the words /admin/disputes uses for a deposit refusal
 * that has ended, and the two reads that feed them (FOLLOW-UPS A). The history
 * itself is proven by behaviour in tests/db/a-deposit-refusal-survives-a-resend.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  REFUSAL_CLOSURE_LABEL,
  closureLabel,
  historyByBooking,
  rulingLine,
  type DepositRefusalHistoryRow,
} from '@/lib/deposit-refusal-history';

const WEB = join(import.meta.dirname, '..');
const MIGRATION = readFileSync(
  join(WEB, '../../supabase/migrations/20271223918326_a_deposit_refusal_survives_a_resend.sql'),
  'utf8',
);

test('every closure the database may write has words, and nothing else does', () => {
  const check = /closed_by IN \(([^)]*)\)/.exec(MIGRATION);
  assert.ok(check, 'the closed_by CHECK moved — re-derive this');
  const inDb = [...check[1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!).sort();
  assert.deepEqual(Object.keys(REFUSAL_CLOSURE_LABEL).sort(), inDb);
  assert.equal(closureLabel('couple_resent'), 'the couple sent it again');
  assert.equal(closureLabel('something_new'), 'something_new', 'an unknown value is shown, not hidden');
});

test('a ruling reads as Setnayan\'s, with its note; no ruling is no line', () => {
  assert.equal(
    rulingLine({ dispute_outcome: 'not_received', dispute_note: ' no transfer ' }),
    'Setnayan found it did not arrive — “no transfer”',
  );
  assert.equal(rulingLine({ dispute_outcome: 'payment_stands', dispute_note: null }), 'Setnayan ruled the payment stands');
  assert.equal(rulingLine({ dispute_outcome: null, dispute_note: 'x' }), null);
});

test('history groups by booking, newest first', () => {
  const row = (id: string, booking: string, closed: string): DepositRefusalHistoryRow => ({
    refusal_id: id,
    event_vendor_id: booking,
    vendor_name: null,
    refused_at: closed,
    reason: null,
    dispute_outcome: null,
    dispute_note: null,
    closed_at: closed,
    closed_by: 'couple_resent',
  });
  const g = historyByBooking([row('a', 'b1', '2026-09-01'), row('b', 'b1', '2026-09-05'), row('c', 'b2', '2026-09-03')]);
  assert.deepEqual(g.get('b1')!.map((r) => r.refusal_id), ['b', 'a']);
  assert.deepEqual(g.get('b2')!.map((r) => r.refusal_id), ['c']);
});

test('the disputes page reads the history — for each open dispute, and every recent re-send', () => {
  const src = stripComments(
    readFileSync(join(WEB, 'app/admin/disputes/_components/deposit-disputes-section.tsx'), 'utf8'),
  );
  assert.match(src, /from\('event_vendor_deposit_refusals'\)[\s\S]*?\.in\('event_vendor_id', openIds\)/);
  assert.match(src, /from\('event_vendor_deposit_refusals'\)[\s\S]*?\.eq\('closed_by', 'couple_resent'\)/);
  assert.match(src, /const admin = createAdminClient\(\)/, 'the history has no session grant — it is read on the service client');
});
