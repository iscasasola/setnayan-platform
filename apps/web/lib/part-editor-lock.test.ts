/**
 * ✍️ ONE EDITOR PER PART — the pure half (`lib/part-editor-lock.ts`). Owner 2026-11-21, DECISION_LOG "DESKTOP SPLIT
 * VIEW + ONE EDITOR PER PART — APPROVED TO BUILD"; drawing `prototypes/desktop_split_view_2026-11-21/
 * desktop_split_view_v2_fable.html` frames 3–5. The server half: `tests/db/one-editor-per-part.db.test.ts`.
 *
 *   1 · the lock: the bar's words, and an unreadable answer is never "free";
 *   2 · the 5 s release: the client's twin equals the SQL's INTERVAL, and "held → free" is the "is free" moment;
 *   3 · host take-over: the bumped person is told once, with the host's name; a later read does not tell them again;
 *   4 · the draft on top of the host's latest: plain change vs "changed this too", pick per item, nothing for "theirs".
 *
 * 🛡 Sabotage: make `readPartLockState` answer 'free' for garbage (1) · change PART_FREES_AFTER_MS (2) · drop the
 *    `next.bumpedAt !== toldBumpAt` check (3) · mark every row a conflict in `draftOnLatest` (4).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PART_FREES_AFTER_MS,
  TOUCH_EVERY_MS,
  EDIT_PARTS,
  UNKNOWN_LOCK,
  readPartLockState,
  lockedForMe,
  lockMoment,
  editingWords,
  freeWords,
  takenOverWords,
  putItBackLabel,
  draftOnLatest,
  resolveDraft,
  draftWords,
  confirmLabel,
  type PartLockState,
} from './part-editor-lock';

const MIGRATION = readFileSync(join(__dirname, '../../../supabase/migrations/20271360932916_one_editor_per_part.sql'), 'utf8');
const held = (who: string): PartLockState => ({ ...UNKNOWN_LOCK, status: 'held', holderLabel: who, canEdit: true });

test('1 · the lock — "Ria is editing Guests." and the part is read-only; garbage is never free', () => {
  const s = readPartLockState({ status: 'held', holder_label: 'Ria', holder_is_host: false, can_edit: true, can_take_over: false });
  assert.equal(s.status, 'held');
  assert.equal(lockedForMe(s), true, 'a part someone else holds is not read-only');
  assert.deepEqual(editingWords('Ria', 'guests'), { lead: 'Ria is editing Guests.', rest: 'You can look. It frees itself when Ria stops.' });
  assert.equal(lockedForMe(readPartLockState({ status: 'mine', can_edit: true })), false);
  assert.equal(lockedForMe(readPartLockState({ status: 'free', can_edit: true })), false);

  for (const junk of [null, undefined, 'free', {}, { status: 'whatever' }]) {
    assert.equal(readPartLockState(junk).status, 'unknown', `${JSON.stringify(junk)} was read as a real answer`);
  }
  // The parts are the SQL CHECK's, one for one.
  for (const p of EDIT_PARTS) assert.match(MIGRATION, new RegExp(`'${p}'`), `${p} is not a part in the migration`);
});

test('2 · the 5 s release — the twin is the SQL interval; held → free is the "is free" moment', () => {
  assert.equal(PART_FREES_AFTER_MS, 5_000);
  assert.ok(TOUCH_EVERY_MS < PART_FREES_AFTER_MS, 'the editor touches less often than the part frees itself');
  const intervals = MIGRATION.match(/INTERVAL '(\d+) seconds'/g) ?? [];
  assert.ok(intervals.length >= 2, 'the migration lost its 5 s window');
  for (const i of intervals) assert.equal(i, "INTERVAL '5 seconds'", `a window other than 5 s: ${i}`);

  const free = readPartLockState({ status: 'free', can_edit: true });
  assert.deepEqual(lockMoment(held('Ria'), free, null), { kind: 'became_free', lastEditor: 'Ria' });
  assert.deepEqual(freeWords('guests', 'Ria'), { lead: 'Guests is free.', rest: 'You can edit now. Ria’s changes are in.' });
  assert.equal(lockMoment(free, free, null), null, 'free → free said the moment again');
  assert.equal(lockMoment(UNKNOWN_LOCK, free, null), null, 'the first read said "is free"');
});

test('3 · host take-over — the bumped person is told once, with the host’s name; Put it back waits', () => {
  const bumped = readPartLockState({ status: 'held', holder_label: 'Claire', holder_is_host: true, can_edit: true, taken_by_label: 'Claire', bumped_at: '2026-11-23T10:00:00Z' });
  const m = lockMoment(UNKNOWN_LOCK, bumped, null);
  assert.deepEqual(m, { kind: 'taken_over', by: 'Claire', at: '2026-11-23T10:00:00Z' });
  assert.equal(lockMoment(bumped, bumped, '2026-11-23T10:00:00Z'), null, 'a take-over already told was told again');
  assert.equal(takenOverWords('Claire', 'guests', true).lead, 'Claire took over Guests.');
  assert.match(takenOverWords('Claire', 'guests', true).rest, /Your change was not saved\. It is kept below\./);
  assert.equal(putItBackLabel('guests', false), 'Put it back · when Guests is free');
  assert.equal(putItBackLabel('guests', true), 'Put it back');
  // Only a host is offered the take-over (the server's can_take_over).
  assert.equal(readPartLockState({ status: 'held', holder_label: 'Ria', can_take_over: true }).canTakeOver, true);
  assert.equal(readPartLockState({ status: 'held', holder_label: 'Ria' }).canTakeOver, false);
});

test('4 · the draft on top of the host’s latest — pick per item, nothing saves for "theirs"', () => {
  const kept = [
    { key: 'ben_table', label: 'Ben Tan', from: 'Table 4', to: 'Table 6' },
    { key: 'ana_table', label: 'Ana Reyes', from: 'Table 4', to: 'Table 6' },
    { key: 'carla_note', label: 'Carla Lim', from: '', to: 'vegetarian' },
  ];
  // Claire moved Ana to Table 5 and already wrote Carla's note the same way.
  const rows = draftOnLatest(kept, { ben_table: 'Table 4', ana_table: 'Table 5', carla_note: 'vegetarian' });
  assert.deepEqual(rows.map((r) => [r.key, r.conflict, r.theirs]), [
    ['ben_table', false, 'Table 4'],
    ['ana_table', true, 'Table 5'],
  ]);
  assert.deepEqual(draftWords('Claire', rows), { lead: 'This is a draft on top of Claire’s latest version.', rest: '2 changes. 1 needs your pick.' });
  // "Yours" is the default pick.
  assert.deepEqual(resolveDraft(rows, {}), [
    { key: 'ben_table', value: 'Table 6' },
    { key: 'ana_table', value: 'Table 6' },
  ]);
  assert.equal(confirmLabel(rows, {}), 'Confirm 2 changes');
  // Picking Claire's writes nothing for that guest.
  assert.deepEqual(resolveDraft(rows, { ana_table: 'theirs' }), [{ key: 'ben_table', value: 'Table 6' }]);
  assert.equal(confirmLabel(rows, { ana_table: 'theirs' }), 'Confirm 1 change');
  // A field missing from the latest is read as untouched.
  assert.equal(draftOnLatest(kept.slice(0, 1), {})[0]!.conflict, false);
});
