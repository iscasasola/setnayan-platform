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
  const time = { value: 0.3, steps: [0, 0.3, 0.8], onPick: () => {} };
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
        delay: time,
        does: dd,
        next: dd,
      }),
    );
    /* 🔁 RE-AIMED 2026-10-09 (Animate is four rows — `animate-is-four-rows.test.ts`): a row is a child of the
       four-row grid (`row-start-N`), no longer a 44 px line of a scrolling column; and Animate draws no ⓘ of its
       own any more (the one ⓘ is on the "You're editing" line). The claim stays: no row is empty of a control. */
    const rows = html.split(/(?=<(?:div|p) class="[^"]*\brow-start-\d)/).slice(1);
    assert.ok(rows.length >= 2, `${phase}: rows were found`);
    for (const r of rows) {
      const withoutAbout = r.replace(/<span[^>]*data-stage-about=""[\s\S]*?<\/button><\/span>/g, '');
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

test('no part opens on a row holding only an ⓘ — the pass included', async () => {
  /* Owner, the Digital pass: "an empty row holding only a lone ⓘ". */
  /* 🔁 RE-AIMED 2026-10-09 (owner, decided: the ⓘ explanations do not get rows — ONE ⓘ at the right end of the
     "You're editing" line). This held that a part with no door still SAID its name beside the ⓘ. The claim is kept
     and is stronger now: a part with no door draws NO row at all for it, and its sentences are behind the one ⓘ
     (`StageAbout`) — `lib/edit-types-the-words-in-place.test.ts` (6). */
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MAKER_PART_KEYS, makerPartQuietRow } = await import('./maker-parts');
  const { QuietBar, StageAbout } = await import(`${PANEL}/kit`);
  const { setStagePanelNow } = await import(`${PANEL}/store`);
  let doorless = 0;
  for (const k of MAKER_PART_KEYS) {
    if (makerPartQuietRow(k)) continue;
    doorless += 1;
    const about = `What ${k} is, and where it comes from.`;
    setStagePanelNow({ picked: k, quiet: null, about });
    assert.equal(renderToStaticMarkup(React.createElement(QuietBar)), '', `${k}: a row is drawn for a part with no door`);
    assert.match(renderToStaticMarkup(React.createElement(StageAbout)), /data-explain=""/, `${k}: its sentences have no ⓘ`);
  }
  setStagePanelNow({ picked: null, quiet: null, about: null });
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

test('the palette’s looks are pictures on the Dress code part — one row of five, never a dropdown', async () => {
  /* 🔁 RE-AIMED 2026-10-09 (owner, verbatim: *"row 3 is palette style"*; `TOOLBAR-SPEC-2026-10-09.md` § STYLE). This
     held the palette's looks as a second CAROUSEL of full miniatures on the Dress code part (2026-10-08: "palette
     should show the actual previews like the other styles"). In the four-row toolbar they are ONE ROW of five
     pictures — each the couple's colours drawn in that look. The claim is kept: every look is a picture, the one
     worn is marked, there is no dropdown. (`PaletteLookCards` still draws the full miniatures for a surface with
     the room for them — the next test holds what each of those cards asks the page for.) */
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { readFileSync } = await import('node:fs');
  const { PaletteLookStrip, PaletteLookCards } = await import('../app/dashboard/[eventId]/website/editor/_components/palette-look-row');
  const { PALETTE_LOOK_IDS } = await import('./palette-looks');
  const html = renderToStaticMarkup(React.createElement(PaletteLookStrip, { value: 'fabric', colours: ['#A9834B', '#2C2A29', '#C7A27C'], onPick: () => {} }));
  const picks = [...html.matchAll(/<button[^>]*role="radio"[^>]*data-palette-pick="([a-z-]+)"[^>]*>/g)];
  assert.deepEqual(picks.map((m) => m[1]), [...PALETTE_LOOK_IDS], 'one picture per look, in the registry’s order');
  assert.match(html, /^<div role="radiogroup" aria-label="Palette style" data-look-row="palette"/, 'the five are not ONE row of the toolbar');
  /* Each is a PICTURE of the couple's own colours (three drawn marks at the least), named for a screen reader. */
  const bodies = html.split('<button').slice(1);
  assert.equal(bodies.length, PALETTE_LOOK_IDS.length);
  for (const b of bodies) {
    assert.ok((b.match(/background-color:#/gi) ?? []).length >= 3, 'a look is drawn without the couple’s colours');
    assert.match(b, /aria-label="Palette style: [A-Za-z ]+"/);
  }
  assert.doesNotMatch(html, /aria-haspopup|data-palette-look=|<select/, 'a dropdown came back');
  assert.equal((html.match(/aria-checked="true"/g) ?? []).length, 1);
  assert.match(picks[1]![0], /aria-checked="true"/, 'the look worn now is not the marked one');
  /* The full miniatures are still one card per look, each holding a picture. */
  const cards = renderToStaticMarkup(React.createElement(PaletteLookCards, { value: 'tags', onPick: () => {} }));
  assert.deepEqual([...cards.matchAll(/data-style-card="([a-z-]+)"/g)].map((m) => m[1]), [...PALETTE_LOOK_IDS]);
  assert.equal(cards.split('data-style-preview=').length - 1, PALETTE_LOOK_IDS.length, 'every card holds a picture');
  /* …and the Stages panel's Dress code part is where the row is drawn. */
  const row = readFileSync('app/dashboard/[eventId]/website/editor/_components/scene-style-row.tsx', 'utf8');
  const palette = row.slice(row.indexOf('export function PaletteLookCanvasRow'), row.indexOf('export function SceneAlignRow'));
  assert.match(palette, /const cards = useMaker\(\)\?\.stagesStudio === true;/);
  assert.match(palette, /const onDressPart = useStagePanelNow\(\)\.picked === 'dress';/);
  const at = palette.indexOf('if (cards && onDressPart) {');
  assert.ok(at > 0 && at < palette.indexOf('<PaletteLookRow'), 'the row is returned BEFORE the dropdown row is reached');
  assert.match(palette.slice(at, palette.indexOf('<PaletteLookRow')), /\{drawsPalette \? <PaletteLookStrip value=\{resolvePaletteLook\(shown\.palette\)\} colours=\{colours\} pending=\{pending\} onPick=\{pick\} \/> : null\}/);
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
  /* 📱 Since 2026-10-08 ("show in mobile view, not like a header that is short and wide") a card is the ONE
     phone-shaped frame (`every-style-card-is-phone-shaped.test.ts`). (🔁 Re-aimed 2026-10-09: in the toolbar the
     frame is the CARD itself, as tall as its rows — `SP_STYLE_CARD` — not a picture inside a card.) */
  assert.match(car, /className=\{SP_STYLE_CARD\}/, 'the card is the phone-shaped frame, like every look card');
  assert.doesNotMatch(car, /spCardWidth|miniaturePart/, 'the card is sized by its block again');
});

/* ── 🔲 EVERY EMPTY SCENE'S LOOK, IN SAMPLE SHAPES (owner 08 Oct: "still cannot see the gallery style? maybe
      show what it could look like with boxes?" — applied in the place every card and the canvas share) ── */

/** The words inside a block of markup. */
const wordsIn = (markup: string) => markup.replace(/<[^>]+>/g, '').trim();

test('an EMPTY Invitation scene draws each look as its own picture — no two look cards alike', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerEmptyScene } = await import('../app/[slug]/_components/maker-empty-scene');
  const { SCENE_SAMPLE, SceneSample, sceneSampleKey } = await import('../app/[slug]/_components/maker-scene-samples');
  const { MAKER_EMPTY_DRAWN } = await import('./maker-scene-list');
  const { sceneStylesOn, sceneStyleTypeOfWidget } = await import('./scene-styles');
  let scenes = 0;
  for (const widget of MAKER_EMPTY_DRAWN) {
    const type = sceneStyleTypeOfWidget(widget);
    for (const stage of ['save_the_date', 'rsvp', 'event'] as const) {
      const looks = sceneStylesOn(type, stage, 'wedding');
      if (looks.length < 2) continue;
      scenes += 1;
      const cards = looks.map((l: { id: string }) => renderToStaticMarkup(React.createElement(MakerEmptyScene, { type: widget as never, styleId: l.id })));
      assert.equal(new Set(cards).size, looks.length, `${widget} on ${stage}: two looks of the empty scene draw the same picture`);
      for (const [i, card] of cards.entries()) {
        const id = looks[i]!.id;
        /* Its OWN arrangement — never another look's standing in for it. */
        assert.ok(SCENE_SAMPLE[`${type}:${id}`], `${widget}: the look "${id}" has no arrangement of its own (maker-scene-samples.tsx)`);
        assert.match(card, new RegExp(`aria-hidden="true" data-maker-sample="${type}:${id}"`), `${widget} · ${id}: the sample is not marked`);
        assert.match(card, /data-sample-(box|line)=""/, `${widget} · ${id}: shapes, not a sentence`);
        /* Unmistakably a sample: not one word inside it — no name, no date, no place. */
        const alone = renderToStaticMarkup(React.createElement(SceneSample, { sceneType: type, styleId: id }));
        assert.equal(wordsIn(alone), '', `${widget} · ${id}: the sample prints words a couple could take for their own`);
      }
    }
  }
  assert.ok(scenes >= 7, `the empty-drawn scenes were found on their stages (${scenes})`);
  /* A stored style this version does not draw still draws a sample — the scene's first, never a blank. */
  assert.equal(sceneSampleKey('countdown', 'the-calendar'), 'countdown:four-tiles');
  assert.equal(sceneSampleKey('rsvp', 'reply-card'), null, 'a scene that is never empty has none');
});

test('an EMPTY Dress code draws its three layouts and its five palette looks in sample shapes', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { DressCodeWidget } = await import('../app/[slug]/_components/dress-code-widget');
  const { PALETTE_LOOK_IDS } = await import('./palette-looks');
  const { sceneStylesOn } = await import('./scene-styles');
  const words = { eventWord: 'wedding', solemn: false, twoPeople: true } as never;
  const empty = (sceneStyle: string | null, paletteLook: string | null, makerSample = true) =>
    renderToStaticMarkup(React.createElement(DressCodeWidget, { words, config: null, sceneStyle, paletteLook: paletteLook as never, makerSample }));
  const layouts = sceneStylesOn('dress_code', 'rsvp', 'wedding').map((l: { id: string }) => l.id);
  assert.equal(layouts.length, 3);
  const byLayout = layouts.map((id: string) => empty(id, null));
  assert.equal(new Set(byLayout).size, 3, 'Colours and roles · The palette · The line draw alike when empty');
  for (const [i, h] of byLayout.entries()) assert.match(h, new RegExp(`data-maker-sample="dress_code:${layouts[i]}"`));
  const byPalette = PALETTE_LOOK_IDS.map((id) => empty('colours-and-roles', id));
  assert.equal(new Set(byPalette).size, PALETTE_LOOK_IDS.length, 'two palette looks draw alike on an empty Dress code');
  for (const [i, h] of byPalette.entries()) {
    assert.match(h, new RegExp(`data-dress-code="ours" data-sample-palette="${PALETTE_LOOK_IDS[i]}"`), 'the palette card’s own block is drawn');
  }
  /* A Dress code with words but no colours yet: the palette's place is still pictured, per look. */
  const noColours = PALETTE_LOOK_IDS.map((id) =>
    renderToStaticMarkup(React.createElement(DressCodeWidget, { words, config: { title: 'Garden formal' } as never, paletteLook: id, makerSample: true })),
  );
  assert.equal(new Set(noColours).size, PALETTE_LOOK_IDS.length);
  for (const [i, h] of noColours.entries()) assert.match(h, new RegExp(`data-dress-code="ours" data-maker-sample="palette:${PALETTE_LOOK_IDS[i]}"`));
  /* …and it vanishes when real colours exist. */
  const real = renderToStaticMarkup(
    React.createElement(DressCodeWidget, { words, config: { title: 'Garden formal' } as never, rolePalette: { reception: ['#7A1F2B', '#C9A24B'] }, makerSample: true }),
  );
  assert.doesNotMatch(real, /data-maker-sample="(palette|dress_code):|data-sample-palette/, 'a sample sits beside the couple’s real colours');
  /* Off the Maker's canvas the widget draws none at all. */
  assert.doesNotMatch(empty('colours-and-roles', 'ribbon', false), /data-maker-sample|data-sample-/);
});

test('a sample can never reach a page without a Maker marker', async () => {
  const { readFileSync, readdirSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const css = readFileSync('app/globals.css', 'utf8');
  assert.match(css, /body:not\(:has\(\[data-maker-section\]\)\) \[data-maker-sample\] \{ display: none !important; \}/, 'the page-level fence is gone');
  /* 1 · The marker itself is the verified host canvas's alone. */
  const body = readFileSync('app/[slug]/_components/site-body.tsx', 'utf8');
  assert.match(body, /const makerMark = \(key: string\) =>\s*isEditorCanvas && editorBridge \? <span hidden data-maker-section=\{key\} \/> : null;/);
  /* 2 · Every sample block carries the attribute the fence hides: no file draws a sample shape outside one. */
  const drawers: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx$/.test(name) && /data-sample-(box|line)=""/.test(readFileSync(p, 'utf8'))) drawers.push(p.replace(/\\/g, '/'));
    }
  };
  walk('app');
  assert.deepEqual(drawers.sort(), ['app/[slug]/_components/maker-fixed-parts.tsx', 'app/[slug]/_components/maker-scene-samples.tsx'], 'a new file draws sample shapes — fence it');
  const samples = readFileSync('app/[slug]/_components/maker-scene-samples.tsx', 'utf8');
  assert.match(samples, /<div aria-hidden data-maker-sample=\{key\}/, 'SceneSample is the fenced block every scene sample is drawn in');
  /* 3 · …and its callers mount it only for the Maker: the empty scene, the Maker's E-Gifts place, the Dress code's
         `makerSample` (both dispatchers pass `!guestView`, and the body passes `guestView={!isMakerCanvas}`). */
  const callers: string[] = [];
  const find = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) find(p);
      else if (/\.tsx$/.test(name) && !name.includes('maker-scene-samples') && /from '\.\/maker-scene-samples'/.test(readFileSync(p, 'utf8'))) callers.push(name);
    }
  };
  find('app');
  assert.deepEqual(callers.sort(), ['dress-code-styles.tsx', 'dress-code-widget.tsx', 'maker-empty-scene.tsx', 'maker-fixed-parts.tsx', 'maker-guest-scenes.tsx']);
  let asked = 0;
  for (const f of ['dress-code-widget.tsx', 'dress-code-styles.tsx']) {
    const dress = readFileSync(`app/[slug]/_components/${f}`, 'utf8');
    for (const m of dress.matchAll(/<SceneSample|paletteSample\(look\)|dosSample\((?!look: )/g)) {
      const before = dress.slice(Math.max(0, m.index! - 260), m.index!);
      assert.match(before, /makerSample (\?|&&)/, `${f}: the Dress code draws a sample without asking whether this is the Maker’s canvas`);
      asked += 1;
    }
  }
  assert.ok(asked >= 5, `the Dress code’s sample draws were found (${asked})`);
  for (const f of ['public-hideable-widget.tsx', 'hideable-widget-render.tsx']) {
    const src = readFileSync(`app/[slug]/_components/${f}`, 'utf8');
    assert.equal(src.split('makerSample={!guestView}').length - 1, 1, `${f}: the Dress code’s sample is not tied to the Maker canvas`);
    assert.doesNotMatch(src, /makerSample(?!=\{!guestView\})/, `${f}: another makerSample was passed`);
  }
  assert.doesNotMatch(body, /guestView=\{(?!!isMakerCanvas\})/, 'a mount passes a guest view that is not “not the Maker canvas”');
});

