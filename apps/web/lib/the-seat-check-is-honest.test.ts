/**
 * the-seat-check-is-honest.test.ts — ✦ SEAT PLAN S · THE SMART LAYER (owner 28 Nov 2026, DECISION_LOG;
 * `SEAT-PLAN-COMPLETE-2026-11-27.md` § 4.4; drawing `prototypes/seating_later_2026-11-27/` S).
 *
 *   1 · the ONE line: "N to look at" (drawn ⚠ … ›) only when N > 0; a FAILED dry run says "Couldn't check seats · Try
 *       again" — never a false "All good"; nothing read yet → nothing said;
 *   2 · the Sheet's "All good" lists only the checks a READ dry run found clean; "Fix all" only when a fix can seat;
 *   3 · a card's suggestion must fit its free chairs; the strip says "Seat N";
 *   4 · no engine (`dryRun` absent) → no strip, no line, no switch; a take / Fix seats the unit in ONE write
 *       (`seatGuestHere` with `along`) with ONE Undo; "Fix all" is one Undo for everyone;
 *   5 · no guest name goes to any outside AI — the smart layer's files make no network call of their own.
 *
 * SABOTAGE (each seen red, then restored): `seatCheckLine` returning "All good" for a failed run → 1 · the strip drawn
 * with no `dryRun` (`check={...}` unguarded) → 4.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { SEAT_CHECK_GOOD, seatCheckLine, seatChecksAllGood, suggestionFor, suggestionSeatWords, type DryRun } from './seat-check';

const WEB = join(__dirname, '..');
const read = (f: string) => readFileSync(join(WEB, f), 'utf8');
const ED = read('app/dashboard/[eventId]/seating/_components/seating-editor.tsx');
const LIST = read('app/dashboard/[eventId]/seating/_components/seat-list.tsx');
const UI = read('app/dashboard/[eventId]/seating/_components/seat-check.tsx');

const run: DryRun = {
  suggestions: [
    { tableId: 't1', guestIds: ['a', 'b', 'c'], reason: 'Santos family · 2 parties · groom’s side' },
    { tableId: 't1', guestIds: ['d'], reason: 'Barkada' },
  ],
  problems: [
    { kind: 'plus_one_apart', guestIds: ['e'], tableId: 't2', reason: 'Ben sits apart from Ana', fix: { kind: 'seat', tableId: 't3', guestIds: ['e'] } },
    { kind: 'table_over', guestIds: [], tableId: 't4', reason: 'Table 4 has 11 for 10 chairs', fix: { kind: 'review', tableId: 't4' } },
  ],
};

test('1 · the line: "N to look at" only when N > 0; a failed run is said, never "All good"', () => {
  assert.deepEqual(seatCheckLine({ status: 'read', run }), { words: '2 to look at', failed: false });
  assert.equal(seatCheckLine({ status: 'read', run: { suggestions: [], problems: [] } }), null, 'a clean run says something on the line');
  assert.deepEqual(seatCheckLine({ status: 'failed' }), { words: 'Couldn’t check seats · Try again', failed: true });
  assert.equal(seatCheckLine({ status: 'idle' }), null, 'nothing read yet, and the line spoke');
  assert.match(UI, /<AlertTriangle[^>]*\/>\s*<span className="min-w-0 flex-1">\{line\.words\}<\/span>\s*<ChevronRight/, 'the line is not "⚠ N to look at ›"');
  assert.match(UI, /label="Try again" onClick=\{onRetry\}/, 'a failed check has no Try again');
});

test('2 · "All good" only from a READ run; "Fix all" only when something can be seated', () => {
  assert.deepEqual(seatChecksAllGood(run), ['household_split', 'elder_near_speaker', 'new_rsvp_alone']);
  assert.equal(SEAT_CHECK_GOOD.table_over, 'No table is over its seats');
  assert.match(ED, /\{checkRunData \? \(\s*<SeatCheckSheet/, 'the Sheet opens without a read run');
  assert.match(UI, /\{fixable > 0 \? \(\s*<ActionButton tone="brand" main icon=\{Wand2\} label="Fix all"/, 'Fix all is drawn with nothing to fix');
  assert.match(UI, /label=\{p\.fix\.kind === 'seat' \? 'Fix' : 'Review'\}/, 'a problem has more than one press, or none');
});

test('3 · a suggestion must fit the card’s free chairs; the strip says the seats', () => {
  assert.equal(suggestionFor(run, 't1', 2)?.guestIds.join(), 'd', 'a party bigger than the free chairs was suggested');
  assert.equal(suggestionFor(run, 't1', 3)?.guestIds.join(), 'a,b,c');
  assert.equal(suggestionFor(null, 't1', 9), null);
  assert.equal(suggestionSeatWords([6]), 'Seat 7');
  assert.equal(suggestionSeatWords([6, 7]), 'Seats 7 and 8');
  assert.equal(suggestionSeatWords([2, 4, 8]), 'Seats 3, 5 and 9');
});

test('4 · no engine → nothing drawn; a take or a Fix is ONE write and ONE Undo', () => {
  assert.match(ED, /check=\{dryRun \? \{ state: seatCheck, onOpen: \(\) => setCheckOpen\(true\), onRetry: runSeatCheck \} : null\}/, 'the line is drawn with no engine');
  assert.match(ED, /if \(!suggestOn \|\| !checkRunData\) return null;/, 'a strip is drawn with no read run');
  assert.match(ED, /\{dryRun \? \(\s*<MenuRow\s+icon=\{Sparkles\}\s+label="Suggest seats on the cards"/, 'the switch is drawn with no engine');
  assert.match(ED, /\.catch\(\(\) => \{\s*if \(n === checkRun\.current\) setSeatCheck\(\{ status: 'failed' \}\);/, 'a failed dry run is not said');
  const together = ED.slice(ED.indexOf('const seatTogether = '), ED.indexOf('const shortOf = '));
  assert.match(together, /seatGuestHere\(t, first!, free\[0\], rest\.map/, 'a unit is seated in more than one write');
  assert.match(together, /setMoveNote\(\{ text: [\s\S]*?, undo: \(\) => \{ setMoveNote\(null\); putBack\(before\); \} \}\)/, 'a take has no Undo');
  const all = ED.slice(ED.indexOf('const fixAllProblems = '), ED.indexOf('const cardSuggestion = '));
  assert.match(all, /putBack\(before\)/, 'Fix all has no Undo');
  assert.equal((all.match(/setMoveNote\(\{/g) ?? []).length, 1, 'Fix all says more than one Undo line');
  // The strip sits under its card (the card is one press; the strip's press is its own) — never inside the card button.
  assert.match(LIST, /\{face\}\s*<CardSuggestion /);
  assert.match(ED, /setNotice\('Tap Edit first — only one person arranges at a time'\)/, 'a press without Edit does nothing and says nothing');
  assert.match(UI, /label="Seat" name=\{`Seat \$\{names\.join\(', '\)\}`\} onClick=\{onTake\}/, 'taking a suggestion is more than one press');
});

test('5 · no guest name goes to an outside AI — the smart layer makes no network call of its own', () => {
  for (const src of [UI, read('lib/seat-check.ts')]) assert.doesNotMatch(src, /\bfetch\(|anthropic|openai|XMLHttpRequest/i);
});
