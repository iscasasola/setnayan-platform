import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MakerStageList } from './maker-scene-list';
import { gatedSceneShows, hereOffAfterRender, hereOffKey, listWithGates, partTakenOff } from './maker-list-gates';

/**
 * 🗑 REMOVE, THEN ＋ — the scene taken off a moment ago is offered back.
 *
 * Measured 2026-10-11 at 375 px: Remove on the Message ("Message removed from this page"), then ＋ on the Countdown
 * → "Every part is already on this page." The eye's save is held (no render of the Maker follows), and the ＋ sheet
 * read the last render's list. After: the same two taps offer "WORDS · Message", and it lands back in place
 * (`hub-walk/maker-fixes/shots/AFTER-P02-4-add-sheet.png`, `…-5-brought-back.png`).
 */
const LIST: MakerStageList = {
  stage: 'rsvp',
  shown: [
    { kind: 'fixed', key: 'f:hero', fixed: 'hero', label: 'Names & date', why: '' },
    { kind: 'scene', key: 'w:countdown', widgetId: 'w-countdown', type: 'countdown', label: 'Countdown' },
    { kind: 'scene', key: 'w:special_message', widgetId: 'w-special_message', type: 'special_message', label: 'Special message' },
  ] as MakerStageList['shown'],
  folded: [{ key: 'w:our_photos', widgetId: 'w-our_photos', type: 'our_photos', label: 'Photos you add', reason: 'Not on this stage.', hiddenByCouple: false }],
};
const scene = (id: string, mode: 'auto' | 'shown' | 'hidden', isVisible: boolean) => ({ id, mode, isVisible });

test('a scene the couple just took off is folded, hidden by the couple — what ＋ offers back', () => {
  const after = listWithGates(LIST, [scene('w-countdown', 'auto', true), scene('w-special_message', 'auto', false)]);
  assert.deepEqual(after.shown.map((t) => t.key), ['f:hero', 'w:countdown']);
  const back = after.folded.find((f) => f.key === 'w:special_message');
  assert.ok(back, 'the removed scene is not offered');
  assert.equal(back.hiddenByCouple, true);
  assert.equal(back.widgetId, 'w-special_message', 'the eye has no row to bring back');
  assert.equal(back.label, 'Special message');
  /* What the render already folded is left exactly as it was. */
  assert.deepEqual(after.folded[0], LIST.folded[0]);
  /* Auto · Hidden takes it off the same way the eye does. */
  assert.equal(listWithGates(LIST, [scene('w-special_message', 'hidden', true)]).folded.some((f) => f.key === 'w:special_message' && f.hiddenByCouple), true);
});

test('nothing off → the very same list; a fixed part is never folded; "Shown" beats a closed eye', () => {
  assert.equal(listWithGates(LIST, [scene('w-countdown', 'auto', true), scene('w-special_message', 'auto', true)]), LIST);
  assert.equal(listWithGates(LIST, []), LIST);
  /* An id that is not a scene tile of this list changes nothing. */
  assert.equal(listWithGates(LIST, [scene('w-elsewhere', 'auto', false)]), LIST);
  assert.equal(listWithGates(LIST, [scene('w-special_message', 'shown', false)]), LIST);
});

test('"is it on the page?" is the work area’s own two-gate rule, word for word', () => {
  for (const [mode, isVisible, want] of [['hidden', true, false], ['hidden', false, false], ['shown', false, true], ['shown', true, true], ['auto', true, true], ['auto', false, false]] as const)
    assert.equal(gatedSceneShows({ mode, isVisible }), want, `${mode} · ${isVisible}`);
  /* If the work area's rule changes, this one must — they are the same question. */
  const shell = readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'website', 'editor', '_components', 'editor-shell.tsx'), 'utf8');
  assert.match(shell, /export function sceneShowing\(scene: Pick<MakerScene, 'mode' \| 'isVisible'>\): boolean \{\s*if \(scene\.mode === 'hidden'\) return false;\s*if \(scene\.mode === 'shown'\) return true;\s*return scene\.isVisible;\s*\}/);
});

test('the ＋ sheet reads the list through it — the gates AND what the eye took off this stage', () => {
  const sheet = readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'launch', '_components', 'add-part-sheet.tsx'), 'utf8');
  assert.match(sheet, /list: listWithGates\(raw\.list, raw\.scenes, raw\.hereOff\),/);
  assert.doesNotMatch(sheet, /^\s*list: raw\.list,/m, 'the sheet reads the last render’s list again');
  /* …and the work area hands it over: the value its own eye keeps (`hereOff`), not a copy. */
  const shell = readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'website', 'editor', '_components', 'editor-shell.tsx'), 'utf8');
  assert.match(shell, /partOps\.current = \{[^}]*\beyeWrite,[^}]*\bhereOff,/);
  assert.match(shell, /const \[hereOff, setHereOff\] = useState/);
});

