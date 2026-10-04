/**
 * THE TICKET'S "SAVE TO MY ACCOUNT" SIGNS IN NATIVELY INSIDE THE PHONE APP
 * (2026-10-04, follow-up to the native Apple + Google sign-in).
 *
 * Before: inside the app the Save press was a Server Action redirecting to
 * Apple / Google, which left the app's web view for Safari — the account was
 * signed in THERE, and the app never saw it.
 *
 * What must stay true:
 *   1. IN THE APP (a build carrying `SetnayanSignIn/1`) the Save — on the
 *      landing and on the plus-one door — is drawn as the native form and asks
 *      the action for a hand-off; the provider is never opened in the web view.
 *   2. ON THE WEB, THE DESKTOP APP AND AN OLDER PHONE BUILD — unchanged: the
 *      plain `<form action>` with no native field.
 *   3. AFTER RETURN THE SAVE COMPLETES FOR THE SAME EVENT: the hand-off's
 *      `next` is the SAME `/join/{eventId}/connect` the web door returns to
 *      (one linking path, whose confirm page asks before any seat binds), and
 *      the native round trip carries it back into the web view intact.
 *   4. BOTH actions take the hand-off only AFTER the guest pass and the Terms
 *      tick, and BEFORE the web redirect.
 *
 * SABOTAGES (each run red, then restored — see the PR):
 *   · save-to-account.tsx: `const native = false`                → test 1 RED
 *   · native-account-save.ts: drop the `saveSignsInNatively` gate → test 3 RED
 *   · actions.ts: hand-off `next: '/dashboard'`                  → test 5 RED
 *   · native-save-form.tsx: skip `signIn` on a hand-off           → test 4 RED
 *   · Info.plist: CFBundleName back to $(PRODUCT_NAME)            → test 6 RED
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { NATIVE_SIGN_IN_UA_MARKER } from '@/lib/oauth-shell-gate';
import { NATIVE_SAVE_FIELD, isNativeSaveHandOff, nativeSaveHandOff } from '@/lib/native-account-save';
import { eventConnectPath } from '@/lib/signup-landing';
import { nativeCallbackPath, nativeRedirectTo } from '@/lib/native-oauth-plan';
import { appUrlToPath } from '@/lib/app-url-path';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const read = (...p: string[]) => stripComments(readFileSync(join(process.cwd(), ...p), 'utf8'));

const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
const DESKTOP_APP = 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 SetnayanApp/desktop';
const OLD_APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SetnayanApp';
const IOS_APP = `${OLD_APP} ${NATIVE_SIGN_IN_UA_MARKER}`;
const ANDROID_APP = `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36 SetnayanApp ${NATIVE_SIGN_IN_UA_MARKER}`;
const BOTH = { apple: true, google: true };

async function render(userAgent: string, through: boolean) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SaveToAccount } = await import('./save-to-account');
  process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED = 'true';
  process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED = 'true';
  try {
    return renderToStaticMarkup(
      React.createElement(SaveToAccount as never, {
        state: { kind: 'offer' },
        eventId: 'e-1',
        slug: 'ic',
        personalLink: 'https://www.setnayan.com/ic?invite=0123456789abcdef0123456789abcdef',
        userAgent,
        termsCarried: false,
        ...(through
          ? { through: { action: async () => {}, fields: React.createElement('input', { name: 'x' }), after: null } }
          : {}),
      } as never),
    );
  } finally {
    delete process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED;
    delete process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED;
  }
}

const nativeFieldIn = (html: string) =>
  new RegExp(`<input type="hidden" name="${NATIVE_SAVE_FIELD}" value="1"`).test(html);

for (const through of [false, true]) {
  const where = through ? 'the plus-one door' : 'the landing';

  test(`1 · on ${where}, IN THE APP the Save is the native form, asking for a hand-off`, async () => {
    for (const [device, ua] of [
      ['iOS app', IOS_APP],
      ['Android app', ANDROID_APP],
    ] as const) {
      const html = await render(ua, through);
      assert.ok(html.includes('data-native-save'), `${device}: the native Save form is drawn`);
      assert.ok(nativeFieldIn(html), `${device}: the form asks the action for the native hand-off`);
      assert.ok(html.includes('Save to my account'), `${device}: the same one button`);
      assert.equal((html.match(/<form/g) ?? []).length, 1, `${device}: one form, never a second door`);
    }
  });

  test(`2 · on ${where}, the web, the desktop app and an older phone build are UNCHANGED`, async () => {
    for (const [device, ua] of [
      ['iPhone Safari', SAFARI],
      ['Android Chrome', ANDROID],
      ['Mac', MAC],
      ['desktop app', DESKTOP_APP],
      ['older phone build', OLD_APP],
    ] as const) {
      const html = await render(ua, through);
      assert.ok(!html.includes('data-native-save'), `${device}: no native form`);
      assert.ok(!nativeFieldIn(html), `${device}: no native field — the action redirects as before`);
    }
  });
}

test('3 · the action hands back ONLY when the form asked AND this request is the app with the plugin', () => {
  const next = eventConnectPath('e-1');
  const ask = (posted: unknown, userAgent: string, method = 'apple', providers = BOTH) =>
    nativeSaveHandOff({ posted, userAgent, providers, method, next });
  assert.deepEqual(ask('1', IOS_APP), { native: 'apple', next });
  assert.deepEqual(ask('1', ANDROID_APP, 'google'), { native: 'google', next });
  // The web, the desktop app and an older build: the redirect, exactly as before.
  for (const ua of [SAFARI, ANDROID, MAC, DESKTOP_APP, OLD_APP]) assert.equal(ask('1', ua), null, ua);
  // A plain web form never asked.
  assert.equal(ask(null, IOS_APP), null);
  // No provider to sign in with (a copied link) — nothing to hand back.
  assert.equal(ask('1', IOS_APP, 'link'), null);
  // Apple switched off → no native door (guideline 4.8, the same rule as /login).
  assert.equal(ask('1', IOS_APP, 'google', { apple: false, google: true }), null);
});

test('4 · the native form runs the native sign-in with the hand-off — and nothing else', async () => {
  const { submitNativeSave } = await import('./native-save-form');
  const calls: Array<[string, string]> = [];
  const signIn = async (p: 'apple' | 'google', n: string) => {
    calls.push([p, n]);
    return true;
  };
  const posted: FormData[] = [];
  const fd = new FormData();
  fd.set(NATIVE_SAVE_FIELD, '1');
  await submitNativeSave(
    async (f) => {
      posted.push(f);
      return { native: 'apple', next: '/join/e-1/connect' };
    },
    fd,
    signIn,
  );
  assert.equal(posted[0], fd, 'the SAME form data reaches the SAME action');
  assert.deepEqual(calls, [['apple', '/join/e-1/connect']]);
  // A redirect the action already made (Terms not ticked, "Not now") → no sign-in.
  await submitNativeSave(async () => undefined, new FormData(), signIn);
  assert.equal(calls.length, 1);
  // Never an off-site `next`.
  assert.equal(isNativeSaveHandOff({ native: 'apple', next: '//evil.example' }), false);
  assert.equal(isNativeSaveHandOff({ native: 'apple', next: 'https://evil.example' }), false);

  // 🔒 The provider page never opens in the web view from this file.
  const src = read('app', '[slug]', '_components', 'native-save-form.tsx');
  assert.ok(src.includes('signInWithProviderNative'));
  assert.doesNotMatch(src, /location\.(assign|href|replace)|window\.open|signInWithOAuth/);
});

test('5 · after return the save completes for the SAME event: one `next`, carried round the native trip', () => {
  for (const [file, eventExpr] of [
    [['app', '[slug]', 'actions.ts'], 'eventConnectPath(eventId)'],
    [['app', '[slug]', 'welcome', 'actions.ts'], 'eventConnectPath(event.event_id as string)'],
  ] as const) {
    const src = read(...file);
    const handOff = src.indexOf('nativeSaveHandOff({');
    const web = src.indexOf('signInWithApple(next)');
    const terms = src.indexOf('RSVP_TERMS_COOKIE, TERMS_VERSION');
    assert.ok(handOff > 0 && web > handOff, `${file.join('/')}: the hand-off comes before the web redirect`);
    assert.ok(terms > 0 && terms < handOff, `${file.join('/')}: the Terms tick is kept before the hand-off`);
    const block = src.slice(handOff, web);
    assert.ok(block.includes(`next: ${eventExpr}`), `${file.join('/')}: the hand-off's next is the web door's next`);
    assert.ok(block.includes(`next.set('next', ${eventExpr})`), `${file.join('/')}: the web door's next, unchanged`);
  }
  // The native round trip: setnayan://auth/callback?next=… → /auth/callback?…next=/join/e-1/connect.
  const next = eventConnectPath('e-1');
  const returned = `${nativeRedirectTo(next)}&code=abc`;
  const path = nativeCallbackPath(returned) ?? '';
  assert.ok(path.startsWith('/auth/callback'), path);
  assert.equal(new URL(path, 'https://x').searchParams.get('next'), next);
  assert.equal(appUrlToPath(returned), path);
});

test('6 · the app is named Setnayan wherever the phone shows it — the bundle id unchanged', () => {
  const root = join(process.cwd(), '..', 'mobile');
  const plist = readFileSync(join(root, 'ios', 'App', 'App', 'Info.plist'), 'utf8');
  const key = (k: string) => new RegExp(`<key>${k}</key>\\s*<string>([^<]*)</string>`).exec(plist)?.[1];
  // CFBundleName is what the sign-in prompt reads ("“App” Wants to Use …") —
  // measured in the simulator; it was $(PRODUCT_NAME) = App.
  assert.equal(key('CFBundleName'), 'Setnayan');
  assert.equal(key('CFBundleDisplayName'), 'Setnayan');
  const pbx = readFileSync(join(root, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj'), 'utf8');
  const ids = pbx.match(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g) ?? [];
  assert.ok(ids.length >= 2 && ids.every((l) => l.includes('com.setnayan.app')), 'bundle id stays com.setnayan.app');
  const strings = readFileSync(join(root, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml'), 'utf8');
  assert.match(strings, /<string name="app_name">Setnayan<\/string>/);
  assert.match(strings, /<string name="title_activity_main">Setnayan<\/string>/);
});
