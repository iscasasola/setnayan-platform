'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BadgeCheck } from 'lucide-react';
import { Wordmark } from '@/app/_components/brand-marks';
import { SETNAYAN_HOME_URL } from '@/lib/shop-back';
import { LazyVerifiedFullscreen } from './verified-award-button';

/**
 * 🧭 THE SHOP PAGE'S TOP BAR (owner 15 Nov 2026, DECISION_LOG "SHOP WEBSITE TOP BAR, ONCE SCROLLED" and "SHOP WEBSITE:
 * A 10-BRANCH SHOP, THE NAME RISES INTO THE TOP BAR …"; prototype Supplier Website Looks v16).
 *
 * It stays at the top of the screen. Before scrolling it reads ‹ back (named for where the visitor came from —
 * `shopTopBack`, lib/shop-back.ts) + SETNAYAN, which opens www.setnayan.com as an ABSOLUTE address so it leaves a shop
 * served on its own domain. Once the shop's name (the page's <h1>) scrolls under the bar:
 *   · the back keeps only its chevron, and SETNAYAN gives way to the shop's OWN round logo + name — one button that
 *     brings the page back to the top;
 *   · on a verified shop the blue check beside the name is its own 44 px button that opens the shop's Setnayan
 *     Verified award FULL SCREEN — the award kit's `VerifiedFullscreen` (app/_components/award, #7752), reused as
 *     shipped through `LazyVerifiedFullscreen` (./verified-award-button), with the same blue-check seal the Awards row draws (`verifiedArt`). Its ✕, a tap or Esc closes it.
 * The Share + heart (Add to event) appear only once the page's own buttons have scrolled away (`[data-shop-quick]`),
 * so the same buttons are never on screen twice. Nothing here opens by itself.
 */
export function ShopTopBar({
  back,
  backCompact,
  shopName,
  logo,
  verified,
  verifiedArt,
  acts,
  end,
  widthClass,
}: {
  /** The back button as it reads at the top of the page (chevron + place name). */
  back: ReactNode;
  /** The same back, chevron only — once the shop's name has taken the bar. */
  backCompact: ReactNode;
  shopName: string;
  /** The shop's own small round logo (or its initials). */
  logo: ReactNode;
  verified: boolean;
  /** The Setnayan Verified seal as the Awards row draws it — the art the full-screen award shows. */
  verifiedArt?: ReactNode;
  /** Share + Add to event — shown once the body's own buttons have scrolled away. Null = none on this page. */
  acts: ReactNode | null;
  /** Anything the bar always ends with (Return to Dashboard for a signed-in viewer). */
  end?: ReactNode;
  /** The page column's width, so the bar lines up with the page under it. */
  widthClass: string;
}) {
  const barRef = useRef<HTMLElement | null>(null);
  const [named, setNamed] = useState(false);
  const [acted, setActed] = useState(false);
  const [verifiedOpen, setVerifiedOpen] = useState(false);
  const hasActs = acts !== null;

  useEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof IntersectionObserver === 'undefined') return;
    const h = Math.round(bar.getBoundingClientRect().height);
    const passed = (en: IntersectionObserverEntry) => !en.isIntersecting && en.boundingClientRect.top < h;
    const observers: IntersectionObserver[] = [];
    const name = document.querySelector<HTMLElement>('#shop-top h1');
    if (name) {
      const io = new IntersectionObserver(([en]) => en && setNamed(passed(en)), { rootMargin: `-${h}px 0px 0px 0px` });
      io.observe(name);
      observers.push(io);
    }
    const quick = hasActs ? document.querySelector<HTMLElement>('[data-shop-quick]') : null;
    if (quick) {
      const io = new IntersectionObserver(([en]) => en && setActed(passed(en)), { rootMargin: `-${h}px 0px 0px 0px` });
      io.observe(quick);
      observers.push(io);
    }
    return () => observers.forEach((o) => o.disconnect());
  }, [hasActs]);

  const smooth = () =>
    typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto';

  const toTop = () => window.scrollTo({ top: 0, behavior: smooth() });

  const showVerified = () => setVerifiedOpen(true);

  return (
    <header
      ref={barRef}
      data-shop-top-bar=""
      data-named={named ? '' : undefined}
      className="sticky top-0 z-30 border-b border-ink/5 bg-page/90 backdrop-blur"
    >
      <div className={`mx-auto flex min-h-14 w-full ${widthClass} items-center justify-between gap-3 px-4 sm:px-6 lg:px-8`}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {named ? backCompact : back}
          {named ? (
            <span className="flex min-w-0 items-center" data-shop-top-name="">
              <button
                type="button"
                onClick={toTop}
                aria-label={`${shopName} — back to the top of the page`}
                className="flex min-h-11 min-w-0 items-center gap-2 text-left text-base font-bold text-ink"
              >
                {logo}
                <span className="truncate">{shopName}</span>
              </button>
              {verified ? (
                <button
                  type="button"
                  onClick={showVerified}
                  aria-label="Setnayan Verified — what it means"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-sn-accent"
                >
                  <BadgeCheck aria-hidden className="h-5 w-5" strokeWidth={2} />
                </button>
              ) : null}
            </span>
          ) : (
            <a href={SETNAYAN_HOME_URL} className="flex min-h-11 items-center text-ink" aria-label="SETNAYAN — opens setnayan.com">
              <Wordmark size={22} />
            </a>
          )}
        </div>
        {acts && acted ? (
          <div className="flex shrink-0 items-center gap-1" data-shop-top-acts="">
            {acts}
          </div>
        ) : null}
        {end}
      </div>
      {verified && verifiedOpen ? (
        <LazyVerifiedFullscreen art={verifiedArt ?? null} shopName={shopName} onClose={() => setVerifiedOpen(false)} />
      ) : null}
    </header>
  );
}
