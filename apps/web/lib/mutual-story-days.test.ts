import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * "The days you were both there" — THE BOTH-VISIBLE RULE, in both directions.
 *
 * The rule is not a nicety, it is what stops this feature being an
 * attendance-disclosure engine: a day appears ONLY when BOTH people are already
 * visible in it (their story item consented + live, the event publicly
 * visible). So the page can only ever show what was already shown, and if
 * EITHER person hides, the day must leave BOTH pages.
 *
 * These tests assert BOTH halves. Asserting only "a day appears when both are
 * visible" would pass against a function that ignores hiding entirely.
 *
 * ⚠ The flag is read at CALL time, so every resolver test sets it explicitly —
 * a test that inherits an ambient env is testing the machine, not the code.
 */

const FLAG = 'NEXT_PUBLIC_PERSON_LIFE_STORIES';
// Set before any test RUNS. `personLifeStoriesEnabled()` is deliberately a
// function, not a module const, so it is re-read per call — import order is
// irrelevant here, and that is exactly the property being relied on.
process.env[FLAG] = '1';

import {
  mutualStoryEventIds,
  isPubliclyVisiblePresence,
  sortMutualDays,
  resolveMutualStoryDays,
} from './person-life-stories';

const A = 'person-a';
const B = 'person-b';
const EV = 'event-1';

type Row = {
  person_id: string;
  event_id: string;
  consented_at: string | null;
  hidden_at: string | null;
  removed_at: string | null;
};

/** A live, consented presence — "already visible in that day". */
const visible = (person: string, event = EV): Row => ({
  person_id: person,
  event_id: event,
  consented_at: '2026-08-01T00:00:00Z',
  hidden_at: null,
  removed_at: null,
});

// ---------------------------------------------------------------------------
// The rule itself
// ---------------------------------------------------------------------------

test('a day appears when BOTH people are already visible in it', () => {
  assert.deepEqual(mutualStoryEventIds([visible(A), visible(B)], A, B), [EV]);
});

test('one person visible alone is NOT a shared day', () => {
  assert.deepEqual(mutualStoryEventIds([visible(A)], A, B), []);
  assert.deepEqual(mutualStoryEventIds([visible(B)], A, B), []);
});

for (const [label, mutation] of [
  ['hides it (hidden_at)', { hidden_at: '2026-08-02T00:00:00Z' }],
  ['opts out (removed_at)', { removed_at: '2026-08-02T00:00:00Z' }],
  ['never consented (consented_at null)', { consented_at: null }],
] as const) {
  test(`the day LEAVES BOTH pages when A ${label}`, () => {
    const rows = [{ ...visible(A), ...mutation }, visible(B)];
    // Gone from the page you open about B…
    assert.deepEqual(mutualStoryEventIds(rows, A, B), []);
    // …and from the page you open about A. Same call, arguments swapped.
    assert.deepEqual(mutualStoryEventIds(rows, B, A), []);
  });

  test(`the day LEAVES BOTH pages when B ${label}`, () => {
    const rows = [visible(A), { ...visible(B), ...mutation }];
    assert.deepEqual(mutualStoryEventIds(rows, A, B), []);
    assert.deepEqual(mutualStoryEventIds(rows, B, A), []);
  });
}

test('SYMMETRY is a property of the shape, not a promise — swapping the two people never changes the answer', () => {
  const rows: Row[] = [
    visible(A, 'e1'),
    visible(B, 'e1'),
    visible(A, 'e2'),
    { ...visible(B, 'e2'), hidden_at: 'x' }, // B hid e2
    visible(B, 'e3'),
    { ...visible(A, 'e3'), removed_at: 'x' }, // A opted out of e3
    visible(A, 'e4'),
    { ...visible(B, 'e4'), consented_at: null }, // B never consented at e4
  ];
  assert.deepEqual(mutualStoryEventIds(rows, A, B), ['e1']);
  assert.deepEqual(
    mutualStoryEventIds(rows, A, B),
    mutualStoryEventIds(rows, B, A),
  );
});

test('a person is never mutual with themselves', () => {
  assert.deepEqual(mutualStoryEventIds([visible(A)], A, A), []);
});

test('isPubliclyVisiblePresence requires live AND consented', () => {
  assert.equal(isPubliclyVisiblePresence(visible(A)), true);
  assert.equal(isPubliclyVisiblePresence({ ...visible(A), consented_at: null }), false);
  assert.equal(isPubliclyVisiblePresence({ ...visible(A), hidden_at: 'x' }), false);
  assert.equal(isPubliclyVisiblePresence({ ...visible(A), removed_at: 'x' }), false);
});

test('days sort newest first, undated last, ties broken stably', () => {
  const day = (eventId: string, eventDate: string | null) => ({
    eventId, slug: eventId, displayName: null, eventDate, venueName: null, eventType: null,
  });
  assert.deepEqual(
    sortMutualDays([day('b', null), day('c', '2026-01-01'), day('a', '2026-06-01')])
      .map((d) => d.eventId),
    ['a', 'c', 'b'],
  );
});

// ---------------------------------------------------------------------------
// The CALLER. Testing the pure rule is not testing the resolver: the resolver
// is where the flag, the self-check, the fail-closed branches and — critically —
// the EXPLICIT SCOPING live. `person_story_items`' only policy is
// `is_admin() OR the person is claimed by auth.uid()`, and prod has an account
// that IS an admin, so a read that leaned on RLS would return every row in the
// table to exactly the person most likely to look.
// ---------------------------------------------------------------------------

