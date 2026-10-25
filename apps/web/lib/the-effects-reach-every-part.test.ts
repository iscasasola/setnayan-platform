/**
 * the-effects-reach-every-part.test.ts — ✨ THE SIX NEW EFFECTS ON EVERY TEXT AND PICTURE PART (owner 2026-10-17,
 * verbatim: *"Ship #6600 and #6601. Then extend the effects to every text and picture part."*; the six's own rulings:
 * DECISION_LOG "APPROVED — SIX NEW EFFECTS" and "ALL ANIMATE, EFFECTS, STYLES AND ACCENTS ARE EVENT HUB PRO ◆").
 *
 *   (1) EVERY PART THAT OFFERS SHIMMER OFFERS GLOW AND WORDS ▾ — read off the closed sets for every part key, so a new
 *       text part cannot arrive with Shimmer alone. The one exception is NAMED (`HUB_WORD_FX_NOT`, the joiner).
 *   (2) EVERY PICTURE PART WITH ANIMATE OFFERS REVEAL ▾ AND LIGHT LEAK — the cover's photo (a part), and every scene
 *       whose widget draws a picture (`MAKER_PICTURE_SCENES`); a widget file that draws a picture and is not on the list
 *       goes red, so a new one cannot arrive without them.
 *   (3) A SCENE'S WORD EFFECTS REACH ITS PAGE — they ride on the scene's own style (`hubSceneFxAttr`), read back
 *       sanitized, for a `w:` scene's frame and a Post Event scene's alike.
 *   (4) THE SAME RULES AS THE COVER — the scene pictures' Develop · Curtain · Light leak play only behind the
 *       reduced-motion gate and off Save-Data; Light leak is the shipped ambient leak's own drawing; and each is named
 *       Pro at Apply for a couple without Pro.
 *   (5) LIGHT LEAK REACHES EVERY GLIMPSE FRAME AND EVERY LOVE STORY PHOTO (owner 2026-10-17, a Love Story moment's
 *       photos show as Glimpse): the leak's box list is read off the stylesheet and must hold the element each of
 *       those photos is drawn in — a Glimpse card (a button), filled or whole, and a Love Story photo's own place —
 *       each holding its one photo as its only child.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  HUB_ELEMENT_KEYS,
  HUB_WORD_FX_NOT,
  hubElementDuringOffered,
  hubElementIsPicture,
  hubElementTakesWordFx,
  hubSceneFxAttr,
  readHubSceneRuns,
  sanitizeHubElementStyle,
} from './element-style';
import { MAKER_PICTURE_SCENES, makerSceneHasPictures } from './maker-parts';
import { AMBIENT_EFFECT_CSS, AMBIENT_PHOTO_LEAK_SPEC } from './ambient-effects';
import { hubCanvasClass, sanitizeHubCanvas } from './hub-canvas';
import { emptyHubDraft, mergeHubDraft } from './hub-draft';
import { hubDraftProEffects } from './hub-pro-effects';

const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

test('(1) every part that offers Shimmer offers Glow and Words ▾ — the joiner the one named exception', () => {
  let shimmering = 0;
  for (const key of HUB_ELEMENT_KEYS) {
    if (!hubElementDuringOffered(key).includes('shimmer')) continue;
    shimmering += 1;
    if (key in HUB_WORD_FX_NOT) {
      assert.ok(!hubElementTakesWordFx(key), `${key} is named an exception but takes the word effects`);
      continue;
    }
    assert.ok(hubElementDuringOffered(key).includes('glow'), `${key}: offers Shimmer but not Glow`);
    assert.ok(hubElementTakesWordFx(key), `${key}: offers Shimmer but not Words ▾`);
    // …and what it offers it keeps (a pick the sanitizer dropped would be a control that moves no pixels).
    assert.deepEqual(sanitizeHubElementStyle({ motion: { during: 'glow', words: 'spread' } }, key)?.motion, { during: 'glow', words: 'spread' }, `${key}: Glow + Spread were dropped`);
  }
  assert.ok(shimmering >= 12, `anti-vacuity: only ${shimmering} parts offer Shimmer`);
  for (const key of ['label', 'heading', 'body'] as const) assert.ok(hubElementTakesWordFx(key), `the scene's ${key} lost Words ▾`);
  // The sheet reads the closed sets, never a list of its own.
  const sheet = stripComments(read('app/dashboard/[eventId]/website/editor/_components/element-sheet.tsx'));
  assert.match(sheet, /arrive=\{\s*hubElementTakesWordFx\(target\.el\)/, 'Words ▾ is not offered from the closed set');
  assert.match(sheet, /options: hubElementDuringOffered\(target\.el\)\.map\(/);
});

test('(2) every picture part with Animate offers Reveal ▾ and Light leak ◆', () => {
  assert.ok(hubElementIsPicture('photo'));
  assert.ok(hubElementDuringOffered('photo').includes('leak'), 'the cover photo lost Light leak');
  /* Every scene widget that DRAWS a picture is a picture scene. A new one goes red until it is listed. */
  const WIDGET_TYPE: Record<string, string> = {
    'our-love-story-widget.tsx': 'our_love_story',
    'our-photos-widget.tsx': 'our_photos',
    'venue-widget.tsx': 'venue_map',
  };
  const dir = 'app/[slug]/_components';
  const drawing = readdirSync(join(WEB, dir)).filter((f) => /-widget\.tsx$/.test(f) && /<img\b|<video\b|<SceneClip\b/.test(stripComments(read(`${dir}/${f}`))));
  assert.ok(drawing.length >= 3, `anti-vacuity: ${drawing.length} picture widgets found`);
  for (const f of drawing) {
    assert.ok(WIDGET_TYPE[f], `${f} draws a picture — name its scene in MAKER_PICTURE_SCENES (and here)`);
    assert.ok(makerSceneHasPictures(WIDGET_TYPE[f]!), `${WIDGET_TYPE[f]}: a picture scene without Reveal ▾ and Light leak`);
  }
  assert.ok(MAKER_PICTURE_SCENES.includes('photo_moments'), 'the photo moments lost their pictures’ effects');
  // The scene's Animate offers them from that one list (and on any scene with a photo behind its words).
  const tab = stripComments(read('app/dashboard/[eventId]/website/editor/_components/scene-animate-tab.tsx'));
  assert.match(tab, /const pictures = makerSceneHasPictures\(widgetType\) \|\| liftMoves;/);
  assert.match(tab, /arrive=\{\s*pictures \|\| shown\.reveal/, 'Reveal ▾ is not offered on a picture scene');
  assert.match(tab, /\.\.\.\(pictures \|\| shown\.during === 'leak' \? \(\['leak'\] as const\) : \[\]\)/, 'Light leak is not offered on a picture scene');
  // …and the pick is drawn: the scene's own hooks.
  const cls = hubCanvasClass(sanitizeHubCanvas({ reveal: 'develop', during: 'leak' }));
  assert.match(cls, /\bhub-reveal-develop\b/);
  assert.match(cls, /\bhub-during-leak\b/);
});

