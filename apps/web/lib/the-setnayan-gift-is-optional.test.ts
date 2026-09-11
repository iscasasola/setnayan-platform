/**
 * THE SETNAYAN GIFT IS OPTIONAL — and it was written in THREE places.
 *
 * Owner ruling 2026-09-09, verbatim: *"exclusive setnayan gift then should be
 * optional."* Until that day a shop could not publish a service card at all
 * without typing one.
 *
 * 🔴 WHY THIS GUARD EXISTS RATHER THAN A COMMENT. The rule lived in three
 * independent places and relaxing any two of them ships nothing a person can
 * see:
 *
 *   1. `PUBLISH_REQUIREMENTS` in `service-publish-gate.ts` — the TypeScript the
 *      two server actions and the editor's save button ask.
 *   2. `enforce_service_publish_gate()` in the DATABASE — load-bearing, not
 *      belt-and-braces: `vendor_services` carries a PERMISSIVE `FOR ALL` policy
 *      and `authenticated` holds UPDATE on all 40 columns, so a shop can PATCH
 *      `is_active` through PostgREST and meet no TypeScript at all. Relax only
 *      the TypeScript and the shop presses Publish and reads a raw Postgres
 *      sentence in a banner.
 *   3. The maker's GUIDED FIRST PASS (`canvas-maker.tsx`) — which held
 *      Continue until a gift was typed. This is the one a NEW shop meets first,
 *      so relaxing the other two without it would have left the ruling
 *      invisible to exactly the people it is for.
 *
 * 🔑 Each assertion below is DERIVED from the file that decides it — the SQL is
 * read out of the migration, not restated — so TypeScript and SQL cannot drift
 * apart while this test stays green. *A rule written three times has two copies
 * that will disagree.*
 *
 * ⚖ WHAT IS NOT TESTED HERE, deliberately: that a gift still RENDERS. It does —
 * `exclusive_perk_text` stays on the table, stays displayed, and still decides
 * the card's badge. What was retired is the REQUIREMENT, not the field.
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  PUBLISH_COACH_MESSAGE,
  PUBLISH_REFUSAL_MESSAGE,
  PUBLISH_REQUIREMENTS,
  canPublishService,
  unmetPublishRequirements,
} from './service-publish-gate';

const WEB = join(import.meta.dirname, '..');
const REPO = join(WEB, '..', '..');
const MIGRATIONS = join(REPO, 'supabase', 'migrations');
const read = (p: string) => readFileSync(p, 'utf8');

/** The migration that made the gift optional, found by name, not by date. */
function giftMigration(): string {
  const hits = readdirSync(MIGRATIONS).filter((f) =>
    f.endsWith('_the_setnayan_gift_is_optional.sql'),
  );
  assert.equal(
    hits.length,
    1,
    `expected exactly one gift migration, found ${hits.length}: ${hits.join(', ')}`,
  );
  return read(join(MIGRATIONS, hits[0] as string));
}

/**
 * Strip SQL comments before matching. Every one of these migrations explains
 * the rule it removed, IN PROSE, naming the very column it stopped checking —
 * so a raw-source match reports the defect it just fixed. (This repo has been
 * bitten by exactly that: a guard went red on the comment explaining its fix.)
 */
function sqlBody(src: string): string {
  return src
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');
}

test('1 · the TypeScript gate no longer requires a gift', () => {
  assert.ok(
    !(PUBLISH_REQUIREMENTS as readonly string[]).includes('exclusive'),
    'the gift is back in PUBLISH_REQUIREMENTS — that is a RATE change (5% → 7%), not a tidy-up',
  );
  // H2 (2026-09-11) added the cover and "what's included" — the owner's own
  // "the cover-photo · title · inclusions requirements stay". The gift is still
  // not among them, which is what this test is for.
  assert.deepEqual([...PUBLISH_REQUIREMENTS], ['cover', 'price', 'inclusions']);
  const complete = { hasPrice: true, hasCover: true, hasInclusions: true };
  assert.equal(canPublishService(complete), true, 'a complete card with no gift cannot publish');
  assert.equal(canPublishService({ ...complete, hasPrice: false }), false, 'the price stopped being required');
  assert.deepEqual(unmetPublishRequirements({ ...complete, hasPrice: false }), ['price']);
});

