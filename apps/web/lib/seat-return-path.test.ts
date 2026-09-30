/**
 * seat-return-path.test.ts — a host-seat action lands back on the screen it
 * was pressed on, and a hidden field can never send it anywhere else (the
 * Hosts fold, 2026-09-30).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { seatReturnPath, seatReturnScreen } from '@/lib/seat-return-path';

const V = '0f8b3a52-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
const G = '1a2b3c4d-5e6f-4a1b-9c8d-7e6f5a4b3c2d';
const form = (fields: Record<string, string>) => ({ get: (k: string) => fields[k] ?? null });

test('from the planner’s workspace, back to its Details tab and the card', () => {
  assert.equal(
    seatReturnPath(form({ vendor_id: V }), 'E', { invite_sent: '1', token: 'tok' }),
    `/dashboard/E/vendors/${V}/workspace?invite_sent=1&token=tok&tab=details#promote-coordinator`,
  );
  assert.equal(seatReturnScreen(form({ vendor_id: V }), 'E'), `/dashboard/E/vendors/${V}/workspace`);
});

test('from a guest card, back to that card', () => {
  assert.equal(seatReturnPath(form({ guest_id: G }), 'E', { grant_updated: '1' }), `/dashboard/E/guests/${G}?grant_updated=1`);
  assert.equal(seatReturnScreen(form({ guest_id: G }), 'E'), `/dashboard/E/guests/${G}`);
});

test('anything else lands on the guest list — never where a field says', () => {
  for (const bad of ['../../admin', 'https://evil.example', `${V}/../../x`, '', 'not-an-id']) {
    assert.equal(seatReturnPath(form({ vendor_id: bad, guest_id: bad }), 'E', { host_removed: '1' }), '/dashboard/E/guests?host_removed=1');
  }
  assert.equal(seatReturnPath(form({}), 'E', {}), '/dashboard/E/guests');
});

test('a flash is encoded, never pasted', () => {
  assert.equal(
    seatReturnPath(form({}), 'E', { invite_error: 'A & B?#' }),
    '/dashboard/E/guests?invite_error=A+%26+B%3F%23',
  );
});