/* ── 🧾 THE DO'S & DON'TS' LOOKS ARE PICTURES TOO ───────────────────────────────────────────────── */

test('the Do’s & Don’ts looks are picture cards — one page each, laid on canvas.dos, and drawn in sample shapes while there is no list', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { DosLookCards } = await import('../app/dashboard/[eventId]/website/editor/_components/palette-look-row');
  const { DOS_LOOK_IDS, DOS_LOOK_PREVIEW_TYPE, DOS_LOOK_CARD_FOCUS } = await import('./dress-code-looks');
  const { stylePreviewSrc } = await import(`${PANEL}/style-preview`);
  const { withStylePreview } = await import('../app/[slug]/_lib/style-preview');
  const { canvasStylePreview } = await import('../app/[slug]/_lib/editor-canvas');
  const { dosLookOfRow, paletteLookOfRow } = await import('./scene-style-of-row');
  const { DressCodeWidget } = await import('../app/[slug]/_components/dress-code-widget');
  const html = renderToStaticMarkup(React.createElement(DosLookCards, { value: 'notes', onPick: () => {} }));
  assert.deepEqual([...html.matchAll(/data-style-card="([a-z-]+)"/g)].map((m) => m[1]), [...DOS_LOOK_IDS]);
  assert.match(html, /role="radiogroup"[^>]*data-style-carousel="dos"/);
  assert.doesNotMatch(html, /aria-haspopup|<select/, 'a set of looks is pictures, not a dropdown');
  const rows = [{ widget_type: 'dress_code', config_json: { canvas: { palette: 'ribbon' } } }];
  const words = { eventWord: 'wedding', solemn: false, twoPeople: true } as never;
  const withLists: string[] = [];
  const empty: string[] = [];
  for (const id of DOS_LOOK_IDS) {
    const src = stylePreviewSrc('/maria-and-jose?phase=rsvp&editor=1', 'w:dress_code', DOS_LOOK_PREVIEW_TYPE, id, 'http://x.test')!;
    const asked = canvasStylePreview({ style: new URL(src, 'http://x.test').searchParams.get('style')! }, true);
    const { widgets } = withStylePreview({}, rows, asked);
    assert.equal(dosLookOfRow(widgets[0]), id, `${id}: laid on canvas.dos`);
    assert.equal(paletteLookOfRow(widgets[0]), 'ribbon', `${id}: the palette look beside it is left alone`);
    const draw = (config: unknown) =>
      renderToStaticMarkup(React.createElement(DressCodeWidget, { words, config: config as never, rolePalette: { reception: ['#7A1F2B'] }, dosLook: dosLookOfRow(widgets[0]), makerSample: true }));
    const real = draw({ title: 'Garden formal', dos: ['Wear long gowns'], donts: ['Wear white'] });
    assert.match(real, /data-dress-code="dos"/, `${id}: the block the card is fitted on (${DOS_LOOK_CARD_FOCUS})`);
    assert.doesNotMatch(real, /data-maker-sample="dos:/, `${id}: a sample sits beside the couple’s own lines`);
    withLists.push(real);
    const none = draw({ title: 'Garden formal' });
    assert.match(none, new RegExp(`aria-hidden="true" data-dress-code="dos" data-maker-sample="dos:${id}"`), `${id}: no list yet → its place in sample shapes`);
    assert.equal(wordsIn(none.slice(none.indexOf('data-maker-sample="dos:')).replace(/^[^>]*>/, '')), '', `${id}: the sample prints words`);
    empty.push(none);
  }
  assert.equal(new Set(withLists).size, DOS_LOOK_IDS.length, 'two looks draw the couple’s lists alike');
  assert.equal(new Set(empty).size, DOS_LOOK_IDS.length, 'two looks draw alike while there is no list');
});

