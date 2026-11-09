import { CheckCircle2, Banknote, CalendarClock, Trophy } from 'lucide-react';
import { formatPhp } from '@/lib/orders';
import { formatDuration, type ConversionAnalytics } from '@/lib/vendor-conversion-analytics';
import { CountUp } from './count-up';
import { CardFace } from './card-face';
import { formatCount } from '@/lib/format-number';

/**
 * "Conversion & deals" — My Performance · Phase B family 2 (Pro tier). Four
 * own-business reads off ownership-gated RPCs: quote acceptance + time-to-quote,
 * deal size (quoted + confirmed contract), booking lead time, and win/loss.
 *
 * Server component, honest empty states. Peso figures are partial (off-platform
 * settlement); win rate is "of decided inquiries" (the silent-loss class isn't
 * counted) — both stated in the card.
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

export function ConversionDealsCard({
  data,
  compact = false,
}: {
  data: ConversionAnalytics | null;
  /**
   * 🃏 Shop › Analytics' "deals" face (THE ONE BUILD A3 W8): the quote-acceptance gauge and "X of Y quotes accepted".
   * ✂ No "first quote in 5h" — nothing measures a time to the first quote (map row 28). `data === null` = unread.
   */
  compact?: boolean;
}) {
  if (compact) {
    const q = data?.quote ?? null;
    const pct = q && q.acceptancePct !== null ? Math.max(0, Math.min(100, Math.round(q.acceptancePct))) : null;
    const line =
      q === null
        ? 'Couldn’t load'
        : q.sentCount > 0
          ? `${formatCount(q.acceptedCount)} of ${formatCount(q.sentCount)} quotes accepted`
          : 'No quotes sent yet';
    // A half-ring: 0% at the left, 100% at the right (the arc's own length, so no number is invented).
    const ARC = Math.PI * 40;
    return (
      <CardFace title="Quotes that turn into bookings" window="Last 12 months" line={line} data="deals" quiet={q === null || q.sentCount === 0}>
        <svg viewBox="0 0 100 58" className="mx-auto block w-[150px]" role="img" aria-label={pct === null ? 'No acceptance rate yet' : `${pct}% of quotes accepted`}>
          <path d="M10,50 A40,40 0 0 1 90,50" fill="none" stroke="color-mix(in srgb, var(--m-ink) 8%, transparent)" strokeWidth="9" strokeLinecap="round" />
          {pct !== null && pct > 0 ? (
            <path d="M10,50 A40,40 0 0 1 90,50" fill="none" stroke="var(--m-orange)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(ARC * pct) / 100} ${ARC}`} />
          ) : null}
          <text x="50" y="48" textAnchor="middle" fontSize="17" fontWeight="600" fill="currentColor">
            {pct === null ? '—' : `${pct}%`}
          </text>
        </svg>
      </CardFace>
    );
  }
  if (!data) return null;
  const { quote, deal, lead, winLoss } = data;

  const acceptanceValue =
    quote.acceptancePct === null ? '—' : `${Math.round(quote.acceptancePct)}%`;
  const dealAvg = deal.avgContractPhp ?? deal.avgQuotedPhp;
  const dealValue = dealAvg === null ? '—' : formatPhp(dealAvg);
  const leadValue =
    lead.medianLeadDays === null ? '—' : `${Math.round(lead.medianLeadDays)} days`;

  const winItems = [
    { label: 'Won', value: winLoss.bookingsWon },
    { label: 'Inquiries declined', value: winLoss.inquiriesDeclined },
    { label: 'Quotes lost', value: winLoss.quotesLost },
  ];

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold" style={{ color: 'var(--m-ink)' }}>
        Conversion &amp; deals
      </h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile
          icon={<CheckCircle2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
          label="Quote acceptance"
          value={acceptanceValue}
          sub={
            quote.sentCount > 0
              ? `${quote.acceptedCount}/${quote.sentCount} quotes accepted`
              : 'No quotes sent yet'
          }
        />
        <Tile
          icon={<Banknote className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
          label="Avg deal size"
          value={dealValue}
          sub={
            deal.bookedPricedCount > 0
              ? `${formatCount(deal.bookedPricedCount)} priced booking${deal.bookedPricedCount === 1 ? '' : 's'}`
              : deal.avgQuotedPhp !== null
                ? 'From accepted quotes'
                : 'No priced deals yet'
          }
        />
        <Tile
          icon={<CalendarClock className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
          label="Median lead time"
          value={leadValue}
          sub={
            lead.bookedWithDateCount > 0 && lead.avgLeadDays !== null
              ? `${formatCount(lead.bookedWithDateCount)} dated · avg ${Math.round(lead.avgLeadDays)}d before the event`
              : 'No dated bookings yet'
          }
        />
      </div>

      {/* Deals & wins detail */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5" style={{ color: 'var(--m-slate)' }}>
            <Trophy className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            <span className="font-mono text-[11px] uppercase tracking-[0.15em]">
              Deals &amp; wins
            </span>
          </div>
          {winLoss.winRateOfDecided !== null && (
            <span className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
              {Math.round(winLoss.winRateOfDecided)}% win rate
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {winItems.map((w) => (
            <div key={w.label}>
              <p className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--m-ink)' }}>
                <CountUp value={w.value} />
              </p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--m-slate-3)' }}>
                {w.label}
              </p>
            </div>
          ))}
        </div>
        <div
          className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t pt-3 text-xs"
          style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate)' }}
        >
          <span>
            Total booked value:{' '}
            <span className="font-medium" style={{ color: 'var(--m-ink)' }}>
              {deal.totalContractPhp > 0 ? formatPhp(deal.totalContractPhp) : '—'}
            </span>
          </span>
          <span>
            Avg time to quote:{' '}
            <span className="font-medium" style={{ color: 'var(--m-ink)' }}>
              {quote.quotedWithInquiryCount > 0 ? formatDuration(quote.avgHoursToQuote) : '—'}
            </span>
          </span>
        </div>
        <p className="mt-3 text-[11px]" style={{ color: 'var(--m-slate-3)' }}>
          Win rate is of decided inquiries (won vs declined) — open and stale
          inquiries aren&apos;t counted. Peso figures cover on-platform priced
          bookings only.
        </p>
      </div>
    </section>
  );
}
