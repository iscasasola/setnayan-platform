/**
 * guest-list-side-reads-are-honest.test.ts — 📏 THE READS BESIDE THE GUEST LIST SAY WHETHER THEY HAPPENED, AND THE
 * PAGE SAYS SO.
 *
 * The guest list's own read has been honest since 2026-08-20 (`guests-read-is-honest.test.ts`): refused, it says "We
 * couldn't load your guest list. Nothing has been lost…" instead of "No guests yet." The five reads beside it were
 * not. On `guests/page.tsx` a failed
 *
 *     fetchGuestGroupsByEvent · fetchGroupMembershipsByEvent        → `[]` / an empty Map
 *     fetchAssignments · fetchTables  (they THROW)                  → `.catch(() => [])`
 *     fetchFloorPlan                                                → the default plan, or `.catch(() => null)`
 *
 * and the list was drawn with no group on anyone and nobody at a table — byte-identical to a couple who had made no
 * groups and seated no one. Owner, 2026-10-11: *"make sure requests does not cause a crash"* — and a failure that
 * renders as emptiness is the same fault, quieter.
 *
 * ── WHAT IT CLAIMS ──────────────────────────────────────────────────────────────────────────────────────────────────
 *   1. Each of the five has a form that answers `measured` — run here against a stubbed client: refused → the empty
 *      stand-in and `measured: false`; answered → the rows and `true`; an answered EMPTY is `true` (a couple with no
 *      groups is a fact). None of them throws. The array-only forms keep their contract for their other callers.
 *   2. `measuredOr` never throws, hands the trail to its logger, and survives a logger that throws.
 *   3. The sentence: groups, tables, or both — and null when everything was read.
 *   4. The page asks the measured form of all five, in its one fan-out, and no longer swallows a seat read into
 *      `[]`; what it hands the screen is the sentence built from those very flags; and no table is SUGGESTED from
 *      seat reads that did not all happen.
 *   5. The screen DRAWS it (rendered, not grepped): the sentence and the list's own "Try again" under a list that was
 *      read; nothing when all was read; and not a second message under a list that itself could not be read.
 *
 * ── NOT CLAIMED ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *   · Any other caller of the array-only forms — the seating pages and `seating/actions.ts` still take a refused
 *     memberships read as "no groups" (auto-arrange then seats without them). That is a write on an unread value and
 *     is NOT fixed here.
 *   · The row menu's own lists (Set… ▾ › Group / Table) still show no groups / only "Not seated" when unread — the
 *     line above them says why; they are not disabled.
 *   · Claim 4 reads the page's SOURCE (a server component with ~15 reads cannot be run here); 1, 2, 3 and 5 run code.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchGroupMembershipsByEvent,
  fetchGroupMembershipsByEventMeasured,
  fetchGuestGroupsByEvent,
  fetchGuestGroupsByEventMeasured,
} from '@/lib/guests';
import { fetchFloorPlan, fetchFloorPlanMeasured } from '@/lib/seating';
import { measuredOr } from '@/lib/measured-read';
import { guestListUnreadLine } from '@/lib/guest-list-unread';
import { stripComments } from '@/lib/strip-comments';
import { guestRow, renderGuestsScreen } from '@/app/dashboard/[eventId]/guests/_components/render-guests-screen';

type Result = { data: unknown; error: unknown; status?: number };
const REFUSED: Result = { data: null, error: { code: '42501', message: 'permission denied for table guest_groups' }, status: 403 };
const NO_ANSWER: Result = { data: null, error: { code: '', message: 'TypeError: fetch failed' }, status: 0 };

/** A client whose every table answers what `by(table)` says. Chained filters return the builder. */
function stubClient(by: (table: string) => Result): SupabaseClient {
  return {
    from(table: string) {
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'neq', 'is', 'not', 'in', 'order', 'limit']) b[m] = () => b;
      b.maybeSingle = () => Promise.resolve(by(table));
      b.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(by(table)).then(resolve, reject);
      return b;
    },
  } as unknown as SupabaseClient;
}
/** Sentry's logger writes the refusal to the console — expected here, and noise in the test's output. */
async function quiet<T>(fn: () => Promise<T>): Promise<T> {
  const { error, warn } = console;
  console.error = () => {};
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.error = error;
    console.warn = warn;
  }
}

const GROUP = { group_id: 'gr1', public_id: 'S89G-1', event_id: 'e1', label: 'Cousins', team_side: null, created_at: '', updated_at: '' };

