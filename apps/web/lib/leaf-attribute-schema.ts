/**
 * leaf-attribute-schema.ts — the pure, redirect-free, Supabase-free core behind
 * the Taxonomy Studio's per-leaf **Refinements editor** (the vendor attribute
 * schema stored in `canonical_service_schemas.category_specific_attributes`).
 *
 * These are the owner-clarified "refinements": the attributes of a leaf category
 * that vendors fill in (shooting_style, cuisine, coverage_hours, …). The Studio
 * previously had NO editor for them — only a leaf-creation "starter refinement"
 * and a count badge. This module is the testable spine the server actions call.
 *
 * ─── 0044 ADDITIVE-ONLY / NEVER-ORPHAN CONTRACT (the whole reason this is pure) ──
 *
 * A vendor's saved `vendor_service_attributes.attribute_payload` keys on the
 * FIELD KEY and stores option VALUES verbatim (options are plain strings used as
 * both value and label — see AttributeFieldDef.options). So:
 *
 *   • Field KEYS are immutable. We never rename or delete a key in place — a
 *     rename would orphan every payload keyed on the old name.
 *   • Option VALUES are immutable. Because the option string IS the stored value
 *     (no separate value/label), relabelling an option in place would orphan
 *     every payload that stored the old string. So this module offers NO
 *     option-relabel — only add + retire.
 *   • Field LABELS are free to change: `def.label` is a pure display field; the
 *     payload never stores it. So relabelLeafAttributeField is safe.
 *   • RETIRE is soft + additive: a `retired: true` flag on the field, and a
 *     `retired_options: string[]` list on a select field. Retired entries STAY in
 *     the schema (the option string stays inside `def.options`) so a vendor's
 *     previously-saved value still validates + reads forever; only the render
 *     layer hides them from NEW picks. UNRETIRE is the symmetric inverse.
 *
 * Every mutation returns the FULL new `category_specific_attributes` map plus the
 * incremented `schema_version` — the caller writes both in one UPDATE and audits
 * the before/after of the touched field.
 */
import type { AttributeFieldDef } from '@/lib/marketplaces/schemas';

/** The map stored in `canonical_service_schemas.category_specific_attributes`. */
export type LeafAttributeMap = Record<string, AttributeFieldDef>;

/** The field types an admin may mint through the Studio, mirroring the shapes
 *  the vendor form renderer + the parseAttributeFieldValue parser already
 *  handle. Kept in sync with AttributeFieldDef['type']. */
export const LEAF_ATTRIBUTE_TYPES = [
  'boolean',
  'int',
  'text_short',
  'text_long',
  'enum',
  'multi_select',
  'multi_select_open',
] as const;

export type LeafAttributeType = (typeof LEAF_ATTRIBUTE_TYPES)[number];

/** Types that carry a fixed option list (add-option / retire-option apply). */
export const OPTION_BEARING_TYPES = ['enum', 'multi_select'] as const;

export function isLeafAttributeType(t: string): t is LeafAttributeType {
  return (LEAF_ATTRIBUTE_TYPES as readonly string[]).includes(t);
}

export function isOptionBearingType(t: string): boolean {
  return (OPTION_BEARING_TYPES as readonly string[]).includes(t);
}

/** A field def carrying the additive retire annotations this module manages.
 *  `retired` soft-retires the whole field; `retired_options` soft-retires
 *  individual option values (which stay inside `options` for validation). */
export type RetirableFieldDef = AttributeFieldDef & {
  retired?: boolean;
  retired_options?: readonly string[];
};

export type SchemaMutationResult =
  | { ok: true; attributes: LeafAttributeMap; schemaVersion: number }
  | { ok: false; error: string };

/* ────────────────────────────────────────────────────────────────────────
 * Key + option-value generation (immutable once minted)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Derive a stable snake_case key/value from a human label. Same normalization
 * the Studio's `slugify(label, '_')` uses (lowercase · NFKD · non-alnum → `_`
 * · trim leading/trailing `_`) so a key minted here matches the createCanonicalLeaf
 * starter-refinement convention exactly.
 */
