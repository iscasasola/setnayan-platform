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

test('an EMPTY part still draws each look differently — sample shapes, on the Maker canvas only', async () => {
  /* Owner 08 Oct: "still cannot see the gallery style? maybe show what it could look like with boxes?" */
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { readFileSync } = await import('node:fs');
  const { MakerDayPartStandIn } = await import('../app/[slug]/_components/maker-fixed-parts');
  const { sceneStylesOn } = await import('./scene-styles');
  for (const part of ['announcements', 'find_your_seat', 'live_hub', 'photos_of_you'] as const) {
    const looks = sceneStylesOn(part, 'event', 'wedding');
    assert.ok(looks.length >= 2, `${part} offers looks`);
    const drawn = looks.map((l: { id: string; name: string }) =>
      renderToStaticMarkup(React.createElement(MakerDayPartStandIn, { part, styleName: l.name, styleId: l.id })).replace(/Sample of “[^”]*”/, ''),
    );
    assert.equal(new Set(drawn).size, looks.length, `${part}: every look draws its own arrangement`);
    for (const h of drawn) assert.match(h, /data-sample-(box|line)=""/, `${part}: shapes, not a sentence`);
  }
  const { PhotoMomentsWidget } = await import('../app/[slug]/_components/photo-moments-widget');
  const words = { eventWord: 'wedding' } as never;
  const pm = ['cards', 'down-the-day', 'yes-and-no'].map((st) => renderToStaticMarkup(React.createElement(PhotoMomentsWidget, { config: null, words, sceneStyle: st })));
  assert.equal(new Set(pm).size, 3, 'Photo moments: Cards · Down the day · Yes and no differ with no moments');
  for (const h of pm) assert.match(h, /data-maker-sample="/);
  const css = readFileSync('app/globals.css', 'utf8');
  assert.match(css, /body:not\(:has\(\[data-maker-section\]\)\) \[data-maker-sample\] \{ display: none !important; \}/, 'never shown to a guest');
});

/* ── 🎨 THE PALETTE'S LOOKS ARE PICTURES (owner's preview check, 08 Oct: "palette should show the actual
      previews like the other styles") ─────────────────────────────────────────────────────────────── */

test('the palette’s looks are picture cards on the Dress code part — never a dropdown', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { readFileSync } = await import('node:fs');
  const { PaletteLookCards } = await import('../app/dashboard/[eventId]/website/editor/_components/palette-look-row');
  const { PALETTE_LOOK_IDS } = await import('./palette-looks');
  const html = renderToStaticMarkup(React.createElement(PaletteLookCards, { value: 'tags', onPick: () => {} }));
  const cards = [...html.matchAll(/data-style-card="([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(cards, [...PALETTE_LOOK_IDS], 'one card per look, in the registry’s order');
  assert.equal(html.split('data-style-preview=').length - 1, PALETTE_LOOK_IDS.length, 'every card holds a picture');
  assert.match(html, /role="radiogroup"[^>]*aria-label="Palette look"[^>]*data-style-carousel="palette"/, 'the shared look-card carousel');
  assert.doesNotMatch(html, /aria-haspopup|data-palette-look=|<select/, 'a dropdown came back');
  assert.match(html, /aria-checked="true"[^>]*data-style-card="tags"/, 'the look worn now is the ringed card');
  /* …and the Stages panel's Dress code part is where they are drawn. */
  const row = readFileSync('app/dashboard/[eventId]/website/editor/_components/scene-style-row.tsx', 'utf8');
  const palette = row.slice(row.indexOf('export function PaletteLookCanvasRow'), row.indexOf('export function SceneAlignRow'));
  assert.match(palette, /const cards = useMaker\(\)\?\.stagesStudio === true;/);
  assert.match(palette, /const onDressPart = useStagePanelNow\(\)\.picked === 'dress';/);
  const at = palette.indexOf('if (cards && onDressPart) {');
  assert.ok(at > 0 && at < palette.indexOf('<PaletteLookRow'), 'the cards are returned BEFORE the dropdown row is reached');
  assert.match(palette.slice(at, palette.indexOf('<PaletteLookRow')), /<PaletteLookCards value=\{resolvePaletteLook\(shown\.palette\)\}/);
});

test('each palette card is the couple’s page in that look — one address each, laid on canvas.palette, drawn differently', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { stylePreviewSrc } = await import(`${PANEL}/style-preview`);
  const { PALETTE_LOOK_IDS, PALETTE_LOOK_PREVIEW_TYPE, PALETTE_LOOK_CARD_FOCUS } = await import('./palette-looks');
  const { withStylePreview } = await import('../app/[slug]/_lib/style-preview');
  const { canvasStylePreview } = await import('../app/[slug]/_lib/editor-canvas');
  const { paletteLookOfRow, sceneStyleOfRow } = await import('./scene-style-of-row');
  const { DressCodeWidget } = await import('../app/[slug]/_components/dress-code-widget');
  const srcs = PALETTE_LOOK_IDS.map((id) => stylePreviewSrc('/maria-and-jose?phase=rsvp&editor=1', 'w:dress_code', PALETTE_LOOK_PREVIEW_TYPE, id, 'http://x.test'));
  assert.equal(new Set(srcs).size, PALETTE_LOOK_IDS.length, 'each look is its own page');
  const rows = [
    { widget_type: 'dress_code', config_json: { canvas: { style: 'colours-and-roles', palette: 'ribbon' } } },
    { widget_type: 'countdown', config_json: { canvas: { style: 'line' } } },
  ];
  const words = { eventWord: 'wedding', solemn: false, twoPeople: true } as never;
  const board = { reception: ['#7A1F2B', '#C9A24B', '#F4E9DC'] };
  const drawn: string[] = [];
  for (const id of PALETTE_LOOK_IDS) {
    const asked = canvasStylePreview({ style: new URL(srcs[PALETTE_LOOK_IDS.indexOf(id)]!, 'http://x.test').searchParams.get('style')! }, true);
    assert.deepEqual(asked, { type: PALETTE_LOOK_PREVIEW_TYPE, id }, `${id}: the page reads the card’s ask`);
    const { widgets } = withStylePreview({}, rows, asked);
    assert.equal(paletteLookOfRow(widgets[0]), id, `${id}: laid on the Dress code row’s canvas.palette`);
    assert.equal(sceneStyleOfRow(widgets[0], 'rsvp', 'wedding'), 'colours-and-roles', `${id}: the scene’s own style is left alone`);
    assert.deepEqual(widgets[1], rows[1], `${id}: no other scene is touched`);
    const html = renderToStaticMarkup(
      React.createElement(DressCodeWidget, { words, config: { title: 'Garden formal' } as never, rolePalette: board, paletteLook: paletteLookOfRow(widgets[0]) }),
    );
    assert.match(html, /data-dress-code="ours"/, `${id}: the block the card is fitted on (${PALETTE_LOOK_CARD_FOCUS}) is drawn`);
    drawn.push(html);
  }
  assert.equal(new Set(drawn).size, PALETTE_LOOK_IDS.length, 'the five cards are five different pictures');
  /* A guest's `?style=` asks for nothing — the page they are served cannot be restyled from the address. */
  assert.equal(canvasStylePreview({ style: `${PALETTE_LOOK_PREVIEW_TYPE}:ribbon` }, false), null);
  assert.equal(paletteLookOfRow(withStylePreview({}, rows, null).widgets[0]), 'ribbon', 'no ask → the stored pick, untouched');
});

test('a card fitted on one block hides the rest of its scene, and falls back to the scene when the block is not drawn', async () => {
  const { readFileSync } = await import('node:fs');
  const here = PANEL.replace(/^\.\.\//, '');
  const prev = readFileSync(`${here}/style-preview.tsx`, 'utf8');
  const car = readFileSync(`${here}/style-carousel.tsx`, 'utf8');
  assert.match(prev, /return focus \? \(section\.querySelector<HTMLElement>\(focus\) \?\? section\) : section;/, 'no block → the scene, never a blank card');
  assert.match(prev, /const part = miniaturePart\(section, el, focus\);/, 'the card is fitted on the block');
  assert.match(prev, /\[data-sn-mini-scene\] \*:not\(\[data-sn-mini-focus\]\)[^']*\{visibility:hidden!important\}/, 'the rest of the scene is not drawn in the card');
  assert.match(car, /const part = miniaturePart\(sec \?\? null, el, focus\);/, 'the card’s width follows the SAME block’s shape');
  assert.match(car, /style=\{spCardWidth\(aspect\)\}/, 'sized by aspect like every look card');
});
