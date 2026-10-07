/**
 * 🖼 EVERY LOOK DRAWS A PICTURE, AND NO ANIMATE ROW IS A LONE ⓘ (owner's preview check, 2026-10-07:
 * the Countdown's "Big number" look was an EMPTY tile; Build out carried a row holding only an ⓘ).
 *
 *   1. Every style the registry lists for a scene whose miniature draws itself (`STYLE_RENDERERS`) renders
 *      non-empty, with the part's real kind of content — the countdown its count, a message its words.
 *   2. A look the part does not wear is drawn into a CLEAN copy of the canvas's document (`asMount`), never
 *      into the copied section, whose frame left "Big number" blank.
 *   3. No Animate segment (Build in · Action · Build out) renders a row whose only content is an ⓘ.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { sceneStyleSet } from './scene-styles';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const PANEL = '../app/dashboard/[eventId]/launch/_components/stage-panel';
const FACTS = { targetIso: '2026-12-12', bare: false, text: 'We cannot wait to celebrate with you. Come as you are.', signedBy: 'Maria & Jose' };

test('every registered look of a self-drawing scene renders a non-empty picture', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { STYLE_RENDERERS } = await import(`${PANEL}/style-renderers`);
  const types = Object.keys(STYLE_RENDERERS);
  assert.ok(types.includes('countdown'), 'the countdown draws its own looks');
  for (const type of types) {
    const set = sceneStyleSet(type);
    assert.ok(set, `${type} is a registered scene`);
    for (const st of set!.styles) {
      const el = STYLE_RENDERERS[type]!(st.id, FACTS);
      assert.ok(el, `${type} › ${st.name}: a renderer answers`);
      const html = renderToStaticMarkup(el);
      const text = html.replace(/<[^>]+>/g, '').trim();
      assert.ok(text.length > 4, `${type} › ${st.name}: the picture is empty`);
      if (type === 'countdown') assert.match(text, /until|day|––/i, `${type} › ${st.name}: no count drawn`);
      else assert.match(text, /celebrate/, `${type} › ${st.name}: the words are not drawn`);
    }
  }
});

test('a look the part does not wear is drawn into a clean mount, never into the copied section', () => {
  const src = readFileSync(join(WEB, 'app/dashboard/[eventId]/launch/_components/stage-panel/style-preview.tsx'), 'utf8');
  assert.match(src, /mode === 'render' \? asMount\(live\.snap\) : live\.snap/);
  assert.doesNotMatch(src, /withMount\(/, 'the old in-section mount is gone');
});

test('no Animate segment renders a row holding only an ⓘ', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StageAnimate } = await import(`${PANEL}/stage-animate`);
  const { setStageAnimatePhase } = await import(`${PANEL}/store`);
  const dd = { value: 'auto', options: [{ key: 'auto', label: 'Auto' }], onPick: () => {} };
  const time = { value: 1.1, steps: [0.6, 1.1, 1.8], onPick: () => {} };
  for (const phase of ['in', 'act', 'out'] as const) {
    setStageAnimatePhase(phase);
    const html = renderToStaticMarkup(
      React.createElement(StageAnimate, {
        how: dd,
        inFx: { fade: true },
        outFx: null,
        onIn: () => {},
        onOut: () => {},
        rows: dd,
        duration: time,
        delay: time,
        does: { ...dd, note: 'Nothing happens while it is on screen' },
        timing: dd,
        next: dd,
        pro: 'Event Hub Pro',
      }),
    );
    /* Each 44 px row of the pane: its markup, split at the pane's direct row openings. */
    const rows = html.split(/(?=<div class="flex h-11 )/).slice(1);
    assert.ok(rows.length >= 2, `${phase}: rows were found`);
    for (const r of rows) {
      const withoutAbout = r.replace(/<span[^>]*data-stage-about=""[\s\S]*?<\/span><\/span>/g, '');
      const visible = withoutAbout.replace(/<[^>]+>/g, '').trim();
      const controls = /<(button|input)\b/.test(withoutAbout);
      assert.ok(visible.length > 0 || controls, `${phase}: a row holds only an ⓘ — ${r.slice(0, 120)}`);
    }
  }
  setStageAnimatePhase('in');
});

test('the countdown’s reading is read off its text as the page draws it — digits run into their units', async () => {
  const { readFacts } = await import(`${PANEL}/style-renderers`);
  const fake = { textContent: 'Until we say ‘I do’65Days02Hours44Mins53Secs', querySelector: () => null } as unknown as HTMLElement;
  const f = readFacts(fake);
  assert.ok(f.targetIso, 'a target date is read from "65Days02Hours…"');
  const days = Math.round((Date.parse(f.targetIso!) - Date.now()) / 86_400_000);
  assert.ok(days >= 64 && days <= 67, `the target is ~65 days out (${days})`);
});
