/**
 * 🚫 A +1 BRINGS NO +1 — owner, verbatim, 2026-10-21: *"a +1 of a guest cannot have their own +1."*
 * (desktop Guests, the card of "Ms. pamela mitra labriaga · +1 of Pam" open, its RSVP showing "Extra seats ▾ None").
 *
 * A +1 is a guest row whose `plus_one_of_guest_id` names who brings them (`isAPlusOne`, lib/guests.ts). The PROPERTY:
 * nothing — no screen, no writer — gives such a row a +1 of their own. Held in four layers, each tested here by what it
 * DOES (rendered markup, a planned import, a refused write), never by how its source is spelled:
 *
 *   1 · the reading     — `plusOneSeats` is 0 for a +1 whatever the row says, so the List's "+N" chip, the head counts
 *                         and the reply's "and N guests" never count one;
 *   2 · the screens     — the guest card draws one quiet line instead of the "Extra seats" pick and posts 0; the +1's
 *                         own reply never draws the plus-ones block; a normal guest's card and reply are unchanged;
 *   3 · the writers     — `checkExtraSeats` (the card, the List's inline number, the quick add, a claim) refuses a +1
 *                         anything above 0, `syncExtraSeats` never mints a seat under one, the import shows the row for a
 *                         look instead of writing it, and the reply's `nameTheSeats` refuses before any mint; and every
 *                         file that writes seats must route through `checkExtraSeats` or say here why it need not;
 *   4 · the database    — tests/db/a-plus-one-brings-no-plus-one.db.test.ts (the CHECK, the trigger, the mint).
 *
 * 🛡 SABOTAGED, each seen RED, then restored (2026-10-21) — see the PR body for the run.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';

import { BASE, GUEST, renderReplyCard } from './reply-card.fixture';
import { A_PLUS_ONE_BRINGS_NO_ONE, isAPlusOne, plusOneSeats, type GuestRow } from './guests';
import { planGuestImport, readGuestFile, type ExistingGuest } from './guest-import-file';
import { WEDDING_ROLE_SET } from './role-sets';
import { stripComments } from './strip-comments';

const WEB = path.join(__dirname, '..');
const BRINGER = 'g-pam';

/* ── 1 · the reading ─────────────────────────────────────────────────────────────────────────────────────────────── */

test('a +1 is the row whose plus_one_of_guest_id is set — and they read as bringing nobody, whatever the row says', () => {
  assert.equal(isAPlusOne({ plus_one_of_guest_id: BRINGER }), true);
  assert.equal(isAPlusOne({ plus_one_of_guest_id: null }), false);
  assert.equal(isAPlusOne({}), false);
  // A stale row (written before the rule) still reads 0 — the chip, the counts and the reply follow this.
  assert.equal(plusOneSeats({ plus_one_of_guest_id: BRINGER, plus_one_count: 3, plus_one_allowed: true }), 0);
  assert.equal(plusOneSeats({ plus_one_of_guest_id: BRINGER, plus_one_allowed: true }), 0);
  // …and a guest keeps their number (anti-vacuity).
  assert.equal(plusOneSeats({ plus_one_of_guest_id: null, plus_one_count: 3, plus_one_allowed: true }), 3);
  assert.equal(plusOneSeats({ plus_one_allowed: true }), 1);
});

/* ── 2 · the screens ─────────────────────────────────────────────────────────────────────────────────────────────── */

const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };

function cardGuest(over: Partial<GuestRow>): GuestRow {
  return {
    guest_id: 'g-pamela', event_id: 'e1', first_name: 'pamela', last_name: 'labriaga', name_prefix: 'Ms.', middle_name: 'mitra',
    name_suffix: null, display_name: null, role: 'guest', side: 'groom', rsvp_status: 'pending', group_category: 'work',
    meal_preference: 'no_preference', dietary_restrictions: null, invited_to_blocks: ['ceremony', 'reception', 'cocktails'],
    custom_tags: [], extra_roles: [], plus_one_allowed: false, plus_one_count: 0, plus_one_of_guest_id: null, photo_consent: false,
    faceblock_enabled: false, face_recognition_excluded: false, passed_away: false, attire: 'neutral', seniority_rank: null,
    relation: null, email: null, notes: null, guest_note: null, qr_token: 'tok', mobile: null, entry_source: 'host_seeded',
    invitation_sent_at: null,
    ...over,
  } as unknown as GuestRow;
}

