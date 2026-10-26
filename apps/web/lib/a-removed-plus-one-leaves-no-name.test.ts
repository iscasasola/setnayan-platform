/**
 * 🧹 A REMOVED +1 LEAVES NO NAME — no reader draws a +1 name that no LIVE +1 row has.
 *
 * ⚖ Owner, verbatim, 2026-10-26 (cale-ice, guest Juanita Sacdalan): "I deleted that guest and added a new plus 1. It is
 * still there?" Measured in prod (read-only): her +1 "Ggvv Vfh" soft-deleted, a fresh "+1 · TBA" seat minted ten
 * seconds later — and her own row still carried the one-name COPY `guests.plus_one_name = 'Ggvv Vfh'`. Nothing wrote the
 * copy back when the row it copied went away, and the readers that still took it at its word (the List's search, the
 * desks' and the pass's "no live row → the mirror" fallback) kept a deleted person alive.
 *
 * The WRITE half is the database's (migration 20271288562348 `a_plus_ones_name_is_their_row`, proven by
 * tests/db/a-plus-ones-name-is-their-row.db.test.ts). This is the READ half — THE PROPERTIES:
 *   1 · with Juanita's exact rows (a stale copy, one live unnamed seat — or none at all), every reader of who a guest
 *       brings — `companionNames` (check-in, souvenirs, find-your-seat), `companionNamesByBringer` (the List's search),
 *       `plusOneSeatLines` / `plusOneSeatPeople` (the guest card) — names NOBODY;
 *   2 · over every mix of live named / unnamed / declined seats and any copy, every name a reader returns is a name on
 *       a live seat row of that guest;
 *   3 · the guest card, painted, never draws the copy — with a TBA seat, with no seat, with a named seat;
 *   4 · the search finds a guest by a LIVE +1's name and never by the copy alone;
 *   5 · no reader in the app reads the copy off a row except the ones named here, and the pass card's count never
 *       falls back to it.
 *
 * 🛡 SABOTAGED, seen RED, then restored (2026-10-26) — see the PR body for the run.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { createRequire } from 'node:module';

import { companionNames, companionNamesByBringer, plusOneSeatLines, plusOneSeatPeople, type CompanionSeatRow } from './extra-seats';
import { guestMatchesSearch, type GuestSearchRow } from './guest-search';
import { realNameParts } from './seat-placeholder-words';
import { stripComments } from './strip-comments';
import type { GuestRow } from './guests';

const WEB = path.join(__dirname, '..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(WEB, rel), 'utf8'));

// `server-only` / `client-only` resolve to an empty module (the card's imports reach them) — as every-seat-is-on-the-card does.
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
{
  const nodeRequire = createRequire(import.meta.url);
  const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
  const STUB = path.join(process.cwd(), '__server_only_stub_removed_plus_one__.js');
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

const JUANITA = '9632d9d0-juanita';
const STALE = 'Ggvv Vfh';
const tba = (id: string, at: string): CompanionSeatRow => ({ guest_id: id, plus_one_of_guest_id: JUANITA, first_name: 'TBA', last_name: '+1', plus_one_name_confirmed_at: null, rsvp_status: 'pending', created_at: at });
const named = (id: string, first: string, last: string, at: string, rsvp = 'pending'): CompanionSeatRow => ({ guest_id: id, plus_one_of_guest_id: JUANITA, first_name: first, last_name: last, plus_one_name_confirmed_at: at, rsvp_status: rsvp, created_at: at });
const juanita = { guest_id: JUANITA, plus_one_allowed: true, plus_one_name: STALE };

/* ── 1 · Juanita's exact rows ────────────────────────────────────────────────────────────────────────────────────── */

test('Juanita: a stale copy over one live TBA seat — or over no live seat at all — names nobody, on every reader', () => {
  for (const live of [[tba('33c5e790', '2026-10-26T01:57:48Z')], []]) {
    const label = live.length ? 'one live TBA seat' : 'no live seat';
    assert.deepEqual(companionNames(juanita, live), [], `${label}: the desks / find-your-seat named the removed +1`);
    assert.equal(companionNamesByBringer(live).get(JUANITA), undefined, `${label}: the List's search words named the removed +1`);
    assert.ok(!plusOneSeatLines(JUANITA, live).some((l) => l.includes('Ggvv')), `${label}: the card's lines named the removed +1`);
    assert.ok(!plusOneSeatPeople(JUANITA, live).some((p) => p.name?.includes('Ggvv')), `${label}: the card's people named the removed +1`);
  }
});

