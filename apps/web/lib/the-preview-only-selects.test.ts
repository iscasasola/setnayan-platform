/**
 * the-preview-only-selects.test.ts — IN THE NEW MAKER'S STAGES, THE PAGE PREVIEW ONLY SELECTS (owner 2026-10-09,
 * verbatim: *"on preview screen, you only select. You can change the content there via edit"*;
 * `TOOLBAR-SPEC-2026-10-09.md`).
 *
 *   (1) A TAP NEVER TYPES — the one rule both pages ask (`makerStageMayType`: the Event Hub canvas through the work
 *       area, the reply pages on the page itself), EXECUTED over every part: nothing picked, another part picked,
 *       and the part itself picked — none types. Sabotage: the old rule's body back ("the picked part types") → red.
 *   (2) NO BUTTONS ON THE FRAME — its outline and its name; no ↑ ↓ ✕, no grip, no 🗑. ＋ is the ONE control left on
 *       the preview (owner 2026-10-09, decided: the ＋ on the page stays as the way to add a part — and the way a
 *       removed part comes back). Sabotage: a 🗑 button back on the frame → red.
 *   (3) SOMETHING IS ALWAYS PICKED ON ARRIVING — once per arrival at a stage's page, the first part the page DRAWS
 *       (measured on the canvas, never the map's order); a tap on the ground still lets go; a step into the page
 *       and a return from Studio keep their own pick. Sabotage: the map's first part (`parts[0]`) → red.
 *   (3b) A PAGE CHANGE NEVER ENDS ON NOTHING — guest tab, stage change, Studio and back: the part held from before
 *       is replaced when it is not this page's (EXECUTED); a tap on the guests' bar does not let go before the page
 *       has changed, and a canvas that does not switch still gets that page's first part picked. Sabotage: the
 *       tap letting go first → red.
 *   (4) THE LAST-USED TOOL IS REMEMBERED, AND A PART OPENS ON A TOOL THAT WORKS — EXECUTED over every part × every
 *       remembered tool: the remembered one where it has something to set, else the first of the four that has;
 *       kept while the toolbar is away. Sabotage: a fallback that ignores what works → red.
 *   (5) THE CAMERA HAS ONLY STYLE (owner 2026-10-09: a full-screen design) — Edit, Background and Animate are grey
 *       on it and it opens on Style. Sabotage: Edit live on the Camera → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import {
  MAKER_PARTS,
  MAKER_PART_TOOLS,
  makerArrivalKeeps,
  makerArrivalPart,
  makerPartIsDrawn,
  makerPartToolFor,
  makerPartsTappable,
  makerPartToolWhy,
  makerPartToolWorks,
  makerStagePickedAttr,
  type MakerPartKey,
} from './maker-parts';
import { makerStageMayType } from './maker-stage-type';
import { partsInPageOrder } from './maker-part-step';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';
const KEYS = Object.keys(MAKER_PARTS) as MakerPartKey[];

test('(1) a tap never types: nothing picked, another part picked, the part itself picked — on the canvas and on the reply pages', () => {
  let asked = 0;
  for (const k of KEYS) {
    const def = MAKER_PARTS[k];
    if (!def.canvas) continue;
    const own = makerStagePickedAttr(k);
    assert.ok(own, `${k}: a drawn part has no picked mark`);
    for (const el of [def.el ?? null, 'heading', 'body', null]) {
      assert.equal(makerStageMayType(null, def.canvas, el), false, `${k}: a first tap typed`);
      assert.equal(makerStageMayType(makerStagePickedAttr('countdown'), def.canvas, el), false, `${k}: typed while another part was picked`);
      /* THE claim: the part is ALREADY picked and its words are tapped again — still only a pick. */
      assert.equal(makerStageMayType(own, def.canvas, el), false, `${k}: a second tap on the picked part types on the page`);
      asked += 3;
    }
  }
  assert.ok(asked >= 400, `anti-vacuity: the rule was asked only ${asked} times`);

  /* BOTH pages still ask THIS rule and nothing else decides — the work area for the Event Hub canvas… */
  const shell = read(`${E}/editor-shell.tsx`);
  const read0 = shell.indexOf('const start = readTypeStart(event.data, event.source, Date.now());');
  const gate = shell.indexOf('if (!makerStageMayType(picked, start.key, start.el)) {', read0);
  const firstStart = shell.indexOf('setTypeStart(start)', read0);
  assert.ok(read0 > 0 && gate > read0 && firstStart > gate, 'the work area starts typing before it asks the rule');
  const refused = shell.slice(gate, firstStart);
  assert.match(refused, /t: 'typeStop'/, 'the tap’s caret is not taken back');
  assert.match(refused, /MAKER_STAGE_PICK_EVENT/, 'the tap is not handed to the toolbar as a pick');
  assert.match(refused, /return;/);
  assert.match(shell.slice(read0, gate), /if \(stagesStudioRef\.current && window\.innerWidth < 1024\) \{/, 'the rule is asked outside the new Maker on a phone — the shipped Maker types as it did');
  /* …and the reply pages on the page itself. */
  const bridge = read('app/[slug]/_components/rsvp-canvas-bridge.tsx');
  assert.match(bridge, /if \(wordEl && part\.word && rsvpWordIsTyped\(part\.word\) && makerStageMayType\(picked, part\.key, part\.el\)\) \{\s*beginTyping\(/);
  assert.equal((bridge.match(/beginTyping\(wordEl/g) ?? []).length, 1, 'a reply page types by a second door');
  /* The toolbar slides away for typing only when the same rule says so. */
  const tools = read(`${L}/stage-tools.tsx`);
  assert.match(tools, /if \(makerStageMayType\(attr, [^)]*\)\) setTyping\(true\);/);
});

test('(2) no buttons on the frame: its outline and its name — and ＋, the one control left on the preview', () => {
  const edges = read(`${L}/add-part-sheet.tsx`);
  const frame = edges.slice(edges.indexOf('data-part-edges={picked}'), edges.indexOf('{toast && !error ? ('));
  assert.ok(frame.length > 800, 'anti-vacuity: the frame was not found');
  assert.match(frame, /<div data-part-outline="" className=\{PART_OUTLINE\}/);
  assert.match(frame, /data-part-name=""/);
  /* Every control drawn on the frame, by what it is marked as. */
  const controls = [...frame.matchAll(/<(?:button|a|input)\b[\s\S]*?>/g)].map((m) => /data-part-[a-z]+(?:="[a-z]*")?/.exec(m[0])?.[0] ?? m[0].slice(0, 60));
  assert.deepEqual(controls, ['data-part-add="above"', 'data-part-add="below"'], 'the frame draws a control other than ＋');
  assert.doesNotMatch(frame, /onPointerDown|onPointerMove|touch-none|GripVertical|Trash2|ChevronUp|ChevronDown/, 'a grip, a 🗑 or a chip is back on the frame');
  /* The whole frame lets taps through to the page under it; only ＋ takes one. */
  assert.match(frame, /className="pointer-events-none fixed inset-0 z-\[86\] lg:hidden"/);
  /* Moving and removing did not go away: they are the toolbar's Edit › Earlier · Later · Remove, from the same hook. */
  assert.match(edges, /earlier: canStep\(-1\) \? \(\) => stepMove\(-1\) : null,\s*later: canStep\(1\) \? \(\) => stepMove\(1\) : null,\s*remove: canRemove \? \(\) => setRemoving\(true\) : null,/);
  const tools = read(`${L}/stage-tools.tsx`);
  assert.match(tools, /<StageEdit [^>]*earlier=\{edits\.earlier\} later=\{edits\.later\} remove=\{edits\.remove\} removeWord=\{edits\.removeWord\} /);
  /* The page's own outline is put away too — one highlight (the frame), nothing of the canvas's to press. */
  assert.match(tools, /\[data-setnayan-editor-bound\],\[data-setnayan-editor-bound\] \*\{outline:none!important\}/);
});

test('(3) something is always picked on arriving: the first part the page DRAWS, once per arrival', () => {
  /* The order is the page's, measured — not the map's: a page that draws the date above the names picks the date. */
  const tops: Record<string, number> = { names: 140, date: 80, place: 220 };
  assert.deepEqual(partsInPageOrder(['names', 'date', 'place', 'countdown'] as const, (k) => tops[k] ?? null)[0], 'date');

  const tools = read(`${L}/stage-tools.tsx`);
  const at = tools.indexOf('const arrived = useRef<{ stage: MakerStageKey | null; at: string | null }>({ stage: null, at: null });');
  const arrive = tools.slice(at, tools.indexOf('}, [parts, playing, shownPage, stage, stageKey, typing]);', at));
  assert.ok(at > 0 && arrive.length > 400, 'anti-vacuity: the arrival was not found');
  /* Keyed by the stage AND the page — a new page of the same stage is an arrival too. */
  assert.match(arrive, /const at = `\$\{stageKey\}\/\$\{shownPage \?\? ''\}`;/);
  /* ONCE: an arrival already answered asks for nothing (a tap on the ground lets go and it stays let go). */
  assert.match(arrive, /if \(arrived\.current\.at === at \|\| parts\.length === 0 \|\| typing \|\| playing\) return;/);
  /* The first DRAWN part Edit has a row for — the measured order's, never the map's; never the Reveal (it leads
     three pages and has only Style), never an empty tool (the controller's calls, 2026-10-09). EXECUTED: */
  const row = new Set<MakerPartKey>(['ename', 'names', 'schedule']);
  const has = (k: MakerPartKey) => row.has(k);
  assert.equal(makerArrivalPart(['reveal', 'ename', 'names'], has), 'ename', 'the arrival lands on the Reveal');
  assert.equal(makerArrivalPart(['pass', 'gallery', 'schedule', 'names'], has), 'schedule', 'the arrival lands on a part with nothing in Edit’s rows');
  assert.equal(makerArrivalPart(['date', 'names'], has), 'names', 'not the FIRST part with a row, in the page’s order');
  /* A page whose parts all have no row still picks its first; a page that draws nothing (or only the Reveal) picks nothing. */
  assert.equal(makerArrivalPart(['reveal', 'pass', 'gallery'], has), 'pass');
  assert.equal(makerArrivalPart(['reveal'], has), null);
  assert.equal(makerArrivalPart([], has), null);
  assert.match(arrive, /const first = makerArrivalPart\(orderedRef\.current\(\), hasEditRowRef\.current\);\s*if \(!first\) return;\s*const was = arrived\.current;\s*arrived\.current = \{ stage: stageKey, at \};/, 'the arrival does not pick the first drawn part that has an Edit row');
  /* "Has a row" is what Edit would draw: the part's one door, or words the page draws for it. */
  assert.match(tools, /const hasEditRow = \(k: MakerPartKey\): boolean => \{\s*if \(rsvpOpen\) return rsvpQuietRow\(k\) !== null;\s*if \(makerPartQuietRow\(k\) !== null\) return true;[\s\S]{0,200}return readPartWords\(doc, makerPartCanvasOn\(stageKey, k\), MAKER_PARTS\[k\]\.el \?\? null, ''\)\.length > 0;/);

  /* 🖼 ONLY PARTS THE PAGE DREW ARE PARTS OF THE PAGE. Seen on the lab (2026-10-09): the plain cover draws no invite
     line and no link, both were picked all the same — the frame fell back to the whole cover, Edit was blank. */
  const lab = new Set(['f:hero', 'f:hero|eyebrow', 'f:hero|mark', 'f:hero|names', 'f:hero|joiner', 'f:hero|date', 'f:hero|venue', 'w:countdown']);
  for (const k of ['ename', 'logo', 'names', 'date', 'place', 'countdown'] as const) assert.equal(makerPartIsDrawn(k, lab), true, `${k} is drawn and is not a part`);
  for (const k of ['heroline', 'herolink'] as const) assert.equal(makerPartIsDrawn(k, lab), false, `${k}: the cover did not draw it and it is still a part of the page`);
  assert.equal(makerPartIsDrawn('schedule', lab), false, 'a scene the page did not draw is a part');
  /* A reader that lists no parts of the section is answered by the section (the other stages' readers). */
  assert.equal(makerPartIsDrawn('heroline', new Set(['f:hero'])), true);
  /* The toolbar's parts go through it (as the reply pages' always did). */
  assert.match(tools, /makerPartsWithAdded\(\{[^}]*\}\)\.filter\(\(k\) => makerPartIsDrawn\(k, present\)\);/, 'a part the page did not draw can be picked');
  assert.deepEqual(makerPartsTappable('rsvp', 'home', lab).filter((k) => !makerPartIsDrawn(k, lab)), []);
  assert.doesNotMatch(arrive, /parts\[0\]|makerPartsOnPage/, 'the arrival picks by the map’s order');
  /* It stands back for a part already picked (a tap, a return from Studio) and for a step into the page. */
  assert.match(arrive, /if \(!keeps && pendingStep\.current === null\) pickPartRef\.current\(first\);/);
  /* …and it picks the way a tap does (the one door), so the frame, the tools and the centring are the shipped ones. */
  assert.equal((arrive.match(/pickPartRef\.current\(/g) ?? []).length, 1);
  assert.match(tools, /const ordered = useCallback\(\(\) => partsInPageOrder\(parts, \(k\) => makerPartTopOnScreen\(stageKey, k, frameSel\)\), \[frameSel, parts, stageKey\]\);/);
  /* A tap on the page's ground still lets go. */
  assert.match(tools, /d\.t === 'tapOutside'\) deselectRef\.current\(\)/);
});

test('(4) the last-used tool is remembered; a part opens on it where it works, else on the first of the four that does', () => {
  let fellBack = 0;
  for (const k of KEYS) {
    for (const remembered of MAKER_PART_TOOLS) {
      const opens = makerPartToolFor(k, remembered);
      assert.equal(makerPartToolWorks(k, opens), true, `${k}: remembered ${remembered}, opens on ${opens} — a tool with nothing to set there`);
      if (makerPartToolWorks(k, remembered)) assert.equal(opens, remembered, `${k}: ${remembered} works there and was not kept`);
      else {
        assert.equal(opens, MAKER_PART_TOOLS.find((t) => makerPartToolWorks(k, t)), `${k}: not the FIRST tool that works`);
        fellBack += 1;
      }
    }
  }
  assert.ok(fellBack >= 30, `anti-vacuity: only ${fellBack} fallbacks`);
  /* Nothing picked: the remembered tool, whatever it is. */
  for (const t of MAKER_PART_TOOLS) assert.equal(makerPartToolFor(null, t), t);
  /* Worked examples: E-Gifts has no Animate → Edit; Names has → Animate stays; a scene keeps Background. */
  assert.equal(makerPartToolFor('gifts', 'animate'), 'edit');
  assert.equal(makerPartToolFor('names', 'animate'), 'animate');
  assert.equal(makerPartToolFor('names', 'bg'), 'edit');
  assert.equal(makerPartToolFor('schedule', 'bg'), 'bg');

  const tools = read(`${L}/stage-tools.tsx`);
  /* The toolbar asks that function, and shows the first working tool of its own (the Reveal, the pass, RSVP too). */
  assert.match(tools, /const toolFor = useCallback\(\(k: MakerPartKey \| null\): MakerPartTool => makerPartToolFor\(k, toolRef\.current\), \[\]\);/);
  assert.match(tools, /const shownTool: MakerPartTool = toolWorks\(tool\) \? tool : \(MAKER_PART_TOOLS\.find\(toolWorks\) \?\? 'style'\);/);
  /* REMEMBERED WHILE THE TOOLBAR IS AWAY (Studio unmounts it): kept outside the component, read when it mounts,
     written with every pick — and a fallback never writes it. */
  assert.match(tools, /\nlet lastTool: MakerPartTool = 'edit';/);
  assert.match(tools, /const \[tool, setToolNow\] = useState<MakerPartTool>\(lastTool\);\s*const setTool = useCallback\(\(t: MakerPartTool\) => \{\s*lastTool = t;\s*setToolNow\(t\);\s*\}, \[\]\);/);
  assert.equal((tools.match(/\blastTool = /g) ?? []).length, 1, 'the remembered tool is written somewhere else');
  assert.equal((tools.match(/\bsetTool\(/g) ?? []).length, 1, 'the tool is set by something other than a tap on the selector');
  const pick = tools.slice(tools.indexOf('const pickTool = (t: MakerPartTool) => {'), tools.indexOf('const away = typing || playing;'));
  assert.match(pick, /if \(!toolWorks\(t\)\) return setWhy\([^;]*;\s*setTool\(t\);/, 'a grey tool is remembered');
});

test('(5) the Camera has only Style: Edit, Background and Animate are grey on it, each tap says why, and it opens on Style', () => {
  assert.equal(makerPartToolWorks('camera', 'style'), true);
  for (const t of ['edit', 'bg', 'animate'] as const) {
    assert.equal(makerPartToolWorks('camera', t), false, `the Camera's ${t} is live`);
    assert.match(makerPartToolWhy('camera', t), /^(Edit|Background|Animate) has nothing to change on this part\.$/);
  }
  for (const t of MAKER_PART_TOOLS) assert.equal(makerPartToolFor('camera', t), 'style');
  /* Only the Camera: every other part keeps its Edit (its door or its name, and its place). */
  for (const k of KEYS) if (k !== 'camera') assert.equal(makerPartToolWorks(k, 'edit'), true, `${k} lost Edit`);
  /* No move row: Edit's rows are never drawn for it (they are Edit's, and Edit is grey), and its frame has no place. */
  const tools = read(`${L}/stage-tools.tsx`);
  assert.match(tools, /const editOn = picked !== null && shownTool === 'edit';/);
  assert.match(tools, /picked: open && !cameraOpen \? picked : null,/);
  assert.match(tools, /\{open && cameraOpen && !editOn \? <CameraPartTools \/> : null\}/);
});

test('(3b) a page change never ends on nothing: the held part is replaced when it is not this page’s; a tab tap never lets go first', () => {
  /* Seen on the review copy, 2026-10-09 (375 × 812, touch): a tap on "Details" let the picked part go, the lab's
     sample — drawn as ONE page — refused the switch, and the toolbar was left on Welcome with nothing picked and
     every tool an empty box. The tap itself reached the tab (its click ran); nothing was eaten by the swipe. */
  const parts = ['countdown', 'schedule', 'venue'] as const;
  /* WHAT IS KEPT ON ARRIVING — executed. Nothing held: nothing to keep (the first part is picked). */
  assert.equal(makerArrivalKeeps({ held: null, parts, newStage: false, canvasSaidThePage: true }), false);
  /* A part of THIS page (just tapped; the one Studio came back to): kept. */
  assert.equal(makerArrivalKeeps({ held: 'schedule', parts, newStage: false, canvasSaidThePage: true }), true);
  /* A part the canvas's own tab switch left on a hidden page: replaced. */
  assert.equal(makerArrivalKeeps({ held: 'names', parts, newStage: false, canvasSaidThePage: true }), false, 'a part of the page before is kept on the new page');
  /* ANOTHER STAGE — even when both stages have a part of that name (the work area lets it go a moment later). */
  assert.equal(makerArrivalKeeps({ held: 'countdown', parts, newStage: true, canvasSaidThePage: true }), false, 'a part held across a stage change leaves the toolbar on nothing');
  assert.equal(makerArrivalKeeps({ held: 'countdown', parts, newStage: true, canvasSaidThePage: false }), false);
  /* A canvas drawn as one page: the page FOLLOWS what is picked and scrolled — a held part is never replaced by a scroll. */
  assert.equal(makerArrivalKeeps({ held: 'names', parts, newStage: false, canvasSaidThePage: false }), true, 'scrolling a one-page canvas would swap the picked part');

  const tools = read(`${L}/stage-tools.tsx`);
  /* The arrival asks that rule, with the stage it came from and whether the canvas said the page. */
  assert.match(tools, /const keeps = makerArrivalKeeps\(\{\s*held: pickedRef\.current,\s*parts: partsRef\.current,\s*newStage: was\.stage !== null && was\.stage !== stageKey,\s*canvasSaidThePage: tabRef\.current\?\.stage === stage \|\| rsvpOpenRef\.current,\s*\}\);/);
  /* (First mount — back from Studio — is not "another stage": the part Studio came back to is this page's and is kept.) */
  assert.match(tools, /const arrived = useRef<\{ stage: MakerStageKey \| null; at: string \| null \}>\(\{ stage: null, at: null \}\);/);

  /* THE TAB TAP: it asks the canvas for the page and lets go of NOTHING. */
  const bar = tools.slice(tools.indexOf('data-stage-guest-tab={p.key}'), tools.indexOf('className={STAGE_GUEST_TAB}'));
  const other = bar.slice(bar.indexOf('} else {'));
  assert.ok(other.length > 60, 'anti-vacuity: the tab’s handler was not found');
  assert.match(other, /goToPage\(p\.key, p\.option\);\s*askPage\(p\.key\);/);
  assert.doesNotMatch(other, /deselect\(\)/, 'a tab tap lets the picked part go before the page has changed — a canvas that does not switch leaves nothing picked');
  /* The part is let go when the canvas HAS switched its tab and the part is not on the new page — at once. */
  assert.match(tools, /if \(tab && held && !partsRef\.current\.includes\(held\) && pendingStep\.current === null\) deselectRef\.current\(\);\s*\}, \[canvasTab, stage\]\);/);
  /* A canvas that did not switch: shortly after, that page's first part Edit has a row for is picked where it is drawn. */
  const ask = tools.slice(tools.indexOf('const askPage = useCallback((key: string) => {'), tools.indexOf('}, STAGE_PAGE_ASK_MS);'));
  assert.ok(ask.length > 200, 'anti-vacuity: the page ask was not found');
  assert.match(ask, /if \(where\.current\.shownPage === key\) return;/, 'the fallback also picks when the canvas DID switch (the arrival already does)');
  assert.match(ask, /const on = tappableOnRef\.current\(key\);\s*const first = makerArrivalPart\(partsInPageOrder\(on, [^;]*\), hasEditRowRef\.current\);\s*if \(first && pendingStep\.current === null\) pickPartRef\.current\(first\);/);
  assert.match(tools, /const STAGE_PAGE_ASK_MS = (\d+);/);
  const ms = Number(/const STAGE_PAGE_ASK_MS = (\d+);/.exec(tools)?.[1]);
  assert.ok(ms >= 300 && ms <= 800, `the canvas is given ${ms} ms to switch — too short to be heard, or too long to be left on nothing`);
  /* The reply pages (their three screens are this toolbar's own state) still let go and arrive on the screen picked. */
  assert.match(bar, /if \(rsvpOpen\) \{[\s\S]{0,260}deselect\(\);\s*goToScreen\(p\.key as RsvpStageScene\);/);
});
