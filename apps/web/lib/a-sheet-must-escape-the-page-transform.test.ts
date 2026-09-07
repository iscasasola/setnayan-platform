/**
 * a-sheet-must-escape-the-page-transform.test.ts
 *
 * `position: fixed` is relative to the nearest TRANSFORMED ancestor, not the
 * viewport. This app's page wrapper `.sn-page-enter` carries
 * `transform: matrix(1, 0, 0, 1, 0, 0)` — an identity transform left behind by
 * the entrance animation, invisible and still a containing block.
 *
 * Measured in production 2026-09-07 at 1187×1208: the canvas maker's
 * `fixed inset-0` sheet backdrop measured **77px from the top and 184px tall**
 * instead of filling the viewport. `lg:my-auto` then centred a 435px sheet
 * inside 184px (`margin-top: -125.5px`, top **-48px**), so the service-card
 * editor rendered crushed into the top-right corner, over the header. The
 * owner's words: *"it stay on the upper right. cannot read and edit."*
 *
 * 🔑 NOTHING WAS MIS-STYLED. Every rule did exactly what it says; the container
 * was the wrong size. Two other components already portal to <body> for this
 * exact reason and each left a note. This one had missed it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(resolve(HERE, rel), 'utf8'));

/**
 * Every full-screen sheet in the app. A `fixed inset-0` overlay rendered inside
 * the page tree is a bug waiting for a transformed ancestor — which this app
 * always has.
 */
const SHEETS = [
  '../app/vendor-dashboard/services/_components/canvas-maker.tsx',
  '../app/dashboard/[eventId]/vendors/_components/category-search-overlay.tsx',
  '../app/dashboard/[eventId]/vendors/_components/team-summary-chip.tsx',
] as const;

for (const rel of SHEETS) {
  const name = rel.split('/').pop();
  test(`${name} portals its overlay out of the page tree`, () => {
    const src = read(rel);
    assert.match(
      src,
      /createPortal\(/,
      `${name} renders a fixed overlay inside the page tree — .sn-page-enter's ` +
        'identity transform will become its containing block and the sheet will ' +
        'be sized against a fragment of the viewport',
    );
    assert.match(src, /document\.body/, `${name} portals somewhere other than <body>`);
  });
}

test('the canvas sheet keeps its mount guard — a portal on the server has no body', () => {
  const src = read('../app/vendor-dashboard/services/_components/canvas-maker.tsx');
  const i = src.indexOf('createPortal(');
  assert.ok(i > -1, 'the portal is gone');
  const before = src.slice(Math.max(0, i - 600), i);
  assert.match(before, /if \(!mounted\) return null;/, 'no mount guard before the portal');
  assert.match(before, /useEffect\(\(\) => setMounted\(true\), \[\]\)/, 'mounted is never set');
});

test('the sheet still docks right on large screens — the fix is the container, not the design', () => {
  const src = read('../app/vendor-dashboard/services/_components/canvas-maker.tsx');
  assert.match(src, /lg:right-0/, 'the right dock was removed — that was not the bug');
  assert.match(src, /lg:my-auto/, 'the vertical centring was removed — it was correct all along');
});
