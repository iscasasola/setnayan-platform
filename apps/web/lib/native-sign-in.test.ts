/**
 * native-sign-in.test.ts — Google + Apple in the PHONE APP (B3, 2026-10-04).
 *
 * DECISION_LOG 2026-09-30 "…GOOGLE + APPLE SIGN-IN COME TO THE PHONE APPS
 * BEFORE THE APPLE CHECK"; Apple guideline 4.8 (Google in the app ⇒ Sign in
 * with Apple beside it).
 *
 * Three things must stay true, and each is a different way to fail silently:
 *   1. WHO SEES THE BUTTONS. The web sees the web row, the desktop app the
 *      loopback row, the phone app the NATIVE row — and only a phone build that
 *      carries the plugin. An older build shown buttons gets a door with
 *      nothing behind it on its first screen.
 *   2. WHERE THE PERSON COMES BACK. The provider returns to setnayan://auth/
 *      callback carrying `next`, and the web view opens /auth/callback with it —
 *      so a guest from an invitation lands on that invitation.
 *   3. 🔒 GOOGLE NEVER OPENS IN THE APP'S WEB VIEW. Google refuses it
 *      ("disallowed_useragent"). The provider URL goes ONLY to the native
 *      plugin's system-browser session.
 *
 * SABOTAGES (each run, each red, each restored — see the PR):
 *   · oauthGate: drop `hasNativeSignIn(ua) &&`              → test 1 RED
 *   · native-oauth.ts: `skipBrowserRedirect: false`          → test 4 RED
 *   · native-oauth.ts: `window.location.assign(data.url)`    → test 4 RED
 *   · nativeRedirectTo: hand-type `?next=` without the rule  → test 3 RED
 *   · sign-in-card.tsx: native arm renders <OAuthButtonRow>  → test 5 RED
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyShell, hasNativeSignIn, oauthGate, NATIVE_SIGN_IN_UA_MARKER } from './oauth-shell-gate';
import {
  NATIVE_AUTH_PLUGIN,
  NATIVE_CALLBACK_SCHEME,
  nativeCallbackPath,
  nativeOAuthPlan,
  nativeRedirectTo,
  nativeSessionLandingPath,
} from './native-oauth-plan';
import { appUrlToPath } from './app-url-path';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE = join(WEB, '..', 'mobile');
const read = (abs: string) => readFileSync(abs, 'utf8');
/** Executed code only — the docblocks name the traps they describe. */
const code = (abs: string) => stripComments(read(abs));

const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const OLD_APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 SetnayanApp';
const NEW_APP = `${OLD_APP} ${NATIVE_SIGN_IN_UA_MARKER}`;
const DESKTOP = 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 SetnayanApp/desktop';
const ON = { any: true, apple: true };

// ── 1 · who sees the buttons ────────────────────────────────────────────────

test('1 · web → web row · desktop → loopback · the phone app → native only in a build with the plugin', () => {
  assert.deepEqual(oauthGate(classifyShell(SAFARI, ''), SAFARI, ON), { show: true, desktop: false, native: false });
  assert.deepEqual(oauthGate(classifyShell(DESKTOP, ''), DESKTOP, ON), { show: true, desktop: true, native: false });
  assert.deepEqual(oauthGate(classifyShell(NEW_APP, ''), NEW_APP, ON), { show: true, desktop: false, native: true });
  // The build already in people's hands has no plugin: email only, never the web row.
  assert.deepEqual(oauthGate(classifyShell(OLD_APP, ''), OLD_APP, ON), { show: false, desktop: false, native: false });
  // The client-type cookie alone (a UA the shell did not stamp) is still the app.
  assert.equal(classifyShell(SAFARI, 'capacitor'), 'mobile');
  assert.equal(classifyShell(SAFARI, '', true), 'mobile', 'a live Capacitor bridge is the app');
});

test('1 · in the app there is no Google without Apple (guideline 4.8), and no buttons with the flags off', () => {
  assert.equal(oauthGate('mobile', NEW_APP, { any: true, apple: false }).show, false);
  assert.deepEqual(oauthGate('web', SAFARI, { any: false, apple: false }), { show: false, desktop: false, native: false });
  assert.equal(oauthGate('mobile', NEW_APP, { any: false, apple: true }).show, false);
});

test('1 · the phone app never gets the web redirect row, whatever the user-agent says', () => {
  for (const ua of [OLD_APP, NEW_APP, '', SAFARI]) {
    const g = oauthGate('mobile', ua, ON);
    assert.ok(!g.show || g.native, `mobile + "${ua}" would render the web row Google refuses`);
  }
});

