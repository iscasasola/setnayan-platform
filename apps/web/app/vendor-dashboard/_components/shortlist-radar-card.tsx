import { Heart, Radar } from 'lucide-react';
import { getShortlistRadar } from '../actions';

/**
 * Shortlist Radar card (Wave 2 vendor benefit · 2026-06-29).
 *
 * Two de-identified demand signals on the vendor home:
 *   1. A live "N couples saved you" tally — distinct savers across follows +
 *      guest bookmarks, read via the count_saves_for_vendor RPC. Never exposes
 *      who saved (guest_saved_vendors stays owner-only at the RLS layer; the
 *      vendor sees only the aggregate count).
 *   2. A "rival in your area" feed — de-identified (month, region, count)
 *      demand rollup from rival_signals_for_vendor. The RPC honors the
 *      admin radar_enabled toggle + min-N floor, so a below-floor cell that
 *      could re-identify a single couple never reaches this component, and no
 *      couple identity (no user_id / event_id / name) is ever present.
 *
 * Mounted on /vendor-dashboard home as its own server component (separate file
 * from vendor-stats-panel.tsx to avoid a merge collision with the parallel
 * First-Look PR editing that file). Degrades to an empty/zero state on any
 * error — getShortlistRadar() is best-effort.
 *
 * ADMIN surface = the radar_enabled toggle + radar_min_n_floor already live on
 * platform_settings (admin-managed config); no new admin UI is needed here.
 * COUPLE surface = none (their saves already exist).
 */

const MONTH_FMT = new Intl.DateTimeFormat('en-PH', {
  month: 'long',
  year: 'numeric',
});

function formatMonth(monthBucket: string): string {
  // month_bucket is a DATE (first-of-month) string from the RPC.
  const d = new Date(`${monthBucket}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 'an upcoming';
  return MONTH_FMT.format(d);
}

export async function ShortlistRadarCard() {
  const { savedCount, signals } = await getShortlistRadar();

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="m-label-mono" style={{ color: 'var(--m-slate)' }}>
          Shortlist Radar
        </h2>
        <span className="text-xs text-ink/45">Demand near you</span>
      </div>

      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        {/* Live saved-you tally */}
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terracotta/[0.1] text-terracotta">
            <Heart className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div>
            <p className="font-display text-2xl font-semibold tabular-nums text-ink">
              {savedCount === 1
                ? '1 couple saved you'
                : `${savedCount} couples saved you`}
            </p>
            <p className="text-xs text-ink/55">
              Couples who followed or bookmarked your profile to plan with later.
            </p>
          </div>
        </div>

        {/* De-identified rival-in-your-area feed */}
        <div className="mt-5 border-t border-ink/10 pt-4">
          <div className="mb-3 flex items-center gap-2 text-ink/55">
            <Radar className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            <span className="m-label-mono text-xs">Rival on your dates</span>
          </div>

          {signals.length === 0 ? (
            <p className="text-sm text-ink/65">
              No demand signals in your area yet. As couples nearby start
              shortlisting vendors, you&rsquo;ll see the months and regions
              heating up here — never any couple&rsquo;s identity, just the trend.
            </p>
          ) : (
            <ul className="space-y-2">
              {signals.slice(0, 6).map((s) => (
                <li
                  key={`${s.month_bucket}-${s.region_code}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-ink/10 bg-cream px-4 py-3"
                >
                  <p className="text-sm text-ink">
                    A couple planning a{' '}
                    <span className="font-medium">{formatMonth(s.month_bucket)}</span>{' '}
                    wedding in{' '}
                    <span className="font-medium">{s.region_code}</span> added a
                    vendor in your area to their shortlist.
                  </p>
                  <span className="shrink-0 rounded-full bg-ink/[0.05] px-2 py-0.5 text-xs font-medium tabular-nums text-ink/70">
                    {s.signal_count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
