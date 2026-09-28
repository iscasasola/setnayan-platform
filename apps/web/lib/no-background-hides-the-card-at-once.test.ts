/**
 * no-background-hides-the-card-at-once.test.ts — 🖼 "NO BACKGROUND" TAKES THE
 * WIDGET'S OWN CARD OFF THE MAKER CANVAS AT ONCE, AND WHAT IT DRAWS IS EXACTLY
 * WHAT THE RELOAD DRAWS.
 *
 * Owner, 2026-09-28, on #6073 (the card went only after the save's reload,
 * ~2–3 s): *"yes must be instant"*. So the Maker tells the canvas the server's
 * own answer (`sceneCardBareFor` → `sceneWidgetIsBare`) in the `sceneBg`
 * message, and the bridge swaps the card with the server's own class strings
 * (`lib/scene-card-look.ts` `applySceneCardPreview`). The reload still runs
 * (`no-background-drops-the-card.test.ts`) and still decides.
 *
 * What this proves:
 *   1. CONVERGENCE — the instant swap, applied to the server's HTML for the old
 *      answer, yields BYTE-FOR-BYTE the server's HTML for the new answer, both
 *      directions, for every widget that draws a card (Countdown with its four
 *      tiles, Photo moments, Tier comparison) and inside a scene frame;
 *   2. ONE SOURCE — every `data-scene-card` in the guest components takes its
 *      classes from `sceneCardClass`, so no widget can drift from the table;
 *   3. THE MESSAGE — carries the server's answer for the new canvas, never a
 *      guess (an unresolvable photo leaves it out), and survives sanitising
 *      only as a boolean;
 *   4. THE WIRING — the row sends the uploads' URL map, the bridge swaps.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sanitizeHubCanvas, type HubSectionCanvas } from './hub-canvas';
import { INVITE_THEMES } from './invite-themes';
import { SCENE_CARD_LOOKS, applySceneCardPreview, type SceneCardNode } from './scene-card-look';
import { sceneWidgetIsBare } from './scene-ground';
import { withBackground } from './scene-background-scope';
import { stripComments } from './strip-comments';
import { eventWordsFromProfile } from '../app/[slug]/_lib/event-words';
import { CountdownWidget } from '../app/[slug]/_components/countdown';
import { PhotoMomentsWidget } from '../app/[slug]/_components/photo-moments-widget';
import { TierComparisonWidget } from '../app/[slug]/_components/tier-comparison-widget';
import { HubCanvasFrame } from '../app/[slug]/_components/hub-canvas-frame';
import { sanitizeSceneBgPreview } from '../app/[slug]/_components/scene-bg-preview';
import { sceneBgPreviewMessage } from '../app/dashboard/[eventId]/website/editor/_components/scene-bg-preview-message';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/* ── a tiny DOM parsed from the server's own HTML, serialised back byte-for-byte ── */