test('1 · the marker the gate reads is the one the Capacitor shell actually appends', () => {
  const cfg = read(join(MOBILE, 'capacitor.config.ts'));
  const m = cfg.match(/appendUserAgent:\s*'([^']+)'/);
  assert.ok(m, 'capacitor.config.ts must declare appendUserAgent');
  const ua = `Mozilla/5.0 ${m![1]}`;
  assert.equal(hasNativeSignIn(ua), true, 'the shell no longer announces the native sign-in plugin');
  assert.equal(classifyShell(ua, ''), 'mobile', 'the shell no longer reads as the phone app');
});

// ── 2 · which flow each button takes ────────────────────────────────────────

test('2 · Apple on iPhone is the native sheet; Google everywhere and Apple on Android are the system browser', () => {
  assert.equal(nativeOAuthPlan('apple', 'ios'), 'apple-sheet');
  assert.equal(nativeOAuthPlan('google', 'ios'), 'system-browser');
  assert.equal(nativeOAuthPlan('apple', 'android'), 'system-browser');
  assert.equal(nativeOAuthPlan('google', 'android'), 'system-browser');
});

// ── 3 · the return URL ──────────────────────────────────────────────────────

test('3 · the provider returns to the app scheme carrying `next` by the web door\'s own rule', () => {
  assert.equal(nativeRedirectTo('/maria-and-jose'), 'setnayan://auth/callback?next=%2Fmaria-and-jose');
  assert.equal(
    nativeRedirectTo('/join/S89E-ABC/connect'),
    'setnayan://auth/callback?next=%2Fjoin%2FS89E-ABC%2Fconnect',
  );
  // A vendor with no destination goes to /open-shop, and the intent rides along.
  assert.equal(nativeRedirectTo('/', 'vendor'), 'setnayan://auth/callback?next=%2Fopen-shop&as=vendor');
  assert.ok(nativeRedirectTo('/').startsWith(`${NATIVE_CALLBACK_SCHEME}://`));
});

test('3 · the return URL opens /auth/callback in the web view — and nothing else is accepted', () => {
  assert.equal(
    nativeCallbackPath('setnayan://auth/callback?next=%2Fmaria-and-jose&code=abc'),
    '/auth/callback?next=%2Fmaria-and-jose&code=abc',
  );
  assert.equal(nativeCallbackPath('setnayan://dashboard'), null);
  assert.equal(nativeCallbackPath('https://evil.example/auth/callback?code=abc'), null);
  assert.equal(nativeCallbackPath('evil://auth/callback?code=abc'), null);
  assert.equal(nativeCallbackPath(null), null);
  // After the Apple sheet the session is set; the callback runs the shared landing.
  assert.equal(nativeSessionLandingPath('/maria-and-jose'), '/auth/callback?next=%2Fmaria-and-jose&native=1');
  assert.equal(nativeSessionLandingPath('/', 'vendor'), '/auth/callback?next=%2Fopen-shop&as=vendor&native=1');
});

test('3 · a link that opens the app maps to the path the web view shows (Android returns this way)', () => {
  assert.equal(appUrlToPath('setnayan://auth/callback?code=abc&next=%2Fx'), '/auth/callback?code=abc&next=%2Fx');
  assert.equal(appUrlToPath('https://www.setnayan.com/papic/join/T1?x=1'), '/papic/join/T1?x=1');
  assert.equal(appUrlToPath('setnayan:///dashboard'), '/dashboard');
  assert.equal(appUrlToPath('javascript:alert(1)'), null);
  assert.equal(appUrlToPath('not a url'), null);
  assert.equal(appUrlToPath(undefined), null);
});

test('3 · /auth/callback runs ONE landing for the code exchange and the native Apple session', () => {
  const cb = code(join(WEB, 'app/auth/callback/route.ts'));
  assert.match(cb, /if \(code \|\| nativeSession\)/, 'the native session skips the shared landing');
  assert.match(cb, /code\s*\?\s*await supabase\.auth\.exchangeCodeForSession\(code\)\s*:\s*await freshNativeSession\(supabase\)/);
  assert.match(cb, /NATIVE_SESSION_PARAM\) === '1'/);
});

// ── 4/5 · 🔒 the in-app web view is never used for Google ───────────────────────