test('(3) a scene’s word effects reach its page — the w: frame and a Post Event scene alike', () => {
  const attr = hubSceneFxAttr({ heading: { motion: { words: 'word', speed: 'gentle' } }, body: { motion: { during: 'glow' } }, label: { color: '#112233' } });
  assert.ok(attr, 'no payload for a scene with word effects');
  const back = readHubSceneRuns(attr);
  assert.deepEqual(back?.heading?.motion, { words: 'word', speed: 'gentle' });
  assert.deepEqual(back?.body?.motion, { during: 'glow' });
  assert.equal(back?.label, undefined, 'a part with no word effect rode along');
  assert.equal(hubSceneFxAttr({ heading: { motion: { during: 'shimmer' } } }), null);
  for (const f of ['app/[slug]/_components/hub-canvas-frame.tsx', 'app/[slug]/_components/editorial/post-event-scene-views.tsx']) {
    const src = stripComments(read(f));
    assert.match(src, /\[HUB_SCENE_FX_ATTR\]:/, `${f}: the scene's word effects are not on its style`);
    assert.match(src, /<HubSceneFx scope=/, `${f}: nothing cuts the scene's words`);
  }
  assert.equal((stripComments(read('app/[slug]/_components/editorial/editorial-content.tsx')).match(/css=\{cssOf\(/g) ?? []).length, (stripComments(read('app/[slug]/_components/editorial/editorial-content.tsx')).match(/fx=\{fxOf\(/g) ?? []).length, 'a Post Event scene draws its looks but not its word effects');
});

/* ── the scene pictures' CSS ─────────────────────────────────────────────── */
type Rule = { chain: string[]; selector: string; body: string };
function rulesOf(cssText: string): Rule[] {
  const css = stripComments(cssText);
  const out: Rule[] = [];
  const stack: Array<{ prelude: string; at: number; child: boolean }> = [];
  let last = 0;
  for (let i = 0; i < css.length; i += 1) {
    if (css[i] === '{') {
      if (stack.length) stack[stack.length - 1]!.child = true;
      stack.push({ prelude: css.slice(last, i).split(';').pop()!.trim(), at: i + 1, child: false });
      last = i + 1;
    } else if (css[i] === '}') {
      const top = stack.pop();
      if (top && !top.child) out.push({ chain: stack.map((s) => s.prelude), selector: top.prelude, body: css.slice(top.at, i) });
      last = i + 1;
    }
  }
  return out;
}
const decl = (body: string, prop: string) => new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(body)?.[1]?.trim() ?? null;
const flat = (v: string | null) => (v ?? '').replace(/\s+/g, '');
/** A selector list split at its top-level commas (never inside `:is(…)` · `:has(…)`). */
function selectors(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let at = 0;
  for (let i = 0; i < list.length; i += 1) {
    if (list[i] === '(') depth += 1;
    else if (list[i] === ')') depth -= 1;
    else if (list[i] === ',' && depth === 0) {
      out.push(list.slice(at, i).trim());
      at = i + 1;
    }
  }
  out.push(list.slice(at).trim());
  return out;
}

test('(4) the scene pictures play behind the gate, Light leak is the ambient leak’s own drawing, and each is named Pro at Apply', () => {
  const rules = rulesOf(read('app/globals.css'));
  const GATE = '@media screen and (prefers-reduced-motion: no-preference)';
  const scenePics = rules.filter((r) => /hub-reveal-|hub-during-leak/.test(r.selector));
  assert.ok(scenePics.length >= 4, 'anti-vacuity: the scene pictures’ rules are gone');
  for (const r of scenePics) {
    const anim = decl(r.body, 'animation');
    if (!anim) continue;
    assert.ok(r.chain.includes(GATE), `"${r.selector}" plays outside the reduced-motion gate`);
    assert.ok(selectors(r.selector).every((s) => s.startsWith(':root:not(.sn-save-data)')), `"${r.selector}" plays on Save-Data`);
  }
  // Light leak's drawing: the ambient leak's band, colours, blur and still, with the spec's own values.
  const leak = scenePics.find((r) => /::before/.test(r.selector) && !r.chain.includes(GATE));
  assert.ok(leak, 'the scene pictures’ Light leak has no drawing at rest');
  const amb = /\[data-ambient-effect="leak"\] i\{([^}]*)\}/.exec(AMBIENT_EFFECT_CSS)![1]!;
  const v = AMBIENT_PHOTO_LEAK_SPEC.vars;
  const p = AMBIENT_PHOTO_LEAK_SPEC.particles[0]!;
  const sub = (x: string) => x.replace(/var\((--[a-z0-9-]+)\)/g, (_, k: string) => v[k] ?? p[k] ?? k).replace(/calc\(10px\*1\.00\)/, '10px');
  for (const prop of ['left', 'top', 'width', 'height', 'background', 'mix-blend-mode']) assert.equal(flat(decl(leak!.body, prop)), flat(sub(decl(amb, prop) ?? '')), `Light leak's ${prop} is not the ambient leak's`);
  assert.equal(flat(decl(leak!.body, 'filter')), 'blur(10px)');
  const still = /@media \(prefers-reduced-motion:reduce\)\{[\s\S]*\[data-ambient-effect="leak"\] i\{([^}]*)\}/.exec(AMBIENT_EFFECT_CSS)![1]!;
  assert.equal(flat(decl(leak!.body, 'opacity')), flat(sub(decl(still, 'opacity') ?? '')), 'Light leak at rest is not the ambient still');
  assert.equal(flat(decl(leak!.body, 'transform')), flat(sub(decl(still, 'transform') ?? '')), 'Light leak at rest is not the ambient still');
  const kf = rules.filter((r) => r.chain.at(-1) === '@keyframes el-fx-leak');
  const ambKf = rulesOf(/@keyframes sn-fx-leak\{.*?\}\}/.exec(AMBIENT_EFFECT_CSS)![0]!);
  assert.deepEqual(kf.map((r) => [r.selector, flat(r.body).replace(/;$/, '')]), ambKf.map((r) => [r.selector, flat(sub(r.body)).replace(/;$/, '')]), 'Light leak’s cycle is not the ambient leak’s');
  // Named Pro at Apply — a scene's pictures and a scene's words.
  const live = (type: string) => ({ events: {}, widgets: [{ widget_id: `w-${type}`, widget_type: type, is_always_on: false, display_order: 3, config_json: {}, mode: 'auto' }] }) as never;
  const asked = (type: string, canvas: object) => hubDraftProEffects(mergeHubDraft(emptyHubDraft(), { widgets: { [type]: { canvas } } } as never), live(type), false).map((e) => e.what);
  assert.deepEqual(asked('our_love_story', { reveal: 'develop' }), ['Develop']);
  assert.deepEqual(asked('our_photos', { reveal: 'curtain' }), ['Curtain']);
  assert.deepEqual(asked('venue_map', { during: 'leak' }), ['Light leak']);
  assert.deepEqual(asked('schedule', { elements: { heading: { motion: { words: 'word' } } } }), ['Word by word']);
  assert.deepEqual(hubDraftProEffects(mergeHubDraft(emptyHubDraft(), { widgets: { venue_map: { canvas: { during: 'leak' } } } } as never), live('venue_map'), true), []);
});

test('(5) Light leak reaches every Glimpse frame and every Love Story photo — the box each is drawn in is on the leak’s list', async () => {
  (globalThis as unknown as { React: unknown }).React = (await import('react')).default;
  {
    const Mod = require('node:module');
    const load = Mod._load;
    Mod._load = function (request: string, ...rest: unknown[]) {
      if (request === 'server-only' || request === 'client-only') return {};
      return load.call(this, request, ...rest);
    };
  }
  const React = (await import('react')).default;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const css = read('app/globals.css');
  const list = /\.hub-during-leak > \.hub-canvas-body :where\(([^)]*)\):has\(> :is\(img, video\):only-child\)::before/.exec(css);
  assert.ok(list, 'the scene pictures’ Light leak selector moved — this guard reads its box list');
  const boxes = new Set(list![1]!.split(',').map((t) => t.trim()));
  /** Every element carrying `attr`, with its tag and whether its only child is one <img>. */
  const holders = (html: string, attr: string) =>
    [...html.matchAll(new RegExp(`<(\\w+)[^>]*\\s${attr}=""[^>]*>([\\s\\S]*?)</\\1>`, 'g'))].map((m) => ({ tag: m[1]!, alone: /^<img [^>]*\/>$/.test(m[2]!) }));
  const { GlimpseRail } = await import('../app/[slug]/_components/glimpse-rail');
  const urls = ['https://img.test/a.jpg', 'https://img.test/b.jpg', 'https://img.test/c.jpg'];
  const { OurLoveStoryWidget } = await import('../app/[slug]/_components/our-love-story-widget');
  const ref = (n: string) => `r2://setnayan-media/events/E1/love-story/${n}.jpg`;
  const story = { moments: [
    { id: 'three', date: { y: 2019 }, line: 'Three.', media: [ref('a'), ref('b'), ref('c')], order: 0, canvas: {} },
    { id: 'one', date: { y: 2020 }, line: 'One.', media: [ref('d')], order: 1, canvas: {} },
  ] };
  const mediaUrls = Object.fromEntries(['a', 'b', 'c', 'd'].map((n) => [ref(n), `https://img.test/${n}.jpg`]));
  const cases: Array<[string, string, string]> = [
    ['Photos scene Glimpse', renderToStaticMarkup(React.createElement(GlimpseRail, { urls })), 'data-glimpse-card'],
    ['Glimpse, whole photos', renderToStaticMarkup(React.createElement(GlimpseRail, { urls, whole: true })), 'data-glimpse-card'],
    ...(['conversation', 'timeline', 'cards', 'chapters'] as const).map((st): [string, string, string] => [
      `Love Story · ${st} · the one photo`,
      renderToStaticMarkup(React.createElement(OurLoveStoryWidget, { config: story, mediaUrls, sceneStyle: st, partners: ['Maria', 'Jose'] })),
      'data-love-photo',
    ]),
  ];
  for (const [what, html, attr] of cases) {
    const hs = holders(html, attr);
    assert.ok(hs.length > 0, `${what}: no photo drawn — the guard read nothing`);
    for (const h of hs) {
      assert.ok(h.alone, `${what}: a photo is not its box's only child, so Light leak cannot reach it`);
      assert.ok(boxes.has(h.tag), `${what}: a photo drawn in a <${h.tag}>, which is not on Light leak's box list (${[...boxes].join(', ')})`);
    }
  }
});
