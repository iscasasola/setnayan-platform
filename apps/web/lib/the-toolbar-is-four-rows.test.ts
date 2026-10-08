/**
 * the-toolbar-is-four-rows.test.ts — THE STAGES TOOLBAR'S FRAME (owner 2026-10-09, the approved clickable prototype
 * `public/review/studio-head-prototype.html`; `TOOLBAR-SPEC-2026-10-09.md` — every quote his).
 *
 *   (1) ONE FIXED HEIGHT — *"330 px it is"*: handle 14 + the editing line 20 + the selector's band 52 + four 48-px
 *       rows 6 apart (210) + the phone's safe area 34. A short phone: 44-px rows 4 apart (≈ 284). Never under 10 px
 *       below the last row. The stylesheet's two measures are the SAME numbers the script reports.
 *       Sabotage: a row of 46 → red.
 *   (2) FOUR TOOLS — *"so it is just Edit | Style | Background | Animate"*: those four, in that order, as WORDS, each
 *       as wide as its word, 44 px to the thumb. Sabotage: a fifth tool, or a fixed width → red.
 *   (3) THE ROWS START FROM THE TOP AND NOTHING SCROLLS UP AND DOWN — the grid is exactly four rows, cut, never
 *       centred; Edit's door is row 1 and ↑ Earlier · ↓ Later · Remove is ALWAYS row 4, on every part (a step with
 *       nowhere to go is still a button, grey). RENDERED. Sabotage: `overflow-y-auto` on the grid → red.
 *   (4) ONE SELECTOR, NOT TWO — the scene's Format shows the toolbar's tool (Style: its looks · Background: its
 *       background) and draws no Look | Background | Arrange of its own. RENDERED. Sabotage: `StageStyle` ignoring
 *       the tool → red.
 *   (5) WHAT LEFT THE TOOLBAR — the stage ▾ (the top bar opens the same list), "Tap a part of the page" and the
 *       part tiles, the drag and the fold. Sabotage: `<StageItemMenu` back in the toolbar → red.
 *   (6) THE SHIPPED MAKER NEVER SEES ANY OF IT — the toolbar is mounted only by the new Maker on a phone, and every
 *       rule it adds names the toolbar itself. Sabotage: an unscoped rule → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { MAKER_PARTS, MAKER_PART_TOOLS, MAKER_PART_TOOL_LABEL, makerPartToolWhy, makerPartToolWorks, makerWorkTool, type MakerPartKey } from './maker-parts';
import {
  SP_ROWS,
  STAGE_BAR_BAND_PX,
  STAGE_BAR_FOOT_CSS,
  STAGE_BAR_GRID_CSS,
  STAGE_BAR_HANDLE,
  STAGE_BAR_HANDLE_PX,
  STAGE_BAR_LINE,
  STAGE_BAR_LINE_PX,
  STAGE_BAR_ROW_VARS,
  STAGE_BAR_SHORT_PX,
  STAGE_ROW,
  STAGE_TOOL_BUTTON,
  STAGE_TOOL_INSET,
  STAGE_TOOL_PILL,
  stageBarGridPx,
  stageBarPx,
  stageBarRow,
} from './maker-stage-room';
import { phoneHeightPx } from './maker-phone-room';

/* The panel's pieces are compiled with the classic JSX runtime under `tsx` — they read `React` off the scope. */
(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';
const has = (classes: string, c: string) => classes.split(' ').includes(c);

test('(1) one fixed height: 330 px on a tall phone, ≈ 284 on a short one, never under 10 px below the last row', () => {
  /* The owner's own sum, on an iPhone (812 tall, a 34-px home indicator). */
  assert.equal(STAGE_BAR_HANDLE_PX + STAGE_BAR_LINE_PX + STAGE_BAR_BAND_PX, 14 + 20 + 52);
  assert.deepEqual(stageBarRow(812), { row: 48, gap: 6 });
  assert.equal(stageBarGridPx(812), 210);
  assert.equal(stageBarPx(812, 34), 330, '"330 px it is"');
  /* A short phone: 44-px rows, 4-px gaps — and the spec's "≈ 284 px". */
  assert.deepEqual(stageBarRow(667), { row: 44, gap: 4 });
  assert.equal(stageBarGridPx(667), 188);
  assert.equal(stageBarPx(667, 0), 284);
  /* Either side of the line, and on it. */
  assert.deepEqual(stageBarRow(STAGE_BAR_SHORT_PX - 1), { row: 44, gap: 4 });
  assert.deepEqual(stageBarRow(STAGE_BAR_SHORT_PX), { row: 48, gap: 6 });
  /* The room under the last row is the phone's own, and never under 10. */
  for (const h of [568, 667, 739, 740, 812, 844, 932]) {
    for (const safe of [0, 8, 10, 21, 34]) {
      const foot = stageBarPx(h, safe) - (14 + 20 + 52) - stageBarGridPx(h);
      assert.equal(foot, Math.max(10, safe), `${h} tall, ${safe} safe: ${foot}px under the last row`);
    }
    /* The page keeps more than half the screen at every height. */
    assert.ok(stageBarPx(h, 34) < h * 0.6, `${h} tall: the toolbar takes ${stageBarPx(h, 34)}px`);
  }
  /* A row is at least the 44 px a control is. */
  for (const h of [320, 667, 812, 1200]) assert.ok(stageBarRow(h).row >= 44);

  /* THE STYLESHEET SAYS THE SAME NUMBERS — parsed out of the rule it is given, then compared with the script's. */
  const base = /^html:has\(\[data-stage-tools\]\)\{--sp-rh:(\d+)px;--sp-rg:(\d+)px\}/.exec(STAGE_BAR_ROW_VARS);
  const short = /@media \(max-height:([\d.]+)px\)\{html:has\(\[data-stage-tools\]\)\{--sp-rh:(\d+)px;--sp-rg:(\d+)px\}\}$/.exec(STAGE_BAR_ROW_VARS);
  assert.ok(base && short, 'the two measures are not said to the stylesheet');
  assert.deepEqual({ row: Number(base![1]), gap: Number(base![2]) }, stageBarRow(STAGE_BAR_SHORT_PX));
  assert.deepEqual({ row: Number(short![2]), gap: Number(short![3]) }, stageBarRow(STAGE_BAR_SHORT_PX - 1));
  const line = Number(short![1]);
  assert.ok(line < STAGE_BAR_SHORT_PX && line > STAGE_BAR_SHORT_PX - 1, `the stylesheet's line (${line}) is not the script's (${STAGE_BAR_SHORT_PX})`);
  assert.equal(STAGE_BAR_GRID_CSS, 'calc(4 * var(--sp-rh) + 3 * var(--sp-rg))');
  assert.equal(STAGE_BAR_FOOT_CSS, 'max(10px, env(safe-area-inset-bottom))');

  /* The frame's own pieces are the heights the sum names. */
  assert.ok(has(STAGE_BAR_HANDLE, 'h-[14px]'));
  assert.ok(has(STAGE_BAR_LINE, 'h-5') && has(STAGE_BAR_LINE, 'truncate'), 'the editing line is 20 px, one line, cut');
  assert.ok(has(STAGE_ROW, 'h-[52px]'));

  /* …and the toolbar reports that height, the same picked or not: one call, no drag, no fold, no remembered share. */
  const tools = read(`${L}/stage-tools.tsx`);
  assert.match(tools, /onPx\(stageBarPx\(window\.innerHeight, safe\) - safe\);/, 'the toolbar is not told its one height');
  assert.equal((tools.match(/onPx\(/g) ?? []).length, 3, 'the height is said somewhere else too (away · the one height · unmount)');
  assert.doesNotMatch(tools, /localStorage|MAKER_LT_SIZE_KEY|setPointerCapture|data-stage-folded|data-stage-grab/, 'the toolbar is dragged, folded or remembers a size again');
  /* The toolbar's own top line takes NO room (an inset shadow that follows the curve, never a border): a border's
     1 px pushed Edit's rows 1 px below the work area's (measured on the lab, 2026-10-09: 593 vs 592). */
  const root = /data-stage-tool-now=\{shownTool\}[\s\S]{0,160}className=\{`([^`]*)`\}/.exec(tools)?.[1] ?? '';
  assert.ok(root.includes('rounded-t-2xl'), 'the toolbar’s top is not curved');
  assert.doesNotMatch(root, /(?:^|\s)border(?:-t)?(?:\s|$)|(?:^|\s)p[ty]-/, 'the toolbar’s frame takes room above the handle');
  /* The work area's tool lies over exactly the four rows, on the room kept under the last one. */
  assert.match(tools, /\[data-phone-chrome="panel"\]\{left:0!important;right:0!important;bottom:\$\{STAGE_BAR_FOOT_CSS\}!important;height:\$\{STAGE_BAR_GRID_CSS\}!important;/);
});

test('(2) four tools — Edit | Style | Background | Animate — words only, each as wide as its word', () => {
  assert.deepEqual([...MAKER_PART_TOOLS], ['edit', 'style', 'bg', 'animate']);
  assert.deepEqual(MAKER_PART_TOOLS.map((t) => MAKER_PART_TOOL_LABEL[t]), ['Edit', 'Style', 'Background', 'Animate']);

  const tools = read(`${L}/stage-tools.tsx`);
  const group = tools.slice(tools.indexOf('data-stage-tpill=""'), tools.indexOf('data-stage-play=""'));
  assert.ok(group.length > 300, 'anti-vacuity: the selector was not found');
  /* One button a tool, from the list — and what it draws is the tool's WORD, nothing else. */
  assert.match(group, /\{MAKER_PART_TOOLS\.map\(\(t\) => \(\s*<button/);
  assert.match(group, /className=\{STAGE_TOOL_BUTTON\}\s*>\s*\{MAKER_PART_TOOL_LABEL\[t\]\}\s*<\/button>/, 'a tool is not drawn as its word');
  assert.doesNotMatch(group, /<svg|<[A-Z][A-Za-z]+ aria-hidden|strokeWidth/, 'a tool wears an icon again');
  assert.match(group, /<PillThumb \/>/, 'the thumb does not slide');
  assert.match(group, /data-seg-inset=\{STAGE_TOOL_INSET\}/);
  assert.equal(STAGE_TOOL_INSET, 3);

  /* AS WIDE AS ITS WORD: it grows from its own width (`flex-auto`), never a fixed or an equal share. */
  assert.ok(has(STAGE_TOOL_BUTTON, 'flex-auto'), 'a tool is not as wide as its word');
  assert.ok(!STAGE_TOOL_BUTTON.split(' ').some((c) => /^(w-|flex-1$|basis-)/.test(c)), 'a tool has a fixed or an equal width');
  assert.ok(has(STAGE_TOOL_BUTTON, 'whitespace-nowrap'), 'a word could wrap');
  assert.ok(has(STAGE_TOOL_BUTTON, 'min-w-11'), 'a short word could be under 44 px wide');
  /* 44 px to the thumb, read as the phone-room guard reads every control. */
  assert.equal(phoneHeightPx(STAGE_TOOL_BUTTON, 812), 44);
  assert.equal(phoneHeightPx(STAGE_TOOL_PILL, 812), 44);
  /* The selector takes the row left of ▶. */
  assert.ok(has(STAGE_TOOL_PILL, 'flex-1') && has(STAGE_TOOL_PILL, 'min-w-0'));

  /* What the work area is asked: Animate is its own; the other three are the scene's Format. */
  assert.deepEqual(MAKER_PART_TOOLS.map(makerWorkTool), ['style', 'style', 'style', 'animate']);

  /* Which work, over EVERY part: Style always, Edit on all but the Camera; Background only on a scene the couple arranges. */
  const keys = Object.keys(MAKER_PARTS) as MakerPartKey[];
  assert.ok(keys.length >= 40);
  let bg = 0;
  for (const k of keys) {
    /* (The Camera is a full-screen design with ONLY Style live — owner 2026-10-09.) */
    assert.equal(makerPartToolWorks(k, 'edit'), k !== 'camera', `${k}: Edit`);
    assert.equal(makerPartToolWorks(k, 'style'), true, `${k}: Style`);
    const scene = (MAKER_PARTS[k].canvas ?? '').startsWith('w:');
    assert.equal(makerPartToolWorks(k, 'bg'), scene, `${k}: Background`);
    if (scene) bg += 1;
  }
  assert.ok(bg >= 8, `anti-vacuity: only ${bg} parts have a background`);
  /* A single line of the cover sits on the cover's — grey, and it says so in the prototype's own words. */
  for (const k of ['logo', 'ename', 'names', 'heroline', 'date', 'place', 'herolink'] as const) {
    assert.equal(makerPartToolWorks(k, 'bg'), false, `${k}: a line of the cover has a background of its own`);
    assert.equal(makerPartToolWhy(k, 'bg'), 'This sits on the cover’s background.');
  }
});

test('(3) the rows start from the top and nothing scrolls up and down; Edit: the door is row 1, Earlier · Later · Remove is always row 4', async () => {
  const cls = SP_ROWS.split(' ');
  assert.ok(cls.includes('grid') && cls.includes('grid-rows-[repeat(4,var(--sp-rh))]'), 'the grid is not four rows of the frame’s measure');
  assert.ok(cls.includes('gap-y-[var(--sp-rg)]'));
  assert.ok(cls.includes('auto-rows-[0]'), 'a fifth row would have height');
  assert.ok(cls.includes('overflow-hidden'), 'the rows are not cut to four');
  assert.ok(!cls.some((c) => /^overflow-(y-)?(auto|scroll)$/.test(c)), 'the rows scroll up and down');
  assert.ok(!cls.some((c) => /^(content-|place-content-|items-center$|justify-center$)/.test(c)), 'the rows are centred — "the rule is always start from the top"');

  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StageEdit } = await import('../app/dashboard/[eventId]/launch/_components/stage-panel/stage-edit');
  const { setStagePanelNow } = await import('../app/dashboard/[eventId]/launch/_components/stage-panel/store');
  const draw = (p: { earlier: (() => void) | null; later: (() => void) | null; remove: (() => void) | null }) =>
    renderToStaticMarkup(React.createElement(StageEdit, { ...p, removeWord: 'Remove' }));

  /* A part with a door (E-Gifts → Studio) that can move both ways and be taken off. */
  setStagePanelNow({ picked: 'gifts', quiet: { kind: 'studio', words: 'Edit the E-Gifts', open: () => {} }, about: null });
  const go = () => {};
  const html = draw({ earlier: go, later: go, remove: go });
  const rows = [...html.matchAll(/data-stage-edit-row="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(rows, ['door', 'place'], 'Edit draws rows other than its door and its place');
  const rowClass = (name: string) => new RegExp(`class="([^"]*)" data-stage-edit-row="${name}"`).exec(html)?.[1]?.split(' ') ?? [];
  assert.ok(rowClass('door').includes('row-start-1'), 'the door is not row 1');
  assert.ok(rowClass('place').includes('row-start-4'), 'Earlier · Later · Remove is not the LAST row');
  const door = html.slice(html.indexOf('data-stage-edit-row="door"'), html.indexOf('data-stage-edit-row="place"'));
  assert.match(door, /aria-label="Edit the E-Gifts"/, 'row 1 is not the part’s door');
  const place = html.slice(html.indexOf('data-stage-edit-row="place"'));
  const steps = [...place.matchAll(/<button[^>]*aria-label="([^"]+)"[^>]*>/g)];
  assert.deepEqual(steps.map((m) => m[1]), ['Earlier', 'Later', 'Remove'], 'the last row is not ↑ Earlier · ↓ Later · Remove, in that order');
  for (const m of steps) assert.doesNotMatch(m[0], /aria-disabled|disabled=""/, `${m[1]} is grey on a part that can do it`);
  assert.match(steps[2]![0], /data-tone="danger"/, 'Remove is not the danger button');
  assert.match(steps[0]![0], /class="ab /, 'the steps are not the app’s ONE action button');

  /* ALWAYS: a part that cannot move and cannot be taken off (the Reveal) keeps the three — grey, still buttons. */
  setStagePanelNow({ picked: 'reveal', quiet: null, about: null });
  const fixed = draw({ earlier: null, later: null, remove: null });
  const greyed = [...fixed.slice(fixed.indexOf('data-stage-edit-row="place"')).matchAll(/<button[^>]*aria-label="([^"]+)"[^>]*>/g)];
  assert.deepEqual(greyed.map((m) => m[1]), ['Earlier', 'Later', 'Remove'], 'a fixed part lost its last row');
  for (const m of greyed) {
    assert.match(m[0], /aria-disabled="true"/, `${m[1]} is not grey on a part that cannot`);
    assert.doesNotMatch(m[0], / disabled=""/, `${m[1]} is natively disabled — it drops out of a screen reader's path`);
  }
  setStagePanelNow({ picked: null, quiet: null, about: null });

  /* A STEP IS THE GRIP'S OWN WRITE — one function lands a part (`dropOn`, the retired grip's drop), the step ends in
     it, and it holds the hook's only order write for a scene: a step can never cost more than a drag did. */
  const edits = read(`${L}/add-part-sheet.tsx`);
  const hook = edits.slice(edits.indexOf('export function usePartEdits('), edits.indexOf('function OwnScenePicker('));
  assert.ok(hook.length > 4000, 'anti-vacuity: the part edits were not found');
  assert.match(hook, /const stepMove = \(dir: -1 \| 1\) => \{\s*const o = askPartOps\(\);\s*const t = o && canMove \? neighbour\(o, dir\) : null;\s*if \(o && t\) dropOn\(o, t, dir < 0 \? 'above' : 'below'\);\s*\};/);
  assert.equal((hook.match(/o\.move\(mv\.id, delta\)/g) ?? []).length, 1, 'a second order write for the picked scene');
  assert.match(hook, /remove: canRemove \? \(\) => setRemoving\(true\) : null,/, 'Remove does not ask first (the one confirm)');
});

