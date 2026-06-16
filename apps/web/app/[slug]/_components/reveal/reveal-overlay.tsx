'use client';

/**
 * RevealOverlay — the opening "reveal" layer for the couple website.
 *
 * Mounts a full-screen reveal (one of the envelope / door / veil templates) over
 * the Save-the-Date (and later RSVP) phase. The guest opens it to uncover the
 * invitation beneath.
 *
 * Progressive enhancement: renders nothing on the server and until mounted, so a
 * guest with JS disabled (or before hydration) sees the content directly — the
 * reveal is a delight layer, never a gate. Once opened it removes itself so the
 * page underneath is fully interactive.
 *
 * Activation (the caller passes `enabled` = "we're in the Save-the-Date phase"):
 *   - global flag  `NEXT_PUBLIC_STD_REVEAL=1`  → on for everyone, default template
 *   - per-visit URL `?reveal=<id>` → preview/override any template without
 *     flipping the global flag (used to demo on Vercel previews). Accepted ids in
 *     ./reveal-templates REVEAL_ALIASES, e.g. ?reveal=church-doors, ?reveal=crown.
 *
 * Template registry is a switch (./reveal-templates). The rigid families are pure
 * CSS-3D (in the main chunk, Lighthouse-safe); the two WebGL veils are lazy-loaded
 * via next/dynamic (ssr:false) so three.js lands in a code-split chunk fetched
 * only when a veil actually mounts — the main couple-site bundle stays clean.
 */

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { FourFlapEnvelope } from './four-flap';
import { RigidReveal } from './rigid-reveal';
import { isVeilTemplate, REVEAL_ALIASES, type RevealTemplate } from './reveal-templates';

const VeilReveal = dynamic(() => import('./veil-reveal'), { ssr: false });
const VeilCrown = dynamic(() => import('./veil-crown'), { ssr: false });

export type { RevealTemplate } from './reveal-templates';

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

  const override = reveal ? REVEAL_ALIASES[reveal] ?? null : null;
  const template: RevealTemplate = override ?? 'four-flap';
  const veil = isVeilTemplate(template);

  // Rigid templates swing open for a beat before the overlay is removed; the
  // veils remove themselves the moment they're lifted clear (handled in onRevealed).
  useEffect(() => {
    if (!open || veil) return;
    const t = setTimeout(() => setGone(true), OPEN_MS);
    return () => clearTimeout(t);
  }, [open, veil]);

  const active = enabled && (FLAG_ON || override !== null);
  if (!active || !mounted || gone) return null;

  if (veil) {
    const VeilComponent = template === 'veil-crown' ? VeilCrown : VeilReveal;
    return (
      <div
        className={`fixed inset-0 z-[60] overflow-hidden transition-opacity duration-500 ${
          open ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <VeilComponent
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

  if (
    template === 'two-flap-vertical' ||
    template === 'two-flap-horizontal' ||
    template === 'church-doors'
  ) {
    return (
      <div className="fixed inset-0 z-[60] overflow-hidden">
        <RigidReveal variant={template} monogram={monogram} open={open} onOpen={() => setOpen(true)} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden">
      <FourFlapEnvelope monogram={monogram} open={open} onOpen={() => setOpen(true)} />
    </div>
  );
}
