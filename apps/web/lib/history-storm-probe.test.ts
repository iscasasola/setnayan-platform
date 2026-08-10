import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';

import { installHistoryStormProbe, STORM_THRESHOLD } from './history-storm-probe';

const g = globalThis as unknown as { window?: unknown };
let realCalls: string[] = [];

beforeEach(() => {
  realCalls = [];
  g.window = {
    history: {
      replaceState: (...a: unknown[]) => void realCalls.push(`replace:${String(a[2])}`),
      pushState: (...a: unknown[]) => void realCalls.push(`push:${String(a[2])}`),
    },
    location: { pathname: '/dashboard' },
  };
});
afterEach(() => { delete g.window; });

function w() {
  return (g.window as { history: History; location: { pathname: string } });
}

test('it always calls through — a probe must not change behaviour', () => {
  const stop = installHistoryStormProbe(() => {});
  w().history.replaceState(null, '', '/a');
  w().history.pushState(null, '', '/b');
  assert.deepEqual(realCalls, ['replace:/a', 'push:/b']);
  stop();
});

test('normal navigation reports nothing', () => {
  let reports = 0;
  const stop = installHistoryStormProbe(() => (reports += 1));
  for (let i = 0; i < STORM_THRESHOLD - 1; i++) w().history.replaceState(null, '', '/x');
  assert.equal(reports, 0, 'a probe that cries wolf gets ignored on the day it is right');
  stop();
});

test('a storm reports the count and a stack — the thing we are actually after', () => {
  const seen: { count: number; stack: string; path: string }[] = [];
  const stop = installHistoryStormProbe((s) => seen.push(s));
  for (let i = 0; i < STORM_THRESHOLD + 5; i++) w().history.replaceState(null, '', '/x');
  assert.equal(seen.length, 1);
  assert.ok(seen[0]!.count >= STORM_THRESHOLD);
  assert.ok(seen[0]!.stack.length > 0, 'no stack means no answer');
  stop();
});

test('it reports ONCE — a storm must not become a report storm', () => {
  let reports = 0;
  const stop = installHistoryStormProbe(() => (reports += 1));
  for (let i = 0; i < STORM_THRESHOLD * 5; i++) w().history.replaceState(null, '', '/x');
  assert.equal(reports, 1);
  stop();
});

test('it never sends the query string', () => {
  // The query string on this app can carry a guest token. A diagnostic must not
  // become the thing that leaks one.
  const seen: { path: string }[] = [];
  const stop = installHistoryStormProbe((s) => seen.push(s));
  (g.window as { location: { pathname: string } }).location.pathname = '/dashboard';
  for (let i = 0; i < STORM_THRESHOLD; i++) w().history.replaceState(null, '', '/x?token=secret');
  assert.equal(seen[0]!.path, '/dashboard');
  assert.doesNotMatch(seen[0]!.path, /token/);
  stop();
});

test('a throwing reporter cannot break the page', () => {
  const stop = installHistoryStormProbe(() => { throw new Error('reporter exploded'); });
  for (let i = 0; i < STORM_THRESHOLD + 1; i++) {
    assert.doesNotThrow(() => w().history.replaceState(null, '', '/x'));
  }
  assert.equal(realCalls.length, STORM_THRESHOLD + 1, 'the real call must still happen');
  stop();
});

test('uninstalling restores the originals', () => {
  const before = w().history.replaceState;
  const stop = installHistoryStormProbe(() => {});
  assert.notEqual(w().history.replaceState, before);
  stop();
  w().history.replaceState(null, '', '/z');
  assert.deepEqual(realCalls, ['replace:/z']);
});

test('with no window it is inert rather than throwing', () => {
  delete g.window;
  assert.doesNotThrow(() => installHistoryStormProbe(() => {})());
});
