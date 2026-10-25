/**
 * an-unnamed-plus-one-has-no-name.test.ts — 🪪 AN UNNAMED +1 HAS NO NAME YET.
 *
 * Owner 2026-10-21, on the card of "dally BIR’s +1 · TBA": *"Why is the +1 listed as the +1's last name? when there is
 * no last name yet until we type on it or it is filled up by the guest via RSVP"* — and on the downloaded sheet: *"looking
 * at excel there are so many +1 without names which shouldn't be listed as such"*.
 *
 * An unnamed seat is STORED with stand-ins (`guests.first_name` / `last_name` are NOT NULL): "TBA" · "+1" · a "+1 · TBA"
 * Shown as. The seat engine keys on them, so they stay. The PROPERTY held here: they are never drawn, sent or saved as a
 * name somebody typed —
 *   1 · the guest card draws an unnamed seat's First, Last and Shown as EMPTY (posted empty), in BOTH kits, for every
 *       spelling of the stand-ins; a real person's name is drawn as stored;
 *   2 · a save never writes a stand-in as a typed name — for EVERY combination of posted boxes drawn from the stand-ins
 *       and blanks, an unnamed seat's name columns are not written; a typed name is written, the stand-in Shown as is
 *       cleared, and the seat is stamped named; a named seat emptied is refused, never cleared;
 *   3 · `updateGuest` asks `plusOneNameSave` and writes what it says (no second path to the name columns);
 *   4 · the Excel file: no unnamed seat is a row, no cell holds a stand-in as a name, a named +1 sits directly under
 *       their guest with "Guest of", and the file's people = the list's rows;
 *   5 · the invitation's greeting never says "TBA" / "+1"; a +1 named "Ben" reads "Ben", never "Ben +1".
 *
 * SABOTAGE (each seen RED, then restored — see the PR body): `seatNameAsTyped` returns the stored parts · the card's
 * First reads `guest.first_name` again · `plusOneNameSave` writes posted stand-ins · `exportRows` keeps unnamed seats ·
 * `exportRows` places named +1s by the caller's sort · `greetingName` stops skipping stand-ins · `updateGuest` stops
 * writing `plusOneNameSave`'s columns. 7 of 7 RED, restored GREEN (2026-10-21).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { GuestRow } from '@/lib/guests';
import { guestDisplayName, guestFullName } from '@/lib/guests';
import { plusOneNameSave, seatNameAsTyped } from '@/lib/extra-seats';
import { isPlaceholderNameWord } from '@/lib/seat-placeholder-words';
import { exportHeadcount, exportRows, guestListCsv, UTF8_BOM, type ExportGuest } from '@/lib/guest-export-file';
import { buildGuestInviteMessage } from '@/lib/guest-invite-message';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

// `server-only` / `client-only` resolve to an empty module (the-card-posts-the-same-form.test.ts does the same).
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_unnamed_plus_one__.js');
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

const WEB = join(__dirname, '..');
const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };

/** Every spelling of an unnamed seat the writers have ever stored (sync · RSVP · add-guest form · the pre-2026-09-29 label). */
const STAND_INS: Array<Pick<GuestRow, 'first_name' | 'last_name' | 'display_name'>> = [
  { first_name: 'TBA', last_name: '+1', display_name: '+1 · TBA' },
  { first_name: 'TBA', last_name: '+1', display_name: '+3 · TBA' },
  { first_name: 'TBA', last_name: '+1', display_name: '+ TBA · brought by Maria' },
  { first_name: 'TBA', last_name: '+1', display_name: '+ TBA 3 · brought by Maria' },
  { first_name: 'tba', last_name: '+1', display_name: null },
  { first_name: ' TBA ', last_name: ' +1 ', display_name: '' },
];

