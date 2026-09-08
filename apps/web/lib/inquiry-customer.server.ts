import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { regionLabel } from '@/lib/region-source';

/**
 * inquiry-customer.server.ts — the customer facts behind a vendor inquiry.
 *
 * ── WHY THIS FILE NO LONGER MASKS (owner ruling 2026-09-08) ─────────────────
 * This module was `inquiry-mask.server.ts`, the server half of
 * anonymization-until-accept (Glass PR-6b · `Vendor_Inquiry_Anonymization_Spec
 * _2026-07-15`). Pre-accept a vendor saw WHAT the job was but never WHO was
 * asking; accepting revealed it. The retired module's own docblock named the
 * consideration outright: "Accepting (the flat 1-token burn, ₱200) reveals
 * everything — identity is what the token buys."
 *
 * 🔑 THE TOKEN WALLET IS RETIRED (2026-05-11), so nobody buys it any more.
 * Owner, verbatim, 2026-09-08: "we do not need to hide anything, since no more
 * tokens." A supplier now sees the customer on any thread their org owns.
 *
 * The privacy rationale went with it rather than merely being overruled: a
 * `chat_threads` row exists ONLY because the couple chose to contact this
 * supplier. There is no cold-outreach surface here to protect them from — the
 * placeholder was withholding a name from the one supplier they had already
 * written to.
 *
 * ── WHAT STILL GATES THIS ───────────────────────────────────────────────────
 * ⚠ THE READ IS ADMIN-SCOPED AND THEREFORE BYPASSES RLS. A vendor is not an
 * `event_members` row (measured in prod 2026-09-08: an ACCEPTED thread's vendor
 * still had `vendor_is_event_member = 0`), so `public.events` is unreadable to
 * them and no policy will resolve this embed. The gate is the CALLER's, and it
 * is the only gate: every call site must already have proven the calling vendor
 * owns the thread whose `event_id` it passes. Do not widen `events` RLS to
 * vendors instead — that would hand every supplier every couple's event row,
 * which is a far larger grant than the one the owner made.
 */

/** City/area-level label from a region slug — never a venue name or address. */
export function inquiryCityLabel(region: string | null | undefined): string | null {
  return regionLabel(region);
}

/** The customer facts shown on a vendor's inquiry, roster and thread surfaces. */
export type InquiryCustomerFacts = {
  /** The event title, which carries the couple's names ("Cale & Ice"). */
  displayName: string | null;
  eventDate: string | null;
  eventType: string | null;
  /** City/area label — resolved here so callers never re-derive it. */
  city: string | null;
};

/**
 * What a caller renders when the batched read had nothing for this event — a
 * genuinely missing row, not a withheld one. Exported so every surface says "we
 * know nothing" the same obvious way instead of `?? {}`, which silently
 * satisfied an optional shape.
 */
export const INQUIRY_CUSTOMER_UNKNOWN: InquiryCustomerFacts = {
  displayName: null,
  eventDate: null,
  eventType: null,
  city: null,
};

/**
 * Batched, admin-scoped read of the customer facts for a set of inquiries'
 * events. The caller passes the event ids of its OWN vendor threads — see the
 * gating note in this file's header; the admin client is what makes the read
 * possible at all, and the caller's ownership proof is what makes it legitimate.
 *
 * Best-effort: any error → empty map, and the surface falls back to
 * {@link INQUIRY_CUSTOMER_UNKNOWN} rather than breaking the inbox.
 */
export async function fetchInquiryCustomerFacts(
  admin: SupabaseClient,
  eventIds: string[],
): Promise<Map<string, InquiryCustomerFacts>> {
  const out = new Map<string, InquiryCustomerFacts>();
  const ids = Array.from(new Set(eventIds.filter(Boolean)));
  if (ids.length === 0) return out;
  try {
    const { data } = await admin
      .from('events')
      .select('event_id, display_name, event_date, event_type, region')
      .in('event_id', ids);
    const rows = (data ?? []) as Array<{
      event_id: string;
      display_name: string | null;
      event_date: string | null;
      event_type: string | null;
      region: string | null;
    }>;
    for (const row of rows) {
      out.set(row.event_id, {
        displayName: row.display_name,
        eventDate: row.event_date,
        eventType: row.event_type,
        city: regionLabel(row.region),
      });
    }
  } catch {
    // Best-effort — never let customer enrichment break the inbox.
  }
  return out;
}
