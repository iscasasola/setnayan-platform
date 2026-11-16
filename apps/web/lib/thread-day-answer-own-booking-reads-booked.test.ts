/**
 * 📅 CHAT-29 (walk 16 Nov 2026): the supplier's own booked date read a red "⊗ Not available" on the conversation's
 * answer line — the couple's own booking had closed the day, and the line read the closure, not whose it was.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { threadDayAnswerOf, threadDayWords } from './thread-day-answer';

test('a day held by this couple reads Booked, never Not available', () => {
  for (const state of ['blocked', 'locked', 'full', null] as const) {
    const a = threadDayAnswerOf({ day: { state, consumed: 1, capacity: 1 }, hasSchedule: true, heldByThisEvent: true });
    assert.deepEqual(a, { kind: 'booked' });
    assert.equal(threadDayWords(a!).word, 'Booked');
    assert.equal(threadDayWords(a!).tone, 'ok');
  }
});

test('a day closed by someone else still reads Not available', () => {
  const a = threadDayAnswerOf({ day: { state: 'blocked', consumed: 0, capacity: 1 }, hasSchedule: true });
  assert.deepEqual(a, { kind: 'not_available' });
});

test('the read checks the hold against THIS event, and the thread page passes it', () => {
  const server = readFileSync(join(process.cwd(), 'lib/thread-day-answer.server.ts'), 'utf8');
  assert.match(server, /select\('pool_id, event_id'\)/);
  assert.match(server, /heldByThisEvent/);
  const page = readFileSync(join(process.cwd(), 'app/vendor-dashboard/messages/[threadId]/page.tsx'), 'utf8');
  assert.match(page, /readThreadDayAnswer\(supabase, \{[\s\S]{0,200}eventId: thread\.event_id/);
});
