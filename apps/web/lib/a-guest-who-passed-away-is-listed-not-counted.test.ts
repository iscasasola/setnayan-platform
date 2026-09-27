/**
 * 🕯 A GUEST WHO PASSED AWAY IS LISTED, NEVER COUNTED (owner, 2026-09-25,
 * DECISION_LOG "PRINT CONTENT COMES FROM WHERE IT ALREADY LIVES", verbatim:
 * *"a button of passed can be placed there … If passed away already, then not
 * counted on the guestlist. but listed."*).
 *
 * The couple ticks "Passed away" on the guest card (`guests.passed_away`,
 * migration 20271249859363). That person stays on the guest list and prints as
 * "the late <name>" in the parents' lines, and is never counted (headcount,
 * pax, RSVP totals, caterer, supplier brief, seat plan, Papic pool), never
 * seated and never sent an invitation.
 *
 * 🔑 THE SWEEP IS A PROPERTY, NOT A LIST. Every reader that leaves a REQUEST out
 * of a count (`.neq('entry_source', REQUEST_ENTRY_SOURCE)`, lib/guests.ts) is by
 * definition a reader that counts — so every one of them must ALSO leave out a
 * guest who passed away. A counting reader added tomorrow with the request rule
 * and without this one goes red here without anybody updating a list. The SQL
 * half is behavioural in tests/db/a-guest-who-passed-away-is-listed-not-counted.db.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { computeGuestStats, countsTowardEvent, PASSED_AWAY, type GuestRow } from '@/lib/guests';
import { parentLine } from '@/lib/print-pieces';
import { registryRows, registryTotals, type RegistryGuest } from '@/lib/print-guest-registry';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(relative(WEB, full));
  }
  return out;
}

test('the rule: a guest marked Passed away does not count; everyone else (and a bare fixture) does', () => {
  assert.equal(PASSED_AWAY, 'passed_away');
  assert.equal(countsTowardEvent({ passed_away: true }), false);
  assert.equal(countsTowardEvent({ passed_away: false }), true);
  assert.equal(countsTowardEvent({ passed_away: null }), true);
  assert.equal(countsTowardEvent({}), true, 'a fixture with no flag reads as living');
  // The two rules compose — neither undoes the other.
  assert.equal(countsTowardEvent({ entry_source: 'self_added_unlisted', passed_away: false }), false);
});

test('computeGuestStats leaves a guest who passed away out of every number', () => {
  const row = (rsvp: GuestRow['rsvp_status'], passed: boolean, plus = 0) =>
    ({ rsvp_status: rsvp, passed_away: passed, plus_one_count: plus, plus_one_allowed: plus > 0 }) as unknown as GuestRow;
  const stats = computeGuestStats([
    row('attending', false),
    row('pending', false),
    row('attending', true, 1),
    row('pending', true),
  ]);
  assert.equal(stats.total, 2);
  assert.equal(stats.attending, 1);
  assert.equal(stats.pending, 1);
  assert.equal(stats.plus_ones, 0, 'the seats of a guest who passed away were counted');
});

test('the guest list reads the LIVING list by default; only the roster and the desk registry list them', () => {
  const guests = read('lib/guests.ts');
  const fetch = guests.slice(guests.indexOf('export async function fetchGuestsByEventMeasured'));
  assert.match(fetch.slice(0, 1200), /if \(!opts\.includePassedAway\) q = q\.eq\(PASSED_AWAY, false\);/);
  const count = guests.slice(guests.indexOf('export async function countGuestsByEvent'));
  assert.match(count.slice(0, 800), /\.eq\(PASSED_AWAY, false\)/, 'the sidebar guest total counts a guest who passed away');

  const optIns = sources(join(WEB, 'app'))
    .concat(sources(join(WEB, 'lib')))
    .filter((f) => /includePassedAway:\s*true/.test(read(f)))
    .sort();
  assert.deepEqual(
    optIns,
    ['app/api/hub-print/[piece]/route.ts', 'app/dashboard/[eventId]/guests/page.tsx'],
    'a reader that COUNTS, SEATS or SENDS opted in to the guests who passed away',
  );
});

test('every reader that leaves a request out of a count also leaves out a guest who passed away', () => {
  const NEQ = ".neq('entry_source', REQUEST_ENTRY_SOURCE)";
  let checked = 0;
  const missing: string[] = [];
  for (const f of sources(join(WEB, 'app')).concat(sources(join(WEB, 'lib')))) {
    const src = read(f);
    let at = src.indexOf(NEQ);
    while (at !== -1) {
      const before = src.slice(Math.max(0, at - 8), at);
      const after = src.slice(at + NEQ.length, at + NEQ.length + 60);
      // lib/guests.ts's roster switch applies the two rules on two lines, each
      // behind its own opt-in — asserted in the test above.
      const rosterSwitch = f === 'lib/guests.ts' && /q = q$/.test(before);
      if (!rosterSwitch) {
        checked += 1;
        if (!/^\s*\.eq\(PASSED_AWAY, false\)/.test(after)) missing.push(`${f}: …${NEQ}${after.split('\n')[0]}`);
      }
      at = src.indexOf(NEQ, at + NEQ.length);
    }
  }
  assert.ok(checked >= 16, `only ${checked} counting readers found — the sweep lost its targets`);
  assert.deepEqual(missing, [], 'these counting readers still count a guest who passed away');
});

test('no invitation or Save the Date is emailed to a guest who passed away', () => {
  const fanOut = read('lib/save-the-date-emails.ts');
  assert.equal((fanOut.match(/\.eq\(PASSED_AWAY, false\)/g) ?? []).length, 2, 'the STD or the invitation fan-out emails them');
  const card = read('app/dashboard/[eventId]/guests/[guestId]/actions.ts');
  const invite = card.slice(card.indexOf('export async function inviteGuestByEmailAction'), card.indexOf('export async function updateGuest'));
  assert.match(invite, /\.select\('[^']*\bpassed_away\b[^']*'\)/, 'the sign-in-link email does not read the flag');
  assert.match(invite, /if \(guest\?\.passed_away === true\) \{\s*return redirect\(/, 'the sign-in-link email is sent to them');
});

test('the guest card is where the couple sets it — never for the couple themselves', () => {
  const body = read('app/dashboard/[eventId]/guests/_components/guest-card-body.tsx');
  const toggle = /\{isCouple \? null : \(\s*<Toggle\s+name="passed_away"/;
  assert.match(body, toggle, 'the Passed away toggle is missing, or offered to the bride and groom');
  assert.match(body, /label="Passed away"/);
  const action = read('app/dashboard/[eventId]/guests/[guestId]/actions.ts');
  assert.match(
    action,
    /const passed_away =\s*role !== 'bride' && role !== 'groom' && clean\(formData\.get\('passed_away'\)\) === 'on';/,
    'updateGuest no longer reads the toggle, or lets the couple carry it',
  );
  const update = action.slice(action.indexOf(".from('guests')\n    .update({"));
  assert.match(update.slice(0, 900), /\bpassed_away,/, 'updateGuest reads the toggle and never writes it');
  // Anchored on the passed-away branch itself — `softDeleteGuest` releases a
  // seat with the same statement, so a file-wide match would stay green.
  const release = action.slice(action.indexOf('if (passedAwayMoved && passed_away) {'));
  assert.ok(release.length > 0 && action.includes('if (passedAwayMoved && passed_away) {'), 'the passed-away seat release is gone');
  assert.match(
    release.slice(0, 400),
    /^if \(passedAwayMoved && passed_away\) \{\s*const \{ error: seatError \} = await supabase\s*\.from\('event_seat_assignments'\)\s*\.delete\(\)\s*\.eq\('event_id', eventId\)\s*\.eq\('guest_id', guestId\)/,
    'a chair is kept for a guest who passed away',
  );
});

test('the prints: "the late <name>" in the parents’ lines, and "In loving memory" at the desk, counted nowhere', () => {
  assert.equal(parentLine({ name: 'Rosa Cruz', deceased: true, side: 'bride' }), 'the late Rosa Cruz');
  assert.equal(parentLine({ name: 'Rosa Cruz', deceased: false, side: 'bride' }), 'Rosa Cruz');

  const set = read('lib/print-set.server.ts');
  assert.match(set, /deceased: p\.id !== null && passedAway\.has\(p\.id\)/, 'the parents’ lines never read the flag');
  assert.match(set, /\.select\(`\$\{ENTOURAGE_COLUMNS\}, \$\{PASSED_AWAY\}`\)/, 'the entourage read for the prints does not select the flag');

  const g = (id: string, first: string, passed: boolean): RegistryGuest => ({
    guest_id: id,
    first_name: first,
    last_name: 'Cruz',
    display_name: null,
    name_suffix: null,
    role: 'guest',
    rsvp_status: 'attending',
    plus_one_count: 0,
    plus_one_allowed: false,
    plus_one_of_guest_id: null,
    passed_away: passed,
  });
  const rows = registryRows([g('a', 'Ana', false), g('b', 'Rosa', true)], new Map());
  assert.equal(rows.length, 2, 'the desk dropped the name');
  const rosa = rows.find((r) => r.guestId === 'b')!;
  assert.equal(rosa.counted, false);
  assert.equal(rosa.party, null);
  assert.equal(rosa.rsvp, 'In loving memory');
  assert.equal(registryTotals(rows).people, 1);
});

test('the SQL readers are rewritten with the rule — and only with the rule', () => {
  const mig = readFileSync(
    join(WEB, '..', '..', 'supabase', 'migrations', '20271249859363_a_guest_who_passed_away_is_listed_not_counted.sql'),
    'utf8',
  );
  const body = mig.split('\n').filter((l) => !l.startsWith('--')).join('\n');
  assert.match(body, /ALTER TABLE public\.guests\s+ADD COLUMN IF NOT EXISTS passed_away BOOLEAN NOT NULL DEFAULT FALSE;/);
  for (const fn of ['get_vendor_seat_plan', 'get_vendor_catering_metrics', 'get_vendor_event_brief', 'papic_event_guest_headcount']) {
    assert.match(body, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(`), `${fn} is not redefined`);
  }
  const reads = body.match(/\b(?:FROM|JOIN)\s+public\.guests\b/g) ?? [];
  const ruled = body.match(/\b(g2?)\.entry_source <> 'self_added_unlisted' AND NOT \1\.passed_away\b/g) ?? [];
  assert.equal(ruled.length, 9, 'a guest read in the four functions lost the rule');
  assert.equal(reads.length, 9, 'a new guest read appeared without the rule');
});
