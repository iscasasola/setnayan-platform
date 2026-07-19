'use client';

import Link from 'next/link';
import { useCallback, useEffect } from 'react';

/**
 * VendorHeroGate — the CTA row for the /vendors hero, PLUS a scroll-lock that
 * holds the visitor on the hero until they choose a path (owner 2026-07-10).
 * The hero is a decision gate: the only two ways forward are the two CTAs.
 *
 *  • "List your business for free" → /open-shop (auth-gated vendor onboarding:
 *    login/signup → check for an existing shop → limit check → open it or the
 *    create wizard; all that branching already lives in /open-shop).
 *  • "How the model works ↓" → releases the lock and smooth-scrolls to #model,
 *    handing the rest of the page back to the visitor.
 *
 * Why an island: the hero (vendor-grow-hero.tsx) is a Server Component carrying
 * the LCP <Image>, so it stays server-rendered — only this CTA row is client.
 *
 * Safety: the lock is released on EITHER CTA and on unmount, so a visitor is
 * never trapped. We also skip the lock entirely when the page is deep-linked
 * past the hero (a #hash is present on load) so we don't strand someone at an
 * inner anchor. Respects prefers-reduced-motion for the scroll.
 */
export function VendorHeroGate() {
  const release = useCallback(() => {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }, []);

  useEffect(() => {
    // Deep-linked past the hero (e.g. /vendors#model) — don't gate.
    if (window.location.hash) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  const revealModel = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      release();
      const target = document.getElementById('model');
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    },
    [release],
  );

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <Link
        href="/open-shop"
        className="m-btn m-btn-orange m-btn-lg"
        onClick={release}
      >
        List your business for free
      </Link>
      <a href="#model" className="m-btn m-btn-lg m-hero-wire" onClick={revealModel}>
        How the model works ↓
      </a>
      <style>{`
        .m-hero-wire {
          background: rgba(255,255,255,.08);
          color: #fff;
          border: 1px solid rgba(255,255,255,.5);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }
        .m-hero-wire:hover { background: rgba(255,255,255,.16); }
      `}</style>
    </div>
  );
}
