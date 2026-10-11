import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { settleVerdict } from './maker-settle';
import { stripComments } from './strip-comments';

/**
 * ⏳ A PRESS IS ONE ACTION, AND NOTHING IS SAID BEFORE THE PAGE SHOWS IT (owner, 2026-10-11 — F1 · F3).
 *
 * "pressed undo twice before it reversed that edit" · "a pop up says it moved but didn't, only moved on the second
 * click". A move, an undo and a part brought back reach the canvas by a RELOAD, seconds after the press on a real
 * connection; the controls were live and the toast already up for all of them.
 */

const A = { frame: 'a' }, B = { frame: 'b' };

test('THE RULE: it has reached the screen only when nothing is in flight AND the canvas on show is a new one', () => {
  /* The save is still on its way. */
  assert.equal(settleVerdict(A, { saves: 1, loading: 0, shown: A }), 'wait');
  /* The save answered; the Maker's render has not arrived — the page on show is still the old one. THE GAP the owner
     pressed into: nothing is in flight, nothing is loading, and nothing has changed. */
  assert.equal(settleVerdict(A, { saves: 0, loading: 0, shown: A }), 'wait', 'the control is given back in the gap');
  /* The new page is loading behind the old one. */
  assert.equal(settleVerdict(A, { saves: 0, loading: 1, shown: A }), 'wait');
  /* Swapped — but a second reload (a later save's) is already loading behind it. */
  assert.equal(settleVerdict(A, { saves: 0, loading: 1, shown: B }), 'wait');
  assert.equal(settleVerdict(A, { saves: 0, loading: 0, shown: B }), 'shown');
  /* No canvas at the press (a Maker with no work area): only the save is waited for. */
  assert.equal(settleVerdict(null, { saves: 1, loading: 0, shown: null }), 'wait');
  assert.equal(settleVerdict(null, { saves: 0, loading: 0, shown: null }), 'shown');
  /* The canvas went away meanwhile (the stage was left): not "shown". */
  assert.equal(settleVerdict(A, { saves: 0, loading: 0, shown: null }), 'wait');
});

const read = (...p: string[]) => stripComments(readFileSync(join(process.cwd(), ...p), 'utf8'));
const L = ['app', 'dashboard', '[eventId]', 'launch', '_components'];

test('↺ · Restore · Reset: the bar stays busy until the page shows it — a second press cannot be a second step', () => {
  const bar = read('app', 'dashboard', '[eventId]', 'website', '_components', 'hub-draft-bar.tsx');
  const hook = bar.slice(bar.indexOf('function useDraftIntent('), bar.indexOf('function ResultLine('));
  /* Watched FROM THE PRESS (the frame on show is read before anything is sent), and busy at once. */
  assert.match(hook, /const watch = intent && DRAFT_INTENT_RELOADS\.includes\(intent\) \? canvasSettleWatch\(\) : null;\s*if \(watch\) \{\s*setSettling\(intent\);\s*void watch\.done\.then\(\(\) => setSettling\(null\)\);\s*\}\s*start\(async/);
  /* Busy is the action OR the wait for the page: every control of the bar reads the one `pending`. */
  assert.match(hook, /return \{ pending: pending \|\| settling !== null, working: settling, result, run \};/);
  /* A refusal brings no render: the bar is given back at once. */
  assert.match(hook, /if \(!r\.ok\) watch\?\.cancel\(\);/);
  /* ⚠ Never awaited INSIDE the transition — React holds every transition's commit (the Maker's render among them)
     until an async one ends, so the wait would be waiting on itself. */
  const inTransition = hook.slice(hook.indexOf('start(async'));
  assert.doesNotMatch(inTransition, /await (whenCanvasShowsIt|watch\.done)/);
  /* …and the pressed button says so. */
  assert.match(bar, /label="Undo"[\s\S]{0,500}?working=\{working === 'undo'\}/);
});

test('Earlier · Later · ＋: one press at a time, and the toast waits for the page', () => {
  const sheet = read(...L, 'add-part-sheet.tsx');
  /* The move: the words are said by `settle`, after the page shows it — never at the press. */
  const drop = sheet.slice(sheet.indexOf('const dropOn = '), sheet.indexOf('const neighbour = '));
  assert.doesNotMatch(drop, /setToast\(/, 'a move is announced at the press again');
  assert.match(drop, /o\.move\(mv\.id, delta\);\s*settle\(where === 'above' \? 'earlier' : 'later', `\$\{label\} moved`\);/);
  const add = sheet.slice(sheet.indexOf('const add = '), sheet.indexOf('const removeYes = '));
  assert.match(add, /o\.add\(folded\.widgetId, delta\);\s*settle\('add', `\$\{makerPartLabelOn\(stage, key\)\} added \$\{where\}`\);/);
  /* `settle`: busy from the press, and words only for 'shown'. */
  assert.match(sheet, /const settle = \(what: PartWorking, words: string\) => \{\s*setWorking\(what\);\s*void whenCanvasShowsIt\(\)\.then\(\(how\) => \{\s*setWorking\(null\);\s*if \(how === 'shown'\) setToast\(words\);/);
  /* While it works: no step, no remove, no ＋ — each says why instead of acting. */
  assert.match(sheet, /earlier: working \? null : /);
  assert.match(sheet, /later: working \? null : /);
  assert.match(sheet, /remove: working \? null : /);
  assert.match(sheet, /if \(working\) return;\s*setAdding\(/);
  /* The toolbar's Edit row draws the working step. */
  assert.match(read(...L, 'stage-panel', 'stage-edit.tsx'), /aria-busy=\{working === 'earlier' \|\| undefined\}/);
  assert.match(read(...L, 'stage-tools.tsx'), /working=\{edits\.working\}/);
});
