import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The 5 axes a couple rates a vendor on after delivery. Mirrors the columns
 * defined in 20260514100000_vendor_reviews.sql.
 */
export const REVIEW_AXES = [
  'overall',
  'communication',
  'quality',
  'value',
  'on_time',
] as const;

export type ReviewAxis = (typeof REVIEW_AXES)[number];

export const REVIEW_AXIS_LABEL: Record<ReviewAxis, string> = {
  overall: 'Overall',
  communication: 'How well did they communicate throughout the process?',
  quality: 'Did they deliver what was promised on the day?',
  value: 'Was the price fair for what you received?',
  // on_time is binary (Yes=5 / No=1) — use REVIEW_ON_TIME_LABEL for the UI
  // question; REVIEW_AXIS_LABEL keeps a short form for display (star breakdowns
  // in the vendor profile public page use the short label).
  on_time: 'On-time delivery',
};

/** Label for the on_time binary Yes/No toggle shown in the review form. */
export const REVIEW_ON_TIME_LABEL =
  'Did they arrive and deliver on schedule?';

export type ReviewRow = {
  review_id: string;
  public_id: string;
  vendor_profile_id: string;
  event_id: string;
  couple_user_id: string | null;
  rating_overall: number;
  rating_communication: number;
  rating_quality: number;
  rating_value: number;
  rating_on_time: number;
  body: string | null;
  vendor_reply: string | null;
  vendor_reply_at: string | null;
  created_at: string;
};

export type ReviewWithCouple = ReviewRow & {
  couple_display_name: string | null;
};

export type ReviewStatsRow = {
  vendor_profile_id: string;
  avg_rating_overall: number;
  total_count: number;
  count_5_star: number;
  count_4_star: number;
  count_3_star: number;
  count_2_star: number;
  count_1_star: number;
};

const REVIEW_COLUMNS =
  'review_id,public_id,vendor_profile_id,event_id,couple_user_id,rating_overall,rating_communication,rating_quality,rating_value,rating_on_time,body,vendor_reply,vendor_reply_at,created_at';

export type FetchReviewsOpts = {
  limit?: number;
  offset?: number;
};

/**
 * List reviews for a vendor profile, newest first. Pure-data fetch — no
 * couple-name resolution; that's the responsibility of `enrichReviewsWithCouple`
 * which optionally joins users (display_name).
 */
