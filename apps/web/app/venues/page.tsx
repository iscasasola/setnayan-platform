import Link from 'next/link';
import Image from 'next/image';
import { MapPin } from 'lucide-react';
import { Logo as BrandLogo } from '@/app/_components/logo';
import { displayVenueType } from '@/lib/venue-recommendations';
import {
  fetchVenueDirectory,
  groupByCity,
  SITE_URL,
} from './_lib/venue-directory';

// ISR — admin-curated directory changes a few times a week at most; this is
// a crawler-facing index page with no per-user state (the venue DETAIL page
// stays force-dynamic for its session-aware header + add-to-plan button).
export const revalidate = 3600;

const PAGE_TITLE = 'Wedding venues in the Philippines';
const PAGE_DESCRIPTION =
  'Browse real Philippine wedding venues by city — churches, garden venues, hotel ballrooms, beach and destination resorts across Tagaytay, Cebu, Metro Manila, and more. Free planning tools on Setnayan.';

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/venues` },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/venues`,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    siteName: 'Setnayan',
    locale: 'en_PH',
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

export default async function VenuesHubPage() {
  const venues = await fetchVenueDirectory();
  const cities = groupByCity(venues);

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
    ],
  };

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Wedding venues in the Philippines by city',
    numberOfItems: cities.length,
    itemListElement: cities.map((group, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `Wedding venues in ${group.city}`,
      url: `${SITE_URL}/venues/${group.citySlug}`,
    })),
  };

  // FAQ copy quotes live counts — skip the block entirely on the zero-row
  // fallback render (no-env build environments / transient DB error) so the
  // page never publishes "0 venues" as a citable fact.
  const faqs: Array<{ q: string; a: string }> = venues.length === 0 ? [] : [
    {
      q: 'How many wedding venues are listed on Setnayan?',
      a: `${venues.length} real Philippine venues across ${cities.length} cities — Catholic and Christian churches, garden venues, hotel ballrooms, beach and destination resorts, and heritage sites. The directory is curated by the Setnayan team and grows as new venues are added.`,
    },
    {
      q: 'Can I book a venue through Setnayan?',
      a: 'Not yet — the venue directory is informational in this release. Use it to shortlist ceremony and reception venues, then plan everything around your chosen venue with Setnayan’s free tools: guest list, RSVP, seating, and the vendor marketplace. In-platform venue booking is on the roadmap.',
    },
    {
      q: 'Which cities are covered?',
      a: `${cities.map((c) => c.city).join(', ')} — with more cities added as the directory grows.`,
    },
  ];

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
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
      {faqs.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      ) : null}

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
          <span className="text-ink/80">Wedding venues</span>
        </nav>

        <header className="max-w-3xl space-y-4">
          <h1 className="font-display text-4xl leading-tight text-ink sm:text-5xl">
            Wedding venues in the Philippines
          </h1>
          <p className="text-base leading-relaxed text-ink/70 sm:text-lg">
            {venues.length > 0 ? (
              <>
                {venues.length} real venues across {cities.length} cities,
                curated by the Setnayan team —{' '}
              </>
            ) : (
              <>Real venues curated by the Setnayan team — </>
            )}
            Catholic and Christian churches for the ceremony, garden venues
            and hotel ballrooms for the reception, beachfronts and destination
            resorts for couples marrying away from the city. Browse by city
            below, open any venue for capacity and rate details, then plan
            your guest list, RSVP, and seating around it with
            Setnayan&rsquo;s free tools.
          </p>
        </header>

        {/* City quick links — the geo-modified index pages. */}
        <nav aria-label="Venues by city" className="mt-8 flex flex-wrap gap-2">
          {cities.map((group) => (
            <Link
              key={group.citySlug}
              href={`/venues/${group.citySlug}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-4 py-1.5 text-sm font-medium text-ink/80 transition-colors hover:border-ink/40 hover:text-ink"
            >
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {group.city}
              <span className="text-ink/40">{group.venues.length}</span>
            </Link>
          ))}
        </nav>

        {/* Per-city sections. */}
        {cities.map((group) => (
          <section key={group.citySlug} className="mt-12">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-2xl text-ink sm:text-3xl">
                {group.city}
              </h2>
              <Link
                href={`/venues/${group.citySlug}`}
                className="text-sm font-medium text-ink/60 underline-offset-4 hover:text-ink hover:underline"
              >
                All {group.city} venues →
              </Link>
            </div>
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.venues.slice(0, 6).map((venue) => (
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
                      <h3 className="font-medium leading-snug text-ink group-hover:underline">
                        {venue.name}
                      </h3>
                      <p className="text-sm text-ink/60">
                        {displayVenueType(venue.venue_type)} ·{' '}
                        {venue.location_city}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* FAQ — conversational Q&A pairs double as GEO grounding. */}
        {faqs.length > 0 ? (
          <section className="mt-16 max-w-3xl">
            <h2 className="font-display text-2xl text-ink sm:text-3xl">
              Common questions
            </h2>
            <dl className="mt-6 space-y-6">
              {faqs.map(({ q, a }) => (
                <div key={q}>
                  <dt className="font-medium text-ink">{q}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-ink/70">
                    {a}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        <section className="mt-16 rounded-lg border border-ink/10 bg-white p-6 sm:p-8">
          <h2 className="font-display text-2xl text-ink">
            Found your venue? Plan the rest, free.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/70">
            Guest list, RSVP, seating chart, and a marketplace of verified
            Filipino wedding vendors — free for couples, 0% commission on
            vendor bookings.
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
