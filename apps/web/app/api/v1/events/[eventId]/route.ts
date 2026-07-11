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

/**
 * GET /api/v1/events/:eventId
 *
 * Bearer-authenticated, scope: events.read. `:eventId` accepts either the
 * UUID `event_id` or the human-friendly `public_id` (E89G-...). Returns the
 * full event row minus internal fields. 404 if the caller is not a member
 * — we never leak the existence of an event the caller can't see.
 */
export async function GET(req: Request, { params }: Params) {
  const auth = await authenticateApiRequest(req);
  if (isAuthError(auth)) return authErrorResponse(auth);

  const scopeError = requireScope(auth, 'events.read');
  if (scopeError) return scopeError;

  const { eventId } = await params;
  if (!eventId) {
    return apiErrorResponse(400, 'invalid_request', 'Missing event id.');
  }

  const admin = createAdminClient();
  const idColumn = isUuid(eventId) ? 'event_id' : 'public_id';

  // Single query — fetch the event and ensure the caller is a member in
  // the same round-trip. The inner-join via event_members narrows the
  // result to events the caller can see.
  const { data, error } = await admin
    .from('events')
    .select(
      `event_id,
       public_id,
       event_type,
       display_name,
       event_date,
       is_primary,
       archived,
       venue_name,
       venue_address,
       geolocation_enabled,
       created_at,
       updated_at,
       event_members!inner ( user_id, member_type )`,
    )
    .eq(idColumn, eventId)
    .eq('event_members.user_id', auth.userId)
    .maybeSingle();

  if (error) {
    return apiErrorResponse(500, 'database_error', error.message);
  }

  if (!data) {
    return apiErrorResponse(404, 'event_not_found', 'Event not found.');
  }

  // Strip the join-only column off the response and surface member_type
  // separately as `caller_role` so consumers know how the caller relates
  // to the event without exposing the full member list.
  const members = Array.isArray(data.event_members) ? data.event_members : [];
  const callerMember = members.find((m: { user_id: string }) => m.user_id === auth.userId);
  const callerRole =
    callerMember && 'member_type' in callerMember
      ? (callerMember as { member_type: string }).member_type
      : null;

  const {
    event_members: _membersField,
    ...event
  } = data as { event_members?: unknown; [k: string]: unknown };
  void _membersField;

  return NextResponse.json(
    {
      data: {
        ...event,
        slug: event.public_id,
        caller_role: callerRole,
      },
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
