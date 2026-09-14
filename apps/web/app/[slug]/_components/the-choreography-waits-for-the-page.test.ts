/**
 * THE SCROLL CHOREOGRAPHY RUNS THE SHIPPED SCRIPT, IN A FAKE DOM.
 *
 * ── 🔴 THE DEFECT ──────────────────────────────────────────────────────────
 * `PahinaMotionObserver` made ONE synchronous query and gave up if it came back
 * empty. The public invitation streams — React flushes Suspense content into
 * hidden buffers and moves it in afterwards — and this script runs at ~96% of
 * the document, BEFORE those moves. So it matched zero chapters every time,
 * called `give()`, removed `.pahina-js` globally and permanently, and the page
 * never animated for anyone from 2026-07-25 to 2026-09-14.
 *
 * Caught on the live page by patching `DOMTokenList.prototype.remove`:
 *   `when: remove · from: give() · readyState: "loading" · selectorMatches: 0`
 *   …afterwards: `selectorMatches 8 · revealed 0 · flag off`
 *
 * ── WHY THIS TEST EXECUTES THE SCRIPT INSTEAD OF GREPPING IT ───────────────
 * 🔑 A SOURCE ASSERTION WOULD HAVE PASSED ALL SEVEN WEEKS. Every line of the
 * broken version was present and correct — the observer was mounted, the marker
 * was there, the selector was right. What was wrong was WHEN one line ran, and
 * no grep can see that. So the real string is pulled off the real component and
 * RUN against a DOM that streams the way production does.
 *
 * The fake is deliberately small and dumb. It models exactly the four things
 * that mattered: a query that answers 0 and later 8, a `readyState` that starts
 * at "loading", a `DOMContentLoaded` that fires late, and a classList somebody
 * can remove a flag from.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The script exactly as it ships — lifted out of the component's own source,
 * never re-typed here.
 *
 * ⚠ Read from the FILE rather than by calling `PahinaMotionObserver()`: the
 * component returns JSX, and `tsx --test` compiles JSX to `React.createElement`
 * with no React in scope, so calling it throws "React is not defined". Reading
 * the file keeps the property that matters — the bytes under test are the bytes
 * that ship — without dragging a renderer in for one string.
 */
function shippedScript(): string {
  const file = readFileSync(
    join(process.cwd(), 'app/[slug]/_components/pahina-motion.tsx'),
    'utf8',
  );
  const start = file.indexOf('export function PahinaMotionObserver');
  assert.ok(start > 0, 'PahinaMotionObserver is gone — this test is pointing at nothing');
  const body = file.slice(start);
  const m = body.match(/__html: `([\s\S]*?)`,\n/);
  assert.ok(m, 'could not lift the observer script out of the component');
  const src = m![1]!;
  assert.ok(src.includes('IntersectionObserver'), 'got something that is not the observer script');
  return src;
}

type FakeEl = { classes: Set<string>; classList: { add(c: string): void } };

function makeEl(): FakeEl {
  const classes = new Set<string>();
  return { classes, classList: { add: (c: string) => void classes.add(c) } };
}

/**
 * Run the shipped script against a DOM that reveals `chapters` only once
 * `flush()` is called — i.e. the page is still streaming when it executes.
 */
function run(chaptersAfterFlush: number, chaptersNow = 0) {
  const rootClasses = new Set<string>(['pahina-js']);
  const els: FakeEl[] = Array.from({ length: chaptersAfterFlush }, makeEl);
  let visible = chaptersNow;
  const listeners: Array<() => void> = [];
  const timers: Array<() => void> = [];
  const observed: FakeEl[] = [];
  const warnings: string[] = [];
  let ioCallback: ((entries: Array<{ isIntersecting: boolean; target: FakeEl }>) => void) | null = null;

  const document = {
    readyState: 'loading',
    documentElement: {
      classList: {
        contains: (c: string) => rootClasses.has(c),
        add: (c: string) => void rootClasses.add(c),
        remove: (c: string) => void rootClasses.delete(c),
      },
    },
    querySelectorAll: () => els.slice(0, visible),
    addEventListener: (_ev: string, fn: () => void) => void listeners.push(fn),
  };
  const win: Record<string, unknown> = {};
  class FakeIO {
    constructor(cb: (entries: Array<{ isIntersecting: boolean; target: FakeEl }>) => void) {
      ioCallback = cb;
    }
    observe(t: FakeEl) { observed.push(t); }
    unobserve() {}
  }
  const console = { warn: (m: string) => void warnings.push(m) };
  const setTimeout = (fn: () => void) => void timers.push(fn);

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function('document', 'window', 'IntersectionObserver', 'console', 'setTimeout', shippedScript())(
    document, win, FakeIO, console, setTimeout,
  );

  return {
    rootClasses, els, observed, warnings, win,
    /** The rest of the page arrives, then DOMContentLoaded fires. */
    flush() { visible = chaptersAfterFlush; document.readyState = 'complete'; listeners.forEach((f) => f()); },
    /** The 1.5s belt-and-braces retry, without DOMContentLoaded ever firing. */
    fireTimer() { visible = chaptersAfterFlush; timers.forEach((f) => f()); },
    intersect(i: number) { ioCallback?.([{ isIntersecting: true, target: els[i]! }]); },
    timerCount: () => timers.length,
  };
}

