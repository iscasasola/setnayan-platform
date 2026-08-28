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

test('a sheet may hide the confirm ONLY when it carries a real control of its own', () => {
  const src = readFileSync(CANVAS, 'utf8');

  // ⚖ THIS RULE WAS "EXACTLY ONE SHEET, THE AUDIENCE ONE" UNTIL 2026-08-28, AND
  // IT IS WIDENED HERE ON PURPOSE RATHER THAN DELETED. The owner's rule (2026-07-28,
  // *"pop ups must have update button to avoid confusion"*) is about a sheet you
  // can only leave by the ×. The first pass gives its sheets something better —
  // Continue / Done, plus a skip — so the confusion the rule exists to prevent
  // cannot occur there. What must never happen is a sheet with NEITHER.
  // 🪤 THE OBVIOUS REGEX IS WRONG HERE AND FAILED SILENTLY ON THE FIRST RUN.
  // `<CanvasSheet[\s\S]*?>` stops at the first `>` in the tag — which is the
  // ARROW in `onClose={() => …}`, so every sheet with an inline handler was cut
  // short and its `confirmLabel` was never seen. Tags are closed on their own
  // line in this file; match THAT.
  const tags = [...src.matchAll(/<CanvasSheet[\s\S]*?\n\s*>/g)].map((m) => m[0]);
  assert.ok(tags.length >= 6, `expected the shipped sheets, found ${tags.length}`);

  for (const tag of tags) {
    const id = /id="([^"]+)"/.exec(tag)?.[1] ?? '(unnamed)';
    const canHideConfirm = /confirmLabel=\{null\}/.test(tag) || /confirmLabel=\{inPass/.test(tag);
    if (!canHideConfirm) continue;
    const hasOwnControl =
      id === 'canvas-audience' || // its own real "Save who it's for" submit
      /footer=\{/.test(tag); // the guided pass's Continue / Done / skip
    assert.ok(
      hasOwnControl,
      `${id} can render with no confirm and no control of its own — the exact confusion the owner reported`,
    );
  }

  // The audience opt-out is still exactly where it was.
  const audience = src.slice(src.indexOf('id="canvas-audience"'));
  assert.ok(
    audience.slice(0, 400).includes('confirmLabel={null}'),
    'the confirmLabel={null} opt-out is not on the audience sheet',
  );

  // And an ORDINARY edit — outside the first pass — still gets its button on
  // every sheet: no tag may hide the confirm unconditionally except those two.
  const unconditional = tags.filter((t) => /confirmLabel=\{null\}/.test(t));
  const ids = unconditional.map((t) => /id="([^"]+)"/.exec(t)?.[1] ?? '(unnamed)').sort();
  assert.deepEqual(
    ids,
    ['canvas-audience', 'canvas-intro'],
    `only the audience sheet and the first-card explainer may hide it always; found ${ids.join(', ')}`,
  );
});
