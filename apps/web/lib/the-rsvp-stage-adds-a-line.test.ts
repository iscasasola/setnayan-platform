/**
 * ＋ THE RSVP STAGE ADDS A LINE — step 5c of the per-element work (owner's ruling 2026-10-09: "we already had the +" →
 * "you removed it"; approved prototype `prototypes/maker_rsvp_add_drag_group_2026-10-09.html` § 1).
 *
 *   1. ＋ IS BACK ON A LINE'S FRAME, AND ONLY ADDS A LINE — the same ＋ the frame wears on every stage; on this stage's
 *      fixed pages it is drawn only for a line (`lineAdd`), and never opens the scenes' sheet;
 *   2. THE SHEET OFFERS ONLY Heading · Message — never the invitation's scenes (the reason ＋ was switched off here);
 *   3. EVERY CHANGE IS THE PANEL'S ONE SAVE — the toolbar and the page ASK (a window event); the panel makes the edit,
 *      asks the size limit, saves through its one door, and answers what to pick and what to say;
 *   4. WHAT IS SAID — the prototype's sentences and the controller's four, with the caps' number read from the rule;
 *   5. EDIT'S LAST ROW — ↑ Earlier · ↓ Later · Group · Remove on a line: what each does, and what a grey one says. Only
 *      a line the couple added can be removed; the Hint stays at the card's foot; the Save button under the ticket;
 *   6. A LINE THE COUPLE ADDED IS A PART LIKE ANY OTHER — a tap names it, it takes a look, Style has its rows;
 *   7. IT ARRIVES EMPTY — no word is made up for it;
 *   8. the Maker's first load, and a guest's page, learn nothing of any of it.
 *
 * SEEN IN A BROWSER (the lab, 375 × 812 and 375 × 667, touch — the commit's contact sheet): ＋ → the sheet → a line
 * added and picked with its box open → typed → on the page → Earlier / Later → Remove; and the sample re-arranged
 * live is the page the server draws for the same list.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import { formatCount } from './format-number';
import { RSVP_ADDED_MAX, RSVP_GROUP_ATTR, RSVP_GROUPS_MAX, readRsvpLook, rsvpLookLine, rsvpStyleHasRows } from './rsvp-look';
import { RSVP_ADD_KINDS, RSVP_LIST_DONE_EVENT, RSVP_LIST_EDIT_EVENT, RSVP_LIST_WORDS, rsvpLayoutEdit, rsvpPlaceOf } from './rsvp-layout-edit';
import * as CANVAS from '../app/[slug]/_components/rsvp-canvas-parts';

(globalThis as unknown as { React: unknown }).React = React;
const h = React.createElement;
const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const list = async () => import('../app/dashboard/[eventId]/launch/_components/rsvp-line-list');

test('1 · ＋ is back on a LINE’s frame — the same ＋, and on a fixed page it only ever asks the stage for a line', () => {
  const FRAME = src(`${L}/add-part-sheet.tsx`);
  /* On a fixed page (this stage) ＋ is drawn ONLY when the stage hands a `lineAdd` — otherwise nothing, as before. */
  const at = FRAME.indexOf('{fixedPages ? (');
  assert.ok(at > 0, 'anti-vacuity: the frame’s fixed-page arm was not found');
  const arm = FRAME.slice(at, FRAME.indexOf('{edgesOf.addAbove ? (', at));
  assert.match(arm, /^\{fixedPages \? \(\s*lineAdd \? \(/);
  assert.match(arm, /\) : null\s*\) : \(\s*<>\s*$/);
  /* The same ＋: the shipped tap, the shipped face, the shipped place on the frame's edge. */
  assert.equal((arm.match(/className=\{EDGE_BTN\}/g) ?? []).length, 2);
  assert.equal((arm.match(/<span className=\{ADD_FACE\}>\+<\/span>/g) ?? []).length, 2);
  assert.match(arm, /data-part-add="above" onClick=\{\(\) => lineAdd\.onAdd\('above'\)\}/);
  assert.match(arm, /data-part-add="below" onClick=\{\(\) => lineAdd\.onAdd\('below'\)\}/);
  /* …and it can never open the SCENES' sheet (that sheet offers the invitation's hidden scenes — another stage's). */
  assert.doesNotMatch(arm, /setAdding|AddPartSheet|makerPartOffers/);
  assert.match(src('lib/maker-parts.ts'), /export function makerStageIsFixedPages\(stage: MakerStageKey\): boolean \{\s*return stage === RSVP_STAGE_KEY;\s*\}/, 'the RSVP stage’s pages are no longer fixed for scenes');
  /* The toolbar hands it only what the page says the picked thing is (`rsvp-list-stage.tsx`). */
  assert.match(src(`${L}/stage-tools.tsx`), /lineAdd: rsvpList\.add,/);
  const STAGE = src(`${L}/rsvp-list-stage.tsx`);
  assert.match(STAGE, /add: node && inList \? \{ above: true, below: true \} : foot \? \{ above: true, below: false \} : null,/, 'the Hint takes ＋ above only; a thing with no place takes none');
});

