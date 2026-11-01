/**
 * 🪑 A SEAT SAYS WHO PLACED IT (owner 2026-10-29, DECISION_LOG "GUESTS ANSWERS (owner ~14:40)" answer 4 — *"ok"* to
 * "add who placed each seat (auto / arrange vs the couple)"; prototype `whyHere` / `markYou`).
 *
 * The PROPERTIES:
 *   1. ONE column pair holds it (`event_seat_assignments.placed_by` 'couple'|'auto'|NULL + `placed_at`), CHECKed, added
 *      idempotently by a pipeline migration — no second home (Rule 0: `locked` means pinned, not who placed).
 *   2. Every HAND placement stamps 'couple' — assignGuest · assignGroup · seatRoleAtTable · createTable with its guests ·
 *      both swaps (RPC, then a stamp — cleared, never stale, if the stamp fails) · the guest card's Table pick · the
 *      group's "seat at table". Every SOLVER placement stamps 'auto' — autoSeatGuests · Fill around locked ·
 *      autoArrange · buildSeatingDraft · the live reconcile.
 *   3. The words: "You placed Ana here · yesterday" · "Auto arrange placed Ana here · today"; NULL / unknown → nothing.
 *   4. Read where a seat is shown: the seat plan's guests (`fetchAssignments` → `SeatingGuest.seat_placed_by`) → the
 *      Seats › List face says it ("Ana Reyes, Table 3, seat 4, placed by you"); the guest card's Seat Plan fold says it.
 *
 * SABOTAGE (each seen RED, then restored): `...placedByAuto()` dropped from autoArrange · `placedByCouple` on a solver
 * insert · the CHECK removed · a NULL stamp read as 'auto'.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { placedByAuto, placedByCouple, placedWhenWords, seatPlacedBy, seatPlacedShort, seatWhyWords } from '@/lib/seat-why';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(WEB, '..', '..');
const src = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const NOW = new Date('2026-10-30T12:00:00Z');

test('1 · one column pair, CHECKed, from one idempotent migration', () => {
  const dir = join(REPO, 'supabase', 'migrations');
  const files = readdirSync(dir).filter((f) => /placed_by/.test(readFileSync(join(dir, f), 'utf8')) && /event_seat_assignments/.test(readFileSync(join(dir, f), 'utf8')));
  assert.deepEqual(files, ['20271297291493_seat_assignment_placed_by.sql'], 'who placed a seat has a second home');
  const sql = readFileSync(join(dir, files[0]!), 'utf8');
  assert.match(sql, /ADD COLUMN IF NOT EXISTS placed_by TEXT/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS placed_at TIMESTAMPTZ/);
  assert.match(sql, /CHECK \(placed_by IS NULL OR placed_by IN \('couple', 'auto'\)\)/);
});

/** The body of one exported server action in seating/actions.ts. */
function action(file: string, name: string): string {
  const s = src(file);
  const at = s.indexOf(`export async function ${name}(`);
  assert.ok(at >= 0, `${name} is gone`);
  const next = s.indexOf('\nexport async function ', at + 10);
  return s.slice(at, next < 0 ? undefined : next);
}

