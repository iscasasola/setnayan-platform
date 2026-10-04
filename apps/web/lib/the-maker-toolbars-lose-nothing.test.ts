/**
 * the-maker-toolbars-lose-nothing.test.ts — THE "TODAY → NEW" STRIP, HELD.
 *
 * The approved prototype (`prototypes/maker_toolbars_keynote_pages_2026-09-27
 * .html`, owner: *"1. okay 2. okay 3. -+ only. 4. fold it 5. both 6. this
 * stage 7. yes."*) rearranged every Maker toolbar after Keynote and Pages, and
 * its last section — "Today → New: every control we ship today, and where it
 * goes" — is the promise that NOTHING IS LOST. This file is that strip as a
 * test: every control that shipped before the rebuild is named here with its
 * new home, and the home must still carry it. Delete a control from its new
 * home and this goes red with the strip's own words.
 *
 * It also holds the structural answers:
 *   · Format · Animate · Arrange live ONLY as the inspector's tabs — never in
 *     the top bar (owner: *"repeated. just place it on the sidebar"*);
 *   · the scene inspector is Format · Animate · Arrange · Content, with the
 *     Transition tab folded into Animate (answer 4);
 *   · the part inspector is Text · Animate · Arrange;
 *   · the question's buttons never say "Apply" (that word is the publish button);
 *   · Dawn is not a per-scene background (answer 1);
 *   · Size is − / + only — no S · M · L · XL and no number (answer 3);
 *   · the Colour panel is ONE panel: a pop-over from `lg`, a sheet section
 *     below it (answer 7).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const EDITOR = 'app/dashboard/[eventId]/website/editor/_components';
const LAUNCH = 'app/dashboard/[eventId]/launch/_components';
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const HOME = {
  topBar: `${LAUNCH}/maker-shell.tsx`,
  play: `${LAUNCH}/maker-play-menu.tsx`,
  pageMenu: `${LAUNCH}/maker-bar.ts`,
  draftBar: 'app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx',
  background: `${EDITOR}/scene-background-row.tsx`,
  colour: `${EDITOR}/colour-well.tsx`,
  scene: `${EDITOR}/scene-inspector.tsx`,
  part: `${EDITOR}/part-inspector.tsx`,
  sheet: `${EDITOR}/element-sheet.tsx`,
  shell: `${EDITOR}/editor-shell.tsx`,
} as const;

/** [today's control, its new home, what the home must still say]. */
const STRIP: ReadonlyArray<readonly [string, keyof typeof HOME, readonly string[]]> = [
  // ── Top toolbar (maker-shell.tsx) ──
  // ✂ THE MAKER IN 4 (2026-10-02, design `maker_in_four_2026-09-30_fable.html`,
  // "What moved where — nothing is lost"): the bar is Exit · Page ▾ · Look ·
  // Details · Undo · Phone · Apply · ⋯, and every other control below is a row
  // of ⋯ — each still has its home, re-pointed here, not dropped.
  // → 2026-10-04 (PR-0, owner: ⋯ → 👁 Preview; "apply icon · undo icon · exit
  // icon"): ⋯'s rows moved to 👁 Preview (how the page is seen) and Page ▾ (the
  // rest, `makerPageActions`) — re-pointed again, still not dropped.
  ['✕ Exit (now ‹, a 44 px icon)', 'topBar', ['data-maker-tool="exit"', 'aria-label="Exit"']],
  ['▤ Show / hide the scenes (👁 Preview › Scenes)', 'topBar', ['data-maker-tool-row="scenes"', '>Scenes<', 'setNavOpen((o) => !o)']],
  ['▶ Play this scene · Preview the whole stage (👁 Preview)', 'topBar', ['Play this scene', 'MAKER_PLAY_SCENE_EVENT', '<PreviewStageLink']],
  ['…the Preview link itself', 'play', ['Preview the whole']],
  // 2026-09-28 — the ＋ WORKS (DECISION_LOG 2026-09-27 "+ ADD A SCENE"): drawn from
  // the work area's registration ON A STAGE only (owner: *"it should only show on stages."*).
  ['＋ Add a scene (Page ▾, end of the stage)', 'topBar', ["stageAdd?.kind === 'ready'", 'stageAdd.open()', 'makerAddShowsOn(selection) ? addScene : null']],
  ['…its row', 'pageMenu', ["label: '＋ Add a scene'"]],
  ['Stage row + "● Invitation ▾" → Page ▾ (the stages and their pages, one picker)', 'topBar', ['label="Page"', 'makerPageMenu({', 'onPick={pickPage}']],
  // View ▾ (Desktop · Phone · Both) → 👁 Preview's Phone / Desktop row + its Both row (1024 px and wider).
  ['Desktop · Phone · Both', 'topBar', ['data-maker-tool-row="view"', 'makerViewToggle(shownDevice)', "o.key === 'both'"]],
  // ⊞ "Snap grid" was a switched-off row carrying only a note (`MAKER_SNAP_NOTE`) —
  // no control. It went with the bar's other explainers (2026-10-02, "no explainer captions").
  ['ⓘ About the Maker (Page ▾ › Your Event Hub)', 'topBar', ["act === 'about'", 'setTour(true)']],
  ['…its row', 'pageMenu', ["label: 'About the Maker'"]],
  ['address, who can view (Page ▾ › Your Event Hub)', 'topBar', ['setMoreOpen(true)']],
  ['…their rows', 'pageMenu', ["label: 'Your Event Hub address'", "label: 'Who can view'"]],
  // 2026-10-04 PR-10: the role chips became See as ▾ — a SAMPLE guest drawn on the
  // canvas (hasn't replied · Replied Yes · Declined · Signed out); desktop: above the preview.
  ['View as (Guest · Supplier) — 👁 Preview › See as', 'topBar', ['<MenuHeading>See as</MenuHeading>', 'setSeeAs(s.key)']],
  ['Reset this stage… (Page ▾, end of the stage)', 'topBar', ["act === 'reset'", 'MAKER_OPEN_RESET_EVENT']],
  ['…its row', 'pageMenu', ["label: 'Reset this stage…'"]],
  ['Reset this stage… (the confirm)', 'draftBar', ['MAKER_OPEN_RESET_EVENT', "intent: 'reset'"]],
  ['Undo · Apply (the slot)', 'topBar', ['{applySlot}']],
  ['Undo · Apply (the buttons)', 'draftBar', ['label="Undo"', "intent: 'apply'", '{maker?.previewMenu ?? null}']],
  ['↺ Restore (Page ▾ › Restore, the draft bar\'s own act)', 'topBar', ['draft.restore()', "act === 'restore'"]],
  ['…its row', 'pageMenu', ["label: 'Restore what guests see'"]],
  ['↺ Restore (the act, registered)', 'draftBar', ["intent: 'restore'", 'setDraftDoor({\n      canRestore,']],
  ['Details (now "Event Details") and Prints (Page ▾) — doors into the one Details page', 'topBar', ['MAKER_DETAILS_LABEL', "pressDoor('prints')"]],
  ['…Prints\' row', 'pageMenu', ['label: MAKER_PRINTS_LABEL']],
  ['Look — the Look part of Details', 'topBar', ['MAKER_LOOK_LABEL', 'pressDoor(door)']],
  // ── Scene inspector ──
  ['Background: No background · Full colour · Opaque glass · Frosted glass · Photo · Snippet', 'background', ["'No background'", "'Plain'", "'Opaque'", "'Frosted'", "'Upload media'", "kind: 'snippet'"]],
  ['Colour picked in a row below the chips', 'background', ['<ColourWell']],
  ['Framed / Full width', 'background', ['HUB_SCENE_SHAPES', 'label="Shape"']],
  ['Photo: which photo, what to keep in frame, how close', 'background', ['photoChoices.map', 'HUB_FOCAL_POINTS', 'HUB_ZOOMS']],
  ['A free couple may take a photo off', 'background', ['Remove this scene’s photo']],
  ['Auto · Shown · Hidden (the mode chips) / the eye', 'scene', ["'shown', 'auto', 'hidden'", 'onEye']],
  ['Move up / Move down', 'scene', ['Move up', 'Move down']],
  ['How it moves — Auto · Still · Calm · Editorial · Cinematic', 'scene', ['HUB_MOTION_PRESETS', 'How it moves']],
  // 🎛 2026-10-04: Comes in / From and Goes out / Toward became the four effects (Fade · Move ▾ arrow grid · Size · Blur), each end with its own Auto.
  ['Timing · Comes in · Goes out (four effects each, Move from 8 directions) · Parts', 'scene', ['label="Timing"', '<ISection>Comes in</ISection>', '<MotionFxRows end="in"', '<ISection>Goes out</ISection>', '<MotionFxRows end="out"', 'Back to Auto', 'label="Parts"']],
  ['Into the next section — Scroll · Scrub · Auto-scroll + Speed', 'scene', ['Into the next scene', 'HUB_TRANSITIONS', 'HUB_AUTO_SPEEDS']],
  ['Reset how it moves (free)', 'scene', ['Reset how it moves']],
  ['Layout (a scene of their own)', 'scene', ['HUB_ARRANGEMENTS', 'label="Layout"']],
  ['Style a part: Label · Heading · Words', 'scene', ['data-maker-element={k}', 'Open the Hero editor']],
  // ── Part sheet (element-sheet.tsx → part-inspector.tsx) ──
  ['Font ▾ (Event Hub font, then the one font dropdown’s shelves)', 'part', ['lead="Event Hub font"', '<FontPick']],
  ['Colour swatches + "+" + "Hard to read here"', 'part', ['<ColourWell', 'Hard to read here']],
  ['Size: S · M · L · XL', 'part', ['label="Size"', 'stepHubElementSize']],
  // 🎛 2026-10-04: In / Out are four effects + Speed (was Duration), in the order a guest sees it.
  ['Motion: Comes in (Fade · Move · Size · Blur · Speed · Delay) · During · Goes out · When it plays', 'part', ['<MotionFxRows end="in"', '<MotionSpeedRow', 'HUB_EL_DELAY', 'HUB_EL_DURING_WORDS', '<MotionFxRows end="out"', 'HUB_EL_TIMELINE']],
  ['▶ Play', 'part', ['Preview']],
  ['Resets: font · colour · motion · element', 'part', ['Use the Event Hub style', 'Move with the scene']],
  ['Saved + theme colours', 'colour', ['Theme colours', 'Saved colours', 'Save the current colour']],
  // 💎 2026-09-28: the Pro mark moved off the title onto the only Pro rows.
  ['Title: the part’s name', 'sheet', ['<PartPicker', 'HUB_ELEMENT_LABEL[target.el]']],
  ['The Pro mark on Font ▾ and on Animate', 'part', ['fontMark ?', 'data-part-animate-pro']],
  ['…drawn by the sheet, which reads ownsPro', 'sheet', ['fontMark={fontMark}', 'proMark={animateMark}', '<PaidMark']],
  ['"Whole part / this selection" (a run of letters)', 'sheet', ['data-element-range', 'Whole {HUB_ELEMENT_LABEL', 'Clear this selection']],
  // ▣ 2026-10-04 ("segmented control"): the sheet's sections are one segmented control, Text · Motion · Arrange.
  ['The sheet’s sections — Text · Motion · Arrange', 'sheet', ['PART_TABS', 'data-element-sections', '<ISeg key={t.key} tone="wine"', '<PartTextTab', '<PartAnimateTab', '<PartArrangeTab']],
  // ── The wiring: every tab is mounted in the Maker, and #6048's words stay ──
  ['Scene tabs mounted: Format · Animate · Arrange · Content', 'shell', ['<InspectorTabs tabs={tabs}', '<SceneBackgroundRow', '<SceneAnimateTab', '<SceneArrangeTab', '<SceneLayoutRow', '<SceneParts']],
  ['Transition folded into Animate (an old address opens Animate)', 'shell', ["asked === 'transition' ? 'animate' : asked", "tab: 'animate' })"]],
  ['#6048: the Content box + "Change it everywhere / Just this scene" + the Details chip', 'shell', ['<DetailsBoundField', 'contentBound', 'CanvasWordsContext.Provider']],
  ['Background choices preview on the canvas before their save', 'shell', ['postToCanvas(message)']],
  ['The part sheet’s Part ▾ and the scene it is on', 'shell', ['parts={', 'onPart={', 'sceneLabel={']],
  ['⚡ Every choice on the canvas first (#6046)', 'sheet', ['onPreview?.(elementPreview(target.key, target.el, before, next))', 'onPreviewColour={previewColour}']],
];