async function paintCard(guest: GuestRow, withKit: boolean, plusOneOf: unknown = null): Promise<string> {
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { GuestCardBody } = await import('../app/dashboard/[eventId]/guests/_components/guest-card-body');
  const kit = withKit ? (await import('../app/dashboard/[eventId]/guests/_components/guest-card-template-kit')).TEMPLATE_KIT : undefined;
  const data = {
    isCouple: false, hasSides: true, availableRoles: ['guest'], groupOptions: ['work', 'other'], isIncWedding: false,
    showTeaCeremony: false, plusOneStateLabel: null, plusOneGuestId: null, initialInvited: ['ceremony', 'reception', 'cocktails'],
    seatedAt: null, customGroups: [], recordedAt: null, access: null, canManageAccess: true, offersThisIsMe: false,
    nameLinked: false, linkedAccount: null, profileName: null, roleNames: {}, tables: null, seatTableId: null, groupChoices: null,
    plusOneOf, guest,
  };
  const card = React.createElement(GuestCardBody as unknown as React.FC<Record<string, unknown>>, {
    eventId: 'e1', data, invitationBase: 'https://www.setnayan.com/pam-and-co', photoDisplayUrl: null, variant: 'panel',
    headerShown: true, returnTo: '/dashboard/e1/guests', errorMessage: null, inviteFlash: null, ...(kit ? { kit } : {}),
  });
  return renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: ROUTER as never }, card));
}

/** Every control posting `plus_one_count`, as its opening tag. */
const seatControls = (html: string) => html.match(/<(?:input|select|button)\b[^>]*name="plus_one_count"[^>]*>/g) ?? [];
/** The "+1 … +4" choices a seat pick offers (a PickMenu option, a select option or a radio). */
const offersSeats = (html: string) => /(?:>|")\+[1-4](?:<|")/.test(html);
/** The section of the card that holds the seats — "Seats and food" up to the next fold. */
const seatsAndFood = (html: string) => {
  const at = html.indexOf('Seats and food');
  assert.ok(at > 0, 'the card lost its "Seats and food" section (the probe would read nothing)');
  return html.slice(at, at + 6000);
};

for (const withKit of [false, true]) {
  const which = withKit ? 'the Guests page card (template kit)' : 'the Maker’s card (hand-drawn kit)';

  test(`${which}: a +1's card says one quiet line where "Extra seats" was, and posts 0`, async () => {
    const plusOne = cardGuest({ plus_one_of_guest_id: BRINGER });
    const html = await paintCard(plusOne, withKit, { hostId: BRINGER, hostName: 'Pam', name: null, of: '+1 of Pam', side: 'groom' });
    assert.ok(html.includes(A_PLUS_ONE_BRINGS_NO_ONE.replace('’', '&#x27;')) || html.includes(A_PLUS_ONE_BRINGS_NO_ONE), 'the +1’s card does not say a +1 can’t bring their own +1');
    const controls = seatControls(html);
    assert.equal(controls.length, 1, `a +1's card must post plus_one_count exactly once (found ${controls.length})`);
    assert.match(controls[0]!, /type="hidden"/, 'a +1’s seats are a control they could change');
    assert.match(controls[0]!, /value="0"/, 'a +1’s card posts a number other than 0');
    assert.ok(!offersSeats(seatsAndFood(html)), 'a +1’s card still offers +1 … +4');
  });

  test(`${which}: a stale +1 row (a number left from before the rule) still offers nothing and posts 0`, async () => {
    const stale = cardGuest({ plus_one_of_guest_id: BRINGER, plus_one_count: 2, plus_one_allowed: true });
    const html = await paintCard(stale, withKit);
    const controls = seatControls(html);
    assert.equal(controls.length, 1);
    assert.match(controls[0]!, /value="0"/, 'a stale +1 row posts its old number back');
    assert.ok(!offersSeats(seatsAndFood(html)), 'a stale +1 row still offers +1 … +4');
    assert.ok(!html.includes('Allowed, but no +1 added yet.'), 'a +1 is told they are allowed a +1');
  });

  test(`${which}: a normal guest's card is unchanged — the Extra seats pick, its five choices, no +1 line`, async () => {
    const html = await paintCard(cardGuest({ plus_one_count: 1, plus_one_allowed: true }), withKit);
    assert.ok(!html.includes(A_PLUS_ONE_BRINGS_NO_ONE.replace('’', '&#x27;')) && !html.includes(A_PLUS_ONE_BRINGS_NO_ONE), 'a guest is told they are a +1');
    assert.ok(html.includes('Extra seats'), 'the guest lost the Extra seats pick');
    assert.ok(offersSeats(seatsAndFood(html)), 'a guest’s Extra seats no longer offers +1 … +4 (the probe would pass vacuously)');
    const controls = seatControls(html);
    assert.ok(controls.length >= 1 && controls.every((t) => !/value="0"/.test(t) || /type="radio"/.test(t)) , 'a guest with +1 posts 0');
  });
}

