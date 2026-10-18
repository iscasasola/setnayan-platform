/**
 * shimmer-is-an-action-on-any-text.test.ts — ✨ SHIMMER IS AN ANIMATE EFFECT FOR ANY TEXT (owner 2026-10-16, DECISION_LOG
 * "SHIMMER IS AN ANIMATE EFFECT FOR ANY TEXT · 'CONFIRM ATTENDANCE' IS THE RSVP"; verbatim: *"text animate shimmer is on any
 * text they want. it is an effect."*; and "ALL ANIMATE, EFFECTS, STYLES AND ACCENTS ARE EVENT HUB PRO ◆").
 *
 *   (1) ANY TEXT PART TAKES IT — every hero line with words and every scene's label · heading · words; never the logo
 *       (a drawing) nor the RSVP button (Look › Buttons'). Gold is kept only beside a shimmer.
 *   (2) IT IS AN ACTION — a looping slot in the part's own animation list (5 s), the hero part wears its hook
 *       (`data-el-shimmer`), and ▶ Action finds it (`el-during-*`).
 *   (3) OFF UNDER REDUCED MOTION AND SAVE-DATA — the paint (the gradient clipped to the words) exists only inside
 *       `prefers-reduced-motion: no-preference` and off `.sn-save-data`, for the hero (globals.css) and a scene (its own
 *       style); outside them the word is its plain colour, never transparent text.
 *   (4) THE MAKER OFFERS IT — Action becomes ONE dropdown (Still · Drift · Shimmer ◆) on a text part, with Band ▾ while
 *       it shimmers; the Apply sheet names it "Shimmer" (Pro at Apply, the part's own motion).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  HUB_ELEMENT_KEYS,
  HUB_SHIMMER_GOLD,
  HUB_SHIMMER_KEYFRAME,
  HUB_SHIMMER_PERIOD_S,
  HUB_EL_DURING_PRO_NAMED,
  hubElementArrivalOnly,
  hubElementDuringOffered,
  hubElementMotionAttr,
  hubElementMotionDeclarations,
  hubElementSceneCss,
  hubElementTakesShimmer,
  hubShimmerPaint,
  sanitizeHubElementStyle,
  type HubElementKey,
} from './element-style';

import { emptyHubDraft, mergeHubDraft } from './hub-draft';
import { hubDraftProEffects } from './hub-pro-effects';

const WEB = join(__dirname, '..');
/** The live hero row the Apply sheet compares the draft to — nothing chosen on it. */
const HERO_ROW = { widget_id: 'w-hero', widget_type: 'hero', is_always_on: true, display_order: 0, config_json: {}, mode: 'auto' } as never;
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const TEXT: readonly HubElementKey[] = ['eyebrow', 'names', 'joiner', 'line', 'date', 'time', 'link', 'venue', 'caption', 'closing', 'label', 'heading', 'body'];

test('(1) any text part takes a shimmer — never the logo or the RSVP button; Gold only beside it', () => {
  for (const key of HUB_ELEMENT_KEYS) {
    const kept = sanitizeHubElementStyle({ motion: { during: 'shimmer', band: 'gold' } }, key);
    if (TEXT.includes(key)) {
      assert.ok(hubElementTakesShimmer(key), `${key}: a text part does not take a shimmer`);
      assert.deepEqual(kept?.motion, { during: 'shimmer', band: 'gold' }, `${key}: the shimmer was dropped`);
    } else {
      assert.ok(!hubElementTakesShimmer(key), `${key}: a part with no words takes a shimmer`);
      assert.equal(kept?.motion?.during, undefined, `${key}: a shimmer was kept where no words can carry it`);
    }
  }
  assert.equal(sanitizeHubElementStyle({ motion: { during: 'drift', band: 'gold' } }, 'names')?.motion?.band, undefined, 'Gold kept beside no shimmer');
});

test('(2) it is an Action — a 5 s loop in the part’s own list, its hook on the hero, ▶ finds it', () => {
  assert.equal(HUB_SHIMMER_PERIOD_S, 5);
  assert.match(HUB_SHIMMER_KEYFRAME, /^el-during-/, '▶ Action would not find the shimmer (`kfOf(…, /^el-during-/)`)');
  const motion = { during: 'shimmer' as const };
  for (const place of ['hero', 'page'] as const) {
    const anim = Object.fromEntries(hubElementMotionDeclarations(motion, place)).animation ?? '';
    assert.ok(anim.includes(`5s linear 0s infinite normal none ${HUB_SHIMMER_KEYFRAME}`), `${place}: the shimmer is not in the part’s animation list`);
  }
  assert.ok(hubElementArrivalOnly(motion)?.includes(HUB_SHIMMER_KEYFRAME), 'an engine without scroll timelines never shimmers');
  assert.deepEqual(hubElementMotionAttr({ motion }), { 'data-el-motion': '', 'data-el-shimmer': 'hue' });
  assert.deepEqual(hubElementMotionAttr({ motion: { during: 'shimmer', band: 'gold' } }), { 'data-el-motion': '', 'data-el-shimmer': 'gold' });
  assert.deepEqual(hubElementMotionAttr({ motion: { during: 'drift' } }), { 'data-el-motion': '' });
  // The Maker's instant preview lays the same hook.
  assert.match(stripComments(read('app/[slug]/_components/editor-bridge.tsx')), /const band = hubElementShimmer\(style\?\.motion\);\s*if \(band\) part\.setAttribute\(HUB_SHIMMER_ATTR, band\);\s*else part\.removeAttribute\(HUB_SHIMMER_ATTR\);/);
});

