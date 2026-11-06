import type { SupabaseClient } from '@supabase/supabase-js';
import { reviewState, type CompletionFields, type ReviewState } from '@/lib/completion-handshake';
import { logQueryError } from '@/lib/supabase/error-detect';
import { myPagePath } from '@/lib/supplier-qr-codes';

/**
 * ⭐ THE PRINTED REVIEWS CODE OPENS "LEAVE A REVIEW" (owner 2026-11-06, verbatim pick: "Write a review (Recommended)").
 *
 * A shop's printed Reviews QR (Promote › Prints, `printQrUrl('reviews')`) encodes `/v/<slug>/review`. That address
 * owns no screen of its own — it finds the ONE write flow that already exists, the per-booking
 * `/dashboard/<eventId>/vendors/<vendorId>/review` ("Leave a review"), and sends the couple there:
 *
 *   signed out (or a guest pass)  → /login?next=/v/<slug>/review   (the login page's own `next`, `safeNext`-checked)
 *   a booking with this shop that is ready for a review, on an event the person HOSTS (member_type 'couple' — the
 *     only role `/dashboard/<eventId>` admits) → that booking's review page; several → the most recent event's
 *   no such booking                → the shop's own page at its reviews (`/v/<slug>#reviews`), to read them
 *   a renamed shop address         → the same door on the new address (the ledger `/v/<slug>` already honours)
 *
 * "Ready for a review" = the review page's own handshake (`reviewState`) says `reviewable`, or `awaiting_confirm` —
 * the supplier marked the service done and the review page's FIRST step is the couple's "Yes, received", after which
 * the form opens. `awaiting_vendor` (event not done) and `disputed` are not ready.
 *
 * 🔒 READS ARE HONEST. Every read here binds its error, and a refused read lands on the READ page — never on a 404
 * and never on "no booking" (lib/guests-read-is-honest.test.ts is the pattern). The shop's own page is the one
 * destination that is true whether or not the reads worked.
 *
 * 🔒 lib/shop-review-door.test.ts
 */

export type ReviewDoor =
  | { kind: 'sign_in'; next: string }
  | { kind: 'review'; eventId: string; vendorId: string }
  | { kind: 'moved'; slug: string }
  | { kind: 'read'; slug: string; reason: 'no_booking' | 'missing_shop' | 'read_failed' };

/** The address the printed code encodes, and the one sign-in returns to. */
export function reviewDoorPath(slug: string): string {
  return `${myPagePath(slug)}/review`;
}

/** Where a door lands, as a same-origin path. */
export function reviewDoorTarget(door: ReviewDoor): string {
  switch (door.kind) {
    case 'sign_in':
      return `/login?next=${encodeURIComponent(door.next)}`;
    case 'review':
      return `/dashboard/${encodeURIComponent(door.eventId)}/vendors/${encodeURIComponent(door.vendorId)}/review`;
    case 'moved':
      return reviewDoorPath(door.slug);
    case 'read':
      return `${myPagePath(door.slug)}#reviews`;
  }
}

export type ReviewBookingRow = CompletionFields & {
  vendor_id: string;
  event_id: string;
};

const READY: readonly ReviewState[] = ['reviewable', 'awaiting_confirm'];

/**
 * The booking the code should open, or null. Ready bookings only; the most recent EVENT wins (a couple who booked
 * the same shop twice is reviewing the one that just happened). An undated event sorts last.
 */
export function pickReviewBooking(
  rows: readonly ReviewBookingRow[],
  eventDates: ReadonlyMap<string, string | null>,
  now: number = Date.now(),
): ReviewBookingRow | null {
  const ready = rows.filter((r) => READY.includes(reviewState(r, eventDates.get(r.event_id) ?? null, now)));
  if (!ready.length) return null;
  const at = (r: ReviewBookingRow) => {
    const d = eventDates.get(r.event_id);
    const t = d ? Date.parse(d) : NaN;
    return Number.isFinite(t) ? t : -Infinity;
  };
  return [...ready].sort((a, b) => at(b) - at(a))[0] ?? null;
}

