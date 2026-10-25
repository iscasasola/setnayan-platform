/**
 * apple-device.test.ts — AN iPAD IS AN APPLE DEVICE (iPad + Duo audit B1, 2026-10-19:
 * W1 · W6 · W8).
 *
 * The user-agents below are not guesses: the two iPad ones were read off the
 * iPad Pro 11-inch simulator (iPadOS 26.5) on 2026-10-19 — Safari, and the
 * Setnayan app's own WKWebView (the shipped build, pointed at a local probe page).
 *
 *   1. `deviceOs` reads every one the way the person holding it would.
 *   2. The iPad app — whose user-agent says Macintosh — is offered Sign in with
 *      Apple wherever Google would be (App Store 4.8), on the server.
 *   3. iPad Safari, which no server can tell from a Mac, gets an Apple block the
 *      browser swaps in (`AppleOnTouch`).
 *   4. NFC writing and reading are offered only where the plugin says the radio
 *      is here (W6) — every iPad's plugin says it is not.
 *   5. 🔒 ONE HELPER: no other source file reads a device name off a user-agent.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { deviceOs, isAppleTouchDevice, mightBeIpadSafari } from '@/lib/apple-device';
import { isStoreShellSignals } from '@/lib/store-shell';
import { saveMethodFor } from '@/lib/guest-one-path';
import { homeScreenStepsFor } from '@/lib/home-screen-shortcut';
import { uaFamily } from '@/lib/guest-pass-hop';
import { nfcDeviceKind } from '@/lib/nfc-tag';
import { unblockSteps } from '@/lib/push-unblock-steps';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = process.cwd();
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

// Measured, iPad Pro 11-inch (M5) simulator, iPadOS 26.5, 2026-10-19.
const IPAD_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15';
const IPAD_APP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SetnayanApp SetnayanSignIn/1 SetnayanIAP/1';
const IPAD_TOUCH = 5;
// Published / long-standing strings.
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const IPHONE_APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SetnayanApp SetnayanSignIn/1 SetnayanIAP/1';
const IPAD_MOBILE_MODE = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';
const MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const MAC_DESKTOP_APP = `${MAC_SAFARI} SetnayanApp/desktop`;
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36';
const ANDROID_APP = `${ANDROID} SetnayanApp SetnayanSignIn/1`;
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const BOTH = { apple: true, google: true };

test('1 · every device reads as what it is — the iPad by its touch points or its app marker, never by name', () => {
  const table: [string, string, number | undefined, string][] = [
    ['iPad Safari, in the browser', IPAD_SAFARI, IPAD_TOUCH, 'ipad'],
    ['iPad Safari, on the server', IPAD_SAFARI, undefined, 'mac'],
    ['the iPad app, on the server', IPAD_APP, undefined, 'ipad'],
    ['the iPad app, in the browser', IPAD_APP, IPAD_TOUCH, 'ipad'],
    ['an iPad in mobile mode', IPAD_MOBILE_MODE, undefined, 'ipad'],
    ['iPhone Safari ("like Mac OS X")', IPHONE, undefined, 'iphone'],
    ['the iPhone app', IPHONE_APP, undefined, 'iphone'],
    ['Mac Safari', MAC_SAFARI, 0, 'mac'],
    ['Mac Chrome', MAC_CHROME, 0, 'mac'],
    ['the Mac desktop app', MAC_DESKTOP_APP, 0, 'mac'],
    ['Android Chrome', ANDROID, 5, 'android'],
    ['the Android app', ANDROID_APP, 5, 'android'],
    ['Windows', WINDOWS, 0, 'windows'],
  ];
  for (const [who, ua, touch, want] of table) assert.equal(deviceOs(ua, touch), want, who);
  assert.equal(isAppleTouchDevice(IPAD_SAFARI, IPAD_TOUCH), true);
  assert.equal(isAppleTouchDevice(MAC_SAFARI, 0), false);
  assert.equal(mightBeIpadSafari(IPAD_SAFARI), true, 'a server cannot rule iPad Safari out');
  assert.equal(mightBeIpadSafari(IPAD_APP), false, 'the iPad app is already known to the server');
});

test('1 · the server-side iPad rule IS the store-shell rule (spelled once each, held to one answer)', () => {
  for (const ua of [IPAD_APP, IPAD_SAFARI, MAC_SAFARI, MAC_CHROME, MAC_DESKTOP_APP]) {
    assert.equal(deviceOs(ua) === 'ipad', isStoreShellSignals(ua, null), ua);
  }
});

test('2 · 🍎 the iPad APP is offered Sign in with Apple wherever Google would be (guideline 4.8)', async () => {
  assert.equal(saveMethodFor(IPAD_APP, BOTH), 'apple', 'the iPad app is offered Google first');
  assert.equal(saveMethodFor(IPHONE_APP, BOTH), 'apple');
  assert.equal(saveMethodFor(ANDROID_APP, BOTH), 'google');
  assert.equal(saveMethodFor(MAC_SAFARI, BOTH), 'google', 'a Mac is unchanged');
  // …and the rendered FIRST button says it and carries it (2026-10-25 "Show both": Google draws under it).
  const html = await renderSave(IPAD_APP);
  assert.match(html, /Continue with Apple/, 'the iPad app’s button does not say Apple');
  assert.deepEqual(pressOrder(html), ['apple', 'google'], 'the iPad app’s first press does not carry Apple');
  // The other pieces read the same device.
  assert.equal(homeScreenStepsFor(IPAD_APP).length, 1);
  assert.match(homeScreenStepsFor(IPAD_APP)[0]!.phone, /iPad/);
  assert.equal(uaFamily(IPAD_APP), 'ios/setnayan-app', 'the iPad app is counted as a desktop');
});

test('3 · 🍎 iPad Safari: the server draws the Apple block beside the Mac one, and the browser picks it', async () => {
  const { SaveToAccount } = await import('@/app/[slug]/_components/save-to-account');
  const { AppleOnTouch } = await import('@/app/[slug]/_components/apple-on-touch');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const el = withProviders(() => (SaveToAccount as (p: unknown) => React.ReactElement)(saveProps(IPAD_SAFARI)));
  assert.equal(el.type, AppleOnTouch, 'iPad Safari is handed the Mac’s Google button with no way to Apple');
  const { web, apple } = el.props as { web: React.ReactNode; apple: React.ReactNode };
  const appleHtml = renderToStaticMarkup(React.createElement(React.Fragment, null, apple));
  assert.match(appleHtml, /Continue with Apple/);
  // 🍏🤖 2026-10-25 ("Show both"): both blocks hold both buttons — the swap decides only the ORDER.
  assert.deepEqual(pressOrder(appleHtml), ['apple', 'google'], 'the swapped-in block does not put Apple first');
  assert.deepEqual(pressOrder(renderToStaticMarkup(React.createElement(React.Fragment, null, web))), ['google', 'apple']);
  // Every other browser-side reading takes the touch points too.
  assert.equal(unblockSteps({ userAgent: IPAD_SAFARI, maxTouchPoints: IPAD_TOUCH }).platform, 'iPhone or iPad', 'iPad Safari is told "Safari on Mac"');
  assert.equal(unblockSteps({ userAgent: MAC_SAFARI, maxTouchPoints: 0 }).platform, 'Safari on Mac');
  // The browser's question is the helper's, with the touch points.
  const src = read('app/[slug]/_components/apple-on-touch.tsx');
  assert.match(src, /isAppleTouchDevice\(navigator\.userAgent, navigator\.maxTouchPoints\)/);
  // An iPhone or Android page is not doubled.
  for (const ua of [IPHONE, ANDROID, IPAD_APP]) {
    const plain = withProviders(() => (SaveToAccount as (p: unknown) => React.ReactElement)(saveProps(ua)));
    assert.notEqual(plain.type, AppleOnTouch, ua);
  }
});

test('4 · 🍎 no NFC radio, no "Write to NFC" — the plugin is asked about the hardware (W6)', async () => {
  const { nativeNfcWithHardware } = await import('@/app/_components/nfc-runtime');
  const plugin = (over: Record<string, unknown>) => ({
    startScanning: async () => {}, stopScanning: async () => {}, write: async () => {}, addListener: () => ({ remove() {} }),
    getStatus: async () => ({ status: 'NFC_OK' }),
    ...over,
  });
  const g = globalThis as unknown as { window?: unknown };
  const had = 'window' in g;
  const prev = g.window;
  const withPlugin = async (nfc: unknown) => {
    g.window = { Capacitor: { isNativePlatform: () => true, isPluginAvailable: () => true, Plugins: { CapacitorNfc: nfc } } };
    try {
      return await nativeNfcWithHardware();
    } finally {
      if (had) g.window = prev;
      else delete g.window;
    }
  };
  // Measured on the iPad simulator: isSupported → false, getStatus → NO_NFC.
  assert.equal(await withPlugin(plugin({ isSupported: async () => ({ supported: false }) })), null, 'an iPad is offered a write');
  const phone = plugin({ isSupported: async () => ({ supported: true }) });
  assert.equal(await withPlugin(phone), phone, 'an iPhone lost its writer');
  assert.equal(await withPlugin(plugin({ getStatus: async () => ({ status: 'NO_NFC' }) })), null, 'an older plugin build on an iPad');
  const off = plugin({ getStatus: async () => ({ status: 'NFC_DISABLED' }) });
  assert.equal(await withPlugin(off), off, 'a radio that is merely off is still a radio');
  // The web: iPad Safari is a tablet, which the button hides on.
  assert.equal(nfcDeviceKind({ coarsePointer: true, maxTouchPoints: IPAD_TOUCH, userAgent: IPAD_SAFARI, screenWidth: 834 }), 'tablet');
  assert.equal(nfcDeviceKind({ coarsePointer: true, maxTouchPoints: 5, userAgent: IPHONE, screenWidth: 393 }), 'phone');
  // The button and the desk only take the app's writer through the hardware check.
  const button = read('app/_components/nfc-write-button.tsx');
  assert.match(button, /\(await nativeNfcWithHardware\(\)\)\s*\?\s*'app'\s*:\s*'absent'/, 'the write button trusts the plugin without asking for the radio');
  assert.match(button, /kind === 'tablet'\s*\?\s*'absent'/, 'iPad Safari is still offered a write');
  assert.match(button, /if \(!nfcOn \|\| !eligibility\.eligible \|\| writer === 'absent'\) return null;/, '"absent" still draws the button');
  assert.doesNotMatch(button, /setWriter\('app'\)/, 'a second door to the app writer');
  const desk = read('app/_components/use-nfc-tag-reader.ts');
  assert.match(desk, /nativeNfcWithHardware\(\)\.then\(\(nfc\) => \{\s*if \(live && nfc\) setRuntime\('app'\);/, 'the desk offers a tap with no radio');
  assert.doesNotMatch(desk, /if \(nativeNfc\(\)\) setRuntime\('app'\)/, 'the desk trusts the plugin without asking for the radio');
});

// ── 5 · ONE HELPER ──────────────────────────────────────────────────────────

/**
 * A regex literal that reads a DEVICE NAME off a user-agent: iPhone / iPad /
 * iPod / Macintosh / "Mac OS" / a bare `mac`. Only a literal in code position
 * counts (after `=`, `(`, `,`, `:`, `?`, `!`, `&&`, `||` or `return`), so JSX
 * words like "iPhone &amp; iPad" are not mistaken for one.
 */
