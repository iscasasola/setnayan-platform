/**
 * 🎨🌗🎛 THE STAGES PANEL'S THREE FOLLOW-UPS ARE REAL — owner 2026-10-07, verbatim
 * *"1. all three together"* (DECISION_LOG "STAGES PANEL REDRAW APPROVED (#6398);
 * THREE FOLLOW-UPS AS ONE STEP").
 *
 *   A · Every part has REAL styles, registered in the guest render — Names · Date ·
 *       Place · Logo · Title, the four for-each-guest parts and E-Gifts — and every
 *       style that is not the shipped look is DRAWN (a CSS rule for its attribute).
 *   B · The miniatures are the guest page itself, one part in one style, host-canvas
 *       only (`?only=` + `?style=`), and a guest's `?style=` changes nothing.
 *   C · A scene photo's Darker ↔ Lighter never takes the words under AA, for every
 *       theme; Spacing is stored, drawn, and is never a frame on its own.
 *   D · The camera's look is drafted beside the QR (never over it), is free, and a
 *       held QR still lets the camera look through.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAKER_PARTS, type MakerPartKey } from './maker-parts';
import { sceneStyleOptions, sceneStyleSet } from './scene-styles';
import { PART_SCENE_STYLE_SETS, partLookAttr } from './scene-styles-parts';
import { PART_LOOK_SCENES, sanitizeFixedSceneStylesDraft } from './fixed-scene-styles';
import { hasHubCanvas, sanitizeHubCanvas } from './hub-canvas';
import { HUB_THEMES } from './invite-themes';
import { AA_BODY } from './hub-legibility';
import { sceneMediaShade, sceneMediaShadeVars } from './scene-media-shade';
import { eventItemIsPro, mergeHubDraft, emptyHubDraft, planHubDraftApply, type HubLiveState } from './hub-draft';
import { canvasOnlyCss, canvasOnlyScene, canvasStylePreview } from '../app/[slug]/_lib/editor-canvas';
import { withStylePreview } from '../app/[slug]/_lib/style-preview';
import { stripComments } from './strip-comments';
import { PUBLIC_R2_BUCKET } from './r2-client-ref';

const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const CSS = read('app/globals.css');

/* ── A · real styles, drawn by the guest page ──────────────────────────────── */

const NAMED: Array<[MakerPartKey, string]> = [
  ['names', 'rsvp'],
  ['date', 'rsvp'],
  ['place', 'rsvp'],
  ['logo', 'save_the_date'],
  ['ename', 'event'],
  ['gifts', 'rsvp'],
  ['myrole', 'rsvp'],
  ['mywear', 'rsvp'],
  ['myarrive', 'rsvp'],
  ['myguests', 'rsvp'],
];

test('A · every part the owner named has 3–5 registered styles, offered on its stage', () => {
  for (const [k, stage] of NAMED) {
    const l = MAKER_PARTS[k].layouts;
    assert.equal(l.kind, 'scene', `${k}: its layouts are a registered scene's`);
    if (l.kind !== 'scene') continue;
    const opts = sceneStyleOptions(l.type, stage as never, 'wedding');
    assert.ok(opts.length >= 3 && opts.length <= 5, `${k}: ${opts.length} styles on ${stage}`);
    assert.ok(sceneStyleSet(l.type), `${k}: "${l.type}" is in the ONE registry`);
  }
});

test('A · the shipped look is each set’s first and carries no attribute; every other style is drawn by a CSS rule', () => {
  let drawn = 0;
  for (const set of PART_SCENE_STYLE_SETS) {
    assert.equal(partLookAttr(set.type, set.styles[0]!.id), null, `${set.type}: the first style is the page as shipped`);
    for (const st of set.styles.slice(1)) {
      const attr = partLookAttr(set.type, st.id);
      assert.ok(attr, `${set.type}.${st.id} names an attribute`);
      assert.ok(CSS.includes(`[data-part-look="${attr}"]`), `${attr}: no rule in globals.css draws it`);
      drawn += 1;
    }
  }
  assert.ok(drawn >= 30, `anti-vacuity: ${drawn} styles checked`);
});

test('A · the picks are drafted beside the five fixed parts (one key, no migration)', () => {
  const d = sanitizeFixedSceneStylesDraft({ hero_names: 'staggered', gifts: null, my_role: 'centred', nope: 'x' });
  assert.deepEqual(d, { hero_names: 'staggered', gifts: null, my_role: 'centred' });
  assert.equal(PART_LOOK_SCENES.length, 10);
});

