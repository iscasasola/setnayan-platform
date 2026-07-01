import { CheckCircle2, Banknote, CalendarClock, Trophy } from 'lucide-react';
import { formatPhp } from '@/lib/vendors';
import { formatDuration, type ConversionAnalytics } from '@/lib/vendor-conversion-analytics';

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
    <div className="rounded-lg border bg-white p-5" style={{ borderColor: 'var(--m-line)' }}>
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

export function ConversionDealsCard({ data }: { data: ConversionAnalytics }) {
  const { quote, deal, lead, winLoss } = data;

  const acceptanceValue =
    quote.acceptancePct === null ? '—' : `${Math.round(quote.acceptancePct)}%`;
  const dealAvg = deal.avgContractPhp ?? deal.avgQuotedPhp;
  const dealValue = dealAvg === null ? '—' : formatPhp(Math.round(dealAvg));
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
              ? `${deal.bookedPricedCount} priced booking${deal.bookedPricedCount === 1 ? '' : 's'}`
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
              ? `${lead.bookedWithDateCount} dated · avg ${Math.round(lead.avgLeadDays)}d before the event`
              : 'No dated bookings yet'
          }
        />
      </div>

      {/* Deals & wins detail */}
      <div className="rounded-lg border bg-white p-5" style={{ borderColor: 'var(--m-line)' }}>
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
                {w.value}
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
              {deal.totalContractPhp > 0 ? formatPhp(Math.round(deal.totalContractPhp)) : '—'}
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
