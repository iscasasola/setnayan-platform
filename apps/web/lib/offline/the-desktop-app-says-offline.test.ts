/**
 * GUARD — THE DESKTOP APP SAYS IT IS OFFLINE (controller review #2 item 23).
 *
 * The desktop app (Tauri) opens `src-tauri/shell/index.html`, which sent the window straight to the live site — so with
 * no connection the window showed a blank browser error. The live site cannot be kept for offline use inside the desktop
 * app (the browser and the Home Screen app can), so the page now checks for a connection first: with one it goes on
 * exactly as before; with none it says "You're offline · Open setnayan.com in your browser to work offline", and
 * "Try again" (or the connection coming back) checks again.
 *
 * HOW: the page's own script is run in a `vm` with a stand-in document, network and clock.
 *
 * Sabotages (2026-11-25), each red: the `navigator.onLine === false` line dropped (a phone that says offline still
 * waits on the network) · the failed check's `offline()` dropped · the 6-second timer dropped (a hanging check shows
 * "Loading" forever) · the unconditional `window.location.replace` restored · the Try again listener dropped.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SHELL = process.env.SHELL_FROM || path.join(import.meta.dirname, '..', '..', '..', '..', 'src-tauri', 'shell', 'index.html');
const html = readFileSync(SHELL, 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');

type Net = 'reachable' | 'refused' | 'hangs';

function boot(opts: { onLine: boolean; net: Net }) {
  const classes = new Set<string>();
  const timers: (() => void)[] = [];
  const listeners: Record<string, (() => void)[]> = {};
  const replaced: string[] = [];
  let fetches = 0;
  let net = opts.net;
  const again: { click?: () => void } = {};
  const context = vm.createContext({
    navigator: { onLine: opts.onLine },
    document: {
      body: { classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c) } },
      getElementById: (id: string) => (id === 'again' ? { addEventListener: (_t: string, fn: () => void) => (again.click = fn) } : null),
    },
    window: {
      location: { replace: (u: string) => replaced.push(u) },
      addEventListener: (t: string, fn: () => void) => (listeners[t] ??= []).push(fn),
    },
    setTimeout: (fn: () => void) => {
      timers.push(fn);
      return timers.length;
    },
    clearTimeout: () => undefined,
    fetch: () => {
      fetches += 1;
      if (net === 'reachable') return Promise.resolve({});
      if (net === 'refused') return Promise.reject(new TypeError('Failed to fetch'));
      return new Promise(() => undefined);
    },
  });
  vm.runInContext(script, context);
  const settle = () => new Promise((r) => setImmediate(r));
  return {
    classes,
    replaced,
    fetches: () => fetches,
    settle,
    elapse: () => timers.splice(0).forEach((fn) => fn()),
    setNet: (n: Net) => (net = n),
    setOnLine: (v: boolean) => ((context.navigator as { onLine: boolean }).onLine = v),
    tryAgain: () => again.click?.(),
    online: () => (listeners.online ?? []).forEach((fn) => fn()),
  };
}

test('the words are the ruling’s, and nothing leaves before the check', () => {
  assert.match(html, /You’re offline/);
  assert.match(html, /Open setnayan\.com in your browser to work offline\./);
  assert.match(html, /<button type="button" id="again">Try again<\/button>/);
  assert.doesNotMatch(html.replace(/<noscript>[\s\S]*?<\/noscript>/g, ''), /http-equiv="refresh"/, 'a refresh leaves before the check');
  assert.equal((script.match(/location\.replace\(/g) ?? []).length, 1, 'more than one way out of the check');
});

test('with a connection it goes straight on, as it always did', async () => {
  const p = boot({ onLine: true, net: 'reachable' });
  await p.settle();
  assert.deepEqual(p.replaced, ['https://setnayan.com']);
  assert.equal(p.classes.has('is-offline'), false);
});

test('a computer that says it is offline is told at once, without waiting on the network', async () => {
  const p = boot({ onLine: false, net: 'reachable' });
  await p.settle();
  assert.equal(p.classes.has('is-offline'), true);
  assert.equal(p.fetches(), 0);
  assert.deepEqual(p.replaced, []);
});

test('a refused check says offline; a check that hangs says it after 6 seconds — never "Loading" forever', async () => {
  const refused = boot({ onLine: true, net: 'refused' });
  await refused.settle();
  assert.equal(refused.classes.has('is-offline'), true, 'a refused check left the window on Loading');
  assert.deepEqual(refused.replaced, []);

  const hangs = boot({ onLine: true, net: 'hangs' });
  await hangs.settle();
  assert.equal(hangs.classes.has('is-offline'), false);
  hangs.elapse();
  assert.equal(hangs.classes.has('is-offline'), true, 'a hanging check never said offline');
  assert.deepEqual(hangs.replaced, []);
});

test('Try again — or the connection coming back — checks again and goes on', async () => {
  const p = boot({ onLine: true, net: 'refused' });
  await p.settle();
  assert.equal(p.classes.has('is-offline'), true);
  p.setNet('reachable');
  p.tryAgain();
  await p.settle();
  assert.deepEqual(p.replaced, ['https://setnayan.com'], 'Try again did nothing');

  const q = boot({ onLine: false, net: 'reachable' });
  await q.settle();
  q.setOnLine(true);
  q.online();
  await q.settle();
  assert.deepEqual(q.replaced, ['https://setnayan.com'], 'the connection came back and the window stayed offline');
});
