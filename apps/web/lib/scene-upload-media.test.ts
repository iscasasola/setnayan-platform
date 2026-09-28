/**
 * scene-upload-media.test.ts — "UPLOAD MEDIA" ON A SCENE BACKGROUND IS ALWAYS
 * THERE, UPLOADS IN PLACE, AND A PHOTO CAN BE PARALLAX (DECISION_LOG
 * 2026-09-28). Owner, verbatim: *"where is the upload media/: photo parallax
 * effect or snippet that would run like the background?"* — and the same day,
 * *"they can edit it with pro features. but need to upgrade to pro when clicked
 * on apply"*.
 *
 * Held here, each by what a couple or a guest would actually get:
 *   1 · the chip is DRAWN with no picture at all, open to a free couple (a ◆
 *       mark, never a padlock) — hidden only for the store shell's free couple;
 *   2 · the Save the Date's own uploaded background is one of the pictures;
 *   3 · Parallax is the SHIPPED hero parallax (its mark, its script, its rule);
 *   4 · a free couple's media stays in the DRAFT and never publishes;
 *   5 · a clip plays in the couple's own Maker canvas and never reaches a guest
 *       (SEC-6) — the guest sees its still.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as unknown as { React: unknown }).React = React;

import { resolveHubBackground, sanitizeHubCanvas, type HubSectionCanvas } from './hub-canvas';
import { sceneGround, sceneWidgetIsBare } from './scene-ground';
import { canvasFreePart, planHubDraftApply, type HubDraftState, type HubLiveState } from './hub-draft';
import { sceneUploadRefs, stdBackgroundUploadRef } from './scene-media-choices';
import { withBackground } from './scene-background-scope';
import { stripComments } from './strip-comments';

const ROOT = join(import.meta.dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const EDITOR = 'app/dashboard/[eventId]/website/editor';

const E = 'E1';
const OWN = `r2://setnayan-media/events/${E}/scene-background/1-a.jpg`;
const CLIP = `r2://setnayan-media/events/${E}/scene-background/2-b.mp4`;
const STILL = `r2://setnayan-media/events/${E}/scene-background/3-still.jpg`;
const STD = `r2://setnayan-media/events/${E}/std-background/bg.jpg`;

/* ── 1 · THE CHIP IS ALWAYS DRAWN ─────────────────────────────────────────── */

async function paintRow(props: Record<string, unknown>): Promise<string> {
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { SceneBackgroundRow } = await import(`../${EDITOR}/_components/scene-background-row`);
  const router = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} };
  return renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: router as never },
      React.createElement(SceneBackgroundRow, {
        eventId: E,
        widgetType: 'countdown',
        canvas: {},
        stageScenes: [{ type: 'countdown', canvas: {} }],
        stageLabel: 'Invitation',
        draftAction: async () => ({ ok: true, intent: 'save', applied: 0, held: [] }),
        themeColours: ['#1b1a17'],
        ...props,
      }),
    ),
  );
}

const mediaChip = (html: string) => /<button[^>]*data-scene-bg-choice="media"[^>]*>[\s\S]*?<\/button>/.exec(html)?.[0] ?? '';

test('1 · Upload media is drawn for a couple with NO picture at all, and open to a free couple', async () => {
  const free = await paintRow({ ownsPro: false, photoChoices: [], videoChoice: null });
  const chip = mediaChip(free);
  assert.ok(chip, 'the chip is drawn with zero existing media');
  assert.match(chip, />Upload media</);
  assert.match(chip, /lucide-gem/, 'a small ◆ mark says it is Pro');
  assert.doesNotMatch(chip, /lucide-lock/, 'never a padlock — Pro is asked for at Apply');
  assert.doesNotMatch(chip, /\bdisabled=""/, 'the chip is tappable');
  const pro = await paintRow({ ownsPro: true, photoChoices: [], videoChoice: null });
  assert.ok(mediaChip(pro), 'drawn for a Pro couple with no picture too');
});

test('1b · the store shell hides it from a free couple (the shell rule for every Pro control)', async () => {
  const shell = await paintRow({ ownsPro: false, hidePro: true, photoChoices: [{ ref: STD, url: 'https://x.test/a.jpg' }] });
  assert.equal(mediaChip(shell), '', 'no Pro pitch in the app-store shell');
});

