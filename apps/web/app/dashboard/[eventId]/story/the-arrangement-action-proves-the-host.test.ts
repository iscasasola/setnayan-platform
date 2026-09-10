/**
 * THE ARRANGEMENT'S ACTION PROVES THE HOST BEFORE THE SERVICE ROLE WRITES.
 *
 * `saveArrangement` is a public POST that ends in a service-role write, so the ONLY thing
 * between a stranger and somebody's story is the host check in front of it. The document rules
 * are tested as pure code (`lib/story-arrangement*.test.ts`) and the write in the real database
 * (`tests/db/the-arrangement-is-kept.db.test.ts`); what is left is a WIRING claim — that the
 * action asks, and asks first — which is what a source scan can establish.
 *
 * Each claim is its own assertion, anchored on the statement itself rather than a count.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

/** The repo's ONE stripper — a docblock describing the check is not the check. */
function body(): string {
  const src = stripComments(readFileSync(join(import.meta.dirname, 'arrangement-actions.ts'), 'utf8'));
  const start = src.indexOf('export async function saveArrangement');
  assert.ok(start >= 0, 'saveArrangement is gone from arrangement-actions.ts');
  return src.slice(start);
}

test('the host is proved through the caller\'s own session, and a non-host is turned away', () => {
  const b = body();
  const ask = b.search(/const\s+userId\s*=\s*await\s+hostUserId\s*\(\s*eventId\s*\)/);
  assert.ok(ask >= 0, 'saveArrangement no longer asks hostUserId(eventId)');
  const refuse = b.search(/if\s*\(\s*!userId\s*\)\s*\{?\s*return\b/);
  assert.ok(refuse > ask, 'a caller who is not a host is no longer turned away before the write');
});

test('…and only THEN does the service role write', () => {
  const b = body();
  const refuse = b.search(/if\s*\(\s*!userId\s*\)/);
  const write = b.search(/saveStoryArrangement\s*\(\s*createAdminClient\s*\(\s*\)/);
  assert.ok(write >= 0, 'the action no longer writes through saveStoryArrangement');
  assert.ok(write > refuse, 'the service-role write now happens before the host is proved');
});

test('an autosave revalidates nothing — it would re-fetch the Story Maker on every change', () => {
  assert.equal(/revalidate(Path|Tag)\s*\(/.test(body()), false);
});
