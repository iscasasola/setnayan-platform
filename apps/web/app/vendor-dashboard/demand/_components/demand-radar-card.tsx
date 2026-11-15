import { Radar, MessageSquare, KeyRound, CheckCircle2 } from 'lucide-react';
import type { DemandRadar } from '@/lib/demand-radar';
import { InfoTip } from '@/app/_components/info-tip';
import { formatCount } from '@/lib/format-number';

/**
 * DemandRadarCard — presentational radar (server component, no client JS).
 *
 * Renders three projections from the assembled, already-min-N-suppressed
 * DemandRadar: a month heat strip, top looks, and (admin scope) top regions +
 * event types. Counts only — the props carry no couple identity by construction
 * (see lib/demand-radar.ts / migration 20270324631500).
 *
 * Empty/suppressed → an honest "not enough demand data yet" state. Never
 * fabricates a trend. Founder-only marketplace lands here most of the time
 * today, which is expected and correct.
 *
 * Doorway-idiomatic styling: vendor scope uses the vendor ink/cream/terracotta
 * tokens; admin scope reuses the same primitives (the admin doorway tolerates
 * them and they read consistently with /admin/intelligence's calm tables).
 */
export function DemandRadarCard({
  radar,
  marketLabel,
  scope,
  unreadable = false,
}: {
  radar: DemandRadar;
  marketLabel: string | null;
  scope: 'vendor' | 'admin';
  /** true = the radar read was REFUSED, not below the min-N floor — say we
   *  couldn't check, never "not enough demand data yet" (S41c). */
  unreadable?: boolean;
}) {
  if (unreadable) {
    return (
      <div className="py-3">
        <p className="flex items-center gap-2 text-sm font-medium text-ink">
          <Radar aria-hidden className="h-4 w-4 flex-none text-[color:var(--m-slate-2)]" strokeWidth={1.75} />
          We couldn&rsquo;t load {scope === 'admin' ? 'the' : 'your'} demand radar right now
        </p>
        <p className="mt-1 text-[13px] text-[color:var(--m-slate-2)]">
          This is on our side, not a sign {scope === 'admin' ? 'the' : 'your'} market is quiet. Refresh in a
          moment.
        </p>
      </div>
    );
  }

  if (!radar.hasData) {
    return (
      <div className="flex items-center gap-2 py-3">
        <Radar aria-hidden className="h-4 w-4 flex-none text-[color:var(--m-slate-2)]" strokeWidth={1.75} />
        <InfoTip label="Not enough demand data yet" labelClassName="text-sm font-medium text-ink" align="start">
          {scope === 'vendor' ? (
            <>
              The radar fills in once there&rsquo;s enough activity in{' '}
              {marketLabel ?? 'your area'} that we can show it without revealing
              any single couple. Check back as more couples start planning near
              you.
            </>
          ) : (
            <>
              No market cell has cleared the min-N privacy floor yet. As demand
              grows across regions, de-identified rollups will appear here. You
              can lower the floor in platform settings, but only down to a value
              that still protects individual couples.
            </>
          )}
        </InfoTip>
      </div>
    );
  }

  const maxMonth = Math.max(1, ...radar.months.map((m) => m.total));
  const topLooks = radar.looks.slice(0, 5);
  const topRegions = radar.regions.slice(0, 8);
  const topEventTypes = radar.eventTypes.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Signal summary */}
      <div className="grid grid-cols-3 gap-3 border-y border-[color:var(--m-line)] py-3">
        <SignalTile
          icon={<MessageSquare aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
          label="Inquiries"
          value={radar.months.reduce((s, m) => s + m.inquiries, 0)}
        />
        <SignalTile
          icon={<KeyRound aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
          label="Paid unlocks"
          value={radar.months.reduce((s, m) => s + m.unlocks, 0)}
        />
        <SignalTile
          icon={<CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
          label="Bookings"
          value={radar.months.reduce((s, m) => s + m.bookings, 0)}
        />
      </div>

      {/* Month heat strip */}
      <section>
        <header className="flex items-center justify-between gap-2 pb-1">
          <h2 className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]">Month heat</h2>
          <span className="text-[13px] text-[color:var(--m-slate-2)]">
            Demand by the month events are happening
          </span>
        </header>
        <ul className="divide-y divide-[color:var(--m-line)] border-t border-[color:var(--m-line)]">
          {radar.months.map((m) => (
            <li key={m.month} className="flex min-h-14 items-center gap-3 py-3">
              <span className="w-20 shrink-0 text-sm font-medium text-ink">
                {m.label}
              </span>
              <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-ink/[0.06]">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-terracotta/70"
                  style={{ width: `${Math.round((m.total / maxMonth) * 100)}%` }}
                />
              </span>
              <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-ink">
                {formatCount(m.total)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Hot looks */}
      <section>
        <header className="flex items-center justify-between gap-2 pb-1">
          <h2 className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]">Hot looks</h2>
          <span className="text-[13px] text-[color:var(--m-slate-2)]">
            Capture styles couples are choosing
          </span>
        </header>
        <ul className="divide-y divide-[color:var(--m-line)] border-t border-[color:var(--m-line)]">
          {topLooks.map((l) => (
            <li
              key={l.style}
              className="flex min-h-14 items-center justify-between gap-3 py-3"
            >
              <span className="text-sm font-medium text-ink">{l.label}</span>
              <span className="text-[13px] text-[color:var(--m-slate-2)]">
                <span className="font-semibold tabular-nums text-ink">
                  {formatCount(l.total)}
                </span>{' '}
                signals
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Admin-only breakdowns: regions + event types */}
      {scope === 'admin' ? (
        <>
          <section>
            <header className="flex items-center justify-between gap-2 pb-1">
              <h2 className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]">Top regions</h2>
              <span className="text-[13px] text-[color:var(--m-slate-2)]">Demand by market</span>
            </header>
            <ul className="divide-y divide-[color:var(--m-line)] border-t border-[color:var(--m-line)]">
              {topRegions.map((r) => (
                <li
                  key={r.region || '(unspecified)'}
                  className="flex min-h-14 items-center justify-between gap-3 py-3"
                >
                  <span className="text-sm font-medium text-ink">{r.label}</span>
                  <span className="text-[13px] text-[color:var(--m-slate-2)]">
                    <span className="tabular-nums">{formatCount(r.inquiries)}</span> inq ·{' '}
                    <span className="tabular-nums">{formatCount(r.unlocks)}</span> unlocks ·{' '}
                    <span className="tabular-nums">{formatCount(r.bookings)}</span> bookings
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <header className="flex items-center justify-between gap-2 pb-1">
              <h2 className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]">By event type</h2>
              <span className="text-[13px] text-[color:var(--m-slate-2)]">Where the demand sits</span>
            </header>
            <ul className="divide-y divide-[color:var(--m-line)] border-t border-[color:var(--m-line)]">
              {topEventTypes.map((et) => (
                <li
                  key={et.eventType}
                  className="flex min-h-14 items-center justify-between gap-3 py-3"
                >
                  <span className="text-sm font-medium text-ink">{et.label}</span>
                  <span className="text-[13px] text-[color:var(--m-slate-2)]">
                    <span className="font-semibold tabular-nums text-ink">
                      {formatCount(et.total)}
                    </span>{' '}
                    signals
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}

function SignalTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="grid min-h-11 content-center gap-0.5 text-center">
      <span className="inline-flex items-center justify-center gap-1.5 text-[12px] text-[color:var(--m-slate-2)]">
        {icon}
        {label}
      </span>
      <p className="text-[24px] font-bold leading-none tabular-nums text-ink">{value}</p>
    </div>
  );
}
