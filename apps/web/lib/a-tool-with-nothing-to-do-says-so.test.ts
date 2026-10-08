/**
 * a-tool-with-nothing-to-do-says-so.test.ts — STYLE | TEXT | ANIMATE: A TOOL WITH NOTHING TO SET ON THE PICKED PART
 * IS GREY AND ANSWERS A TAP WITH ONE LINE — NEVER A DEAD TAP, NEVER A PILL THAT SLIDES OVER THE WRONG PANEL.
 *
 * Tapped on the Maker lab, 2026-10-08 (Invitation, 375 × 812): on E-Gifts and on What to wear, a tap on Text slid the
 * pill to Text while the panel still showed Style › Look's cards; Animate the same. On the Reveal the two were greyed
 * and a tap said nothing. Owner rule: a failure never renders as success; a press answers at once.
 *
 *   (1) WHICH TOOLS WORK — `makerPartToolWorks`, executed over EVERY part: Style always; Text and Animate exactly
 *       where the work area has a save — a part with words of its own (`el`) or a scene the couple arranges (`w:`).
 *       The parts tapped dead on the lab are among the "no"s; the ones tapped working are among the "yes"es.
 *   (2) …AND THAT IS THE WORK AREA'S OWN RULE — the two branches the predicate mirrors are still the only ones.
 *   (3) THE ANSWER — `makerPartToolWhy`, executed over every part and both tools: one plain line, never empty; a
 *       part whose content is Studio's says where it is changed.
 *   (4) THE PILL — grey and `aria-disabled` (never `disabled`: that is the dead tap), never pressed while it has
 *       nothing to set, and its tap says the line through the app's toast; picking such a part opens Style, not the
 *       remembered tool.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { MAKER_PARTS, MAKER_PART_TOOLS, makerPartSource, makerPartToolWhy, makerPartToolWorks, type MakerPartKey } from './maker-parts';
import { STAGE_TOOL_BUTTON } from './maker-stage-room';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';
const KEYS = Object.keys(MAKER_PARTS) as MakerPartKey[];

test('(1) Style always works; Text and Animate work exactly where there is a save — a part with words of its own, or a scene', () => {
  assert.ok(KEYS.length >= 40, `anti-vacuity: only ${KEYS.length} parts read`);
  const yes: MakerPartKey[] = [];
  const no: MakerPartKey[] = [];
  for (const k of KEYS) {
    assert.equal(makerPartToolWorks(k, 'style'), true, `${k}: Style has nothing to set`);
    const def = MAKER_PARTS[k];
    const want = Boolean(def.canvas) && (Boolean(def.el) || (def.canvas ?? '').startsWith('w:'));
    for (const t of ['text', 'animate'] as const) assert.equal(makerPartToolWorks(k, t), want, `${k} · ${t}`);
    (want ? yes : no).push(k);
  }
  /* TAPPED on the lab — dead (the pill slid, the panel did not change), or greyed and silent. */
  for (const k of ['gifts', 'mywear', 'reveal'] as const) assert.ok(no.includes(k), `${k}: Text / Animate were dead on the lab and are still offered`);
  /* The same shape, not on the lab's page: fixed parts with no words of their own, the pass, the camera, Post Event's. */
  for (const k of ['march', 'details', 'seats', 'pass', 'camera', 'rsvp', 'greeting', 'announce', 'numbers', 'wishes'] as const) assert.ok(no.includes(k), `${k} is offered a tool with no save`);
  /* TAPPED on the lab — working: the cover's parts and the scenes. */
  for (const k of ['logo', 'ename', 'names', 'heroline', 'date', 'place', 'herolink', 'countdown', 'message', 'schedule', 'venue', 'dress', 'story'] as const) {
    assert.ok(yes.includes(k), `${k}: Text / Animate worked on the lab and are now greyed`);
  }
  assert.ok(yes.length >= 12 && no.length >= 12, `anti-vacuity: ${yes.length} yes · ${no.length} no`);
});