test('(4) one selector, not two: the scene’s Format shows the toolbar’s tool and has no Look | Background | Arrange of its own', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StageStyle } = await import('../app/dashboard/[eventId]/launch/_components/stage-panel/stage-style');
  const { setStageTool } = await import('../app/dashboard/[eventId]/launch/_components/stage-panel/store');
  const h = React.createElement;
  const draw = (background: boolean) =>
    renderToStaticMarkup(
      h(StageStyle, {
        look: h('i', { 'data-t': 'look' }),
        background: background ? h('i', { 'data-t': 'bg' }) : null,
        arrange: h('i', { 'data-t': 'arrange' }),
      }),
    );
  const shows = (html: string) => [...html.matchAll(/data-t="([a-z]+)"/g)].map((m) => m[1]);

  setStageTool('style');
  assert.deepEqual(shows(draw(true)), ['look'], 'Style is not the part’s looks alone');
  setStageTool('bg');
  assert.deepEqual(shows(draw(true)), ['bg'], 'Background is not the part’s background alone');
  /* A part with no background never draws a blank under a tool it should not be on. */
  assert.deepEqual(shows(draw(false)), ['look']);
  /* Under Edit the body stays mounted (a word typed on a reply page saves through it) — the toolbar hides it. */
  setStageTool('edit');
  assert.deepEqual(shows(draw(true)), ['look']);
  for (const t of MAKER_PART_TOOLS) {
    setStageTool(t);
    const html = draw(true);
    assert.doesNotMatch(html, /data-stage-phases|role="group"/, `${t}: a second selector is drawn under the toolbar’s`);
    assert.ok(!shows(html).includes('arrange'), `${t}: Arrange is drawn — "i don't think we need the arrange anymore"`);
  }
  setStageTool('edit');

  /* …and under Edit the work area's tool is out of sight and out of reach — only then. */
  const tools = read(`${L}/stage-tools.tsx`);
  assert.match(tools, /\[data-maker-shell\]:has\(\[data-stage-tool-now="edit"\]\) \[data-phone-chrome="panel"\]\{visibility:hidden;pointer-events:none\}/);
  assert.match(tools, /data-stage-tool-now=\{shownTool\}/);
  assert.match(tools, /useEffect\(\(\) => setStageTool\(shownTool\), \[shownTool\]\);/, 'the body under the selector is not told the tool');
});

