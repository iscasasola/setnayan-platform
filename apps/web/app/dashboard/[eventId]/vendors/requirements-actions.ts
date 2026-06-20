'use server';

/**
 * Shortlist per-category requirements — view/edit actions (Phase 1b PR-4).
 *
 * The couple's Shortlist shows a small "saved request" icon on any leaf category
 * that has a saved event_vendor_preferences row. These two actions back that
 * icon's modal:
 *   • loadCategoryRequirements — fetch the leaf's admin multi_select facets +
 *     the couple's saved template, to pre-fill the editor when the icon opens.
 *   • saveCategoryRequirements — persist the edited template via setEventPreference.
 *
 * This is the SAME data the public Inquire pop-up captures (lib/requirements-
 * capture.ts + lib/event-preferences.ts), just reachable from the couple's own
 * shortlist so they can review/update a saved request without re-inquiring.
 *
 * Core/FREE — never gated on Setnayan AI. Reads/writes go through the host-scoped
 * RLS server client: event_vendor_preferences is host-RLS via current_event_ids(),
 * so the couple can only touch their own event's rows. fetchRequirementFields
 * reads the public schema (admin client) to dodge any RLS on the schema table.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getEventPreference,
  setEventPreference,
} from '@/lib/event-preferences';
import {
  fetchRequirementFields,
  isPersistableCanonicalService,
  type RequirementField,
} from '@/lib/requirements-capture';

/** The saved template shape the modal pre-fills from (string[] facets). */
export type SavedRequirementsPayload = {
  payload: Record<string, string[]>;
  specialRequest: string;
  autoSend: boolean;
};

export type LoadCategoryRequirementsResult =
  | {
      status: 'ok';
      fields: RequirementField[];
      saved: SavedRequirementsPayload | null;
    }
  | { status: 'error'; message: string };

export type SaveCategoryRequirementsResult =
  | { status: 'ok' }
  | { status: 'error'; message: string };

/** Normalize a raw attribute_payload into {key: string[]} (drops non-array values). */
function toStringArrayPayload(
  raw: Record<string, unknown> | null | undefined,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!raw) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!Array.isArray(value)) continue;
    const picks = value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
    if (picks.length > 0) out[key] = picks;
  }
  return out;
}

/**
 * Load the leaf's couple-facing facets + the couple's saved template for one
 * (event, canonical_service). Best-effort: a missing schema / no saved row
 * degrades to empty fields / null saved — the modal still renders the note box.
 */
export async function loadCategoryRequirements(
  eventId: string,
  canonicalService: string,
): Promise<LoadCategoryRequirementsResult> {
  const key = (canonicalService ?? '').trim();
  if (!eventId || !key) {
    return { status: 'error', message: 'Missing category.' };
  }
  const supabase = await createClient();
  const admin = createAdminClient();

  const [fields, pref] = await Promise.all([
    // Public schema read via admin (dodges any RLS on the schema table).
    fetchRequirementFields(admin, key),
    // The couple's own row via the host-scoped RLS client.
    getEventPreference(supabase, eventId, key),
  ]);

  const saved: SavedRequirementsPayload | null = pref
    ? {
        payload: toStringArrayPayload(pref.attribute_payload),
        specialRequest: pref.special_request ?? '',
        autoSend: pref.auto_send ?? false,
      }
    : null;

  return { status: 'ok', fields, saved };
}

/**
 * Persist the couple's edited requirements template for one (event, category).
 * Clears the row when the whole template is emptied (setEventPreference handles
 * the delete-vs-upsert decision). Skips gracefully when the leaf has no
 * canonical_service_schemas row (the FK target) — the icon shouldn't have
 * surfaced in that case, but we guard anyway.
 */
export async function saveCategoryRequirements(
  eventId: string,
  canonicalService: string,
  input: {
    payload: Record<string, string[]>;
    specialRequest: string | null;
    autoSend: boolean;
  },
): Promise<SaveCategoryRequirementsResult> {
  const key = (canonicalService ?? '').trim();
  if (!eventId || !key) {
    return { status: 'error', message: 'Missing category.' };
  }
  const supabase = await createClient();
  const admin = createAdminClient();

  // FK safety — the canonical must be a real canonical_service_schemas row.
  const persistable = await isPersistableCanonicalService(admin, key);
  if (!persistable) {
    return { status: 'error', message: 'This category can’t store a saved request yet.' };
  }

  // Sanitize the payload to {key: string[]} so we never persist junk shapes.
  const cleanPayload = toStringArrayPayload(input.payload);

  const result = await setEventPreference(supabase, eventId, key, cleanPayload, {
    specialRequest: input.specialRequest,
    autoSend: input.autoSend === true,
  });

  if (!result.ok) {
    return {
      status: 'error',
      message:
        result.code === 'unavailable'
          ? 'Saved requests aren’t available yet.'
          : 'Could not save your request. Please try again.',
    };
  }

  // The shortlist reads the saved-row set on the server — refresh so the icon
  // appears/disappears immediately after an edit/clear.
  revalidatePath(`/dashboard/${eventId}/vendors`, 'page');
  return { status: 'ok' };
}
