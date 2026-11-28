/**
 * every-seat-write-asks-the-lock.test.ts — 🔒 NO HAND MOVES A LOCKED SEAT, ON ANY PATH (seat plan #17, controller
 * post-merge review of #8460: "every write path must refuse locked guests on the server").
 *
 * Every function in app/ and lib/ that writes a seat row (`event_seat_assignments` upsert · insert · delete · update, the
 * swap RPCs, or a DELETE of `event_tables` — its seats go with it, ON DELETE CASCADE) is listed here, ONE of two ways:
 *   · ASKS — it reads the lock first (`lockedSeatGuests` / `tablesHoldLockedSeats`, lib/seat-lock.server.ts, or the
 *     `locked` column of the rows it is about to move) and refuses;
 *   · ALLOW — it is not a hand move of a seated guest, with the reason (an auto pass that keeps locked seats, a guest
 *     leaving the event, an Undo putting a seat back, the lock itself).
 * A NEW seat writer fails this test until it is put in one list — so no path can skip the check by being new.
 *
 * SABOTAGE (each seen red, then restored): `lockedSeatGuests` removed from `createTable` → 1 · `tablesHoldLockedSeats`
 * removed from `deleteTable` (the cascade) → 1 · a new exported action
 * that upserts a seat row added to seating/actions.ts → 1 (unlisted) · `refuseLocked(...party` removed from `doMove` → 2.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { test } from 'node:test';

const WEB = join(__dirname, '..');
const SEATING = 'app/dashboard/[eventId]/seating/actions.ts';
const CARD = 'app/dashboard/[eventId]/guests/[guestId]/actions.ts';
const GROUPS = 'app/dashboard/[eventId]/guests/groups-actions.ts';

/** file › function → how it asks the lock (a pattern its body must hold). */
const ASKS: Record<string, RegExp> = {
  [`${SEATING} › createTable`]: /lockedSeatGuests\(supabase, eventId, seatAsked\)/,
  [`${SEATING} › assignGuest`]: /lockedSeatGuests\(supabase, eventId, \[guestId, \.\.\.along/,
  [`${SEATING} › swapSeats`]: /lockedSeatGuests\(supabase, eventId, everyone\)/,
  [`${SEATING} › unassignGuest`]: /lockedSeatGuests\(supabase, eventId, everyone\)/,
  [`${SEATING} › swapTableOccupants`]: /tablesHoldLockedSeats\(supabase, eventId, \[tableA, tableB\]\)/,
  [`${SEATING} › assignGroup`]: /lockedSeatGuests\(supabase, eventId, guestIds/,
  [`${SEATING} › updateTableType`]: /\.some\(\(a\) => a\.locked\)/,
  [`${SEATING} › deleteTable`]: /tablesHoldLockedSeats\(supabase, eventId, \[tableId\]\)/,
  [`${SEATING} › undoAutoArrange`]: /lockedSeatGuests\(supabase, eventId, seatedGuestIds\)[\s\S]*tablesWithLockedSeats\(supabase, eventId, addedTableIds\)/,
  [`${CARD} › syncCardTable`]: /lockedSeatGuests\(supabase, eventId, \[guestId\]\)/,
  [`${GROUPS} › setTableForGuests`]: /lockedSeatGuests\(supabase, eventId, ids\)/,
};

/** file › function → why it is not a hand move of a seated guest. */
const ALLOW: Record<string, string> = {
  [`${SEATING} › stampPlacedByCouple`]: 'writes who placed a seat (placed_by / placed_at), never where it is',
  [`${SEATING} › toggleSeatLock`]: 'the lock itself',
  [`${SEATING} › autoSeatGuests`]: 'seats only guests with no seat — a locked guest is seated, so never moved',
  [`${SEATING} › seatRoleAtTable`]: 'seats only guests with no seat (`!seatedIds.has`) — a locked guest is never one',
  [`${SEATING} › lockAndFill`]: 'Fill around locked: clears only `locked = false` rows and re-seats around the locked ones',
  [`${SEATING} › autoArrange`]: 'Auto arrange: every UNLOCKED seat comes off (`.eq(\'locked\', false)`); a locked seat never moves',
  [`${SEATING} › clearAllSeats`]: 'Clear all asks first, and keeps locked seats unless the host picks "Clear locked too" (`keep_locked`)',
  [`${SEATING} › buildSeatingDraft`]: 'the first draft on an EMPTY floor — no seat exists yet, locked or not (the tables it may delete are its own, made in the same run)',
  [`${CARD} › syncInvitedChapters`]: 'the guest is no longer invited to the part with the seat plan — their seat is released, not moved',
  [`${CARD} › updateGuest`]: 'a guest marked "passed away" gives back their chair — the guest leaves the plan',
  [`${GROUPS} › bulkSoftDeleteGuestsForUndo`]: 'the guests are removed from the list (their seat kept for the Undo)',
  [`${GROUPS} › restoreDeletedGuests`]: 'the Undo of a removal — puts each seat back as it was, lock included',
  ['app/dashboard/[eventId]/guests/inline-actions.ts › restoreGuestRsvpAndSeat']: 'the Undo of a decline — puts the seat back as it was',
  ['app/dashboard/[eventId]/guests/claims/actions.ts › declineRequest']: 'a request to join is declined — no guest, no seat',
  ['app/dashboard/[eventId]/guests/claims/actions.ts › linkRequest']: 'a request is linked to its existing guest — the request row’s seat goes',
  ['lib/extra-seats-sync.ts › syncExtraSeats']: 'an extra seat is removed from the list — the seat row goes with it',
  ['lib/seating-reconcile.ts › reconcilePass']: 'the live auto-seat (the engine lane) — locked rows are its fixed context, not a hand move',
};

const WRITE = /from\('event_seat_assignments'\)\.(upsert|insert|delete|update)\(|rpc\('swap_(seat|seat_unit|table)_assignments'|from\('event_tables'\)\.delete\(/;
const squash = (s: string) => s.replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').replace(/\) \./g, ').');

/** Every top-level function in app/ and lib/ that writes a seat row: "file › name" → its body. */
function seatWriters(): Map<string, string> {
  const files = execSync(`grep -rl "event_seat_assignments\\|swap_seat_assignments\\|swap_table_assignments\\|from('event_tables')" app lib --include=*.ts --include=*.tsx`, {
    cwd: WEB,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((f) => f && !/\.test\.|\.lab\.|lib\/ugat\//.test(f));
  const out = new Map<string, string>();
  for (const f of files) {
    const s = readFileSync(join(WEB, f), 'utf8');
    const heads = [...s.matchAll(/^(?:export )?(?:async )?function (\w+)/gm)];
    heads.forEach((h, i) => {
      const body = s.slice(h.index, heads[i + 1]?.index ?? s.length);
      if (WRITE.test(squash(body))) out.set(`${f} › ${h[1]}`, body);
    });
  }
  return out;
}

test('1 · every seat writer asks the lock, or says why it is not a hand move', () => {
  const writers = seatWriters();
  assert.ok(writers.size >= 20, `only ${writers.size} seat writers found — the reader is not reading the app`);
  const unlisted = [...writers.keys()].filter((k) => !(k in ASKS) && !(k in ALLOW));
  assert.deepEqual(unlisted, [], 'a seat writer that neither asks the lock nor is allowed — add the check (lib/seat-lock.server.ts) or a reason');
  for (const [k, pattern] of Object.entries(ASKS)) {
    const body = writers.get(k);
    assert.ok(body, `${k} no longer writes a seat — move it out of ASKS`);
    assert.match(body!, pattern, `${k} writes a seat without asking the lock`);
    // The ask comes BEFORE the write.
    const ask = body!.search(pattern);
    const write = squash(body!).search(WRITE);
    assert.ok(ask >= 0 && squash(body!.slice(0, ask)).search(WRITE) < 0, `${k} writes before it asks the lock (write at ${write})`);
  }
  for (const k of Object.keys(ALLOW)) assert.ok(writers.has(k), `${k} no longer writes a seat — drop it from ALLOW`);
});

test('2 · the editor refuses before it writes, and says the server’s refusal', () => {
  const ed = readFileSync(join(WEB, 'app/dashboard/[eventId]/seating/_components/seating-editor.tsx'), 'utf8');
  const doMove = ed.slice(ed.indexOf('const doMove = '), ed.indexOf('const moveSheet ='));
  assert.match(doMove, /refuseLocked\(\.\.\.party\.map\(\(g\) => g\.guest_id\)\)/, 'the phone’s Move to… moves a locked guest');
  assert.match(doMove, /else saidLocked\(made\)/, '+ New table’s refusal is not said');
  assert.match(doMove, /if \(saidLocked\(res\)\) return;/, 'Move to… keeps going after a refusal (the +1 would move alone)');
  assert.doesNotMatch(doMove, /for \(let i = 0; i < party\.length/, 'Move to… writes the party one guest at a time again');
  assert.match(ed, /if \(saidLocked\(await swapTableOccupants\(fd\)\)\) return;/, 'a table swap’s refusal is not said');
  assert.match(ed, /if \(saidLocked\(res\)\) return; \/\/ 🔒 #17: the new shape/, 'a shape change’s refusal is not said');
  assert.match(ed, /if \(res\?\.locked\) \{/, 'a group seated past its locked members says nothing');
  const remove = ed.slice(ed.indexOf('const removeTables = '), ed.indexOf('const removeTable = '));
  assert.match(remove, /if \(refuseLocked\(\.\.\.guests\.filter/, 'a table holding a locked seat is deleted from the editor');
  assert.match(remove, /if \(saidLocked\(res\)\) return \{ ok: false \};/, 'the server’s refusal of a delete is not said');
});

test('3 · a unit trade is ONE transaction (nothing half-traded), and the plan re-reads', () => {
  const s = readFileSync(join(WEB, SEATING), 'utf8');
  const swap = s.slice(s.indexOf('export async function swapSeats('), s.indexOf('export async function swapTableOccupants('));
  // Seat plan L11: the whole trade (leads + every +1 pair) goes through swap_seat_unit_assignments, all or nothing
  // (held behaviourally by tests/db/a-unit-trade-is-one-transaction.db.test.ts) — no per-pair loop to roll back.
  assert.match(swap, /rpc\('swap_seat_unit_assignments', \{/, 'a trade with +1s is not one transaction');
  assert.doesNotMatch(swap, /for \(const \[a, b\] of \[\[guestA, guestB\]/, 'a per-pair swap loop can leave the leads swapped and the +1s not');
  const ed = readFileSync(join(WEB, 'app/dashboard/[eventId]/seating/_components/seating-editor.tsx'), 'utf8');
  const trade = ed.slice(ed.indexOf('const tradeSeats = '), ed.indexOf('const place = '));
  assert.match(trade, /if \(res === null\) router\.refresh\(\);/, 'a failed swap leaves the screen showing the move');
});
