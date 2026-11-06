/**
 * 🍽 "NOT COUNTED FOR ▾" — A GUEST WHO COMES BUT IS LEFT OUT OF ONE BOOKED SERVICE'S HEADCOUNT (owner 2026-11-02,
 * DECISION_LOG "NOT COUNTED FOR ▾"). Owner, verbatim: *"so a dropdown above passed away or a place to set this. it will
 * list all booked services to pick if they are not counted?"* → *"yes. just to prevent caterers counting attendees not
 * counted"*.
 *
 * The behaviour of the counts is held in SQL by tests/db/a-guest-not-counted-for-a-service.db.test.ts (the caterer's
 * count drops · another service's does not · the supplier cannot read who). This file holds the rest:
 *
 *   1 · the rule (pure): the words, the parse, and the save as a DIFF (two hosts never overwrite each other);
 *   2 · the card: ONE PickMenu tick dropdown, directly ABOVE Passed Away, posting with the autosave form by `form=`,
 *       with its marker — never for the couple, never offered from a refused read;
 *   3 · the save: `updateGuest` changes the ticks only when the marker came, never for the couple;
 *   4 · the list: the row's quiet "Not counted for <service>" note;
 *   5 · the supplier side: nothing a supplier reaches selects the table — the NUMBER only, never who;
 *   6 · the migration: the three supplier readers are redefined, every guest read carries the rule, and the earlier
 *       rules (request · passed away · represented) all survive the re-copy.
 *
 * Reuses the passed-away "listed, not counted" pattern (`a-guest-who-passed-away-is-listed-not-counted.test.ts`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  COUNTED_FOR_ALL,
  NOT_COUNTED_FIELD,
  NOT_COUNTED_POSTED,
  notCountedAfterSave,
  notCountedWords,
  parseNotCounted,
} from '@/lib/guest-not-counted';

const WEB = join(__dirname, '..');
const REPO = join(WEB, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const CARD = 'app/dashboard/[eventId]/guests/_components/guest-card-body.tsx';
const ACTION = 'app/dashboard/[eventId]/guests/[guestId]/actions.ts';
const MIGRATION = readdirSync(join(REPO, 'supabase', 'migrations')).find((f) => /_a_guest_not_counted_for_a_service\.sql$/.test(f));

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(relative(WEB, full));
  }
  return out;
}

test('1 · the words, the parse, and the default', () => {
  assert.equal(notCountedWords([]), null, 'nothing ticked must say nothing — the default is counted for all');
  assert.equal(notCountedWords(['Catering']), 'Not counted for Catering');
  assert.equal(notCountedWords(['Catering', ' Photo Booth ', '']), 'Not counted for Catering, Photo Booth');
  assert.equal(COUNTED_FOR_ALL, 'Counted for all');
  assert.deepEqual(parseNotCounted(''), []);
  assert.deepEqual(parseNotCounted('a, b,,a'), ['a', 'b']);
});

test('1 · the save is a DIFF: a tick another host added stays; only this event’s bookings are ever kept', () => {
  const booked = new Set(['cater', 'booth', 'band']);
  // No base (an older form): exactly what was posted — and never a booking of another event.
  assert.deepEqual(notCountedAfterSave(['cater'], ['booth', 'elsewhere'], booked), { add: ['booth'], drop: ['cater'] });
  // With a base: this card started with [cater] and unticked it; another host meanwhile ticked band.
  assert.deepEqual(notCountedAfterSave(['cater', 'band'], [], booked, ['cater']), { add: [], drop: ['cater'] });
  // This card ticked booth; band (another host's) stays.
  assert.deepEqual(notCountedAfterSave(['band'], ['booth'], booked, []), { add: ['booth'], drop: [] });
  // Nothing changed on this card → nothing written.
  assert.deepEqual(notCountedAfterSave(['cater'], ['cater'], booked, ['cater']), { add: [], drop: [] });
});

test('2 · the card: ONE tick dropdown, directly ABOVE Passed Away, posting with the autosave form', () => {
  const body = read(CARD);
  const at = body.indexOf('data-card-not-counted=""');
  const passed = body.indexOf('data-card-passed-away=""');
  assert.ok(at > 0, 'the "Not counted for" row is missing from the guest card');
  assert.ok(passed > at, '"Not counted for" must sit ABOVE Passed Away');
  // Nothing is drawn between them — directly above.
  const between = body.slice(at, passed);
  assert.equal((between.match(/data-card-[a-z-]+=""/g) ?? []).length, 1, 'another row sits between "Not counted for" and Passed Away');
  // ONE PickMenu dropdown (the card kit's Pick → `CardPick` → the shared PickMenu), several ticked, never a pill row.
  assert.match(between, /<K\.Pick\s+name=\{NOT_COUNTED_FIELD\}\s+label="Not counted for"\s+multi\s+form=\{formId\}/);
  // Each service says whether it is booked yet (owner 2026-11-04): "<shop> · Booked" · "<shop> · Quoted · applies once booked".
  assert.match(between, /hint: serviceHint\(s\)/);
  assert.match(between, /<input type="hidden" name=\{NOT_COUNTED_POSTED\} value="1" form=\{formId\} \/>/, 'the marker is not posted');
  assert.match(between, /emptyText=\{COUNTED_FOR_ALL\}/, 'nothing ticked must read as counted for all');
  assert.doesNotMatch(between, /<K\.Chips|<Chips|role="radiogroup"/, 'a pill row instead of the PickMenu dropdown');
  // Never for the couple; never from a refused read (no marker → nothing changes); not while nothing is booked.
  assert.match(body, /\{isCouple \|\| guest\.passed_away \|\| !notCounted \|\| notCounted\.services\.length === 0 \? null : \(\s*<div[^>]*data-card-not-counted=""/);
  assert.equal(NOT_COUNTED_FIELD, 'not_counted_for');
  assert.equal(NOT_COUNTED_POSTED, 'not_counted_posted');
  // The pick posts with the form it sits outside of.
  const rows = read('app/dashboard/[eventId]/guests/_components/guest-card-rows.tsx');
  const pick = rows.slice(rows.indexOf('export function CardPick('));
  assert.match(pick.slice(0, 3000), /<input ref=\{ref\} type="hidden" id=\{name\} name=\{name\} value=\{current\} form=\{form\} data-form-pick="" \/>/);
  // The card's data reads the booked services and this guest's ticks — measured.
  const data = read('app/dashboard/[eventId]/guests/_components/guest-card-data.ts');
  assert.match(data, /readGuestNotCounted\(supabase, eventId, guestId\)/);
  // Joined into the card's second batch — no wait of its own (`the-live-iphone-test-holds.test.ts` counts the waits).
  assert.match(data, /, notCounted\] = await Promise\.all\(\[/);
  assert.match(data, /\n\s*notCountedRead,\n\s*\]\);/);
});

test('2 · the reads offer every PER-HEAD supplier on the event (any status), and a refused read offers nothing', () => {
  // Owner 2026-11-04: *"on cale-ice it asked for venue, and no option for catering"* → every supplier on the event, booked
  // or not; *"not counted for will be for service cards with pax only"* → only per-head ones. Both are decided in SQL
  // (`get_event_service_counts`: not archived · `event_vendor_counts_per_head`), held by who-a-supplier-counts.db.test.ts.
  const server = read('lib/guest-not-counted.server.ts');
  assert.match(server, /const counts = await readEventServiceCounts\(supabase, eventId\);\s*if \(!counts\) return null;/);
  assert.doesNotMatch(server, /COUNTED_BOOKING_STATUSES|\.in\('status'/, 'the list went back to booked-only');
  const counts = read('lib/supplier-count.server.ts');
  assert.match(counts, /supabase\.rpc\('get_event_service_counts', \{ p_event_id: eventId \}\)/);
  const card = server.slice(server.indexOf('export async function readGuestNotCounted'));
  assert.match(card.slice(0, 900), /if \(error\) \{[\s\S]{0,160}return null;/, 'a refused tick read is drawn as "counted for all"');
  assert.match(card.slice(0, 900), /if \(!services\) return null;/, 'a refused services read is drawn as "counted for all"');
});

test('3 · the save changes the ticks only when the marker came, never for the couple', () => {
  const action = read(ACTION);
  assert.match(action, /const notCountedPosted = clean\(formData\.get\(NOT_COUNTED_POSTED\)\) === '1';/);
  assert.match(
    action,
    /if \(notCountedPosted && role !== 'bride' && role !== 'groom' && \(!merge\.based \|\| merge\.changed\.has\(NOT_COUNTED_FIELD\)\)\) \{\s*await syncCardNotCounted\(/,
  );
  // On the user's own session — RLS decides — never the service role.
  const sync = read('lib/guest-not-counted.server.ts');
  assert.doesNotMatch(sync, /createAdminClient|service_role|SUPABASE_SERVICE_ROLE/);
});

test('4 · the Guest List row carries the quiet note', () => {
  const page = read('app/dashboard/[eventId]/guests/page.tsx');
  assert.match(page, /readNotCountedNotes\(supabase, eventId\)/);
  assert.match(page, /notCountedByGuest=\{notCountedByGuest\}/);
  const screen = read('app/dashboard/[eventId]/guests/_components/guests-screen.tsx');
  assert.match(screen, /notCounted=\{notCountedByGuest\[g\.guest_id\] \?\? null\}/);
  assert.match(screen, /\{notCounted \? <span className=\{styles\.mute\} data-row-not-counted="">\{` · \$\{notCounted\}`\}<\/span> : null\}/);
});

test('5 · the supplier sees the NUMBER only — nothing a supplier reaches selects who', () => {
  const supplierSide = sources(join(WEB, 'app', 'vendor-dashboard'))
    .concat(sources(join(WEB, 'app', '[slug]')))
    .concat(sources(join(WEB, 'app', 'api')))
    .concat(sources(join(WEB, 'lib')).filter((f) => /vendor|supplier/.test(f)));
  assert.ok(supplierSide.length > 50, 'the supplier-side sweep lost its targets');
  const readers = supplierSide.filter((f) => /guest_not_counted_for|guests_not_counted_for_services/.test(read(f)));
  assert.deepEqual(readers, [], 'a supplier-side file reads which guests are not counted');
  // The only app code that names the table is the couple's own module.
  const all = sources(join(WEB, 'app')).concat(sources(join(WEB, 'lib')));
  const named = all.filter((f) => /from\('guest_not_counted_for'\)/.test(read(f)));
  assert.deepEqual(named, ['lib/guest-not-counted.server.ts']);
});

test('6 · the migration: the three supplier readers carry the rule on every guest read, and keep every earlier rule', () => {
  assert.ok(MIGRATION, 'the "not counted for" migration is gone');
  const sql = readFileSync(join(REPO, 'supabase', 'migrations', MIGRATION!), 'utf8');
  const body = sql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');
  assert.match(body, /CREATE TABLE IF NOT EXISTS public\.guest_not_counted_for \(/);
  assert.match(body, /ALTER TABLE public\.guest_not_counted_for ENABLE ROW LEVEL SECURITY;/, 'RLS is not on at CREATE TABLE');
  // No policy reaches a supplier: the couple, a guest-list helper, and nobody else.
  const policies = body.match(/CREATE POLICY (\w+)/g) ?? [];
  assert.deepEqual(policies.map((p) => p.replace('CREATE POLICY ', '')).sort(), [
    'guest_not_counted_for_couple_all',
    'guest_not_counted_for_moderator_read',
    'guest_not_counted_for_moderator_write',
  ]);
  assert.doesNotMatch(body, /current_vendor_ids/, 'a supplier policy on the table');
  assert.match(body, /REVOKE ALL ON FUNCTION public\.guests_not_counted_for_services\(UUID, UUID\[\]\) FROM PUBLIC, anon, authenticated;/);
  for (const fn of ['get_vendor_seat_plan', 'get_vendor_catering_metrics', 'get_vendor_event_brief']) {
    assert.match(body, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(`), `${fn} is not redefined`);
  }
  assert.doesNotMatch(body, /CREATE OR REPLACE FUNCTION public\.papic_event_guest_headcount\(/, 'Papic is the couple’s pool, not a booked service');
  // The three readers only — the trigger above looks the guest up to find its event, and counts nobody.
  const readers = body.slice(body.indexOf('CREATE OR REPLACE FUNCTION public.get_vendor_seat_plan('));
  const reads = readers.match(/\b(?:FROM|JOIN)\s+public\.guests\b/g) ?? [];
  const ruled =
    readers.match(
      /\b(g2?)\.entry_source <> 'self_added_unlisted' AND NOT \1\.passed_away AND \1\.represented_by_guest_id IS NULL AND \1\.guest_id <> ALL \(v_not_counted\)/g,
    ) ?? [];
  assert.equal(reads.length, 8, 'a guest read appeared in (or left) the three supplier readers');
  assert.equal(ruled.length, reads.length, 'a supplier guest read lost the not-counted rule — or an earlier one');
});
