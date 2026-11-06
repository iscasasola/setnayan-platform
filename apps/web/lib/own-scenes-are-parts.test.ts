/**
 * own-scenes-are-parts.test.ts — ✍ A SCENE OF THE COUPLE'S OWN CAN BE WRITTEN IN THE MAKER, EMPTY OR NOT.
 *
 * Owner, 2026-10-17, on his own Maker (cale-ice), a "Your own section" he had just added from template 20 (Photo
 * strip): its placeholder "YOUR OWN SECTION — Write this scene." over his photo, and *"i cannot edit this"*.
 * Measured in the Maker lab on his row (`lab_own=tpl20`): a tap on it named `w:custom_1`, NO part of the Stages map had
 * that canvas key, so `makerPartOfTap` and `makerPartOfCanvas` answered null — the toolbar let go of what was picked
 * and stayed on the stage, and Edit drew nothing. True of every scene of their own, written or empty. And had it been
 * picked, Edit lists only words the page draws, which a placeholder has none of; and the one write a Heading makes
 * refused any scene with no words yet. On the desktop Maker a tap on the placeholder's own name opened a font sheet.
 *
 * THE PROPERTY, for every slot (`custom_1`…`custom_6`) × every way a scene is made (no template, and each of the 25):
 *   P1 a tap on it picks a part — on every stage, whatever piece of it was tapped (the phone's map);
 *   P2 that part's Edit works and lists at least one field — its Heading and its Words — while the scene is EMPTY,
 *      read the way the toolbar reads them (`readPartWords` over the page, with the Maker's own words);
 *   P3 the first Heading of a scene with no words is one draft write, not a refusal; and it is NOT held, so the page
 *      is redrawn with it;
 *   P4 the placeholder never blocks the tap: no `pointer-events` on it, and on the desktop a tap anywhere on an
 *      empty one opens its Content (never a placeholder word's font sheet);
 *   P5 while the Heading is typed it shows on the page — the placeholder carries the scene's guest look, with a
 *      heading or words for the canvas to type into, drawn by the guest's own renderer;
 *   P6 a guest never sees an empty one (shipped rule, kept): the guest renderer draws nothing for it.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { CUSTOM_SECTION_TYPES, customSectionEditorLabel, customSectionHasContent, type CustomSectionType } from './custom-sections';
import {
  MAKER_OWN_SCENE_PARTS,
  MAKER_PARTS,
  MAKER_STAGE_KEYS,
  MAKER_STAGE_PAGES,
  makerOwnSceneType,
  makerPartOfTap,
  makerPartToolWorks,
  type MakerPartKey,
} from './maker-parts';
import { makerPartOfCanvas } from './maker-part-groups';
import { sceneTypeWrite } from './scene-type-words';
import { SCENE_TEMPLATES, SCENE_TEMPLATE_IDS } from './scene-templates';
import { tapOpensWords } from './maker-scene-words';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
(globalThis as unknown as { CSS: unknown }).CSS ??= { escape: (s: string) => s.replace(/["\\]/g, '\\$&') };

let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup;
let partWords: typeof import('../app/dashboard/[eventId]/launch/_components/stage-panel/part-words');
let empty: typeof import('../app/[slug]/_components/maker-empty-scene');
let renderCustomSection: typeof import('../app/[slug]/_components/custom-section-widget').renderCustomSection;
let NO_SCENE_FACTS: typeof import('../app/[slug]/_components/scene-template').NO_SCENE_FACTS;
before(async () => {
  ({ renderToStaticMarkup } = await import('react-dom/server'));
  partWords = await import('../app/dashboard/[eventId]/launch/_components/stage-panel/part-words');
  empty = await import('../app/[slug]/_components/maker-empty-scene');
  ({ renderCustomSection } = await import('../app/[slug]/_components/custom-section-widget'));
  ({ NO_SCENE_FACTS } = await import('../app/[slug]/_components/scene-template'));
});

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** Every way a scene of their own is made: no template, and each of the 25. */
const MADE: ReadonlyArray<{ name: string; canvas: Record<string, unknown> }> = [
  { name: 'no template', canvas: {} },
  ...SCENE_TEMPLATE_IDS.map((t) => ({ name: `template ${t}`, canvas: { template: t, preset: 'still' } })),
];
/** The pieces a tap can name on the scene — none (its space), its name, its prompt, a heading. */
const TAPPED: ReadonlyArray<string | null> = [null, 'label', 'body', 'heading'];

