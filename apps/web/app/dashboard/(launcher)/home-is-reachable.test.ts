/**
 * home-is-reachable.test.ts — the home board is a place you can get to.
 *
 * ─── The bug this exists to prevent ──────────────────────────────────────
 * The launcher's landing rule read:
 *
 *     if (active.length === 1 && !hasConsole) redirect(`/dashboard/${id}`);
 *
 * `active` means "not archived" — so a wedding that ALREADY HAPPENED still
 * counted. Every single-event, non-console user was bounced out of the home
 * board into their event, and the account switcher's Home button pointed at
 * plain `/dashboard`, which re-fired the same redirect. The loop had no exit.
 *
 * The consequence was not cosmetic: **Alaala, People, Samahan and the Creator's
 * Lab did not exist** for the core persona — an engaged couple with one wedding —
 * nor for any couple after their wedding, forever. That is why the owner's
 * "how do i find my samahan" had no good answer: he could not reach the room it
 * lives in. The 2026-07-04 ruling was *"keep the auto-jump, hub reachable"*;
 * only the first half was ever built.
 *
 * ─── The rule now, owner 2026-08-11 ─────────────────────────────────────
 * *"home board is for the user's collection of events. On going and completed."*
 * A collection is a place you visit, and it must hold the wedding that already
 * happened. So:
 *   • the jump fires only while the sole event is still UPCOMING;
 *   • `?hub=1` always wins, and the switcher's Home carries it.
 *
 * ─── Why a source scan ───────────────────────────────────────────────────
 * The hazard is a `redirect()` that fires too often. There is no return value to
 * assert — `redirect()` throws — and the launcher is a server component with a
 * dozen live reads before it, so standing one up in a unit test would assert the
 * mocks, not the rule. The three things that can regress are all visible in the
 * source: the past-check, the bypass, and the link that uses the bypass.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAUNCHER = resolve(HERE, 'page.tsx');
const SWITCHER = resolve(
  HERE,
  '..',
  '..',
  '_components',
  'account-switcher',
  'account-switcher.tsx',
);

const launcher = () => stripComments(readFileSync(LAUNCHER, 'utf8'));

test('the auto-jump does not fire for an event that has already happened', () => {
  const src = launcher();
  // The redirect must be guarded by the past-check. Matching the guard rather
  // than a line number: any spelling that consults isPast before jumping passes.
  const jump = /if\s*\([^)]*\)\s*\{\s*redirect\(`\/dashboard\/\$\{active\[0\]!\.event_id\}`\)/s;
  const m = src.match(jump);
  assert.ok(m, 'The single-event auto-jump is gone or unrecognisable — re-read this test.');
  assert.match(
    m[0],
    /isPast|soleUpcoming/,
    'The auto-jump no longer consults isPast. `active` only means "not archived", so a ' +
      'FINISHED wedding still matches — which seals the couple inside it forever and ' +
      'contradicts the owner\'s ruling that the board holds completed events too.',
  );
});

test('an explicit hub request always beats the auto-jump', () => {
  const src = launcher();
  assert.match(
    src,
    /sp\.hub\s*===\s*['"]1['"]/,
    'The ?hub=1 bypass is gone from the launcher. Without it the switcher\'s Home button ' +
      'lands back on a page that immediately redirects away — the hub becomes unreachable ' +
      'again for every single-event user.',
  );
  const m = src.match(/if\s*\([^)]*\)\s*\{\s*redirect\(`\/dashboard\/\$\{active\[0\]!\.event_id\}`\)/s);
  assert.ok(m);
  assert.match(
    m[0],
    /wantsHub/,
    'The auto-jump ignores the hub request. The bypass exists but the redirect does not ' +
      'honour it, which is the same trap with an extra parameter.',
  );
});

test('the switcher\'s Home carries the bypass', () => {
  // 🔑 This is the half that is easiest to lose: someone "tidies" the query
  // string off the href and the launcher's guard still looks correct in review.
  assert.match(
    stripComments(readFileSync(SWITCHER, 'utf8')),
    /href=["']\/dashboard\?hub=1["']/,
    'The account switcher\'s Home link dropped ?hub=1. It then points at a page that ' +
      'redirects the user straight back to where they came from — the exact loop that ' +
      'made the home board unreachable.',
  );
});

test('the create-event redirect for empty console accounts is untouched', () => {
  // Guard against over-correction: the OTHER landing branch was never the bug,
  // and quietly removing it would strand a vendor with no events on a blank board.
  assert.match(
    launcher(),
    /active\.length\s*===\s*0\s*&&\s*hasConsole[\s\S]{0,80}redirect\(['"]\/dashboard\/create-event['"]\)/,
    'The 0-event console redirect was removed. That branch was correct — only the ' +
      'single-event one was over-firing.',
  );
});
