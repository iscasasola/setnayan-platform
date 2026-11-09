/**
 * 📅 NO LIFETIME QUOTATION (Supplier Build 3 · lane B; DECISION_LOG 📅 2026-11-09).
 *
 * What would silently undo it:
 *   1. a blank / past / after-the-event Valid until passes the rule;
 *   2. the picker preselects a choice, loses "Pick a date", or offers a choice past the event;
 *   3. a send path inserts its row BEFORE asking the rule (a half-sent quote), or a surface brings back a raw date
 *      input / a "No end date" choice;
 *   4. the database line (CHECK + send trigger) is dropped, so a path this file does not know about sends forever.
 *
 * Run: cd apps/web && npx tsx --test lib/quote-valid-until.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { addDaysIso, validUntilChoices, validUntilRefusal, validUntilWords } from './quote-valid-until';

const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

test('1 · the rule: blank, today, past and after-the-event are refused; tomorrow → event day is fine', () => {
  const today = '2026-11-09';
  assert.ok(validUntilRefusal('', today, null));
  assert.ok(validUntilRefusal(null, today, null));
  assert.ok(validUntilRefusal('11/23/2026', today, null));
  assert.ok(validUntilRefusal(today, today, null), 'today is not "after today"');
  assert.ok(validUntilRefusal('2026-11-01', today, null));
  assert.ok(validUntilRefusal('2026-12-13', today, '2026-12-12'));
  assert.equal(validUntilRefusal('2026-11-10', today, '2026-12-12'), null);
  assert.equal(validUntilRefusal('2026-12-12', today, '2026-12-12'), null, 'the event day itself is allowed');
});

test('2 · four choices, none preselected; a choice past the event is not offered; Pick a date always is', () => {
  const all = validUntilChoices('2026-11-09', null);
  assert.deepEqual(all.map((c) => c.label), ['7 days', '14 days', '30 days', 'Pick a date']);
  assert.equal(all[0]!.date, '2026-11-16');
  const near = validUntilChoices('2026-11-09', '2026-11-20');
  assert.deepEqual(near.map((c) => c.key), ['7', 'pick']);
  assert.equal(addDaysIso('2026-12-28', 7), '2027-01-04');
  assert.equal(validUntilWords('2026-11-23'), 'Valid until Nov 23');

  const picker = read('app/_components/valid-until-picker.tsx');
  assert.match(picker, /useState<ValidUntilChoiceKey \| ''>/, 'the picker must start with nothing picked');
  assert.match(picker, /<PickMenu/, 'one dropdown');
  assert.match(picker, /<DateRow/, 'Pick a date is the shipped calendar');
  assert.doesNotMatch(picker, /type="date"/);
});

test('3 · every send path asks the rule before it writes; no surface keeps a raw date input or "No end date"', () => {
  const send = read('lib/proposal-send.ts');
  for (const fn of ['export async function sendProposalCore', 'export async function sendCustomProposalCore']) {
    const body = send.slice(send.indexOf(fn));
    const ask = body.indexOf('validUntilRefusal(');
    const insert = body.indexOf(".from('vendor_proposals')\n    .insert(");
    assert.ok(ask > 0 && insert > 0 && ask < insert, `${fn}: the Valid until rule must refuse before the insert`);
  }
  const draftSend = read('app/vendor-dashboard/proposals/actions.ts');
  const sendFn = draftSend.slice(draftSend.indexOf('export async function sendProposal('));
  assert.ok(
    sendFn.indexOf('validUntilRefusal(') > 0 && sendFn.indexOf('validUntilRefusal(') < sendFn.indexOf(".update({ status: 'sent'"),
    'sending a draft must refuse a blank Valid until before the flip',
  );
  for (const rel of [
    'app/vendor-dashboard/proposals/surface.tsx',
    'app/vendor-dashboard/messages/[threadId]/_components/send-proposal-card.tsx',
    'app/_components/proposal-maker.tsx',
  ]) {
    const s = read(rel);
    assert.match(s, /<ValidUntilPicker/, `${rel}: the shared picker`);
    assert.doesNotMatch(s, /name="valid_until"[^>]*type="date"|type="date"[^>]*name="valid_until"/, `${rel}: raw date input`);
    assert.doesNotMatch(s, /No end date/, `${rel}: a lifetime choice is back`);
  }
});

test('4 · the database holds the same line: sent/viewed ⇒ a Valid until (legacy rows exempt, never invented)', () => {
  const dir = join(WEB, '..', '..', 'supabase', 'migrations');
  const sql = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .join('\n');
  assert.match(sql, /vendor_proposals_sent_has_valid_until\s+CHECK \(status NOT IN \('sent', 'viewed'\) OR valid_until IS NOT NULL OR valid_until_legacy\)/);
  assert.match(sql, /VALID_UNTIL_AFTER_THE_EVENT/);
});
