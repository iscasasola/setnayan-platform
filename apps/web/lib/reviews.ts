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
  /**
   * Receipt-backed provenance. TRUE when this review's source `event_vendors`
   * booking links to the reviewed vendor's marketplace profile (via
   * `linked_vendor_profile_id` or `marketplace_vendor_id`). PLATFORM-DERIVED —
   * stamped server-side + re-derived by a DB trigger; couples can never set it.
   * Drives the "Booked through Setnayan" / "Verified wedding" pill.
   */
  booked_through_setnayan: boolean;
  /**
   * Receipt-backed provenance SUBSET of `booked_through_setnayan`. TRUE only when
   * the source `event_vendors` booking also carries `source = 'vendor_invite'` —
   * the vendor brought this couple onto Setnayan via their invite QR. PLATFORM-
   * DERIVED — stamped server-side + re-derived by a DB trigger; couples can never
   * set it. Drives the "Verified booking" (import) pill instead of the
   * "Verified wedding" (on-platform) one.
   */
  via_vendor_import: boolean;
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
  'review_id,public_id,vendor_profile_id,event_id,couple_user_id,rating_overall,rating_communication,rating_quality,rating_value,rating_on_time,body,vendor_reply,vendor_reply_at,created_at,booked_through_setnayan,via_vendor_import';

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
 * Resolve the *couple* display name for a set of EVENT ids. A vendor_reviews
 * row is the host's verdict, attributed to the event/couple — never to the
 * individual who physically submitted it (which may be a delegated coordinator,
 * whose personal name must never surface publicly). We therefore key off
 * `event_id` → `events.display_name` (the same "Maria & Juan" couple label the
 * rest of the app uses), NOT `couple_user_id` → `users.display_name`.
 *
 * Falls back to null when the event has no display name; the caller renders
 * "Verified couple" in that case.
 */
export async function resolveCoupleDisplayNames(
  supabase: SupabaseClient,
  eventIds: ReadonlyArray<string | null>,
): Promise<Map<string, string | null>> {
  const ids = Array.from(new Set(eventIds.filter((id): id is string => !!id)));
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from('events')
    .select('event_id, display_name')
    .in('event_id', ids);
  if (error) return new Map();
  const m = new Map<string, string | null>();
  for (const row of data ?? []) {
    const name = (row.display_name as string | null) ?? null;
    m.set(row.event_id as string, name && name.trim().length > 0 ? name : null);
  }
  return m;
}

/**
 * Same as fetchReviewsForVendor but also resolves the couple display name via a
 * follow-up lookup. Attribution is to the EVENT's couple (events.display_name),
 * never the submitter — so a coordinator who submits the host review on the
 * couple's behalf never leaks their personal name. Events with no display name
 * surface as "Verified couple".
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
    reviews.map((r) => r.event_id),
  );
  return reviews.map((r) => ({
    ...r,
    couple_display_name: names.get(r.event_id) ?? null,
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

/**
 * Trusted (receipt-backed, arm's-length) review aggregate for ONE vendor.
 * Read from the `vendor_trusted_review_stats` materialized view (migration
 * `20270516500000_vendor_trusted_review_stats.sql`).
 *
 * ANTI-FRAUD (2026-07-05, Phase 1 follow-up · spec
 * `03_Strategy/Anti_Fraud_Trust_Integrity_2026-07-05.md` § 3): this is the
 * ONLY source the PUBLIC-facing aggregate rating NUMBER + review COUNT may
 * read. It counts only reviews that are `booked_through_setnayan = TRUE` and
 * pass the same self-dealing / arm's-length exclusions as the completed-events
 * view, so fake / self-dealt reviews can't inflate the public star average.
 * The raw `vendor_review_stats` (via `fetchReviewStats`) still backs the
 * per-star HISTOGRAM bars + the review LIST pagination — only the headline
 * average + count migrate to trusted.
 */
