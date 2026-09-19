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
 * ─── The rule now, owner 2026-09-19 ─────────────────────────────────────
 * *"shouldn't it let me pick which event first?"* — the rail said Events 2 and
 * the jump fired anyway, because it was decided from the ORGANISER-only set
 * while the board counts organiser AND invited cards. The jump now fires only
 * when the WHOLE board is exactly one card (own, upcoming). That decision is a
 * pure function (`landingJumpTarget`, lib/event-board.ts) and is EXECUTED below;
 * the source scan only pins that the launcher feeds it the board set.
 *
 * ─── Why a source scan (for the wiring) ──────────────────────────────────
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
import { landingJumpTarget } from '@/lib/event-board';
import type { EventWithRole } from '@/lib/events';

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

const TODAY = '2026-09-19';
const ev = (
  id: string,
  member_type: EventWithRole['member_type'],
  event_date: string | null,
  archived = false,
): EventWithRole =>
  ({ event_id: id, member_type, event_date, archived, event_end_date: null }) as unknown as EventWithRole;

// The jump in the launcher, as a pattern: a guarded redirect to `jumpTo`.
const JUMP = /if\s*\(([^)]*)\)\s*\{\s*redirect\(`\/dashboard\/\$\{jumpTo\}`\)/s;

test('exactly one upcoming card of your own still jumps straight in', () => {
  assert.equal(landingJumpTarget([ev('A', 'couple', '2026-12-12')], TODAY), 'A');
  // Undated ("Date to be set") is upcoming — mid-planning, not finished.
  assert.equal(landingJumpTarget([ev('A', 'couple', null)], TODAY), 'A');
  // Today is not finished.
  assert.equal(landingJumpTarget([ev('A', 'couple', TODAY)], TODAY), 'A');
  // A put-away (archived) second event is off the board and does not count.
  assert.equal(
    landingJumpTarget([ev('A', 'couple', '2026-12-12'), ev('B', 'couple', '2027-01-01', true)], TODAY),
    'A',
  );
  // A membership with no board stance (coordinator) is not a card either.
  assert.equal(
    landingJumpTarget([ev('A', 'couple', '2026-12-12'), ev('C', 'coordinator', '2027-01-01')], TODAY),
    'A',
  );
});

test('a board with two or more cards NEVER auto-jumps — the person picks (owner 2026-09-19)', () => {
  const cases: Array<[string, EventWithRole[]]> = [
    // The owner's own account: organises one wedding, invited (groom) on another.
    ['own upcoming + invited upcoming', [ev('A', 'couple', '2026-12-12'), ev('B', 'guest', '2027-02-14')]],
    ['own upcoming + invited finished', [ev('A', 'couple', '2026-12-12'), ev('B', 'guest', '2025-02-14')]],
    ['own upcoming + own finished', [ev('A', 'couple', '2026-12-12'), ev('B', 'couple', '2025-02-14')]],
    ['two own upcoming', [ev('A', 'couple', '2026-12-12'), ev('B', 'couple', '2027-01-01')]],
    ['own + two invited', [ev('A', 'couple', null), ev('B', 'guest', null), ev('C', 'guest', '2027-01-01')]],
  ];
  for (const [name, board] of cases) {
    assert.equal(
      landingJumpTarget(board, TODAY),
      null,
      `${name}: the board holds ${board.length} cards (the rail says "Events ${board.length}") ` +
        'and the launcher still jumped into one of them — the person was never allowed to pick.',
    );
  }
});

test('the auto-jump does not fire for an event that has already happened', () => {
  assert.equal(
    landingJumpTarget([ev('A', 'couple', '2025-02-14')], TODAY),
    null,
    'A FINISHED sole event still jumps — that seals the couple inside it forever and ' +
      "contradicts the owner's ruling that the board holds completed events too.",
  );
});

test('a sole INVITED card does not jump into a dashboard', () => {
  // An invited person's door is the public page, never /dashboard/<id> (which
  // admits member_type = couple only — a 404 for them).
  assert.equal(landingJumpTarget([ev('B', 'guest', '2026-12-12')], TODAY), null);
});

test('the launcher decides the jump from the BOARD set, through landingJumpTarget', () => {
  const src = launcher();
  const m = src.match(/const\s+jumpTo\s*=\s*landingJumpTarget\(\s*(\w+)\s*,/);
  assert.ok(m, 'The launcher no longer computes `jumpTo` with landingJumpTarget — re-read this test.');
  assert.equal(
    m[1],
    'boardEvents',
    `The jump is decided from \`${m[1]}\`, not \`boardEvents\`. Anything narrower than the ` +
      'board (e.g. the organiser-only `active`) is exactly the 2026-09-19 bug: "Events 2" ' +
      'on the rail, and a jump into one of them.',
  );
  const jumps = [...src.matchAll(new RegExp(JUMP.source, 'gs'))];
  assert.equal(jumps.length, 1, `expected exactly one guarded jump redirect, found ${jumps.length}`);
  // No other redirect into an event id may bypass the decision.
  const eventRedirects = src.match(/redirect\(`\/dashboard\/\$\{/g) ?? [];
  assert.equal(eventRedirects.length, 1, `found ${eventRedirects.length} redirects into an event id`);
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
  const m = src.match(JUMP);
  assert.ok(m);
  assert.match(
    m[1]!,
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
