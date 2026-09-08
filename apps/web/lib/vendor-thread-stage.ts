import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * The vendor-facing pipeline stage for one chat thread, shown as a pill in the
 * Customer info rail (PR-3 of the Customer Card respine) and echoed on
 * /vendor-dashboard/clients.
 *
 *   Completed — the job is finished and both sides say so
 *   Cancelled — the conversation ended without one
 *   Booked    — this org holds a live pool booking for the thread's event
 *   Quoted    — a vendor_proposals row for (vendor, event) is sent/viewed
 *   Inquiry   — none of the above (fresh lead / just accepted)
 *
 * ── THE STAGE IS DERIVED AND READ-ONLY (owner decision, do not re-ask) ───────
 * The supplier moves it by DOING the thing — sending a quote, holding a date,
 * finishing the job — never by picking from a menu. That is what stops the pill
 * ever saying Booked while no booking exists.
 *
 * ── ⚠ WHY "COMPLETED" IS NOT `event_vendors.status = 'complete'` ────────────
 * The build plan for this rung named that value. **Measured against production
 * 2026-09-09 before building it: nothing writes it.** Not one application
 * writer exists anywhere in `app/` or `lib/`, and the only mentions in the
 * migrations are read predicates plus one legacy backfill. Prod holds
 * `considering=33 · contracted=10 · deposit_paid=3` and **zero** rows at
 * `delivered` or `complete`. A rung keyed on it would have been the sixth
 * "gate with no handle" — shipped, correct-looking, and unreachable forever.
 *
 * What IS reachable, and is therefore what this reads:
 *   • `completion_status` `confirmed` / `auto_confirmed`, or
 *     `customer_confirmed_received_at` — the completion handshake. In use:
 *     prod holds `awaiting_vendor=45 · confirmed=1`.
 *   • `status` `delivered` / `complete` — written by the couple-side auto-flip
 *     24h after the event (`app/dashboard/[eventId]/vendors/page.tsx`) and by
 *     the legacy backfill. Kept in the predicate so that path lands here too.
 *
 * 🔑 SO THIS IS A RELABEL PLUS A WIDENING, NOT A NEW RUNG — and saying that out
 * loud matters, because the plan argued the opposite from an enum that has the
 * value. An enum having a value is not evidence anything can produce it.
 *
 * All derivations are cheap, RLS-scoped reads and every one graceful-degrades:
 * a missing migration or thrown query never blocks the thread render — the
 * stage simply falls back toward `Inquiry`.
 */
export type ThreadStage = 'inquiry' | 'quoted' | 'booked' | 'completed' | 'cancelled';

