'use client';

/**
 * WebNudgeBanner — "Buy on web for less" banner for mobile (Capacitor) users.
 *
 * Post-2024 Apple ruling allows apps to show a deep-link to the web for
 * external purchases. This banner surfaces the web discount clearly and
 * non-alarmingly — a helpful nudge in Champagne Gold, not a warning.
 *
 * Rendered by tokens and subscription pages; hidden on the web (isNative=false).
 * The component is always in the DOM (SSR renders nothing); the client mounts
 * and reads Capacitor after hydration.
 */

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { isNativeApp } from '@/lib/capacitor';

interface WebNudgeBannerProps {
  /** Copy for the savings claim, e.g. "₱100/token (save ₱50 each)" */
  savingsCopy: string;
  /** Sub-line showing web prices, e.g. "Pro ₱6,000/28d · Enterprise ₱10,000/28d on web" */
  webPricesCopy?: string;
  /** Full URL to the equivalent page on setnayan.com */
  webUrl: string;
}

export function WebNudgeBanner({
  savingsCopy,
  webPricesCopy,
  webUrl,
}: WebNudgeBannerProps) {
  const [native, setNative] = useState(false);

  useEffect(() => {
    setNative(isNativeApp());
  }, []);

  if (!native) return null;

  return (
    <div
      className="mb-5 flex items-start justify-between gap-3 rounded-xl px-4 py-3"
      style={{
        background: 'rgba(212, 175, 55, 0.15)' /* Champagne Gold tint */,
        border: '1px solid rgba(212, 175, 55, 0.40)',
      }}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">
          💡 Buy on our website for less — {savingsCopy}
        </p>
        {webPricesCopy && (
          <p className="mt-0.5 text-xs text-ink/65">{webPricesCopy}</p>
        )}
      </div>
      <a
        href={webUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-ink transition hover:opacity-80"
        style={{ background: 'rgba(212, 175, 55, 0.35)' }}
      >
        Go to website
        <ExternalLink className="h-3 w-3" strokeWidth={2.5} aria-hidden />
      </a>
    </div>
  );
}
