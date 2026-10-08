/**
 * style-is-cards-colour-and-size.test.ts — THE TOOLBAR'S STYLE (owner 2026-10-09, the approved prototype;
 * `TOOLBAR-SPEC-2026-10-09.md` § STYLE, every quote his).
 *
 *   (1) THE CARDS TAKE THE ROWS LEFT TO THEM AND NOTHING SCROLLS UP AND DOWN — the strip is as tall as its rows, a
 *       card as tall as the strip; the picked card rests in the MIDDLE with the previous and the next in view
 *       (RENDERED: a room before the first card and after the last). Sabotage: the pane scrolling again → red.
 *   (2) ROW 4 IS COLOUR + SIZE, SIDE BY SIDE (*"color and size share the same row"* · *"Color just 1 circle…"*) —
 *       RENDERED: ONE circle and one slider; no Font. For the parts that have words of their own, EXECUTED over
 *       every part; a part with neither has no row and its cards take all four. Sabotage: Colour as a row of
 *       swatches → red.
 *   (3) A PICK IS THE PART SHEET'S OWN WRITE — EXECUTED: the shipped `withElementChoice` on the Maker's own copy of
 *       the scene's canvas, the same queue key, one write, held; 100 % is an absence. Sabotage: a write key of its
 *       own → red.
 *   (4) THE DRESS CODE: cards over ONE row of five palette looks (*"row 3 is palette style"*), then Colour + Size.
 *       RENDERED. (What the Dress code no longer draws here is held in `the-stages-panel-is-the-prototypes`.)
 *   (5) WHO DRAWS WHAT — the toolbar draws row 4 and the work area's tool stands on it, three rows tall; under
 *       Style the part's Format shows its cards and its one row only. Sabotage: the tool left four rows tall → red.
 *   (6) NO FONT, NO ALIGNMENT, NO SPACING IN THE TOOLBAR — and the stored values are still honoured: the guest page
 *       draws them from the same places as before.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { MAKER_PARTS, type MakerPartKey } from './maker-parts';
import { HUB_ELEMENT_FIELDS, HUB_ELEMENT_SIZE_BASE, withElementChoice } from './element-style';
import { canvasWriteKey } from './maker-draft-store';
import { SP_LOOK_ROW, SP_PALETTE_PICK, SP_PALETTE_ROW, SP_STYLE_CARD, SP_STYLE_PANE, SP_STYLE_STRIP, STAGE_BAR_FOOT_CSS, STAGE_STRIP_RING_PX, stageBarRow } from './maker-stage-room';
import { phoneHeightPx } from './maker-phone-room';
import { PALETTE_LOOK_IDS } from './palette-looks';

/* The panel's pieces are compiled with the classic JSX runtime under `tsx` — they read `React` off the scope. */
(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';
const KEYS = Object.keys(MAKER_PARTS) as MakerPartKey[];
const has = (classes: string, c: string) => classes.split(' ').includes(c);

test('(1) the cards take the rows left to them, nothing scrolls up and down, and the picked card can rest in the middle', async () => {
  /* The pane: a column as tall as the tool, a row's gap between its rows, cut — never scrolled up and down. */
  for (const c of ['flex', 'h-full', 'flex-col', 'overflow-hidden', 'gap-[var(--sp-rg)]']) assert.ok(has(SP_STYLE_PANE, c), `the Style pane lost ${c}`);
  assert.ok(!SP_STYLE_PANE.split(' ').some((c) => /^overflow-(y-)?(auto|scroll)$/.test(c)), 'Style scrolls up and down');
  /* The strip: what is left of the pane (`flex-1`), swiped sideways only, a card snapping to its middle. */
  for (const c of ['flex-1', 'min-h-0', 'overflow-x-auto', 'overflow-y-hidden', 'snap-x', 'snap-mandatory', 'items-stretch']) assert.ok(has(SP_STYLE_STRIP, c), `the strip lost ${c}`);
  /* 🫧 A ROW'S GAP ABOVE THE CARDS (seen on the review copy: the cards touched the selector's band and the picked
     card's ring was cut at the top): the strip's top margin plus its own padding is exactly one gap (`--sp-rg`), and
     that padding — the room the ring is drawn in — is as wide as the ring, above and below. */
  assert.equal(STAGE_STRIP_RING_PX, 4);
  assert.ok(has(SP_STYLE_STRIP, 'mt-[calc(var(--sp-rg)_-_4px)]') && has(SP_STYLE_STRIP, 'py-1'), 'the cards do not start one gap under the selector’s band');
  assert.ok(has(SP_STYLE_STRIP, '-mb-1') && !has(SP_STYLE_STRIP, '-my-1') && !has(SP_STYLE_STRIP, '-mt-1'), 'the strip reaches up over the band again — the ring is cut');
  assert.match(SP_STYLE_CARD, /aria-checked:shadow-\[0_0_0_1px_var\(--sp-cta\),0_0_0_4px_var\(--sp-cta-wash\)\]/, 'the ring is wider than the room kept for it');
  for (const h of [568, 667, 812]) assert.ok(stageBarRow(h).gap >= STAGE_STRIP_RING_PX, `${h}px tall: a gap is narrower than the ring`);
  /* The card: as tall as the strip, its width following (the one 3 : 4 frame); it snaps by its centre. */
  for (const c of ['sn-phone-card', '!h-full', '![inline-size:auto]', 'snap-center']) assert.ok(has(SP_STYLE_CARD, c), `the card lost ${c}`);
  /* Picked, it wears the accent's line and ring — on the card itself (the prototype's `.lc[aria-checked=true]`). */
  assert.ok(has(SP_STYLE_CARD, 'aria-checked:border-[var(--sp-cta)]') && SP_STYLE_CARD.includes('aria-checked:shadow-[0_0_0_1px_var(--sp-cta),0_0_0_4px_var(--sp-cta-wash)]'));

  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StyleCards } = await import(`../${L}/stage-panel/style-carousel`);
  const { StageStyle } = await import(`../${L}/stage-panel/stage-style`);
  const { setStageTool } = await import(`../${L}/stage-panel/store`);
  const options = [{ id: 'a', name: 'Stacked' }, { id: 'b', name: 'One line' }, { id: 'c', name: 'Staggered' }];
  const html = renderToStaticMarkup(React.createElement(StyleCards, { options, value: 'b', onPick: () => {}, pending: false, canvasKey: 'f:hero.names', sceneType: 'hero_names' }));
  /* In order: a room, the cards, a room — so the first and the last can stand in the middle too. */
  const order = [...html.matchAll(/data-look-end="(first|last)"|data-style-card="([a-z]+)"/g)].map((m) => m[1] ?? m[2]);
  assert.deepEqual(order, ['first', 'a', 'b', 'c', 'last'], 'the strip has no room before its first card or after its last');
  assert.match(html, /^<div role="radiogroup" aria-label="Layout" data-style-carousel="" data-look-cards="" class="([^"]*)"/);
  assert.equal(/^<div[^>]* class="([^"]*)"/.exec(html)?.[1]?.replace(/&amp;/g, '&'), SP_STYLE_STRIP);
  assert.equal((html.match(/aria-checked="true"/g) ?? []).length, 1);
  /* Each card: its picture over its one-line name; no description, no "Recommended". */
  assert.equal((html.match(/data-style-card-preview=""/g) ?? []).length, 3);
  assert.doesNotMatch(html, /Recommended/);
  /* The picked card is brought to the middle on opening, after a pick (gliding), and when a card or the strip changes size. */
  const car = read(`${L}/stage-panel/style-carousel.tsx`);
  assert.match(car, /c\.scrollTo\(\{ left: Math\.max\(0, on\.offsetLeft \+ on\.offsetWidth \/ 2 - c\.clientWidth \/ 2\), behavior: smooth \? 'smooth' : 'auto' \}\);/);
  assert.match(car, /const room = \(card: HTMLElement\) => Math\.max\(0, Math\.round\(c\.clientWidth \/ 2 - card\.offsetWidth \/ 2 - gap\)\);/, 'the first / last card cannot reach the middle');
  assert.match(car, /useLayoutEffect\(\(\) => centre\(false\), \[centre, ends\.first, ends\.last, wide, options\.length\]\);/);
  assert.match(car, /picked\.current = value;\s*centre\(true\);/);
  assert.match(car, /new ResizeObserver\(\(\) => centre\(false\)\)/);
  /* THE ROOM BESIDE THE FIRST / LAST CARD IS THE STRIP'S OWN (the first look picked leaves the left third empty —
     the owner's rule is the picked one in the middle, no wrap-around): it is inside the strip, so a swipe that
     starts there swipes the cards; it has no handler of its own; and the toolbar's swipe-to-the-next-part stands
     back for anything inside the strip. Never dead space that swallows a swipe. */
  assert.match(html, /^<div[^>]*data-look-cards=""[^>]*><span aria-hidden="true" data-look-end="first"/);
  assert.match(html, /<span aria-hidden="true" data-look-end="last" class="shrink-0"[^>]*><\/span><\/div>$/);
  assert.doesNotMatch(car, /data-look-end="(first|last)"[^>]*on(Click|Pointer|Touch)/);
  assert.match(read(`${L}/stage-tools.tsx`), /const skip = t\?\.closest\?\.\('[^']*\[data-style-carousel\][^']*'\);/, 'a swipe on the strip also steps to the next part');

  /* THE WORK AREA'S PARTS ARE LAID IN THAT PANE under Style (`rows`); a body that is not the work area's keeps its own. */
  const h = React.createElement;
  const cards = h('i', { 'data-look-cards': '' });
  setStageTool('style');
  const rows = renderToStaticMarkup(h(StageStyle, { look: cards, background: h('b'), rows: true }));
  assert.match(rows, new RegExp(`^<div class="${SP_STYLE_PANE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" data-stage-style="look" data-stage-style-rows="">`), 'the work area’s Style is not laid in rows');
  assert.doesNotMatch(renderToStaticMarkup(h(StageStyle, { look: cards, background: h('b') })), /data-stage-style-rows/, 'the Reveal’s / the Camera’s / a reply page’s own body was put in rows');
  setStageTool('bg');
  assert.doesNotMatch(renderToStaticMarkup(h(StageStyle, { look: cards, background: h('b'), rows: true })), /data-stage-style-rows/, 'Background was put in Style’s rows before it is rebuilt');
  setStageTool('edit');
  assert.match(read(`${L}/stage-panel/parts.tsx`), /<StageStyle \{\.\.\.rest\} arrange=\{asStageArrange\(arrange\)\} rows \/>/);
});

