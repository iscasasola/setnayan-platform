'use client';

/**
 * SetnayanAiStory — the one-page, NO-SCROLL (desktop) Setnayan AI story.
 *
 * Owner 2026-07-02: "make Setnayan AI 1 of the 5 icons on the bottom and it will
 * show a 1 page no scroll, for desktop, the story of setnayan AI." Opens when
 * the Suri · Setnayan AI dock tile is selected (and from the nav pop-up's "full
 * story" action) — the story lives INSIDE the new homepage world instead of
 * bouncing to the old-chrome /setnayan-ai route (the owner's core complaint).
 *
 * Copy per the GTM framework (Setnayan_AI_GTM_Content_2026-07-02.md): the
 * category flip ("it doesn't chat, it watches") + relief + the three SHIPPED
 * jobs + the restraint promise + catalog-driven price. Honesty guardrails: no
 * personalization/cohort teasers (dormant), no tech named, no fake urgency,
 * price never hardcoded (reads `pricing` from the live catalog).
 *
 * Layout: fixed full-viewport takeover portaled to <body> (same reasoning as
 * OverlayShell — hero transforms would trap a fixed child). One 100dvh screen,
 * content centered, no scroll at desktop heights; short/mobile viewports fall
 * back to overflow-y auto so nothing is unreachable. Esc / backdrop / ✕ close
 * via the shared useModalA11y (focus trap + scroll lock).
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useModalA11y } from '@/lib/use-modal-a11y';
import type { PricingData } from './pricing-data';

const INK = '#f4f1ea';
const SOFT = 'rgba(244,241,234,.78)';
const FAINT = 'rgba(244,241,234,.55)';

export function SetnayanAiStory({
  open,
  onClose,
  pricing,
}: {
  open: boolean;
  onClose: () => void;
  pricing: PricingData;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useModalA11y({ open, onClose, containerRef: ref });
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!open || !mounted) return null;

  const jobs: Array<[string, string]> = [
    ['Does the legwork', 'Finds and ranks your best-fit verified vendors, chases the quiet ones, and lines up their quotes.'],
    ['Stands guard', 'Flags a deposit due, a price change, a double-booking, or a deadline before it slips.'],
    ['Reassures you', '“Great pick — 47 reviews, 4.8★,” with the evidence. So you stop second-guessing.'],
  ];

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="The Setnayan AI story"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflowY: 'auto',
        padding: '46px 20px 28px',
        background:
          'linear-gradient(rgba(24,26,29,.62), rgba(24,26,29,.86)), radial-gradient(100% 85% at 50% 35%, #A6AEB6 0%, #757d86 44%, #383f47 100%)',
      }}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'fixed',
          top: 18,
          right: 22,
          width: 38,
          height: 38,
          borderRadius: 'var(--m-r-full)',
          border: '1px solid rgba(244,241,234,.35)',
          background: 'rgba(24,26,29,.35)',
          color: INK,
          fontSize: 15,
          cursor: 'pointer',
        }}
      >
        ✕
      </button>

      <div style={{ width: '100%', maxWidth: 780, textAlign: 'center', margin: 'auto' }}>
        <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase', color: FAINT, margin: 0 }}>
          Suri · Setnayan AI — your planning brain
        </p>
        <h2
          style={{
            fontFamily: 'var(--hr-serif)',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 'clamp(30px, 4.6vw, 52px)',
            lineHeight: 1.06,
            letterSpacing: '-0.01em',
            color: INK,
            margin: '14px 0 0',
          }}
        >
          It doesn&rsquo;t chat.
          <br />
          It watches your event for you.
        </h2>
        <p style={{ fontSize: 'clamp(14px, 1.4vw, 16px)', lineHeight: 1.55, color: SOFT, maxWidth: 620, margin: '16px auto 0' }}>
          Every other planning AI waits for you to ask a question. Setnayan AI keeps an eye on the vendors
          you&rsquo;re eyeing and the ones you&rsquo;ve booked — and taps you only when something needs you: a deposit
          due, a price that moved, a date about to clash.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
            margin: '26px 0 0',
            textAlign: 'left',
          }}
        >
          {jobs.map(([t, d]) => (
            <div
              key={t}
              style={{
                background: 'rgba(244,241,234,.08)',
                border: '1px solid rgba(244,241,234,.16)',
                borderRadius: 'var(--m-r-md)',
                padding: '14px 16px',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14, color: INK }}>{t}</div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: SOFT, marginTop: 4 }}>{d}</div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 13, color: FAINT, margin: '18px auto 0', maxWidth: 560 }}>
          One calm weekly digest — loud only when it can&rsquo;t wait. No spam, no fake countdowns.
        </p>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--hr-serif)', fontStyle: 'italic', fontSize: 30, color: INK }}>{pricing.aiPrice}</span>
          <span style={{ fontSize: 14, color: FAINT }}>{pricing.aiPeriod}</span>
          <span
            style={{
              background: 'rgba(244,241,234,.14)',
              color: INK,
              fontSize: 12,
              fontWeight: 500,
              padding: '4px 12px',
              borderRadius: 'var(--m-r-full)',
            }}
          >
            {pricing.aiIntroPrice} your first 28 days
          </span>
        </div>
        <p style={{ fontSize: 12.5, color: FAINT, margin: '6px 0 0' }}>
          Covers all your events · 0% vendor commission · every planning tool stays free.
        </p>

        <div style={{ display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
          <Link
            href="/onboarding/wedding?from=setnayan-ai-story"
            style={{
              background: INK,
              color: '#211f1b',
              fontSize: 14,
              fontWeight: 600,
              padding: '12px 24px',
              borderRadius: 'var(--m-r-full)',
              textDecoration: 'none',
            }}
          >
            Turn on Setnayan AI
          </Link>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: SOFT, fontSize: 14, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            Keep exploring
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
