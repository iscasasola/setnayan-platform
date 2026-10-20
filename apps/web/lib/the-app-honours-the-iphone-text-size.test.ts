/**
 * 🔠 The iPhone/iPad APP honours the person's text size (iOS Dynamic Type) —
 * owner ruling 2026-10-20. See lib/app-text-size.ts for the mechanism.
 *
 * Held here, as PROPERTIES (not phrasings):
 *
 *   1. the arithmetic: a bigger Settings size never shrinks the text, the
 *      default changes nothing, and nothing exceeds the cap;
 *   2. the <head> script, run against a fake document, answers exactly what
 *      `appTextScale` answers for every Dynamic Type body size — so the inline
 *      copy cannot drift from the tested function;
 *   3. it touches NOTHING outside the store shell (Safari, the .dmg) and
 *      nothing where `-apple-system-body` does not exist (the Android shell);
 *   4. wiring: mounted once, in <head>, AFTER the store-shell mark it reads.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  APP_TEXT_SCALE_ATTR,
  APP_TEXT_SCALE_MAX,
  IOS_DEFAULT_BODY_PX,
  appTextScale,
  appTextSizeScript,
} from './app-text-size';

// UIKit body sizes per content-size category, in points (= CSS px in WKWebView).
const DYNAMIC_TYPE_BODY: ReadonlyArray<readonly [string, number]> = [
  ['extra-small', 14],
  ['small', 15],
  ['medium', 16],
  ['large (default)', 17],
  ['extra-large', 19],
  ['extra-extra-large', 21],
  ['extra-extra-extra-large', 23],
  ['accessibility-medium (AX1)', 28],
  ['accessibility-large (AX2)', 33],
  ['accessibility-extra-large (AX3)', 40],
  ['accessibility-extra-extra-large (AX4)', 47],
  ['accessibility-extra-extra-extra-large (AX5)', 53],
];

type Run = { style: Record<string, string>; attrs: Map<string, string>; listeners: string[] };

/** Run the inline script against a fake document. */
function runScript(opts: { storeShell: boolean; appleSystemBody: boolean; bodyPx: number }): Run {
  const style: Record<string, string> = {};
  const attrs = new Map<string, string>();
  if (opts.storeShell) attrs.set('data-store-shell', '1');
  const listeners: string[] = [];
  const documentFake = {
    visibilityState: 'visible',
    documentElement: {
      style,
      hasAttribute: (k: string) => attrs.has(k),
      setAttribute: (k: string, v: string) => attrs.set(k, v),
      appendChild: () => undefined,
      removeChild: () => undefined,
    },
    createElement: () => {
      const s: Record<string, string> = {};
      return {
        style: new Proxy(s, {
          set(target, key: string, value: string) {
            // A browser without the keyword drops the declaration — style.font stays ''.
            if (key === 'font' && (!opts.appleSystemBody || value !== '-apple-system-body')) return true;
            target[key] = value;
            return true;
          },
          get(target, key: string) {
            return target[key] ?? '';
          },
        }),
      };
    },
    addEventListener: (type: string) => listeners.push(type),
  };
  const getComputedStyle = () => ({ fontSize: `${opts.bodyPx}px` });
  new Function('document', 'getComputedStyle', appTextSizeScript)(documentFake, getComputedStyle);
  return { style, attrs, listeners };
}

test('text size — the default changes nothing, bigger never shrinks, nothing passes the cap', () => {
  assert.equal(appTextScale(IOS_DEFAULT_BODY_PX), 1, 'the default iPhone text size is the design size');
  let prev = 0;
  for (const [name, px] of DYNAMIC_TYPE_BODY) {
    const s = appTextScale(px);
    assert.ok(s >= 1, `${name}: never below the design size (the 16px input floor stops iOS focus-zoom)`);
    assert.ok(s <= APP_TEXT_SCALE_MAX, `${name}: never above the cap`);
    assert.ok(s >= prev, `${name}: a larger setting never gives smaller text`);
    prev = s;
  }
  assert.ok(appTextScale(19) > 1, 'XL must actually grow the text — a scale stuck at 1 would pass the bounds');
  assert.equal(appTextScale(Number.NaN), 1);
  assert.equal(appTextScale(0), 1);
});

