/**
 * A6-B13 (final check 25 Nov) — a shop with chats can upload a contract: the picker's couples are this shop's
 * threads, named through the scoped service-role reader, never through the thread's `event` embed (always null for a
 * supplier: no `events` RLS).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const src = stripComments(readFileSync(join(__dirname, 'page.tsx'), 'utf8'));

test('the picker never filters threads on the null `event` embed', () => {
  assert.doesNotMatch(src, /\.filter\(\(t\) => t\.event\)/);
  assert.doesNotMatch(src, /t\.event!?\.display_name/);
});

test('names come from fetchInquiryCustomerFacts over the event ids of the caller-read threads', () => {
  assert.match(src, /fetchInquiryCustomerFacts\(createAdminClient\(\), threadEventIds\)/);
  assert.match(src, /threads\.map\(\(t\) => t\.event_id\)/);
});

test('threads with no names back is said as a failed read, never "not in conversation with a couple"', () => {
  assert.match(src, /threadEventIds\.length > 0 && facts\.size === 0\) threadsMeasured = false/);
});
