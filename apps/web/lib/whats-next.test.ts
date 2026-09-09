/**
 * WHAT'S NEXT — derived, never created, and never the wrong register.
 *
 * `02` §7 · 08 step 1.7. The owner's ruling is that most stories end, so the
 * tests that matter most here are the ones about what this screen REFUSES to
 * offer and what it leaves absent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  ANNOUNCEMENT_WRITES_TO,
  NEVER_OFFERED_AS_NEXT,
  NOTHING_YET,
  TIMING_BADGE,
  backCoverOf,
  daysBetween,
  nextCandidates,
  sanitizeNextAnnouncement,
  writeAnnouncement,
  type NextTypeOption,
} from './whats-next';

/** The real roster's shape, trimmed to the kinds these rules turn on. */
const ROSTER: NextTypeOption[] = [
  { key: 'wedding', label: 'Wedding', solemn: false },
  { key: 'debut', label: 'Debut', solemn: false },
  { key: 'birthday', label: 'Birthday', solemn: false },
  { key: 'travel', label: 'Travel', solemn: false },
  { key: 'christening', label: 'Christening', solemn: false },
  { key: 'anniversary', label: 'Anniversary', solemn: false },
  { key: 'reunion', label: 'Reunion', solemn: false },
  { key: 'wake', label: 'Wake', solemn: true },
];

const iso = (s: string) => s;
const build = (over: Partial<Parameters<typeof nextCandidates>[0]> = {}) =>
  nextCandidates({
    eventDateISO: '2026-02-14',
    todayISO: '2026-03-01',
    roster: ROSTER,
    formatDate: iso,
    ...over,
  });

test('1 · the resting card is always first, and it is a real answer', () => {
  const candidates = build();
  assert.equal(candidates[0]!.kind, NOTHING_YET);
  assert.equal(candidates[0]!.label, 'Nothing yet');
});

/**
 * ⚖ THE SOLEMN REGISTER IS NEVER THE SEQUEL. Offering "a wake" as what comes
 * next after a wedding is a sentence this product must never write, and the
 * exclusion is derived from the type's own register rather than from its name —
 * so the next solemn type somebody adds is excluded without anyone remembering.
 */
test('2 · a solemn type is never offered, whatever the roster says', () => {
  const kinds = build().map((c) => c.kind);
  assert.ok(!kinds.includes('wake'), 'a wake was offered as the next celebration');

  // …and it is the REGISTER doing the work, not the word "wake": the same key
  // with a celebratory register would be offered.
  const relabelled = build({
    roster: [{ key: 'wake', label: 'Wake', solemn: false }],
  }).map((c) => c.kind);
  assert.ok(
    relabelled.includes('wake'),
    'the exclusion is keyed on the name, not the register — the next solemn type will slip through',
  );
});

test('3 · a wedding is never offered — the generic create path refuses it', () => {
  assert.ok(NEVER_OFFERED_AS_NEXT.has('wedding'));
  assert.ok(!build().map((c) => c.kind).includes('wedding'));
});

/**
 * ⚠ EVERY TIMING IS CHECKED, not "at least one is derived". A threshold guard
 * in this repo went green while a sabotage deleted one of four arms.
 */
test('4 · each kind carries the timing its ANCHOR implies, and the matching badge', () => {
  const byKind = new Map(build().map((c) => [c.kind, c] as const));

  // union_date → we can name the date, because it comes from the day just held.
  assert.equal(byKind.get('anniversary')!.timing, 'derived');
  assert.equal(byKind.get('anniversary')!.dateISO, '2027-02-14');
  assert.equal(byKind.get('anniversary')!.dateLabel, '2027-02-14');

  // person_birthdate → a date we do not have, will not ask for, will not guess.
  for (const kind of ['christening', 'birthday', 'debut']) {
    assert.equal(byKind.get(kind)!.timing, 'waiting', `${kind} should be waiting on a date`);
    assert.equal(byKind.get(kind)!.dateISO, null, `${kind} carried a date we do not hold`);
  }

  // everything else → the host picks a day.
  assert.equal(byKind.get('reunion')!.timing, 'you_choose');
  assert.equal(byKind.get('travel')!.timing, 'you_choose');

  assert.equal(TIMING_BADGE.derived, '⟳ Derived, not created');
  assert.equal(TIMING_BADGE.waiting, '◇ Waiting on a date');
});

test('5 · the days-away count is the real arithmetic', () => {
  const anniversary = build().find((c) => c.kind === 'anniversary')!;
  assert.equal(anniversary.inDays, daysBetween('2026-03-01', '2027-02-14'));
  assert.equal(anniversary.inDays, 350);
});

/**
 * 🔑 DERIVED MEANS WE CAN NAME THE DATE. A card badged "Derived, not created"
 * with no date on it is a promise the screen has not kept, so the candidate is
 * withheld rather than shown blank.
 */
test('6 · with no date on this event, nothing is offered as derived', () => {
  const candidates = build({ eventDateISO: null });
  assert.ok(!candidates.some((c) => c.timing === 'derived'));
  assert.ok(!candidates.map((c) => c.kind).includes('anniversary'));
  // The rest still stand — the host can still choose a day.
  assert.ok(candidates.map((c) => c.kind).includes('reunion'));
});

test('7 · only types on the admin roster are ever offered', () => {
  const candidates = build({ roster: [{ key: 'reunion', label: 'Reunion', solemn: false }] });
  assert.deepEqual(candidates.map((c) => c.kind), [NOTHING_YET, 'reunion']);
});

