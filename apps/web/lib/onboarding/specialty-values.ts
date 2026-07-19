/**
 * Pure helpers for the rich per-type specialty capture (Track-B polish).
 *
 * - `normalizeSpecialtyValues` cleans the raw controlled-form bag before it's
 *   persisted to events.signature_details: coerces number fields to real numbers
 *   (the renderer holds them as strings while typing), coerces roster item cells,
 *   drops empty values / empty roster rows, and drops fields hidden by a
 *   `show_when` condition. So the Brief's specialty layer reads typed, dense data
 *   instead of stringy, empty-keyed noise.
 * - `isSpecialtyFieldVisible` is the conditional-reveal predicate (rite branching,
 *   e.g. only show the unity rites for a religious ceremony).
 *
 * No React, no I/O — unit-testable + deterministic (Rule 1).
 */
import type { SpecialtyField, SpecialtyItemField } from './specialty-catalog';

/** number | undefined — coerce a raw value (string/number) to a finite number. */
function toNumber(raw: unknown): number | undefined {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t === '') return undefined;
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** trimmed non-empty string | undefined. */
function toStr(raw: unknown): string | undefined {
  if (typeof raw === 'string') {
    const t = raw.trim();
    return t === '' ? undefined : t;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  return undefined;
}

/** Coerce one roster item cell by its declared type. */
function coerceCell(type: SpecialtyItemField['type'], raw: unknown): unknown {
  return type === 'number' ? toNumber(raw) : toStr(raw);
}

/**
 * Is a field shown, given the current answers? A field with no `show_when` is
 * always visible; otherwise the controlling field's value must be in `equals`
 * (supports a controlling select string OR a multiselect array).
 */
export function isSpecialtyFieldVisible(
  field: SpecialtyField,
  values: Record<string, unknown>,
): boolean {
  const sw = field.show_when;
  if (!sw) return true;
  const cur = values[sw.field];
  if (Array.isArray(cur)) return cur.some((x) => typeof x === 'string' && sw.equals.includes(x));
  return typeof cur === 'string' && sw.equals.includes(cur);
}

function normalizeRosterRow(
  itemFields: readonly SpecialtyItemField[],
  row: unknown,
): Record<string, unknown> | undefined {
  if (!row || typeof row !== 'object') return undefined;
  const src = row as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const it of itemFields) {
    const v = coerceCell(it.type, src[it.key]);
    if (v !== undefined) out[it.key] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Coerce one field's raw value to its persisted shape (or undefined to drop it). */
function normalizeFieldValue(field: SpecialtyField, raw: unknown): unknown {
  switch (field.type) {
    case 'number':
      return toNumber(raw);
    case 'boolean':
      return typeof raw === 'boolean' ? raw : undefined;
    case 'multiselect': {
      const arr = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];
      return arr.length > 0 ? arr : undefined;
    }
    case 'person_roster':
    case 'list': {
      const items = field.item_fields ?? [];
      const rows = (Array.isArray(raw) ? raw : [])
        .map((r) => normalizeRosterRow(items, r))
        .filter((r): r is Record<string, unknown> => r !== undefined);
      return rows.length > 0 ? rows : undefined;
    }
    default: // text · textarea · date · select
      return toStr(raw);
  }
}

/**
 * Clean the raw specialty-values bag for persistence: typed, dense, no hidden
 * fields, no empty rows/keys. Pure — same input → same output.
 */
export function normalizeSpecialtyValues(
  fields: readonly SpecialtyField[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (!isSpecialtyFieldVisible(f, values)) continue;
    const v = normalizeFieldValue(f, values[f.key]);
    if (v !== undefined) out[f.key] = v;
  }
  return out;
}
