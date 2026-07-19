// Unit tests for the migration doctor's pure classifier.
// Run: node --test scripts/migration-doctor.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyDrift, extractLedgerRows } from './migration-doctor.mjs';

test('classifyDrift: healthy — ledger and files match exactly', () => {
  const local = ['20270101000000', '20270102000000'];
  const ledger = [
    { version: '20270101000000', name: 'a' },
    { version: '20270102000000', name: 'b' },
  ];
  const r = classifyDrift(local, ledger);
  assert.deepEqual(r.orphans, []);
  assert.deepEqual(r.stranded, []);
  assert.equal(r.okCount, 2);
});

test('classifyDrift: orphan — ledger row with no local file (jams db push)', () => {
  const local = ['20270101000000'];
  const ledger = [
    { version: '20270101000000', name: 'a' },
    { version: '20270426100000', name: 'event_launch_mode' },
  ];
  const r = classifyDrift(local, ledger);
  assert.deepEqual(r.orphans, [{ version: '20270426100000', name: 'event_launch_mode' }]);
  assert.deepEqual(r.stranded, []);
  assert.equal(r.okCount, 1);
});

test('classifyDrift: stranded — local file not yet in the ledger', () => {
  const local = ['20270101000000', '20270426250948'];
  const ledger = [{ version: '20270101000000', name: 'a' }];
  const r = classifyDrift(local, ledger);
  assert.deepEqual(r.orphans, []);
  assert.deepEqual(r.stranded, ['20270426250948']);
  assert.equal(r.okCount, 1);
});

test('classifyDrift: both orphan and stranded at once', () => {
  const local = ['20270101000000', '20270300000000'];
  const ledger = [
    { version: '20270101000000', name: 'a' },
    { version: '20270200000000', name: 'orphaned' },
  ];
  const r = classifyDrift(local, ledger);
  assert.deepEqual(r.orphans, [{ version: '20270200000000', name: 'orphaned' }]);
  assert.deepEqual(r.stranded, ['20270300000000']);
  assert.equal(r.okCount, 1);
});

test('classifyDrift: orphans returned sorted by version', () => {
  const ledger = [
    { version: '20270300000000', name: 'z' },
    { version: '20270100000000', name: 'a' },
  ];
  const r = classifyDrift([], ledger);
  assert.deepEqual(
    r.orphans.map((o) => o.version),
    ['20270100000000', '20270300000000'],
  );
});

// extractLedgerRows — must survive both connection modes' output shapes.
test('extractLedgerRows: single envelope object (--db-url shape)', () => {
  const raw =
    'Update available: v2\n' +
    '{"boundary":"abc","rows":[{"version":"20270101000000","name":"a"},{"version":"20270102000000","name":"b"}],"warning":null}';
  assert.deepEqual(extractLedgerRows(raw), [
    { version: '20270101000000', name: 'a' },
    { version: '20270102000000', name: 'b' },
  ]);
});

test('extractLedgerRows: separate boundary + rows objects (--linked shape that crashed CI)', () => {
  const raw =
    'A new version of Supabase CLI is available\n' +
    '{\n  "boundary": "abc123"\n}\n' +
    '{\n  "rows": [{"version":"20270426100000","name":"event_launch_mode"}]\n}';
  assert.deepEqual(extractLedgerRows(raw), [
    { version: '20270426100000', name: 'event_launch_mode' },
  ]);
});

test('extractLedgerRows: NDJSON — one row object per line', () => {
  const raw =
    '{"version":"20270101000000","name":"a"}\n{"version":"20270102000000","name":"b"}';
  assert.deepEqual(extractLedgerRows(raw), [
    { version: '20270101000000', name: 'a' },
    { version: '20270102000000', name: 'b' },
  ]);
});

test('extractLedgerRows: bare array + coerces version to string, defaults name', () => {
  const raw = '[{"version":20270101000000},{"version":"20270102000000","name":"b"}]';
  assert.deepEqual(extractLedgerRows(raw), [
    { version: '20270101000000', name: '' },
    { version: '20270102000000', name: 'b' },
  ]);
});

test('extractLedgerRows: braces inside string literals do not break scanning', () => {
  const raw = '{"rows":[{"version":"20270101000000","name":"has } brace {"}]}';
  assert.deepEqual(extractLedgerRows(raw), [
    { version: '20270101000000', name: 'has } brace {' },
  ]);
});
