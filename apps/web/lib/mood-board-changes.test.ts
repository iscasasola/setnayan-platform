/**
 * 🖼⏱ Home's Mood Board asks — the words, the time left, and the parse of the ONE read (`mood_board_home_asks`).
 * Owner 2026-10-30, DECISION_LOG "MOOD BOARD CHANGES: SUPPLIERS ASK, COORDINATORS APPLY, THE OWNERS HAVE 24 HOURS TO UNDO".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import {
  changeTitle,
  changeWhat,
  changesTodayWords,
  moodBoardUndoWords,
  readMoodBoardHomeAsks,
  suggestionsTodayWords,
  undoLeft,
} from './mood-board-changes';

const ROW_S = { suggestion_id: 's1', slot_key: 'stage', part_label: 'Stage', shop_label: 'Bloom & Co.', image_url: 'https://m/x.jpg', at: '2026-10-30T08:00:00Z' };
const ROW_C = {
  change_id: 'c1',
  actor_label: 'Coordinator Styled by Bea',
  kind: 'replace',
  part_label: 'Ceiling',
  shop_label: null,
  at: '2026-10-30T08:00:00Z',
  undo_until: '2026-10-31T08:00:00Z',
};

test('the read is parsed, and a shape it does not know is null — never "nothing to approve"', () => {
  const asks = readMoodBoardHomeAsks({ editor: true, owner: true, suggestions: [ROW_S], changes: [ROW_C] });
  assert.ok(asks);
  assert.equal(asks.suggestions[0]!.shopLabel, 'Bloom & Co.');
  assert.equal(asks.changes[0]!.kind, 'replace');
  assert.deepEqual(readMoodBoardHomeAsks({ suggestions: [], changes: [] }), { suggestions: [], changes: [] });
  for (const bad of [null, undefined, 'x', {}, { suggestions: [] }, { suggestions: [{}], changes: [] }, { suggestions: [], changes: [{ ...ROW_C, kind: 'paint' }] }]) {
    assert.equal(readMoodBoardHomeAsks(bad), null, `accepted ${JSON.stringify(bad)}`);
  }
});

test('the words: the notice’s own title, what was done, and every refusal in a sentence', () => {
  assert.equal(changeTitle({ actorLabel: 'Coordinator Styled by Bea', partLabel: 'Stage' }), 'Coordinator Styled by Bea changed the Mood Board · Stage');
  assert.equal(changeWhat({ kind: 'keep', shopLabel: 'Bloom & Co.' }), 'Kept a photo from Bloom & Co.');
  assert.equal(changeWhat({ kind: 'remove', shopLabel: null }), 'Removed a photo');
  assert.equal(moodBoardUndoWords('moved_on'), 'This part changed again since — undo the later change first.');
  for (const s of ['moved_on', 'expired', 'already', 'empty', 'not_yours', 'error'] as const) {
    assert.match(moodBoardUndoWords(s), /^[A-Z].+[.]$/, `${s} is not a sentence`);
  }
  const parsed = readMoodBoardHomeAsks({ suggestions: [ROW_S, { ...ROW_S, suggestion_id: 's2' }], changes: [ROW_C] })!;
  assert.equal(suggestionsTodayWords(parsed.suggestions.slice(0, 1)), 'Bloom & Co. suggested a photo · Stage');
  assert.equal(suggestionsTodayWords(parsed.suggestions), '2 supplier photos to approve');
  assert.equal(changesTodayWords(parsed.changes), 'Coordinator Styled by Bea changed the Mood Board · Ceiling');
});

test('the time left to undo — and nothing once the 24 hours have passed', () => {
  const until = '2026-10-31T08:00:00Z';
  assert.equal(undoLeft(until, new Date('2026-10-30T09:00:00Z')), '23 h left to undo');
  assert.equal(undoLeft(until, new Date('2026-10-31T07:20:00Z')), '40 min left to undo');
  assert.equal(undoLeft(until, new Date('2026-10-31T08:00:00Z')), null);
  assert.equal(undoLeft('not a date'), null);
});

test('🔒 the trigger’s notice and Home say the same title (one sentence, two places)', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const sql = readFileSync(join(dir, '..', '..', '..', 'supabase', 'migrations', '20271299051148_mood_board_changes_undo_24h.sql'), 'utf8');
  assert.match(sql, /format\('%s changed the Mood Board · %s', v_change\.actor_label, v_change\.part_label\)/, 'the notice title moved — keep changeTitle() in step');
  const src = stripComments(readFileSync(join(dir, 'mood-board-changes.ts'), 'utf8'));
  assert.match(src, /`\$\{c\.actorLabel\} changed the Mood Board · \$\{c\.partLabel\}`/);
});
