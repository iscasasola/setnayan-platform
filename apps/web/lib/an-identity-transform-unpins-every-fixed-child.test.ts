import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  lingeringTransforms,
  keyframesTouchingTransform,
} from './lingering-transform';

/**
 * The property: no page-level wrapper ends an animation still holding a
 * transform, because a transform — even an identity one — makes its element the
 * containing block for every `position: fixed` descendant.
 *
 * ─── MEASURED ON PRODUCTION 2026-09-18 ───────────────────────────────────
 *     .sn-page-enter  →  transform: matrix(1, 0, 0, 1, 0, 0)
 *     backdrop  636 x 2444   (should be 636 x 1107, the viewport)
 *     card      top 1052 → bottom 1393, viewport ends at 1107
 *
 * The vendor coach-mark's Skip and Next sat 341px below the fold. The owner saw
 * a dimmed page and a sliver of a dialog he could not reach. Nothing about the
 * transform was visible: it moves nothing, and `both` is one word in a
 * shorthand.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const CSS = () => readFileSync(join(WEB, 'app/globals.css'), 'utf8');
const BASELINE = () =>
  readFileSync(join(WEB, 'scripts/lingering-transform.baseline.txt'), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

/* ── THE DECISION, EXECUTED ──────────────────────────────────────────────── */

test('the detector finds a persisting transform, whatever it is spelled as', () => {
  const css = `
    @keyframes rise { from { opacity: 0; transform: translateY(8px); } }
    @keyframes spin { from { rotate: 0deg; } }
    @keyframes fade { from { opacity: 0; } }
    .a { animation: rise 400ms both ease; }
    .b { animation: spin 1s forwards; }
    .c { animation: fade 200ms both; }
    .d { animation: rise 400ms backwards ease; }
  `;
  const names = keyframesTouchingTransform(css);
  assert.ok(names.has('rise'));
  assert.ok(names.has('spin'), 'the `rotate` property creates a containing block too');
  assert.ok(!names.has('fade'), 'opacity alone is harmless');

  const hits = lingeringTransforms(css).map((h) => h.selector).sort();
  assert.deepEqual(hits, ['.a', '.b'], 'expected .a (both) and .b (forwards) only');
  // The floor that matters: `backwards` is the FIX, and must never be flagged.
  assert.ok(!hits.includes('.d'), 'backwards was flagged — the fix would look like the bug');
  assert.ok(!hits.includes('.c'), 'a transform-free animation was flagged');
});

/* ── THE REGRESSION ──────────────────────────────────────────────────────── */

test('.sn-page-enter never holds a transform again', () => {
  const offenders = lingeringTransforms(CSS()).map((h) => h.selector);
  assert.ok(
    !offenders.includes('.sn-page-enter'),
    'THE BUG, RESTORED. .sn-page-enter wraps every in-shell page, so a held ' +
      'transform unpins every fixed overlay in the app — invisibly. Use ' +
      '`backwards`, never `both`.',
  );
  // And positively: the rule still runs its animation, it was not just deleted.
  assert.match(
    CSS(),
    /\.sn-page-enter \{ animation: sn-rise-soft 400ms backwards/,
    'the route-entry animation was removed rather than corrected',
  );
});

/* ── THE BASELINE MAY ONLY SHRINK ────────────────────────────────────────── */

test('no NEW rule starts holding a transform after animating', () => {
  const now = lingeringTransforms(CSS())
    .map((h) => `${h.selector} :: ${h.animation}`)
    .sort();
  const known = BASELINE().sort();
  const added = now.filter((r) => !known.includes(r));
  assert.deepEqual(
    added,
    [],
    'These rules now keep a transform applied after their animation ends. If ' +
      'nothing inside is position:fixed it is harmless — prove that, then add ' +
      'it to scripts/lingering-transform.baseline.txt with a reason. ' +
      'Otherwise use `backwards`:\n  ' + added.join('\n  '),
  );
  // A guard that finds nothing passes forever.
  assert.ok(
    known.length >= 20,
    `the baseline holds only ${known.length} entries — the scan has gone blind`,
  );
  const removed = known.filter((r) => !now.includes(r));
  assert.ok(
    removed.length === 0 || true,
    'removals are always welcome — regenerate the baseline',
  );
});
