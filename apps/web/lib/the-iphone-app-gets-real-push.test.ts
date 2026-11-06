/**
 * the-iphone-app-gets-real-push.test.ts — INSIDE THE IPHONE APP, A REPLY STILL
 * REACHES THE LOCK SCREEN.
 *
 * Owner, 2026-10-31: "The notification on the phone not on the app." Web Push does
 * not reach inside the app's WKWebView, so the app gets APNs. One mechanism, many
 * halves, each held here (comments stripped):
 *   1 · the funnel hands the SAME template message to both channels, and
 *       "configured" means either one;
 *   2 · the APNs channel is a quiet no-op without its five env vars, and never
 *       prints the key;
 *   3 · Web Push sends only to 'web' rows; the save action writes 'apns' rows;
 *   4 · the app build carries the plugin and says so (`SetnayanPush/1`, iOS only),
 *       forwards the device token from AppDelegate, and holds the push
 *       entitlement; SPM links the plugin;
 *   5 · a tap opens its screen and an allowed phone refreshes its token — the
 *       router is mounted in the root layout.
 *
 * SABOTAGE (seen red, then restored): dropped `sendApns(userId, message)` from the
 * funnel (1 red) · removed `.eq('kind', 'web')` from web-push.ts (3 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = process.cwd();
const MOBILE = join(WEB, '..', 'mobile');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const raw = (abs: string) => readFileSync(abs, 'utf8');

test('1 · the funnel sends the same message to Web Push and APNs', () => {
  const f = code('lib/push-send.server.ts');
  assert.match(f, /Promise\.all\(\[sendWebPush\(userId, message\), sendApns\(userId, message\)\]\)/, 'a channel is left out, or gets a different message');
  assert.match(f, /isWebPushConfigured\(\) \|\| isApnsConfigured\(\)/);
});

test('2 · APNs is a quiet no-op without its env, and never prints the key', () => {
  const a = code('lib/apns.ts');
  assert.match(a, /const cfg = config\(\);\s*if \(!cfg\) return;/);
  assert.match(code('lib/apns-request.ts'), /if \(!keyP8 \|\| !keyId \|\| !teamId \|\| !bundleId\) return null;/);
  assert.ok(!/console\.\w+\([^)]*(keyP8|APNS_KEY_P8|cfg\))/.test(a), 'the APNs key could reach a log');
  assert.match(a, /\.eq\('kind', 'apns'\)/);
});

test('3 · Web Push sends only to web rows; the app saves apns rows', () => {
  assert.match(code('lib/web-push.ts'), /\.eq\('kind', 'web'\)/, 'Web Push would try to send to an iPhone token');
  const actions = code('lib/push-actions.ts');
  const save = actions.slice(actions.indexOf('export async function savePushSubscription'));
  assert.match(save, /isApnsDeviceToken\(sub\.apnsToken\)/);
  assert.match(save, /kind: 'apns'/);
  assert.match(save, /onConflict: 'endpoint'/);
});

test('4 · the app build carries the plugin, announces it, forwards the token, holds the entitlement', () => {
  const pkg = JSON.parse(raw(join(MOBILE, 'package.json'))) as { dependencies: Record<string, string> };
  assert.match(pkg.dependencies['@capacitor/push-notifications'] ?? '', /^8\./, 'the push plugin is not in the app');
  const cfg = raw(join(MOBILE, 'capacitor.config.ts'));
  const ios = /ios:\s*\{[\s\S]*?appendUserAgent:\s*'([^']+)'/.exec(cfg);
  assert.ok(ios && /\bSetnayanPush\/1\b/.test(ios[1]!), 'the iOS build does not announce native push');
  const global = /\n {2}appendUserAgent:\s*'([^']+)'/.exec(cfg);
  assert.ok(global && !/SetnayanPush/.test(global[1]!), 'Android claims native push it does not have');
  assert.match(code('lib/native-push.ts'), /NATIVE_PUSH_UA_MARKER = 'SetnayanPush\/1'/);
  assert.match(code('lib/native-push.ts'), /savePushSubscription\(\{ apnsToken: token \}\)/);
  const delegate = raw(join(MOBILE, 'ios/App/App/AppDelegate.swift'));
  assert.match(delegate, /didRegisterForRemoteNotificationsWithDeviceToken[\s\S]*?\.capacitorDidRegisterForRemoteNotifications/);
  assert.match(delegate, /didFailToRegisterForRemoteNotificationsWithError[\s\S]*?\.capacitorDidFailToRegisterForRemoteNotifications/);
  assert.match(raw(join(MOBILE, 'ios/App/App/App.entitlements')), /<key>aps-environment<\/key>/);
  assert.match(raw(join(MOBILE, 'ios/App/CapApp-SPM/Package.swift')), /CapacitorPushNotifications/);
});

test('5 · a tap opens its screen; the router is mounted once in the root layout', () => {
  assert.match(code('app/layout.tsx'), /<NativePushRouter \/>/);
  const router = code('app/_components/native-push-router.tsx');
  assert.match(router, /onNativePushTap\(/);
  assert.match(router, /refreshNativePushToken\(\)/);
  assert.ok(!/requestPermissions|registerNativePush/.test(router), 'the router would prompt on launch — the ask on Guests does that');
  assert.match(code('lib/native-push.ts'), /url\.startsWith\('\/'\) && !url\.startsWith\('\/\/'\)/);
});