test('A · the guest render hands each part its look (masthead, Welcome, Me)', () => {
  const body = stripComments(read('app/[slug]/_components/site-body.tsx'));
  assert.match(body, /heroElements\.looks = /);
  /* Five since 2026-10-08: the guest's own look is drawn on Me (the guest's pages follow the Maker's filing) — the
     same component, the same looks. EVERY mount carries them. */
  assert.equal((body.match(/partLooks=\{welcomeLooks\}/g) ?? []).length, (body.match(/<GuestWelcome\b/g) ?? []).length, 'every Welcome mount');
  assert.equal((body.match(/<GuestWelcome\b/g) ?? []).length, 5);
  assert.match(body, /partLooks=\{meLooks\}/);
  const mast = stripComments(read('app/[slug]/_components/pahina-masthead.tsx'));
  assert.match(mast, /'data-part-look': looks\[key as keyof typeof looks\]/, 'each hero part carries its look');
});

/* ── B · the miniature is the guest page, one part, one style — host only ─── */

test('B · ?only= and ?style= are honoured on the host canvas alone', () => {
  assert.equal(canvasOnlyScene({ only: 'f:hero.names' }, true), 'f:hero.names');
  assert.equal(canvasOnlyScene({ only: 'w:countdown' }, true), 'w:countdown');
  assert.equal(canvasOnlyScene({ only: 'w:countdown' }, false), null, 'a guest’s ?only= cut their page down');
  assert.equal(canvasOnlyScene({ only: 'w:x"]{}' }, true), null, 'nothing typed reaches the CSS');
  assert.equal(canvasOnlyScene({ only: 'story' }, true), null);
  assert.deepEqual(canvasStylePreview({ style: 'hero_names:staggered' }, true), { type: 'hero_names', id: 'staggered' });
  assert.equal(canvasStylePreview({ style: 'hero_names:staggered' }, false), null, 'a guest’s ?style= changed their page');
  assert.equal(canvasStylePreview({ style: 'hero_names:<b>' }, true), null);
  assert.match(canvasOnlyCss('f:hero.names'), /\[data-el="names"\]/, 'one part of the hero alone');
});

test('B · the style asked for is laid over the rows as read — a section’s canvas, or a part’s pick', () => {
  const ev = { style_preferences: { qr: { shape: 'dots' }, scene_styles: { entourage: 'march' } } };
  const rows = [{ widget_type: 'countdown', config_json: { canvas: { kind: 'none' } } }, { widget_type: 'schedule', config_json: {} }];
  const a = withStylePreview(ev, rows, { type: 'countdown', id: 'calendar' });
  assert.equal((a.widgets[0]!.config_json as { canvas: { style: string; kind: string } }).canvas.style, 'calendar');
  assert.equal((a.widgets[0]!.config_json as { canvas: { kind: string } }).canvas.kind, 'none', 'the rest of the canvas kept');
  assert.equal(a.widgets[1], rows[1], 'another scene untouched');
  const b = withStylePreview(ev, rows, { type: 'hero_date', id: 'big-day' });
  assert.deepEqual((b.event.style_preferences as { scene_styles: unknown }).scene_styles, { entourage: 'march', hero_date: 'big-day' });
  assert.deepEqual((b.event.style_preferences as { qr: unknown }).qr, { shape: 'dots' }, 'every other key kept');
  const c = withStylePreview(ev, rows, null);
  assert.equal(c.event, ev, 'no preview: the event as read');
});

test('B · a miniature frame never mounts the editor bridge, and every card is the guest page', () => {
  const body = stripComments(read('app/[slug]/_components/site-body.tsx'));
  assert.match(body, /\{isEditorCanvas && editorBridge && !themeTile \? <EditorBridge \/> : null\}/);
  assert.match(body, /const themeTile = themeTileIn \|\| Boolean\(stylePreview\);/, 'a miniature is a tile: no bridge');
  assert.match(body, /withStylePreview\(eventIn, widgetsIn, isEditorCanvas \? stylePreview : null\)/);
  const page = stripComments(read('app/[slug]/page.tsx'));
  assert.match(page, /stylePreview: canvasStylePreview\(search, isEditorCanvas\)/);
  const prev = stripComments(read('app/dashboard/[eventId]/launch/_components/stage-panel/style-preview.tsx'));
  assert.match(prev, /u\.searchParams\.set\('only', canvasKey\)/);
  assert.match(prev, /u\.searchParams\.set\('style', `\$\{sceneType\}:\$\{styleId\}`\)/);
  assert.match(prev, /sandbox="allow-same-origin"/, 'script-less: a miniature cannot play or talk to the Maker');
});