test('(5) what left the toolbar: the stage ▾, "Tap a part of the page", the part tiles — and the top bar still opens the stage list', () => {
  const tools = read(`${L}/stage-tools.tsx`);
  assert.doesNotMatch(tools, /<StageItemMenu/, 'the stage ▾ is back in the toolbar — "means we can remove this"');
  assert.doesNotMatch(tools, /Tap a part of the page|data-stage-nosel|data-stage-strip|data-stage-part=/, 'the hint or the part tiles are back — "these are not the tools"');
  /* The order, top to bottom: the handle, the editing line, the selector, the four rows. */
  const order = ['data-stage-handle=""', 'data-stage-caption=""', 'data-stage-row=""', 'data-stage-rows=""'].map((m) => tools.indexOf(m));
  assert.ok(order.every((i) => i > 0), 'a piece of the frame is missing');
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'the frame is out of order — the handle is "above your editing"');
  /* The handle is drawn, never pressed. */
  const handle = tools.slice(order[0]! - 80, order[1]!);
  assert.match(handle, /<div aria-hidden data-stage-handle=""/);
  assert.doesNotMatch(handle, /<button|onPointer|onClick/);
  /* "You're editing · Stage › Page › Part" — the part named once one is picked. */
  assert.match(tools, /picked \? makerPartLabelOn\(stageKey, picked\) : null\]\s*\.filter\(Boolean\)\s*\.join\(' › '\)/);
  /* The guests' bar is still a bar under the page — its tabs only, where the stage has pages. */
  const bar = tools.slice(tools.indexOf('data-stage-guest-bar=""'), tools.indexOf('</nav>'));
  assert.ok(bar.length > 400, 'anti-vacuity: the guests’ bar was not found');
  assert.match(bar, /hidden=\{pages\.length <= 1\}/, 'a stage that is one page draws an empty bar');
  assert.doesNotMatch(bar, /You’re editing|data-stage-caption/, '"You’re editing" is still on the guests’ bar — it is the toolbar’s own line now');
  assert.match(bar, /data-stage-guest-tab=\{p\.key\}/);

  /* The list of stages is still there, and the top bar is who opens it (`bar`). */
  const menu = read(`${L}/stage-item-menu.tsx`);
  assert.match(menu, /export function StageItemMenu\(/);
  assert.match(menu, /bar\?: \{ open: boolean; onClose: \(\) => void; here: boolean \};/);
  const top = read(`${L}/stages-studio-parts.tsx`);
  const at = top.indexOf('<StageItemMenu');
  assert.ok(at > 0 && /\bbar=\{/.test(top.slice(at, at + 600)), 'the top bar no longer opens the stage list');
});

