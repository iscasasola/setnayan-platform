'use client';

/**
 * ReskinFooter — the ONE site footer, in the ELN-reskin style (hr-footer).
 *
 * Extracted from HomeReskin's private HomeFooter (2026-07-03) so the homepage
 * and every public marketing page render the SAME footer from one source —
 * the old site had five forked footer implementations (_SiteFooter,
 * _sections.Footer, page-tail.Footer, plus inline copies on privacy /
 * how-it-works / pricing / help / download), which is exactly the anti-fork
 * chrome drift the owner keeps flagging.
 *
 * Carries every compliance link (Legal column) plus product/company links, and
 * "crawls in" — translateY + fade, staggered per column — when it scrolls into
 * view. Respects reduced motion.
 *
 * Every internal link click calls pinFooter(): on the destination page the
 * persistent SiteFooterChrome renders this same footer as a pinned bottom
 * sheet, so footer-to-footer navigation never loses the footer. Top-nav
 * presses unpin it (see footer-pin.ts).
 */

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { SetnayanMark } from '@/app/_components/setnayan-mark-icon';
import { openConsentManager } from '@/lib/cookie-consent';
import { pinFooter } from './footer-pin';

function reduceMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function ReskinFooter() {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduceMotion()) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <footer ref={ref} className={`hr-footer${inView ? ' hr-foot-in' : ''}`}>
      <div className="hr-foot-grid">
        <div className="hr-foot-brand">
          <span className="hr-foot-mark">
            <SetnayanMark />
          </span>
          <span className="hr-foot-word">Setnayan</span>
          <p className="hr-foot-tag">
            One place that plans it, runs it, remembers it — and keeps it, for
            life. <i>Set na &rsquo;yan.</i>
          </p>
        </div>

        <nav className="hr-foot-col" aria-label="Explore" onClick={onFooterLinkClick}>
          <h3>Explore</h3>
          <Link href="/pricing">Prices</Link>
          <Link href="/explore">Vendors</Link>
          <Link href="/papic">Papic</Link>
          <Link href="/monogram">Monogram maker</Link>
          <Link href="/download">Download app</Link>
        </nav>

        <nav className="hr-foot-col" aria-label="Company" onClick={onFooterLinkClick}>
          <h3>Company</h3>
          <Link href="/about">About</Link>
          <Link href="/blog">Journal</Link>
          <Link href="/weddings">Real stories</Link>
          <Link href="/help">Help center</Link>
          <Link href="/vendors">For vendors</Link>
        </nav>

        <nav className="hr-foot-col" aria-label="Legal" onClick={onFooterLinkClick}>
          <h3>Legal</h3>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/refunds">Refunds &amp; cancellations</Link>
          <Link href="/cookies">Cookie policy</Link>
          <Link href="/acceptable-use">Acceptable use</Link>
          <button type="button" className="hr-foot-linkbtn" onClick={() => openConsentManager()}>
            Cookie settings
          </button>
        </nav>
      </div>

      <div className="hr-foot-base">
        <span>&copy; 2026 Setnayan &middot; Made in the Philippines</span>
        <span>
          Data Protection Officer ·{' '}
          <a href="mailto:dpo@setnayan.com">dpo@setnayan.com</a>
        </span>
      </div>
    </footer>
  );
}

/**
 * One delegated handler per column instead of an onClick on every <Link>:
 * pins the footer for any real anchor navigation inside the column. The
 * "Cookie settings" button and the mailto: link are not internal navigations,
 * so they don't pin.
 */
function onFooterLinkClick(e: React.MouseEvent) {
  const a = (e.target as HTMLElement).closest('a');
  if (a && a.getAttribute('href')?.startsWith('/')) pinFooter();
}
