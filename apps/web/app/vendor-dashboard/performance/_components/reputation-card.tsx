import { Star, MessageCircle, Clock } from 'lucide-react';
import {
  formatReplyLatency,
  type ReputationAnalytics,
} from '@/lib/vendor-reputation-analytics';
import { CountUp } from './count-up';

/**
 * "Reputation" — My Performance · Phase B family 3 (Pro tier). Own-business
 * reads: overall rating + count, reply-to-review coverage, avg reply time, the
 * 5→1 star distribution, and a 12-month review-velocity + rating-trend strip.
 * Server component, honest empty states. (Sentiment/themes deferred — no
 * derived column captured yet.)
 */

function Tile({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5" style={{ color: 'var(--m-slate)' }}>
        {icon}
        <span className="font-mono text-[11px] uppercase tracking-[0.15em]">{label}</span>
      </div>
      <p className="text-3xl font-semibold tabular-nums" style={{ color: 'var(--m-ink)' }}>
        {value}
      </p>
      <p className="mt-1 text-xs" style={{ color: 'var(--m-slate-3)' }}>
        {sub}
      </p>
    </div>
  );
}

export function ReputationCard({ data }: { data: ReputationAnalytics }) {
  const { coverage, monthly } = data;
  const total = coverage.totalReviews;

  const dist = [
    { star: 5, n: coverage.distribution.five },
    { star: 4, n: coverage.distribution.four },
    { star: 3, n: coverage.distribution.three },
    { star: 2, n: coverage.distribution.two },
    { star: 1, n: coverage.distribution.one },
  ];

  const velocityMax = monthly.reduce((m, p) => Math.max(m, p.count), 0);
  const hasVelocity = velocityMax > 0;

  return (
    <section className="space-y-4">
      {/* No card-level <h2>: this card is the sole child of the page's
          "Reputation · all-time" SectionEyebrow, so a heading here just
          repeated the eyebrow two lines down. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile
          icon={<Star className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
          label="Overall rating"
          value={coverage.avgRating === null ? '—' : `${(Math.round(coverage.avgRating * 10) / 10).toFixed(1)}★`}
          sub={total > 0 ? `Across ${total} review${total === 1 ? '' : 's'}` : 'No reviews yet'}
        />
        <Tile
          icon={<MessageCircle className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
          label="Reply coverage"
          value={coverage.coveragePct === null ? '—' : `${Math.round(coverage.coveragePct)}%`}
          sub={
            total > 0
              ? `${coverage.repliedCount}/${total} reviews answered`
              : 'Reply to reviews to build trust'
          }
        />
        <Tile
          icon={<Clock className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
          label="Avg reply time"
          value={coverage.repliedCount > 0 ? formatReplyLatency(coverage.avgReplyHours) : '—'}
          sub={coverage.repliedCount > 0 ? 'From review posted to your reply' : 'No replies yet'}
        />
      </div>

      {/* Star distribution */}
      {total > 0 && (
        <div>
          <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em]" style={{ color: 'var(--m-slate)' }}>
            Rating breakdown
          </div>
          <div className="space-y-1.5">
            {dist.map((d) => {
              const pct = total > 0 ? (d.n / total) * 100 : 0;
              return (
                <div key={d.star} className="flex items-center gap-2">
                  <span className="w-8 font-mono text-[11px] tabular-nums" style={{ color: 'var(--m-slate)' }}>
                    {d.star}★
                  </span>
                  <div className="h-3 flex-1 overflow-hidden rounded-sm" style={{ background: 'var(--m-paper)' }}>
                    <div
                      className="perf-bar-grow h-full rounded-sm"
                      style={{ width: `${pct}%`, background: 'var(--m-orange-2)', minWidth: d.n > 0 ? 3 : 0 }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs tabular-nums" style={{ color: 'var(--m-slate-3)' }}>
                    <CountUp value={d.n} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Review velocity — reviews per month, last 12 months */}
      <div>
        <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em]" style={{ color: 'var(--m-slate)' }}>
          Reviews per month
        </div>
        {hasVelocity ? (
          <>
            <div className="flex h-16 items-end gap-1">
              {monthly.map((p) => {
                const h = p.count === 0 ? 0 : Math.max((p.count / velocityMax) * 100, 8);
                const isLast = p === monthly[monthly.length - 1];
                return (
                  <div key={p.month} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="perf-bar-grow-y w-full rounded-t-sm"
                        style={{
                          height: `${h}%`,
                          minHeight: p.count > 0 ? 2 : 0,
                          background: isLast ? 'var(--m-orange-2)' : 'var(--m-orange)',
                        }}
                        title={`${p.label}: ${p.count} review${p.count === 1 ? '' : 's'}${p.avgRating !== null ? ` · avg ${(Math.round(p.avgRating * 10) / 10).toFixed(1)}★` : ''}`}
                      />
                    </div>
                    <span className="font-mono text-[9px] leading-none" style={{ color: 'var(--m-slate-3)' }}>
                      {p.label.charAt(0)}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px]" style={{ color: 'var(--m-slate-3)' }}>
              Last 12 months · hover a bar for that month&apos;s average rating
            </p>
          </>
        ) : (
          <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
            No reviews in the last 12 months yet.
          </p>
        )}
      </div>
    </section>
  );
}
