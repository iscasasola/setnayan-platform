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
  assert.match(logo, /useState<'layers' \| 'tools'>\('tools'\)/, 'the editor no longer opens on the picked layer’s tools');
});

test('2 · the panels are never a Maker tool and never tiles in the lower third’s navigator', () => {
  const logo = code(`${L}/maker-logo.tsx`);
  assert.doesNotMatch(logo, /useMakerTool\b/, 'a Logo panel registers as a Maker tool — the navigator folds and the other panel is unreachable');
  assert.doesNotMatch(logo, /IntoLowerThird\b|\bltNav\b/, 'the Logo’s controls are portalled into the lower third’s navigator again');
  assert.doesNotMatch(logo, /MAKER_LT_TOOL\b/, 'a Logo panel is fixed over the lower third again');
  // Both panels wear the in-flow phone layout, and the row that switches them is on the phone.
  const panels = [...logo.matchAll(/flex-col \$\{LOGO_PANEL_PHONE\} lg:static/g)].length;
  assert.equal(panels, 2, `${panels} of the two panels sit under the logo`);
  /* RE-AIMED 2026-10-09 (Studio › Logo's chrome moved onto the templates — `studio-logo-are-the-templates.test.ts` holds the new shape): the row is the Pill selector. */
  assert.match(logo, /<PillSelector\s+label="Logo panels"[\s\S]*?key: 'layers'[\s\S]*?key: 'tools'/, 'the Layers | layer row is gone');
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
  // The row's declared room is the row the editor draws (44 px buttons, p-1, mt-2).
  const logo = code(`${L}/maker-logo.tsx`);
  /* RE-AIMED 2026-10-09 (Studio › Logo's chrome moved onto the templates — `studio-logo-are-the-templates.test.ts` holds the new shape): the Pill selector (44 px) sits centred in a 52 px band under mt-2 — the same 60 px the room is counted with. */
  assert.match(logo, /data-logo-panels="" className="mt-2 flex h-\[52px\] w-full max-w-sm shrink-0 items-center /, 'the row changed size — LOGO_PANEL_ROW_PX is stale');
});

test('4 · no "Do you want a logo?" over the Logo studio', () => {
  const details = code(`${L}/maker-details.tsx`);
  assert.match(details, /bodies\.logo = <DetailsLookBody item="logo" \/>;/, 'the Logo studio is wrapped in something again');
  assert.doesNotMatch(details, /data-details-logo-strip/, 'the answer strip is back over the editor');
});
