/**
 * A LAPSED GUEST GETS BACK IN FROM THE SAVE (owner 2026-10-25, verbatim: "A button we can offer when they try to
 * save the digital pass." — and, on where: "After they have rsvped and opens the event hub.").
 *
 * A guest who already replied opens the Event Hub, goes to Me, presses "Save my ticket" — and their pass on this
 * phone has expired, been cleared, or been revoked. `/api/guest/pass-card` answers 401 (and only then: every
 * refusal after sign-in is a 404). Before: the button stayed, with "Open your invitation link first." under it —
 * a line, and a button that could do nothing about it. Now: ONE button, "Get back in", to the page's own door.
 *
 * Pinned by RUNNING the pieces, not by grepping them:
 *   1 · the save maps a 401 to `signedOut` — and a 404 / a network fault are still the old error line;
 *   2 · `signedOut` becomes a state carrying the way back in (this page's path, no query, no hash);
 *   3 · that state RENDERS the button — on the Event Hub's own ticket (`GuestTicket`'s keepers) too — with one
 *       short line and the detail in the ⓘ, and no error line;
 *   4 · the way back in is an existing door (the Event Hub's `GetInside`), not a new sign-in.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PASS_REENTRY_WORDS, passReentryHref, savePassCards } from '@/lib/save-pass-cards';
import { stripComments } from '@/lib/strip-comments';
import { PASS_CARD_ROUTE, PASS_CARD_WORDS } from '@/lib/pass-card';

(globalThis as unknown as { React: unknown }).React = React;

async function withFetch<T>(answer: () => Promise<Response>, fn: () => Promise<T>): Promise<T> {
  const saved = globalThis.fetch;
  globalThis.fetch = (async () => answer()) as typeof fetch;
  try {
    return await fn();
  } finally {
    globalThis.fetch = saved;
  }
}

test('1 · a 401 from the ticket route is a lapsed sign-in — not an error line', async () => {
  const r = await withFetch(async () => new Response('Open your invitation link first.', { status: 401 }), () => savePassCards([PASS_CARD_ROUTE]));
  assert.deepEqual(r, { k: 'signedOut' });
  // Every other refusal keeps its words, unchanged.
  const refused = await withFetch(async () => new Response('Not available.', { status: 404 }), () => savePassCards([PASS_CARD_ROUTE]));
  assert.deepEqual(refused, { k: 'failed', message: 'Not available.' });
  const offline = await withFetch(async () => Promise.reject(new Error('offline')), () => savePassCards([PASS_CARD_ROUTE]));
  assert.equal(offline.k, 'failed');
});

test('2 · the state carries the way back in: this page, fresh — the path only', async () => {
  const { nextSavePassState } = await import('./save-pass-card-button');
  assert.deepEqual(nextSavePassState({ k: 'signedOut' }, { pathname: '/cale-ice' }), { k: 'signedOut', href: '/cale-ice' });
  assert.equal(passReentryHref({ pathname: '/cale-ice/invite/enter' }), '/cale-ice/invite/enter');
  assert.equal(passReentryHref({ pathname: '' }), '/');
  assert.deepEqual(nextSavePassState({ k: 'failed', message: 'x' }, { pathname: '/a' }), { k: 'error', message: 'x' });
});

test('3 · signed out, the Save renders ONE "Get back in" button, one short line, the detail in the ⓘ — no error line', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SavePassCardFace } = await import('./save-pass-card-button');
  for (const variant of ['primary', 'button'] as const) {
    const html = renderToStaticMarkup(
      React.createElement(SavePassCardFace, {
        state: { k: 'signedOut', href: '/cale-ice' },
        label: PASS_CARD_WORDS.saveOwn,
        count: 1,
        variant,
      }),
    );
    assert.match(html, /<a href="\/cale-ice" data-guest-reentry=""/, `${variant}: no way back in`);
    assert.ok(html.includes(PASS_REENTRY_WORDS.button), `${variant}: the button has no words`);
    assert.ok(html.includes(PASS_REENTRY_WORDS.line), `${variant}: the one short line is missing`);
    assert.equal((html.match(/data-guest-reentry=""/g) ?? []).length, 1, `${variant}: more than one door`);
    assert.doesNotMatch(html, /role="alert"/, `${variant}: a lapsed sign-in still renders as an error`);
    assert.doesNotMatch(html, /data-save-pass-card=/, `${variant}: the dead Save is still drawn`);
    assert.doesNotMatch(html, /celebration/i);
  }
  // Idle, it is the same Save as before.
  const idle = renderToStaticMarkup(
    React.createElement(SavePassCardFace, { state: { k: 'idle' }, label: PASS_CARD_WORDS.saveOwn, count: 1 }),
  );
  assert.ok(idle.includes(PASS_CARD_WORDS.saveOwn) && idle.includes('data-save-pass-card="1"'));
  assert.doesNotMatch(idle, /data-guest-reentry/);
});

test('3b · the Event Hub’s ticket (Me) saves through this component — so it carries the way back in', () => {
  const read = (p: string) => stripComments(readFileSync(join(__dirname, '..', p), 'utf8'));
  const ticket = read('[slug]/_components/guest-ticket.tsx');
  assert.match(ticket, /<GuestCodeKeepers[^>]*passCardHref=\{src\}/, 'Me’s ticket no longer hands its card to the keepers');
  const keepers = read('[slug]/_components/guest-code-keepers.tsx');
  assert.match(keepers, /<SavePassCardButton hrefs=\{\[passCardHref\]\}/, 'the keepers save the ticket another way');
  const button = read('_components/save-pass-card-button.tsx');
  assert.match(button, /done\(await savePassCards\(hrefs\)\)/);
  assert.match(button, /nextSavePassState\(r, window\.location\)/, 'the save answer is not turned into the door');
});

test('4 · the door it opens is the Event Hub’s own — no new sign-in method', () => {
  const read = (p: string) => stripComments(readFileSync(join(__dirname, '..', p), 'utf8'));
  const door = read('[slug]/_components/get-inside.tsx');
  assert.match(door, /Upload your QR · Sign in/, 'the Event Hub’s signed-out door moved — re-check where "Get back in" lands');
  const lib = stripComments(readFileSync(join(__dirname, '..', '..', 'lib', 'save-pass-cards.ts'), 'utf8'));
  assert.doesNotMatch(lib, /\/login|signInWith|mintReentryCode|reentryRedeemPath/, 'the save invented its own way in');
});
