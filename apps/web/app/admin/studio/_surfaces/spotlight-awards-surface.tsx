/**
 * SpotlightAwardsSurface — the Spotlight Awards curation body, re-homed
 * byte-identical from app/admin/spotlight-awards/page.tsx into the tabbed
 * /admin/studio studio (Studio Studio slice 3 · Marketing lane).
 *
 * The curation surface for the monthly vendor recognition program. Three jobs:
 *   1. RECOMPUTE — "Run now" snapshots the current-period AUTO winners
 *      (top_pick + most_booked) from the live badge engine into
 *      `vendor_spotlight_awards`. Cron-free: this button (or a Next after()
 *      piggyback in the admin layout) is the ONLY way the table is written;
 *      there is no poller.
 *   2. CONFIRM / OVERRIDE — admins can hand-add a 'rising' award (or any type)
 *      for a vendor, and remove rows. Admin-added rows are awarded_by='admin'
 *      and are PRESERVED across re-runs.
 *   3. HOMEPAGE FEATURE — toggle `is_homepage_featured`. ⚠ The homepage strip
 *      renders ONLY featured rows, so nothing reaches the live homepage until an
 *      admin flips this here. Owner sign-off pending before featuring goes live.
 *
 * Two mechanical changes vs the legacy page:
 *   1. It accepts the surface's own searchParams (ok, error) as props from the
 *      /admin/studio shell instead of awaiting them itself.
 *   2. The outer max-w-5xl container is dropped (the studio shell provides
 *      layout). The addAwardManually / SpotlightAwardRowActions server actions
 *      still redirect back to /admin/spotlight-awards?ok=… / ?error= (which now
 *      redirects in) so their banners surface on the Spotlight Awards tab — no
 *      action rewrite needed.
 *
 * Auth: the /admin layout already 404s non-admins; the server actions re-check
 * (defense in depth). Reads use the RLS-scoped server client (public-read).
 */

import { Trophy, Star, TrendingUp, BarChart3, Info } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  fetchSpotlightAwards,
  currentPeriodMonth,
  AWARD_LABELS,
  type SpotlightAwardType,
} from '@/lib/spotlight-awards';
import {
  SpotlightRecomputeButton,
  SpotlightAwardRowActions,
} from '@/app/admin/spotlight-awards/_components/spotlight-actions';
import { addAwardManually } from '@/app/admin/spotlight-awards/actions';

const AWARD_ICON: Record<SpotlightAwardType, React.ReactNode> = {
  top_pick: <Trophy className="h-4 w-4" strokeWidth={1.75} aria-hidden />,
  most_booked: <BarChart3 className="h-4 w-4" strokeWidth={1.75} aria-hidden />,
  rising: <TrendingUp className="h-4 w-4" strokeWidth={1.75} aria-hidden />,
};

