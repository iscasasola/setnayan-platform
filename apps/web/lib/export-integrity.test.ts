import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  listOutcome,
  singleOutcome,
  collectIncomplete,
} from './export-integrity';

// ── The invariant under test ────────────────────────────────────────────────
// An RA 10173 subject-access response must never present a FAILED read as an
// empty one. "You authored nothing" and "we could not check" are different
// statements, and only one of them is legal to make when the other is true.

test('a clean read yields the rows and no notice', () => {
  const out = listOutcome<{ id: number }>('working notes', {
    data: [{ id: 1 }, { id: 2 }],
    error: null,
  });
  assert.deepEqual(out.rows, [{ id: 1 }, { id: 2 }]);
  assert.equal(out.incomplete, null);
});

test('a genuinely empty read stays silent — no false alarm', () => {
  const out = listOutcome('working notes', { data: [], error: null });
  assert.deepEqual(out.rows, []);
  assert.equal(
    out.incomplete,
    null,
    'a real zero-row result must NOT be flagged incomplete, or the notice becomes noise the subject learns to ignore',
  );
});

test('LOAD-BEARING · an ERRORED read is never presented as an empty one', () => {
  const out = listOutcome('working notes', {
    data: null,
    error: { message: 'permission denied for table event_vendor_working_notes' },
  });
  assert.deepEqual(out.rows, []);
  assert.notEqual(
    out.incomplete,
    null,
    'an errored read MUST produce a notice — this is the entire point of the helper',
  );
  assert.match(out.incomplete!, /READ FAILED/);
  assert.match(
    out.incomplete!,
    /must NOT be read as/,
    'the notice must explicitly deny the "you have no such records" reading',
  );
  assert.match(out.incomplete!, /permission denied for table/, 'the cause must survive into the notice');
});

test('LOAD-BEARING · a NOT-ATTEMPTED read is distinguished from an errored one', () => {
  const out = listOutcome('broadcasts sent', null, 'The privileged read client was unavailable.');
  assert.deepEqual(out.rows, []);
  assert.match(out.incomplete!, /NOT READ/);
  assert.match(out.incomplete!, /privileged read client was unavailable/);
  assert.doesNotMatch(
    out.incomplete!,
    /READ FAILED/,
    'a read that never ran must not be reported as a failed query — the remedies differ',
  );
});

test('an error with no message still produces a notice', () => {
  const out = listOutcome('orders', { data: null, error: {} });
  assert.match(out.incomplete!, /READ FAILED/);
  assert.match(out.incomplete!, /no message/);
});

test('error text is capped so an export never becomes a leak channel', () => {
  const out = listOutcome('orders', { data: null, error: { message: 'x'.repeat(500) } });
  assert.ok(
    out.incomplete!.length < 400,
    `notice must stay bounded, got ${out.incomplete!.length} chars — an unbounded DB error can echo another party's row content into a subject-access file`,
  );
  assert.match(out.incomplete!, /…/, 'truncation must be visible');
});

test('singleOutcome mirrors the contract for maybeSingle reads', () => {
  const ok = singleOutcome<{ name: string }>('profile', { data: { name: 'a' }, error: null });
  assert.deepEqual(ok.row, { name: 'a' });
  assert.equal(ok.incomplete, null);

  const absent = singleOutcome('profile', { data: null, error: null });
  assert.equal(absent.row, null);
  assert.equal(absent.incomplete, null, 'no row is a legitimate answer for maybeSingle');

  const failed = singleOutcome('profile', { data: null, error: { message: 'boom' } });
  assert.equal(failed.row, null);
  assert.match(failed.incomplete!, /READ FAILED/);

  const skipped = singleOutcome('profile', null, 'client unavailable');
  assert.match(skipped.incomplete!, /NOT READ/);
});

test('collectIncomplete keeps only the notices, in order', () => {
  const notices = collectIncomplete([
    { incomplete: null },
    { incomplete: 'A failed' },
    { incomplete: null },
    { incomplete: 'B failed' },
  ]);
  assert.deepEqual(notices, ['A failed', 'B failed']);
});

test('collectIncomplete on an all-clean run is empty (so export_complete can be TRUE honestly)', () => {
  assert.deepEqual(collectIncomplete([{ incomplete: null }, { incomplete: null }]), []);
});
