import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { LocaleSwitch } from '@/lib/marketing-i18n';
import { findBlogArticle } from '@/lib/blog';
import {
  FEATURES_HUB_PATHS,
  featureHref,
  featurePage,
  featurePaths,
  type FeatureLocale,
  type FeaturePageEntry,
} from '@/lib/feature-pages';
import { featurePriceLabel, resolveFeaturePrice } from '@/lib/feature-pages/price';
import { featureJsonLd } from '@/lib/feature-pages/seo';
import { readFeatureCatalogue } from './_feature-price';
import { featureIcon } from './_icons';

/**
 * ONE FEATURE, ONE PAGE — /features/<slug> and /tl/features/<slug>
 * (DECISION_LOG 2026-10-01 "/FEATURES IS ALSO OUR SEARCH-ENGINE PAGE SET").
 *
 * Server component, no client code of its own: the shared bundle sits at its
 * ceiling, and a page whose job is to be read by people and crawlers needs no
 * JavaScript. Every word comes from the registry (`lib/feature-pages`); every
 * tag from `lib/feature-pages/seo.ts`; the price from the live catalogue.
 *
 * Phone first (390 px): the name, one line, the answer, the price and the one
 * button sit in the top third. Then, in order: who it is for · how it works
 * (3 steps) · what makes it different · works with the rest of Setnayan ·
 * questions · guides. One H1; every section an H2; questions are H3.
 *
 * No cards (`lint-no-card.mjs`): sections are grouped by whitespace and a
 * single hairline, never a bordered box.
 */

const MUTED = 'text-[var(--m-slate-2)]';
const GOLD = 'text-[var(--m-orange-2)]';
const H2 = 'font-serif text-2xl leading-snug tracking-tight text-[var(--m-ink)]';
const SECTION = 'mt-14 border-t border-[var(--m-line)] pt-10';

const PRIMARY_CTA =
  'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full ' +
  'bg-[var(--m-mulberry)] px-6 py-3 text-sm font-semibold text-[var(--m-paper)] ' +
  'transition-opacity hover:opacity-90';
const SECONDARY_CTA =
  'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full ' +
  'border border-[var(--m-ink)]/20 px-6 py-3 text-sm font-semibold text-[var(--m-ink)] ' +
  'transition-colors hover:bg-[var(--m-ink)]/[0.04]';

const WORDS = {
  en: {
    features: 'Features',
    forWho: 'Who it’s for',
    how: 'How it works',
    different: 'What makes it different',
    worksWith: 'Works with the rest of Setnayan',
    price: 'Price',
    faq: 'Questions',
    guides: 'Guides',
    tryIt: 'Try it',
    more: (n: string) => `More about ${n}`,
    startHost: 'Start planning · free',
    startSupplier: 'Open your shop',
    pricing: 'All prices',
    findSuppliers: 'Find suppliers near you',
  },
  tl: {
    features: 'Mga feature',
    forWho: 'Para kanino',
    how: 'Paano ito gumagana',
    different: 'Ano ang kakaiba rito',
    worksWith: 'Kasama ng iba pang bahagi ng Setnayan',
    price: 'Presyo',
    faq: 'Mga tanong',
    guides: 'Mga gabay',
    tryIt: 'Subukan',
    more: (n: string) => `Higit pa tungkol sa ${n}`,
    startHost: 'Magsimula · libre',
    startSupplier: 'Buksan ang shop mo',
    pricing: 'Lahat ng presyo',
    findSuppliers: 'Maghanap ng suppliers malapit sa iyo',
  },
} as const;

/** Host pages whose job ends at a supplier — they also link the region pages. */
const LINKS_SUPPLIER_REGIONS: ReadonlySet<string> = new Set(['marketplace', 'compare']);

