/**
 * SUPNAYAN IS THE SAME APP, BUILT A SECOND WAY (owner, DECISION_LOG 24 Nov 2026 "Three iOS apps: Setnayan · Supnayan ·
 * Chatnayan" and "A dedicated iPhone app for suppliers").
 *
 * Supnayan (com.setnayan.supnayan) is the suppliers' and coordinators' iPhone app. It is NOT a second project, a
 * second web app or a second copy of any page: it is the one Xcode target, the one Swift, the one web app, built from
 * the "Debug Supnayan" / "Release Supnayan" configurations. What must stay true:
 *
 *   1. ITS IDENTITY IS ONE FILE. ios/supnayan.xcconfig holds its bundle id, name, return scheme, icon, entitlements and
 *      build number, and the Supnayan configurations take it from there. A Supnayan configuration that wrote any of
 *      those inline would silently beat the xcconfig (Xcode ranks target settings above the target's xcconfig).
 *   2. THE SETNAYAN APP IS UNCHANGED. Its configurations still say com.setnayan.app, Setnayan and setnayan://, and the
 *      Info.plist names only build settings, never "Supnayan".
 *   3. WHAT IT OPENS AND HOW IT ANNOUNCES ITSELF is capacitor.config.ts › plugins.SetnayanShell.supnayan, which
 *      SetnayanShell.swift writes onto Capacitor's descriptor before the web view exists:
 *        · the supplier door, supplier.setnayan.com;
 *        · the store shell (`SetnayanApp`): Apple's in-app-purchase rules apply, exactly as in Setnayan;
 *        · native sign-in (`SetnayanSignIn/1`): the same plugin, Google with Apple beside it (guideline 4.8);
 *        · `SetnayanBusiness`: the web's ONE door flag, so the dashboard has no way out to the host side or Discover;
 *        · NOT `SetnayanIAP/*` (no In-App Purchase products exist under this app's App Store record) and NOT
 *          `SetnayanPush/1` (lib/apns.ts sends to the one Setnayan topic). Announcing either would show a button with
 *          nothing behind it;
 *        · the site's hosts in allowNavigation: a door hands sign-in and every other page to the site (one auth
 *          origin), and Capacitor throws any other host out to Safari.
 *   4. THE OFFLINE RETRY reopens the app's own start address, never the host side.
 *
 * SABOTAGES (each run red, then restored — see the PR):
 *   · supnayan.xcconfig: PRODUCT_BUNDLE_IDENTIFIER = com.setnayan.app             → test 1 RED
 *   · pbxproj "Release Supnayan": add PRODUCT_BUNDLE_IDENTIFIER inline            → test 1 RED
 *   · capacitor.config.ts supnayan.appendUserAgent: add SetnayanIAP/3             → test 3 RED
 *   · capacitor.config.ts supnayan.allowNavigation: drop www.setnayan.com          → test 3 RED
 *   · SetnayanBridgeViewController.swift: drop `SetnayanShell.apply(to:`           → test 4 RED
 *   · www/index.html: follow any ?retry= address                                   → test 5 RED
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isStoreShellSignals } from './store-shell';
import { hasNativeSignIn } from './oauth-shell-gate';
import { hasNativeStore } from './iap/iap-gate';
import { NATIVE_CALLBACK_SCHEME } from './native-oauth-plan';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE = join(WEB, '..', 'mobile');
const IOS = join(MOBILE, 'ios');
const read = (rel: string) => readFileSync(join(MOBILE, rel), 'utf8');

/** `KEY = value` lines of an xcconfig, comments dropped. */
function xcconfig(rel: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of read(rel).split('\n')) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line.replace(/\/\/.*$/, ''));
    if (m) out[m[1]!] = m[2]!;
  }
  return out;
}

/** One XCBuildConfiguration block of the pbxproj, by its configuration name, at project or target level. */
function configBlocks(pbx: string, name: string): string[] {
  const quoted = name.includes(' ') ? `"${name}"` : name;
  return [...pbx.matchAll(/\t\t[0-9A-F]{24} \/\* [^*]+ \*\/ = \{\n\t\t\tisa = XCBuildConfiguration;[\s\S]*?\n\t\t\};\n/g)]
    .map((m) => m[0])
    .filter((b) => b.includes(`\t\t\tname = ${quoted};`));
}