test('1 · groups: refused or unanswered → no groups and measured:false; answered → the groups; an answered empty is a FACT', async () => {
  for (const failure of [REFUSED, NO_ANSWER]) {
    const got = await quiet(() => fetchGuestGroupsByEventMeasured(stubClient(() => failure), 'e1'));
    assert.deepEqual(got, { groups: [], measured: false, countsMeasured: false });
  }
  const ok = await fetchGuestGroupsByEventMeasured(
    stubClient((t) => (t === 'guest_groups' ? { data: [GROUP], error: null } : { data: [{ group_id: 'gr1' }, { group_id: 'gr1' }], error: null })),
    'e1',
  );
  assert.equal(ok.measured, true);
  assert.equal(ok.countsMeasured, true);
  assert.deepEqual(ok.groups.map((g) => [g.label, g.member_count]), [['Cousins', 2]]);
  // The groups answered, their head-counts did not: the groups are real, the 0 is not.
  const half = await quiet(() => fetchGuestGroupsByEventMeasured(stubClient((t) => (t === 'guest_groups' ? { data: [GROUP], error: null } : REFUSED)), 'e1'));
  assert.deepEqual([half.measured, half.countsMeasured, half.groups.length], [true, false, 1]);
  const none = await fetchGuestGroupsByEventMeasured(stubClient(() => ({ data: [], error: null })), 'e1');
  assert.deepEqual(none, { groups: [], measured: true, countsMeasured: true }, 'a couple with no groups was reported as an unread list');
  // The array-only form keeps its contract (the seating pages): the rows, never a throw.
  assert.deepEqual(await quiet(() => fetchGuestGroupsByEvent(stubClient(() => REFUSED), 'e1')), []);
});

test('1 · memberships: refused → an empty map and measured:false; answered → who is in which group', async () => {
  for (const failure of [REFUSED, NO_ANSWER]) {
    const got = await quiet(() => fetchGroupMembershipsByEventMeasured(stubClient(() => failure), 'e1'));
    assert.equal(got.measured, false);
    assert.equal(got.memberships.size, 0);
  }
  const rows = [{ guest_id: 'g1', group_id: 'gr1' }, { guest_id: 'g1', group_id: 'gr2' }, { guest_id: 'g2', group_id: 'gr1' }];
  const ok = await fetchGroupMembershipsByEventMeasured(stubClient(() => ({ data: rows, error: null })), 'e1');
  assert.equal(ok.measured, true);
  assert.deepEqual([...ok.memberships.entries()], [['g1', ['gr1', 'gr2']], ['g2', ['gr1']]]);
  assert.equal((await fetchGroupMembershipsByEventMeasured(stubClient(() => ({ data: [], error: null })), 'e1')).measured, true);
  assert.deepEqual([...(await fetchGroupMembershipsByEvent(stubClient(() => ({ data: rows, error: null })), 'e1')).keys()], ['g1', 'g2']);
  assert.equal((await quiet(() => fetchGroupMembershipsByEvent(stubClient(() => REFUSED), 'e1'))).size, 0);
});

test('1 · the floor plan: refused → the DEFAULT plan and measured:false; no row yet is an answer', async () => {
  const refused = await quiet(() => fetchFloorPlanMeasured(stubClient(() => REFUSED), 'e1'));
  assert.equal(refused.measured, false);
  const noRow = await fetchFloorPlanMeasured(stubClient(() => ({ data: null, error: null })), 'e1');
  assert.equal(noRow.measured, true, 'an event with no floor plan yet was reported as an unread one');
  assert.deepEqual(refused.plan, noRow.plan, 'the stand-in is the default plan');
  const placed = await fetchFloorPlanMeasured(stubClient(() => ({ data: { stage_x: 0.25, stage_y: 0.75 }, error: null })), 'e1');
  assert.deepEqual([placed.measured, placed.plan.stage_x, placed.plan.stage_y], [true, 0.25, 0.75]);
  // The plain form is the same plan, for the seating editor.
  assert.deepEqual(await fetchFloorPlan(stubClient(() => ({ data: { stage_x: 0.25, stage_y: 0.75 }, error: null })), 'e1'), placed.plan);
});

test('2 · measuredOr: the value and true; the stand-in and false; never a throw — even from its own logger', async () => {
  assert.deepEqual(await measuredOr(Promise.resolve([1, 2]), [] as number[]), { value: [1, 2], measured: true });
  assert.deepEqual(await measuredOr(Promise.resolve([] as number[]), [9]), { value: [], measured: true }, 'an answered empty is measured');
  const seen: unknown[] = [];
  const boom = new Error('fetchTables failed: permission denied');
  assert.deepEqual(await measuredOr(Promise.reject(boom), [] as number[], (e) => void seen.push(e)), { value: [], measured: false });
  assert.deepEqual(seen, [boom], 'the refusal left no trail');
  assert.deepEqual(
    await measuredOr(Promise.reject(boom), null, () => {
      throw new Error('the logger broke');
    }),
    { value: null, measured: false },
  );
});

