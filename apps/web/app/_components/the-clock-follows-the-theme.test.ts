/**
 * 🌗 THE PHONE'S CLOCK FOLLOWS THE SCREEN'S THEME (dark B1, 2026-10-23 · dark_mode_rollout_2026-10-22 §4).
 *
 * The native app's host paints the strip behind the status bar in the page's own colour
 * (`SideSafeAreaHost.swift` follows the web view's underPageBackgroundColor). The status-bar WORDS were
 * never told: the style stayed the OS default, which follows the PHONE — so a phone in dark mode drew a
 * white clock over the Light page, and once dark ships a Light-mode phone would draw a black clock over
 * the dark page. `clockFollowsTheme` ties the style to the one thing that decides the theme, `html.dark`.
 *
 * Driven with a fake root and a fake MutationObserver — the real function, no source reading.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clockFollowsTheme } from './native-bridge';

function fakePage(startDark: boolean) {
  const classes = new Set<string>(startDark ? ['dark'] : []);
  let fire: (() => void) | null = null;
  let watching: { attributeFilter?: string[] } | null = null;
  let disconnected = false;
  class FakeObserver {
    constructor(cb: () => void) {
      fire = cb;
    }
    observe(_node: unknown, opts: { attributeFilter?: string[] }) {
      watching = opts;
    }
    disconnect() {
      disconnected = true;
    }
  }
  const root = { classList: { contains: (c: string) => classes.has(c) } };
  const setClass = (dark: boolean) => {
    if (dark) classes.add('dark');
    else classes.delete('dark');
    fire?.();
  };
  return {
    root,
    setClass,
    Observer: FakeObserver as unknown as typeof MutationObserver,
    watching: () => watching,
    disconnected: () => disconnected,
  };
}

test('light page → dark text (LIGHT); dark page → light text (DARK), from the first paint', () => {
  for (const [startDark, want] of [[false, 'LIGHT'], [true, 'DARK']] as const) {
    const page = fakePage(startDark);
    const calls: string[] = [];
    clockFollowsTheme(page.root, (s) => calls.push(s), page.Observer);
    assert.deepEqual(calls, [want], `a ${startDark ? 'dark' : 'light'} page must set ${want} at once`);
  }
});

test('the clock follows every flip of html.dark, asks only on a flip, and watches only the class', () => {
  const page = fakePage(false);
  const calls: string[] = [];
  const stop = clockFollowsTheme(page.root, (s) => calls.push(s), page.Observer);
  assert.deepEqual(page.watching()?.attributeFilter, ['class'], 'it must watch the class attribute of <html>');
  page.setClass(true);
  page.setClass(true); // another class change, same theme — no second bridge call
  page.setClass(false);
  assert.deepEqual(calls, ['LIGHT', 'DARK', 'LIGHT']);
  stop();
  assert.equal(page.disconnected(), true, 'the stop must disconnect the watcher');
});
