/**
 * 🔒 THE SHOP'S COVER SHEETS OPEN WITHOUT A REQUEST (8 Nov release gate, blocker B).
 *
 * What it caught: Promote, QR, Logo, Cover and ⚙ opened with `router.replace(?sheet=… / ?view=… / ?gear=1)` and the
 * server drew each body only while the address named it — so every open AND every close re-ran the whole Shop read
 * (Promote appeared 8.4 s after the tap, measured on dev).
 *
 * What is held (each part was broken on purpose and went red, then restored):
 *   1 · The cover opens and closes its sheets with client state + `history.replaceState` — never `router.replace` /
 *       `router.push`, and no `useRouter` at all. `null` history state, so Next.js keeps `useSearchParams` in step
 *       (a restore, never a fetch) and the cover's ⚙ still reaches the pinned row's ONE settings sheet.
 *   2 · The address still opens a sheet on arrival (a deep link, a reload, a save coming back): the open sheet starts
 *       from the address and follows it.
 *   3 · Every body comes WITH the page — no `?sheet` / `?view` / `?gear` gate on the Shop page — Promote · QR · ⚙ each
 *       in a <Suspense> so the cover never waits for them.
 *   4 · The Shop tab's ⚙ door opens locally; the other Shop section pages keep navigating (their rows are drawn only
 *       for `?gear=1`).
 *   5 · The 8 Nov Logo/Cover tap fix (a309848942) stays: the hidden pinned row never takes the cover's taps.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const HERE = import.meta.dirname;
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const PAGE = read('page.tsx');
const COVER = read('_components/shop-cover.tsx');
const GEAR = read('_components/shop-settings.tsx');

test('1 · a cover sheet opens and closes without asking the server', () => {
  assert.doesNotMatch(COVER, /\brouter\.(replace|push|refresh)\s*\(|\buseRouter\b/, 'a cover sheet re-runs the whole Shop page again');
  assert.match(COVER, /window\.history\.replaceState\(null, '',/, 'the cover no longer writes its address in place');
  for (const id of ['promote', 'qr', 'logo', 'cover'] as const) {
    assert.match(COVER, new RegExp(`onClick=\\{\\(\\) => openSheet\\('${id}'\\)\\}`), `the ${id} tap no longer opens its sheet locally`);
    assert.match(COVER, new RegExp(`<ParamSheet open=\\{sheet === '${id}'\\} onClose=\\{\\(\\) => closeSheet\\('${id}'\\)\\}`), `the ${id} sheet is not driven by the local state`);
  }
  assert.match(COVER, /const openSheet = \(id: CoverSheet\) => \{\s*setSheet\(id\);\s*replaceAddressParam\(/, 'opening does not set the state first');
  assert.match(COVER, /const closeSheet = \(id: CoverSheet\) => \{\s*setSheet\(null\);\s*replaceAddressParam\(SHEET_ADDRESS\[id\]\[0\], null\)/, 'closing leaves the address behind');
  assert.match(COVER, /onClick=\{openGear\}/);
  assert.match(COVER, /const openGear = \(\) => replaceAddressParam\('gear', '1'\);/, 'the cover’s ⚙ asks the server again');
});

test('2 · the address still opens a sheet on arrival', () => {
  assert.match(COVER, /promote: \['sheet', 'promote'\],\s*qr: \['sheet', 'qr'\],\s*logo: \['view', 'logo'\],\s*cover: \['view', 'cover'\],/, 'a sheet lost its address');
  assert.match(COVER, /const inAddress = sheetInAddress\(params\);\s*const \[sheet, setSheet\] = useState<CoverSheet \| null>\(inAddress\);/, 'a deep link no longer opens its sheet');
  assert.match(COVER, /useEffect\(\(\) => setSheet\(inAddress\), \[inAddress\]\);/, 'the sheet no longer follows its address');
});

test('3 · every sheet body comes with the page, streamed', () => {
  assert.doesNotMatch(PAGE, /one\('(sheet|view)'\)|\bsp\.gear\b|shopGearBody\(sp\)/, 'a cover sheet’s body is gated on the address again (a server round trip per open)');
  assert.match(PAGE, /promoteBody=\{\s*<Suspense fallback=\{<SheetOpening\b[^}]*\}>\s*<PromoteBody search=\{qrSearch\} part="promote" \/>\s*<\/Suspense>\s*\}/, 'Promote is not drawn with the page, in its own Suspense');
  assert.match(PAGE, /qrBody=\{\s*<Suspense fallback=\{<SheetOpening\b[^}]*\}>\s*<PromoteBody search=\{qrSearch\} part="qr" \/>\s*<\/Suspense>\s*\}/, 'QR is not drawn with the page, in its own Suspense');
  assert.match(PAGE, /gearBody=\{<Suspense fallback=\{<SheetOpening\b[^}]*\}>\{shopGearBodyAlways\(sp\)\}<\/Suspense>\}/, 'the ⚙ rows are not drawn with the page, in their own Suspense');
  assert.match(PAGE, /logoBody=\{\s*<div className="space-y-3" data-shop-logo-view="">/, 'the Logo body is gated again');
  assert.match(PAGE, /coverBody=\{\s*<div className="space-y-3" data-shop-cover-view="">/, 'the Cover body is gated again');
});

test('4 · the Shop tab’s ⚙ opens locally; other Shop pages keep navigating', () => {
  assert.match(COVER, /<ShopSettings body=\{gearBody\} local \/>/, 'the Shop tab’s ⚙ asks the server on every open');
  assert.match(GEAR, /if \(local\) window\.history\.replaceState\(null, '', href\);\s*else router\.replace\(href, \{ scroll: false \}\);/, 'the ⚙ door lost one of its two ways');
});

test('5 · the hidden pinned row never takes the cover’s Logo/Cover taps (a309848942)', () => {
  assert.match(COVER, /className="pointer-events-none sticky top-0 z-\[6\] -mb-11 h-11"/, 'the pinned row’s wrapper takes taps again');
  assert.match(COVER, /pointerEvents: pin < 0\.5 \? 'none' : 'auto'/, 'the pinned row does not take taps back once shown');
});
