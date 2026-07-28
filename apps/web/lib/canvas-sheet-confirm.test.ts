import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Owner 2026-07-28: "pop ups must have update button to avoid confusion" —
 * every canvas sheet closes with an explicit "Update card" confirm. Edits are
 * live; the button affirms and closes, nothing more. These pins hold the two
 * properties that matter and would fail silently if lost.
 */

const CANVAS = join(
  process.cwd(),
  'app',
  'vendor-dashboard',
  'services',
  '_components',
  'canvas-maker.tsx',
);

test('CanvasSheet defaults every sheet to an explicit "Update card" confirm', () => {
  const src = readFileSync(CANVAS, 'utf8');
  assert.match(
    src,
    /confirmLabel = 'Update card'/,
    'the default confirm is gone — sheets close only via ×, the exact confusion the owner reported',
  );
  assert.match(src, /\{confirmLabel !== null \? \(/, 'the confirm render is gone');
});

test('the confirm is type="button" — a default-submit inside the card form would submit the card', () => {
  const src = readFileSync(CANVAS, 'utf8');
  const render = src.slice(src.indexOf('{confirmLabel !== null ? ('));
  const openTag = render.slice(0, render.indexOf('{confirmLabel}'));
  assert.match(
    openTag,
    /type="button"/,
    'the sheet confirm lost type="button" — tapping "Update card" would submit commitVendorService mid-edit',
  );
});

test('only the audience sheet opts out (it has its own real "Save who it’s for" submit)', () => {
  const src = readFileSync(CANVAS, 'utf8');
  const optOuts = [...src.matchAll(/confirmLabel=\{null\}/g)].length;
  assert.equal(
    optOuts,
    1,
    `exactly one sheet may hide the confirm (the audience sheet); found ${optOuts}`,
  );
  // …and that one opt-out sits on the audience sheet, next to its own submit.
  const audience = src.slice(src.indexOf('id="canvas-audience"'));
  assert.ok(
    audience.slice(0, 400).includes('confirmLabel={null}'),
    'the confirmLabel={null} opt-out is not on the audience sheet',
  );
});