test('1c · with media up, the panel offers the pictures AND the in-place upload', async () => {
  const html = await paintRow({
    ownsPro: false,
    canvas: { media: STD },
    photoChoices: [{ ref: STD, url: 'https://x.test/std.jpg' }],
    sceneUploads: [{ ref: CLIP, url: 'https://x.test/clip.mp4', kind: 'snippet', poster: STILL }],
  });
  assert.match(html, /data-inspector-row="scene-uploads"/);
  assert.match(html, /https:\/\/x\.test\/std\.jpg/, 'the Save the Date background is a thumbnail');
  assert.match(html, /▶ Clip/, 'a scene upload clip is a tile');
  assert.match(html, /data-inspector-row="scene-upload"/, 'the in-place upload is in the panel');
  assert.match(html, /data-scene-media-motion/, 'a photo gets Motion');
  const src = stripComments(read(`${EDITOR}/_components/scene-background-row.tsx`));
  assert.match(src, /<FileUpload[\s\S]*?compressImage[\s\S]*?compressVideo[\s\S]*?\/>/, 'the shipped FileUpload, compressed in the browser');
  assert.match(src, /pathPrefix=\{sceneBackgroundPathPrefix\(eventId\)\}/);
});

/* ── 2 · THE SAVE THE DATE BACKGROUND IS ONE OF THE PICTURES ────────────── */

test('2 · the Save the Date upload is offered — through the page\'s ONE signing pass — and Apply accepts it', () => {
  assert.equal(stdBackgroundUploadRef({ kind: 'upload', value: STD }), STD);
  assert.equal(stdBackgroundUploadRef({ kind: 'realistic', value: 'aurora' }), null, 'a library scene is not the couple\'s own photo');
  assert.equal(stdBackgroundUploadRef({ kind: 'upload', value: 'r2://setnayan-thread-files/x.jpg' }), null, 'held to the public bucket');
  const page = stripComments(read(`${EDITOR}/page.tsx`));
  const batch = /await Promise\.all\(\[\s*displayFor\(\[heroRef\]\),[\s\S]*?\]\);/.exec(page)?.[0] ?? '';
  assert.match(batch, /displayFor\(\[stdBgRef\]\)/, 'signed in the same Promise.all, not a second pass');
  assert.match(page, /const photoChoices = \[\.\.\.new Set\(\[heroRef, \.\.\.galleryRefs, stdBgRef\]\)\]/);
  assert.match(page, /stdBgDisplay\[ref\]/);
  const apply = stripComments(read('app/dashboard/[eventId]/website/hub-draft-actions.ts'));
  assert.match(apply, /siteMediaServeRef\(stdBackgroundUploadRef\(ownRow\.std_background\)\)/, 'Apply: "every photo is the couple\'s own" accepts it');
  assert.match(apply, /\.select\(`[^`]*std_background/);
});

test('2b · a scene\'s own upload lands in its own folder and Apply accepts only THIS event\'s', () => {
  const apply = stripComments(read('app/dashboard/[eventId]/website/hub-draft-actions.ts'));
  assert.match(apply, /const ownScenePrefix = `r2:\/\/\$\{PUBLIC_R2_BUCKET\}\/events\/\$\{eventId\}\/\$\{SCENE_BACKGROUND_FOLDER\}\/`/);
  assert.match(apply, /\[drafted\?\.media, drafted\?\.poster\]/, 'the clip\'s still is checked too');
  const refs = sceneUploadRefs(E, [
    { canvas: { media: OWN, mediaMotion: 'parallax' } },
    { canvas: { kind: 'snippet', media: CLIP, poster: STILL } },
    { canvas: { media: STD } },
    { canvas: { media: `r2://setnayan-media/events/OTHER/scene-background/x.jpg` } },
  ]);
  assert.deepEqual(refs, [
    { ref: OWN, kind: 'photo', poster: null },
    { ref: CLIP, kind: 'snippet', poster: STILL },
  ]);
  const route = read('app/api/upload/route.ts');
  assert.match(route, /'scene-background',\n\]\);/, 'counted on the couple\'s Maker media meter');
});