/* ── 2 · every name a reader returns is on a live row ────────────────────────────────────────────────────────────── */

test('over every mix of seats and any copy, a reader only ever returns names on that guest’s live rows', () => {
  const pool = [
    named('a', 'Ana', 'Cruz', '2026-10-01'),
    tba('b', '2026-10-02'),
    named('c', 'Ben', '+1', '2026-10-03'),
    named('d', 'Cara', 'Lim', '2026-10-04', 'declined'),
    named('e', 'TBA', 'Ccgg', '2026-10-05'),
  ];
  const copies = [null, '', 'TBA', STALE, 'Ana Cruz', 'Marwin Baldevia'];
  let checked = 0;
  for (let mask = 0; mask < 1 << pool.length; mask++) {
    const live = pool.filter((_, i) => mask & (1 << i));
    const onRows = new Set(live.map((r) => { const n = realNameParts(r.first_name, r.last_name); return [n.first, n.last].filter(Boolean).join(' '); }));
    for (const c of copies) {
      const bringer = { guest_id: JUANITA, plus_one_allowed: true, plus_one_name: c };
      const said = [
        ...companionNames(bringer, live),
        ...(companionNamesByBringer(live).get(JUANITA) ?? []),
        ...plusOneSeatPeople(JUANITA, live).map((p) => p.name).filter((n): n is string => Boolean(n)),
        ...plusOneSeatLines(JUANITA, live).filter((l) => l.startsWith('Bringing ')).map((l) => l.slice('Bringing '.length)),
      ];
      for (const n of said) assert.ok(onRows.has(n), `"${n}" was drawn with live rows [${[...onRows].join(', ')}] and copy ${JSON.stringify(c)}`);
      checked += 1;
    }
  }
  assert.equal(checked, (1 << pool.length) * copies.length);
});

/* ── 3 · the guest card, painted ─────────────────────────────────────────────────────────────────────────────────── */

const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };

function cardGuest(): GuestRow {
  return {
    guest_id: JUANITA, event_id: 'e1', first_name: 'Juanita', last_name: 'Sacdalan', name_prefix: null, middle_name: null,
    name_suffix: null, display_name: null, role: 'guest', side: 'bride', rsvp_status: 'pending', group_category: 'family',
    meal_preference: 'no_preference', dietary_restrictions: null, invited_to_blocks: ['ceremony', 'reception'],
    custom_tags: [], extra_roles: [], plus_one_allowed: true, plus_one_count: 1, plus_one_of_guest_id: null, photo_consent: true,
    faceblock_enabled: false, face_recognition_excluded: false, passed_away: false, attire: 'neutral', seniority_rank: null,
    relation: null, email: null, notes: null, guest_note: null, qr_token: 'tok', mobile: null, entry_source: 'host_seeded',
    invitation_sent_at: null, plus_one_name: STALE, plus_one_name_confirmed_at: null,
  } as unknown as GuestRow;
}

async function paintCard(plusOneLines: readonly string[], withKit: boolean): Promise<string> {
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { GuestCardBody } = await import('@/app/dashboard/[eventId]/guests/_components/guest-card-body');
  const kit = withKit ? (await import('@/app/dashboard/[eventId]/guests/_components/guest-card-template-kit')).TEMPLATE_KIT : undefined;
  const data = {
    isCouple: false, hasSides: true, availableRoles: ['guest'], groupOptions: ['family', 'other'], isIncWedding: false,
    showTeaCeremony: false, plusOneLines, plusOneGuestId: null, initialInvited: ['ceremony', 'reception'],
    seatedAt: null, customGroups: [], recordedAt: null, access: null, canManageAccess: true, offersThisIsMe: false,
    nameLinked: false, linkedAccount: null, profileName: null, roleNames: {}, tables: null, seatTableId: null, groupChoices: null,
    plusOneOf: null, guest: cardGuest(),
  };
  const card = React.createElement(GuestCardBody as unknown as React.FC<Record<string, unknown>>, {
    eventId: 'e1', data, invitationBase: 'https://www.setnayan.com/cale-and-ice', photoDisplayUrl: null, variant: 'panel',
    headerShown: true, returnTo: '/dashboard/e1/guests', errorMessage: null, inviteFlash: null, ...(kit ? { kit } : {}),
  });
  return renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: ROUTER as never }, card));
}

