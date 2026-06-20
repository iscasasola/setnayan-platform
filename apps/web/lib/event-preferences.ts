import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * event-preferences — read/write the couple's per-category match preferences
 * (public.event_vendor_preferences). CLAUDE.md 2026-06-02 "do both" · step 2
 * FOUNDATION.
 *
 * This is the couple-side mirror of iteration 0044's vendor_service_attributes.
 * A vendor fills attribute_payload for a canonical_service (cuisine_specialties,
 * dietary_accommodations, …); these helpers let the couple persist the SAME
 * shape of preference per canonical_service. The match layer (Layer-B SORT, per
 * Vendor_Match_Personalization_2026-06-01.md) will float vendors whose
 * vendor_service_attributes.attribute_payload @> the couple's preference — never
 * exclude.
 *
 * FOUNDATION-ONLY today: vendor_service_attributes is EMPTY in production (no
 * vendor is tagged with facet values yet), so reading these prefs into a matcher
 * would match nothing. These helpers land the canonical storage access so a
 * capture UI (onboarding Phase 5 / a couple pref editor) can persist prefs and
 * the match-read can be wired — both activating automatically once vendor facet
 * tagging coverage exists. Nothing in the app calls these yet → zero pilot impact.
 *
 * Client-agnostic: pass the RLS server client (host-scoped via
 * current_event_ids()) for couple reads/writes, or the admin client for
 * server-action writes / matcher reads. Graceful-degrade on a missing
 * table/column (42P01 / 42703) so a brand-new-table deploy edge never throws.
 */

/** A couple's preference payload for one canonical_service. */
export type EventPreferencePayload = Record<string, unknown>;

/**
 * A couple's full saved requirements template for one canonical_service:
 * the match facets (attribute_payload) PLUS the freeform special_request and
 * the auto_send (carry-forward) flag added in Phase 1b PR-1.
 */
export type EventPreference = {
  attribute_payload: EventPreferencePayload;
  special_request: string | null;
  auto_send: boolean;
};

/** event_id → its saved requirements template. */
export type EventPreferenceMap = Record<string, EventPreference>;

export type SetEventPreferenceResult =
  | { ok: true }
  | { ok: false; code: 'unavailable' | 'db_error'; message: string };

const TABLE = 'event_vendor_preferences';

/** True for a missing-table / missing-column shape error (table not migrated yet). */
function isShapeError(code: string | undefined): boolean {
  return code === '42P01' || code === '42703';
}

/**
 * All of an event's per-category preferences, keyed by canonical_service.
 * Returns {} on no rows OR a not-yet-migrated table — never throws.
 */
export async function getEventPreferences(
  client: SupabaseClient,
  eventId: string,
): Promise<EventPreferenceMap> {
  const { data, error } = await client
    .from(TABLE)
    .select('canonical_service, attribute_payload, special_request, auto_send')
    .eq('event_id', eventId);

  if (error) {
    if (isShapeError(error.code)) return {};
    console.warn(`Failed to read event preferences: ${error.message}`);
    return {};
  }

  const map: EventPreferenceMap = {};
  for (const row of data ?? []) {
    const r = row as {
      canonical_service?: string;
      attribute_payload?: EventPreferencePayload;
      special_request?: string | null;
      auto_send?: boolean | null;
    };
    const key = r.canonical_service;
    if (typeof key === 'string' && key.length > 0) {
      map[key] = {
        attribute_payload: (r.attribute_payload ?? {}) as EventPreferencePayload,
        special_request: r.special_request ?? null,
        auto_send: r.auto_send ?? false,
      };
    }
  }
  return map;
}

/**
 * One category's saved requirements template (match facets + special_request +
 * auto_send), or null if none / not-yet-migrated.
 */
export async function getEventPreference(
  client: SupabaseClient,
  eventId: string,
  canonicalService: string,
): Promise<EventPreference | null> {
  const { data, error } = await client
    .from(TABLE)
    .select('attribute_payload, special_request, auto_send')
    .eq('event_id', eventId)
    .eq('canonical_service', canonicalService)
    .maybeSingle();

  if (error) {
    if (isShapeError(error.code)) return null;
    console.warn(`Failed to read event preference: ${error.message}`);
    return null;
  }
  if (!data) return null;
  const r = data as {
    attribute_payload?: EventPreferencePayload;
    special_request?: string | null;
    auto_send?: boolean | null;
  };
  return {
    attribute_payload: (r.attribute_payload ?? {}) as EventPreferencePayload,
    special_request: r.special_request ?? null,
    auto_send: r.auto_send ?? false,
  };
}

/** The optional requirements-template fields persisted alongside the facets. */
export type SetEventPreferenceFields = {
  /** Freeform per-category requirement note. Empty/whitespace → stored as null. */
  specialRequest?: string | null;
  /** Carry-forward flag: auto-attach this template to inquiries for the category. */
  autoSend?: boolean;
};

/** Normalize a freeform note: trim, and treat empty as "no note". */
function normalizeSpecialRequest(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Upsert (or clear) one category's saved requirements template — match facets
 * (attribute_payload) plus the freeform special_request and the auto_send
 * carry-forward flag (Phase 1b PR-1).
 *
 * The row is DELETED only when the WHOLE template is empty: no facet keys AND no
 * special_request AND auto_send is false — the clean representation of "the
 * couple cleared this category" (so it stops affecting the sort), matching the
 * Personalize-my-matches delete semantics in Vendor_Match_Personalization §6.
 * A row that carries ONLY a special_request (no checkboxes) or ONLY auto_send=true
 * therefore SURVIVES — those are real requirements the couple set.
 *
 * Pass the admin client from a server action (RLS is defense-in-depth; the action
 * is the gate) OR the host-scoped RLS client. Returns a result object rather than
 * throwing so callers can surface inline state.
 */
export async function setEventPreference(
  client: SupabaseClient,
  eventId: string,
  canonicalService: string,
  payload: EventPreferencePayload,
  fields: SetEventPreferenceFields = {},
): Promise<SetEventPreferenceResult> {
  const specialRequest = normalizeSpecialRequest(fields.specialRequest);
  const autoSend = fields.autoSend === true;

  const hasKeys = payload != null && Object.keys(payload).length > 0;
  // Empty = no facets AND no special_request AND auto_send is off. A template
  // that carries any one of those is a real requirement → it must survive.
  const isEmpty = !hasKeys && specialRequest === null && !autoSend;

  if (isEmpty) {
    const { error } = await client
      .from(TABLE)
      .delete()
      .eq('event_id', eventId)
      .eq('canonical_service', canonicalService);
    if (error) {
      if (isShapeError(error.code)) {
        return { ok: false, code: 'unavailable', message: 'Preferences are not available yet.' };
      }
      return { ok: false, code: 'db_error', message: error.message };
    }
    return { ok: true };
  }

  const { error } = await client.from(TABLE).upsert(
    {
      event_id: eventId,
      canonical_service: canonicalService,
      attribute_payload: payload ?? {},
      special_request: specialRequest,
      auto_send: autoSend,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'event_id,canonical_service' },
  );
  if (error) {
    if (isShapeError(error.code)) {
      return { ok: false, code: 'unavailable', message: 'Preferences are not available yet.' };
    }
    return { ok: false, code: 'db_error', message: error.message };
  }
  return { ok: true };
}
