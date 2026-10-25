/**
 * 🍏🤖 "SAVE TO MY ACCOUNT" SHOWS BOTH PROVIDERS (owner 2026-10-25 — asked "Do you want to keep it that way, or show
 * both Apple and Google buttons to everyone? Showing both would reverse that rule.", answered verbatim: "Show both").
 *
 * This REVERSES the guest rule "one button at a time, we pick the method, never the guest" FOR THIS OFFER ONLY.
 *
 * Rendered, not grepped — the offer is drawn for an iPhone and an Android with each provider combination:
 *   1. BOTH ON  → two buttons, the device's own FIRST as the primary, the other under it as the house secondary,
 *                 the same size; "Use my email instead" stays under them.
 *   2. ONE ON   → just that one button, on every device.
 *   3. NONE ON  → no provider button; today's "Copy my link".
 *   4. THE SERVER opens the provider PRESSED while it is on — from any device — and REFUSES one that is off (no
 *      sign-in, never the other provider). The plus-one door's action reads a provider press as "keep".
 *
 * SABOTAGES (each run red, then restored — see the PR):
 *   · saveProvidersInOrder → `[method]` (one button again)                  → 1 RED
 *   · saveProvidersInOrder → `[other, method]` (the device's one second)     → 1 RED
 *   · save-to-account.tsx: the second button `button-primary`               → 1 RED
 *   · saveMethodFromForm → `providers[posted] ? posted : saveMethodFor(...)` → 4 RED
 *   · save-to-account.tsx: drop `{emailInstead}`                            → 1 RED
 *   · save-to-account.tsx: `<CopyMyLink …/>` → `null`                       → 3 RED
 *   · welcome/actions.ts: drop the provider-press → "keep" fallback          → 4 RED
 *   · globals.css + CANDLELIGHT_WORD_TOKENS: drop Candlelight's `--color-link` → 6 RED
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { SAVE_METHOD_FIELD, pressedSaveMethod, saveMethodFromForm } from '@/lib/guest-one-path';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36';

type Providers = { apple: boolean; google: boolean };

async function render(userAgent: string, providers: Providers, through = false): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SaveToAccount } = await import('./save-to-account');
  if (providers.apple) process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED = 'true';
  if (providers.google) process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED = 'true';
  try {
    return renderToStaticMarkup(
      React.createElement(SaveToAccount as never, {
        state: { kind: 'offer' },
        eventId: 'e-1',
        slug: 'ic',
        personalLink: 'https://www.setnayan.com/ic?invite=0123456789abcdef0123456789abcdef',
        userAgent,
        termsCarried: true,
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

/** Each provider press drawn, in order: what it posts, what its words say, its class, and where it sits. */
function presses(html: string) {
  return [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
    .filter(([b]) => b.includes(`name="${SAVE_METHOD_FIELD}"`))
    .map((m) => {
      const b = m[0];
      const open = /<button\b[^>]*>/.exec(b)![0];
      return {
        posts: /\svalue="([a-z]+)"/.exec(open)?.[1] ?? null,
        says: /with (Apple|Google) · nothing to type/.exec(b)?.[1]?.toLowerCase() ?? null,
        cls: /\sclass="([^"]*)"/.exec(open)?.[1] ?? '',
        at: m.index ?? 0,
      };
    });
}

const BOTH = { apple: true, google: true };

