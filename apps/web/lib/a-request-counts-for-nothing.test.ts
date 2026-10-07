/**
 * 🛂 A REQUEST COUNTS FOR NOTHING UNTIL KEEP OR LINK (owner, 2026-09-27,
 * verbatim: "no. only count when accepted."). A guest row with
 * `entry_source = 'self_added_unlisted'` waits in Guest List → Requests and is
 * left out of every headcount, seat, caterer number and printed list.
 *
 * The pure rule, and a SWEEP of every reader that counts: each is named here
 * with the anchor that proves it applies the rule, so a new reader added
 * without it — or a filter deleted from an old one — goes red. The SQL half
 * (the caterer's, the supplier brief's, the seat plan's and the Papic pool's
 * counts) is behavioural in tests/db/a-request-counts-for-nothing.db.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { computeGuestStats, countsTowardEvent, REQUEST_ENTRY_SOURCE, type GuestRow } from '@/lib/guests';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const NEQ = /\.neq\('entry_source', REQUEST_ENTRY_SOURCE\)/g;

test('the rule: a request does not count; the couple’s own rows (and hand-built fixtures) do', () => {
  assert.equal(REQUEST_ENTRY_SOURCE, 'self_added_unlisted');
  assert.equal(countsTowardEvent({ entry_source: 'self_added_unlisted' }), false);
  assert.equal(countsTowardEvent({ entry_source: 'host_seeded' }), true);
  assert.equal(countsTowardEvent({}), true, 'a fixture with no provenance reads as the couple’s own');
});

test('computeGuestStats leaves requests out of every number', () => {
  const row = (rsvp: GuestRow['rsvp_status'], entry: string, plus = 0) =>
    ({ rsvp_status: rsvp, entry_source: entry, plus_one_count: plus, plus_one_allowed: plus > 0 }) as unknown as GuestRow;
  const stats = computeGuestStats([
    row('attending', 'host_seeded'),
    row('pending', 'host_seeded'),
    row('attending', 'self_added_unlisted', 2),
    row('pending', 'self_added_unlisted'),
  ]);
  assert.equal(stats.total, 2);
  assert.equal(stats.attending, 1);
  assert.equal(stats.pending, 1);
  assert.equal(stats.plus_ones, 0, 'a request’s seats counted');
});

test('the list readers read the ACCEPTED list by default; only the roster opts in', () => {
  const guests = read('lib/guests.ts');
  const fetch = guests.slice(guests.indexOf('export async function fetchGuestsByEventMeasured'));
  assert.match(fetch.slice(0, 900), /if \(!opts\.includeRequests\) q = q\.neq\('entry_source', REQUEST_ENTRY_SOURCE\);/);
  const count = guests.slice(guests.indexOf('export async function countGuestsByEvent'));
  assert.match(count.slice(0, 700), /\.neq\('entry_source', REQUEST_ENTRY_SOURCE\)/, 'the guest total counts requests');
  // Exactly one caller opts in: the roster, which draws requests as their own rows.
  const roster = read('app/dashboard/[eventId]/guests/page.tsx');
  assert.match(roster, /fetchGuestsByEventMeasured\(supabase, eventId, \{ includeRequests: true(?:, includePassedAway: true)? \}\)/);
  // ⤷ Maker PR 4f: the counts are drawn by GuestsScreen, over the list the page
  // hands it — requests excluded (they are the Review row), counted through the one rule.
  assert.match(roster, /\.filter\(\(g\) => !selfJoinIds\.includes\(g\.guest_id\)\)/, 'the list includes requests');
  const screen = read('app/dashboard/[eventId]/guests/_components/guests-screen.tsx');
  assert.match(screen, /const counted = roster\.filter\(\(g\) => countsTowardEvent\(g\)\)/, 'the counts include requests');
  assert.match(roster, /!countsTowardEvent\(g\)\s*\?\s*null/, 'a request is suggested a seat');
});

/** Every reader that COUNTS or SEATS or PRINTS, and how many guest reads in it take the rule. */
const SWEEP: Array<[file: string, reads: number, what: string]> = [
  ['lib/pax.ts', 1, 'the live headcount → final pax and every supplier price'],
  ['lib/papic-limited.ts', 2, 'the Papic Limited per-guest price and its camera hand-out'],
  ['lib/print-set.server.ts', 1, 'printed passes'],
  ['app/dashboard/[eventId]/guests/checkin/page.tsx', 1, 'the door list'],
  ['app/dashboard/[eventId]/guests/souvenirs/page.tsx', 1, 'the souvenir table'],
  ['app/dashboard/[eventId]/plan3d/page.tsx', 2, 'the 3D plan’s guest counts'],
  ['lib/after-summary.ts', 1, 'the after-the-day attending count'],
  ['lib/auto-recap.ts', 1, 'the recap’s guest count'],
  ['app/[slug]/_components/editorial/data.ts', 3, 'the story’s guests / attending / replied'],
  ['app/dashboard/[eventId]/studio/papic/magazine/route.ts', 1, 'the magazine’s guest line'],
  ['lib/wedding-roadmap-signals.ts', 1, '"you have a guest list" signal'],
  ['app/dashboard/[eventId]/checklist-actions.ts', 1, '"you have a guest list" checklist'],
  ['lib/interconnect/probes.ts', 1, 'the reach probe’s truth (it must match the reader it checks)'],
];

test('every counting reader applies the rule', () => {
  for (const [file, reads, what] of SWEEP) {
    const n = (read(file).match(NEQ) ?? []).length;
    assert.equal(n, reads, `${file} (${what}): ${n} of ${reads} guest reads leave requests out`);
  }
});

test('the seat reconcile reads the accepted list — so no request is handed a provisional seat', () => {
  const src = read('lib/seating-reconcile.ts');
  assert.match(src, /fetchGuestsByEvent\(supabase, eventId\)/, 'the reconcile reads guests some other way now — re-check it');
  assert.doesNotMatch(src, /includeRequests/, 'the reconcile opted in to requests');
});

test('the SQL readers are rewritten with the rule — and only with the rule', () => {
  const mig = readFileSync(
    join(WEB, '..', '..', 'supabase', 'migrations', '20271249183421_a_request_counts_for_nothing_until_kept.sql'),
    'utf8',
  );
  const body = mig.split('\n').filter((l) => !l.startsWith('--')).join('\n');
  for (const fn of ['get_vendor_seat_plan', 'get_vendor_catering_metrics', 'get_vendor_event_brief', 'papic_event_guest_headcount']) {
    assert.match(body, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(`), `${fn} is not redefined`);
  }
  const hits = body.match(/\bg2?\.entry_source <> 'self_added_unlisted'/g) ?? [];
  const reads = body.match(/\bpublic\.guests\b/g) ?? [];
  assert.equal(hits.length, 9, 'a guest read in the four functions lost the rule');
  assert.equal(reads.length, 9, 'a new guest read appeared without the rule');
});
