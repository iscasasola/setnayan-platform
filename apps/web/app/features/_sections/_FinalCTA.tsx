import Image from 'next/image';
import Link from 'next/link';

import type { MarketingLocale } from '@/lib/marketing-i18n';
import s from '../features-story.module.css';
import { StoryIcon } from '../_story-icons';

// The close — v3 (owner-approved 11 Nov): a photo, one line for each side, and TWO EQUAL buttons, because the page
// now speaks to hosts and to suppliers alike. Each button says what it opens: sign-up for a host, the supplier front
// door for a shop. (2026-10-01: the old copy promised a concierge call this flow never makes — see git history.)

const COPY: Record<
  MarketingLocale,
  { eyebrow: string; heading: string; body: string; ctaPrimary: string; ctaSecondary: string }
> = {
  en: {
    eyebrow: 'Set na ’yan. · it’s all set.',
    heading: 'Start free. Add only what your event needs.',
    body: 'Hosts plan for free and pay only for the show. Suppliers open a shop for free and pay only when we bring the client.',
    ctaPrimary: 'Start planning · free',
    ctaSecondary: 'Open a shop · free',
  },
  tl: {
    eyebrow: 'Set na ’yan. · set na lahat.',
    heading: 'Magsimula nang libre. Idagdag lang ang kailangan ng event mo.',
    body: 'Libre ang pagpaplano para sa hosts; ang show lang ang may bayad. Libre ring magbukas ng shop ang suppliers; may bayad lang kapag kami ang nagdala ng kliyente.',
    ctaPrimary: 'Magsimula · libre',
    ctaSecondary: 'Magbukas ng shop · libre',
  },
};

export function FinalCTA({ locale }: { locale: MarketingLocale }) {
  const c = COPY[locale];
  return (
    <section className={s.close} aria-labelledby="close-h">
      <Image src="/marketing/2026-11-04/hero-christening.webp" alt="" fill sizes="100vw" className={s.closeImg} />
      <div className={`${s.closeIn} ${s.gut}`}>
        <p className={s.closeEye}>{c.eyebrow}</p>
        <h2 id="close-h">{c.heading}</h2>
        <p className={s.closeLine}>{c.body}</p>
        <div className={s.closeBtns}>
          <Link className={`${s.btn} ${s.btnFill}`} href="/signup">
            <StoryIcon name="home" className={s.bi} />
            <span>{c.ctaPrimary}</span>
          </Link>
          <Link className={`${s.btn} ${s.btnLine}`} href="/for-suppliers">
            <StoryIcon name="store" className={s.bi} />
            <span>{c.ctaSecondary}</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
