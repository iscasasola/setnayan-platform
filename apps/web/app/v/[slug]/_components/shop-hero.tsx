/**
 * 🌄 THE VERIFIED SHOP'S HERO — full-bleed, the name on the photo, the Verified seal and the badge circles on it
 * (owner 2026-11-13: "verified suppliers get more … above and beyond beautiful and elegant"; DECISION_LOG "THE SHOP
 * WEBSITE HAS TWO LOOKS" — every verified shop, Verified · Solo · Pro · Ultra, wears the same best page; prototype
 * `public_pages_three_2026-11-13`, `.hero`).
 *
 * 🚫 NO BUTTONS ON THE PHOTO (owner 13 Nov, "Yes, one main button"): the calling card right under it carries Inquire.
 * A second Inquire here is exactly the duplicate `one-inquire-button.test.ts` forbids.
 *
 * Server-rendered; the motion is CSS (`shop-motion.module.css`), arrival-only, and the resting state is complete.
 */
import type { ReactNode } from 'react';
import Image from 'next/image';
import { MarkedPhoto } from '@/app/_components/marked-photo';
import m from './shop-motion.module.css';

export function ShopHero({
  name,
  kicker,
  tagline,
  photoUrl,
  photoIsMarked,
  badges,
  marker,
  frame = 'page',
}: {
  /** The display label — the hybrid-anonymity placeholder while the name is hidden, never the raw business name. */
  name: string;
  kicker: string;
  tagline: string | null;
  /** The shop's chosen hero, else its first portfolio photo, else the shared placeholder. */
  photoUrl: string;
  /** A portfolio photo carries the shop's mark and is drawn whole on its blur (`MarkedPhoto`); the placeholder is not. */
  photoIsMarked: boolean;
  badges: ReactNode;
  /** The "(DEMO ONLY)" marker for a demo shop, beside the name. */
  marker?: ReactNode;
  /**
   * 'page' — the shop page itself (the default): the name is the page's <h1>, the photo is preloaded, and the hero grows
   * with the screen. 'sample' — the SAME hero drawn inside another page as its phone-width sample (`SampleShopPage`, on
   * /for-suppliers and /for-coordinators): the name is a paragraph (that page owns its headings), nothing is preloaded,
   * and the sizes stay the phone's at any screen width, because the drawing sits in a phone-width frame.
   */
  frame?: 'page' | 'sample';
}) {
  const words = name.split(/\s+/).filter(Boolean);
  const sample = frame === 'sample';
  const Name = sample ? 'p' : 'h1';
  return (
    <header
      data-shop-hero=""
      className={`relative isolate h-[560px] w-full overflow-hidden bg-[var(--sn-ob-page)] text-[var(--sn-ob-text)] ${sample ? '' : 'lg:h-[640px]'}`}
    >
      <div className={`absolute inset-x-0 -bottom-[6%] -top-[6%] -z-20 ${m.heroDrift}`}>
        <div className={`absolute inset-0 ${m.heroPhoto}`}>
          {photoIsMarked ? (
            <MarkedPhoto src={photoUrl} alt="" frame="square" displayAspect={16 / 9} priority={!sample} sizes={sample ? '430px' : '100vw'} />
          ) : (
            <Image src={photoUrl} alt="" fill priority={!sample} sizes={sample ? '430px' : '100vw'} className="object-cover" />
          )}
        </div>
      </div>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(14,12,8,.92)_0%,rgba(14,12,8,.7)_30%,rgba(14,12,8,.25)_58%,rgba(14,12,8,0)_78%,rgba(14,12,8,.3)_100%)]"
      />
      <div
        className={`absolute inset-x-0 bottom-0 mx-auto grid max-w-screen-2xl gap-3 px-5 pb-16 ${sample ? '' : 'sm:px-8 lg:gap-4 lg:px-10 lg:pb-28'} ${m.heroBody}`}
      >
        {kicker ? (
          <p className={`font-mono text-[0.66rem] font-bold uppercase tracking-[0.3em] text-[var(--sn-ob-text)] ${m.kicker}`}>
            {kicker}
          </p>
        ) : null}
        <Name
          aria-label={name}
          className={`font-serif ${sample ? 'text-[3.1rem]' : 'text-[clamp(3.1rem,11vw,7rem)]'} font-normal italic leading-[0.94] tracking-[-0.02em] text-[var(--sn-ob-text)]`}
        >
          {words.map((w, i) => (
            <span key={`${w}-${i}`} aria-hidden="true">
              <span className={m.word}>
                <span style={{ ['--i' as string]: i }}>{w}</span>
              </span>
              {i < words.length - 1 ? ' ' : null}
            </span>
          ))}
        </Name>
        {marker ? <div>{marker}</div> : null}
        {tagline ? (
          <p className={`max-w-[30em] text-[1.05rem] text-[var(--sn-ob-text)] ${sample ? '' : 'lg:text-xl'} ${m.tagline}`}>{tagline}</p>
        ) : null}
        {badges}
      </div>
    </header>
  );
}

/** The seal's caption beside the circular Verified badge on the photo. */
export function SealCaption() {
  return (
    <span className="mr-1.5 font-mono text-[0.66rem] font-bold uppercase leading-tight tracking-[0.14em] text-[var(--sn-ob-text)]">
      Setnayan
      <br />
      Verified
    </span>
  );
}

export { m as shopMotion };
