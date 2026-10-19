/**
 * edit-owns-content.test.ts — ✏️ IN THE NEW MAKER EVERY TAP NAMES A PART, CONTENT IS EDIT'S, STYLE IS ONLY THE LOOK,
 * AND EDIT IS NEVER BLANK.
 *
 * 🔴 Owner, 2026-10-19, live (Safari ~840 px, Invitation › Home, a Love Story on the page): "YOU'RE EDITING ·
 * INVITATION › HOME" over a blank Edit, and the Love Story's moments editor under Style — *"why is it on style and
 * not on edit (and i thought it should jump to the studio?)"*. Cause: the real canvas's Love Story region
 * (`#site-story`, bound by the bridge as `f:story`) named no part, so the toolbar picked nothing while the work area
 * opened that region's panel, and in the new Maker that panel laid the Details fact's editor inside Style.
 *
 * Properties held (each a property, not a phrasing):
 *   1. Every key the canvas's bridge can send for a tap — each part's own section and every REGION it binds by id
 *      (`ID_SECTIONS`) — names a part on every stage (so the toolbar always has a part, and Edit its door or words).
 *   2. The Love Story's Edit is its one door, "Open in Studio › Love Story" (TOOLBAR-SPEC 2026-10-09 § EDIT).
 *   3. Under the new Maker the work area's body never opens on Content, whatever tab is asked for.
 *   4. Under the new Maker a fixed part's Style never carries its fact's editor; the old Maker's panel still does.
 *   5. Row 1 with nothing picked says one line; a silent page says its own (two states, never one).
 *   6. Wiring: the toolbar names a region's tap through the alias, draws the line, and the work area's Style is
 *      built through `makerStyleLook` / `makerWorkAreaTab` (a revert of any one is red).
 *
 * Sabotage (each seen red, see the PR): drop `'f:story'` from `MAKER_CANVAS_ALIAS` · return `asked` unchanged from
 * `makerWorkAreaTab` · put `pieces.fact` back in the new Maker's `makerStyleLook` · make `stageRowOneLine` return null
 * for nothing picked · pass `fixedFact ?? toolHere` straight into the work area's Style again.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { MAKER_PARTS, MAKER_STAGE_KEYS, makerPartOfTap, makerPartQuietRow, makerPartsOnPage, MAKER_STAGE_PAGES } from './maker-parts';
import { makerPartOfCanvas } from './maker-part-groups';
import { ID_SECTIONS } from '@/app/[slug]/_components/canvas-section-binder';
import { STAGE_NOTHING_PICKED_WORDS, makerStyleLook, makerWorkAreaTab, stageRowOneLine, type MakerWorkAreaTab } from './maker-edit-owns-content';

const read = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');

test('every key a canvas tap can name — each part section and every region the bridge binds by id — names a part on every stage', () => {
  const partKeys = Object.values(MAKER_PARTS)
    .map((d) => d.canvas)
    .filter((c): c is string => typeof c === 'string' && !c.startsWith('p:'));
  const keys = [...new Set([...partKeys, ...ID_SECTIONS])];
  assert.ok(keys.includes('f:story') && keys.includes('w:our_love_story'), 'the Love Story region and its scene are both tap keys');
  const missing: string[] = [];
  for (const stage of MAKER_STAGE_KEYS) {
    for (const key of keys) {
      if (!makerPartOfCanvas(stage, key)) missing.push(`${stage} · ${key}`);
    }
  }
  assert.deepEqual(missing, [], `a tap on these names no part — the toolbar picks nothing and Edit is blank: ${missing.join(', ')}`);
});

test('a tap on the Love Story — its scene or its region — picks the Love Story on every page that lists it, and on a page that does not', () => {
  let pages = 0;
  for (const stage of MAKER_STAGE_KEYS) {
    for (const page of Object.keys(MAKER_STAGE_PAGES[stage] ?? {})) {
      if (!makerPartsOnPage(stage, page).includes('story')) continue;
      pages++;
      for (const key of ['w:our_love_story', 'f:story']) {
        for (const el of [null, 'label', 'heading', 'body']) {
          assert.equal(makerPartOfTap(stage, page, key, el), 'story', `${stage} › ${page}: ${key}${el ? `|${el}` : ''}`);
        }
      }
    }
  }
  assert.ok(pages >= 3, `the Love Story is listed on ${pages} pages`);
  /* Invitation › Home does not list it (one page with Details and Story): the canvas-wide fallback still names it. */
  assert.equal(makerPartOfTap('rsvp', 'home', 'f:story', null) ?? makerPartOfCanvas('rsvp', 'f:story'), 'story');
});

