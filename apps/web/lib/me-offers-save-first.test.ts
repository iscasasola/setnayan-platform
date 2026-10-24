/**
 * me-offers-save-first.test.ts — ME OFFERS "KEEP THIS INVITATION" FIRST, AND ONLY THERE (owner 2026-10-24: *"on the me
 * part, we start offering the linking of this event to their account"*).
 *
 * Held:
 *   (1) the block, on the shipped Save (`SaveToAccount`): a title, one short line, the Save button and its Terms tick —
 *       the reason inside the ⓘ, never again under the button;
 *   (2) once saved, ONE line — "✓ Saved to your account" — nothing to press;
 *   (3) a host viewing as a guest gets nothing here (Me's slim host bar says "Only they can save it" in its ⓘ);
 *   (4) ONE PLACE (DECISION_LOG 2026-10-03): the redrawn Me's `GuestMe plain` draws no Save of its own;
 *   (5) on the real page the block stands RIGHT UNDER the greeting (name · role · date · venues), before every other
 *       part of Me and before Me's one Reply.
 *
 * Sabotages seen red (each restored): `GuestMe plain` drawing its account card again ((4) red) · the slot mounted after
 * Me's parts ((5) red) · the reason left under the button ((1) red).
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

async function keep(state: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MeKeepInvitation } = await import('../app/[slug]/_components/me-keep-invitation');
  return renderToStaticMarkup(React.createElement(MeKeepInvitation, { ...BASE, state } as never));
}

test('(1) an unlinked guest: the title, one line, the shipped Save and its Terms tick — the reason in the ⓘ', async () => {
  const { ME_KEEP_TITLE, ME_KEEP_LINE, ME_KEEP_TIP } = await import('../app/[slug]/_components/me-keep-invitation');
  const html = await keep({ kind: 'offer' });
  assert.match(html, /data-me-save="offer"/);
  assert.ok(html.includes(ME_KEEP_TITLE), 'no title');
  assert.ok(html.includes(ME_KEEP_LINE.replace('’', '&#x27;')) || html.includes(ME_KEEP_LINE), 'no short line');
  assert.match(html, /Save to my account/, 'the shipped Save button is not drawn');
  assert.match(html, /type="checkbox"/, 'the Terms tick is not drawn');
  assert.match(html, /aria-label="About keeping this invitation"/, 'no ⓘ');
  assert.doesNotMatch(html, /Keeps the photos of you, and opens this invitation on any phone\.<\/p>/, 'the reason is said again under the button — details go in the ⓘ');
  assert.ok(ME_KEEP_TIP.length > 0);
});

test('(2) once saved: one line, "✓ Saved to your account" — nothing to press', async () => {
  const html = await keep({ kind: 'linked', accountEmail: 'ana@example.com' });
  assert.match(html, /^<p data-me-save="linked"[^>]*>[\s\S]*✓[\s\S]*Saved to your account<\/p>$/);
  assert.doesNotMatch(html, /<button|<form|<a /, 'a saved invitation still offers a press');
});

test('(3) a host viewing as a guest: nothing here — the slim bar’s ⓘ says it', async () => {
  assert.equal(await keep({ kind: 'host_viewing', seatName: 'Indalecia' }), '');
  const bar = read('app/[slug]/_components/held-pass-line.tsx');
  assert.match(bar, /Only they can save it to their account\./, 'the slim host bar lost "Only they can save it"');
});

test('(4) one place: the redrawn Me’s GuestMe draws no Save of its own', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { GuestMe } = await import('../app/[slug]/_components/guest-me');
  const props = {
    name: 'Ana Reyes', slug: 'ana', eventId: 'e-1', guestId: 'g-ana', askMeal: false, askDietary: false, askPlusOnes: false,
    eventName: 'Indalecio & Claire', guests: [], account: { kind: 'offer' }, personalLink: null, userAgent: null, termsCarried: true,
  };
  const plain = renderToStaticMarkup(React.createElement(GuestMe, { ...props, plain: true } as never));
  assert.doesNotMatch(plain, /data-me-card="account"|Save to my account/, 'Me draws a second Save');
  const shipped = renderToStaticMarkup(React.createElement(GuestMe, props as never));
  assert.match(shipped, /data-me-card="account"/, 'anti-vacuity: the one-scroll Me lost its Save');
  // Mounted once, on Me, from the page that holds the account's facts.
  assert.equal((read('app/[slug]/page.tsx').match(/<MeKeepInvitation\b/g) ?? []).length, 1);
  assert.equal((read('app/[slug]/_components/site-body.tsx').match(/\{meSave \?/g) ?? []).length, 1);
});

test('(5) on the real page the block stands right under the greeting, before the rest of Me', async () => {
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
