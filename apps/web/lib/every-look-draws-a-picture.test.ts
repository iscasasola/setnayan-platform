/**
 * 🖼 NO ANIMATE ROW IS A LONE ⓘ, AND NO LOOK IS AN EMPTY TILE (owner's preview check, 2026-10-07: Build out
 * carried a row holding only an ⓘ; the Countdown's "Big number" look was an empty tile).
 *
 *   1. No Animate segment (Build in · Action · Build out) renders a row whose only content is an ⓘ.
 *   2. Every look card is the guest page itself, asked for that part in that style (`stylePreviewSrc`,
 *      `?only=&style=`), and a card that finds nothing says so (`data-style-preview="empty"`) — never a
 *      silent blank. Every look of every part is built from the ONE registry (`sceneStyleOptions`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;

const PANEL = '../app/dashboard/[eventId]/launch/_components/stage-panel';

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


test('every look card asks the page for its own style, and a card that finds nothing says so', async () => {
  const { stylePreviewSrc } = await import(`${PANEL}/style-preview`);
  const { sceneStyleOptions } = await import('./scene-styles');
  const ids = sceneStyleOptions('countdown', 'rsvp', 'wedding').map((o: { id: string }) => o.id);
  assert.ok(ids.length >= 3, 'the countdown offers its looks');
  const srcs = ids.map((id: string) => stylePreviewSrc('/maria-and-jose?phase=rsvp&editor=1', 'w:countdown', 'countdown', id, 'http://x.test'));
  assert.equal(new Set(srcs).size, ids.length, 'each look is its own page');
  for (const [i, s] of srcs.entries()) assert.match(s!, new RegExp(`style=countdown%3A${ids[i]}`), `the ${ids[i]} card asks for ${ids[i]}`);
});

test('a script-less miniature is finished from the parent — the streamed page never draws itself', async () => {
  /* Vercel preview, 2026-10-07: every card blank. The guest route STREAMS (`$RS`/`$RC` move hidden
     `S:n` segments into place) and a sandboxed frame runs no script, so every section stayed hidden.
     The lab never streamed, so it drew. */
  const { readFileSync } = await import('node:fs');
  const here = PANEL.replace(/^\.\.\//, '');
  const prev = readFileSync(`${here}/style-preview.tsx`, 'utf8');
  const swap = readFileSync(`${here}/streamed-swap.ts`, 'utf8');
  const finish = prev.indexOf('finishStreamedHtml(d);');
  const find = prev.indexOf('findMakerSection(d, key!)');
  assert.ok(finish > 0 && finish < find, 'the stream is finished BEFORE the part is looked for');
  assert.match(prev, /drawn\.width < 1 \|\| drawn\.height < 1/, 'a part drawn at 0×0 (still hidden) is not a picture');
  assert.match(prev, /Couldn’t draw this look/, 'a card that cannot draw says so');
  assert.match(prev, /'Drawing…'/, 'a card still drawing says so — never a blank card');
  assert.match(swap, /\\\$R\(\[SC\]\)/, 'both React swap calls are applied');
  assert.match(swap, /sn-init-splash/, 'the init splash is lifted');
});

test('no part’s Style › Look opens on a row holding only an ⓘ — the pass included', async () => {
  /* Owner, the Digital pass: "an empty row holding only a lone ⓘ". A part with no door to name (the pass,
     the guest's look …) still has its own sentences — they are SAID, beside the ⓘ. */
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MAKER_PART_KEYS, makerPartQuietRow } = await import('./maker-parts');
  const { QuietBar } = await import(`${PANEL}/kit`);
  const { setStagePanelNow } = await import(`${PANEL}/store`);
  let doorless = 0;
  for (const k of MAKER_PART_KEYS) {
    if (makerPartQuietRow(k)) continue;
    doorless += 1;
    setStagePanelNow({ picked: k, quiet: null, about: `What ${k} is, and where it comes from.` });
    const html = renderToStaticMarkup(React.createElement(QuietBar));
    const visible = html.replace(/<span[^>]*data-stage-about=""[\s\S]*?<\/span><\/span>/g, '').replace(/<[^>]+>/g, '').trim();
    assert.ok(visible.length > 0, `${k}: its Look opens on a lone ⓘ`);
  }
  assert.ok(doorless > 0, 'parts without a door were found (the pass among them)');
  setStagePanelNow({ picked: null, quiet: null, about: null });
});
