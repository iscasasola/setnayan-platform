import { createAdminClient } from '@/lib/supabase/admin';
import {
  apiErrorResponse,
  authenticateApiRequest,
  authErrorResponse,
  isAuthError,
  requireScope,
} from '@/lib/api-auth';
import { MAX_LIMIT, vendorJson } from '@/lib/api-vendor';
import { logQueryError } from '@/lib/supabase/error-detect';

type BlockRow = {
  blocked_at: string;
  blocked_until: string | null;
  block_source: string | null;
  is_private: boolean | null;
  setnayan_booking_id: string | null;
};

type DayStateRow = {
  state_date: string;
  day_state: string | null;
};

/** Basic YYYY-MM-DD / ISO-ish guard so a junk `?from=` can't break the query. */
function safeDate(raw: string | null): string | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : raw;
}

/**
 * GET /api/v1/vendor/availability?from=&to=
 *
 * Bearer-authenticated · scope vendor.availability.read. Returns the calling
 * vendor's OWN calendar as busy blocks + day states, for two-way availability
 * sync. A WINDOWED read (pass from/to to bound it), newest-window first.
 *
 * PRIVACY: block free-text that can name a client (block_label, client_name,
 * client_contact, client_note) is never selected. A Setnayan-originated block
 * reduces to a boolean `setnayan_originated` (never the booking id, which
 * re-identifies the couple). Private blocks collapse to source: "private".
 */
export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req);
  if (isAuthError(auth)) return authErrorResponse(auth);
  const scopeError = requireScope(auth, 'vendor.availability.read');
  if (scopeError) return scopeError;

  const url = new URL(req.url);
  const from = safeDate(url.searchParams.get('from'));
  const to = safeDate(url.searchParams.get('to'));

  const admin = createAdminClient();
  const vendorProfileId = auth.vendorProfileId;

  let blockQuery = admin
    .from('vendor_calendar_blocks')
    .select('blocked_at, blocked_until, block_source, is_private, setnayan_booking_id')
    .eq('vendor_profile_id', vendorProfileId)
    .order('blocked_at', { ascending: true })
    .limit(MAX_LIMIT);
  // Overlap window: a block that ends after `from` and starts before `to`.
  if (from) blockQuery = blockQuery.gte('blocked_until', from);
  if (to) blockQuery = blockQuery.lte('blocked_at', to);

  const { data: blocks, error: blocksErr } = await blockQuery;
  if (blocksErr) {
    logQueryError('GET /api/v1/vendor/availability (blocks)', blocksErr, {
      vendor_profile_id: vendorProfileId,
    });
    return apiErrorResponse(500, 'database_error', 'Availability could not load right now. Try again in a moment.');
  }

  let dayQuery = admin
    .from('vendor_calendar_day_states')
    .select('state_date, day_state')
    .eq('vendor_profile_id', vendorProfileId)
    .order('state_date', { ascending: true })
    .limit(MAX_LIMIT);
  if (from) dayQuery = dayQuery.gte('state_date', from);
  if (to) dayQuery = dayQuery.lte('state_date', to);

  const { data: dayStates, error: dayErr } = await dayQuery;
  if (dayErr) {
    logQueryError('GET /api/v1/vendor/availability (day_states)', dayErr, {
      vendor_profile_id: vendorProfileId,
    });
    return apiErrorResponse(500, 'database_error', 'Availability could not load right now. Try again in a moment.');
  }

  return vendorJson({
    blocks: ((blocks ?? []) as BlockRow[]).map((b) => ({
      start: b.blocked_at,
      end: b.blocked_until,
      busy: true,
      source: b.is_private ? 'private' : b.block_source,
      setnayan_originated: b.setnayan_booking_id != null,
    })),
    day_states: ((dayStates ?? []) as DayStateRow[]).map((d) => ({
      date: d.state_date,
      state: d.day_state,
    })),
  });
}
