import Link from 'next/link';
import { MapPin, Plus } from 'lucide-react';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { displayVenueType } from '@/lib/venue-recommendations';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { PageMasthead } from '@/app/_components/page-masthead';

/**
 * The read's own ceiling, named once and passed to the table as `cap` so a full
 * page says "there are more" instead of reading as the whole directory. It was
 * a bare `.limit(500)` with nothing anywhere saying so.
 */
const VENUE_ROW_LIMIT = 500;

type VenueRow = {
  venue_directory_id: string;
  slug: string;
  name: string;
  venue_type: string;
  location_city: string;
  hq_latitude: number | string;
  hq_longitude: number | string;
  compatible_ceremony_types: string[];
  source_note: string | null;
};

const VENUE_TYPE_FILTERS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'catholic_church', label: 'Catholic Church' },
  { value: 'christian_church', label: 'Christian Church' },
  { value: 'inc_chapel', label: 'INC Chapel' },
  { value: 'mosque', label: 'Mosque' },
  { value: 'cultural_site', label: 'Cultural Site' },
  { value: 'civil_registrar', label: 'Civil Registrar' },
  { value: 'hotel_ballroom', label: 'Hotel Ballroom' },
  { value: 'garden', label: 'Garden' },
  { value: 'beach', label: 'Beach' },
  { value: 'destination_resort', label: 'Destination Resort' },
  { value: 'heritage', label: 'Heritage' },
  { value: 'outdoor_tent', label: 'Outdoor Tent' },
  { value: 'temple', label: 'Temple' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'multi_purpose_hall', label: 'Multi-Purpose Hall' },
];

/**
 * VenuesSurface — the Venues LIST body, re-homed byte-identical from
 * app/admin/venues/page.tsx into the tabbed /admin/accounts studio (Accounts
 * Studio slice 2). Behaviour is unchanged: the ?q + ?type + ?city filters, the
 * per-venue-type stats strip, and the rows linking to the standalone
 * /admin/venues/[id] detail route. Only two things differ, both mechanical:
 *   1. It accepts the surface's own searchParams (q, type, city) as props from
 *      the /admin/accounts shell instead of awaiting them itself.
 *   2. The main filter form posts to /admin/accounts with a hidden tab=venues
 *      input so submitting a filter stays on the Venues tab.
 *
 * The row links to /admin/venues/[id] (detail) and the "Add venue" link to
 * /admin/venues/new (create) STAY pointing at those standalone routes — they
 * are not absorbed into the studio this slice. The stats-strip type links keep
 * pointing at /admin/venues?type=… (which now redirects into the tab).
 *
 * ── 2026-08-17 · onto <ConsoleTable>, and it was NOT a looks change ──────────
 * BOTH reads on this surface threw their `{ error }` away — the main list never
 * destructured it at all — and then coerced `data` with `?? []`. Supabase
 * RESOLVES with an error instead of throwing, so a refused read arrived as an
 * empty array and this page printed "No venues match these filters." A directory
 * that could not be read looked exactly like a directory with nothing in it, and
 * an admin curating coverage had no reason to doubt either one. `rows` is now
 * nullable all the way to the table, which treats null as NOT MEASURED.
 *
 * The per-type stat chips had the same fault one level down: `?? 0` per type, so
 * a refused stats read painted a confident 0 beside all fifteen venue types and
 * "0 venues" in the eyebrow. They render an em-dash now.
 *
 * 🎨 Two links here painted TEXT in the Tailwind slot named `terracotta`, which
 * holds the atelier GOLD #A9834B — 3.37:1 on cream, an AA failure at any text
 * size. The name link's hover and the "Edit →" link's resting state both moved
 * to `text-link` (#3B4E67, 8.22:1). The slots are inherited and backwards: the
 * CTA terracotta lives in the slot named `mulberry`.
 */
