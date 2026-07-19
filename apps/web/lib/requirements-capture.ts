import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchSchemaWithSharedGroups } from '@/lib/vendor-service-attributes';

/**
 * requirements-capture — the COUPLE side of the per-category facet schema
 * (Phase 1b PR-3). When a couple inquires about a leaf service category, we
 * surface the SAME admin-defined `multi_select` facets the vendor fills (from
 * `canonical_service_schemas.category_specific_attributes`) as a checkbox
 * "what we're looking for" capture. The couple's picks persist to
 * `event_vendor_preferences.attribute_payload` (keyed by canonical_service)
 * via `setEventPreference`, and get appended to the inquiry message body so
 * the vendor sees them on first contact.
 *
 * We intentionally surface ONLY `multi_select` fields here: those are the
 * "pick what you want" facets that read naturally as couple preferences
 * (shooting styles, coverage scope, dietary accommodations, …). The other
 * field types (int / text / enum / boolean / multi_select_open) are
 * vendor-completeness inputs ("wedding count handled", "response-time SLA"),
 * not couple-facing requirements, so they're filtered out.
 *
 * Graceful-degrade: a leaf with no schema row, or a schema with no
 * multi_select fields, yields an empty list — the pop-up then shows only the
 * special-request box and never errors.
 */

/** One couple-facing requirement field: a labelled checkbox group. */
export type RequirementField = {
  /** The attribute_payload key (e.g. 'shooting_styles'). */
  key: string;
  /** Human label (from the schema's `label`, else humanized key). */
  label: string;
  /** The fixed checkbox options (raw values; humanize for display). */
  options: string[];
};

/** Humanize a raw snake_case option/key for display. */
export function humanizeFacet(value: string): string {
  return value.replaceAll('_', ' ');
}

/**
 * Resolve the couple-facing `multi_select` requirement fields for a leaf
 * canonical_service. Returns [] when the leaf has no schema or no
 * multi_select fields (never throws — fetchSchemaWithSharedGroups can throw,
 * so we swallow and degrade to no fields).
 */
export async function fetchRequirementFields(
  client: SupabaseClient,
  canonicalService: string | null,
): Promise<RequirementField[]> {
  const key = (canonicalService ?? '').trim();
  if (!key) return [];
  let resolved;
  try {
    resolved = await fetchSchemaWithSharedGroups(client, key);
  } catch {
    // Missing table / transient error → degrade to no fields. The pop-up
    // still works (special-request only) and the inquiry still sends.
    return [];
  }
  if (!resolved) return [];

  const fields: RequirementField[] = [];
  for (const [fieldKey, def] of Object.entries(resolved.fields)) {
    if (def.type !== 'multi_select') continue;
    const options = Array.isArray(def.options) ? def.options.filter((o) => typeof o === 'string') : [];
    if (options.length === 0) continue;
    fields.push({
      key: fieldKey,
      label: def.label ?? humanizeFacet(fieldKey),
      options: [...options],
    });
  }
  return fields;
}

/**
 * Whether a canonical_service key is a valid FK target for
 * event_vendor_preferences.canonical_service (i.e. a row exists in
 * canonical_service_schemas). The couple's leaf key comes from
 * vendor_services.category, which is ~1:1 with canonical_service — but a
 * handful of legacy categories have no schema row. Persisting against one of
 * those would violate the FK, so callers check this first and gracefully
 * SKIP the save (the inquiry still sends) when it returns false.
 *
 * Best-effort: a missing table (not-yet-migrated edge) returns false so the
 * caller skips rather than throwing.
 */
export async function isPersistableCanonicalService(
  client: SupabaseClient,
  canonicalService: string | null,
): Promise<boolean> {
  const key = (canonicalService ?? '').trim();
  if (!key) return false;
  const { data, error } = await client
    .from('canonical_service_schemas')
    .select('canonical_service')
    .eq('canonical_service', key)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.canonical_service);
}

