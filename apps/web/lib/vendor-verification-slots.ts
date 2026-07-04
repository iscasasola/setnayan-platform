import {
  DOC_SLOTS,
  SOCIAL_PLATFORM_KEYS,
  detectSocialPlatform,
  isFilledReference,
  type ClientReference,
  type DocUpload,
} from '@/lib/vendor-verification';

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
 * The JSONB shape persisted for one doc slot. Aliases the shared `DocUpload`
 * union so a built value slots straight into a `DocUploadMap` — either a
 * single-object value (file ref / social map / meet timestamp) or an ARRAY
 * value (portfolio refs, structured client references). Null clears the slot.
 */
export type SlotValue = DocUpload;

/**
 * Build the JSONB value persisted for one doc slot. Owner 2026-07-03 field
 * redesign — three vendor slots outgrew the "one file / one URL" model:
 *
 *   • portfolio_samples  → an ARRAY of R2 refs (`portfolioRefs`, up to 10).
 *   • client_references  → an ARRAY of structured entries (`references`, up to
 *     5) — name · contact number · event · date.
 *   • social_media       → a MAP of platform → link (`social`). A legacy single
 *     `fields.url` still works: it maps onto its detected platform (else
 *     Website), so open-shop seeding and the old /verify flow keep passing just
 *     `{ url }`.
 *
 * Every remaining slot stores a single R2 ref exactly as before. The three new
 * params are OPTIONAL, so callers that don't set them (old /verify upload,
 * open-shop) compile + behave unchanged. Returns null for a blank submission
 * (→ the slot stays incomplete).
 */
export function buildSlotValue(
  slotKey: string,
  fields: {
    r2Ref: string | null;
    url: string | null;
    scheduledAt: string | null;
    /** Structured client references (client_references slot). */
    references?: ClientReference[];
    /** Platform → link map (social_media slot). */
    social?: Record<string, string>;
    /** Ordered R2 refs (portfolio_samples slot). */
    portfolioRefs?: string[];
  },
): SlotValue {
  const now = new Date().toISOString();

  if (slotKey === 'social_media') {
    const map: Record<string, string> = {};
    // Modern per-platform map — only keep known, non-empty platforms.
    if (fields.social) {
      for (const [key, raw] of Object.entries(fields.social)) {
        if (!SOCIAL_PLATFORM_KEYS.has(key)) continue;
        const v = typeof raw === 'string' ? raw.trim() : '';
        if (v) map[key] = v;
      }
    }
    // Legacy single URL — place it on its detected platform (else Website).
    // Doesn't overwrite an explicit per-platform value.
    if (fields.url) {
      const target = detectSocialPlatform(fields.url) ?? 'website';
      if (!map[target]) map[target] = fields.url;
    }
    if (Object.keys(map).length === 0) return null;
    return { ...map, updated_at: now };
  }

  if (slotKey === 'client_references') {
    const refs = (fields.references ?? []).filter(isFilledReference).map((r) => ({
      name: r.name.trim(),
      contact_number: r.contact_number.trim(),
      event: r.event.trim(),
      date: r.date.trim(),
    }));
    if (refs.length === 0) return null;
    return refs;
  }

  if (slotKey === 'portfolio_samples') {
    const refs = (fields.portfolioRefs ?? [])
      .map((r) => (typeof r === 'string' ? r.trim() : ''))
      .filter((r) => r.length > 0);
    // Fall back to the single-file `r2Ref` when no explicit array was passed —
    // keeps the old /verify single-upload path working for this slot.
    if (refs.length === 0) {
      if (!fields.r2Ref) return null;
      return [{ r2_key: fields.r2Ref, uploaded_at: now }];
    }
    return refs.map((ref) => ({ r2_key: ref, uploaded_at: now }));
  }

  if (slotKey === 'google_meet') {
    if (!fields.scheduledAt) return null;
    return { scheduled_at: fields.scheduledAt };
  }
  // Default: every other slot persists a single R2 ref.
  if (!fields.r2Ref) return null;
  return { r2_key: fields.r2Ref, uploaded_at: now };
}
