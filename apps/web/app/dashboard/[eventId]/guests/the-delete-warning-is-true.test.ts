/**
 * the-delete-warning-is-true.test.ts — WHAT THE DELETE WARNING PROMISES GOES,
 * GOES; AND THE UNDO BRINGS IT BACK.
 *
 * ⚖ Owner 2026-10-03 (DECISION_LOG "A HOST CAN DELETE A GUEST WHO ALREADY
 * ACCEPTED"): the in-page warning names what goes with a guest — "their reply
 * and answers, seat, +1, song request and the link to their account". The song
 * request did NOT go: a soft delete leaves the guest row, and with it their
 * `event_song_requests` row (its FK acts only on a hard delete). The act's inbox
 * kept the request of somebody no longer on the list.
 *
 * Now the delete takes them away and hands them to the Undo, exactly like the
 * seat, and the Undo writes them back through ONE re-check
 * (`restorableSongRequests`, lib/released-song-requests.ts).
 *
 * 🛡 Sabotaged (see the PR): removing the `event_song_requests` delete from
 * `bulkSoftDeleteGuestsForUndo` turns the second test red; letting
 * `restorableSongRequests` accept another guest's row turns the first red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { restorableSongRequests } from '@/lib/released-song-requests';

const HERE = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests');
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, ...p), 'utf8'));

const R1 = '11111111-1111-4111-8111-111111111111';
const R2 = '22222222-2222-4222-8222-222222222222';
const V = '33333333-3333-4333-8333-333333333333';

test('the Undo writes back only what may be written back', () => {
  const restored = new Set(['g-ana']);
  const rows = [
    { request_id: R1, guest_id: 'g-ana', song_id: 42, requester_name: '  Ana  ', status: 'accepted', decided_by_vendor_profile_id: V, decided_at: '2026-10-03T10:00:00Z', created_at: '2026-10-01T10:00:00Z' },
    // Another guest's request — never written back on Ana's Undo.
    { request_id: R2, guest_id: 'g-ben', song_id: 7, status: 'pending', created_at: '2026-10-01T10:00:00Z' },
    // Malformed copies from the browser.
    { request_id: 'not-a-uuid', guest_id: 'g-ana', song_id: 1, status: 'pending' },
    { request_id: '44444444-4444-4444-8444-444444444444', guest_id: 'g-ana', song_id: -3, status: 'pending' },
    { request_id: '55555555-5555-4555-8555-555555555555', guest_id: 'g-ana', song_id: 3, status: 'played' },
    // The same row twice.
    { request_id: R1, guest_id: 'g-ana', song_id: 42, status: 'accepted' },
    null,
    'junk',
  ];
  const out = restorableSongRequests(rows, restored);
  assert.equal(out.length, 1, `only Ana's one real request may come back — got ${JSON.stringify(out)}`);
  assert.deepEqual(out[0], {
    request_id: R1,
    guest_id: 'g-ana',
    song_id: 42,
    requester_name: 'Ana',
    status: 'accepted',
    decided_by_vendor_profile_id: V,
    decided_at: '2026-10-03T10:00:00Z',
    created_at: '2026-10-01T10:00:00Z',
  });
  // The table's CHECK pairs status and decided_at — the copy is made to agree.
  const [pending] = restorableSongRequests(
    [{ request_id: R1, guest_id: 'g-ana', song_id: 42, status: 'pending', decided_at: '2026-10-03T10:00:00Z', decided_by_vendor_profile_id: V }],
    restored,
  );
  assert.equal(pending!.decided_at, null);
  assert.equal(pending!.decided_by_vendor_profile_id, null);
  const [declined] = restorableSongRequests([{ request_id: R1, guest_id: 'g-ana', song_id: 42, status: 'declined' }], restored);
  assert.ok(declined!.decided_at, 'a decided request came back without its decision stamp — the insert would be refused');
  // The copy can never choose its event, lane or device key.
  assert.ok(!('event_id' in out[0]!) && !('origin' in out[0]!) && !('anon_key' in out[0]!));
});

test('the delete takes the song requests the warning names, and the Undo brings them back', () => {
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
  assert.match(songs, /from\('event_song_requests'\)[\s\S]*\.eq\('origin', 'guest'\)[\s\S]*\.in\('guest_id', deletedIds\)/, 'the delete no longer finds the guest’s song requests');
  assert.match(songs, /from\('event_song_requests'\)\s*\.delete\(\)\s*\.eq\('event_id', eventId\)/, 'the warning says the song request goes — and it no longer does');
  assert.match(del, /return \{ ok: true, removedIds, releasedSeats, releasedSongs \};/, 'the Undo is not handed the song requests');
  const restore = actions.slice(actions.indexOf('export async function restoreDeletedGuests('));
  assert.match(restore, /songs: ReleasedSongRequest\[\] = \[\]/);
  assert.match(restore, /restorableSongRequests\(\s*songs \?\? \[\],\s*new Set\(\(restoredRows \?\? \[\]\)/, 'the Undo writes back song requests without the one re-check');
  assert.match(restore, /event_id: eventId, origin: 'guest', anon_key: null/, 'the Undo lets the copy choose its event or lane');
  assert.match(restore, /onConflict: 'event_id,song_id', ignoreDuplicates: true/, 'the Undo would overwrite somebody else’s request for the same song');
  // The one delete path hands them to the one Undo.
  assert.match(warning, /restoreDeletedGuests\(eventId, plan\.guestIds, plan\.seats, releasedSongs\)/, 'the Undo does not bring the song requests back');
});
