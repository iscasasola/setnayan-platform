/**
 * THE AUTO STORY CANNOT PUBLISH ITSELF (Event Hub Maker Phase 8).
 *
 * Post Event is compiled on the couple's first open after the day and written
 * into `event_editorial.draft_json`. That write must never be a second door to
 * Discover: publishing stays the couple's act, through `saveEditorial`'s gate
 * (`publishBlockers` — desk clear + the consent tick) and the database trigger
 * that raises `story:publish_needs_consent` (held by
 * `tests/db/the-two-doors-are-shut.db.test.ts`).
 *
 * So the compile's ONE write may carry `draft_json` and nothing else — no
 * `status`, no `publish_consent_at`, no `published_at`, no edition stamp. A
 * property of the write, not of a comment.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const src = stripComments(readFileSync(join(WEB, 'lib/post-event-compile.server.ts'), 'utf8'));

test('the compile writes draft_json and nothing that decides who reads the story', () => {
  const writes = [...src.matchAll(/\.(update|upsert|insert)\(\s*\{([^}]*)\}/g)];
  assert.equal(writes.length, 1, `exactly one write expected, found ${writes.length}`);
  const [, verb, body] = writes[0]!;
  assert.equal(verb, 'update', 'an update of the existing row — never an upsert that could create one');
  const keys = [...body!.matchAll(/(\w+)\s*:/g)].map((m) => m[1]);
  assert.deepEqual(keys, ['draft_json']);
  for (const forbidden of ['status', 'publish_consent_at', 'published_at', 'edition_no', 'edition_volume']) {
    assert.ok(!new RegExp(`\\b${forbidden}\\b`).test(src), `the compile must not touch ${forbidden}`);
  }
});

test('the publish gate is still the couple’s: saveEditorial asks for consent before published', () => {
  const actions = stripComments(
    readFileSync(join(WEB, 'app/dashboard/[eventId]/story/actions.ts'), 'utf8'),
  );
  assert.match(actions, /publishBlockers\(\{[\s\S]*consented:\s*consentedAt\s*!==\s*null/);
  const trigger = readFileSync(
    join(WEB, '../../supabase/migrations/20271217599705_the_two_doors_the_database_left_open.sql'),
    'utf8',
  );
  assert.match(trigger, /RAISE EXCEPTION 'story:publish_needs_consent'/);
});
