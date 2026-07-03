import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * The vendor-facing pipeline stage for one chat thread, shown as a pill in the
 * Customer info rail (PR-3 of the Customer Card respine, design source
 * 03_Strategy/Customer_Card_Prototype_2026-07-03.html · View 1). Mirrors the
 * three buckets on /vendor-dashboard/clients plus the completion handshake:
 *
 *   Delivered — the event_vendors completion handshake is confirmed
 *   Booked    — this org holds a live pool booking for the thread's event
 *   Quoted    — a vendor_proposals row for (vendor, event) is sent/viewed
 *   Inquiry   — none of the above (fresh lead / just accepted)
 *
 * All derivations are cheap, RLS-scoped reads and every one graceful-degrades:
 * a missing migration or thrown query never blocks the thread render — the
 * stage simply falls back toward `Inquiry`.
 */
export type ThreadStage = 'inquiry' | 'quoted' | 'booked' | 'delivered';

export const THREAD_STAGE_LABEL: Record<ThreadStage, string> = {
  inquiry: 'Inquiry',
  quoted: 'Quoted',
  booked: 'Booked',
  delivered: 'Delivered',
};

/**
 * Tailwind tone per stage — cream-card idioms (no raw prototype CSS). Terracotta
 * for the live/booked states, muted ink for the terminal Delivered, warn for the
 * mid-funnel Quoted, a soft neutral for a bare Inquiry.
 */
export const THREAD_STAGE_TONE: Record<ThreadStage, string> = {
  inquiry: 'border-ink/15 bg-ink/[0.04] text-ink/70',
  quoted: 'border-warn-200 bg-warn-50 text-warn-900',
  booked: 'border-terracotta/25 bg-terracotta/10 text-terracotta',
  delivered: 'border-success-200 bg-success-50 text-success-900',
};

type DeriveArgs = {
  /** Request-scoped client — the vendor's own RLS reads vendor_proposals and
   *  the org's pool bookings. */
  supabase: SupabaseClient;
  /** Admin client — completion handshake sits on couple-RLS'd event_vendors. */
  adminClient: SupabaseClient;
  eventId: string;
  vendorProfileId: string;
};

/**
 * Resolve the pipeline stage from a small set of cheap, RLS-scoped reads: the
 * completion handshake row, a live-booking existence probe, and a proposal
 * existence probe. Every one graceful-degrades toward `Inquiry`.
 */
export async function deriveThreadStage({
  supabase,
  adminClient,
  eventId,
  vendorProfileId,
}: DeriveArgs): Promise<ThreadStage> {
  // Delivered — completion handshake confirmed (Event Lifecycle Menu §6.1).
  // event_vendors is couple-RLS'd, so read it via admin AFTER the caller has
  // already gated on thread-ownership (this page does).
  try {
    const { data } = await adminClient
      .from('event_vendors')
      .select('completion_status, customer_confirmed_received_at')
      .eq('event_id', eventId)
      .eq('marketplace_vendor_id', vendorProfileId)
      .maybeSingle();
    const row = data as {
      completion_status: string | null;
      customer_confirmed_received_at: string | null;
    } | null;
    if (
      row &&
      (row.completion_status === 'confirmed' ||
        row.completion_status === 'auto_confirmed' ||
        Boolean(row.customer_confirmed_received_at))
    ) {
      return 'delivered';
    }
  } catch (caught) {
    logQueryError(
      'deriveThreadStage completion (threw)',
      caught instanceof Error ? caught : new Error(String(caught)),
      { event_id: eventId, vendor_profile_id: vendorProfileId },
      'graceful_degrade',
    );
  }

  // Booked — this org holds a live (not-yet-released) pool booking for the
  // event. Same predicate as the Clients page's Booked bucket, scoped to one
  // event so it's a single indexed read on the vendor's own RLS.
  try {
    const { data, error } = await supabase
      .from('vendor_schedule_pool_bookings')
      .select('pool_booking_id')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('event_id', eventId)
      .is('released_at', null)
      .limit(1);
    if (error) {
      logQueryError(
        'deriveThreadStage bookings',
        error,
        { event_id: eventId, vendor_profile_id: vendorProfileId },
        'graceful_degrade',
      );
    } else if ((data ?? []).length > 0) {
      return 'booked';
    }
  } catch (caught) {
    logQueryError(
      'deriveThreadStage bookings (threw)',
      caught instanceof Error ? caught : new Error(String(caught)),
      { event_id: eventId, vendor_profile_id: vendorProfileId },
      'graceful_degrade',
    );
  }

  // Quoted — a proposal for (vendor, event) that's out with the couple. The
  // vendor's own RLS SELECT policy on vendor_proposals covers this read.
  try {
    const { data, error } = await supabase
      .from('vendor_proposals')
      .select('proposal_id')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('event_id', eventId)
      .in('status', ['sent', 'viewed'])
      .limit(1);
    if (error) {
      logQueryError(
        'deriveThreadStage proposals',
        error,
        { event_id: eventId, vendor_profile_id: vendorProfileId },
        'graceful_degrade',
      );
    } else if ((data ?? []).length > 0) {
      return 'quoted';
    }
  } catch (caught) {
    logQueryError(
      'deriveThreadStage proposals (threw)',
      caught instanceof Error ? caught : new Error(String(caught)),
      { event_id: eventId, vendor_profile_id: vendorProfileId },
      'graceful_degrade',
    );
  }

  return 'inquiry';
}
