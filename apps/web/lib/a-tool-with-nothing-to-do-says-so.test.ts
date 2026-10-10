/**
 * a-tool-with-nothing-to-do-says-so.test.ts — EDIT | STYLE | BACKGROUND | ANIMATE: A TOOL WITH NOTHING TO SET ON THE
 * PICKED PART IS GREY AND ANSWERS A TAP WITH ONE LINE — NEVER A DEAD TAP, NEVER A PILL THAT SLIDES OVER THE WRONG PANEL.
 *
 * 🔁 RE-AIMED 2026-10-09 (owner: *"so it is just Edit | Style | Background | Animate"*, `TOOLBAR-SPEC-2026-10-09.md`):
 * the selector was Style | Text | Animate. Text is gone (its Font left the toolbar, its Colour and Size are Style's),
 * Edit and Background are new. The RULE this file holds is unchanged — only which tools it walks: Edit and Style
 * always work; Background works where there is a background to save today (a scene); Animate where it always did.
 * A part with nothing for the remembered tool now opens on EDIT, the first tool (it was Style, then the first).
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
import { MAKER_PARTS, MAKER_PARTS_NO_LOOK, MAKER_PART_TOOLS, makerPartSource, makerPartToolWhy, makerPartToolWorks, type MakerPartKey } from './maker-parts';
import { STAGE_TOOL_BUTTON } from './maker-stage-room';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';
const KEYS = Object.keys(MAKER_PARTS) as MakerPartKey[];

test('(1) Edit and Style always work; Animate works exactly where there is a save — a part with words of its own, or a scene; Background on a scene', () => {
  assert.ok(KEYS.length >= 40, `anti-vacuity: only ${KEYS.length} parts read`);
  const yes: MakerPartKey[] = [];
  const no: MakerPartKey[] = [];
  for (const k of KEYS) {
    /* (Re-aimed 2026-10-10: Style on every part BUT one with no look to pick at all — The Day's "Happening now" card,
       where Style slid over four empty rows on the lab. Listed, and the list is held to that one part below.) */
    assert.equal(makerPartToolWorks(k, 'style'), !MAKER_PARTS_NO_LOOK.includes(k), `${k}: Style`);
    /* (The Camera is a full-screen design with ONLY Style live — owner 2026-10-09: its Edit is grey too.) */
    assert.equal(makerPartToolWorks(k, 'edit'), k !== 'camera', `${k}: Edit`);
    const def = MAKER_PARTS[k];
    const want = Boolean(def.canvas) && (Boolean(def.el) || (def.canvas ?? '').startsWith('w:'));
    assert.equal(makerPartToolWorks(k, 'animate'), want, `${k} · animate`);
    /* Background: only what the work area can save today — a scene's (`sceneTabs.background`); a fixed row hands `null`. */
    assert.equal(makerPartToolWorks(k, 'bg'), (def.canvas ?? '').startsWith('w:'), `${k} · bg`);
    (want ? yes : no).push(k);
  }
  /* TAPPED on the lab — dead (the pill slid, the panel did not change), or greyed and silent. */
  for (const k of ['gifts', 'mywear', 'reveal'] as const) assert.ok(no.includes(k), `${k}: Animate was dead on the lab and is still offered`);
  /* The same shape, not on the lab's page: fixed parts with no words of their own, the pass, the camera, Post Event's. */
  for (const k of ['march', 'details', 'seats', 'pass', 'camera', 'rsvp', 'greeting', 'announce', 'numbers', 'wishes'] as const) assert.ok(no.includes(k), `${k} is offered a tool with no save`);
  /* TAPPED on the lab — working: the cover's parts and the scenes. */
  for (const k of ['logo', 'ename', 'names', 'heroline', 'date', 'place', 'herolink', 'countdown', 'message', 'schedule', 'venue', 'dress', 'story'] as const) {
    assert.ok(yes.includes(k), `${k}: Animate worked on the lab and is now greyed`);
  }
  assert.ok(yes.length >= 12 && no.length >= 12, `anti-vacuity: ${yes.length} yes · ${no.length} no`);
  assert.deepEqual([...MAKER_PARTS_NO_LOOK], ['spotlight', 'beforeafter', 'song', 'next', 'wall', 'you'], 'a part lost its Style — only a part with no look at all may');
});