test('the +1’s own reply never offers a +1 of their own — even from a stale row; a guest’s reply still does', async () => {
  const askAll = { ...BASE, doorAction: async () => {} };
  const guestHtml = await renderReplyCard({ ...askAll, guest: { ...GUEST, plus_one_allowed: true, plus_one_count: 1, plus_one_of_guest_id: null } });
  assert.match(guestHtml, /id="plus-ones"/, 'a guest allowed a +1 is not asked their name (the probe would pass vacuously)');
  const plusHtml = await renderReplyCard({ ...askAll, guest: { ...GUEST, plus_one_allowed: true, plus_one_count: 1, plus_one_of_guest_id: BRINGER } });
  assert.doesNotMatch(plusHtml, /id="plus-ones"/, 'a +1’s own reply offers them a +1');
  assert.doesNotMatch(plusHtml, /name="plus_one_first_name_1"/, 'a +1’s own reply carries a seat-name box');
});

/* ── 3 · the writers ─────────────────────────────────────────────────────────────────────────────────────────────── */

type Row = Record<string, unknown>;
/** The smallest Supabase stand-in `checkExtraSeats` / `syncExtraSeats` need: guests by id, their seats, an open list. */
function fakeDb(primary: Row, seats: Row[] = []) {
  const writes: Array<{ table: string; op: string; row: unknown }> = [];
  const builder = (table: string) => {
    const filters: Record<string, unknown> = {};
    const read = () => {
      if (table === 'events') return { data: { guest_count_locked_at: null, guest_list_edit_deadline: null, event_date: null }, error: null };
      if ('plus_one_of_guest_id' in filters) return { data: seats, error: null };
      return { data: primary, error: null };
    };
    const b: Record<string, unknown> = {
      select: () => b,
      eq: (k: string, v: unknown) => ((filters[k] = v), b),
      in: (k: string, v: unknown) => ((filters[k] = v), b),
      neq: () => b,
      is: () => b,
      order: () => b,
      maybeSingle: async () => read(),
      insert: async (row: unknown) => (writes.push({ table, op: 'insert', row }), { error: null }),
      update: (row: unknown) => (writes.push({ table, op: 'update', row }), b),
      delete: () => (writes.push({ table, op: 'delete', row: null }), b),
      then: (ok: (v: unknown) => unknown) => Promise.resolve(read()).then(ok),
    };
    return b;
  };
  return { client: { from: builder, rpc: async () => ({ data: null, error: null }) }, writes };
}

const PRIMARY = { guest_id: 'g-pamela', first_name: 'pamela', side: 'groom', group_category: 'work', invited_to_blocks: null };

