/**
 * a-loading-copy-never-draws-counts-as-real.test.ts — 🔒 W4 B3 (18 Nov 2026): Guests drew "Total guests 1 · 8% replied ·
 * BRIDE & GROOM 0 · GUESTS 1" while loading, then settled at the real 6 / 50%. While the fresh list is coming, the
 * phone's OLD copy is on screen (`copy.freshness === 'updating'`): its rows stay (owner 2026-10-16 "opens from the
 * phone"), its COUNTS wait — a loading state never draws as data. A FAILED refresh keeps its counts (dimmed, with the
 * "may be out of date" line); a fresh list draws them as ever.
 *
 * SABOTAGE: draw the carousel under `updating` again → test 1 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guestRow, renderGuestsScreen } from './_components/render-guests-screen';

const guests = [
  guestRow({ role: 'bride', rsvp_status: 'attending', custom_tags: [] } as never),
  guestRow({ role: 'groom', side: 'groom', rsvp_status: 'attending', custom_tags: [] } as never),
  ...Array.from({ length: 6 }, (_, i) => guestRow({ first_name: `Guest${i}`, custom_tags: [] } as never)),
];
const SAVED = Date.UTC(2026, 9, 15, 7, 42);

test('1 · while the fresh list comes, the old copy keeps its rows but draws NO counts', async () => {
  const html = await renderGuestsScreen({ guests, copy: { freshness: 'updating', savedAt: SAVED } });
  assert.match(html, /data-roster-counts-waiting=""/);
  assert.match(html, /aria-busy="true"/);
  assert.doesNotMatch(html, /Total guests|% replied|data-guests-carousel|data-guests-card=/, 'the copy\'s counts read as today\'s');
  assert.match(html, /data-guest-row=""/, 'the rows stay');
  assert.match(html, /data-roster-counts=""/, 'the strip keeps its place');
});

test('2 · a FRESH list draws its counts, and a FAILED refresh keeps them (the line says out of date)', async () => {
  const fresh = await renderGuestsScreen({ guests });
  assert.match(fresh, /Total guests/);
  assert.match(fresh, /data-guests-carousel=""/);
  assert.doesNotMatch(fresh, /data-roster-counts-waiting/);
  const failed = await renderGuestsScreen({ guests, copy: { freshness: 'failed', savedAt: SAVED } });
  assert.match(failed, /Total guests/);
  assert.doesNotMatch(failed, /data-roster-counts-waiting/);
});