// ── what is stored, and what the back cover says ────────────────────────────

test('8 · an announcement is validated against what was actually offered', () => {
  const offered = build();
  assert.deepEqual(sanitizeNextAnnouncement({ kind: 'anniversary' }, offered), {
    kind: 'anniversary',
  });
  // A hand-posted value cannot put a refused kind on the back cover.
  assert.equal(sanitizeNextAnnouncement({ kind: 'wake' }, offered), null);
  assert.equal(sanitizeNextAnnouncement({ kind: 'wedding' }, offered), null);
  assert.equal(sanitizeNextAnnouncement({ kind: 'not_a_type' }, offered), null);
  // The resting state is not an announcement.
  assert.equal(sanitizeNextAnnouncement({ kind: NOTHING_YET }, offered), null);
  assert.equal(sanitizeNextAnnouncement(null, offered), null);
  assert.equal(sanitizeNextAnnouncement(undefined, offered), null);
  assert.equal(sanitizeNextAnnouncement({ kind: '' }, offered), null);
});

/**
 * ⚖ CHOOSING NOTHING LEAVES THE BACK COVER ABSENT — not empty, not dashed, not
 * "coming soon". A story that ends at the last word is finished, and `null`
 * here is what makes the published page draw nothing at all.
 */
test('9 · nothing announced means no back cover, and a choice means a real one', () => {
  const offered = build();
  assert.equal(backCoverOf(null, offered), null);
  assert.equal(backCoverOf({ kind: 'wake' }, offered), null, 'a refused kind reached the back cover');

  assert.deepEqual(backCoverOf({ kind: 'anniversary' }, offered), {
    title: 'Anniversary',
    when: '2027-02-14',
    sub: 'in 350 days',
  });

  // A kind we cannot date says so, and does NOT invent a date or a countdown.
  const waiting = backCoverOf({ kind: 'christening' }, offered)!;
  assert.equal(waiting.when, 'The chronicle continues');
  assert.equal(waiting.sub, null);

  const chosen = backCoverOf({ kind: 'reunion' }, offered)!;
  assert.equal(chosen.when, 'A day still to choose');
  assert.equal(chosen.sub, null);
});

// ── "Announce it only" creates nothing ──────────────────────────────────────

/**
 * A recording stand-in for the admin client. It answers reads and — the point
 * of this file — **counts every table written and every row-creating call**.
 *
 * ⚠ THE CAST IS THE HOUSE PATTERN (`story-edition.test.ts`): handing the real
 * `SupabaseClient` type a four-method stand-in is what lets these tests drive
 * the production write with no database. Widening the production signature to
 * fit a hand-rolled structural type is what made tsc give up with TS2589.
 */
function recorder(read: { row?: Record<string, unknown> | null; error?: unknown } = {}) {
  const writes: Array<{ table: string; op: string }> = [];
  const api = {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.maybeSingle = async () => ({ data: read.row ?? null, error: read.error ?? null });
      for (const op of ['insert', 'upsert', 'update', 'delete']) {
        chain[op] = async () => {
          writes.push({ table, op });
          return { data: null, error: null };
        };
      }
      return chain;
    },
  };
  return { client: api as unknown as SupabaseClient, writes };
}

/**
 * ⚖ THE OWNER'S RULING, MEASURED: **"Announce it only" creates nothing.**
 *
 * This drives the PRODUCTION write and counts what it touched — it does not read
 * the action and conclude it looks safe. Sabotage `writeAnnouncement` into
 * creating an event and this goes red on the count, which is what a guard is for.
 */
test('10 · announcing writes to exactly one table, and never creates an event', async () => {
  const { client, writes } = recorder({ row: { draft_json: { headline: 'Ours' } } });

  const ok = await writeAnnouncement(client, 'e1', { kind: 'anniversary' });
  assert.equal(ok, true);

  const eventsWrites = writes.filter((w) => w.table === 'events');
  assert.equal(
    eventsWrites.length,
    0,
    `announcing wrote to events ${eventsWrites.length} time(s): ${JSON.stringify(eventsWrites)}`,
  );
  const creations = writes.filter((w) => w.op === 'insert');
  assert.equal(creations.length, 0, `announcing created ${creations.length} row(s)`);

  // …and it did write, so the test cannot pass by doing nothing at all.
  assert.deepEqual(writes, [{ table: ANNOUNCEMENT_WRITES_TO, op: 'upsert' }]);
  assert.equal(ANNOUNCEMENT_WRITES_TO, 'event_editorial');
});

/**
 * ⚠ A REFUSED READ IS NOT AN EMPTY DRAFT. `draft_json` holds the host's
 * headline, deck and every chapter override; writing over a document we failed
 * to read would delete all of it on the way to saving one key.
 */
test('11 · a refused read refuses the write rather than blanking the story', async () => {
  const { client, writes } = recorder({ error: { message: 'permission denied' } });
  const ok = await writeAnnouncement(client, 'e1', { kind: 'anniversary' });
  assert.equal(ok, false);
  assert.equal(writes.length, 0, 'a refused read still wrote over the host’s words');
});

test('12 · clearing the announcement is a write of null, not a deletion', async () => {
  const { client, writes } = recorder({ row: { draft_json: { headline: 'Ours' } } });
  assert.equal(await writeAnnouncement(client, 'e1', null), true);
  assert.deepEqual(writes, [{ table: ANNOUNCEMENT_WRITES_TO, op: 'upsert' }]);
  assert.equal(writes.filter((w) => w.op === 'delete').length, 0);
});
