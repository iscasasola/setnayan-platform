/**
 * the-console-claims-only-what-it-does.test.ts — the day-of console may not
 * tell a supplier that something reaches the couple when it never leaves their
 * phone.
 *
 * ── The defect, in one sentence ────────────────────────────────────────────
 * Both headings above the shot list read "Shot list · syncs to the couple".
 * `shot-list.tsx` says of itself, in its own docblock, "Nothing here touches
 * the server" — it is `localStorage`, namespaced by eventId, and its only
 * persistence calls are `window.localStorage.getItem` / `.setItem`. So the list
 * does not reach the couple, and does not even follow the shooter to a second
 * device. A photographer reading that heading on a wedding morning has no
 * reason to send the couple anything, because the screen has told them it is
 * already done.
 *
 * 🔑 THE CLAIM AND THE MECHANISM WERE WRITTEN BY THE SAME COMMIT AND
 * CONTRADICTED EACH OTHER FROM THE START. Nothing failed; the sentence was
 * simply untrue, and a sentence cannot fail a test that does not exist.
 *
 * ── What this pins ────────────────────────────────────────────────────────
 * Two properties, and the second is the load-bearing one:
 *
 *   1. no heading in the console claims the shot list syncs/sends/shares to
 *      the couple;
 *   2. IF `shot-list.tsx` ever genuinely gains a server writer, this test
 *      fails — so the claim can come back, but only WITH the mechanism, and
 *      whoever builds it is told to update this file rather than discovering
 *      the heading is now allowed.
 *
 * Property 2 is why this is not just a string ban. A guard that only forbade
 * the words would still be green on the day somebody shipped the sync and left
 * the honest heading in place, and would quietly forbid a true statement.
 *
 * 🛡 Mutation-checked: the heading was restored on ONE of the two sites and the
 * count printed before and after, to prove the sabotage landed; the test went
 * RED naming that site. The `shot-list.tsx` rule was broken by adding a fake
 * `await fetch('/api/x')` and confirmed RED before being trusted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONSOLE_PAGE = join(HERE, 'page.tsx');
const SHOT_LIST = join(HERE, '_components', 'shot-list.tsx');

/**
 * Comments are stripped so a docblock EXPLAINING the ban does not trip it.
 *
 * ⚠ ONE COMMENT STRIPPER — `@/lib/strip-comments`, never a local regex. This
 * file shipped its own two-line regex version first and a blocking guard caught
 * it, correctly: `/*` inside a STRING (`accept="image/*"`, `video/*`) opens a
 * comment that never existed and blanks real code to the next `*​/`. That
 * version hid 5,104 lines across 1,031 files when it last shipped here.
 */
function code(path: string): string {
  return stripComments(readFileSync(path, 'utf8'));
}

/**
 * Verbs that assert the list leaves the device. Deliberately narrow: the
 * console legitimately says the shot list sits "against the couple's live
 * timeline", which is true — the timeline is read, the list is not sent.
 */
const REACHES_THE_COUPLE = /\b(syncs?|sends?|shares?|delivers?)\s+to\s+the\s+couple\b/i;

test('no console heading claims the shot list reaches the couple', () => {
  const src = code(CONSOLE_PAGE);
  const shotListArea = src
    .split('\n')
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => /shot\s*list/i.test(line) && REACHES_THE_COUPLE.test(line));

  assert.deepEqual(
    shotListArea.map(({ n, line }) => `${n}: ${line.trim()}`),
    [],
    'the shot list is localStorage-only — a heading saying it reaches the couple is a claim the code does not keep',
  );
});

test('the shot list still has no server writer — if it gains one, revisit the heading', () => {
  const src = code(SHOT_LIST);
  const writers = [
    /\bfetch\s*\(/,
    /\bsupabase\b/i,
    /use server/,
    /\.(insert|upsert|update)\s*\(/,
  ].filter((re) => re.test(src));

  assert.deepEqual(
    writers.map(String),
    [],
    'shot-list.tsx now reaches the server. That is a FEATURE, not a failure: build the couple-facing half, ' +
      'then update this test and the console heading together — never the heading alone.',
  );

  // And the positive half: it is still the device-local thing the heading now describes.
  assert.match(src, /window\.localStorage\.setItem/, 'the shot list should still persist to localStorage');
});
