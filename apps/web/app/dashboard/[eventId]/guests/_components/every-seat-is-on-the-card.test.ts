/**
 * 🪑 EVERY SEAT IS ON THE CARD — and a seat read that failed is never drawn as "no +1".
 *
 * Live cale-ice, 2026-10-22: Antonio Loo and Darryl Jan Patrick Lim each bring TWO +1s (two live seat rows, read-only).
 * Their guest card said "Allowed, but no +1 added yet." The card's loader read the guest's +1 with `.maybeSingle()`;
 * PostgREST answers two rows with an ERROR, the error was logged, and the card drew the EMPTY state. One defect, two
 * halves: a single-row read of a many-row fact, and a failure rendered exactly like emptiness.
 *
 * THE PROPERTIES, each tested by what it does:
 *   1 · N live seat rows → N lines on the card, oldest first ("+2" is the second seat everywhere), any N 0…4;
 *   2 · a refused read → the card says it could not read them — NEVER "no +1 added yet";
 *       and no seat row → the shipped "Allowed, but no +1 added yet." (anti-vacuity: the empty state still exists);
 *   3 · no read of a guest's +1 seats anywhere in the app is a single-row read (`.maybeSingle()` / `.single()` on a
 *       `plus_one_of_guest_id` filter) — the one writer that deliberately asks for "the oldest waiting seat" is named.
 *
 * 🛡 SABOTAGED, each seen RED, then restored (2026-10-22) — see the PR body for the run.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';

import { plusOneSeatLines } from '@/lib/extra-seats';
import { stripComments } from '@/lib/strip-comments';
import type { GuestRow } from '@/lib/guests';

const WEB = path.join(__dirname, '..', '..', '..', '..', '..');
const BRINGER = 'g-antonio';

/* ── 1 · every seat row is a line ────────────────────────────────────────────────────────────────────────────────── */

const named = (id: string, first: string, last: string, at: string) => ({ guest_id: id, first_name: first, last_name: last, plus_one_name_confirmed_at: at, created_at: at });
const open = (id: string, at: string) => ({ guest_id: id, first_name: 'TBA', last_name: '+1', plus_one_name_confirmed_at: null, created_at: at });

test('N seat rows are N lines, for every N the couple can give (0…4)', () => {
  const pool = [open('s1', '2026-10-01'), named('s2', 'Ana', 'Cruz', '2026-10-02'), open('s3', '2026-10-03'), named('s4', 'Ben', 'Reyes', '2026-10-04')];
  for (let n = 0; n <= 4; n++) {
    assert.equal(plusOneSeatLines(BRINGER, pool.slice(0, n)).length, n, `${n} seat row(s) drew a different number of lines`);
  }
});

test('the lines are oldest first, a named seat says who, an unnamed one waits — whatever order the read returned', () => {
  const lines = plusOneSeatLines(BRINGER, [open('s-new', '2026-10-21T16:37:23Z'), named('s-old', 'Ana', 'Cruz', '2026-09-30T09:27:24Z')]);
  assert.deepEqual(lines, ['Bringing Ana Cruz', 'Awaiting +1 to confirm their name']);
  // A name the host typed on the row (no stamp) is a name — the List's own test (`plusOneHasNoName`) says so too.
  assert.deepEqual(plusOneSeatLines(BRINGER, [{ guest_id: 's', first_name: 'Leigh', last_name: 'Dimaunahan', plus_one_name_confirmed_at: null }]), ['Bringing Leigh Dimaunahan']);
  // A first name with the stand-in last ("Ben" / "+1") reads "Ben", never "Ben +1".
  assert.deepEqual(plusOneSeatLines(BRINGER, [named('s', 'Ben', '+1', '2026-10-01')]), ['Bringing Ben']);
});

/* ── 2 · the card draws every line, and a failure as a failure ───────────────────────────────────────────────────── */

const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };

function cardGuest(over: Partial<GuestRow>): GuestRow {
  return {
    guest_id: BRINGER, event_id: 'e1', first_name: 'Antonio', last_name: 'Loo', name_prefix: null, middle_name: null,
    name_suffix: null, display_name: null, role: 'guest', side: 'groom', rsvp_status: 'pending', group_category: 'family',
    meal_preference: 'no_preference', dietary_restrictions: null, invited_to_blocks: ['ceremony', 'reception'],
    custom_tags: [], extra_roles: [], plus_one_allowed: true, plus_one_count: 2, plus_one_of_guest_id: null, photo_consent: true,
    faceblock_enabled: false, face_recognition_excluded: false, passed_away: false, attire: 'neutral', seniority_rank: null,
    relation: null, email: null, notes: null, guest_note: null, qr_token: 'tok', mobile: null, entry_source: 'host_seeded',
    invitation_sent_at: null,
    ...over,
  } as unknown as GuestRow;
}

async function paintCard(guest: GuestRow, plusOneLines: readonly string[] | null, withKit: boolean): Promise<string> {
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { GuestCardBody } = await import('./guest-card-body');
  const kit = withKit ? (await import('./guest-card-template-kit')).TEMPLATE_KIT : undefined;
  const data = {
    isCouple: false, hasSides: true, availableRoles: ['guest'], groupOptions: ['family', 'other'], isIncWedding: false,
    showTeaCeremony: false, plusOneLines, plusOneGuestId: null, initialInvited: ['ceremony', 'reception'],
    seatedAt: null, customGroups: [], recordedAt: null, access: null, canManageAccess: true, offersThisIsMe: false,
    nameLinked: false, linkedAccount: null, profileName: null, roleNames: {}, tables: null, seatTableId: null, groupChoices: null,
    plusOneOf: null, guest,
  };
  const card = React.createElement(GuestCardBody as unknown as React.FC<Record<string, unknown>>, {
    eventId: 'e1', data, invitationBase: 'https://www.setnayan.com/cale-and-ice', photoDisplayUrl: null, variant: 'panel',
    headerShown: true, returnTo: '/dashboard/e1/guests', errorMessage: null, inviteFlash: null, ...(kit ? { kit } : {}),
  });
  return renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: ROUTER as never }, card));
}

