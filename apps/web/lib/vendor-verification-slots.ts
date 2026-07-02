import { DOC_SLOTS } from '@/lib/vendor-verification';

/**
 * Shared doc-slot write helpers for the vendor verification checklist.
 *
 * Extracted 2026-07-02 so the redirecting `/verify` upload action AND the new
 * non-redirecting inline My-Shop upload action merge a saved slot value the SAME
 * way — the logic used to live privately in `verify/actions.ts`. Plain module
 * (NOT 'use server') so it can export non-action values.
 */

/** Every valid slot key — the allowlist guarding an incoming `slot_key`. */
export const DOC_SLOT_KEYS: ReadonlySet<string> = new Set(DOC_SLOTS.map((s) => s.key));

/**
 * Build the JSONB value persisted for one doc slot. File slots store an R2 ref;
 * `social_media` stores a URL; `google_meet` stores a scheduled timestamp.
 * Returns null for a blank submission (→ the slot stays incomplete).
 */
export function buildSlotValue(
  slotKey: string,
  fields: {
    r2Ref: string | null;
    url: string | null;
    scheduledAt: string | null;
  },
): Record<string, unknown> | null {
  const now = new Date().toISOString();

  if (slotKey === 'social_media') {
    if (!fields.url) return null;
    return { url: fields.url, updated_at: now };
  }
  if (slotKey === 'google_meet') {
    if (!fields.scheduledAt) return null;
    return { scheduled_at: fields.scheduledAt };
  }
  // Default: every other slot persists an R2 ref.
  if (!fields.r2Ref) return null;
  return { r2_key: fields.r2Ref, uploaded_at: now };
}
