/** `whenPageSettles` runs its check exactly once, after `load` and an idle moment — and never after cancel. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { whenPageSettles } from './when-page-settles';

type Listener = () => void;
function fakePage(readyState: 'loading' | 'complete') {
  const listeners: Listener[] = [];
  const idle: Array<{ cb: Listener; timeout: number }> = [];
  const g = globalThis as unknown as Record<string, unknown>;
  g.document = { readyState };
  g.window = {
    addEventListener: (type: string, cb: Listener) => type === 'load' && listeners.push(cb),
    removeEventListener: (type: string, cb: Listener) => {
      const i = listeners.indexOf(cb);
      if (type === 'load' && i >= 0) listeners.splice(i, 1);
    },
    requestIdleCallback: (cb: Listener, o: { timeout: number }) => idle.push({ cb, timeout: o.timeout }) - 1,
    cancelIdleCallback: (id: number) => {
      idle[id] = { cb: () => {}, timeout: 0 };
    },
  };
  return {
    load: () => listeners.splice(0).forEach((cb) => cb()),
    idle: () => idle.splice(0).forEach((x) => x.cb()),
    idleTimeouts: () => idle.map((x) => x.timeout),
    restore: () => {
      delete g.window;
      delete g.document;
    },
  };
}

test('a loading page: nothing runs until load, then an idle moment — once', () => {
  const page = fakePage('loading');
  let runs = 0;
  whenPageSettles(() => runs++);
  page.idle();
  assert.equal(runs, 0, 'ran before the page loaded');
  page.load();
  assert.equal(runs, 0, 'ran at load, before the idle moment');
  assert.deepEqual(page.idleTimeouts(), [3000], 'the idle wait must have a ceiling');
  page.idle();
  assert.equal(runs, 1);
  page.load();
  page.idle();
  assert.equal(runs, 1, 'ran twice');
  page.restore();
});

test('an already-loaded page waits only for the idle moment', () => {
  const page = fakePage('complete');
  let runs = 0;
  whenPageSettles(() => runs++);
  page.idle();
  assert.equal(runs, 1);
  page.restore();
});

test('cancelled before it settles: it never runs', () => {
  const page = fakePage('loading');
  let runs = 0;
  const cancel = whenPageSettles(() => runs++);
  cancel();
  page.load();
  page.idle();
  assert.equal(runs, 0);
  page.restore();
});

test('on the server it does nothing', () => {
  let runs = 0;
  whenPageSettles(() => runs++)();
  assert.equal(runs, 0);
});