test('checkExtraSeats — every host writer’s gate — refuses a +1 any seat, and lets a guest have theirs', async () => {
  const { checkExtraSeats } = await import('./extra-seats-sync');
  const plusOne = fakeDb({ ...PRIMARY, plus_one_count: 0, plus_one_of_guest_id: BRINGER });
  for (const want of [1, 2, 4, (now: number) => Math.max(1, now)] as const) {
    const res = await checkExtraSeats(plusOne.client as never, 'e1', 'g-pamela', want);
    assert.deepEqual(res, { ok: false, error: A_PLUS_ONE_BRINGS_NO_ONE }, `a +1 was allowed ${typeof want === 'number' ? `+${want}` : 'the old on-box'}`);
  }
  assert.deepEqual(await checkExtraSeats(plusOne.client as never, 'e1', 'g-pamela', 0), { ok: true }, 'a +1 cannot be saved at none');
  const guest = fakeDb({ ...PRIMARY, plus_one_count: 0, plus_one_of_guest_id: null });
  assert.deepEqual(await checkExtraSeats(guest.client as never, 'e1', 'g-pamela', 2), { ok: true }, 'a guest was refused their +2 (the gate would pass vacuously)');
});

test('syncExtraSeats never mints a seat under a +1 — even from a stale number — and still does for a guest', async () => {
  const { syncExtraSeats } = await import('./extra-seats-sync');
  const plusOne = fakeDb({ ...PRIMARY, plus_one_count: 2, plus_one_of_guest_id: BRINGER });
  const res = await syncExtraSeats(plusOne.client as never, 'e1', 'g-pamela');
  assert.equal(res.ok, true);
  assert.deepEqual(plusOne.writes.filter((w) => w.op === 'insert'), [], 'a seat row was minted under a +1');
  const guest = fakeDb({ ...PRIMARY, plus_one_count: 2, plus_one_of_guest_id: null });
  await syncExtraSeats(guest.client as never, 'e1', 'g-pamela').catch(() => null);
  const minted = guest.writes.filter((w) => w.op === 'insert' && w.table === 'guests');
  assert.equal(minted.length, 1, 'a guest’s +2 minted no seats (the probe would pass vacuously)');
  assert.equal((minted[0]!.row as unknown[]).length, 2);
});

test('the import never gives a +1 extra seats — the row waits for a look; the same file still gives a guest theirs', () => {
  const existing = (over: Partial<ExistingGuest>): ExistingGuest => ({
    guest_id: 'g-paul', first_name: 'Paul', last_name: 'Ang', name_prefix: null, middle_name: null, name_suffix: null,
    side: 'groom', group_category: 'other', role: 'guest', mobile: null, plus_one_count: 0, ...over,
  });
  const ctx = (rows: ExistingGuest[]) => ({ offeredRoles: WEDDING_ROLE_SET.offeredRoles, singletonRoles: WEDDING_ROLE_SET.singletonRoles, hasSides: true, existing: rows });
  const file = readGuestFile('First name,Last name,Their guests (+)\nPaul,Ang,1\n');
  const asPlusOne = planGuestImport(file, ctx([existing({ plus_one_of_guest_id: 'g-anne' })])).rows[0]!;
  assert.equal(asPlusOne.status, 'look', 'the import would give a +1 a +1');
  assert.equal(asPlusOne.patch, undefined);
  assert.ok(asPlusOne.reason?.includes(A_PLUS_ONE_BRINGS_NO_ONE), 'the look does not say why');
  const asGuest = planGuestImport(file, ctx([existing({ plus_one_of_guest_id: null })])).rows[0]!;
  assert.equal(asGuest.status, 'changed', 'a guest’s +1 from the file was dropped (the probe would pass vacuously)');
  assert.equal(asGuest.patch?.plus_one_count, 1);
  // A +1 the file leaves at none is no look at all.
  const none = planGuestImport(readGuestFile('First name,Last name,Their guests (+)\nPaul,Ang,0\n'), ctx([existing({ plus_one_of_guest_id: 'g-anne' })])).rows[0]!;
  assert.equal(none.status, 'same');
});