/* ── C · Darker ↔ Lighter never under the floor; Spacing ──────────────────── */

test('C · Darker and Lighter hold body text at AA over the darkest and lightest pixel, for every theme', () => {
  for (const theme of HUB_THEMES) {
    for (const step of ['darker', 'lighter'] as const) {
      const r = sceneMediaShade(step, theme);
      assert.ok(r.bodyContrast >= AA_BODY, `${theme.id} · ${step}: ${r.bodyContrast.toFixed(2)}:1`);
    }
    assert.ok(sceneMediaShade('darker', theme).veil === theme.palette.darkInk, `${theme.id}: Darker is the theme’s dark ink`);
    /* …and the words the page paints over it ARE the ink that was measured (the theme's light ink). */
    const ink = sceneMediaShadeVars('darker', theme)['--color-ink'];
    const hex = `#${ink!.split(' ').map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
    assert.equal(hex.toLowerCase(), theme.palette.lightInk.toLowerCase(), `${theme.id}: Darker paints the measured light ink`);
  }
});

test('C · the shade is kept only beside a picture; Spacing is kept and is never a frame alone', () => {
  const photo = sanitizeHubCanvas({ canvas: { media: `r2://${PUBLIC_R2_BUCKET}/a/b.jpg`, kind: 'photo', shade: 'darker' } });
  assert.equal(photo.shade, 'darker');
  assert.equal(sanitizeHubCanvas({ canvas: { kind: 'color', color: '#112233', shade: 'darker' } }).shade, undefined);
  assert.equal(sanitizeHubCanvas({ canvas: { shade: 'as-is' } }).shade, undefined);
  const roomy = sanitizeHubCanvas({ canvas: { spacing: 'roomy' } });
  assert.equal(roomy.spacing, 'roomy');
  assert.equal(sanitizeHubCanvas({ canvas: { spacing: 'regular' } }).spacing, undefined, 'Regular is the absence');
  assert.equal(hasHubCanvas(roomy), false, 'Spacing alone brings no frame (and no motion)');
  assert.ok(CSS.includes('.hub-space-roomy {') && CSS.includes('~ .hub-space-tight {'), 'both are drawn');
  assert.match(CSS, /var\(--hub-scrim-top, rgb\(255 255 255 \/ 0\.72\)\)/, 'As is stays the shipped scrim');
});

/* ── D · the camera's look rides the draft beside the QR ─────────────────── */

test('D · a camera pick never resets a drafted QR, and the QR never resets the camera', () => {
  let d = mergeHubDraft(emptyHubDraft(), { events: { style_preferences: { qr: { pattern: 'dots' } } } });
  d = mergeHubDraft(d, { events: { style_preferences: { camera_look: 'brand' } } });
  assert.deepEqual(d.events.style_preferences, { qr: { pattern: 'dots' }, camera_look: 'brand' });
  d = mergeHubDraft(d, { events: { style_preferences: { camera_look: 'nonsense' } } });
  assert.deepEqual(d.events.style_preferences, { qr: { pattern: 'dots' }, camera_look: 'brand' }, 'an unknown look is dropped');
});

test('D · the camera look is free; only a moving QR is Pro — and a held QR still lets the camera through', () => {
  assert.equal(eventItemIsPro('style_preferences', { camera_look: 'challenges' }, 'change', {}), false);
  const live: HubLiveState = { events: { style_preferences: {} }, widgets: [] };
  const draft = mergeHubDraft(emptyHubDraft(), { events: { style_preferences: { qr: { pattern: 'dots' }, camera_look: 'brand' } } });
  const plan = planHubDraftApply(draft, live, false);
  const free = plan.apply.find((i) => i.kind === 'event' && i.column === 'style_preferences');
  assert.ok(free, 'the camera look is written though the QR waits for Pro');
  assert.deepEqual((free as { value: unknown }).value, { camera_look: 'brand' }, 'only the camera look — never the held QR');
});
