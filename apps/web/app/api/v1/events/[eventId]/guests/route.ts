import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  apiErrorResponse,
  authenticateApiRequest,
  authErrorResponse,
  isAuthError,
  requireScope,
} from '@/lib/api-auth';

type Params = { params: Promise<{ eventId: string }> };

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

type GuestRow = {
  guest_id: string;
  public_id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  side: string;
  role: string;
  rsvp_status: string;
  created_at: string;
};

type SeatRow = {
  guest_id: string;
  table_id: string;
};

/**
 * GET /api/v1/events/:eventId/guests
 *
 * Bearer-authenticated, scope: guests.read. Returns the active (non-deleted)
 * guest list for the event with RSVP status, role, and current table
 * assignment. Caller must be a member of the event — 404 otherwise.
 *
 * Cursor pagination is keyed off the guest's public_id (which is unique
 * and stable). Ordering matches the dashboard: created_at ASC, public_id ASC.
 */
export async function GET(req: Request, { params }: Params) {
  const auth = await authenticateApiRequest(req);
  if (isAuthError(auth)) return authErrorResponse(auth);

  const scopeError = requireScope(auth, 'guests.read');
  if (scopeError) return scopeError;

  const { eventId } = await params;
  if (!eventId) {
    return apiErrorResponse(400, 'invalid_request', 'Missing event id.');
  }

  const url = new URL(req.url);
  const limit = clampLimit(url.searchParams.get('limit'));
  const cursor = url.searchParams.get('cursor');

  const admin = createAdminClient();

  // Resolve the supplied id to the canonical UUID + check membership in
  // one round-trip. We require the caller to be in event_members for this
  // event — if not, 404 (don't leak existence).
  const idColumn = isUuid(eventId) ? 'event_id' : 'public_id';
  const { data: eventLookup, error: lookupErr } = await admin
    .from('events')
    .select('event_id, event_members!inner(user_id)')
    .eq(idColumn, eventId)
    .eq('event_members.user_id', auth.userId)
    .maybeSingle();

  if (lookupErr) {
    return apiErrorResponse(500, 'database_error', lookupErr.message);
  }

  if (!eventLookup) {
    return apiErrorResponse(404, 'event_not_found', 'Event not found.');
  }

  const eventUuid = (eventLookup as { event_id: string }).event_id;

  let query = admin
    .from('guests')
    .select(
      'guest_id, public_id, first_name, last_name, display_name, side, role, rsvp_status, created_at',
    )
    .eq('event_id', eventUuid)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .order('public_id', { ascending: true })
    .limit(limit + 1);

  if (cursor) {
    const { data: cursorRow } = await admin
      .from('guests')
      .select('created_at, public_id')
      .eq('public_id', cursor)
      .eq('event_id', eventUuid)
      .maybeSingle();

    if (cursorRow) {
      query = query.or(
        `created_at.gt.${cursorRow.created_at},and(created_at.eq.${cursorRow.created_at},public_id.gt.${cursorRow.public_id})`,
      );
    }
  }

  const { data: guests, error: guestsErr } = await query;
  if (guestsErr) {
    return apiErrorResponse(500, 'database_error', guestsErr.message);
  }

  const guestRows = (guests ?? []) as GuestRow[];
  const hasMore = guestRows.length > limit;
  const pageRows = hasMore ? guestRows.slice(0, limit) : guestRows;

  // Fetch seat assignments for just the visible page — keeps the payload
  // small even for events with thousands of guests. event_seat_assignments
  // is keyed by (event_id, guest_id) so an `.in` filter is fast.
  const guestIds = pageRows.map((g) => g.guest_id);
  let seatMap = new Map<string, string>();
  if (guestIds.length > 0) {
    const { data: seats } = await admin
      .from('event_seat_assignments')
      .select('guest_id, table_id')
      .eq('event_id', eventUuid)
      .in('guest_id', guestIds);
    seatMap = new Map(((seats ?? []) as SeatRow[]).map((s) => [s.guest_id, s.table_id]));
  }

  const nextCursor = hasMore ? (pageRows[pageRows.length - 1]?.public_id ?? null) : null;

  return NextResponse.json(
    {
      data: pageRows.map((g) => ({
        guest_id: g.guest_id,
        public_id: g.public_id,
        first_name: g.first_name,
        last_name: g.last_name,
        display_name: g.display_name,
        side: g.side,
        role: g.role,
        rsvp_status: g.rsvp_status,
        table_id: seatMap.get(g.guest_id) ?? null,
      })),
      next_cursor: nextCursor,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8',
      },
    },
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function clampLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}
