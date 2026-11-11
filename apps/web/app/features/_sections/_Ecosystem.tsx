import Link from 'next/link';
import { Fragment } from 'react';

import type { MarketingLocale } from '@/lib/marketing-i18n';
import { ECOSYSTEM_CHAINS, featureHref, featurePage } from '@/lib/feature-pages';
import s from '../features-story.module.css';

// THE ECOSYSTEM BAND — "one band showing the whole ecosystem as a simple
// connected map" (DECISION_LOG 2026-10-01 "EVERY FEATURE PAGE SAYS WHY IT'S
// AHEAD — AND HOW IT WORKS WITH THE REST OF SETNAYAN"). v3 (11 Nov) titles it
// "Nothing is typed twice." and lays the three chains side by side on a wide
// screen.
//
// Each chain is a row of linked feature names joined by arrows: the path a
// person's work actually travels. The chains live in the registry
// (`ECOSYSTEM_CHAINS`) beside the features they connect; this file only draws
// them. Plain text and links — no diagram library, no client code.

const WORDS = {
  en: { heading: 'Nothing is typed twice.', line: 'Each part hands its work to the next.' },
  tl: {
    heading: 'Walang tina-type nang dalawang beses.',
    line: 'Ipinapasa ng bawat bahagi ang trabaho sa susunod.',
  },
} as const;

export function EcosystemBand({ locale }: { locale: MarketingLocale }) {
  const w = WORDS[locale];
  return (
    <section aria-labelledby="ecosystem" className={s.connect}>
      <div className={`${s.gut} ${s.wide}`}>
        <h2 id="ecosystem">{w.heading}</h2>
        <p className={s.connectLine}>{w.line}</p>
        <div className={s.chains}>
          {ECOSYSTEM_CHAINS.map((c) => (
            <div key={c.name.en} className={s.chain}>
              <h3>{c.name[locale]}</h3>
              <p className={s.links}>
                {c.slugs.map((slug, i) => {
                  const f = featurePage(slug);
                  if (!f) return null;
                  return (
                    <Fragment key={slug}>
                      {i > 0 ? <span aria-hidden>→</span> : null}
                      <Link href={featureHref(slug, locale)}>{f.name[locale]}</Link>
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
