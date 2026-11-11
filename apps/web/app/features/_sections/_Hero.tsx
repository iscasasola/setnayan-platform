import Image from 'next/image';

import { LocaleSwitch, type MarketingLocale } from '@/lib/marketing-i18n';
import { FEATURES_HUB_PATHS } from '@/lib/feature-pages';
import { PERSONAS } from '@/lib/features-page';
import s from '../features-story.module.css';
import { PersonaPicker, PersonaText, type PersonaChoice } from '../_story-client';

// The /features hub's opening.
//
// ENGLISH — v3 (owner-approved 11 Nov; DECISION_LOG "FEATURES PAGE v3 — APPROVED"): a full-bleed photo, the
// persona's own headline and line, and the "I am" pick that chooses whose story the page tells (kept in the URL
// hash by `PersonaScope`). The ONE <h1> holds the chosen persona's title — never all four.
//
// TAGLISH — the shipped opening (2026-10-01, "/FEATURES — THE FULL LIST"): a title of ≤5 words and ONE line of ≤12,
// so the first group lands in the top third of a 390 px screen. It stays until the v3 rows are written in Taglish.

const TL = {
  title: 'Lahat ng kaya ng Setnayan',
  line: 'Magplano, mag-imbita, magdiwang, mag-alala — at sa suppliers, ma-book.',
};

const titles = Object.fromEntries(PERSONAS.map((p) => [p.key, p.heroTitle])) as Record<PersonaChoice, string>;
const lines = Object.fromEntries(PERSONAS.map((p) => [p.key, p.heroLine])) as Record<PersonaChoice, string>;

export function FeaturesHero({ locale }: { locale: MarketingLocale }) {
  const en = locale === 'en';
  const h1 = (
    <h1 className={en ? undefined : 'font-display text-3xl font-medium tracking-tight text-ink sm:text-5xl'}>
      {en ? <PersonaText texts={titles} /> : TL.title}
    </h1>
  );
  if (!en) {
    return (
      <section className="bg-cream">
        <div className="mx-auto w-full max-w-3xl px-4 pb-4 pt-8 sm:px-6 sm:pt-14">
          <div className="flex items-start justify-between gap-4">
            {h1}
            <LocaleSwitch locale={locale} paths={FEATURES_HUB_PATHS} />
          </div>
          <p className="mt-3 text-base text-ink/70 sm:text-lg">{TL.line}</p>
        </div>
      </section>
    );
  }
  return (
    <section className={s.hero} aria-label="Setnayan features">
      <Image
        src="/marketing/2026-11-04/hero-wedding.webp"
        alt="A bride and groom in a barong walk out past cheering guests under falling petals"
        fill
        priority
        sizes="100vw"
        className={s.heroImg}
      />
      <div className={s.heroTop}>
        <LocaleSwitch locale={locale} paths={FEATURES_HUB_PATHS} className={s.heroLocale} />
      </div>
      <div className={`${s.heroIn} ${s.gut}`}>
        <div>
          <p className={s.heroEye}>Features · Set na ’yan.</p>
          {h1}
          <p className={s.heroLine}>
            <PersonaText texts={lines} />
          </p>
        </div>
        <PersonaPicker label="I am" options={PERSONAS.map((p) => ({ key: p.key, label: p.label }))} />
      </div>
    </section>
  );
}
