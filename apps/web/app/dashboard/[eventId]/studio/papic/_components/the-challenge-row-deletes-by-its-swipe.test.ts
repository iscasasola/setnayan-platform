/**
 * the-challenge-row-deletes-by-its-swipe.test.ts — 👈 A COUPLE'S OWN CHALLENGE DELETES BY ITS SWIPE, WITH UNDO (owner
 * 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS").
 *
 * The Challenges page's row draws no trash; only the couple's own challenge is wrapped in `ChallengeRowSwipe` (the ONE
 * swipe), and its Delete reaches the SAME soft remove the old trash form posted (`deleteCoupleChallengeAction`, through
 * the in-place door) via `deleteWithUndo`. The page mounts the one Undo toast host.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const MANAGER = stripComments(readFileSync(join(HERE, '..', 'couple-challenges-manager.tsx'), 'utf8'));
const SWIPE = stripComments(readFileSync(join(HERE, 'challenge-row-swipe.tsx'), 'utf8'));
const PAGE = stripComments(readFileSync(join(HERE, '..', 'challenges', 'page.tsx'), 'utf8'));

test('the challenge row draws no trash — only the couple’s own row is a swipe', () => {
  const at = MANAGER.indexOf('function ChallengeRow(');
  assert.ok(at > 0, 'premise: ChallengeRow');
  const row = MANAGER.slice(at);
  assert.doesNotMatch(row, /aria-label="Delete challenge"|<Trash2\b|door="deleteCoupleChallengeAction"/, 'the visible trash is back on the row');
  assert.match(row, /if \(m\.source !== 'couple'\) return <li>\{row\}<\/li>;/, 'a Setnayan / supplier challenge became deletable');
  assert.match(row, /<ChallengeRowSwipe eventId=\{eventId\} missionId=\{m\.mission_id\}/);
});

test('the swipe reaches the same soft remove, through Undo, and the page carries the toast', () => {
  assert.match(SWIPE, /<SwipeToDelete\b[\s\S]{0,80}label=\{`Delete challenge: \$\{name\}`\}/);
  assert.match(SWIPE, /deleteWithUndo\(\{[\s\S]*hide: \(\) => setHidden\(true\)[\s\S]*restore: \(\) => setHidden\(false\)/);
  assert.match(SWIPE, /papicSaveInPlace\('deleteCoupleChallengeAction', fd\)/);
  assert.match(SWIPE, /fd\.set\('mission_id', missionId\)/);
  assert.match(PAGE, /<UndoToastHost \/>/);
});
