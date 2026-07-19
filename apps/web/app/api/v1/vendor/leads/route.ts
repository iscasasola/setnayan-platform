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

type ThreadRow = {
  public_id: string;
  event_id: string;
  inquiry_status: string;
  created_at: string;
  accepted_at: string | null;
  pax_at_inquiry: number | null;
  pax_current: number | null;
  vendor_first_reply_at: string | null;
  thread_id: string;
};

type InterestRow = {
  thread_id: string;
  category_key: string | null;
  status: string | null;
};

type EventDateRow = { event_id: string; event_date: string | null };

/**
 * GET /api/v1/vendor/leads?limit=&cursor=
 *
 * Bearer-authenticated · scope vendor.leads.read. Lists the calling vendor's
 * inbound couple inquiries (a lead = a chat_threads row) that are still active
 * — inquiry_status pending or accepted. Newest first.
 *
 * DISCLOSURE LADDER (matches get_vendor_event_brief's inquiry stage): a lead
 * carries the requested services, the couple's pax count, and the EVENT DATE
 * only. It deliberately withholds every couple contact detail (name / email /
 * phone) and the venue — those live inside the accepted chat thread, never in
 * the lead feed. event_id is an opaque correlation key (same value the bookings
 * feed uses), not PII.
 */
export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req);
  if (isAuthError(auth)) return authErrorResponse(auth);
  const scopeError = requireScope(auth, 'vendor.leads.read');
  if (scopeError) return scopeError;

  const url = new URL(req.url);
  const limit = clampLimit(url.searchParams.get('limit'));
  const cursor = url.searchParams.get('cursor');

  const admin = createAdminClient();
  const vendorProfileId = auth.vendorProfileId;

  let query = admin
    .from('chat_threads')
    .select(
      'thread_id, public_id, event_id, inquiry_status, created_at, accepted_at, pax_at_inquiry, pax_current, vendor_first_reply_at',
    )
    .eq('vendor_profile_id', vendorProfileId)
    .in('inquiry_status', ['pending', 'accepted'])
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (cursor) query = query.lt('created_at', cursor);

  const { data, error } = await query;
  if (error) {
    logQueryError('GET /api/v1/vendor/leads', error, { vendor_profile_id: vendorProfileId });
    return apiErrorResponse(500, 'database_error', 'Leads could not load right now. Try again in a moment.');
  }

  const rows = (data ?? []) as ThreadRow[];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (pageRows[pageRows.length - 1]?.created_at ?? null) : null;

  const threadIds = pageRows.map((r) => r.thread_id);
  const eventIds = Array.from(new Set(pageRows.map((r) => r.event_id)));

  // Requested services per thread (safe: category + ask-status only).
  const interestsByThread = new Map<string, Array<{ category: string | null; status: string | null }>>();
  if (threadIds.length > 0) {
    const { data: interests } = await admin
      .from('thread_service_interests')
      .select('thread_id, category_key, status')
      .in('thread_id', threadIds);
    for (const i of (interests ?? []) as InterestRow[]) {
      const list = interestsByThread.get(i.thread_id) ?? [];
      list.push({ category: i.category_key, status: i.status });
      interestsByThread.set(i.thread_id, list);
    }
  }

  // Event DATE only — never venue (inquiry-stage disclosure).
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
      inquiry_status: r.inquiry_status,
      pax: r.pax_current ?? r.pax_at_inquiry ?? null,
      requested_services: interestsByThread.get(r.thread_id) ?? [],
      created_at: r.created_at,
      accepted_at: r.accepted_at,
      first_replied_at: r.vendor_first_reply_at,
    })),
    next_cursor: nextCursor,
  });
}
