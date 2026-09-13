import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RolePalette } from './mood-board';
import {
  applyAddMajorSlot,
  applyAddRoleColor,
  applyPasteInto,
  applyRelease,
  applyRemoveMajorSlot,
  applyRemoveRoleColor,
  applySetMajorColor,
  applySetRoleColor,
  applySwap,
  applyTouch,
} from './mood-board-board-ops';

test('applySetMajorColor writes reception and nothing else', () => {
  const p: RolePalette = { reception: ['#111111', '#222222'] };
  const next = applySetMajorColor(p, 1, '#abcdef');
  assert.deepEqual(next.reception, ['#111111', '#ABCDEF']);
  assert.equal(next.touched_roles, undefined, 'the majors are never marked touched');
});

test('applyAddMajorSlot respects PALETTE_LIMITS.reception.max (5)', () => {
  const full: RolePalette = { reception: ['#111111', '#222222', '#333333', '#444444', '#555555'] };
  const next = applyAddMajorSlot(full);
  assert.equal(next, full, 'already at max — identity, no mutation');
});

test('applyAddMajorSlot on a blank board falls through to the static default (nothing chosen yet to be progressive from)', () => {
  const next = applyAddMajorSlot({});
  assert.equal(next.reception?.length, 1);
  assert.match(next.reception![0]!, /^#[0-9A-F]{6}$/);
});

test('🔌 MB13 WIRING · once a major is chosen, applyAddMajorSlot advises via progressiveReceptionSuggestion, not the static modulo-cycle', () => {
  // The exact defect MB13 fixed in the old PaletteEditor: a static
  // suggestions[length % length] cycle repeats after a few adds. The real
  // recommender (lib/palette-recommender.ts) never repeats an already-chosen
  // colour BY NAME — this proves the wiring survived MB5's port to
  // mood-board-board-ops.ts, not just that the lib function exists.
  let p: RolePalette = applyAddMajorSlot({ reception: ['#7A1F2B'] });
  for (let i = 0; i < 3 && (p.reception?.length ?? 0) < 5; i++) {
    p = applyAddMajorSlot(p);
  }
  const names = new Set((p.reception ?? []).map((h) => h.toUpperCase()));
  assert.equal(names.size, p.reception!.length, 'every advised major is a distinct colour — no repeat from a modulo cycle');
});

test('applyRemoveMajorSlot splices without an unremovable floor (the couple can clear back to zero)', () => {
  const p: RolePalette = { reception: ['#111111', '#222222', '#333333'] };
  const next = applyRemoveMajorSlot(p, 0);
  assert.deepEqual(next.reception, ['#222222', '#333333']);
});

// ── touchedRoles ────────────────────────────────────────────────────────────

test('editing a role marks it touched, and a second edit does not duplicate the mark', () => {
  let p: RolePalette = { guest: ['#111111'] };
  p = applySetRoleColor(p, 'guest', 0, '#222222');
  assert.deepEqual(p.touched_roles, ['guest']);
  p = applySetRoleColor(p, 'guest', 0, '#333333');
  assert.deepEqual(p.touched_roles, ['guest'], 'touching an already-touched role does not duplicate it');
});

test('adding or removing a color also marks the role touched', () => {
  let p: RolePalette = { bridesmaids: ['#111111', '#222222', '#333333'] };
  p = applyAddRoleColor(p, 'bridesmaids');
  assert.deepEqual(p.touched_roles, ['bridesmaids']);
  p = { ...p, touched_roles: [] }; // reset for the remove case
  p = applyRemoveRoleColor(p, 'bridesmaids', 0);
  assert.deepEqual(p.touched_roles, ['bridesmaids']);
});

test('applyAddRoleColor respects the role\'s own PALETTE_LIMITS.max', () => {
  const full: RolePalette = { bride: ['#111111', '#222222', '#333333'] }; // bride max = 3
  const next = applyAddRoleColor(full, 'bride');
  assert.equal(next, full, 'already at max — identity, no mutation, and not (re-)touched by a no-op');
});

test('🚨 THE GUARD · touching a role is ABSOLUTE — a later major change or style switch never overwrites its stored colors', () => {
  // This is the contract `displayColorsFor` (mood-board-derive.ts) relies on:
  // once `touched_roles` includes a key, the reducer never writes that key's
  // colors again except through the role's own setter — proven here at the
  // reducer level, and through `deriveBoard` itself in
  // `palette-styles-touched-roles-are-never-written.test.ts` and
  // `mood-board-derive-slice-path-preserves-rank-order.test.ts`.
  let p: RolePalette = { reception: ['#7A1F2B'], guest: ['#00FF00'] };
  p = applyTouch(p, 'guest');
  const touchedColorsBefore = p.guest;
  // A major changes underneath — nothing in this reducer module re-derives
  // `guest`; only `PaletteBoardProvider`'s `derived`/`colorsFor` recompute,
  // and `displayColorsFor` reads `touched` first. Simulate the majors moving:
  p = applySetMajorColor(p, 0, '#000000');
  assert.deepEqual(p.guest, touchedColorsBefore, 'a touched role\'s stored colors never change on their own');
});

test('applyRelease removes a role from touched_roles and leaves its stored colors untouched', () => {
  let p: RolePalette = { guest: ['#00FF00'], touched_roles: ['guest'] };
  p = applyRelease(p, 'guest');
  assert.deepEqual(p.touched_roles, []);
  assert.deepEqual(p.guest, ['#00FF00'], 'releasing does not clear the stored colors — the derived preview takes over at render time');
});

test('applyPasteInto touches the target role', () => {
  const p: RolePalette = { guest: ['#111111'] };
  const next = applyPasteInto(p, 'guest', 0, '#7A1F2B');
  assert.deepEqual(next.guest, ['#7A1F2B']);
  assert.deepEqual(next.touched_roles, ['guest']);
});

test('applySwap trades two slots within the same role and touches it once', () => {
  const p: RolePalette = { bridesmaids: ['#111111', '#222222'] };
  const next = applySwap(p, { key: 'bridesmaids', index: 0 }, { key: 'bridesmaids', index: 1 });
  assert.deepEqual(next.bridesmaids, ['#222222', '#111111']);
  assert.deepEqual(next.touched_roles, ['bridesmaids']);
});

test('applySwap trades a slot across two different roles and touches both', () => {
  const p: RolePalette = { bride: ['#AAAAAA'], groom: ['#BBBBBB'] };
  const next = applySwap(p, { key: 'bride', index: 0 }, { key: 'groom', index: 0 });
  assert.deepEqual(next.bride, ['#BBBBBB']);
  assert.deepEqual(next.groom, ['#AAAAAA']);
  assert.deepEqual([...(next.touched_roles ?? [])].sort(), ['bride', 'groom']);
});

test('applySwap is a no-op against an empty slot on either side', () => {
  const p: RolePalette = { bride: ['#AAAAAA'], groom: [] };
  const next = applySwap(p, { key: 'bride', index: 0 }, { key: 'groom', index: 0 });
  assert.equal(next, p);
});

// ── 🛑 THE ONE-DIRECTIONAL RULE — sabotage-tested ──────────────────────────

test('🛑 THE ONE-DIRECTIONAL RULE · every 02 mutator refuses to write "reception"', () => {
  const p: RolePalette = { reception: ['#111111'] };
  assert.equal(applySetRoleColor(p, 'reception', 0, '#ABCDEF'), p, 'setRoleColor must not touch reception');
  assert.equal(applyAddRoleColor(p, 'reception'), p, 'addRoleColor must not touch reception');
  assert.equal(applyRemoveRoleColor(p, 'reception', 0), p, 'removeRoleColor must not touch reception');
  assert.equal(applyPasteInto(p, 'reception', 0, '#ABCDEF'), p, 'pasteInto must not touch reception');
  const withGuest: RolePalette = { ...p, guest: ['#222222'] };
  assert.equal(
    applySwap(withGuest, { key: 'reception', index: 0 }, { key: 'guest', index: 0 }),
    withGuest,
    'swap must not touch reception as the source',
  );
  assert.equal(
    applySwap(withGuest, { key: 'guest', index: 0 }, { key: 'reception', index: 0 }),
    withGuest,
    'swap must not touch reception as the target',
  );
});

test('sabotage, performed and undone: removing the reception guard from applySetRoleColor lets 02 write the majors', () => {
  // Proves the guard test above actually catches the regression it exists
  // for, rather than passing vacuously. Reimplements the UNGUARDED function
  // inline (never edits the source file) and shows it fails the same
  // assertion the guarded version passes.
  const unguardedSetRoleColor = (p: RolePalette, key: keyof RolePalette, index: number, hex: string): RolePalette => {
    const arr = [...((p[key] as string[] | undefined) ?? [])];
    arr[index] = hex.toUpperCase();
    return { ...p, [key]: arr } as RolePalette;
  };
  const p: RolePalette = { reception: ['#111111'] };
  const sabotaged = unguardedSetRoleColor(p, 'reception', 0, '#ABCDEF');
  assert.notDeepEqual(sabotaged.reception, p.reception, 'the unguarded function DOES let 02 write 00 — this is the defect the real guard prevents');
  assert.deepEqual(applySetRoleColor(p, 'reception', 0, '#ABCDEF'), p, 'the real, guarded function refuses the same write');
});