test('(2) the predicate is the work area’s own rule: a part’s sheet needs `canvas && el`; a scene’s heading and motion need a scene', () => {
  const tools = read(`${L}/stage-tools.tsx`);
  /* (Re-aimed: the toolbar's tool is turned into the work area's word first — `makerWorkTool`: Animate is the part's
     own, Edit · Style · Background are the scene's Format — and the door reads that word.) */
  assert.match(tools, /const work = makerWorkTool\(t\);\s*if \(work !== 'style' && def\?\.canvas && def\.el && !rsvpOpenRef\.current\) \{/, 'the part-sheet door changed — re-derive `makerPartToolWorks`');
  assert.match(tools, /new CustomEvent\(MAKER_STAGE_TOOL_EVENT, \{ detail: work \}\)/, 'the work area is asked in a word it does not know');
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
      /* A line of the cover under Background says whose background it sits on (the prototype's own words) — before
         where its content is changed: the Logo is Studio's AND a line of the cover. */
      const coverLine = Boolean(k) && t === 'bg' && MAKER_PARTS[k!].canvas === 'f:hero' && Boolean(MAKER_PARTS[k!].el);
      if (coverLine) assert.equal(line, 'This sits on the cover’s background.', `${k}: a line of the cover does not say whose background it is`);
      else if (k && makerPartSource(k).kind === 'studio') assert.equal(line, 'Nothing to change here — edit it in Studio.', `${k}: its content is Studio’s and the line does not say so`);
    }
  }
  assert.equal(makerPartToolWhy('gifts', 'animate'), 'Nothing to change here — edit it in Studio.');
  assert.equal(makerPartToolWhy('gifts', 'bg'), 'Nothing to change here — edit it in Studio.');
  assert.equal(makerPartToolWhy('reveal', 'bg'), 'Background has nothing to change on this part.');
  assert.equal(makerPartToolWhy('reveal', 'animate'), 'Animate has nothing to change on this part.');
  assert.equal(makerPartToolWhy('pass', 'animate'), 'Animate has nothing to change on this part.');
  assert.equal(makerPartToolWhy('names', 'bg'), 'This sits on the cover’s background.');
});

