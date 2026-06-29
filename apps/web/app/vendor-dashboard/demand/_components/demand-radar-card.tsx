import { Radar, MessageSquare, KeyRound, CheckCircle2 } from 'lucide-react';
import type { DemandRadar } from '@/lib/demand-radar';

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
}: {
  radar: DemandRadar;
  marketLabel: string | null;
  scope: 'vendor' | 'admin';
}) {
  if (!radar.hasData) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/15 bg-white p-10 text-center">
        <Radar aria-hidden className="mx-auto h-8 w-8 text-ink/30" strokeWidth={1.5} />
        <p className="mt-3 text-sm font-medium text-ink">
          Not enough demand data yet
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink/55">
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
        </p>
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
      <div className="grid grid-cols-3 gap-3">
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
      <section className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
        <header className="flex items-center justify-between gap-2 border-b border-ink/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Month heat</h2>
          <span className="text-xs text-ink/55">
            Demand by the month events are happening
          </span>
        </header>
        <ul className="divide-y divide-ink/[0.06]">
          {radar.months.map((m) => (
            <li key={m.month} className="flex items-center gap-3 px-4 py-3">
              <span className="w-20 shrink-0 text-sm font-medium text-ink">
                {m.label}
              </span>
              <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-ink/[0.06]">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-terracotta/70"
                  style={{ width: `${Math.round((m.total / maxMonth) * 100)}%` }}
                />
              </span>
              <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-ink/80">
                {m.total}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Hot looks */}
      <section className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
        <header className="flex items-center justify-between gap-2 border-b border-ink/10 px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Hot looks</h2>
          <span className="text-xs text-ink/55">
            Capture styles couples are choosing
          </span>
        </header>
        <ul className="divide-y divide-ink/[0.06]">
          {topLooks.map((l) => (
            <li
              key={l.style}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <span className="text-sm font-medium text-ink">{l.label}</span>
              <span className="text-xs text-ink/55">
                <span className="font-semibold tabular-nums text-ink/80">
                  {l.total}
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
          <section className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
            <header className="flex items-center justify-between gap-2 border-b border-ink/10 px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">Top regions</h2>
              <span className="text-xs text-ink/55">Demand by market</span>
            </header>
            <ul className="divide-y divide-ink/[0.06]">
              {topRegions.map((r) => (
                <li
                  key={r.region || '(unspecified)'}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="text-sm font-medium text-ink">{r.label}</span>
                  <span className="text-xs text-ink/55">
                    <span className="tabular-nums">{r.inquiries}</span> inq ·{' '}
                    <span className="tabular-nums">{r.unlocks}</span> unlocks ·{' '}
                    <span className="tabular-nums">{r.bookings}</span> bookings
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
            <header className="flex items-center justify-between gap-2 border-b border-ink/10 px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">By event type</h2>
              <span className="text-xs text-ink/55">Where the demand sits</span>
            </header>
            <ul className="divide-y divide-ink/[0.06]">
              {topEventTypes.map((et) => (
                <li
                  key={et.eventType}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="text-sm font-medium text-ink">{et.label}</span>
                  <span className="text-xs text-ink/55">
                    <span className="font-semibold tabular-nums text-ink/80">
                      {et.total}
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
    <div className="rounded-2xl border border-ink/10 bg-white p-4">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink/55">
        <span className="text-terracotta">{icon}</span>
        {label}
      </span>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}
