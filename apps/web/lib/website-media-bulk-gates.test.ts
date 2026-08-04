/**
 * website-media-bulk-gates.test.ts — the five gates on the only action that
 * can delete a thousand files at once.
 *
 * ─── WHY THIS TEST IS THE PRODUCT ────────────────────────────────────────
 * `actions.ts` used to state, in its own header, that a bulk delete "would be a
 * mistake: the left-over verdict comes from a database read, and a read that
 * breaks or gets scoped wrong reports every file as left-over at once. One
 * keystroke should never be able to act on that."
 *
 * That reasoning was right, and it is not dismissed — the prohibition was
 * lifted only because `/admin/website-media` reported **1,878** deletable
 * files, and a surface that can only be cleared one confirmation at a time
 * never gets cleared. So the danger had to be CAUGHT rather than avoided, and
 * these gates are the catching. If they are weakened, the original prohibition
 * should come back with them.
 *
 * A source scan rather than an execution test, deliberately: the action's real
 * dependencies are R2 and the whole reference-read stack, and a mocked version
 * of those would prove the mock has gates, not the action. What is checkable
 * without a bucket is that each refusal exists, is server-side, and comes
 * BEFORE the delete loop — which is exactly what an accidental reorder or a
 * "simplifying" edit would break.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(
  join(resolve(HERE, '..'), 'app', 'admin', 'website-media', 'actions.ts'),
  'utf8',
);
/** The bulk action alone — the single-file one has its own, different gates. */
const BULK = SRC.slice(SRC.indexOf('export async function clearLeftoverMediaAction'));
const DELETE_LOOP = BULK.indexOf('for (const key of leftover)');

function before(needle: string, what: string) {
  const i = BULK.indexOf(needle);
  assert.ok(i > -1, `${what}: not found at all`);
  assert.ok(i < DELETE_LOOP, `${what}: sits AFTER the delete loop — it cannot prevent anything`);
}

test('the delete loop exists and is the last thing that happens', () => {
  assert.ok(DELETE_LOOP > -1, 'the bulk action no longer deletes anything — this test is stale');
});

test('GATE 1 · admin is required, and required first', () => {
  before('requireAdminAction()', 'the admin gate');
});

test('GATE 2 · the verdict is RE-READ, never taken from the screen', () => {
  before('loadWebsiteMedia()', 'the fresh read');
  // The action must not accept a list of keys from the caller — that would make
  // the browser the authority on what gets deleted.
  const sig = BULK.slice(0, BULK.indexOf(')'));
  assert.ok(
    !/keys|files|rows/.test(sig),
    `the bulk action takes a caller-supplied file list (${sig.trim()}) — the server must ` +
      `decide what is deletable, not the page that rendered a moment ago`,
  );
});

test('GATE 3 · a read that did not complete deletes NOTHING', () => {
  // A failed lookup and an empty result are the same value. This is the exact
  // hazard the original prohibition named.
  before('group.lookupFailure', 'the failed-lookup refusal');
  before('group.listingError', 'the failed-listing refusal');
  before('group.truncated', 'the truncated-listing refusal');
});

test('GATE 4 · "everything is left over" is treated as a broken query, not a tidy bucket', () => {
  // The signature of a mis-scoped read: nothing anywhere reads as in use.
  before('inUseEverywhere', 'the implausible-verdict refusal');
  assert.match(
    BULK,
    /inUseEverywhere === 0/,
    'the implausible-verdict check no longer tests for a total absence of in-use files',
  );
});

test('GATE 5 · the confirmed count must still be the real count', () => {
  before('expectedCount', 'the count confirmation');
  assert.match(
    BULK,
    /leftover\.length !== args\.expectedCount/,
    'the count is no longer compared against the fresh read — a bucket that changed ' +
      'between render and click would be acted on anyway',
  );
});

test('every deleted key still goes through the single-file key allowlist', () => {
  const loop = BULK.slice(DELETE_LOOP);
  assert.match(
    loop,
    /assertDeletableKey\(key\)/,
    'the bulk loop skips the prefix allowlist that the single-file path enforces',
  );
  assert.match(loop, /R2_BUCKETS\.media/, 'the bulk loop deletes from somewhere other than the media bucket');
});

test('only rows THIS read calls unreferenced are eligible', () => {
  assert.match(
    BULK,
    /filter\(\(r\) => isDeletableUsage\(r\.usage\)\)/,
    'the eligible set is no longer filtered through isDeletableUsage — "In use" and ' +
      '"Not sure" must both be refused, and "Not sure" as firmly as "In use"',
  );
});

test('the header still tells the truth about the prohibition it reversed', () => {
  // The old header forbade this action. A reader who finds the action but not
  // the reversal will assume it slipped in unnoticed — and the reasoning behind
  // the original rule is the thing worth carrying forward.
  const header = SRC.slice(0, SRC.indexOf('import '));
  assert.match(header, /1,878/, 'the header no longer records why the rule changed');
  assert.match(
    header,
    /gates 3 and 4/i,
    'the header no longer points at the gates that answer the original objection',
  );
});