export const THREAD_STAGE_LABEL: Record<ThreadStage, string> = {
  inquiry: 'Inquiry',
  quoted: 'Quoted',
  booked: 'Booked',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/**
 * Tailwind tone per stage — cream-card idioms (no raw prototype CSS). Terracotta
 * for the live/booked state, success for the finished one, warn for the
 * mid-funnel Quoted, a soft neutral for a bare Inquiry.
 *
 * ⚖ CANCELLED IS GREY, NOT RED. Most of the ways a thread reaches it are
 * ordinary — the couple chose somebody else, the ask timed out, the supplier
 * was not free. Painting a normal outcome as an error tells a supplier they did
 * something wrong on a day they did not.
 */
export const THREAD_STAGE_TONE: Record<ThreadStage, string> = {
  inquiry: 'border-ink/15 bg-ink/[0.04] text-ink/70',
  quoted: 'border-warn-200 bg-warn-50 text-warn-900',
  booked: 'border-terracotta/25 bg-terracotta/10 text-terracotta',
  completed: 'border-success-200 bg-success-50 text-success-900',
  cancelled: 'border-ink/12 bg-ink/[0.02] text-ink/45',
};

/**
 * Every `chat_threads.inquiry_status` that means this conversation is over
 * without a booking. The enum's remaining values are `pending` and `accepted`,
 * both of which are live.
 */
export const CANCELLED_INQUIRY_STATUSES = [
  'declined',
  'withdrawn',
  'expired',
  'displaced',
] as const;

export function isCancelledInquiryStatus(status: string | null | undefined): boolean {
  return (CANCELLED_INQUIRY_STATUSES as readonly string[]).includes(status ?? '');
}

/** What the stage is decided from. Four independent facts, one ordering. */
export type ThreadStageFacts = {
  /** The completion handshake is settled, or the booking reached delivered. */
  completed: boolean;
  /** A live, not-yet-released pool booking for this event. */
  booked: boolean;
  /** A proposal is out with the couple (sent / viewed — not a draft). */
  quoted: boolean;
  /** The thread itself ended: declined · withdrawn · expired · displaced. */
  cancelled: boolean;
};

/**
 * THE ONE PLACE THE LADDER IS ORDERED.
 *
 * Three mechanisms already track a thread's state — `chat_threads.
 * inquiry_status`, `event_vendors.status` and `inquiry_outcomes.outcome` — and
 * none of them spells this ladder alone. A fourth definition of the ordering is
 * the exact failure this repo keeps producing, so both surfaces gather their
 * own facts (one query per thread, or one batched query per list) and hand them
 * to this pure function.
 *
 * ⚖ WHY CANCELLED SITS BELOW BOOKED AND ABOVE QUOTED. A live booking is a fact
 * about a held date and money that has moved; a thread status is a fact about a
 * conversation, and the two can disagree — so the booking wins. But a quote
 * sent into a conversation that has since ended is not a live quote, so
 * cancelled outranks quoted. Completed outranks everything: a finished job
 * stays finished however the thread was later filed.
 */
export function resolveThreadStage(facts: ThreadStageFacts): ThreadStage {
  if (facts.completed) return 'completed';
  if (facts.booked) return 'booked';
  if (facts.cancelled) return 'cancelled';
  if (facts.quoted) return 'quoted';
  return 'inquiry';
}

type DeriveArgs = {
  /** Request-scoped client — the vendor's own RLS reads vendor_proposals and
   *  the org's pool bookings. */
  supabase: SupabaseClient;
  /** Admin client — completion handshake sits on couple-RLS'd event_vendors. */
  adminClient: SupabaseClient;
  eventId: string;
  vendorProfileId: string;
  /**
   * `chat_threads.inquiry_status` for THIS thread — the only fact of the four
   * that is about the conversation rather than the booking, and the reason this
   * function needed a fifth argument at all. Omitted, a thread that was
   * declined or withdrawn keeps reading as a live `Inquiry`.
   */
  inquiryStatus?: string | null;
};

/**
 * Is this booking finished? The one predicate, so the thread pill and the
 * clients list cannot answer it differently — the list asks it of many rows in
 * one batched read and passes each row through here.
 *
 * ⚠ `status` is in it because the couple-side auto-flip 24h after the event
 * writes `delivered` there and touches no handshake column; the handshake
 * covers the case where the two sides settle it between themselves.
 */
export function rowReadsCompleted(row: {
  completion_status?: string | null;
  customer_confirmed_received_at?: string | null;
  status?: string | null;
} | null): boolean {
  if (!row) return false;
  return (
    row.completion_status === 'confirmed' ||
    row.completion_status === 'auto_confirmed' ||
    Boolean(row.customer_confirmed_received_at) ||
    row.status === 'delivered' ||
    row.status === 'complete'
  );
}

/**
 * Resolve the pipeline stage from a small set of cheap, RLS-scoped reads: the
 * completion row, a live-booking existence probe, and a proposal existence
 * probe — plus the thread's own status, which is passed in. Every read
 * graceful-degrades toward `Inquiry`.
 *
 * 🔑 THE READS STILL SHORT-CIRCUIT, BUT THE ORDERING NO LONGER LIVES HERE.
 * Each probe stops the moment it has decided, so a completed booking costs one
 * query exactly as before; what changed is that the ranking is
 * `resolveThreadStage`'s, shared with the list.
 */
export async function deriveThreadStage({
  supabase,
  adminClient,
  eventId,
  vendorProfileId,
  inquiryStatus,
}: DeriveArgs): Promise<ThreadStage> {
  const cancelled = isCancelledInquiryStatus(inquiryStatus);

  // Completed — the handshake settled, or the booking reached delivered.
  // event_vendors is couple-RLS'd, so read it via admin AFTER the caller has
  // already gated on thread-ownership (this page does).
  try {
    const { data } = await adminClient
      .from('event_vendors')
      .select('completion_status, customer_confirmed_received_at, status')
      .eq('event_id', eventId)
      .eq('marketplace_vendor_id', vendorProfileId)
      .maybeSingle();
    if (
      rowReadsCompleted(
        data as {
          completion_status: string | null;
          customer_confirmed_received_at: string | null;
          status: string | null;
        } | null,
      )
    ) {
      return resolveThreadStage({ completed: true, booked: false, quoted: false, cancelled });
    }
  } catch (caught) {
    logQueryError(
      'deriveThreadStage completed (threw)',
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
      return resolveThreadStage({ completed: false, booked: true, quoted: false, cancelled });
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
      return resolveThreadStage({ completed: false, booked: false, quoted: true, cancelled });
    }
  } catch (caught) {
    logQueryError(
      'deriveThreadStage proposals (threw)',
      caught instanceof Error ? caught : new Error(String(caught)),
      { event_id: eventId, vendor_profile_id: vendorProfileId },
      'graceful_degrade',
    );
  }

  return resolveThreadStage({ completed: false, booked: false, quoted: false, cancelled });
}