export function slugifyKey(label: string): string {
  return String(label ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** A minted key must be non-empty snake_case (letters/digits/underscore, not
 *  starting or ending with `_`, no double `__` runs after slugify). */
const KEY_RE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

export function isValidKey(key: string): boolean {
  return KEY_RE.test(key);
}

/* ────────────────────────────────────────────────────────────────────────
 * Read helpers
 * ──────────────────────────────────────────────────────────────────────── */

/** A field is retired when `retired === true`. */
export function isFieldRetired(def: AttributeFieldDef): boolean {
  return (def as RetirableFieldDef).retired === true;
}

/** The retired option values for a field (empty when none). */
export function retiredOptionsOf(def: AttributeFieldDef): string[] {
  const r = (def as RetirableFieldDef).retired_options;
  return Array.isArray(r) ? [...r] : [];
}

/** True when this option string is soft-retired on the field. */
export function isOptionRetired(def: AttributeFieldDef, option: string): boolean {
  return retiredOptionsOf(def).includes(option);
}

/**
 * The RENDER-facing view of the schema: fields with `retired:true` dropped, and
 * each option-bearing field's `options` filtered to the non-retired set. This is
 * what the vendor form + fast-form chips iterate so a retired refinement stops
 * offering NEW picks — while the full map (with retired entries intact) is what
 * the PARSER validates against, so an already-saved value never orphans.
 *
 * Pure + side-effect free: returns a fresh map; never mutates the input.
 */
export function visibleLeafAttributes(attributes: LeafAttributeMap): LeafAttributeMap {
  const out: LeafAttributeMap = {};
  for (const [key, def] of Object.entries(attributes ?? {})) {
    if (!def || isFieldRetired(def)) continue;
    if (isOptionBearingType(def.type) && Array.isArray(def.options)) {
      const retired = new Set(retiredOptionsOf(def));
      const visibleOptions = def.options.filter((o) => !retired.has(o));
      // Strip the retired_options bookkeeping from the render copy — the form
      // never needs it, and leaving it out keeps the rendered def clean.
      const { retired_options: _drop, retired: _drop2, ...rest } = def as RetirableFieldDef;
      out[key] = { ...rest, options: visibleOptions };
    } else {
      const { retired: _drop, ...rest } = def as RetirableFieldDef;
      out[key] = rest;
    }
  }
  return out;
}

/**
 * The RENDER view for a vendor's OWN form, given their saved payload. Same as
 * {@link visibleLeafAttributes} but a retired field / option that the vendor has
 * ALREADY answered stays visible (and keeps its saved value in `options`) so they
 * can see, keep, or change it — the answer is never silently dropped on the next
 * save. New (unanswered) retired entries are hidden. This is the never-orphan
 * guarantee applied at the one form that writes the payload.
 */
export function visibleLeafAttributesForPayload(
  attributes: LeafAttributeMap,
  payload: Record<string, unknown> | null | undefined,
): LeafAttributeMap {
  const p = payload ?? {};
  const out: LeafAttributeMap = {};
  for (const [key, def] of Object.entries(attributes ?? {})) {
    if (!def) continue;
    const answered = isAnswered(p[key]);
    if (isFieldRetired(def) && !answered) continue; // hide retired + unanswered

    if (isOptionBearingType(def.type) && Array.isArray(def.options)) {
      const retired = new Set(retiredOptionsOf(def));
      const selected = selectedValues(p[key]);
      const visibleOptions = def.options.filter(
        (o) => !retired.has(o) || selected.has(o), // keep a retired option the vendor picked
      );
      const { retired_options: _d1, retired: _d2, ...rest } = def as RetirableFieldDef;
      out[key] = { ...rest, options: visibleOptions };
    } else {
      const { retired: _d, ...rest } = def as RetirableFieldDef;
      out[key] = rest;
    }
  }
  return out;
}

function isAnswered(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function selectedValues(value: unknown): Set<string> {
  if (typeof value === 'string') return new Set([value]);
  if (Array.isArray(value)) return new Set(value.filter((v): v is string => typeof v === 'string'));
  return new Set();
}

/* ────────────────────────────────────────────────────────────────────────
 * Mutations — each returns the FULL new map + bumped schema_version
 * ──────────────────────────────────────────────────────────────────────── */

function bump(schemaVersion: number): number {
  return (Number.isFinite(schemaVersion) ? schemaVersion : 1) + 1;
}

/**
 * Add a brand-new field. The key is derived from the label (immutable) and must
 * not collide with an existing field (retired or not — a retired field still
 * owns its key). Option-bearing types seed an initial option list (deduped,
 * order-preserved); a non-empty option list is REQUIRED for enum/multi_select
 * so the field is usable the moment it lands.
 */
export function addLeafAttributeField(
  attributes: LeafAttributeMap,
  schemaVersion: number,
  input: { label: string; type: string; options?: string[] },
): SchemaMutationResult {
  const label = String(input.label ?? '').trim();
  if (label.length < 2 || label.length > 80) {
    return { ok: false, error: 'Refinement name must be 2–80 characters.' };
  }
  if (!isLeafAttributeType(input.type)) {
    return { ok: false, error: `Unknown field type "${input.type}".` };
  }
  const key = slugifyKey(label);
  if (!isValidKey(key)) {
    return { ok: false, error: 'Name needs letters or numbers.' };
  }
  if (key in (attributes ?? {})) {
    return { ok: false, error: `A refinement "${key}" already exists on this service.` };
  }

  const def: RetirableFieldDef = { type: input.type as LeafAttributeType, label };

  if (isOptionBearingType(input.type)) {
    const options = normalizeOptionList(input.options ?? []);
    if (options.length === 0) {
      return { ok: false, error: 'This field type needs at least one option.' };
    }
    def.options = options;
  }

  const next: LeafAttributeMap = { ...(attributes ?? {}), [key]: def };
  return { ok: true, attributes: next, schemaVersion: bump(schemaVersion) };
}

/**
 * Add an option to an existing enum/multi_select field. The option VALUE is
 * derived from the label (immutable). If the value already exists but is
 * retired, this UN-retires it (additive round-trip) rather than erroring —
 * an admin re-adding a name they retired gets it back.
 */
export function addLeafAttributeOption(
  attributes: LeafAttributeMap,
  schemaVersion: number,
  input: { fieldKey: string; label: string },
): SchemaMutationResult {
  const fieldKey = String(input.fieldKey ?? '').trim();
  const def = (attributes ?? {})[fieldKey] as RetirableFieldDef | undefined;
  if (!def) return { ok: false, error: `No refinement "${fieldKey}" on this service.` };
  if (!isOptionBearingType(def.type)) {
    return { ok: false, error: 'Only pick-one / pick-many refinements have options.' };
  }
  const label = String(input.label ?? '').trim();
  if (label.length < 1 || label.length > 80) {
    return { ok: false, error: 'Option name must be 1–80 characters.' };
  }
  const value = slugifyKey(label);
  if (!isValidKey(value)) {
    return { ok: false, error: 'Option needs letters or numbers.' };
  }

  const options = [...(def.options ?? [])];
  const retired = new Set(retiredOptionsOf(def));

  if (options.includes(value)) {
    if (retired.has(value)) {
      // Re-adding a retired value simply un-retires it.
      retired.delete(value);
      const nextDef: RetirableFieldDef = { ...def, options };
      writeRetiredOptions(nextDef, retired);
      return finalize(attributes, fieldKey, nextDef, schemaVersion);
    }
    return { ok: false, error: `Option "${value}" already exists here.` };
  }

  options.push(value);
  const nextDef: RetirableFieldDef = { ...def, options };
  return finalize(attributes, fieldKey, nextDef, schemaVersion);
}

/**
 * Relabel a field's display label. SAFE because `def.label` is pure display —
 * the payload keys on the immutable field KEY, never the label. The key is
 * untouched.
 */
export function relabelLeafAttributeField(
  attributes: LeafAttributeMap,
  schemaVersion: number,
  input: { fieldKey: string; label: string },
): SchemaMutationResult {
  const fieldKey = String(input.fieldKey ?? '').trim();
  const def = (attributes ?? {})[fieldKey] as RetirableFieldDef | undefined;
  if (!def) return { ok: false, error: `No refinement "${fieldKey}" on this service.` };
  const label = String(input.label ?? '').trim();
  if (label.length < 2 || label.length > 80) {
    return { ok: false, error: 'Name must be 2–80 characters.' };
  }
  const nextDef: RetirableFieldDef = { ...def, label };
  return finalize(attributes, fieldKey, nextDef, schemaVersion);
}

/**
 * Soft-retire (or un-retire) a whole field. The def + its options stay in the
 * map so saved payloads keep validating; only `retired` flips. Idempotent.
 */
export function retireLeafAttributeField(
  attributes: LeafAttributeMap,
  schemaVersion: number,
  input: { fieldKey: string; retired: boolean },
): SchemaMutationResult {
  const fieldKey = String(input.fieldKey ?? '').trim();
  const def = (attributes ?? {})[fieldKey] as RetirableFieldDef | undefined;
  if (!def) return { ok: false, error: `No refinement "${fieldKey}" on this service.` };
  const nextDef: RetirableFieldDef = { ...def };
  if (input.retired) nextDef.retired = true;
  else delete nextDef.retired;
  return finalize(attributes, fieldKey, nextDef, schemaVersion);
}

/**
 * Soft-retire (or un-retire) a single option VALUE. The value stays inside
 * `options` (so a payload holding it still validates); it's added to /
 * removed from `retired_options`, which the render layer reads to hide it from
 * new picks. Never removes the value.
 */
export function retireLeafAttributeOption(
  attributes: LeafAttributeMap,
  schemaVersion: number,
  input: { fieldKey: string; option: string; retired: boolean },
): SchemaMutationResult {
  const fieldKey = String(input.fieldKey ?? '').trim();
  const def = (attributes ?? {})[fieldKey] as RetirableFieldDef | undefined;
  if (!def) return { ok: false, error: `No refinement "${fieldKey}" on this service.` };
  if (!isOptionBearingType(def.type)) {
    return { ok: false, error: 'Only pick-one / pick-many refinements have options.' };
  }
  const option = String(input.option ?? '').trim();
  if (!(def.options ?? []).includes(option)) {
    return { ok: false, error: `No option "${option}" on this refinement.` };
  }
  // Never retire the last remaining live option — a select with zero live
  // options can't offer a valid new pick.
  const retired = new Set(retiredOptionsOf(def));
  if (input.retired) {
    const liveAfter = (def.options ?? []).filter((o) => o !== option && !retired.has(o));
    if (liveAfter.length === 0) {
      return { ok: false, error: 'Can’t retire the last active option — retire the whole refinement instead.' };
    }
    retired.add(option);
  } else {
    retired.delete(option);
  }
  const nextDef: RetirableFieldDef = { ...def };
  writeRetiredOptions(nextDef, retired);
  return finalize(attributes, fieldKey, nextDef, schemaVersion);
}

/* ────────────────────────────────────────────────────────────────────────
 * Internal helpers
 * ──────────────────────────────────────────────────────────────────────── */

/** Dedupe + trim an incoming option label list into stable snake_case values,
 *  order preserved. Drops empties + anything that slugs to nothing. */
function normalizeOptionList(labels: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of labels) {
    const value = slugifyKey(String(raw ?? ''));
    if (!isValidKey(value)) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

/** Set or clear `retired_options` on a def in place (empty list → drop key). */
function writeRetiredOptions(def: RetirableFieldDef, retired: Set<string>): void {
  if (retired.size === 0) {
    delete def.retired_options;
  } else {
    // Preserve declaration order of the underlying options where possible.
    const ordered = (def.options ?? []).filter((o) => retired.has(o));
    def.retired_options = ordered;
  }
}

/** Splice one changed field def back into the map + bump the version. */
function finalize(
  attributes: LeafAttributeMap,
  fieldKey: string,
  nextDef: RetirableFieldDef,
  schemaVersion: number,
): SchemaMutationResult {
  const next: LeafAttributeMap = { ...(attributes ?? {}), [fieldKey]: nextDef };
  return { ok: true, attributes: next, schemaVersion: bump(schemaVersion) };
}
