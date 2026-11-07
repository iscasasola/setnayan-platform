/**
 * service-definitions.ts — the one-line ⓘ definition of a SERVICE (plan Track D, item D4).
 *
 * Owner, DECISION_LOG 2026-11-06 ("EVERY CATEGORY AND SERVICE IN THE SIGN-UP PICKER GETS AN ⓘ WITH A ONE-LINE
 * DEFINITION"): *"add (i) for each so we can define the categories and service so they know where they should
 * locate themselves."* A category's ⓘ already reads `service_categories.hint_en`; a service's reads
 * `canonical_service_schemas.hint_en` (migration 20271320021260), written on Admin › Categories › a service ›
 * Name › "ⓘ text". The taxonomy has ONE source — Admin › Categories — so no definition is ever written in code.
 *
 * 🚫 NO FALLBACK, NO PLACEHOLDER. Unlike a category (whose ⓘ falls back to an old line or a built one), an
 * unwritten service definition means NO ⓘ: `serviceDefinitionIn` answers `null` and the caller draws nothing.
 *
 * Pure on purpose (no Supabase, no React): the client pickers import the shapes; the server read lives in
 * `service-definitions.server.ts`.
 */

/** The longest definition the column takes (`canonical_service_schemas_hint_en_length`, migration 20271320021260). */
export const SERVICE_DEFINITION_MAX = 120;

/** Sparse: only services whose definition is WRITTEN appear. Key = `canonical_service`. */
export type ServiceDefinitions = Readonly<Record<string, string>>;

/** What a typed definition saves as: one line, spaces collapsed; blank → `null` (= not written, no ⓘ). */
export function cleanServiceDefinition(raw: unknown): string | null {
  const text = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return text === '' ? null : text;
}

/** Build the sparse map from rows `{ canonical_service, hint_en }` — a blank or missing line is left out. */
export function serviceDefinitionsFromRows(
  rows: ReadonlyArray<{ canonical_service: string | null; hint_en: string | null }> | null | undefined,
): ServiceDefinitions {
  const out: Record<string, string> = {};
  for (const r of rows ?? []) {
    const key = (r.canonical_service ?? '').trim();
    const line = cleanServiceDefinition(r.hint_en);
    if (key && line) out[key] = line;
  }
  return out;
}

/** The one line for `key`, or `null` — and `null` means the caller draws NO ⓘ. */
export function serviceDefinitionIn(defs: ServiceDefinitions | null | undefined, key: string | null | undefined): string | null {
  if (!defs || !key) return null;
  return cleanServiceDefinition(defs[key]);
}
