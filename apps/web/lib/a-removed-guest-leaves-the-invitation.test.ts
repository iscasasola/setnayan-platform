/**
 * A GUEST THE COUPLE REMOVED IS NOT ON THEIR INVITATION.
 *
 * ── 🔴 THE DEFECT, FOUND BY THE OWNER ON HIS OWN WEDDING ───────────────────
 * The entourage read shipped without `.is('deleted_at', null)`, and `guests`
 * deletes SOFTLY — the row stays, with a timestamp. So two people the couple had
 * removed that morning were still printed on the public invitation: a best man
 * and a principal sponsor.
 *
 * 🔑 IT DID NOT LOOK LIKE A DELETED ROW. It looked like a DUPLICATE — the same
 * name twice — because the live row and the removed one differ only in a column
 * nobody renders. I reported it to the owner as duplicate data to clean up,
 * twice, and he corrected me from his own screen: *"i can only see 1 indalecio
 * and 1 indalecia"*, then *"i also only see 1 subia"*. He was right both times.
 *
 * ⚠ AND THE QUERY I DIAGNOSED IT WITH HAD THE SAME OMISSION as the code I was
 * diagnosing, so it confirmed my wrong answer. That is the real lesson here and
 * the reason this test asserts the SOURCE rather than a resolver's output: a
 * pure function cannot see a missing WHERE clause, and neither can a second
 * query written by the same hand.
 *
 * ── WHY A SOURCE ASSERTION AND NOT A ROUND TRIP ────────────────────────────
 * `loadEntourage` needs an admin Supabase client and a live database; there is
 * no unit-level seam where the filter is observable. The property that matters
 * is "the query says deleted_at is null", and that IS checkable. The db-replay
 * suite would catch it end to end; this catches it in the second it takes to
 * run, on every commit.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

/**
 * `loadEntourage`'s query, comments removed so prose can never satisfy a check.
 *
 * 🪤 WHITESPACE IS COLLAPSED FIRST, AND THAT IS NOT TIDINESS. This repo's
 * `stripComments` replaces a comment with SPACES OF THE SAME LENGTH so every
 * offset survives — so a fixed-size window measured in characters is mostly
 * blank once a docblock sits inside it, and the line you are looking for falls
 * off the end. The first cut of this guard failed against the very fix it was
 * written to protect, for exactly that reason.
 */
function entourageRead(): string {
  const src = stripComments(
    readFileSync(join(process.cwd(), 'app/[slug]/_lib/loaders.ts'), 'utf8'),
  );
  /* 🪤 ANCHOR ON THE DECLARATION, NOT THE NAME. `indexOf('loadEntourage')`
     matched `loadEntourageSectionOrder` the day that loader landed above this
     one, and the guard went red while reading the wrong function. A bare-name
     anchor faces whichever match comes first. */
  const start = src.indexOf('export const loadEntourage = cache(');
  assert.ok(start > 0, 'loadEntourage is gone — this guard is pointing at nothing');
  const body = src.slice(start).replace(/\s+/g, ' ').slice(0, 700);
  /* Vacuity: if the slice missed the query, every assertion below is about
     nothing and would pass forever. */
  assert.ok(body.includes('.from('), 'the slice does not contain the query at all');
  return body;
}

test('the entourage read excludes removed guests', () => {
  assert.ok(
    /\.is\(\s*['"]deleted_at['"]\s*,\s*null\s*\)/.test(entourageRead()),
    'loadEntourage no longer filters deleted_at — a guest the couple REMOVED is back on their public invitation',
  );
});

test('it still reads the event it was asked for', () => {
  // Paired with the check above so a future edit cannot satisfy one by
  // deleting the other: a read with no event filter would publish one couple's
  // entourage on another couple's page.
  assert.ok(
    /\.eq\(\s*['"]event_id['"]\s*,\s*eventId\s*\)/.test(entourageRead()),
    'loadEntourage no longer scopes to the event',
  );
});

/*
  ⛔ WHAT THIS FILE DELIBERATELY DOES NOT ASSERT: "every guests read in
  loaders.ts filters deleted_at". I wrote that rule first and it is FALSE —
  `loaders.ts` also looks a single guest up by `guest_id` (the UGC-terms read),
  where the filter is neither present nor wanted. A guard that states an untrue
  rule is worse than no guard: it goes red for correct code, and the next person
  weakens it rather than reading it. The true property is narrower and is the one
  above — the read that PUBLISHES a list of names must exclude removed rows.
*/
