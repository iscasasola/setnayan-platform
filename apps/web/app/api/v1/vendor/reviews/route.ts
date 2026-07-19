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

type ReviewRow = {
  public_id: string;
  rating_overall: number | null;
  rating_communication: number | null;
  rating_quality: number | null;
  rating_value: number | null;
  rating_on_time: number | null;
  body: string | null;
  vendor_reply: string | null;
  vendor_reply_at: string | null;
  booked_through_setnayan: boolean | null;
  created_at: string;
  voided_by_fraud: unknown;
};

/**
 * GET /api/v1/vendor/reviews?limit=&cursor=
 *
 * Bearer-authenticated · scope vendor.reviews.read. Lists the reviews on the
 * calling vendor's business — ratings (5 axes), body, and the vendor's own
 * reply. EXCLUDES the reviewer's identity (couple_user_id) and the event id;
 * fraud-voided reviews are dropped. Newest first.
 *
 * Cursor pagination: `next_cursor` is the ISO created_at of the last row; pass
 * it as `?cursor=` to resume. (Ties on identical created_at are vanishingly rare
 * at per-vendor review volume; a full sync pages until next_cursor is null.)
 */
export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req);
  if (isAuthError(auth)) return authErrorResponse(auth);
  const scopeError = requireScope(auth, 'vendor.reviews.read');
  if (scopeError) return scopeError;

  const url = new URL(req.url);
  const limit = clampLimit(url.searchParams.get('limit'));
  const cursor = url.searchParams.get('cursor');

  const admin = createAdminClient();
  const vendorProfileId = auth.vendorProfileId;

  // Exact total across this vendor's VISIBLE reviews (head:true → no rows). The
  // fraud filter here mirrors the per-row drop below (voided_by_fraud is a
  // NOT-NULL boolean default false), so `total` matches what a full sync yields.
  const { count: total } = await admin
    .from('vendor_reviews')
    .select('review_id', { count: 'exact', head: true })
    .eq('vendor_profile_id', vendorProfileId)
    .eq('voided_by_fraud', false);

  let query = admin
    .from('vendor_reviews')
    .select(
      'public_id, rating_overall, rating_communication, rating_quality, rating_value, rating_on_time, body, vendor_reply, vendor_reply_at, booked_through_setnayan, created_at, voided_by_fraud',
    )
    .eq('vendor_profile_id', vendorProfileId)
    .order('created_at', { ascending: false })
    // over-fetch: a few extra rows absorb any fraud-voided rows we filter out
    // in JS so a full page still comes back after the exclusion.
    .limit(limit + 5);

  if (cursor) query = query.lt('created_at', cursor);

  const { data, error } = await query;
  if (error) {
    logQueryError('GET /api/v1/vendor/reviews', error, { vendor_profile_id: vendorProfileId });
    return apiErrorResponse(500, 'database_error', 'Reviews could not load right now. Try again in a moment.');
  }

  // Drop fraud-voided reviews (voided_by_fraud may be a boolean or a timestamp —
  // treat any truthy value as voided) then trim to the requested page size.
  const visible = ((data ?? []) as ReviewRow[]).filter((r) => !r.voided_by_fraud);
  const pageRows = visible.slice(0, limit);
  const hasMore = visible.length > limit;
  const nextCursor = hasMore ? (pageRows[pageRows.length - 1]?.created_at ?? null) : null;

  return vendorJson({
    total: total ?? null,
    data: pageRows.map((r) => ({
      public_id: r.public_id,
      rating_overall: r.rating_overall,
      rating_communication: r.rating_communication,
      rating_quality: r.rating_quality,
      rating_value: r.rating_value,
      rating_on_time: r.rating_on_time,
      body: r.body,
      vendor_reply: r.vendor_reply,
      vendor_reply_at: r.vendor_reply_at,
      booked_through_setnayan: r.booked_through_setnayan,
      created_at: r.created_at,
    })),
    next_cursor: nextCursor,
  });
}