test('(2) the predicate is the work area’s own rule: a part’s sheet needs `canvas && el`; a scene’s heading and motion need a scene', () => {
  const tools = read(`${L}/stage-tools.tsx`);
  assert.match(tools, /if \(t !== 'style' && def\?\.canvas && def\.el && !rsvpOpenRef\.current\) \{/, 'the part-sheet door changed — re-derive `makerPartToolWorks`');
  const shell = read(`${E}/editor-shell.tsx`);
  const onTool = shell.slice(shell.indexOf('const onTool = (e: Event) => {'), shell.indexOf('window.addEventListener(MAKER_STAGE_TOOL_EVENT, onTool);'));
  assert.ok(onTool.length > 300, 'anti-vacuity: the work area’s tool handler was not found');
  /* Its two ways to open Text / Animate with no part sheet open both need a SCENE selected (`w:` canvases)… */
  assert.match(onTool, /const sc = now\?\.kind === 'scene' \? scenes\.find\(\(x\) => x\.id === now\.id\) : null;/);
  assert.match(onTool, /\} else if \(!elementRef\.current && t === 'text' && sc && !HUB_ELEMENT_EXCLUDED_WIDGETS\.includes\(sc\.type\)\) \{/);
  assert.match(onTool, /\} else if \(!elementRef\.current && now\?\.kind === 'scene'\) select\?\.\(\{ \.\.\.now, tab: t === 'text' \? 'content' : 'animate' \}\);/);
  /* …and there is no third: a fixed row (`f:`) or a Post Event scene (`p:`) has no branch. */
  assert.equal((onTool.match(/else if|if \(/g) ?? []).length, 5, 'the work area gained (or lost) a way to open a tool — re-derive `makerPartToolWorks`');
  assert.doesNotMatch(onTool, /kind === 'row'|kind === 'post-event'/);
});

test('(3) a tap on a tool with nothing to set answers with ONE plain line — Studio’s parts say where they are changed', () => {
  for (const k of [...KEYS, null]) {
    for (const t of MAKER_PART_TOOLS) {
      const line = makerPartToolWhy(k, t);
      assert.ok(line.length >= 20 && line.length <= 60, `${k} · ${t}: “${line}” is not one short line`);
      assert.match(line, /\.$/);
      assert.doesNotMatch(line, /undefined|null|\n/);
      if (k && makerPartSource(k).kind === 'studio') assert.equal(line, 'Nothing to change here — edit it in Studio.', `${k}: its content is Studio’s and the line does not say so`);
    }
  }
  assert.equal(makerPartToolWhy('gifts', 'text'), 'Nothing to change here — edit it in Studio.');
  assert.equal(makerPartToolWhy('reveal', 'text'), 'Text has nothing to change on this part.');
  assert.equal(makerPartToolWhy('reveal', 'animate'), 'Animate has nothing to change on this part.');
  assert.equal(makerPartToolWhy('pass', 'animate'), 'Animate has nothing to change on this part.');
});

test('(4) the pill: grey and `aria-disabled` (never `disabled`), never pressed with nothing to set, its tap says the line; such a part opens on Style', () => {
  const tools = read(`${L}/stage-tools.tsx`);
  const group = tools.slice(tools.indexOf('data-stage-tpill=""'), tools.indexOf('data-stage-play=""'));
  assert.ok(group.length > 400, 'anti-vacuity: the tool group was not found');
  assert.match(group, /aria-disabled=\{toolWorks\(t\) \? undefined : true\}/, 'a tool with nothing to set is not marked');
  assert.doesNotMatch(group, /(?<![-\w])disabled=\{/, 'a tool is `disabled` — its tap is dead and silent');
  assert.match(group, /aria-pressed=\{open && shownTool === t\}/, 'a pill can be pressed over another tool’s panel');
  assert.match(group, /onClick=\{\(\) => pickTool\(t\)\}/);
  /* Grey by the same class a disabled pill wore. */
  assert.ok(STAGE_TOOL_BUTTON.split(' ').includes('aria-disabled:opacity-30'), 'an inactive tool is not grey');
  assert.ok(!STAGE_TOOL_BUTTON.split(' ').some((c) => c.startsWith('disabled:')), 'the pill still styles a state it never has');
  /* What works: Style; anything while nothing is picked (the tap raises the page's parts); else the part's own answer. */
  assert.match(tools, /const toolWorks = \(t: MakerPartTool\) => t === 'style' \|\| \(!styleOnly && \(!picked \|\| !open \|\| makerPartToolWorks\(picked, t\)\)\);/);
  assert.match(tools, /const shownTool: MakerPartTool = toolWorks\(tool\) \? tool : 'style';/);
  /* The tap: the line FIRST and nothing else — no tool is set, no panel is asked for. */
  assert.match(tools, /const pickTool = \(t: MakerPartTool\) => \{\s*if \(!toolWorks\(t\)\) return setWhy\(\(w\) => \(\{ words: makerPartToolWhy\(picked, t\), n: \(w\?\.n \?\? 0\) \+ 1 \}\)\);\s*setTool\(t\);/);
  assert.match(tools, /<PeekToast key=\{why\.n\} tone="note" data="tool-why" onGone=\{\(\) => setWhy\(\(w\) => \(w\?\.n === why\.n \? null : w\)\)\}>\s*\{why\.words\}\s*<\/PeekToast>/, 'the line is not said through the app’s toast');
  /* Picking a part (a tile, or a tap on the page) opens the tool that HAS something there. */
  assert.match(tools, /const toolFor = useCallback\(\(k: MakerPartKey \| null\): MakerPartTool => \(k && !makerPartToolWorks\(k, toolRef\.current\) \? 'style' : toolRef\.current\), \[\]\);/);
  assert.equal((tools.match(/askTool\(toolFor\(k\), k\);/g) ?? []).length, 2, 'a pick can still ask the work area for a tool it has no panel for');
  assert.doesNotMatch(tools, /askTool\(toolRef\.current, k\)/);
});
