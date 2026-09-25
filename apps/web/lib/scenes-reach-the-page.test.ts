/**
 * scenes-reach-the-page.test.ts — A TEMPLATE SCENE RENDERS, AND ITS WORDS READ.
 *
 * RENDERS `renderScene` (the guest renderer other builders call — Phase 7's
 * Love Story moments included) and `HubCanvasFrame`, because a correct
 * contract that never reaches the page is the defect this programme keeps
 * finding. Build plan Phase 5 tests: "a scene with a near-black colour
 * background renders light ink and one with cream renders dark ink for a free
 * event (the tone is not behind any Pro check — assert on the gate, not the
 * copy)".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PUBLIC_R2_BUCKET } from './r2-client-ref';
import { SCENE_TEMPLATES, SCENE_TEMPLATE_IDS, sceneTemplateClass } from './scene-templates';
import { INVITE_THEMES, INVITE_THEME_IDS } from './invite-themes';
import { relativeLuminance, contrastRatio, AA_BODY } from './hub-legibility';
import { sceneLegibility } from './scene-legibility';
import { sanitizeHubCanvas } from './hub-canvas';
import { stripComments } from './strip-comments';

const REF = (n: number) => `r2://${PUBLIC_R2_BUCKET}/events/E1/p${n}.jpg`;
const URLS = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [REF(i), `https://cdn.test/p${i}.jpg`]));
const FACTS = {
  names: 'Ana & Ben',
  monogram: 'A & B',
  daysToGo: 85,
  specialMessage: 'We cannot wait to celebrate with you.',
  milestones: [{ head: '2019', text: 'We met' }],
};

async function load() {
  const React = (await import('react')).default;
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { renderScene } = await import('../app/[slug]/_components/scene-template');
  const { HubCanvasFrame } = await import('../app/[slug]/_components/hub-canvas-frame');
  return { React, renderToStaticMarkup, renderScene, HubCanvasFrame };
}

function fullCanvas(id: number) {
  const t = SCENE_TEMPLATES[id as 1];
  const slots = Array.from({ length: Math.max(t.media, t.blocks) }, (_, i) => ({
    ...(i < t.media ? { media: REF(i) } : {}),
    ...(i < t.blocks ? { head: `Q${i}`, text: `A${i}` } : {}),
  }));
  return sanitizeHubCanvas({ canvas: { template: id, ...(slots.length ? { slots } : {}) } });
}

test('⭐ all 25 render: one <section> carrying the template class, its parts as direct children', async () => {
  const { renderToStaticMarkup, renderScene } = await load();
  for (const id of SCENE_TEMPLATE_IDS) {
    const el = renderScene({ canvas: fullCanvas(id), words: { title: 'Heading', body: 'Body words' }, mediaUrls: URLS, facts: FACTS });
    assert.ok(el, `#${id} renders`);
    const html = renderToStaticMarkup(el);
    assert.ok(html.startsWith(`<section class="${sceneTemplateClass(id)}" data-scene-template="${id}">`), `#${id}: ${html.slice(0, 120)}`);
    assert.equal((html.match(/<section/g) ?? []).length, 1, `#${id} is ONE section`);
    const t = SCENE_TEMPLATES[id];
    assert.equal((html.match(/class="hub-tpl-m"/g) ?? []).length, t.media, `#${id} draws every filled picture slot`);
    assert.equal((html.match(/class="hub-tpl-b"/g) ?? []).length, t.blocks, `#${id} draws every filled word block`);
  }
});

test('⛔ an empty template scene renders NOTHING — no empty boxes on a wedding page', async () => {
  const { renderScene } = await load();
  for (const id of [1, 13, 17, 21, 22] as const) {
    assert.equal(renderScene({ canvas: { template: id }, words: { title: '', body: '' }, facts: FACTS }), null, `#${id}`);
  }
  // A picture whose signing failed is not a picture.
  assert.equal(
    renderScene({ canvas: { template: 13, slots: [{ media: REF(0) }] }, words: { title: '', body: '' }, mediaUrls: {}, facts: FACTS }),
    null,
  );
});

test('⭐ the four built on shipped parts print REAL words — names, the days, the monogram, the message', async () => {
  const { renderToStaticMarkup, renderScene } = await load();
  const html = (id: 10 | 11 | 12 | 16 | 24) =>
    renderToStaticMarkup(renderScene({ canvas: { template: id }, words: { title: '', body: '' }, facts: FACTS })!);
  assert.match(html(10), /Ana &amp; Ben/);
  assert.match(html(12), />85</);
  assert.match(html(12), /days to go/);
  assert.match(html(16), /A &amp; B/);
  assert.match(html(11), /We cannot wait to celebrate with you\./);
  assert.match(html(24), /2019[\s\S]*We met/);
  // After the day there is no number to show, and the scene says nothing rather than "0" or "-3".
  assert.equal(renderScene({ canvas: { template: 12 }, words: { title: '', body: '' }, facts: { ...FACTS, daysToGo: null } }), null);
});

test('🔒 the couple’s words are text, never markup', async () => {
  const { renderToStaticMarkup, renderScene } = await load();
  const html = renderToStaticMarkup(
    renderScene({ canvas: { template: 8 }, words: { title: '<b>x</b>', body: '<script>alert(1)</script>' }, facts: FACTS })!,
  );
  assert.doesNotMatch(html, /<script|<b>/);
});

test('🎬 a clip slot loops silently by default; a tap-to-play clip waits behind ▶', async () => {
  const { renderToStaticMarkup, renderScene } = await load();
  const clip = { template: 14 as const, slots: [{ media: REF(0), kind: 'snippet' as const }] };
  const loop = renderToStaticMarkup(renderScene({ canvas: clip, words: { title: '', body: '' }, mediaUrls: URLS, facts: FACTS })!);
  // (React does not serialise `muted` into server HTML; the prop is on the element.)
  assert.match(loop, /<video[^>]*loop=""/i);
  assert.match(loop, /playsinline=""/i);
  assert.doesNotMatch(loop, /autoplay|controls/i, 'no autoplay attribute — it plays only on screen, never under reduced motion');
  const tap = renderToStaticMarkup(
    renderScene({ canvas: { ...clip, video: { play: 'tap' } }, words: { title: 'Our first dance', body: '' }, mediaUrls: URLS, facts: FACTS })!,
  );
  assert.match(tap, /class="hub-tpl-play"[^>]*aria-label="Play: Our first dance"/);
  assert.doesNotMatch(tap, /loop=""/i, 'a tap-to-play video is not a loop');
});

/* ══ READABLE FOR EVERYONE, NEVER PRO ══════════════════════════════════════ */

