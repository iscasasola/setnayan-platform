import { createAdminClient } from '@/lib/supabase/admin';
import {
  apiErrorResponse,
  authenticateApiRequest,
  authErrorResponse,
  isAuthError,
  requireScope,
} from '@/lib/api-auth';
import { clampLimit, vendorJson } from '@/lib/api-vendor';
import { logQueryError } from '@/lib/supabase/error-detect';

// The BOOKED funnel stages (vendor_status enum). 'considering'/'shortlisted' are
// pre-commitment and excluded — a booking is a contract or beyond.
const BOOKED_STATUSES = ['contracted', 'deposit_paid', 'delivered', 'complete'];

type BookingRow = {
  public_id: string;
  event_id: string;
  category: string | null;
  status: string;
  completion_status: string | null;
  contract_signed_at: string | null;
  service_marked_complete_at: string | null;
  customer_confirmed_received_at: string | null;
  created_at: string;
};

type EventDateRow = { event_id: string; event_date: string | null };

/**
 * GET /api/v1/vendor/bookings?limit=&cursor=
 *
 * Bearer-authenticated · scope vendor.bookings.read. Lists the calling vendor's
 * CONFIRMED bookings — event_vendors rows in a booked status, linked to this
 * shop via marketplace_vendor_id. Newest first.
 *
 * event_vendors has NO vendor-facing RLS (it is the couple's private planning
 * row), so scoping here is the explicit `.eq('marketplace_vendor_id', …)` filter
 * on the admin client. The column allowlist HARD-EXCLUDES every couple-private
 * field: all money (total_cost_php, deposit_paid_php, transport_php,
 * food_allowance_php, pax_surcharge_php, deposit_proof_url), notes, and the
 * couple's contact details. We return the booking lifecycle + event date only.
 */
export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req);
  if (isAuthError(auth)) return authErrorResponse(auth);
  const scopeError = requireScope(auth, 'vendor.bookings.read');
  if (scopeError) return scopeError;

  const url = new URL(req.url);
  const limit = clampLimit(url.searchParams.get('limit'));
  const cursor = url.searchParams.get('cursor');

  const admin = createAdminClient();
  const vendorProfileId = auth.vendorProfileId;

  let query = admin
    .from('event_vendors')
    .select(
      'public_id, event_id, category, status, completion_status, contract_signed_at, service_marked_complete_at, customer_confirmed_received_at, created_at',
    )
    .eq('marketplace_vendor_id', vendorProfileId)
    .in('status', BOOKED_STATUSES)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (cursor) query = query.lt('created_at', cursor);

  const { data, error } = await query;
  if (error) {
    logQueryError('GET /api/v1/vendor/bookings', error, { vendor_profile_id: vendorProfileId });
    return apiErrorResponse(500, 'database_error', 'Bookings could not load right now. Try again in a moment.');
  }

  const rows = (data ?? []) as BookingRow[];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (pageRows[pageRows.length - 1]?.created_at ?? null) : null;

  const eventIds = Array.from(new Set(pageRows.map((r) => r.event_id)));
  const dateByEvent = new Map<string, string | null>();
  if (eventIds.length > 0) {
    const { data: events } = await admin
      .from('events')
      .select('event_id, event_date')
      .in('event_id', eventIds);
    for (const e of (events ?? []) as EventDateRow[]) {
      dateByEvent.set(e.event_id, e.event_date);
    }
  }

  return vendorJson({
    data: pageRows.map((r) => ({
      public_id: r.public_id,
      event_id: r.event_id,
      event_date: dateByEvent.get(r.event_id) ?? null,
      category: r.category,
      status: r.status,
      completion_status: r.completion_status,
      contract_signed_at: r.contract_signed_at,
      completed_at: r.service_marked_complete_at,
      confirmed_received_at: r.customer_confirmed_received_at,
      created_at: r.created_at,
    })),
    next_cursor: nextCursor,
  });
}
