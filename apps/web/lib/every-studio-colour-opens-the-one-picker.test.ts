/**
 * 🎨 EVERY COLOUR OPENS THE ONE PICKER (owner 2026-10-08, relayed: *"we already have a design for the
 * color palettes and how to pick colors on the moodboard. apply that same concept on the background
 * and on any other color rules parts"* · *"the color suggestions should rely on the moodboard as well.
 * so the mood board colors, then the complementing colors for them"* · *"restudy is good"* —
 * `BACKGROUND_RESTUDY_2026-10-08_fable.md` § 2.2 "The colour picker = ONE" and § 6 row 4: *"Retire
 * `ColourWell`, `SwatchPopover`, `StudioMainColours` in favour of `ColourPickerSheet`"*; picture
 * `prototypes/background-restudy-2026-10-08/08-picker.png`).
 *
 *   A · the ONE picker is the Mood Board's `ColourPickerSheet`, its shelves in the approved order:
 *       Against the background (the AA line) · Your Mood Board (the five) · Goes with your Mood Board
 *       (the Mood Board's own harmony) · From your photos · Swatches · Custom (+ Use);
 *   B · the shelves' source, by behaviour: the five first, then what goes with them — from every one
 *       of the five, none repeating the five; each colour named (its slot's name where the caller
 *       holds the five in order, else the colour's own); with a ground, the colours that read on it
 *       come FIRST and none is hidden; the AA line says the prototype's three verdicts with the ratio;
 *   C · every Studio colour control mounts it — through `StudioColourField` or the sheet itself — and
 *       draws no `type="color"` of its own: Look › Colours (`StudioMainColours`) · Info › QR colour ·
 *       Logo › Colour · Mood Board;
 *   D · `ColourWell` is only a trigger: its split swatch opens the sheet, and the panel it drew
 *       (wheel · Brightness · Opacity · Theme colours · Saved colours) is gone;
 *   E · every well in Stages and Look reaches the sheet with the Mood Board's colours — a part's
 *       Background colour and Text colour (their "+" and their row), Look › Colours › Page · Buttons,
 *       the Reveal's veil and petal colours — and a TEXT colour hands the ground it sits on;
 *   F · `SwatchPopover` (the Mood Board's swatches, the Story Maker's theme step) is only a trigger
 *       too: no wheel, no code field of its own; what only it does rides in the sheet's quiet row;
 *   G · the Maker draws NO colour input of its own (`type="color"` nowhere under `launch/_components`
 *       or `website/editor/_components`) and no second swatch grid: every file there that paints a
 *       colour it was handed is listed with what it is, and how many it paints;
 *   H · the sheet is NOT in the Maker's first load — the route's client graph is walked the way Next
 *       builds it (static imports from the client boundaries); neither the sheet, its library, nor
 *       `colour-well.tsx` is in it.
 *
 * 🛡 Sabotaged once each, each red alone. 2026-10-08 (Studio): the QR's Studio row drawn as its old
 * PickMenu → C; the Mood Board shelf moved below Swatches → A; `pickerSuggestions` returning the
 * swatches instead of the harmony → B. 2026-10-08 (this stream): the AA shelf moved to the foot → A;
 * `readableFirst` dropping the colours that do not read → B; a slot's name given by the cleaned
 * list's position → B; `pickerReadsOn` grading "clear" at 3:1 → B; `slots` taken off Look ›
 * Colours → C; a `<input type="range">` put back in `colour-well.tsx` → D; `readsOn={ground}` taken
 * off the part's Text colour → E; the Stages "+" handed a close that does nothing → E; a
 * `type="color"` put back in `swatch-popover.tsx` → F; its Swap dropped → F; a `type="color"` put
 * back in the Reveal's row → G; one more painted swatch in `stage-text.tsx` → G; `editor-shell.tsx`
 * importing the sheet → H.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { stripComments } from './strip-comments';
import { MAIN_COLOUR_NAMES, PICKER_GOES_WITH, PICKER_SWATCHES, pickerReadsOn, pickerShelves, pickerSuggestions, readableFirst } from './mood-board-studio';
import { candidatesFor } from './palette-recommender';
import { contrastRatio } from './hub-legibility';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const D = 'app/dashboard/[eventId]';
const SHEET = `${D}/studio/mood-board/_components/colour-picker-sheet.tsx`;
const FIELD = `${D}/launch/_components/studio-colour-field.tsx`;
const WELL = `${D}/website/editor/_components/colour-well.tsx`;
const FIVE = ['#5B4A6B', '#D9C4CF', '#A9834B', '#F7F2EC', '#7A8B6F'];

test('A · the one picker draws Against the background · Your Mood Board · Goes with your Mood Board · From your photos · Swatches · Custom, in that order', () => {
  const src = read(SHEET);
  const at = (needle: string) => {
    const i = src.indexOf(needle);
    assert.ok(i > 0, `the picker has no ${needle}`);
    return i;
  };
  const order = ['data-picker-against', 'data-picker-palette', 'data-picker-goes-with', 'data-picker-from-photos', 'data-picker-swatches', 'data-picker-custom'].map(at);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'the picker’s shelves are not in the approved order');
  /* Each shelf's heading, in the restudy's words, right above its shelf. */
  const heads = ['>Against the background<', '>Your Mood Board<', '>Goes with your Mood Board<', '>From your photos<', '>Swatches<', '>Custom<'].map(at);
  assert.deepEqual([...heads].sort((a, b) => a - b), heads, 'the shelves’ headings are not in the approved order');
  assert.doesNotMatch(src, /Your palette|Goes with your palette/, 'a shelf still wears its old name');
  assert.match(src, /const suggest = pickerShelves\(palette, \{ names: slots \? MAIN_COLOUR_NAMES : undefined, readsOn \}\);/, 'the picker does not compute its own shelves');
  assert.match(src, /const read = pickerReadsOn\(current, readsOn\);/, 'the AA line is not measured from the colour chosen now');
  assert.match(src, /\{read \? \(/, 'the AA shelf is drawn without a ground to measure against');
  assert.match(src, /\{read\.grade === 'clear' \? 'AA' : 'AA ✗'\}/, 'the AA badge does not say AA ✗ when it fails');
  assert.match(src, /<ActionButton tone="brand" main icon=\{Check\} label="Use"/, 'Custom has no ✓ Use');
});

