/**
 * Unit suite for buildPapicGeoFields — the fail-closed geo-stamp gate.
 * The load-bearing invariant: control OFF ⇒ no geo column is ever written.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPapicGeoFields } from './papic-geo';

test('control OFF → empty (fail-closed), even with a valid fix', () => {
  assert.deepEqual(
    buildPapicGeoFields(false, { lat: 14.55, lon: 121.02, accuracyM: 12 }),
    {},
  );
});

test('control OFF → empty even when the client flags unavailable', () => {
  assert.deepEqual(buildPapicGeoFields(false, { unavailable: true }), {});
});

test('control ON, valid fix → coords + accuracy + geo_unavailable false', () => {
  assert.deepEqual(buildPapicGeoFields(true, { lat: 14.55, lon: 121.02, accuracyM: 12 }), {
    geo_lat: 14.55,
    geo_lon: 121.02,
    geo_accuracy_m: 12,
    geo_unavailable: false,
  });
});

test('control ON, missing accuracy → accuracy null, still stamped', () => {
  assert.deepEqual(buildPapicGeoFields(true, { lat: 1, lon: 2 }), {
    geo_lat: 1,
    geo_lon: 2,
    geo_accuracy_m: null,
    geo_unavailable: false,
  });
});

test('control ON, undefined geo (offline drain / DSLR bridge) → {} (not recorded, NOT mislabeled unavailable)', () => {
  // A capture path that carried no location info must not assert geo_unavailable —
  // that means "the client tried and failed", which an offline/bridge path did not.
  assert.deepEqual(buildPapicGeoFields(true, undefined), {});
  assert.deepEqual(buildPapicGeoFields(true, null), {});
});

test('control ON, client-declared unavailable → geo_unavailable true', () => {
  assert.deepEqual(buildPapicGeoFields(true, { unavailable: true }), { geo_unavailable: true });
});

test('control ON, non-finite/garbage coords → treated as unavailable', () => {
  assert.deepEqual(buildPapicGeoFields(true, { lat: NaN, lon: 2 }), { geo_unavailable: true });
  assert.deepEqual(
    buildPapicGeoFields(true, { lat: 'x' as unknown as number, lon: 2 }),
    { geo_unavailable: true },
  );
});