test('(6) the shipped Maker never sees any of it: mounted only by the new Maker on a phone; every rule names the toolbar', () => {
  /* Mounted in one place, behind `ss` (the flag AND a phone), on the Stages side. */
  const shell = read(`${L}/maker-shell.tsx`);
  assert.equal((shell.match(/<StageTools\b/g) ?? []).length, 1);
  assert.match(shell, /grab=\{ss \? side === 'stages' \? <StageTools /);
  assert.match(shell, /const ss = stagesStudio && phone;|ss = stagesStudio && phone/, 'the new Maker is no longer the flag AND a phone');

  /* Every rule the toolbar writes is conditional on the toolbar being drawn. */
  const tools = read(`${L}/stage-tools.tsx`);
  const css = tools.slice(tools.indexOf('<style>'), tools.indexOf('</style>'));
  assert.ok(css.length > 600, 'anti-vacuity: the toolbar’s rules were not found');
  const selectors = [...css.matchAll(/'((?:\[data-|html)[^{']*)\{/g), ...css.matchAll(/`((?:\[data-|html)[^{`]*)\{/g)].map((m) => m[1]!);
  assert.ok(selectors.length >= 5, `anti-vacuity: only ${selectors.length} rules read`);
  for (const sel of selectors) {
    for (const one of sel.split(',')) {
      assert.match(one, /\[data-stage-tools\]|\[data-stage-tool-now="edit"\]|\[data-stage-playing\]/, `a rule reaches a Maker with no toolbar: ${one}`);
    }
  }
  assert.match(STAGE_BAR_ROW_VARS, /^html:has\(\[data-stage-tools\]\)\{/);
  /* The layout rules are a phone's. */
  assert.match(css, /'@media \(max-width:1023\.98px\)\{' \+/);
});