/**
 * The couple's saved requirements template for one leaf category, as it lives
 * in `event_vendor_preferences` (the ONLY source for auto carry-forward). This
 * is the de-Set'd, serializable shape the client composer holds and the server
 * action accepts.
 */
export type SavedRequirementsTemplate = {
  /** Checked facet picks: field key → selected option values. */
  payload: Record<string, string[]>;
  /** Freeform "anything specific?" note. */
  specialRequest: string;
  /** Carry-forward flag (`event_vendor_preferences.auto_send`). */
  autoSend: boolean;
};

/**
 * The requirements payload shape the inquiry server action accepts.
 * (Matches `startServiceInquiry({ requirements })`.)
 */
export type RequirementsActionInput = {
  payload: Record<string, string[]>;
  specialRequest: string | null;
  autoSend: boolean;
};

/**
 * Phase 1b PR-5 — AI-gated auto carry-forward. Build the requirements payload
 * for an inquiry SOLELY from the couple's own saved template
 * (`event_vendor_preferences`). This is the carry-forward source-of-truth and
 * the PRIVACY BOUNDARY (owner-locked 2026-06-20): the auto-attached
 * requirements come ONLY from the couple's saved row — NEVER from a vendor's
 * proposal / quote / message or any other vendor-authored table.
 *
 * Pure + total: a null/empty template degrades to an empty payload (no facets,
 * no note) with autoSend carried through, so the caller can decide whether
 * there's anything to send. It re-sanitizes the saved shape (string keys →
 * arrays of non-empty strings) defensively even though the row is the couple's
 * own.
 */
export function buildAutoCarryForwardRequirements(
  saved: SavedRequirementsTemplate | null | undefined,
): RequirementsActionInput {
  const payload: Record<string, string[]> = {};
  const rawPayload = saved?.payload;
  if (rawPayload && typeof rawPayload === 'object') {
    for (const [key, values] of Object.entries(rawPayload)) {
      if (!key || !Array.isArray(values)) continue;
      const picks = Array.from(
        new Set(values.map((v) => String(v).trim()).filter((v) => v.length > 0)),
      );
      if (picks.length > 0) payload[key] = picks;
    }
  }
  const note = typeof saved?.specialRequest === 'string' ? saved.specialRequest.trim() : '';
  return {
    payload,
    specialRequest: note.length > 0 ? note : null,
    autoSend: saved?.autoSend === true,
  };
}

/**
 * Should the Inquire click SKIP the pop-up and auto-send the saved
 * requirements? True only when ALL of:
 *   • Setnayan AI is active for the event (auto carry-forward = the AI value),
 *   • the couple has a saved template for THIS category, AND
 *   • that template's auto_send flag is on.
 *
 * The FIRST inquiry (couple fills + checks "auto-send") always shows the
 * pop-up because no saved row exists yet at render time — only SUBSEQUENT
 * same-category inquiries satisfy this. AI OFF, auto_send=false, or no saved
 * row → false → the pop-up shows (pre-filled from the row if present).
 */
export function shouldAutoCarryForward(
  aiActive: boolean,
  saved: SavedRequirementsTemplate | null | undefined,
): boolean {
  return aiActive === true && saved != null && saved.autoSend === true;
}

/**
 * Build the "What we're looking for" block appended to the inquiry message
 * body so the vendor sees the couple's requirements on first contact.
 * Returns '' when there's nothing to show (no checked facets, no note).
 */
export function buildRequirementsBlock(
  payload: Record<string, string[]>,
  specialRequest: string | null,
): string {
  const lines: string[] = [];
  for (const [key, values] of Object.entries(payload)) {
    const picks = (values ?? []).filter((v) => typeof v === 'string' && v.trim().length > 0);
    if (picks.length === 0) continue;
    lines.push(`• ${humanizeFacet(key)}: ${picks.map(humanizeFacet).join(', ')}`);
  }
  const note = (specialRequest ?? '').trim();
  if (note.length > 0) lines.push(`• Special request: ${note}`);
  if (lines.length === 0) return '';
  return ['', '— What we’re looking for —', ...lines].join('\n');
}