/* ── 3 · PARALLAX IS THE SHIPPED HERO PARALLAX ────────────────────────────── */

async function paintFrame(canvas: HubSectionCanvas, urls: Record<string, string>, ownClipPlays = false): Promise<string> {
  const { HubCanvasFrame } = await import('../app/[slug]/_components/hub-canvas-frame');
  return renderToStaticMarkup(
    React.createElement(
      HubCanvasFrame,
      { widget: { widget_type: 'countdown', config_json: { canvas } }, mediaUrls: urls, ownClipPlays } as never,
      React.createElement('p', null, 'words'),
    ),
  );
}

test('3 · a Parallax photo wears the SHIPPED parallax mark; Still does not', async () => {
  const still = await paintFrame({ media: OWN }, { [OWN]: 'https://x.test/a.jpg' });
  assert.doesNotMatch(still, /data-pahina-parallax/);
  const moving = await paintFrame({ media: OWN, mediaMotion: 'parallax' }, { [OWN]: 'https://x.test/a.jpg' });
  assert.match(moving, /<div aria-hidden="true" class="hub-canvas-media" data-pahina-parallax="">/);
  assert.match(moving, /class="hub-canvas [^"]*\bhub-bg-parallax\b/);
  /* The one script: it reads `[data-pahina-parallax]` under `.sn-editorial`
     on every frame and writes ONE property — nothing else writes it. */
  const motion = read('app/[slug]/_components/pahina-motion.tsx');
  assert.match(motion, /querySelectorAll\('\.sn-editorial \[data-pahina-parallax\]'\)/);
  const writers = [
    'app/[slug]/_components/hub-canvas-frame.tsx',
    'app/[slug]/_components/scene-bg-preview.ts',
    `${EDITOR}/_components/scene-background-row.tsx`,
  ].filter((p) => /setProperty\('--pahina-parallax'/.test(read(p)));
  assert.deepEqual(writers, [], 'no second parallax mechanism');
  /* The rule rides the same `.pahina-js` flag, folds in the zoom, and stands
     still under reduced motion. */
  const css = read('app/globals.css');
  assert.match(css, /\.pahina-js \.sn-editorial \.hub-canvas-media\[data-pahina-parallax\] \{\s*transform: translate3d\(0, var\(--pahina-parallax, 0%\), 0\) scale\(calc\(1\.16 \* var\(--hub-zoom, 1\)\)\);/);
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\) \{\s*\.pahina-js \.sn-editorial \.hub-canvas-media\[data-pahina-parallax\] \{\s*transform: scale\(var\(--hub-zoom, 1\)\);/,
  );
});

/* A tiny DOM — exactly what `applySceneBgPreview` touches (the pattern of
   `a-scene-background-previews-instantly.test.ts`). */
class El {
  className = '';
  children: El[] = [];
  parentNode: El | null = null;
  attrs: Record<string, string> = {};
  props = new Map<string, string>();
  constructor(public tagName: string) {}
  classList = { contains: (c: string) => this.className.split(/\s+/).includes(c) };
  style = {
    length: 0,
    item: (i: number) => [...this.props.keys()][i]!,
    setProperty: (p: string, v: string) => void this.props.set(p, v),
    removeProperty: (p: string) => void this.props.delete(p),
  };
  get firstChild(): El | null {
    return this.children[0] ?? null;
  }
  setAttribute(n: string, v: string) {
    this.attrs[n] = v;
  }
  removeAttribute(n: string) {
    delete this.attrs[n];
  }
  appendChild(c: El) {
    return this.insertBefore(c, null);
  }
  insertBefore(c: El, ref: El | null) {
    if (c.parentNode) c.parentNode.children.splice(c.parentNode.children.indexOf(c), 1);
    const i = ref ? this.children.indexOf(ref) : -1;
    if (i < 0) this.children.push(c);
    else this.children.splice(i, 0, c);
    c.parentNode = this;
    return c;
  }
  remove() {
    this.parentNode?.children.splice(this.parentNode.children.indexOf(this), 1);
    this.parentNode = null;
  }
}
const fakeDoc = { createElement: (t: string) => new El(t.toUpperCase()) } as unknown as Pick<Document, 'createElement'>;

test('3b · the Maker canvas turns Parallax on in place — the bridge marks the layer from the frame class', async () => {
  const { applySceneBgPreview } = await import('../app/[slug]/_components/scene-bg-preview');
  const parent = new El('DIV');
  const scene = parent.appendChild(new El('SECTION'));
  const vars = { '--hub-media': 'url("https://x.test/a.jpg")' };
  const on = { key: 'w:countdown', classes: ['hub-has-media', 'hub-bg-photo', 'hub-bg-parallax'], vars };
  const frame = applySceneBgPreview(scene as unknown as HTMLElement, on, fakeDoc) as unknown as El;
  const layer = () => frame.children.find((c) => c.className === 'hub-canvas-media')!;
  assert.equal(layer().attrs['data-pahina-parallax'], '', 'Parallax marks the photo layer at once');
  const off = { key: 'w:countdown', classes: ['hub-has-media', 'hub-bg-photo'], vars };
  applySceneBgPreview(frame as unknown as HTMLElement, off, fakeDoc);
  assert.equal('data-pahina-parallax' in layer().attrs, false, 'Still takes it off');
});

test('3c · Parallax is kept only beside a photo, travels with it, and is Pro like the photo', () => {
  assert.equal(sanitizeHubCanvas({ canvas: { media: OWN, mediaMotion: 'parallax' } }).mediaMotion, 'parallax');
  assert.equal(sanitizeHubCanvas({ canvas: { kind: 'snippet', media: CLIP, mediaMotion: 'parallax' } }).mediaMotion, undefined);
  assert.equal(sanitizeHubCanvas({ canvas: { kind: 'color', color: '#aabbcc', mediaMotion: 'parallax' } }).mediaMotion, undefined);
  assert.equal(sanitizeHubCanvas({ canvas: { media: OWN, mediaMotion: 'wobble' } }).mediaMotion, undefined);
  const glass = withBackground({ media: OWN, mediaMotion: 'parallax' }, { kind: 'glass' }, false);
  assert.equal(glass.mediaMotion, undefined, 'a new background takes the old one\'s motion with it');
});

/* ── 4 · A FREE COUPLE'S MEDIA STAYS IN THE DRAFT ─────────────────────────── */

const LIVE: HubLiveState = {
  events: {},
  widgets: [{ widget_id: 'W1', widget_type: 'countdown', is_always_on: false, display_order: 1, config_json: null, mode: 'auto' }],
};
const drafting = (canvas: HubSectionCanvas): HubDraftState => ({ events: {}, widgets: { countdown: { canvas } } });

test('4 · a free couple drafts media + Parallax + a clip; Apply holds every one of them, a Pro couple publishes', () => {
  for (const canvas of [
    { media: OWN },
    { media: OWN, mediaMotion: 'parallax' as const },
    { kind: 'snippet' as const, media: CLIP, poster: STILL },
  ]) {
    const free = planHubDraftApply(drafting(sanitizeHubCanvas({ canvas })), LIVE, false);
    const published = free.apply.map((i) => JSON.stringify(i.value));
    assert.ok(!published.some((v) => /scene-background/.test(v)), `media reached live for a free couple: ${published}`);
    assert.equal(free.refused.length, 1, 'held in the draft');
    const pro = planHubDraftApply(drafting(sanitizeHubCanvas({ canvas })), LIVE, true);
    assert.equal(pro.refused.length, 0, 'a Pro couple publishes it');
  }
  // The free half of a held scene never carries the Pro keys.
  const free = canvasFreePart({}, sanitizeHubCanvas({ canvas: { media: OWN, mediaMotion: 'parallax', shape: 'full' } }));
  assert.equal(free.media, undefined);
  assert.equal(free.mediaMotion, undefined);
  const heldClip = canvasFreePart({}, sanitizeHubCanvas({ canvas: { kind: 'snippet', media: CLIP, poster: STILL } }));
  assert.equal(heldClip.poster, undefined);
  // Parallax added to a photo that is ALREADY live is still Pro.
  const onLive = planHubDraftApply(
    drafting({ media: OWN, mediaMotion: 'parallax' }),
    { ...LIVE, widgets: [{ ...LIVE.widgets[0]!, config_json: { canvas: { media: OWN } } }] },
    false,
  );
  assert.equal(onLive.refused.length, 1, 'Parallax on a live photo waits for Pro');
});

test('4b · the draft save takes media from a free couple (no Pro check on save)', () => {
  const src = stripComments(read('app/dashboard/[eventId]/website/hub-draft-actions.ts'));
  const save = src.slice(src.indexOf("if (intent === 'save')"), src.indexOf("if (intent === 'reset')"));
  assert.doesNotMatch(save, /lookProAllows|ownsPro/, 'saving into the draft is never gated');
});

/* ── 5 · A CLIP PLAYS FOR THE COUPLE, NEVER FOR A GUEST (SEC-6) ──────────── */

test('5 · a guest never gets the clip — they see its still; the couple\'s Maker canvas plays it', async () => {
  const urls = { [CLIP]: 'https://x.test/clip.mp4', [STILL]: 'https://x.test/still.jpg' };
  const canvas = { kind: 'snippet' as const, media: CLIP, poster: STILL };
  const guest = sceneGround({ config_json: { canvas } }, urls);
  assert.equal(guest.bg?.kind, 'photo', 'the guest gets the still as a photo');
  assert.equal(guest.mediaUrl, 'https://x.test/still.jpg');
  assert.equal(guest.painted, true, 'the scene still owns its box');
  const host = sceneGround({ config_json: { canvas } }, urls, { ownClipPlays: true });
  assert.equal(host.bg?.kind, 'snippet');
  assert.equal(host.mediaUrl, 'https://x.test/clip.mp4');
  // Same box either way: the card never flips between the Maker and the page.
  assert.equal(sceneWidgetIsBare({ config_json: { canvas } }, urls), sceneWidgetIsBare({ config_json: { canvas } }, urls, { ownClipPlays: true }));

  const guestHtml = await paintFrame(canvas, urls);
  assert.doesNotMatch(guestHtml, /<video/, 'no unscreened clip reaches a guest');
  assert.match(guestHtml, /still\.jpg/);
  const hostHtml = await paintFrame(canvas, urls, true);
  assert.match(hostHtml, /<video[^>]*class="hub-canvas-media"[^>]*>/);
  const video = /<video[^>]*>/.exec(hostHtml)![0];
  assert.match(video, /\bloop=""/);
  assert.match(video, /\bplaysInline=""|\bplaysinline=""/i);
  assert.doesNotMatch(video, /\bcontrols\b/);
  // Paused off-screen and under reduced motion — the shipped SceneClip.
  const clip = read('app/[slug]/_components/scene-clip.tsx');
  assert.match(clip, /new IntersectionObserver/);
  assert.match(clip, /prefers-reduced-motion: reduce/);
});

test('5b · only the verified Maker canvas turns the clip on; every other caller is a guest', () => {
  const body = stripComments(read('app/[slug]/_components/site-body.tsx'));
  const passes = body.match(/ownClipPlays=\{[^}]*\}/g) ?? [];
  assert.ok(passes.length >= 2, 'both dispatchers are told');
  for (const p of passes) assert.equal(p, 'ownClipPlays={isMakerCanvas}');
  assert.match(body, /const isMakerCanvas = isEditorCanvas && editorBridge;/);
  for (const f of ['hideable-widget-render.tsx', 'public-hideable-widget.tsx', 'hub-canvas-frame.tsx']) {
    const src = stripComments(read(`app/[slug]/_components/${f}`));
    assert.match(src, /ownClipPlays = false,/, `${f}: absent means a guest`);
  }
  // No still stored → a guest sees no picture (the old, honest fallback).
  const bare = sceneGround({ config_json: { canvas: { kind: 'snippet', media: CLIP } } }, { [CLIP]: 'https://x.test/c.mp4' });
  assert.equal(bare.mediaUrl, null);
  assert.equal(resolveHubBackground(bare.canvas)?.kind, 'snippet');
});