test('text size — the <head> script applies exactly what appTextScale says, for every Dynamic Type size', () => {
  for (const [name, px] of DYNAMIC_TYPE_BODY) {
    const r = runScript({ storeShell: true, appleSystemBody: true, bodyPx: px });
    const want = appTextScale(px);
    assert.equal(r.attrs.get(APP_TEXT_SCALE_ATTR), String(want), `${name}: attribute`);
    assert.equal(r.style.webkitTextSizeAdjust, `${Math.round(want * 100)}%`, `${name}: -webkit-text-size-adjust`);
    assert.equal(r.style.textSizeAdjust, `${Math.round(want * 100)}%`, `${name}: text-size-adjust`);
    assert.ok(r.listeners.includes('visibilitychange'), `${name}: re-reads when the person comes back from Settings`);
  }
});

test('text size — the web, the desktop app and the Android shell are untouched', () => {
  const web = runScript({ storeShell: false, appleSystemBody: true, bodyPx: 28 });
  assert.equal(web.style.webkitTextSizeAdjust, undefined, 'Safari on an iPhone (no store-shell mark) keeps its own text size');
  assert.equal(web.attrs.has(APP_TEXT_SCALE_ATTR), false);
  const android = runScript({ storeShell: true, appleSystemBody: false, bodyPx: 28 });
  assert.equal(android.style.webkitTextSizeAdjust, undefined, 'no -apple-system-body → nothing to read → nothing changes');
  assert.equal(android.attrs.has(APP_TEXT_SCALE_ATTR), false);
});

test('text size — wiring: mounted once in <head>, after the store-shell mark it reads', () => {
  const layout = readFileSync(join(__dirname, '..', 'app', 'layout.tsx'), 'utf8');
  assert.equal((layout.match(/__html: appTextSizeScript/g) ?? []).length, 1, 'mounted exactly once');
  const at = layout.indexOf('__html: appTextSizeScript');
  assert.ok(at < layout.indexOf('</head>'), 'must run in <head>, before the first paint');
  assert.ok(
    layout.indexOf('__html: storeShellMarkScript') < at,
    'must run AFTER storeShellMarkScript — it reads the data-store-shell mark that script sets',
  );
});

test('text size — the sign-in "or … email" divider keeps both rules and centres a wrapped label', () => {
  // Walked 2026-10-20 (iPhone 17 simulator, 402 px): /signup's long label wrapped, the two flex rules went to 0 px
  // and the words sat flush left. Bigger iPhone text makes every label wrap, so this is a property of the rule,
  // not of one string: the rules carry a positive min-width, and the label centres and balances its lines.
  const { stripComments } = require('./strip-comments') as typeof import('./strip-comments');
  const css = stripComments(readFileSync(join(__dirname, '..', 'app', '_components', 'home', 'home-reskin.css'), 'utf8'));
  const block = (selector: RegExp): string => {
    const m = css.match(new RegExp(`${selector.source}\\s*\\{([^}]*)\\}`));
    assert.ok(m, `rule ${selector.source} must exist`);
    return m![1];
  };
  const rules = block(/\.home-reskin-ov \.hr-si-or::before,\s*\.home-reskin-ov \.hr-si-or::after/);
  const min = rules.match(/min-width:\s*(\d+(?:\.\d+)?)px/);
  assert.ok(min && Number(min[1]) > 0, 'both rules keep a positive min-width, so a wrapping label cannot squeeze them to nothing');
  const label = block(/\.home-reskin-ov \.hr-si-or span/);
  assert.match(label, /text-align:\s*center/, 'a wrapped label stays centred between its rules');
  assert.match(label, /text-wrap:\s*balance/, 'a wrapped label breaks into even lines');
});