export async function FeaturePageView({ feature: f, locale }: { feature: FeaturePageEntry; locale: FeatureLocale }) {
  const w = WORDS[locale];
  const price = resolveFeaturePrice(f.price, await readFeatureCatalogue());
  const priceLabel = featurePriceLabel(price, locale);
  const Icon = featureIcon(f.icon);
  const isSupplier = f.group === 'suppliers';
  const start = isSupplier
    ? { href: '/open-shop', label: w.startSupplier }
    : { href: '/signup', label: w.startHost };
  const guides = (f.guides ?? []).map((s) => findBlogArticle(s)).filter((a) => a !== undefined);
  const hubHref = locale === 'tl' ? FEATURES_HUB_PATHS.tl : FEATURES_HUB_PATHS.en;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(featureJsonLd(f, locale, price)) }}
      />
      <main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6 sm:px-6 sm:pt-10" lang={locale === 'tl' ? 'tl' : 'en'}>
        <nav aria-label="Breadcrumb" className="flex items-center justify-between gap-3 text-sm">
          <ol className="flex min-w-0 items-center gap-1.5">
            <li>
              <Link href={hubHref} className={`${MUTED} underline-offset-4 hover:underline`}>
                {w.features}
              </Link>
            </li>
            <li aria-hidden className={MUTED}>›</li>
            <li className="truncate text-[var(--m-ink)]" aria-current="page">
              {f.name[locale]}
            </li>
          </ol>
          <LocaleSwitch locale={locale} paths={featurePaths(f.slug)} />
        </nav>

        <header className="mt-6">
          <div className="flex items-center gap-3">
            <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[var(--m-orange-4)] ${GOLD}`}>
              <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <h1 className="font-serif text-3xl leading-tight tracking-tight text-[var(--m-ink)] sm:text-4xl">
              {f.name[locale]}
            </h1>
          </div>
          <p className="mt-3 text-lg text-[var(--m-ink)]">{f.line[locale]}</p>
          {/* Answer-first: the paragraph an answer engine quotes. */}
          <p className={`mt-3 text-base leading-relaxed ${MUTED}`}>{f.answer[locale]}</p>
          <p className="mt-4 text-sm">
            <span className={`font-mono text-[11px] uppercase tracking-[0.16em] ${GOLD}`}>{w.price}</span>{' '}
            <span className="font-semibold text-[var(--m-ink)]">{priceLabel}</span>
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {f.tryHref ? (
              <Link href={f.tryHref} className={PRIMARY_CTA}>
                {w.tryIt}
                <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </Link>
            ) : (
              <Link href={start.href} className={PRIMARY_CTA}>
                {start.label}
              </Link>
            )}
            {f.moreHref ? (
              <Link href={f.moreHref} className={SECONDARY_CTA}>
                {w.more(f.name[locale])}
              </Link>
            ) : null}
          </div>
        </header>

        {f.shots.length > 0 ? (
          <div className="mt-10 flex gap-4 overflow-x-auto pb-2">
            {f.shots.map((s) =>
              s.src.startsWith('/demo/') ? (
                <div key={s.src} className="relative aspect-square w-[260px] flex-none overflow-hidden rounded-2xl">
                  <Image src={s.src} alt={s.alt[locale]} fill sizes="260px" className="object-cover" loading="lazy" />
                </div>
              ) : (
                <div key={s.src} className="aspect-[460/972] w-[150px] flex-none overflow-hidden rounded-2xl">
                  <Image
                    src={s.src}
                    alt={s.alt[locale]}
                    width={460}
                    height={972}
                    sizes="150px"
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              ),
            )}
          </div>
        ) : null}

        <section className={SECTION} aria-labelledby="for-who">
          <h2 id="for-who" className={H2}>{w.forWho}</h2>
          <p className={`mt-3 text-base leading-relaxed ${MUTED}`}>{f.forWho[locale]}</p>
        </section>

        <section className={SECTION} aria-labelledby="how-it-works">
          <h2 id="how-it-works" className={H2}>{w.how}</h2>
          <ol className="mt-5 space-y-5">
            {f.steps[locale].map((s, i) => (
              <li key={s} className="flex gap-4">
                <span className={`font-mono text-sm ${GOLD}`}>{String(i + 1).padStart(2, '0')}</span>
                <p className="text-base leading-relaxed text-[var(--m-ink)]">{s}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={SECTION} aria-labelledby="different">
          <h2 id="different" className={H2}>{w.different}</h2>
          <ul className="mt-5 space-y-3">
            {f.different[locale].map((d) => (
              <li key={d} className="flex gap-3 text-base leading-relaxed text-[var(--m-ink)]">
                <span aria-hidden className={GOLD}>—</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={SECTION} aria-labelledby="works-with">
          <h2 id="works-with" className={H2}>{w.worksWith}</h2>
          <ul className="mt-5 divide-y divide-[var(--m-line)]">
            {f.worksWith.map((x) => {
              const other = featurePage(x.slug);
              if (!other) return null;
              const OtherIcon = featureIcon(other.icon);
              return (
                <li key={x.slug}>
                  <Link href={featureHref(x.slug, locale)} className="group flex items-start gap-3 py-4">
                    <OtherIcon aria-hidden className={`mt-0.5 h-5 w-5 flex-none ${GOLD}`} strokeWidth={1.75} />
                    <span>
                      <span className="block font-semibold text-[var(--m-ink)] group-hover:underline">
                        {other.name[locale]}
                      </span>
                      <span className={`block text-sm ${MUTED}`}>{x.how[locale]}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {LINKS_SUPPLIER_REGIONS.has(f.slug) ? (
            <p className="mt-4 text-sm">
              <Link href="/suppliers" className="font-semibold text-[var(--m-ink)] underline underline-offset-4">
                {w.findSuppliers}
              </Link>
            </p>
          ) : null}
        </section>

        <section className={SECTION} aria-labelledby="faq">
          <h2 id="faq" className={H2}>{w.faq}</h2>
          <div className="mt-5 divide-y divide-[var(--m-line)]">
            {f.faq[locale].map((x) => (
              <div key={x.q} className="py-5">
                <h3 className="font-serif text-lg text-[var(--m-ink)]">{x.q}</h3>
                <p className={`mt-1.5 text-base leading-relaxed ${MUTED}`}>{x.a}</p>
              </div>
            ))}
          </div>
        </section>

        {guides.length > 0 ? (
          <section className={SECTION} aria-labelledby="guides">
            <h2 id="guides" className={H2}>{w.guides}</h2>
            <ul className="mt-5 space-y-3">
              {guides.map((g) => (
                <li key={g.slug}>
                  <Link href={`/blog/${g.slug}`} className="font-semibold text-[var(--m-ink)] underline underline-offset-4">
                    {g.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className={SECTION}>
          <div className="flex flex-wrap items-center gap-3">
            <Link href={start.href} className={PRIMARY_CTA}>
              {start.label}
            </Link>
            <Link
              href={isSupplier ? '/for-suppliers' : '/pricing'}
              className={`text-sm font-semibold underline underline-offset-4 ${MUTED}`}
            >
              {w.pricing}
            </Link>
            <Link href={hubHref} className={`text-sm font-semibold underline underline-offset-4 ${MUTED}`}>
              {w.features}
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
