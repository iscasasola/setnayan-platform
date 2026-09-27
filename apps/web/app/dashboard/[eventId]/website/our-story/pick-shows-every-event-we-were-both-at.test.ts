/**
 * pick-shows-every-event-we-were-both-at.test.ts — owner 2026-09-27: *"this
 * should show all events that they are both there."*
 *
 * "Pick from our events" listed only events where the SIGNED-IN partner was the
 * couple. It now lists every other event where BOTH partners are members, in
 * any role, newest first — and offers photos only from the ones they host.
 *
 *   1. the rule (`sharedEvents`): both must be live members; a declined/left
 *      membership (`hidden_at`) does not count; hosted = either is a host (couple or coordinator);
 *   2. the read (`readOurEvents`) drives the REAL control flow through a fake
 *      admin client: refused for a non-couple, fail-closed on any error, refs
 *      only from hosted events, newest first;
 *   3. the page and the pick action ask the SAME read — the action can never
 *      accept a ref the page did not offer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { newestFirst, sharedEvents, type MembershipRow } from './_components/our-events-rule';

const HERE = __dirname;
const A = 'user-a';
const B = 'user-b';
const C = 'user-c';
const THIS = 'ev-this';
type Raw = { event_id: string; user_id: string; member_type: string; hidden_at: string | null };
const row = (event_id: string, user_id: string, member_type: string, hidden_at: string | null = null): Raw => ({
  event_id,
  user_id,
  member_type,
  hidden_at,
});
/** What the reader hands the rule: host decided by the shared definition. */
const asRule = (rows: Raw[]): MembershipRow[] =>
  rows.map((r) => ({ event_id: r.event_id, user_id: r.user_id, host: ['couple', 'coordinator'].includes(r.member_type), hidden_at: r.hidden_at }));

const ROWS: Raw[] = [
  row(THIS, A, 'couple'),
  row(THIS, B, 'couple'),
  row('ev-friends-wedding', A, 'guest'),
  row('ev-friends-wedding', B, 'guest'),
  row('ev-a-birthday', A, 'couple'),
  row('ev-a-birthday', B, 'guest'),
  row('ev-b-baptism', B, 'couple'),
  row('ev-b-baptism', A, 'guest'),
  row('ev-cousin-debut', A, 'coordinator'),
  row('ev-cousin-debut', B, 'guest'),
  row('ev-supplier-gig', A, 'vendor'),
  row('ev-supplier-gig', B, 'guest'),
  row('ev-only-a', A, 'guest'),
  row('ev-declined', A, 'guest'),
  row('ev-declined', B, 'guest', '2026-09-01T00:00:00Z'),
  row('ev-with-c', C, 'couple'),
  row('ev-with-c', A, 'guest'),
];

test('📐 both must be there: every shared event, any role, hosted when either is a host', () => {
  const rule = asRule(ROWS);
  assert.deepEqual(sharedEvents(rule, [A, B], THIS), [
    { eventId: 'ev-a-birthday', hosted: true },
    { eventId: 'ev-b-baptism', hosted: true },
    { eventId: 'ev-cousin-debut', hosted: true },
    { eventId: 'ev-friends-wedding', hosted: false },
    { eventId: 'ev-supplier-gig', hosted: false },
  ]);
  assert.deepEqual(sharedEvents(rule, [B, A], THIS), sharedEvents(rule, [A, B], THIS), 'symmetric in the pair');
  assert.deepEqual(sharedEvents(rule, [], THIS), []);
  // One partner has an account: the intersection of one is their own events.
  assert.deepEqual(
    sharedEvents(rule, [A], THIS).map((e) => e.eventId),
    ['ev-a-birthday', 'ev-b-baptism', 'ev-cousin-debut', 'ev-declined', 'ev-friends-wedding', 'ev-only-a', 'ev-supplier-gig', 'ev-with-c'],
  );
});

test('📅 newest first, undated last', () => {
  const list = [
    { eventId: 'x', date: null },
    { eventId: 'a', date: '2024-02-01' },
    { eventId: 'b', date: '2026-01-01' },
  ];
  assert.deepEqual(newestFirst(list).map((e) => e.eventId), ['b', 'a', 'x']);
});