type Recorded = { table: string; filters: string[] };

/**
 * A stub that mimics enough of the Supabase builder to drive the REAL control
 * flow, and records which filters were actually applied so a dropped scope is a
 * test failure rather than a silent widening.
 */
function stubClient(data: Record<string, unknown[]>, recorded: Recorded[]) {
  return {
    from(table: string) {
      const rec: Recorded = { table, filters: [] };
      recorded.push(rec);
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      builder.select = chain;
      builder.eq = (c: string) => (rec.filters.push(`eq:${c}`), builder);
      builder.in = (c: string) => (rec.filters.push(`in:${c}`), builder);
      builder.is = (c: string, v: unknown) => (rec.filters.push(`is:${c}=${String(v)}`), builder);
      builder.not = (c: string, op: string) => (rec.filters.push(`not:${c}:${op}`), builder);
      builder.then = (resolve: (r: unknown) => void) =>
        resolve({ data: data[table] ?? [], error: null });
      return builder;
    },
  } as unknown as Parameters<typeof resolveMutualStoryDays>[0]['adminClient'];
}

const PEOPLE = [
  { person_id: A, claimed_by_user_id: 'user-a' },
  { person_id: B, claimed_by_user_id: 'user-b' },
];
const PUBLIC_EVENT = {
  event_id: EV,
  slug: 'juan-and-maria',
  display_name: 'Juan & Maria',
  event_date: '2026-05-02',
  venue_name: 'Tagaytay',
  event_type: 'wedding',
  landing_page_visibility: 'public',
  scheduled_launch_at: null,
};

const call = (over: Partial<Record<string, unknown[]>> = {}, ids = ['user-a', 'user-b']) => {
  const recorded: Recorded[] = [];
  const p = resolveMutualStoryDays({
    viewerUserId: ids[0]!,
    profileUserId: ids[1]!,
    adminClient: stubClient(
      {
        people: PEOPLE,
        person_story_items: [visible(A), visible(B)],
        events: [PUBLIC_EVENT],
        ...over,
      },
      recorded,
    ),
  });
  return { p, recorded };
};

test('resolver: returns the shared day when both are visible and the event is public', async () => {
  const { p } = call();
  const days = await p;
  assert.equal(days.length, 1);
  assert.equal(days[0]!.slug, 'juan-and-maria');
  assert.equal(days[0]!.displayName, 'Juan & Maria');
});

test('resolver: scopes the story read EXPLICITLY — it never leans on RLS', async () => {
  const { p, recorded } = call();
  await p;
  const story = recorded.find((r) => r.table === 'person_story_items');
  assert.ok(story, 'the resolver must read person_story_items');
  assert.ok(story.filters.includes('in:person_id'), 'must scope to the two people BY HAND');
  assert.ok(story.filters.includes('is:hidden_at=null'), 'must exclude hidden rows');
  assert.ok(story.filters.includes('is:removed_at=null'), 'must exclude removed rows');
  assert.ok(story.filters.includes('not:consented_at:is'), 'must require the consent stamp');
});

test('resolver: an event that is not publicly visible yields NO shared day', async () => {
  const days = await call({
    events: [{ ...PUBLIC_EVENT, landing_page_visibility: 'private', scheduled_launch_at: null }],
  }).p;
  assert.deepEqual(days, []);
});

test('resolver: an event with no public address yields NO shared day', async () => {
  const days = await call({ events: [{ ...PUBLIC_EVENT, slug: null }] }).p;
  assert.deepEqual(days, []);
});

test('resolver: hiding on EITHER side empties the answer, both ways round', async () => {
  const hiddenA = [{ ...visible(A), hidden_at: 'x' }, visible(B)];
  assert.deepEqual(await call({ person_story_items: hiddenA }).p, []);
  assert.deepEqual(
    await call({ person_story_items: hiddenA }, ['user-b', 'user-a']).p,
    [],
  );
  const hiddenB = [visible(A), { ...visible(B), removed_at: 'x' }];
  assert.deepEqual(await call({ person_story_items: hiddenB }).p, []);
  assert.deepEqual(
    await call({ person_story_items: hiddenB }, ['user-b', 'user-a']).p,
    [],
  );
});

test('resolver: your own profile is never a list of shared days', async () => {
  assert.deepEqual(await call({}, ['user-a', 'user-a']).p, []);
});

test('resolver: an account with no person node simply has no shared days', async () => {
  assert.deepEqual(
    await call({ people: [{ person_id: A, claimed_by_user_id: 'user-a' }] }).p,
    [],
  );
});

test('resolver: the flag is the whole feature — OFF returns nothing and reads nothing', async () => {
  const recorded: Recorded[] = [];
  process.env[FLAG] = '0';
  try {
    const days = await resolveMutualStoryDays({
      viewerUserId: 'user-a',
      profileUserId: 'user-b',
      adminClient: stubClient(
        { people: PEOPLE, person_story_items: [visible(A), visible(B)], events: [PUBLIC_EVENT] },
        recorded,
      ),
    });
    assert.deepEqual(days, []);
    assert.equal(recorded.length, 0, 'flag-off must not touch the database at all');
  } finally {
    process.env[FLAG] = '1';
  }
});

test("resolver: 'true' is not '1' — only the exact value switches it on", async () => {
  process.env[FLAG] = 'true';
  try {
    assert.deepEqual(await call().p, []);
  } finally {
    process.env[FLAG] = '1';
  }
});