test('🔴 THE REGRESSION: mid-stream emptiness does NOT stand the choreography down', () => {
  const r = run(8); // 0 chapters now, 8 after the stream settles
  assert.ok(
    r.rootClasses.has('pahina-js'),
    'the flag was removed while the document was still parsing — this is the seven-week defect, back',
  );
  assert.equal(r.observed.length, 0, 'nothing is observable yet, so nothing should be observed yet');
  assert.deepEqual(r.warnings, [], 'it must not announce a stand-down it did not make');
});

test('…and once the page settles, every chapter is observed', () => {
  const r = run(8);
  r.flush();
  assert.equal(r.observed.length, 8, 'the late chapters were never picked up');
  assert.ok(r.rootClasses.has('pahina-js'), 'the flag must survive so the CSS can reveal');
});

test('a chapter coming into view is revealed', () => {
  const r = run(3);
  r.flush();
  r.intersect(1);
  assert.ok(r.els[1]!.classes.has('pahina-in'), 'an intersecting chapter did not get its reveal class');
  assert.ok(!r.els[0]!.classes.has('pahina-in'), 'a chapter that never intersected was revealed anyway');
});

test('the fast path is unchanged — a complete page attaches immediately', () => {
  const r = run(5, 5); // already there when the script runs
  assert.equal(r.observed.length, 5, 'a page that was ready should not have waited');
  assert.ok(r.rootClasses.has('pahina-js'));
});

test('🔒 a GENUINELY empty page still stands down — the contract is kept', () => {
  const r = run(0);
  assert.ok(r.rootClasses.has('pahina-js'), 'it must not give up before the retry');
  r.flush();
  assert.ok(!r.rootClasses.has('pahina-js'), 'nothing to animate, so the page must be un-hidden');
});

test('🔑 and it SAYS so — a silent stand-down is what hid this for seven weeks', () => {
  const r = run(0);
  r.flush();
  assert.equal(r.warnings.length, 1, 'the stand-down left no trace');
  assert.match(r.warnings[0]!, /stood down/i);
  assert.match(r.warnings[0]!, /matched 0/, 'the message must say what its selector actually saw');
});

test('the retry is scheduled TWO ways, so one dead path cannot strand it', () => {
  const r = run(4);
  assert.ok(r.timerCount() > 0, 'no timer backstop — a DOMContentLoaded that never fires would strand the page');
  r.fireTimer(); // DOMContentLoaded deliberately never fires
  assert.equal(r.observed.length, 4, 'the timer path did not attach');
  assert.ok(r.rootClasses.has('pahina-js'));
});

test('it attaches once, not twice, when both paths fire', () => {
  const r = run(4);
  r.flush();
  r.fireTimer();
  assert.equal(r.observed.length, 4, 'the chapters were observed twice — both retry paths ran');
});

test('it does nothing at all when the flag was never set (reduced motion / no IO)', () => {
  const r = run(6);
  r.rootClasses.delete('pahina-js');
  const again = run(6);
  again.rootClasses.delete('pahina-js');
  // Re-run from scratch with the flag absent from the start:
  const rootClasses = new Set<string>();
  const doc = {
    readyState: 'loading',
    documentElement: { classList: { contains: (c: string) => rootClasses.has(c), add: () => {}, remove: () => {} } },
    querySelectorAll: () => [],
    addEventListener: () => {},
  };
  const win: Record<string, unknown> = {};
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function('document', 'window', 'IntersectionObserver', 'console', 'setTimeout', shippedScript())(
    doc, win, class {}, { warn: () => {} }, () => {},
  );
  assert.equal(win.__pahinaArmed, undefined, 'it armed itself on a page that opted out of motion');
});