/** A tiny PostgREST stand-in: `from().select().eq()/.in()/.limit()`, awaitable. */
function fakeAdmin(tables: Record<string, Record<string, unknown>[]>, failOn?: string) {
  return {
    from(table: string) {
      const filters: ((r: Record<string, unknown>) => boolean)[] = [];
      const q = {
        select: () => q,
        eq: (col: string, v: unknown) => (filters.push((r) => r[col] === v), q),
        in: (col: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[col])), q),
        limit: () => q,
        then(resolve: (v: unknown) => void) {
          if (failOn === table) return resolve({ data: null, error: { message: 'refused' } });
          resolve({ data: (tables[table] ?? []).filter((r) => filters.every((f) => f(r))), error: null });
        },
      };
      return q;
    },
  } as never;
}

const EVENTS = [
  { event_id: 'ev-friends-wedding', display_name: 'Carla & Dan', event_date: '2025-06-01', our_photos: ['r2://setnayan-media/cd/1.jpg'], landing_page_hero_image_url: 'r2://setnayan-media/cd/hero.jpg' },
  { event_id: 'ev-a-birthday', display_name: 'Ana turns 30', event_date: '2023-03-03', our_photos: ['r2://setnayan-media/ab/1.jpg', 'r2://setnayan-thread-files/secret.jpg'], landing_page_hero_image_url: null },
  { event_id: 'ev-b-baptism', display_name: 'Baby Ben', event_date: '2026-01-10', our_photos: [], landing_page_hero_image_url: 'r2://setnayan-media/bb/hero.jpg' },
  { event_id: 'ev-cousin-debut', display_name: 'Mia at 18', event_date: '2024-08-08', our_photos: ['r2://setnayan-media/md/1.jpg'], landing_page_hero_image_url: null },
  { event_id: 'ev-supplier-gig', display_name: 'A client wedding', event_date: null, our_photos: ['r2://setnayan-media/cw/1.jpg'], landing_page_hero_image_url: null },
];

test('🔒 the read: refs only from hosted events, never another couple’s gallery, newest first', async () => {
  const { readOurEvents } = await import('./_components/our-events-read');
  const got = await readOurEvents({ userId: A, eventId: THIS, adminClient: fakeAdmin({ event_members: ROWS, events: EVENTS }) });
  assert.ok(got);
  assert.deepEqual(
    got.map((e) => [e.eventId, e.hosted, e.refs]),
    [
      ['ev-b-baptism', true, ['r2://setnayan-media/bb/hero.jpg']],
      ['ev-friends-wedding', false, []],
      ['ev-cousin-debut', true, ['r2://setnayan-media/md/1.jpg']],
      ['ev-a-birthday', true, ['r2://setnayan-media/ab/1.jpg']],
      ['ev-supplier-gig', false, []],
    ],
  );
});

test('⛔ refused for anyone who is not the couple here, and fail-closed on any error', async () => {
  const { readOurEvents } = await import('./_components/our-events-read');
  const tables = { event_members: ROWS, events: EVENTS };
  assert.equal(await readOurEvents({ userId: C, eventId: THIS, adminClient: fakeAdmin(tables) }), null);
  assert.equal(await readOurEvents({ userId: '', eventId: THIS, adminClient: fakeAdmin(tables) }), null);
  assert.equal(await readOurEvents({ userId: A, eventId: THIS, adminClient: fakeAdmin(tables, 'event_members') }), null);
  assert.equal(await readOurEvents({ userId: A, eventId: THIS, adminClient: fakeAdmin(tables, 'events') }), null);
});

test('🤝 the page offers and the pick accepts from the SAME read', () => {
  const page = readFileSync(join(HERE, 'page.tsx'), 'utf8');
  const actions = readFileSync(join(HERE, 'actions.ts'), 'utf8');
  assert.match(page, /await readOurEvents\(\{ userId, eventId \}\)/, 'the page reads the shared scope');
  const pick = actions.slice(actions.indexOf("'pick'"), actions.indexOf('── THE CAP, ON THE SERVER'));
  assert.match(pick, /await ourEventPhotoRefs\(user\.id, eventId\)/, 'the pick checks against the same read');
  assert.doesNotMatch(actions, /member_type', 'couple'\)/, 'no second, narrower list of "our" events in the action');
});
