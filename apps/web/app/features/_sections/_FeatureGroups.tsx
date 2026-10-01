import Link from 'next/link';

import type { MarketingLocale } from '@/lib/marketing-i18n';
import { FEATURE_GROUPS, featureHref, featuresInGroup } from '@/lib/feature-pages';
import { featurePriceLabel, resolveFeaturePrice } from '@/lib/feature-pages/price';
import { readFeatureCatalogue } from '../_feature-price';
import { featureIcon } from '../_icons';

// THE FIVE GROUPS — the hub's body (DECISION_LOG 2026-10-01: "a few plain
// groups … each feature = icon · one line · Try it · Free or price").
//
// Rendered from the ONE registry (`lib/feature-pages`), so the hub, every
// feature page, the sitemap and llms.txt cannot list different things. The
// six hand-written catalogue sections this replaced were a second list — and
// `features-page-says-what-ships.test.ts` records how often they drifted.
//
// Rows, not cards (`lint-no-card.mjs`): a hairline between features, the
// group name as the only heading. Each row is ONE link to the feature's page;
// "Try it" is a second, separate link only where a real try page exists.
// Prices come from the live catalogue — never typed here.

const WORDS = {
  en: { tryIt: 'Try it' },
  tl: { tryIt: 'Subukan' },
} as const;

export async function FeatureGroups({ locale }: { locale: MarketingLocale }) {
  const catalogue = await readFeatureCatalogue();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
      {FEATURE_GROUPS.map((g) => {
        const items = featuresInGroup(g.key);
        if (items.length === 0) return null;
        return (
          <section key={g.key} id={g.key} aria-labelledby={`group-${g.key}`} className="pt-8">
            <h2
              id={`group-${g.key}`}
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55"
            >
              {g.name[locale]}
            </h2>
            <ul className="mt-2 divide-y divide-ink/10">
              {items.map((f) => {
                const Icon = featureIcon(f.icon);
                const price = featurePriceLabel(resolveFeaturePrice(f.price, catalogue), locale);
                return (
                  <li key={f.slug} className="flex items-start gap-3 py-4">
                    <span className="mt-0.5 flex h-10 w-10 flex-none items-center justify-center rounded-full bg-ink/[0.04] text-ink/70">
                      <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-ink">
                        <Link href={featureHref(f.slug, locale)} className="hover:underline">
                          {f.name[locale]}
                        </Link>
                      </h3>
                      <p className="mt-0.5 text-sm text-ink/65">{f.line[locale]}</p>
                      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        {f.tryHref ? (
                          <Link
                            href={f.tryHref}
                            className="font-semibold text-terracotta underline-offset-4 hover:underline"
                            aria-label={`${WORDS[locale].tryIt}: ${f.name[locale]}`}
                          >
                            {WORDS[locale].tryIt}
                          </Link>
                        ) : null}
                        <span className="text-ink/60">{price}</span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
