/**
 * the-agreed-card-reads-its-event.test.ts — "Agreed now" on a supplier's booked client never says "Couldn't load what is
 * agreed" because the supplier's own session cannot read the couple's event (walk 13 Nov 2026, F-W1-59).
 *
 * SABOTAGE: read the event through the session client only again → RED; drop the "on the event" proof (read the event
 * with the service client unconditionally) → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const src = stripComments(readFileSync(join(import.meta.dirname, 'agreed-now.tsx'), 'utf8'));

test('the event’s facts come through the service client once the supplier has shown it is on the event', () => {
  assert.match(src, /const onTheEvent = Boolean\(threadId\) \|\| \(\(quotes\.data \?\? \[\]\) as unknown\[\]\)\.length > 0;/);
  assert.match(src, /onTheEvent\s*\?\s*await createAdminClient\(\)\.from\('events'\)\.select\('event_date, estimated_pax, final_pax'\)/);
  assert.doesNotMatch(src, /Promise\.all\(\[\s*supabase\.from\('events'\)/, 'the event is read in the RLS batch again');
});
