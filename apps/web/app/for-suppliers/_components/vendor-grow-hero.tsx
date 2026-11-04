/**
 * VendorGrowHero — the /for-suppliers hero, ported from the owner-approved 4 Nov 2026 prototype
 * (`prototypes/for_suppliers_2026-11-04.html`, section 1 "aspiring · new · experienced").
 *
 * "Start or grow your event business here." — one headline for three kinds of supplier (no business yet · new ·
 * experienced), one primary door ("Open a shop — free") — no demo-shop button (owner, "just do not add buttons") — and the truths line with the
 * booking fee behind an ⓘ.
 *
 * THE PHOTOS — six trades, one every 5 s (`HeroSlides`), the owner's 4 Nov renders in
 * `public/marketing/2026-11-04/`. Hero rule (owner, "images are too cut", for all three marketing pages):
 *   · phone — `object-fit: cover`;
 *   · ≥1024 px — the hero is `min(100svh − bar, max(600px, 58vw))` tall and the photo shows its FULL height,
 *     anchored right and shifted right by its own `--dr` (the prototype's values, below); zoom 2.5%.
 *
 * Replaces the 2026-07-05 hero ("Everything your business needs. Set na 'yan.", one photo under a dark scrim)
 * and its scroll-lock gate (`vendor-hero-gate.tsx`, owner 2026-07-10): the 4 Nov prototype has no lock and no
 * "How the model works ↓" release, and a lock whose only exits leave the page would strand the visitor above
 * everything this page now says.
 *
 * No peso figure is typed here: the fee's numbers are the LIVE schedule the page read (`fee`), via
 * `bookingFeeBandsLine`; `null` names the fee with no rate.
 */
import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { InfoTip } from '@/app/_components/info-tip';
import { bookingFeeBandsLine, type BookingFeeSchedule } from '@/lib/booking-fee';
import { FIRST_BOOKING_FREE } from '@/lib/booking-fee-lock';
import { HERO_SLIDES, MARKETING_PHOTOS, OPEN_SHOP_HREF } from './supplier-page-words';
import { HeroSlides } from './for-vendors-motion';
import css from './vendor-grow.module.css';

/** `fee` — the LIVE schedule the page read, or null (named without a rate). */
export function VendorGrowHero({ fee }: { fee: BookingFeeSchedule | null }) {
  return (
    <section className={css.hero} aria-labelledby="fs-h1">
      <div className={css.heroPhoto} aria-hidden>
        <HeroSlides>
          {HERO_SLIDES.map((s, i) => (
            <Image
              key={s.key}
              src={`${MARKETING_PHOTOS}/${s.key}.webp`}
              alt={s.alt}
              width={1600}
              height={1200}
              priority={i === 0}
              sizes="(min-width: 1024px) 80vw, 100vw"
              className={css.slideImg}
              style={{ '--dr': s.dr } as CSSProperties}
            />
          ))}
        </HeroSlides>
      </div>
      <div className={css.heroCopy}>
        <p className={css.eyebrow}>For suppliers</p>
        <h1 id="fs-h1" className={css.h1}>
          Start or grow your event business here.
        </h1>
        <p className={css.heroLede}>
          <b>Setnayan is where Filipino hosts plan their events</b> — and where they find, compare and book their
          suppliers. Whether you have no business yet, a new one, or one booked every weekend, this is your starting
          market.
        </p>
        <dl className={css.three}>
          <div>
            <dt>No business yet?</dt>
            <dd>Open a shop in two steps, free. Your first booking through Setnayan is free too.</dd>
          </div>
          <div>
            <dt>New?</dt>
            <dd>Get Verified free, and couples and search engines can find you.</dd>
          </div>
          <div>
            <dt>Experienced?</dt>
            <dd>Bring your clients in free and keep them free. Pay only on the ones Setnayan brings.</dd>
          </div>
        </dl>
        <div className={css.ctas}>
          <Link href={OPEN_SHOP_HREF} className={`${css.btn} ${css.btnPrimary}`}>
            Open a shop — free
          </Link>
        </div>
        <div className={css.truths}>
          <span>Free to join</span>
          <span className={css.sep} aria-hidden>
            ·
          </span>
          <span>Full dashboard free</span>
          <span className={css.sep} aria-hidden>
            ·
          </span>
          <span>Only Verified businesses are shown</span>
          <span className={css.sep} aria-hidden>
            ·
          </span>
          <InfoTip label="Booking fee only on the couples Setnayan brings" ariaLabel="About the booking fee" align="start">
            {FIRST_BOOKING_FREE} After that,{' '}
            {fee ? bookingFeeBandsLine(fee) : 'a booking fee'} — only on couples Setnayan brought you. The clients you
            import or bring yourself never carry a fee.
          </InfoTip>
        </div>
      </div>
    </section>
  );
}
