'use client';

/**
 * RevealOverlay — the opening "reveal" layer for the couple website.
 *
 * Mounts a full-screen reveal (envelope / veil) over the Save-the-Date (and later
 * RSVP) phase. The guest opens it to uncover the invitation beneath.
 *
 * Progressive enhancement: renders nothing on the server and until mounted, so a
 * guest with JS disabled (or before hydration) sees the content directly — the
 * reveal is a delight layer, never a gate. Once opened it removes itself so the
 * page underneath is fully interactive.
 *
 * Activation (the caller passes `enabled` = "we're in the Save-the-Date phase"):
 *   - global flag  `NEXT_PUBLIC_STD_REVEAL=1`  → on for everyone, default template
 *   - per-visit URL `?reveal=veil` | `?reveal=envelope` → preview/override a
 *     template without flipping the global flag (used to demo on Vercel previews)
 *
 * Template registry is a switch. The WebGL veil is lazy-loaded via next/dynamic
 * (ssr:false) so three.js lands in a code-split chunk fetched only when the veil
 * actually mounts — the main couple-site bundle stays clean.
 */

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { FourFlapEnvelope } from './four-flap';

const VeilReveal = dynamic(() => import('./veil-reveal'), { ssr: false });

export type RevealTemplate = 'four-flap' | 'veil-sheer';

type Props = {
  /** True when the page is in the Save-the-Date phase (the only place it shows). */
  enabled: boolean;
  /** Short couple monogram for the envelope seal, e.g. "A & J". */
  monogram: string;
  /** Veil tulle colour (hex) from the Mood Board palette. */
  veilColor?: string;
};

const FLAG_ON = process.env.NEXT_PUBLIC_STD_REVEAL === '1';
const OPEN_MS = 1200;

export function RevealOverlay({ enabled, monogram, veilColor = '#f3ece1' }: Props) {
  const [mounted, setMounted] = useState(false);
  const [reveal, setReveal] = useState('');
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setReveal(new URLSearchParams(window.location.search).get('reveal') ?? '');
    } catch {
      /* noop */
    }
  }, []);

  // Envelope folds for a beat before the overlay is removed; the veil removes
  // itself the moment it's lifted clear (handled in onRevealed).
  useEffect(() => {
    if (!open || reveal === 'veil') return;
    const t = setTimeout(() => setGone(true), OPEN_MS);
    return () => clearTimeout(t);
  }, [open, reveal]);

  const active = enabled && (FLAG_ON || reveal !== '');
  if (!active || !mounted || gone) return null;

  if (reveal === 'veil') {
    return (
      <div
        className={`fixed inset-0 z-[60] overflow-hidden transition-opacity duration-500 ${
          open ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <VeilReveal
          veilColor={veilColor}
          onRevealed={() => {
            setOpen(true);
            setTimeout(() => setGone(true), 500);
          }}
        />
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-10 text-center transition-opacity duration-500 ${
            open ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-cream/90 [text-shadow:0_1px_6px_rgba(0,0,0,0.55)]">
            Lift the veil ↑
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden">
      <FourFlapEnvelope monogram={monogram} open={open} onOpen={() => setOpen(true)} />
    </div>
  );
}
