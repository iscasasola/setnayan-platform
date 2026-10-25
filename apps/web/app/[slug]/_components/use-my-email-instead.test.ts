/**
 * "USE MY EMAIL INSTEAD" — under the guest's Save button(s) (owner 2026-10-25,
 * "If you have recommendation that follow our design go for it").
 *
 * Rendered, not grepped: the offer is drawn for an iPhone (Apple) and an Android
 * (Google), and the quiet link must be there on both, open the SHIPPED email
 * sign-in (/login), and return to the SAME door the button does —
 * `/join/{eventId}/connect`. It is a text link, never a second button.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

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

async function render(userAgent: string) {
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
        termsCarried: true,
        whyInTip: true,
      } as never),
    );
  } finally {
    delete process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED;
    delete process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED;
  }
}

for (const [device, ua] of [['iPhone', IPHONE], ['Android', ANDROID]] as const) {
  test(`${device}: a quiet "Use my email instead" opens the email sign-in with the button's return`, async () => {
    const html = await render(ua);
    const link = /<a[^>]*data-save-email-instead=""[^>]*>Use my email instead<\/a>|<a[^>]*href="([^"]+)"[^>]*data-save-email-instead=""[^>]*>Use my email instead<\/a>/.exec(html);
    assert.ok(link, `${device}: the "Use my email instead" link is not drawn under the Save button`);
    const href = /href="([^"]+)"/.exec(link[0])?.[1]?.replace(/&amp;/g, '&');
    assert.equal(href, `/login?next=${encodeURIComponent('/join/e-1/connect')}`, 'it must return to the same seat-binding door');
    assert.doesNotMatch(link[0], /button-primary|button-secondary|border/, 'it must stay a quiet text link, not a second button');
  });
}
