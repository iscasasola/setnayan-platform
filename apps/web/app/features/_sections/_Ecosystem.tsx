import Link from 'next/link';
import { Fragment } from 'react';

import type { MarketingLocale } from '@/lib/marketing-i18n';
import { ECOSYSTEM_CHAINS, featureHref, featurePage } from '@/lib/feature-pages';

// THE ECOSYSTEM BAND — "one band showing the whole ecosystem as a simple
// connected map" (DECISION_LOG 2026-10-01 "EVERY FEATURE PAGE SAYS WHY IT'S
// AHEAD — AND HOW IT WORKS WITH THE REST OF SETNAYAN").
//
// Each chain is a row of linked feature names joined by arrows: the path a
// person's work actually travels. The chains live in the registry
// (`ECOSYSTEM_CHAINS`) beside the features they connect; this file only draws
// them. Plain text and links — no diagram library, no client code.

const WORDS = {
  en: { heading: 'How it all connects', line: 'Nothing is typed twice. Each part hands its work to the next.' },
  tl: {
    heading: 'Paano nagkakaugnay ang lahat',
    line: 'Walang tina-type nang dalawang beses. Ipinapasa ng bawat bahagi ang trabaho sa susunod.',
  },
} as const;

export function EcosystemBand({ locale }: { locale: MarketingLocale }) {
  const w = WORDS[locale];
  return (
    <section aria-labelledby="ecosystem" className="mt-12 bg-ink/[0.03] py-12">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <h2 id="ecosystem" className="font-display text-2xl font-medium tracking-tight text-ink sm:text-3xl">
          {w.heading}
        </h2>
        <p className="mt-2 text-base text-ink/70">{w.line}</p>
        <div className="mt-6 space-y-6">
          {ECOSYSTEM_CHAINS.map((c) => (
            <div key={c.name.en}>
              <h3 className="text-base font-semibold text-ink">{c.name[locale]}</h3>
              <p className="mt-0.5 text-sm text-ink/65">{c.line[locale]}</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                {c.slugs.map((slug, i) => {
                  const f = featurePage(slug);
                  if (!f) return null;
                  return (
                    <Fragment key={slug}>
                      {i > 0 ? (
                        <span aria-hidden className="text-ink/40">
                          →
                        </span>
                      ) : null}
                      <Link
                        href={featureHref(slug, locale)}
                        className="font-medium text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-ink"
                      >
                        {f.name[locale]}
                      </Link>
                    </Fragment>
                  );
                })}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