test('2 · the sheet offers only Heading · Message — the shipped sheet, the shipped row, never a scene', async () => {
  assert.deepEqual([...RSVP_ADD_KINDS], ['h', 'm']);
  const SHEET = src(`${L}/rsvp-line-list.tsx`);
  assert.match(SHEET, /<MakerSheet label=\{`Add \$\{where\} \$\{anchorName\}`\} onClose=\{onClose\}>/);
  assert.match(SHEET, /\{RSVP_ADD_KINDS\.map\(\(kind\) => \(\s*<li key=\{kind\}>\s*<button type="button" data-rsvp-add=\{kind\} onClick=\{\(\) => onAdd\(kind\)\} className=\{STAGE_SHEET_ROW\}>/);
  assert.doesNotMatch(SHEET, /makerPartOffers|SceneTemplatePicker|AddPartSheet|MAKER_PARTS/);
  const { RSVP_ADDED_NAME } = await import('../app/[slug]/_components/rsvp-lines');
  assert.deepEqual(RSVP_ADD_KINDS.map((k) => RSVP_ADDED_NAME[k]), ['Heading', 'Message']);
  /* 🚪 It is drawn on the page's BODY (the door every sheet of a part uses): drawn inside the toolbar it opened UNDER
     the stage's own panel — the dark was there and "Heading · Message" were not (the first picture of this step). */
  assert.match(src(`${L}/rsvp-list-stage.tsx`), /\? createPortal\(\s*<RsvpAddLineSheet[\s\S]{0,420}\/>,\s*document\.body,\s*\)/, 'the ＋ sheet is drawn inside the toolbar again — under the panel');
});

test('3 · every change is the panel’s one save: asked on an event, sized, saved through the one door, answered', () => {
  const PANEL = src(`${L}/maker-rsvp-ask.tsx`);
  assert.match(
    PANEL,
    /const onEdit = \(e: Event\) => \{[\s\S]{0,260}const made = rsvpListEdited\(latest\.current, edit\);\s*if \(!made\.done\.ok\) return answer\(made\.done\);\s*const next = \{ \.\.\.latest\.current, look: made\.look \};\s*if \(!rsvpConfigFits\(next, latest\.current\)\) return answer\(\{ edit, ok: false, said: RSVP_CONFIG_FULL \}\);\s*void saveRef\.current\(\{ look: made\.look \}, [^)]*\);/,
    'an edit of the list is not sized and saved by the panel’s own save',
  );
  assert.match(PANEL, /window\.addEventListener\(RSVP_LIST_EDIT_EVENT, onEdit\);/);
  assert.match(PANEL, /window\.dispatchEvent\(new CustomEvent\(RSVP_LIST_DONE_EVENT, \{ detail: done \}\)\)/);
  /* Nothing else writes the list: the toolbar, the sheet and the last row only ASK. */
  for (const file of [`${L}/rsvp-line-list.tsx`, `${L}/rsvp-list-stage.tsx`, `${L}/stage-tools.tsx`, `${L}/add-part-sheet.tsx`, `${L}/rsvp-canvas-arrange.ts`]) {
    assert.doesNotMatch(src(file), /draftAction\(|hubDraftAction|rsvp_ask_config/, `${file} writes the config itself`);
  }
  assert.notEqual(RSVP_LIST_EDIT_EVENT, RSVP_LIST_DONE_EVENT);
  /* The page is told at once (the stage lays the list on the frame it already drew — never a reload). */
  const STAGE = src(`${L}/maker-rsvp-stage.tsx`);
  assert.match(STAGE, /if \(scene && doc\) arrangeRsvpScreen\(doc, RSVP_SCENE_PART\[scene\], readRsvpLook\(latest\.current\)\);/);
  assert.match(STAGE, /const RSVP_SCENE_PART: Record<RsvpStageScene, RsvpLookCard> = \{ form: 'rsvp', thanks: 'yesnote', decline: 'nonote' \};/);
});

test('4 · what is said: the prototype’s sentences, the controller’s four — and the caps’ number is the rule’s own', async () => {
  const { rsvpListEdited } = await list();
  const said = (config: unknown, edit: Parameters<typeof rsvpListEdited>[1]) => {
    const r = rsvpListEdited(config, edit);
    return r.done.said;
  };
  assert.equal(said({}, { do: 'add', part: 'rsvp', kind: 'm', anchor: 'question', where: 'below' }), 'Message added below Question.');
  assert.equal(said({}, { do: 'add', part: 'rsvp', kind: 'h', anchor: 'yes', where: 'above' }), 'Heading added above Yes answer.');
  assert.equal(said({}, { do: 'add', part: 'nonote', kind: 'm', anchor: 'heading', where: 'below' }), 'Message added below Heading.');
  const one = { look: rsvpListEdited({}, { do: 'add', part: 'rsvp', kind: 'm', anchor: 'question', where: 'below' }).look };
  assert.equal(said(one, { do: 'remove', part: 'rsvp', line: 'a:1' }), 'Message removed.');
  assert.equal(said(one, { do: 'remove', part: 'rsvp', line: 'yes' }), 'This line is part of the RSVP — it stays. Lines you add can be removed.');
  assert.equal(said(one, { do: 'step', part: 'rsvp', name: 'eyebrow', dir: -1 }), 'Already first on this screen.');
  assert.equal(said(one, { do: 'step', part: 'rsvp', name: 'no', dir: 1 }), 'Already last on this screen.');
  assert.equal(said(one, { do: 'step', part: 'rsvp', name: 'question', dir: 1 }), null, 'a step that was taken says nothing — the page shows it');
  const grouped = { look: rsvpListEdited(one, { do: 'group', part: 'rsvp', lines: ['question', 'a:1'] }).look };
  assert.equal(said(grouped, { do: 'add', part: 'rsvp', kind: 'h', anchor: 'a:1', where: 'below' }), 'Heading added below Message — inside its group.');
  assert.equal(said(grouped, { do: 'step', part: 'rsvp', name: 'question', dir: -1 }), 'Already first in its group.');
  /* The two caps: the controller's sentences, with the number READ from the rule (never typed twice). */
  let full: Record<string, unknown> = {};
  for (let i = 0; i < RSVP_ADDED_MAX; i++) full = { look: rsvpListEdited(full, { do: 'add', part: 'rsvp', kind: 'm', anchor: 'no', where: 'below' }).look };
  assert.equal(said(full, { do: 'add', part: 'rsvp', kind: 'm', anchor: 'no', where: 'below' }), `A screen takes up to ${formatCount(RSVP_ADDED_MAX)} added lines. Remove one to add another.`);
  assert.equal(RSVP_LIST_WORDS.full, 'A screen takes up to 4 added lines. Remove one to add another.');
  assert.equal(RSVP_LIST_WORDS.groupsFull, `A screen takes up to ${formatCount(RSVP_GROUPS_MAX)} groups. Ungroup one to make another.`);
  assert.equal(RSVP_LIST_WORDS.groupsFull, 'A screen takes up to 4 groups. Ungroup one to make another.');
  assert.equal(RSVP_LIST_WORDS.hint, 'The hint stays at the foot of the card.');
  assert.equal(RSVP_LIST_WORDS.save, 'The Save button stays under the ticket.');
  const WORDS = src('lib/rsvp-layout-edit.ts');
  assert.match(WORDS, /full: `A screen takes up to \$\{formatCount\(RSVP_ADDED_MAX\)\} added lines\. Remove one to add another\.`,/);
  assert.match(WORDS, /groupsFull: `A screen takes up to \$\{formatCount\(RSVP_GROUPS_MAX\)\} groups\. Ungroup one to make another\.`,/);
  /* The owner's word rules: "event", never the other; never "website". */
  assert.doesNotMatch(Object.values(RSVP_LIST_WORDS).map((w) => (typeof w === 'string' ? w : '')).join(' '), /celebration|website|\bsite\b/i);
});

test('5 · Edit’s last row: ↑ Earlier · ↓ Later · Group · Remove — what each does for the line picked, and what a grey one says', async () => {
  const { RsvpLinePlaceRow, rsvpPlaceSteps } = await list();
  const steps = (config: unknown, name: string, part: 'rsvp' | 'yesnote' | 'nonote' = 'rsvp') => rsvpPlaceSteps(part, name, rsvpPlaceOf(config, part, name), () => {});
  const live = (s: ReturnType<typeof rsvpPlaceSteps>) => ({ earlier: Boolean(s.earlier), later: Boolean(s.later), group: Boolean(s.group), remove: Boolean(s.remove) });
  /* One of the page's own lines: it moves and can be grouped; it is never removed. */
  assert.deepEqual(live(steps({}, 'question')), { earlier: true, later: true, group: true, remove: false });
  assert.deepEqual(live(steps({}, 'eyebrow')), { earlier: false, later: true, group: true, remove: false });
  assert.deepEqual(live(steps({}, 'no')), { earlier: true, later: false, group: true, remove: false });
  assert.equal(steps({}, 'eyebrow').why.earlier, 'Already first on this screen.');
  assert.equal(steps({}, 'no').why.later, 'Already last on this screen.');
  assert.equal(steps({}, 'yes').why.remove, 'This line is part of the RSVP — it stays. Lines you add can be removed.');
  /* A line the couple added: the only kind Remove is live on. */
  const one = { look: rsvpLayoutEdit({}, { do: 'add', part: 'rsvp', kind: 'm', anchor: 'question', where: 'below' }) };
  const added = { look: (one.look as { look?: unknown }).look };
  assert.deepEqual(live(steps(added, 'a:1')), { earlier: true, later: true, group: true, remove: true });
  /* The Hint has no place in the list: nothing moves it, and each grey step says why. */
  const hint = steps({}, 'hint');
  assert.deepEqual(live(hint), { earlier: false, later: false, group: false, remove: false });
  assert.equal(hint.why.earlier, 'The hint stays at the foot of the card.');
  assert.equal(hint.why.later, 'The hint stays at the foot of the card.');
  assert.equal(hint.why.group, 'The hint stays at the foot of the card.');
  /* DRAWN: four of the app's buttons, in that order, each with its word; a step that cannot be taken is still a
     button — grey — and Remove is the danger tone. */
  const html = renderToStaticMarkup(h(RsvpLinePlaceRow, { steps: steps({}, 'eyebrow'), onWhy: () => {} }));
  const buttons = [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
  assert.deepEqual([...html.matchAll(/<span class="lbl">([^<]+)<\/span>/g)].map((m) => m[1]), ['Earlier', 'Later', 'Group', 'Remove']);
  assert.deepEqual(buttons.map((b) => / data-waiting=""/.test(b)), [true, false, false, true]);
  assert.match(buttons[3]!, /data-tone="danger"/);
  assert.match(html, /^<div class="[^"]*\brow-start-4\b[^"]*" data-rsvp-row="4" data-rsvp-place-row="">/);
  /* 📏 FOUR IN ONE ROW AT 375 px, NO WORD CUT: each button is never narrower than its word, and where four do not
     fit the row obeys the app's own Button Rule (`useFitRow`) — never a truncated word. */
  const ROW = src(`${L}/rsvp-line-list.tsx`);
  assert.match(ROW, /const PLACE_STEP = '!h-11 !min-w-max !flex-1 !px-2';/);
  assert.doesNotMatch(ROW, /truncate[^\n]*PLACE_STEP|PLACE_STEP[^\n]*truncate/);
  assert.match(ROW, /const row = useRef<HTMLDivElement>\(null\);\s*useFitRow\(row\);/);
  /* The panel draws it as row 4 for a line of a screen's card — and the Save button keeps the toolbar's own three,
     its grey steps saying the controller's sentence. */
  const PANEL = src(`${L}/maker-rsvp-ask.tsx`);
  assert.equal((PANEL.match(/\{placeRow\}/g) ?? []).length, 2, 'the last row is not drawn for both a line of the page’s own and a line the couple added');
  const { RSVP_SAVE_STAYS } = await import('../app/dashboard/[eventId]/launch/_components/rsvp-list-stage');
  assert.deepEqual(RSVP_SAVE_STAYS, { earlier: 'The Save button stays under the ticket.', later: 'The Save button stays under the ticket.', remove: 'This line is part of the RSVP — it stays. Lines you add can be removed.' });
  assert.match(src(`${L}/stage-tools.tsx`), /why=\{rsvpOpen && picked === 'pass' && rsvpLine === 'save' \? RSVP_SAVE_STAYS : edits\.why\}/);
});

test('6 · a line the couple added is a part like any other: a tap names it, it takes a look, Style has its rows', () => {
  /* The tap: the page names it `a:<id>`, and only on a screen's card. */
  assert.equal(CANVAS.rsvpLineOf('f:rsvp', 'a:1'), 'a:1');
  assert.equal(CANVAS.rsvpLineOf('f:yesnote', 'a:zz9'), 'a:zz9');
  assert.equal(CANVAS.rsvpLineOf('f:rsvp', 'g:1'), 'g:1');
  for (const [section, line] of [['f:pass', 'a:1'], ['f:greeting', 'a:1'], ['f:hero', 'g:1'], ['f:rsvp', 'a:TOOLONG'], ['f:rsvp', 'a:'], ['f:rsvp', 'x:1'], ['f:rsvp', 'a:1"]']] as const) {
    assert.equal(CANVAS.rsvpLineOf(section, line), null, `${section} / ${line}`);
  }
  /* The page's own lines are named as before. */
  assert.equal(CANVAS.rsvpLineOf('f:rsvp', 'question'), 'question');
  assert.equal(CANVAS.rsvpLineOf('f:rsvp', 'heading'), null);
  /* EXECUTED — the shipped tap reader over the page's shape: marker · section › fieldset › p[a:1]; and a group's own
     paper (no line under the finger) names the group. */
  type El = { getAttribute(n: string): string | null; parentElement: El | null; previousElementSibling: El | null };
  const node = (attrs: Record<string, string>, parent: El | null, before: El | null = null): El => ({ getAttribute: (n) => attrs[n] ?? null, parentElement: parent, previousElementSibling: before });
  const section = node({}, null, node({ 'data-maker-section': 'f:rsvp' }, null));
  const fieldset = node({}, section);
  assert.deepEqual(CANVAS.rsvpPartOfTap(node({ 'data-rsvp-line': 'a:1' }, fieldset) as never), { key: 'f:rsvp', el: null, word: null, line: 'a:1' });
  const group = node({ [RSVP_GROUP_ATTR]: 'g1' }, fieldset);
  assert.deepEqual(CANVAS.rsvpPartOfTap(group as never), { key: 'f:rsvp', el: null, word: null, line: 'g:g1' });
  assert.deepEqual(CANVAS.rsvpPartOfTap(node({ 'data-rsvp-line': 'yes' }, group) as never), { key: 'f:rsvp', el: null, word: null, line: 'yes' }, 'a line inside a group is still picked on its own');
  assert.equal(CANVAS.RSVP_GROUP_ATTR, RSVP_GROUP_ATTR, 'the page and the tap reader name a group differently');
  /* It takes a look — the same four things — and Style has its rows; a group has none of its own. */
  assert.equal(rsvpLookLine('rsvp', 'a:1'), 'a:1');
  assert.equal(rsvpLookLine('pass', 'a:1'), null);
  assert.equal(rsvpLookLine('rsvp', 'g:1'), null);
  assert.equal(rsvpStyleHasRows('rsvp', 'a:1'), true);
  assert.equal(rsvpStyleHasRows('rsvp', 'g:1'), false);
  /* Its Edit rows are the panel's (its words), so the toolbar's own stand aside — as for a line with words. */
  assert.match(src(`${L}/stage-tools.tsx`), /const rsvpLineTypes = rsvpLineWord\(picked, rsvpLine\) !== null \|\| rsvpList\.own;/);
});

test('7 · a new line arrives EMPTY, picked, with its box open — no word is made up for it', async () => {
  const { rsvpListEdited } = await list();
  const made = rsvpListEdited({}, { do: 'add', part: 'yesnote', kind: 'h', anchor: 'heading', where: 'above' });
  assert.ok(made.done.ok);
  assert.equal(made.done.ok && made.done.pick, 'a:1');
  assert.deepEqual(readRsvpLook({ look: made.look }).added, { yesnote: [{ id: '1', k: 'h' }] });
  assert.doesNotMatch(JSON.stringify(made.look), /"t":/, 'a new line was given words');
  const PANEL = src(`${L}/maker-rsvp-ask.tsx`);
  assert.match(PANEL, /setJustAdded\(edit\.do === 'add' \? made\.done\.pick : null\);/);
  assert.match(PANEL, /openNow=\{justAdded === line\}/);
  const ROWS = src(`${L}/rsvp-line-list.tsx`);
  assert.match(ROWS, /if \(openNow\) setAsk\(\(n\) => n \+ 1\);/);
  assert.match(ROWS, /\{RSVP_LIST_WORDS\.noAutomatic\}/);
  assert.equal(RSVP_LIST_WORDS.noAutomatic, 'This one has no automatic words — it shows only what you write.');
});

test('8 · the Maker’s first load and a guest’s page learn nothing of it', () => {
  for (const file of ['lib/rsvp-ask.ts', 'lib/hub-draft.ts', 'lib/hub-canvas.ts', 'lib/hub-scenes.ts', 'lib/rsvp-stage-shared.ts', `${L}/maker-shell.tsx`, `${L}/details-workspace.tsx`, `${L}/details-lazy.tsx`]) {
    assert.doesNotMatch(src(file), /rsvp-layout-edit|rsvp-line-list|rsvp-list-stage|rsvp-canvas-arrange|RSVP_LIST_/, `${file} (first load) knows the list’s edits`);
  }
  /* No file a guest is served imports the Maker's half. */
  for (const file of ['app/[slug]/_components/rsvp-lines.tsx', 'app/[slug]/_components/rsvp-note-lines.tsx', 'app/[slug]/_components/rsvp-widget.tsx', 'app/[slug]/_components/rsvp-canvas-bridge.tsx', 'app/[slug]/_components/rsvp-canvas-parts.ts']) {
    assert.doesNotMatch(src(file), /rsvp-layout-edit|launch\/_components|rsvp-canvas-arrange/, `${file} imports the Maker’s half`);
  }
});