for (const withKit of [false, true]) {
  const which = withKit ? 'the Guests page card (template kit)' : 'the Maker’s card (hand-drawn kit)';
  test(`${which}: Juanita's card never draws the removed +1's name — over a TBA seat, over no seat, beside a named one`, async () => {
    const overTba = await paintCard(plusOneSeatLines(JUANITA, [tba('s1', '2026-10-26')]), withKit);
    assert.ok(overTba.includes('Awaiting +1 to confirm their name'), 'the live TBA seat is not on the card (the probe is vacuous)');
    assert.ok(!overTba.includes('Ggvv'), 'the card drew the removed +1 over the new TBA seat');
    const none = await paintCard(plusOneSeatLines(JUANITA, []), withKit);
    assert.ok(!none.includes('Ggvv'), 'the card drew the removed +1 with no seat at all');
    const beside = await paintCard(plusOneSeatLines(JUANITA, [named('s2', 'Ana', 'Cruz', '2026-10-26')]), withKit);
    assert.ok(beside.includes('Bringing Ana Cruz'), 'a live named seat is not drawn (the probe is vacuous)');
    assert.ok(!beside.includes('Ggvv'), 'the card drew the removed +1 beside the live one');
  });
}

/* ── 4 · the search ──────────────────────────────────────────────────────────────────────────────────────────────── */

test('the search finds a guest by a live +1’s name — and never by the copy alone', () => {
  const row = { first_name: 'Juanita', last_name: 'Sacdalan', role: 'guest', side: 'bride', group_category: 'family', rsvp_status: 'pending', custom_tags: [], plus_one_name: STALE } as unknown as GuestSearchRow;
  const live = [tba('s1', '2026-10-26')];
  assert.equal(guestMatchesSearch('Ggvv', row, { companionNames: companionNamesByBringer(live).get(JUANITA) }), false, 'searching the removed +1 still finds Juanita');
  const withAna = [named('s2', 'Ana', 'Cruz', '2026-10-26')];
  assert.equal(guestMatchesSearch('Ana Cruz', row, { companionNames: companionNamesByBringer(withAna).get(JUANITA) }), true, 'a live +1’s name does not find their guest');
});

/* ── 5 · no reader takes the copy off a row ──────────────────────────────────────────────────────────────────────── */

test('the copy is read off a row only by the readers named here — and the pass card’s count never falls back to it', () => {
  // The guest card, the List and its search read who a guest brings from the rows alone.
  for (const rel of [
    'app/dashboard/[eventId]/guests/_components/guest-card-data.ts',
    'app/dashboard/[eventId]/guests/_components/guest-card-body.tsx',
    'app/dashboard/[eventId]/guests/_components/guest-card-rows.tsx',
    'app/dashboard/[eventId]/guests/_components/guests-screen.tsx',
    'app/dashboard/[eventId]/guests/page.tsx',
    'lib/guest-search.ts',
    'lib/guest-roster-view.ts',
  ]) {
    assert.ok(!/\.plus_one_name\b/.test(read(rel)), `${rel} reads the one-name copy (\`.plus_one_name\`) off a row`);
  }
  // `companionNames` never reaches for the bringer's copy.
  const ex = read('lib/extra-seats.ts');
  const fn = ex.slice(ex.indexOf('export function companionNames'), ex.indexOf('export function companionNamesByBringer'));
  assert.ok(fn.length > 50 && !/plus_one_name\b/.test(fn.replace(/bringer:\s*\{[^}]*\}/, '')), '`companionNames` reads the copy');
  // The pass card: "and N guests" and "bringing" come from the live rows' count, never the copy alone.
  const pc = read('lib/pass-card.server.ts');
  const pass = pc.slice(pc.indexOf('export function passCardPass'), pc.indexOf('export function passCardDesignFor'));
  const party = pass.match(/party:\s*([^\n]+)/)?.[1] ?? '';
  assert.ok(party.includes('kit.party'), 'the probe did not find the party line');
  assert.ok(!/plus_one_name/.test(party), 'the pass card counts a +1 off the copy');
  const bringing = pass.match(/bringing:\s*([^\n]+)/)?.[1] ?? '';
  assert.match(bringing, /kit\.party/, 'the pass card says who a guest brings without a live named row');
});