test('(3) the paint is drawn only where motion is allowed and there is no Save-Data', () => {
  const css = read('app/globals.css');
  assert.match(css, new RegExp(`@keyframes ${HUB_SHIMMER_KEYFRAME} \\{ from \\{ background-position: 120% 0; \\} to \\{ background-position: -140% 0; \\} \\}`));
  const rule = ':root:not(.sn-save-data) [data-el-shimmer] {';
  const at = css.indexOf(rule);
  assert.ok(at > 0, 'the hero’s shimmer paint is gone');
  const gate = css.lastIndexOf('@media', at);
  assert.equal(css.slice(gate, css.indexOf('{', gate)).trim(), '@media screen and (prefers-reduced-motion: no-preference)', 'the shimmer paint is outside the reduced-motion gate');
  assert.ok(css.indexOf('}\n}', gate) > at, 'the shimmer paint escaped its gate');
  // Every paint declaration is `hubShimmerPaint`'s — one drawing for the hero and the scenes.
  const block = css.slice(at, css.indexOf('}', at));
  for (const [p, v] of hubShimmerPaint('hue')) assert.ok(block.includes(`${p}: ${v};`), `the hero’s paint lacks ${p}: ${v}`);
  const gold = css.slice(css.indexOf(":root:not(.sn-save-data) [data-el-shimmer='gold'] {"));
  assert.ok(gold.slice(0, 200).includes(`${HUB_SHIMMER_GOLD.ink} 0 38%, ${HUB_SHIMMER_GOLD.band} 50%`), 'the Gold band is not the prototype’s #835C2F → #F0D9A8');
  assert.match(stripComments(read('app/[slug]/_components/pahina-motion.tsx')), /navigator\.connection&&navigator\.connection\.saveData\)r\.classList\.add\('sn-save-data'\)/, 'a Save-Data connection is not marked');
  // A scene's part: the same declarations, in its own style, behind the same gate.
  const scene = hubElementSceneCss('schedule', { heading: { motion: { during: 'shimmer' } } }) ?? '';
  const sat = scene.indexOf('@media screen and (prefers-reduced-motion: no-preference){');
  assert.ok(sat >= 0, 'a scene’s shimmer paint is not behind the reduced-motion gate');
  const paint = scene.slice(sat);
  assert.match(paint, /:root:not\(\.sn-save-data\) :has\(\+ style\[data-hub-els="schedule"\]\)/, 'a scene’s shimmer paints on a Save-Data connection');
  assert.ok(paint.includes('-webkit-text-fill-color:transparent'), 'a scene’s shimmer has no paint');
  assert.ok(!scene.slice(0, sat).includes('background-clip'), 'a scene’s shimmer paint is drawn outside its gate');
  assert.equal(hubElementSceneCss('schedule', { heading: { motion: { during: 'drift' } } })?.includes('background-clip') ?? false, false);
});

test('(4) the Maker offers it as one dropdown with Band ▾, and Apply names it "Shimmer"', () => {
  const sheet = stripComments(read('app/dashboard/[eventId]/website/editor/_components/element-sheet.tsx'));
  /* (2026-10-16, "SIX NEW EFFECTS": the offer and the ◆ moved into the closed sets — `hubElementDuringOffered`,
     `HUB_EL_DURING_PRO_NAMED` — so the same property is held on them, and the sheet is held to reading them.) */
  for (const key of TEXT) assert.ok(hubElementDuringOffered(key).includes('shimmer'), `${key}: the part’s Action does not offer Shimmer`);
  assert.ok(HUB_EL_DURING_PRO_NAMED.includes('shimmer'), 'Shimmer is not one of the Actions marked ◆');
  assert.match(sheet, /options: hubElementDuringOffered\(target\.el\)\.map\(/, 'the part’s Action does not read the offered set');
  assert.match(sheet, /HUB_EL_DURING_PRO_NAMED\.includes\(v\) \? `\$\{HUB_EL_DURING_LABEL\[v\]\} ◆`/, 'Shimmer is not marked ◆ (Pro at Apply)');
  assert.match(sheet, /band=\{\s*motion\.during === 'shimmer'/, 'no Band ▾ while it shimmers');
  const animate = stripComments(read('app/dashboard/[eventId]/launch/_components/stage-panel/stage-animate.tsx'));
  assert.match(animate, /does\.options\.length >= 3 \? \(\s*<Dd small=\{animatePro\('While on screen'\)\}/, 'three Action choices are not ONE dropdown');
  assert.match(animate, /at === 'act' && band \? \(/, 'Band ▾ is not drawn on Action');
  /* The Apply sheet names it — asked of the sheet itself, for a couple without Pro. */
  const draft = mergeHubDraft(emptyHubDraft(), { widgets: { hero: { canvas: { elements: { names: { motion: { during: 'shimmer' } } } } } } });
  const named = hubDraftProEffects(draft, { events: {}, widgets: [HERO_ROW] }, false).map((e) => e.what);
  assert.deepEqual(named, ['Shimmer'], 'the Apply sheet does not name the Shimmer');
});