test('(4) the pill: grey and `aria-disabled` (never `disabled`), never pressed with nothing to set, its tap says the line; such a part opens on Edit', () => {
  const tools = read(`${L}/stage-tools.tsx`);
  const group = tools.slice(tools.indexOf('data-stage-tpill=""'), tools.indexOf('data-stage-play=""'));
  assert.ok(group.length > 300, 'anti-vacuity: the tool group was not found');
  assert.match(group, /aria-disabled=\{toolWorks\(t\) \? undefined : true\}/, 'a tool with nothing to set is not marked');
  assert.doesNotMatch(group, /(?<![-\w])disabled=\{/, 'a tool is `disabled` — its tap is dead and silent');
  /* (Re-aimed: the toolbar is one height and always up, so the thumb always rests on a tool — the one whose rows are
     on screen, `shownTool`, which is never a tool with nothing to set here.) */
  assert.match(group, /aria-pressed=\{shownTool === t\}/, 'a pill can be pressed over another tool’s panel');
  assert.match(group, /onClick=\{\(\) => pickTool\(t\)\}/);
  /* Grey by the same class a disabled pill wore. */
  assert.ok(STAGE_TOOL_BUTTON.split(' ').includes('aria-disabled:opacity-40'), 'an inactive tool is not grey');
  assert.ok(!STAGE_TOOL_BUTTON.split(' ').some((c) => c.startsWith('disabled:')), 'the pill still styles a state it never has');
  /* What works: anything while nothing is picked (the tool is remembered for the next part); Edit and Style on every
     part; else the part's own answer — and none of it on the Style-only parts (the Reveal, the Camera, the pass, RSVP). */
  /* 🔁 RE-AIMED 2026-10-10: a reply screen's CARD and its LINES now have a Background and an Animate to set (owner
     2026-10-09: "how come background not fixed and no animate?" — `the-rsvp-lines-have-a-look.test.ts` §10), so those
     two are live there (`rsvpLooks`). Every other part is decided exactly as before — the claim this line holds. */
  /* 🔁 RE-AIMED AGAIN 2026-10-10: the tools a picked thing has a save for BEYOND the part rule are now one named
     function, `ownTool` (a reply card or line: Background · Animate; a fixed block with one real root: Background · Animate —
     `a-fixed-block-has-its-own-motion.test.ts` §5). The part rule itself is decided exactly as before. */
  /* 🔁 RE-AIMED 2026-10-10 (toolbar consistency — owner: "please make Edit | Style | Background | Animate Consistent in
     design"): the part rule is as it was, and one clause is added to it — a tool whose rows would be EMPTY on the
     picked thing is grey too (`emptyHere`: on the reply pages Style has a row only for a line with a look and for the
     When-yes card). The claim this pin holds — a live tool is one with something to set — is the same, and stricter. */
  assert.match(tools, /const toolWorks = \(t: MakerPartTool\) => !picked \|\| ownTool\(t\) \|\| \(\(t === 'edit' \|\| t === 'style' \|\| !styleOnly\) && makerPartToolWorks\(picked, t\) && !emptyHere\(t\)\);/);
  /* …and the rows show the FIRST tool that has something here (Edit; Style on the Camera) — never a grey one. */
  assert.match(tools, /const shownTool: MakerPartTool = toolWorks\(tool\) \? tool : \(MAKER_PART_TOOLS\.find\(toolWorks\) \?\? 'style'\);/);
  /* The tap: the line FIRST and nothing else — no tool is set, no panel is asked for. */
  /* 🔁 RE-AIMED 2026-10-10: the line a grey tool answers with is now worked out by `whyNot` — the part's own line
     (`makerPartToolWhy`, still the default and the last word), unless the part is a SAMPLE on the canvas or E-Gifts
     with nothing for a guest to see, which say that instead (`a-fixed-block-has-its-own-motion.test.ts` §5). The
     claim is unchanged: a tap on a grey tool says ONE plain line and sets nothing. */
  assert.match(tools, /const pickTool = \(t: MakerPartTool\) => \{\s*if \(!toolWorks\(t\)\) return setWhy\(\(w\) => \(\{ words: whyNot\(t\), n: \(w\?\.n \?\? 0\) \+ 1 \}\)\);\s*setTool\(t\);/);
  assert.match(tools, /return sample \?\? empty \?\? makerPartToolWhy\(picked, t\);/, 'the part’s own line is no longer the default');
  assert.match(tools, /<PeekToast key=\{why\.n\} tone="note" data="tool-why" onGone=\{\(\) => setWhy\(\(w\) => \(w\?\.n === why\.n \? null : w\)\)\}>\s*\{why\.words\}\s*<\/PeekToast>/, 'the line is not said through the app’s toast');
  /* Picking a part (a tap on the page) opens the tool that HAS something there. */
  assert.match(tools, /const toolFor = useCallback\(\(k: MakerPartKey \| null\): MakerPartTool => makerPartToolFor\(k, toolRef\.current\), \[\]\);/);
  assert.equal((tools.match(/askTool\(toolFor\(k\), k\);/g) ?? []).length, 2, 'a pick can still ask the work area for a tool it has no panel for');
  assert.doesNotMatch(tools, /askTool\(toolRef\.current, k\)/);
});

test('(5) a pick asks for its tool only ONCE THE WORK AREA HAS THE PICK — never two frames after posting it', () => {
  /* Measured on the Maker lab, 2026-10-09 (a tile → Names, Style remembered): the tool was asked for at 487 ms, the
     pick's own message arrived at 488 ms — so the work area closed nothing, then opened the part's sheet on Text
     under a pressed Style pill. Names and Logo, every time. */
  const tools = read(`${L}/stage-tools.tsx`);
  const pick = tools.slice(tools.indexOf('const pickPart = useCallback('), tools.indexOf('const pickPartRef = useRef(pickPart);'));
  assert.ok(pick.length > 300, 'anti-vacuity: `pickPart` was not found');
  /* The pick is posted as the canvas's own message, carrying which part this panel picked… */
  assert.match(pick, /window\.postMessage\(\{ source: 'setnayan-site', t: 'edit', key: def\.canvas, \.\.\.\(def\.el \? \{ el: def\.el \} : \{\}\), stagePick: k \}, window\.location\.origin\);/);
  /* …and `pickPart` itself asks for NO tool on that path (the Reveal, the Camera and the RSVP pages have no work-area tool to ask for). */
  assert.doesNotMatch(pick, /askTool\(/, 'the tool is asked for before the work area has heard the pick');
  /* The ask is made when this panel hears its OWN message back — the task in which the work area hears it too. */
  const heard = tools.slice(tools.indexOf('const onCanvas = (e: MessageEvent) => {'), tools.indexOf("if (d.t === 'edit' && typeof d.key === 'string') {"));
  assert.match(
    heard,
    /if \(e\.source === window\) \{\s*if \(d\.t === 'edit' && typeof d\.stagePick === 'string' && d\.stagePick in MAKER_PARTS\) \{\s*const k = d\.stagePick as MakerPartKey;\s*askTool\(toolFor\(k\), k\);\s*\}\s*return;\s*\}/,
    'the panel does not ask for the tool when its own pick comes back',
  );
  /* A message that is not this panel's own pick (the work area's, a stray one) asks for nothing. */
  assert.match(heard, /if \(d\?\.source !== 'setnayan-site'\) return;/);
  /* The work area reads the same message it always did: `t`, `key`, `el` — the extra field changes none of them. */
  const shell = read(`${E}/editor-shell.tsx`);
  assert.doesNotMatch(shell, /stagePick/, 'the work area started reading the panel’s own mark');
});

test('(6) …AND A TOOL WHOSE ROWS WOULD BE EMPTY ON THIS STAGE IS GREY TOO — Style where the part has no look to choose here', async () => {
  /* 🧨 SEEN ON THE REVIEW COPY, 2026-10-10 (owner: "please make Edit | Style | Background | Animate Consistent in
     design"): Save the Date › E-Gifts › Style and RSVP › Names › Style were LIVE over four empty rows. The part rule
     above cannot see either — whether a part has looks depends on the STAGE, and the reply pages' tools are their own.
     Both are one clause of the toolbar's rule now (`emptyHere`), each asking the function that DRAWS the rows:
       · a fixed part whose Style is its scene's looks — `sceneStyleOptions`, the row's own "is there a choice?";
       · the reply pages — `rsvpStyleHasRows`, held to the real panel in `the-rsvp-tools-stand-in-the-four-rows.test.ts`.
     Sabotage: E-Gifts' looks asked of the Invitation whatever the stage → red; the clause dropped from `toolWorks` → red. */
  const { PART_LOOKS_ONLY, partStyleIsEmptyOn } = await import(`../${L}/stage-panel/part-look`);
  const { sceneStyleOptions, sceneStylesOn } = await import('./scene-styles');
  const { HUB_STAGES } = await import('./hub-canvas');
  const { FIXED_STYLE_SCENES } = await import('./fixed-scene-styles');
  /* EXECUTED over every such part and every stage: grey exactly where the row has no choice to draw. */
  const hosts = Object.entries(PART_LOOKS_ONLY as Record<string, string>);
  assert.deepEqual(hosts.map(([k]) => k).sort(), ['f:gifts', 'f:look', ...FIXED_STYLE_SCENES.map((x: string) => `f:${x}`)].sort(), 'the parts whose Style is only their looks changed — re-read `fixedStylePanel`');
  const grey: string[] = [];
  for (const [canvas, type] of hosts) {
    for (const stage of HUB_STAGES) {
      const choice = sceneStyleOptions(type, stage).length >= 2;
      assert.equal(partStyleIsEmptyOn(stage, canvas), !choice, `${canvas} on ${stage}: Style is ${choice ? 'grey with looks to choose' : 'live with none'}`);
      /* Never grey where an event type could still draw the row: asked without one, the list is the longest. */
      for (const eventType of ['wedding', 'birthday', 'corporate']) assert.ok(sceneStylesOn(type, stage, eventType).length <= sceneStylesOn(type, stage).length);
      if (!choice) grey.push(`${canvas}@${stage}`);
    }
  }
  /* THE ONE SEEN: E-Gifts has its looks on the Invitation and none on Save the Date. */
  assert.ok(grey.includes('f:gifts@save_the_date'), 'E-Gifts on Save the Date still offers a Style with nothing in it');
  assert.equal(partStyleIsEmptyOn('rsvp', 'f:gifts'), false, 'E-Gifts lost its Style on the Invitation, where it has four looks');
  /* A part that is not one of these is never greyed by this clause (the cover's lines have Colour · Size; a scene has its own pane). */
  for (const canvas of ['f:hero', 'w:schedule', 'w:countdown', 'p:cover', null]) for (const stage of HUB_STAGES) assert.equal(partStyleIsEmptyOn(stage, canvas), false, `${canvas} on ${stage}`);
  /* …and they ARE the sections whose Style is that one row: the work area's own branch, still the only ones. */
  const shell = read(`${E}/editor-shell.tsx`);
  assert.match(shell, /if \(maker\?\.stagesStudio && \(fixed === 'hero' \|\| fixed === 'gifts' \|\| fixed === 'look'\)\) \{\s*return \(\s*<FixedSceneStyleRow /, 'the part-look hosts changed — re-read this guard');
  assert.match(shell, /if \(!fixed \|\| !isFixedStyleScene\(fixed\)\) return null;\s*return \(\s*<FixedSceneStyleRow/);
  assert.match(read(`${E}/fixed-scene-style-row.tsx`), /const options = sceneStyleOptions\(scene, stage, eventType\);\s*if \(options\.length < 2\) return null;/, 'the row draws on some other test than "is there a choice?"');
  assert.match(read(`${E}/fixed-scene-style-row.tsx`), /if \(host === 'gifts'\) return \{ scene: 'gifts', el: null \};\s*if \(host === 'look'\) return \{ scene: 'my_wear', el: null \};/);
  /* WIRING — one clause of the toolbar's own rule, and the tool's own line when tapped. */
  const tools = read(`${L}/stage-tools.tsx`);
  assert.match(tools, /const emptyHere = \(t: MakerPartTool\) => t === 'style' && \(rsvpOpen \? !rsvpStyleHasRows\(picked, rsvpLine\) : partStyleIsEmptyOn\(stage, picked \? makerPartCanvasOn\(stageKey, picked\) : null\)\);/);
  assert.match(tools, /makerPartToolWorks\(picked, t\) && !emptyHere\(t\)\);/);
  assert.match(tools, /if \(emptyHere\(t\)\) return makerPartToolWhy\(null, t\);/);
  assert.equal(makerPartToolWhy(null, 'style'), 'Style has nothing to change on this part.');
});
