import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  apiErrorResponse,
  authenticateApiRequest,
  authErrorResponse,
  isAuthError,
  requireScope,
} from '@/lib/api-auth';
import { logQueryError } from '@/lib/supabase/error-detect';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

type EventRow = {
  event_id: string;
  public_id: string;
  display_name: string;
  event_date: string | null;
  venue_name: string | null;
  created_at: string;
};

/**
 * GET /api/v1/events
 *
 * Bearer-authenticated, scope: events.read. Lists the events the calling
 * user is a member of (via event_members). RLS would normally scope this,
 * but the route uses the admin client and applies the user_id filter on
 * event_members explicitly — equivalent semantics, no auth.uid() needed.
 *
 * Pagination: cursor-based via the event public_id. The cursor of the
 * last row in a page becomes `next_cursor`; passing it as `?cursor=` on
 * the follow-up request resumes after that row. Ordering is by
 * created_at DESC, public_id DESC as a tiebreaker.
 *
 * Note: events.slug doesn't exist in V1 — public_id is the slug-equivalent
 * stable identifier ("E89G-..."). We surface public_id under the `slug`
 * field too so consumers have one canonical key.
 */
export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req);
  if (isAuthError(auth)) return authErrorResponse(auth);

  const scopeError = requireScope(auth, 'events.read');
  if (scopeError) return scopeError;

  const url = new URL(req.url);
  const limit = clampLimit(url.searchParams.get('limit'));
  const cursor = url.searchParams.get('cursor');

  const admin = createAdminClient();

  // Step 1: get the event_ids this user is a member of. Cheap because
  // event_members has a per-user index.
  const { data: memberships, error: memberErr } = await admin
    .from('event_members')
    .select('event_id')
    .eq('user_id', auth.userId);

  if (memberErr) {
    // Sanitize → public API never returns raw Postgres error messages. Full
    // detail goes to Sentry + Vercel Functions via logQueryError. Pre-pilot
    // audit cleanup 2026-05-30.
    logQueryError('GET /api/v1/events (event_members)', memberErr, {
      user_id: auth.userId,
    });
    return apiErrorResponse(
      500,
      'database_error',
      'Events could not load right now. Try again in a moment.',
    );
  }

  const eventIds = Array.from(new Set((memberships ?? []).map((m) => m.event_id)));
  if (eventIds.length === 0) {
    return jsonResponse({ data: [], next_cursor: null });
  }

  // Step 2: page through events. We over-fetch by one row so we can tell
  // whether another page exists without a second count() query.
  let query = admin
    .from('events')
    .select('event_id, public_id, display_name, event_date, venue_name, created_at')
    .in('event_id', eventIds)
    .eq('archived', false)
    .order('created_at', { ascending: false })
    .order('public_id', { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    // Find the cursor row's created_at so we can resume after it. The
    // cursor format is opaque — we don't promise it stays public_id.
    const { data: cursorRow } = await admin
      .from('events')
      .select('created_at, public_id')
      .eq('public_id', cursor)
      .maybeSingle();

    if (cursorRow) {
      // (created_at, public_id) < (cursorRow.created_at, cursorRow.public_id)
      // expressed with .or() because supabase-js doesn't have a row-value
      // comparison helper.
      query = query.or(
        `created_at.lt.${cursorRow.created_at},and(created_at.eq.${cursorRow.created_at},public_id.lt.${cursorRow.public_id})`,
      );
    }
  }

  const { data: events, error: eventsErr } = await query;
  if (eventsErr) {
    logQueryError('GET /api/v1/events (events)', eventsErr, {
      user_id: auth.userId,
    });
    return apiErrorResponse(
      500,
      'database_error',
      'Events could not load right now. Try again in a moment.',
    );
  }

  const rows = (events ?? []) as EventRow[];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (pageRows[pageRows.length - 1]?.public_id ?? null) : null;

  return jsonResponse({
    data: pageRows.map((r) => ({
      event_id: r.event_id,
      public_id: r.public_id,
      display_name: r.display_name,
      event_date: r.event_date,
      // V1 has no separate slug column — surface public_id under both keys
      // so future migration to a real slug doesn't break the field name.
      slug: r.public_id,
      venue_name: r.venue_name,
      created_at: r.created_at,
    })),
    next_cursor: nextCursor,
  });
}

function clampLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function jsonResponse(body: unknown): NextResponse {
  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