const IDENTITY = [
  'PRODUCT_BUNDLE_IDENTIFIER',
  'SETNAYAN_SHELL',
  'SETNAYAN_DISPLAY_NAME',
  'SETNAYAN_URL_SCHEME',
  'ASSETCATALOG_COMPILER_APPICON_NAME',
  'CODE_SIGN_ENTITLEMENTS',
  'CURRENT_PROJECT_VERSION',
  'MARKETING_VERSION',
  'TARGETED_DEVICE_FAMILY',
] as const;

/** The supnayan block of capacitor.config.ts, read as text (the config imports Capacitor's CLI types). */
function supnayanBlock(): { url: string; userAgent: string; hosts: string[] } {
  const cfg = stripComments(read('capacitor.config.ts'));
  const block = /SetnayanShell:\s*\{\s*supnayan:\s*\{([\s\S]*?)\}\s*,?\s*\}/.exec(cfg)?.[1];
  assert.ok(block, 'capacitor.config.ts has no plugins.SetnayanShell.supnayan block — the Supnayan build would stop at launch');
  const url = /url:\s*process\.env\.CAP_SUPNAYAN_URL\s*\?\?\s*'([^']+)'/.exec(block)?.[1];
  const userAgent = /appendUserAgent:\s*'([^']+)'/.exec(block)?.[1];
  const hosts = [.../'([^']+)'/g[Symbol.matchAll](/allowNavigation:\s*\[([^\]]*)\]/.exec(block)?.[1] ?? '')].map((m) => m[1]!);
  assert.ok(url && userAgent, 'the supnayan block needs url + appendUserAgent');
  return { url: url!, userAgent: userAgent!, hosts };
}

