/**
 * the-app-clears-the-side-safe-areas.test.ts — the iOS web view stays out of
 * the LEFT and RIGHT safe areas, and only those; and a launch that has reached
 * the server is not thrown onto the offline page by the first-response clock.
 *
 * ── D1 (PR #6716 walk, iPhone Duo outer screen 466×678 pt, iOS 27.1) ───────
 * The system status column (clock · Wi-Fi · sensor) runs down the RIGHT edge of
 * that screen. The Capacitor web view filled the window, so in-flow page
 * content sat under it. #6681's `env(safe-area-inset-left/right)` clears fixed
 * bars only. `ios.contentInset: 'always'` was measured and rejected: it insets
 * every edge AND WebKit still reports the full env() insets, so every padded
 * bar would pad twice on every iPhone. The fix is native
 * (apps/mobile/ios/App/App/SideSafeAreaHost.swift): a host controller lays the
 * web view inside the side safe area, full height. Each half fails silently:
 *
 *   · a host that is never installed (SceneDelegate) changes nothing;
 *   · a host installed AFTER `loadViewIfNeeded()` leaves a launch link with no
 *     plugin listening (the-app-runs-on-scenes.test.ts test 4's reason);
 *   · a host without the web-view subclass is undone by `@capacitor/keyboard`
 *     (`resize: 'native'`), which rewrites the frame to "window width − x" on
 *     every keyboard show and hide — the right edge goes back under the column;
 *   · a band that touches top/bottom moves the iPhone's notch/home-indicator
 *     handling, which the web already does through env();
 *   · a host that swallows the status-bar questions loses the StatusBar plugin.
 *
 * ── D8 (same walk) ────────────────────────────────────────────────────────
 * The single 12 s clock ran from launch to `didFinish` (every subresource) and
 * replaced slow-but-working loads with "You're offline". Phase 1 keeps 12 s to
 * the FIRST RESPONSE (a genuinely offline phone sees Retry as soon as before);
 * the first main-frame commit re-arms a longer phase 2 for finishing.
 *
 * SABOTAGES (each run, each red, each restored — see the PR body):
 *   · SceneDelegate: delete the SideSafeAreaHostViewController wrap     → 1 RED
 *   · SceneDelegate: move the wrap below loadViewIfNeeded()               → 1 RED
 *   · Bridge VC: delete the webView(with:configuration:) override         → 2 RED
 *   · SideSafeWebView: setter assigns newValue straight to super.frame    → 2 RED
 *   · sideSafe(): use insets.top for y                                    → 3 RED
 *   · host: drop childForStatusBarStyle                                   → 4 RED
 *   · capacitor.config.ts: ios.contentInset: 'always'                     → 5 RED
 *   · didCommit: drop onFirstCommit?()                                    → 6 RED
 *   · paintDeadline below launchDeadline                                  → 6 RED
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE = join(WEB, '..', 'mobile');
const APP_DIR = join(MOBILE, 'ios/App/App');
/** Executed code only — the docblocks name the shapes they forbid. */
const code = (file: string) => stripComments(readFileSync(join(APP_DIR, file), 'utf8'));

const HOST = code('SideSafeAreaHost.swift');
const BRIDGE = code('SetnayanBridgeViewController.swift');
const SCENE = code('SceneDelegate.swift');

/** A Swift body by a signature fragment, braces balanced. */
function swiftBody(source: string, signature: RegExp): string | undefined {
  const m = signature.exec(source);
  if (!m) return undefined;
  const open = source.indexOf('{', m.index + m[0].length);
  let depth = 0;
  for (let j = open; j < source.length; j++) {
    if (source[j] === '{') depth++;
    else if (source[j] === '}') {
      depth--;
      if (depth === 0) return source.slice(open + 1, j);
    }
  }
  return undefined;
}

// ── 1 · the host is the window's root, before anything loads ─────────────