test("the Love Story's Edit is its one door: Open in Studio › Love Story", () => {
  assert.deepEqual(makerPartQuietRow('story'), { words: 'Open in Studio › Love Story', to: { studio: 'story' } });
});

test('under the new Maker the work area never opens on Content; the old Maker keeps every tab', () => {
  const asked: MakerWorkAreaTab[] = ['format', 'animate', 'arrange', 'content', 'transition'];
  for (const a of asked) assert.notEqual(makerWorkAreaTab(a, true), 'content', `asked ${a}`);
  assert.equal(makerWorkAreaTab('content', false), 'content');
  assert.equal(makerWorkAreaTab('transition', false), 'animate');
  assert.equal(makerWorkAreaTab('format', true), 'format');
});

test("under the new Maker a fixed part's Style never carries its fact's editor", () => {
  const all = { style: 'STYLE', ticket: 'TICKET', fact: 'FACT', tool: 'TOOL' };
  for (const fact of ['FACT', null]) {
    for (const tool of ['TOOL', null]) {
      const look = makerStyleLook({ ...all, fact, tool }, true);
      assert.ok(!look.includes('FACT'), `new Maker, fact=${fact} tool=${tool}: ${look.join(',')}`);
      if (tool) assert.ok(look.includes('TOOL'), 'the tool it is made in stays');
    }
  }
  assert.deepEqual(makerStyleLook({ style: null, ticket: null, fact: 'FACT', tool: null }, true), []);
  /* The old Maker's fixed panel draws the fact in place, unchanged. */
  assert.deepEqual(makerStyleLook(all, false), ['STYLE', 'TICKET', 'FACT']);
});

test('row 1 with nothing picked says one plain line; a silent page says its own; a pick has its own rows', () => {
  assert.equal(stageRowOneLine({ picked: false, canvasSilent: false }), 'pick');
  assert.equal(stageRowOneLine({ picked: false, canvasSilent: true }), 'silent');
  assert.equal(stageRowOneLine({ picked: true, canvasSilent: true }), 'silent');
  assert.equal(stageRowOneLine({ picked: true, canvasSilent: false }), null);
  assert.ok(STAGE_NOTHING_PICKED_WORDS.trim().length > 0);
  const silent = read('app/dashboard/[eventId]/website/editor/_components/canvas-bridge-watch.ts').match(/CANVAS_SILENT_WORDS = "([^"]+)"/)?.[1];
  assert.ok(silent && silent !== STAGE_NOTHING_PICKED_WORDS, 'the two states never share words');
});

test('wiring: the toolbar names a region tap through the alias and draws the line; the work area builds Style through the rule', () => {
  const tools = read('app/dashboard/[eventId]/launch/_components/stage-tools.tsx');
  assert.match(tools, /makerCanvasKeyOf\(d\.key\)/, 'the toolbar reads a region tap through `makerCanvasKeyOf`');
  assert.match(tools, /stageRowOneLine\(\{ picked: picked !== null, canvasSilent \}\) === 'pick'/, 'the toolbar draws the nothing-picked line from the rule');
  assert.match(tools, /\{STAGE_NOTHING_PICKED_WORDS\}/, 'the line is drawn');
  const shell = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  const inspector = shell.slice(shell.indexOf('function Inspector('));
  assert.ok(inspector.length > 1000, 'the Inspector is found');
  assert.match(inspector, /const tab: SceneTab = makerWorkAreaTab\(asked, ss\);/, 'the scene tab goes through the rule');
  const ssFixed = inspector.slice(inspector.indexOf('data-maker-fixed-panel={fixed}'), inspector.indexOf('arrange={null}'));
  assert.ok(ssFixed.length > 0, "the new Maker's fixed panel is found");
  assert.match(ssFixed, /makerStyleLook\(/, "the new Maker's fixed Style is built through `makerStyleLook`");
  assert.doesNotMatch(ssFixed, /\{fixedFact\s*(\?\?|\|\||\})/, "the fact's editor is never placed in Style directly");
});