/**
 * The page as the toolbar reads it, for an EMPTY scene: its marker, and the placeholder after it with no field marked
 * (`markSceneWords` marks only words the page draws). Enough of a Document for `findMakerSection` + `readPartWords`.
 */
function emptyPage(key: string): Document {
  const section = { hasAttribute: () => false, querySelectorAll: () => [], querySelector: () => null };
  const marker = { nextElementSibling: section, getAttribute: (n: string) => (n === 'data-maker-section' ? key : null) };
  return { querySelector: (sel: string) => (sel === `[data-maker-section="${key}"]` ? marker : null) } as unknown as Document;
}

test('P1 — a tap on a scene of their own picks it, on every stage, whatever piece of it was tapped', () => {
  for (const type of CUSTOM_SECTION_TYPES) {
    for (const stage of MAKER_STAGE_KEYS) {
      for (const page of Object.keys(MAKER_STAGE_PAGES[stage])) {
        for (const el of TAPPED) {
          /* The toolbar's own reading of a tap (`stage-tools.tsx`): the page's part, else the stage's part for the key. */
          const k = makerPartOfTap(stage, page, `w:${type}`, el) ?? makerPartOfCanvas(stage, `w:${type}`);
          assert.ok(k, `${stage} › ${page}: a tap on ${type} (${el ?? 'its space'}) picks no part — the toolbar stays on the stage`);
          assert.equal(makerOwnSceneType(k), type, `${type} is picked as itself, not ${k}`);
        }
      }
    }
  }
  /* …the wiring that reading is: the tap handler composes exactly these two. */
  const tools = read('app/dashboard/[eventId]/launch/_components/stage-tools.tsx');
  assert.match(tools, /makerPartOfTap\(where\.current\.stageKey, where\.current\.shownPage, d\.key, typeof d\.el === 'string' \? d\.el : null\) \?\?\s*makerPartOfCanvas\(where\.current\.stageKey, d\.key\)/);
});

test('P1 — each slot is one part, named as its editor row is', () => {
  assert.equal(MAKER_OWN_SCENE_PARTS.length, CUSTOM_SECTION_TYPES.length);
  for (const [i, k] of MAKER_OWN_SCENE_PARTS.entries()) {
    const type = CUSTOM_SECTION_TYPES[i] as CustomSectionType;
    assert.equal(MAKER_PARTS[k].canvas, `w:${type}`);
    assert.equal(MAKER_PARTS[k].label, customSectionEditorLabel(type));
  }
});

test('P2 — an EMPTY scene of their own: Edit works and lists its Heading and its Words, made any way', () => {
  for (const k of MAKER_OWN_SCENE_PARTS as readonly MakerPartKey[]) {
    assert.equal(makerPartToolWorks(k, 'edit'), true, `${k}: Edit is grey`);
    const key = MAKER_PARTS[k].canvas!;
    for (const made of MADE) {
      /* The Maker's own words for it: none yet. (How it was made does not change what the page lets Edit read.) */
      const fields = partWords.readPartWords(emptyPage(key), key, MAKER_PARTS[k].el ?? null, MAKER_PARTS[k].label, { title: '', body: '' });
      assert.ok(fields.length >= 1, `${k} (${made.name}), empty: Edit lists no field — the scene cannot be written`);
      assert.deepEqual(fields.map((f) => f.field), ['title', 'body'], `${k}: Heading, then Words`);
      for (const f of fields) {
        assert.equal(f.drawn, false, 'the page does not draw them yet — keeping them must redraw it');
        assert.equal(f.text, '');
      }
    }
  }
  /* What the Maker has is what the rows hold (a heading written, no words yet). */
  const held = partWords.readPartWords(emptyPage('w:custom_3'), 'w:custom_3', null, 'Your own section 3', { title: 'Our places', body: '' });
  assert.equal(held.find((f) => f.field === 'title')?.text, 'Our places');
  /* …and the toolbar hands those words over (drafted over the last render). */
  const tools = read('app/dashboard/[eventId]/launch/_components/stage-tools.tsx');
  assert.match(tools, /const own = ownType \? draftedOwnWordsOr\(ownType, askPartOps\(\)\?\.ownWords\?\.\[ownType\] \?\? null\) : null;/);
  assert.match(tools, /readPartWords\(doc, makerPartCanvasOn\(stageKey, picked\), MAKER_PARTS\[picked\]\.el \?\? null, makerPartLabelOn\(stageKey, picked\), own\)/);
});

