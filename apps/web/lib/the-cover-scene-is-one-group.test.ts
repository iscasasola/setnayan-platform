/**
 * 🖼 THE COVER SCENE IS ONE GROUP — owner-approved 2026-10-15 on
 * `Setnayan/prototypes/maker_cover_group_background_2026-10-14_fable.html` (DECISION_LOG 2026-10-15 "COVER SCENE
 * APPROVED"): every word on the cover is ONE group, named Cover Scene, with ONE Background — the Hero folded in —
 * filling the whole first screen on any device; Scene ◆ ready-made loops play and stay Pro.
 *
 *   (1) the group has Background ONLY; each cover word's Background is grey and its line names the group, and the
 *       toolbar's toast ends in the ONE door that selects it ("Select the Cover Scene ›")
 *   (2) a tap on the cover's empty space selects the group, on every page the cover leads — it is first among the
 *       cover's words there, and no arrival lands on it
 *   (3) Colour and The theme's own are free; Scene ◆ and Upload ◆ are Pro — by the shipped rule, never a second one
 *   (4) a clip never survives the sanitiser while the hero clip may not reach guests; a loop that is not one of
 *       Setnayan's own is dropped; nothing stored is The theme's own
 *   (5) the cover is the whole first screen in EVERY design (min-h 100svh, 100dvh where supported), and an absent
 *       ground draws no layer at all
 *   (6) the words follow the ground: their tone flips with it and AA holds over every sample once the scrim is laid
 *
 * Each claim was broken once and seen red (the sabotage runs are in the PR body).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PahinaMasthead } from '@/app/[slug]/_components/pahina-masthead';
import {
  MAKER_COVER_SCENE,
  MAKER_COVER_SCENE_DOOR,
  MAKER_COVER_WORD_BG_WHY,
  MAKER_PARTS,
  MAKER_PART_KEYS,
  MAKER_PART_TOOLS,
  MAKER_STAGE_PAGES,
  makerArrivalPart,
  makerPartOfTap,
  makerPartParent,
  makerPartToolWhy,
  makerPartToolWorks,
  makerStageIsFixedPages,
  type MakerPartKey,
  type MakerStageKey,
} from './maker-parts';
import { BACKGROUND_SOURCE_IS_PRO } from './background-source';
import {
  COVER_INK,
  COVER_PAPER,
  COVER_SCENE_SOURCES,
  COVER_SCENE_SOURCE_IS_PRO,
  coverGroundIsPro,
  coverGroundSamples,
  coverGroundSource,
  coverSceneLegibility,
} from './cover-scene';
import { hubMovingBackgroundIds, sanitizeHubCanvas, sanitizeHubCoverGround, type HubCoverGround } from './hub-canvas';
import { GUEST_HERO_VIDEO_PLAYBACK } from './guest-hero-video';
import { compositeOver, contrastRatio } from './hub-legibility';
import { HERO_DESIGNS } from './hero-design';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** The cover's words: every part drawn in the cover's section as one of its parts. */
const WORDS = MAKER_PART_KEYS.filter((k) => MAKER_PARTS[k].canvas === 'f:hero' && MAKER_PARTS[k].el);

test('(1) the group has Background only; a cover word’s Background names the group and ends in its one door', () => {
  assert.ok(WORDS.length >= 7, `anti-vacuity: only ${WORDS.length} cover words`);
  assert.equal(MAKER_PARTS[MAKER_COVER_SCENE].canvas, 'f:hero');
  assert.equal(MAKER_PARTS[MAKER_COVER_SCENE].el, undefined, 'the group IS the section — it has no `el`');
  assert.equal(MAKER_PARTS[MAKER_COVER_SCENE].label, 'Cover Scene');
  assert.deepEqual(MAKER_PART_TOOLS.filter((t) => makerPartToolWorks(MAKER_COVER_SCENE, t)), ['bg'], 'the Cover Scene has Background only');
  for (const t of ['edit', 'style', 'animate'] as const) assert.match(makerPartToolWhy(MAKER_COVER_SCENE, t), /^Tap a word /, `the group's ${t} says to tap a word`);
  for (const k of WORDS) {
    assert.equal(makerPartParent(k), MAKER_COVER_SCENE, `${k} sits in the Cover Scene`);
    assert.equal(makerPartToolWorks(k, 'bg'), false, `${k} has a background of its own`);
    assert.equal(makerPartToolWhy(k, 'bg'), MAKER_COVER_WORD_BG_WHY, `${k}: its Background line does not name the group`);
  }
  for (const k of MAKER_PART_KEYS) if (!WORDS.includes(k)) assert.equal(makerPartParent(k), null, `${k} is not a word of the cover`);
  assert.equal(MAKER_COVER_SCENE_DOOR, 'Select the Cover Scene ›');
  /* The toolbar: the toast's ONE action selects the group — it picks, it never navigates. */
  const tools = read('app/dashboard/[eventId]/launch/_components/stage-tools.tsx');
  assert.match(tools, /const whyDoor = why && why\.words === MAKER_COVER_WORD_BG_WHY && !rsvpOpen \? makerPartParent\(picked\) : null;/);
  assert.match(tools, /action=\{whyDoor \? \{ label: MAKER_COVER_SCENE_DOOR, onPress: \(\) => \(setWhy\(null\), pickPartRef\.current\(whyDoor\)\) \} : undefined\}/);
});