test('1b · every surviving requirement still has both of its sentences', () => {
  // Removing a requirement must not leave a message record keyed on a word the
  // union no longer has, nor a requirement with no sentence to show.
  for (const requirement of PUBLISH_REQUIREMENTS) {
    assert.ok(PUBLISH_REFUSAL_MESSAGE[requirement]?.trim().length > 0);
    assert.ok(PUBLISH_COACH_MESSAGE[requirement]?.trim().length > 0);
  }
  assert.deepEqual(Object.keys(PUBLISH_REFUSAL_MESSAGE).sort(), [...PUBLISH_REQUIREMENTS].sort());
  assert.deepEqual(Object.keys(PUBLISH_COACH_MESSAGE).sort(), [...PUBLISH_REQUIREMENTS].sort());
});

test('2 · the DATABASE trigger stopped refusing, and still refuses an unpriced publish', () => {
  const body = sqlBody(giftMigration());
  assert.match(
    body,
    /CREATE OR REPLACE FUNCTION public\.enforce_service_publish_gate\(\)/,
    'the migration does not replace the trigger function at all',
  );
  assert.ok(
    !/exclusive_perk_text/.test(body),
    'the replaced trigger still mentions exclusive_perk_text — the database would keep refusing while the app allows it',
  );
  assert.ok(
    !/Setnayan Exclusive perk is required/.test(body),
    'the old refusal sentence survived in the function body',
  );
  // …and the half that must NOT have been lost while removing the other.
  //
  // 🪤 THIS ASSERTION WAS DECORATION ON ITS FIRST WRITING, and only a mutation
  // found it. It matched `/v_priced\s*:=/` — which `v_priced := TRUE;` satisfies
  // exactly as well as the real check, so gutting the price predicate left it
  // GREEN. Match the PREDICATE, never the assignment: an occurrence count on the
  // left-hand side cannot see the right-hand side being replaced.
  assert.match(
    body,
    /v_priced\s*:=\s*NEW\.starting_price_php IS NOT NULL AND NEW\.starting_price_php > 0/,
    'the price predicate was gutted — the trigger would publish an unpriced card',
  );
  assert.match(
    body,
    /Set a starting price before you publish this card/,
    'the price refusal sentence was dropped or reworded',
  );
  assert.match(
    body,
    /IF NEW\.is_active IS NOT TRUE THEN\s*\n\s*RETURN NEW;/,
    'the draft escape hatch was lost — every draft would now be judged',
  );
});

test('2b · the trigger stopped RE-JUDGING a live card when its gift text changes', () => {
  // Subtle and worth its own assertion: the old function also listed
  // `exclusive_perk_text` in its "should I judge this UPDATE at all" test.
  // Leaving it there would re-run the whole gate whenever a shop edited a
  // now-optional field, and refuse the card for something else.
  const body = sqlBody(giftMigration());
  const judging = body.slice(body.indexOf('v_judging :='), body.indexOf('IF NOT v_judging'));
  assert.ok(judging.length > 0, 'the judging clause is gone entirely');
  assert.ok(
    !/exclusive/i.test(judging),
    'editing the optional gift still re-opens the publish gate on a live card',
  );
  assert.match(judging, /starting_price_php/, 'the judging clause stopped watching the price');
});

test('3 · the guided first pass lets a shop walk past the gift', () => {
  const maker = read(
    join(WEB, 'app', 'vendor-dashboard', 'services', '_components', 'canvas-maker.tsx'),
  );
  const start = maker.indexOf('const passAnswered =');
  assert.ok(start > 0, 'the pass no longer computes whether its question is answered');
  const clause = maker.slice(start, maker.indexOf(';', start));
  assert.ok(
    !/perk/.test(clause),
    'Continue still waits for a gift — a new shop cannot reach the state the ruling created',
  );
  // The two that DO still hold it, so this never becomes "nothing blocks anything".
  assert.match(clause, /snap\.hasCover/, 'the cover photo stopped holding Continue');
  assert.match(clause, /snap\.hasPrice/, 'the price stopped holding Continue');
});

test('4 · nothing in the app still calls the gate with a gift fact', () => {
  // `PublishFacts.hasExclusive` was DELETED rather than left ignored, so that a
  // caller cannot keep passing it and believe it still decides something. If a
  // new call site reintroduces the property this fails before the type error
  // reaches a reviewer.
  const files = [
    join(WEB, 'app', 'vendor-dashboard', 'services', 'actions.ts'),
    join(WEB, 'app', 'vendor-dashboard', 'services', '_components', 'publish-gate-submit.tsx'),
    join(WEB, 'app', 'vendor-dashboard', 'services', '_components', 'service-wizard.tsx'),
    join(WEB, 'lib', 'card-health.ts'),
  ];
  for (const f of files) {
    assert.ok(
      !/hasExclusive:\s*exclusiveIsSet|hasExclusive:\s*hasPerk/.test(read(f)),
      `${f} still feeds a gift fact to the publish gate`,
    );
  }
});
