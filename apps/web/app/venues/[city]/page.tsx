import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { Logo as BrandLogo } from '@/app/_components/logo';
import { displayVenueType } from '@/lib/venue-recommendations';
import {
  fetchVenueDirectory,
  groupByCity,
  SITE_URL,
  type CityGroup,
} from '../_lib/venue-directory';

// ISR like the hub — pure crawler-facing index, no per-user state.
export const revalidate = 3600;

type Props = {
  params: Promise<{ city: string }>;
};

async function resolveCity(citySlug: string): Promise<{
  group: CityGroup;
  otherCities: CityGroup[];
} | null> {
  const venues = await fetchVenueDirectory();
  const cities = groupByCity(venues);
  const group = cities.find((c) => c.citySlug === citySlug);
  if (!group) return null;
  return {
    group,
    otherCities: cities.filter((c) => c.citySlug !== citySlug),
  };
}

export async function generateMetadata({ params }: Props) {
  const { city } = await params;
  const resolved = await resolveCity(city);
  if (!resolved) notFound();
  const { group } = resolved;
  const title = `Wedding venues in ${group.city}`;
  const description = `${group.venues.length} real wedding venue${
    group.venues.length === 1 ? '' : 's'
  } in ${group.city} — churches, gardens, ballrooms, and resorts curated by the Setnayan team. Capacity and rate details on every venue. Free planning tools on Setnayan.`;
  const canonicalUrl = `${SITE_URL}/venues/${group.citySlug}`;
  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'website',
      url: canonicalUrl,
      title,
      description,
      siteName: 'Setnayan',
      locale: 'en_PH',
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function VenuesCityPage({ params }: Props) {
  const { city } = await params;
  const resolved = await resolveCity(city);
  if (!resolved) notFound();
  const { group, otherCities } = resolved;

  const typeCounts = new Map<string, number>();
  for (const venue of group.venues) {
    const label = displayVenueType(venue.venue_type);
    typeCounts.set(label, (typeCounts.get(label) ?? 0) + 1);
  }
  const typeSummary = [...typeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `${count} ${label.toLowerCase()}${count === 1 ? '' : 's'}`)
    .join(' · ');

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Wedding venues',
        item: `${SITE_URL}/venues`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: group.city,
        item: `${SITE_URL}/venues/${group.citySlug}`,
      },
    ],
  };

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Wedding venues in ${group.city}`,
    numberOfItems: group.venues.length,
    itemListElement: group.venues.map((venue, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: venue.name,
      url: `${SITE_URL}/venue/${venue.slug}`,
    })),
  };

  return (
    <main className="min-h-dvh bg-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      <header className="border-b border-ink/5">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center text-ink">
            <BrandLogo height={32} withWordmark />
          </Link>
          <Link
            href="/signup"
            className="hidden text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline sm:inline"
          >
            Plan with Setnayan
          </Link>
        </div>
      </header>

      <article className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink/50">
          <Link href="/" className="hover:text-ink hover:underline">
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link href="/venues" className="hover:text-ink hover:underline">
            Wedding venues
          </Link>
          <span className="mx-2">/</span>
          <span className="text-ink/80">{group.city}</span>
        </nav>

        <header className="max-w-3xl space-y-4">
          <h1 className="font-display text-4xl leading-tight text-ink sm:text-5xl">
            Wedding venues in {group.city}
          </h1>
          <p className="text-base leading-relaxed text-ink/70 sm:text-lg">
            {group.venues.length} curated venue
            {group.venues.length === 1 ? '' : 's'} in {group.city}
            {typeSummary ? <> — {typeSummary}</> : null}. Open any venue for
            capacity, day rates where published, and ceremony compatibility,
            then build your guest list and seating around it with
            Setnayan&rsquo;s free planning tools.
          </p>
        </header>

        <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {group.venues.map((venue) => (
            <li key={venue.slug}>
              <Link
                href={`/venue/${venue.slug}`}
                className="group block overflow-hidden rounded-lg border border-ink/10 bg-white transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-[3/2] bg-ink/5">
                  {venue.hero_image_url ? (
                    <Image
                      src={venue.hero_image_url}
                      alt={`${venue.name} — wedding venue in ${venue.location_city}`}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-ink/30">
                      <MapPin className="h-8 w-8" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="space-y-1 p-4">
                  <h2 className="font-medium leading-snug text-ink group-hover:underline">
                    {venue.name}
                  </h2>
                  <p className="text-sm text-ink/60">
                    {displayVenueType(venue.venue_type)}
                    {typeof venue.capacity_max === 'number'
                      ? ` · up to ${venue.capacity_max} pax`
                      : ''}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {otherCities.length > 0 ? (
          <nav aria-label="Other cities" className="mt-14">
            <h2 className="font-display text-2xl text-ink">
              Venues in other cities
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {otherCities.map((other) => (
                <Link
                  key={other.citySlug}
                  href={`/venues/${other.citySlug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-4 py-1.5 text-sm font-medium text-ink/80 transition-colors hover:border-ink/40 hover:text-ink"
                >
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {other.city}
                  <span className="text-ink/40">{other.venues.length}</span>
                </Link>
              ))}
            </div>
          </nav>
        ) : null}

        <section className="mt-16 rounded-lg border border-ink/10 bg-white p-6 sm:p-8">
          <h2 className="font-display text-2xl text-ink">
            Marrying in {group.city}?
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/70">
            Plan your guest list, RSVP, and seating free on Setnayan — then
            find verified Filipino wedding vendors with 0% booking commission.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-sm bg-mulberry px-6 py-3 text-sm font-medium tracking-wide text-cream transition-colors hover:bg-mulberry-600"
            >
              Start planning · free
            </Link>
            <Link
              href="/vendors"
              className="inline-flex items-center justify-center rounded-sm border border-ink/20 px-6 py-3 text-sm font-medium tracking-wide text-ink transition-colors hover:bg-ink/5"
            >
              Browse wedding vendors
            </Link>
          </div>
        </section>
      </article>
    </main>
  );
}