test('every control from the "Today → New" strip still has its home', () => {
  const cache = new Map<string, string>();
  const read = (k: keyof typeof HOME) => {
    if (!cache.has(k)) cache.set(k, src(HOME[k]));
    return cache.get(k)!;
  };
  const missing: string[] = [];
  for (const [today, home, needles] of STRIP) {
    const text = read(home);
    for (const n of needles) if (!text.includes(n)) missing.push(`${today} → ${HOME[home]} lacks ${JSON.stringify(n)}`);
  }
  assert.deepEqual(missing, [], `lost in the rebuild:\n${missing.join('\n')}`);
});

test('Format · Animate · Arrange are the inspector’s tabs, never the top bar’s', async () => {
  const { SCENE_TABS } = await import(`../${EDITOR}/scene-inspector`);
  const { PART_TABS } = await import(`../${EDITOR}/part-inspector`);
  assert.deepEqual((SCENE_TABS as Array<{ label: string }>).map((t) => t.label), ['Format', 'Animate', 'Arrange', 'Content']);
  assert.deepEqual((PART_TABS as Array<{ label: string }>).map((t) => t.label), ['Text', 'Motion', 'Arrange']);
  const top = src(HOME.topBar);
  const header = top.slice(top.indexOf('data-maker-toolbar'), top.indexOf('</header>'));
  assert.ok(header.length > 200, 'found the toolbar');
  for (const word of ['Format', 'Animate', 'Arrange', 'Transition']) {
    assert.ok(!header.includes(`>${word}<`) && !header.includes(`'${word}'`), `the top bar must not carry "${word}"`);
  }
});

