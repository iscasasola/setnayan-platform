/**
 * the-app-runs-on-scenes.test.ts — the iOS shell uses the UIScene life cycle,
 * and its launch screen is the light app's first paint.
 *
 * ── N1 · why the scene life cycle (Duo/iPad audit 2026-10-19, P0) ─────────
 * Apple TN3187: in the release after iOS 26, an app built with the latest SDK
 * that has not adopted UIScene does not launch. The iOS 26.5 simulator already
 * logs it as a fault for the Xcode 27.1 build of the old shell — "`UIScene`
 * lifecycle will soon be required. Failure to adopt will result in an assert in
 * the future." The fix is one manifest plus one class, and each half fails
 * SILENTLY on its own:
 *
 *   · a manifest whose delegate class is not compiled (SceneDelegate.swift
 *     missing from the Xcode project's Sources phase) launches to a black
 *     window — UIKit cannot find the class and says so only in the console;
 *   · a URL handler left in AppDelegate is never called once a scene manifest
 *     exists — the Google sign-in return (setnayan://auth/callback) and every
 *     Universal Link would be dropped with no error anywhere;
 *   · a cold launch from a link arrives ONLY in `connectionOptions`; if the
 *     scene delegate forwards it before the bridge has loaded its plugins, the
 *     App plugin is not yet listening and the link is lost.
 *
 * ── N3 · why the launch screen is pinned to the web's colour ──────────────
 * The web is forced light (`DARK_READY` is empty). The old launch storyboard
 * used `systemBackgroundColor` and the splash shipped `-dark` variants, so a
 * phone in dark mode launched BLACK and then turned light. While the ready list
 * is empty, the shell must be light too, and its launch colour must be the
 * web's own theme colour.
 *
 * SABOTAGES (each run, each red, each restored — see the PR body):
 *   · Info.plist: delete UIApplicationSceneManifest           → test 1 RED
 *   · project.pbxproj: drop "SceneDelegate.swift in Sources"  → test 2 RED
 *   · AppDelegate: restore `application(_:open:options:)`     → test 3 RED
 *   · SceneDelegate: move loadViewIfNeeded() below open(urls) → test 4 RED
 *   · LaunchScreen: background back to systemBackgroundColor  → test 6 RED
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DARK_READY, THEME_COLOR } from './appearance';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE = join(WEB, '..', 'mobile');
const APP_DIR = join(MOBILE, 'ios/App/App');
const read = (abs: string) => readFileSync(abs, 'utf8');
/** Executed code only — the docblocks name the handlers they forbid. */
const code = (abs: string) => stripComments(read(abs));

const INFO_PLIST = read(join(APP_DIR, 'Info.plist'));
const PBXPROJ = read(join(MOBILE, 'ios/App/App.xcodeproj/project.pbxproj'));
const APP_DELEGATE = code(join(APP_DIR, 'AppDelegate.swift'));
const SCENE_DELEGATE_PATH = join(APP_DIR, 'SceneDelegate.swift');
const SCENE_DELEGATE = existsSync(SCENE_DELEGATE_PATH) ? code(SCENE_DELEGATE_PATH) : '';

/** The `<string>` (or `<true/>`/`<false/>`) right after `<key>name</key>`. */
function plistValue(xml: string, key: string): string | undefined {
  const m = xml.match(new RegExp(`<key>${key}</key>\\s*(?:<string>([^<]*)</string>|<(true|false)/>)`));
  return m ? (m[1] ?? m[2]) : undefined;
}

/** The body of `<key>name</key><dict>…</dict>`, balanced. */
function plistDict(xml: string, key: string): string | undefined {
  const start = xml.search(new RegExp(`<key>${key}</key>\\s*<dict>`));
  if (start < 0) return undefined;
  let i = xml.indexOf('<dict>', start);
  let depth = 0;
  for (let j = i; j < xml.length; j++) {
    if (xml.startsWith('<dict>', j)) depth++;
    else if (xml.startsWith('</dict>', j)) {
      depth--;
      if (depth === 0) return xml.slice(i + '<dict>'.length, j);
    }
  }
  return undefined;
}

/** A Swift function body, by a signature fragment, braces balanced. */
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

// ── 1 · the manifest names a scene delegate and the bridge's storyboard ────