test('1 · SceneDelegate makes the side-safe host the root before the bridge loads, on every launch', () => {
  const body = swiftBody(SCENE, /func\s+scene\s*\(\s*_\s+scene:\s*UIScene,\s*willConnectTo\b[\s\S]*?\)/);
  assert.ok(body, 'no scene(_:willConnectTo:options:)');
  const wrap = body.search(/rootViewController\s*=\s*SideSafeAreaHostViewController\(\s*hosting:/);
  assert.ok(wrap >= 0, 'the Capacitor bridge is still the window root — the web view runs under the side safe areas (D1)');
  const load = body.indexOf('loadViewIfNeeded()');
  assert.ok(load < 0 || wrap < load, 'the host is installed after the bridge loaded — its plugins were built under the old root');
  // Not behind the "no launch link" early return: an ordinary launch must get it too.
  const earlyReturn = body.search(/guard\s+!urls\.isEmpty[^\n]*else\s*\{\s*return\s*\}/);
  assert.ok(earlyReturn < 0 || wrap < earlyReturn, 'the host is installed only when the app is launched from a link');

  // The host loads the bridge's view (and with it the bridge) inside its own viewDidLoad.
  const didLoad = swiftBody(HOST, /override\s+func\s+viewDidLoad\s*\(\s*\)/);
  assert.ok(didLoad, 'the host has no viewDidLoad');
  assert.match(didLoad, /addChild\(\s*bridgeController\s*\)/);
  assert.match(didLoad, /view\.addSubview\(/);
  assert.match(didLoad, /didMove\(\s*toParent:\s*self\s*\)/);
});

// ── 2 · every writer of the web view's frame is held to the band ─────────

test('2 · the bridge builds a SideSafeWebView, whose frame setter applies the side-safe band', () => {
  const make = swiftBody(BRIDGE, /override\s+func\s+webView\s*\(\s*with\s+frame:\s*CGRect,\s*configuration:\s*WKWebViewConfiguration\s*\)\s*->\s*WKWebView/);
  assert.ok(make, 'the bridge does not override webView(with:configuration:) — the Keyboard plugin can widen the web view back under the column');
  assert.match(make, /SideSafeWebView\(\s*frame:/);

  assert.match(HOST, /class\s+SideSafeWebView\s*:\s*WKWebView/);
  const frame = swiftBody(HOST, /override\s+var\s+frame\s*:\s*CGRect/);
  assert.ok(frame, 'SideSafeWebView does not override frame');
  const setter = swiftBody(frame, /\bset\b/);
  assert.ok(setter, 'frame has no setter');
  assert.match(setter, /super\.frame\s*=[^\n]*sideSafe\(/, 'the frame setter does not apply sideSafe — writers bypass the band');
  assert.doesNotMatch(setter, /super\.frame\s*=\s*newValue\s*$/m, 'the frame setter passes the frame through untouched');

  // The host's own layout pass goes through the same band and gives the web view to the host.
  assert.match(HOST, /\.host\s*=\s*view/);
  const layout = swiftBody(HOST, /override\s+func\s+viewDidLayoutSubviews\s*\(\s*\)/);
  assert.ok(layout);
  assert.match(layout, /sideSafe\(/);
  assert.match(HOST, /override\s+func\s+viewSafeAreaInsetsDidChange\s*\(\s*\)/, 'a safe-area change (Duo display change, rotation) would not re-lay the web view');
});

// ── 3 · the band is horizontal only ───────────────────────────────────────

test('3 · sideSafe() moves x and width by the left/right insets, and returns y and height untouched', () => {
  const band = swiftBody(HOST, /static\s+func\s+sideSafe\s*\(/);
  assert.ok(band, 'no sideSafe()');
  assert.match(band, /x:\s*insets\.left/);
  assert.match(band, /width:[^\n]*bounds\.width\s*-\s*insets\.left\s*-\s*insets\.right/);
  assert.match(band, /y:\s*frame\.origin\.y/, 'y is not the caller\'s — the top inset is the web\'s job (env), not the frame\'s');
  assert.match(band, /height:\s*frame\.height/, 'height is not the caller\'s — the Keyboard plugin\'s answer would be lost');
  assert.doesNotMatch(band, /insets\.(top|bottom)/, 'the band uses a top/bottom inset — every iPhone\'s bars would move');
});

// ── 4 · the bridge still answers the status-bar questions ────────────────

test('4 · the host forwards status bar, home indicator, edge gestures and orientations to the bridge', () => {
  for (const p of ['childForStatusBarStyle', 'childForStatusBarHidden', 'childForHomeIndicatorAutoHidden', 'childForScreenEdgesDeferringSystemGestures']) {
    assert.match(HOST, new RegExp(`override\\s+var\\s+${p}\\s*:\\s*UIViewController\\?\\s*\\{\\s*bridgeController\\s*\\}`), `${p} is not the bridge's — the StatusBar plugin would stop working`);
  }
  assert.match(HOST, /override\s+var\s+supportedInterfaceOrientations[^{]*\{\s*bridgeController\.supportedInterfaceOrientations\s*\}/);
});

// ── 5 · the measured-and-rejected alternative stays out ──────────────────

test('5 · capacitor.config.ts does not set an iOS contentInset (it double-pads every env() bar)', () => {
  const cap = stripComments(readFileSync(join(MOBILE, 'capacitor.config.ts'), 'utf8'));
  assert.doesNotMatch(cap, /contentInset\s*:/);
});

// ── 6 · D8 — the deadline moves to the finish phase once the server answers ─

test('6 · the first main-frame commit re-arms the launch deadline with a longer finish phase', () => {
  const num = (name: string) => Number(BRIDGE.match(new RegExp(`static\\s+let\\s+${name}\\s*:\\s*TimeInterval\\s*=\\s*(\\d+(?:\\.\\d+)?)`))?.[1]);
  const first = num('launchDeadline');
  const finish = num('paintDeadline');
  assert.ok(first > 0 && first <= 15, `launchDeadline ${first}s — an offline phone must still see Retry quickly`);
  assert.ok(finish > first, `paintDeadline ${finish}s is not longer than launchDeadline ${first}s — D8 is back`);
  assert.ok(finish <= 30, `paintDeadline ${finish}s — a stalled body would sit blank too long`);

  const commit = swiftBody(BRIDGE, /func\s+webView\s*\(\s*_\s+webView:\s*WKWebView,\s*didCommit\b[^)]*\)/);
  assert.ok(commit, 'no didCommit');
  assert.match(commit, /navigationTarget\?\.webView\?\(webView,\s*didCommit:/, 'Capacitor no longer sees didCommit');
  assert.match(commit, /onFirstCommit\?\(\)/, 'the first commit does not re-arm the deadline');
  assert.match(BRIDGE, /onFirstCommit\s*=\s*\{[^}]*rearmWatchdogForPaint\(\)/);
  const rearm = swiftBody(BRIDGE, /func\s+rearmWatchdogForPaint\s*\(\s*\)/);
  assert.ok(rearm);
  assert.match(rearm, /Self\.paintDeadline/);
  // Commit must NOT cancel outright — "headers then a stalled body" stays bounded.
  assert.doesNotMatch(commit, /cancelLaunchWatchdog|onContentRendered/);
});

// ── 7 · this build is the one after build 5 ──────────────────────────────

test('7 · both build configurations carry the same build number, past build 5', () => {
  const pbx = readFileSync(join(MOBILE, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
  const builds = [...pbx.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map((m) => Number(m[1]));
  assert.equal(builds.length, 2, 'expected Debug + Release CURRENT_PROJECT_VERSION');
  assert.equal(builds[0], builds[1], 'Debug and Release disagree on the build number');
  assert.ok(builds[0]! >= 6, `build ${builds[0]} — 1.0 (5) is already in App Store Connect; a duplicate upload is refused`);
});