test('(2) a tap on the cover’s empty space selects the group, first among the cover’s words on every page the cover leads', () => {
  let pages = 0;
  for (const [stage, byPage] of Object.entries(MAKER_STAGE_PAGES) as [MakerStageKey, Record<string, readonly MakerPartKey[]>][]) {
    for (const [page, parts] of Object.entries(byPage)) {
      const words = parts.filter((k) => WORDS.includes(k));
      if (!words.length || !parts.includes('ename')) continue;
      /* (The RSVP stage's reply form is a fixed page with its own tools (`makerStageIsFixedPages`) — not the hub's first
         screen; the group is not offered there. Named, never silent: a builder's call recorded for the owner.) */
      if (makerStageIsFixedPages(stage)) {
        assert.ok(!parts.includes(MAKER_COVER_SCENE), `${stage} › ${page}: the reply form gained the group — re-derive this exception`);
        continue;
      }
      pages += 1;
      const at = parts.indexOf(MAKER_COVER_SCENE);
      assert.ok(at >= 0, `${stage} › ${page} leads with the cover and has no Cover Scene`);
      assert.ok(parts.slice(0, at).every((k) => !WORDS.includes(k)), `${stage} › ${page}: a cover word comes before the Cover Scene`);
      assert.equal(makerPartOfTap(stage, page, 'f:hero', null), MAKER_COVER_SCENE, `${stage} › ${page}: a tap on the cover itself fell to a word`);
      assert.equal(makerPartOfTap(stage, page, 'f:hero', 'names'), 'names', `${stage} › ${page}: a tap on a word must pick the word`);
      assert.notEqual(makerArrivalPart(parts, () => true), MAKER_COVER_SCENE, `${stage} › ${page}: arriving lands on the group`);
    }
  }
  assert.ok(pages >= 4, `anti-vacuity: only ${pages} pages lead with the cover`);
});

test('(3) Colour and The theme’s own are free; Scene ◆ and Upload ◆ are Pro — the shipped rule', () => {
  assert.deepEqual([...COVER_SCENE_SOURCES], ['theme', 'colour', 'scene', 'own']);
  assert.equal(COVER_SCENE_SOURCE_IS_PRO.theme, false);
  assert.equal(COVER_SCENE_SOURCE_IS_PRO.colour, BACKGROUND_SOURCE_IS_PRO.colour);
  assert.equal(COVER_SCENE_SOURCE_IS_PRO.scene, BACKGROUND_SOURCE_IS_PRO.scene);
  assert.equal(COVER_SCENE_SOURCE_IS_PRO.own, BACKGROUND_SOURCE_IS_PRO.own);
  assert.equal(coverGroundIsPro(null), false);
  assert.equal(coverGroundIsPro({ kind: 'color', color: '#112233' }), false);
  assert.equal(coverGroundIsPro({ kind: 'frost' }), false);
  assert.equal(coverGroundIsPro({ kind: 'loop', loop: hubMovingBackgroundIds()[0]! }), true);
  assert.equal(coverGroundIsPro({ kind: 'photo', media: 'r2://setnayan-media/a.jpg' }), true);
});

test('(4) a clip never survives the sanitiser while the hero clip may not reach guests; a loop is Setnayan’s own', () => {
  assert.equal(GUEST_HERO_VIDEO_PLAYBACK, false, 'the hero clip opened — re-derive this claim (a clip may then be worn)');
  const clip = { kind: 'snippet', media: 'r2://setnayan-media/events/x/scene-background/a.mp4' };
  assert.equal(sanitizeHubCoverGround(clip), null, 'a clip survived the cover’s sanitiser');
  assert.equal(sanitizeHubCanvas({ ground: clip }).ground, undefined, 'a clip survived the canvas sanitiser');
  assert.equal(sanitizeHubCanvas({ canvas: { ground: clip } }).ground, undefined);
  const loops = hubMovingBackgroundIds();
  assert.ok(loops.length >= 5, 'anti-vacuity: the ready-made loops');
  for (const loop of loops) assert.deepEqual(sanitizeHubCanvas({ ground: { kind: 'loop', loop } }).ground, { kind: 'loop', loop });
  assert.equal(sanitizeHubCoverGround({ kind: 'loop', loop: 'not-a-theme' }), null);
  assert.equal(sanitizeHubCoverGround({ kind: 'color', color: 'red' }), null, 'a colour that is not six hex digits is dropped, never repaired');
  assert.equal(coverGroundSource(sanitizeHubCanvas({}).ground), 'theme', 'nothing stored is The theme’s own');
  /* A glass has its Opacity, never the shade bar; Full width is the only shape stored. */
  assert.deepEqual(sanitizeHubCoverGround({ kind: 'frost', color: '#112233', opacity: 60, shade: 50, shape: 'framed' }), { kind: 'frost', color: '#112233', opacity: 60 });
  assert.deepEqual(sanitizeHubCoverGround({ kind: 'color', color: '#112233', shade: -50, shape: 'full' }), { kind: 'color', color: '#112233', shade: -50, shape: 'full' });
});

