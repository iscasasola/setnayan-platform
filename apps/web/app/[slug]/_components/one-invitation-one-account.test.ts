/**
 * ONE INVITATION, ONE ACCOUNT — what the SECOND account is told.
 *
 * ⚖ Owner, 2026-10-01 (verbatim): *"save to my account. adds it to a user. if
 * someone tries to sync it to a different email. they cannot. we will say this
 * event QR is already assigned to someone."*
 *
 * The refusal itself is the database's (tests/db/one-invitation-one-account.db
 * .test.ts). This file pins the WORDS, by mounting each surface a refused
 * account can land on and reading the emitted HTML — exactly the heading and
 * the one line, and none of the old "Sign in with that one" wording:
 *
 *   · the shared Save                    (`SaveToAccount`,    held_elsewhere)
 *   · the screen a Google / Apple return lands on (`HeldElsewhereDoor`, drawn
 *     by /join/{id}/connect/confirm) — and the two routes that send them there.
 *
 * 🪤 `globalThis.React` is set before the DYNAMIC imports (tsconfig `"jsx":
 * "preserve"` → tsx compiles to the classic runtime), and the `server-only`
 * shim is registered at module scope for the same reason — see
 * app/pay/[reference]/_components/one-stage-at-a-time.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_one_invite__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return STUB;
    return original.call(this, request, ...rest);
  };
}

const HEADING = 'This event QR is already assigned to someone.';
const LINE = 'If this is your invitation, ask the hosts to check it.';

/** The visible words of an HTML fragment, in order. */
function words(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function code(rel: string): string {
  return stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));
}

/* (The invitation's own account card was removed 2026-10-03 — owner: one
   place per control; "Save to my account" is Me's `SaveToAccount` alone, below.) */

test('the shared Save says exactly the two sentences to a second account', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SaveToAccount } = await import('./save-to-account');
  const html = renderToStaticMarkup(
    React.createElement(SaveToAccount, {
      state: { kind: 'held_elsewhere' },
      eventId: 'e-1',
      slug: 'ana-and-ben',
      personalLink: null,
      userAgent: null,
      termsCarried: true,
    }),
  );
  assert.equal(words(html), `${HEADING} ${LINE}`);
  assert.doesNotMatch(html, /<form|<button|href=/);
});

test('the Google / Apple return lands on the same two sentences, and nothing to press', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HeldElsewhereDoor } = await import('@/app/join/[eventId]/connect/confirm/held-elsewhere-door');
  const html = renderToStaticMarkup(React.createElement(HeldElsewhereDoor));
  assert.match(html, new RegExp(`<h1[^>]*>${HEADING.replace(/\./g, '\\.')}</h1>`));
  // The door's wordmark (aria-label "Setnayan home") is the only other thing on it.
  assert.equal(words(html).replace(/^Setnayan\s*/i, ''), `${HEADING} ${LINE}`);
  assert.doesNotMatch(html, /<form|<button/);
});

test('the connect route and the confirm page send a refused account to that screen', () => {
  const route = code('app/join/[eventId]/connect/route.ts');
  const held = route.indexOf('await seatHeldElsewhere(');
  const connect = route.indexOf('await connectEventForUser(');
  assert.ok(held > 0 && held < connect, 'a refused sign-in falls through to an unexplained account home again');
  assert.match(route.slice(held, connect), /\/connect\/confirm\$\{carry\}/, 'the held branch no longer lands on the confirm page');

  const page = code('app/join/[eventId]/connect/confirm/page.tsx');
  const noSeat = page.indexOf('if (!seat) {');
  const back = page.indexOf('redirect(`/join/${eventId}/connect${carry}`)', noSeat);
  const branch = page.slice(noSeat, back);
  assert.ok(noSeat > 0 && back > noSeat, 'the confirm page lost its no-seat branch');
  assert.match(branch, /await seatHeldElsewhere\([^)]*\)\)\s*\{\s*return <HeldElsewhereDoor \/>/, 'the confirm page no longer says it');
});

test('"held elsewhere" means a DIFFERENT account holds the row this sign-in reached for', () => {
  const lib = code('lib/event-account-link.ts');
  const at = lib.indexOf('export async function seatHeldElsewhere(');
  const body = lib.slice(at, lib.indexOf('\n}\n', at));
  assert.match(body, /return !seat && report\.heldElsewhere;/, 'held-elsewhere fires while a seat is still on offer');
  const find = lib.slice(lib.indexOf('export async function findSeatToConnect('), at);
  assert.match(
    find,
    /const other = Boolean\(bound && bound\.user_id !== userId\);\s*if \(other && report\) report\.heldElsewhere = true;/,
    'the account’s OWN link is read as someone else’s',
  );
});