test('(2) row 4 is Colour + Size side by side: ONE circle and one slider, no Font — on the parts that have words of their own', async () => {
  const { partLookTarget, partLookFields, partLookSizes } = await import(`../${L}/stage-panel/part-look`);
  const { makerPartCanvasOn } = await import('./maker-part-groups');
  /* WHICH parts, over every one: a line of the cover is its own part; a scene the couple arranges is its heading;
     a fixed block, a Post Event scene, the RSVP form, a part the page does not draw has none. */
  let both = 0;
  let none = 0;
  for (const k of KEYS) {
    const def = MAKER_PARTS[k];
    const t = partLookTarget(makerPartCanvasOn('rsvp', k), def.el ?? null);
    const scene = (def.canvas ?? '').startsWith('w:');
    const want = def.canvas === 'f:hero' && def.el ? { key: 'f:hero', widgetType: 'hero', el: def.el } : scene ? { key: def.canvas, widgetType: def.canvas!.slice(2), el: 'heading' } : null;
    assert.deepEqual(t, want, `${k}: whose colour and size`);
    const can = partLookFields(t);
    if (t) {
      /* What it can take is the SHIPPED table — never a list of Style's own. */
      const takes: readonly string[] = HUB_ELEMENT_FIELDS[t.el as keyof typeof HUB_ELEMENT_FIELDS];
      assert.equal(can.colour, takes.includes('color'), `${k}: colour`);
      assert.equal(can.size, takes.includes('size'), `${k}: size`);
      assert.ok(partLookSizes(t.el).includes(HUB_ELEMENT_SIZE_BASE), `${k}: 100 % is not a size it can be`);
      if (can.colour && can.size) both += 1;
    } else {
      assert.deepEqual(can, { colour: false, size: false });
      none += 1;
    }
  }
  assert.ok(both >= 12 && none >= 12, `anti-vacuity: ${both} with both, ${none} with none`);
  /* The logo is a drawing: a size, no colour. The RSVP form's words are not styled part by part. */
  assert.deepEqual(partLookFields(partLookTarget('f:hero', 'mark')), { colour: false, size: true });
  assert.equal(partLookTarget('w:rsvp', null), null);
  assert.equal(partLookTarget('f:gifts', null), null);

  /* RENDERED: "Colour", ONE circle, "Size", ONE slider, the size said — in that order, in one row. */
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StageLookRow } = await import(`../${L}/stage-panel/stage-look-row`);
  const draw = (el: string, canvas: object) =>
    renderToStaticMarkup(React.createElement(StageLookRow, { target: { key: 'f:hero', widgetType: `hero-test-${el}`, el }, canvas, palette: null, onKeep: async () => ({ ok: true as const }), onRefused: () => {} }));
  const row = draw('names', { elements: { names: { color: '#a9834b', size: 120 } } });
  assert.match(row, new RegExp(`^<div class="${SP_LOOK_ROW}" data-stage-look-row="names">`));
  assert.ok(has(SP_LOOK_ROW, 'flex') && has(SP_LOOK_ROW, 'items-center') && !has(SP_LOOK_ROW, 'flex-col') && !has(SP_LOOK_ROW, 'flex-wrap'), 'Colour and Size do not share ONE row');
  const marks = [...row.matchAll(/>(Colour|Size)<|data-stage-look-colour="([^"]+)"|type="range"|>(\d+%)</g)].map((m) => m[1] ?? m[2] ?? m[3] ?? 'slider');
  assert.deepEqual(marks, ['Colour', '#a9834b', 'Size', 'slider', '120%']);
  assert.equal((row.match(/data-stage-look-colour=/g) ?? []).length, 1, 'Colour is more than ONE circle — "Color just 1 circle…"');
  assert.equal((row.match(/<button/g) ?? []).length, 1, 'the row holds a control beside the circle and the slider');
  assert.match(row, /<button[^>]*aria-label="Colour #a9834b — change it"/);
  assert.match(row, /background:#a9834b/);
  assert.doesNotMatch(row, /Font|data-element-font|aria-haspopup="listbox"/, 'a Font control is back in the toolbar');
  /* Nothing chosen: the circle is the theme's own (striped), the slider at 100 %. */
  const plain = draw('eyebrow', {});
  assert.match(plain, /data-stage-look-colour="theme"/);
  assert.match(plain, />100%</);
  /* The logo: its size only. */
  const logo = draw('mark', {});
  assert.doesNotMatch(logo, /Colour|data-stage-look-colour/);
  assert.match(logo, /type="range"/);
  /* The circle opens the app's ONE colour picker; the slider is the app's one slider. */
  const src = read(`${L}/stage-panel/stage-look-row.tsx`);
  assert.match(src, /\{picking \? \(\s*<ColourSheet\s/);
  assert.match(src, /onPick=\{\(\) => setPicking\(true\)\}/);
  assert.match(src, /onUnset=\{\(\) => keep\('color', null\)\}/, 'the theme’s own colour cannot be put back');
  assert.match(src, /<Slider label="Text size" /);
  assert.doesNotMatch(src, /type="color"|<input|SwatchMore|colours\.map/, 'a swatch grid or a colour input of its own');
});

test('(3) a pick is the part sheet’s own write: the shipped choice on the Maker’s copy, the same queue key, one write, held', async () => {
  const { partLookNext, partLookNow } = await import(`../${L}/stage-panel/part-look`);
  const t = { key: 'f:hero', widgetType: 'hero-write-test', el: 'names' as const };
  const before = { style: 'stacked', elements: { names: { font: 'fraunces' }, date: { size: 120 } } };
  /* A colour: exactly `withElementChoice`'s elements, everything else of the canvas untouched. */
  const col = partLookNext(t, before as never, 'color', '#a9834b');
  assert.deepEqual(col, { ...before, elements: withElementChoice(before.elements as never, 'names', 'color', '#a9834b') });
  assert.deepEqual((col as { elements: Record<string, unknown> }).elements.names, { font: 'fraunces', color: '#a9834b' }, 'the stored Font was dropped — it is no longer set here, and must still be honoured');
  /* A size; 100 % is the theme's own — an absence, never a stored 100. */
  assert.deepEqual((partLookNext(t, before as never, 'size', 132) as { elements: Record<string, { size?: number }> }).elements.names!.size, 132);
  const sized = { elements: { names: { size: 132 } } };
  assert.deepEqual(partLookNext(t, sized as never, 'size', HUB_ELEMENT_SIZE_BASE), {}, '100 % is stored');
  /* A pick that changes nothing sends nothing. */
  assert.equal(partLookNext(t, { elements: { names: { color: '#a9834b' } } } as never, 'color', '#a9834b'), null);
  assert.equal(partLookNext(t, {} as never, 'color', null), null);
  /* What the row shows is read off the same place. */
  assert.deepEqual(partLookNow(t, { elements: { names: { color: '#112233', size: 85 } } } as never), { colour: '#112233', size: 85 });
  assert.deepEqual(partLookNow(t, {} as never), { colour: null, size: 100 });

  const src = read(`${L}/stage-panel/part-look.ts`);
  const keep = src.slice(src.indexOf('export async function keepPartLook('));
  /* On the page first (the bridge's own `elStyle`), on the Maker's copy, then ONE write under the part sheet's key. */
  assert.match(keep, /show\(elementPreview\(t\.key, t\.el, before, next\)\);\s*noteDraftedCanvas\(t\.widgetType, next, server\);/);
  assert.match(keep, /makerLatestWrite\(canvasWriteKey\(t\.widgetType\), \(\) => \{/, 'a write key of Style’s own — a pick here and one in the part’s sheet would race');
  assert.equal(canvasWriteKey('hero'), 'canvas:hero');
  assert.match(read(`${E}/element-sheet.tsx`), /makerLatestWrite\(canvasWriteKey\(target\.widgetType\), write\)/, 'anti-vacuity: the part sheet no longer queues under that key');
  assert.equal((keep.match(/door\.draftAction\(/g) ?? []).length, 1);
  assert.match(keep, /fd\.set\('patch', JSON\.stringify\(\{ widgets: \{ \[t\.widgetType\]: \{ canvas: next \} \} \}\)\);/);
  assert.match(keep, /\{ held: true, ok: \(r\) => r !== SUPERSEDED && r\.ok === true \}/);
  assert.doesNotMatch(keep, /router\.refresh|requestMakerRefresh\(\)/);
  /* Refused: the page and the copy go back (unless a newer pick is already on them) and the row is told why. */
  assert.match(keep, /show\(elementPreview\(t\.key, t\.el, next, before, false\)\);\s*noteDraftedCanvas\(t\.widgetType, before, server\);/);
  assert.match(keep, /return \{ ok: false, error: refusedChoiceWords\(t\.el, field, res\.error \|\| null\) \};/);
  const tools = read(`${L}/stage-tools.tsx`);
  assert.match(tools, /if \(!o\?\.draftAction \|\| !lookTarget\) return \{ ok: false as const, error: /, 'with no draft door a pick looks like success');
  assert.match(tools, /onRefused=\{\(words\) => setWhy\(/, 'a refused pick is silent');
  /* The work area lends its own canvases and colours — nothing new is stored or read. */
  assert.match(read(`${L}/add-part-sheet.tsx`), /canvases: raw\.elementEditing\?\.canvases \?\? null,\s*palette: raw\.elementEditing\?\.palette \?\? null,/);
});

test('(4) the Dress code: the palette’s five looks are ONE row of five pictures', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PaletteLookStrip } = await import(`../${E}/palette-look-row`);
  const html = renderToStaticMarkup(React.createElement(PaletteLookStrip, { value: 'tags', colours: ['#A9834B', '#2C2A29', '#C7A27C', '#E8D9C5', '#8A8580'], onPick: () => {} }));
  assert.match(html, new RegExp(`^<div role="radiogroup" aria-label="Palette style" data-look-row="palette" data-palette-strip="" class="${SP_PALETTE_ROW.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">`));
  const picks = [...html.matchAll(/<button[^>]*data-palette-pick="([a-z]+)"[^>]*class="([^"]*)"/g)];
  assert.deepEqual(picks.map((m) => m[1]), [...PALETTE_LOOK_IDS], 'not the five looks, in the registry’s order');
  for (const m of picks) assert.equal(m[2]!.replace(/&amp;/g, '&').replace(/&gt;/g, '>'), SP_PALETTE_PICK);
  /* ONE row tall, five EQUAL buttons, 44 px each. */
  assert.ok(has(SP_PALETTE_ROW, 'h-[var(--sp-rh)]') && has(SP_PALETTE_ROW, 'shrink-0') && has(SP_PALETTE_ROW, 'flex') && !has(SP_PALETTE_ROW, 'flex-wrap'));
  assert.ok(has(SP_PALETTE_PICK, 'flex-1') && has(SP_PALETTE_PICK, 'min-w-0'));
  assert.equal(phoneHeightPx(SP_PALETTE_PICK, 812), 44);
  /* The couple's own colours, in each look's shape — and greys, never an invented colour, before they have any. */
  assert.ok((html.match(/background-color:#A9834B/gi) ?? []).length >= 5, 'a look is not drawn in the couple’s colours');
  const empty = renderToStaticMarkup(React.createElement(PaletteLookStrip, { value: 'tags', colours: [], onPick: () => {} }));
  assert.equal((empty.match(/role="radio"/g) ?? []).length, 5, 'with no colours yet the row is gone');
  assert.doesNotMatch(empty, /#A9834B/i);
  /* ONE frame a look: the picture fills its button (the dropdown thumbnail's own small box and line are put away). */
  for (const c of ['overflow-hidden', 'items-stretch', '[&>[data-palette-thumb]]:!w-full', '[&>[data-palette-thumb]]:!h-auto', '[&>[data-palette-thumb]]:!shadow-none', '[&>[data-palette-thumb]]:!rounded-none']) {
    assert.ok(has(SP_PALETTE_PICK, c), `a palette picture is a box inside a box (no ${c})`);
  }
  assert.equal((html.match(/data-palette-thumb="/g) ?? []).length, 5, 'anti-vacuity: the thumbnail’s mark moved');
  /* It is a row of Style (kept under the cards), never a card strip of its own. */
  assert.doesNotMatch(html, /data-look-cards|data-style-carousel/);
});

test('(5) who draws what: the toolbar draws row 4, the work area’s tool stands on it three rows tall; Style shows the cards and their one row only', () => {
  const tools = read(`${L}/stage-tools.tsx`);
  /* Row 4 is on when Style is, on a part with a colour or a size — never on a reply page or the pass. */
  assert.match(tools, /picked && !rsvpOpen && picked !== 'pass' \? partLookTarget\(makerPartCanvasOn\(stageKey, picked\), MAKER_PARTS\[picked\]\.el \?\? null\) : null/);
  assert.match(tools, /const lookOn = open && shownTool === 'style' && lookTarget !== null && \(lookCan\.colour \|\| lookCan\.size\);/);
  assert.match(tools, /data-stage-row4=\{lookOn \? '' : undefined\}/);
  /* The toolbar's own row is the grid's LAST row. */
  const at = tools.indexOf('<div className={SP_ROWS} data-stage-look="">');
  assert.ok(at > 0);
  assert.match(tools.slice(at, at + 200), /<div className="row-start-4 min-w-0">\s*<StageLookRow/);
  /* …and only then the work area's tool is three rows, standing one row and one gap above the toolbar's foot. */
  assert.ok(
    tools.includes(
      '`[data-maker-shell]:has([data-stage-tools][data-stage-row4]) [data-phone-chrome="panel"]{height:calc(3 * var(--sp-rh) + 2 * var(--sp-rg))!important;bottom:calc(${STAGE_BAR_FOOT_CSS} + var(--sp-rh) + var(--sp-rg))!important}`',
    ),
    'with Colour + Size on, the work area’s tool still covers row 4',
  );
  assert.equal(STAGE_BAR_FOOT_CSS, 'max(10px, env(safe-area-inset-bottom))');
  /* Under Style, a Format that has look cards shows the cards, a row of Style's (`data-look-row`) and a save's
     error — nothing else of it (an editor of the part's content is Edit's door). One with no cards keeps its pane. */
  assert.ok(tools.includes(`'[data-maker-shell]:has([data-stage-tools]) [data-stage-style-rows]:has(>[data-look-cards])>:not([data-look-cards],[data-look-row],[role="alert"]){display:none!important}'`));
  assert.ok(tools.includes(`'[data-maker-shell]:has([data-stage-tools]) [data-stage-style-rows]:not(:has(>[data-look-cards])){overflow-y:auto;gap:8px;padding-bottom:8px}'`));
  /* The marks those rules read are the ones the pieces wear. */
  assert.match(read(`${L}/stage-panel/style-carousel.tsx`), /data-look-cards=""/);
  assert.match(read(`${E}/palette-look-row.tsx`), /data-look-row="palette"/);
});

test('(6) no Font, no Alignment, no Spacing in the toolbar — and what was stored is still drawn', () => {
  /* The toolbar's own files draw none of the three. */
  for (const f of ['stage-tools.tsx', 'stage-panel/stage-look-row.tsx', 'stage-panel/stage-edit.tsx', 'stage-panel/stage-style.tsx', 'stage-panel/style-carousel.tsx']) {
    const src = read(`${L}/${f}`);
    assert.doesNotMatch(src, /<FontPick|SceneAlignRow|small="Alignment"|small="Spacing"|small="Font"|<StageText|<StageArrange/, `${f}: a Font, Alignment or Spacing control is drawn in the toolbar`);
  }
  /* The scene's Format no longer shows Arrange (where Alignment and Spacing were) under any tool. */
  assert.doesNotMatch(read(`${L}/stage-panel/stage-style.tsx`), /\{arrange\}|<Phases/);
  /* STILL HONOURED — the page draws a stored font, alignment and spacing from the same places as before. */
  const css = read('lib/element-style.ts');
  assert.ok((css.match(/out\.push\(\['font-family', /g) ?? []).length >= 2, 'a stored Font is no longer drawn');
  assert.match(css, /'text-align'/, 'a stored Alignment is no longer drawn');
  const canvas = read('lib/hub-canvas.ts');
  assert.match(canvas, /if \(canvas\.spacing === 'tight' \|\| canvas\.spacing === 'roomy'\) out\.spacing = canvas\.spacing;/, 'a stored Spacing is dropped');
  assert.match(canvas, /return canvas\.spacing \? `hub-space-\$\{canvas\.spacing\}` : null;/, 'a stored Spacing is no longer drawn');
  /* A Colour or Size pick keeps the part's other stored choices (its Font among them) — (3) executes it. */
});
