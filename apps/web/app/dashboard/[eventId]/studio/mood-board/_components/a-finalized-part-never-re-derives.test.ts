/**
 * a-finalized-part-never-re-derives.test.ts — MB12's derivation-stop, end to
 * end on the couple's own screen.
 *
 * The database half of this is
 * `tests/db/a-finalized-part-and-its-freeze-are-one-transaction.db.test.ts`: it
 * proves the agreement and the freeze land together, and that the freeze is put
 * back on every write to `events.role_palette` from any path. This file is the
 * other half — the board the couple is LOOKING AT.
 *
 * ── WHY BOTH HALVES ARE NEEDED, AND WHY NEITHER IS ENOUGH ─────────────────
 * A correct database and a correct component can each pass their own suite
 * while the line between them is cut. Three seams live in TypeScript:
 *
 *   1. `page.tsx` reads the finalization rows and never hands them to the
 *      provider. The board looks identical; nothing is frozen in the UI, the
 *      couple presses "Match my main colours again" on a role a supplier
 *      agreed to, and the change appears to work — until the next load, when
 *      the database's backstop has silently put it back. The app looks like it
 *      lost their edit.
 *   2. The provider builds its touched set from `palette.touched_roles` alone
 *      and never merges the rows, so `frozenKeys` is empty and every control
 *      stays live.
 *   3. `applyRelease` / `applyResetRoomDressing` are called without the frozen
 *      set, so they refuse nothing.
 *
 * Each of the three renders as SUCCESS. That is why the assertions below are
 * both behavioural (the reducers and the engine) and structural (the wire is
 * really connected) — a reducer that refuses correctly is worth nothing if
 * nobody passes it the set.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyRelease, applyResetRoomDressing } from '@/lib/mood-board-board-ops';
import { displayColorsFor, derivedBoardFor } from '@/lib/mood-board-derive';
import { resolveRoomDressing, type RolePalette } from '@/lib/mood-board';
import { deriveBoard } from '@/lib/palette-styles';
import { frozenNow, type PartFinalizationRecord } from '@/lib/moodboard-finalization';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTEXT = readFileSync(join(HERE, 'palette-board-context.tsx'), 'utf8');
const PAGE = readFileSync(join(HERE, '..', 'page.tsx'), 'utf8');

const MAJORS = ['#8C3B2E', '#C9A227', '#2F4858', '#EDE6DA', '#6B8F71'];
const OTHER_MAJORS = ['#123456', '#654321', '#0A0A0A', '#FAFAFA', '#00FF88'];
const AGREED_BRIDE = ['#AA1122'];

/** The palette exactly as `vendor_agree_to_part` leaves it: the agreed colours
 *  written in, and the key marked touched. */
const AFTER_AGREE: RolePalette = {
  reception: MAJORS,
  bride: AGREED_BRIDE,
  touched_roles: ['bride'],
  room_dressing: { linens: '#C0FFEE' },
};

const AGREED_ROW: PartFinalizationRecord = {
  finalization_id: 'f1',
  part_id: 'people:bride',
  vendor_id: 'v1',
  state: 'agreed',
  expires_at: null,
  agreed_at: '2026-09-04T00:00:00Z',
  declined_at: null,
  decline_reason: null,
  reopen_state: null,
  reopen_expires_at: null,
  reopen_decline_reason: null,
  frozen_palette_keys: ['bride'],
  frozen_dressing_fields: ['linens'],
};

/* ── 1 · THE ACTUAL RE-DERIVE, FORCED ────────────────────────────────────── */

test('changing every major re-derives every role EXCEPT the one a supplier agreed to', () => {
  // 🔑 THE SABOTAGE THIS TEST IS SHAPED AROUND: force the re-derivation. Not
  // "check a flag" — swap all five majors, which is the single act that moves
  // the whole board, and read what section 02 would draw afterwards.
  const touched = new Set(AFTER_AGREE.touched_roles ?? []);
  const before = derivedBoardFor(MAJORS, 'depth');
  const after = derivedBoardFor(OTHER_MAJORS, 'depth');

  assert.deepEqual(
    displayColorsFor('bride', { ...AFTER_AGREE, reception: OTHER_MAJORS }, touched, after),
    AGREED_BRIDE,
    'the agreed role must show the AGREED colours after the majors move',
  );

  // Vacuity: an UNTOUCHED role really does move, so the assertion above is
  // measuring a stop and not a board that never derives at all.
  const guestBefore = displayColorsFor('guest', AFTER_AGREE, touched, before);
  const guestAfter = displayColorsFor(
    'guest',
    { ...AFTER_AGREE, reception: OTHER_MAJORS },
    touched,
    after,
  );
  assert.notDeepEqual(
    guestBefore,
    guestAfter,
    'if nothing moves, this file proves nothing — the engine must really re-derive',
  );
});

