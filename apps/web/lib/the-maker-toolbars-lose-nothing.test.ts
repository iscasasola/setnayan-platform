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
  ['✕ Exit', 'topBar', ['data-maker-tool="exit"', '>Exit<']],
  ['▤ Show / hide the scenes', 'topBar', ['data-maker-tool="scenes"', '>Scenes<']],
  ['▶ Play menu (this scene · the whole stage)', 'play', ['data-maker-tool="play"', 'Play this scene', 'Preview the whole']],
  ['＋ Add a scene (says "coming next")', 'topBar', ['tool="Add"', 'MAKER_COMING_NEXT.add']],
  ['"● Invitation ▾" — Stages + Pages in one picker', 'topBar', ['<MakerBar']],
  ['Desktop · Phone · Both', 'topBar', ['label="View"', "setDevice('desktop')", "setDevice('phone')", 'MAKER_COMING_NEXT.both']],
  ['⊞ Snap grid (a note only)', 'topBar', ['Snap grid', 'MAKER_COMING_NEXT.snap']],
  ['ⓘ About the Maker', 'topBar', ['About the Maker', "setTour('again')"]],
  ['⋯ address, who can view', 'topBar', ['Your Event Hub address', 'Who can view', 'setMoreOpen(true)']],
  ['View as (Guest · Supplier)', 'topBar', ['See it as…', 'setViewAsRole(r.role)']],
  ['Reset this stage…', 'topBar', ['Reset this stage…', 'MAKER_OPEN_RESET_EVENT']],
  ['Reset this stage… (the confirm)', 'draftBar', ['MAKER_OPEN_RESET_EVENT', "intent: 'reset'"]],
  ['Restore · Undo · Apply', 'topBar', ['{applySlot}']],
  ['Restore · Undo · Apply (the buttons)', 'draftBar', ['label="Restore"', 'label="Undo"', "intent: 'apply'"]],
  // ── Scene inspector ──
  ['Background: No background · Full colour · Opaque glass · Frosted glass · Photo · Snippet', 'background', ["'No background'", "'Plain'", "'Opaque'", "'Frosted'", "'Upload media'", "kind: 'snippet'"]],
  ['Colour picked in a row below the chips', 'background', ['<ColourWell']],
  ['Framed / Full width', 'background', ['HUB_SCENE_SHAPES', 'label="Shape"']],
  ['Photo: which photo, what to keep in frame, how close', 'background', ['photoChoices.map', 'HUB_FOCAL_POINTS', 'HUB_ZOOMS']],
  ['A free couple may take a photo off', 'background', ['Remove this scene’s photo']],
  ['Auto · Shown · Hidden (the mode chips) / the eye', 'scene', ["'shown', 'auto', 'hidden'", 'onEye']],
  ['Move up / Move down', 'scene', ['Move up', 'Move down']],
  ['How it moves — Auto · Still · Calm · Editorial · Cinematic', 'scene', ['HUB_MOTION_PRESETS', 'How it moves']],
  ['Timing · Comes in · From · Goes out · Toward · Parts', 'scene', ['label="Timing"', 'label="Comes in"', 'label="From"', 'label="Goes out"', 'label="Toward"', 'label="Parts"']],
  ['Into the next section — Scroll · Scrub · Auto-scroll + Speed', 'scene', ['Into the next scene', 'HUB_TRANSITIONS', 'HUB_AUTO_SPEEDS']],
  ['Reset how it moves (free)', 'scene', ['Reset how it moves']],
  ['Layout (a scene of their own)', 'scene', ['HUB_ARRANGEMENTS', 'label="Layout"']],
  ['Style a part: Label · Heading · Words', 'scene', ['data-maker-element={k}', 'Open the Hero editor']],
  // ── Part sheet (element-sheet.tsx → part-inspector.tsx) ──
  ['Font ▾ (Event Hub font, then every face grouped)', 'part', ["'Event Hub font'", 'HUB_ELEMENT_FONTS']],
  ['Colour swatches + "+" + "Hard to read here"', 'part', ['<ColourWell', 'Hard to read here']],
  ['Size: S · M · L · XL', 'part', ['label="Size"', 'stepHubElementSize']],
  ['Motion: Plays once / Follows the scroll · In · During · Out · Duration · Delay', 'part', ['HUB_EL_TIMELINE', 'HUB_EL_IN', 'HUB_EL_DURING_WORDS', 'HUB_EL_OUT', 'HUB_EL_DURATION', 'HUB_EL_DELAY']],
  ['▶ Play', 'part', ['Preview']],
  ['Resets: font · colour · motion · element', 'part', ['Use the Event Hub style', 'Move with the scene']],
  ['Saved + theme colours', 'colour', ['Theme colours', 'Saved colours', 'Save the current colour']],
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
  assert.deepEqual((PART_TABS as Array<{ label: string }>).map((t) => t.label), ['Text', 'Animate', 'Arrange']);
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
