// Unit tests for the migration-prefix guard's pure rule functions.
// Run: node --test scripts/check-migration-timestamps.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  duplicatePrefixes,
  isHandTypedRoundPrefix,
  handTypedNewMigrations,
} from './check-migration-timestamps.mjs';

test('duplicatePrefixes flags two files sharing a 14-digit prefix', () => {
  assert.deepEqual(
    duplicatePrefixes([
      '20270109000000_a.sql',
      '20270109000000_b.sql',
      '20270110123456_c.sql',
    ]),
    ['20270109000000'],
  );
});

test('duplicatePrefixes returns [] when all unique, ignoring non-migrations', () => {
  assert.deepEqual(
    duplicatePrefixes(['README.md', '.gitkeep', '20270109000001_a.sql', '20270110123456_b.sql']),
    [],
  );
});

test('isHandTypedRoundPrefix: only a YYYYMMDD000000 round prefix is true', () => {
  assert.equal(isHandTypedRoundPrefix('20270109000000'), true);
  assert.equal(isHandTypedRoundPrefix('20270109000001'), false);
  assert.equal(isHandTypedRoundPrefix('20270109120000'), false); // 12:00:00 — low digits present
  assert.equal(isHandTypedRoundPrefix('20270110648840'), false); // allocator output
});

test('handTypedNewMigrations flags a new round-prefix file, grandfathers ones on main', () => {
  const local = [
    '20260101000000_old.sql', // round BUT on main → grandfathered
    '20270109000000_new_bad.sql', // round + new → FLAG
    '20270110123456_new_ok.sql', // new but allocator-style → ok
  ];
  const main = ['20260101000000_old.sql'];
  assert.deepEqual(
    handTypedNewMigrations(local, main).map((x) => x.file),
    ['20270109000000_new_bad.sql'],
  );
});

test('handTypedNewMigrations: empty/missing main treats everything as new (the CLI guards this by skipping rule 2)', () => {
  assert.deepEqual(
    handTypedNewMigrations(['20270109000000_x.sql'], null).map((x) => x.file),
    ['20270109000000_x.sql'],
  );
  // A non-round new migration is never flagged, even with no main list.
  assert.deepEqual(handTypedNewMigrations(['20270110123456_ok.sql'], []), []);
});
