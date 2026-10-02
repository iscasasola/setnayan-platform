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

/** The provider the button's words name, and the pick its form carries. */
function readBack(html: string): { said: string | null; carried: string | null } {
  const said = /with (Apple|Google) · nothing to type/.exec(html)?.[1]?.toLowerCase() ?? null;
  const carried =
    new RegExp(`<input type="hidden" name="${SAVE_METHOD_FIELD}" value="([a-z]+)"`).exec(html)?.[1] ?? null;
  return { said, carried };
}

for (const through of [false, true]) {
  const where = through ? 'the plus-one door (through-mode)' : 'the landing';
  test(`on ${where}, the provider the button NAMES is the one the press opens — on every device`, async () => {
    for (const [device, ua, other] of [
      ['iPhone', IPHONE, ANDROID],
      ['Android', ANDROID, IPHONE],
      ['Mac', MAC, IPHONE],
    ] as const) {
      const { said, carried } = readBack(await renderButton(ua, through));
      assert.ok(said, `${device}: the button names no provider`);
      assert.equal(carried, said, `${device}: the button says "${said}" but its form carries "${carried}"`);
      // The action, asked from a request that does NOT look like the page's.
      assert.equal(
        saveMethodFromForm(carried, other, BOTH),
        said,
        `${device}: the button says ${said}, the press opens ${saveMethodFromForm(carried, other, BOTH)}`,
      );
    }
  });
}

test('a pick that cannot be honoured falls back to the device rule — never an error, never a third door', () => {
  assert.equal(saveMethodFromForm(undefined, IPHONE, BOTH), 'apple');
  assert.equal(saveMethodFromForm('facebook', ANDROID, BOTH), 'google', 'a tampered value is not a provider');
  assert.equal(saveMethodFromForm('apple', ANDROID, { apple: false, google: true }), 'google', 'a provider switched off is not opened');
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
