/**
 * "SAVE TO MY ACCOUNT" OPENS THE PROVIDER ITS BUTTON NAMES (owner's live
 * iPhone test, 2026-10-02: Guest A's button read "with Apple" and the tap went
 * straight to Google sign-in; another guest's read "with Google").
 *
 * The page picked the method from the PAGE request's user-agent; the action
 * picked it AGAIN from the POST's. Two requests, asked the same question
 * separately, only agree when they look alike. Now the button's pick rides the
 * form (`SAVE_METHOD_FIELD`) and the action takes it (`saveMethodFromForm`).
 *
 * Rendered, not grepped: the button is drawn for each device, its label and its
 * hidden pick are read back out of the HTML, and the action's decision is
 * asked with the pick AND a DIFFERENT user-agent — the exact split that sent an
 * "Apple" tap to Google.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { SAVE_METHOD_FIELD, saveMethodFromForm } from '@/lib/guest-one-path';

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

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
const BOTH = { apple: true, google: true };

async function renderButton(userAgent: string, through: boolean) {
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

/**
 * Every provider button drawn: the provider its WORDS name, and the pick its PRESS posts. Since 2026-10-25 ("Show
 * both") the press carries its own provider — the button's `name`/`value` (`SAVE_METHOD_FIELD`), not a hidden field.
 */
function readBack(html: string): Array<{ said: string | null; carried: string | null }> {
  return [...html.matchAll(/<button\b[^>]*data-save-provider="[a-z]+"[^>]*>[\s\S]*?<\/button>/g)].map(([b]) => ({
    said: /with (Apple|Google) · nothing to type/.exec(b)?.[1]?.toLowerCase() ?? null,
    carried: b.includes(`name="${SAVE_METHOD_FIELD}"`) ? (/\svalue="([a-z]+)"/.exec(b)?.[1] ?? null) : null,
  }));
}

for (const through of [false, true]) {
  const where = through ? 'the plus-one door (through-mode)' : 'the landing';
  test(`on ${where}, the provider the button NAMES is the one the press opens — on every device`, async () => {
    for (const [device, ua, other] of [
      ['iPhone', IPHONE, ANDROID],
      ['Android', ANDROID, IPHONE],
      ['Mac', MAC, IPHONE],
    ] as const) {
      const buttons = readBack(await renderButton(ua, through));
      assert.equal(buttons.length, 2, `${device}: both providers are on, so both buttons draw`);
      for (const { said, carried } of buttons) {
        assert.ok(said, `${device}: a button names no provider`);
        assert.equal(carried, said, `${device}: the button says "${said}" but its press carries "${carried}"`);
        // The action, asked from a request that does NOT look like the page's.
        assert.equal(
          saveMethodFromForm(carried, other, BOTH),
          said,
          `${device}: the button says ${said}, the press opens ${saveMethodFromForm(carried, other, BOTH)}`,
        );
      }
    }
  });
}

test('a field that names no provider falls back to the device rule; a provider switched OFF is refused, never swapped', () => {
  assert.equal(saveMethodFromForm(undefined, IPHONE, BOTH), 'apple');
  assert.equal(saveMethodFromForm('facebook', ANDROID, BOTH), 'google', 'a tampered value is not a provider');
  // 🍏🤖 2026-10-25 ("Show both"): the guest PRESSED Apple; Apple is off → no sign-in at all (`link`, the action sends
  // them back), never the Google they did not press.
  assert.equal(saveMethodFromForm('apple', ANDROID, { apple: false, google: true }), 'link', 'a provider switched off is opened, or swapped for the other');
  assert.equal(saveMethodFromForm('google', IPHONE, { apple: true, google: false }), 'link', 'a provider switched off is opened, or swapped for the other');
});

test('both actions take the button\'s pick — neither re-guesses the device from the POST', () => {
  for (const file of [['app', '[slug]', 'actions.ts'], ['app', '[slug]', 'welcome', 'actions.ts']]) {
    const src = read(...file);
    assert.match(
      src,
      /const method = saveMethodFromForm\(formData\.get\(SAVE_METHOD_FIELD\), \(await headers\(\)\)\.get\('user-agent'\), \{/,
      `${file.join('/')} does not take the button's pick`,
    );
    assert.doesNotMatch(src, /saveMethodFor\(/, `${file.join('/')} re-decides the method from the POST`);
  }
});

// ═══ the way back when the provider does not open (owner 2026-10-02: Google
//     sign-in "hung on loading", Guest A never linked) ══════════════════════

test('a stalled sign-in is never a dead screen: no veil over it, and "Didn\'t open? Try again" inside the Save form', async () => {
  const SAVE = read('app', '[slug]', '_components', 'save-to-account.tsx');
  // The press leaves for another site — the app-wide veil would never come down.
  assert.match(
    SAVE,
    /pendingLabel=\{m === 'apple' \? 'Opening Apple…' : 'Opening Google…'\}\s*overlay=\{false\}/,
    'the provider press raises the full-screen veil again',
  );
  // The stall line rides INSIDE each form that posts the press (it reads that form's status).
  assert.match(SAVE, /\{button\}\s*\{stall\}\s*<\/>/, 'the plus-one door has no way back');
  assert.match(SAVE, /\{button\}\s*\{stall\}\s*<\/form>/, 'the thank-you has no way back');
  assert.match(SAVE, /const stall = signsIn \? <ProviderStall provider=\{method === 'apple' \? 'Apple' : 'Google'\} \/> : null;/);
  // 🍏🤖 Two buttons share the form (2026-10-25): the stall names the provider PRESSED, not the device's.
  assert.match(read('app', '[slug]', '_components', 'provider-stall.tsx'), /pressedSaveMethod\(data\)/, 'the stall names the device’s provider, not the pressed one');
  const { PROVIDER_STALL_MS, stallLine } = await import('./provider-stall');
  assert.ok(PROVIDER_STALL_MS > 0 && PROVIDER_STALL_MS <= 10_000, 'a guest waits too long before being offered a way back');
  assert.equal(stallLine('Google'), 'Google didn’t open?');
  // A page restored from the back-forward cache reloads live instead of spinning.
  const STALL = read('app', '[slug]', '_components', 'provider-stall.tsx');
  assert.match(STALL, /if \(e\.persisted\) window\.location\.reload\(\);/, 'backing out of Google leaves a frozen "Opening Google…"');
  assert.match(STALL, />\s*Try again\s*</, 'the way back says nothing');
});
