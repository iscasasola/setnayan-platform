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
  /* (2026-10-13, `rd/maker-undo-instant`: a ↺ the Maker DREW at the press — the journal's step, `lib/maker-undo-run.ts` —
     is busy only while the page it keeps still moves (`drawn.settle`); `lib/an-older-undo-is-drawn-at-once.test.ts`.
     Every other ↺ · Restore · Reset — the `slow` path — as before.) */
  assert.match(hook, /const slow = \(fields: Record<string, string>, intent: HubDraftIntent \| null\) => \{\s*const watch = intent && DRAFT_INTENT_RELOADS\.includes\(intent\) \? canvasSettleWatch\(\) : null;\s*if \(watch\) \{\s*setSettling\(intent\);\s*void watch\.done\.then\(\(\) => setSettling\(null\)\);\s*\}\s*start\(async/);
  assert.match(hook, /const drawn = runner\.runDrawnUndo\(drawnIo\(\)\);\s*if \(!drawn\) return false;\s*setSettling\('undo'\);\s*void drawn\.settle\.then\(\(\) => setSettling\(null\)\);/, 'a drawn ↺ is busy until the page it keeps settles');
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

test('↺ shows its count from the action’s OWN answer — never only from the whole-Maker render that follows', () => {
  /* The real action: Undo and Reset write the next draft and, asked, read the bar of THAT SAME draft beside the write. */
  const action = read('app', 'dashboard', '[eventId]', 'website', 'hub-draft-actions.ts');
  const helper = action.slice(action.indexOf('const answerWithBar = '), action.indexOf("if (intent === 'save')"));
  assert.match(helper, /writeHubDraft\(supabase, eventId, next\)/);
  assert.match(helper, /formData\.get\(HUB_DRAFT_BAR_FIELD\) === '1' \? hubDraftBarAfterSave\(supabase, eventId, next\)/);
  assert.match(helper, /return bar \? \{ \.\.\.done\(\), bar, \.\.\.said \} : \{ \.\.\.done\(\), \.\.\.said \};/, 'the bar (and the state’s stamp) in the one answer');
  for (const intent of ['undo', 'reset']) {
    const at = action.indexOf(`if (intent === '${intent}') {`);
    assert.ok(at > 0, intent);
    const branch = action.slice(at, action.indexOf('\n    }', at));
    assert.match(branch, /return answerWithBar\(/, `${intent} answers without its bar`);
    assert.doesNotMatch(branch, /writeHubDraft\(/, `${intent} writes outside the one answer`);
  }
  /* The toolbar asks for it on exactly the presses it waits on, and `makerSave` hands the answer's bar to it. */
  const bar = read('app', 'dashboard', '[eventId]', 'website', '_components', 'hub-draft-bar.tsx');
  const hook = bar.slice(bar.indexOf('function useDraftIntent('), bar.indexOf('function ResultLine('));
  assert.match(hook, /if \(watch\) fd\.set\(HUB_DRAFT_BAR_FIELD, '1'\);/);
  /* …and a ↺ the Maker drew asks for it too: no render follows it at all. */
  assert.match(hook.slice(hook.indexOf('const drawnIo = ')), /fd\.set\('intent', 'undo'\);\s*fd\.set\(HUB_DRAFT_BAR_FIELD, '1'\);/);
  assert.match(hook, /makerSave\(\(\) => action\(eventId, fd\)/);
  const refresh = read('lib', 'maker-refresh.ts');
  assert.match(refresh.slice(refresh.indexOf('export function makerSave<T>(')), /announceDraftBar\(result\);/);
});

test('a move · a remove · ＋: one press at a time, and nothing is said before the page shows it', () => {
  const sheet = read(...L, 'add-part-sheet.tsx');
  /* 🔁 Re-aimed 2026-10-11 (DECISION_LOG "IN THE MAKER, A SCENE IS MOVED BY DRAGGING IT ON THE PAGE AND REMOVED BY DROPPING IT ON A BIN"): a move toasted "<Scene> moved" through `settle`. A scene is now held on the page
     and dropped — it is already where it was put, so nothing is toasted; the line under the tools says "Saving…" until
     the page shows it, and the honest line if the save was refused (`scene-drag.tsx` `run`). The busy rule is the
     same: `landed` holds every step from the press until the page on screen is the new one, and tells how it ended. */
  const drop = sheet.slice(sheet.indexOf('const dropOn = '), sheet.indexOf('const neighbour = '));
  assert.doesNotMatch(drop, /setToast\(/, 'a move is announced at the press again');
  assert.match(drop, /o\.move\(m\.id, delta\);\s*return landed\('move'\);/);
  /* (2026-10-12: …and a move the page already shows waits for its save and the page's own redraw — `heldRedrawWatch`.) */
  assert.match(drop, /const done = heldRedrawWatch\(\);\s*o\.move\(m\.id, delta, true\);\s*return landed\('move', done\);/);
  assert.match(sheet, /const landed = \(what: PartWorking, done: Promise<CanvasSettle> = whenCanvasShowsIt\(\)\): Promise<CanvasSettle> => \{\s*setWorking\(what\);\s*return done\.then\(\(how\) => \{\s*setWorking\(null\);\s*return how;/);
  /* No second lift while it works (`sceneLiftAllowed` — executed in `lib/a-scene-is-dragged-on-the-page.test.ts`). */
  assert.match(sheet, /working: working !== null,/);
  const add = sheet.slice(sheet.indexOf('const add = '), sheet.indexOf('const takeOff = '));
  /* ＋: said after the page shows it — and the part is brought onto the screen first, so "added" is never said over a
     screen that looks the same (it is added above or below the picked part, which can be just past the edge). */
  /* (2026-10-12, `rd/maker-moves-instant`: beside a picked scene, ＋ holds the part's place on the page at once and is
     saved held; its words still wait for the page to show the part — the save AND the page's own redraw. Elsewhere
     (off a fixed part) it is the reload, as before.) */
  assert.match(add, /const words = `\$\{makerPartLabelOn\(stage, key\)\} added \$\{mv\.kind === 'scene' \? where : onHere \? `on \$\{onHere\.label\}` : 'to this page'\}`;/);
  assert.match(add, /const done = heldRedrawWatch\(\);[\s\S]*?o\.add\(folded\.widgetId, delta, true\);[\s\S]*?void landed\('add', done\)\.then\(\(how\) => \{\s*if \(how !== 'shown'\) return;\s*bringOntoScreen\(c\);\s*setToast\(words\);/);
  assert.match(add, /o\.add\(folded\.widgetId, delta\);\s*settle\('add', words, \(\) => bringOntoScreen\(c\)\);/);
  const bring = sheet.slice(sheet.indexOf('function bringOntoScreen('));
  assert.match(bring.slice(0, bring.indexOf('\n}\n')), /querySelector\(`\[data-maker-section="\$\{canvasKey\}"\]`\)[\s\S]*?\.scrollIntoView\(/);
  /* `settle`: busy from the press; words (and the bringing) only for 'shown'. */
  assert.match(sheet, /const settle = \(what: PartWorking, words: string, shown\?: \(\) => void\) => \{\s*setWorking\(what\);\s*void whenCanvasShowsIt\(\)\.then\(\(how\) => \{\s*setWorking\(null\);\s*if \(how !== 'shown'\) return;\s*shown\?\.\(\);\s*setToast\(words\);/);
  /* While it works: no step, no remove, no ＋ — each says why instead of acting. */
  assert.match(sheet, /earlier: working \? null : /);
  assert.match(sheet, /later: working \? null : /);
  assert.match(sheet, /remove: working \? null : /);
  assert.match(sheet, /if \(working\) return;\s*setAdding\(/);
  /* (The toolbar's Edit row drew the working step; the row left with the drag — the line under the tools says "Saving…".) */
  assert.match(read(...L, 'scene-drag.tsx'), /saving\.current = true;\s*put\(\{ kind: 'saving' \}\);/);
});
