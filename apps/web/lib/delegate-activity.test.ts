/**
 * delegate-activity.test.ts — "what your helpers did" says the same sentence
 * about the same row wherever it is shown (the Hosts fold, 2026-09-30: the
 * Hosts page's delegate activity became the Overview feed).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { delegateActivityLine, delegateObject, delegateVerb, UNNAMED_HELPER } from '@/lib/delegate-activity';

const row = (over: Partial<Parameters<typeof delegateActivityLine>[0]> = {}) => ({
  id: 'log-1',
  performed_by_user_id: 'u1',
  action_type: 'delegate_update',
  action_target_table: 'guests',
  notes: null,
  payload_json: { area: 'guest_list' },
  performed_at: '2026-09-30T02:00:00Z',
  ...over,
});

test('the verb is the action type’s ending', () => {
  assert.equal(delegateVerb('delegate_insert'), 'added');
  assert.equal(delegateVerb('delegate_delete'), 'removed');
  assert.equal(delegateVerb('delegate_update'), 'updated');
});

test('the object is the couple’s word for the area, the table when no area says', () => {
  assert.equal(delegateObject('guest_list', 'guests'), 'a guest');
  assert.equal(delegateObject('seat_plan', 'x'), 'the seat plan');
  assert.equal(delegateObject('schedule', 'x'), 'a schedule block');
  assert.equal(delegateObject('vendors', 'x'), 'a vendor record');
  assert.equal(delegateObject(null, 'mood_boards'), 'mood_boards');
  assert.equal(delegateObject(undefined, null), 'the plan');
});

test('one line: who, what, the note, when', () => {
  assert.deepEqual(delegateActivityLine(row({ action_type: 'delegate_insert', notes: ' Tita Baby ' }), 'Ana'), {
    key: 'log-1',
    who: 'Ana',
    did: 'added a guest',
    note: 'Tita Baby',
    at: '2026-09-30T02:00:00Z',
  });
});

test('a name that could not be read is a helper, never an empty string or an id', () => {
  assert.equal(delegateActivityLine(row(), null).who, UNNAMED_HELPER);
  assert.equal(delegateActivityLine(row(), '   ').who, UNNAMED_HELPER);
  assert.equal(delegateActivityLine(row({ notes: '  ' }), 'Ana').note, null);
});
