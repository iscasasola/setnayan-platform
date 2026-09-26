/**
 * /suppliers — the index of the supplier landing pages (SEO Playbook §5.1,
 * locked 2026-05-14; event level added by the owner 2026-09-27).
 *
 * It lists ONLY pages that pass the gate (`qualifyingPages`), grouped by event
 * type — the same list the sitemap publishes, so a crawler and a person see the
 * same directory. While nothing qualifies the page says so plainly and is
 * `noindex`: an index of zero pages is the thinnest page a site can serve.
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { loadLandingCards } from '@/lib/supplier-landing-data';
import { cityName, pagePath, qualifyingPages, type QualifyingPage } from '@/lib/supplier-landing';

const TITLE = 'Filipino event suppliers by event, category and city';
const DESCRIPTION =
  'Verified Filipino suppliers for weddings, debuts, christenings, birthdays and every other celebration — grouped by event, category and city, with the prices they publish themselves. 0% commission.';

export async function generateMetadata(): Promise<Metadata> {
  const source = await loadLandingCards();
  const any = qualifyingPages(source.cards, source.tileServesEvent).length > 0;
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: '/suppliers' },
    robots: { index: any, follow: true },
    openGraph: { title: `${TITLE} · Setnayan`, description: DESCRIPTION, url: '/suppliers', type: 'website', siteName: 'Setnayan' },
  };
}

export default async function SuppliersIndexPage() {
  const source = await loadLandingCards();
  const pages = qualifyingPages(source.cards, source.tileServesEvent);
  const byEvent = new Map<string, QualifyingPage[]>();
  for (const p of pages) byEvent.set(p.event, [...(byEvent.get(p.event) ?? []), p]);
  const tileSlug = source.taxonomy.tileSlug;

  return (
    <main className="min-h-dvh bg-cream">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{TITLE}</h1>
        <p className="mt-4 max-w-2xl text-base text-ink/70">
          Every supplier here is verified — a business-legitimacy check and a video call with a Setnayan admin — and
          every price is the one they publish themselves. You message them from Setnayan and pay them directly.
        </p>

        {pages.length === 0 ? (
          <div className="mt-8 max-w-2xl space-y-3 text-base text-ink/70">
            <p>
              This directory builds itself as suppliers publish their services. A page opens once a place has enough
              verified suppliers to compare — none has yet.
            </p>
            <p>
              <Link href="/explore" className="font-medium text-ink underline underline-offset-4">Browse every verified supplier</Link>
              {' · '}
              <Link href="/vendors" className="text-ink/70 underline underline-offset-4">Are you a supplier? List your services</Link>
            </p>
          </div>
        ) : (
          <div className="mt-10 space-y-10">
            {[...byEvent.entries()].map(([event, list]) => (
              <section key={event} aria-labelledby={`event-${event}`}>
                <h2 id={`event-${event}`} className="text-lg font-semibold">
                  {source.eventLabel.get(event) ?? event}
                </h2>
                <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-base">
                  {list.map((p) => (
                    <li key={pagePath(p, tileSlug)}>
                      <Link href={pagePath(p, tileSlug)} className="underline underline-offset-4">
                        {source.taxonomy.tileLabel[p.tile] ?? p.tile} in {p.city ? cityName(p.city) : 'the Philippines'}
                      </Link>{' '}
                      <span className="text-sm text-ink/55">({p.cards})</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
