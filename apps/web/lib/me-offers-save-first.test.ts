/**
 * me-offers-save-first.test.ts — ME'S ONE SAVE OFFER, "KEEP THIS INVITATION" (owner 2026-10-24: *"on the me part, we
 * start offering the linking of this event to their account"*; 2026-10-25: *"there is no Save my account on me"* ·
 * *"create a proper widget to link this event to your account"* · *"there is already a save to my account"* · *"but we
 * are supposed to have that with the save to wallet, correct?"*).
 *
 * Held:
 *   (1) the block is option A on the shipped Save: the owner's title as the ONE heading (the offer is `headless`, so no
 *       "Save to my account" / "Keep your ticket on every phone" stacks over it), one line, the ⓘ, the little ticket,
 *       the official buttons, the affirmative Terms tick when not carried;
 *   (2) once saved, ONE line — "✓ Saved to your account" — nothing to press;
 *   (3) a host viewing as a guest sees a LABELLED PREVIEW ("What your guests see") — never a live press: no form, no
 *       link, no provider button, nothing posting a save;
 *   (4) ONE OFFER PER PAGE: `GuestMe` draws none (plain, and the page hands it no account); `MeKeepInvitation` is
 *       mounted once (`keepNode`) and placed in ONE of two places that exclude each other;
 *   (5) WHERE: with a ticket, directly under the ticket's Save · Add to Apple Wallet (`GuestTicket keep`);
 *       without one, under the greeting (`meSave`), before the rest of Me;
 *   (6) an unlinked guest ALWAYS gets the widget — one test per state, in a browser, inside Messenger, with no
 *       provider switched on, with no personal link.
 *
 * Sabotages seen red (each restored — see the PR): `MeKeepInvitation` returning null for `host_viewing` ((3) red) ·
 * the offer drawn without `headless` ((1) red) · `keep` dropped from `GuestTicket` ((5) red) · `meSave` given
 * `keepNode` unconditionally ((4) red) · the in-app branch's "Sign in with email" dropped ((6) red).
 */
/* FIRST: this import installs the seam the real page is drawn through (`site-body-fixture-render.ts`). */
import { renderSiteBodyFixture } from './site-body-fixture-render';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

/* The providers as production has them (the Save signs in with Google here) — read at render, not at import. */
process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED = 'true';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const BASE = { eventId: 'e-1', slug: 'ana', personalLink: 'https://x/ana?invite=t0', userAgent: null, termsCarried: false };

async function keep(state: Record<string, unknown>, extra: Record<string, unknown> = {}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MeKeepInvitation } = await import('../app/[slug]/_components/me-keep-invitation');
  return renderToStaticMarkup(React.createElement(MeKeepInvitation, { ...BASE, ...extra, state } as never));
}

test('(1) an unlinked guest: the owner’s title as the ONE heading, one line, the ⓘ, the official buttons, the Terms tick', async () => {
  const { ME_KEEP_TITLE, ME_KEEP_LINE, ME_KEEP_TIP } = await import('../app/[slug]/_components/me-keep-invitation');
  const html = await keep({ kind: 'offer' });
  assert.match(html, /data-me-save="offer"/);
  assert.ok(html.includes(ME_KEEP_TITLE), 'no title');
  assert.ok(html.includes(ME_KEEP_LINE), 'no short line');
  assert.equal((html.match(/<h[1-6]\b/g) ?? []).length, 1, 'Me’s block draws more than ONE heading');
  assert.equal((html.match(/data-save-heading=""/g) ?? []).length, 1, 'a second head is stacked over the buttons');
  assert.doesNotMatch(html, /Save to my account|Keep your ticket on every phone|Nothing to type/, 'the offer’s own heading is back on Me');
  assert.match(html, /data-keep-art=""/, 'the little ticket is not beside the title');
  assert.match(html, /data-save-provider="google"[^>]*data-save-filled=""|data-save-filled=""[^>]*data-save-provider="google"/, 'the provider button is not drawn filled');
  assert.match(html, /type="checkbox"/, 'the Terms tick is not drawn');
  assert.doesNotMatch(html, /type="checkbox"[^>]*checked/, 'the Terms tick is pre-ticked');
  assert.doesNotMatch(html, /By continuing/i, 'a browsewrap line');
  assert.match(html, /aria-label="About keeping this invitation"/, 'no ⓘ');
  assert.doesNotMatch(html, /Keeps the photos of you, and opens this invitation on any phone\.<\/p>/, 'the reason is said again under the button — details go in the ⓘ');
  assert.ok(ME_KEEP_TIP.length > 0);
});