/* ── 📸 PHOTOS OF YOU — the three gallery styles, pictured (owner 08 Oct: "this needs to present different
      gallery styles") ───────────────────────────────────────────────────────────────────────────── */

test('Photos of you draws The grid · The big one · Polaroids as the real gallery lays them — in sample photos, and its box is the frame’s', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { readFileSync } = await import('node:fs');
  const { MakerDayPartStandIn } = await import('../app/[slug]/_components/maker-fixed-parts');
  const { sceneStylesOn } = await import('./scene-styles');
  const looks = sceneStylesOn('photos_of_you', 'event', 'wedding');
  assert.deepEqual(looks.map((l: { name: string }) => l.name), ['The grid', 'The big one', 'Polaroids']);
  const draw = (id: string, name: string) => renderToStaticMarkup(React.createElement(MakerDayPartStandIn, { part: 'photos_of_you', styleName: name, styleId: id }));
  const real = readFileSync('app/[slug]/_components/photos-of-you-styles.tsx', 'utf8') + readFileSync('app/[slug]/_components/photos-of-you-gallery.tsx', 'utf8');
  /* Each sample is laid by the SAME arrangement the shipped look uses — read from the shipped renderer, so a
     look redrawn there and not here goes red. */
  const arrangement: Record<string, RegExp[]> = {
    grid: [/grid grid-cols-3 gap-2/],
    lead: [/flex (snap-x )?gap-2 overflow-/, /w-32 shrink-0/],
    polaroids: [/grid grid-cols-2 gap-4/, /p-2 pb-3 shadow-md/, /-rotate-1/],
  };
  const pictures: string[] = [];
  for (const look of looks) {
    const html = draw(look.id, look.name);
    for (const re of arrangement[look.id]!) {
      assert.match(real, re, `${look.id}: the shipped look no longer uses ${re} — redraw the sample to match it`);
      assert.match(html, new RegExp(re.source.replace('(snap-x )?', '')), `${look.id}: the sample is not the shipped look’s arrangement`);
    }
    const sample = /<div aria-hidden="true" data-maker-sample="photos_of_you:[a-z]+">([\s\S]*?)<\/div>/.exec(html);
    assert.ok(sample, `${look.id}: the sample is not fenced to the Maker’s canvas`);
    assert.equal(wordsIn(sample[1]!), '', `${look.id}: the sample prints words`);
    assert.ok(sample[1]!.split('data-sample-box=""').length - 1 >= 4, `${look.id}: sample photos, not one plate`);
    /* The part is ONE section — the box the pick frame measures (`findMakerSection` → the marker's next sibling). */
    assert.match(html, /^<section class="[^"]*" data-maker-day-part="photos_of_you"/);
    assert.equal(html.split('<section').length - 1, 1);
    pictures.push(sample[1]!);
  }
  assert.equal(new Set(pictures).size, 3, 'two gallery styles draw the same picture');
  const body = readFileSync('app/[slug]/_components/site-body.tsx', 'utf8');
  assert.match(body, /\{makerMark\(`f:\$\{part\}`\)\}\s*<MakerDayPartStandIn/, 'the stand-in is no longer the marker’s next sibling — the frame would measure something else');
  assert.match(body, /styleId=\{fixedStyle\(part as FixedStyleScene\)\}/, 'the canvas draws the look PICKED, not the first');
});
