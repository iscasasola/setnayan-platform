/**
 * reveal-sweep.test.ts — "More settings" first open: down through every row, back to Price; a touch stops it.
 * Owner 2026-11-04: "we want to scroll so the see all animating then return back to the first one which is price".
 *
 * The runner is driven for real with a fake clock and fake frames (no DOM in this runner).
 * Sabotage (2026-11-04): `const off = env.onPersonInput(stop);` → `const off = env.onPersonInput(() => {});` →
 * "a touch stops it at once" red; `if (env.reducedMotion) {` → `if (false) {` → "reduce motion" red. Restored green.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { runRevealSweep, sweepAt, SWEEP, SWEEP_TOTAL_MS, type SweepEnv } from '@/lib/reveal-sweep';

function harness(opts: { reducedMotion?: boolean; scroll?: number; max?: number; down?: number; back?: number } = {}) {
  let t = 0;
  let scroll = opts.scroll ?? 200;
  const frames = new Map<number, () => void>();
  let nextId = 1;
  const writes: number[] = [];
  let personStop: (() => void) | null = null;
  let unsubscribed = false;
  const env: SweepEnv = {
    now: () => t,
    frame: (cb) => {
      const id = nextId++;
      frames.set(id, cb);
      return id;
    },
    cancelFrame: (id) => void frames.delete(id),
    read: () => ({ scroll, max: opts.max ?? 2000, down: opts.down ?? 900, back: opts.back ?? 400 }),
    write: (v) => {
      scroll = v;
      writes.push(v);
    },
    onPersonInput: (stop) => {
      personStop = stop;
      return () => {
        unsubscribed = true;
      };
    },
    reducedMotion: opts.reducedMotion ?? false,
  };
  const tick = (ms: number) => {
    t += ms;
    const run = [...frames.entries()];
    frames.clear();
    for (const [, cb] of run) cb();
  };
  return { env, tick, writes, scroll: () => scroll, touch: () => personStop?.(), pending: () => frames.size, unsubscribed: () => unsubscribed };
}

test('the curve: waits, goes down to the last row, holds, comes back to the first row — under 2 s', () => {
  assert.ok(SWEEP_TOTAL_MS >= 1500 && SWEEP_TOTAL_MS <= 2000, `${SWEEP_TOTAL_MS} ms`);
  assert.equal(sweepAt(0, 200, 900, 400), 200);
  assert.equal(sweepAt(SWEEP.waitMs + SWEEP.downMs, 200, 900, 400), 900);
  assert.equal(sweepAt(SWEEP_TOTAL_MS, 200, 900, 400), 400);
});

test('run to the end: it reaches the bottom, settles on Price, and lets go', () => {
  const h = harness();
  runRevealSweep(h.env);
  for (let i = 0; i < 200 && h.pending() > 0; i++) h.tick(16);
  assert.equal(Math.max(...h.writes), 900, 'never reached the last row');
  assert.equal(h.scroll(), 400, 'did not come back to Price');
  assert.equal(h.pending(), 0);
  assert.ok(h.unsubscribed(), 'it kept listening after it finished');
});

test('a touch stops it at once and leaves them exactly where they are', () => {
  const h = harness();
  runRevealSweep(h.env);
  for (let i = 0; i < 40; i++) h.tick(16); // ~640 ms: mid-way down
  const at = h.scroll();
  assert.ok(at > 200 && at < 900, `expected mid-sweep, was ${at}`);
  const n = h.writes.length;
  h.touch();
  for (let i = 0; i < 100; i++) h.tick(16);
  assert.equal(h.writes.length, n, 'it kept scrolling after the touch');
  assert.equal(h.scroll(), at, 'the touch did not leave them where they were');
  assert.equal(h.pending(), 0);
});

test('it never scrolls past what can be scrolled (no blank past the end)', () => {
  const h = harness({ max: 600 });
  runRevealSweep(h.env);
  for (let i = 0; i < 200 && h.pending() > 0; i++) h.tick(16);
  assert.ok(Math.max(...h.writes) <= 600);
});

test('reduce motion: no sweep — one write, straight to Price', () => {
  const h = harness({ reducedMotion: true });
  runRevealSweep(h.env);
  h.tick(16);
  assert.deepEqual(h.writes, [400]);
  assert.equal(h.pending(), 0);
});

test('the maker plays it on the FIRST open of More settings only', () => {
  const src = stripComments(readFileSync(join(__dirname, '..', 'app/vendor-dashboard/services/_components/canvas-maker.tsx'), 'utf8'));
  assert.match(src, /onOpenChange=\{onMoreOpenChange\}/, 'More settings no longer reports its opening');
  assert.match(src, /if \(moreRevealed\.current\) return;\s*moreRevealed\.current = true;/, 'the reveal plays on every open');
  assert.match(src, /stopReveal\.current = revealFold\(fold, lastRow/);
});