test('3 · the sentence — what could not be loaded, and that nothing is lost', () => {
  assert.equal(guestListUnreadLine({ groups: true, seats: true }), null);
  assert.equal(guestListUnreadLine({ groups: false, seats: true }), 'We couldn’t load your groups this time. Nothing has been lost.');
  assert.equal(guestListUnreadLine({ groups: true, seats: false }), 'We couldn’t load your tables this time. Nothing has been lost.');
  assert.equal(guestListUnreadLine({ groups: false, seats: false }), 'We couldn’t load your groups and tables this time. Nothing has been lost.');
});

const WEB = join(__dirname, '..');
const PAGE = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/guests/page.tsx'), 'utf8'));
const count = (s: string, needle: string) => s.split(needle).length - 1;

test('4 · the page asks the measured form of all five, and says what they answered', () => {
  const fan = PAGE.slice(PAGE.indexOf('await Promise.all(['), PAGE.indexOf(']);', PAGE.indexOf('await Promise.all([')));
  assert.ok(fan.includes('fetchGuestsByEventMeasured('), 're-anchor — this is not the page’s read fan-out');
  for (const call of [
    'fetchGuestGroupsByEventMeasured(supabase, eventId)',
    'fetchGroupMembershipsByEventMeasured(supabase, eventId)',
    'measuredOr(fetchAssignments(supabase, eventId),',
    'measuredOr(fetchTables(supabase, eventId),',
    'fetchFloorPlanMeasured(supabase, eventId)',
  ]) {
    assert.equal(count(fan, call), 1, `${call} is not in the page's read fan-out exactly once`);
  }
  // The un-measured forms are gone from the page altogether — each named, with the paren, so the Measured form is not a match.
  for (const bare of ['fetchGuestGroupsByEvent(', 'fetchGroupMembershipsByEvent(', 'fetchFloorPlan(']) {
    assert.equal(count(PAGE, bare), 0, `the page calls ${bare}…) — a refused read becomes "none" again`);
  }
  assert.equal(count(PAGE, 'fetchAssignments('), 1);
  assert.equal(count(PAGE, 'fetchTables('), 1);
  assert.doesNotMatch(fan, /\.catch\(\s*\(\)\s*=>\s*(\[\]|null)/, 'a read in the fan-out is swallowed into an empty value with no flag');
  // The flags are built from EVERY one of the five, and the sentence from the flags.
  assert.match(PAGE, /groups: groupsRead\.measured && membershipsRead\.measured,\s*seats: assignmentsRead\.measured && tablesRead\.measured && floorPlanRead\.measured,/);
  assert.equal(count(PAGE, 'notLoaded={guestListUnreadLine(sideReads)}'), 1);
  // An unread plan is never the stage a table is suggested from; unread seats suggest no table at all.
  assert.match(PAGE, /const floorPlan = floorPlanRead\.measured \? floorPlanRead\.plan : null;/);
  assert.match(PAGE, /!countsTowardEvent\(g\) \|\| !sideReads\.seats\s*\? null/);
});

test('5 · the screen draws it — under a list that was read, once, with the list’s own Try again', async () => {
  const line = guestListUnreadLine({ groups: false, seats: false })!;
  const guests = [guestRow(), guestRow()];
  const said = await renderGuestsScreen({ guests, notLoaded: line });
  const at = said.indexOf('data-roster-not-loaded');
  assert.ok(at > -1, 'the unread line is not drawn');
  const tag = said.slice(said.lastIndexOf('<p', at), said.indexOf('</p>', at));
  assert.match(tag, /role="status"/);
  assert.ok(tag.includes('We couldn’t load your groups and tables this time. Nothing has been lost.'), tag);
  assert.match(tag, /<a href="\/dashboard\/e1\/guests"[^>]*>Try again<\/a>/, 'no way to ask again — and it must be a real round trip (a plain anchor)');
  assert.ok(at > said.indexOf('data-roster-counts'), 'the line is not in the counts strip');
  // Everything read → nothing is said.
  assert.equal(count(await renderGuestsScreen({ guests }), 'data-roster-not-loaded'), 0);
  // The list itself unread → its own words say it; this line does not pile on.
  assert.equal(count(await renderGuestsScreen({ guests: [], measured: false, notLoaded: line }), 'data-roster-not-loaded'), 0);
});