export type TrustedReviewStatsRow = {
  vendor_profile_id: string;
  trusted_avg_rating: number;
  trusted_review_count: number;
};

/**
 * Pulls the trusted-stats row for a vendor. Returns 0/0 when no row exists yet
 * (brand-new profile, or the vendor has zero trusted reviews). Fail-soft: a
 * SELECT error (e.g. the view is missing pre-migration) also collapses to 0/0
 * so the public page still renders — it just shows no headline stars.
 */
export async function fetchTrustedReviewStats(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<TrustedReviewStatsRow> {
  const zero: TrustedReviewStatsRow = {
    vendor_profile_id: vendorProfileId,
    trusted_avg_rating: 0,
    trusted_review_count: 0,
  };
  const { data, error } = await supabase
    .from('vendor_trusted_review_stats')
    .select('vendor_profile_id, trusted_avg_rating, trusted_review_count')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (error || !data) return zero;
  return {
    vendor_profile_id: data.vendor_profile_id as string,
    trusted_avg_rating: Number(data.trusted_avg_rating ?? 0),
    trusted_review_count: Number(data.trusted_review_count ?? 0),
  };
}

/**
 * Batch trusted-stats fetch keyed by vendor_profile_id. Used by the marketplace
 * grid + any multi-vendor public surface that shows the aggregate star metric.
 * Vendors absent from the returned map have 0 trusted reviews (callers default
 * to 0/0). Fail-soft: any SELECT error returns an empty map.
 */
export async function fetchTrustedReviewStatsForMany(
  supabase: SupabaseClient,
  vendorProfileIds: ReadonlyArray<string>,
): Promise<Map<string, TrustedReviewStatsRow>> {
  const ids = Array.from(new Set(vendorProfileIds));
  const m = new Map<string, TrustedReviewStatsRow>();
  if (ids.length === 0) return m;
  const { data, error } = await supabase
    .from('vendor_trusted_review_stats')
    .select('vendor_profile_id, trusted_avg_rating, trusted_review_count')
    .in('vendor_profile_id', ids);
  if (error) return m;
  for (const row of data ?? []) {
    m.set(row.vendor_profile_id as string, {
      vendor_profile_id: row.vendor_profile_id as string,
      trusted_avg_rating: Number(row.trusted_avg_rating ?? 0),
      trusted_review_count: Number(row.trusted_review_count ?? 0),
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
 * Resolve, SERVER-SIDE, whether this couple's booking links to THIS vendor's
 * marketplace profile — the "Booked through Setnayan" receipt. Reads the
 * platform-derived linkage via the `review_is_booked_through_setnayan` RPC
 * (SECURITY DEFINER over `event_vendors`). This is the receipt proof; couples
 * never pass it. The DB trigger re-derives the identical value as an
 * authoritative backstop, so even if this resolution and the trigger ever
 * disagreed, the trigger wins and the couple's input is always discarded.
 *
 * Best-effort: a resolution error returns false (the conservative outcome —
 * the review still posts, the trigger still stamps the truth on write).
 */
export async function resolveBookedThroughSetnayan(
  supabase: SupabaseClient,
  eventId: string,
  vendorProfileId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('review_is_booked_through_setnayan', {
    p_event_id: eventId,
    p_vendor_profile_id: vendorProfileId,
  });
  if (error) return false;
  return data === true;
}

/**
 * Resolve, SERVER-SIDE, whether this review's source booking came in via the
 * vendor's invite QR (the import path) rather than the couple's own on-platform
 * discovery — the "Verified booking" vs "Verified wedding" split. Reads the
 * `review_via_vendor_import` RPC (SECURITY DEFINER over `event_vendors`), a
 * strict subset of resolveBookedThroughSetnayan. Advisory only: the DB trigger
 * re-derives the authoritative value on write, so couples never control it.
 * Best-effort: a resolution error returns false (the conservative outcome — the
 * review still falls back to the broader "Verified wedding" pill).
 */
export async function resolveViaVendorImport(
  supabase: SupabaseClient,
  eventId: string,
  vendorProfileId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('review_via_vendor_import', {
    p_event_id: eventId,
    p_vendor_profile_id: vendorProfileId,
  });
  if (error) return false;
  return data === true;
}

/**
 * Couple-side INSERT. The DB-level RLS + unique constraint enforce the
 * "must be delivered/complete" + "one per (vendor, event, couple)" rules.
 *
 * Provenance (`booked_through_setnayan` + `via_vendor_import`) is resolved
 * SERVER-SIDE here and passed explicitly, but is NOT couple-controllable: the
 * `stamp_review_provenance` BEFORE trigger overwrites whatever value reaches
 * the row with the platform-derived truth on every write. We pass our resolved
 * values so the intent is visible in the call path; the trigger guarantees it.
 */
export async function createReview(
  supabase: SupabaseClient,
  args: CreateReviewArgs,
): Promise<{ review_id: string }> {
  const [bookedThroughSetnayan, viaVendorImport] = await Promise.all([
    resolveBookedThroughSetnayan(supabase, args.eventId, args.vendorProfileId),
    resolveViaVendorImport(supabase, args.eventId, args.vendorProfileId),
  ]);
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
      // Server-resolved provenance. The BEFORE trigger re-derives the canonical
      // values, so these are advisory — couples cannot set them by tampering.
      booked_through_setnayan: bookedThroughSetnayan,
      via_vendor_import: viaVendorImport,
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

// ----------------------------------------------------------------------------
// Track record — dated list of completed events that flowed through Setnayan.
// ----------------------------------------------------------------------------

/**
 * One row of a vendor's dated track record. Sourced from the
 * `vendor_completed_events` VIEW, which applies the SAME self-review / team /
 * internal / self-comp / archived exclusions as the public completed-events
 * stats view — so this list can never be padded by a vendor's own bookings.
 */
export type VendorCompletedEventRow = {
  vendor_profile_id: string;
  vendor_id: string;
  event_id: string;
  event_type: string | null;
  event_date: string | null;
  completed_at: string | null;
};

const COMPLETED_EVENT_COLUMNS =
  'vendor_profile_id,vendor_id,event_id,event_type,event_date,completed_at';

/**
 * Fetch a vendor's dated track record (most recent first). Reads the public
 * `vendor_completed_events` view (GRANTed to anon + authenticated), so it works
 * from both the public /v/[slug] surface and the vendor dashboard. Best-effort:
 * if the view is missing in a stale deploy environment, returns [].
 */
export async function fetchVendorCompletedEvents(
  supabase: SupabaseClient,
  vendorProfileId: string,
  opts: { limit?: number } = {},
): Promise<VendorCompletedEventRow[]> {
  const limit = opts.limit ?? 60;
  const { data, error } = await supabase
    .from('vendor_completed_events')
    .select(COMPLETED_EVENT_COLUMNS)
    .eq('vendor_profile_id', vendorProfileId)
    .order('completed_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as VendorCompletedEventRow[];
}

/**
 * Format a track-record entry's date as "Month YYYY" (e.g. "Jun 2026"),
 * preferring `completed_at` then `event_date`. Returns null when neither is set
 * so the caller can omit the date suffix.
 */
export function formatTrackRecordMonth(row: VendorCompletedEventRow): string | null {
  const raw = row.completed_at ?? row.event_date;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short' });
}

/**
 * Title-case a raw event_type slug for display ("wedding" → "Wedding",
 * "gender_reveal" → "Gender Reveal"). Falls back to "Event" when unset.
 */
export function formatEventTypeLabel(eventType: string | null): string {
  if (!eventType || eventType.trim().length === 0) return 'Event';
  return eventType
    .trim()
    .split(/[_\s]+/)
    .map((w) => (w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}
