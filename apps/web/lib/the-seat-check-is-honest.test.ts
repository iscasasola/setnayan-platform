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
 * with no `dryRun` (`check={...}` unguarded) → 4 · Fix all counting every planned guest again → 7 · `raw.slice(0, 8)`
 * back in `assignGuest` (or no packing on the client) → 8.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  SEAT_CHECK_GOOD,
  SEAT_WRITE_MAX,
  fixAllWords,
  packSeatWrites,
  seatCheckLine,
  seatChecksAllGood,
  settleSeatWrites,
  suggestionFor,
  suggestionSeatWords,
  type DryRun,
} from './seat-check';

const WEB = join(__dirname, '..');
const read = (f: string) => readFileSync(join(WEB, f), 'utf8');
const ED = read('app/dashboard/[eventId]/seating/_components/seating-editor.tsx');
const LIST = read('app/dashboard/[eventId]/seating/_components/seat-list.tsx');
const UI = read('app/dashboard/[eventId]/seating/_components/seat-check.tsx');
const ACT = read('app/dashboard/[eventId]/seating/actions.ts');

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
  // ONE write per table (`along`), and the Undo line only once every write has LANDED (`onSaved`).
  const groups = ED.slice(ED.indexOf('const seatGroups = '), ED.indexOf('const shortOf = '));
  assert.match(groups, /const writes = packSeatWrites\(plan\.byTable\);/, 'a table is written past the server cap');
  assert.match(groups, /seatGuestHere\(t, first!\.guestId, first!\.seat, rest, \(ok\) => \{/, 'a unit is seated in more than one write');
  // Locks for EVERY group before anything is written; ONE Undo for exactly what landed; a refused table's guests come back.
  assert.match(groups, /if \(refuseLocked\(\.\.\.ids\)\) return false;[\s\S]*seatGuestHere\(/, 'a lock is found only after other tables were written');
  assert.match(groups, /const \{ landed, missed, firstTableId \} = settleSeatWrites\(writes, answers\);/, 'the Undo covers writes that never landed');
  assert.match(groups, /const back = landed\.flatMap\(\(id\) => before\.get\(id\) \?\? \[\]\);/, 'the Undo covers writes that never landed');
  assert.match(groups, /if \(waiting > 0\) return;/, 'the line waits for a write that will never answer');
  assert.match(groups, /if \(missed\.length\) setJustTaken\(\(c\) => new Set\(\[\.\.\.c\]\.filter\(\(id\) => !missed\.includes\(id\)\)\)\);/, 'refused guests stay hidden');
  assert.match(groups, /undo: \(\) => \{ setMoveNote\(null\); putBack\(back\); \}/, 'no Undo for what landed');
  // Every way out of seatGuestHere answers onDone — a write refused before it is sent still counts down.
  assert.match(ED, /if \(!canEdit\) return onDone\?\.\(false\);\s*if \(refuseLocked\(guestId, \.\.\.along\.map\(\(x\) => x\.guestId\)\)\) return onDone\?\.\(false\);/);
  assert.match(ED, /onDone\?\.\(res !== null && !saidLocked\(res\)\);/, 'onDone says landed for a failed or refused write');
  // Fix all: every placement worked out against ONE pool of free chairs before anything is written (no double-booking).
  const place = ED.slice(ED.indexOf('const placeAll = '), ED.indexOf('const seatGroups = '));
  assert.match(place, /const free = pool\.get\(t\.table_id\) \?\? freeChairsAt\(t\);/, 'two fixes can take the same chair');
  assert.match(place, /pool\.set\(t\.table_id, free\.slice\(g\.guestIds\.length\)\);/);
  const all = ED.slice(ED.indexOf('const fixAllProblems = '), ED.indexOf('const cardSuggestion = '));
  assert.match(all, /seatGroups\(groups,/, 'Fix all writes fix by fix again');
  assert.doesNotMatch(all, /for \(const f of seats\) if \(seatTogether/, 'Fix all writes fix by fix again');
  // A take (and a Fix) moves each guest's whole unit — the drag's own rule.
  assert.match(ED, /const withUnits = \(ids: readonly string\[\]\) => \[\.\.\.new Set\(ids\.flatMap\(\(id\) => \{ const u = unitOf\(id\); return \[u\.leadId, \.\.\.u\.party\]; \}\)\)\];/);
  assert.match(ED.slice(ED.indexOf('const takeSuggestion = ')), /const ids = withUnits\(sug\.guestIds\);/, 'a take leaves the +1 behind');
  // Just taken → gone from every strip at once; the dry run is asked once the plan settles.
  assert.match(ED, /sug\.guestIds\.every\(\(id\) => !justTaken\.has\(id\) && !guestsById\.get\(id\)\?\.seated_table_id\)/, 'a just-taken suggestion stays on the card');
  assert.match(ED, /const t = setTimeout\(\(\) => \{\s*runSeatCheck\(\);[\s\S]{0,120}\}, SEARCH_WAIT_MS\);/, 'the dry run is asked on every change, not once things settle');
  // The strip sits under its card (the card is one press; the strip's press is its own) — never inside the card button.
  assert.match(LIST, /\{face\}\s*<CardSuggestion /);
  assert.match(ED, /setNotice\('Tap Edit first — only one person arranges at a time'\)/, 'a press without Edit does nothing and says nothing');
  assert.match(UI, /label="Seat" name=\{`Seat \$\{names\.join\(', '\)\}`\} onClick=\{onTake\}/, 'taking a suggestion is more than one press');
});

test('5 · no guest name goes to an outside AI — the smart layer makes no network call of its own', () => {
  for (const src of [UI, read('lib/seat-check.ts')]) assert.doesNotMatch(src, /\bfetch\(|anthropic|openai|XMLHttpRequest/i);
});

test('6 · the lab’s dry run is built on the client — no server action spent on it', () => {
  const lab = read('app/dev/guests-lab/lab-seats-march.tsx');
  assert.doesNotMatch(lab, /dryRun: check\s*\?\s*async/, 'the lab hands the editor a server function again');
  assert.match(read('app/dev/guests-lab/lab-dry-run.tsx'), /^'use client';/);
});

test('7 · a partial Fix all says what LANDED: 3 tables, 6 guests, table 2 fails → "4 guests", named for a table that landed', () => {
  const byTable = new Map([
    ['t1', [[{ guestId: 'a', seat: 0 }, { guestId: 'b', seat: 1 }]]],
    ['t2', [[{ guestId: 'c', seat: 0 }, { guestId: 'd', seat: 1 }]]],
    ['t3', [[{ guestId: 'e', seat: 0 }, { guestId: 'f', seat: 1 }]]],
  ]);
  const writes = packSeatWrites(byTable);
  assert.equal(writes.length, 3);
  const out = settleSeatWrites(writes, [true, false, true]);
  assert.deepEqual(out.landed, ['a', 'b', 'e', 'f']);
  assert.deepEqual(out.missed, ['c', 'd']);
  assert.equal(fixAllWords(out.landed.length), 'Fixed · 4 guests seated', 'the line counts a table that failed');
  assert.equal(fixAllWords(1), 'Fixed · 1 guest seated');
  // The first table failed → the line names the first table that LANDED, never the planned first.
  assert.equal(settleSeatWrites(writes, [false, true, true]).firstTableId, 't2');
  assert.deepEqual(settleSeatWrites(writes, [false, false, false]), { landed: [], missed: ['a', 'b', 'c', 'd', 'e', 'f'], firstTableId: null });
  // The editor builds the line from `landed`, never from the planned groups.
  const all = ED.slice(ED.indexOf('const fixAllProblems = '), ED.indexOf('const cardSuggestion = '));
  assert.match(all, /seatGroups\(groups, \(_label, got\) => fixAllWords\(got\.length, formatCount\)\)/, 'Fix all counts every planned guest');
  assert.doesNotMatch(all, /groups\.reduce\(/, 'Fix all counts every planned guest');
  const groups = ED.slice(ED.indexOf('const seatGroups = '), ED.indexOf('const shortOf = '));
  assert.match(groups, /const lt = tables\.find\(\(x\) => x\.table_id === firstTableId\);/, 'the line names a table that did not land');
  assert.match(groups, /words\(lt\?\.link_group_label\?\.trim\(\) \|\| lt\?\.table_label \|\| '', landed\)/, 'the line is not built from what landed');
  assert.doesNotMatch(groups, /firstTable = tables\.find\(\(x\) => x\.table_id === groups\[0\]/, 'the line names the planned first table');
  for (const fn of ['const takeSuggestion = ', 'const fixProblem = ']) {
    const body = ED.slice(ED.indexOf(fn), ED.indexOf(fn) + 900);
    assert.match(body, /\(label, got\) => `\$\{got\.map\(shortOf\)\.join\(', '\)\} → \$\{label\}`/, `${fn} names guests that did not land`);
  }
});

test('8 · no guest dropped past the cap: writes are packed to SEAT_WRITE_MAX and the server refuses, never truncates', () => {
  // 10 guests at one 10-seat table (two groups of 5) → two writes, every guest in one of them.
  const ten = Array.from({ length: 10 }, (_, i) => ({ guestId: `g${i}`, seat: i }));
  const w = packSeatWrites(new Map([['t1', [ten.slice(0, 5), ten.slice(5)]]]));
  assert.ok(w.every((x) => x.seats.length <= SEAT_WRITE_MAX), 'a write carries more than the server takes');
  assert.deepEqual(w.flatMap((x) => x.seats.map((s) => s.guestId)), ten.map((s) => s.guestId), 'a guest went missing in packing');
  assert.deepEqual(w.map((x) => x.seats.length), [5, 5], 'a group was split when it fits whole');
  // One group bigger than a write is cut into full writes; nothing lost.
  const big = packSeatWrites(new Map([['t1', [ten]], ['t2', [[{ guestId: 'z', seat: 0 }]]]]));
  assert.deepEqual(big.map((x) => [x.tableId, x.seats.length]), [['t1', 9], ['t1', 1], ['t2', 1]]);
  // Small groups share a write up to the cap.
  const smalls = packSeatWrites(new Map([['t1', [ten.slice(0, 4), ten.slice(4, 8), ten.slice(8)]]]));
  assert.deepEqual(smalls.map((x) => x.seats.length), [8, 2]);
  // The server: one guest + SEAT_WRITE_MAX - 1 along; more is REFUSED, never cut.
  assert.equal(SEAT_WRITE_MAX, 9);
  assert.doesNotMatch(ACT, /raw\.slice\(0, \d+\)/, 'assignGuest cuts the along list silently');
  assert.match(ACT, /if \(Array\.isArray\(raw\) && raw\.length > SEAT_WRITE_MAX - 1\) throw new Error\(/, 'assignGuest takes a list past the cap');
  // The Undo goes back in writes of at most SEAT_WRITE_MAX too.
  const back = ED.slice(ED.indexOf('const putBack = '), ED.indexOf('const undoMove = '));
  assert.match(back, /for \(let i = 0; i < all\.length; i \+= SEAT_WRITE_MAX\) \{\s*const \[first, \.\.\.rest\] = all\.slice\(i, i \+ SEAT_WRITE_MAX\);/, 'an Undo writes past the cap');
});
