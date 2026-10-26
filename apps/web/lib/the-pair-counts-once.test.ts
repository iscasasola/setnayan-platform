/**
 * 🧍‍♀️➡️🧍 THE PAIR COUNTS ONCE — every guest counter honours the proxy rule (owner, 2026-10-27, verbatim: *"make sure the
 * seats are properly counted. not having 2 guests but 1."*; DECISION_LOG "A ROLE HOLDER CAN SEND A PROXY").
 *
 * A role holder with `represented_by_guest_id` set is LISTED, never COUNTED — their proxy is the one person who comes, with
 * the proxy's own reply. So, like `passed_away`, the rule is a single-row predicate, and these guards hold it everywhere:
 *
 *   1 · THE SWEEP IS A PROPERTY, NOT A LIST. Every reader that leaves a guest who passed away out of a count
 *       (`.eq(PASSED_AWAY, false)`) is by definition a counter — so every one must ALSO say `.is(REPRESENTED_BY, null)`
 *       right after it. A counter added tomorrow with the passed-away rule and without this one goes red here.
 *       (Covers: Home's headcount and pax `lib/pax.ts`, the sidebar total, the check-in desk, souvenirs, the 3D plan,
 *       printed passes, the ticket zip, Papic's limited cameras, recaps, the roadmap, the reminder send list.)
 *   2 · The default guest read (`fetchGuestsByEventMeasured`) — behind the seat plan, the caterer's meal counts, the
 *       invitation prints, the send run, "N to invite" — leaves the holder out; only the roster and the export opt in.
 *   3 · `countsTowardEvent` (List N, Attending / Not coming / No reply, `rosterStats`, Home's tiles) and `guestHasTicket`.
 *   4 · The Guest List draws the pair as ONE row through `asOnePair` BEFORE anything counts or filters it, so the drawn
 *       rows and `counts-equal-the-rows` agree.
 *   5 · The four SQL readers (caterer, supplier brief, seat plan, Papic pool) carry the predicate in the migration (the
 *       database half is behavioural: tests/db/a-role-holder-can-send-a-proxy.db.test.ts).
 *
 * Sabotage (2026-10-27): dropping `.is(REPRESENTED_BY, null)` from lib/pax.ts → test 1 red; removing `!g.represented_by_guest_id`
 * from `countsTowardEvent` → test 3 red; reading `projectGuests(...)` straight into `roster` in guests-screen.tsx → test 4 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { computeGuestStats, countsTowardEvent, guestHasTicket, REPRESENTED_BY, type GuestRow } from '@/lib/guests';
import { passCardEligibility } from '@/lib/pass-card';

const WEB = join(__dirname, '..');
const REPO = join(WEB, '..', '..');
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

test('1 · every counter that leaves out a guest who passed away also leaves out a represented role holder', () => {
  const files = sources(join(WEB, 'app')).concat(sources(join(WEB, 'lib')));
  let checked = 0;
  const missing: string[] = [];
  for (const f of files) {
    const src = read(f);
    const at = [...src.matchAll(/\.eq\(PASSED_AWAY, false\)/g)];
    for (const m of at) {
      // The roster switch in `fetchGuestsByEventMeasured` is its own rule (test 2).
      const line = src.slice(src.lastIndexOf('\n', m.index!) + 1, src.indexOf('\n', m.index!));
      if (/includePassedAway/.test(line)) continue;
      checked += 1;
      const next = src.slice(m.index! + m[0].length, m.index! + m[0].length + 40).trimStart();
      if (!next.startsWith('.is(REPRESENTED_BY, null)')) missing.push(`${f}: ${line.trim().slice(0, 120)}`);
    }
  }
  assert.ok(checked >= 18, `only ${checked} counters found — the sweep is not reading what it should`);
  assert.deepEqual(missing, [], 'a counter leaves out a guest who passed away but counts a represented role holder beside their proxy');
});

test('2 · the default guest read leaves the role holder out; only the roster and the export list them', () => {
  const guests = read('lib/guests.ts');
  const fetch = guests.slice(guests.indexOf('export async function fetchGuestsByEventMeasured'));
  assert.match(fetch.slice(0, 1600), /if \(!opts\.includeRepresented\) q = q\.is\(REPRESENTED_BY, null\);/);
  const count = guests.slice(guests.indexOf('export async function countGuestsByEvent'));
  assert.match(count.slice(0, 900), /\.eq\(PASSED_AWAY, false\)\s*\.is\(REPRESENTED_BY, null\)/, 'the sidebar guest total counts the pair twice');
  const optIns = sources(join(WEB, 'app'))
    .concat(sources(join(WEB, 'lib')))
    .filter((f) => /includeRepresented:\s*true/.test(read(f)))
    .sort();
  assert.deepEqual(optIns, ['app/dashboard/[eventId]/guests/export/route.ts', 'app/dashboard/[eventId]/guests/page.tsx']);
  assert.equal(REPRESENTED_BY, 'represented_by_guest_id');
});

const holder = { rsvp_status: 'declined', represented_by_guest_id: 'g-proxy', qr_token: 't', plus_one_count: 0 } as unknown as GuestRow;
const proxy = { rsvp_status: 'attending', represented_by_guest_id: null, qr_token: 't', plus_one_count: 0 } as unknown as GuestRow;

test('3 · the counters’ own rule: the pair is one person, counted with the proxy’s reply; only the proxy has a ticket', () => {
  assert.equal(countsTowardEvent(holder), false);
  assert.equal(countsTowardEvent(proxy), true);
  const stats = computeGuestStats([holder, proxy]);
  assert.deepEqual([stats.total, stats.attending, stats.declined], [1, 1, 0]);
  assert.equal(guestHasTicket(holder), false);
  assert.equal(guestHasTicket(proxy), true);
  assert.equal(passCardEligibility({ guest_id: 'h', event_id: 'e', qr_token: 't', represented_by_guest_id: 'g-proxy' }), 'none');
});

test('4 · the Guest List makes the pair ONE row before it counts, filters or draws anything', () => {
  const src = read('app/dashboard/[eventId]/guests/_components/guests-screen.tsx');
  assert.match(src, /const \{ rows: roster, pairs: standIns \} = useMemo\(\(\) => asOnePair\(projected\), \[projected\]\);/);
  assert.doesNotMatch(src, /const roster = useMemo\(\(\) => projectGuests\(/, 'the List counts the role holder and the proxy as two');
  // The row says who stands in, and is found by the proxy's name.
  assert.match(src, /representedByWords\(standIn\.proxyName\)/);
  assert.match(src, /standIn \? \[\.\.\.\(companions\.get\(id\) \?\? \[\]\), standIn\.proxyName\]/);
  // Both lists of what a row carries hold the link, so the pair is drawn the same from a kept copy.
  const rows = read('lib/guest-list-rows.ts');
  assert.equal((rows.match(/'represented_by_guest_id'/g) ?? []).length, 2);
});

test('5 · the SQL readers carry the rule in the migration that redefines them', () => {
  const dir = join(REPO, 'supabase', 'migrations');
  const file = readdirSync(dir).find((f) => /_a_role_holder_can_send_a_proxy\.sql$/.test(f));
  assert.ok(file, 'the proxy migration is gone');
  const sql = readFileSync(join(dir, file!), 'utf8');
  for (const fn of ['get_vendor_seat_plan', 'get_vendor_catering_metrics', 'get_vendor_event_brief', 'papic_event_guest_headcount']) {
    assert.match(sql, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(`), `${fn} is not redefined`);
  }
  const ruled = (sql.match(/\b(g2?)\.entry_source <> 'self_added_unlisted' AND NOT \1\.passed_away AND \1\.represented_by_guest_id IS NULL\b/g) ?? []).length;
  assert.equal(ruled, 9, 'a guest read in the caterer / brief / seat plan / pool counts a represented role holder');
});