const VOID = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'wbr', 'area', 'col', 'embed', 'track']);
class Node implements SceneCardNode {
  attrs: Array<[string, string | null]> = [];
  children: Array<Node | string> = [];
  constructor(public tag: string) {}
  get className() {
    return this.getAttribute('class') ?? '';
  }
  set className(v: string) {
    this.setAttribute('class', v);
  }
  getAttribute(n: string) {
    const a = this.attrs.find((x) => x[0] === n);
    return a ? (a[1] ?? '') : null;
  }
  setAttribute(n: string, v: string) {
    const a = this.attrs.find((x) => x[0] === n);
    if (a) a[1] = v;
    else this.attrs.push([n, v]);
  }
  private all(): Node[] {
    return this.children.flatMap((c) => (typeof c === 'string' ? [] : [c, ...c.all()]));
  }
  querySelectorAll(sel: string): Node[] {
    if (sel === '[data-scene-card]') return this.all().filter((n) => n.getAttribute('data-scene-card') !== null);
    if (/^[a-z]+$/.test(sel)) return this.all().filter((n) => n.tag === sel);
    throw new Error(`the tiny DOM does not know "${sel}" — applySceneCardPreview asked for something new`);
  }
  querySelector(sel: string) {
    return this.querySelectorAll(sel)[0] ?? null;
  }
  html(): string {
    const a = this.attrs.map(([k, v]) => (v === null ? ` ${k}` : ` ${k}="${v}"`)).join('');
    if (VOID.has(this.tag)) return `<${this.tag}${a}/>`;
    return `<${this.tag}${a}>${this.children.map((c) => (typeof c === 'string' ? c : c.html())).join('')}</${this.tag}>`;
  }
}
function parse(html: string): Node {
  const root = new Node('#root');
  const stack = [root];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s=/>]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const top = stack[stack.length - 1]!;
    if (m[5] !== undefined) {
      top.children.push(m[5]);
      continue;
    }
    if (m[1]) {
      assert.equal(stack.pop()!.tag, m[2], 'the tiny DOM mis-nested the HTML');
      continue;
    }
    const n = new Node(m[2]!);
    for (const a of (m[3] ?? '').matchAll(/([^\s=/>]+)(?:="([^"]*)")?/g)) n.attrs.push([a[1]!, a[2] ?? null]);
    top.children.push(n);
    if (!VOID.has(n.tag) && !m[4]) stack.push(n);
  }
  assert.equal(stack.length, 1, 'the tiny DOM left an element open');
  assert.equal(root.children.map((c) => (typeof c === 'string' ? c : c.html())).join(''), html, 'anti-vacuity: the tiny DOM round-trips the server HTML');
  return root;
}
const serialise = (root: Node) => root.children.map((c) => (typeof c === 'string' ? c : c.html())).join('');

const WORDS = eventWordsFromProfile({
  terminology: { organizerNoun: 'couple', eventWord: 'wedding', occasionNoun: 'celebration', register: 'celebratory', personB: 'Ben', celebrantShape: 'pair' },
} as never);

/** Every widget that draws a card of its own, as the dispatchers mount it. */
const WIDGETS: Array<[string, (bare: boolean) => React.ReactElement]> = [
  ['Countdown', (bare) => React.createElement(CountdownWidget, { targetIso: '2099-12-12', bare })],
  ['Photo moments (none yet)', (bare) => React.createElement(PhotoMomentsWidget, { config: {}, words: WORDS, bare })],
  [
    'Photo moments',
    (bare) =>
      React.createElement(PhotoMomentsWidget, {
        config: { intro_copy: 'Our favourites', moments: [{ title: 'The first look', time_label: '2:00 PM' }] },
        words: WORDS,
        bare,
      }),
  ],
  ['Tier comparison (+1)', (bare) => React.createElement(TierComparisonWidget, { limited: true, eventNoun: 'wedding', words: WORDS, bare })],
  ['Tier comparison', (bare) => React.createElement(TierComparisonWidget, { limited: false, eventNoun: 'wedding', words: WORDS, bare })],
];

/* ═══ 1 · CONVERGENCE — the instant card IS the reload's card ═══ */

test('the swap turns the server’s card into exactly what the reload renders — both ways, every widget', () => {
  for (const [name, make] of WIDGETS) {
    const own = renderToStaticMarkup(make(false));
    const bare = renderToStaticMarkup(make(true));
    assert.notEqual(own, bare, `${name}: anti-vacuity — the two answers render differently`);
    assert.match(own, /data-scene-card="own"/, `${name}: anti-vacuity — a card`);

    const off = parse(own);
    assert.equal(applySceneCardPreview(off, true), true, `${name}: the swap did nothing`);
    assert.equal(serialise(off), bare, `${name}: No background — the instant canvas differs from the reload`);

    const on = parse(bare);
    assert.equal(applySceneCardPreview(on, false), true, `${name}: the reverse swap did nothing`);
    assert.equal(serialise(on), own, `${name}: the card coming back differs from the reload`);

    // Same answer twice: nothing moves.
    const same = parse(bare);
    assert.equal(applySceneCardPreview(same, true), false);
    assert.equal(serialise(same), bare);
  }
});