test('B · the suggestions: the Mood Board’s five, then what goes with them — from every one of the five', () => {
  const s = pickerSuggestions(FIVE.map((c) => c.toLowerCase()));
  assert.deepEqual(s.palette, FIVE, 'the five are not first, as the Mood Board holds them');
  assert.equal(s.goesWith.length, 8);
  for (const c of s.goesWith) assert.ok(!FIVE.includes(c), `${c} repeats one of the five`);
  const harmony = new Set(candidatesFor(FIVE).map((x) => x.hex.toUpperCase()));
  for (const c of s.goesWith) assert.ok(harmony.has(c), `${c} is not the Mood Board’s own harmony`);
  assert.ok(!s.goesWith.every((c) => (PICKER_SWATCHES as readonly string[]).includes(c)), 'the “goes with” row is just the swatches');
  /* Not all from the first colour: the row answers the whole palette. */
  const fromFirst = new Set(candidatesFor([FIVE[0]!]).map((x) => x.hex.toUpperCase()));
  assert.ok(s.goesWith.some((c) => !fromFirst.has(c)), 'every suggestion comes from the first colour alone');
  assert.deepEqual(pickerSuggestions([]), { palette: [], goesWith: [] }, 'with no Mood Board there is nothing to suggest from');
});

test('B · the shelves: each colour named; with a ground, what reads on it comes first and nothing is hidden', () => {
  /* Named by slot where the caller holds the five in order. */
  const plain = pickerShelves(FIVE, { names: MAIN_COLOUR_NAMES });
  assert.deepEqual(plain.board, FIVE.map((hex, i) => ({ hex, name: ['Dominant', 'Supporting', 'Accent', 'Neutral', 'Accent 2'][i] })));
  assert.equal(plain.goesWith.length, PICKER_GOES_WITH, 'the prototype draws six that go with the board');
  for (const r of plain.goesWith) assert.ok(r.name && r.name.length > 0, `${r.hex} has no name of its own`);
  /* A name travels with ITS colour, whatever the caller's spelling or a repeat does to the positions. */
  const messy = pickerShelves(['#5b4a6b', '#5B4A6B', 'nope', '#A9834B'], { names: ['One', 'Two', 'Three', 'Four'] });
  assert.deepEqual(messy.board, [{ hex: '#5B4A6B', name: 'One' }, { hex: '#A9834B', name: 'Four' }]);
  /* No names handed → the colour's own, never a slot's. */
  for (const r of pickerShelves(FIVE).board) assert.ok(!MAIN_COLOUR_NAMES.includes(r.name ?? ''), `${r.hex} wears a slot name nobody handed in`);

  /* On the cream paper: the readable ones lead, in the order they came; the pale ones follow. */
  const ground = '#F7F2EC';
  const mixed = ['#D9C4CF', '#5B4A6B', '#F7F2EC', '#2C2A29', '#A9834B'];
  const reads = (hex: string) => contrastRatio(hex, ground) >= 4.5;
  assert.deepEqual(mixed.filter(reads), ['#5B4A6B', '#2C2A29'], 'the fixture must hold both kinds, out of order, or this proves nothing');
  const unranked = pickerShelves(mixed, { names: MAIN_COLOUR_NAMES });
  const ranked = pickerShelves(mixed, { names: MAIN_COLOUR_NAMES, readsOn: ground });
  assert.deepEqual(unranked.board.map((r) => r.hex), mixed, 'with no ground the shelf keeps the board’s own order');
  assert.deepEqual(ranked.board.map((r) => r.hex), ['#5B4A6B', '#2C2A29', '#D9C4CF', '#F7F2EC', '#A9834B']);
  assert.deepEqual([...ranked.board.map((r) => r.hex)].sort(), [...mixed].sort(), 'a colour was hidden — the shelf is reordered, never filtered');
  assert.deepEqual([...ranked.goesWith.map((r) => r.hex)].sort(), [...unranked.goesWith.map((r) => r.hex)].sort(), 'a colour that goes with the board was hidden');
  const firstUnreadable = ranked.goesWith.findIndex((r) => !reads(r.hex));
  if (firstUnreadable >= 0) assert.ok(ranked.goesWith.slice(firstUnreadable).every((r) => !reads(r.hex)), 'a readable colour sits after one that is not');
  assert.equal(ranked.board[0]?.name, 'Supporting', 'a reordered colour lost the name of the slot it was handed in');
  /* The helper itself: stable, total, and a non-colour ground changes nothing. */
  const rows = FIVE.map((hex) => ({ hex }));
  assert.deepEqual(readableFirst(rows, 'not a colour'), rows);
  assert.deepEqual(readableFirst(rows, null), rows);
  assert.equal(readableFirst(rows, '#000000').length, rows.length);
});

