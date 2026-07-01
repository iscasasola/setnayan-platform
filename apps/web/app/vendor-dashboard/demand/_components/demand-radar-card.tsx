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
 * Shared by BOTH the standalone /vendor-dashboard/demand route AND the
 * vendor Overview's inline Demand Radar section (via DemandRadarPanel) — one
 * source of truth. Editorial `--m-*` palette throughout (Alabaster paper /
 * Obsidian ink / Champagne gold accent), matching the vendor Overview.
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
      <div
        className="rounded-xl border border-dashed p-10 text-center"
        style={{ borderColor: 'var(--m-line)', background: '#fff' }}
      >
        <Radar
          aria-hidden
          className="mx-auto h-8 w-8"
          strokeWidth={1.5}
          style={{ color: 'var(--m-slate-4)' }}
        />
        <p className="mt-3 text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
          Not enough demand data yet
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm" style={{ color: 'var(--m-slate)' }}>
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
      <section
        className="overflow-hidden rounded-xl border"
        style={{ borderColor: 'var(--m-line)', background: '#fff' }}
      >
        <header
          className="flex items-center justify-between gap-2 border-b px-4 py-3"
          style={{ borderColor: 'var(--m-line)' }}
        >
          <h3 className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
            Month heat
          </h3>
          <span className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
            Demand by the month events are happening
          </span>
        </header>
        <ul className="divide-y" style={{ borderColor: 'var(--m-line-soft)' }}>
          {radar.months.map((m) => (
            <li
              key={m.month}
              className="flex items-center gap-3 border-t px-4 py-3 first:border-t-0"
              style={{ borderColor: 'var(--m-line-soft)' }}
            >
              <span
                className="w-20 shrink-0 text-sm font-medium"
                style={{ color: 'var(--m-ink)' }}
              >
                {m.label}
              </span>
              <span
                className="relative h-2.5 flex-1 overflow-hidden rounded-full"
                style={{ background: 'var(--m-paper-2)' }}
              >
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${Math.round((m.total / maxMonth) * 100)}%`,
                    background: 'var(--m-orange)',
                  }}
                />
              </span>
              <span
                className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums"
                style={{ color: 'var(--m-slate)' }}
              >
                {m.total}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Hot looks */}
      <section
        className="overflow-hidden rounded-xl border"
        style={{ borderColor: 'var(--m-line)', background: '#fff' }}
      >
        <header
          className="flex items-center justify-between gap-2 border-b px-4 py-3"
          style={{ borderColor: 'var(--m-line)' }}
        >
          <h3 className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
            Hot looks
          </h3>
          <span className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
            Capture styles couples are choosing
          </span>
        </header>
        <ul className="divide-y" style={{ borderColor: 'var(--m-line-soft)' }}>
          {topLooks.map((l) => (
            <li
              key={l.style}
              className="flex items-center justify-between gap-3 border-t px-4 py-3 first:border-t-0"
              style={{ borderColor: 'var(--m-line-soft)' }}
            >
              <span className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                {l.label}
              </span>
              <span className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
                <span className="font-semibold tabular-nums" style={{ color: 'var(--m-slate)' }}>
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
          <section
            className="overflow-hidden rounded-xl border"
            style={{ borderColor: 'var(--m-line)', background: '#fff' }}
          >
            <header
              className="flex items-center justify-between gap-2 border-b px-4 py-3"
              style={{ borderColor: 'var(--m-line)' }}
            >
              <h3 className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
                Top regions
              </h3>
              <span className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
                Demand by market
              </span>
            </header>
            <ul className="divide-y" style={{ borderColor: 'var(--m-line-soft)' }}>
              {topRegions.map((r) => (
                <li
                  key={r.region || '(unspecified)'}
                  className="flex items-center justify-between gap-3 border-t px-4 py-3 first:border-t-0"
                  style={{ borderColor: 'var(--m-line-soft)' }}
                >
                  <span className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                    {r.label}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
                    <span className="tabular-nums">{r.inquiries}</span> inq ·{' '}
                    <span className="tabular-nums">{r.unlocks}</span> unlocks ·{' '}
                    <span className="tabular-nums">{r.bookings}</span> bookings
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section
            className="overflow-hidden rounded-xl border"
            style={{ borderColor: 'var(--m-line)', background: '#fff' }}
          >
            <header
              className="flex items-center justify-between gap-2 border-b px-4 py-3"
              style={{ borderColor: 'var(--m-line)' }}
            >
              <h3 className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
                By event type
              </h3>
              <span className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
                Where the demand sits
              </span>
            </header>
            <ul className="divide-y" style={{ borderColor: 'var(--m-line-soft)' }}>
              {topEventTypes.map((et) => (
                <li
                  key={et.eventType}
                  className="flex items-center justify-between gap-3 border-t px-4 py-3 first:border-t-0"
                  style={{ borderColor: 'var(--m-line-soft)' }}
                >
                  <span className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                    {et.label}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
                    <span className="font-semibold tabular-nums" style={{ color: 'var(--m-slate)' }}>
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
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: 'var(--m-line)', background: '#fff' }}
    >
      <span
        className="inline-flex items-center gap-1.5 text-xs font-medium"
        style={{ color: 'var(--m-slate-3)' }}
      >
        <span style={{ color: 'var(--m-orange-2)' }}>{icon}</span>
        {label}
      </span>
      <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: 'var(--m-ink)' }}>
        {value}
      </p>
    </div>
  );
}