const EMPTY = 'Allowed, but no +1 added yet.';
const UNREAD = 'Couldn’t read this guest’s +1s';
const has = (html: string, words: string) => html.includes(words) || html.includes(words.replace(/’/g, '&#x27;'));

for (const withKit of [false, true]) {
  const which = withKit ? 'the Guests page card (template kit)' : 'the Maker’s card (hand-drawn kit)';

  test(`${which}: a guest with two seats shows BOTH, numbered by seat — never "no +1 added yet"`, async () => {
    const lines = plusOneSeatLines(BRINGER, [named('s1', 'Ana', 'Cruz', '2026-10-01'), open('s2', '2026-10-02')]);
    const html = await paintCard(cardGuest({}), lines, withKit);
    assert.ok(html.includes('+1: Bringing Ana Cruz'), 'the first seat is not on the card');
    assert.ok(html.includes('+2: Awaiting +1 to confirm their name'), 'the second seat is not on the card');
    assert.ok(!has(html, EMPTY), 'a guest with two seats is told they have none');
  });

  test(`${which}: a refused seat read says so — it is never drawn as the empty state`, async () => {
    const html = await paintCard(cardGuest({}), null, withKit);
    assert.ok(has(html, UNREAD), 'a refused read is not said as a refused read');
    assert.ok(!has(html, EMPTY), 'a refused read was drawn as "no +1 added yet"');
  });

  test(`${which}: no seat row at all still reads the shipped empty line (the probe is not vacuous)`, async () => {
    const html = await paintCard(cardGuest({ plus_one_count: 1 }), [], withKit);
    assert.ok(has(html, EMPTY), 'the empty state disappeared — the two tests above would pass on a card that draws nothing');
    assert.ok(!has(html, UNREAD), 'an empty read is said as a refused one');
  });
}

test('the card’s loader turns a refused seat read into NULL — and reads every seat row, not one', () => {
  const src = stripComments(fs.readFileSync(path.join(__dirname, 'guest-card-data.ts'), 'utf8'));
  const assign = src.match(/plusOneLines\s*=\s*(\w+)\s*\?\s*null\s*:\s*plusOneSeatLines\(\s*guestId\s*,\s*(\w+)\s*\)/);
  assert.ok(assign, 'plusOneLines is not "refused ? null : every line"');
  const [, errName, listName] = assign;
  // The error is the one bound to the seat read's slot, and the list is built from that slot's data.
  const slot = src.match(new RegExp(`\\{\\s*data:\\s*(\\w+)\\s*,\\s*error:\\s*${errName}\\s*\\}`));
  assert.ok(slot, `${errName} is not the error of a read in the loader's Promise.all`);
  assert.match(src, new RegExp(`${listName}\\s*=\\s*\\(\\s*${slot[1]}\\s*\\?\\?\\s*\\[\\]\\s*\\)`), `${listName} is not built from ${slot[1]}`);
});

/* ── 3 · no +1 read anywhere is a single-row read ────────────────────────────────────────────────────────────────── */

/**
 * The ONE place a single row is the point: the add-guest form's older named +1 NAMES "the oldest waiting seat"
 * (`.order(created_at).limit(1)` — a writer picking one seat to fill, never a reader saying how many there are).
 */
const ONE_ROW_ON_PURPOSE = new Set(['app/dashboard/[eventId]/guests/new/actions.ts']);

function sources(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name === 'dev') continue;
      sources(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !/\.harness\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

test('no read of a guest’s +1 seats is a single-row read (`.maybeSingle()` / `.single()` on plus_one_of_guest_id)', () => {
  let chains = 0;
  const offenders: string[] = [];
  for (const file of [...sources(path.join(WEB, 'app')), ...sources(path.join(WEB, 'lib'))]) {
    const rel = path.relative(WEB, file).split(path.sep).join('/');
    const src = stripComments(fs.readFileSync(file, 'utf8'));
    const re = /\.(?:eq|in)\(\s*['"]plus_one_of_guest_id['"]/g;
    for (let m = re.exec(src); m; m = re.exec(src)) {
      chains += 1;
      // The rest of THIS query chain: up to the statement's end, the next query, or the next array slot.
      const rest = src.slice(m.index, m.index + 600);
      const end = rest.search(/;|\.from\(|\n\s*\]\)|\)\s*,\s*\n\s*(?:supabase|admin|db|client)\b/);
      const chain = end >= 0 ? rest.slice(0, end) : rest;
      if (/\.(?:maybeSingle|single)\(/.test(chain) && !ONE_ROW_ON_PURPOSE.has(rel)) offenders.push(`${rel}: ${chain.replace(/\s+/g, ' ').slice(0, 160)}`);
    }
  }
  assert.ok(chains >= 10, `only ${chains} +1 reads were scanned — the scan is not reading the app`);
  assert.deepEqual(offenders, [], `a guest's +1 seats are read as ONE row:\n${offenders.join('\n')}`);
  console.log(`[every-seat-is-on-the-card] ${chains} plus_one_of_guest_id reads scanned, ${offenders.length} single-row`);
});