test('(2) once saved: one line, "✓ Saved to your account" — nothing to press', async () => {
  const html = await keep({ kind: 'linked', accountEmail: 'ana@example.com' });
  assert.match(html, /^<p data-me-save="linked"[^>]*>[\s\S]*✓[\s\S]*Saved to your account<\/p>$/);
  assert.doesNotMatch(html, /<button|<form|<a /, 'a saved invitation still offers a press');
});

test('(3) a host viewing as a guest: the labelled preview "What your guests see" — never a live press', async () => {
  for (const userAgent of [null, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1']) {
    process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED = 'true';
    try {
      const html = await keep({ kind: 'host_viewing', seatName: 'Indalecia' }, { userAgent });
      assert.match(html, /data-me-save="host_preview"/, 'the host sees nothing — he cannot check what guests see');
      assert.match(html, /What your guests see/, 'the preview is not labelled');
      assert.match(html, /data-save-preview-provider="/, 'the preview does not show the buttons');
      assert.doesNotMatch(html, /<form|<a\b|name="save_method"|data-save-provider=|type="checkbox"/, 'the host is handed a live press');
      // The only button is the ⓘ.
      assert.equal((html.match(/<button\b/g) ?? []).length, 1, 'a pressable control in the host preview');
      assert.match(html, /<button[^>]*aria-label="About keeping this invitation"/);
    } finally {
      delete process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED;
    }
  }
  const bar = read('app/[slug]/_components/held-pass-line.tsx');
  assert.match(bar, /Only they can save it to their account\./, 'the slim host bar lost "Only they can save it"');
});

test('(4) ONE OFFER PER PAGE: GuestMe draws none; MeKeepInvitation is mounted once and placed in one of two exclusive places', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { GuestMe } = await import('../app/[slug]/_components/guest-me');
  const props = {
    name: 'Ana Reyes', slug: 'ana', eventId: 'e-1', guestId: 'g-ana', askMeal: false, askDietary: false, askPlusOnes: false,
    eventName: 'Indalecio & Claire', guests: [], account: { kind: 'offer' }, personalLink: null, userAgent: null, termsCarried: true,
  };
  const plain = renderToStaticMarkup(React.createElement(GuestMe, { ...props, plain: true } as never));
  assert.doesNotMatch(plain, /data-me-card="account"|data-save-heading/, 'Me draws a second Save');
  const page = read('app/[slug]/page.tsx');
  // The page hands GuestMe no account, so the one-scroll Me's own card can never be a second offer.
  const guestMe = page.slice(page.indexOf('<GuestMe\n'), page.indexOf('/>', page.indexOf('faceTagging={', page.indexOf('<GuestMe\n'))));
  assert.match(guestMe, /account=\{null\}/, 'the page hands GuestMe an account — a second save offer on Me');
  assert.equal((page.match(/<MeKeepInvitation\b/g) ?? []).length, 1, 'Me’s offer is mounted more than once');
  assert.equal((page.match(/<SaveToAccount\b/g) ?? []).length, 0, 'the page draws a SaveToAccount of its own beside Me’s');
  // Placed once: under the ticket (`keepOnTicket`) or, failing that, under the greeting / at the slot's top.
  assert.match(page, /keep=\{keepOnTicket \? keepNode : null\}/, 'the ticket does not hold the offer');
  assert.match(page, /guestPageTabbed && !isEditorCanvas && !keepOnTicket \? \(\s*keepNode/, 'the Me tab’s fallback is not exclusive of the ticket’s');
  assert.match(page, /\{me\.inMe \|\| keepOnTicket \? null : <div className="mb-8">\{keepNode\}<\/div>\}/, 'the one-scroll fallback is not exclusive');
  assert.equal((read('app/[slug]/_components/site-body.tsx').match(/\{meSave \?/g) ?? []).length, 1);
});

test('(5a) with a ticket: the offer sits DIRECTLY under the ticket’s Save · Add to Apple Wallet', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { GuestTicket } = await import('../app/[slug]/_components/guest-ticket');
  const html = renderToStaticMarkup(
    React.createElement(GuestTicket, {
      state: 'pass', name: 'Ana', invitationUrl: 'https://x/ana?invite=t0',
      appleWallet: { kind: 'download', href: '/api/guest/wallet-pass', label: 'Add to Apple Wallet' },
      keep: React.createElement('p', { 'data-lab-keep': '' }, 'keep'),
    } as never),
  );
  const wallet = html.indexOf('data-wallet="apple"');
  const keepAt = html.indexOf('data-ticket-keep=""');
  assert.ok(wallet > -1, 'anti-vacuity: the Wallet badge is not drawn');
  assert.ok(keepAt > wallet, 'the offer is not under Add to Apple Wallet');
  assert.ok(html.indexOf('data-lab-keep') > keepAt);
  // …and never under a ticket that is not a real pass.
  const pending = renderToStaticMarkup(React.createElement(GuestTicket, { state: 'awaiting', name: 'Ana', invitationUrl: 'x', keep: React.createElement('p', { 'data-lab-keep': '' }) } as never));
  assert.doesNotMatch(pending, /data-lab-keep/);
});

test('(5b) without a ticket: the block stands right under the greeting, before the rest of Me', async () => {
  const html = await renderSiteBodyFixture({ meSave: React.createElement('p', { 'data-lab-save': '' }, 'save here') } as never);
  const me = html.slice(html.indexOf('data-me-stage=""'));
  const at = me.indexOf('data-me-save-slot');
  assert.ok(at > me.indexOf('data-greeting-venues'), 'the Save is not under the greeting');
  for (const after of ['data-me-parts', 'id="me-reply"', 'data-me-foot']) {
    const i = me.indexOf(after);
    if (i > -1) assert.ok(at < i, `the Save is not before ${after}`);
  }
  assert.equal(me.split('data-me-save-slot').length - 1, 1);
});

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const MESSENGER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/430.0]';
for (const [label, state, extra, expect] of [
  ['offer · a browser', { kind: 'offer' }, { userAgent: IPHONE }, /data-save-provider="/],
  ['offer · inside Messenger', { kind: 'offer' }, { userAgent: MESSENGER }, /data-save-email-signin=""[^>]*>Sign in with email|>Sign in with email</],
  ['offer · inside Messenger, no personal link', { kind: 'offer' }, { userAgent: MESSENGER, personalLink: null }, />Sign in with email</],
  ['offer · no provider switched on', { kind: 'offer' }, { userAgent: IPHONE, noProviders: true }, />Sign in with email</],
  ['sign_in · kept in an account this browser is not signed in to', { kind: 'sign_in' }, {}, />Sign in to your account</],
  ['held_elsewhere · kept in another account', { kind: 'held_elsewhere' }, {}, /data-account-state="held_elsewhere"/],
] as const) {
  test(`(6) an unlinked guest always gets the widget — ${label}`, async () => {
    const off = 'noProviders' in extra;
    if (off) delete process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED;
    try {
      const { noProviders: _n, ...rest } = extra as Record<string, unknown>;
      const html = await keep(state as never, rest);
      assert.match(html, /data-me-save="/, `${label}: Me draws no save widget`);
      assert.match(html, /Keep this invitation/, `${label}: the widget has no title`);
      assert.match(html, expect, `${label}: the widget has nothing to do`);
    } finally {
      process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED = 'true';
    }
  });
}

test('(6) an unlinked guest always gets the widget — link_this_seat · signed in, the seat is free (read: its hosts tick reads the database)', () => {
  const save = read('app/[slug]/_components/save-to-account.tsx');
  const arm = save.slice(save.indexOf("if (state.kind === 'link_this_seat') {"), save.indexOf('// offer — the device'));
  assert.match(arm, /<form action=\{linkThisSeatAction\.bind\(null, eventId\)\}/, 'the signed-in guest has no press that saves the seat');
  assert.match(arm, /Yes, save to my account/);
  const me = read('app/[slug]/_components/me-keep-invitation.tsx');
  assert.match(me, /<SaveToAccount \{\.\.\.props\} headless \/>/, 'Me’s widget does not draw the shipped Save for every state');
});
