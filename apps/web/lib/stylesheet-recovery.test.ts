/**
 * The stylesheet-recovery script is EXECUTED here, not grepped: it is run in a
 * fake window/document so each branch is proven by what it does (reload, stay
 * put, or show the bar). See lib/stylesheet-recovery.ts for why it exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import {
  APP_STYLESHEET_PATH,
  STYLESHEET_FAILURE_KEY,
  STYLESHEET_RELOAD_KEY,
  stylesheetRecoveryScript,
} from './stylesheet-recovery';

type Sheet = { cssRules: unknown[] } | null;
type FakeLink = { tagName: 'LINK'; rel: string; href: string; sheet: Sheet };

function link(href: string, sheet: Sheet): FakeLink {
  return { tagName: 'LINK', rel: 'stylesheet', href, sheet };
}
const OK = { cssRules: [{}] };
const APP_CSS = `https://www.setnayan.com${APP_STYLESHEET_PATH}f616be75862301ea.css?dpl=dpl_x`;

function run(opts: { links: FakeLink[]; storage?: Record<string, string>; storageThrows?: boolean }) {
  const store = new Map(Object.entries(opts.storage ?? {}));
  const listeners: Record<string, (e: { target: unknown }) => void> = {};
  const docListeners: Record<string, (e: { target: unknown }) => void> = {};
  const appended: Array<{ id: string }> = [];
  let reloads = 0;
  const makeEl = () => {
    const el: { id: string; setAttribute: (k: string, v: string) => void; appendChild: () => void; [k: string]: unknown } = {
      id: '',
      setAttribute(k, v) {
        if (k === 'id') el.id = v;
      },
      appendChild() {},
    };
    return el;
  };
  const storage = {
    getItem: (k: string) => {
      if (opts.storageThrows) throw new Error('SecurityError');
      return store.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (opts.storageThrows) throw new Error('SecurityError');
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };
  const document = {
    addEventListener: (t: string, fn: (e: { target: unknown }) => void) => {
      docListeners[t] = fn;
    },
    querySelectorAll: () => opts.links,
    getElementById: (id: string) => appended.find((a) => a.id === id) ?? null,
    createElement: makeEl,
    createTextNode: () => ({}),
    body: { appendChild: (el: { id: string }) => appended.push(el) },
    documentElement: { appendChild: (el: { id: string }) => appended.push(el) },
  };
  const window = {
    get sessionStorage() {
      if (opts.storageThrows) throw new Error('SecurityError');
      return storage;
    },
    addEventListener: (t: string, fn: (e: { target: unknown }) => void) => {
      listeners[t] = fn;
    },
  };
  const ctx = {
    window,
    document,
    navigator: { serviceWorker: { controller: {} } },
    location: { reload: () => reloads++, pathname: '/vendor-dashboard' },
    JSON,
    Date,
  };
  vm.runInNewContext(stylesheetRecoveryScript, ctx);
  return {
    load: () => listeners.load?.({ target: window }),
    error: (target: unknown) => docListeners.error?.({ target }),
    reloads: () => reloads,
    store,
    bar: () => appended.some((a) => a.id === 'sn-css-failed'),
  };
}

test('a page whose own stylesheet never arrived reloads exactly once, and records what failed', () => {
  const r = run({ links: [link(APP_CSS, OK), link(APP_CSS.replace('f616', 'dead'), null)] });
  r.load();
  assert.equal(r.reloads(), 1);
  assert.equal(r.store.get(STYLESHEET_RELOAD_KEY), '1');
  const failure = JSON.parse(r.store.get(STYLESHEET_FAILURE_KEY) ?? '{}');
  assert.match(failure.href, /dead/);
  assert.equal(failure.sw, true, 'records that a service worker controlled the page');
  assert.equal(r.bar(), false);
});

test('an EMPTY sheet counts as failed: an error page served where CSS was expected has no rules', () => {
  const r = run({ links: [link(APP_CSS, { cssRules: [] })] });
  r.load();
  assert.equal(r.reloads(), 1);
});

test('a 404 sheet in Chromium HAS a sheet object whose cssRules THROWS — that is a failure, not health', () => {
  const throwing = {
    get cssRules(): unknown[] {
      throw new Error("SecurityError: Failed to read the 'cssRules' property: Cannot access rules");
    },
  };
  const r = run({ links: [link(APP_CSS, throwing)] });
  r.load();
  assert.equal(r.reloads(), 1);
});

test('the second failure in a row does NOT reload again — it says so on screen instead', () => {
  const r = run({ links: [link(APP_CSS, null)], storage: { [STYLESHEET_RELOAD_KEY]: '1' } });
  r.load();
  assert.equal(r.reloads(), 0, 'a reload loop on an unreadable page is worse than the bug');
  assert.equal(r.bar(), true);
});

test('a good load clears the marker, so a failure after a LATER deploy gets its own reload', () => {
  const r = run({ links: [link(APP_CSS, OK)], storage: { [STYLESHEET_RELOAD_KEY]: '1' } });
  r.load();
  assert.equal(r.reloads(), 0);
  assert.equal(r.store.has(STYLESHEET_RELOAD_KEY), false);
});

test('a stylesheet that is not our build (a third party) never triggers a reload', () => {
  const r = run({ links: [link('https://cdn.example.com/widget.css', null), link(APP_CSS, OK)] });
  r.load();
  assert.equal(r.reloads(), 0);
});

test('a sheet a client-side navigation adds later is caught by its error event', () => {
  const r = run({ links: [] });
  r.error(link(APP_CSS, null));
  assert.equal(r.reloads(), 1);
  r.error(link(APP_CSS, null));
  assert.equal(r.reloads(), 1, 'one failure event handled once per page');
  r.error({ tagName: 'IMG', rel: '', href: APP_CSS, sheet: null });
  assert.equal(r.reloads(), 1);
});

test('with storage disabled it cannot prove "once", so it never reloads — it shows the bar', () => {
  const r = run({ links: [link(APP_CSS, null)], storageThrows: true });
  r.load();
  assert.equal(r.reloads(), 0);
  assert.equal(r.bar(), true);
});

test('the root layout mounts the script exactly once, inside <head>', () => {
  const src = readFileSync(join(process.cwd(), 'app/layout.tsx'), 'utf8');
  const mount = '__html: stylesheetRecoveryScript';
  const count = src.split(mount).length - 1;
  assert.equal(count, 1, `expected 1 mount, found ${count}`);
  const at = src.indexOf(mount);
  const headOpen = src.indexOf('<head>');
  const headClose = src.indexOf('</head>');
  assert.ok(headOpen !== -1 && headOpen < at && at < headClose, 'the mount must sit between <head> and </head>');
});