/**
 * 👁 M03 · M09 of the merged copy's walk (2026-10-11). Remove writes the STAGE's own value now, never the two gates —
 * so the list above folded nothing and ＋ said "Every part is already on this page." again, and the panel went on
 * editing a part the page no longer drew.
 */
test('M03 — a part the eye took off THIS stage is folded for ＋ (on this stage only), though both gates are open', () => {
  const open = [scene('w-countdown', 'auto', true), scene('w-special_message', 'auto', true)];
  assert.equal(listWithGates(LIST, open), LIST, 'anti-vacuity: the gates alone fold nothing here');
  const after = listWithGates(LIST, open, { [hereOffKey('rsvp', 'w-countdown')]: true });
  assert.deepEqual(after.shown.map((t) => t.key), ['f:hero', 'w:special_message']);
  const back = after.folded.find((f) => f.key === 'w:countdown');
  assert.deepEqual([back?.hiddenByCouple, back?.hiddenHere, back?.widgetId], [true, true, 'w-countdown'], '＋ is not offered the part Remove just took off');
  /* The same part taken off ANOTHER stage changes nothing on this one. */
  assert.equal(listWithGates(LIST, open, { [hereOffKey('event', 'w-countdown')]: true }), LIST);
  /* A fixed part is never folded, whatever is said of it. */
  assert.equal(listWithGates(LIST, open, { [hereOffKey('rsvp', 'f-hero')]: true }), LIST);
});

test('M09 — the picked part is "taken off" exactly when the fold says the couple took it off', () => {
  const open = [scene('w-countdown', 'auto', true), scene('w-special_message', 'auto', true)];
  const removed = { list: listWithGates(LIST, open, { [hereOffKey('rsvp', 'w-countdown')]: true }) };
  assert.equal(partTakenOff(removed, 'w:countdown'), true, 'the panel keeps editing a part Remove just took off');
  assert.equal(partTakenOff(removed, 'w:special_message'), false);
  assert.equal(partTakenOff({ list: LIST }, 'w:countdown'), false, 'a part still on the page was let go of');
  /* Folded for another reason (not this stage's) is not "taken off by the couple"; a fixed part and no part never are. */
  assert.equal(partTakenOff({ list: LIST }, 'w:our_photos'), false);
  assert.equal(partTakenOff(removed, 'f:hero'), false);
  assert.equal(partTakenOff(removed, null), false);
  assert.equal(partTakenOff(null, 'w:countdown'), false);
  /* The panel is told: the hook calls `onGone`, and the Stages toolbar lets go with it. */
  const sheet = readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'launch', '_components', 'add-part-sheet.tsx'), 'utf8');
  /* Re-aimed 2026-10-12 (rd/c-drag-scenes): the let-go now also asks the work area AGAIN at that moment — a scene ↺
     had just put back was read as "taken off" from the list the render still held, and let go of in the same breath.
     The pin holds both halves: the fold of this render's list, and the fresh ask before `onGone` is called. */
  assert.match(sheet, /const gone = partTakenOff\(ops, canvas\);[\s\S]{0,900}if \(gone && partTakenOff\(askPartOps\(\), canvas\)\) onGoneRef\.current\?\.\(\);/);
  const tools = readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'launch', '_components', 'stage-tools.tsx'), 'utf8');
  assert.match(tools, /onGone: deselect,/);
});

test('what is held off after a render: dropped once the server drops it, or once a render ASKED FOR after it still draws it', () => {
  const key = hereOffKey('rsvp', 'w-countdown');
  const h = { [key]: true as const };
  const still = { rsvp: LIST };
  const dropped = { rsvp: { shown: LIST.shown.filter((t) => t.key !== 'w:countdown') } };
  /* A render that was already on its way proves nothing: the part stays held off. */
  assert.equal(hereOffAfterRender(h, still, new Set()), h);
  /* The server folded it: its own list says so now. */
  assert.deepEqual(hereOffAfterRender(h, dropped, new Set()), {});
  /* ↺ took the Remove back (a write that owes a render was sent after the hide) and the render still draws it:
     the part is on the page again — it must not stay marked off, or the next Remove is read as "show". */
  assert.deepEqual(hereOffAfterRender(h, still, new Set([key])), {});
  /* Only the keys asked about are decided. */
  const two = { [key]: true as const, [hereOffKey('rsvp', 'w-special_message')]: true as const };
  assert.deepEqual(hereOffAfterRender(two, still, new Set([key])), { [hereOffKey('rsvp', 'w-special_message')]: true });
  /* …and the work area asks at every write that owes a render. */
  const shell = readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'website', 'editor', '_components', 'editor-shell.tsx'), 'utf8');
  assert.match(shell, /window\.addEventListener\(MAKER_UNHELD_WRITE_EVENT, ask\);/);
  assert.match(shell, /setHereOff\(\(h\) => hereOffAfterRender\(h, navigator\.stageLists, asked\)\);/);
});