for (const [device, ua, own, other] of [
  ['iPhone', IPHONE, 'apple', 'google'],
  ['Android', ANDROID, 'google', 'apple'],
] as const) {
  for (const through of [false, true]) {
    const where = through ? 'the plus-one door' : 'the landing';
    test(`1 · ${device}, ${where}: BOTH on → both buttons, ${own} first as the primary, ${other} under it as the secondary, same size`, async () => {
      const html = await render(ua, BOTH, through);
      const p = presses(html);
      assert.deepEqual(p.map((x) => x.posts), [own, other], `${device}: the device's own provider is not first, or one is missing`);
      for (const x of p) assert.equal(x.says, x.posts, `${device}: a button says "${x.says}" but posts "${x.posts}"`);
      assert.match(p[0]!.cls, /\bbutton-primary\b/, 'the device’s own button is not the primary');
      assert.match(p[1]!.cls, /\bbutton-secondary\b/, 'the second button is not the quieter house secondary');
      assert.doesNotMatch(p[1]!.cls, /\bbutton-primary\b/, 'two terracotta primaries on one screen');
      for (const x of p) {
        assert.match(x.cls, /\bmin-h-\[56px\]/, 'a provider button is smaller than 56 px');
        assert.match(x.cls, /\bw-full\b/, 'the two buttons are not the same width');
      }
      if (!through) {
        // "Use my email instead" stays — under BOTH buttons, still a quiet link.
        const email = html.indexOf('data-save-email-instead=""');
        assert.ok(email > 0, `${device}: "Use my email instead" is gone`);
        assert.ok(email > p[1]!.at, `${device}: "Use my email instead" is not under the two buttons`);
      }
    });
  }

  test(`2 · ${device}: ONE provider on → just that one button`, async () => {
    for (const only of ['apple', 'google'] as const) {
      const html = await render(ua, { apple: only === 'apple', google: only === 'google' });
      assert.deepEqual(presses(html).map((x) => x.posts), [only], `${device}, only ${only} on`);
      assert.match(presses(html)[0]!.cls, /\bbutton-primary\b/);
      assert.ok(html.includes('data-save-email-instead=""'), `${device}, only ${only} on: "Use my email instead" is gone`);
    }
  });

  test(`3 · ${device}: NONE on → no provider button, today's "Copy my link"`, async () => {
    const html = await render(ua, { apple: false, google: false });
    assert.equal(presses(html).length, 0, `${device}: a provider button with no provider switched on`);
    assert.ok(html.includes('data-copy-my-link=""') && html.includes('Copy my link'), `${device}: "Copy my link" is gone`);
  });
}

test('4 · the server opens the provider PRESSED while it is on — from any device — and refuses one that is off', () => {
  for (const ua of [IPHONE, ANDROID]) {
    assert.equal(saveMethodFromForm('apple', ua, BOTH), 'apple', `${ua}: an Apple press opened something else`);
    assert.equal(saveMethodFromForm('google', ua, BOTH), 'google', `${ua}: a Google press opened something else`);
    // Pressed, but switched off → refused: no sign-in (the action sends the guest back), never the other provider.
    assert.equal(saveMethodFromForm('apple', ua, { apple: false, google: true }), 'link', `${ua}: a switched-off Apple was opened or swapped`);
    assert.equal(saveMethodFromForm('google', ua, { apple: true, google: false }), 'link', `${ua}: a switched-off Google was opened or swapped`);
  }
  // Both actions send a refused press back without signing in.
  const read = (...p: string[]) => stripComments(readFileSync(join(process.cwd(), ...p), 'utf8'));
  assert.match(read('app', '[slug]', 'actions.ts'), /if \(!saveMethodSignsIn\(method\)\) return redirect\(back\);/);
  const welcome = read('app', '[slug]', 'welcome', 'actions.ts');
  assert.match(welcome, /if \(method === 'apple' \|\| method === 'google'\) \{/);
  // The plus-one door's provider press posts its provider, not `then=keep` — the action must read it as "keep".
  assert.match(
    welcome,
    /String\(formData\.get\('then'\) \?\? ''\) \|\| \(pressedProvider === 'apple' \|\| pressedProvider === 'google' \? 'keep' : ''\)/,
    'a provider press on the plus-one door is not read as "Save to my account"',
  );
});

test('5 · the pressed button is read from the pending submission (its own label, the stall line)', () => {
  const fd = (v?: string) => {
    const f = new FormData();
    if (v !== undefined) f.set(SAVE_METHOD_FIELD, v);
    return f;
  };
  assert.equal(pressedSaveMethod(fd('apple')), 'apple');
  assert.equal(pressedSaveMethod(fd('google')), 'google');
  assert.equal(pressedSaveMethod(fd('facebook')), null);
  assert.equal(pressedSaveMethod(fd()), null);
  assert.equal(pressedSaveMethod(null), null);
});

test('6 · the second (house secondary) button reads on a dark look — Candlelight gives `text-link` a measured ink', async () => {
  const { CANDLELIGHT_WORD_TOKENS, contrastOf, pageWordBase } = await import('@/app/[slug]/_lib/pro-site-vars');
  const paper = CANDLELIGHT_WORD_TOKENS['--color-cream']!;
  const link = pageWordBase('house', null, 'candlelight')['--color-link']!;
  assert.ok(contrastOf(link, paper) >= 4.5, `the secondary's label reads ${contrastOf(link, paper).toFixed(2)}:1 on Candlelight`);
});