test('2 · every hand placement stamps couple, every solver run stamps auto', () => {
  const SEAT = 'app/dashboard/[eventId]/seating/actions.ts';
  for (const name of ['createTable', 'assignGuest', 'assignGroup', 'seatRoleAtTable']) {
    const body = action(SEAT, name);
    assert.match(body, /\.\.\.placedByCouple\(\)/, `${name} places by hand without saying so`);
    assert.doesNotMatch(body, /placedByAuto/, `${name} is said to be Auto arrange`);
  }
  for (const name of ['swapSeats', 'swapTableOccupants']) assert.match(action(SEAT, name), /await stampPlacedByCouple\(supabase, eventId,/, `${name} leaves the old placer`);
  for (const name of ['autoSeatGuests', 'lockAndFill', 'autoArrange', 'buildSeatingDraft']) {
    const body = action(SEAT, name);
    assert.match(body, /\.\.\.placedByAuto\(\)/, `${name} seats without saying it was Auto arrange`);
    assert.doesNotMatch(body, /placedByCouple/, `${name} is said to be the couple`);
  }
  const stamp = src(SEAT).slice(src(SEAT).indexOf('async function stampPlacedByCouple'));
  assert.match(stamp.slice(0, 900), /await write\(\{ placed_by: null, placed_at: null \}\)/, 'a failed stamp leaves a stale placer');
  assert.match(src('lib/seating-reconcile.ts'), /\.\.\.placedByAuto\(\)/, 'the live auto-seat does not say it was automatic');
  assert.match(src('app/dashboard/[eventId]/guests/[guestId]/actions.ts'), /seat_number: null, \.\.\.placedByCouple\(\) \}/, 'the card’s Table pick');
  assert.match(src('app/dashboard/[eventId]/guests/groups-actions.ts'), /seat_number: null, \.\.\.placedByCouple\(\) \}/, 'a group seated at a table');
});

test('3 · the words — and nothing when nobody recorded it', () => {
  assert.equal(placedByCouple(NOW).placed_by, 'couple');
  assert.equal(placedByAuto(NOW).placed_at, NOW.toISOString());
  assert.equal(seatWhyWords({ placed_by: 'couple', placed_at: '2026-10-29T08:00:00Z' }, 'Ana', NOW), 'You placed Ana here · yesterday');
  assert.equal(seatWhyWords({ placed_by: 'auto', placed_at: '2026-10-30T09:00:00Z' }, 'Ana', NOW), 'Auto arrange placed Ana here · today');
  assert.equal(seatWhyWords({ placed_by: 'couple', placed_at: null }, undefined, NOW), 'You placed them here');
  assert.equal(seatWhyWords({ placed_by: null }, 'Ana', NOW), null);
  assert.equal(seatWhyWords({ placed_by: 'robot' }, 'Ana', NOW), null);
  assert.equal(seatPlacedBy('auto'), 'auto');
  assert.equal(seatPlacedBy(undefined), null);
  assert.equal(seatPlacedShort('couple'), 'placed by you');
  assert.equal(seatPlacedShort(null), null);
  assert.equal(placedWhenWords('2026-10-26T12:00:00Z', NOW), '4 days ago');
  assert.equal(placedWhenWords('2026-10-01T12:00:00Z', NOW), 'October 1');
  assert.equal(placedWhenWords('nope', NOW), null);
});

test('4 · read where a seat is shown: Seats › List faces and the guest card', () => {
  assert.match(src('lib/seating.ts'), /\.select\('assignment_id,table_id,guest_id,seat_number,locked,placed_by,placed_at'\)/);
  assert.match(src('app/dashboard/[eventId]/seating/page.tsx'), /seat_placed_by: seatPlacedBy\(seat\?\.placed_by\),/);
  assert.match(src('app/dashboard/[eventId]/seating/_components/seating-editor.tsx'), /placed: seatPlacedShort\(g\.seat_placed_by\)/);
  const faces = src('app/dashboard/[eventId]/seating/_components/seat-faces-list.tsx');
  assert.match(faces, /aria-label=\{`\$\{g\.name\}, \$\{where\}\$\{g\.placed \? `, \$\{g\.placed\}` : ''\}`\}/);
  const data = src('app/dashboard/[eventId]/guests/_components/guest-card-data.ts');
  assert.match(data, /\.select\('table_id, placed_by, placed_at, event_tables\(table_label\)'\)/);
  const body = src('app/dashboard/[eventId]/guests/_components/guest-card-body.tsx');
  assert.match(body, /\{seatTableId && data\.seatPlaced \? \(\s*<p className="text-xs text-ink\/60" data-guest-seat-placed-by=\{data\.seatPlaced\.by\}>\s*\{seatWhyWords\(/);
});