test('1 · Info.plist declares the UIScene life cycle, one window scene, SceneDelegate + Main.storyboard', () => {
  const manifest = plistDict(INFO_PLIST, 'UIApplicationSceneManifest');
  assert.ok(manifest, 'Info.plist has no UIApplicationSceneManifest — the app is on the retired app-delegate life cycle (TN3187)');
  // One bridge, one web view: a second window would build a second Capacitor
  // bridge whose plugins all hear the same NotificationCenter events.
  assert.equal(plistValue(manifest, 'UIApplicationSupportsMultipleScenes'), 'false');
  const roles = plistDict(manifest, 'UISceneConfigurations') ?? '';
  assert.match(roles, /<key>UIWindowSceneSessionRoleApplication<\/key>/);
  assert.equal(plistValue(roles, 'UISceneDelegateClassName'), '$(PRODUCT_MODULE_NAME).SceneDelegate');
  assert.equal(plistValue(roles, 'UISceneStoryboardFile'), 'Main');
  // The window has ONE owner. UIMainStoryboardFile is the app-delegate-era key.
  assert.equal(plistValue(INFO_PLIST, 'UIMainStoryboardFile'), undefined, 'UIMainStoryboardFile is back — the window must come from the scene');

  // The name AppDelegate asks for is the one the plist declares.
  const name = plistValue(roles, 'UISceneConfigurationName');
  assert.ok(name);
  const asked = APP_DELEGATE.match(/UISceneConfiguration\(\s*name:\s*"([^"]+)"/);
  if (asked) assert.equal(asked[1], name, 'AppDelegate asks for a scene configuration the plist does not declare');
});

test('1 · the scene storyboard still roots the app in SetnayanBridgeViewController', () => {
  const main = read(join(APP_DIR, 'Base.lproj/Main.storyboard'));
  const initial = main.match(/initialViewController="([^"]+)"/)?.[1];
  assert.ok(initial);
  const root = main.match(new RegExp(`<viewController id="${initial}"[^>]*>`))?.[0] ?? '';
  // The offline fallback, the 12 s launch watchdog and the in-app plugins
  // (SetnayanAuth, SetnayanStore) all live in this class.
  assert.match(root, /customClass="SetnayanBridgeViewController"/);
});

// ── 2 · the delegate class is compiled ─────────────────────────────────────

test('2 · every Swift file in the app folder is compiled — SceneDelegate above all', () => {
  assert.ok(SCENE_DELEGATE, 'apps/mobile/ios/App/App/SceneDelegate.swift is missing');
  const swift = readdirSync(APP_DIR).filter((f) => f.endsWith('.swift'));
  assert.ok(swift.includes('SceneDelegate.swift'));
  for (const file of swift) {
    assert.match(
      PBXPROJ,
      new RegExp(`/\\* ${file.replace('.', '\\.')} in Sources \\*/,`),
      `${file} is not in the App target's Sources phase — the manifest would name a class that does not exist (black window)`,
    );
  }
});

// ── 3 · URLs and Universal Links are handled where UIKit delivers them ─────

test('3 · AppDelegate keeps no window and no URL handler (UIKit never calls them under a scene manifest)', () => {
  assert.doesNotMatch(APP_DELEGATE, /\bvar\s+window\b/);
  assert.doesNotMatch(APP_DELEGATE, /func\s+application\s*\([^)]*\bopen\s+url\s*:/);
  assert.doesNotMatch(APP_DELEGATE, /func\s+application\s*\([^)]*\bcontinue\s+userActivity\s*:/);
  assert.doesNotMatch(APP_DELEGATE, /ApplicationDelegateProxy/);
});

