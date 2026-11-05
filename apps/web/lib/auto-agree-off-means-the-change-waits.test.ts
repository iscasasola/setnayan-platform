/**
 * auto-agree-off-means-the-change-waits.test.ts — 🔒 WITH AUTO-AGREE OFF, A SUPPLIER'S CHANGE WAITS.
 *
 * Owner 2026-11-01 (DECISION_LOG "SCHEDULE PLAN §9: EIGHT OPEN ITEMS RULED", item 4): *Auto-agree starts Off — supplier
 * changes wait for the host or coordinator.* And 3 Oct: *"yes correct. they still approve or decline"*.
 *
 *   1 · the decision runs for real: Off → the accept path is NEVER called and the request waits; a setting that could
 *       not be read (null, or a read that throws) is Off; On → the one accept path runs, once;
 *   2 · the wiring: every ask the supplier's action writes is settled through `settleAfterAsking`, which reads THE
 *       event's `supplier_requests_auto_agree` and applies only through `decideSuggestion` (the host's Approve path);
 *       the supplier's action itself never writes the schedule.
 *
 * Revert the guard in `settleSupplierRequest` (apply regardless) and test 1 fails.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { settleSupplierRequest } from '@/lib/supplier-schedule';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function spy() {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    apply: async () => {
      calls += 1;
      return 'applied' as const;
    },
  };
}

test('1 · Auto-agree OFF: the change waits and nothing is applied', async () => {
  const s = spy();
  assert.equal(await settleSupplierRequest(async () => false, s.apply), 'waits');
  assert.equal(s.calls, 0, 'a change was applied with Auto-agree off');
});

test('1 · a setting that could not be read is OFF — never the other way round', async () => {
  const s = spy();
  assert.equal(await settleSupplierRequest(async () => null, s.apply), 'waits');
  assert.equal(
    await settleSupplierRequest(async () => {
      throw new Error('read refused');
    }, s.apply),
    'waits',
  );
  assert.equal(s.calls, 0, 'an unread setting let a change in');
});

test('1 · Auto-agree ON: the one accept path runs, once', async () => {
  const s = spy();
  assert.equal(await settleSupplierRequest(async () => true, s.apply), 'applied');
  assert.equal(s.calls, 1);
  assert.equal(await settleSupplierRequest(async () => true, async () => 'words'), 'words', 'a suggestion in words is left for Noted');
});

test('2 · every ask is settled through the setting, and applied only by the host’s accept path', () => {
  const action = read('app/vendor-dashboard/clients/[eventId]/actions.ts');
  const fn = action.slice(
    action.indexOf('export async function suggestScheduleChange'),
    action.indexOf('export async function', action.indexOf('export async function suggestScheduleChange') + 10),
  );
  assert.ok(fn.length > 1000, 'could not slice suggestScheduleChange');
  const insert = fn.indexOf(".from('event_schedule_suggestions')");
  const settle = fn.indexOf('settleAfterAsking(');
  assert.ok(insert > 0 && settle > insert, 'an ask is written without being settled through the Auto-agree setting');
  assert.doesNotMatch(fn, /\.from\('event_schedule_(blocks|tasks)'\)\s*\.(insert|update|delete|upsert)\(/, 'the supplier’s action writes the schedule itself');
  assert.doesNotMatch(fn, /decideSuggestion\(/, 'the supplier’s action approves its own request');

  const decide = read('lib/schedule-suggestion-decide.server.ts');
  const settleFn = decide.slice(decide.indexOf('export async function settleAfterAsking'));
  assert.match(settleFn, /settleSupplierRequest\(/, 'Auto-agree is decided somewhere other than the guarded function');
  assert.match(settleFn, /\.select\('supplier_requests_auto_agree'\)/, 'the setting read is not the event’s Auto-agree');
  assert.match(settleFn, /decideSuggestion\(admin, null, eventId, suggestionId, 'accept', true, \{ auto: true \}\)/, 'Auto-agree applies through a second accept path');
});
