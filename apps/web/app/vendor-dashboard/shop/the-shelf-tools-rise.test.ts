/**
 * GUARD — THEFT WATCH AND TRACK RECORD RISE FROM THE SHOP SHELF (final check B15 · B16; drawing
 * `prototypes/final-check-area-5_2026-11-25/final-check-area-5_2026-11-25.html` § B15 · B16, approved 25 Nov).
 * The shelf row's tap draws the real page inside the shared layer (`RiseRoute page`: full screen on a phone, the centred
 * dialog from 701); inside it the page's own pinned ‹ row steps aside; a hard load keeps it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(web, rel), 'utf8'));

test('both shelf tools rise as themselves, the same shape as the card maker', () => {
  for (const [dir, title] of [['theft-watch', 'Theft Watch'], ['track-record', 'Track record']] as const) {
    const layout = src(`app/vendor-dashboard/@rise/(.)${dir}/layout.tsx`);
    assert.match(layout, new RegExp(`<RiseRoute page kind="stack" title="${title}" data="${dir}">`), `${dir} does not rise in the shared layer`);
    assert.equal(src(`app/vendor-dashboard/@rise/(.)${dir}/page.tsx`).trim(), `export { default } from '../../${dir}/page';`, `${dir}: a second page body`);
  }
  const shelves = src('app/vendor-dashboard/shop/shop-tool-shelves.ts');
  assert.match(shelves, /href: '\/vendor-dashboard\/track-record'/);
  assert.match(shelves, /href: '\/vendor-dashboard\/theft-watch'/);
});

test('inside the layer the pinned ‹ row steps aside; a hard load keeps it; a status chip stays', () => {
  const pin = src('app/vendor-dashboard/_components/tool-page.tsx');
  const fn = pin.slice(pin.indexOf('export function ToolPin('), pin.indexOf('export function ToolSection('));
  assert.match(fn, /<BackWhenNotRisen>\s*<BackButton route=\{route\} params=\{params\} variant="tool" inPlace=\{inPlace\} \/>\s*<h1\b/, 'the ‹ and the title still draw inside the layer');
  assert.match(fn, /return right \|\| sub \? pin : <BackWhenNotRisen>\{pin\}<\/BackWhenNotRisen>;/, 'an empty pinned row is drawn inside the layer, or a chip is lost');
  const back = src('app/vendor-dashboard/_components/back-when-not-risen.tsx');
  assert.match(back, /return inRiseRoute \? null : outsideRise;/, 'the centred dialog (not a RiseScreen) still shows the ‹');
});
