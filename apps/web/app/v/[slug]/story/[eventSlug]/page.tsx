/**
 * /v/[slug]/story/[eventSlug] — AN ULTRA SHOP'S OWN PAGE FOR ONE BOOKED EVENT (owner 2026-11-14, specs DECISION_LOG
 * "SIMPLER SUPPLIER PLANS — APPROVED AS DRAWN …" item 8; drawing artifact Eiwc64wF1VHLfZ52Sjbs8c § 5, frame 2).
 *
 * Reached from the shop page's "Featured in these stories" card, which on Ultra reads "Our story of this day →" and
 * keeps the visitor on the shop's address (`featuredStoryLink`, lib/ultra-story-pages.ts). Top to bottom, as drawn:
 * the shop and its kind · the host's names · place and month · the shop's own photos from that day · What we did ·
 * In our words · What they said · "Read <names>'s full story →" · Check your date · Back to the shop.
 *
 * 🔒 Every read and every gate is `loadShopStoryPage` (lib/ultra-story-pages.server.ts): a published celebration
 * only, after the 30-day wait, the shop on Ultra, its page public. Anything else is the not-found page.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, CalendarCheck, Star } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { loadShopStoryPage } from '@/lib/ultra-story-pages.server';
import { IN_OUR_WORDS } from '@/lib/ultra-story-pages';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string; eventSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, eventSlug } = await params;
  const read = await loadShopStoryPage(slug, eventSlug).catch(() => null);
  if (!read || read.kind !== 'ok') return { title: 'Story', robots: { index: false, follow: false } };
  const { shop, story } = read.page;
  return {
    title: `${story.hostNames} · ${shop.name}`,
    description: `${shop.name} at ${story.hostNames}${story.city ? `, ${story.city}` : ''}${story.dateLabel ? ` · ${story.dateLabel}` : ''}.`,
  };
}

export default async function ShopStoryPage({ params }: Props) {
  const { slug, eventSlug } = await params;
  const read = await loadShopStoryPage(slug, eventSlug);
  if (read.kind !== 'ok') notFound();
  const { shop, story, photos, work, note, review } = read.page;
  const shopHref = `/v/${encodeURIComponent(shop.slug)}`;
  const [lead, ...rest] = photos;

  return (
    <main className="min-h-[100dvh] bg-cream text-ink" data-shop-story-page="">
      <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <a href={shopHref} className="sn-press inline-flex min-h-11 items-center gap-1.5 text-[14px] text-ink/70 hover:text-ink">
          <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {shop.name}
        </a>

        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.15em] text-terracotta-700" data-story-shop="">
          {[shop.name, shop.kind].filter(Boolean).join(' · ')}
        </p>
        <h1 className="mt-1 font-serif text-[30px] leading-tight text-ink sm:text-[40px]">{story.hostNames}</h1>
        {story.city || story.dateLabel ? (
          <p className="mt-1 text-[14px] text-ink/65">{[story.city, story.dateLabel].filter(Boolean).join(' · ')}</p>
        ) : null}

        {lead ? (
          <section className="mt-5" aria-label="Our photos from the day" data-story-photos="">
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- presigned, short-lived URLs: next/image would cache a link that expires */}
              <img src={lead.url} alt={lead.caption ?? `${shop.name} at ${story.hostNames}`} className="col-span-2 row-span-2 aspect-square w-full rounded-xl object-cover" />
              {rest.slice(0, 2).map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- presigned, short-lived URLs
                <img key={i} src={p.url} alt={p.caption ?? ''} className="aspect-square w-full rounded-xl object-cover" />
              ))}
            </div>
            {rest.length > 2 ? (
              <div className="mt-1.5 grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2">
                {rest.slice(2).map((p, i) => (
                  // eslint-disable-next-line @next/next/no-img-element -- presigned, short-lived URLs
                  <img key={i} src={p.url} alt={p.caption ?? ''} loading="lazy" className="aspect-square w-full rounded-xl object-cover" />
                ))}
              </div>
            ) : null}
            <p className="mt-1.5 text-[12.5px] text-ink/55">
              Our photos from the day · {photos.length}
            </p>
          </section>
        ) : null}

        {work ? (
          <section className="mt-7" data-story-work="">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">What we did</h2>
            <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-ink/10 pt-2 text-[15px]">
              <span className="text-ink">{work.title}</span>
              {work.kind ? <span className="text-right text-[14px] text-ink/60">{work.kind}</span> : null}
            </div>
          </section>
        ) : null}

        {note ? (
          <section className="mt-7" data-story-note="">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">{IN_OUR_WORDS}</h2>
            <p className="mt-2 whitespace-pre-line text-[15.5px] leading-relaxed text-ink">&ldquo;{note}&rdquo;</p>
          </section>
        ) : null}

        {review && (review.body || review.stars) ? (
          <section className="mt-7" data-story-review="">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">What they said</h2>
            {review.stars ? (
              <p className="mt-2 flex items-center gap-0.5 text-terracotta" aria-label={`${review.stars} of 5 stars`}>
                {Array.from({ length: Math.max(0, Math.min(5, review.stars)) }, (_, i) => (
                  <Star key={i} aria-hidden className="h-4 w-4 fill-current" strokeWidth={1.5} />
                ))}
              </p>
            ) : null}
            {review.body ? (
              <p className="mt-1.5 text-[15px] leading-relaxed text-ink/75">
                &ldquo;{review.body}&rdquo; <span className="text-ink/55">— {story.hostNames}</span>
              </p>
            ) : null}
          </section>
        ) : null}

        <p className="mt-8 text-[15px]">
          <a href={`/${encodeURIComponent(story.slug)}`} className="inline-flex min-h-11 items-center gap-1 font-semibold text-terracotta hover:underline" data-story-full="">
            Read {story.hostNames}&rsquo;s full story
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </a>
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <ActionButton
            tone="brand"
            main
            icon={<CalendarCheck aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
            label={`Check your date with ${shop.name}`}
            href={`${shopHref}/dates`}
          />
          <ActionButton
            tone="neutral"
            icon={<ArrowLeft aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />}
            label={`Back to ${shop.name}`}
            href={shopHref}
          />
        </div>
      </div>
    </main>
  );
}
