/**
 * GUARD — the Check-in desk's offline queue IS the shipped offline daemon (EV3 brief: "The scanner's offline queue MUST
 * reuse the existing sync daemon, not a second queue"), and a queued scan is never lost silently.
 *
 * Source-reading half: the desk reaches the queue only through `lib/offline/checkin-queue.ts`, which writes with the
 * daemon's `enqueueOfflineItem('checkin', …)` and sends with the daemon's `triggerSyncNow()`; the daemon routes the
 * `checkin` store to `checkin-handler.ts`. Behaviour half: the handler's endings (another account's scan waits; a gave-up
 * item leaves a note) run here with a stand-in localStorage.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { SERVICE_CODES } from './types';

const root = path.join(import.meta.dirname, '..', '..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');
const strip = stripComments;

test('the desk has no queue of its own — it reaches the daemon through checkin-queue.ts', () => {
  const desk = strip(read('app/dashboard/[eventId]/guests/checkin/_components/checkin-desk.tsx'));
  assert.match(desk, /import\('@\/lib\/offline\/checkin-queue'\)/, 'the desk no longer loads the daemon-backed queue');
  for (const own of [/indexedDB/, /localStorage/, /sessionStorage/, /idb-keyval/, /caches\./]) {
    assert.doesNotMatch(desk, own, `the desk keeps scans itself (${own}) — a second queue beside the daemon`);
  }
  const queue = strip(read('lib/offline/checkin-queue.ts'));
  assert.match(queue, /enqueueOfflineItem\('checkin'/, 'a scan is no longer written to the daemon’s checkin store');
  assert.match(queue, /triggerSyncNow\(\)/, 'queued scans are no longer sent by the daemon');
  assert.doesNotMatch(queue, /indexedDB\.open|new IDBFactory/, 'checkin-queue.ts opened its own database');
});

test('the daemon routes the checkin store to its handler, and tells it when it gives an item up', () => {
  assert.ok(SERVICE_CODES.includes('checkin'), 'checkin is not one of the daemon’s queues');
  const daemon = strip(read('lib/offline/sync-daemon.ts'));
  assert.match(daemon, /checkin:\s*syncOneCheckin/, 'the daemon has no handler for checkin');
  assert.match(daemon, /checkin:\s*checkinGaveUp/, 'an evicted check-in would vanish without a note');
  assert.match(daemon, /ON_EVICT\[service\]\?\.\(item\)/, 'the eviction no longer calls the service’s note');
});

test('a scan waits for the account that made it; a gave-up scan leaves a note', async () => {
  const store = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
  try {
    const h = await import('./service-handlers/checkin-handler');
    const item = {
      item_id: 'i1',
      event_id: 'E1',
      queued_at: '2026-11-14T06:00:00.000Z',
      retry_count: 0,
      payload: { viewer: 'ana', guestId: 'g1', name: 'Jose Santos', method: 'qr_scan', scannedAt: '2026-11-14T06:00:00.000Z' },
    };
    h.setCheckinViewer('ben');
    const waits = await h.syncOne(item);
    assert.equal(waits.ok, false, 'Ben’s phone sent Ana’s scan');
    h.setCheckinViewer(null);
    assert.equal((await h.syncOne(item)).ok, false, 'a scan was sent with nobody signed in at the desk');
    h.noteGaveUp(item);
    const notes = h.readCheckinNotes('ana', 'E1');
    assert.equal(notes.length, 1);
    assert.equal(notes[0]!.kind, 'gave-up');
    assert.match(notes[0]!.detail, /never reached Setnayan — check them in again/);
    assert.deepEqual(h.readCheckinNotes('ben', 'E1'), [], 'another account reads Ana’s notes');
    h.dismissCheckinNote('ana', 'E1', 'g1');
    assert.deepEqual(h.readCheckinNotes('ana', 'E1'), []);
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
});

test('checkInGuest dates a late-sent scan to the door, and says ALREADY and REFUSED out loud', () => {
  const actions = strip(read('app/dashboard/[eventId]/guests/checkin/actions.ts'));
  assert.match(actions, /scannedAt\?: string/, 'checkInGuest no longer takes the time a scan was made');
  assert.match(actions, /checked_in_at: at/, 'the scan time is no longer written');
  assert.match(actions, /already: true/, 'a double check-in is no longer reported as one');
  assert.ok((actions.match(/refused: true/g) ?? []).length >= 4, 'a permanent refusal is no longer marked — the queue would retry it forever');
});