test('3 · SceneDelegate hands every open URL and Universal Link to Capacitor', () => {
  assert.match(SCENE_DELEGATE, /class\s+SceneDelegate\s*:\s*UIResponder\s*,\s*UIWindowSceneDelegate/);
  assert.match(SCENE_DELEGATE, /\bvar\s+window\s*:\s*UIWindow\?/);

  const openBody = swiftBody(SCENE_DELEGATE, /func\s+scene\s*\(\s*_\s+scene:\s*UIScene,\s*openURLContexts\b[^)]*\)/);
  const continueBody = swiftBody(SCENE_DELEGATE, /func\s+scene\s*\(\s*_\s+scene:\s*UIScene,\s*continue\s+userActivity:\s*NSUserActivity\s*\)/);
  assert.ok(openBody, 'no scene(_:openURLContexts:) — setnayan:// (the Google sign-in return) would be dropped');
  assert.ok(continueBody, 'no scene(_:continue:) — Universal Links would be dropped');

  // Both reach ApplicationDelegateProxy, directly or through one private helper.
  const reaches = (body: string, proxyCall: RegExp) => {
    if (proxyCall.test(body)) return true;
    const helper = body.match(/\b([a-z][A-Za-z]*)\(/g)?.map((c) => c.slice(0, -1)) ?? [];
    return helper.some((h) => {
      const b = swiftBody(SCENE_DELEGATE, new RegExp(`func\\s+${h}\\s*\\([^)]*\\)`));
      return b !== undefined && proxyCall.test(b);
    });
  };
  assert.ok(reaches(openBody, /ApplicationDelegateProxy\.shared\.application\([^)]*open:/), 'openURLContexts does not reach ApplicationDelegateProxy');
  assert.ok(reaches(continueBody, /ApplicationDelegateProxy\.shared\.application\([\s\S]*?continue:/), 'continue does not reach ApplicationDelegateProxy');
});

// ── 4 · a link that LAUNCHES the app is not lost ───────────────────────────

test('4 · willConnectTo forwards the launch URL and activity — after the bridge has loaded', () => {
  const body = swiftBody(SCENE_DELEGATE, /func\s+scene\s*\(\s*_\s+scene:\s*UIScene,\s*willConnectTo\b[\s\S]*?\)/);
  assert.ok(body, 'no scene(_:willConnectTo:options:)');
  assert.match(body, /connectionOptions\.urlContexts/, 'a cold launch from setnayan:// would be ignored');
  assert.match(body, /connectionOptions\.userActivities/, 'a cold launch from a Universal Link would be ignored');

  const load = body.indexOf('loadViewIfNeeded()');
  assert.ok(load >= 0, 'willConnectTo forwards before the bridge exists — the App plugin is not listening yet');
  // Every forwarding call comes after the view (and with it the bridge and its plugins) loads.
  const forwards = [...body.matchAll(/\b(open|continueActivity|ApplicationDelegateProxy)\b(?=[.(])/g)].map((m) => m.index ?? 0);
  assert.ok(forwards.length > 0, 'willConnectTo forwards nothing');
  for (const at of forwards) assert.ok(at > load, 'a launch link is forwarded before loadViewIfNeeded()');
});

// ── 5/6 · the launch is the light app's first paint ────────────────────────

const LAUNCH = read(join(APP_DIR, 'Base.lproj/LaunchScreen.storyboard'));
const SPLASH = JSON.parse(read(join(APP_DIR, 'Assets.xcassets/Splash.imageset/Contents.json'))) as {
  images: { appearances?: { appearance: string; value: string }[] }[];
};

/** `#RRGGBB` → the storyboard's 0..1 sRGB floats. */
function hexToStoryboard(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
}

test('5 · while no screen is dark-ready, the shell is light: no dark splash, no dark launch', { skip: DARK_READY.length > 0 }, () => {
  assert.equal(plistValue(INFO_PLIST, 'UIUserInterfaceStyle'), 'Light', 'a dark-mode phone would get dark native chrome around a light web app');
  const dark = SPLASH.images.filter((i) => i.appearances?.some((a) => a.value === 'dark'));
  assert.equal(dark.length, 0, 'the splash ships a dark variant while the web is forced light');
});

test('6 · the launch screen and the web view open in the web\'s own theme colour', () => {
  assert.doesNotMatch(LAUNCH, /systemColor="systemBackgroundColor"/, 'the launch screen follows the phone (black in dark mode), not the app');
  const bg = LAUNCH.match(/<color key="backgroundColor" red="([\d.]+)" green="([\d.]+)" blue="([\d.]+)"[^>]*customColorSpace="sRGB"/);
  assert.ok(bg, 'the launch screen root has no explicit sRGB background');
  const want = hexToStoryboard(THEME_COLOR.light);
  bg.slice(1, 4).forEach((v, i) => assert.ok(Math.abs(Number(v) - want[i]!) < 0.002, `launch background channel ${i} ≠ ${THEME_COLOR.light}`));

  const cap = stripComments(read(join(MOBILE, 'capacitor.config.ts')));
  const iosBlock = cap.slice(cap.indexOf('ios: {'));
  assert.match(
    iosBlock.slice(0, iosBlock.indexOf('\n  },')),
    new RegExp(`backgroundColor:\\s*'${THEME_COLOR.light}'`, 'i'),
    'the iOS web view paints systemBackground (white, or black in dark mode) before the page arrives',
  );
});