test('the engine itself never writes a frozen key, at any palette style', () => {
  for (const style of ['simple', 'depth', 'complex'] as const) {
    const board = deriveBoard(OTHER_MAJORS, style, new Set(['bride', 'room_dressing']));
    assert.equal(board.bride, undefined, `${style}: deriveBoard wrote over a frozen role`);
    assert.equal(board.room_dressing, undefined, `${style}: deriveBoard wrote over frozen dressing`);
  }
});

test('a frozen room-dressing override survives a change of majors', () => {
  const moved: RolePalette = { ...AFTER_AGREE, reception: OTHER_MAJORS };
  assert.equal(
    resolveRoomDressing(moved).linens,
    '#C0FFEE',
    'an explicit override outranks the derived value — that IS the room freeze',
  );
  // Vacuity again: a field with no override really does follow the majors.
  assert.equal(resolveRoomDressing(moved).chairs, OTHER_MAJORS[2]);
});

/* ── 2 · THE COUPLE CANNOT UNDO IT ALONE ─────────────────────────────────── */

test('"Match my main colours again" refuses on a role a supplier agreed to', () => {
  const frozen = frozenNow([AGREED_ROW]);
  const after = applyRelease(AFTER_AGREE, 'bride', frozen.paletteKeys);
  assert.deepEqual(
    after.touched_roles,
    ['bride'],
    'releasing here would un-freeze a design somebody is already building against',
  );
  assert.equal(after, AFTER_AGREE, 'a refusal must be a no-op, not a rebuilt object');
});

test('resetting a frozen room-dressing field refuses too', () => {
  const frozen = frozenNow([AGREED_ROW]);
  const after = applyResetRoomDressing(AFTER_AGREE, 'linens', frozen.dressingFields);
  assert.equal(after.room_dressing?.linens, '#C0FFEE');
});

test('and an UNfrozen role still releases normally — the guard is not a wall', () => {
  const p: RolePalette = { ...AFTER_AGREE, touched_roles: ['bride', 'guest'] };
  const frozen = frozenNow([AGREED_ROW]);
  assert.deepEqual(applyRelease(p, 'guest', frozen.paletteKeys).touched_roles, ['bride']);
  assert.equal(
    applyResetRoomDressing({ ...p, room_dressing: { linens: '#1', chairs: '#2' } }, 'chairs', frozen.dressingFields)
      .room_dressing?.chairs,
    undefined,
  );
});

test('a PENDING ask freezes nothing — asking is not agreeing', () => {
  const frozen = frozenNow([{ ...AGREED_ROW, state: 'pending' }]);
  assert.equal(frozen.paletteKeys.size, 0);
  assert.deepEqual(applyRelease(AFTER_AGREE, 'bride', frozen.paletteKeys).touched_roles, []);
});

/* ── 3 · THE WIRE IS REALLY CONNECTED ────────────────────────────────────── */

test('page.tsx hands the finalization rows to the provider', () => {
  // Seam 1. Without this line every assertion above is about a set that is
  // always empty in production.
  assert.match(
    PAGE,
    /<PaletteBoardProvider[\s\S]{0,400}?finalizations=\{finalizationRecords\}/,
    'the provider is not given the rows — nothing is frozen on the couple’s screen',
  );
  assert.ok(
    PAGE.includes("from('moodboard_part_finalizations')"),
    'the rows are never read at all',
  );
});

test('the provider derives its frozen set from the ROWS, not from the palette alone', () => {
  // Seam 2.
  assert.match(
    CONTEXT,
    /const frozen = useMemo\(\(\) => frozenNow\(finalizations\)/,
    'the frozen set is not computed from the finalization rows',
  );
});

test('both release reducers are CALLED with the frozen set, not merely capable of taking one', () => {
  // Seam 3. `applyRelease` defaults its third argument to an empty Set so every
  // existing caller keeps compiling — which is exactly why "it refuses when
  // told" is not the same claim as "it is told". Pin the call sites.
  assert.match(
    CONTEXT,
    /releaseRole:\s*\(key\)\s*=>\s*mutate\(\(p\)\s*=>\s*applyRelease\(p,\s*key,\s*frozen\.paletteKeys\)\)/,
    'releaseRole calls applyRelease without the frozen set',
  );
  assert.match(
    CONTEXT,
    /applyResetRoomDressing\(p,\s*field,\s*frozen\.dressingFields\)/,
    'resetRoomDressing calls applyResetRoomDressing without the frozen fields',
  );
  // And the old inline delete must be gone: it bypassed the reducer entirely.
  assert.ok(
    !CONTEXT.includes('delete next[field]'),
    'the inline room-dressing delete is back — it edits the palette without consulting the freeze',
  );
});
