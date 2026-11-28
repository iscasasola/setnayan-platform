/**
 * the-guest-taps-are-never-dead.test.ts — 👆 "OPEN IN SAFARI" AND "COPY MY LINK" EITHER WORK OR SAY SO.
 *
 * Owner walk 2026-11-27 (MASTER-PLAN L3, the blocker): on `/[slug]/invite/enter` and `/[slug]/welcome`, inside
 * Messenger / Facebook, "Open in Safari to …" fired 35 times and did nothing, and "Copy my link" did nothing.
 *   · Copy: the clipboard API is missing, refused — or its promise never settles — in those browsers. `copyText` now
 *     copies by selection first (inside the tap), asks the clipboard with a time limit, and NEVER hangs; a failure
 *     hands over the link in a field to select by hand (`LinkToCopyByHand`).
 *   · Safari: the app may ignore `x-safari-https://`. Every hop is a `SafariHop`, which watches the page and, still
 *     on screen after `SAFARI_HOP_WAIT_MS`, says so with the app's own way out and the link to copy.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { SAFARI_HOP_WAIT_MS, inAppHandoff, safariHopLink, safariHopStuck } from '@/lib/guest-landing';
import { COPY_WAIT_MS, LinkToCopyByHand, copyText } from './copy-my-link';

// tsconfig's classic JSX reads `React` from the global scope when a component renders.
(globalThis as unknown as { React: unknown }).React = React;

const LINK = 'https://www.setnayan.com/ana-miguel?invite=0123456789abcdef';
const IOS_MESSENGER =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/450.0;FBBV/1;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.4;FBSS/3;FBCR/;FBID/phone;FBLC/en_US;FBOP/5]';

/** A stand-in page: `execCommand('copy')` answers `selection`; the clipboard answers as told. */
function fakeBrowser(opts: { selection: boolean; clipboard: 'missing' | 'ok' | 'refused' | 'hangs' }) {
  const g = globalThis as Record<string, unknown>;
  const before = { document: g.document, navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator') };
  const field = { setAttribute() {}, style: {} as Record<string, string>, focus() {}, select() {}, setSelectionRange() {}, remove() {} };
  g.document = { execCommand: () => opts.selection, createElement: () => field, body: { appendChild() {} }, activeElement: null };
  const clipboard =
    opts.clipboard === 'missing'
      ? undefined
      : {
          writeText: () =>
            opts.clipboard === 'ok' ? Promise.resolve() : opts.clipboard === 'refused' ? Promise.reject(new Error('NotAllowed')) : new Promise<void>(() => {}),
        };
  Object.defineProperty(globalThis, 'navigator', { value: { clipboard }, configurable: true, writable: true });
  return () => {
    g.document = before.document;
    if (before.navigator) Object.defineProperty(globalThis, 'navigator', before.navigator);
  };
}

test('copy: a selection copy that works answers at once — the tap does its job', async () => {
  const restore = fakeBrowser({ selection: true, clipboard: 'hangs' });
  try {
    assert.equal(await copyText(LINK), true);
  } finally {
    restore();
  }
});

test('copy: a clipboard that NEVER answers is called failed within its limit — never a dead tap', async () => {
  const restore = fakeBrowser({ selection: false, clipboard: 'hangs' });
  try {
    const t0 = Date.now();
    assert.equal(await copyText(LINK), false);
    assert.ok(Date.now() - t0 < COPY_WAIT_MS + 500, 'the copy waited past its limit');
  } finally {
    restore();
  }
});

test('copy: refused or missing → false (the failure is said), working → true', async () => {
  for (const [clipboard, want] of [['missing', false], ['refused', false], ['ok', true]] as const) {
    const restore = fakeBrowser({ selection: false, clipboard });
    try {
      assert.equal(await copyText(LINK), want, `clipboard ${clipboard}`);
    } finally {
      restore();
    }
  }
});

test('copy: a failure hands over the link in a field to select by hand — in both copy buttons', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const html = renderToStaticMarkup(React.createElement(LinkToCopyByHand, { link: LINK }));
  assert.match(html, /<input[^>]*readOnly=""[^>]*value="https:\/\/www\.setnayan\.com\/ana-miguel\?invite=0123456789abcdef"/i);
  const src = readFileSync(join(__dirname, 'copy-my-link.tsx'), 'utf8');
  assert.equal(src.split('<LinkToCopyByHand link={link} />').length - 1, 2, '"Copy my link" and "Open in your browser" both hand the link over on a failure');
});

test('safari: the hop carries the guest’s own link, and only a page that never left the screen is stuck', () => {
  const ios = inAppHandoff(IOS_MESSENGER, LINK);
  assert.equal(ios.kind, 'ios', 'anti-vacuity: Messenger on an iPhone is not an in-app browser');
  assert.equal(safariHopLink((ios as { safariHref: string }).safariHref), LINK);
  assert.equal(safariHopStuck({ left: false, visible: true }), true);
  assert.equal(safariHopStuck({ left: true, visible: true }), false);
  assert.equal(safariHopStuck({ left: false, visible: false }), false);
  assert.ok(SAFARI_HOP_WAIT_MS >= 1000 && SAFARI_HOP_WAIT_MS <= 3000, 'the wait is long enough for Safari to open, short enough to answer a tap');
});

test('safari: EVERY hop on the guest pages is a SafariHop — no bare x-safari link that can sit there silently', () => {
  const root = join(__dirname, '..');
  for (const rel of ['_components/in-app-bar.tsx', '_components/ticket-popup.tsx', 'invite/enter/page.tsx']) {
    const src = readFileSync(join(root, rel), 'utf8');
    assert.match(src, /<SafariHop href=\{(?:handoff\.safariHref|safariHref|safariSave)\}/, `${rel}: the Safari hop is not a SafariHop`);
    assert.doesNotMatch(src, /<a href=\{(?:handoff\.safariHref|safariHref|safariSave)\}/, `${rel}: a bare Safari hop is back`);
  }
  const hop = readFileSync(join(__dirname, 'safari-hop.tsx'), 'utf8');
  assert.match(hop, /onClick=\{watch\}/, 'the hop no longer watches for a page that did not leave');
  assert.match(hop, /<CopyMyLink link=\{safariHopLink\(href\)\}/, 'a stuck hop no longer hands over the link');
});