test('the one-or-all question says "Just this scene" / "Every scene" — never "Apply"; the chip is the owner’s wording', () => {
  const bg = src(HOME.background);
  const ask = bg.slice(bg.indexOf('data-scene-bg-ask'), bg.indexOf('data-scene-bg-scope="own"'));
  assert.match(ask, /Use this background on every scene\?/);
  assert.match(ask, />\s*Just this scene\s*</);
  assert.match(ask, />\s*Every scene\s*</);
  assert.doesNotMatch(ask, /Apply/, '"Apply" is the publish button');
  assert.match(bg, /Own background ·/);
  assert.match(bg, /Use the Event Hub’s/);
  assert.doesNotMatch(bg, /dawn/i, 'Dawn is not offered per scene (answer 1)');
});

test('size is − / + only: no S · M · L · XL, no number; the stepper stops at the bounds', async () => {
  const part = src(HOME.part);
  assert.doesNotMatch(part, /HUB_ELEMENT_SIZE_LABEL|'XL'|>XL</);
  const sizeRow = part.slice(part.indexOf('data="size"'), part.indexOf('data="size"') + 600);
  assert.doesNotMatch(sizeRow, /value=/, 'no number beside the size stepper');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PartTextTab } = await import(`../${EDITOR}/part-inspector`);
  const draw = (size: number | undefined) =>
    renderToStaticMarkup(
      React.createElement(PartTextTab, {
        el: 'names',
        face: { size },
        style: { size },
        onRange: false,
        choose: () => {},
        chooseAlign: () => {},
        resetText: () => {},
        themeColours: ['#1b1a17'],
        usedColours: [],
        shownColour: '#1b1a17',
        contrast: null,
        eventId: 'e',
      }),
    );
  const btn = (html: string, dir: 'up' | 'down') => new RegExp(`<button[^>]*aria-label="Size: ${dir === 'up' ? 'larger' : 'smaller'}"[^>]*>`).exec(html)?.[0] ?? '';
  const top = draw(145);
  assert.match(btn(top, 'up'), / disabled=""/, 'at the ceiling + is off');
  assert.doesNotMatch(btn(top, 'down'), / disabled=""/);
  const floor = draw(70);
  assert.match(btn(floor, 'down'), / disabled=""/, 'at the floor − is off');
  const mid = draw(undefined);
  assert.doesNotMatch(btn(mid, 'up'), / disabled=""/);
  assert.doesNotMatch(btn(mid, 'down'), / disabled=""/);
});

test('the Colour panel is ONE panel — a pop-over from lg, a section of the sheet below it', () => {
  const colour = src(HOME.colour);
  const panel = /data-colour-panel=""\s+className="([^"]+)"/.exec(colour)?.[1] ?? '';
  assert.ok(panel, 'found the panel');
  assert.match(panel, /\blg:absolute\b/, 'floats from lg (desktop)');
  assert.doesNotMatch(panel.replace(/lg:\S+/g, ''), /\babsolute\b|\bfixed\b/, 'in the flow below lg (the phone sheet)');
  assert.equal((colour.match(/data-colour-panel=/g) ?? []).length, 1, 'drawn once');
});