test('the Countdown’s four per-number tiles go with the card at once, and come back with it', () => {
  const tiles = (html: string) => (html.match(/class="rounded-lg border border-ink\/10 bg-paper py-3"/g) ?? []).length;
  const own = renderToStaticMarkup(React.createElement(CountdownWidget, { targetIso: '2099-12-12', bare: false }));
  assert.equal(tiles(own), 4, 'anti-vacuity: four tiles on the card');
  const dom = parse(own);
  applySceneCardPreview(dom, true);
  assert.equal(tiles(serialise(dom)), 0, 'a tile survived "No background"');
  assert.doesNotMatch(serialise(dom), /\bborder\b/, 'no border anywhere');
  applySceneCardPreview(dom, false);
  assert.equal(tiles(serialise(dom)), 4);
});

test('inside a scene frame (what the navigator marker points at), the card underneath is swapped', () => {
  const canvas = sanitizeHubCanvas({ canvas: withBackground({}, { kind: 'color', color: '#8a1c2b' }, false) });
  const widget = { widget_id: 'w', widget_type: 'countdown', is_visible: true, display_order: 1, config_json: { canvas } } as never;
  const framed = (bare: boolean) =>
    renderToStaticMarkup(React.createElement(HubCanvasFrame, { widget } as never, React.createElement(CountdownWidget, { targetIso: '2099-12-12', bare })));
  const dom = parse(framed(false));
  const frame = dom.children[0] as Node;
  assert.match(frame.className, /\bhub-canvas\b/, 'anti-vacuity: the marker points at the frame');
  applySceneCardPreview(frame, true);
  assert.equal(serialise(dom), framed(true));
});

test('a card the table does not recognise is left for the reload — never guessed', () => {
  const dom = parse('<section data-scene-card="own" class="rounded-3xl border p-9">x</section>');
  assert.equal(applySceneCardPreview(dom, true), false);
  assert.equal(serialise(dom), '<section data-scene-card="own" class="rounded-3xl border p-9">x</section>');
  assert.equal(applySceneCardPreview(parse('<section class="p-6">no card</section>'), true), false);
});

/* ═══ 2 · ONE SOURCE — no widget writes its card classes by hand ═══ */

test('every data-scene-card in the guest components takes its classes from sceneCardClass', () => {
  const dir = join(WEB, 'app/[slug]/_components');
  let cards = 0;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.tsx'))) {
    const src = read(`app/[slug]/_components/${f}`);
    for (const m of src.matchAll(/data-scene-card=\{[^}]*\}\s*className=\{([^}]*\})?[^}]*\}/g)) {
      cards += 1;
      assert.match(m[0], /className=\{sceneCardClass\('(countdown|card)', bare\)\}/, `${f}: a card with hand-written classes — ${m[0]}`);
    }
  }
  assert.ok(cards >= 6, `anti-vacuity: found ${cards} cards (Countdown, the generic card, Photo moments ×2, Tier comparison ×2)`);
  assert.match(read('app/[slug]/_components/countdown.tsx'), /className=\{sceneCardTileClass\(bare\)\}/, 'the Countdown tile must come from the table');
  // The looks are told apart by their class strings — they must all differ.
  const strings = Object.values(SCENE_CARD_LOOKS).flatMap((l) => [l.own, l.bare]);
  assert.equal(new Set(strings).size, strings.length);
});

/* ═══ 3 · THE MESSAGE ═══ */

