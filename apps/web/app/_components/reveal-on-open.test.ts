/**
 * reveal-on-open.test.ts — THE BEHAVIOUR (owner 2026-11-04, app-wide): after a user opens a section and it settles, if
 * it runs past the bottom, its head glides to the pin line; if it fits, nothing moves; a fold open on load never moves
 * the page; a touch cancels the glide. Drives the pure engine (`reveal-engine.ts`) with a fake page under plain Node.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isUserOpen, revealAfterSettle, revealTarget, type RevealEnv } from './reveal-engine';

/** A fake page: one section whose natural top/bottom are in document px, a pin line, a 844 px window. */
function page(o: { top: number; bottom: number; pin?: number; viewBottom?: number; reduced?: boolean }) {
  let scroll = 0;
  let clock = 0;
  const frames: Array<() => void> = [];
  const inputs = new Set<() => void>();
  const moves: number[] = [];
  const sec = { top: o.top, bottom: o.bottom };
  const env: RevealEnv = {
    now: () => clock,
    frame: (cb) => frames.push(cb),
    cancelFrame: () => {
      frames.length = 0;
    },
    section: () => ({ top: sec.top - scroll, bottom: sec.bottom - scroll }),
    view: () => ({ top: o.pin ?? 56, bottom: o.viewBottom ?? 844 }),
    getScroll: () => scroll,
    setScroll: (y) => {
      scroll = Math.max(0, y);
      moves.push(scroll);
    },
    reduced: o.reduced ?? false,
    onInput: (cb) => {
      inputs.add(cb);
      return () => inputs.delete(cb);
    },
  };
  return {
    env,
    sec,
    get scroll() {
      return scroll;
    },
    set scroll(y: number) {
      scroll = y;
    },
    moves,
    /** Run frames at 16 ms until none are left (or `max`). */
    run(max = 500) {
      for (let i = 0; i < max && frames.length; i++) {
        clock += 16;
        frames.shift()!();
      }
    },
    touch() {
      for (const cb of [...inputs]) cb();
    },
    get listening() {
      return inputs.size;
    },
  };
}

test('opened and running past the bottom: the head glides onto the pin line', () => {
  const p = page({ top: 600, bottom: 1500, pin: 56 });
  revealAfterSettle(p.env);
  p.run();
  assert.equal(p.env.section().top, 56, 'the head did not land on the pin line');
  assert.ok(p.moves.length > 3, 'it jumped instead of gliding');
  assert.equal(p.listening, 0, 'it kept listening after it finished');
});

test('the whole section fits: nothing moves', () => {
  const p = page({ top: 300, bottom: 800 });
  revealAfterSettle(p.env);
  p.run();
  assert.deepEqual(p.moves, [], 'a section that fits moved the page');
  assert.equal(revealTarget({ top: 300, bottom: 800 }, { top: 56, bottom: 844 }, 0), null);
});

test('it measures AFTER the layout settles — a fold above closing (one open at a time) moves the target', () => {
  const p = page({ top: 900, bottom: 1800 });
  revealAfterSettle(p.env);
  // The fold above shuts over 10 frames, lifting this one by 300 px.
  for (let i = 0; i < 10; i++) {
    p.sec.top -= 30;
    p.sec.bottom -= 30;
    p.run(1);
  }
  p.run();
  assert.equal(p.env.section().top, 56, 'measured before the fold above finished shutting');
});

test('reduced motion: one jump, no glide', () => {
  const p = page({ top: 600, bottom: 1500, reduced: true });
  revealAfterSettle(p.env);
  p.run();
  assert.deepEqual(p.moves, [544]);
});

test('a touch during the glide cancels it — the page stays where the finger left it', () => {
  const p = page({ top: 600, bottom: 1500 });
  revealAfterSettle(p.env);
  p.run(REVEAL_FRAMES_TO_GLIDE + 3);
  assert.ok(p.moves.length > 0, 'the glide had not started');
  const at = p.scroll;
  p.touch();
  p.run();
  assert.equal(p.scroll, at, 'the glide kept going after a touch');
  assert.ok(p.env.section().top > 56);
});

test('a scroll that is not ours cancels the glide', () => {
  const p = page({ top: 600, bottom: 1500 });
  revealAfterSettle(p.env);
  p.run(REVEAL_FRAMES_TO_GLIDE + 3);
  p.scroll = 40; // the user flicked back up
  p.run();
  assert.equal(p.scroll, 40);
});

test('only a USER open reveals: never a fold open on load, a restored state, a controlled open or a #hash', () => {
  const base = { cause: 'press' as const, gestureAt: -Infinity, now: 1000, windowMs: 1000 };
  // Mounting open (defaultOpen · restored state): no closed → open change.
  assert.equal(isUserOpen({ ...base, was: true, open: true, pressedAt: 990 }), false);
  // A tap on the head, then it opens.
  assert.equal(isUserOpen({ ...base, was: false, open: true, pressedAt: 990 }), true);
  // Opened with no press (an #anchor, a controlled open from elsewhere).
  assert.equal(isUserOpen({ ...base, was: false, open: true, pressedAt: -Infinity }), false);
  // Closing never reveals.
  assert.equal(isUserOpen({ ...base, was: true, open: false, pressedAt: 990 }), false);
  // An opener that does not own its press (Collapsible, <details>): a tap just before counts, a stale one does not.
  assert.equal(isUserOpen({ ...base, cause: 'gesture', was: false, open: true, pressedAt: -Infinity, gestureAt: 900 }), true);
  assert.equal(isUserOpen({ ...base, cause: 'gesture', was: false, open: true, pressedAt: -Infinity, gestureAt: -5000 }), false);
});

/** The settle wait (REVEAL_STABLE_FRAMES) plus the first frame. */
const REVEAL_FRAMES_TO_GLIDE = 8;