function row(over: Partial<GuestRow> = {}): GuestRow {
  return {
    guest_id: 'g-seat',
    event_id: 'e1',
    first_name: 'TBA',
    last_name: '+1',
    name_prefix: null,
    middle_name: null,
    name_suffix: null,
    display_name: '+1 · TBA',
    role: 'guest',
    side: 'groom',
    rsvp_status: 'pending',
    group_category: 'other',
    meal_preference: 'no_preference',
    dietary_restrictions: null,
    invited_to_blocks: [],
    custom_tags: [],
    extra_roles: [],
    plus_one_allowed: false,
    plus_one_count: 0,
    plus_one_of_guest_id: 'g-dally',
    photo_consent: true,
    faceblock_enabled: false,
    face_recognition_excluded: false,
    passed_away: false,
    attire: 'neutral',
    seniority_rank: null,
    relation: null,
    email: null,
    notes: null,
    guest_note: null,
    qr_token: 'tok',
    mobile: null,
    entry_source: 'host_seeded',
    invitation_sent_at: null,
    ...over,
  } as unknown as GuestRow;
}

const DATA = {
  isCouple: false,
  hasSides: true,
  availableRoles: ['guest'],
  groupOptions: ['other'],
  isIncWedding: false,
  showTeaCeremony: false,
  plusOneLines: [],
  plusOneGuestId: null,
  initialInvited: [] as string[],
  seatedAt: null,
  customGroups: [] as Array<{ label: string }>,
  recordedAt: null,
  access: null,
  canManageAccess: true,
  offersThisIsMe: false,
  nameLinked: false,
  linkedAccount: null,
  profileName: null,
  roleNames: {},
  tables: null,
  seatTableId: null,
  groupChoices: null,
  plusOneOf: { hostId: 'g-dally', hostName: 'dally BIR', name: 'dally BIR’s +1 · TBA', of: '+1 of dally BIR', side: 'groom' },
};

async function paint(g: GuestRow, withKit: boolean): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { GuestCardBody } = await import('@/app/dashboard/[eventId]/guests/_components/guest-card-body');
  const kit = withKit ? (await import('@/app/dashboard/[eventId]/guests/_components/guest-card-template-kit')).TEMPLATE_KIT : undefined;
  const card = React.createElement(GuestCardBody as unknown as React.FC<Record<string, unknown>>, {
    eventId: 'e1',
    data: { ...DATA, guest: g },
    invitationBase: 'https://www.setnayan.com/ana-and-ben',
    photoDisplayUrl: null,
    variant: 'panel',
    headerShown: true,
    returnTo: '/dashboard/e1/guests',
    errorMessage: null,
    inviteFlash: null,
    ...(kit ? { kit } : {}),
  });
  return renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: ROUTER as never }, card));
}

const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** The value the autosave form POSTS for `name` (the first input carrying it), as the browser would read it. */
function posted(html: string, name: string): string | null {
  const at = html.indexOf('name="quiet"');
  assert.ok(at > 0, 'the autosave form is not on the page');
  const form = html.slice(html.lastIndexOf('<form', at), html.indexOf('</form>', at));
  for (const m of form.matchAll(/<input\b[^>]*>/g)) {
    const tag = m[0];
    if (!new RegExp(`\\bname="${name}"`).test(tag)) continue;
    const v = /\bvalue="([^"]*)"/.exec(tag);
    return decode(v ? v[1]! : '');
  }
  return null;
}

