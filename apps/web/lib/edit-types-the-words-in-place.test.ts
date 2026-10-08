/**
 * edit-types-the-words-in-place.test.ts — THE TOOLBAR'S EDIT (owner 2026-10-09, verbatim: *"if the edit is just text,
 * then don't need to jump. but it can both adapt to whichever is edited. same goes to simple edits. Only jump if it
 * has editing that cannot be done there. Example: Schedule, Love Story, Wedding March, Logo"*;
 * `TOOLBAR-SPEC-2026-10-09.md` § EDIT).
 *
 *   (1) ONE VALUE, HOWEVER MANY DOORS — keeping a field's words is the SHIPPED write: EXECUTED for the names, a line
 *       of the cover and each scene field, and compared with the shipped writers' own answers (the same sanitizer,
 *       the same patch, the same write key the typing bar uses). Refused words are refused, never cut and never
 *       sent. Sabotage: a write key of Edit's own → red.
 *   (2) THE ROWS — RENDERED: a part with texts draws one typed Form row per text in rows 1–3 and NO door; the text
 *       last tapped comes first; a part with none draws its ONE door in row 1; row 4 is always Earlier · Later ·
 *       Remove. Sabotage: the door drawn beside the fields → red.
 *   (3) WHICH PARTS JUMP — the door's words are the prototype's ("Open in Studio › <page>", "Change it in
 *       Suppliers"), over EVERY part; the owner's four examples and the parts of the same kind have a Studio door,
 *       and no part of text has one that says anything else. Sabotage: the old "Edit the …" → red.
 *   (4) WHAT CAN BE TYPED IS THE PAGE'S TO SAY — the fields are read off the canvas with the canvas's own readers,
 *       only where the shipped typing door could put a caret; the page shows the words as they are typed and ONE
 *       write keeps them (held — no Maker render). Sabotage: a save on every keystroke → red.
 *   (5) THE TYPING BAR — while a field is open the toolbar is only "Typing · <part>" + Done over that field; Done
 *       is the app's main button. All by `:has()` on the typed row's own mark. Sabotage: the bar shown always → red.
 *   (6) ONE ⓘ — at the right end of the "You're editing" line, the picked part's own sentences word for word;
 *       nothing when it has none; no ⓘ and no name-only row left in Edit. RENDERED. Sabotage: an ⓘ back in the
 *       door's row → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { MAKER_PARTS, MAKER_STUDIO_TOOL_LABEL, makerPartQuietRow, makerPartSource, type MakerPartKey } from './maker-parts';
import { sceneTypeWrite } from './scene-type-words';
import { typedDisplayName } from './typed-names';
import { withTypedWords } from './type-in-place';
import { canvasWriteKey } from './maker-draft-store';
import { SP_KEY_BAR, STAGE_BAR_ABOUT, STAGE_BAR_LINE } from './maker-stage-room';
import { phoneHeightPx } from './maker-phone-room';

/* The panel's pieces are compiled with the classic JSX runtime under `tsx` — they read `React` off the scope. */
(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';
const KEYS = Object.keys(MAKER_PARTS) as MakerPartKey[];
const WORDS = `../${L}/stage-panel/part-words`;

type Field = import('../app/dashboard/[eventId]/launch/_components/stage-panel/part-words').PartWordsField;
const field = (over: Partial<Field>): Field => ({ key: 'f:hero', el: 'line', field: null, label: 'Invite line', text: '', auto: null, long: false, maxLength: 240, twoPeople: false, ...over });

test('(1) keeping a field’s words is the shipped write — the same sanitizer, patch and key as the typing bar', async () => {
  const { partWordsWrite, NAMES_WRITE_KEY } = await import(WORDS);
  const door = { heroCanvas: {}, ownWords: { custom_1: { title: 'Our pets', body: 'Two dogs.' } } };

  /* THE NAMES → the event's own name, in the draft. */
  const names = field({ el: 'names', label: 'Names', text: 'Maria & Jose', twoPeople: true });
  const n = partWordsWrite(names, '  Ana   &  Ben ', door);
  assert.ok(n.ok);
  assert.deepEqual(n.patch, { events: { display_name: typedDisplayName('  Ana   &  Ben ', true) } });
  assert.equal(n.writeKey, 'event:display_name');
  assert.equal(n.writeKey, NAMES_WRITE_KEY);
  /* A side left blank is refused — nothing to send. */
  const blank = partWordsWrite(names, 'Ana & ', door);
  assert.equal(blank.ok, false);
  assert.equal(typedDisplayName('Ana & ', true), null, 'anti-vacuity: the shipped rule no longer refuses a blank side');

  /* A LINE OF THE COVER → the hero's canvas, built on the Maker's own copy. */
  const line = field({ el: 'line', auto: 'invite you to celebrate their wedding' });
  const l = partWordsWrite(line, 'Join us by the sea', door);
  assert.ok(l.ok);
  assert.equal(l.writeKey, canvasWriteKey('hero'));
  assert.deepEqual(l.patch, { widgets: { hero: { canvas: { elements: withTypedWords(undefined, 'line', 'Join us by the sea', line.auto).elements } } } });
  assert.equal(l.words, 'Join us by the sea');
  l.undo();
  /* The page's own words typed back = no word of its own; nothing changed = nothing sent. */
  const same = partWordsWrite(line, line.auto!, door);
  assert.ok(same.ok);
  assert.equal(same.patch, null, 'unchanged words are sent');
  /* Words the shipped sanitizer refuses (far too long for one line) are refused here — never cut, never sent. */
  const tooLong = 'word '.repeat(200);
  assert.equal(withTypedWords(undefined, 'line', tooLong, null).refused, true, 'anti-vacuity: the sanitizer accepts a 1,000-character line');
  assert.equal(partWordsWrite(line, tooLong, door).ok, false);

  /* EACH SCENE FIELD → exactly `sceneTypeWrite`'s patch and key. */
  for (const [f, key, typed] of [
    ['message', 'w:special_message', 'We cannot wait.\nSee you there.'],
    ['reminders', 'w:what_to_bring', 'Bring a jacket.'],
    ['title', 'w:custom_1', 'Our cats'],
    ['body', 'w:custom_1', 'Three cats.'],
  ] as const) {
    const type = key.slice(2);
    const shipped = sceneTypeWrite(f, type, typed, door.ownWords[type as 'custom_1'] ?? null);
    assert.ok(shipped.ok, `anti-vacuity: ${f} is refused by the shipped writer`);
    const w = partWordsWrite(field({ key, el: 'body', field: f, long: f !== 'title' }), typed, door);
    assert.ok(w.ok, `${f}: refused`);
    assert.equal(w.writeKey, shipped.writeKey, `${f}: a write key of Edit's own — two doors would race`);
    assert.deepEqual(w.patch, shipped.patch, `${f}: not the shipped patch`);
    w.undo();
  }
  /* An emptied message is refused as the shipped writer refuses it (taking it off the page is Remove). */
  assert.equal(partWordsWrite(field({ key: 'w:special_message', el: 'body', field: 'message' }), '   ', door).ok, false);

  /* …and the typing bar holds the same three: one key for the names, one writer a scene, one sanitizer a line. */
  const bar = read(`${E}/type-in-place.tsx`);
  assert.match(bar, new RegExp(`const NAMES_WRITE_KEY = '${NAMES_WRITE_KEY}';`), 'the two doors queue the names under two keys');
  for (const shared of ['typedDisplayName(', 'sceneTypeWrite(', 'withTypedWords(', "canvasWriteKey('hero')", 'makerLatestWrite(', 'HUB_DRAFT_BAR_FIELD']) {
    assert.ok(bar.includes(shared), `the typing bar no longer uses ${shared}`);
    assert.ok(read(`${L}/stage-panel/part-words.ts`).includes(shared), `Edit does not use ${shared}`);
  }
});

test('(2) the rows, rendered: one typed row per text in rows 1–3 and no door; the text last tapped first; a part with none keeps its ONE door; row 4 always', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StageEdit } = await import(`../${L}/stage-panel/stage-edit`);
  const { setStagePanelNow } = await import(`../${L}/stage-panel/store`);
  const keep = async () => ({ ok: true as const });
  const draw = (fields: Field[], tapped: string | null = null) =>
    renderToStaticMarkup(React.createElement(StageEdit, { fields, tapped, onType: () => {}, onKeep: keep, earlier: null, later: null, remove: null, removeWord: 'Remove' }));
  const rowsOf = (html: string) => [...html.matchAll(/class="([^"]*)" data-stage-edit-row="([a-z]+)"(?: data-stage-edit-words="([a-z_]+)")?/g)].map((m) => ({ row: /row-start-(\d)/.exec(m[1]!)?.[1], kind: m[2], id: m[3] ?? null }));
  const door = { kind: 'studio' as const, words: 'Open in Studio › Info', open: () => {} };

  /* A part of ONE text (the names): the field in row 1, the place in row 4, and NO door though it has one. */
  setStagePanelNow({ picked: 'names', quiet: door, about: null });
  const one = draw([field({ el: 'names', label: 'Names', text: 'Maria & Jose' })]);
  assert.deepEqual(rowsOf(one), [{ row: '1', kind: 'words', id: 'names' }, { row: '4', kind: 'place', id: null }]);
  assert.match(one, /<button[^>]*data-form-row-pill="typed"[^>]*aria-label="Names: Maria &amp; Jose\. Tap to change"/, 'the field is not the app’s typed Form row holding the part’s words');
  assert.doesNotMatch(one, /Open in Studio|data-stage-quiet-row/, 'a part that is typed here still shows a door — "if the edit is just text, then don\'t need to jump"');

  /* A part of TWO texts (a scene of their own): two rows, in the page's order… */
  const own = [field({ key: 'w:custom_1', el: 'heading', field: 'title', label: 'Heading', text: 'Our pets' }), field({ key: 'w:custom_1', el: 'body', field: 'body', label: 'Words', text: 'Two dogs.', long: true })];
  assert.deepEqual(rowsOf(draw(own)).map((r) => `${r.row}:${r.id ?? r.kind}`), ['1:title', '2:body', '4:place']);
  /* …and "adapt to whichever is edited": the words tapped on the page come first. */
  assert.deepEqual(rowsOf(draw(own, 'body')).map((r) => `${r.row}:${r.id ?? r.kind}`), ['1:body', '2:title', '4:place']);
  assert.deepEqual(rowsOf(draw(own, 'heading')).map((r) => `${r.row}:${r.id ?? r.kind}`), ['1:title', '2:body', '4:place']);
  /* Never more than three: row 4 is the place's. */
  const four = ['title', 'body', 'message', 'reminders'].map((f) => field({ key: 'w:x', el: 'body', field: f as Field['field'], label: f }));
  assert.deepEqual(rowsOf(draw(four)).map((r) => r.row), ['1', '2', '3', '4']);

  /* A part with NO text the page draws (the Schedule): its ONE door in row 1. */
  setStagePanelNow({ picked: 'schedule', quiet: { kind: 'studio', words: 'Open in Studio › Schedule', open: () => {} }, about: null });
  const jump = draw([]);
  assert.deepEqual(rowsOf(jump), [{ row: '1', kind: 'door', id: null }, { row: '4', kind: 'place', id: null }]);
  assert.equal((jump.match(/aria-label="Open in Studio › Schedule"/g) ?? []).length, 1, 'the door is not ONE button');
  assert.doesNotMatch(jump, /data-form-row-pill/);
  /* No Add, on any of them (the ＋ on the page stays the way to add a part). */
  for (const html of [one, draw(own), jump]) {
    assert.deepEqual([...html.slice(html.indexOf('data-stage-edit-row="place"')).matchAll(/<button[^>]*aria-label="([^"]+)"/g)].map((m) => m[1]), ['Earlier', 'Later', 'Remove']);
    assert.doesNotMatch(html, /aria-label="Add\b/);
  }
  setStagePanelNow({ picked: null, quiet: null, about: null });
});

test('(3) which parts jump: "Open in Studio › <page>" for what cannot be edited in three rows, "Change it in Suppliers" for the date and the place', () => {
  /* The owner's four examples, and the parts of the same kind (the controller's reading). */
  const jumps: Array<[MakerPartKey, string]> = [
    ['schedule', 'Schedule'],
    ['story', 'Love Story'],
    ['march', 'Wedding March'],
    ['logo', 'Logo'],
    ['gifts', 'E-Gifts'],
    ['rsvp', 'RSVP'],
    ['dress', 'Mood Board & Dress Code'],
    ['seats', 'Seat plan'],
  ];
  for (const [k, page] of jumps) {
    assert.equal(makerPartQuietRow(k)?.words, `Open in Studio › ${page}`, `${k}: its door`);
    assert.equal(makerPartSource(k).kind, 'studio');
  }
  for (const k of ['date', 'place', 'venue', 'details'] as const) assert.equal(makerPartQuietRow(k)?.words, 'Change it in Suppliers', `${k}: set by the venue booking`);
  /* EVERY part: a door says one of the three, in the prototype's words — never "Edit the …". */
  let doors = 0;
  for (const k of KEYS) {
    const q = makerPartQuietRow(k);
    if (!q) continue;
    doors += 1;
    const src = makerPartSource(k);
    const want = src.kind === 'studio' ? `Open in Studio › ${MAKER_STUDIO_TOOL_LABEL[src.tool]}` : src.kind === 'supplier' ? 'Change it in Suppliers' : 'Open in Studio › Info';
    assert.equal(q.words, want, `${k}: “${q.words}”`);
    assert.ok(q.words.length <= 40, `${k}: the door does not fit one row`);
  }
  assert.ok(doors >= 20, `anti-vacuity: only ${doors} doors`);
});

test('(4) what can be typed is the page’s to say; the page shows the words as typed and ONE write keeps them', async () => {
  const { orderPartWords, PART_WORDS_MAX } = await import(WORDS);
  assert.equal(PART_WORDS_MAX, 3);
  const a = field({ el: 'heading', field: 'title' });
  const b = field({ el: 'body', field: 'body' });
  assert.deepEqual(orderPartWords([a, b], null), [a, b]);
  assert.deepEqual(orderPartWords([a, b], 'body'), [b, a]);
  assert.deepEqual(orderPartWords([a, b], 'not-there'), [a, b], 'a tap on something else reorders the rows');

  const words = read(`${L}/stage-panel/part-words.ts`);
  /* Read with the canvas's OWN readers, only where the shipped typing door could put a caret. */
  assert.match(words, /import \{ partWords, sceneTypeField \} from '@\/app\/\[slug\]\/_components\/type-in-place-canvas';/);
  assert.match(words, /if \(key !== 'f:hero' \|\| !isTypeCaretPart\(el\)\) return \[\];/, 'a line of the cover the typing door refuses (the date, the place, the mark) is offered a field');
  assert.match(words, /section\.querySelectorAll<HTMLElement>\('\[data-el-field\]'\)/, 'a scene’s fields are not the ones the canvas marked');
  assert.match(words, /text: partWords\(part\)/);
  /* The toolbar reads them off the SHOWN canvas, for the picked part, and never for a reply page. */
  const tools = read(`${L}/stage-tools.tsx`);
  assert.match(tools, /if \(!picked \|\| rsvpOpen\) return setFields\(\[\]\);/);
  assert.match(tools, /readPartWords\(doc, makerPartCanvasOn\(stageKey, picked\), MAKER_PARTS\[picked\]\.el \?\? null, makerPartLabelOn\(stageKey, picked\)\)/);
  /* AS TYPED: on the page only (the bridge's own `typeText`) — never a save. */
  assert.match(tools, /<StageEdit key=\{picked\} fields=\{fields\} tapped=\{tapped\} onType=\{showPartWords\} onKeep=\{keepWords\}/);
  const show = words.slice(words.indexOf('export function showPartWords('), words.indexOf('export async function keepPartWords('));
  assert.match(show, /t: 'typeText'/);
  assert.doesNotMatch(show, /draftAction|makerSave|makerLatestWrite|fetch\(/, 'a keystroke saves');
  /* KEPT: one write, held (no Maker render, no canvas reload), through the work area's own draft door. */
  const keep = words.slice(words.indexOf('export async function keepPartWords('));
  assert.equal((keep.match(/door\.draftAction\(/g) ?? []).length, 1, 'keeping is more than one write');
  assert.match(keep, /\{ held: true, ok: \(r\) => r !== SUPERSEDED && r\.ok === true \}/);
  assert.doesNotMatch(keep, /router\.refresh|requestMakerRefresh\(\)/);
  /* A refused or failed keep puts the page's words back and answers the row — never the look of success. */
  assert.match(keep, /if \(!w\.ok\) \{\s*showPartWords\(f, f\.text\);\s*return \{ ok: false, error: w\.reason \};\s*\}/);
  assert.match(keep, /w\.undo\(\);\s*showPartWords\(f, f\.text\);\s*return \{ ok: false, error: /);
  assert.match(tools, /const o = askPartOps\(\);\s*if \(!o\?\.draftAction\) return \{ ok: false as const, error: /, 'with no draft door a keep looks like success');
  /* The work area lends what the writes are built on — its own values, nothing new stored. */
  assert.match(read(`${L}/add-part-sheet.tsx`), /heroCanvas: raw\.elementEditing\?\.canvases\.hero \?\? null,\s*ownWords: raw\.elementEditing\?\.ownWords \?\? null,/);
  /* The row is the app's typed Form row: its field keeps ONCE, when it closes. */
  const edit = read(`${L}/stage-panel/stage-edit.tsx`);
  assert.match(edit, /<TypedRow\s[\s\S]*?onType=\{\(text\) => onType\(f, text\)\}\s*onKeep=\{\(text\) => onKeep\(f, text\)\}/);
  assert.doesNotMatch(edit, /<input|<textarea|contentEditable/, 'Edit draws a field of its own');
});

test('(5) the typing bar: while a field is open the toolbar is "Typing · <part>" + Done over that one field', () => {
  const tools = read(`${L}/stage-tools.tsx`);
  const css = tools.slice(tools.indexOf('<style>'), tools.indexOf('</style>'));
  const OPEN = ':has([data-form-row-editing])';
  /* Hidden unless a field is open… */
  assert.ok(css.includes("'[data-stage-tools] [data-stage-keys]{display:none}'"), 'the typing bar is shown with no field open');
  assert.ok(css.includes(`'[data-stage-tools]${OPEN} [data-stage-keys]{display:flex}'`));
  /* …and then everything else of the toolbar steps aside: the handle, the line, the selector, the ⓘ, the other rows. */
  assert.ok(css.includes(`'[data-stage-tools]${OPEN}>:is([data-stage-handle],[data-stage-caption],[data-stage-row],[data-stage-about]){display:none}'`));
  assert.ok(css.includes(`'[data-stage-tools]${OPEN} [data-stage-edit-row]:not(${OPEN}){display:none}'`));
  assert.ok(css.includes(`'[data-stage-tools]${OPEN} [data-stage-edit]{display:block;overflow:visible}'`), 'the open field is cut by the four-row grid');
  /* The toolbar is only as tall as the bar and the field; the guests' bar (placed by the full height) is away. */
  assert.ok(css.includes(`'[data-maker-lower-third]:has(>[data-stage-tools] [data-form-row-editing]){height:auto!important;transition:none!important}'`));
  assert.ok(css.includes(`'[data-maker-shell]:has([data-stage-tools] [data-form-row-editing]) [data-stage-guest-bar]{display:none}'`));
  /* The mark those rules read is the typed row's own, set while its field is open. */
  assert.match(read('app/_components/form-row.tsx'), /data-form-row-editing=\{editing \? '' : undefined\}/);
  /* The bar: what is typed, and Done — the app's MAIN button (the accent), 44 px. */
  const bar = tools.slice(tools.indexOf('<div data-stage-keys=""'), tools.indexOf('<div className={STAGE_ROW}'));
  assert.ok(bar.length > 200, 'anti-vacuity: the typing bar was not found');
  assert.match(bar, /Typing · \{picked \? makerPartLabelOn\(stageKey, picked\) : ''\}/);
  assert.match(bar, /<ActionButton tone="brand" main icon=\{Check\} label="Done"/, 'Done is not the app’s main button');
  assert.equal((bar.match(/<ActionButton/g) ?? []).length, 1);
  assert.equal(phoneHeightPx(SP_KEY_BAR, 812), 44);
});

test('(6) one ⓘ: at the right end of the "You’re editing" line, the part’s own sentences word for word; none in Edit’s rows', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StageAbout, QuietBar } = await import(`../${L}/stage-panel/kit`);
  const { setStagePanelNow } = await import(`../${L}/stage-panel/store`);
  const SAID = 'Each guest sees their own pass. It is made from your guest list.';

  /* A part with sentences and no door (the pass): the ONE ⓘ carries them; Edit's row draws nothing. */
  setStagePanelNow({ picked: 'pass', quiet: null, about: SAID });
  const mark = renderToStaticMarkup(React.createElement(StageAbout));
  assert.match(mark, /<span class="[^"]*" data-stage-about=""><button[^>]*data-explain=""[^>]*aria-label="About Digital pass"[^>]*aria-haspopup="dialog"/, 'the ⓘ is not the app’s explanation template, named for the part');
  assert.equal(renderToStaticMarkup(React.createElement(QuietBar)), '', 'a row holding only a name and an ⓘ is back');
  /* A part with a door AND sentences: the door alone in the row, the sentences behind the same ⓘ. */
  setStagePanelNow({ picked: 'gifts', quiet: { kind: 'studio', words: 'Open in Studio › E-Gifts', open: () => {} }, about: SAID });
  const row = renderToStaticMarkup(React.createElement(QuietBar));
  assert.equal((row.match(/<button/g) ?? []).length, 1, 'the door’s row holds something beside the door');
  assert.doesNotMatch(row, /data-explain|data-stage-about/, 'an ⓘ is back in the door’s row');
  assert.match(renderToStaticMarkup(React.createElement(StageAbout)), /aria-label="About E-Gifts"/);
  /* Nothing to say: nothing drawn. */
  setStagePanelNow({ picked: 'names', quiet: null, about: null });
  assert.equal(renderToStaticMarkup(React.createElement(StageAbout)), '');
  setStagePanelNow({ picked: null, quiet: null, about: null });

  /* WORD FOR WORD: the sentences handed to the pop-up are the store's, untouched. */
  const kit = read(`${L}/stage-panel/kit.tsx`);
  assert.match(kit, /<Explain title=\{name\} className="[^"]*">\s*\{about\}\s*<\/Explain>/);
  /* Where it is: once, straight after the line, over the handle and the line — never on the selector's band. */
  const tools = read(`${L}/stage-tools.tsx`);
  assert.equal((tools.match(/<StageAbout \/>/g) ?? []).length, 1);
  assert.match(tools, /<p data-stage-caption="" className=\{STAGE_BAR_LINE\}>[\s\S]{0,200}<\/p>\s*(?:\{\s*\}\s*)?<StageAbout \/>/);
  const cls = STAGE_BAR_ABOUT.split(' ');
  assert.ok(cls.includes('absolute') && cls.includes('top-0') && cls.includes('right-0.5'));
  assert.ok(cls.includes('h-[38px]') && 38 <= 14 + 20 + 4, 'the ⓘ reaches the selector (14 handle + 20 line + the band’s 4 px)');
  assert.ok(cls.includes('w-11'), 'the ⓘ is under 44 px wide');
  /* The line keeps clear of it on both sides, so its words stay centred and never run under the ⓘ. */
  assert.ok(STAGE_BAR_LINE.split(' ').includes('px-11'));
  /* The sentences are still worked out from the part (the fixed scene's own line and source; a reply page's). */
  assert.match(tools, /setStagePanelNow\(\{ picked, quiet, about \}\);/);
});