test('🔤 near-black ground → light ink; cream ground → dark ink — rendered on the frame', async () => {
  const { React, renderToStaticMarkup, HubCanvasFrame } = await load();
  const Frame = HubCanvasFrame as unknown as React.FunctionComponent<Record<string, unknown>>;
  const render = (color: string) =>
    renderToStaticMarkup(
      React.createElement(
        Frame,
        { widget: { widget_id: 'w', widget_type: 'custom_1', config_json: { canvas: { kind: 'color', color, template: 8 } } } },
        React.createElement('section', null, 'words'),
      ),
    );
  const inkOf = (html: string) => {
    const m = /--color-ink:(\d+) (\d+) (\d+)/.exec(html);
    assert.ok(m, 'the frame sets the ink token');
    return `#${[m[1], m[2], m[3]].map((c) => Number(c).toString(16).padStart(2, '0')).join('')}`;
  };
  assert.ok(relativeLuminance(inkOf(render('#111111'))) > 0.5, 'light ink on near-black');
  assert.ok(relativeLuminance(inkOf(render('#f5efe6'))) < 0.2, 'dark ink on cream');
});

test('🔤 every theme × a light and a dark ground: body text clears AA', () => {
  for (const id of INVITE_THEME_IDS) {
    for (const ground of ['#111111', '#f5efe6', '#7a1f3d', '#d9c3a0']) {
      const leg = sceneLegibility(INVITE_THEMES[id], ground);
      assert.ok(contrastRatio(leg.ink, ground) >= AA_BODY, `${id} on ${ground}: ${contrastRatio(leg.ink, ground).toFixed(2)}`);
    }
  }
});

test('⛔ the tone is behind NO Pro check — the gate, not the copy', () => {
  // The frame and the rule take no entitlement input and import no entitlement reader.
  // Comments are stripped first: both files SAY "no entitlement", and a guard
  // that fires on the documentation of the rule agrees with itself forever.
  for (const file of ['lib/scene-legibility.ts', 'app/[slug]/_components/hub-canvas-frame.tsx']) {
    const code = stripComments(readFileSync(join(__dirname, '..', file), 'utf8'));
    assert.doesNotMatch(code, /couple-website-pro|entitlements|hub-look-gate|hub-look-pro|scrubAllowed|ownsPro/, file);
  }
});
