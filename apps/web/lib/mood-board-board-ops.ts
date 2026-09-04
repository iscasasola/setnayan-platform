/**
 * Pure `RolePalette` reducers behind section 02's mutations — extracted from
 * `palette-board-context.tsx` so the ONE-DIRECTIONAL RULE and the
 * touched-roles semantics are unit-testable directly, with no React tree, no
 * jsdom (this repo runs `tsx --test` over plain functions — see
 * `port-controls.mjs`'s own docblock on why: no render harness exists here).
 *
 * 🛑 THE ONE-DIRECTIONAL RULE. `applySetRoleColor` / `applyAddRoleColor` /
 * `applyRemoveRoleColor` / `applyPasteInto` / `applySwap` all refuse to
 * touch `key === 'reception'` — the majors are written ONLY by
 * `applySetMajorColor` / `applyAddMajorSlot` / `applyRemoveMajorSlot`,
 * called from `<MajorsEditor>` (section 00) alone. See
 * `mood-board-board-ops-one-directional-rule.test.ts`.
 */

import { DEFAULT_PALETTE_SUGGESTIONS, DERIVABLE_PALETTE_KEYS, PALETTE_LIMITS, type PaletteKey, type RolePalette } from './mood-board';
import { progressiveReceptionSuggestion } from './palette-recommender';

function nextSuggestion(key: PaletteKey, currentLength: number): string {
  const suggestions = DEFAULT_PALETTE_SUGGESTIONS[key];
  return (suggestions[currentLength % suggestions.length] ?? '#C97B4B').toUpperCase();
}

/** Add a role key to `touched_roles` (idempotent). `reception` and
 *  `officiants` are never derivable, so touching them is a no-op — matches
 *  `DERIVABLE_PALETTE_KEYS`. */
export function applyTouch(p: RolePalette, key: PaletteKey): RolePalette {
  if (!DERIVABLE_PALETTE_KEYS.includes(key)) return p;
  const set = new Set(p.touched_roles ?? []);
  if (set.has(key)) return p;
  set.add(key);
  return { ...p, touched_roles: [...set] };
}

/** Remove a role key from `touched_roles` — "Match my main colours again". */
export function applyRelease(p: RolePalette, key: PaletteKey): RolePalette {
  return { ...p, touched_roles: (p.touched_roles ?? []).filter((k) => k !== key) };
}

// ── section 00 — the majors, the ONLY writers of `palette.reception` ───────

export function applySetMajorColor(p: RolePalette, index: number, hex: string): RolePalette {
  const arr = [...(p.reception ?? [])];
  arr[index] = hex.toUpperCase();
  return { ...p, reception: arr };
}

export function applyAddMajorSlot(p: RolePalette): RolePalette {
  const arr = p.reception ?? [];
  if (arr.length >= PALETTE_LIMITS.reception.max) return p;
  // MB13: Setnayan AI takes over the majors suggestion once the couple has
  // actually started choosing colours (`progressiveReceptionSuggestion`
  // returns `undefined` — advise nothing — until `hasChosenMajors`, so the
  // very first colour still falls through to the static default below).
  const next = progressiveReceptionSuggestion(arr) ?? nextSuggestion('reception', arr.length);
  return { ...p, reception: [...arr, next] };
}

export function applyRemoveMajorSlot(p: RolePalette, index: number): RolePalette {
  return { ...p, reception: (p.reception ?? []).filter((_, i) => i !== index) };
}

// ── section 02 — every other role. NEVER `key === 'reception'`. ────────────

export function applySetRoleColor(p: RolePalette, key: PaletteKey, index: number, hex: string): RolePalette {
  if (key === 'reception') return p; // 🛑 one-directional rule
  const arr = [...(p[key] ?? [])];
  arr[index] = hex.toUpperCase();
  return applyTouch({ ...p, [key]: arr }, key);
}

export function applyAddRoleColor(p: RolePalette, key: PaletteKey): RolePalette {
  if (key === 'reception') return p; // 🛑 one-directional rule
  const arr = p[key] ?? [];
  if (arr.length >= PALETTE_LIMITS[key].max) return p;
  return applyTouch({ ...p, [key]: [...arr, nextSuggestion(key, arr.length)] }, key);
}

export function applyRemoveRoleColor(p: RolePalette, key: PaletteKey, index: number): RolePalette {
  if (key === 'reception') return p; // 🛑 one-directional rule
  return applyTouch({ ...p, [key]: (p[key] ?? []).filter((_, i) => i !== index) }, key);
}

/** Copy `clipboardHex` into one role's slot — the picker's "paste" action. */
export function applyPasteInto(p: RolePalette, key: PaletteKey, index: number, clipboardHex: string): RolePalette {
  if (key === 'reception') return p; // 🛑 one-directional rule
  const arr = [...(p[key] ?? [])];
  arr[index] = clipboardHex.toUpperCase();
  return applyTouch({ ...p, [key]: arr }, key);
}

/** Trade two slots' colors — same role or across two different roles.
 *  Both ends must already hold a color; both roles end up touched. */
export function applySwap(
  p: RolePalette,
  a: { key: PaletteKey; index: number },
  b: { key: PaletteKey; index: number },
): RolePalette {
  if (a.key === 'reception' || b.key === 'reception') return p; // 🛑 one-directional rule
  if (a.key === b.key && a.index === b.index) return p;
  const arrA = [...(p[a.key] ?? [])];
  const arrB = a.key === b.key ? arrA : [...(p[b.key] ?? [])];
  const aVal = arrA[a.index];
  const bVal = arrB[b.index];
  if (aVal == null || bVal == null) return p;
  arrA[a.index] = bVal;
  arrB[b.index] = aVal;
  let next: RolePalette = { ...p, [a.key]: arrA };
  if (a.key !== b.key) next = { ...next, [b.key]: arrB };
  next = applyTouch(next, a.key);
  next = applyTouch(next, b.key);
  return next;
}
