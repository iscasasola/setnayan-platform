/**
 * 🪪 "USE THIS ON YOUR PROFILE" (B9) — DECISION_LOG 2026-09-30 "THE EVENT'S
 * FORMAL NAME FILLS THE PERSON'S OWN PROFILE — ONE TAP, NEVER SILENT", within
 * "A GUEST ROW LINKED TO AN ACCOUNT SHOWS THE ACCOUNT PROFILE'S DETAILS" and
 * "A SEAT BECOMES AN ACCOUNT'S ONLY ON PURPOSE".
 *
 * What is held:
 *   1. it is offered only when the names DIFFER, and never over a part the
 *      person typed (the rule runs for real);
 *   2. one tap writes the profile's formal name and NOTHING else — the five name
 *      parts, each matched on its own NULL, through the person's OWN client;
 *   3. the name is read on the server from the seat the account SAVED — the
 *      browser hands over two ids and no name, and no host surface imports it;
 *   4. opening writes nothing: the offer read has no write in it, and the line
 *      draws without calling the action.
 * The database half — a host cannot write another person's profile — is
 * tests/db/a-host-cannot-write-a-guests-profile.db.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { FORMAL_NAME_FIELDS } from '@/lib/formal-name';
import { seatNameOffer } from './seat-name-offer';

// 🪤 `globalThis.React` before the DYNAMIC import (tsconfig `jsx: preserve`) and
// `server-only` stubbed — the traps `each-guest-page-has-one-main-action` names.
(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const SEAT = { name_prefix: 'Ms.', first_name: 'Claire', middle_name: 'Estoras', last_name: 'Buanhog', name_suffix: null };

// ── 1 · the rule, executed ──────────────────────────────────────────────────

test('a fuller seat name is offered, and fills ONLY the empty parts', () => {
  const offer = seatNameOffer({ first_name: 'Claire', last_name: 'Buanhog' }, SEAT);
  assert.ok(offer, 'Claire’s fuller name is not offered');
  assert.deepEqual(offer.fill, { name_prefix: 'Ms.', middle_name: 'Estoras' });
  assert.equal(offer.name, 'Ms. Claire Estoras Buanhog');
});

test('the same name is not offered — not even in another case or spacing', () => {
  assert.equal(seatNameOffer(SEAT, SEAT), null);
  assert.equal(
    seatNameOffer({ name_prefix: 'ms.', first_name: ' claire ', middle_name: 'ESTORAS', last_name: 'buanhog' }, SEAT),
    null,
  );
});

test('a part the person typed is never replaced — a disagreement offers nothing', () => {
  assert.equal(seatNameOffer({ first_name: 'Clai', last_name: 'Buanhog' }, SEAT), null);
  assert.equal(seatNameOffer({ first_name: 'Claire', last_name: 'Buanhog', name_suffix: 'Jr.' }, { ...SEAT, name_suffix: 'II' }), null);
});

test('a part only the profile has is kept, and the line says so', () => {
  const offer = seatNameOffer({ first_name: 'Claire', last_name: 'Buanhog', name_suffix: 'III' }, SEAT);
  assert.ok(offer);
  assert.equal('name_suffix' in offer.fill, false);
  assert.equal(offer.name, 'Ms. Claire Estoras Buanhog III');
});

test('an empty profile takes the whole name; a seat with no real name offers nothing', () => {
  assert.deepEqual(seatNameOffer(null, SEAT)?.fill, { name_prefix: 'Ms.', first_name: 'Claire', middle_name: 'Estoras', last_name: 'Buanhog' });
  assert.equal(seatNameOffer({}, { first_name: 'TBA', last_name: 'Guest' }), null);
  assert.equal(seatNameOffer({}, { first_name: 'Claire', last_name: '' }), null);
  assert.equal(seatNameOffer({}, null), null);
});

// ── 2 · one tap writes the formal name and nothing else ─────────────────────

const ACTIONS = read('app/dashboard/(account)/profile/actions.ts');
const ADOPT = ACTIONS.slice(
  ACTIONS.indexOf('export async function adoptSeatNameOnProfile('),
  ACTIONS.indexOf('export async function requestAccountDeletion('),
);

test('🔒 the tap writes the person’s OWN row, through their own client, matched part by part on NULL', () => {
  assert.ok(ADOPT.length > 100, 'adoptSeatNameOnProfile is gone');
  assert.match(
    ADOPT,
    /let write = supabase\.from\('users'\)\.update\(offer\.fill\)\.eq\('user_id', user\.id\);/,
    'the write is no longer the person’s own row through their own (RLS) client',
  );
  assert.match(ADOPT, /for \(const f of columns\) write = write\.is\(f, null\);/, 'the write can replace a part the person typed');
  assert.equal((ADOPT.match(/\.update\(/g) ?? []).length, 1, 'the tap writes more than one thing');
  assert.doesNotMatch(ADOPT, /createAdminClient\(\)\s*\.from/, 'the write left the person’s own client');
});

test('🔒 what the tap can write is the five name parts — no other column is in `fill`', () => {
  for (const profile of [null, {}, { first_name: 'Claire', last_name: 'Buanhog' }]) {
    const offer = seatNameOffer(profile, { ...SEAT, name_suffix: 'II' });
    for (const k of Object.keys(offer?.fill ?? {})) {
      assert.ok((FORMAL_NAME_FIELDS as readonly string[]).includes(k), `the tap writes ${k}`);
    }
  }
});

// ── 3 · the name comes from the saved seat, never from the browser ──────────

test('🔒 the browser hands over two ids and no name; the name is read again on the server', () => {
  assert.match(ADOPT, /adoptSeatNameOnProfile\(input: \{\s*eventId: string;\s*guestId: string;\s*\}\)/);
  assert.match(ADOPT, /seatNameOfferFor\(createAdminClient\(\), user\.id, input\.eventId, input\.guestId\)/);
  assert.doesNotMatch(ADOPT, /formData|input\.(name|first_name|last_name|fill)/);
});

test('🔒 only a seat saved to THIS account qualifies, and the offer read writes nothing', () => {
  const lib = read('lib/seat-name-offer.server.ts');
  assert.match(
    lib,
    /\.from\('event_members'\)\s*\.select\('user_id'\)\s*\.eq\('event_id', eventId\)\s*\.eq\('user_id', userId\)\s*\.eq\('guest_id', guestId\)/,
    'the offer no longer requires the seat to be saved to this account',
  );
  assert.match(lib, /!seatHeld\.data/, 'a seat not saved to this account still gets an offer');
  assert.doesNotMatch(lib, /\.(update|insert|upsert|delete|rpc)\(/, 'opening the Me tab can write');
});

test('🔒 Me asks only for a viewer whose OWN account holds this seat', () => {
  const page = read('app/[slug]/page.tsx');
  assert.match(
    page,
    /const seatNameOffer =\s*!isEditorCanvas && viewerAccount\?\.id && account\.kind === 'linked'\s*\? await seatNameOfferFor\(admin, viewerAccount\.id, event\.event_id, guest\.guest_id\)/,
  );
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === 'node_modules' || name === '.next') continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('🔒 no host surface can reach the tap — only the guest’s own page hands it in', () => {
  const users = walk(join(WEB, 'app'))
    .filter((p) => /\badoptSeatNameOnProfile\b/.test(stripComments(readFileSync(p, 'utf8'))))
    .map((p) => p.slice(WEB.length + 1))
    .sort();
  assert.deepEqual(users, ['app/[slug]/page.tsx', 'app/dashboard/(account)/profile/actions.ts']);
});

// ── 4 · opening writes nothing ──────────────────────────────────────────────

test('🔒 the line draws without calling the action; only "Use it" calls it', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { GuestMe } = await import('@/app/[slug]/_components/guest-me');
  let calls = 0;
  const adopt = async () => {
    calls += 1;
    return { ok: true as const, name: 'x' };
  };
  const base = {
    name: 'Claire',
    slug: 'cb',
    eventId: 'e-1',
    guestId: 'g-1',
    askMeal: false,
    askDietary: false,
    askPlusOnes: false,
    eventName: 'Claire & Jon',
    guests: [],
    passes: {},
    account: { kind: 'linked' as const, accountEmail: 'c@x.test' },
    personalLink: null,
    userAgent: null,
    termsCarried: true,
  };
  const html = renderToStaticMarkup(
    React.createElement(GuestMe, { ...base, profileName: { name: 'Ms. Claire Estoras Buanhog', adopt } }),
  );
  assert.equal((html.match(/>Use this on your profile</g) ?? []).length, 1, 'the action is not drawn exactly once');
  assert.match(html, /Ms\. Claire Estoras Buanhog/);
  assert.doesNotMatch(html, />Use it</, 'the confirm is open before the tap');
  assert.equal(calls, 0, 'drawing Me called the write');

  const none = renderToStaticMarkup(React.createElement(GuestMe, { ...base, profileName: null }));
  assert.doesNotMatch(none, /Use this on your profile/, 'the action shows with nothing to offer');

  const ui = read('app/[slug]/_components/use-on-profile.tsx');
  assert.equal((ui.match(/\badopt\(/g) ?? []).length, 1, 'the action is called from more than one place');
  const confirm = ui.slice(ui.indexOf('function confirmUse('), ui.indexOf('return (', ui.indexOf('function confirmUse(')));
  assert.match(confirm, /await adopt\(\{ eventId, guestId \}\)/, 'the write is not behind the confirm');
  assert.match(ui, /onClick=\{confirmUse\}[^>]*>\s*\{pending \? 'Saving…' : 'Use it'\}/, 'the write is not on "Use it"');
});
