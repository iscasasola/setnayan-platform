import { redirect } from 'next/navigation';
import { Star, Reply, Flag, Heart, BadgeCheck, CalendarCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { countVendorRecommendingCouples } from '@/lib/vendor-recommendations';
import {
  averageByAxis,
  fetchReviewsForVendorWithCouple,
  fetchReviewStats,
  fetchVendorCompletedEvents,
  formatStarRating,
  formatTrackRecordMonth,
  formatEventTypeLabel,
  REVIEW_AXIS_LABEL,
  VENDOR_REPLY_MAX_CHARS,
  REVIEW_FLAG_REASON_LABEL,
  type ReviewAxis,
  type ReviewWithCouple,
  type ReviewStatsRow,
  type VendorCompletedEventRow,
} from '@/lib/reviews';
import { SubmitButton } from '@/app/_components/submit-button';
import { postVendorReply, submitFlagAsFake } from './actions';

export const metadata = { title: 'Reviews · Vendor' };

export default async function VendorReviewsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Reviews</h1>
        <p className="mt-4 text-base text-ink/65">
          Set up your vendor profile first — once it&rsquo;s published and a couple marks a
          service delivered, their review will land here.
        </p>
      </div>
    );
  }

  const [stats, reviews, recommendingCouples, completedEvents] = await Promise.all([
    fetchReviewStats(supabase, profile.vendor_profile_id),
    fetchReviewsForVendorWithCouple(supabase, profile.vendor_profile_id, { limit: 200 }),
    // "Recommended by N couples" (Event Lifecycle Menu §6.3) — the proof-backed
    // trust signal couples build for you post-event; also shows on your profile.
    countVendorRecommendingCouples(supabase, profile.vendor_profile_id),
    // Receipt-backed dated track record (Wave 5) — the same dated list of
    // Setnayan-delivered events that renders on your public /v/[slug].
    fetchVendorCompletedEvents(supabase, profile.vendor_profile_id, { limit: 60 }),
  ]);

  const axisAverages = averageByAxis(reviews);

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Reviews</h1>
        <p className="max-w-prose text-base text-ink/65">
          Reviews from real Setnayan couples post-event. They&rsquo;re permanent per the
          Vendor Agreement &sect;&nbsp;3.10 — they can&rsquo;t be hidden, but you get
          one public reply under each review. Your reply shows to every couple,
          on every plan — make it count, it&rsquo;s final once posted.
        </p>
        {recommendingCouples > 0 ? (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-mulberry/10 px-3 py-1 text-xs font-medium text-mulberry">
            <Heart aria-hidden className="h-3.5 w-3.5 fill-mulberry/80" strokeWidth={2} />
            Recommended by {recommendingCouples} couple{recommendingCouples === 1 ? '' : 's'}
          </p>
        ) : null}
      </header>

      <StatsOverview stats={stats} axisAverages={axisAverages} />

      {/* Receipt-backed track record (Wave 5) — dated list of events you
          delivered through Setnayan, the same list couples see on your public
          profile. Same owner/team/internal/self-comp exclusions as the public
          count, so it can't be padded. Omitted when you have none yet. */}
      {completedEvents.length > 0 ? <TrackRecord events={completedEvents} /> : null}

      {reviews.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center text-sm text-ink/55">
          You don&rsquo;t have any reviews yet. They&rsquo;ll appear here automatically the
          moment a couple posts one — and we&rsquo;ll send it to your notifications
          and email so you never miss one.
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {reviews.map((r) => (
            <li key={r.review_id}>
              <VendorReviewCard
                review={r}
                vendorName={profile.business_name ?? 'Your business'}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatsOverview({
  stats,
  axisAverages,
}: {
  stats: ReviewStatsRow;
  axisAverages: Record<ReviewAxis, number>;
}) {
  const totals: Array<{ star: 5 | 4 | 3 | 2 | 1; count: number }> = [
    { star: 5, count: stats.count_5_star },
    { star: 4, count: stats.count_4_star },
    { star: 3, count: stats.count_3_star },
    { star: 2, count: stats.count_2_star },
    { star: 1, count: stats.count_1_star },
  ];
  const max = Math.max(1, ...totals.map((t) => t.count));

  return (
    <section className="grid gap-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:grid-cols-3">
      <div className="flex flex-col gap-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
          Average rating
        </p>
        <div className="flex items-center gap-1">
          <Star
            className={`h-6 w-6 ${
              stats.avg_rating_overall > 0
                ? 'fill-warn-400 text-warn-500'
                : 'text-ink/25'
            }`}
            strokeWidth={1.5}
          />
          <span className="text-3xl font-semibold text-ink">
            {stats.avg_rating_overall > 0 ? formatStarRating(stats.avg_rating_overall) : '—'}
          </span>
        </div>
        <p className="text-xs text-ink/60">
          {stats.total_count} review{stats.total_count === 1 ? '' : 's'} total
        </p>
      </div>

      <div className="space-y-1.5 text-xs sm:col-span-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
          Star breakdown
        </p>
        <ul className="space-y-1">
          {totals.map(({ star, count }) => (
            <li key={star} className="grid grid-cols-[28px_1fr_40px] items-center gap-2">
              <span className="inline-flex items-center gap-0.5 text-ink/65">
                {star}
                <Star className="h-3 w-3 fill-warn-400 text-warn-500" strokeWidth={1.5} />
              </span>
              <span className="h-2 w-full overflow-hidden rounded-full bg-ink/10">
                <span
                  className="block h-full bg-warn-400"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </span>
              <span className="text-right font-mono text-[11px] text-ink/55">{count}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-1.5 text-xs">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
          By category
        </p>
        <ul className="space-y-1">
          {(['communication', 'quality', 'value', 'on_time'] as ReadonlyArray<ReviewAxis>).map(
            (axis) => (
              <li
                key={axis}
                className="flex items-center justify-between rounded-md bg-ink/[0.03] px-2 py-1"
              >
                <span className="text-ink/65">{REVIEW_AXIS_LABEL[axis]}</span>
                <span className="inline-flex items-center gap-1 font-mono text-ink/80">
                  <Star className="h-3 w-3 fill-warn-400 text-warn-500" strokeWidth={1.5} />
                  {axisAverages[axis] > 0 ? axisAverages[axis].toFixed(1) : '—'}
                </span>
              </li>
            ),
          )}
        </ul>
      </div>
    </section>
  );
}

function VendorReviewCard({
  review,
  vendorName,
}: {
  review: ReviewWithCouple;
  vendorName: string;
}) {
  const author =
    review.couple_display_name && review.couple_display_name.trim().length > 0
      ? review.couple_display_name
      : 'Verified couple';
  const dateLabel = new Date(review.created_at).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const hasReply = !!review.vendor_reply;

  return (
    <article className="space-y-3 rounded-xl border border-ink/10 bg-cream p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StarRow value={review.rating_overall} />
          <span className="text-sm font-medium text-ink">{author}</span>
          {/* Receipt-backed provenance (Wave 5 + import polish). PLATFORM-DERIVED
              — couples can't set it. "Verified booking" when the couple came in
              via your invite QR (import); "Verified wedding" when they booked you
              on-platform; nothing for off-platform bookings. */}
          {review.via_vendor_import ? (
            <VerifiedBookingPill />
          ) : review.booked_through_setnayan ? (
            <VerifiedWeddingPill />
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <time className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/45">
            {dateLabel}
          </time>
          <FlagForm reviewId={review.review_id} />
        </div>
      </header>

      {review.body ? (
        <p className="whitespace-pre-line text-sm text-ink/80">{review.body}</p>
      ) : (
        <p className="text-xs italic text-ink/45">No written review.</p>
      )}

      <dl className="grid gap-2 text-[11px] text-ink/55 sm:grid-cols-4">
        <AxisStat axis="communication" value={review.rating_communication} />
        <AxisStat axis="quality" value={review.rating_quality} />
        <AxisStat axis="value" value={review.rating_value} />
        <AxisStat axis="on_time" value={review.rating_on_time} />
      </dl>

      {hasReply ? (
        <ExistingReplySection review={review} vendorName={vendorName} />
      ) : (
        <ReplyForm reviewId={review.review_id} />
      )}
    </article>
  );
}

/**
 * Shows the vendor's single public reply, read-only. The reply is IMMUTABLE
 * once posted (owner 2026-06-29 · one public reply per review): the DB trigger
 * `lock_vendor_reply` rejects any change, so there is no edit affordance.
 */
function ExistingReplySection({
  review,
  vendorName,
}: {
  review: ReviewWithCouple;
  vendorName: string;
}) {
  const repliedAt = review.vendor_reply_at
    ? new Date(review.vendor_reply_at).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div className="rounded-md border-l-4 border-terracotta/40 bg-terracotta/[0.06] p-3 pl-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta-700">
        Response from {vendorName}
        {repliedAt ? ` · ${repliedAt}` : null}
      </p>
      <p className="mt-1 whitespace-pre-line text-sm text-ink/80">{review.vendor_reply}</p>
      <p className="mt-2 text-[11px] text-ink/45">
        Your public reply is final — it can’t be edited once posted.
      </p>
    </div>
  );
}

function ReplyForm({ reviewId }: { reviewId: string }) {
  return (
    <form action={postVendorReply} className="space-y-2 border-t border-ink/10 pt-3">
      <input type="hidden" name="review_id" value={reviewId} />
      <label
        htmlFor={`reply_${reviewId}`}
        className="block font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55"
      >
        Public reply
      </label>
      <textarea
        id={`reply_${reviewId}`}
        name="reply"
        required
        rows={3}
        maxLength={VENDOR_REPLY_MAX_CHARS}
        placeholder="Write a thoughtful public response visible to all couples on your profile…"
        className="input-field min-h-[80px] py-2"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-ink/50">
          Up to {VENDOR_REPLY_MAX_CHARS} characters. One public reply — it&rsquo;s
          final once posted, so take a moment.
        </p>
        <SubmitButton
          className="inline-flex items-center gap-1.5 rounded-md bg-mulberry px-3 py-2 text-xs font-medium text-cream hover:bg-mulberry-600 disabled:opacity-60"
          pendingLabel="Posting…"
        >
          <Reply className="h-3.5 w-3.5" strokeWidth={2} />
          Post reply
        </SubmitButton>
      </div>
    </form>
  );
}

/**
 * Flag-as-fake button that expands to a reason selector + submit.
 * Uses <details> to avoid any client-side JavaScript for the toggle.
 */
function FlagForm({ reviewId }: { reviewId: string }) {
  return (
    <details className="group relative">
      <summary
        title="Flag review as fake"
        className="inline-flex cursor-pointer select-none list-none items-center gap-1 text-[11px] text-ink/40 hover:text-danger-600"
      >
        <Flag aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        <span className="sr-only">Flag as fake</span>
      </summary>
      <div className="absolute right-0 top-6 z-10 w-72 rounded-xl border border-ink/10 bg-white p-3 shadow-lg">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
          Flag review as fake
        </p>
        <form action={submitFlagAsFake} className="space-y-2">
          <input type="hidden" name="review_id" value={reviewId} />
          <select
            name="reason"
            required
            className="input-field w-full py-1.5 text-xs"
            defaultValue=""
          >
            <option value="" disabled>
              Select a reason…
            </option>
            {(Object.entries(REVIEW_FLAG_REASON_LABEL) as Array<[string, string]>).map(
              ([key, label]) => (
                <option key={key} value={`${key}: ${label}`}>
                  {label}
                </option>
              ),
            )}
          </select>
          <p className="text-[10px] text-ink/45">
            Setnayan HQ will review this within 48 hours. You can only flag a
            review once.
          </p>
          <SubmitButton
            className="inline-flex items-center gap-1.5 rounded-md bg-danger-600 px-3 py-2 text-xs font-medium text-white hover:bg-danger-700 disabled:opacity-60"
            pendingLabel="Flagging…"
          >
            <Flag className="h-3.5 w-3.5" strokeWidth={2} />
            Submit flag
          </SubmitButton>
        </form>
      </div>
    </details>
  );
}

/**
 * Receipt-backed provenance pills — the same platform-derived signals that
 * render on the public /v/[slug] review. A couple can never set them; they're
 * stamped server-side from the booking linkage + source.
 *
 * "Verified wedding" — the couple booked you on-platform themselves.
 */
function VerifiedWeddingPill() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-mulberry/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-mulberry"
      title="This couple booked you through Setnayan — verified by the platform."
    >
      <BadgeCheck aria-hidden className="h-3 w-3" strokeWidth={2} />
      Verified wedding
    </span>
  );
}

/**
 * "Verified booking" — you brought this couple onto Setnayan via your invite QR.
 * Still a verified, platform-confirmed relationship — just sourced from your own
 * client rather than on-platform discovery.
 */
function VerifiedBookingPill() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-terracotta/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-terracotta-700"
      title="You invited this couple to Setnayan — a verified booking relationship."
    >
      <BadgeCheck aria-hidden className="h-3 w-3" strokeWidth={2} />
      Verified booking
    </span>
  );
}

/**
 * Receipt-backed dated track record. The same `{event type · month-year}` list
 * that renders on your public profile — sourced from the
 * `vendor_completed_events` view, which excludes your own team / internal /
 * self-comp bookings so the count is always honest.
 */
function TrackRecord({ events }: { events: ReadonlyArray<VendorCompletedEventRow> }) {
  return (
    <section className="mt-8 rounded-2xl border border-ink/10 bg-cream p-5">
      <div className="mb-3 flex items-center gap-2">
        <CalendarCheck aria-hidden className="h-4 w-4 text-mulberry" strokeWidth={1.75} />
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
          Track record
        </h2>
        <span className="text-xs text-ink/45">
          {events.length} event{events.length === 1 ? '' : 's'} delivered through Setnayan
        </span>
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((ev) => {
          const month = formatTrackRecordMonth(ev);
          return (
            <li
              key={ev.vendor_id}
              className="flex items-center justify-between gap-3 rounded-md bg-ink/[0.03] px-3 py-1.5 text-sm"
            >
              <span className="text-ink/80">{formatEventTypeLabel(ev.event_type)}</span>
              {month ? (
                <time className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink/45">
                  {month}
                </time>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AxisStat({ axis, value }: { axis: ReviewAxis; value: number }) {
  return (
    <div className="rounded-md bg-ink/[0.03] px-2 py-1.5">
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
        {REVIEW_AXIS_LABEL[axis]}
      </dt>
      <dd className="flex items-center gap-1 text-ink/80">
        <Star className="h-3 w-3 fill-warn-400 text-warn-500" strokeWidth={1.5} />
        <span className="font-mono text-[11px]">{value.toFixed(0)}</span>
      </dd>
    </div>
  );
}

function StarRow({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden
          className={`h-4 w-4 ${
            n <= value ? 'fill-warn-400 text-warn-500' : 'text-ink/25'
          }`}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}
