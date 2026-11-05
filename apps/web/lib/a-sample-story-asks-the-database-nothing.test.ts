/**
 * a-sample-story-asks-the-database-nothing.test.ts — A /realstories SAMPLE IS NOT AN EVENT ROW, SO ITS
 * WORDS ARE NEVER LOOKED UP BY ITS SENTINEL ID.
 *
 * Production fault log, 2026-10-02 → 2026-10-15: `DB_READ_REFUSED · GET events · 22P02: invalid input
 * syntax for type uuid` — 75 hits. Vercel's log named the page: every render of
 * `/realstories/jack-and-jill-cebu-beach-wedding` (and the other samples) sent
 * `events?event_id=eq.sample-jack-and-jill`. `EditorialContent` resolves its words with
 * `eventWordsForEvent(eventId)` → `resolveProfileByEvent` → `readEventTypeRow`, before any of its
 * sample guards; `events.event_id` is a `uuid`, so the read is not "no row" — Postgres refuses the
 * statement, and the refusal path asked a second time.
 *
 * The property, held at the one reader every caller shares: a string Postgres would refuse as a
 * uuid never reaches the database, and resolves exactly as an absent row does (WEDDING_PROFILE).
 * A real uuid still asks — checked too, so this cannot pass by a stub that sees nothing.
 *
 * SABOTAGE (2026-10-15): drop the `isUuid` line in `readEventTypeRow` → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://db.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const sent: string[] = [];
globalThis.fetch = ((input: RequestInfo | URL) => {
  const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
  sent.push(url);
  return Promise.resolve(new Response('null', { status: 200, headers: { 'content-type': 'application/json' } }));
}) as typeof fetch;

test('a sample story’s sentinel id sends no read to `events`; a real event id still does', async () => {
  const { resolveProfileByEvent, WEDDING_PROFILE } = await import('./event-type-profile');
  const { SAMPLE_EDITORIAL_ID_LIST } = await import('../app/[slug]/_components/editorial/sample-ids');
  for (const id of SAMPLE_EDITORIAL_ID_LIST) {
    const profile = await resolveProfileByEvent(id);
    assert.equal(profile, WEDDING_PROFILE, `${id} must resolve like an absent row`);
  }
  assert.deepEqual(
    sent.filter((u) => u.includes('/rest/v1/events')),
    [],
    'a sentinel id reached the database — Postgres answers 22P02 and the Problems list fills with it',
  );
  await resolveProfileByEvent('0b1e7a52-3f7e-4c2a-9d1b-6a5e2c8f4d10');
  assert.ok(sent.some((u) => u.includes('/rest/v1/events')), 'the stub saw no read at all — this test would pass blind');
});