/* Which files write a guest's seats: a call to the seat sync or the mint, or an `.update(…)` / `.insert(…)` /
   `.upsert(…)` whose argument sets the number. Each must ask `checkExtraSeats` (the one gate that knows a +1), or say
   why not. A type or a select that merely NAMES the column is not a write. */
const SEAT_CALL = /\bsyncExtraSeats\s*\(|guest_plus_one_seat_mint/;
const writesSeats = (src: string) =>
  SEAT_CALL.test(src) ||
  [...src.matchAll(/\.(?:update|insert|upsert)\(/g)].some((m) => /\bplus_one_(?:count|allowed)\s*:/.test(src.slice(m.index!, m.index! + 400).split(/\)\s*\n?\s*\.(?:eq|in|select|match)\(/)[0]!));
const NEEDS_NO_GATE: Record<string, string> = {
  'lib/extra-seats-sync.ts': 'the gate itself — and `syncExtraSeats` plans 0 for a +1 (tested above)',
  'lib/extra-seats.ts': 'pure planning, no write',
  'lib/guest-import-file.ts': 'the import plan — refuses a +1 row (tested above)',
  'app/dashboard/[eventId]/guests/import/actions.ts': 'writes only what `planGuestImport` planned (tested above)',
  'app/dashboard/[eventId]/guests/new/actions.ts': 'inserts a NEW guest, who is never a +1; the +1 it may add is inserted at 0',
  'app/[slug]/actions.ts': '`nameTheSeats` refuses a +1 bringer before any mint (checked below), and the mint answers bringer_is_plus_one',
};

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next' || p.endsWith(path.join('app', 'dev'))) continue;
      out.push(...sourceFiles(p));
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|fixture|harness)\./.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/** A file's code with its comments gone, so a docblock that names the column is not a write. */
const code = (src: string) => stripComments(src);

test('every server writer of a guest’s seats asks the +1 gate — or is named here with its reason', () => {
  const writers: string[] = [];
  for (const file of [...sourceFiles(path.join(WEB, 'app')), ...sourceFiles(path.join(WEB, 'lib'))]) {
    const src = code(fs.readFileSync(file, 'utf8'));
    if (!writesSeats(src)) continue;
    const rel = path.relative(WEB, file).split(path.sep).join('/');
    writers.push(rel);
    if (rel in NEEDS_NO_GATE) continue;
    assert.match(src, /\bcheckExtraSeats\s*\(/, `${rel} writes a guest's seats without asking checkExtraSeats — a +1 could be given a +1`);
  }
  // Anti-vacuity: the scan sees the writers it was written for.
  for (const known of ['app/dashboard/[eventId]/guests/inline-actions.ts', 'app/dashboard/[eventId]/guests/[guestId]/actions.ts', 'app/dashboard/[eventId]/guests/claims/actions.ts']) {
    assert.ok(writers.includes(known), `the scan no longer sees ${known} — it would pass vacuously`);
  }
  for (const named of Object.keys(NEEDS_NO_GATE)) assert.ok(fs.existsSync(path.join(WEB, named)), `${named} is excused but no longer exists — drop its line`);
});

test('the reply refuses a +1 bringer BEFORE it reads or mints a seat', () => {
  const src = code(fs.readFileSync(path.join(WEB, 'app/[slug]/actions.ts'), 'utf8'));
  const body = src.slice(src.indexOf('async function nameTheSeats('));
  assert.ok(body.length > 0 && src.includes('async function nameTheSeats('), 'nameTheSeats moved — re-aim this check');
  const refuse = body.search(/isAPlusOne\(primary\)\)\s*return\s*\{\s*ok:\s*false/);
  const mint = body.indexOf("rpc('guest_plus_one_seat_mint'");
  assert.ok(refuse > 0, 'nameTheSeats no longer refuses a +1 bringer');
  assert.ok(mint > 0 && refuse < mint, 'nameTheSeats mints before it refuses a +1');
  assert.match(body.slice(0, refuse), /\.select\([^)]*plus_one_of_guest_id/, 'the bringer read does not carry plus_one_of_guest_id — the refusal could never fire');
});
