/**
 * the-load-rules-are-one.test.ts — ⏱ THE LOAD RULES: WAIT 150, STAY 400, ONE HELPER (motion standard 18 Nov 2026,
 * § 2 "Waits" · § 4 #17 Load).
 *
 * Held here:
 *   1. the two numbers are the standard's, the same in `lib/load-rules.ts` and as `--sn-m-load-*` in globals.css;
 *   2. the gate RUNS the rule: a fast load shows no loader at all; a slow one shows at 150 ms and stays ≥ 400 ms;
 *      a second start while it is up never blinks it;
 *   3. every shared loading part goes through the one helper — the top line and the veil by `createLoadGate`, the
 *      skeleton block by the CSS token — and none keeps a wait of its own;
 *   4. the rules never hold the page back: the helper has no way to delay content, and makes no request.
 *
 * Seen RED once each (2026-11-18), then restored — see the changelog fragment `claude-motion-loading.md`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { LOAD_STAY_MS, LOAD_WAIT_MS, createLoadGate, loaderMayShow, loaderStayLeft, type LoadGateClock } from '@/lib/load-rules';

const WEB = join(__dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const css = read('app/globals.css');

/** A clock the test moves by hand. */
function fakeClock() {
  let now = 0;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const clock: LoadGateClock = {
    now: () => now,
    setTimer: (fn, ms) => {
      timers.set(++seq, { at: now + ms, fn });
      return seq as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimer: (t) => void timers.delete(t as unknown as number),
  };
  const advanceTo = (t: number) => {
    for (;;) {
      const due = [...timers.entries()].filter(([, v]) => v.at <= t).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      now = due[1].at;
      due[1].fn();
    }
    now = t;
  };
  return { clock, advanceTo };
}

function gateWithLog() {
  const { clock, advanceTo } = fakeClock();
  const log: string[] = [];
  const gate = createLoadGate({ show: () => log.push(`show@${clock.now()}`), hide: () => log.push(`hide@${clock.now()}`) }, clock);
  return { gate, log, advanceTo };
}

test('1 · wait 150, stay 400 — the same in JS and CSS', () => {
  assert.equal(LOAD_WAIT_MS, 150);
  assert.equal(LOAD_STAY_MS, 400);
  const decl = (name: string) => [...css.matchAll(new RegExp(`${name}:\\s*([^;]+);`, 'g'))].map((m) => m[1]!.trim());
  assert.deepEqual(decl('--sn-m-load-wait'), [`${LOAD_WAIT_MS}ms`]);
  assert.deepEqual(decl('--sn-m-load-stay'), [`${LOAD_STAY_MS}ms`]);
  assert.equal(loaderMayShow(149), false);
  assert.equal(loaderMayShow(150), true);
  assert.equal(loaderStayLeft(null, 9999), 0, 'a loader never shown has nothing to stay for');
  assert.equal(loaderStayLeft(150, 200), 350);
  assert.equal(loaderStayLeft(150, 550), 0);
  assert.equal(loaderStayLeft(150, 5000), 0);
});

test('2a · a fast load shows no loader at all', () => {
  const { gate, log, advanceTo } = gateWithLog();
  gate.start();
  advanceTo(149);
  gate.finish();
  advanceTo(5000);
  assert.deepEqual(log, [], 'a load that finished inside the wait still flashed its loader');
  assert.equal(gate.shown(), false);
});

test('2b · a slow load shows at 150 ms and, once shown, stays at least 400 ms', () => {
  const { gate, log, advanceTo } = gateWithLog();
  gate.start();
  advanceTo(150);
  assert.deepEqual(log, ['show@150']);
  advanceTo(200);
  gate.finish(); // done 50 ms after it appeared
  advanceTo(549);
  assert.deepEqual(log, ['show@150'], 'the loader left before it had stayed 400 ms');
  advanceTo(550);
  assert.deepEqual(log, ['show@150', 'hide@550']);
});

test('2c · a load longer than the stay hides the moment it is done — the stay never adds time', () => {
  const { gate, log, advanceTo } = gateWithLog();
  gate.start();
  advanceTo(2000);
  gate.finish();
  assert.deepEqual(log, ['show@150', 'hide@2000']);
});

test('2d · a second start while the loader is up never blinks it; cancel is silent', () => {
  const { gate, log, advanceTo } = gateWithLog();
  gate.start();
  advanceTo(300);
  gate.finish(); // would hide at 550
  advanceTo(400);
  gate.start(); // another page, the loader is still up
  advanceTo(3000);
  assert.deepEqual(log, ['show@150'], 'the loader blinked off and on between two loads');
  gate.finish();
  assert.deepEqual(log, ['show@150', 'hide@3000']);
  gate.start();
  advanceTo(3100);
  gate.cancel();
  advanceTo(9000);
  assert.deepEqual(log, ['show@150', 'hide@3000'], 'a cancelled gate still moved its loader');
});

test('3 · every shared loading part goes through the one helper', () => {
  for (const part of ['app/_components/nav-progress.tsx', 'components/loading-activity.tsx']) {
    const src = read(part);
    assert.match(src, /from '@\/lib\/load-rules'/, `${part} does not read the load rules`);
    assert.match(src, /createLoadGate\(/, `${part} does not go through the gate`);
    const own = [...src.matchAll(/setTimeout\([^)]*?,\s*(\d[\d_]*)\s*\)/g)].map((m) => Number(m[1]!.replace(/_/g, '')));
    assert.deepEqual(own.filter((n) => n < 1000), [], `${part} keeps a short wait of its own (${own.join(', ')} ms) beside the load rules`);
  }
  const block = /\.skeleton\s*,\s*\.sn-skeleton\s*\{([^}]*)\}/.exec(css);
  assert.ok(block, 'the .skeleton rule is gone');
  assert.match(
    block[1]!,
    /animation:\s*sn-load-wait var\(--sn-m-quick\) var\(--sn-m-settle\) var\(--sn-m-load-wait\) backwards;/,
    'a skeleton block no longer waits --sn-m-load-wait before it shows (or is not filled `backwards`)',
  );
  assert.match(css, /@keyframes sn-load-wait\s*\{\s*from\s*\{\s*opacity:\s*0;?\s*\}\s*\}/, 'sn-load-wait is not a plain fade from 0');
  // The shared skeleton parts are the only way a route's loading screen draws a grey block.
  const sk = read('components/skeletons/index.tsx');
  assert.match(sk, /className=\{`skeleton \$\{className\}`\}/, '<Sk> no longer draws the one .skeleton block');
});

test('4 · the rules cannot hold the page back, and make no request', () => {
  const src = read('lib/load-rules.ts');
  assert.ok(!/\bfetch\(|import\(|XMLHttpRequest|await\b|Promise/.test(src), 'the load rules reach for the network or make something wait on them');
  assert.ok(!/from '/.test(src), 'the load rules import something — they are two numbers and a gate');
});