const DEVICE_NAME_REGEX =
  /(?:[=(,:?!]|&&|\|\||\breturn)\s*\/((?:\\.|[^/\n\\])*?(?:iPhone|iPad|iPod|Macintosh|Mac OS|\bmac\b)(?:\\.|[^/\n\\])*?)\/[dgimsuy]*/i;

/** Files allowed to spell one — each with its reason. */
const ALLOWED: Record<string, string> = {
  'lib/apple-device.ts': 'THE helper.',
  'app/download/_download-motion.tsx':
    'The Mac-only Apple-silicon nudge on /download (owned by sweep batch B4). An iPad that reaches it reports the WebGL renderer "Apple GPU", which reads as Apple silicon — no nudge, nothing offered.',
};

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !/\.d\.ts$/.test(name)) out.push(p);
  }
  return out;
}

test('5 · 🔒 one helper reads the device off a user-agent — no other file spells a device name in a regex', () => {
  const files = [...sources(join(WEB, 'app')), ...sources(join(WEB, 'lib'))];
  assert.ok(files.length > 500, `scanned only ${files.length} files — the walk is broken`);
  const offenders: string[] = [];
  for (const file of files) {
    const rel = relative(WEB, file);
    if (rel in ALLOWED) continue;
    const src = stripComments(readFileSync(file, 'utf8'));
    const m = DEVICE_NAME_REGEX.exec(src);
    if (m) offenders.push(`${rel}: /${m[1]}/`);
  }
  assert.deepEqual(
    offenders,
    [],
    'Read the device through lib/apple-device.ts (`deviceOs` / `isAppleTouchDevice`) — a bare /iPhone|iPad/ reads an iPad as a Mac:\n  ' +
      offenders.join('\n  '),
  );
  // …and the pattern can hit (it would have caught the four this batch removed).
  for (const old of [
    'const APPLE_DEVICE = /iPhone|iPad|iPod/i;',
    'const mac = /mac/i.test(ua);',
    "if (/iPhone|iPod|Android.*Mobile/i.test(ua)) return 'phone';",
    "return /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;",
  ]) {
    assert.match(old, DEVICE_NAME_REGEX, `the guard is blind to: ${old}`);
  }
  assert.doesNotMatch('<span className="hr-ic">↧</span>App Store · iPhone &amp; iPad · soon', DEVICE_NAME_REGEX);
  assert.ok(read('lib/apple-device.ts').includes('Macintosh'), 'the helper no longer handles the quirk');
});

// ── helpers ──────────────────────────────────────────────────────────────────

function saveProps(userAgent: string) {
  return {
    state: { kind: 'offer' },
    eventId: 'e-1',
    slug: 'ic',
    personalLink: 'https://www.setnayan.com/ic?invite=0123456789abcdef0123456789abcdef',
    userAgent,
    termsCarried: false,
  };
}

function withProviders<T>(fn: () => T): T {
  process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED = 'true';
  process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED = 'true';
  try {
    return fn();
  } finally {
    delete process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED;
    delete process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED;
  }
}

/** The provider each Save press carries, in drawn order (the button's own `name="save_method"` + `value`). */
function pressOrder(html: string): string[] {
  return [...html.matchAll(/<button\b[^>]*>/g)]
    .map(([b]) => b)
    .filter((b) => b.includes('name="save_method"'))
    .map((b) => /\svalue="([a-z]+)"/.exec(b)?.[1] ?? '?');
}

async function renderSave(userAgent: string): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SaveToAccount } = await import('@/app/[slug]/_components/save-to-account');
  return withProviders(() => renderToStaticMarkup(React.createElement(SaveToAccount as never, saveProps(userAgent) as never)));
}
