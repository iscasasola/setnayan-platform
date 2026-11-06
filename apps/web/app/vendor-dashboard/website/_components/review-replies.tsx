import { Star, Reply, Flag, BadgeCheck } from 'lucide-react';
import {
  REVIEW_AXIS_LABEL,
  VENDOR_REPLY_MAX_CHARS,
  type ReviewAxis,
  type ReviewWithCouple,
} from '@/lib/reviews';
import { SubmitButton } from '@/app/_components/submit-button';
import { formatCount } from '@/lib/format-number';
import { postVendorReply, submitFlagAsFake } from '../../reviews/actions';
import { FlagReasonPick } from './flag-reason-pick';
import { GUEST_REVIEW_REPLY_MAX, type GuestReviewRow, type GuestReviewsRead } from '@/lib/guest-reviews';
import { GuestAtEventPill, ReviewGroupHead } from '@/app/v/[slug]/_components/review-groups';

/**
 * 💬 REPLY TO A REVIEW, IN PLACE — Shop › Page › Reviews and stories (owner 2026-11-06, verbatim: *"Use fable to decide.
 * Find the best location for each. Make the pages live there and not jump to another menu."* — DECISION_LOG "ONE HOME
 * FOR EVERY PROMOTE TOOL": **Page › Reviews and stories** = read + reply to reviews in place; `/reviews` forwards there).
 *
 * LIFTED, not redrawn, from the retired `/vendor-dashboard/reviews` page: the review card (stars · couple · the
 * platform-stamped Verified pill · date · the words · the four axes), the ONE public reply form (`postVendorReply`,
 * up to `VENDOR_REPLY_MAX_CHARS`, final once posted — the DB trigger `lock_vendor_reply` refuses any change), the
 * existing reply read-only, and Flag as fake (`submitFlagAsFake`, a `<details>`; the reason is a PickMenu island, `flag-reason-pick.tsx`). The reply form
 * keeps its `id="reply_<review_id>"`, so a link to one review still lands on its box.
 *
 * Reviews needing a reply come first. A refused read is said — never "no reviews". Reviews are permanent (Vendor
 * Agreement § 3.10), so nothing here can be removed and the rows carry no swipe.
 *
 * Server component, handed to the client `PageParts` as `reviewsBody` (the same slot pattern as `domainBody`).
 *
 * ⭐ TWO LABELLED GROUPS (owner, 6 Nov · prototype § 9: "the same two groups"): **From the hosts** — the list above,
 * unchanged — then **From guests**, each with the same one public reply (`postVendorReply`, `kind=guest`). Guest reviews cannot
 * be flagged here: they are public at once and Setnayan hides one from Admin › Reviews (owner ruling A).
 */
export function ReviewReplies({
  reviews,
  vendorName,
  capped,
  guestReviews,
}: {
  reviews: ReviewWithCouple[] | null;
  vendorName: string;
  capped: boolean;
  guestReviews: GuestReviewsRead;
}) {
  return (
    <div className="space-y-4 pt-2" data-review-groups>
      <div>
        <ReviewGroupHead>From the hosts</ReviewGroupHead>
        <HostReplies reviews={reviews} vendorName={vendorName} capped={capped} />
      </div>
      <GuestReplies read={guestReviews} vendorName={vendorName} />
    </div>
  );
}

function HostReplies({ reviews, vendorName, capped }: { reviews: ReviewWithCouple[] | null; vendorName: string; capped: boolean }) {
  if (reviews === null) {
    return (
      <p role="alert" className="pt-2 text-[13.5px] text-ink/70" data-review-replies="unread">
        We couldn&rsquo;t load your reviews just now. Any reply you posted is still on your page — reload to try again.
      </p>
    );
  }
  if (reviews.length === 0) {
    return (
      <p className="pt-2 text-[13.5px] text-ink/60" data-review-replies="none">
        No reviews yet. They show here the moment a couple posts one, ready for your reply.
      </p>
    );
  }
  const waiting = reviews.filter((r) => !r.vendor_reply);
  const ordered = [...waiting, ...reviews.filter((r) => !!r.vendor_reply)];
  return (
    <div className="pt-2" data-review-replies="list">
      <p className="text-[13px] font-semibold text-ink">
        {waiting.length > 0 ? `Reply · ${formatCount(waiting.length)} waiting` : 'Replies · all answered'}
      </p>
      <p className="text-[12.5px] text-ink/55">One public reply per review — every couple sees it, and it&rsquo;s final once posted.</p>
      <ul className="mt-1">
        {ordered.map((r) => (
          <li key={r.review_id} className="border-b border-ink/10 py-3 last:border-b-0">
            <VendorReviewCard review={r} vendorName={vendorName} />
          </li>
        ))}
      </ul>
      {capped ? <p className="pt-1 text-[12.5px] text-ink/55">Showing your newest {formatCount(reviews.length)} reviews.</p> : null}
    </div>
  );
}

