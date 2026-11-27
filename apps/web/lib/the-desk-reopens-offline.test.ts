/**
 * the-desk-reopens-offline.test.ts — final check A2-P22 (25 Nov 2026, plan batch A-2).
 *
 * The staging walk opened Home and the Check-in desk online, went offline, reloaded, and got the browser's own
 * "no internet" page. Traced: copies are kept only inside the event's window — from three days before the day
 * (`SAVE_FROM_DAYS_BEFORE`) to the day after — and the walked event was ~90 days out, so no copy existed and none was
 * promised (the desk's saved mark draws nothing outside the window). By design, not a fault. This file holds the
 * contract that makes the desk and Home reopen with no signal INSIDE the window:
 *   · both addresses are saved shapes, and Home's save covers the desk too;
 *   · the window opens at T-3 and is shut at T-90;
 *   · each page mounts its saver.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { coordinatorOfflinePaths, offlineSavingOpen, SAVE_FROM_DAYS_BEFORE } from '@/lib/offline-copies';
import { isOfflineCopyPath } from '@/lib/offline-copy-addresses';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(join(web, rel), 'utf8'));
const EV = '44c273b9-9c4a-4b92-8147-03c50ca46023';
const DAY = 86_400_000;

test('Home and the desk are saved shapes, and Home’s save keeps the desk too', () => {
  assert.equal(isOfflineCopyPath(`/dashboard/${EV}`), true);
  assert.equal(isOfflineCopyPath(`/dashboard/${EV}/guests/checkin`), true);
  assert.deepEqual(coordinatorOfflinePaths(EV, { checkin: true }), [`/dashboard/${EV}`, `/dashboard/${EV}/guests/checkin`]);
});

test('copies are kept from T-3 to the day after — shut ~90 days out, as on the walk', () => {
  assert.equal(SAVE_FROM_DAYS_BEFORE, 3);
  const day = '2027-02-23';
  const dayStart = Date.UTC(2027, 1, 22, 16, 0, 0); // 2027-02-23 00:00 Manila
  assert.equal(offlineSavingOpen(day, dayStart - 90 * DAY), false, '90 days out: nothing is kept');
  assert.equal(offlineSavingOpen(day, dayStart - 2 * DAY), true, 'two days out: kept');
  assert.equal(offlineSavingOpen(day, dayStart + 6 * 3_600_000), true, 'on the day: kept');
});

test('each page mounts its saver', () => {
  assert.match(src('app/dashboard/[eventId]/page.tsx'), /<ReadyForNoSignal\b/);
  assert.match(src('app/dashboard/[eventId]/guests/checkin/page.tsx'), /<DeskSavedMark\b/);
  assert.match(src('app/_components/offline-ready/ready-for-no-signal.tsx'), /paths: coordinatorOfflinePaths\(eventId, \{ checkin \}\)/);
});