/** The section of the card that draws the name (`data-guest-card-name`), as text a host reads. */
function nameSectionText(html: string): string {
  const at = html.indexOf('data-guest-card-name');
  assert.ok(at > 0, 'the card has no NAME section');
  /* RE-AIMED 2026-10-23: the name is the Basic Info group now (owner's groups) — it ends where the next group, Details, begins. */
  const end = html.indexOf('>Details<', at);
  assert.ok(end > at, 'the Details group no longer follows the name (the probe would read the whole card)');
  return decode(html.slice(at, end).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
}

/* ── 1 · the card ──────────────────────────────────────────────────────────────────────────────────────────────── */

test('1 · an unnamed +1’s First, Last and Shown as are EMPTY on the card — every stored spelling, both kits', async () => {
  for (const withKit of [false, true]) {
    for (const s of STAND_INS) {
      const html = await paint(row(s), withKit);
      const label = `${withKit ? 'templated' : 'Maker'} card, stored ${JSON.stringify(s)}`;
      for (const f of ['first_name', 'last_name', 'display_name']) {
        const v = posted(html, f);
        assert.notEqual(v, null, `${label}: ${f} is not on the form (the scan is blind)`);
        assert.equal(v, '', `${label}: ${f} is drawn as "${v}" — a stand-in shown as a typed name`);
      }
      assert.equal(posted(html, 'plus_one_seat'), '1', `${label}: the card does not say it drew a +1 seat — its empty name would be refused`);
      const text = nameSectionText(html);
      assert.doesNotMatch(text, /\bTBA\b/i, `${label}: the NAME section says TBA`);
      assert.doesNotMatch(text.replace(/\+63/g, ''), /\+\d/, `${label}: the NAME section says +1`);
      // Not "Required" in red on a seat nobody has named — the plain "Add".
      assert.doesNotMatch(text, /Required/, `${label}: an unnamed seat's empty name reads as an error`);
    }
  }
});

test('1b · anti-vacuity: a real person’s name, and a +1 named Ben, are drawn as stored', async () => {
  for (const withKit of [false, true]) {
    const ana = await paint(row({ first_name: 'Ana', last_name: 'Cruz', display_name: 'Tita Ana', plus_one_of_guest_id: null }), withKit);
    assert.equal(posted(ana, 'first_name'), 'Ana');
    assert.equal(posted(ana, 'last_name'), 'Cruz');
    assert.equal(posted(ana, 'display_name'), 'Tita Ana');
    assert.equal(posted(ana, 'plus_one_seat'), null, 'a guest who is not a +1 says they are a seat');
    // A guest who is not a +1 is never touched, even with the odd word "TBA" typed as a name.
    const odd = await paint(row({ first_name: 'TBA', last_name: 'Guest', display_name: null, plus_one_of_guest_id: null }), withKit);
    assert.equal(posted(odd, 'first_name'), 'TBA');
    // A +1 the guest named "Ben" (only a first name — the RSVP stored "+1" as the last): Ben, and an empty Last.
    const ben = await paint(row({ first_name: 'Ben', last_name: '+1', display_name: null }), withKit);
    assert.equal(posted(ben, 'first_name'), 'Ben');
    assert.equal(posted(ben, 'last_name'), '');
  }
});

/* ── 2 · the save ──────────────────────────────────────────────────────────────────────────────────────────────── */

const BOX_VALUES = ['', 'TBA', 'tba', '+1', '+2', '+1 · TBA', '+ TBA · brought by Maria'];
const STAMP = '2026-10-21T00:00:00.000Z';

test('2 · a save never writes a stand-in as a typed name — every posted combination over an unnamed seat', () => {
  let checked = 0;
  for (const s of STAND_INS) {
    const stored = { ...s, plus_one_of_guest_id: 'g-dally', plus_one_name_confirmed_at: null };
    for (const first of BOX_VALUES) {
      for (const last of BOX_VALUES) {
        for (const display of ['', '+1 · TBA', 'TBA +1']) {
          const out = plusOneNameSave(stored, { first_name: first, last_name: last, display_name: display || null }, STAMP);
          checked += 1;
          assert.ok(out, 'a +1 seat must be decided by plusOneNameSave');
          assert.equal(out.kind, 'unnamed', `posted ${JSON.stringify([first, last, display])} over an unnamed seat was taken as a name`);
          if (out.kind === 'unnamed') {
            assert.deepEqual(out.columns, {}, `posted ${JSON.stringify([first, last, display])} writes ${JSON.stringify(out.columns)}`);
          }
        }
      }
    }
  }
  assert.ok(checked > 400, `only ${checked} combinations — the sweep is blind`);
});

test('2b · a typed name IS written; its empty half keeps the stand-in; the "+1 · TBA" Shown as is cleared; the seat is stamped named', () => {
  const unnamed = { first_name: 'TBA', last_name: '+1', display_name: '+1 · TBA', plus_one_of_guest_id: 'g-dally', plus_one_name_confirmed_at: null };
  const ben = plusOneNameSave(unnamed, { first_name: 'Ben', last_name: '', display_name: null }, STAMP);
  assert.equal(ben?.kind, 'named');
  if (ben?.kind !== 'named') return;
  assert.deepEqual(ben.columns, { first_name: 'Ben', last_name: '+1', display_name: null, plus_one_name_confirmed_at: STAMP });
  assert.deepEqual(ben.force, ['display_name'], 'the stand-in Shown as must be cleared even though its box did not change');
  const full = plusOneNameSave(unnamed, { first_name: 'Ben', last_name: 'Reyes', display_name: 'TBA' }, STAMP);
  assert.deepEqual(full?.kind === 'named' && full.columns, { first_name: 'Ben', last_name: 'Reyes', display_name: null, plus_one_name_confirmed_at: STAMP });
  // A seat already named keeps its stamp; emptying a named seat is refused, never cleared.
  const named = { first_name: 'Ben', last_name: 'Reyes', display_name: null, plus_one_of_guest_id: 'g-dally', plus_one_name_confirmed_at: '2026-10-01' };
  const renamed = plusOneNameSave(named, { first_name: 'Benjie', last_name: 'Reyes', display_name: null }, STAMP);
  assert.ok(renamed?.kind === 'named' && !('plus_one_name_confirmed_at' in renamed.columns));
  for (const [f, l] of [['', ''], ['TBA', '+1']]) {
    assert.equal(plusOneNameSave(named, { first_name: f!, last_name: l!, display_name: null }, STAMP)?.kind, 'missing');
  }
  // Not a +1: decided the old way.
  assert.equal(plusOneNameSave({ first_name: 'Ana', last_name: 'Cruz', plus_one_of_guest_id: null }, { first_name: '', last_name: '', display_name: null }, STAMP), null);
  // Typed a "Shown as" on an unnamed seat — only that is written.
  const shown = plusOneNameSave(unnamed, { first_name: '', last_name: '', display_name: 'Tita Baby' }, STAMP);
  assert.deepEqual(shown, { kind: 'unnamed', columns: { display_name: 'Tita Baby' } });
});

test('2c · seatNameAsTyped: every stand-in empty on a +1, untouched for anyone else', () => {
  for (const s of STAND_INS) {
    assert.deepEqual(seatNameAsTyped({ ...s, plus_one_of_guest_id: 'g-dally' }), { first_name: '', last_name: '', display_name: '', unnamed: true });
  }
  assert.deepEqual(seatNameAsTyped({ first_name: 'TBA', last_name: '+1', display_name: '+1 · TBA', plus_one_of_guest_id: null }), {
    first_name: 'TBA',
    last_name: '+1',
    display_name: '+1 · TBA',
    unnamed: false,
  });
  for (const real of ['Ana', 'Tabatha', 'Tba-Lim', 'Benedict']) assert.equal(isPlaceholderNameWord('first', real), false, real);
  for (const real of ['Reyes', '1', '+63 917']) assert.equal(isPlaceholderNameWord('last', real), false, real);
});

/* ── 3 · updateGuest uses the decision ─────────────────────────────────────────────────────────────────────────── */

test('3 · updateGuest decides a +1’s name with plusOneNameSave, and writes only its columns', () => {
  const src = stripComments(readFileSync(join(WEB, 'app', 'dashboard', '[eventId]', 'guests', '[guestId]', 'actions.ts'), 'utf8'));
  const fn = src.slice(src.indexOf('export async function updateGuest('), src.indexOf('\nexport ', src.indexOf('export async function updateGuest(') + 10));
  assert.ok(fn.length > 2000, 'updateGuest not found');
  const decided = fn.indexOf('plusOneNameSave(');
  const write = fn.indexOf(".from('guests')\n    .update(");
  assert.ok(decided > 0, 'updateGuest no longer asks plusOneNameSave');
  assert.ok(write > decided, 'the guests write happens before the seat’s name is decided');
  // The seat branch replaces the posted first_name / last_name / display_name with the decision's columns.
  assert.match(
    fn,
    /delete wholeCard\.first_name;\s*delete wholeCard\.last_name;\s*delete wholeCard\.display_name;\s*Object\.assign\(wholeCard, seatName\.columns\)/,
    'the seat branch does not write plusOneNameSave’s columns (and only them)',
  );
  assert.ok(fn.indexOf('Object.assign(wholeCard, seatName.columns)') < write, 'the seat’s columns are set after the write');
  // The merge compares an unnamed seat in the card's own (empty) spelling.
  assert.match(fn, /guestCardMerge\([\s\S]{0,120}?comparedRow\)/, 'the merge reads the raw stand-ins as "another screen moved it"');
  assert.match(fn, /seatName\.force\.includes\(column\)/, 'a forced column (the stand-in Shown as) is not written');
});

/* ── 4 · the Excel file ────────────────────────────────────────────────────────────────────────────────────────── */

const eg = (over: Partial<ExportGuest>): ExportGuest => ({
  guest_id: 'x',
  name_prefix: null,
  first_name: 'Ana',
  middle_name: null,
  last_name: 'Reyes',
  name_suffix: null,
  side: 'bride',
  group_category: 'family',
  role: 'guest',
  plus_one_count: 0,
  mobile: null,
  rsvp_status: 'pending',
  plus_one_of_guest_id: null,
  display_name: null,
  ...over,
});
/** As the route hands it over: already sorted (last name), so every +1 seat sorts AWAY from their guest. */
const LIST: ExportGuest[] = [
  eg({ guest_id: 's1', first_name: 'TBA', last_name: '+1', display_name: '+1 · TBA', group_category: 'other', plus_one_of_guest_id: 'dally' }),
  eg({ guest_id: 's2', first_name: 'TBA', last_name: '+1', display_name: '+1 · TBA', group_category: 'other', plus_one_of_guest_id: 'kat' }),
  eg({ guest_id: 's3', first_name: 'Ben', last_name: '+1', group_category: 'other', plus_one_of_guest_id: 'kat' }),
  eg({ guest_id: 's4', first_name: 'TBA', last_name: '+1', display_name: '+ TBA · brought by Gone', plus_one_of_guest_id: 'gone' }),
  eg({ guest_id: 'kat', first_name: 'Kat', last_name: 'Arroyo', plus_one_count: 2 }),
  eg({ guest_id: 'dally', first_name: 'dally', last_name: 'BIR', plus_one_count: 2 }),
  eg({ guest_id: 's5', first_name: 'Rosa', last_name: 'Lim', plus_one_of_guest_id: 'dally' }),
  eg({ guest_id: 'rich', first_name: 'Rich', last_name: 'Aguila' }),
];

function sheet(csv: string): string[][] {
  return csv.replace(UTF8_BOM, '').split('\r\n').filter(Boolean).map((l) => l.split(','));
}

test('4 · Excel: no unnamed +1 is a row; no cell holds a stand-in as a name; a named +1 sits under their guest', () => {
  const rows = sheet(guestListCsv(LIST, { hasSides: true }));
  const head = rows[0]!;
  const at = (h: string) => head.indexOf(h);
  for (const h of ['First name', 'Last name', 'Their guests (+)', 'Guest of']) assert.ok(at(h) >= 0, `no ${h} column`);
  const body = rows.slice(1);
  const names = body.map((r) => `${r[at('First name')]} ${r[at('Last name')]}`.trim());
  for (const r of body) {
    for (const h of ['First name', 'Last name']) {
      const v = (r[at(h)] ?? '').replace(/^'/, '');
      assert.ok(!isPlaceholderNameWord(h === 'First name' ? 'first' : 'last', v), `a ${h} cell holds the stand-in "${r[at(h)]}"`);
    }
  }
  assert.deepEqual(names, ['Kat Arroyo', 'Ben', 'dally BIR', 'Rosa Lim', 'Rich Aguila'], 'the rows, in order');
  const guestOf = body.map((r) => r[at('Guest of')]);
  assert.deepEqual(guestOf, ['', 'Kat Arroyo', '', 'dally BIR', '']);
  assert.deepEqual(body.map((r) => r[at('Their guests (+)')]), ['2', '0', '2', '0', '0'], 'the guest’s own number — the column an upload writes back');
});

test('4b · Excel: the file’s people = the list’s rows (no +1 counted twice, none lost)', () => {
  // The list as the app counts it: every live row. The orphan seat (its guest removed) is the one row a file cannot carry.
  const listed = LIST.filter((g) => g.plus_one_of_guest_id !== 'gone').length;
  const rows = exportRows(LIST);
  assert.equal(exportHeadcount(rows), listed, `file says ${exportHeadcount(rows)} people, the list has ${listed}`);
  // Anti-vacuity: counting the named +1 rows AND their guest's number would be one too many per named +1.
  const naive = rows.reduce((n, r) => n + 1 + (r.g.plus_one_count ?? 0), 0);
  assert.equal(naive, listed + 2, 'the fixture no longer has two named +1s under a guest');
});

/* ── 5 · the greeting and the compact name ─────────────────────────────────────────────────────────────────────── */

test('5 · the invitation never greets "TBA" or "+1"; a +1 named Ben reads Ben', () => {
  const g = { first_name: 'TBA', last_name: '+1', display_name: '+1 · TBA', name_prefix: null, middle_name: null, name_suffix: null };
  const msg = buildGuestInviteMessage({
    formalName: g.display_name,
    firstName: g.first_name,
    guestName: guestDisplayName(g),
    inviteUrl: 'https://www.setnayan.com/x/i/tok',
    eventName: 'Ana & Ben',
  } as Parameters<typeof buildGuestInviteMessage>[0]);
  assert.ok(msg, 'no message');
  const firstLine = msg.split('\n')[0]!;
  assert.doesNotMatch(firstLine, /TBA|\+1/i, `the greeting is "${firstLine}"`);
  assert.match(firstLine, /^Hi!/, `the greeting is "${firstLine}"`);
  // Formal spellings too ("TBA +1" from the five parts).
  const formal = buildGuestInviteMessage({ formalName: guestFullName({ ...g, display_name: null }), firstName: 'TBA', guestName: 'TBA +1', inviteUrl: 'https://www.setnayan.com/x/i/tok' } as Parameters<typeof buildGuestInviteMessage>[0]);
  assert.doesNotMatch(formal!.split('\n')[0]!, /TBA|\+1/i);
  // A real name still greets.
  const ana = buildGuestInviteMessage({ formalName: 'Ana Cruz', firstName: 'Ana', guestName: 'Ana Cruz', inviteUrl: 'https://www.setnayan.com/x/i/tok' } as Parameters<typeof buildGuestInviteMessage>[0]);
  assert.match(ana!.split('\n')[0]!, /^Hi Ana Cruz!/);
  assert.equal(guestDisplayName({ first_name: 'Ben', last_name: '+1', display_name: null }), 'Ben');
  assert.equal(guestFullName({ first_name: 'Ben', last_name: '+1', name_prefix: null }), 'Ben');
  assert.equal(guestDisplayName({ first_name: 'TBA', last_name: 'Reyes', display_name: null }), 'Reyes');
  // Both stand-ins: unchanged (the callers' own fallbacks, e.g. the seat label).
  assert.equal(guestDisplayName({ first_name: 'TBA', last_name: '+1', display_name: null }), 'TBA +1');
});