const MARK = React.createElement('svg', { viewBox: '0 0 10 10' });
const CARD = { eyebrow: 'Together with their families', line: 'invite you to celebrate their wedding', timeLabel: '1:30 PM', hubHref: '#hub', hubLabel: 'Open the Event Hub' };
function cover(extra: Record<string, unknown>): string {
  return renderToStaticMarkup(
    React.createElement(PahinaMasthead, { displayName: 'Maria & Juan', eventDate: '2027-02-14', monogramSlot: MARK, ...extra }),
  );
}
const FIRST_SCREEN = /<header data-pahina-first-screen=""[^>]*\sdata-cover-scene="[^"]*"[^>]*class="[^"]*min-h-\[100svh\] supports-\[height:100dvh\]:min-h-\[100dvh\][^"]*"/;

test('(5) the cover is the whole first screen in every design; an absent ground draws no layer', () => {
  const variants: [string, Record<string, unknown>][] = [
    ['the plain cover', {}],
    ['the written card', { card: CARD }],
    ['the photo cover', { mediaSlot: React.createElement('img', { alt: '' }) }],
    ...HERO_DESIGNS.map((design) => [`design ${design}`, { card: CARD, design }] as [string, Record<string, unknown>]),
  ];
  for (const [name, extra] of variants) {
    const html = cover(extra);
    assert.match(html, FIRST_SCREEN, `${name}: the cover is not the whole first screen`);
    assert.doesNotMatch(html, /data-cover-scene-ground/, `${name}: a layer drawn with nothing stored`);
  }
  /* …and with a ground: the layer, first in the header, with the shape and the tone it was given. */
  const layer = { shape: 'full', css: '#112233', still: null, clip: null, parallax: false, veil: null, scrim: { color: COVER_INK, opacity: 0 }, tone: 'cream' };
  for (const design of HERO_DESIGNS) {
    const html = cover({ card: CARD, design, ground: layer });
    assert.match(html, /<header data-pahina-first-screen=""[^>]*data-cover-scene="full"[^>]*data-cover-tone="cream"[^>]*><div aria-hidden="true" data-cover-scene-ground="full"/, `design ${design}: the ground is not the header’s first child`);
  }
});

test('(6) the words follow the ground: the tone flips with it, and AA holds over every sample', () => {
  const grounds: HubCoverGround[] = [
    { kind: 'color', color: '#111111' },
    { kind: 'color', color: '#F6EFE3' },
    { kind: 'diagonal', color: '#5B1A22' },
    { kind: 'glow', color: '#C9A24B' },
    { kind: 'glass', color: '#1F3A2E', opacity: 90 },
    { kind: 'frost', color: '#9DB7C9' },
    { kind: 'photo', media: 'r2://setnayan-media/a.jpg' },
    ...hubMovingBackgroundIds().map((loop) => ({ kind: 'loop' as const, loop })),
    ...hubMovingBackgroundIds().map((loop) => ({ kind: 'loop' as const, loop, shade: -80 })),
  ];
  for (const g of grounds) {
    const { tone, scrim } = coverSceneLegibility(g);
    const ink = tone === 'ink' ? COVER_INK : COVER_PAPER;
    for (const s of coverGroundSamples(g)) {
      const ratio = contrastRatio(ink, compositeOver(scrim.color, scrim.opacity, s));
      assert.ok(ratio >= 4.5 - 1e-9, `${JSON.stringify(g)}: ${tone} over ${s} is ${ratio.toFixed(2)}:1`);
    }
  }
  assert.equal(coverSceneLegibility({ kind: 'color', color: '#111111' }).tone, 'cream');
  assert.equal(coverSceneLegibility({ kind: 'color', color: '#F6EFE3' }).tone, 'ink');
  /* The bar flips the words on its own: a light loop darkened far enough reads in cream. */
  const light = hubMovingBackgroundIds().find((loop) => coverSceneLegibility({ kind: 'loop', loop }).tone === 'ink');
  assert.ok(light, 'anti-vacuity: a light loop');
  assert.equal(coverSceneLegibility({ kind: 'loop', loop: light!, shade: -100 }).tone, 'cream', 'Darker did not flip the words');
});