test('B · the AA line: Clear to read · Clear for large words only · Hard to read, each with its ratio', () => {
  const clear = pickerReadsOn('#5B4A6B', '#F7F2EC')!;
  assert.equal(clear.grade, 'clear');
  assert.equal(clear.words, `Clear to read · ${contrastRatio('#5B4A6B', '#F7F2EC').toFixed(1)}:1`);
  const large = pickerReadsOn('#A9834B', '#F7F2EC')!;
  assert.ok(large.ratio >= 3 && large.ratio < 4.5, `the fixture is not between 3 and 4.5 (${large.ratio})`);
  assert.equal(large.grade, 'large');
  assert.match(large.words, /^Clear for large words only · \d\.\d:1$/);
  const hard = pickerReadsOn('#D9C4CF', '#F7F2EC')!;
  assert.equal(hard.grade, 'hard');
  assert.equal(hard.words, `Hard to read — pick a deeper colour · ${hard.ratio.toFixed(1)}:1`, 'the restudy’s own words');
  /* On a dark ground the way out is lighter, not deeper. */
  assert.match(pickerReadsOn('#3E3350', '#2C2A29')!.words, /^Hard to read — pick a lighter colour · /);
  /* A see-through colour is measured by its own six digits; a ground that is not a colour says nothing. */
  assert.equal(pickerReadsOn('#5b4a6b80', '#f7f2ec')!.grade, 'clear');
  assert.equal(pickerReadsOn('#5B4A6B', null), null);
  assert.equal(pickerReadsOn('#5B4A6B', 'paper'), null);
  assert.equal(pickerReadsOn('ink', '#FFFFFF'), null);
});

