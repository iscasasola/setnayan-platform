import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ScratchCardLab } from './scratch-card-lab';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * /dev/scratch-card-lab — THE SHARED SCRATCH CARD ON SAMPLE CONTENT. DEV-ONLY: production builds 404 it, the same
 * kill-switch as every `/dev/*-lab`.
 *
 * It mounts `app/_components/scratch-card.tsx` the way the couple's "a supplier's gift landed" unwrap will — the gold
 * cover, a cover image, the reveal by scratching, the controlled `revealed`, and `disabled` — so the canvas (strokes,
 * the sheen, the dust, a rotate mid-scratch, reduced motion) can be tried on a real phone before a screen mounts it.
 * Nothing here is anybody's real gift.
 */
export default function ScratchCardLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <ScratchCardLab />;
}