const theme = INVITE_THEMES.house;
const noUrl = () => null;
test('the sceneBg message carries the server’s own answer for the new canvas — and nothing it cannot answer', () => {
  const cases: Array<[string, HubSectionCanvas]> = [
    ['no background at all', {}],
    ['No background', withBackground({}, { kind: 'none' }, false)],
    ['Plain', withBackground({}, { kind: 'color', color: '#8a1c2b' }, false)],
    ['Frosted', withBackground({}, { kind: 'frost', color: '#f4ecdd', opacity: 40 }, false)],
  ];
  for (const [name, canvas] of cases) {
    const [scene] = sceneBgPreviewMessage([{ type: 'countdown', canvas }], noUrl, theme, {}).scenes;
    assert.equal(scene!.bare, sceneWidgetIsBare({ config_json: { canvas } }, {}), `${name}: not the server’s answer`);
  }
  assert.equal(sceneBgPreviewMessage([{ type: 'countdown', canvas: {} }], noUrl, theme, {}).scenes[0]!.bare, false, 'anti-vacuity: the card');
  assert.equal(sceneBgPreviewMessage([{ type: 'countdown', canvas: withBackground({}, { kind: 'none' }, false) }], noUrl, theme, {}).scenes[0]!.bare, true);
  // A photo the Maker holds no URL for: left out, never guessed.
  const photo = withBackground({}, { media: 'r2://setnayan-media/unknown.jpg' }, false);
  assert.equal('bare' in sceneBgPreviewMessage([{ type: 'countdown', canvas: photo }], noUrl, theme, {}).scenes[0]!, false);
  // Without the URL map (the opacity slider's live preview) nothing is claimed either.
  assert.equal('bare' in sceneBgPreviewMessage([{ type: 'countdown', canvas: {} }], noUrl, theme).scenes[0]!, false);
  // Sanitised: only a boolean survives.
  assert.equal(sanitizeSceneBgPreview([{ key: 'w:countdown', classes: [], vars: {}, bare: true }])[0]!.bare, true);
  assert.equal('bare' in sanitizeSceneBgPreview([{ key: 'w:countdown', classes: [], vars: {}, bare: 'yes' }])[0]!, false);
});

/* ═══ 4 · THE WIRING ═══ */

test('the row sends the uploads’ URL map; the bridge swaps the card after laying the frame', () => {
  const row = read('app/dashboard/[eventId]/website/editor/_components/scene-background-row.tsx');
  const save = row.slice(row.indexOf('const save = ('), row.indexOf('const put = '));
  assert.match(save, /sceneBgPreviewMessage\(\s*Object\.entries\(canvases\)[\s\S]*?mediaUrl,\s*theme,\s*mediaUrls,\s*\)/);
  const msg = read('app/dashboard/[eventId]/website/editor/_components/scene-bg-preview-message.ts');
  assert.match(msg, /const bare = mediaUrls \? sceneCardBareFor\(canvas, mediaUrls\) : null;/, 'the message asks the one function');
  const preview = read('app/dashboard/[eventId]/website/editor/_components/element-preview.ts');
  const fn = preview.slice(preview.indexOf('export function sceneCardBareFor'), preview.indexOf('export function canvasesFingerprint'));
  // The Maker canvas is the couple's own — their clip plays there (`ownClipPlays`).
  assert.match(fn, /return sceneWidgetIsBare\(\{ config_json: \{ canvas \} \}, mediaUrls, \{ ownClipPlays: true \}\);/);
  const bridge = read('app/[slug]/_components/editor-bridge.tsx');
  const at = bridge.indexOf("data.t === 'sceneBg'");
  const onBg = bridge.slice(at, bridge.indexOf('return;', at));
  assert.ok(onBg.includes('applySceneBgPreview('), 'anti-vacuity: the sceneBg branch');
  assert.ok(onBg.indexOf('applySceneBgPreview(') < onBg.indexOf('applySceneCardPreview('), 'the frame first, then the card inside it');
  assert.match(onBg, /applySceneCardPreview\(framed, scene\.bare\)/);
});