test('C · every Studio colour control mounts the one picker and draws no colour input of its own', () => {
  const field = read(FIELD);
  assert.match(field, /import \{ ColourPickerSheet \} from '\.\.\/\.\.\/studio\/mood-board\/_components\/colour-picker-sheet';/, 'StudioColourField does not open the Mood Board’s picker');
  assert.match(field, /<ColourPickerSheet[\s\S]{0,200}palette=\{palette\}/, 'StudioColourField does not hand the five to the picker');
  const controls: Array<[string, string, RegExp]> = [
    ['Look › Colours (the five main colours)', `${D}/launch/_components/studio-tools.tsx`, /<StudioColourField\s+data=\{`main-\$\{slot\}`\}[\s\S]{0,300}palette=\{colours\}\s+slots\b/],
    ['Info › QR colour', `${D}/launch/_components/qr-look-controls.tsx`, /studio \? \([\s\S]{0,400}<StudioColourField\s+data="qr-ink"[\s\S]{0,300}palette=\{inks\}/],
    ['Logo › Colour', `${D}/launch/_components/maker-logo.tsx`, /studio \? \([\s\S]{0,400}<StudioColourField\s+data="logo"[\s\S]{0,300}palette=\{studio\.five\}\s+slots\b/],
    ['Mood Board (Palette · Attire)', `${D}/studio/mood-board/_components/mood-board-studio.tsx`, /<ColourPickerSheet[\s\S]{0,200}palette=\{five\}\s+slots\b/],
  ];
  for (const [name, file, mounts] of controls) {
    assert.match(read(file), mounts, `${name} does not open the one picker with the Mood Board’s five`);
  }
  /* The QR's inks are a scan-safe SUBSET of the board — never named by slot. */
  assert.doesNotMatch(read(`${D}/launch/_components/qr-look-controls.tsx`), /<StudioColourField\s+data="qr-ink"[\s\S]{0,400}\bslots\b/, 'the QR inks are not the five in order — a slot name there would lie');
  for (const file of [`${D}/launch/_components/studio-tools.tsx`, FIELD]) {
    assert.doesNotMatch(read(file), /type="color"/, `${file} draws a colour input of its own`);
  }
});

test('D · ColourWell is only a trigger — its split swatch opens the one picker, and its own panel is gone', async () => {
  const src = read(WELL);
  assert.match(src, /<ColourPickerSheet[\s\S]{0,300}palette=/, 'ColourWell opens the picker without the Mood Board’s colours');
  assert.match(src, /readsOn=\{readsOn\}/, 'the well does not hand the ground on');
  assert.match(src, /onRemove=\{\s*onUnset && value/, '“no colour” is not the sheet’s Remove this colour');
  for (const [gone, what] of [
    [/data-colour-panel/, 'its own panel'],
    [/type="range"/, 'a Brightness / Opacity slider'],
    [/type="color"/, 'a colour input'],
    [/colour-wheel'/, 'the wheel’s maths'],
    [/localStorage/, 'device-saved colours'],
    [/\.map\(/, 'a swatch grid'],
    [/Saved colours|Theme colours/, 'the old panel’s headings'],
  ] as const) {
    assert.doesNotMatch(src, gone, `colour-well.tsx still draws ${what} — there is one picker`);
  }
  /* Drawn: the trigger says the colour, and the picker is not on the page until it is opened. */
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ColourWell } = await import(`../${WELL}`);
  const draw = (value: string | null) =>
    renderToStaticMarkup(React.createElement(ColourWell, { value, shown: '#f7f2ec', what: 'the page', palette: FIVE, unsetLabel: 'From your Mood Board', onPick: () => {}, data: 'page' }));
  const set = draw('#5b4a6b');
  assert.match(set, /data-colour-well="page"/);
  assert.match(set, /data-colour-well-wide=""[^>]*style="background:#5b4a6b[^"]*"[^>]*><span[^>]*>#5B4A6B</, 'the well does not say the colour chosen');
  assert.match(draw(null), /data-colour-well-wide=""[^>]*style="background:#f7f2ec[^"]*"[^>]*><span[^>]*>From your Mood Board</, 'an unset well does not show what the page wears');
  assert.equal((set.match(/aria-haspopup="dialog"/g) ?? []).length, 2, 'both halves of the split well open the sheet');
  assert.doesNotMatch(set, /data-colour-picker|data-picker-swatch/, 'the picker is drawn before it is opened');
});

test('E · every well in Stages and Look reaches the sheet with the Mood Board’s colours; a text colour hands its ground', () => {
  const E = `${D}/website/editor/_components`;
  const L = `${D}/launch/_components`;
  const wells: Array<[string, string, RegExp]> = [
    ['a part’s Background colour (Stages “+”)', `${E}/scene-background-row.tsx`, /customColour=\{\(close\) => \(\s*<ColourSheet[\s\S]{0,260}palette=\{board \?\? themeColours\}[\s\S]{0,500}onClose=\{close\}/],
    ['a scene’s Colour row', `${E}/scene-background-row.tsx`, /<IRow label="Colour" data="scene-colour">\s*<ColourWell[\s\S]{0,200}palette=\{board \?\? themeColours\}/],
    ['a part’s Text colour (Stages “+”)', `${E}/element-sheet.tsx`, /customColour=\{\(close\) => \(\s*<ColourSheet[\s\S]{0,300}palette=\{palette\.board \?\? NO_BOARD\}[\s\S]{0,120}readsOn=\{ground\}[\s\S]{0,200}onClose=\{close\}/],
    ['a part’s Text colour row', `${E}/part-inspector.tsx`, /<IRow label="Colour" data="color">\s*<ColourWell[\s\S]{0,260}palette=\{board\}\s+slots=\{slots\}\s+readsOn=\{readsOn\}/],
    ['…handed the ground by the sheet', `${E}/element-sheet.tsx`, /<PartTextTab[\s\S]{0,500}board=\{palette\.board \?\? NO_BOARD\}[\s\S]{0,80}readsOn=\{ground\}/],
    ['Look › Colours › Buttons', `${E}/pro-panels.tsx`, /data-button-colour-field=""[\s\S]{0,400}<ColourWell[\s\S]{0,200}palette=\{moodBoard\?\.swatches \?\? \[\]\}[\s\S]{0,200}onUnset=/],
    ['Look › Colours › Background', `${E}/pro-panels.tsx`, /name="bg_color"[\s\S]{0,900}<ColourWell[\s\S]{0,200}palette=\{moodBoard\?\.swatches \?\? \[\]\}[\s\S]{0,200}onUnset=/],
    ['the Reveal’s veil and petal colours', `${L}/maker-reveal.tsx`, /function ColourRow\([\s\S]{0,2600}<ColourSheet title=\{label\}[\s\S]{0,120}palette=\{palette\}/],
  ];
  for (const [name, file, mounts] of wells) assert.match(read(file), mounts, `${name} does not open the one picker with the Mood Board’s colours`);
  /* The ground a text colour is measured on is the one the sheet's own warning already uses. */
  assert.match(read(`${E}/element-sheet.tsx`), /const ground = canvas\.kind === 'color' && canvas\.color \? canvas\.color : palette\.surface;/);
  /* The Stages rows' "+" opens the picker itself and is handed the way to close it. */
  for (const f of ['stage-background.tsx', 'stage-text.tsx']) {
    const src = read(`${L}/stage-panel/${f}`);
    /* (“+” is the panel's shared colour circle since 2026-10-08 — `SwatchMore`, `kit.tsx`: the row hands it the open.) */
    assert.match(src, /<SwatchMore open=\{custom\} onOpen=\{\(\) => setCustom\(true\)\}/, `${f}: “+” does not open the picker`);
    assert.match(src, /\{custom \? customColour\(\(\) => setCustom\(false\)\) : null\}/, `${f}: the picker cannot close its “+”`);
  }
  /* The five reach the wells from ONE server reading (`mainColoursOf`, the Mood Board drafted over live). */
  assert.match(read(`${D}/website/editor/page.tsx`), /board: mainColoursOf\(\(drafted as \{ role_palette\?: unknown \}\)\.role_palette, currentThemeId\),/);
  assert.match(read(`${E}/editor-shell.tsx`), /<SceneBackgroundRow[\s\S]{0,500}board=\{elementEditing\.palette\.board\}/);
  assert.match(read(`${L}/maker-made-once.tsx`), /mainColours=\{mainColoursOf\(m\.drafted\.role_palette, theme\)\}/);
});

test('F · SwatchPopover is only a trigger: the one picker, and what only it does rides in the sheet’s quiet row', () => {
  const src = read(`${D}/studio/mood-board/_components/swatch-popover.tsx`);
  assert.match(src, /import \{ ColourPickerSheet \} from '\.\/colour-picker-sheet';/);
  assert.match(src, /\{open \? \(\s*<ColourPickerSheet[\s\S]{0,300}palette=\{fromBoard\}/, 'the swatch does not open the one picker with the board’s colours');
  assert.doesNotMatch(src, /type="color"/, 'the swatch still draws a colour wheel of its own');
  assert.doesNotMatch(src, /Hex color code|role="dialog"/, 'the swatch still draws a popover of its own');
  /* Nothing only it did was dropped. */
  const extra = src.slice(src.indexOf('extra={'));
  assert.match(src, /searchColorNames\(query\)/, 'the swatch lost its search by name');
  for (const kept of ['Search by color name', 'results.matches.map', 'results.suggestions.map', 'board.copyToClipboard', 'board.pasteFrom', 'board.beginSwap', 'board.commitSwap', 'board.cancelSwap']) {
    assert.ok(extra.includes(kept), `the swatch lost ${kept}`);
  }
  /* Every mount of it still stands. */
  for (const f of [`${D}/studio/mood-board/_components/palette-section.tsx`, `${D}/studio/mood-board/_components/majors-editor.tsx`, `${D}/story/_components/theme-step.tsx`]) {
    assert.match(read(f), /<SwatchPopover\b/, `${f} no longer mounts the swatch`);
  }
});

/* ── G · the Maker's own files ─────────────────────────────────────────────── */

const MAKER_DIRS = [`${D}/launch/_components`, `${D}/website/editor/_components`];
function tsxUnder(dir: string): string[] {
  return readdirSync(join(WEB, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    if (statSync(join(WEB, rel)).isDirectory()) return tsxUnder(rel);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [rel] : [];
  });
}
/** An element painted with a colour it was HANDED (`style={{ background: c }}`) — a swatch, whatever it is for. */
const PAINTED = /style=\{\{\s*background(?:Color)?:\s*[A-Za-z_][\w.]*(?:\s*\?\?\s*[^}]+)?\s*\}\}/g;

/**
 * Every Maker file that paints a handed colour, what it is, and how many it paints. A file that is
 * not here — or a count that moved — is a new swatch somewhere: open it. If it picks a colour it
 * must be a trigger of the one picker; add it here only with what it is.
 */
const PAINTS: Record<string, [number, string]> = {
  'launch/_components/hub-stage.tsx': [4, 'the Event Hub stage card’s own fixed surfaces (OB.page …) — no colour is picked'],
  'launch/_components/maker-logo.tsx': [1, 'the SHIPPED Maker’s logo inks (no Studio) — the new Maker draws StudioColourField instead'],
  'launch/_components/maker-reveal.tsx': [1, 'the Reveal colour row’s trigger — opens ColourSheet'],
  'launch/_components/stage-panel/stage-background.tsx': [1, 'the prototype’s five-colour row — its “+” opens ColourSheet'],
  'launch/_components/stage-panel/stage-look-row.tsx': [1, 'Style’s last row in the toolbar (owner 2026-10-09: “Color just 1 circle”) — the ONE circle, a trigger of ColourSheet'],
  'launch/_components/stage-panel/stage-text.tsx': [1, 'the prototype’s colour row — its “+” opens ColourSheet'],
  'launch/_components/studio-colour-field.tsx': [1, 'the Studio colour row’s trigger — opens the sheet'],
  'website/editor/_components/background-colour-wells.tsx': [2, 'Background › Colour’s two circles — each a trigger of the one sheet (ColourPickerSheet)'],
  'website/editor/_components/background-effects.tsx': [2, 'Effects › Colour ▾’s dots (Original + the palette’s five, one PickMenu — no picker of its own) and a card’s veil — no colour is picked'],
  'website/editor/_components/buttons-look-row.tsx': [1, 'the dot beside “Accent” — it says where the buttons’ colour comes from; no colour is picked here'],
  'website/editor/_components/colour-well.tsx': [1, 'the split well’s wheel half — a trigger'],
  'website/editor/_components/main-background-panel.tsx': [2, 'labels (Buttons · Accents · Ornaments) and a still’s fallback — no colour is picked'],
  'website/editor/_components/sections-panel.tsx': [1, 'the older editor’s scene colour row, from the couple’s own palette (server forms)'],
};

test('G · the Maker draws no colour input of its own, and no second swatch grid', () => {
  const files = MAKER_DIRS.flatMap(tsxUnder);
  assert.ok(files.length > 100, `the sweep reads the Maker (${files.length} files)`);
  for (const f of [WELL, `${D}/launch/_components/maker-reveal.tsx`, `${D}/launch/_components/stage-panel/stage-text.tsx`]) {
    assert.ok(files.includes(f), `${f} is not swept`);
  }
  const inputs = files.filter((f) => /type=(?:"color"|'color'|\{['"]color['"]\})/.test(read(f)));
  assert.deepEqual(inputs, [], 'a Maker file draws a colour input of its own — open the one picker (ColourWell / ColourSheet / StudioColourField)');
  const found: Record<string, number> = {};
  for (const f of files) {
    const n = (read(f).match(PAINTED) ?? []).length;
    if (n > 0) found[f.slice(D.length + 1)] = n;
  }
  assert.deepEqual(found, Object.fromEntries(Object.entries(PAINTS).map(([f, [n]]) => [f, n])), 'a Maker file paints a colour this guard has not seen — a second swatch grid? see PAINTS');
  /* The detector can fire. */
  assert.equal(('<button style={{ background: c }} /><i style={{ backgroundColor: o.hex }} /><b style={{ background: value ?? shown }} />'.match(PAINTED) ?? []).length, 3);
  assert.equal(('<i style={{ background: WHEEL }} className="x" style={{ color: c }} />'.match(PAINTED) ?? []).length, 1);
});

/* ── H · the first load ────────────────────────────────────────────────────── */

const isClient = (src: string) => /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*['"]use client['"]/.test(src);
function resolveSpec(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(WEB, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const c of [base, `${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
    if (/\.(tsx?|jsx?|mjs)$/.test(c) && existsSync(c)) return c;
  }
  return null;
}
/** Static, value-carrying imports (never `import type`, never `import()`). */
function staticImports(src: string): string[] {
  const out: string[] = [];
  const s = stripComments(src);
  const re = /(?:^|[;\n}])\s*(import|export)\s+(type\s+)?([^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m[2]) continue;
    if (m[1] === 'export' && !m[3]) continue;
    out.push(m[4]!);
  }
  return out;
}
/** What a cold open of the Maker runs before any tool is opened: the client boundaries of its server graph, and all they import statically. */
function makerFirstLoad(): Set<string> {
  const raw = (p: string) => readFileSync(p, 'utf8');
  const server = new Set<string>();
  const boundaries = new Set<string>();
  const stack = ['app/dashboard/[eventId]/launch/page.tsx', 'app/layout.tsx', 'app/dashboard/layout.tsx', 'app/dashboard/[eventId]/layout.tsx'].map((f) => join(WEB, f));
  while (stack.length) {
    const f = stack.pop()!;
    if (server.has(f) || boundaries.has(f)) continue;
    const src = raw(f);
    if (isClient(src)) {
      boundaries.add(f);
      continue;
    }
    server.add(f);
    for (const spec of staticImports(src)) {
      const r = resolveSpec(f, spec);
      if (r) stack.push(r);
    }
  }
  const seen = new Set<string>();
  const walk = [...boundaries];
  while (walk.length) {
    const f = walk.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    for (const spec of staticImports(raw(f))) {
      const r = resolveSpec(f, spec);
      if (r) walk.push(r);
    }
  }
  return new Set([...seen].map((f) => relative(WEB, f)));
}

test('H · the one picker is not in the Maker’s first load — nor is anything that mounts it', () => {
  const first = makerFirstLoad();
  /* Floors: the walk is the Maker's. */
  assert.ok(first.size > 300, `the first-load walk is thin (${first.size} files)`);
  for (const f of [`${D}/website/editor/_components/editor-shell.tsx`, `${D}/launch/_components/maker-shell.tsx`, `${D}/launch/_components/details-lazy.tsx`]) {
    assert.ok(first.has(f), `${f} is not in the walk — it is not the Maker’s first load`);
  }
  for (const f of [
    SHEET,
    'lib/mood-board-studio.ts',
    'lib/palette-recommender.ts',
    'lib/color-names.ts',
    WELL,
    FIELD,
    `${D}/studio/mood-board/_components/swatch-popover.tsx`,
    `${D}/launch/_components/maker-reveal.tsx`,
    `${D}/website/editor/_components/element-sheet.tsx`,
    `${D}/website/editor/_components/scene-background-row.tsx`,
    `${D}/website/editor/_components/pro-panels.tsx`,
  ]) {
    assert.ok(existsSync(join(WEB, f)), `${f} moved — re-point this guard`);
    assert.ok(!first.has(f), `${f} is in the Maker’s first load — the colour picker must load with the tool that opens it (details-lazy.tsx)`);
  }
});
