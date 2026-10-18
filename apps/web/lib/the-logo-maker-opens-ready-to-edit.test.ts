/**
 * ✏ THE LOGO MAKER OPENS READY TO EDIT — and nothing can fold its tools away (owner 2026-10-08,
 * verbatim: *"when opening logo make on studio, i get stuck with 1 layer and cannot access anything
 * more … no more asking do you want a logo? this is direct edit already"*; approved design
 * `LOGO_MAKER_REPLOT_2026-10-08_fable.md` § 2 + PR L1).
 *
 * The trap was three mechanisms, each still in the tree for OTHER pages, so each is fenced here:
 *   1 · the editor opened with nothing picked → Edit read "Pick a layer" and was disabled;
 *   2 · its two panels were Maker TOOLS (`useMakerTool`) whose tiles were portalled into the lower
 *       third's navigator (`IntoLowerThird to={ltNav}`) — which goes `inert` while any tool is open;
 *   3 · a "Do you want a logo?" strip sat over the editor.
 *
 * Read with comments stripped — the docblocks that explain the fix name every symbol it forbids.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { LOGO_PANEL_PHONE, LOGO_PANEL_ROW_PX } from './logo-maker-layout';
import { hiddenOnPhone, makerLtHeightPx, phoneHeightPx, MAKER_PHONE_BAR_PX, MAKER_PHONE_VIEWPORTS, MAKER_PREVIEW_MIN_SHARE } from './maker-phone-room';

const ROOT = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const code = (rel: string) => stripComments(readFileSync(join(ROOT, rel), 'utf8'));

test('1 · the editor opens with the top layer picked, and a tap on the empty frame never un-picks it', () => {
  const logo = code(`${L}/maker-logo.tsx`);
  assert.match(logo, /useState<string \| null>\(\(\) => openingPick\(layers\)\)/, 'the editor opens with nothing picked again ("Pick a layer")');
  assert.match(logo, /function openingPick\(layers: readonly LogoLayer\[\]\): string \| null \{\s*return layers\[layers\.length - 1\]\?\.id \?\? null;/, 'the opening pick is not the top of the stack');
  assert.doesNotMatch(logo, /setSelectedId\(null\)/, 'something un-picks the layer — Edit goes dead again');
  assert.doesNotMatch(logo, /setSheet\(null\)/, 'a panel can be shut with no way back to it');
  /* RE-AIMED 2026-10-18 (L2 — the Layers panel became the layers carousel, always drawn): the panel opens on the
     picked layer's tools, in the tool that layer has. */
  assert.match(logo, /useState<'tools' \| 'add'>\('tools'\)/, 'the editor no longer opens on the picked layer’s tools');
  assert.match(logo, /useState<LogoTool>\(\(\) => toolFor\(layers\[layers\.length - 1\]\)\)/, 'the editor opens on a tool the top layer may not have');
});

test('2 · the panels are never a Maker tool and never tiles in the lower third’s navigator', () => {
  const logo = code(`${L}/maker-logo.tsx`);
  assert.doesNotMatch(logo, /useMakerTool\b/, 'a Logo panel registers as a Maker tool — the navigator folds and the other panel is unreachable');
  assert.doesNotMatch(logo, /IntoLowerThird\b|\bltNav\b/, 'the Logo’s controls are portalled into the lower third’s navigator again');
  assert.doesNotMatch(logo, /MAKER_LT_TOOL\b/, 'a Logo panel is fixed over the lower third again');
  /* RE-AIMED 2026-10-18 (L2 + L3, LOGO_MAKER_REPLOT): the layers are the carousel — ALWAYS drawn, never a panel to
     switch to — and the tools panel wears the in-flow phone layout, its tools row inside it. */
  const panels = [...logo.matchAll(/flex-col \$\{LOGO_PANEL_PHONE\} lg:static/g)].length;
  assert.equal(panels, 1, `${panels} tools panels sit under the logo`);
  const strip = /<aside[^>]*data-logo-cards-strip=""[^>]*className="([^"]*)"/.exec(logo);
  assert.ok(strip, 'the layers carousel is gone');
  assert.doesNotMatch(strip![1]!, /(?:^|\s)(?:max-lg:)?hidden(?:\s|$)/, 'the layers carousel can be hidden on a phone — the one-layer trap again');
  assert.match(logo, /<LogoLayerCards\b/, 'the carousel is not the layer cards');
  assert.match(logo, /<PillSelector<LogoTool>\s+label="Logo tools"/, 'the tools row is gone');
});

test('3 · the phone layout is in the page’s flow, under the logo, and steps aside only in the guided flow', () => {
  const t = LOGO_PANEL_PHONE.split(/\s+/);
  assert.ok(t.includes('max-lg:order-last'), 'a panel is not under the logo');
  assert.ok(!t.some((c) => /^max-lg:(fixed|absolute)$/.test(c)), 'a panel floats over the page again');
  assert.ok(!hiddenOnPhone(`flex ${LOGO_PANEL_PHONE}`), 'the open panel is hidden on a phone');
  assert.ok(t.includes('max-lg:group-data-[details-mode=guided]/ws:hidden'), 'the panels sit under the guided step’s sheet');
  // The row + the panel are the lower third's room, no more: the logo keeps what the page keeps with any tool open.
  for (const { width, height } of MAKER_PHONE_VIEWPORTS) {
    const lt = makerLtHeightPx(height);
    const px = phoneHeightPx(LOGO_PANEL_PHONE, height);
    assert.ok(px !== null, 'the panel declares no phone height');
    assert.equal(px + LOGO_PANEL_ROW_PX, lt, `${width}×${height}: the row + the panel are ${px + LOGO_PANEL_ROW_PX} px — not the lower third (${lt} px)`);
    const share = (height - MAKER_PHONE_BAR_PX - lt) / height;
    assert.ok(share >= MAKER_PREVIEW_MIN_SHARE - 1e-9, `${width}×${height}: the logo keeps ${(share * 100).toFixed(1)}%`);
  }
  // The row's declared room is the row the editor draws.
  const logo = code(`${L}/maker-logo.tsx`);
  /* RE-AIMED 2026-10-18 (L2): the row is the layers carousel — 74 px cards under mt-2, the 82 px the room is counted
     with (the prototype's `.lyrs`); the tools row is inside the panel's own height. */
  assert.equal(LOGO_PANEL_ROW_PX, 8 + 74);
  assert.match(logo, /data-logo-cards-strip=""\s+className="mt-2 flex h-\[74px\] w-full shrink-0 flex-col /, 'the carousel changed size — LOGO_PANEL_ROW_PX is stale');
  const cards = code(`${L}/logo-layer-cards.tsx`);
  assert.match(cards, /relative flex h-\[74px\] w-\[66px\] shrink-0 flex-col/, 'a layer card is not 74 px tall');
});

test('4 · no "Do you want a logo?" over the Logo studio', () => {
  const details = code(`${L}/maker-details.tsx`);
  assert.match(details, /bodies\.logo = <DetailsLookBody item="logo" \/>;/, 'the Logo studio is wrapped in something again');
  assert.doesNotMatch(details, /data-details-logo-strip/, 'the answer strip is back over the editor');
});
