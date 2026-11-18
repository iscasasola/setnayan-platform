/**
 * the-reset-page-says-it-sent.test.ts — ✉ after a reset link is sent, the page SAYS so (walker W1-B6, 16 Nov 2026).
 *
 * The walker's finding: after "Email me a reset link" the page kept the same empty form and the same button. Held:
 *   1 · on `?sent=1` the request form gives way to the sent state — the empty form is not drawn again;
 *   2 · the sent state says "Sent to …", "Open your email" and "Send again in 60s", and the resend button is OFF
 *       until the 60 s have passed;
 *   3 · the address is kept in this tab only, never put in the address bar, and the neutral "if an account exists"
 *       line stays (anti-enumeration);
 *   4 · Send again posts the same action with the same bot check (so its limit and its answer are the form's own).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { stripComments } from '@/lib/strip-comments';
import { RESEND_AFTER_SECONDS, inboxFor, resendLabel } from '@/lib/reset-sent';

// tsx compiles the components' JSX to `React.createElement` (the classic runtime) — the shape the render tests use.
(globalThis as unknown as { React: unknown }).React = React;

const code = (p: string) => stripComments(readFileSync(join(process.cwd(), p), 'utf8'));

test('1 · on ?sent=1 the empty request form is not drawn again', () => {
  const page = code('app/forgot-password/page.tsx');
  assert.match(page, /\{sent \? \(\s*<ResetSent requestPasswordReset=\{requestPasswordReset\} \/>\s*\) : \(\s*<form action=\{requestPasswordReset\}/, 'the sent page still draws the empty form');
  assert.match(page, /title=\{sent \? 'Check your email' : 'Forgot your password\?'\}/);
  // The form keeps the address it sends, for the sent state to name.
  assert.match(page, /<form action=\{requestPasswordReset\} className="space-y-4">\s*<RememberResetEmail \/>/);
});

test('2 · the sent state: where it went, where to look, and a 60 s wait before Send again', async () => {
  assert.equal(RESEND_AFTER_SECONDS, 60);
  assert.equal(resendLabel(60), 'Send again in 60s');
  assert.equal(resendLabel(1), 'Send again in 1s');
  assert.equal(resendLabel(0), 'Send again');
  assert.equal(inboxFor('Ana@Gmail.com'), 'https://mail.google.com/mail/u/0/#inbox');
  assert.equal(inboxFor('ana@our-own-domain.ph'), null, 'an unknown domain is guessed at');

  const { ResetSent } = await import('@/app/forgot-password/_components/reset-sent');
  const html = renderToStaticMarkup(React.createElement(ResetSent, { requestPasswordReset: async () => {} }));
  assert.match(html, /Sent to your email/, 'the sent state does not say where it went');
  assert.match(html, /Open your email/);
  assert.match(html, /Send again in 60s/);
  const resend = /<button[^>]*>(?:(?!<\/button>)[\s\S])*Send again in 60s/.exec(html)?.[0] ?? '';
  assert.match(resend, /\sdisabled(?:=""|\s|>)/, 'Send again can be pressed before the 60 s have passed');
  assert.doesNotMatch(html, /type="email"/, 'the sent state draws the empty email field again');
});

test('3 · the address stays in this tab; the neutral line stays', () => {
  const page = code('app/forgot-password/page.tsx');
  const actions = code('app/forgot-password/actions.ts');
  assert.match(actions, /redirect\('\/forgot-password\?sent=1'\)/, 'the address went into the URL');
  assert.doesNotMatch(actions + page, /sent=1&|[?&](?:to|email)=/, 'the address is put in the address bar');
  const sent = code('app/forgot-password/_components/reset-sent.tsx');
  assert.match(sent, /If an account exists for that email, a reset link is on its way\./, 'the neutral line is gone — an enumeration risk');
  assert.match(code('lib/reset-sent.ts'), /window\.sessionStorage\.setItem\(KEY, v\)/);
});

test('4 · Send again is the same action with the same bot check', () => {
  const sent = code('app/forgot-password/_components/reset-sent.tsx');
  assert.match(
    sent,
    /<form action=\{requestPasswordReset\}[\s\S]{0,120}?>\s*<input type="hidden" name="email" value=\{email\} \/>\s*<TurnstileField action="password_reset" \/>/,
    'Send again posts without the bot check',
  );
  assert.match(sent, /disabled=\{left > 0\}/);
});