function formatPeriod(period: string): string {
  const d = new Date(`${period}T00:00:00Z`);
  return d.toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export async function SpotlightAwardsSurface({
  ok,
  error,
}: {
  ok?: string;
  error?: string;
}) {
  const supabase = await createClient();
  const period = currentPeriodMonth();
  const rows = await fetchSpotlightAwards(supabase, { periodMonth: period });

  const featuredCount = rows.filter((r) => r.is_homepage_featured).length;
  const autoCount = rows.filter((r) => r.awarded_by === 'auto').length;
  const adminCount = rows.filter((r) => r.awarded_by === 'admin').length;

  return (
    <div>
      <header className="mb-6 space-y-2">
        <p className="sn-eye" style={{ color: 'var(--m-orange-2)' }}>
          Setnayan HQ
        </p>
        <h1 className="sn-h1">
          Spotlight Awards
        </h1>
        <p className="max-w-prose text-sm text-ink/65">
          This month&rsquo;s vendor recognitions — {formatPeriod(period)}. Run the
          recompute to refresh the automatic picks, confirm or add awards by hand,
          and feature a curated few on the homepage.
        </p>
      </header>

      {ok ? (
        <div className="mb-5 rounded-xl border border-success-300/70 bg-success-50 px-4 py-3 text-sm text-success-800">
          {ok}
        </div>
      ) : null}
      {error ? (
        <div className="mb-5 rounded-xl border border-terracotta/40 bg-terracotta/[0.06] px-4 py-3 text-sm text-terracotta">
          {error}
        </div>
      ) : null}

      {/* Owner sign-off note — homepage featuring is gated, not auto. */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-warn-300/70 bg-warn-50 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-warn-700" strokeWidth={1.75} aria-hidden />
        <p className="text-sm text-ink/80">
          Homepage featuring is <strong>off by default</strong>. The public
          homepage strip shows only the awards you feature here — nothing is
          auto-injected onto the live site. Featuring awaits owner sign-off.
        </p>
      </div>

      {/* Recompute + stat row */}
      <section className="mb-6 flex flex-col gap-4 sn-tile p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Total awards" value={rows.length} />
          <Stat label="Auto-picked" value={autoCount} />
          <Stat label="Featured" value={featuredCount} />
        </div>
        <SpotlightRecomputeButton />
      </section>

      {/* Awards table */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/15 bg-white/40 px-6 py-12 text-center">
          <Star className="mx-auto mb-3 h-6 w-6 text-ink/30" strokeWidth={1.5} aria-hidden />
          <p className="text-sm font-medium text-ink">No awards for this month yet.</p>
          <p className="mt-1 text-sm text-ink/60">
            Click <strong>Run now</strong> to snapshot the current top picks, or add
            one by hand below.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.award_id}
              className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                {r.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.logo_url}
                    alt=""
                    className="h-10 w-10 rounded-lg object-cover ring-1 ring-ink/10"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink/[0.06] text-ink/40">
                    {AWARD_ICON[r.award_type]}
                  </div>
                )}
                <div>
                  <p className="font-medium text-ink">
                    {r.business_name ?? 'Unnamed vendor'}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink/60">
                    <span className="inline-flex items-center gap-1 rounded-full bg-ink/[0.05] px-2 py-0.5">
                      {AWARD_ICON[r.award_type]}
                      {AWARD_LABELS[r.award_type]}
                    </span>
                    <span>
                      {r.awarded_by === 'admin' ? 'Added by admin' : 'Auto-picked'}
                    </span>
                    {r.is_homepage_featured ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2 py-0.5 font-medium text-success-700">
                        Featured
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <SpotlightAwardRowActions
                awardId={r.award_id}
                isFeatured={r.is_homepage_featured}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Add-by-hand */}
      <section className="mt-8 sn-tile p-5">
        <h2 className="text-base font-semibold text-ink">Add an award by hand</h2>
        <p className="mt-1 text-sm text-ink/60">
          Award a vendor directly — useful for the <strong>Rising Star</strong>{' '}
          recognition, which has no automatic formula yet. Paste the vendor&rsquo;s
          profile ID.
        </p>
        <ManualAddForm period={period} />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="text-xs text-ink/55">{label}</p>
    </div>
  );
}

/**
 * Manual add form — a plain server-action <form> (progressive-enhancement-safe,
 * no client JS needed). Lives inline here because it's a single form; the
 * row-level toggle/remove buttons are the client component.
 */
function ManualAddForm({ period }: { period: string }) {
  return (
    <form action={addAwardManually} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="period_month" value={period} />
      <label className="flex-1 text-sm">
        <span className="mb-1 block font-medium text-ink/80">Vendor profile ID</span>
        <input
          name="vendor_profile_id"
          required
          placeholder="00000000-0000-0000-0000-000000000000"
          className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 font-mono text-xs text-ink outline-none focus:border-terracotta"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-ink/80">Award</span>
        <select
          name="award_type"
          defaultValue="rising"
          className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-terracotta"
        >
          <option value="rising">Rising Star</option>
          <option value="top_pick">Setnayan&apos;s Top Pick</option>
          <option value="most_booked">Most Booked</option>
        </select>
      </label>
      <button
        type="submit"
        className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-ink/90"
      >
        Add award
      </button>
    </form>
  );
}