export async function VenuesSurface({
  q: qRaw,
  type: typeRaw,
  city: cityRaw,
}: {
  q: string;
  type: string;
  city: string;
}) {
  const q = (qRaw ?? '').trim();
  const typeFilter = (typeRaw ?? '').trim();
  const cityFilter = (cityRaw ?? '').trim();

  const admin = createAdminClient();
  let query = admin
    .from('venue_directory')
    .select(
      'venue_directory_id,slug,name,venue_type,location_city,hq_latitude,hq_longitude,compatible_ceremony_types,source_note',
    )
    .order('name', { ascending: true })
    .limit(VENUE_ROW_LIMIT);
  if (q.length > 0) {
    query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%`);
  }
  if (typeFilter.length > 0) {
    query = query.eq('venue_type', typeFilter);
  }
  if (cityFilter.length > 0) {
    query = query.ilike('location_city', `%${cityFilter}%`);
  }

  const { data: rowsRaw, error } = await query;
  if (error) logQueryError('AdminVenuesSurface (venue_directory)', error);
  // NOT `?? []`. Null means the read was refused, which is a different fact from
  // "no venue matches these filters" — and this page said the second one when it
  // was the first.
  const rows = rowsRaw as VenueRow[] | null;

  // Group counts by venue_type for the stats strip — useful when validating
  // coverage during the V1 seed review.
  const { data: statsRaw, error: statsError } = await admin
    .from('venue_directory')
    .select('venue_type');
  if (statsError) logQueryError('AdminVenuesSurface (venue_type stats)', statsError);
  const statsRows = statsRaw as { venue_type: string }[] | null;
  const statsMeasured = Array.isArray(statsRows);
  const statsByType = new Map<string, number>();
  for (const row of statsRows ?? []) {
    statsByType.set(row.venue_type, (statsByType.get(row.venue_type) ?? 0) + 1);
  }
  // null = not measured. A refused stats read used to print a confident 0 beside
  // every venue type, which reads as "we have no mosques" rather than "we did
  // not manage to count".
  const totalRows = statsMeasured ? statsRows.length : null;

  return (
    <div>
      <PageMasthead
        className="mb-6"
        title="Venue directory"
        lede="Read-only directory of known PH wedding venues. Powers the marketplace Paired-Venue recommendation panel. Admins curate this list while the full venue marketplace (per-location calendar + day-rates) is being built."
        actions={
          <Link
            href="/admin/venues/new"
            className="inline-flex h-11 items-center gap-1.5 rounded-md bg-mulberry px-4 text-sm font-medium text-cream hover:bg-mulberry-600"
          >
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            Add venue
          </Link>
        }
      />

      {/* The total moved OUT of the masthead eyebrow, which PageMasthead
          deliberately has no prop for, and down here beside the per-type counts
          it belongs with — where it stays visible on a phone. The masthead lede
          is desktop-only by council lock, and a count is not orienting prose. */}
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/70">
        V1 directory ·{' '}
        {totalRows === null ? 'venue count unavailable' : `${totalRows} venues`}
      </p>

      <section className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {VENUE_TYPE_FILTERS.map((t) => {
          // null, never 0, when the stats read was refused — an em-dash says "we
          // do not know"; a 0 says "this faith has nowhere to marry".
          const count = statsMeasured ? (statsByType.get(t.value) ?? 0) : null;
          return (
            <Link
              key={t.value}
              href={`/admin/venues?type=${t.value}`}
              className={
                t.value === typeFilter
                  ? 'rounded-lg border border-terracotta bg-terracotta/5 px-2 py-2 text-left text-xs'
                  : 'sn-tile px-2 py-2 text-left text-xs hover:border-ink/30'
              }
            >
              <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink/70">
                {t.label}
              </p>
              <p className="text-base font-semibold text-ink">
                {count === null ? '—' : count}
              </p>
            </Link>
          );
        })}
      </section>

      <form
        method="get"
        action="/admin/accounts"
        className="mb-6 grid gap-3 sn-tile p-4 sm:grid-cols-3"
      >
        <input type="hidden" name="tab" value="venues" />
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Search name / slug
          </span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Marriott, manaoag…"
            className="input-field"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Filter by type
          </span>
          <select name="type" defaultValue={typeFilter} className="input-field">
            <option value="">All types</option>
            {VENUE_TYPE_FILTERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            City contains
          </span>
          <input
            type="text"
            name="city"
            defaultValue={cityFilter}
            placeholder="Tagaytay, Cebu…"
            className="input-field"
          />
        </label>
        <div className="sm:col-span-3">
          <button type="submit" className="button-primary px-5">
            Apply filters
          </button>
          {(q || typeFilter || cityFilter) ? (
            <Link
              href="/admin/venues"
              className="button-secondary ml-2 px-5"
            >
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      <ConsoleTable
        rows={rows}
        readPermitted
        readError={error}
        reads="the venue directory"
        cap={VENUE_ROW_LIMIT}
        label="Venue directory"
        minWidth="45rem"
        rowKey={(r) => r.venue_directory_id}
        empty={{
          Icon: MapPin,
          title:
            q || typeFilter || cityFilter
              ? 'No venue matches these filters'
              : 'No venues in the directory yet',
          blurb:
            q || typeFilter || cityFilter
              ? 'The read went through and returned nothing for this search. Clear the filters to see the whole directory.'
              : 'Nothing has been curated into the directory yet. Add the first venue and it becomes available to the Paired-Venue panel.',
          verifiedNote: 'Verified: read permitted · 0 venues matched',
        }}
        columns={[
          {
            header: 'Name',
            cell: (r) => (
              <>
                <Link
                  href={`/admin/venues/${r.venue_directory_id}`}
                  className="font-medium text-ink hover:text-link hover:underline"
                >
                  {r.name}
                </Link>
                <p className="font-mono text-[10px] text-ink/70">{r.slug}</p>
              </>
            ),
          },
          {
            header: 'Type',
            hideBelow: 'md',
            cell: (r) => (
              <span className="inline-flex items-center rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/70">
                {displayVenueType(r.venue_type)}
              </span>
            ),
          },
          {
            header: 'City',
            cell: (r) => <span className="text-ink/80">{r.location_city}</span>,
          },
          {
            header: 'Coords',
            hideBelow: 'lg',
            mono: true,
            cell: (r) => (
              <span className="inline-flex items-center gap-1 text-ink/70">
                <MapPin aria-hidden className="h-3 w-3" strokeWidth={1.75} />
                {Number(r.hq_latitude).toFixed(4)}, {Number(r.hq_longitude).toFixed(4)}
              </span>
            ),
          },
          {
            header: 'Faiths',
            hideBelow: 'lg',
            cell: (r) =>
              r.compatible_ceremony_types.length === 0 ? (
                <span className="text-[11px] text-ink/70">all faiths</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {r.compatible_ceremony_types.map((ct) => (
                    <span
                      key={ct}
                      className="rounded-full bg-ink/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink/70"
                    >
                      {ct}
                    </span>
                  ))}
                </div>
              ),
          },
          {
            header: 'Action',
            align: 'right',
            cell: (r) => (
              <Link
                href={`/admin/venues/${r.venue_directory_id}`}
                className="text-xs font-medium text-link underline-offset-4 hover:underline"
              >
                Edit →
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