type Clients = {
  /** The signed-in person's client — event membership and bookings are read under THEIR RLS. */
  supabase: SupabaseClient;
  /** Service role — only to resolve the shop's slug, exactly as `/v/[slug]` does (`fetchVendor`). */
  admin: SupabaseClient;
};

/**
 * Decide the door. `userId` null = signed out. `resolveRenamed` is the slug ledger (`resolveRenamedPath(admin, slug,
 * ['vendor'])`), passed in so the decision stays testable without the ledger's own reads.
 */
export async function readReviewDoor(
  { supabase, admin }: Clients,
  slug: string,
  userId: string | null,
  resolveRenamed: (slug: string) => Promise<string | null>,
  now: number = Date.now(),
): Promise<ReviewDoor> {
  const clean = String(slug ?? '').trim();
  if (!userId) return { kind: 'sign_in', next: reviewDoorPath(clean) };

  const failed = (): ReviewDoor => ({ kind: 'read', slug: clean, reason: 'read_failed' });

  try {
    // 1 · The shop, the way the shop page finds it.
    const { data: shop, error: shopError } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, business_slug')
      .ilike('business_slug', clean)
      .maybeSingle();
    if (shopError) {
      logQueryError('shopReviewDoor.shop', shopError, { slug: clean });
      return failed();
    }
    const shopRow = shop as { vendor_profile_id: string; business_slug: string | null } | null;
    if (!shopRow) {
      const movedTo = await resolveRenamed(clean).catch(() => null);
      const newSlug = movedTo?.replace(/^\/+/, '').trim();
      if (newSlug && !newSlug.includes('/')) return { kind: 'moved', slug: newSlug };
      return { kind: 'read', slug: clean, reason: 'missing_shop' };
    }
    const shopSlug = shopRow.business_slug?.trim() || clean;

    // 2 · The events this person HOSTS (the only events whose review page they can open).
    const { data: members, error: membersError } = await supabase
      .from('event_members')
      .select('event_id, events:event_id ( event_id, event_date )')
      .eq('user_id', userId)
      .eq('member_type', 'couple');
    if (membersError) {
      logQueryError('shopReviewDoor.events', membersError, { slug: shopSlug });
      return { kind: 'read', slug: shopSlug, reason: 'read_failed' };
    }
    const eventDates = new Map<string, string | null>();
    for (const m of (members ?? []) as Array<{
      event_id: string;
      events: { event_date: string | null } | Array<{ event_date: string | null }> | null;
    }>) {
      const ev = Array.isArray(m.events) ? m.events[0] : m.events;
      eventDates.set(m.event_id, ev?.event_date ?? null);
    }
    if (!eventDates.size) return { kind: 'read', slug: shopSlug, reason: 'no_booking' };

    // 3 · Their bookings with THIS shop, on those events (the review page's own FK link).
    const { data: bookings, error: bookingsError } = await supabase
      .from('event_vendors')
      .select('vendor_id, event_id, status, completion_status, service_marked_complete_at, customer_confirmed_received_at')
      .eq('marketplace_vendor_id', shopRow.vendor_profile_id)
      .in('event_id', [...eventDates.keys()])
      .is('archived_at', null);
    if (bookingsError) {
      logQueryError('shopReviewDoor.bookings', bookingsError, { slug: shopSlug });
      return { kind: 'read', slug: shopSlug, reason: 'read_failed' };
    }

    const pick = pickReviewBooking((bookings ?? []) as ReviewBookingRow[], eventDates, now);
    if (!pick) return { kind: 'read', slug: shopSlug, reason: 'no_booking' };
    return { kind: 'review', eventId: pick.event_id, vendorId: pick.vendor_id };
  } catch (err) {
    logQueryError('shopReviewDoor.threw', err, { slug: clean });
    return failed();
  }
}