test('1 · Supnayan\'s identity is ios/supnayan.xcconfig, and its configurations take it from there', () => {
  const sup = xcconfig('ios/supnayan.xcconfig');
  assert.equal(sup.PRODUCT_BUNDLE_IDENTIFIER, 'com.setnayan.supnayan');
  assert.equal(sup.SETNAYAN_SHELL, 'supnayan');
  assert.equal(sup.SETNAYAN_DISPLAY_NAME, 'Supnayan');
  assert.ok(sup.SETNAYAN_URL_SCHEME && sup.SETNAYAN_URL_SCHEME !== NATIVE_CALLBACK_SCHEME, 'Supnayan must not claim setnayan:// — Setnayan\'s links would open the wrong app');
  assert.ok(Number(sup.CURRENT_PROJECT_VERSION) >= 1, 'Supnayan carries its own build number');
  assert.equal(sup.TARGETED_DEVICE_FAMILY, '1', 'iPhone only');

  const debug = read('ios/supnayan-debug.xcconfig');
  assert.match(debug, /#include "debug\.xcconfig"/, 'the Debug build keeps Capacitor\'s debug flag');
  assert.match(debug, /#include "supnayan\.xcconfig"/);

  const pbx = read('ios/App/App.xcodeproj/project.pbxproj');
  for (const [name, base] of [['Debug Supnayan', 'supnayan-debug.xcconfig'], ['Release Supnayan', 'supnayan.xcconfig']] as const) {
    const blocks = configBlocks(pbx, name);
    assert.equal(blocks.length, 2, `"${name}" must exist at the project and the target level`);
    const target = blocks.find((b) => b.includes('INFOPLIST_FILE'));
    assert.ok(target, `"${name}" has no target-level configuration`);
    assert.match(target!, new RegExp(`baseConfigurationReference = [0-9A-F]{24} /\\* ${base.replace('.', '\\.')} \\*/;`), `"${name}" is not built on ${base}`);
    for (const k of IDENTITY) {
      assert.doesNotMatch(target!, new RegExp(`\\b${k} = `), `"${name}" writes ${k} inline — it would beat supnayan.xcconfig`);
    }
  }
});

test('2 · the Setnayan app is unchanged: its own id, name and scheme, and an Info.plist of build settings only', () => {
  const pbx = read('ios/App/App.xcodeproj/project.pbxproj');
  for (const name of ['Debug', 'Release']) {
    const blocks = configBlocks(pbx, name);
    const project = blocks.find((b) => !b.includes('INFOPLIST_FILE'));
    const target = blocks.find((b) => b.includes('INFOPLIST_FILE'));
    assert.ok(project && target, `the "${name}" configurations moved`);
    assert.match(target!, /PRODUCT_BUNDLE_IDENTIFIER = com\.setnayan\.app;/);
    assert.match(target!, /ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;/);
    assert.match(target!, /CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/);
    assert.match(project!, /SETNAYAN_SHELL = setnayan;/);
    assert.match(project!, /SETNAYAN_DISPLAY_NAME = Setnayan;/);
    assert.match(project!, new RegExp(`SETNAYAN_URL_SCHEME = ${NATIVE_CALLBACK_SCHEME};`));
  }
  const plist = read('ios/App/App/Info.plist');
  assert.match(plist, /<key>SetnayanShell<\/key>\s*<string>\$\(SETNAYAN_SHELL\)<\/string>/);
  assert.match(plist, /<key>CFBundleDisplayName<\/key>\s*<string>\$\(SETNAYAN_DISPLAY_NAME\)<\/string>/);
  assert.doesNotMatch(plist, /Supnayan/i, 'the shared Info.plist names an app — it must name build settings only');
  assert.equal((pbx.match(/SetnayanShell\.swift in Sources \*\/,/g) ?? []).length, 1, 'SetnayanShell.swift is not compiled into the one target');

  // Both apps archive from shared schemes: once Supnayan's scheme names the target, Xcode stops making "App" by itself.
  const scheme = (n: string) => read(`ios/App/App.xcodeproj/xcshareddata/xcschemes/${n}.xcscheme`);
  assert.match(scheme('App'), /<ArchiveAction\s+buildConfiguration = "Release"/);
  assert.match(scheme('App'), /<LaunchAction\s+buildConfiguration = "Debug"/);
  assert.match(scheme('Supnayan'), /<ArchiveAction\s+buildConfiguration = "Release Supnayan"/);
  assert.match(scheme('Supnayan'), /<LaunchAction\s+buildConfiguration = "Debug Supnayan"/);
});

test('2 · Supnayan\'s icon slot and entitlements exist — sign-in and NFC only, no Universal Links domain', () => {
  const sup = xcconfig('ios/supnayan.xcconfig');
  const iconSet = join(IOS, 'App', 'App', 'Assets.xcassets', `${sup.ASSETCATALOG_COMPILER_APPICON_NAME}.appiconset`);
  const contents = JSON.parse(readFileSync(join(iconSet, 'Contents.json'), 'utf8')) as { images: { size: string; filename?: string }[] };
  const icon = contents.images.find((i) => i.size === '1024x1024');
  assert.ok(icon?.filename && existsSync(join(iconSet, icon.filename)), 'the 1024 icon file is missing from the slot');

  assert.equal(sup.CODE_SIGN_ENTITLEMENTS, 'App/Supnayan.entitlements');
  const ent = read('ios/App/App/Supnayan.entitlements');
  assert.match(ent, /com\.apple\.developer\.applesignin/, 'Google in the app needs Sign in with Apple beside it (4.8)');
  assert.doesNotMatch(ent, /associated-domains/, 'no apple-app-site-association names Supnayan; claiming www.setnayan.com would fight Setnayan for links');
  assert.doesNotMatch(ent, /aps-environment/, 'push waits for a per-app APNs topic (lib/apns.ts)');
});

test('3 · what Supnayan opens and how it announces itself', () => {
  const { url, userAgent, hosts } = supnayanBlock();
  assert.equal(url, 'https://supplier.setnayan.com', 'Supnayan opens the supplier door');
  const ua = `Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ${userAgent}`;
  assert.equal(isStoreShellSignals(ua, ''), true, 'Supnayan must read as the store shell — Apple\'s purchase rules apply');
  assert.equal(hasNativeSignIn(ua), true, 'Supnayan carries the native sign-in plugin');
  assert.match(userAgent, /\bSetnayanBusiness\b/, 'Supnayan must turn on the door flag (lib/doors.ts DOOR_APP_UA)');
  assert.equal(hasNativeStore(ua), false, 'no In-App Purchase products exist under Supnayan\'s record yet');
  assert.doesNotMatch(userAgent, /SetnayanIAP/);
  assert.doesNotMatch(userAgent, /SetnayanPush/, 'lib/apns.ts sends to the one Setnayan topic — a Supnayan token would be refused');
  for (const h of ['www.setnayan.com', 'setnayan.com', 'supplier.setnayan.com', 'coordinator.setnayan.com']) {
    assert.ok(hosts.includes(h), `${h} is not in Supnayan's allowNavigation — Capacitor would open it in Safari`);
  }
  for (const h of hosts) assert.match(h, /^(?:[a-z0-9-]+\.)?setnayan\.com$/, `${h}: Supnayan opens only Setnayan's own hosts in place`);

  // The Setnayan app's own user-agent is untouched by the second app.
  const cfg = stripComments(read('capacitor.config.ts'));
  assert.match(cfg, /ios:\s*\{[\s\S]*?appendUserAgent:\s*'SetnayanApp SetnayanSignIn\/1 SetnayanIAP\/3 SetnayanPush\/1'/);
  assert.match(cfg, /server:\s*\{\s*url: SERVER_URL,/);
});

test('4 · the switch: the build names its app, and the bridge applies the block before the web view exists', () => {
  const shell = stripComments(read('ios/App/App/SetnayanShell.swift'));
  assert.match(shell, /static let infoKey = "SetnayanShell"/, 'Info.plist key and Swift disagree');
  assert.match(shell, /static let configKey = "SetnayanShell"/, 'capacitor.config.ts block and Swift disagree');
  assert.match(shell, /descriptor\.serverURL = url/);
  assert.match(shell, /descriptor\.appendedUserAgentString = userAgent/);
  assert.match(shell, /descriptor\.allowedNavigationHostnames = /);
  assert.match(shell, /preconditionFailure\(/, 'a Supnayan build with no block must stop, never open as Setnayan under another name');
  const bridge = stripComments(read('ios/App/App/SetnayanBridgeViewController.swift'));
  assert.match(bridge, /override func instanceDescriptor\(\) -> InstanceDescriptor \{\s*let descriptor = super\.instanceDescriptor\(\)\s*SetnayanShell\.apply\(to: descriptor\)/);
});

test('5 · the offline Retry reopens the app\'s own start address — only a setnayan.com one', () => {
  const bridge = stripComments(read('ios/App/App/SetnayanBridgeViewController.swift'));
  assert.match(bridge, /URLQueryItem\(name: "retry", value: start\)/, 'the shell no longer hands the page its start address');
  const html = read('www/index.html');
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  assert.ok(script, 'the fallback page lost its Retry script');
  const run = (search: string) => {
    let went = '';
    const button = { addEventListener: (_: string, fn: () => void) => fn() };
    const location = { search, set href(v: string) { went = v; }, get href() { return went; } };
    new Function('location', 'document', 'URLSearchParams', script!)(location, { getElementById: () => button }, URLSearchParams);
    return went;
  };
  assert.equal(run(`?retry=${encodeURIComponent('https://supplier.setnayan.com')}`), 'https://supplier.setnayan.com');
  assert.equal(run(`?retry=${encodeURIComponent('https://www.setnayan.com/')}`), 'https://www.setnayan.com/');
  assert.equal(run(''), 'https://www.setnayan.com', 'Android (no ?retry=) keeps the default');
  for (const evil of ['https://evil.example', 'https://setnayan.com.evil.example', 'javascript:alert(1)', 'https://evilsetnayan.com']) {
    assert.equal(run(`?retry=${encodeURIComponent(evil)}`), 'https://www.setnayan.com', `${evil} was followed`);
  }
});
