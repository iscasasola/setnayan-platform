import { ShieldCheck, Star } from 'lucide-react';
import { formatGuestAverage, type GuestReviewRow, type GuestReviewsRead } from '@/lib/guest-reviews';

/**
 * ⭐ THE TWO REVIEW GROUPS on a shop's page — prototype § 5 ("one For line") and § 9 ("Where each shows"), owner
 * rulings 6 Nov:
 *
 *   · The shop's OVERALL is the hosts' number (option A): `vendor_trusted_review_stats`, untouched. A guest review
 *     NEVER moves it — it gets its own line under it ("4.9 ★ from 40 guests").
 *   · "From the hosts" rows are the shipped ReviewRow plus ONE "For <card> · see the card" line.
 *   · "From guests" rows are compact: photo thumb (if any) · stars · name · the blue "Guest at the event" chip (not
 *     the gold Verified booking — a different claim) · the line. No axis boxes: a guest has none.
 *   · A shop with no guest reviews shows no guest group at all; a refused read SAYS so (never an empty group).
 *
 * Presentational only — every read happens in the page, so this file can be drawn by the dev lab with dummy rows.
 */

/** "From the hosts" / "From guests" — the prototype's `.grp` head: mono caps with a trailing rule. */
export function ReviewGroupHead({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/60 after:h-px after:flex-1 after:bg-ink/10"
      data-review-group-head
    >
      {children}
    </p>
  );
}

/** The guests' own line under the hosts' overall — "4.9 ★ from 40 guests". Nothing when there are none. */
export function GuestStarsLine({ read }: { read: GuestReviewsRead }) {
  if (read.state !== 'rows' || read.stats.count === 0) return null;
  const { average, count } = read.stats;
  return (
    <p className="text-sm text-ink/80" data-guest-stars-line>
      {formatGuestAverage(average)} ★ from {count.toLocaleString('en-PH')} guest{count === 1 ? '' : 's'}
    </p>
  );
}

export type ReviewCardLink = { title: string; anchorId: string; photoUrl: string | null };

/** "For <card> · see the card" — 28 px thumb, links to the card above. No card on the review → nothing, never a guess. */
export function ReviewForLine({ card }: { card: ReviewCardLink | null }) {
  if (!card) return null;
  return (
    <a
      href={`#${card.anchorId}`}
      className="mt-2 inline-flex items-center gap-2 text-xs text-ink/70 hover:text-ink"
      data-review-for-line
    >
      <span className="block h-7 w-7 shrink-0 overflow-hidden rounded-md bg-ink/5">
        {card.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- the card's own public cover
          <img src={card.photoUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
      </span>
      <span>
        For <b className="font-semibold text-ink">{card.title}</b> · <u>see the card</u>
      </span>
    </a>
  );
}

export function SmallStars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden
          className={`h-3.5 w-3.5 ${n <= value ? 'fill-warn-400 text-warn-500' : 'text-ink/25'}`}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

/** The blue chip — "Guest at the event". A different claim from the hosts' Verified booking, so a different colour. */
export function GuestAtEventPill() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-link/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-link">
      <ShieldCheck aria-hidden className="h-3 w-3" strokeWidth={2} />
      Guest at the event
    </span>
  );
}

/** One compact guest row. */
export function GuestReviewItem({
  row,
  photoUrl,
  vendorName,
}: {
  row: GuestReviewRow;
  photoUrl: string | null;
  vendorName: string;
}) {
  return (
    <article className="border-t border-ink/10 py-2.5 first:border-t-0" data-guest-review-row>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {photoUrl ? (
          <span className="block h-7 w-7 shrink-0 overflow-hidden rounded-md bg-ink/5">
            {/* eslint-disable-next-line @next/next/no-img-element -- the guest's own shot, through the blur gate */}
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          </span>
        ) : null}
        <SmallStars value={row.rating_overall} />
        <span className="text-sm font-medium text-ink">{row.shown_name}</span>
        <GuestAtEventPill />
      </div>
      {row.line ? <q className="mt-1 block text-sm text-ink/80">{row.line}</q> : null}
      {row.vendor_reply ? (
        <div className="mt-2 border-l-2 border-ink/15 pl-3 text-xs text-ink/70" data-guest-review-reply>
          <p className="font-medium text-ink/80">Response from {vendorName}</p>
          <p className="mt-0.5 whitespace-pre-line">{row.vendor_reply}</p>
        </div>
      ) : null}
    </article>
  );
}

/**
 * The "From guests" group on the shop page. `shown` rows draw; the rest fold into "+ N more guests". Refused → said.
 */
export function GuestReviewsGroup({
  read,
  photoUrlByCapture,
  vendorName,
  shown = 5,
}: {
  read: GuestReviewsRead;
  photoUrlByCapture: ReadonlyMap<string, string>;
  vendorName: string;
  shown?: number;
}) {
  if (read.state === 'none') return null;
  if (read.state === 'refused') {
    return (
      <div id="guest-reviews" className="scroll-mt-24 space-y-2" data-guest-reviews="unread">
        <ReviewGroupHead>From guests</ReviewGroupHead>
        <p role="alert" className="text-sm text-ink/65">
          We couldn&rsquo;t load the guests&rsquo; reviews just now.
        </p>
      </div>
    );
  }
  const visible = read.rows.slice(0, shown);
  const more = Math.max(0, read.stats.count - visible.length);
  return (
    <div id="guest-reviews" className="scroll-mt-24 space-y-2" data-guest-reviews="rows">
      <ReviewGroupHead>From guests</ReviewGroupHead>
      <div className="flex items-center gap-2 text-xs">
        <SmallStars value={Math.round(read.stats.average)} />
        <span className="font-mono text-ink/60">
          {formatGuestAverage(read.stats.average)} · {read.stats.count.toLocaleString('en-PH')} guest
          {read.stats.count === 1 ? '' : 's'}
        </span>
      </div>
      <div className="px-0.5">
        {visible.map((r) => (
          <GuestReviewItem
            key={r.review_id}
            row={r}
            photoUrl={r.capture_id ? (photoUrlByCapture.get(r.capture_id) ?? null) : null}
            vendorName={vendorName}
          />
        ))}
      </div>
      {more > 0 ? (
        <p className="text-xs text-ink/60">
          + {more.toLocaleString('en-PH')} more guest{more === 1 ? '' : 's'}
        </p>
      ) : null}
    </div>
  );
}
