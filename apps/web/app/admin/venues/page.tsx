import Link from 'next/link';
import { MapPin, Plus } from 'lucide-react';

import { createAdminClient } from '@/lib/supabase/admin';
import { displayVenueType } from '@/lib/venue-recommendations';

export const metadata = { title: 'Venues · Admin' };

type Props = {
  searchParams: Promise<{ q?: string; type?: string; city?: string }>;
};

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
];

export default async function AdminVenuesPage({ searchParams }: Props) {
  const search = await searchParams;
  const q = (search.q ?? '').trim();
  const typeFilter = (search.type ?? '').trim();
  const cityFilter = (search.city ?? '').trim();

  const admin = createAdminClient();
  let query = admin
    .from('venue_directory')
    .select(
      'venue_directory_id,slug,name,venue_type,location_city,hq_latitude,hq_longitude,compatible_ceremony_types,source_note',
    )
    .order('name', { ascending: true })
    .limit(500);
  if (q.length > 0) {
    query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%`);
  }
  if (typeFilter.length > 0) {
    query = query.eq('venue_type', typeFilter);
  }
  if (cityFilter.length > 0) {
    query = query.ilike('location_city', `%${cityFilter}%`);
  }

  const { data: rowsRaw } = await query;
  const rows = (rowsRaw ?? []) as VenueRow[];

  // Group counts by venue_type for the stats strip — useful when validating
  // coverage during the V1 seed review.
  const { data: allRowsForStats } = await admin
    .from('venue_directory')
    .select('venue_type');
  const statsByType = new Map<string, number>();
  for (const row of (allRowsForStats ?? []) as { venue_type: string }[]) {
    statsByType.set(row.venue_type, (statsByType.get(row.venue_type) ?? 0) + 1);
  }
  const totalRows = (allRowsForStats ?? []).length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            V1 directory · {totalRows} venues
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Venue directory
          </h1>
          <p className="max-w-prose text-sm text-ink/65">
            Read-only directory of known PH wedding venues. Powers the marketplace
            Paired-Venue recommendation panel. Admins curate this list while the
            full venue marketplace (per-location calendar + day-rates) is being built.
          </p>
        </div>
        <Link
          href="/admin/venues/new"
          className="inline-flex h-10 items-center gap-1.5 rounded-md bg-terracotta px-4 text-sm font-medium text-cream hover:bg-terracotta-600"
        >
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
          Add venue
        </Link>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {VENUE_TYPE_FILTERS.map((t) => {
          const count = statsByType.get(t.value) ?? 0;
          return (
            <Link
              key={t.value}
              href={`/admin/venues?type=${t.value}`}
              className={
                t.value === typeFilter
                  ? 'rounded-lg border border-terracotta bg-terracotta/5 px-2 py-2 text-left text-xs'
                  : 'rounded-lg border border-ink/10 bg-cream px-2 py-2 text-left text-xs hover:border-ink/30'
              }
            >
              <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink/55">
                {t.label}
              </p>
              <p className="text-base font-semibold text-ink">{count}</p>
            </Link>
          );
        })}
      </section>

      <form
        method="get"
        action="/admin/venues"
        className="mb-6 grid gap-3 rounded-2xl border border-ink/10 bg-cream p-4 sm:grid-cols-3"
      >
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

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink/20 bg-cream/60 px-4 py-8 text-center text-sm text-ink/55">
          No venues match these filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-cream">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink/10 bg-ink/[0.02] text-left">
                <th className="px-3 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                  Name
                </th>
                <th className="px-3 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                  Type
                </th>
                <th className="px-3 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                  City
                </th>
                <th className="px-3 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                  Coords
                </th>
                <th className="px-3 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                  Faiths
                </th>
                <th className="px-3 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const lat = Number(row.hq_latitude).toFixed(4);
                const lng = Number(row.hq_longitude).toFixed(4);
                return (
                  <tr key={row.venue_directory_id} className="border-b border-ink/5">
                    <td className="px-3 py-3 align-top">
                      <Link
                        href={`/admin/venues/${row.venue_directory_id}`}
                        className="font-medium text-ink hover:text-terracotta hover:underline"
                      >
                        {row.name}
                      </Link>
                      <p className="font-mono text-[10px] text-ink/40">{row.slug}</p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className="inline-flex items-center rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/65">
                        {displayVenueType(row.venue_type)}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top text-ink/80">
                      {row.location_city}
                    </td>
                    <td className="px-3 py-3 align-top font-mono text-[11px] text-ink/55">
                      <span className="inline-flex items-center gap-1">
                        <MapPin
                          aria-hidden
                          className="h-3 w-3"
                          strokeWidth={1.75}
                        />
                        {lat}, {lng}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top">
                      {row.compatible_ceremony_types.length === 0 ? (
                        <span className="text-[11px] text-ink/40">all faiths</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {row.compatible_ceremony_types.map((ct) => (
                            <span
                              key={ct}
                              className="rounded-full bg-ink/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink/65"
                            >
                              {ct}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <Link
                        href={`/admin/venues/${row.venue_directory_id}`}
                        className="text-xs font-medium text-terracotta underline-offset-4 hover:underline"
                      >
                        Edit →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
