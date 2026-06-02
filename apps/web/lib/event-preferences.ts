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

/** event_id → { canonical_service → attribute_payload }. */
export type EventPreferenceMap = Record<string, EventPreferencePayload>;

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
    .select('canonical_service, attribute_payload')
    .eq('event_id', eventId);

  if (error) {
    if (isShapeError(error.code)) return {};
    console.warn(`Failed to read event preferences: ${error.message}`);
    return {};
  }

  const map: EventPreferenceMap = {};
  for (const row of data ?? []) {
    const key = (row as { canonical_service?: string }).canonical_service;
    if (typeof key === 'string' && key.length > 0) {
      map[key] =
        ((row as { attribute_payload?: EventPreferencePayload }).attribute_payload ??
          {}) as EventPreferencePayload;
    }
  }
  return map;
}

/**
 * One category's preference payload, or null if none / not-yet-migrated.
 */
export async function getEventPreference(
  client: SupabaseClient,
  eventId: string,
  canonicalService: string,
): Promise<EventPreferencePayload | null> {
  const { data, error } = await client
    .from(TABLE)
    .select('attribute_payload')
    .eq('event_id', eventId)
    .eq('canonical_service', canonicalService)
    .maybeSingle();

  if (error) {
    if (isShapeError(error.code)) return null;
    console.warn(`Failed to read event preference: ${error.message}`);
    return null;
  }
  if (!data) return null;
  return (
    ((data as { attribute_payload?: EventPreferencePayload }).attribute_payload ??
      {}) as EventPreferencePayload
  );
}

/**
 * Upsert (or clear) one category's preference payload.
 *
 * An empty payload (no keys) DELETES the row — the clean representation of
 * "the couple cleared this preference" (so it stops affecting the sort), matching
 * the Personalize-my-matches delete semantics in Vendor_Match_Personalization §6.
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
): Promise<SetEventPreferenceResult> {
  const hasKeys = payload != null && Object.keys(payload).length > 0;

  if (!hasKeys) {
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
      attribute_payload: payload,
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
