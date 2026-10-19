/**
 * The iPhone/Android app never asks for the device's location; the web does.
 *
 * Owner, DECISION_LOG 2026-10-19 "FIVE CONTROLLER RECOMMENDATIONS APPROVED"
 * (1): the app declares no location (no NSLocation* key — held by
 * `the-app-declares-what-it-collects.test.ts`, and "no location" on App Store
 * Connect), and inside the app every screen that would ask skips the ask.
 *
 * THREE PROPERTIES, each of which has a different way to rot:
 *   1. ONE DOOR. No source file but `lib/location-ask.ts` touches the
 *      geolocation API — found by a grep over the whole tree, so a fifth call
 *      site written next month is caught without anyone listing it here.
 *   2. THE DOOR IS SHUT IN THE APP. With the store-shell user agent or cookie,
 *      the wrapper never calls the API (a spy proves it); on the web and on the
 *      desktop .dmg (`SetnayanApp/desktop`) it does.
 *   3. NO DEAD BUTTON. Every control whose press asks carries
 *      `data-asks-location`, which globals.css hides under the pre-paint
 *      `html[data-store-shell]` mark — a "Near me" that does nothing in the app
 *      is worse than none.
 *
 * SABOTAGE (2026-10-19, run once each): an inline `navigator.geolocation` call
 * in `location-step.tsx` → RED (1); `mayAskForLocation` returning true in the
 * store shell → RED (2); `data-asks-location` removed from `city-pin.tsx` → RED (3).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';
import { askLocationOnce, mayAskForLocation, watchLocation } from './location-ask';

const WEB = join(__dirname, '..');
const ROOTS = ['app', 'lib', 'components'];
const THE_DOOR = 'lib/location-ask.ts';

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(relative(WEB, p));
    }
  };
  for (const r of ROOTS) walk(join(WEB, r));
  return out;
}

const FILES = sourceFiles();
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const GEO_API = /navigator\s*\.\s*geolocation|@capacitor\/geolocation|\bgetCurrentPosition\s*\(|\bwatchPosition\s*\(/;

test('1 · only lib/location-ask.ts touches the geolocation API', () => {
  assert.ok(FILES.length > 1000, `precondition: the walk found the tree (${FILES.length} files)`);
  const offenders = FILES.filter((f) => f !== THE_DOOR && GEO_API.test(code(f)));
  assert.deepEqual(
    offenders,
    [],
    'These files ask for location without the store-shell gate. Call askLocationOnce / watchLocation\n' +
      'from @/lib/location-ask instead (DECISION_LOG 2026-10-19 (1): the app declares no location).',
  );
  assert.match(code(THE_DOOR), /navigator\.geolocation\.getCurrentPosition/);
});

const callers = FILES.filter((f) => /from '@\/lib\/location-ask'/.test(code(f)));

test('the call sites are enumerated by grep, not by a list', () => {
  // The four found on 2026-10-19: onboarding "Near me", the Maker's city pick,
  // the open-shop "Use my location", Papic's geo-stamp. More is fine; fewer
  // means one was rewritten around the door, and test 1 says where.
  assert.ok(callers.length >= 4, `expected ≥ 4 callers of the location door, found ${callers.length}: ${callers.join(', ')}`);
});

test('3 · every control that asks on a press is hidden in the app before first paint', () => {
  // The element whose onClick runs a function that calls askLocationOnce must
  // carry `data-asks-location` — globals.css hides it under html[data-store-shell],
  // which the <head> mark sets before the first paint (no one-frame flash).
  const ts = require('typescript') as typeof import('typescript');
  const pressed = callers.filter((f) => /\baskLocationOnce\s*\(/.test(code(f)));
  assert.ok(pressed.length >= 3, `precondition: the press-to-ask callers were found (${pressed.length})`);
  let controls = 0;
  for (const f of pressed) {
    const text = readFileSync(join(WEB, f), 'utf8');
    const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    // Names of the handlers that ask: `const nearMe = () => { … askLocationOnce(… }`.
    const askers = new Set<string>();
    const findAskers = (n: import('typescript').Node) => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && /\baskLocationOnce\s*\(/.test(n.initializer.getText(sf))) {
        askers.add(n.name.text);
      }
      ts.forEachChild(n, findAskers);
    };
    findAskers(sf);
    assert.ok(askers.size > 0, `${f}: askLocationOnce is called outside a named handler — name it so this guard can find its button`);
    let found = 0;
    const visit = (n: import('typescript').Node) => {
      const attrs = ts.isJsxSelfClosingElement(n) ? n.attributes : ts.isJsxOpeningElement(n) ? n.attributes : null;
      if (attrs) {
        const onClick = attrs.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === 'onClick');
        const handler = onClick && ts.isJsxAttribute(onClick) ? onClick.initializer?.getText(sf) ?? '' : '';
        if ([...askers].some((name) => new RegExp(`\\b${name}\\b`).test(handler))) {
          found++;
          const marked = attrs.properties.some((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === 'data-asks-location');
          const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
          assert.ok(marked, `${f}:${line + 1} asks for location on a press but carries no data-asks-location, so the app shows a button that does nothing`);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
    assert.ok(found > 0, `${f}: no control presses ${[...askers].join('/')} — the handler is wired some other way; check the app hides it`);
    controls += found;
  }
  assert.ok(controls >= 3, `expected ≥ 3 location controls, found ${controls}`);
  const css = code('app/globals.css');
  assert.match(css, /html\[data-store-shell\] \[data-asks-location\] \{\s*display: none !important;\s*\}/, 'the one CSS rule that hides them is gone');
});

// ── 2 · the door, opened with each shell's real signals ────────────────────
const IOS_APP_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SetnayanApp';
const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15 SetnayanApp/desktop';
const SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';

function withBrowser(ua: string, cookie: string, run: (calls: string[]) => void) {
  const calls: string[] = [];
  const geolocation = {
    getCurrentPosition: (ok: (p: unknown) => void) => {
      calls.push('getCurrentPosition');
      ok({ coords: { latitude: 14.6, longitude: 121.0, accuracy: 20 } });
    },
    watchPosition: () => {
      calls.push('watchPosition');
      return 7;
    },
    clearWatch: () => calls.push('clearWatch'),
  };
  const g = globalThis as Record<string, unknown>;
  const before = {
    navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
    document: Object.getOwnPropertyDescriptor(globalThis, 'document'),
  };
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: ua, geolocation }, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'document', { value: { cookie }, configurable: true, writable: true });
  try {
    run(calls);
  } finally {
    for (const k of ['navigator', 'document'] as const) {
      const d = before[k];
      if (d) Object.defineProperty(globalThis, k, d);
      else delete g[k];
    }
  }
}

test('2 · inside the store shell the ask never runs — by user agent or by cookie', () => {
  for (const [label, ua, cookie] of [
    ['the iOS app user agent', IOS_APP_UA, ''],
    ['the capacitor cookie', SAFARI_UA, 'theme=light; setnayan-client-type=capacitor'],
  ] as const) {
    withBrowser(ua, cookie, (calls) => {
      assert.equal(mayAskForLocation(), false, label);
      let fixed = false;
      let refused = false;
      askLocationOnce(() => (fixed = true), () => (refused = true));
      const stop = watchLocation(() => (fixed = true));
      stop();
      assert.deepEqual(calls, [], `${label}: the geolocation API was called inside the app`);
      assert.equal(fixed, false, label);
      assert.equal(refused, true, `${label}: the caller's fallback must still run`);
    });
  }
});

test('2 · the web and the desktop .dmg still ask', () => {
  for (const [label, ua, cookie] of [
    ['mobile Safari', SAFARI_UA, ''],
    ['the desktop app', DESKTOP_UA, 'setnayan-client-type=tauri'],
  ] as const) {
    withBrowser(ua, cookie, (calls) => {
      assert.equal(mayAskForLocation(), true, label);
      let fix: unknown = null;
      askLocationOnce((f) => (fix = f), () => {});
      watchLocation(() => {})();
      assert.deepEqual(calls, ['getCurrentPosition', 'watchPosition', 'clearWatch'], label);
      assert.deepEqual(fix, { lat: 14.6, lon: 121.0, accuracyM: 20 }, label);
    });
  }
});
