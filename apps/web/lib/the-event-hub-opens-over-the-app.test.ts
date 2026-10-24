/**
 * the-event-hub-opens-over-the-app.test.ts — `openEventHub` (lib/open-external.ts).
 *
 * Owner, 24 Oct 2026: in the iOS / Android app, "View Event Hub" opens the
 * couple's public page in an IN-APP browser sheet over the app (Done → back to
 * Home); it never navigates the app's web view away and never throws the
 * person out to Safari. On the web it opens a new tab.
 *
 * Each arm fails differently and silently:
 *   1. APP + PLUGIN → Browser.open, with an ABSOLUTE url (SFSafariViewController
 *      refuses a path), and the web view does not move.
 *   2. WEB → window.open(_blank, noopener), never Browser, never the same view.
 *   3. OLDER APP BUILD (no plugin) → the same web view. Not a dead button.
 *   4. A refused sheet still reaches the page (same view).
 *   5. THE NATIVE HALF IS REALLY THERE — the plugin in apps/mobile's
 *      package.json, the iOS Swift package and the Android gradle. The web half
 *      alone would pass 1–4 and do nothing on a phone.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openEventHub, type OpenEventHubWindow } from './open-external';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE = join(WEB, '..', 'mobile');
const read = (rel: string) => readFileSync(join(MOBILE, rel), 'utf8');

type Calls = { browser: string[]; open: [string, string, string][]; assign: string[] };

function fakeWindow(opts: {
  native: boolean;
  plugin?: 'present' | 'absent' | 'rejects' | 'throws';
  /** An old shell whose bridge lacks `isPluginAvailable`. */
  noAvailabilityCheck?: boolean;
}): { win: OpenEventHubWindow; calls: Calls } {
  const calls: Calls = { browser: [], open: [], assign: [] };
  const plugins: Record<string, unknown> = {};
  if (opts.plugin && opts.plugin !== 'absent') {
    plugins.Browser = {
      open: ({ url }: { url: string }) => {
        calls.browser.push(url);
        if (opts.plugin === 'throws') throw new Error('bridge gone');
        if (opts.plugin === 'rejects') return Promise.reject(new Error('cannot present'));
        return Promise.resolve();
      },
    };
  }
  const win: OpenEventHubWindow = {
    location: {
      href: 'https://www.setnayan.com/dashboard/S89E-ABC/launch',
      assign: (u) => calls.assign.push(u),
    },
    open: (u, t, f) => {
      calls.open.push([u, t, f]);
      return null;
    },
  };
  if (opts.native) {
    win.Capacitor = {
      isNativePlatform: () => true,
      ...(opts.noAvailabilityCheck
        ? {}
        : { isPluginAvailable: (n: string) => Object.prototype.hasOwnProperty.call(plugins, n) }),
      Plugins: plugins as NonNullable<OpenEventHubWindow['Capacitor']>['Plugins'],
    };
  }
  return { win, calls };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

test('1 · in the app with the plugin: Browser.open with an absolute url; the web view stays put', async () => {
  const { win, calls } = fakeWindow({ native: true, plugin: 'present' });
  assert.equal(openEventHub('/maria-and-jose', win), 'in-app-browser');
  await tick();
  assert.deepEqual(calls.browser, ['https://www.setnayan.com/maria-and-jose']);
  assert.deepEqual(calls.assign, [], 'the app web view must not navigate away');
  assert.deepEqual(calls.open, [], 'never window.open in the app (that is Safari)');

  const old = fakeWindow({ native: true, plugin: 'present', noAvailabilityCheck: true });
  assert.equal(openEventHub('https://www.setnayan.com/x', old.win), 'in-app-browser');
  assert.deepEqual(old.calls.browser, ['https://www.setnayan.com/x']);
});

test('2 · on the web: a new tab, noopener — never the plugin, never the same view', () => {
  const { win, calls } = fakeWindow({ native: false });
  assert.equal(openEventHub('/maria-and-jose', win), 'new-tab');
  assert.deepEqual(calls.open, [['https://www.setnayan.com/maria-and-jose', '_blank', 'noopener']]);
  assert.deepEqual(calls.assign, []);
  assert.deepEqual(calls.browser, []);

  // A page that is not the native shell but happens to carry a Browser stub
  // (e.g. a stray Capacitor web build) still opens a tab.
  const stray = fakeWindow({ native: false, plugin: 'present' });
  assert.equal(openEventHub('/x', stray.win), 'new-tab');
  assert.deepEqual(stray.calls.browser, []);
});

test('3 · an app build without the plugin falls back to the same web view', () => {
  const { win, calls } = fakeWindow({ native: true, plugin: 'absent' });
  assert.equal(openEventHub('/maria-and-jose', win), 'same-view');
  assert.deepEqual(calls.assign, ['https://www.setnayan.com/maria-and-jose']);
  assert.deepEqual(calls.open, []);
  assert.deepEqual(calls.browser, []);
});

test('4 · a sheet that cannot present still reaches the page, in the same view', async () => {
  const rejects = fakeWindow({ native: true, plugin: 'rejects' });
  openEventHub('/maria-and-jose', rejects.win);
  await tick();
  assert.deepEqual(rejects.calls.assign, ['https://www.setnayan.com/maria-and-jose']);

  const throws = fakeWindow({ native: true, plugin: 'throws' });
  assert.equal(openEventHub('/maria-and-jose', throws.win), 'same-view');
  assert.deepEqual(throws.calls.assign, ['https://www.setnayan.com/maria-and-jose']);
});

test('5 · the native half ships: @capacitor/browser in the app, the iOS package and the Android gradle', () => {
  const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
  const browser = pkg.dependencies['@capacitor/browser'];
  const core = pkg.dependencies['@capacitor/core'];
  assert.ok(browser, '@capacitor/browser must be a dependency of apps/mobile');
  assert.equal(browser.match(/\d+/)?.[0], core.match(/\d+/)?.[0], 'same Capacitor major as @capacitor/core');

  const spm = read('ios/App/CapApp-SPM/Package.swift');
  assert.match(spm, /\.package\(name: "CapacitorBrowser", path: "[^"]*@capacitor\/browser"\)/);
  assert.match(spm, /\.product\(name: "CapacitorBrowser", package: "CapacitorBrowser"\)/);

  assert.match(read('android/capacitor.settings.gradle'), /include ':capacitor-browser'/);
  assert.match(read('android/app/capacitor.build.gradle'), /implementation project\(':capacitor-browser'\)/);
});