test('4 · 🔒 the provider page goes to the system browser, never the app\'s web view', () => {
  const src = code(join(WEB, 'lib/native-oauth.ts'));
  // supabase-js must not navigate THIS window to the provider…
  const calls = [...src.matchAll(/signInWithOAuth\(\{[\s\S]*?\}\);/g)].map((m) => m[0]);
  assert.ok(calls.length > 0, 'the native flow no longer starts an OAuth sign-in');
  for (const c of calls) assert.match(c, /skipBrowserRedirect:\s*true/, `navigates the web view: ${c}`);
  // …and nothing in the file hands the provider URL to the web view.
  assert.doesNotMatch(src, /location\.(assign|replace)\(\s*data\.url/, 'the web view is sent to the provider page');
  assert.doesNotMatch(src, /location\.href\s*=\s*data\.url/, 'the web view is sent to the provider page');
  assert.doesNotMatch(src, /window\.open\(/, 'window.open inside the app is the web view, not the system browser');
  // The URL's only destination is the plugin's system-browser session.
  assert.match(src, /callPlugin\('openAuthSession',\s*\{\s*url:\s*data\.url/);
  assert.equal(NATIVE_AUTH_PLUGIN, 'SetnayanAuth');
  // And the native buttons never post the web server action (a redirect in the web view).
  const btn = code(join(WEB, 'app/_components/native-oauth-buttons.tsx'));
  assert.doesNotMatch(btn, /oauth-actions/, 'the native row posts the web redirect action');
  assert.match(btn, /signInWithProviderNative\(/);
});

test('5 · every sign-in surface with a native arm renders the NATIVE row there', () => {
  const surfaces: [string, RegExp][] = [
    ['app/login/_components/sign-in-card.tsx', /nativeOAuth \? \(\s*<NativeOAuthButtons\b/],
    ['app/signup/page.tsx', /nativeOAuth \? \(\s*<NativeOAuthButtons\b/],
    ['app/open-shop/_components/open-shop-wizard.tsx', /oauth\.native \? \(\s*<NativeOAuthButtons\b/],
  ];
  for (const [rel, arm] of surfaces) {
    assert.match(code(join(WEB, rel)), arm, `${rel}: the phone app's arm does not render <NativeOAuthButtons>`);
  }
  // The in-place card reads the same gate.
  assert.match(code(join(WEB, 'app/_components/auth/sign-in-here-panel.tsx')), /nativeOAuth=\{oauth\.native\}/);
  assert.match(code(join(WEB, 'app/_components/auth/detect-oauth-shell.ts')), /oauthGate\(classifyShell\(/);
});

// ── 6 · the native half exists on both phones ─────────────────────────────────

test('6 · the plugin the web calls is registered on iOS and Android, on the scheme the web returns to', () => {
  const swift = read(join(MOBILE, 'ios/App/App/SetnayanAuthPlugin.swift'));
  assert.match(swift, /jsName = "SetnayanAuth"/);
  assert.match(swift, /CAPPluginMethod\(name: "signInWithApple"/);
  assert.match(swift, /CAPPluginMethod\(name: "openAuthSession"/);
  assert.match(swift, /ASAuthorizationAppleIDProvider\(\)/, 'Apple is not the native sheet');
  assert.match(swift, /ASWebAuthenticationSession\(url:/, 'Google is not the system browser session');
  assert.doesNotMatch(swift, /\bprint\(|NSLog\(/, 'the sign-in plugin logs — never risk a token in a log');
  const vc = read(join(MOBILE, 'ios/App/App/SetnayanBridgeViewController.swift'));
  assert.match(vc, /registerPluginInstance\(SetnayanAuthPlugin\(\)\)/);
  const pbx = read(join(MOBILE, 'ios/App/App.xcodeproj/project.pbxproj'));
  assert.match(pbx, /SetnayanAuthPlugin\.swift in Sources/, 'the Swift file is not compiled into the app');
  const ent = read(join(MOBILE, 'ios/App/App/App.entitlements'));
  assert.match(ent, /com\.apple\.developer\.applesignin/, 'no Sign in with Apple entitlement');
  const plist = read(join(MOBILE, 'ios/App/App/Info.plist'));
  assert.match(plist, new RegExp(`<string>${NATIVE_CALLBACK_SCHEME}</string>`), 'iOS does not own the return scheme');

  const java = read(join(MOBILE, 'android/app/src/main/java/com/setnayan/app/SetnayanAuthPlugin.java'));
  assert.match(java, /@CapacitorPlugin\(name = "SetnayanAuth"\)/);
  assert.match(java, /public void openAuthSession\(PluginCall call\)/);
  assert.match(read(join(MOBILE, 'android/app/src/main/java/com/setnayan/app/MainActivity.java')), /registerPlugin\(SetnayanAuthPlugin\.class\)/);
  const manifest = read(join(MOBILE, 'android/app/src/main/AndroidManifest.xml'));
  assert.match(manifest, new RegExp(`android:scheme="${NATIVE_CALLBACK_SCHEME}"`), 'Android does not own the return scheme');
});
