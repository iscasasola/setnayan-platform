'use client';

/**
 * RevealOverlay — the opening "reveal" layer for the couple website.
 *
 * Mounts a full-screen reveal (envelope / veil / curtain) over the Save-the-Date
 * (and later RSVP) phase. The guest opens it to uncover the invitation beneath.
 *
 * Progressive enhancement: renders nothing on the server and until mounted, so a
 * guest with JS disabled (or before hydration) sees the content directly — the
 * reveal is a delight layer, never a gate. Once opened it removes itself so the
 * page underneath is fully interactive.
 *
 * Flag-gated by the caller (default off) so it has zero effect on the live site
 * until the full reveal library + chooser ship. Template registry is a switch so
 * the WebGL veils + curtain drop in behind the same contract in a later PR.
 */

import { useEffect, useState } from 'react';
import { FourFlapEnvelope } from './four-flap';

export type RevealTemplate = 'four-flap';

type Props = {
  enabled: boolean;
  monogram: string;
  template?: RevealTemplate;
};

const OPEN_MS = 1200;

export function RevealOverlay({ enabled, monogram, template = 'four-flap' }: Props) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setGone(true), OPEN_MS);
    return () => clearTimeout(t);
  }, [open]);

  if (!enabled || !mounted || gone) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden">
      {template === 'four-flap' ? (
        <FourFlapEnvelope monogram={monogram} open={open} onOpen={() => setOpen(true)} />
      ) : null}
    </div>
  );
}