test('(7) ONE background, ONE hero writer: an Upload pick IS the hero photo, and the photo is never drawn twice', () => {
  /* The same save writes the photo to the column `resolveHero` reads (the poster, the home card, Post Event). */
  const rows = read('app/dashboard/[eventId]/launch/_components/stage-panel/cover-words-background.tsx');
  assert.match(rows, /const heroPhoto = canvasNext\.ground\?\.kind === 'photo' \? canvasNext\.ground\.media : null;/);
  assert.match(rows, /fd\.set\('patch', JSON\.stringify\(\{ widgets: \{ hero: \{ canvas: canvasNext \} \}, \.\.\.\(heroPhoto \? \{ events: \{ landing_page_hero_image_url: heroPhoto \} \} : \{\}\) \}\)\);/, 'the cover’s photo and the hero photo are written apart');
  assert.equal((rows.match(/fd\.set\('patch'/g) ?? []).length, 1, 'a second save of the cover — two writers');
  /* With a ground, the photo plate under the words is not drawn a second time. */
  const layer = { shape: 'framed', css: null, still: 'https://x.test/a.jpg', clip: null, parallax: false, veil: null, scrim: { color: COVER_PAPER, opacity: 0.5 }, tone: 'ink' };
  const plate = cover({ mediaSlot: React.createElement('img', { alt: '', 'data-plate': '' }) });
  assert.match(plate, /data-plate/, 'anti-vacuity: the photo cover draws its plate');
  assert.doesNotMatch(cover({ mediaSlot: React.createElement('img', { alt: '', 'data-plate': '' }), ground: layer }), /data-plate/, 'the photo is drawn twice');
});

test('(8) the REAL guest page draws it: a stored ground lays the layer behind the words, the first screen tall', async () => {
  const { renderSiteBodyFixtureFull } = await import('./site-body-fixture-render');
  const { fixtureWidgets } = await import('./site-body-fixture');
  const page = await renderSiteBodyFixtureFull({ widgets: fixtureWidgets({ hero: { ground: { kind: 'color', color: '#111111', shape: 'full' } } }) });
  assert.deepEqual(page.complaints, []);
  assert.match(page.html, /<header data-pahina-first-screen=""[^>]*data-cover-scene="full"[^>]*data-cover-tone="cream"[^>]*><div aria-hidden="true" data-cover-scene-ground="full"/, 'the stored colour is not drawn behind the cover, or the words did not flip');
  assert.match(page.html, /data-cover-scene-ground="full"[^>]*><div class="[^"]*m-0 rounded-none[^"]*" style="background:#111111"/, 'Full width is not edge to edge, or the colour is not painted');
  const framed = await renderSiteBodyFixtureFull({ widgets: fixtureWidgets({ hero: { ground: { kind: 'color', color: '#F6EFE3' } } }) });
  assert.match(framed.html, /data-cover-scene="framed"[^>]*data-cover-tone="ink"/);
  assert.match(framed.html, /data-cover-scene-ground="framed"[^>]*><div class="[^"]*m-3 rounded-\[18px\]/, 'Framed is not inset with its rounded margin');
  /* 🚫 The fixture pins the environment (no media host): a loop whose files do not resolve is NOT drawn as an empty
     veil — the cover stays The theme's own. A clip stored by hand never reaches the page at all. */
  const loop = await renderSiteBodyFixtureFull({ widgets: fixtureWidgets({ hero: { ground: { kind: 'loop', loop: hubMovingBackgroundIds()[0]! } } }) });
  assert.doesNotMatch(loop.html, /data-cover-scene-ground/, 'an unresolved loop drew an empty layer');
  const clip = await renderSiteBodyFixtureFull({ widgets: fixtureWidgets({ hero: { ground: { kind: 'snippet', media: 'r2://setnayan-media/events/x/scene-background/a.mp4' } } }) });
  assert.doesNotMatch(clip.html, /data-cover-scene-ground/, 'a stored clip was drawn on the cover');
  /* …and a resolved loop PLAYS (the layer as the page lays it, the shipped SceneClip). */
  const { CoverSceneGround } = await import('@/app/[slug]/_components/cover-scene-ground');
  const played = renderToStaticMarkup(
    React.createElement(CoverSceneGround, { layer: { shape: 'framed', css: null, still: 'https://media.test/p.jpg', clip: 'https://media.test/l.mp4', parallax: false, veil: null, scrim: { color: COVER_INK, opacity: 0.4 }, tone: 'cream' } }),
  );
  assert.match(played, /<video[^>]*>/, 'the ready-made loop does not play');
});
