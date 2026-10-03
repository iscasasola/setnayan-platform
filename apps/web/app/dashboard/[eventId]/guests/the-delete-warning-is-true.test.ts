/**
 * the-delete-warning-is-true.test.ts — WHAT THE DELETE WARNING PROMISES GOES,
 * GOES; AND THE UNDO BRINGS IT BACK — FROM THE DATABASE, NEVER THE BROWSER.
 *
 * ⚖ Owner 2026-10-03 (DECISION_LOG "A HOST CAN DELETE A GUEST WHO ALREADY
 * ACCEPTED"): the in-page warning names what goes with a guest — "their reply
 * and answers, seat, +1, song request and the link to their account". The song
 * request did NOT go: a soft delete leaves the guest row, and with it their
 * `event_song_requests` row (its FK acts only on a hard delete).
 *
 * 🔒 2026-10-04 (review of #6311): the first fix handed the song requests to
 * the browser and wrote back whatever came back, with the service role — so a
 * host could forge which supplier decided a request, and "restore" requests
 * onto guests that were never deleted. Now the delete MOVES them into a
 * service-only pen (`release_deleted_guest_song_requests`) and the Undo reads
 * them back from there (`restore_deleted_guests`), which also decides from the
 * table which guests are really deleted. The SQL half is proven against the
 * replayed schema in tests/db/the-undo-restores-only-what-was-deleted.db.test.ts;
 * this file pins that the actions really go through it.
 *
 * 🛡 Sabotage: putting a song parameter back on `restoreDeletedGuests`, or
 * dropping the release RPC from the delete, turns this red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const HERE = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests');
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, ...p), 'utf8'));

test('the delete hands the song requests to the database, and the Undo takes them back from it', () => {
  const warning = read('_components', 'guest-delete.tsx');
  assert.match(warning, /song request and the link to their account go with them/, 'the warning changed — re-check what this guard promises');
  const actions = read('groups-actions.ts');
  const del = actions.slice(
    actions.indexOf('export async function bulkSoftDeleteGuestsForUndo('),
    actions.indexOf('export async function restoreDeletedGuests('),
  );
  // Acts on the guests RLS REALLY deleted, never the ids the browser sent.
  assert.match(del, /\.update\(\{ deleted_at: new Date\(\)\.toISOString\(\) \}\)[\s\S]*?\.select\('guest_id'\);/, 'the soft delete no longer reports which guests it really deleted');
  const songs = del.slice(del.indexOf('const deletedIds'));
  assert.match(
    songs,
    /rpc\('release_deleted_guest_song_requests', \{\s*p_event_id: eventId,\s*p_guest_ids: deletedIds,?\s*\}\)/,
    'the warning says the song request goes — and the delete no longer takes it',
  );
  assert.match(del, /return \{ ok: true, removedIds, releasedSeats \};/, 'the delete hands something new to the browser — song data must never travel there');
  assert.doesNotMatch(del, /event_song_requests/, 'the delete touches song requests directly again, outside the pen');

  const restore = actions.slice(actions.indexOf('export async function restoreDeletedGuests('));
  const signature = restore.slice(0, restore.indexOf('): Promise<RestoreResult>'));
  assert.match(signature, /seats: ReleasedSeat\[\],?\s*$/, 'the Undo takes something after the seats again — song data from the browser?');
  assert.match(restore, /rpc\('restore_deleted_guests', \{\s*p_event_id: eventId,\s*p_guest_ids: ids,?\s*\}\)/, 'the Undo no longer lets the database decide what is restored');
  assert.doesNotMatch(restore, /from\('guests'\)|event_song_requests|createAdminClient/, 'the Undo writes guests or song requests itself again');
  assert.match(restore, /\.filter\(\(s\) => s && restoredIds\.has\(s\.guest_id\)\)/, 'seats go back to guests that were not really restored');

  // The one delete path hands them to the one Undo — with no song data.
  assert.match(warning, /restoreDeletedGuests\(eventId, plan\.guestIds, plan\.seats\)/, 'the Undo call changed shape');
});
