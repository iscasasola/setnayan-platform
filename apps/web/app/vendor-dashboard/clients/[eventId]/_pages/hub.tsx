/**
 * 🗂 HUB — a picked-client page (THE ONE BUILD, 8 Nov 2026 · v113; ruling 7 Nov: "the Hub setup stays on Hub; the
 * client page gets Open Hub").
 *
 * ⚠ STUB pushed by L2 at hour 0. OWNER OF THIS FILE: **C2** (B2 §2.5). Shown only for a BOOKED client. Until C2
 * lands the body it is the door to the shipped home of every Hub — nothing about the Hub is copied here.
 */
import Link from 'next/link';
import type { PickedPageProps } from './context';

export function HubPage({ shipped }: PickedPageProps) {
  if (shipped) return <>{shipped}</>;
  return (
    <div className="px-1 py-6 text-center">
      <p className="text-sm text-ink/60">Set up this event&rsquo;s Hub and play it from your Hub page.</p>
      <Link
        href="/vendor-dashboard/on-the-day"
        className="mt-3 inline-flex min-h-[44px] items-center rounded-full bg-ink px-4 text-sm font-semibold text-cream"
      >
        Open Hub
      </Link>
    </div>
  );
}
