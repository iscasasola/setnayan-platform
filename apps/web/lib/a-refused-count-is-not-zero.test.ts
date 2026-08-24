/**
 * SAY WHAT IS TRUE ABOUT A REFUSED COUNT — AND ABOUT WHO IS READING.
 *
 * Four sentences in this tree asserted things that were not so, and each one
 * was load-bearing: somebody read it and stopped checking.
 *
 *  1. `countGuestsByEvent` "already returns null for a refused read". It does
 *     not. An RLS refusal arrives as `count: 0, error: null` — the null path
 *     covers a query that FAILED. So the finished-event summary tells a
 *     delegate the wedding had nobody at it.
 *  2. Two seating export routes: "RLS scopes every read to the couple — a
 *     non-member gets null/empty". `events_moderator_read` admits every
 *     accepted delegate, so a helper reaches those routes and downloads a
 *     complete-looking empty document.
 *  3. The refusal notice said "The couple haven't shared…" — one day after the
 *     solemn register shipped, on a screen that also serves funerals.
 *
 * 🔑 A COMMENT IS NOT A MECHANISM, AND A WRONG ONE IS WORSE THAN NONE: it
 * answers the question a reader came to ask, so they stop asking it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const FILES = {
  guests: 'lib/guests.ts',
  summary: 'lib/after-summary.ts',
  print: 'app/dashboard/[eventId]/seating/print/route.ts',
  caterer: 'app/dashboard/[eventId]/seating/caterer/route.ts',
  notice: 'app/dashboard/[eventId]/_components/not-shared-with-you.tsx',
} as const;

function src(k: keyof typeof FILES): string {
  return readFileSync(FILES[k], 'utf8');
}

test('nothing claims a refused count comes back null', () => {
  // The claim, in either file, in the shape it was written.
  for (const k of ['guests', 'summary'] as const) {
    assert.ok(
      !/returns `null` for a\s*\n?\s*\*?\s*refused read/.test(src(k)),
      `${FILES[k]} still promises a null that a refused read never produces`,
    );
  }
  assert.ok(
    /cannot be\s*\n?\s*\/\/ TOLD APART FROM AN EMPTY EVENT/i.test(src('guests')),
    'lib/guests.ts must say what a zero actually means',
  );
});

test('no route claims RLS scopes it to the couple', () => {
  // 🔑 DERIVED, NOT TYPED: sweep the tree for the sentence rather than the two
  // files I happened to open. It was in four places, not two.
  const { execSync } = require('node:child_process') as typeof import('node:child_process');
  const hits = execSync(
    "grep -rl 'RLS scopes every read to the couple' app lib || true",
    { encoding: 'utf8', shell: '/bin/bash' },
  )
    .split('\n')
    .filter(Boolean)
    // ⚠ EXCLUDING THIS FILE. Its first run reported itself, because a guard
    // that quotes the sentence it bans matches the sentence it bans.
    .filter((f) => !f.includes('.test.'));

  // 🔑 FOUR, NOT TWO. My first cut asserted "at most two remain and both are
  // couple-only" — I had opened the two seating exports and assumed the others
  // were gated. Neither is: both rely on the same `events` read, which admits
  // every accepted delegate. Assuming would have left the false sentence in two
  // more places while a test asserted it was fine.
  assert.deepEqual(hits, [], `these still claim the couple are the only readers: ${hits.join(', ')}`);
});

test('the refusal notice does not assume the event has a couple', () => {
  const s = src('notice');
  assert.ok(
    !/The couple haven/.test(s),
    'a funeral has no couple, and this screen serves all sixteen event types',
  );
  assert.ok(/hasn&rsquo;t been shared with you/.test(s), 'it must still say what happened');
});
