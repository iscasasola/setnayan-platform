/**
 * lib/alaala-tile-counts-memories.test.ts — the Alaala board tile must not make
 * a claim about MEMORIES from a count of EVENTS.
 *
 * ── WHAT IT SAID, AND WHY IT WAS WRONG ─────────────────────────────────────
 * The tile's subtitle read *"Your moments gather here as events finish"* and was
 * chosen by `finishedCount > 0`. On the owner's own home screen (2026-08-13)
 * that was FALSE: he had **14 photos and clips kept in Alaala** and **zero
 * finished events** — two weddings in December, and a "Movie Night" with no date
 * at all, so nothing could count as finished. The tile told him his memories had
 * not arrived while the wall further down the SAME PAGE was holding fourteen of
 * them. He asked why, and that is how it was found.
 *
 * 🔑 IDENTICAL SHAPE TO "No events attended yet" printed from an absence of
 * PHOTOS, fixed the same day. It survived that sweep because it lives in a
 * summary tile rather than in Alaala itself. **Alaala keeps photographs;
 * whether a party has ended says nothing about whether anything is kept.**
 *
 * ── WHY A SOURCE SCAN ──────────────────────────────────────────────────────
 * `home-board.tsx` imports `next/link` and renders JSX, so the node test runner
 * cannot import `buildHomeBoardTiles` from it. The rule that can regress is
 * visible in the source: whether the subtitle is chosen by an event count.
 *
 * ⚠ Lives in `lib/` rather than beside the component because the launcher's
 * directory name contains `(launcher)` and its siblings are already claimed by
 * an in-flight PR — keeping this file separate means neither has to wait on the
 * other.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const SRC = stripComments(
  readFileSync(
    join(process.cwd(), 'app', 'dashboard', '(launcher)', '_components', 'home-board.tsx'),
    'utf8',
  ),
);

/** The `tiles.push({ … })` block for one tile key. */
function tileBlock(key: string): string {
  const at = SRC.indexOf(`key: '${key}'`);
  assert.notEqual(at, -1, `no tile with key '${key}' — update this guard`);
  const end = SRC.indexOf('});', at);
  assert.notEqual(end, -1, `could not find the end of the '${key}' tile`);
  const block = SRC.slice(at, end);
  assert.ok(block.length > 40, `the '${key}' tile extractor matched almost nothing`);
  return block;
}

test('the Alaala tile still exists and still points at Alaala', () => {
  // Anchor first: without this every assertion below could pass vacuously the
  // day the board's shape changes.
  const block = tileBlock('alaala');
  assert.match(block, /href: '\/dashboard\/library'/);
  assert.match(block, /label: 'Alaala'/);
});

test('its subtitle is not chosen by how many events have finished', () => {
  const block = tileBlock('alaala');
  assert.ok(
    !/finishedCount\s*>\s*0\s*\?/.test(block),
    'The Alaala tile picks its subtitle from an EVENT count again. A person ' +
      'with photos kept and no finished celebration is then told their moments ' +
      'have not arrived — which is what the owner saw, with fourteen of them on ' +
      'the same page.',
  );
});

test('and it never says memories arrive only when an event ends', () => {
  const block = tileBlock('alaala');
  assert.ok(
    !/as events finish/i.test(block),
    'The "as events finish" promise is back on the Alaala tile. Photos are kept ' +
      'the moment they are taken, not when a party ends.',
  );
  // The subtitle must still SAY something — an empty one is its own defect.
  const sub = /sub:\s*'([^']+)'/.exec(block);
  assert.ok(sub, 'the Alaala tile lost its subtitle entirely');
  assert.ok(sub[1]!.length > 12, 'the Alaala tile subtitle is too short to mean anything');
});