test('P3 — the first Heading of a scene with no words is one draft write, and the page is redrawn with it', () => {
  for (const type of CUSTOM_SECTION_TYPES) {
    const w = sceneTypeWrite('title', type, 'Our favourite places', { title: '', body: '' });
    assert.equal(w.ok, true, `${type}: a heading on a scene with no words yet is refused`);
    if (w.ok) assert.deepEqual(w.patch, { widgets: { [type]: { custom: { title: 'Our favourite places', body: '' } } } });
  }
  /* Still refused: taking words away that were there. */
  assert.equal(sceneTypeWrite('body', 'custom_1', '  ', { title: 'x', body: 'Words' }).ok, false);
  /* Not held: the keep of a field the page did not draw asks for the render that draws it. */
  const src = read('app/dashboard/[eventId]/launch/_components/stage-panel/part-words.ts');
  assert.match(src, /\{ held: f\.drawn !== false, ok:/);
});

test('P4 — the placeholder never blocks the tap', () => {
  for (const type of CUSTOM_SECTION_TYPES) {
    for (const made of MADE) {
      const html = renderToStaticMarkup(
        React.createElement(empty.MakerEmptyScene, { type: type as never, look: empty.makerWordsLook(type, { canvas: made.canvas }) }),
      );
      assert.match(html, new RegExp(`^<section[^>]*data-maker-empty="${type}"`), 'one section, the scene itself');
      assert.doesNotMatch(html, /pointer-events/, `${type} (${made.name}): something in the placeholder takes the pointer`);
    }
  }
  /* The desktop Maker: a tap anywhere on an EMPTY one — its name, its prompt, its space — opens its Content. */
  for (const el of TAPPED) assert.equal(tapOpensWords({ wordsScene: false, el, empty: true, ownScene: true }), true, `${el}`);
  /* …written, it keeps the tap every scene has (its words are typed on the page). */
  assert.equal(tapOpensWords({ wordsScene: false, el: 'label', empty: false, ownScene: true }), false);
  const shell = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  assert.match(shell, /tapOpensWords\(\{ wordsScene: isWordsScene\(type, canvases\[type\], ownWords\), el, empty, ownScene: isOwnSceneType\(type\) \}\)/);
});

test('P5 — while the Heading is typed it shows on the page: the placeholder carries a heading or words to type into', () => {
  for (const made of MADE) {
    const t = 'template' in made.canvas ? SCENE_TEMPLATES[made.canvas.template as keyof typeof SCENE_TEMPLATES] : null;
    /* A template built on the event's own part (names, countdown, monogram) prints that, not the couple's heading. */
    if (t && (t.layout === 'title' || t.layout === 'number' || t.layout === 'mono')) continue;
    const html = renderToStaticMarkup(React.createElement(empty.MakerEmptyScene, { type: 'custom_1', look: empty.makerWordsLook('custom_1', { canvas: made.canvas }) }));
    const look = html.slice(html.indexOf('data-maker-look'));
    assert.ok(look.length > 'data-maker-look'.length, `${made.name}: the placeholder carries no look to type into`);
    /* `ownLookPart`'s targets: the template's heading / words, else the plain scene's eyebrow / words. */
    assert.match(look, /class="hub-tpl-h"|class="pahina-eyebrow"|class="hub-tpl-p"|<p class="max-w-prose/, `${made.name}: the look has no heading or words`);
  }
  const src = read('app/[slug]/_components/type-in-place-canvas.ts');
  assert.match(src, /if \(!part && field && section\) \{\s*showOwnLookWords\(section, field, text\);/);
});

test('P6 — a guest never sees an empty scene of their own (shipped rule, kept)', () => {
  for (const made of MADE) {
    const t = 'template' in made.canvas ? SCENE_TEMPLATES[made.canvas.template as keyof typeof SCENE_TEMPLATES] : null;
    if (t?.builtOn) continue; // filled from the event itself — never empty (`SCENE_BUILT_ON_LABEL`)
    const config = { canvas: made.canvas };
    assert.equal(customSectionHasContent(config), false, `${made.name}: an empty scene counts as content`);
    assert.equal(renderCustomSection({ config, facts: NO_SCENE_FACTS }), null, `${made.name}: the guest renderer draws an empty scene`);
  }
  /* The placeholder is the Maker's canvas alone (`site-body.tsx` sets `makerEmpty` from `isMakerCanvas`). */
  assert.match(read('app/[slug]/_components/site-body.tsx'), /makerEmpty=\{\s*isMakerCanvas && makerDrawsEmpty\(widget\.widget_type\) &&/);
});