export async function fetchReviewsForVendor(
  supabase: SupabaseClient,
  vendorProfileId: string,
  opts: FetchReviewsOpts = {},
): Promise<ReviewRow[]> {
  const limit = opts.limit ?? 25;
  const offset = opts.offset ?? 0;
  const { data, error } = await supabase
    .from('vendor_reviews')
    .select(REVIEW_COLUMNS)
    .eq('vendor_profile_id', vendorProfileId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(`fetchReviewsForVendor failed: ${error.message}`);
  return (data ?? []) as ReviewRow[];
}

/**
 * Total review count for a vendor. Used by the public landing page when it
 * wants pagination math without pulling the stats view (e.g. before the first
 * refresh has run for a brand-new vendor).
 */
export async function countReviewsForVendor(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('vendor_reviews')
    .select('*', { count: 'exact', head: true })
    .eq('vendor_profile_id', vendorProfileId);
  if (error) throw new Error(`countReviewsForVendor failed: ${error.message}`);
  return count ?? 0;
}

/**
 * Resolve display names for a set of couple_user_ids. Falls back to null when
 * the user has been deleted (couple_user_id is then null after the ON DELETE
 * SET NULL cascade) or hasn't set a display name. Caller renders "Verified
 * couple" in either case.
 */
export async function resolveCoupleDisplayNames(
  supabase: SupabaseClient,
  userIds: ReadonlyArray<string | null>,
): Promise<Map<string, string | null>> {
  const ids = Array.from(new Set(userIds.filter((id): id is string => !!id)));
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from('users')
    .select('user_id, display_name')
    .in('user_id', ids);
  if (error) return new Map();
  const m = new Map<string, string | null>();
  for (const row of data ?? []) {
    m.set(row.user_id as string, (row.display_name as string | null) ?? null);
  }
  return m;
}

/**
 * Same as fetchReviewsForVendor but also resolves couple display names via a
 * follow-up lookup. Reviews from deleted users surface as "Verified couple".
 */
export async function fetchReviewsForVendorWithCouple(
  supabase: SupabaseClient,
  vendorProfileId: string,
  opts: FetchReviewsOpts = {},
): Promise<ReviewWithCouple[]> {
  const reviews = await fetchReviewsForVendor(supabase, vendorProfileId, opts);
  if (reviews.length === 0) return [];
  const names = await resolveCoupleDisplayNames(
    supabase,
    reviews.map((r) => r.couple_user_id),
  );
  return reviews.map((r) => ({
    ...r,
    couple_display_name: r.couple_user_id ? (names.get(r.couple_user_id) ?? null) : null,
  }));
}

/**
 * Pulls the materialized view row for a vendor. Returns a zero-initialized
 * stats object when no row exists yet (e.g. vendor has zero reviews and the
 * view hasn't been refreshed since profile creation).
 */
export async function fetchReviewStats(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<ReviewStatsRow> {
  const { data, error } = await supabase
    .from('vendor_review_stats')
    .select(
      'vendor_profile_id,avg_rating_overall,total_count,count_5_star,count_4_star,count_3_star,count_2_star,count_1_star',
    )
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (error) throw new Error(`fetchReviewStats failed: ${error.message}`);
  if (!data) {
    return {
      vendor_profile_id: vendorProfileId,
      avg_rating_overall: 0,
      total_count: 0,
      count_5_star: 0,
      count_4_star: 0,
      count_3_star: 0,
      count_2_star: 0,
      count_1_star: 0,
    };
  }
  return {
    vendor_profile_id: data.vendor_profile_id as string,
    avg_rating_overall: Number(data.avg_rating_overall ?? 0),
    total_count: Number(data.total_count ?? 0),
    count_5_star: Number(data.count_5_star ?? 0),
    count_4_star: Number(data.count_4_star ?? 0),
    count_3_star: Number(data.count_3_star ?? 0),
    count_2_star: Number(data.count_2_star ?? 0),
    count_1_star: Number(data.count_1_star ?? 0),
  };
}

/**
 * Batch fetch of stats rows keyed by vendor_profile_id. The marketplace grid
 * uses this to render the per-card star metric without one SELECT per card.
 */
export async function fetchReviewStatsForMany(
  supabase: SupabaseClient,
  vendorProfileIds: ReadonlyArray<string>,
): Promise<Map<string, ReviewStatsRow>> {
  const ids = Array.from(new Set(vendorProfileIds));
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from('vendor_review_stats')
    .select(
      'vendor_profile_id,avg_rating_overall,total_count,count_5_star,count_4_star,count_3_star,count_2_star,count_1_star',
    )
    .in('vendor_profile_id', ids);
  if (error) throw new Error(`fetchReviewStatsForMany failed: ${error.message}`);
  const m = new Map<string, ReviewStatsRow>();
  for (const row of data ?? []) {
    m.set(row.vendor_profile_id as string, {
      vendor_profile_id: row.vendor_profile_id as string,
      avg_rating_overall: Number(row.avg_rating_overall ?? 0),
      total_count: Number(row.total_count ?? 0),
      count_5_star: Number(row.count_5_star ?? 0),
      count_4_star: Number(row.count_4_star ?? 0),
      count_3_star: Number(row.count_3_star ?? 0),
      count_2_star: Number(row.count_2_star ?? 0),
      count_1_star: Number(row.count_1_star ?? 0),
    });
  }
  return m;
}

export type CreateReviewArgs = {
  vendorProfileId: string;
  eventId: string;
  coupleUserId: string;
  ratings: Record<ReviewAxis, number>;
  body: string | null;
};

/**
 * Couple-side INSERT. The DB-level RLS + unique constraint enforce the
 * "must be delivered/complete" + "one per (vendor, event, couple)" rules.
 */
export async function createReview(
  supabase: SupabaseClient,
  args: CreateReviewArgs,
): Promise<{ review_id: string }> {
  const { data, error } = await supabase
    .from('vendor_reviews')
    .insert({
      vendor_profile_id: args.vendorProfileId,
      event_id: args.eventId,
      couple_user_id: args.coupleUserId,
      rating_overall: args.ratings.overall,
      rating_communication: args.ratings.communication,
      rating_quality: args.ratings.quality,
      rating_value: args.ratings.value,
      rating_on_time: args.ratings.on_time,
      body: args.body && args.body.length > 0 ? args.body : null,
    })
    .select('review_id')
    .single();
  if (error) throw new Error(`createReview failed: ${error.message}`);
  return { review_id: data.review_id as string };
}

/**
 * Look up whether the signed-in couple has already submitted a review for a
 * (vendor_profile, event) pair. Used to gate the "Leave a review" CTA on the
 * couple's vendor-tracker.
 */
export async function fetchOwnReviewForVendor(
  supabase: SupabaseClient,
  vendorProfileId: string,
  eventId: string,
  coupleUserId: string,
): Promise<ReviewRow | null> {
  const { data, error } = await supabase
    .from('vendor_reviews')
    .select(REVIEW_COLUMNS)
    .eq('vendor_profile_id', vendorProfileId)
    .eq('event_id', eventId)
    .eq('couple_user_id', coupleUserId)
    .maybeSingle();
  if (error) return null;
  return (data ?? null) as ReviewRow | null;
}

export const VENDOR_REPLY_MAX_CHARS = 500;

/**
 * Vendor-side reply (initial post or edit). The DB trigger stamps
 * vendor_reply_at automatically; subsequent edits update it to NOW() as well.
 * Validates the vendor owns the review before writing — RLS enforces this too,
 * but we fail early to give a clearer error.
 */
export async function submitVendorReply(
  supabase: SupabaseClient,
  reviewId: string,
  reply: string,
): Promise<void> {
  const trimmed = reply.trim();
  if (trimmed.length === 0) throw new Error('Reply cannot be empty.');
  if (trimmed.length > VENDOR_REPLY_MAX_CHARS)
    throw new Error(`Reply must be ${VENDOR_REPLY_MAX_CHARS} characters or fewer.`);
  const { error } = await supabase
    .from('vendor_reviews')
    .update({ vendor_reply: trimmed })
    .eq('review_id', reviewId);
  if (error) throw new Error(`submitVendorReply failed: ${error.message}`);
}

export type ReviewFlagReason =
  | 'fake_reviewer'
  | 'competitor_account'
  | 'defamatory_content'
  | 'wrong_vendor'
  | 'other';

export const REVIEW_FLAG_REASON_LABEL: Record<ReviewFlagReason, string> = {
  fake_reviewer: 'Fake or anonymous reviewer',
  competitor_account: 'Suspected competitor account',
  defamatory_content: 'Defamatory or false claims',
  wrong_vendor: 'Review is for a different vendor',
  other: 'Other reason',
};

/**
 * Vendor flags a review as fake/disputed. Inserts into vendor_review_flags
 * which feeds the HQ adjudication queue in /admin/reviews. A vendor can only
 * flag a given review once (DB UNIQUE constraint).
 */
export async function flagReviewAsFake(
  supabase: SupabaseClient,
  reviewId: string,
  vendorProfileId: string,
  reason: string,
): Promise<void> {
  const trimmed = reason.trim();
  if (trimmed.length === 0) throw new Error('Flag reason cannot be empty.');
  if (trimmed.length > 1000) throw new Error('Flag reason must be 1000 characters or fewer.');
  const { error } = await supabase
    .from('vendor_review_flags')
    .insert({
      review_id: reviewId,
      reported_by_vendor_profile_id: vendorProfileId,
      reason: trimmed,
    });
  if (error) {
    // Unique violation means already flagged.
    if (error.code === '23505') {
      throw new Error('You have already flagged this review. HQ will review it.');
    }
    throw new Error(`flagReviewAsFake failed: ${error.message}`);
  }
}

/**
 * Average across the 4 non-overall axes — handy when we want a "category
 * breakdown" tile on the vendor-side reviews dashboard.
 */
export function averageByAxis(reviews: ReadonlyArray<ReviewRow>): Record<ReviewAxis, number> {
  if (reviews.length === 0) {
    return { overall: 0, communication: 0, quality: 0, value: 0, on_time: 0 };
  }
  const sum = { overall: 0, communication: 0, quality: 0, value: 0, on_time: 0 };
  for (const r of reviews) {
    sum.overall += r.rating_overall;
    sum.communication += r.rating_communication;
    sum.quality += r.rating_quality;
    sum.value += r.rating_value;
    sum.on_time += r.rating_on_time;
  }
  const n = reviews.length;
  return {
    overall: sum.overall / n,
    communication: sum.communication / n,
    quality: sum.quality / n,
    value: sum.value / n,
    on_time: sum.on_time / n,
  };
}

export function formatStarRating(value: number): string {
  if (!value) return '—';
  return value.toFixed(1);
}
