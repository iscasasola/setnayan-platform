import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { AwardLab } from './award-lab';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * /dev/award-lab — THE SHARED AWARD UI KIT ON SAMPLE DATA (supplier badges, seals and rewards, controller build map
 * 2026-11-15, slice K). DEV-ONLY: production builds 404 it, the same kill-switch as every `/dev/*-lab`.
 *
 * It mounts each piece of `app/_components/award` the way a screen will — the reward tickets in their three states,
 * the full-screen badge, the gold seal plaque, and the story video behind "Share to story" — so the kit can be checked
 * on a phone before the badge screens (slice B) mount it for real. This is the harness the PR's screenshots came from.
 * Names are samples: nobody real.
 */
export default function AwardLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <AwardLab />;
}