/** ⭐ From guests — the shop's side. none → no group; refused → said; rows → each with its one reply. */
function GuestReplies({ read, vendorName }: { read: GuestReviewsRead; vendorName: string }) {
  if (read.state === 'none') return null;
  if (read.state === 'refused') {
    return (
      <div data-guest-replies="unread">
        <ReviewGroupHead>From guests</ReviewGroupHead>
        <p role="alert" className="pt-2 text-[13.5px] text-ink/70">
          We couldn&rsquo;t load your guests&rsquo; reviews just now. Reload to try again.
        </p>
      </div>
    );
  }
  const waiting = read.rows.filter((r) => !r.vendor_reply);
  const ordered = [...waiting, ...read.rows.filter((r) => !!r.vendor_reply)];
  return (
    <div data-guest-replies="list">
      <ReviewGroupHead>From guests</ReviewGroupHead>
      <p className="pt-2 text-[13px] font-semibold text-ink">
        {formatCount(read.stats.count)} guest{read.stats.count === 1 ? '' : 's'} ·{' '}
        {waiting.length > 0 ? `${formatCount(waiting.length)} waiting` : 'all answered'}
      </p>
      <p className="text-[12.5px] text-ink/55">They saw the result on the day. Their stars never move your overall.</p>
      <ul className="mt-1">
        {ordered.map((r) => (
          <li key={r.review_id} className="border-b border-ink/10 py-3 last:border-b-0">
            <VendorGuestReviewCard row={r} vendorName={vendorName} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function VendorGuestReviewCard({ row, vendorName }: { row: GuestReviewRow; vendorName: string }) {
  const dateLabel = new Date(row.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  return (
    <article className="space-y-2" data-guest-review-card={row.vendor_reply ? 'replied' : 'waiting'}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StarRow value={row.rating_overall} />
          <span className="text-sm font-medium text-ink">{row.shown_name}</span>
          <GuestAtEventPill />
        </div>
        <time className="ml-auto font-mono text-[11px] uppercase tracking-[0.15em] text-ink/45">{dateLabel}</time>
      </header>
      {row.service_title ? <p className="text-xs text-ink/60">For {row.service_title}</p> : null}
      {row.line ? <p className="text-sm text-ink/80">&ldquo;{row.line}&rdquo;</p> : <p className="text-xs italic text-ink/45">Stars only.</p>}
      {row.vendor_reply ? (
        <div className="rounded-md border-l-4 border-terracotta/40 bg-terracotta/[0.06] p-3 pl-4" data-guest-review-reply="posted">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta-700">Response from {vendorName}</p>
          <p className="mt-1 whitespace-pre-line text-sm text-ink/80">{row.vendor_reply}</p>
          <p className="mt-2 text-[11px] text-ink/45">Your public reply is final — it can’t be edited once posted.</p>
        </div>
      ) : (
        <form action={postVendorReply} className="space-y-2 border-t border-ink/10 pt-3" data-guest-review-reply="form">
          <input type="hidden" name="kind" value="guest" />
          <input type="hidden" name="review_id" value={row.review_id} />
          <label htmlFor={`guest_reply_${row.review_id}`} className="block font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Public reply
          </label>
          <textarea
            // field-ok: the hosts' reply box above, lifted unchanged — one reply, one look, on one list
            id={`guest_reply_${row.review_id}`}
            name="reply"
            required
            rows={2}
            maxLength={GUEST_REVIEW_REPLY_MAX}
            placeholder="Thank them — everyone who opens your page sees it…"
            className="input-field min-h-[64px] py-2"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-ink/50">Up to {GUEST_REVIEW_REPLY_MAX} characters. One public reply — final once posted.</p>
            <SubmitButton
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-mulberry px-3 py-2 text-xs font-medium text-cream hover:bg-mulberry-600 disabled:opacity-60"
              pendingLabel="Posting…"
            >
              <Reply className="h-3.5 w-3.5" strokeWidth={2} />
              Post reply
            </SubmitButton>
          </div>
        </form>
      )}
    </article>
  );
}

function VendorReviewCard({ review, vendorName }: { review: ReviewWithCouple; vendorName: string }) {
  const author = review.couple_display_name && review.couple_display_name.trim().length > 0 ? review.couple_display_name : 'Verified couple';
  const dateLabel = new Date(review.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  return (
    <article className="space-y-2" data-review-card={review.vendor_reply ? 'replied' : 'waiting'}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StarRow value={review.rating_overall} />
          <span className="text-sm font-medium text-ink">{author}</span>
          {/* Receipt-backed provenance — PLATFORM-DERIVED, a couple can't set it. */}
          {review.via_vendor_import ? <VerifiedBookingPill /> : review.booked_through_setnayan ? <VerifiedWeddingPill /> : null}
        </div>
        {/* ml-auto: when the header wraps at phone width, the date + flag stay on the RIGHT, so the flag panel (anchored
            right-0, 18 rem wide) opens inside the screen instead of off its left edge. */}
        <div className="ml-auto flex items-center gap-3">
          <time className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/45">{dateLabel}</time>
          <FlagForm reviewId={review.review_id} />
        </div>
      </header>

      {review.body ? <p className="whitespace-pre-line text-sm text-ink/80">{review.body}</p> : <p className="text-xs italic text-ink/45">No written review.</p>}

      <dl className="grid grid-cols-2 gap-2 text-[11px] text-ink/55 sm:grid-cols-4">
        <AxisStat axis="communication" value={review.rating_communication} />
        <AxisStat axis="quality" value={review.rating_quality} />
        <AxisStat axis="value" value={review.rating_value} />
        <AxisStat axis="on_time" value={review.rating_on_time} />
      </dl>

      {review.vendor_reply ? <ExistingReplySection review={review} vendorName={vendorName} /> : <ReplyForm reviewId={review.review_id} />}
    </article>
  );
}

/**
 * The supplier's single public reply, read-only. IMMUTABLE once posted (owner 2026-06-29 · one public reply per
 * review): the DB trigger `lock_vendor_reply` rejects any change, so there is no edit.
 */
function ExistingReplySection({ review, vendorName }: { review: ReviewWithCouple; vendorName: string }) {
  const repliedAt = review.vendor_reply_at
    ? new Date(review.vendor_reply_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
    : null;
  return (
    <div className="rounded-md border-l-4 border-terracotta/40 bg-terracotta/[0.06] p-3 pl-4" data-review-reply="posted">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta-700">
        Response from {vendorName}
        {repliedAt ? ` · ${repliedAt}` : null}
      </p>
      <p className="mt-1 whitespace-pre-line text-sm text-ink/80">{review.vendor_reply}</p>
      <p className="mt-2 text-[11px] text-ink/45">Your public reply is final — it can’t be edited once posted.</p>
    </div>
  );
}

function ReplyForm({ reviewId }: { reviewId: string }) {
  return (
    <form action={postVendorReply} className="space-y-2 border-t border-ink/10 pt-3" data-review-reply="form">
      <input type="hidden" name="review_id" value={reviewId} />
      <label htmlFor={`reply_${reviewId}`} className="block font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
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
          Up to {VENDOR_REPLY_MAX_CHARS} characters. One public reply — it&rsquo;s final once posted, so take a moment.
        </p>
        <SubmitButton
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-mulberry px-3 py-2 text-xs font-medium text-cream hover:bg-mulberry-600 disabled:opacity-60"
          pendingLabel="Posting…"
        >
          <Reply className="h-3.5 w-3.5" strokeWidth={2} />
          Post reply
        </SubmitButton>
      </div>
    </form>
  );
}

/** Flag as fake — a reason selector + submit, behind `<details>` (no client script for the toggle). */
function FlagForm({ reviewId }: { reviewId: string }) {
  return (
    <details className="group relative">
      <summary
        title="Flag review as fake"
        className="inline-flex min-h-11 min-w-11 cursor-pointer select-none list-none items-center justify-center gap-1 text-[11px] text-ink/40 hover:text-danger-600"
      >
        <Flag aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        <span className="sr-only">Flag as fake</span>
      </summary>
      <div className="absolute right-0 top-10 z-10 w-72 max-w-[calc(100vw-2rem)] rounded-xl bg-white p-3 shadow-lg">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">Flag review as fake</p>
        <form action={submitFlagAsFake} className="space-y-2">
          <input type="hidden" name="review_id" value={reviewId} />
          <FlagReasonPick />
        </form>
      </div>
    </details>
  );
}

/** "Verified wedding" — the couple booked you on-platform themselves (platform-stamped). */
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

/** "Verified booking" — you brought this couple onto Setnayan via your invite QR. */
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

function AxisStat({ axis, value }: { axis: ReviewAxis; value: number }) {
  return (
    <div className="rounded-md bg-ink/[0.03] px-2 py-1.5">
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">{REVIEW_AXIS_LABEL[axis]}</dt>
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
        <Star key={n} aria-hidden className={`h-4 w-4 ${n <= value ? 'fill-warn-400 text-warn-500' : 'text-ink/25'}`} strokeWidth={1.5} />
      ))}
    </span>
  );
}
