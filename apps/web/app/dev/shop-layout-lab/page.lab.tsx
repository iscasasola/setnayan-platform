/**
 * /dev/shop-layout-lab — the public shop page's (`/v/[slug]`) two columns at every width, on fixture data, for the
 * supplier website by plan (owner-approved 2026-10-30). No sign-in, no database. DEV-ONLY: production builds 404 this
 * route first thing. The article width and both columns are the page's OWN classes (`shop-columns.ts`), so the layout
 * shown is the layout that ships; the card is the page's identity markup with the real `ShareButton` and
 * `ShopBadgePill`, and the page body is marked stand-ins (services · portfolio · reviews) of its real section rhythm.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, MessageCircle, Send } from 'lucide-react';
import { Wordmark } from '@/app/_components/brand-marks';
import { ShopBadgePill } from '@/app/_components/shop-badge-pill';
import { ShareButton } from '@/app/v/[slug]/_components/share-button';
import {
  SHOP_ARTICLE_WIDTH,
  SHOP_CARD_COLUMN_CLASS,
  SHOP_CARD_SECTION_CLASS,
  SHOP_COLUMNS_CLASS,
} from '@/app/v/[slug]/_components/shop-columns';
import { verifiedBadge } from '@/lib/shop-badges';

const NAME = 'Sampaguita Table';
/** Stand-in service titles only — no prices: a typed peso figure is never invented, even in a lab. */
const CARDS = ['Plated dinner', 'Family-style feast', 'Grazing table'];

export default async function ShopLayoutLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <main className="min-h-dvh bg-cream">
      <header className="border-b border-ink/5">
        <div className={`mx-auto flex w-full ${SHOP_ARTICLE_WIDTH} items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8`}>
          <Link href="/" className="flex items-center text-ink">
            <Wordmark size={22} />
          </Link>
          <span className="hidden text-sm font-medium text-ink/70 sm:inline">Plan with Setnayan</span>
        </div>
      </header>
      <article className={`mx-auto w-full px-4 py-12 sm:px-6 sm:py-16 lg:px-8 ${SHOP_ARTICLE_WIDTH}`}>
        <div data-shop-columns="" className={SHOP_COLUMNS_CLASS}>
          <div data-shop-card-column="" className={SHOP_CARD_COLUMN_CLASS}>
            <section className={SHOP_CARD_SECTION_CLASS}>
              <span className="inline-flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-terracotta/15 text-xl font-semibold text-terracotta-700">
                ST
              </span>
              <div className="min-w-0 space-y-2">
                <h1 className="font-serif text-4xl font-normal italic tracking-[-0.02em] text-ink sm:text-5xl md:text-4xl lg:text-5xl">{NAME}</h1>
                <p className="text-base text-ink/70">Filipino feasts, plated or family-style</p>
                <ShopBadgePill badge={verifiedBadge()} className="w-fit" />
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink/60">
                  <span className="inline-flex items-center gap-1">
                    <MapPin aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Tagaytay
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Replies in your Setnayan inbox
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-4">
                  <a href="#get-in-touch" className="button-primary inline-flex items-center gap-2">
                    <Send className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    Inquire
                  </a>
                  <ShareButton title={NAME} className="button-secondary inline-flex items-center gap-2" />
                </div>
                <div className="h-[220px] rounded-xl bg-ink/[0.05]" aria-label="Map stand-in" />
              </div>
            </section>
          </div>
          <div data-shop-body-column="" className="min-w-0">
            <section className="space-y-4 border-b border-ink/10 py-8">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Services &amp; pricing · stand-in</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {CARDS.map((t) => (
                  <div key={t} className="overflow-hidden rounded-2xl bg-ink/[0.03]">
                    <div className="h-40 bg-ink/[0.06]" />
                    <p className="p-4 font-medium text-ink">{t}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className="space-y-4 border-b border-ink/10 py-8">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Portfolio · stand-in</h2>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="aspect-square rounded-lg bg-ink/[0.06]" />
                ))}
              </div>
            </section>
            <section id="reviews" className="space-y-3 border-b border-ink/10 py-8">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Reviews · stand-in</h2>
              <div className="h-32 rounded-xl bg-ink/[0.04]" />
            </section>
          </div>
        </div>
      </article>
    </main>
  );
}
