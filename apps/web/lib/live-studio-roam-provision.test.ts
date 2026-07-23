/**
 * Live Studio ROAM provisioning — pure-logic invariants (Node built-in test
 * runner via tsx). Guards buildRoamManifest(), the WRITE-side barrier that turns
 * zone + stream rows into the public picker manifest:
 *
 *   • a zone appears ONLY with an active stream carrying a real YouTube video id
 *   • complete/errored streams, invalid ids, and disabled zones are omitted
 *   • featured/venue/status carry through; output is ordered by zone_index
 *
 * Run: `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildRoamManifest, type RoamStreamRow, type RoamZoneRow } from './live-studio-roam-provision';

const VID_A = 'dQw4w9WgXcQ';
const VID_B = 'abcdefghijk';

function zone(partial: Partial<RoamZoneRow> & { id: number; zone_index: number }): RoamZoneRow {
  return {
    label: `Zone ${partial.zone_index}`,
    venue_label: null,
    is_featured: false,
    status: 'live',
    ...partial,
  };
}
function stream(partial: Partial<RoamStreamRow> & { zone_id: number }): RoamStreamRow {
  return { broadcast_id: VID_A, status: 'live', ...partial };
}

test('buildRoamManifest includes a zone that has an active stream with a valid video id', () => {
  const m = buildRoamManifest(
    [zone({ id: 10, zone_index: 1, label: 'Ceremony', venue_label: 'Church', is_featured: true })],
    [stream({ zone_id: 10, broadcast_id: VID_A })],
  );
  assert.equal(m.length, 1);
  assert.deepEqual(m[0], {
    zoneIndex: 1,
    label: 'Ceremony',
    venueLabel: 'Church',
    videoId: VID_A,
    featured: true,
    status: 'live',
  });
});

test('buildRoamManifest omits a zone with no stream', () => {
  const m = buildRoamManifest([zone({ id: 1, zone_index: 1 })], []);
  assert.equal(m.length, 0);
});

test('buildRoamManifest omits zones whose stream is complete or errored', () => {
  const m = buildRoamManifest(
    [zone({ id: 1, zone_index: 1 }), zone({ id: 2, zone_index: 2 })],
    [stream({ zone_id: 1, status: 'complete' }), stream({ zone_id: 2, status: 'errored' })],
  );
  assert.equal(m.length, 0);
});

test('buildRoamManifest omits a stream with an invalid broadcast id (write-side injection barrier)', () => {
  const m = buildRoamManifest(
    [zone({ id: 1, zone_index: 1 })],
    [stream({ zone_id: 1, broadcast_id: 'not-a-real-id' })],
  );
  assert.equal(m.length, 0);
});

test('buildRoamManifest omits a disabled zone even with a live stream', () => {
  const m = buildRoamManifest(
    [zone({ id: 1, zone_index: 1, status: 'disabled' })],
    [stream({ zone_id: 1 })],
  );
  assert.equal(m.length, 0);
});

test('buildRoamManifest orders by zone_index and carries fields through', () => {
  const m = buildRoamManifest(
    [
      zone({ id: 3, zone_index: 3, label: 'Booth', status: 'offline' }),
      zone({ id: 1, zone_index: 1, label: 'Aisle', venue_label: 'Church' }),
      zone({ id: 2, zone_index: 2, label: 'Floor', venue_label: 'Reception' }),
    ],
    [
      stream({ zone_id: 1, broadcast_id: VID_A }),
      stream({ zone_id: 2, broadcast_id: VID_B }),
      stream({ zone_id: 3, broadcast_id: VID_A, status: 'offline' as RoamStreamRow['status'] }),
    ],
  );
  assert.deepEqual(m.map((z) => z.label), ['Aisle', 'Floor', 'Booth']);
  assert.equal(m[0]?.venueLabel, 'Church');
  assert.equal(m[2]?.status, 'offline');
});

test('buildRoamManifest keeps the latest eligible stream per zone', () => {
  // Two streams for one zone (a re-provision); the later valid one wins.
  const m = buildRoamManifest(
    [zone({ id: 5, zone_index: 1 })],
    [
      stream({ zone_id: 5, broadcast_id: VID_A, status: 'complete' }), // old, finished
      stream({ zone_id: 5, broadcast_id: VID_B, status: 'live' }), // current
    ],
  );
  assert.equal(m.length, 1);
  assert.equal(m[0]?.videoId, VID_B);
});
